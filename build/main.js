"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_device_client = require("./lib/device-client");
var import_events = require("./lib/events");
var import_i18n = require("./lib/i18n");
var import_messages = require("./lib/messages");
var import_protocol = require("./lib/protocol");
var import_notifications = require("./lib/notifications");
var import_params = require("./lib/params");
var import_remote_control = require("./lib/remote-control");
var import_states = require("./lib/states");
const VOLATILE_INTERVAL_MS = 3e4;
const MESSAGE_FLUSH_MS = 1e3;
const MESSAGE_AGE_HINT_MS = 5e3;
const CONNECTION_MINUTES_MIN = 1;
const CONNECTION_MINUTES_MAX = 1440;
const CONNECTION_MINUTES_DEFAULT = 5;
const HISTORY_MIN = 1;
const HISTORY_MAX = 500;
const HISTORY_DEFAULT = 50;
const VOLATILE_IDS = new Set(import_states.STATES.filter((def) => def.volatile).map((def) => def.id));
const REPORT_COUNT = 3;
function stateCommon(def) {
  const common = {
    name: (0, import_i18n.fullName)(def.name),
    type: def.type,
    role: def.role,
    read: def.read !== false,
    write: def.write === true
  };
  if (def.min !== void 0) {
    common.min = def.min;
  }
  if (def.max !== void 0) {
    common.max = def.max;
  }
  if (def.unit) {
    common.unit = def.unit;
  }
  if (def.states) {
    common.states = def.states;
  }
  return common;
}
const JOG_STATE = { elevation: "control.jogElevation", azimuth: "control.jogAzimuth" };
class SambaSolarTrack extends utils.Adapter {
  client;
  remote;
  /** What the firmware can do, from GET /api/info */
  features = /* @__PURE__ */ new Set();
  /** Reason of the last failure per kind of command; the same reason is reported only once */
  commandProblems = /* @__PURE__ */ new Map();
  events = new import_events.EventDetector();
  /** Messaging instance for notifications, empty = notifications are off */
  messagingInstance = "";
  notifyCategories = /* @__PURE__ */ new Set();
  /** Language of the notifications: the language of the system */
  notifyLanguage = "en";
  connectionMinutes = CONNECTION_MINUTES_DEFAULT;
  connectionTimer;
  connectionLostNotified = false;
  /** Settings of the device by their key, from GET /api/params */
  params = /* @__PURE__ */ new Map();
  /** true while loadParams() reads the settings and creates their states */
  paramsLoading = false;
  /** writes to settings that arrived while loadParams() was running, replayed afterwards */
  deferredParamWrites = /* @__PURE__ */ new Map();
  /** Setup values chosen in ioBroker that are not saved at the device yet */
  stagedSetup = {};
  store = new import_messages.MessageStore(HISTORY_DEFAULT);
  cache = /* @__PURE__ */ new Map();
  forwardLevel = "W";
  bootEpoch = 0;
  volatileWritten = 0;
  pending = [];
  flushTimer;
  lostReported = false;
  stopping = false;
  /** Features and operating mode the conditional objects were last created for */
  layoutKey = "";
  /** Changes of the objects and the status writes after them run one after another */
  objectQueue = Promise.resolve();
  /** `axes.elevation.flatDir` the names of the elevation states were written for */
  flatDir = 1;
  /** The test reports are read with the next status (after connecting) */
  reportsDue = false;
  reportsLoading = false;
  reportsAgain = false;
  constructor(options = {}) {
    super({
      ...options,
      name: "samba-solar-track"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    var _a, _b, _c;
    await this.setState("info.connection", false, true);
    const host = String((_a = this.config.ip) != null ? _a : "").trim();
    const port = Number(this.config.port);
    if (!host) {
      this.log.error(
        "[cfg] No address of the device configured. Enter the IP address or host name in the adapter settings."
      );
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      this.log.error(
        `[cfg] Invalid port "${String(this.config.port)}". Allowed: 1 to 65535, the device uses 80.`
      );
      return;
    }
    const tokenSetting = (0, import_protocol.assembleToken)(
      [this.config.tokenBlock1, this.config.tokenBlock2, this.config.tokenBlock3, this.config.tokenBlock4],
      this.config.token
    );
    this.log.debug(
      `[cfg] Token: four fields with ${tokenSetting.blockLengths.join("/")} characters, old token field with ${tokenSetting.oldLength} characters (whitespace removed) -> ${(0, import_protocol.tokenSummary)(tokenSetting)}`
    );
    if (tokenSetting.source === "blocks" && tokenSetting.oldLength > 0) {
      this.log.debug("[cfg] Token: the four fields are used, the old token field is ignored");
    }
    const migration = (0, import_protocol.migrateOldToken)(
      [this.config.tokenBlock1, this.config.tokenBlock2, this.config.tokenBlock3, this.config.tokenBlock4],
      this.config.token
    );
    if (migration) {
      const update = { token: "" };
      (_b = migration.blocks) == null ? void 0 : _b.forEach((block, index) => update[`tokenBlock${index + 1}`] = block);
      try {
        await this.updateConfig(update);
        this.log.info(
          migration.blocks ? "[cfg] Token: moved from the old token field into the four fields (the settings show only these since 0.0.6); js-controller restarts the adapter" : "[cfg] Token: the old token field was emptied, the four fields are used; js-controller restarts the adapter"
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.log.warn(
          migration.blocks ? `[cfg] Token: the old token field could not be moved into the four fields (${reason}); this run uses it, the next start tries again` : `[cfg] Token: the old token field could not be emptied (${reason}); the four fields are used, the next start tries again`
        );
        if (error instanceof Error && error.stack) {
          this.log.debug(`[cfg] Token: ${error.stack}`);
        }
      }
    }
    if (tokenSetting.problem) {
      this.log.error(
        `[cfg] The token in the adapter settings cannot be used: ${tokenSetting.problem}. ${import_protocol.TOKEN_HINT} Until then the adapter only reads.`
      );
    }
    const token = tokenSetting.token;
    const configuredLevel = String((_c = this.config.forwardLevel) != null ? _c : "W");
    if (configuredLevel === "off" || import_messages.DEVICE_LEVELS.includes(configuredLevel)) {
      this.forwardLevel = configuredLevel;
    } else {
      this.log.debug(`[cfg] Unknown forwardLevel "${configuredLevel}", using "W"`);
    }
    let historySize = Math.round(Number(this.config.historySize));
    if (!Number.isFinite(historySize)) {
      historySize = HISTORY_DEFAULT;
    }
    historySize = Math.min(HISTORY_MAX, Math.max(HISTORY_MIN, historySize));
    this.store = new import_messages.MessageStore(historySize);
    this.log.info(
      `[cfg] Device ${host}:${port}, ${(0, import_protocol.tokenSummary)(tokenSetting)}, messages forwarded to this log from level "${this.forwardLevel}", history ${historySize} messages`
    );
    this.setupNotifications();
    await this.createObjects();
    await this.restorePosition();
    if (this.stopping) {
      this.log.debug("[cfg] Start not continued: the adapter is stopping");
      return;
    }
    const timers = {
      set: (callback, ms) => this.setTimeout(callback, ms),
      clear: (handle) => this.clearTimeout(handle)
    };
    this.remote = new import_remote_control.RemoteControl({
      send: (frame) => {
        var _a2, _b2;
        return (_b2 = (_a2 = this.client) == null ? void 0 : _a2.send(frame)) != null ? _b2 : false;
      },
      timers,
      log: this.log,
      onJogEnd: (axis, reason) => this.onJogEnd(axis, reason)
    });
    this.client = new import_device_client.DeviceClient({
      host,
      port,
      token,
      log: this.log,
      timers,
      events: {
        onInfo: (info) => this.onInfo(info),
        onHello: (hello) => this.onHello(hello),
        onStatus: (status) => this.onStatus(status),
        onLog: (line) => this.onLog(line),
        onLost: (lost) => this.onLost(lost),
        onConnection: (connected) => this.onConnection(connected),
        onResult: (id, ok, reason, detail) => {
          var _a2;
          return (_a2 = this.remote) == null ? void 0 : _a2.handleResult(id, ok, reason, detail);
        },
        onParams: (changed) => this.onParams(changed)
      }
    });
    this.subscribeStates("control.*");
    this.subscribeStates("setup.*");
    this.subscribeStates("params.*");
    this.armConnectionTimer();
    this.client.start();
  }
  /** Reads the settings for notifications and the language of the system */
  setupNotifications() {
    const config = this.config;
    const instance = typeof config.messagingInstance === "string" ? config.messagingInstance.trim() : "";
    this.messagingInstance = config.notifyEnabled === true ? instance : "";
    for (const category of import_events.EVENT_CATEGORIES) {
      const key = `notify${category.charAt(0).toUpperCase()}${category.slice(1)}`;
      if (config[key] === true) {
        this.notifyCategories.add(category);
      }
    }
    const minutes = Math.round(Number(config.notifyConnectionMinutes));
    this.connectionMinutes = Number.isFinite(minutes) ? Math.min(CONNECTION_MINUTES_MAX, Math.max(CONNECTION_MINUTES_MIN, minutes)) : CONNECTION_MINUTES_DEFAULT;
    this.notifyLanguage = (0, import_notifications.supportedLanguage)(this.language);
    if (config.notifyEnabled === true && !instance) {
      this.log.warn(
        "[ntf] Notifications are switched on, but no messaging instance is chosen in the adapter settings."
      );
    }
    this.log.info(
      this.messagingInstance ? `[ntf] Notifications to ${this.messagingInstance} for: ${[...this.notifyCategories].join(", ") || "nothing"} (language ${this.notifyLanguage}, connection after ${this.connectionMinutes} min)` : "[ntf] Notifications are switched off"
    );
  }
  /**
   * Sends a notification through the chosen messaging adapter, if this kind of event is wanted.
   *
   * @param category kind of event
   * @param key key of the text
   * @param params values for the placeholders
   */
  notify(category, key, params) {
    if (!this.messagingInstance) {
      this.log.silly(`[ntf] ${category}/${key} not sent: notifications are switched off`);
      return;
    }
    if (!this.notifyCategories.has(category)) {
      this.log.debug(`[ntf] ${category}/${key} not sent: this kind of event is not selected`);
      return;
    }
    const name = this.cache.get("info.hostname");
    const text = (0, import_notifications.translate)(key, this.notifyLanguage, {
      name: typeof name === "string" && name ? name : "Samba Solar Track",
      ...params
    });
    try {
      this.sendTo(this.messagingInstance, "send", { text, message: text });
      this.log.debug(`[ntf] ${category}/${key} sent to ${this.messagingInstance}: ${text}`);
    } catch (error) {
      this.log.warn(
        `[ntf] Notification to ${this.messagingInstance} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  /**
   * Answers questions of the settings page: the list of messaging instances.
   *
   * @param obj the message
   */
  async onMessage(obj) {
    if (obj.command !== "getMessagingInstances") {
      this.log.debug(`[cfg] Message "${obj.command}" from ${obj.from} ignored: unknown command`);
      return;
    }
    this.log.debug(`[cfg] Message "${obj.command}" from ${obj.from} received`);
    let options = [];
    try {
      const view = await this.getObjectViewAsync("system", "instance", {
        startkey: "system.adapter.",
        endkey: "system.adapter.\u9999"
      });
      options = (0, import_notifications.messagingOptions)(view.rows.map((row) => row.id));
    } catch (error) {
      this.log.debug(
        `[cfg] Reading the instances failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    this.log.debug(`[cfg] ${options.length} messaging instance(s) reported to ${obj.from}`);
    if (obj.callback) {
      this.sendTo(obj.from, obj.command, options, obj.callback);
    }
  }
  /** Starts the time after which a missing connection is worth a notification */
  armConnectionTimer() {
    if (this.connectionTimer || this.stopping) {
      return;
    }
    this.connectionTimer = this.setTimeout(() => {
      this.connectionTimer = void 0;
      this.connectionLostNotified = true;
      this.notify("connection", "connectionLost", { minutes: this.connectionMinutes });
    }, this.connectionMinutes * 6e4);
  }
  /**
   * Creates or updates the channels and states every firmware has. Settings made by the user
   * are kept. The objects that depend on features and operating mode follow in syncLayout.
   */
  async createObjects() {
    const started = Date.now();
    const nodes = import_states.NODES.filter((node) => !(0, import_states.isConditional)(node));
    const states = import_states.STATES.filter((def) => !(0, import_states.isConditional)(def));
    for (const node of nodes) {
      await this.extendObject(node.id, { type: node.type, common: { name: (0, import_i18n.fullName)(node.name) }, native: {} });
    }
    for (const def of states) {
      await this.extendObject(def.id, { type: "state", common: stateCommon(def), native: {} });
    }
    this.flatDir = 1;
    this.log.debug(
      `[obj] ${nodes.length} channels and ${states.length} states created or updated in ${Date.now() - started} ms`
    );
  }
  /**
   * Creates the channels and states of the features the firmware reports and of the operating
   * mode, and removes those that no longer exist (other firmware or other operating mode).
   *
   * @param layout features and operating mode of the device
   */
  async syncLayout(layout) {
    const started = Date.now();
    let created = 0;
    let removed = 0;
    try {
      const existing = await this.getAdapterObjectsAsync();
      const exists = (id) => `${this.namespace}.${id}` in existing;
      const nodes = import_states.NODES.filter(import_states.isConditional);
      for (const node of nodes.filter((n) => (0, import_states.isAvailable)(n, layout))) {
        await this.extendObject(node.id, {
          type: node.type,
          common: { name: (0, import_i18n.fullName)(node.name) },
          native: {}
        });
      }
      for (const def of import_states.STATES.filter(import_states.isConditional)) {
        if ((0, import_states.isAvailable)(def, layout)) {
          await this.extendObject(def.id, { type: "state", common: stateCommon(def), native: {} });
          created++;
        } else if (exists(def.id)) {
          await this.delObjectAsync(def.id);
          this.cache.delete(def.id);
          removed++;
        }
      }
      for (const node of [...nodes].reverse()) {
        if (!(0, import_states.isAvailable)(node, layout) && exists(node.id)) {
          await this.delObjectAsync(node.id);
          removed++;
        }
      }
      this.log.debug(
        `[obj] Objects for features ${[...layout.features].join(",") || "-"} and mode ${String(layout.mode)}: ${created} state(s) created or updated, ${removed} object(s) removed in ${Date.now() - started} ms`
      );
    } catch (error) {
      this.log.debug(
        `[obj] Creating the objects of the features failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  /**
   * Writes the names of the elevation states again when the flat position lies in the other
   * direction: display and web page show STEEPER and FLATTER instead of the outputs.
   *
   * @param flatDir value of `axes.elevation.flatDir`
   */
  async relabelElevation(flatDir) {
    try {
      for (const def of (0, import_states.elevationLabelStates)(flatDir)) {
        await this.extendObject(def.id, { common: stateCommon(def) });
      }
      this.log.debug(
        `[obj] Names of the elevation states written for the flat position in direction ${flatDir === -1 ? "MINUS" : "PLUS"}`
      );
    } catch (error) {
      this.log.debug(
        `[obj] Writing the names of the elevation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  /** Reads where the message stream ended in the last run, so nothing is fetched twice */
  async restorePosition() {
    const [bootId, lastSeq, history] = await Promise.all([
      this.getStateAsync("info.bootId"),
      this.getStateAsync("messages.lastSeq"),
      this.getStateAsync("messages.history")
    ]);
    const messages = (0, import_messages.parseHistory)(history == null ? void 0 : history.val);
    const knownBootId = typeof (bootId == null ? void 0 : bootId.val) === "string" && bootId.val ? bootId.val : void 0;
    const knownSeq = typeof (lastSeq == null ? void 0 : lastSeq.val) === "number" ? lastSeq.val : 0;
    this.store.restore(knownBootId, knownSeq, messages);
    this.writeValue("messages.lost", 0);
    this.log.debug(
      `[msg] Position of the last run: bootId ${knownBootId != null ? knownBootId : "unknown"}, last sequence number ${knownSeq}, ${messages.length} message(s) in the history`
    );
  }
  /**
   * Writes a value when it differs from the last written one.
   *
   * @param id id of the state
   * @param value new value
   */
  writeValue(id, value) {
    if (this.cache.get(id) === value && this.cache.has(id)) {
      return;
    }
    this.cache.set(id, value);
    this.setState(id, { val: value, ack: true }).catch((error) => {
      this.log.debug(`[obj] Writing ${id} failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
  /**
   * Writes all changed values. Values that change constantly are written only every 30 s.
   *
   * @param values state id => value
   */
  writeValues(values) {
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
  forceValue(id, value) {
    this.cache.delete(id);
    this.writeValue(id, value);
  }
  onInfo(info) {
    this.features = new Set(info.features);
    this.writeValues((0, import_states.infoToValues)(info));
    if (info.simulation) {
      this.log.debug("[dev] The device runs its simulation: no value is a real measurement");
    }
  }
  onHello(hello) {
    const since = (0, import_protocol.resumeSince)(hello, this.store.bootId, this.store.lastSeq);
    const previous = this.store.bootId;
    if (this.store.setBootId(hello.bootId)) {
      this.log.info(
        `[dev] The device has restarted (boot id ${previous} -> ${hello.bootId}); its messages are fetched from the beginning`
      );
      const reason = this.cache.get("info.resetReason");
      this.notify("restart", "deviceRestarted", { reason: typeof reason === "string" && reason ? reason : "?" });
    }
    this.bootEpoch = Date.now() - hello.uptimeMs;
    this.volatileWritten = 0;
    this.writeValue("info.bootId", hello.bootId);
    this.writeValue("info.bootTime", Math.round(this.bootEpoch / 1e3) * 1e3);
    this.writeValue("info.authorized", hello.auth);
    return since;
  }
  onStatus(status) {
    var _a;
    if (typeof status.uptimeMs === "number") {
      this.bootEpoch = Date.now() - status.uptimeMs;
    }
    if ((0, import_protocol.isObject)(status.jog) && typeof status.jog.active === "boolean") {
      (_a = this.remote) == null ? void 0 : _a.handleStatus(status.jog.active);
    }
    const layout = {
      features: new Set(this.features),
      mode: typeof status.mode === "number" ? status.mode : void 0
    };
    const key = `${[...layout.features].sort().join(",")}|${String(layout.mode)}`;
    if (key !== this.layoutKey) {
      this.log.debug(`[obj] Features or operating mode changed (${this.layoutKey || "none"} -> ${key})`);
      this.layoutKey = key;
      this.enqueue(() => this.syncLayout(layout));
    }
    const flatDir = (0, import_protocol.readPath)(status, "axes.elevation.flatDir") === -1 ? -1 : 1;
    if (flatDir !== this.flatDir) {
      this.flatDir = flatDir;
      this.enqueue(() => this.relabelElevation(flatDir));
    }
    this.enqueue(() => this.applyStatus(status, layout));
  }
  /**
   * Runs a step after the steps before it; a failing step does not stop the following ones.
   *
   * @param task the step
   */
  enqueue(task) {
    this.objectQueue = this.objectQueue.then(task).catch((error) => {
      var _a;
      this.log.debug(`[obj] ${error instanceof Error ? (_a = error.stack) != null ? _a : error.message : String(error)}`);
    });
  }
  /**
   * Writes a status into the states and evaluates it.
   *
   * @param status the status of the device
   * @param layout features and operating mode the objects exist for
   */
  applyStatus(status, layout) {
    if (this.stopping) {
      return;
    }
    const before = this.cache.get("status.state");
    const doneBefore = this.cache.get("commissioning.done");
    const activeBefore = this.cache.get("commissioning.active");
    this.writeValues((0, import_states.statusToValues)(status, layout));
    const after = this.cache.get("status.state");
    if (before !== after) {
      this.log.debug(`[dev] State ${String(before != null ? before : "unknown")} -> ${String(after)}`);
    }
    for (const event of this.events.update(status)) {
      this.log.debug(`[ntf] Event ${event.category}/${event.key} ${JSON.stringify(event.params)}`);
      this.notify(event.category, event.key, event.params);
    }
    if (!layout.features.has("commissioning")) {
      return;
    }
    const done = this.cache.get("commissioning.done");
    const active = this.cache.get("commissioning.active");
    let reason = "";
    if (this.reportsDue) {
      reason = "connected";
    } else if (done !== doneBefore) {
      reason = `setup program completed ${String(doneBefore)} -> ${String(done)}`;
    } else if (activeBefore === true && active === false) {
      reason = "setup program closed at the display";
    }
    if (reason) {
      this.reportsDue = false;
      void this.loadReports(reason);
    }
  }
  /**
   * Reads the test reports, one run at a time; a request during a run starts one more run.
   *
   * @param reason why, for the log
   */
  async loadReports(reason) {
    if (this.reportsLoading) {
      this.log.debug(`[rep] Reading the test reports (${reason}) follows the run in progress`);
      this.reportsAgain = true;
      return;
    }
    this.reportsLoading = true;
    try {
      let why = reason;
      do {
        this.reportsAgain = false;
        await this.readReports(why);
        why = "requested during the last run";
      } while (this.reportsAgain && !this.stopping);
    } finally {
      this.reportsLoading = false;
    }
  }
  /**
   * Reads the three test reports as text (GET /api/report?n=0..2) and the newest as data set
   * (feature reportjson). "No report under this number" (409) is no error.
   *
   * @param reason why, for the log
   */
  async readReports(reason) {
    const client = this.client;
    if (!client) {
      this.log.debug(`[rep] Test reports (${reason}) skipped: not connected`);
      return;
    }
    const started = Date.now();
    const present = [];
    for (let n = 0; n < REPORT_COUNT; n++) {
      try {
        const { status, text } = await client.getText(`/api/report?n=${n}`);
        if (status === 200) {
          present.push(n);
          this.writeValue(`commissioning.report${n}`, text);
        } else if (status === 409) {
          this.writeValue(`commissioning.report${n}`, "");
        } else {
          this.log.debug(`[rep] Test report ${n}: HTTP ${status}, ${text.slice(0, 200)}`);
        }
      } catch (error) {
        this.log.debug(
          `[rep] Reading test report ${n} failed: ${error instanceof Error ? error.message : String(error)}`
        );
        return;
      }
    }
    let dataSet = "not offered by the firmware";
    if (this.features.has("reportjson")) {
      try {
        const { status, text } = await client.getText("/api/report?n=0&format=json");
        let parsed;
        if (status === 200) {
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = void 0;
          }
        }
        if (status === 200 && (0, import_protocol.isObject)(parsed)) {
          dataSet = "read";
        } else if (status === 409) {
          dataSet = "none";
        } else {
          dataSet = `not usable (HTTP ${status})`;
          parsed = void 0;
        }
        if (status === 200 || status === 409) {
          for (const [id, value] of (0, import_states.reportToValues)(parsed)) {
            this.writeValue(id, value);
          }
        }
      } catch (error) {
        dataSet = `failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    this.log.debug(
      `[rep] Test reports read (${reason}): ${present.length ? `number(s) ${present.join(", ")} present` : "none present"}, data set of the newest ${dataSet}, in ${Date.now() - started} ms`
    );
  }
  onLog(line) {
    const { message, gap } = this.store.add(line, this.bootEpoch);
    if (!message) {
      this.log.debug(`[msg] Message #${line.seq} skipped: already received (last ${this.store.lastSeq})`);
      return;
    }
    if (gap > 0) {
      this.log.debug(`[msg] ${gap} message(s) missing before #${line.seq}`);
    }
    this.pending.push(message);
    if ((0, import_messages.shouldForward)(message.lvl, this.forwardLevel)) {
      const age = Date.now() - message.ts;
      const time = age > MESSAGE_AGE_HINT_MS ? ` (device time ${new Date(message.ts).toISOString()})` : "";
      this.log[(0, import_messages.hostLevel)(message.lvl)](`[dev] #${message.seq} ${(0, import_messages.formatMessage)(message)}${time}`);
    }
    if (!this.flushTimer && !this.stopping) {
      this.flushTimer = this.setTimeout(() => {
        this.flushTimer = void 0;
        this.flushMessages();
      }, MESSAGE_FLUSH_MS);
    }
  }
  onLost(lost) {
    this.store.addLost(lost.count, lost.to);
    this.writeValue("messages.lost", this.store.lost);
    const text = `[msg] ${lost.count} message(s) of the device are lost (#${lost.from} to #${lost.to}): they were overwritten in the device before the adapter could fetch them`;
    if (this.lostReported) {
      this.log.debug(text);
    } else {
      this.lostReported = true;
      this.log.warn(text);
    }
  }
  onConnection(connected) {
    var _a;
    this.writeValue("info.connection", connected);
    if (connected) {
      this.lostReported = false;
      if (this.connectionTimer) {
        this.clearTimeout(this.connectionTimer);
        this.connectionTimer = void 0;
      }
      if (this.connectionLostNotified) {
        this.connectionLostNotified = false;
        this.notify("connection", "connectionRestored", {});
      }
      this.reportsDue = true;
      void this.loadParams();
    } else {
      this.flushMessages();
      (_a = this.remote) == null ? void 0 : _a.handleDisconnect();
      this.armConnectionTimer();
    }
  }
  /** Reads all settings of the device and creates or updates their states */
  async loadParams() {
    if (!this.client || !this.features.has("params")) {
      this.log.debug("[par] Settings skipped: the firmware does not offer them");
      return;
    }
    this.paramsLoading = true;
    try {
      await this.loadParamsNow();
    } finally {
      this.paramsLoading = false;
      this.replayDeferredParamWrites();
    }
  }
  /** Sends the writes to settings that arrived while the settings were loaded */
  replayDeferredParamWrites() {
    if (this.deferredParamWrites.size === 0) {
      return;
    }
    const writes = [...this.deferredParamWrites.entries()];
    this.deferredParamWrites.clear();
    for (const [local, { value, source }] of writes) {
      if (this.paramByStateId(local)) {
        this.log.debug(`[par] Write to ${local} from ${source} sent after loading the settings`);
        void this.runParam(local, value, source);
      } else {
        this.log.debug(
          `[par] Write to ${local} from ${source} ignored: the device does not offer this setting`
        );
      }
    }
  }
  /** Body of loadParams(): reads the settings and creates or updates their states */
  async loadParamsNow() {
    if (!this.client) {
      return;
    }
    const started = Date.now();
    let list;
    try {
      const answer = await this.client.getJson("/api/params");
      list = (0, import_protocol.isObject)(answer) ? answer.params : void 0;
    } catch (error) {
      this.log.debug(
        `[par] Reading the settings failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }
    const { entries, dropped } = (0, import_params.parseParams)(list);
    if (dropped > 0) {
      this.log.debug(`[par] ${dropped} setting(s) of the device ignored: unknown type or name`);
    }
    const groups = /* @__PURE__ */ new Set();
    const wanted = /* @__PURE__ */ new Set();
    try {
      for (const entry of entries) {
        if (!groups.has(entry.group)) {
          groups.add(entry.group);
          await this.extendObject(`params.${entry.group}`, {
            type: "channel",
            common: { name: (0, import_params.groupName)(entry.group) },
            native: {}
          });
        }
        const id = (0, import_params.paramStateId)(entry);
        wanted.add(`${this.namespace}.${id}`);
        await this.extendObject(id, {
          type: "state",
          common: (0, import_params.paramCommon)(entry),
          native: { key: entry.key, apply: entry.apply }
        });
      }
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
        this.writeValue((0, import_params.paramStateId)(entry), entry.value);
      }
      this.writeValue("params.pending", JSON.stringify((0, import_params.pendingMap)(this.params.values())));
      this.log.debug(
        `[par] ${entries.length} setting(s) in ${groups.size} group(s) read in ${Date.now() - started} ms, ${removed} outdated state(s) removed`
      );
    } catch (error) {
      this.log.debug(
        `[par] Creating the states failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  /**
   * Settings or proposals have changed at the device.
   *
   * @param changed entries like in GET /api/params
   */
  onParams(changed) {
    const { entries, dropped } = (0, import_params.parseParams)(changed);
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
      this.writeValue((0, import_params.paramStateId)(entry), entry.value);
      if (before.pending !== null && entry.pending === null) {
        this.log.info(
          entry.value === before.pending ? `[par] ${entry.key}: the proposal ${String(before.pending)} was confirmed at the display` : `[par] ${entry.key}: the proposal ${String(before.pending)} was not accepted, the value stays ${String(entry.value)}`
        );
      } else if (before.value !== entry.value) {
        this.log.debug(
          `[par] ${entry.key}: ${String(before.value)} -> ${String(entry.value)} (reported by the device)`
        );
      }
    }
    this.writeValue("params.pending", JSON.stringify((0, import_params.pendingMap)(this.params.values())));
    if (unknown) {
      this.log.debug(
        "[par] The device reports a setting this adapter has no state for: reading all settings again"
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
  onStateChange(id, state) {
    var _a;
    if (!state || state.ack) {
      return;
    }
    const local = id.slice(this.namespace.length + 1);
    const source = (_a = state.from) != null ? _a : "unknown";
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
      case "control.position":
        void this.runPosition(local, state.val, source);
        break;
      case "control.positionResume":
        void this.runButton("position", { on: false }, "position off (continue the automatic)", local, source);
        break;
      case "control.syncResetElevation":
        void this.runButton(
          "syncReset",
          { axis: "elevation" },
          "reset of the synchronous control elevation",
          local,
          source
        );
        break;
      case "control.syncResetAzimuth":
        void this.runButton(
          "syncReset",
          { axis: "azimuth" },
          "reset of the synchronous control azimuth",
          local,
          source
        );
        break;
      case "control.fwCheck":
        void this.runButton("fwCheck", {}, "check for newer firmware", local, source);
        break;
      case "control.fwInstall":
        void this.runFwInstall(local, state.val, source);
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
        } else if (this.paramsLoading && local.startsWith("params.") && local.split(".").length === 3) {
          this.deferredParamWrites.set(local, { value: state.val, source });
          this.log.debug(`[par] Write to ${local} from ${source} held until the settings are loaded`);
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
  paramByStateId(local) {
    for (const entry of this.params.values()) {
      if ((0, import_params.paramStateId)(entry) === local) {
        return entry;
      }
    }
    return void 0;
  }
  /**
   * Sends values to POST /api/params.
   *
   * @param values key => value
   * @returns the parsed answer, or a reason why the request failed as a whole
   */
  async postValues(values) {
    const blocked = this.precheck("params");
    if (blocked || !this.client) {
      return { reason: blocked != null ? blocked : "disconnected" };
    }
    try {
      const { status, json } = await this.client.postJson("/api/params", { values });
      if ((0, import_protocol.isObject)(json) && json.ok === true) {
        return { answer: json };
      }
      const reason = (0, import_protocol.isObject)(json) && typeof json.reason === "string" ? json.reason : `HTTP ${status}`;
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
  reportParam(key, value, result, reason, source) {
    this.forceValue(
      "params.lastResult",
      JSON.stringify({
        ts: Date.now(),
        key,
        value,
        result,
        reason: reason != null ? reason : null,
        text: (0, import_remote_control.reasonText)(reason),
        from: source
      })
    );
    const kind = `param:${key}`;
    if (result !== "rejected") {
      this.commandProblems.delete(kind);
      return;
    }
    const text = `[par] ${key} = ${String(value)} from ${source} was not accepted: ${reason} (${(0, import_remote_control.reasonText)(reason)})`;
    if (reason === "same" || this.commandProblems.get(kind) === reason) {
      this.log.debug(text);
    } else {
      this.commandProblems.set(kind, reason != null ? reason : "unknown");
      this.log.warn(text);
    }
  }
  async runParam(id, value, source) {
    var _a, _b, _c, _d;
    const entry = this.paramByStateId(id);
    if (!entry) {
      return;
    }
    const wanted = (0, import_params.toDeviceValue)(entry, value);
    if (wanted === void 0) {
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
    const result = answer === void 0 ? void 0 : (0, import_params.readParamResult)(answer, entry.key);
    const current = (_a = this.params.get(entry.key)) != null ? _a : entry;
    if (!result) {
      this.reportParam(entry.key, wanted, "rejected", reason != null ? reason : "answer", source);
      this.forceValue(id, current.value);
      return;
    }
    if (result.result === "applied") {
      const now = (_b = result.value) != null ? _b : wanted;
      this.log.info(`[par] ${entry.key}: ${String(entry.value)} -> ${String(now)} (from ${source})`);
      this.params.set(entry.key, { ...current, value: now, pending: null });
      this.forceValue(id, now);
    } else if (result.result === "pending") {
      this.log.info(
        `[par] ${entry.key}: ${String((_c = result.pending) != null ? _c : wanted)} proposed (from ${source}); it becomes valid when it is confirmed at the display, until then ${String(current.value)} stays`
      );
      this.params.set(entry.key, { ...current, pending: (_d = result.pending) != null ? _d : wanted });
      this.forceValue(id, current.value);
    } else {
      this.forceValue(id, current.value);
    }
    this.writeValue("params.pending", JSON.stringify((0, import_params.pendingMap)(this.params.values())));
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
  async runValue(key, id, value, source) {
    var _a, _b, _c, _d;
    const wanted = key === "simulation" ? false : value;
    const before = this.cache.get(id);
    if (typeof wanted !== "number" && typeof wanted !== "boolean") {
      this.reportParam(key, value, "rejected", "type", source);
      this.forceValue(id, (_a = this.cache.get(id)) != null ? _a : null);
      return;
    }
    const { answer, reason } = await this.postValues({ [key]: wanted });
    const result = answer === void 0 ? void 0 : (0, import_params.readParamResult)(answer, key);
    const accepted = (result == null ? void 0 : result.result) === "applied";
    if (accepted) {
      this.log.info(
        key === "simulation" ? `[par] The simulation is ended (from ${source}); the device restarts` : `[par] design: ${String(before)} -> ${String(wanted)} (from ${source})`
      );
    }
    this.reportParam(
      key,
      wanted,
      accepted ? "applied" : "rejected",
      (_c = (_b = result == null ? void 0 : result.reason) != null ? _b : reason) != null ? _c : accepted ? void 0 : "answer",
      source
    );
    if (key === "simulation") {
      this.forceValue(id, accepted);
    } else {
      this.forceValue(id, accepted ? wanted : (_d = this.cache.get(id)) != null ? _d : null);
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
  stageSetup(key, id, value, source) {
    var _a;
    if (value !== 1 && value !== 2) {
      this.reportParam(key, value, "rejected", "range", source);
      this.forceValue(id, (_a = this.cache.get(id)) != null ? _a : null);
      return;
    }
    this.stagedSetup[key] = value;
    this.log.debug(`[par] Setup: ${key} = ${value} chosen by ${source}; it is sent to the device with setup.save`);
  }
  async runSetup(id, source) {
    var _a, _b;
    const currentMode = this.cache.get("status.mode");
    const currentWind = this.cache.get("status.windSensor");
    const mode = (_a = this.stagedSetup.mode) != null ? _a : currentMode;
    const windSensor = (_b = this.stagedSetup.windSensor) != null ? _b : currentWind;
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
        if (!((0, import_protocol.isObject)(json) && json.ok === true)) {
          reason = (0, import_protocol.isObject)(json) && typeof json.reason === "string" ? json.reason : `HTTP ${status}`;
        }
      } catch (error) {
        this.log.debug(
          `[par] POST /api/setup failed: ${error instanceof Error ? error.message : String(error)}`
        );
        reason = "timeout";
      }
    }
    const what = `mode ${String(mode)}, windSensor ${String(windSensor)}`;
    if (reason) {
      this.stagedSetup = {};
      this.forceValue("setup.mode", currentMode != null ? currentMode : null);
      this.forceValue("setup.windSensor", currentWind != null ? currentWind : null);
      this.reportParam("setup", what, "rejected", reason, source);
    } else {
      this.stagedSetup = {};
      this.log.info(
        `[par] Setup saved (from ${source}): mode ${String(currentMode)} -> ${String(mode)}, windSensor ${String(currentWind)} -> ${String(windSensor)}; the device restarts`
      );
      this.reportParam("setup", what, "applied", void 0, source);
    }
    this.forceValue(id, !reason);
  }
  /**
   * Checks what can be decided without asking the device.
   *
   * @param feature what the firmware has to support
   * @returns the reason why the command cannot be sent, or undefined
   */
  precheck(feature) {
    if (!this.remote || !this.client) {
      return "disconnected";
    }
    if (this.client.readOnly) {
      return "protocol";
    }
    if (this.cache.get("info.connection") === true && !this.features.has(feature)) {
      return "unsupported";
    }
    return void 0;
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
  report(kind, what, result, source, ended = false) {
    var _a, _b, _c;
    this.forceValue(
      "control.lastResult",
      JSON.stringify({
        ts: Date.now(),
        command: what,
        ok: result.ok,
        reason: (_a = result.reason) != null ? _a : null,
        text: (0, import_remote_control.reasonText)(result.reason),
        detail: (_b = result.detail) != null ? _b : null,
        from: source
      })
    );
    if (result.ok) {
      this.commandProblems.delete(kind);
      return;
    }
    const reason = (_c = result.reason) != null ? _c : "unknown";
    const text = ended ? `[jog] The manual drive "${what}" was stopped: ${reason} (${(0, import_remote_control.reasonText)(reason)})` : `[cmd] "${what}" from ${source} was not executed: ${reason} (${(0, import_remote_control.reasonText)(reason)})${result.detail ? `, device: "${result.detail}"` : ""}`;
    if (this.commandProblems.get(kind) === reason) {
      this.log.debug(text);
    } else {
      this.commandProblems.set(kind, reason);
      this.log.warn(text);
    }
  }
  async runSwitch(cmd, feature, id, value, source) {
    var _a;
    const on = value === true || value === 1 || value === "true";
    const blocked = this.precheck(feature);
    const result = blocked || !this.remote ? { ok: false, reason: blocked != null ? blocked : "disconnected", durationMs: 0 } : await this.remote.command(cmd, on, source);
    this.report(cmd, `${cmd} ${on ? "on" : "off"}`, result, source);
    this.forceValue(id, result.ok ? on : (_a = this.cache.get(id)) != null ? _a : null);
  }
  async runAcknowledge(id, source) {
    const blocked = this.precheck("command");
    const result = blocked || !this.remote ? { ok: false, reason: blocked != null ? blocked : "disconnected", durationMs: 0 } : await this.remote.command("ack", void 0, source);
    this.report("ack", "acknowledge", result, source);
    this.forceValue(id, result.ok);
  }
  /**
   * Sends a command with its own fields.
   *
   * @param cmd the command
   * @param fields fields besides `cmd`
   * @param what the command in words
   * @param source who gave the command
   */
  async runCommand(cmd, fields, what, source) {
    const blocked = this.precheck(import_remote_control.COMMAND_FEATURES[cmd]);
    const result = blocked || !this.remote ? { ok: false, reason: blocked != null ? blocked : "disconnected", durationMs: 0 } : await this.remote.commandWith(cmd, fields, source);
    this.report(cmd, what, result, source);
    return result;
  }
  /**
   * A button: reset of the synchronous control, cancel the tilt on command, check for firmware.
   *
   * @param cmd the command
   * @param fields fields besides `cmd`
   * @param what the command in words
   * @param id id of the state
   * @param source who gave the command
   */
  async runButton(cmd, fields, what, id, source) {
    const result = await this.runCommand(cmd, fields, what, source);
    if (result.ok && cmd === "syncReset") {
      this.log.info(`[cmd] The device starts the ${what} (from ${source})`);
    }
    this.forceValue(id, result.ok);
  }
  /**
   * Tilts the elevation to an offered angle (command `position`, vertical only).
   *
   * @param id id of the state
   * @param value angle in whole degrees
   * @param source who gave the command
   */
  async runPosition(id, value, source) {
    var _a, _b;
    const deg = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    if (typeof deg !== "number" || !Number.isInteger(deg) || deg < 0 || deg > 60) {
      this.report("position", `position ${String(value)}`, { ok: false, reason: "range", durationMs: 0 }, source);
      this.forceValue(id, (_a = this.cache.get(id)) != null ? _a : null);
      return;
    }
    const result = await this.runCommand("position", { deg }, `position ${deg}\xB0`, source);
    this.forceValue(id, result.ok ? deg : (_b = this.cache.get(id)) != null ? _b : null);
  }
  /**
   * Installs the newest firmware over the internet. The version has to be written: a button
   * pressed by mistake cannot start an update, and the device checks the version against
   * `fwOnline.latest` (PROTOCOL.md, fwInstall).
   *
   * @param id id of the state
   * @param value version to install
   * @param source who gave the command
   */
  async runFwInstall(id, value, source) {
    const version = typeof value === "string" ? value.trim() : "";
    if (!version) {
      this.report(
        "fwInstall",
        `fwInstall ${String(value)}`,
        { ok: false, reason: "type", durationMs: 0 },
        source
      );
      this.forceValue(id, "");
      return;
    }
    const result = await this.runCommand("fwInstall", { version }, `install firmware ${version}`, source);
    if (result.ok) {
      this.log.info(
        `[cmd] The device loads firmware ${version} (from ${source}); it writes it after the elevation has reached the flat position`
      );
    }
    this.forceValue(id, result.ok ? version : "");
  }
  async runJog(axis, value, source) {
    var _a, _b;
    const id = JOG_STATE[axis];
    const dir = value === 1 || value === -1 || value === 0 ? value : void 0;
    if (dir === void 0) {
      this.report("jog", `jog ${axis} ${String(value)}`, { ok: false, reason: "range", durationMs: 0 }, source);
      this.forceValue(id, 0);
      return;
    }
    const running = (_a = this.remote) == null ? void 0 : _a.jogging;
    if (dir !== 0 && (running == null ? void 0 : running.axis) === axis && running.dir === dir) {
      await ((_b = this.remote) == null ? void 0 : _b.jog(axis, dir, source));
      return;
    }
    const blocked = dir !== 0 ? this.precheck("jog") : void 0;
    const result = blocked || !this.remote ? { ok: false, reason: blocked != null ? blocked : "disconnected", durationMs: 0 } : await this.remote.jog(axis, dir, source);
    this.report("jog", `jog ${axis} ${dir === 0 ? "stop" : dir}`, result, source);
    if (running && running.axis !== axis && dir !== 0) {
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
  onJogEnd(axis, reason) {
    this.report("jog", `jog ${axis}`, { ok: false, reason, durationMs: 0 }, "the adapter", true);
    this.forceValue(JOG_STATE[axis], 0);
  }
  /** Writes the collected messages to the message states */
  flushMessages() {
    if (!this.pending.length) {
      return;
    }
    const batch = this.pending;
    this.pending = [];
    const newest = batch[batch.length - 1];
    this.writeValue("messages.history", JSON.stringify(this.store.messages));
    this.writeValue("messages.last", (0, import_messages.formatMessage)(newest));
    this.writeValue("messages.lastJson", JSON.stringify(newest));
    this.writeValue("messages.lastSeq", this.store.lastSeq);
    this.writeValue("messages.lost", this.store.lost);
    for (let i = batch.length - 1; i >= 0; i--) {
      if ((0, import_messages.isFault)(batch[i].lvl)) {
        this.writeValue("messages.lastFault", (0, import_messages.formatMessage)(batch[i]));
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
  onUnload(callback) {
    var _a, _b;
    try {
      this.stopping = true;
      this.log.debug("[unload] Stopping: closing the connection and clearing timers");
      this.deferredParamWrites.clear();
      (_a = this.remote) == null ? void 0 : _a.stop();
      this.remote = void 0;
      (_b = this.client) == null ? void 0 : _b.stop();
      this.client = void 0;
      if (this.flushTimer) {
        this.clearTimeout(this.flushTimer);
        this.flushTimer = void 0;
      }
      if (this.connectionTimer) {
        this.clearTimeout(this.connectionTimer);
        this.connectionTimer = void 0;
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
  module.exports = (options) => new SambaSolarTrack(options);
} else {
  (() => new SambaSolarTrack())();
}
//# sourceMappingURL=main.js.map
