/*
 * ioBroker adapter for the Samba Solar Track controller.
 *
 * The device is the head: tracking and storm protection work without this adapter. The adapter
 * connects to the device (HTTP and WebSocket on port 80), mirrors its status into states,
 * receives every message the firmware writes to its log and passes on commands written to the
 * states under `control`. The device checks every command itself; storm protection, limit
 * switches and runtime monitoring cannot be bypassed from here.
 *
 * Log tags: [cfg] configuration, [obj] objects, [conn] connection, [rx] received frames,
 * [tx] sent frames, [dev] messages and events of the device, [msg] message handling,
 * [cmd] commands, [jog] manual drive, [par] settings and setup of the device, [ntf] notifications,
 * [unload] shutdown.
 */
import * as utils from "@iobroker/adapter-core";
import { DeviceClient } from "./lib/device-client";
import { EVENT_CATEGORIES, EventDetector, type EventCategory } from "./lib/events";
import {
    DEVICE_LEVELS,
    MessageStore,
    formatMessage,
    hostLevel,
    isFault,
    parseHistory,
    shouldForward,
    type ForwardLevel,
    type Message,
} from "./lib/messages";
import {
    TOKEN_HINT,
    assembleToken,
    isObject,
    migrateOldToken,
    resumeSince,
    tokenSummary,
    type DeviceInfo,
    type DeviceStatus,
    type HelloFrame,
    type LogLine,
    type LostFrame,
} from "./lib/protocol";
import { messagingOptions, supportedLanguage, translate, type Language } from "./lib/notifications";
import {
    groupName,
    paramCommon,
    paramStateId,
    parseParams,
    pendingMap,
    readParamResult,
    toDeviceValue,
    type ParamEntry,
} from "./lib/params";
import { RemoteControl, reasonText, type Axis, type Command, type CommandResult } from "./lib/remote-control";
import { NODES, STATES, infoToValues, statusToValues, type StateValue } from "./lib/states";

/** Values that change constantly (uptime, memory, signal) are written at most this often */
const VOLATILE_INTERVAL_MS = 30000;
/** Messages are collected for this time before the message states are written */
const MESSAGE_FLUSH_MS = 1000;
/** Forwarded messages older than this carry their own time in the text */
const MESSAGE_AGE_HINT_MS = 5000;
/** Limits of the setting "notify after this many minutes without connection" */
const CONNECTION_MINUTES_MIN = 1;
const CONNECTION_MINUTES_MAX = 1440;
const CONNECTION_MINUTES_DEFAULT = 5;
/** Limits of the setting "number of messages in the history" */
const HISTORY_MIN = 1;
const HISTORY_MAX = 500;
const HISTORY_DEFAULT = 50;

const VOLATILE_IDS = new Set(STATES.filter(def => def.volatile).map(def => def.id));

/** State of the manual drive for each axis */
const JOG_STATE: Record<Axis, string> = { elevation: "control.jogElevation", azimuth: "control.jogAzimuth" };

class SambaSolarTrack extends utils.Adapter {
    private client: DeviceClient | undefined;
    private remote: RemoteControl | undefined;
    /** What the firmware can do, from GET /api/info */
    private features = new Set<string>();
    /** Reason of the last failure per kind of command; the same reason is reported only once */
    private readonly commandProblems = new Map<string, string>();
    private readonly events = new EventDetector();
    /** Messaging instance for notifications, empty = notifications are off */
    private messagingInstance = "";
    private readonly notifyCategories = new Set<EventCategory>();
    /** Language of the notifications: the language of the system */
    private notifyLanguage: Language = "en";
    private connectionMinutes = CONNECTION_MINUTES_DEFAULT;
    private connectionTimer: ioBroker.Timeout | undefined;
    private connectionLostNotified = false;
    /** Settings of the device by their key, from GET /api/params */
    private readonly params = new Map<string, ParamEntry>();
    /** Setup values chosen in ioBroker that are not saved at the device yet */
    private stagedSetup: { mode?: number; windSensor?: number } = {};
    private store = new MessageStore(HISTORY_DEFAULT);
    private readonly cache = new Map<string, StateValue>();
    private forwardLevel: ForwardLevel = "W";
    private bootEpoch = 0;
    private volatileWritten = 0;
    private pending: Message[] = [];
    private flushTimer: ioBroker.Timeout | undefined;
    private lostReported = false;
    private stopping = false;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: "samba-solar-track",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        await this.setState("info.connection", false, true);

