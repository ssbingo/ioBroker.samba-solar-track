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
 * [cmd] commands, [jog] manual drive, [unload] shutdown.
 */
import * as utils from "@iobroker/adapter-core";
import { DeviceClient } from "./lib/device-client";
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
    isObject,
    resumeSince,
    type DeviceInfo,
    type DeviceStatus,
    type HelloFrame,
    type LogLine,
    type LostFrame,
} from "./lib/protocol";
import { RemoteControl, reasonText, type Axis, type Command, type CommandResult } from "./lib/remote-control";
import { NODES, STATES, infoToValues, statusToValues, type StateValue } from "./lib/states";

/** Values that change constantly (uptime, memory, signal) are written at most this often */
const VOLATILE_INTERVAL_MS = 30000;
/** Messages are collected for this time before the message states are written */
const MESSAGE_FLUSH_MS = 1000;
/** Forwarded messages older than this carry their own time in the text */
const MESSAGE_AGE_HINT_MS = 5000;
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
        this.on("unload", this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        await this.setState("info.connection", false, true);

        const host = String(this.config.ip ?? "").trim();
        const port = Number(this.config.port);
        const token = String(this.config.token ?? "").trim();
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
            `[cfg] Device ${host}:${port}, token ${token ? `set (${token.length} characters)` : "not set (read only)"}, ` +
                `messages forwarded to this log from level "${this.forwardLevel}", history ${historySize} messages`,
        );

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
            },
        });
        this.subscribeStates("control.*");
        this.client.start();
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
        } else {
            this.flushMessages();
            this.remote?.handleDisconnect();
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
            default:
                this.log.debug(`[cmd] Write to ${local} from ${source} ignored: this state is not a command`);
        }
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
