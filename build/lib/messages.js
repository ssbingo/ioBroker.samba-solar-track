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
var messages_exports = {};
__export(messages_exports, {
  DEVICE_LEVELS: () => DEVICE_LEVELS,
  MessageStore: () => MessageStore,
  formatMessage: () => formatMessage,
  hostLevel: () => hostLevel,
  isFault: () => isFault,
  parseHistory: () => parseHistory,
  shouldForward: () => shouldForward
});
module.exports = __toCommonJS(messages_exports);
const DEVICE_LEVELS = ["E", "W", "I", "D", "V"];
function rank(lvl) {
  const index = DEVICE_LEVELS.indexOf(lvl);
  return index < 0 ? DEVICE_LEVELS.indexOf("I") : index;
}
function shouldForward(lvl, threshold) {
  return threshold !== "off" && rank(lvl) <= rank(threshold);
}
function hostLevel(lvl) {
  switch (lvl) {
    case "E":
    case "W":
      return "warn";
    case "D":
      return "debug";
    case "V":
      return "silly";
    default:
      return "info";
  }
}
function isFault(lvl) {
  return lvl === "E" || lvl === "W";
}
function formatMessage(message) {
  return `[${message.lvl}][${message.tag}] ${message.msg}`;
}
class MessageStore {
  /**
   * @param limit number of messages kept in the history
   */
  constructor(limit) {
    this.limit = limit;
  }
  history = [];
  currentBootId;
  currentLastSeq = 0;
  lostCount = 0;
  /** Boot id the sequence numbers belong to */
  get bootId() {
    return this.currentBootId;
  }
  /** Sequence number of the last received message, 0 = none */
  get lastSeq() {
    return this.currentLastSeq;
  }
  /** Messages lost since this store was created */
  get lost() {
    return this.lostCount;
  }
  /** Messages, newest first */
  get messages() {
    return this.history;
  }
  /**
   * Restores the position known from the last run of the adapter.
   *
   * @param bootId boot id of the device
   * @param lastSeq last received sequence number
   * @param history messages, newest first
   */
  restore(bootId, lastSeq, history) {
    this.currentBootId = bootId;
    this.currentLastSeq = lastSeq > 0 ? lastSeq : 0;
    this.history.length = 0;
    this.history.push(...history.slice(0, this.limit));
  }
  /**
   * Tells the store which start of the device the following lines belong to.
   *
   * @param bootId boot id of the device
   * @returns true when the device has restarted (sequence numbers start again)
   */
  setBootId(bootId) {
    if (bootId === this.currentBootId) {
      return false;
    }
    const restarted = this.currentBootId !== void 0;
    this.currentBootId = bootId;
    this.currentLastSeq = 0;
    return restarted;
  }
  /**
   * Counts messages the device reported as lost.
   *
   * @param count number of lost messages
   * @param to last lost sequence number
   */
  addLost(count, to) {
    this.lostCount += count;
    if (to > this.currentLastSeq) {
      this.currentLastSeq = to;
    }
  }
  /**
   * Adds a line.
   *
   * @param line the line of the device
   * @param bootEpoch time of the start of the device in ms since 1970 (now minus uptime)
   */
  add(line, bootEpoch) {
    if (line.seq <= this.currentLastSeq) {
      return { gap: 0 };
    }
    const gap = this.currentLastSeq > 0 ? line.seq - this.currentLastSeq - 1 : 0;
    this.lostCount += gap;
    this.currentLastSeq = line.seq;
    const message = {
      ts: Math.round(bootEpoch + line.ms),
      seq: line.seq,
      lvl: line.lvl,
      tag: line.tag,
      msg: line.msg
    };
    this.history.unshift(message);
    if (this.history.length > this.limit) {
      this.history.length = this.limit;
    }
    return { message, gap };
  }
}
function parseHistory(json) {
  if (typeof json !== "string" || !json) {
    return [];
  }
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (m) => typeof m === "object" && m !== null && typeof m.ts === "number" && typeof m.seq === "number" && typeof m.lvl === "string" && typeof m.tag === "string" && typeof m.msg === "string"
    );
  } catch {
    return [];
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEVICE_LEVELS,
  MessageStore,
  formatMessage,
  hostLevel,
  isFault,
  parseHistory,
  shouldForward
});
//# sourceMappingURL=messages.js.map
