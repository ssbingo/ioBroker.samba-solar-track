"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var remote_control_exports = {};
__export(remote_control_exports, {
  DEFAULT_REMOTE_TIMING: () => DEFAULT_REMOTE_TIMING,
  REASON_TEXT: () => REASON_TEXT,
  RemoteControl: () => RemoteControl,
  reasonText: () => reasonText
});
module.exports = __toCommonJS(remote_control_exports);
const DEFAULT_REMOTE_TIMING = {
  resultTimeoutMs: 2e3,
  jogRenewMs: 300,
  jogHoldMs: 1e3,
  jogGraceMs: 1500
};
const REASON_TEXT = {
  auth: "the token is missing or wrong",
  locked: "remote control is locked at the display",
  setup: "the setup of the device is not completed",
  state: "the state of the controller does not allow it",
  local: "someone is operating the display, the display has priority",
  range: "the value is outside the limits",
  unknown: "unknown command or axis",
  format: "malformed request",
  busy: "another connection is driving or the device was busy, try again",
  timeout: "the device did not answer in time",
  disconnected: "not connected to the device",
  protocol: "the device speaks a newer protocol, commands are disabled",
  unsupported: "the firmware does not support this command",
  hold: "the drive command was not renewed in time (dead man)",
  device: "the device ended the drive"
};
function reasonText(reason) {
  var _a;
  if (!reason) {
    return "";
  }
  return (_a = REASON_TEXT[reason]) != null ? _a : reason;
}
const RENEW_IDS_KEPT = 20;
class RemoteControl {
  /**
   * @param options settings
   */
  constructor(options) {
    this.options = options;
    var _a;
    this.timing = { ...DEFAULT_REMOTE_TIMING, ...options.timing };
    this.now = (_a = options.now) != null ? _a : (() => Date.now());
  }
  timing;
  now;
  pending = /* @__PURE__ */ new Map();
  renewIds = [];
  /** Ids of stops sent without waiting for the answer */
  releaseIds = [];
  nextId = 1;
  drive;
  renewTimer;
  /** The drive that is running, if any */
  get jogging() {
    return this.drive ? { axis: this.drive.axis, dir: this.drive.dir } : void 0;
  }
  /**
   * Sends a command and waits for the answer of the device.
   *
   * @param cmd the command
   * @param on value for `auto` and `park`
   * @param source who gave the command, for the log
   */
  command(cmd, on, source) {
    const frame = { t: "cmd", cmd };
    if (cmd !== "ack") {
      frame.on = on === true;
    }
    return this.request(frame, `${cmd}${cmd === "ack" ? "" : ` on=${on === true}`}`, source, "[cmd]");
  }
  /**
   * Starts, renews or stops a manual drive. Has to be called again at least once per second
   * while the drive shall continue.
   *
   * @param axis axis to drive
   * @param dir direction, 0 = stop
   * @param source who gave the command, for the log
   */
  async jog(axis, dir, source) {
    const { log } = this.options;
    const drive = this.drive;
    if (dir === 0) {
      if (!drive || drive.axis !== axis) {
        log.debug(`[jog] Stop for ${axis} skipped: no drive is running on this axis`);
        return { ok: true, durationMs: 0 };
      }
      this.clearDrive();
      log.debug(`[jog] Stop ${axis} after ${this.now() - drive.started} ms from ${source}`);
      return this.request({ t: "jog", axis, dir: 0 }, `jog ${axis} stop`, source, "[jog]");
    }
    if (drive && drive.axis === axis && drive.dir === dir) {
      drive.lastHold = this.now();
      log.silly(`[jog] ${axis} ${dir} held by ${source}`);
      return { ok: true, durationMs: 0 };
    }
    if (drive) {
      log.debug(`[jog] ${drive.axis} ${drive.dir} is replaced by ${axis} ${dir}`);
      this.clearDrive();
    }
    const started = this.now();
    const mine = { axis, dir, lastHold: started, started, confirmed: false };
    this.drive = mine;
    this.scheduleRenew();
    const result = await this.request({ t: "jog", axis, dir }, `jog ${axis} ${dir}`, source, "[jog]");
    if (this.drive !== mine) {
      return result;
    }
    if (result.ok) {
      mine.confirmed = true;
    } else {
      this.clearDrive();
      this.release(axis);
    }
    return result;
  }
  /**
   * Handles a `result` frame of the device.
   *
   * @param id id of the command, null when the device could not read it
   * @param ok true = accepted
   * @param reason why not
   */
  handleResult(id, ok, reason) {
    const { log } = this.options;
    if (id !== null) {
      const pending = this.pending.get(id);
      if (pending) {
        this.pending.delete(id);
        this.options.timers.clear(pending.timer);
        pending.resolve({
          ok,
          reason: ok ? void 0 : reason != null ? reason : "unknown",
          durationMs: this.now() - pending.started
        });
        return;
      }
      if (this.renewIds.includes(id)) {
        if (!ok) {
          this.endedByDevice(reason != null ? reason : "device", `renewal #${id} rejected`);
        }
        return;
      }
      if (this.releaseIds.includes(id)) {
        this.releaseIds = this.releaseIds.filter((known) => known !== id);
        log.debug(`[jog] #${id} stop ${ok ? "confirmed" : `refused: ${reason != null ? reason : "unknown"}`}`);
        return;
      }
    }
    log.debug(`[cmd] Result for unknown id ${String(id)} ignored (ok=${ok}${reason ? `, ${reason}` : ""})`);
  }
  /**
   * Evaluates the status of the device: a drive the device no longer reports has ended.
   *
   * @param jogActive `jog.active` of the status
   */
  handleStatus(jogActive) {
    const drive = this.drive;
    if (!drive || !drive.confirmed || jogActive) {
      return;
    }
    if (this.now() - drive.started < this.timing.jogGraceMs) {
      return;
    }
    this.endedByDevice("device", "the status reports no drive");
  }
  /** The connection to the device is lost: nothing can be confirmed any more */
  handleDisconnect() {
    const drive = this.drive;
    this.clearDrive();
    this.failPending("disconnected");
    if (drive) {
      this.options.log.debug(
        `[jog] ${drive.axis} ${drive.dir} ended: connection lost (the device stops by itself)`
      );
      this.options.onJogEnd(drive.axis, "disconnected");
    }
  }
  /** Stops everything: a running drive gets its stop command, timers are cleared */
  stop() {
    const drive = this.drive;
    this.clearDrive();
    if (drive) {
      this.options.log.debug(`[jog] ${drive.axis} ${drive.dir} stopped: the adapter is stopping`);
      this.release(drive.axis);
    }
    this.failPending("disconnected");
  }
  failPending(reason) {
    for (const [id, pending] of this.pending) {
      this.options.timers.clear(pending.timer);
      pending.resolve({ ok: false, reason, durationMs: this.now() - pending.started });
      this.options.log.debug(`[cmd] #${id} ${pending.what}: no answer, ${reasonText(reason)}`);
    }
    this.pending.clear();
  }
  request(frame, what, source, tag) {
    const { log, send, timers } = this.options;
    const id = this.nextId++;
    const started = this.now();
    if (!send({ ...frame, id })) {
      log.debug(`${tag} #${id} ${what} from ${source} not sent: ${reasonText("disconnected")}`);
      return Promise.resolve({ ok: false, reason: "disconnected", durationMs: 0 });
    }
    log.debug(`${tag} #${id} ${what} from ${source} sent`);
    return new Promise((resolve) => {
      const timer = timers.set(() => {
        if (this.pending.delete(id)) {
          resolve({ ok: false, reason: "timeout", durationMs: this.now() - started });
        }
      }, this.timing.resultTimeoutMs);
      this.pending.set(id, { resolve, timer, started, what });
    }).then((result) => {
      log.debug(
        result.ok ? `${tag} #${id} ${what} confirmed after ${result.durationMs} ms` : `${tag} #${id} ${what} failed after ${result.durationMs} ms: ${result.reason} (${reasonText(result.reason)})`
      );
      return result;
    });
  }
  /**
   * Sends a stop without waiting for the answer.
   *
   * @param axis axis to stop
   */
  release(axis) {
    const id = this.nextId++;
    if (this.options.send({ t: "jog", axis, dir: 0, id })) {
      this.releaseIds.push(id);
      if (this.releaseIds.length > RENEW_IDS_KEPT) {
        this.releaseIds.shift();
      }
      this.options.log.debug(`[jog] #${id} stop for ${axis} sent`);
    }
  }
  clearDrive() {
    this.drive = void 0;
    this.renewIds = [];
    if (this.renewTimer !== void 0) {
      this.options.timers.clear(this.renewTimer);
      this.renewTimer = void 0;
    }
  }
  endedByDevice(reason, detail) {
    const drive = this.drive;
    if (!drive) {
      return;
    }
    this.clearDrive();
    this.options.log.debug(
      `[jog] ${drive.axis} ${drive.dir} ended by the device after ${this.now() - drive.started} ms: ${reason} (${reasonText(reason)}; ${detail})`
    );
    this.release(drive.axis);
    this.options.onJogEnd(drive.axis, reason);
  }
  scheduleRenew() {
    this.renewTimer = this.options.timers.set(() => {
      this.renewTimer = void 0;
      const drive = this.drive;
      if (!drive) {
        return;
      }
      const silent = this.now() - drive.lastHold;
      if (silent > this.timing.jogHoldMs) {
        this.clearDrive();
        this.options.log.debug(
          `[jog] ${drive.axis} ${drive.dir} stopped: not renewed for ${silent} ms (limit ${this.timing.jogHoldMs} ms)`
        );
        this.release(drive.axis);
        this.options.onJogEnd(drive.axis, "hold");
        return;
      }
      const id = this.nextId++;
      if (this.options.send({ t: "jog", axis: drive.axis, dir: drive.dir, id })) {
        this.renewIds.push(id);
        if (this.renewIds.length > RENEW_IDS_KEPT) {
          this.renewIds.shift();
        }
        this.options.log.silly(`[jog] #${id} renewal ${drive.axis} ${drive.dir}`);
      }
      this.scheduleRenew();
    }, this.timing.jogRenewMs);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_REMOTE_TIMING,
  REASON_TEXT,
  RemoteControl,
  reasonText
});
//# sourceMappingURL=remote-control.js.map
