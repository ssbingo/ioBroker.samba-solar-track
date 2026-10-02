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
var import_states = require("./lib/states");
const VOLATILE_INTERVAL_MS = 3e4;
const MESSAGE_FLUSH_MS = 1e3;
const MESSAGE_AGE_HINT_MS = 5e3;
const HISTORY_MIN = 1;
const HISTORY_MAX = 500;
const HISTORY_DEFAULT = 50;
const VOLATILE_IDS = new Set(import_states.STATES.filter((def) => def.volatile).map((def) => def.id));
class SambaSolarTrack extends utils.Adapter {
  client;
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
    this.client = new import_device_client.DeviceClient({
      host,
      port,
      token,
      log: this.log,
      timers: {
        set: (callback, ms) => this.setTimeout(callback, ms),
        clear: (handle) => this.clearTimeout(handle)
      },
      events: {
        onInfo: (info) => this.onInfo(info),
        onHello: (hello) => this.onHello(hello),
        onStatus: (status) => this.onStatus(status),
        onLog: (line) => this.onLog(line),
        onLost: (lost) => this.onLost(lost),
        onConnection: (connected) => this.onConnection(connected)
      }
    });
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
        read: true,
        write: false
      };
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
  onInfo(info) {
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
    if (typeof status.uptimeMs === "number") {
      this.bootEpoch = Date.now() - status.uptimeMs;
    }
    const before = this.cache.get("status.state");
    this.writeValues((0, import_states.statusToValues)(status));
    const after = this.cache.get("status.state");
    if (before !== after) {
      this.log.debug(`[dev] State ${String(before != null ? before : "unknown")} -> ${String(after)}`);
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
    this.writeValue("info.connection", connected);
    if (connected) {
      this.lostReported = false;
    } else {
      this.flushMessages();
    }
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
    var _a;
    try {
      this.stopping = true;
      this.log.debug("[unload] Stopping: closing the connection and clearing timers");
      (_a = this.client) == null ? void 0 : _a.stop();
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
