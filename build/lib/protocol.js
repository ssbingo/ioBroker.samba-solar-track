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
var protocol_exports = {};
__export(protocol_exports, {
  DEVICE_NAME: () => DEVICE_NAME,
  PROTOCOL_VERSION: () => PROTOCOL_VERSION,
  isObject: () => isObject,
  parseHello: () => parseHello,
  parseInfo: () => parseInfo,
  parseLogLine: () => parseLogLine,
  readPath: () => readPath,
  resumeSince: () => resumeSince
});
module.exports = __toCommonJS(protocol_exports);
const DEVICE_NAME = "samba-solar-track";
const PROTOCOL_VERSION = 1;
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseInfo(json) {
  if (!isObject(json)) {
    return "answer is not a JSON object";
  }
  if (json.device !== DEVICE_NAME) {
    return `unexpected device "${String(json.device)}" (expected "${DEVICE_NAME}")`;
  }
  if (typeof json.fw !== "string" || typeof json.protocol !== "number" || typeof json.id !== "string") {
    return "fw, protocol or id is missing";
  }
  const features = Array.isArray(json.features) ? json.features.filter((f) => typeof f === "string") : [];
  return { ...json, device: DEVICE_NAME, fw: json.fw, protocol: json.protocol, id: json.id, features };
}
function parseHello(json) {
  if (json.device !== DEVICE_NAME) {
    return `unexpected device "${String(json.device)}"`;
  }
  if (typeof json.bootId !== "string" || typeof json.uptimeMs !== "number") {
    return "bootId or uptimeMs is missing";
  }
  return {
    t: "hello",
    device: DEVICE_NAME,
    fw: typeof json.fw === "string" ? json.fw : "",
    protocol: typeof json.protocol === "number" ? json.protocol : 0,
    bootId: json.bootId,
    uptimeMs: json.uptimeMs,
    auth: json.auth === true,
    logFirst: typeof json.logFirst === "number" ? json.logFirst : 1,
    logNext: typeof json.logNext === "number" ? json.logNext : 1
  };
}
function parseLogLine(json) {
  if (!isObject(json) || typeof json.seq !== "number" || typeof json.ms !== "number") {
    return void 0;
  }
  return {
    seq: json.seq,
    ms: json.ms,
    lvl: typeof json.lvl === "string" ? json.lvl : "I",
    tag: typeof json.tag === "string" ? json.tag : "",
    msg: typeof json.msg === "string" ? json.msg : ""
  };
}
function resumeSince(hello, knownBootId, lastSeq) {
  if (knownBootId === hello.bootId && typeof lastSeq === "number" && lastSeq > 0) {
    return lastSeq + 1;
  }
  return hello.logFirst;
}
function readPath(source, path) {
  let current = source;
  for (const key of path.split(".")) {
    if (!isObject(current)) {
      return void 0;
    }
    current = current[key];
  }
  return current;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEVICE_NAME,
  PROTOCOL_VERSION,
  isObject,
  parseHello,
  parseInfo,
  parseLogLine,
  readPath,
  resumeSince
});
//# sourceMappingURL=protocol.js.map
