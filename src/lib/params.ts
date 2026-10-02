/*
 * Settings of the device (GET and POST /api/params, frame `params`).
 * The device says which settings exist, with their limits; this file turns them into states.
 * Pure data and functions, no I/O.
 */
import { isObject } from "./protocol";
import type { Name, StateValue } from "./states";

/** When a changed value becomes valid */
export type ParamApply = "now" | "standstill" | "confirm";

/** One setting as the device reports it */
export interface ParamEntry {
    /** Key of the setting, e.g. "stormKmh" */
    key: string;
    /** Group: safety, commissioning, control or diagnostics */
    group: string;
    /** Value type */
    type: "bool" | "int" | "float";
    /** Unit as the device names it */
    unit: string;
    /** Valid value */
    value: number | boolean;
    /** Factory default */
    default: number | boolean;
    /** Lower limit, null for yes/no */
    min: number | null;
    /** Upper limit, null for yes/no */
    max: number | null;
    /** When a change becomes valid */
    apply: ParamApply;
    /** Proposed value that waits for confirmation at the display, otherwise null */
    pending: number | boolean | null;
}

/** Result of one value in the answer of POST /api/params */
export interface ParamResult {
    /** applied, pending or rejected */
    result: "applied" | "pending" | "rejected";
    /** Valid value after the request */
    value?: number | boolean;
    /** Proposed value that now waits for confirmation */
    pending?: number | boolean;
    /** Why the value was rejected */
    reason?: string;
}

/** Groups in the order of the display */
export const PARAM_GROUPS: Record<string, Name> = {
    control: { en: "Settings: control", de: "Einstellungen: Regelung" },
    commissioning: { en: "Settings: commissioning", de: "Einstellungen: Inbetriebnahme" },
    safety: {
        en: "Settings: safety (valid only after confirmation at the display)",
        de: "Einstellungen: Sicherheit (gelten erst nach Bestätigung am Display)",
    },
    diagnostics: { en: "Settings: diagnostics", de: "Einstellungen: Diagnose" },
};

/** Names of the settings; a setting the adapter does not know yet is shown with its key */
const PARAM_NAMES: Record<string, Name> = {
    stormKmh: { en: "Storm threshold (gust)", de: "Sturmschwelle (Böe)" },
    stormHoldMs: { en: "Hold time after storm", de: "Haltezeit nach Sturm" },
    motorDeadtimeMs: { en: "Dead time when changing direction", de: "Totzeit beim Richtungswechsel" },
    motorMaxRunMsElevation: { en: "Maximum runtime elevation", de: "Höchstlaufzeit Elevation" },
    motorMaxRunMsAzimuth: { en: "Maximum runtime azimuth", de: "Höchstlaufzeit Azimut" },
    limitSwitchesElevation: { en: "Limit switches elevation installed", de: "Endschalter Elevation eingebaut" },
    limitSwitchesAzimuth: { en: "Limit switches azimuth installed", de: "Endschalter Azimut eingebaut" },
    sunChEast: { en: "Sun sensor EAST at input AIN", de: "Sonnensensor OST an Eingang AIN" },
    sunChWest: { en: "Sun sensor WEST at input AIN", de: "Sonnensensor WEST an Eingang AIN" },
    sunChSouth: { en: "Sun sensor SOUTH at input AIN", de: "Sonnensensor SÜD an Eingang AIN" },
    sunChNorth: { en: "Sun sensor NORTH at input AIN", de: "Sonnensensor NORD an Eingang AIN" },
    sunNorthMeansUp: { en: "North brighter means UP", de: "Nord heller heißt RAUF" },
    stormParkElevationPlus: { en: "Flat position lies in direction UP", de: "Flachstellung liegt Richtung RAUF" },
    windBaud: { en: "Wind sensor: baud rate", de: "Windmesser: Baudrate" },
    windSpeedAddr: { en: "Wind sensor: Modbus address", de: "Windmesser: Modbus-Adresse" },
    windSpeedFunction: { en: "Wind sensor: read function (3 or 4)", de: "Windmesser: Lesebefehl (3 oder 4)" },
    windSpeedRegister: { en: "Wind sensor: register", de: "Windmesser: Register" },
    windSpeedScale: { en: "Wind sensor: m/s per count", de: "Windmesser: m/s je Zähler" },
    windDirAddr: { en: "Wind direction: Modbus address", de: "Windrichtung: Modbus-Adresse" },
    windDirFunction: { en: "Wind direction: read function (3 or 4)", de: "Windrichtung: Lesebefehl (3 oder 4)" },
    windDirRegister: { en: "Wind direction: register", de: "Windrichtung: Register" },
    windDirScale: { en: "Wind direction: degrees per count", de: "Windrichtung: Grad je Zähler" },
    trackStartPermille: { en: "Track from deviation", de: "Nachführen ab Abweichung" },
    trackStopPermille: { en: "Aligned below deviation", de: "Ausgerichtet unter Abweichung" },
    trackStartDelayMs: { en: "Waiting time before a drive", de: "Wartezeit vor einer Fahrt" },
    trackSettleMs: { en: "Rest time after a drive", de: "Ruhezeit nach einer Fahrt" },
    trackMaxMoveMs: { en: "Longest tracking drive", de: "Längste Nachführfahrt" },
    nightEnterLevel: { en: "Night below brightness (sum)", de: "Nacht unter Helligkeit (Summe)" },
    nightExitLevel: { en: "Day above brightness (sum)", de: "Tag über Helligkeit (Summe)" },
    nightDelayMs: { en: "Night or day only after", de: "Nacht oder Tag erst nach" },
    nightReturnEast: { en: "Return to the east at night", de: "Nachts zurück nach Osten" },
    logLevel: { en: "Log level of the device (until its restart)", de: "Log-Stufe des Geräts (bis zum Neustart)" },
};

