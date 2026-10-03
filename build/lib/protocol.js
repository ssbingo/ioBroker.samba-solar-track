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
  TOKEN_BLOCKS: () => TOKEN_BLOCKS,
  TOKEN_BLOCK_LENGTH: () => TOKEN_BLOCK_LENGTH,
  TOKEN_HINT: () => TOKEN_HINT,
  TOKEN_LENGTH: () => TOKEN_LENGTH,
  assembleToken: () => assembleToken,
  isObject: () => isObject,
  migrateOldToken: () => migrateOldToken,
  parseHello: () => parseHello,
  parseInfo: () => parseInfo,
  parseLogLine: () => parseLogLine,
  readPath: () => readPath,
  resumeSince: () => resumeSince,
  tokenSummary: () => tokenSummary
});
module.exports = __toCommonJS(protocol_exports);
const DEVICE_NAME = "samba-solar-track";
const PROTOCOL_VERSION = 1;
const TOKEN_LENGTH = 32;
const TOKEN_BLOCKS = 4;
const TOKEN_BLOCK_LENGTH = TOKEN_LENGTH / TOKEN_BLOCKS;
const TOKEN_HINT = 'The display shows it under the gear > NETZWERK > "TOKEN FUER DEN ADAPTER" as 4 blocks of 8 characters (0-9, a-f); enter one block per field in the adapter settings.';
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
function normalizeToken(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).replace(/\s+/g, "").toLowerCase();
}
function tokenProblems(value, length) {
  const characters = [...value];
  const problems = [];
  if (characters.length !== length) {
    problems.push(`${characters.length} characters instead of ${length}`);
  }
  const positions = [];
  characters.forEach((character, index) => {
    if (!/^[0-9a-f]$/.test(character)) {
      positions.push(index + 1);
    }
  });
  if (positions.length === 1) {
    problems.push(`a character other than 0-9 and a-f at position ${positions[0]}`);
  } else if (positions.length > 1) {
    problems.push(`characters other than 0-9 and a-f at positions ${positions.join(", ")}`);
  }
  return problems;
}
function assembleToken(blocks, old) {
  const parts = [];
  for (let i = 0; i < TOKEN_BLOCKS; i++) {
    parts.push(normalizeToken(blocks[i]));
  }
  const single = normalizeToken(old);
  const lengths = { blockLengths: parts.map((part) => [...part].length), oldLength: [...single].length };
  if (parts.every((part) => part === "")) {
    if (!single) {
      return { token: "", source: "none", ...lengths };
    }
    const problems2 = tokenProblems(single, TOKEN_LENGTH);
    return problems2.length ? {
      token: "",
      source: "old",
      problem: `the token saved by version 0.0.4 or older (no longer shown in the settings) has ${problems2.join(" and ")}; enter the token in the four fields, then it is removed`,
      ...lengths
    } : { token: single, source: "old", ...lengths };
  }
  const problems = [];
  parts.forEach((part, index) => {
    if (!part) {
      problems.push(`block ${index + 1} is empty`);
      return;
    }
    const found = tokenProblems(part, TOKEN_BLOCK_LENGTH);
    if (found.length) {
      problems.push(`block ${index + 1} has ${found.join(" and ")}`);
    }
  });
  return problems.length ? { token: "", source: "blocks", problem: problems.join(", "), ...lengths } : { token: parts.join(""), source: "blocks", ...lengths };
}
function migrateOldToken(blocks, old) {
  const single = normalizeToken(old);
  if (!single) {
    return null;
  }
  const inUse = Array.from({ length: TOKEN_BLOCKS }, (_, i) => normalizeToken(blocks[i])).some((part) => part !== "");
  if (inUse) {
    return { clearOld: true };
  }
  if (tokenProblems(single, TOKEN_LENGTH).length) {
    return null;
  }
  const moved = [];
  for (let i = 0; i < TOKEN_BLOCKS; i++) {
    moved.push(single.slice(i * TOKEN_BLOCK_LENGTH, (i + 1) * TOKEN_BLOCK_LENGTH));
  }
  return { blocks: moved, clearOld: true };
}
function tokenSummary(setting) {
  if (setting.source === "none") {
    return "token not set (read only)";
  }
  const from = setting.source === "blocks" ? "from the four fields" : "from the old token field";
  return setting.problem ? `token ${from} incomplete or wrong (read only)` : `token ${from} complete (${setting.token.length} characters)`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEVICE_NAME,
  PROTOCOL_VERSION,
  TOKEN_BLOCKS,
  TOKEN_BLOCK_LENGTH,
  TOKEN_HINT,
  TOKEN_LENGTH,
  assembleToken,
  isObject,
  migrateOldToken,
  parseHello,
  parseInfo,
  parseLogLine,
  readPath,
  resumeSince,
  tokenSummary
});
//# sourceMappingURL=protocol.js.map
