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
var states_exports = {};
__export(states_exports, {
  ELEVATION_FLATTER: () => ELEVATION_FLATTER,
  ELEVATION_STEEPER: () => ELEVATION_STEEPER,
  NODES: () => NODES,
  STATES: () => STATES,
  convertValue: () => convertValue,
  elevationDirections: () => elevationDirections,
  elevationLabelStates: () => elevationLabelStates,
  infoToValues: () => infoToValues,
  isAvailable: () => isAvailable,
  isConditional: () => isConditional,
  reportToValues: () => reportToValues,
  statusToValues: () => statusToValues
});
module.exports = __toCommonJS(states_exports);
var import_protocol = require("./protocol");
function isAvailable(def, layout) {
  if (!layout) {
    return true;
  }
  if (def.feature && !layout.features.has(def.feature)) {
    return false;
  }
  return def.mode === void 0 || layout.mode === def.mode;
}
function isConditional(def) {
  return def.feature !== void 0 || def.mode !== void 0;
}
const NODES = [
  { id: "status", type: "channel", name: { en: "State of the controller", de: "Zustand der Steuerung" } },
  { id: "axes", type: "folder", name: { en: "Axes", de: "Achsen" } },
  { id: "axes.elevation", type: "channel", name: { en: "Elevation (vertical)", de: "Elevation (vertikal)" } },
  { id: "axes.azimuth", type: "channel", name: { en: "Azimuth (horizontal)", de: "Azimut (horizontal)" } },
  { id: "sun", type: "channel", name: { en: "Sun sensor", de: "Sonnensensor" } },
  {
    id: "sunPosition",
    type: "channel",
    name: { en: "Position of the sun (site and time)", de: "Sonnenstand (Standort und Uhrzeit)" },
    feature: "sunpos"
  },
  { id: "wind", type: "channel", name: { en: "Wind sensor", de: "Windmesser" } },
  { id: "io", type: "channel", name: { en: "I/O components", de: "E/A-Bausteine" } },
  { id: "supply", type: "channel", name: { en: "Supplies", de: "Versorgungen" } },
  {
    id: "battery",
    type: "channel",
    name: { en: "Built-in battery of the board", de: "Eingebauter Akku des Boards" },
    feature: "battery"
  },
  {
    id: "update",
    type: "channel",
    name: { en: "Firmware update in progress", de: "Laufendes Firmware-Update" },
    feature: "update"
  },
  { id: "leds", type: "channel", name: { en: "Indicator lights", de: "Meldeleuchten" } },
  { id: "jog", type: "channel", name: { en: "Remote manual drive", de: "Handfahrt aus der Ferne" } },
  {
    id: "position",
    type: "channel",
    name: { en: "Tilt of the elevation on command", de: "Neigung der Elevation auf Befehl" },
    feature: "position",
    mode: 1
  },
  {
    id: "commissioning",
    type: "channel",
    name: { en: "Setup program", de: "Setup-Programm" },
    feature: "commissioning"
  },
  {
    id: "commissioning.report",
    type: "folder",
    name: { en: "Latest test report (data set)", de: "Neuester Pr\xFCfbericht (Datensatz)" },
    feature: "reportjson"
  },
  {
    id: "firmware",
    type: "channel",
    name: { en: "Firmware over the internet", de: "Firmware \xFCber das Internet" },
    feature: "fwonline"
  },
  { id: "counters", type: "channel", name: { en: "Error counters", de: "Fehlerz\xE4hler" } },
  { id: "messages", type: "channel", name: { en: "Messages of the device", de: "Meldungen des Ger\xE4ts" } },
  { id: "control", type: "channel", name: { en: "Commands", de: "Befehle" } },
  { id: "setup", type: "channel", name: { en: "Setup of the device", de: "Einrichtung des Ger\xE4ts" } },
  { id: "params", type: "folder", name: { en: "Settings of the device", de: "Einstellungen des Ger\xE4ts" } }
];
const CONTROLLER_STATES = {
  SETUP: "Setup missing",
  FAULT: "Fault",
  STORM: "Storm protection",
  MANUAL: "Manual mode",
  PARK: "Parked on command",
  WINDFAULT: "Wind sensor failed",
  POSITION: "Tilt on command",
  SENSOR: "Sun sensor fault",
  COMMISSION: "Setup program not completed",
  NIGHT: "Night",
  ASTRO: "Automatic: cloudy, calculated angle",
  IDLE: "Automatic: aligned",
  TRACKING: "Automatic: tracking",
  SETTLING: "Automatic: settling"
};
const ELEVATION_STEEPER = { en: "STEEPER", de: "STEILER" };
const ELEVATION_FLATTER = { en: "FLATTER", de: "FLACHER" };
const AZIMUTH_PLUS = { en: "EAST", de: "OST" };
const AZIMUTH_MINUS = { en: "WEST", de: "WEST" };
function elevationDirections(flatDir) {
  return flatDir === -1 ? { plus: ELEVATION_STEEPER, minus: ELEVATION_FLATTER } : { plus: ELEVATION_FLATTER, minus: ELEVATION_STEEPER };
}
function directionStates(axis, plus, minus) {
  const id = `axes.${axis}`;
  return [
    {
      id: `${id}.output`,
      name: { en: "Output", de: "Ausgang" },
      type: "number",
      role: "value",
      states: { "-1": minus.en, 0: "Stop", 1: plus.en },
      status: `${id}.out`
    },
    {
      id: `${id}.limitPlus`,
      name: { en: `Limit switch ${plus.en} open`, de: `Endschalter ${plus.de} offen` },
      type: "boolean",
      role: "indicator",
      status: `${id}.limitPlus`
    },
    {
      id: `${id}.limitMinus`,
      name: { en: `Limit switch ${minus.en} open`, de: `Endschalter ${minus.de} offen` },
      type: "boolean",
      role: "indicator",
      status: `${id}.limitMinus`
    },
    {
      id: `${id}.blockedPlus`,
      name: { en: `Direction ${plus.en} blocked`, de: `Richtung ${plus.de} gesperrt` },
      type: "boolean",
      role: "indicator",
      status: `${id}.blockedPlus`
    },
    {
      id: `${id}.blockedMinus`,
      name: { en: `Direction ${minus.en} blocked`, de: `Richtung ${minus.de} gesperrt` },
      type: "boolean",
      role: "indicator",
      status: `${id}.blockedMinus`
    }
  ];
}
function syncResetStates(axis, mode) {
  const id = `axes.${axis}`;
  const path = `${id}.syncReset`;
  const common = { feature: "syncreset", mode };
  return [
    {
      id: `${id}.syncResetPort`,
      name: {
        en: "Reset of the synchronous control: connection",
        de: "Reset der Synchronsteuerung: Anschluss"
      },
      type: "string",
      role: "text",
      states: { off: "off", j23: "J23", j5: "J5 (output azimuth PLUS)" },
      status: `${path}.port`,
      ...common
    },
    {
      id: `${id}.syncResetAvailable`,
      name: { en: "Reset of the synchronous control: available", de: "Reset der Synchronsteuerung: verf\xFCgbar" },
      type: "boolean",
      role: "indicator",
      status: `${path}.available`,
      ...common
    },
    {
      id: `${id}.syncResetPhase`,
      name: { en: "Reset of the synchronous control: phase", de: "Reset der Synchronsteuerung: Phase" },
      type: "string",
      role: "text",
      states: {
        idle: "idle",
        wait: "waiting (dead time)",
        pulse: "reset contact closed",
        run: "synchronous control drives, axis blocked"
      },
      status: `${path}.phase`,
      ...common
    },
    {
      id: `${id}.syncResetRemaining`,
      name: {
        en: "Reset of the synchronous control: remaining time",
        de: "Reset der Synchronsteuerung: Restzeit"
      },
      type: "number",
      role: "value.timer",
      unit: "s",
      status: `${path}.remainingMs`,
      convert: "msToSeconds",
      ...common
    },
    {
      id: `${id}.syncResetPhaseRemaining`,
      name: {
        en: "Reset of the synchronous control: remaining time of the phase",
        de: "Reset der Synchronsteuerung: Restzeit der Phase"
      },
      type: "number",
      role: "value.timer",
      unit: "s",
      status: `${path}.phaseRemainingMs`,
      convert: "msToSeconds",
      ...common
    },
    {
      id: `${id}.syncResetTotal`,
      name: {
        en: "Reset of the synchronous control: total time",
        de: "Reset der Synchronsteuerung: Gesamtzeit"
      },
      type: "number",
      role: "value.timer",
      unit: "s",
      status: `${path}.totalMs`,
      convert: "msToSeconds",
      ...common
    },
    {
      id: `${id}.syncResetResult`,
      name: {
        en: "Reset of the synchronous control: last result",
        de: "Reset der Synchronsteuerung: letztes Ergebnis"
      },
      type: "string",
      role: "text",
      states: { none: "none", done: "done", aborted: "aborted" },
      status: `${path}.result`,
      ...common
    },
    {
      id: `${id}.syncResetReason`,
      name: {
        en: "Reset of the synchronous control: reason of the abort",
        de: "Reset der Synchronsteuerung: Grund des Abbruchs"
      },
      type: "string",
      role: "text",
      states: {
        "": "-",
        iofault: "component of the switching outputs failed",
        nodevice: "component 0x72 does not answer",
        stopped: "all drives stopped before a restart or an update"
      },
      status: `${path}.reason`,
      ...common
    }
  ];
}
function axisStates(axis, plus, minus) {
  const id = `axes.${axis}`;
  const states = [
    {
      id: `${id}.enabled`,
      name: { en: "Axis in use", de: "Achse in Verwendung" },
      type: "boolean",
      role: "indicator",
      status: `${id}.enabled`
    },
    ...directionStates(axis, plus, minus),
    {
      id: `${id}.fault`,
      name: { en: "Runtime fault", de: "Laufzeitfehler" },
      type: "boolean",
      role: "indicator.alarm",
      status: `${id}.fault`
    },
    {
      id: `${id}.deviation`,
      name: { en: "Deviation from the sun", de: "Abweichung von der Sonne" },
      type: "number",
      role: "value",
      unit: "\u2030",
      status: `${id}.errPermille`
    }
  ];
  if (axis === "elevation") {
    states.push(
      {
        id: `${id}.flatDirection`,
        name: { en: "Direction of the flat position", de: "Richtung der Flachstellung" },
        type: "number",
        role: "value",
        states: { "-1": "MINUS (output DOWN)", 1: "PLUS (output UP)" },
        status: `${id}.flatDir`
      },
      {
        id: `${id}.angle`,
        name: { en: "Tilt", de: "Neigung" },
        type: "number",
        role: "value",
        unit: "\xB0",
        status: `${id}.deg`
      },
      {
        id: `${id}.angleSource`,
        name: { en: "Source of the tilt", de: "Herkunft der Neigung" },
        type: "string",
        role: "text",
        states: { hall: "counted (Hall tap)", time: "estimated from the travel time" },
        status: `${id}.degSource`
      },
      ...syncResetStates("elevation", void 0)
    );
  } else {
    states.push(...syncResetStates("azimuth", 2));
  }
  return states;
}
function jogState(axis, plus, minus) {
  return {
    id: axis === "elevation" ? "control.jogElevation" : "control.jogAzimuth",
    name: axis === "elevation" ? {
      en: "Manual drive elevation (write again at least once per second)",
      de: "Handfahrt Elevation (mindestens einmal pro Sekunde neu schreiben)"
    } : {
      en: "Manual drive azimuth (write again at least once per second)",
      de: "Handfahrt Azimut (mindestens einmal pro Sekunde neu schreiben)"
    },
    type: "number",
    role: "level",
    write: true,
    min: -1,
    max: 1,
    states: { "-1": minus.en, 0: "Stop", 1: plus.en }
  };
}
function elevationLabelStates(flatDir) {
  const { plus, minus } = elevationDirections(flatDir);
  return [...directionStates("elevation", plus, minus), jogState("elevation", plus, minus)];
}
function counter(key, name) {
  return { id: `counters.${key}`, name, type: "number", role: "value", status: `counters.${key}` };
}
const SUN = { feature: "sunpos" };
const POSITION = { feature: "position", mode: 1 };
const HALL = { feature: "hall", mode: 1 };
const COMMISSIONING = { feature: "commissioning" };
const REPORT = { feature: "reportjson" };
const FIRMWARE = { feature: "fwonline" };
const BATTERY = { feature: "battery" };
const POWER = { feature: "power" };
const CHARGECHECK = { feature: "chargecheck" };
const UPDATE = { feature: "update" };
const UPDATEPARK = { feature: "updatepark" };
const COMMISSIONING_STEPS = {
  safety: "Safety",
  plant: "Plant data",
  board: "Board and supply",
  wind: "Wind sensor",
  flatdir: "Direction of the flat position",
  elevtravel: "Travel of the elevation",
  azimuth: "Azimuth",
  syncreset: "Reset of the synchronous control",
  position: "Tilt on command",
  sensor: "Sun sensor",
  network: "Network and time",
  site: "Site",
  signals: "Lights, sound, motion detector",
  tracktest: "Test run of the automatic",
  done: "Completion"
};
const STATES = [
  // --- info: GET /api/info and values about the connection ---
  {
    id: "info.firmware",
    name: { en: "Firmware version", de: "Firmware-Stand" },
    type: "string",
    role: "info.firmware",
    info: "fw"
  },
  {
    id: "info.protocol",
    name: { en: "Protocol version", de: "Protokollversion" },
    type: "number",
    role: "value",
    info: "protocol"
  },
  {
    id: "info.deviceId",
    name: { en: "Device id (MAC address)", de: "Ger\xE4tekennung (MAC-Adresse)" },
    type: "string",
    role: "info.mac",
    info: "id"
  },
  {
    id: "info.hostname",
    name: { en: "Device name", de: "Ger\xE4tename" },
    type: "string",
    role: "info.name",
    info: "hostname"
  },
  {
    id: "info.ip",
    name: { en: "IP address", de: "IP-Adresse" },
    type: "string",
    role: "info.ip",
    info: "ip"
  },
  {
    id: "info.features",
    name: { en: "Features of the firmware", de: "F\xE4higkeiten der Firmware" },
    type: "string",
    role: "json",
    info: "features",
    convert: "json"
  },
  {
    id: "info.resetReason",
    name: { en: "Reason of the last reset", de: "Grund des letzten Neustarts" },
    type: "string",
    role: "text",
    info: "resetReason"
  },
  {
    id: "info.heapMin",
    name: { en: "Lowest free memory", de: "Geringster freier Speicher" },
    type: "number",
    role: "value",
    unit: "bytes",
    info: "heapMin"
  },
  {
    id: "info.bootId",
    name: { en: "Boot id (changes on every start)", de: "Start-Kennung (\xE4ndert sich bei jedem Start)" },
    type: "string",
    role: "text",
    status: "bootId"
  },
  {
    id: "info.bootTime",
    name: { en: "Start time of the device", de: "Startzeitpunkt des Ger\xE4ts" },
    type: "number",
    role: "date"
  },
  {
    id: "info.uptime",
    name: { en: "Uptime", de: "Laufzeit" },
    type: "number",
    role: "value.timer",
    unit: "s",
    status: "uptimeMs",
    convert: "msToSeconds",
    volatile: true
  },
  {
    id: "info.heapFree",
    name: { en: "Free memory", de: "Freier Speicher" },
    type: "number",
    role: "value",
    unit: "bytes",
    status: "heapFree",
    volatile: true
  },
  {
    id: "info.wifiRssi",
    name: { en: "WLAN signal strength", de: "WLAN-Signalst\xE4rke" },
    type: "number",
    role: "value.rssi",
    unit: "dBm",
    status: "wifiRssi",
    volatile: true
  },
  {
    id: "info.simulation",
    name: { en: "Simulation running (no real values)", de: "Simulation l\xE4uft (keine echten Werte)" },
    type: "boolean",
    role: "indicator",
    status: "simulation"
  },
  {
    id: "info.authorized",
    name: { en: "Token accepted, commands allowed", de: "Token angenommen, Befehle erlaubt" },
    type: "boolean",
    role: "indicator"
  },
  // --- status ---
  {
    id: "status.state",
    name: { en: "State", de: "Zustand" },
    type: "string",
    role: "info.status",
    states: CONTROLLER_STATES,
    status: "state"
  },
  {
    id: "status.auto",
    name: { en: "Automatic switched on", de: "Automatik eingeschaltet" },
    type: "boolean",
    role: "indicator",
    status: "auto"
  },
  {
    id: "status.setupDone",
    name: { en: "Setup completed", de: "Einrichtung abgeschlossen" },
    type: "boolean",
    role: "indicator",
    status: "setupDone"
  },
  {
    id: "status.mode",
    name: { en: "Operating mode", de: "Betriebsart" },
    type: "number",
    role: "value",
    states: { 1: "Vertical only", 2: "Vertical + horizontal" },
    status: "mode"
  },
  {
    id: "status.windSensor",
    name: { en: "Wind sensor type", de: "Windmesser-Typ" },
    type: "number",
    role: "value",
    states: { 1: "Wind speed only", 2: "Wind speed + direction" },
    status: "windSensor"
  },
  {
    id: "status.park",
    name: { en: "Park request active", de: "Parkanforderung besteht" },
    type: "boolean",
    role: "indicator",
    status: "park"
  },
  {
    id: "status.remoteLocked",
    name: { en: "Remote control locked at the display", de: "Fernsteuerung am Display gesperrt" },
    type: "boolean",
    role: "indicator",
    status: "remoteLocked"
  },
  {
    id: "status.design",
    name: { en: "Design chosen at the device", de: "Am Ger\xE4t gew\xE4hltes Design" },
    type: "number",
    role: "value",
    status: "design"
  },
  {
    id: "status.faultIo",
    name: { en: "Fault: I/O component", de: "St\xF6rung: E/A-Baustein" },
    type: "boolean",
    role: "indicator.alarm",
    status: "fault.io"
  },
  {
    id: "status.faultMotor",
    name: { en: "Fault: runtime of a drive", de: "St\xF6rung: Laufzeit eines Antriebs" },
    type: "boolean",
    role: "indicator.alarm",
    status: "fault.motor"
  },
  {
    id: "status.stormActive",
    name: { en: "Storm protection active", de: "Sturmschutz aktiv" },
    type: "boolean",
    role: "indicator.alarm",
    status: "storm.active"
  },
  {
    id: "status.stormRemaining",
    name: { en: "Storm protection: remaining time", de: "Sturmschutz: Restzeit" },
    type: "number",
    role: "value.timer",
    unit: "s",
    status: "storm.remainingMs",
    convert: "msToSeconds"
  },
  {
    id: "status.pendingConfirm",
    name: {
      en: "Settings waiting for confirmation at the display",
      de: "Einstellungen, die am Display auf Best\xE4tigung warten"
    },
    type: "string",
    role: "json",
    status: "pendingConfirm",
    convert: "json"
  },
  // --- axes: the names of the elevation directions follow axes.elevation.flatDir (main.ts) ---
  ...axisStates("elevation", elevationDirections(1).plus, elevationDirections(1).minus),
  ...axisStates("azimuth", AZIMUTH_PLUS, AZIMUTH_MINUS),
  // --- sun sensor ---
  {
    id: "sun.ok",
    name: { en: "Sun sensor ok", de: "Sonnensensor in Ordnung" },
    type: "boolean",
    role: "indicator",
    status: "sun.ok"
  },
  { id: "sun.east", name: { en: "East", de: "Ost" }, type: "number", role: "value", status: "sun.east" },
  { id: "sun.west", name: { en: "West", de: "West" }, type: "number", role: "value", status: "sun.west" },
  { id: "sun.south", name: { en: "South", de: "S\xFCd" }, type: "number", role: "value", status: "sun.south" },
  { id: "sun.north", name: { en: "North", de: "Nord" }, type: "number", role: "value", status: "sun.north" },
  // --- position of the sun (feature sunpos): times are Unix seconds at the device, here ms ---
  {
    id: "sunPosition.known",
    name: { en: "Time and site known", de: "Uhrzeit und Standort bekannt" },
    type: "boolean",
    role: "indicator",
    status: "sunPos.known",
    ...SUN
  },
  {
    id: "sunPosition.timeOk",
    name: { en: "Time set by the time server", de: "Uhrzeit vom Zeitserver gestellt" },
    type: "boolean",
    role: "indicator",
    status: "sunPos.timeOk",
    ...SUN
  },
  {
    id: "sunPosition.siteSet",
    name: { en: "Site entered", de: "Standort eingegeben" },
    type: "boolean",
    role: "indicator",
    status: "sunPos.siteSet",
    ...SUN
  },
  {
    id: "sunPosition.latitude",
    name: { en: "Latitude of the site", de: "Breite des Standorts" },
    type: "number",
    role: "value.gps.latitude",
    unit: "\xB0",
    status: "sunPos.lat",
    ...SUN
  },
  {
    id: "sunPosition.longitude",
    name: { en: "Longitude of the site", de: "L\xE4nge des Standorts" },
    type: "number",
    role: "value.gps.longitude",
    unit: "\xB0",
    status: "sunPos.lon",
    ...SUN
  },
  {
    id: "sunPosition.azimuth",
    name: { en: "Azimuth of the sun (0 = north, 90 = east)", de: "Himmelsrichtung der Sonne (0 = Nord, 90 = Ost)" },
    type: "number",
    role: "value.sun.azimuth",
    unit: "\xB0",
    status: "sunPos.az",
    ...SUN
  },
  {
    id: "sunPosition.elevation",
    name: { en: "Elevation of the sun above the horizon", de: "H\xF6he der Sonne \xFCber dem Horizont" },
    type: "number",
    role: "value.sun.elevation",
    unit: "\xB0",
    status: "sunPos.el",
    ...SUN
  },
  {
    id: "sunPosition.sunrise",
    name: { en: "Sunrise today", de: "Sonnenaufgang heute" },
    type: "number",
    role: "date.sunrise",
    status: "sunPos.rise",
    convert: "secondsToMs",
    ...SUN
  },
  {
    id: "sunPosition.sunset",
    name: { en: "Sunset today", de: "Sonnenuntergang heute" },
    type: "number",
    role: "date.sunset",
    status: "sunPos.set",
    convert: "secondsToMs",
    ...SUN
  },
  {
    id: "sunPosition.noon",
    name: { en: "Highest position of the sun today", de: "H\xF6chster Sonnenstand heute" },
    type: "number",
    role: "value.time",
    status: "sunPos.noon",
    convert: "secondsToMs",
    ...SUN
  },
  {
    id: "sunPosition.noonElevation",
    name: { en: "Elevation of the sun at its highest position", de: "H\xF6he der Sonne beim h\xF6chsten Stand" },
    type: "number",
    role: "value",
    unit: "\xB0",
    status: "sunPos.noonEl",
    ...SUN
  },
  {
    id: "sunPosition.alwaysUp",
    name: { en: "Polar day today", de: "Polartag heute" },
    type: "boolean",
    role: "indicator",
    status: "sunPos.alwaysUp",
    ...SUN
  },
  {
    id: "sunPosition.alwaysDown",
    name: { en: "Polar night today", de: "Polarnacht heute" },
    type: "boolean",
    role: "indicator",
    status: "sunPos.alwaysDown",
    ...SUN
  },
  {
    id: "sunPosition.night",
    name: { en: "Night by the position of the sun", de: "Nacht nach dem Sonnenstand" },
    type: "boolean",
    role: "indicator",
    status: "sunPos.night",
    ...SUN
  },
  {
    id: "sunPosition.nightStart",
    name: { en: "Beginning of the night today", de: "Beginn der Nacht heute" },
    type: "number",
    role: "value.time",
    status: "sunPos.nightStart",
    convert: "secondsToMs",
    ...SUN
  },
  {
    id: "sunPosition.dayStart",
    name: { en: "Beginning of the day today", de: "Beginn des Tages heute" },
    type: "number",
    role: "value.time",
    status: "sunPos.dayStart",
    convert: "secondsToMs",
    ...SUN
  },
  {
    id: "sunPosition.rackAzimuth",
    name: {
      en: "Orientation of the rack (0 = south, west positive)",
      de: "Ausrichtung des Racks (0 = S\xFCd, nach Westen positiv)"
    },
    type: "number",
    role: "value",
    unit: "\xB0",
    status: "sunPos.rackAz",
    ...SUN,
    mode: 1
  },
  {
    id: "sunPosition.bestTilt",
    name: { en: "Best tilt now", de: "Bester Neigungswinkel jetzt" },
    type: "number",
    role: "value",
    unit: "\xB0",
    status: "sunPos.bestTilt",
    ...SUN,
    mode: 1
  },
  {
    id: "sunPosition.astroTarget",
    name: { en: "Calculated angle when cloudy", de: "Berechneter Winkel bei Bew\xF6lkung" },
    type: "number",
    role: "value",
    unit: "\xB0",
    status: "sunPos.astroTarget",
    ...SUN
  },
  // --- wind ---
  {
    id: "wind.ok",
    name: { en: "Wind sensor answers", de: "Windmesser antwortet" },
    type: "boolean",
    role: "indicator",
    status: "wind.ok"
  },
  {
    id: "wind.speed",
    name: { en: "Wind speed", de: "Windgeschwindigkeit" },
    type: "number",
    role: "value.speed.wind",
    unit: "km/h",
    status: "wind.kmh"
  },
  {
    id: "wind.gust",
    name: { en: "Gust", de: "B\xF6e" },
    type: "number",
    role: "value.speed.wind.gust",
    unit: "km/h",
    status: "wind.gustKmh"
  },
  {
    id: "wind.maxGust",
    name: { en: "Strongest gust", de: "H\xF6chste B\xF6e" },
    type: "number",
    role: "value.speed.max.wind",
    unit: "km/h",
    status: "wind.maxGustKmh"
  },
  {
    id: "wind.stormThreshold",
    name: { en: "Storm threshold (gust)", de: "Sturmschwelle (B\xF6e)" },
    type: "number",
    role: "value",
    unit: "km/h",
    status: "wind.stormKmh"
  },
  {
    id: "wind.hasDirection",
    name: { en: "Wind sensor with direction", de: "Windmesser mit Richtung" },
    type: "boolean",
    role: "indicator",
    status: "wind.hasDirection"
  },
  {
    id: "wind.directionOk",
    name: { en: "Wind direction valid", de: "Windrichtung g\xFCltig" },
    type: "boolean",
    role: "indicator",
    status: "wind.dirOk"
  },
  {
    id: "wind.direction",
    name: { en: "Wind direction", de: "Windrichtung" },
    type: "number",
    role: "value.direction.wind",
    unit: "\xB0",
    status: "wind.dirDeg"
  },
  // --- components and supplies ---
  {
    id: "io.relayOk",
    name: { en: "Component of the switching outputs answers", de: "Baustein der Schaltausg\xE4nge antwortet" },
    type: "boolean",
    role: "indicator.reachable",
    status: "io.relayOk"
  },
  {
    id: "io.ledOk",
    name: { en: "Component of the indicator lights answers", de: "Baustein der Meldeleuchten antwortet" },
    type: "boolean",
    role: "indicator.reachable",
    status: "io.ledOk"
  },
  {
    id: "supply.monitored",
    name: { en: "Current limiters monitored", de: "Strombegrenzer \xFCberwacht" },
    type: "boolean",
    role: "indicator",
    status: "supply.monitored"
  },
  {
    id: "supply.sensorFault",
    name: { en: "Fault: sensor supply", de: "St\xF6rung: Sensorversorgung" },
    type: "boolean",
    role: "indicator.alarm",
    status: "supply.sensorFault"
  },
  {
    id: "supply.ledFault",
    name: { en: "Fault: supply of the lights", de: "St\xF6rung: Leuchtenversorgung" },
    type: "boolean",
    role: "indicator.alarm",
    status: "supply.ledFault"
  },
  {
    id: "leds.ready",
    name: { en: "Light READY", de: "Leuchte BEREIT" },
    type: "string",
    role: "text",
    states: { off: "off", on: "on", blink: "blinking" },
    status: "leds.ready"
  },
  {
    id: "leds.fail",
    name: { en: "Light FAIL", de: "Leuchte FAIL" },
    type: "string",
    role: "text",
    states: { off: "off", red: "red", yellow: "yellow", blue: "blue" },
    status: "leds.fail"
  },
  {
    id: "supply.v24",
    name: { en: "24 V present", de: "24 V vorhanden" },
    type: "boolean",
    role: "indicator",
    status: "supply.v24",
    ...POWER
  },
  {
    id: "supply.v5",
    name: { en: "5 V present", de: "5 V vorhanden" },
    type: "boolean",
    role: "indicator",
    status: "supply.v5",
    ...POWER
  },
  {
    id: "supply.adcOk",
    name: {
      en: "Component for checking the charge lock answers",
      de: "Baustein zur Pr\xFCfung der Ladesperre antwortet"
    },
    type: "boolean",
    role: "indicator.reachable",
    status: "supply.adcOk",
    ...CHARGECHECK
  },
  {
    id: "supply.checks",
    name: {
      en: "Pending findings of the charge lock check",
      de: "Anstehende Befunde der Pr\xFCfung der Ladesperre"
    },
    type: "string",
    role: "json",
    status: "supply.checks",
    convert: "json",
    ...CHARGECHECK
  },
  // --- built-in battery of the board (feature battery), display only ---
  {
    id: "battery.fitted",
    name: { en: "Battery fitted (setting)", de: "Akku eingebaut (Einstellung)" },
    type: "boolean",
    role: "indicator",
    status: "battery.fitted",
    ...BATTERY
  },
  {
    id: "battery.valid",
    name: { en: "Valid measurement of the battery", de: "G\xFCltige Messung des Akkus" },
    type: "boolean",
    role: "indicator",
    status: "battery.valid",
    ...BATTERY
  },
  {
    id: "battery.percent",
    name: { en: "Charge level of the battery", de: "F\xFCllstand des Akkus" },
    type: "number",
    role: "value.battery",
    unit: "%",
    min: 0,
    max: 100,
    status: "battery.percent",
    ...BATTERY
  },
  {
    id: "battery.charging",
    name: { en: "Battery is charging", de: "Akku wird geladen" },
    type: "boolean",
    role: "indicator",
    status: "battery.charging",
    ...BATTERY
  },
  {
    id: "battery.level",
    name: { en: "Level of the battery", de: "Stufe des Akkus" },
    type: "string",
    role: "text",
    states: { ok: "ok", low: "low", critical: "critical" },
    status: "battery.level",
    ...BATTERY
  },
  // --- firmware update over the network or the internet (feature update) ---
  {
    id: "update.active",
    name: { en: "New firmware is being written", de: "Neue Firmware wird geschrieben" },
    type: "boolean",
    role: "indicator.working",
    status: "update.active",
    ...UPDATE
  },
  {
    id: "update.percent",
    name: { en: "Progress of writing", de: "Fortschritt beim Schreiben" },
    type: "number",
    role: "value.progress",
    unit: "%",
    min: 0,
    max: 100,
    status: "update.percent",
    ...UPDATE
  },
  {
    id: "update.phase",
    name: { en: "Phase of the update", de: "Phase des Updates" },
    type: "string",
    role: "text",
    states: {
      none: "no update",
      loading: "receiving and checking the image",
      parking: "moving to the flat position",
      writing: "writing"
    },
    status: "update.phase",
    ...UPDATEPARK
  },
  {
    id: "update.error",
    name: {
      en: "Reason why the last update was not written",
      de: "Grund, warum das letzte Update nicht geschrieben wurde"
    },
    type: "string",
    role: "text",
    status: "update.error",
    ...UPDATEPARK
  },
  // --- remote manual drive ---
  {
    id: "jog.active",
    name: { en: "Remote manual drive running", de: "Handfahrt aus der Ferne l\xE4uft" },
    type: "boolean",
    role: "indicator.working",
    status: "jog.active"
  },
  { id: "jog.axis", name: { en: "Axis", de: "Achse" }, type: "string", role: "text", status: "jog.axis" },
  {
    id: "jog.direction",
    name: { en: "Direction", de: "Richtung" },
    type: "number",
    role: "value",
    states: { "-1": "MINUS", 0: "Stop", 1: "PLUS" },
    status: "jog.dir"
  },
  // --- tilt on command (feature position, vertical only) ---
  {
    id: "position.target",
    name: { en: "Commanded angle", de: "Befohlener Winkel" },
    type: "number",
    role: "value",
    unit: "\xB0",
    status: "position.target",
    ...POSITION
  },
  {
    id: "position.phase",
    name: { en: "Phase of the tilt on command", de: "Ablauf der Neigung auf Befehl" },
    type: "string",
    role: "text",
    states: {
      none: "none",
      reference: "reference drive to the flat position",
      move: "drive to the angle",
      hold: "angle reached, automatic pauses",
      nocal: "travel time not measured: no drive",
      hallfault: "Hall tap failed: no drive"
    },
    status: "position.phase",
    ...POSITION
  },
  {
    id: "position.angle",
    name: { en: "Tilt", de: "Neigung" },
    type: "number",
    role: "value",
    unit: "\xB0",
    status: "position.deg",
    ...POSITION
  },
  {
    id: "position.known",
    name: { en: "Tilt known", de: "Neigung bekannt" },
    type: "boolean",
    role: "indicator",
    status: "position.known",
    ...POSITION
  },
  {
    id: "position.uncertainty",
    name: { en: "Estimated uncertainty of the tilt", de: "Gesch\xE4tzte Unsicherheit der Neigung" },
    type: "number",
    role: "value",
    unit: "\xB0",
    status: "position.uncert",
    ...POSITION
  },
  {
    id: "position.calibrated",
    name: {
      en: "Travel times measured (angles in between possible)",
      de: "Fahrzeiten eingemessen (Zwischenwinkel m\xF6glich)"
    },
    type: "boolean",
    role: "indicator",
    status: "position.calibrated",
    ...POSITION
  },
  {
    id: "position.presets",
    name: { en: "Angles offered", de: "Angebotene Winkel" },
    type: "string",
    role: "json",
    status: "position.presets",
    convert: "json",
    ...POSITION
  },
  {
    id: "position.wait",
    name: {
      en: "Waiting time until a drive to the end position",
      de: "Wartezeit bis zu einer Fahrt in die Endlage"
    },
    type: "number",
    role: "value.timer",
    unit: "s",
    status: "position.waitMs",
    convert: "msToSeconds",
    ...POSITION
  },
  {
    id: "position.source",
    name: { en: "Source of the tilt", de: "Herkunft der Neigung" },
    type: "string",
    role: "text",
    states: { hall: "counted (Hall tap)", time: "estimated from the travel time" },
    status: "position.source",
    ...HALL
  },
  {
    id: "position.hallEnabled",
    name: { en: "Hall tap switched on", de: "Hall-Abgriff eingeschaltet" },
    type: "boolean",
    role: "indicator",
    status: "position.hall.enabled",
    ...HALL
  },
  {
    id: "position.hallOk",
    name: { en: "Hall tap ok", de: "Hall-Abgriff in Ordnung" },
    type: "boolean",
    role: "indicator",
    status: "position.hall.ok",
    ...HALL
  },
  {
    id: "position.hallFault",
    name: { en: "Fault of the Hall tap", de: "St\xF6rung des Hall-Abgriffs" },
    type: "string",
    role: "text",
    states: {
      nodriver: "counter of the board not set up",
      nosteps: "no Hall pulses",
      reversed: "counts against the direction of travel",
      noise: "more steps than the drive can deliver"
    },
    status: "position.hall.fault",
    ...HALL
  },
  {
    id: "position.hallCount",
    name: { en: "Hall steps from the flat position", de: "Hall-Schritte ab der Flachstellung" },
    type: "number",
    role: "value",
    status: "position.hall.count",
    ...HALL
  },
  {
    id: "position.hallSteps",
    name: { en: "Hall steps per stroke (measured)", de: "Hall-Schritte je Hub (eingemessen)" },
    type: "number",
    role: "value",
    status: "position.hall.steps",
    ...HALL
  },
  {
    id: "position.hallFaults",
    name: { en: "Failures of the Hall tap since the start", de: "Ausf\xE4lle des Hall-Abgriffs seit dem Start" },
    type: "number",
    role: "value",
    status: "position.hall.faults",
    ...HALL
  },
  // --- setup program (feature commissioning, operated only at the display) ---
  {
    id: "commissioning.done",
    name: { en: "Setup program completed", de: "Setup-Programm abgeschlossen" },
    type: "boolean",
    role: "indicator",
    status: "commissioning.done",
    ...COMMISSIONING
  },
  {
    id: "commissioning.active",
    name: { en: "Setup program open at the display", de: "Setup-Programm am Display ge\xF6ffnet" },
    type: "boolean",
    role: "indicator.working",
    status: "commissioning.active",
    ...COMMISSIONING
  },
  {
    id: "commissioning.step",
    name: { en: "Current step", de: "Aktueller Schritt" },
    type: "string",
    role: "text",
    states: COMMISSIONING_STEPS,
    status: "commissioning.step",
    ...COMMISSIONING
  },
  {
    id: "commissioning.phase",
    name: { en: "Phase of the step", de: "Ablauf im Schritt" },
    type: "string",
    role: "text",
    states: {
      intro: "introduction",
      check: "check",
      jog: "test drive",
      ask: "question",
      fix: "remedy",
      run: "running",
      input: "input",
      passed: "passed",
      failed: "failed"
    },
    status: "commissioning.phase",
    ...COMMISSIONING
  },
  {
    id: "commissioning.number",
    name: { en: "Number of the step", de: "Nummer des Schritts" },
    type: "number",
    role: "value",
    status: "commissioning.number",
    ...COMMISSIONING
  },
  {
    id: "commissioning.total",
    name: { en: "Number of steps", de: "Anzahl der Schritte" },
    type: "number",
    role: "value",
    status: "commissioning.total",
    ...COMMISSIONING
  },
  {
    id: "commissioning.optional",
    name: { en: "Step may be skipped", de: "Schritt darf \xFCbersprungen werden" },
    type: "boolean",
    role: "indicator",
    status: "commissioning.optional",
    ...COMMISSIONING
  },
  {
    id: "commissioning.report0",
    name: { en: "Test report, newest", de: "Pr\xFCfbericht, neuester" },
    type: "string",
    role: "text",
    ...COMMISSIONING
  },
  {
    id: "commissioning.report1",
    name: { en: "Test report, second newest", de: "Pr\xFCfbericht, zweitneuester" },
    type: "string",
    role: "text",
    ...COMMISSIONING
  },
  {
    id: "commissioning.report2",
    name: { en: "Test report, third newest", de: "Pr\xFCfbericht, drittneuester" },
    type: "string",
    role: "text",
    ...COMMISSIONING
  },
  // --- data set of the newest test report (feature reportjson) ---
  {
    id: "commissioning.report.date",
    name: { en: "Completion of the setup program", de: "Abschluss des Setup-Programms" },
    type: "number",
    role: "date",
    report: "epoch",
    convert: "secondsToMs",
    ...REPORT
  },
  {
    id: "commissioning.report.passed",
    name: { en: "All mandatory steps passed", de: "Alle Pflichtschritte bestanden" },
    type: "boolean",
    role: "indicator",
    report: "done",
    ...REPORT
  },
  {
    id: "commissioning.report.simulation",
    name: { en: "Run in the simulation", de: "In der Simulation durchlaufen" },
    type: "boolean",
    role: "indicator",
    report: "simulation",
    ...REPORT
  },
  {
    id: "commissioning.report.firmware",
    name: { en: "Firmware of the report", de: "Firmware des Berichts" },
    type: "string",
    role: "text",
    report: "fw",
    ...REPORT
  },
  {
    id: "commissioning.report.duration",
    name: { en: "Duration of the setup program", de: "Dauer des Setup-Programms" },
    type: "number",
    role: "time.span",
    unit: "s",
    report: "durationS",
    ...REPORT
  },
  {
    id: "commissioning.report.flatRun",
    name: { en: "Travel time to the flat position", de: "Fahrzeit in die Flachstellung" },
    type: "number",
    role: "time.span",
    unit: "ms",
    report: "values.flatRunMs",
    ...REPORT
  },
  {
    id: "commissioning.report.travelSteeper",
    name: { en: "Travel time 0\xB0 to 60\xB0 (steeper)", de: "Fahrzeit 0\xB0 bis 60\xB0 (steiler)" },
    type: "number",
    role: "time.span",
    unit: "ms",
    report: "values.elevSteepMs",
    ...REPORT
  },
  {
    id: "commissioning.report.travelFlatter",
    name: { en: "Travel time 60\xB0 to 0\xB0 (flatter)", de: "Fahrzeit 60\xB0 bis 0\xB0 (flacher)" },
    type: "number",
    role: "time.span",
    unit: "ms",
    report: "values.elevFlatMs",
    ...REPORT
  },
  {
    id: "commissioning.report.hallSteps",
    name: { en: "Hall steps per stroke", de: "Hall-Schritte je Hub" },
    type: "number",
    role: "value",
    report: "values.elevHallSteps",
    ...REPORT
  },
  {
    id: "commissioning.report.azimuthEast",
    name: { en: "Travel time azimuth to the east", de: "Fahrzeit Azimut nach Osten" },
    type: "number",
    role: "time.span",
    unit: "ms",
    report: "values.azEastMs",
    ...REPORT
  },
  {
    id: "commissioning.report.azimuthWest",
    name: { en: "Travel time azimuth to the west", de: "Fahrzeit Azimut nach Westen" },
    type: "number",
    role: "time.span",
    unit: "ms",
    report: "values.azWestMs",
    ...REPORT
  },
  {
    id: "commissioning.report.azimuthBack",
    name: { en: "Travel time azimuth back", de: "Fahrzeit Azimut zur\xFCck" },
    type: "number",
    role: "time.span",
    unit: "ms",
    report: "values.azBackMs",
    ...REPORT
  },
  {
    id: "commissioning.report.steps",
    name: { en: "Steps with their result", de: "Schritte mit ihrem Ergebnis" },
    type: "string",
    role: "json",
    report: "steps",
    convert: "json",
    ...REPORT
  },
  {
    id: "commissioning.report.stepsPassed",
    name: { en: "Steps passed", de: "Bestandene Schritte" },
    type: "number",
    role: "value",
    ...REPORT
  },
  {
    id: "commissioning.report.stepsSkipped",
    name: { en: "Steps skipped", de: "\xDCbersprungene Schritte" },
    type: "number",
    role: "value",
    ...REPORT
  },
  {
    id: "commissioning.report.stepsOpen",
    name: { en: "Steps open", de: "Offene Schritte" },
    type: "number",
    role: "value",
    ...REPORT
  },
  {
    id: "commissioning.report.json",
    name: { en: "Complete data set of the report", de: "Vollst\xE4ndiger Datensatz des Berichts" },
    type: "string",
    role: "json",
    ...REPORT
  },
  // --- firmware over the internet (feature fwonline) ---
  {
    id: "firmware.state",
    name: { en: "State of the version check", de: "Stand der Versionspr\xFCfung" },
    type: "string",
    role: "text",
    states: {
      unknown: "not checked yet",
      checking: "checking",
      uptodate: "up to date",
      available: "newer version available",
      needsstep: "newer version, intermediate version needed",
      error: "check failed",
      downloading: "downloading",
      verifying: "verifying",
      waiting: "waiting for the flat position",
      writing: "writing",
      done: "done, restart follows",
      failed: "not installed"
    },
    status: "fwOnline.state",
    ...FIRMWARE
  },
  {
    id: "firmware.current",
    name: { en: "Running firmware", de: "Laufende Firmware" },
    type: "string",
    role: "info.firmware",
    status: "fwOnline.current",
    ...FIRMWARE
  },
  {
    id: "firmware.latest",
    name: { en: "Newest version found", de: "Neueste gefundene Version" },
    type: "string",
    role: "text",
    status: "fwOnline.latest",
    ...FIRMWARE
  },
  {
    id: "firmware.date",
    name: { en: "Date of the newest version", de: "Datum der neuesten Version" },
    type: "string",
    role: "date",
    status: "fwOnline.date",
    ...FIRMWARE
  },
  {
    id: "firmware.notes",
    name: { en: "Notes of the newest version", de: "Hinweise zur neuesten Version" },
    type: "string",
    role: "text",
    status: "fwOnline.notes",
    ...FIRMWARE
  },
  {
    id: "firmware.size",
    name: { en: "Size of the newest version", de: "Gr\xF6\xDFe der neuesten Version" },
    type: "number",
    role: "value",
    unit: "bytes",
    status: "fwOnline.size",
    ...FIRMWARE
  },
  {
    id: "firmware.checkedAgo",
    name: { en: "Time since the last check", de: "Zeit seit der letzten Pr\xFCfung" },
    type: "number",
    role: "time.span",
    unit: "s",
    status: "fwOnline.checkedAgoMs",
    convert: "msToSeconds",
    ...FIRMWARE
  },
  {
    id: "firmware.error",
    name: { en: "Reason of the last failure", de: "Grund des letzten Fehlschlags" },
    type: "string",
    role: "text",
    status: "fwOnline.error",
    ...FIRMWARE
  },
  {
    id: "firmware.percent",
    name: { en: "Progress of loading or writing", de: "Fortschritt beim Laden oder Schreiben" },
    type: "number",
    role: "value.progress",
    unit: "%",
    status: "fwOnline.percent",
    ...FIRMWARE
  },
  {
    id: "firmware.rolledBack",
    name: { en: "Version taken back by the device", de: "Vom Ger\xE4t zur\xFCckgenommene Version" },
    type: "string",
    role: "text",
    status: "fwOnline.rolledBack",
    ...FIRMWARE
  },
  {
    id: "firmware.newer",
    name: { en: "Newer version known", de: "Neuere Version bekannt" },
    type: "boolean",
    role: "indicator",
    status: "fwOnline.newer",
    ...FIRMWARE
  },
  {
    id: "firmware.canInstall",
    name: { en: "Newest version can be installed now", de: "Neueste Version jetzt installierbar" },
    type: "boolean",
    role: "indicator",
    status: "fwOnline.canInstall",
    ...FIRMWARE
  },
  {
    id: "firmware.keyPresent",
    name: { en: "Signing key of the project present", de: "Signierschl\xFCssel des Projekts vorhanden" },
    type: "boolean",
    role: "indicator",
    status: "fwOnline.keyPresent",
    ...FIRMWARE
  },
  {
    id: "firmware.awaitingConfirm",
    name: { en: "New firmware waits for its self test", de: "Neue Firmware wartet auf ihren Selbsttest" },
    type: "boolean",
    role: "indicator",
    status: "fwOnline.awaitingConfirm",
    ...FIRMWARE
  },
  // --- counters ---
  counter("relayIoErrors", { en: "Errors: switching outputs", de: "Fehler: Schaltausg\xE4nge" }),
  counter("ledIoErrors", { en: "Errors: indicator lights", de: "Fehler: Meldeleuchten" }),
  counter("lightErrors", { en: "Errors: sun sensor", de: "Fehler: Sonnensensor" }),
  counter("windErrors", { en: "Errors: wind speed", de: "Fehler: Windgeschwindigkeit" }),
  counter("windDirErrors", { en: "Errors: wind direction", de: "Fehler: Windrichtung" }),
  counter("sensorSupplyFaults", { en: "Faults: sensor supply", de: "St\xF6rungen: Sensorversorgung" }),
  counter("ledSupplyFaults", { en: "Faults: supply of the lights", de: "St\xF6rungen: Leuchtenversorgung" }),
  {
    id: "counters.logLost",
    name: { en: "Messages dropped by the device", de: "Vom Ger\xE4t verworfene Meldungen" },
    type: "number",
    role: "value",
    status: "logLost"
  },
  // --- commands ---
  {
    id: "control.auto",
    name: { en: "Automatic on/off", de: "Automatik ein/aus" },
    type: "boolean",
    role: "switch",
    write: true,
    status: "auto"
  },
  {
    id: "control.park",
    name: { en: "Park flat on/off", de: "Flach parken ein/aus" },
    type: "boolean",
    role: "switch",
    write: true,
    status: "park"
  },
  {
    id: "control.acknowledge",
    name: { en: "Acknowledge fault", de: "St\xF6rung quittieren" },
    type: "boolean",
    role: "button",
    write: true,
    read: false
  },
  jogState("elevation", elevationDirections(1).plus, elevationDirections(1).minus),
  jogState("azimuth", AZIMUTH_PLUS, AZIMUTH_MINUS),
  {
    id: "control.position",
    name: {
      en: "Tilt the elevation to an offered angle (position.presets)",
      de: "Elevation auf einen angebotenen Winkel neigen (position.presets)"
    },
    type: "number",
    role: "level",
    unit: "\xB0",
    write: true,
    min: 0,
    max: 60,
    status: "position.target",
    ...POSITION
  },
  {
    id: "control.positionResume",
    name: {
      en: "Cancel the tilt on command, continue the automatic",
      de: "Neigung auf Befehl aufheben, Automatik fortsetzen"
    },
    type: "boolean",
    role: "button.resume",
    write: true,
    read: false,
    ...POSITION
  },
  {
    id: "control.syncResetElevation",
    name: {
      en: "Reset the synchronous control of the elevation (make sure the swivel range is clear)",
      de: "Synchronsteuerung der Elevation zur\xFCcksetzen (vorher den Schwenkbereich frei machen)"
    },
    type: "boolean",
    role: "button",
    write: true,
    read: false,
    feature: "syncreset"
  },
  {
    id: "control.syncResetAzimuth",
    name: {
      en: "Reset the synchronous control of the azimuth (make sure the swivel range is clear)",
      de: "Synchronsteuerung des Azimuts zur\xFCcksetzen (vorher den Schwenkbereich frei machen)"
    },
    type: "boolean",
    role: "button",
    write: true,
    read: false,
    feature: "syncreset",
    mode: 2
  },
  {
    id: "control.fwCheck",
    name: { en: "Check for newer firmware now", de: "Jetzt nach neuerer Firmware suchen" },
    type: "boolean",
    role: "button",
    write: true,
    read: false,
    ...FIRMWARE
  },
  {
    id: "control.fwInstall",
    name: {
      en: "Install firmware: write the version of firmware.latest",
      de: "Firmware installieren: die Version aus firmware.latest schreiben"
    },
    type: "string",
    role: "text",
    write: true,
    ...FIRMWARE
  },
  {
    id: "control.design",
    name: { en: "Design of the display and the web page", de: "Design von Display und Weboberfl\xE4che" },
    type: "number",
    role: "level",
    write: true,
    min: 0,
    status: "design"
  },
  {
    id: "control.endSimulation",
    name: { en: "End the simulation (the device restarts)", de: "Simulation beenden (das Ger\xE4t startet neu)" },
    type: "boolean",
    role: "button",
    write: true,
    read: false
  },
  {
    id: "control.lastResult",
    name: { en: "Result of the last command", de: "Ergebnis des letzten Befehls" },
    type: "string",
    role: "json"
  },
  // --- setup: both values are chosen first and then saved together, like at the display ---
  {
    id: "setup.mode",
    name: {
      en: "Operating mode (takes effect with setup.save)",
      de: "Betriebsart (gilt erst mit setup.save)"
    },
    type: "number",
    role: "level",
    write: true,
    min: 1,
    max: 2,
    states: { 1: "Vertical only", 2: "Vertical + horizontal" },
    status: "mode"
  },
  {
    id: "setup.windSensor",
    name: {
      en: "Wind sensor type (takes effect with setup.save)",
      de: "Windmesser-Typ (gilt erst mit setup.save)"
    },
    type: "number",
    role: "level",
    write: true,
    min: 1,
    max: 2,
    states: { 1: "Wind speed only", 2: "Wind speed + direction" },
    status: "windSensor"
  },
  {
    id: "setup.save",
    name: {
      en: "Save the setup (drives stop, the device restarts)",
      de: "Einrichtung speichern (Antriebe stoppen, das Ger\xE4t startet neu)"
    },
    type: "boolean",
    role: "button",
    write: true,
    read: false
  },
  // --- settings: the states of the single settings are created from GET /api/params ---
  {
    id: "params.pending",
    name: {
      en: "Proposals waiting for confirmation at the display",
      de: "Vorschl\xE4ge, die am Display auf Best\xE4tigung warten"
    },
    type: "string",
    role: "json"
  },
  {
    id: "params.lastResult",
    name: { en: "Result of the last change", de: "Ergebnis der letzten \xC4nderung" },
    type: "string",
    role: "json"
  },
  // --- messages ---
  {
    id: "messages.last",
    name: { en: "Last message", de: "Letzte Meldung" },
    type: "string",
    role: "text"
  },
  {
    id: "messages.lastJson",
    name: { en: "Last message with time and level", de: "Letzte Meldung mit Zeit und Stufe" },
    type: "string",
    role: "json"
  },
  {
    id: "messages.lastFault",
    name: { en: "Last warning or error", de: "Letzte Warnung oder St\xF6rung" },
    type: "string",
    role: "text"
  },
  {
    id: "messages.history",
    name: { en: "Latest messages, newest first", de: "Letzte Meldungen, neueste zuerst" },
    type: "string",
    role: "json"
  },
  {
    id: "messages.lastSeq",
    name: { en: "Sequence number of the last message", de: "Laufende Nummer der letzten Meldung" },
    type: "number",
    role: "value"
  },
  {
    id: "messages.lost",
    name: {
      en: "Messages lost since the start of the adapter",
      de: "Seit dem Start des Adapters verlorene Meldungen"
    },
    type: "number",
    role: "value"
  }
];
function convertValue(def, raw) {
  if (raw === void 0) {
    return void 0;
  }
  if (def.convert === "json") {
    return JSON.stringify(raw);
  }
  if (raw === null) {
    return null;
  }
  if (def.convert === "msToSeconds") {
    return typeof raw === "number" ? Math.floor(raw / 1e3) : void 0;
  }
  if (def.convert === "secondsToMs") {
    return typeof raw === "number" ? raw * 1e3 : void 0;
  }
  return typeof raw === def.type ? raw : void 0;
}
function statusToValues(status, layout) {
  const values = /* @__PURE__ */ new Map();
  for (const def of STATES) {
    if (!def.status || !isAvailable(def, layout)) {
      continue;
    }
    const value = convertValue(def, (0, import_protocol.readPath)(status, def.status));
    if (value !== void 0) {
      values.set(def.id, value);
    }
  }
  return values;
}
function infoToValues(info) {
  const values = /* @__PURE__ */ new Map();
  for (const def of STATES) {
    if (!def.info) {
      continue;
    }
    const value = convertValue(def, (0, import_protocol.readPath)(info, def.info));
    if (value !== void 0) {
      values.set(def.id, value);
    }
  }
  return values;
}
function reportToValues(report) {
  var _a;
  const values = /* @__PURE__ */ new Map();
  const defs = STATES.filter((def) => def.id.startsWith("commissioning.report."));
  if (!(0, import_protocol.isObject)(report)) {
    for (const def of defs) {
      values.set(def.id, null);
    }
    return values;
  }
  for (const def of defs) {
    if (!def.report) {
      continue;
    }
    values.set(def.id, (_a = convertValue(def, (0, import_protocol.readPath)(report, def.report))) != null ? _a : null);
  }
  const steps = Array.isArray(report.steps) ? report.steps : [];
  const count = (result) => steps.filter((step) => (0, import_protocol.isObject)(step) && step.result === result).length;
  values.set("commissioning.report.stepsPassed", count("passed"));
  values.set("commissioning.report.stepsSkipped", count("skipped"));
  values.set("commissioning.report.stepsOpen", count("open"));
  values.set("commissioning.report.json", JSON.stringify(report));
  return values;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ELEVATION_FLATTER,
  ELEVATION_STEEPER,
  NODES,
  STATES,
  convertValue,
  elevationDirections,
  elevationLabelStates,
  infoToValues,
  isAvailable,
  isConditional,
  reportToValues,
  statusToValues
});
//# sourceMappingURL=states.js.map
