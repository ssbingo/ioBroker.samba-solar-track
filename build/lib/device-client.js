"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var device_client_exports = {};
__export(device_client_exports, {
  DEFAULT_TIMING: () => DEFAULT_TIMING,
  DeviceClient: () => DeviceClient
});
module.exports = __toCommonJS(device_client_exports);
var import_ws = __toESM(require("ws"));
var import_protocol = require("./protocol");
const DEFAULT_TIMING = {
  httpTimeoutMs: 5e3,
  handshakeTimeoutMs: 5e3,
  pingMs: 1e4,
  watchdogMs: 15e3,
  reconnectMs: [2e3, 5e3, 1e4, 3e4, 6e4]
};
function errorText(error) {
  if (error instanceof Error) {
    const cause = error.cause;
    const code = (0, import_protocol.isObject)(cause) && typeof cause.code === "string" ? ` (${cause.code})` : "";
    return `${error.message}${code}`;
  }
  return String(error);
}
function frameText(data) {
  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }
  return Array.isArray(data) ? Buffer.concat(data).toString("utf8") : Buffer.from(data).toString("utf8");
}
class DeviceClient {
  /**
   * @param options settings of the client
   */
  constructor(options) {
    this.options = options;
    this.timing = { ...DEFAULT_TIMING, ...options.timing };
    const host = options.host.includes(":") && !options.host.startsWith("[") ? `[${options.host}]` : options.host;
    this.baseUrl = `${host}:${options.port}`;
  }
  timing;
  baseUrl;
  ws;
  session = 0;
  attempt = 0;
  failures = 0;
  stopped = true;
  connected = false;
  problemReported = false;
  tokenProblemReported = false;
  versionProblemReported = false;
  lastRx = 0;
  reconnectTimer;
  pingTimer;
  isReadOnly = false;
  /**
   * true when the device speaks a newer protocol than this adapter knows: reading continues,
   * commands and changes must not be sent (PROTOCOL.md, section 10).
   */
  get readOnly() {
    return this.isReadOnly;
  }
  /** Starts connecting; the client keeps the connection up until `stop` */
  start() {
    if (!this.stopped) {
      this.options.log.debug("[conn] start ignored: client is already running");
      return;
    }
    this.stopped = false;
    void this.connect();
  }
  /** Closes the connection and stops all timers */
  stop() {
    this.options.log.debug(`[conn] stop (connected=${this.connected}, attempts=${this.attempt})`);
    this.stopped = true;
    this.session++;
    this.clearTimers();
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.on("error", () => void 0);
      this.ws.terminate();
      this.ws = void 0;
    }
    this.connected = false;
  }
  clearTimers() {
    if (this.reconnectTimer !== void 0) {
      this.options.timers.clear(this.reconnectTimer);
      this.reconnectTimer = void 0;
    }
    if (this.pingTimer !== void 0) {
      this.options.timers.clear(this.pingTimer);
      this.pingTimer = void 0;
    }
  }
  /**
   * Reads a JSON document from the device.
   *
   * @param path path with leading slash, e.g. "/api/info"
   */
  async getJson(path) {
    const started = Date.now();
    const response = await fetch(`http://${this.baseUrl}${path}`, {
      signal: AbortSignal.timeout(this.timing.httpTimeoutMs),
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for GET ${path}`);
    }
    const json = await response.json();
    this.options.log.debug(`[conn] GET ${path} answered after ${Date.now() - started} ms`);
    return json;
  }
  /**
   * Sends a JSON document to the device with the token (commands and changes need it).
   * An answer with an HTTP error is not an exception: the device explains the refusal in the body.
   *
   * @param path path with leading slash, e.g. "/api/params"
   * @param body the document to send
   * @returns HTTP status and the parsed answer (undefined when the answer is no JSON)
   */
  async postJson(path, body) {
    const started = Date.now();
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (this.options.token) {
      headers.Authorization = `Bearer ${this.options.token}`;
    }
    const text = JSON.stringify(body);
    this.options.log.silly(`[tx] POST ${path} ${text}`);
    const response = await fetch(`http://${this.baseUrl}${path}`, {
      method: "POST",
      signal: AbortSignal.timeout(this.timing.httpTimeoutMs),
      headers,
      body: text
    });
    let json;
    try {
      json = await response.json();
    } catch {
      json = void 0;
    }
    this.options.log.debug(`[conn] POST ${path} answered HTTP ${response.status} after ${Date.now() - started} ms`);
    return { status: response.status, json };
  }
  async connect() {
    const session = ++this.session;
    const attempt = ++this.attempt;
    const { log } = this.options;
    log.debug(`[conn] Attempt #${attempt}: GET http://${this.baseUrl}/api/info`);
    let info;
    try {
      const parsed = (0, import_protocol.parseInfo)(await this.getJson("/api/info"));
      if (typeof parsed === "string") {
        throw new Error(`not a Samba Solar Track: ${parsed}`);
      }
      info = parsed;
    } catch (error) {
      if (session === this.session) {
        this.failed(`GET /api/info failed: ${errorText(error)}`);
      }
      return;
    }
    if (session !== this.session || this.stopped) {
      log.debug(`[conn] Attempt #${attempt}: result ignored, client was stopped meanwhile`);
      return;
    }
    this.isReadOnly = info.protocol > import_protocol.PROTOCOL_VERSION;
    if (this.isReadOnly && !this.versionProblemReported) {
      this.versionProblemReported = true;
      log.warn(
        `[conn] The device speaks protocol version ${info.protocol}, this adapter knows version ${import_protocol.PROTOCOL_VERSION}. Reading continues, commands and changes are disabled. Please update the adapter.`
      );
    }
    log.debug(
      `[conn] Attempt #${attempt}: device ${info.id}, firmware ${info.fw}, protocol ${info.protocol}, features ${info.features.join(",") || "-"}`
    );
    this.options.events.onInfo(info);
    this.openSocket(session, attempt, info);
  }
  openSocket(session, attempt, info) {
    const { log, token } = this.options;
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    log.debug(
      `[conn] Attempt #${attempt}: opening ws://${this.baseUrl}/ws${token ? "?token=***" : ""} (token ${token ? `set, ${token.length} characters` : "not set, read only"})`
    );
    const started = Date.now();
    const ws = new import_ws.default(`ws://${this.baseUrl}/ws${query}`, {
      handshakeTimeout: this.timing.handshakeTimeoutMs
    });
    this.ws = ws;
    ws.on("open", () => {
      if (session !== this.session) {
        return;
      }
      this.lastRx = Date.now();
      log.debug(`[conn] Attempt #${attempt}: WebSocket open after ${Date.now() - started} ms, waiting for hello`);
      this.schedulePing(session);
    });
    ws.on("pong", () => {
      if (session === this.session) {
        this.lastRx = Date.now();
        log.silly("[rx] pong");
      }
    });
    ws.on("message", (data) => {
      if (session !== this.session) {
        return;
      }
      this.lastRx = Date.now();
      this.handleFrame(frameText(data), info, attempt);
    });
    ws.on("error", (error) => {
      if (session === this.session) {
        log.debug(`[conn] WebSocket error: ${errorText(error)}`);
      }
    });
    ws.on("close", (code, reason) => {
      if (session !== this.session) {
        return;
      }
      const text = reason.length ? ` "${String(reason)}"` : "";
      const hint = code === 1013 ? " (the device already has its maximum number of connections)" : "";
      this.failed(`WebSocket closed with code ${code}${text}${hint}`);
    });
  }
  handleFrame(text, info, attempt) {
    const { log, events } = this.options;
    let frame;
    try {
      frame = JSON.parse(text);
    } catch {
      log.debug(`[rx] Frame ignored: no valid JSON (${text.length} characters)`);
      return;
    }
    if (!(0, import_protocol.isObject)(frame) || typeof frame.t !== "string") {
      log.debug("[rx] Frame ignored: field t is missing");
      return;
    }
    log.silly(`[rx] ${text}`);
    switch (frame.t) {
      case "hello":
        this.handleHello(frame, info, attempt);
        break;
      case "status":
        events.onStatus(frame);
        break;
      case "log": {
        const line = (0, import_protocol.parseLogLine)(frame);
        if (line) {
          events.onLog(line);
        } else {
          log.debug("[rx] log frame ignored: seq or ms is missing");
        }
        break;
      }
      case "lost":
        if (typeof frame.count === "number" && typeof frame.to === "number") {
          events.onLost({
            t: "lost",
            from: typeof frame.from === "number" ? frame.from : 0,
            to: frame.to,
            count: frame.count
          });
        } else {
          log.debug("[rx] lost frame ignored: count or to is missing");
        }
        break;
      case "result":
        events.onResult(
          typeof frame.id === "number" ? frame.id : null,
          frame.ok === true,
          typeof frame.reason === "string" ? frame.reason : void 0
        );
        break;
      case "params":
        events.onParams(frame.changed);
        break;
      default:
        log.debug(`[rx] Unknown frame "${frame.t}" ignored`);
    }
  }
  handleHello(frame, info, attempt) {
    var _a, _b;
    const { log, events, token } = this.options;
    const hello = (0, import_protocol.parseHello)(frame);
    if (typeof hello === "string") {
      log.debug(`[rx] hello rejected: ${hello}`);
      (_a = this.ws) == null ? void 0 : _a.terminate();
      return;
    }
    if (this.problemReported) {
      log.info(`[conn] Device reachable again at ${this.baseUrl} after ${this.failures} failed attempt(s)`);
    } else if (!this.connected) {
      log.info(
        `[conn] Connected to Samba Solar Track "${(_b = info.hostname) != null ? _b : info.id}" at ${this.baseUrl} (firmware ${info.fw}, protocol ${info.protocol}${info.simulation ? ", SIMULATION" : ""})`
      );
    }
    this.problemReported = false;
    this.failures = 0;
    this.connected = true;
    if (token && !hello.auth) {
      if (!this.tokenProblemReported) {
        this.tokenProblemReported = true;
        log.warn(
          `[conn] The device did not accept the token. Reading works, commands will be rejected. ${import_protocol.TOKEN_HINT}`
        );
      }
    } else {
      this.tokenProblemReported = false;
    }
    const since = events.onHello(hello);
    log.debug(
      `[conn] Attempt #${attempt}: hello (bootId ${hello.bootId}, uptime ${hello.uptimeMs} ms, auth ${hello.auth}, log ${hello.logFirst}..${hello.logNext - 1}) -> subscribing messages since ${since}`
    );
    this.send({ t: "sub", since });
    events.onConnection(true);
  }
  /**
   * Sends a frame to the device.
   *
   * @param frame the frame
   * @returns false when there is no connection
   */
  send(frame) {
    const { log } = this.options;
    if (!this.ws || !this.connected || this.ws.readyState !== import_ws.default.OPEN) {
      log.debug(`[tx] Frame "${String(frame.t)}" skipped: not connected`);
      return false;
    }
    const text = JSON.stringify(frame);
    log.silly(`[tx] ${text}`);
    this.ws.send(text, (error) => {
      if (error) {
        log.debug(`[tx] Sending "${String(frame.t)}" failed: ${errorText(error)}`);
      }
    });
    return true;
  }
  schedulePing(session) {
    this.pingTimer = this.options.timers.set(() => {
      this.pingTimer = void 0;
      if (session !== this.session || !this.ws) {
        return;
      }
      const silent = Date.now() - this.lastRx;
      if (silent > this.timing.watchdogMs) {
        this.options.log.debug(
          `[conn] No frame for ${silent} ms (limit ${this.timing.watchdogMs} ms): closing`
        );
        this.ws.terminate();
        return;
      }
      if (this.ws.readyState === import_ws.default.OPEN) {
        this.options.log.silly("[tx] ping");
        this.ws.ping();
      }
      this.schedulePing(session);
    }, this.timing.pingMs);
  }
  failed(reason) {
    const { log, events, timers } = this.options;
    this.session++;
    this.clearTimers();
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.on("error", () => void 0);
      this.ws.terminate();
      this.ws = void 0;
    }
    const wasConnected = this.connected;
    this.connected = false;
    this.failures++;
    if (wasConnected) {
      events.onConnection(false);
    }
    if (this.stopped) {
      log.debug(`[conn] ${reason}; no further attempt, client is stopped`);
      return;
    }
    const delays = this.timing.reconnectMs;
    const delay = delays[Math.min(this.failures - 1, delays.length - 1)];
    if (!this.problemReported) {
      this.problemReported = true;
      log.warn(
        `[conn] ${wasConnected ? "Connection to the device lost" : "Device not reachable"} at ${this.baseUrl}: ${reason}. The adapter keeps trying in the background.`
      );
    }
    log.debug(`[conn] ${reason}; failure #${this.failures}, next attempt in ${delay} ms`);
    this.reconnectTimer = timers.set(() => {
      this.reconnectTimer = void 0;
      if (!this.stopped) {
        void this.connect();
      }
    }, delay);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_TIMING,
  DeviceClient
});
//# sourceMappingURL=device-client.js.map
