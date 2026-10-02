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
var params_exports = {};
__export(params_exports, {
  PARAM_GROUPS: () => PARAM_GROUPS,
  groupName: () => groupName,
  paramCommon: () => paramCommon,
  paramStateId: () => paramStateId,
  parseParam: () => parseParam,
  parseParams: () => parseParams,
  pendingMap: () => pendingMap,
  readParamResult: () => readParamResult,
  toDeviceValue: () => toDeviceValue
});
module.exports = __toCommonJS(params_exports);
var import_protocol = require("./protocol");
const PARAM_GROUPS = {
  control: { en: "Settings: control", de: "Einstellungen: Regelung" },
  commissioning: { en: "Settings: commissioning", de: "Einstellungen: Inbetriebnahme" },
  safety: {
    en: "Settings: safety (valid only after confirmation at the display)",
    de: "Einstellungen: Sicherheit (gelten erst nach Best\xE4tigung am Display)"
  },
  diagnostics: { en: "Settings: diagnostics", de: "Einstellungen: Diagnose" }
};
const PARAM_NAMES = {
  stormKmh: { en: "Storm threshold (gust)", de: "Sturmschwelle (B\xF6e)" },
  stormHoldMs: { en: "Hold time after storm", de: "Haltezeit nach Sturm" },
  motorDeadtimeMs: { en: "Dead time when changing direction", de: "Totzeit beim Richtungswechsel" },
  motorMaxRunMsElevation: { en: "Maximum runtime elevation", de: "H\xF6chstlaufzeit Elevation" },
  motorMaxRunMsAzimuth: { en: "Maximum runtime azimuth", de: "H\xF6chstlaufzeit Azimut" },
  limitSwitchesElevation: { en: "Limit switches elevation installed", de: "Endschalter Elevation eingebaut" },
  limitSwitchesAzimuth: { en: "Limit switches azimuth installed", de: "Endschalter Azimut eingebaut" },
  sunChEast: { en: "Sun sensor EAST at input AIN", de: "Sonnensensor OST an Eingang AIN" },
  sunChWest: { en: "Sun sensor WEST at input AIN", de: "Sonnensensor WEST an Eingang AIN" },
  sunChSouth: { en: "Sun sensor SOUTH at input AIN", de: "Sonnensensor S\xDCD an Eingang AIN" },
  sunChNorth: { en: "Sun sensor NORTH at input AIN", de: "Sonnensensor NORD an Eingang AIN" },
  sunNorthMeansUp: { en: "North brighter means UP", de: "Nord heller hei\xDFt RAUF" },
  stormParkElevationPlus: { en: "Flat position lies in direction UP", de: "Flachstellung liegt Richtung RAUF" },
  windBaud: { en: "Wind sensor: baud rate", de: "Windmesser: Baudrate" },
  windSpeedAddr: { en: "Wind sensor: Modbus address", de: "Windmesser: Modbus-Adresse" },
  windSpeedFunction: { en: "Wind sensor: read function (3 or 4)", de: "Windmesser: Lesebefehl (3 oder 4)" },
  windSpeedRegister: { en: "Wind sensor: register", de: "Windmesser: Register" },
  windSpeedScale: { en: "Wind sensor: m/s per count", de: "Windmesser: m/s je Z\xE4hler" },
  windDirAddr: { en: "Wind direction: Modbus address", de: "Windrichtung: Modbus-Adresse" },
  windDirFunction: { en: "Wind direction: read function (3 or 4)", de: "Windrichtung: Lesebefehl (3 oder 4)" },
  windDirRegister: { en: "Wind direction: register", de: "Windrichtung: Register" },
  windDirScale: { en: "Wind direction: degrees per count", de: "Windrichtung: Grad je Z\xE4hler" },
  trackStartPermille: { en: "Track from deviation", de: "Nachf\xFChren ab Abweichung" },
  trackStopPermille: { en: "Aligned below deviation", de: "Ausgerichtet unter Abweichung" },
  trackStartDelayMs: { en: "Waiting time before a drive", de: "Wartezeit vor einer Fahrt" },
  trackSettleMs: { en: "Rest time after a drive", de: "Ruhezeit nach einer Fahrt" },
  trackMaxMoveMs: { en: "Longest tracking drive", de: "L\xE4ngste Nachf\xFChrfahrt" },
  nightEnterLevel: { en: "Night below brightness (sum)", de: "Nacht unter Helligkeit (Summe)" },
  nightExitLevel: { en: "Day above brightness (sum)", de: "Tag \xFCber Helligkeit (Summe)" },
  nightDelayMs: { en: "Night or day only after", de: "Nacht oder Tag erst nach" },
  nightReturnEast: { en: "Return to the east at night", de: "Nachts zur\xFCck nach Osten" },
  logLevel: { en: "Log level of the device (until its restart)", de: "Log-Stufe des Ger\xE4ts (bis zum Neustart)" }
};
const UNITS = { permille: "\u2030", deg: "\xB0" };
const ID_PART = /^[A-Za-z][A-Za-z0-9]*$/;
function parseParam(json) {
  if (!(0, import_protocol.isObject)(json) || typeof json.key !== "string" || typeof json.group !== "string") {
    return void 0;
  }
  if (!ID_PART.test(json.key) || !ID_PART.test(json.group)) {
    return void 0;
  }
  const type = json.type;
  if (type !== "bool" && type !== "int" && type !== "float") {
    return void 0;
  }
  const valueType = type === "bool" ? "boolean" : "number";
  if (typeof json.value !== valueType) {
    return void 0;
  }
  const apply = json.apply === "standstill" || json.apply === "confirm" ? json.apply : "now";
  return {
    key: json.key,
    group: json.group,
    type,
    unit: typeof json.unit === "string" ? json.unit : "",
    value: json.value,
    default: typeof json.default === valueType ? json.default : json.value,
    min: typeof json.min === "number" ? json.min : null,
    max: typeof json.max === "number" ? json.max : null,
    apply,
    pending: typeof json.pending === valueType ? json.pending : null
  };
}
function parseParams(list) {
  if (!Array.isArray(list)) {
    return { entries: [], dropped: 0 };
  }
  const entries = [];
  let dropped = 0;
  for (const item of list) {
    const entry = parseParam(item);
    if (entry) {
      entries.push(entry);
    } else {
      dropped++;
    }
  }
  return { entries, dropped };
}
function paramStateId(entry) {
  return `params.${entry.group}.${entry.key}`;
}
function groupName(group) {
  var _a;
  return (_a = PARAM_GROUPS[group]) != null ? _a : { en: `Settings: ${group}`, de: `Einstellungen: ${group}` };
}
function paramCommon(entry) {
  var _a, _b;
  const name = (_a = PARAM_NAMES[entry.key]) != null ? _a : { en: entry.key, de: entry.key };
  const hint = entry.apply === "confirm" ? { en: " (needs confirmation at the display)", de: " (braucht die Best\xE4tigung am Display)" } : entry.apply === "standstill" ? { en: " (only while no drive is running)", de: " (nur bei stehenden Antrieben)" } : { en: "", de: "" };
  const common = {
    name: { en: name.en + hint.en, de: name.de + hint.de },
    type: entry.type === "bool" ? "boolean" : "number",
    role: entry.type === "bool" ? "switch" : "level",
    read: true,
    write: true,
    def: entry.default
  };
  const unit = (_b = UNITS[entry.unit]) != null ? _b : entry.unit;
  if (unit) {
    common.unit = unit;
  }
  if (entry.min !== null) {
    common.min = entry.min;
  }
  if (entry.max !== null) {
    common.max = entry.max;
  }
  return common;
}
function toDeviceValue(entry, value) {
  if (entry.type === "bool") {
    if (typeof value === "boolean") {
      return value;
    }
    if (value === 1 || value === 0) {
      return value === 1;
    }
    if (value === "true" || value === "false") {
      return value === "true";
    }
    return void 0;
  }
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : void 0;
}
function readParamResult(answer, key) {
  if (!(0, import_protocol.isObject)(answer) || !(0, import_protocol.isObject)(answer.results)) {
    return void 0;
  }
  const entry = answer.results[key];
  if (!(0, import_protocol.isObject)(entry)) {
    return void 0;
  }
  const kind = entry.result;
  if (kind !== "applied" && kind !== "pending" && kind !== "rejected") {
    return void 0;
  }
  const scalar = (v) => typeof v === "number" || typeof v === "boolean" ? v : void 0;
  return {
    result: kind,
    value: scalar(entry.value),
    pending: scalar(entry.pending),
    reason: typeof entry.reason === "string" ? entry.reason : void 0
  };
}
function pendingMap(entries) {
  const map = {};
  for (const entry of entries) {
    if (entry.pending !== null) {
      map[entry.key] = entry.pending;
    }
  }
  return map;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PARAM_GROUPS,
  groupName,
  paramCommon,
  paramStateId,
  parseParam,
  parseParams,
  pendingMap,
  readParamResult,
  toDeviceValue
});
//# sourceMappingURL=params.js.map