/** Units the device names in ASCII */
const UNITS: Record<string, string> = { permille: "‰", deg: "°" };

/** Only these characters are allowed in the key and group, they become part of the state id */
const ID_PART = /^[A-Za-z][A-Za-z0-9]*$/;

/**
 * Checks one entry of GET /api/params or of a `params` frame.
 *
 * @param json parsed entry
 * @returns the entry, or undefined when it cannot be used
 */
export function parseParam(json: unknown): ParamEntry | undefined {
    if (!isObject(json) || typeof json.key !== "string" || typeof json.group !== "string") {
        return undefined;
    }
    if (!ID_PART.test(json.key) || !ID_PART.test(json.group)) {
        return undefined;
    }
    const type = json.type;
    if (type !== "bool" && type !== "int" && type !== "float") {
        return undefined;
    }
    const valueType = type === "bool" ? "boolean" : "number";
    if (typeof json.value !== valueType) {
        return undefined;
    }
    const apply = json.apply === "standstill" || json.apply === "confirm" ? json.apply : "now";
    return {
        key: json.key,
        group: json.group,
        type,
        unit: typeof json.unit === "string" ? json.unit : "",
        value: json.value as number | boolean,
        default:
            typeof json.default === valueType ? (json.default as number | boolean) : (json.value as number | boolean),
        min: typeof json.min === "number" ? json.min : null,
        max: typeof json.max === "number" ? json.max : null,
        apply,
        pending: typeof json.pending === valueType ? (json.pending as number | boolean) : null,
    };
}

/**
 * Reads a list of settings: the answer of GET /api/params or the `changed` list of a frame.
 *
 * @param list the array of entries
 * @returns the usable entries and the number of entries that were dropped
 */
export function parseParams(list: unknown): { entries: ParamEntry[]; dropped: number } {
    if (!Array.isArray(list)) {
        return { entries: [], dropped: 0 };
    }
    const entries: ParamEntry[] = [];
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

/**
 * Id of the state of a setting, relative to the instance.
 *
 * @param entry the setting
 */
export function paramStateId(entry: Pick<ParamEntry, "group" | "key">): string {
    return `params.${entry.group}.${entry.key}`;
}

/**
 * Name of a group.
 *
 * @param group key of the group
 */
export function groupName(group: string): Name {
    return PARAM_GROUPS[group] ?? { en: `Settings: ${group}`, de: `Einstellungen: ${group}` };
}

/**
 * The `common` part of the state object of a setting.
 *
 * @param entry the setting
 */
export function paramCommon(entry: ParamEntry): Record<string, unknown> {
    const name = PARAM_NAMES[entry.key] ?? { en: entry.key, de: entry.key };
    const hint: Name =
        entry.apply === "confirm"
            ? { en: " (needs confirmation at the display)", de: " (braucht die Bestätigung am Display)" }
            : entry.apply === "standstill"
              ? { en: " (only while no drive is running)", de: " (nur bei stehenden Antrieben)" }
              : { en: "", de: "" };
    const common: Record<string, unknown> = {
        name: { en: name.en + hint.en, de: name.de + hint.de },
        type: entry.type === "bool" ? "boolean" : "number",
        role: entry.type === "bool" ? "switch" : "level",
        read: true,
        write: true,
        def: entry.default,
    };
    const unit = UNITS[entry.unit] ?? entry.unit;
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

/**
 * Converts a value written to a state into the value sent to the device.
 *
 * @param entry the setting
 * @param value value of the state
 * @returns the value, or undefined when the type does not fit
 */
export function toDeviceValue(entry: ParamEntry, value: StateValue): number | boolean | undefined {
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
        return undefined;
    }
    const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    return typeof number === "number" && Number.isFinite(number) ? number : undefined;
}

/**
 * Reads the result of one value from the answer of POST /api/params.
 *
 * @param answer parsed answer
 * @param key key of the setting
 * @returns the result, or undefined when the answer does not contain it
 */
export function readParamResult(answer: unknown, key: string): ParamResult | undefined {
    if (!isObject(answer) || !isObject(answer.results)) {
        return undefined;
    }
    const entry = answer.results[key];
    if (!isObject(entry)) {
        return undefined;
    }
    const kind = entry.result;
    if (kind !== "applied" && kind !== "pending" && kind !== "rejected") {
        return undefined;
    }
    const scalar = (v: unknown): number | boolean | undefined =>
        typeof v === "number" || typeof v === "boolean" ? v : undefined;
    return {
        result: kind,
        value: scalar(entry.value),
        pending: scalar(entry.pending),
        reason: typeof entry.reason === "string" ? entry.reason : undefined,
    };
}

/**
 * The proposals that wait for confirmation, as an object for the state `params.pending`.
 *
 * @param entries all known settings
 */
export function pendingMap(entries: Iterable<ParamEntry>): Record<string, number | boolean> {
    const map: Record<string, number | boolean> = {};
    for (const entry of entries) {
        if (entry.pending !== null) {
            map[entry.key] = entry.pending;
        }
    }
    return map;
}