        const host = String(this.config.ip ?? "").trim();
        const port = Number(this.config.port);
        if (!host) {
            this.log.error(
                "[cfg] No address of the device configured. Enter the IP address or host name in the adapter settings.",
            );
            return;
        }
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            this.log.error(
                `[cfg] Invalid port "${String(this.config.port)}". Allowed: 1 to 65535, the device uses 80.`,
            );
            return;
        }
        // the four fields of the settings, as the display shows the token; the old single field
        // of version 0.0.4 and older counts only while the four fields are empty
        const tokenSetting = assembleToken(
            [this.config.tokenBlock1, this.config.tokenBlock2, this.config.tokenBlock3, this.config.tokenBlock4],
            this.config.token,
        );
        this.log.debug(
            `[cfg] Token: four fields with ${tokenSetting.blockLengths.join("/")} characters, ` +
                `old token field with ${tokenSetting.oldLength} characters (whitespace removed) -> ${tokenSummary(tokenSetting)}`,
        );
        if (tokenSetting.source === "blocks" && tokenSetting.oldLength > 0) {
            this.log.debug("[cfg] Token: the four fields are used, the old token field is ignored");
        }
        // Since 0.0.6 the settings show only the four fields: move a token of the old single field
        // there once, or empty the old field when the four fields are in use. The settings are
        // written encrypted, and js-controller restarts the adapter; until then this run goes on
        // with the token assembled above.
        const migration = migrateOldToken(
            [this.config.tokenBlock1, this.config.tokenBlock2, this.config.tokenBlock3, this.config.tokenBlock4],
            this.config.token,
        );
        if (migration) {
            const update: Record<string, string> = { token: "" };
            migration.blocks?.forEach((block, index) => (update[`tokenBlock${index + 1}`] = block));
            try {
                await this.updateConfig(update);
                this.log.info(
                    migration.blocks
                        ? "[cfg] Token: moved from the old token field into the four fields (the settings show only these since 0.0.6)"
                        : "[cfg] Token: the old token field was emptied, the four fields are used",
                );
            } catch (e) {
                this.log.warn(
                    `[cfg] Token: the old token field could not be moved into the four fields (${(e as Error).message}); it is still used`,
                );
            }
        }
        if (tokenSetting.problem) {
            this.log.error(
                `[cfg] The token in the adapter settings cannot be used: ${tokenSetting.problem}. ${TOKEN_HINT} ` +
                    "Until then the adapter only reads.",
            );
        }
        const token = tokenSetting.token;
        const configuredLevel = String(this.config.forwardLevel ?? "W");
        if (configuredLevel === "off" || (DEVICE_LEVELS as readonly string[]).includes(configuredLevel)) {
            this.forwardLevel = configuredLevel as ForwardLevel;
        } else {
            this.log.debug(`[cfg] Unknown forwardLevel "${configuredLevel}", using "W"`);
        }
        let historySize = Math.round(Number(this.config.historySize));
        if (!Number.isFinite(historySize)) {
            historySize = HISTORY_DEFAULT;
        }
        historySize = Math.min(HISTORY_MAX, Math.max(HISTORY_MIN, historySize));
        this.store = new MessageStore(historySize);
        this.log.info(
            `[cfg] Device ${host}:${port}, ${tokenSummary(tokenSetting)}, ` +
                `messages forwarded to this log from level "${this.forwardLevel}", history ${historySize} messages`,
        );

        this.setupNotifications();
        await this.createObjects();
        await this.restorePosition();

        const timers = {
            set: (callback: () => void, ms: number): unknown => this.setTimeout(callback, ms),
            clear: (handle: unknown): void => this.clearTimeout(handle as ioBroker.Timeout),
        };
        this.remote = new RemoteControl({
            send: frame => this.client?.send(frame) ?? false,
            timers,
            log: this.log,
            onJogEnd: (axis, reason) => this.onJogEnd(axis, reason),
        });
        this.client = new DeviceClient({
            host,
            port,
            token,
            log: this.log,
            timers,
            events: {
                onInfo: info => this.onInfo(info),
                onHello: hello => this.onHello(hello),
                onStatus: status => this.onStatus(status),
                onLog: line => this.onLog(line),
                onLost: lost => this.onLost(lost),
                onConnection: connected => this.onConnection(connected),
                onResult: (id, ok, reason) => this.remote?.handleResult(id, ok, reason),
                onParams: changed => this.onParams(changed),
            },
        });
        this.subscribeStates("control.*");
        this.subscribeStates("setup.*");
        this.subscribeStates("params.*");
        this.armConnectionTimer();
        this.client.start();
    }

    /** Reads the settings for notifications and the language of the system */
    private setupNotifications(): void {
        const config = this.config as unknown as Record<string, unknown>;
        const instance = typeof config.messagingInstance === "string" ? config.messagingInstance.trim() : "";
        this.messagingInstance = config.notifyEnabled === true ? instance : "";
        for (const category of EVENT_CATEGORIES) {
            const key = `notify${category.charAt(0).toUpperCase()}${category.slice(1)}`;
            if (config[key] === true) {
                this.notifyCategories.add(category);
            }
        }
        const minutes = Math.round(Number(config.notifyConnectionMinutes));
        this.connectionMinutes = Number.isFinite(minutes)
            ? Math.min(CONNECTION_MINUTES_MAX, Math.max(CONNECTION_MINUTES_MIN, minutes))
            : CONNECTION_MINUTES_DEFAULT;
        // adapter-core knows the language of the system
        this.notifyLanguage = supportedLanguage(this.language);
        if (config.notifyEnabled === true && !instance) {
            this.log.warn(
                "[ntf] Notifications are switched on, but no messaging instance is chosen in the adapter settings.",
            );
        }
        this.log.info(
            this.messagingInstance
                ? `[ntf] Notifications to ${this.messagingInstance} for: ${[...this.notifyCategories].join(", ") || "nothing"} ` +
                      `(language ${this.notifyLanguage}, connection after ${this.connectionMinutes} min)`
                : "[ntf] Notifications are switched off",
        );
    }

    /**
     * Sends a notification through the chosen messaging adapter, if this kind of event is wanted.
     *
     * @param category kind of event
     * @param key key of the text
     * @param params values for the placeholders
     */
    private notify(category: EventCategory, key: string, params: Record<string, string | number>): void {
        if (!this.messagingInstance) {
            this.log.silly(`[ntf] ${category}/${key} not sent: notifications are switched off`);
            return;
        }
        if (!this.notifyCategories.has(category)) {
            this.log.debug(`[ntf] ${category}/${key} not sent: this kind of event is not selected`);
            return;
        }
        const name = this.cache.get("info.hostname");
        const text = translate(key, this.notifyLanguage, {
            name: typeof name === "string" && name ? name : "Samba Solar Track",
            ...params,
        });
        try {
            // "text" and "message": the common messaging adapters read one of the two
            this.sendTo(this.messagingInstance, "send", { text, message: text });
            this.log.debug(`[ntf] ${category}/${key} sent to ${this.messagingInstance}: ${text}`);
        } catch (error) {
            this.log.warn(
                `[ntf] Notification to ${this.messagingInstance} failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Answers questions of the settings page: the list of messaging instances.
     *
     * @param obj the message
     */
    private async onMessage(obj: ioBroker.Message): Promise<void> {
        if (obj.command !== "getMessagingInstances") {
            this.log.debug(`[cfg] Message "${obj.command}" from ${obj.from} ignored: unknown command`);
            return;
        }
        this.log.debug(`[cfg] Message "${obj.command}" from ${obj.from} received`);
        let options: { value: string; label: string }[] = [];
        try {
            const view = await this.getObjectViewAsync("system", "instance", {
                startkey: "system.adapter.",
                endkey: "system.adapter.\u9999",
            });
            options = messagingOptions(view.rows.map(row => row.id));
        } catch (error) {
            this.log.debug(
                `[cfg] Reading the instances failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
        this.log.debug(`[cfg] ${options.length} messaging instance(s) reported to ${obj.from}`);
        if (obj.callback) {
            this.sendTo(obj.from, obj.command, options, obj.callback);
        }
    }

    /** Starts the time after which a missing connection is worth a notification */
    private armConnectionTimer(): void {
        if (this.connectionTimer || this.stopping) {
            return;
        }
        this.connectionTimer = this.setTimeout(() => {
            this.connectionTimer = undefined;
            this.connectionLostNotified = true;
            this.notify("connection", "connectionLost", { minutes: this.connectionMinutes });
        }, this.connectionMinutes * 60000);
    }

    /** Creates or updates all channels and states. Settings made by the user are kept. */
    private async createObjects(): Promise<void> {
        const started = Date.now();
        for (const node of NODES) {
            await this.extendObject(node.id, { type: node.type, common: { name: node.name }, native: {} });
        }
        for (const def of STATES) {
            const common: Partial<ioBroker.StateCommon> = {
                name: def.name,
                type: def.type,
                role: def.role,
                read: def.read !== false,
                write: def.write === true,
            };
            if (def.min !== undefined) {
                common.min = def.min;
            }
            if (def.max !== undefined) {
                common.max = def.max;
            }
            if (def.unit) {
                common.unit = def.unit;
            }
            if (def.states) {
                common.states = def.states;
            }
            await this.extendObject(def.id, { type: "state", common, native: {} });
        }
        this.log.debug(
            `[obj] ${NODES.length} channels and ${STATES.length} states created or updated in ${Date.now() - started} ms`,
        );
    }

    /** Reads where the message stream ended in the last run, so nothing is fetched twice */
    private async restorePosition(): Promise<void> {
        const [bootId, lastSeq, history] = await Promise.all([
            this.getStateAsync("info.bootId"),
            this.getStateAsync("messages.lastSeq"),
            this.getStateAsync("messages.history"),
        ]);
        const messages = parseHistory(history?.val);
        const knownBootId = typeof bootId?.val === "string" && bootId.val ? bootId.val : undefined;
        const knownSeq = typeof lastSeq?.val === "number" ? lastSeq.val : 0;
        this.store.restore(knownBootId, knownSeq, messages);
        this.writeValue("messages.lost", 0);
        this.log.debug(
            `[msg] Position of the last run: bootId ${knownBootId ?? "unknown"}, last sequence number ${knownSeq}, ` +
                `${messages.length} message(s) in the history`,
        );
    }

    /**
     * Writes a value when it differs from the last written one.
     *
     * @param id id of the state
     * @param value new value
     */
    private writeValue(id: string, value: StateValue): void {
        if (this.cache.get(id) === value && this.cache.has(id)) {
            return;
        }
        this.cache.set(id, value);
        this.setState(id, { val: value, ack: true }).catch((error: unknown) => {
            // happens when the adapter stops while frames are still arriving
            this.log.debug(`[obj] Writing ${id} failed: ${error instanceof Error ? error.message : String(error)}`);
        });
    }

    /**
     * Writes all changed values. Values that change constantly are written only every 30 s.
     *
     * @param values state id => value
     */
    private writeValues(values: Map<string, StateValue>): void {
        const now = Date.now();
        const volatileDue = now - this.volatileWritten >= VOLATILE_INTERVAL_MS;
        if (volatileDue) {
            this.volatileWritten = now;
        }
        for (const [id, value] of values) {
            if (VOLATILE_IDS.has(id) && !volatileDue) {
                continue;
            }
            this.writeValue(id, value);
        }
    }

    /**
     * Writes a value in any case, for example to take back a command that was not executed.
     *
     * @param id id of the state
     * @param value new value
     */
    private forceValue(id: string, value: StateValue): void {
        this.cache.delete(id);
        this.writeValue(id, value);
    }

    private onInfo(info: DeviceInfo): void {
        this.features = new Set(info.features);
        this.writeValues(infoToValues(info));
        if (info.simulation) {
            this.log.debug("[dev] The device runs its simulation: no value is a real measurement");
        }
    }

    private onHello(hello: HelloFrame): number {
        const since = resumeSince(hello, this.store.bootId, this.store.lastSeq);
        const previous = this.store.bootId;
        if (this.store.setBootId(hello.bootId)) {
            this.log.info(
                `[dev] The device has restarted (boot id ${previous} -> ${hello.bootId}); its messages are fetched from the beginning`,
            );
            const reason = this.cache.get("info.resetReason");
            this.notify("restart", "deviceRestarted", { reason: typeof reason === "string" && reason ? reason : "?" });
        }
        this.bootEpoch = Date.now() - hello.uptimeMs;
        this.volatileWritten = 0;
        this.writeValue("info.bootId", hello.bootId);
        this.writeValue("info.bootTime", Math.round(this.bootEpoch / 1000) * 1000);
        this.writeValue("info.authorized", hello.auth);
        return since;
    }

    private onStatus(status: DeviceStatus): void {
        if (typeof status.uptimeMs === "number") {
            this.bootEpoch = Date.now() - status.uptimeMs;
        }
        const before = this.cache.get("status.state");
        this.writeValues(statusToValues(status));
        const after = this.cache.get("status.state");
        if (before !== after) {
            this.log.debug(`[dev] State ${String(before ?? "unknown")} -> ${String(after)}`);
        }
        if (isObject(status.jog) && typeof status.jog.active === "boolean") {
            this.remote?.handleStatus(status.jog.active);
        }
        for (const event of this.events.update(status)) {
            this.log.debug(`[ntf] Event ${event.category}/${event.key} ${JSON.stringify(event.params)}`);
            this.notify(event.category, event.key, event.params);
        }
    }

    private onLog(line: LogLine): void {
        const { message, gap } = this.store.add(line, this.bootEpoch);
        if (!message) {
            this.log.debug(`[msg] Message #${line.seq} skipped: already received (last ${this.store.lastSeq})`);
            return;
        }
        if (gap > 0) {
            this.log.debug(`[msg] ${gap} message(s) missing before #${line.seq}`);
        }
        this.pending.push(message);
        if (shouldForward(message.lvl, this.forwardLevel)) {
            const age = Date.now() - message.ts;
            const time = age > MESSAGE_AGE_HINT_MS ? ` (device time ${new Date(message.ts).toISOString()})` : "";
            this.log[hostLevel(message.lvl)](`[dev] #${message.seq} ${formatMessage(message)}${time}`);
        }
        if (!this.flushTimer && !this.stopping) {
            this.flushTimer = this.setTimeout(() => {
                this.flushTimer = undefined;
                this.flushMessages();
            }, MESSAGE_FLUSH_MS);
        }
    }

    private onLost(lost: LostFrame): void {
        this.store.addLost(lost.count, lost.to);
        this.writeValue("messages.lost", this.store.lost);
        const text =
            `[msg] ${lost.count} message(s) of the device are lost (#${lost.from} to #${lost.to}): ` +
            `they were overwritten in the device before the adapter could fetch them`;
        if (this.lostReported) {
            this.log.debug(text);
        } else {
            this.lostReported = true;
            this.log.warn(text);
        }
    }

    private onConnection(connected: boolean): void {
        this.writeValue("info.connection", connected);
        if (connected) {
            this.lostReported = false;
            if (this.connectionTimer) {
                this.clearTimeout(this.connectionTimer);
                this.connectionTimer = undefined;
            }
            if (this.connectionLostNotified) {
                this.connectionLostNotified = false;
                this.notify("connection", "connectionRestored", {});
            }
            void this.loadParams();
        } else {
            this.flushMessages();
            this.remote?.handleDisconnect();
            this.armConnectionTimer();
        }
    }

    /** Reads all settings of the device and creates or updates their states */
    private async loadParams(): Promise<void> {
        if (!this.client || !this.features.has("params")) {
            this.log.debug("[par] Settings skipped: the firmware does not offer them");
            return;
        }
        const started = Date.now();
        let list: unknown;
        try {
            const answer = await this.client.getJson("/api/params");
            list = isObject(answer) ? answer.params : undefined;
        } catch (error) {
            this.log.debug(
                `[par] Reading the settings failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            return;
        }
        const { entries, dropped } = parseParams(list);
        if (dropped > 0) {
            this.log.debug(`[par] ${dropped} setting(s) of the device ignored: unknown type or name`);
        }
        const groups = new Set<string>();
        const wanted = new Set<string>();
        try {
            for (const entry of entries) {
                if (!groups.has(entry.group)) {
                    groups.add(entry.group);
                    await this.extendObject(`params.${entry.group}`, {
                        type: "channel",
                        common: { name: groupName(entry.group) },
                        native: {},
                    });
                }
                const id = paramStateId(entry);
                wanted.add(`${this.namespace}.${id}`);
                await this.extendObject(id, {
                    type: "state",
                    common: paramCommon(entry) as unknown as ioBroker.StateCommon,
                    native: { key: entry.key, apply: entry.apply },
                });
            }
            // settings the device no longer offers (other operating mode or wind sensor)
            const existing = await this.getAdapterObjectsAsync();
            let removed = 0;
            for (const [id, object] of Object.entries(existing)) {
                const local = id.slice(this.namespace.length + 1);
                const dynamic = local.startsWith("params.") && local.split(".").length === 3;
                if (dynamic && object.type === "state" && !wanted.has(id)) {
                    await this.delObjectAsync(local);
                    this.cache.delete(local);
                    removed++;
                }
            }
            this.params.clear();
            for (const entry of entries) {
                this.params.set(entry.key, entry);
                this.writeValue(paramStateId(entry), entry.value);
            }
            this.writeValue("params.pending", JSON.stringify(pendingMap(this.params.values())));
            this.log.debug(
                `[par] ${entries.length} setting(s) in ${groups.size} group(s) read in ${Date.now() - started} ms, ` +
                    `${removed} outdated state(s) removed`,
            );
        } catch (error) {
            // happens when the adapter stops while the objects are written
            this.log.debug(
                `[par] Creating the states failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Settings or proposals have changed at the device.
     *
     * @param changed entries like in GET /api/params
     */
    private onParams(changed: unknown): void {
        const { entries, dropped } = parseParams(changed);
        if (dropped > 0) {
            this.log.debug(`[par] ${dropped} changed setting(s) ignored: unknown type or name`);
        }
        let unknown = false;
        for (const entry of entries) {
            const before = this.params.get(entry.key);
            if (!before) {
                unknown = true;
                continue;
            }
            this.params.set(entry.key, entry);
            this.writeValue(paramStateId(entry), entry.value);
            if (before.pending !== null && entry.pending === null) {
                this.log.info(
                    entry.value === before.pending
                        ? `[par] ${entry.key}: the proposal ${String(before.pending)} was confirmed at the display`
                        : `[par] ${entry.key}: the proposal ${String(before.pending)} was not accepted, the value stays ${String(entry.value)}`,
                );
            } else if (before.value !== entry.value) {
                this.log.debug(
                    `[par] ${entry.key}: ${String(before.value)} -> ${String(entry.value)} (reported by the device)`,
                );
            }
        }
        this.writeValue("params.pending", JSON.stringify(pendingMap(this.params.values())));
        if (unknown) {
            this.log.debug(
                "[par] The device reports a setting this adapter has no state for: reading all settings again",
            );
            void this.loadParams();
        }
    }

    /**
     * Is called if a subscribed state changes: commands written to the states under `control`.
     *
     * @param id full id of the state
     * @param state new state, null when it was deleted
     */
    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (!state || state.ack) {
            // values with ack are confirmations written by this adapter
            return;
        }
        const local = id.slice(this.namespace.length + 1);
        const source = state.from ?? "unknown";
        switch (local) {
            case "control.auto":
                void this.runSwitch("auto", "command", local, state.val, source);
                break;
            case "control.park":
                void this.runSwitch("park", "park", local, state.val, source);
                break;
            case "control.acknowledge":
                void this.runAcknowledge(local, source);
                break;
            case JOG_STATE.elevation:
                void this.runJog("elevation", state.val, source);
                break;
            case JOG_STATE.azimuth:
                void this.runJog("azimuth", state.val, source);
                break;
            case "control.design":
                void this.runValue("design", local, state.val, source);
                break;
            case "control.endSimulation":
                void this.runValue("simulation", local, false, source);
                break;
            case "setup.mode":
                this.stageSetup("mode", local, state.val, source);
                break;
            case "setup.windSensor":
                this.stageSetup("windSensor", local, state.val, source);
                break;
            case "setup.save":
                void this.runSetup(local, source);
                break;
            default:
                if (this.paramByStateId(local)) {
                    void this.runParam(local, state.val, source);
                } else {
                    this.log.debug(`[cmd] Write to ${local} from ${source} ignored: this state is not a command`);
                }
        }
    }

    /**
     * Finds the setting that belongs to a state.
     *
     * @param local id of the state relative to the instance
     */
    private paramByStateId(local: string): ParamEntry | undefined {
        for (const entry of this.params.values()) {
            if (paramStateId(entry) === local) {
                return entry;
            }
        }
        return undefined;
    }

    /**
     * Sends values to POST /api/params.
     *
     * @param values key => value
     * @returns the parsed answer, or a reason why the request failed as a whole
     */
    private async postValues(values: Record<string, number | boolean>): Promise<{ answer?: unknown; reason?: string }> {
        const blocked = this.precheck("params");
        if (blocked || !this.client) {
            return { reason: blocked ?? "disconnected" };
        }
        try {
            const { status, json } = await this.client.postJson("/api/params", { values });
            if (isObject(json) && json.ok === true) {
                return { answer: json };
            }
            const reason = isObject(json) && typeof json.reason === "string" ? json.reason : `HTTP ${status}`;
            return { reason };
        } catch (error) {
            this.log.debug(`[par] POST /api/params failed: ${error instanceof Error ? error.message : String(error)}`);
            return { reason: "timeout" };
        }
    }

    /**
     * Notes the result of a change in `params.lastResult` and in the log.
     *
     * @param key key of the setting
     * @param value value that was written
     * @param result applied, pending or rejected
     * @param reason why it was rejected
     * @param source who wrote the value
     */
    private reportParam(key: string, value: unknown, result: string, reason: string | undefined, source: string): void {
        this.forceValue(
            "params.lastResult",
            JSON.stringify({
                ts: Date.now(),
                key,
                value: value as StateValue,
                result,
                reason: reason ?? null,
                text: reasonText(reason),
                from: source,
            }),
        );
        const kind = `param:${key}`;
        if (result !== "rejected") {
            this.commandProblems.delete(kind);
            return;
        }
        const text = `[par] ${key} = ${String(value)} from ${source} was not accepted: ${reason} (${reasonText(reason)})`;
        if (reason === "same" || this.commandProblems.get(kind) === reason) {
            // nothing to change, or the same refusal again
            this.log.debug(text);
        } else {
            this.commandProblems.set(kind, reason ?? "unknown");
            this.log.warn(text);
        }
    }

    private async runParam(id: string, value: ioBroker.StateValue, source: string): Promise<void> {
        const entry = this.paramByStateId(id);
        if (!entry) {
            return;
        }
        const wanted = toDeviceValue(entry, value);
        if (wanted === undefined) {
            this.reportParam(entry.key, value, "rejected", "type", source);
            this.forceValue(id, entry.value);
            return;
        }
        if (wanted === entry.value && entry.pending === null) {
            this.log.debug(`[par] ${entry.key} = ${String(wanted)} from ${source}: already valid, nothing sent`);
            this.forceValue(id, entry.value);
            return;
        }
        const { answer, reason } = await this.postValues({ [entry.key]: wanted });
        const result = answer === undefined ? undefined : readParamResult(answer, entry.key);
        const current = this.params.get(entry.key) ?? entry;
        if (!result) {
            this.reportParam(entry.key, wanted, "rejected", reason ?? "answer", source);
            this.forceValue(id, current.value);
            return;
        }
        if (result.result === "applied") {
            const now = result.value ?? wanted;
            this.log.info(`[par] ${entry.key}: ${String(entry.value)} -> ${String(now)} (from ${source})`);
            this.params.set(entry.key, { ...current, value: now, pending: null });
            this.forceValue(id, now);
        } else if (result.result === "pending") {
            this.log.info(
                `[par] ${entry.key}: ${String(result.pending ?? wanted)} proposed (from ${source}); ` +
                    `it becomes valid when it is confirmed at the display, until then ${String(current.value)} stays`,
            );
            this.params.set(entry.key, { ...current, pending: result.pending ?? wanted });
            this.forceValue(id, current.value);
        } else {
            this.forceValue(id, current.value);
        }
        this.writeValue("params.pending", JSON.stringify(pendingMap(this.params.values())));
        this.reportParam(entry.key, wanted, result.result, result.reason, source);
    }

    /**
     * Changes a value that is no setting of the list: the design or the end of the simulation.
     *
     * @param key "design" or "simulation"
     * @param id id of the state
     * @param value value that was written
     * @param source who wrote the value
     */
    private async runValue(key: "design" | "simulation", id: string, value: unknown, source: string): Promise<void> {
        const wanted = key === "simulation" ? false : value;
        const before = this.cache.get(id);
        if (typeof wanted !== "number" && typeof wanted !== "boolean") {
            this.reportParam(key, value, "rejected", "type", source);
            this.forceValue(id, this.cache.get(id) ?? null);
            return;
        }
        const { answer, reason } = await this.postValues({ [key]: wanted });
        const result = answer === undefined ? undefined : readParamResult(answer, key);
        const accepted = result?.result === "applied";
        if (accepted) {
            this.log.info(
                key === "simulation"
                    ? `[par] The simulation is ended (from ${source}); the device restarts`
                    : `[par] design: ${String(before)} -> ${String(wanted)} (from ${source})`,
            );
        }
        this.reportParam(
            key,
            wanted,
            accepted ? "applied" : "rejected",
            result?.reason ?? reason ?? (accepted ? undefined : "answer"),
            source,
        );
        if (key === "simulation") {
            this.forceValue(id, accepted);
        } else {
            this.forceValue(id, accepted ? wanted : (this.cache.get(id) ?? null));
        }
    }

    /**
     * Remembers a setup value that will be saved with `setup.save`.
     *
     * @param key which value
     * @param id id of the state
     * @param value value that was written
     * @param source who wrote the value
     */
    private stageSetup(key: "mode" | "windSensor", id: string, value: unknown, source: string): void {
        if (value !== 1 && value !== 2) {
            this.reportParam(key, value, "rejected", "range", source);
            this.forceValue(id, this.cache.get(id) ?? null);
            return;
        }
        this.stagedSetup[key] = value;
        this.log.debug(`[par] Setup: ${key} = ${value} chosen by ${source}; it is sent to the device with setup.save`);
    }

    private async runSetup(id: string, source: string): Promise<void> {
        const currentMode = this.cache.get("status.mode");
        const currentWind = this.cache.get("status.windSensor");
        const mode = this.stagedSetup.mode ?? currentMode;
        const windSensor = this.stagedSetup.windSensor ?? currentWind;
        const blocked = this.precheck("setup");
        let reason = blocked;
        if (!reason && (typeof mode !== "number" || typeof windSensor !== "number")) {
            reason = "disconnected";
        }
        if (!reason && mode === currentMode && windSensor === currentWind) {
            reason = "same";
        }
        if (!reason && this.client) {
            try {
                const { status, json } = await this.client.postJson("/api/setup", { mode, windSensor });
                if (!(isObject(json) && json.ok === true)) {
                    reason = isObject(json) && typeof json.reason === "string" ? json.reason : `HTTP ${status}`;
                }
            } catch (error) {
                this.log.debug(
                    `[par] POST /api/setup failed: ${error instanceof Error ? error.message : String(error)}`,
                );
                reason = "timeout";
            }
        }
        const what = `mode ${String(mode)}, windSensor ${String(windSensor)}`;
        if (reason) {
            // back to what the device reports
            this.stagedSetup = {};
            this.forceValue("setup.mode", currentMode ?? null);
            this.forceValue("setup.windSensor", currentWind ?? null);
            this.reportParam("setup", what, "rejected", reason, source);
        } else {
            this.stagedSetup = {};
            this.log.info(
                `[par] Setup saved (from ${source}): mode ${String(currentMode)} -> ${String(mode)}, ` +
                    `windSensor ${String(currentWind)} -> ${String(windSensor)}; the device restarts`,
            );
            this.reportParam("setup", what, "applied", undefined, source);
        }
        this.forceValue(id, !reason);
    }

    /**
     * Checks what can be decided without asking the device.
     *
     * @param feature what the firmware has to support
     * @returns the reason why the command cannot be sent, or undefined
     */
    private precheck(feature: string): string | undefined {
        if (!this.remote || !this.client) {
            return "disconnected";
        }
        if (this.client.readOnly) {
            return "protocol";
        }
        if (this.cache.get("info.connection") === true && !this.features.has(feature)) {
            return "unsupported";
        }
        return undefined;
    }

    /**
     * Notes the result of a command in `control.lastResult` and in the log. A failure is a
     * warning; while the same failure repeats it is logged at debug level only.
     *
     * @param kind kind of command, failures are remembered per kind
     * @param what the command in words
     * @param result result of the command
     * @param source who gave the command
     * @param ended true = a running manual drive was ended, false = a command was refused
     */
    private report(kind: string, what: string, result: CommandResult, source: string, ended = false): void {
        this.forceValue(
            "control.lastResult",
            JSON.stringify({
                ts: Date.now(),
                command: what,
                ok: result.ok,
                reason: result.reason ?? null,
                text: reasonText(result.reason),
                from: source,
            }),
        );
        if (result.ok) {
            this.commandProblems.delete(kind);
            return;
        }
        const reason = result.reason ?? "unknown";
        const text = ended
            ? `[jog] The manual drive "${what}" was stopped: ${reason} (${reasonText(reason)})`
            : `[cmd] "${what}" from ${source} was not executed: ${reason} (${reasonText(reason)})`;
        if (this.commandProblems.get(kind) === reason) {
            this.log.debug(text);
        } else {
            this.commandProblems.set(kind, reason);
            this.log.warn(text);
        }
    }

    private async runSwitch(cmd: Command, feature: string, id: string, value: unknown, source: string): Promise<void> {
        const on = value === true || value === 1 || value === "true";
        const blocked = this.precheck(feature);
        const result =
            blocked || !this.remote
                ? { ok: false, reason: blocked ?? "disconnected", durationMs: 0 }
                : await this.remote.command(cmd, on, source);
        this.report(cmd, `${cmd} ${on ? "on" : "off"}`, result, source);
        // accepted: confirm the value; refused: back to what the device reports
        this.forceValue(id, result.ok ? on : (this.cache.get(id) ?? null));
    }

    private async runAcknowledge(id: string, source: string): Promise<void> {
        const blocked = this.precheck("command");
        const result =
            blocked || !this.remote
                ? { ok: false, reason: blocked ?? "disconnected", durationMs: 0 }
                : await this.remote.command("ack", undefined, source);
        this.report("ack", "acknowledge", result, source);
        this.forceValue(id, result.ok);
    }

    private async runJog(axis: Axis, value: unknown, source: string): Promise<void> {
        const id = JOG_STATE[axis];
        const dir = value === 1 || value === -1 || value === 0 ? value : undefined;
        if (dir === undefined) {
            this.report("jog", `jog ${axis} ${String(value)}`, { ok: false, reason: "range", durationMs: 0 }, source);
            this.forceValue(id, 0);
            return;
        }
        const running = this.remote?.jogging;
        if (dir !== 0 && running?.axis === axis && running.dir === dir) {
            // the writer keeps the drive alive (dead man); nothing to report
            await this.remote?.jog(axis, dir, source);
            return;
        }
        const blocked = dir !== 0 ? this.precheck("jog") : undefined;
        const result =
            blocked || !this.remote
                ? { ok: false, reason: blocked ?? "disconnected", durationMs: 0 }
                : await this.remote.jog(axis, dir, source);
        this.report("jog", `jog ${axis} ${dir === 0 ? "stop" : dir}`, result, source);
        if (running && running.axis !== axis && dir !== 0) {
            // the device drives one axis at a time: the other drive has ended
            this.forceValue(JOG_STATE[running.axis], 0);
        }
        this.forceValue(id, result.ok ? dir : 0);
    }

    /**
     * A manual drive ended without a stop command: dead man, the device or a lost connection.
     *
     * @param axis axis that was driving
     * @param reason why it ended
     */
    private onJogEnd(axis: Axis, reason: string): void {
        this.report("jog", `jog ${axis}`, { ok: false, reason, durationMs: 0 }, "the adapter", true);
        this.forceValue(JOG_STATE[axis], 0);
    }

    /** Writes the collected messages to the message states */
    private flushMessages(): void {
        if (!this.pending.length) {
            return;
        }
        const batch = this.pending;
        this.pending = [];
        const newest = batch[batch.length - 1];
        this.writeValue("messages.history", JSON.stringify(this.store.messages));
        this.writeValue("messages.last", formatMessage(newest));
        this.writeValue("messages.lastJson", JSON.stringify(newest));
        this.writeValue("messages.lastSeq", this.store.lastSeq);
        this.writeValue("messages.lost", this.store.lost);
        for (let i = batch.length - 1; i >= 0; i--) {
            if (isFault(batch[i].lvl)) {
                this.writeValue("messages.lastFault", formatMessage(batch[i]));
                break;
            }
        }
        this.log.debug(`[msg] ${batch.length} message(s) written, last sequence number ${this.store.lastSeq}`);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback has to be called when everything is cleaned up
     */
    private onUnload(callback: () => void): void {
        try {
            this.stopping = true;
            this.log.debug("[unload] Stopping: closing the connection and clearing timers");
            // a running manual drive gets its stop command before the connection closes
            this.remote?.stop();
            this.remote = undefined;
            this.client?.stop();
            this.client = undefined;
            if (this.flushTimer) {
                this.clearTimeout(this.flushTimer);
                this.flushTimer = undefined;
            }
            if (this.connectionTimer) {
                this.clearTimeout(this.connectionTimer);
                this.connectionTimer = undefined;
            }
            this.flushMessages();
            this.writeValue("info.connection", false);
            callback();
        } catch (error) {
            this.log.debug(`[unload] ${error instanceof Error ? error.message : String(error)}`);
            callback();
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new SambaSolarTrack(options);
} else {
    // otherwise start the instance directly
    (() => new SambaSolarTrack())();
}
