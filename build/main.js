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
var import_messages = require("./lib/messages");
var import_protocol = require("./lib/protocol");
var import_params = require("./lib/params");
var import_remote_control = require("./lib/remote-control");
var import_states = require("./lib/states");
const VOLATILE_INTERVAL_MS = 3e4;
const MESSAGE_FLUSH_MS = 1e3;
const MESSAGE_AGE_HINT_MS = 5e3;
const HISTORY_MIN = 1;
const HISTORY_MAX = 500;
const HISTORY_DEFAULT = 50;
const VOLATILE_IDS = new Set(import_states.STATES.filter((def) => def.volatile).map((def) => def.id));
const JOG_STATE = { elevation: "control.jogElevation", azimuth: "control.jogAzimuth" };
class SambaSolarTrack extends utils.Adapter {
  client;
  remote;
  /** What the firmware can do, from GET /api/info */
  features = /* @__PURE__ */ new Set();
  /** Reason of the last failure per kind of command; the same reason is reported only once */
  commandProblems = /* @__PURE__ */ new Map();
  /** Settings of the device by their key, from GET /api/params */
  params = /* @__PURE__ */ new Map();
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
  constructor(options = {}) {
    super({
      ...options,
      name: "samba-solar-track"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
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
    const token = String((_b = this.config.token) != null ? _b : "").trim();
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
      `[cfg] Device ${host}:${port}, token ${token ? `set (${token.length} characters)` : "not set (read only)"}, messages forwarded to this log from level "${this.forwardLevel}", history ${historySize} messages`
    );
    await this.createObjects();
    await this.restorePosition();
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
        onResult: (id, ok, reason) => {
          var _a2;
          return (_a2 = this.remote) == null ? void 0 : _a2.handleResult(id, ok, reason);
        },
        onParams: (changed) => this.onParams(changed)
      }
    });
    this.subscribeStates("control.*");
    this.subscribeStates("setup.*");
    this.subscribeStates("params.*");
    this.client.start();
  }
  /** Creates or updates all channels and states. Settings made by the user are kept. */
  async createObjects() {
    const started = Date.now();
    for (const node of import_states.NODES) {
      await this.extendObject(node.id, { type: node.type, common: { name: node.name }, native: {} });
    }
    for (const def of import_states.STATES) {
      const common = {
        name: def.name,
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
      await this.extendObject(def.id, { type: "state", common, native: {} });
    }
    this.log.debug(
      `[obj] ${import_states.NODES.length} channels and ${import_states.STATES.length} states created or updated in ${Date.now() - started} ms`
    );
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
    const before = this.cache.get("status.state");
    this.writeValues((0, import_states.statusToValues)(status));
    const after = this.cache.get("status.state");
    if (before !== after) {
      this.log.debug(`[dev] State ${String(before != null ? before : "unknown")} -> ${String(after)}`);
    }
    if ((0, import_protocol.isObject)(status.jog) && typeof status.jog.active === "boolean") {
      (_a = this.remote) == null ? void 0 : _a.handleStatus(status.jog.active);
    }
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
      void this.loadParams();
    } else {
      this.flushMessages();
      (_a = this.remote) == null ? void 0 : _a.handleDisconnect();
    }
  }
  /** Reads all settings of the device and creates or updates their states */
  async loadParams() {
    if (!this.client || !this.features.has("params")) {
      this.log.debug("[par] Settings skipped: the firmware does not offer them");
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
    var _a, _b;
    this.forceValue(
      "control.lastResult",
      JSON.stringify({
        ts: Date.now(),
        command: what,
        ok: result.ok,
        reason: (_a = result.reason) != null ? _a : null,
        text: (0, import_remote_control.reasonText)(result.reason),
        from: source
      })
    );
    if (result.ok) {
      this.commandProblems.delete(kind);
      return;
    }
    const reason = (_b = result.reason) != null ? _b : "unknown";
    const text = ended ? `[jog] The manual drive "${what}" was stopped: ${reason} (${(0, import_remote_control.reasonText)(reason)})` : `[cmd] "${what}" from ${source} was not executed: ${reason} (${(0, import_remote_control.reasonText)(reason)})`;
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
      (_a = this.remote) == null ? void 0 : _a.stop();
      this.remote = void 0;
      (_b = this.client) == null ? void 0 : _b.stop();
      this.client = void 0;
      if (this.flushTimer) {
        this.clearTimeout(this.flushTimer);
        this.flushTimer = void 0;
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
