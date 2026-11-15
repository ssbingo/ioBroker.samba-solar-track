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
  PARAM_TEXTS: () => PARAM_TEXTS,
  groupName: () => groupName,
  paramCommon: () => paramCommon,
  paramName: () => paramName,
  paramStateId: () => paramStateId,
  parseParam: () => parseParam,
  parseParams: () => parseParams,
  pendingMap: () => pendingMap,
  readParamResult: () => readParamResult,
  toDeviceValue: () => toDeviceValue
});
module.exports = __toCommonJS(params_exports);
var import_i18n = require("./i18n");
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
  nightEnterLevel: {
    en: "Night below brightness (sum; without known position of the sun)",
    de: "Nacht unter Helligkeit (Summe; ohne bekannten Sonnenstand)"
  },
  nightExitLevel: {
    en: "Day above brightness (sum; without known position of the sun)",
    de: "Tag \xFCber Helligkeit (Summe; ohne bekannten Sonnenstand)"
  },
  nightDelayMs: { en: "Night or day only after", de: "Nacht oder Tag erst nach" },
  nightReturnEast: { en: "Return to the east at night", de: "Nachts zur\xFCck nach Osten" },
  logLevel: { en: "Log level of the device (until its restart)", de: "Log-Stufe des Ger\xE4ts (bis zum Neustart)" },
  // tilt on command (feature position, vertical only)
  elevTravelSteepMs: { en: "Travel time 0\xB0 to 60\xB0 (steeper)", de: "Fahrzeit 0\xB0 bis 60\xB0 (steiler)" },
  elevTravelFlatMs: { en: "Travel time 60\xB0 to 0\xB0 (flatter)", de: "Fahrzeit 60\xB0 bis 0\xB0 (flacher)" },
  elevGeometry: {
    en: "Frame of the rack (0 = linear, 1 = G1, 2 = G2)",
    de: "Gestell des Racks (0 = linear, 1 = G1, 2 = G2)"
  },
  elevStartLossMs: { en: "Start and run-on loss per drive", de: "Anlauf- und Nachlaufverlust je Fahrt" },
  elevPreset1: { en: "Preset angle 1 (0 = off)", de: "Wunschwinkel 1 (0 = aus)" },
  elevPreset2: { en: "Preset angle 2 (0 = off)", de: "Wunschwinkel 2 (0 = aus)" },
  // Hall tap (feature hall, vertical only)
  elevHall: { en: "Hall tap installed (HallTapBoard)", de: "Hall-Abgriff vorhanden (HallTapBoard)" },
  elevHallInvert: {
    en: "Reverse the counting direction of the Hall tap",
    de: "Z\xE4hlrichtung des Hall-Abgriffs umkehren"
  },
  elevHallSteps: {
    en: "Hall steps per stroke (0 = not measured)",
    de: "Hall-Schritte je Hub (0 = nicht eingemessen)"
  },
  // reset of the synchronous control (feature syncreset)
  syncResetElevation: {
    en: "Reset contact of the synchronous control elevation (0 = off, 1 = J23, 2 = J5)",
    de: "Reset-Kontakt der Synchronsteuerung Elevation (0 = aus, 1 = J23, 2 = J5)"
  },
  syncResetAzimuth: {
    en: "Reset contact of the synchronous control azimuth (0 = off, 1 = J23)",
    de: "Reset-Kontakt der Synchronsteuerung Azimut (0 = aus, 1 = J23)"
  },
  // position of the sun (feature sunpos)
  siteLatitude: { en: "Latitude of the site (north positive)", de: "Breite des Standorts (Nord positiv)" },
  siteLongitude: { en: "Longitude of the site (east positive)", de: "L\xE4nge des Standorts (Ost positiv)" },
  rackAzimuth: {
    en: "Orientation of the rack (0 = south, west positive)",
    de: "Ausrichtung des Racks (0 = S\xFCd, nach Westen positiv)"
  },
  nightAfterSunsetMin: { en: "Night begins after sunset", de: "Nacht beginnt nach Sonnenuntergang" },
  dayBeforeSunriseMin: { en: "Day begins before sunrise", de: "Tag beginnt vor Sonnenaufgang" },
  cloudAstro: {
    en: "When cloudy, drive to the calculated best angle",
    de: "Bei Bew\xF6lkung den berechneten besten Winkel anfahren"
  },
  cloudLevel: { en: "Cloudy below brightness (sum)", de: "Bew\xF6lkt unter Helligkeit (Summe)" }
};
const UNKNOWN_GROUP = { en: "Settings:", de: "Einstellungen:" };
const APPLY_HINTS = {
  confirm: { en: "(needs confirmation at the display)", de: "(braucht die Best\xE4tigung am Display)" },
  standstill: { en: "(only while no drive is running)", de: "(nur bei stehenden Antrieben)" },
  now: void 0
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
  const known = PARAM_GROUPS[group];
  return known ? (0, import_i18n.fullName)(known) : (0, import_i18n.joinNames)((0, import_i18n.fullName)(UNKNOWN_GROUP), group);
}
function paramName(entry) {
  const known = PARAM_NAMES[entry.key];
  const name = known ? (0, import_i18n.fullName)(known) : (0, import_i18n.joinNames)(void 0, entry.key);
  const hint = APPLY_HINTS[entry.apply];
  return hint ? (0, import_i18n.joinNames)(name, (0, import_i18n.fullName)(hint)) : name;
}
const PARAM_TEXTS = [
  ...Object.values(PARAM_GROUPS),
  ...Object.values(PARAM_NAMES),
  UNKNOWN_GROUP,
  ...Object.values(APPLY_HINTS).filter((hint) => hint !== void 0)
];
function paramCommon(entry) {
  var _a;
  const common = {
    name: paramName(entry),
    type: entry.type === "bool" ? "boolean" : "number",
    role: entry.type === "bool" ? "switch" : "level",
    read: true,
    write: true,
    def: entry.default
  };
  const unit = (_a = UNITS[entry.unit]) != null ? _a : entry.unit;
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
  PARAM_TEXTS,
  groupName,
  paramCommon,
  paramName,
  paramStateId,
  parseParam,
  parseParams,
  pendingMap,
  readParamResult,
  toDeviceValue
});
//# sourceMappingURL=params.js.map
