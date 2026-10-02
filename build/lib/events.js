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
var events_exports = {};
__export(events_exports, {
  EVENT_CATEGORIES: () => EVENT_CATEGORIES,
  EventDetector: () => EventDetector
});
module.exports = __toCommonJS(events_exports);
var import_protocol = require("./protocol");
const EVENT_CATEGORIES = ["storm", "fault", "wind", "sensor", "connection", "restart"];
function flag(status, path, fallback) {
  const value = (0, import_protocol.readPath)(status, path);
  return typeof value === "boolean" ? value : fallback;
}
function speed(value) {
  return typeof value === "number" ? value.toFixed(1) : "?";
}
class EventDetector {
  previous;
  /**
   * Compares a status with the one before.
   *
   * @param status the new status
   * @returns the events; none for the very first status, which only sets the starting point
   */
  update(status) {
    const now = {
      storm: flag(status, "storm.active", false),
      faultIo: flag(status, "fault.io", false),
      faultMotor: flag(status, "fault.motor", false),
      windOk: flag(status, "wind.ok", true),
      sunOk: flag(status, "sun.ok", true)
    };
    const before = this.previous;
    this.previous = now;
    if (!before) {
      return [];
    }
    const events = [];
    if (now.storm && !before.storm) {
      events.push({
        category: "storm",
        key: "stormStarted",
        params: {
          gust: speed((0, import_protocol.readPath)(status, "wind.gustKmh")),
          threshold: speed((0, import_protocol.readPath)(status, "wind.stormKmh"))
        }
      });
    } else if (!now.storm && before.storm) {
      events.push({ category: "storm", key: "stormEnded", params: {} });
    }
    if (now.faultIo && !before.faultIo) {
      events.push({ category: "fault", key: "faultIo", params: {} });
    }
    if (now.faultMotor && !before.faultMotor) {
      const axes = ["elevation", "azimuth"].filter((axis) => (0, import_protocol.readPath)(status, `axes.${axis}.fault`) === true);
      events.push({ category: "fault", key: "faultMotor", params: { axes: axes.join(", ") || "?" } });
    }
    if (!now.faultIo && !now.faultMotor && (before.faultIo || before.faultMotor)) {
      events.push({ category: "fault", key: "faultCleared", params: {} });
    }
    if (!now.windOk && before.windOk) {
      events.push({ category: "wind", key: "windLost", params: {} });
    } else if (now.windOk && !before.windOk) {
      events.push({ category: "wind", key: "windBack", params: {} });
    }
    if (!now.sunOk && before.sunOk) {
      events.push({ category: "sensor", key: "sunLost", params: {} });
    } else if (now.sunOk && !before.sunOk) {
      events.push({ category: "sensor", key: "sunBack", params: {} });
    }
    return events;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EVENT_CATEGORIES,
  EventDetector
});
//# sourceMappingURL=events.js.map
