/*
 * Objects of the adapter and the mapping from the device status to state values.
 * Pure data and functions, no I/O.
 */
import { readPath, type DeviceInfo, type DeviceStatus } from "./protocol";

/** Value of an ioBroker state */
export type StateValue = string | number | boolean | null;

/** Name in the languages maintained by hand */
export interface Name {
    /** English */
    en: string;
    /** German */
    de: string;
}

/** A channel or folder */
export interface NodeDef {
    /** Object id relative to the instance */
    id: string;
    /** Object type */
    type: "channel" | "folder";
    /** Name */
    name: Name;
}

/** A state */
export interface StateDef {
    /** Object id relative to the instance */
    id: string;
    /** Name */
    name: Name;
    /** Value type */
    type: "boolean" | "number" | "string";
    /** Role from the official list */
    role: string;
    /** Unit */
    unit?: string;
    /** Texts for the possible values */
    states?: Record<string, string>;
    /** Path of the value in the status of the device (GET /api/status) */
    status?: string;
    /** Path of the value in GET /api/info */
    info?: string;
    /** Conversion of the raw value */
    convert?: "msToSeconds" | "json";
    /** true = changes constantly, is written only every few seconds */
    volatile?: boolean;
    /** true = the state is a command and can be written */
    write?: boolean;
    /** false = the state cannot be read (buttons) */
    read?: boolean;
    /** Smallest value */
    min?: number;
    /** Largest value */
    max?: number;
}

/** Channels and folders, parents before children */
export const NODES: NodeDef[] = [
    { id: "status", type: "channel", name: { en: "State of the controller", de: "Zustand der Steuerung" } },
    { id: "axes", type: "folder", name: { en: "Axes", de: "Achsen" } },
    { id: "axes.elevation", type: "channel", name: { en: "Elevation (vertical)", de: "Elevation (vertikal)" } },
    { id: "axes.azimuth", type: "channel", name: { en: "Azimuth (horizontal)", de: "Azimut (horizontal)" } },
    { id: "sun", type: "channel", name: { en: "Sun sensor", de: "Sonnensensor" } },
    { id: "wind", type: "channel", name: { en: "Wind sensor", de: "Windmesser" } },
    { id: "io", type: "channel", name: { en: "I/O components", de: "E/A-Bausteine" } },
    { id: "supply", type: "channel", name: { en: "Supplies", de: "Versorgungen" } },
    { id: "leds", type: "channel", name: { en: "Indicator lights", de: "Meldeleuchten" } },
    { id: "jog", type: "channel", name: { en: "Remote manual drive", de: "Handfahrt aus der Ferne" } },
    { id: "counters", type: "channel", name: { en: "Error counters", de: "Fehlerzähler" } },
    { id: "messages", type: "channel", name: { en: "Messages of the device", de: "Meldungen des Geräts" } },
    { id: "control", type: "channel", name: { en: "Commands", de: "Befehle" } },
    { id: "setup", type: "channel", name: { en: "Setup of the device", de: "Einrichtung des Geräts" } },
    { id: "params", type: "folder", name: { en: "Settings of the device", de: "Einstellungen des Geräts" } },
];

const CONTROLLER_STATES: Record<string, string> = {
    SETUP: "Setup missing",
    FAULT: "Fault",
    STORM: "Storm protection",
    MANUAL: "Manual mode",
    PARK: "Parked on command",
    WINDFAULT: "Wind sensor failed",
    SENSOR: "Sun sensor fault",
    NIGHT: "Night",
    IDLE: "Automatic: aligned",
    TRACKING: "Automatic: tracking",
    SETTLING: "Automatic: settling",
};

/**
 * States of one axis.
 *
 * @param axis key of the axis in the status
 * @param plus name of the PLUS direction
 * @param minus name of the MINUS direction
 */
function axisStates(axis: "elevation" | "azimuth", plus: Name, minus: Name): StateDef[] {
    const id = `axes.${axis}`;
    return [
        {
            id: `${id}.enabled`,
            name: { en: "Axis in use", de: "Achse in Verwendung" },
            type: "boolean",
            role: "indicator",
            status: `${id}.enabled`,
        },
        {
            id: `${id}.output`,
            name: { en: "Output", de: "Ausgang" },
            type: "number",
            role: "value",
            states: { "-1": minus.en, 0: "Stop", 1: plus.en },
            status: `${id}.out`,
        },
        {
            id: `${id}.limitPlus`,
            name: { en: `Limit switch ${plus.en} open`, de: `Endschalter ${plus.de} offen` },
            type: "boolean",
            role: "indicator",
            status: `${id}.limitPlus`,
        },
        {
            id: `${id}.limitMinus`,
            name: { en: `Limit switch ${minus.en} open`, de: `Endschalter ${minus.de} offen` },
            type: "boolean",
            role: "indicator",
            status: `${id}.limitMinus`,
        },
        {
            id: `${id}.blockedPlus`,
            name: { en: `Direction ${plus.en} blocked`, de: `Richtung ${plus.de} gesperrt` },
            type: "boolean",
            role: "indicator",
            status: `${id}.blockedPlus`,
        },
        {
            id: `${id}.blockedMinus`,
            name: { en: `Direction ${minus.en} blocked`, de: `Richtung ${minus.de} gesperrt` },
            type: "boolean",
            role: "indicator",
            status: `${id}.blockedMinus`,
        },
        {
            id: `${id}.fault`,
            name: { en: "Runtime fault", de: "Laufzeitfehler" },
            type: "boolean",
            role: "indicator.alarm",
            status: `${id}.fault`,
        },
        {
            id: `${id}.deviation`,
            name: { en: "Deviation from the sun", de: "Abweichung von der Sonne" },
            type: "number",
            role: "value",
            unit: "‰",
            status: `${id}.errPermille`,
        },
    ];
}

/**
 * One error counter.
 *
 * @param key key in `counters` of the status
 * @param name name of the state
 */
function counter(key: string, name: Name): StateDef {
    return { id: `counters.${key}`, name, type: "number", role: "value", status: `counters.${key}` };
}

/** All states except info.connection, which is declared in io-package.json */
export const STATES: StateDef[] = [
    // --- info: GET /api/info and values about the connection ---
    {
        id: "info.firmware",
        name: { en: "Firmware version", de: "Firmware-Stand" },
        type: "string",
        role: "info.firmware",
        info: "fw",
    },
    {
        id: "info.protocol",
        name: { en: "Protocol version", de: "Protokollversion" },
        type: "number",
        role: "value",
        info: "protocol",
    },
    {
        id: "info.deviceId",
        name: { en: "Device id (MAC address)", de: "Gerätekennung (MAC-Adresse)" },
        type: "string",
        role: "info.mac",
        info: "id",
    },
    {
        id: "info.hostname",
        name: { en: "Device name", de: "Gerätename" },
        type: "string",
        role: "info.name",
        info: "hostname",
    },
    {
        id: "info.ip",
        name: { en: "IP address", de: "IP-Adresse" },
        type: "string",
        role: "info.ip",
        info: "ip",
    },
    {
        id: "info.features",
        name: { en: "Features of the firmware", de: "Fähigkeiten der Firmware" },
        type: "string",
        role: "json",
        info: "features",
        convert: "json",
    },
    {
        id: "info.resetReason",
        name: { en: "Reason of the last reset", de: "Grund des letzten Neustarts" },
        type: "string",
        role: "text",
        info: "resetReason",
    },
    {
        id: "info.heapMin",
        name: { en: "Lowest free memory", de: "Geringster freier Speicher" },
        type: "number",
        role: "value",
        unit: "bytes",
        info: "heapMin",
    },
    {
        id: "info.bootId",
        name: { en: "Boot id (changes on every start)", de: "Start-Kennung (ändert sich bei jedem Start)" },
        type: "string",
        role: "text",
        status: "bootId",
    },
    {
        id: "info.bootTime",
        name: { en: "Start time of the device", de: "Startzeitpunkt des Geräts" },
        type: "number",
        role: "date",
    },
    {
        id: "info.uptime",
        name: { en: "Uptime", de: "Laufzeit" },
        type: "number",
        role: "value.timer",
        unit: "s",
        status: "uptimeMs",
        convert: "msToSeconds",
        volatile: true,
    },
    {
        id: "info.heapFree",
        name: { en: "Free memory", de: "Freier Speicher" },
        type: "number",
        role: "value",
        unit: "bytes",
        status: "heapFree",
        volatile: true,
    },
    {
        id: "info.wifiRssi",
        name: { en: "WLAN signal strength", de: "WLAN-Signalstärke" },
        type: "number",
        role: "value.rssi",
        unit: "dBm",
        status: "wifiRssi",
        volatile: true,
    },
    {
        id: "info.simulation",
        name: { en: "Simulation running (no real values)", de: "Simulation läuft (keine echten Werte)" },
        type: "boolean",
        role: "indicator",
        status: "simulation",
    },
    {
        id: "info.authorized",
        name: { en: "Token accepted, commands allowed", de: "Token angenommen, Befehle erlaubt" },
        type: "boolean",
        role: "indicator",
    },

    // --- status ---
    {
        id: "status.state",
        name: { en: "State", de: "Zustand" },
        type: "string",
        role: "info.status",
        states: CONTROLLER_STATES,
        status: "state",
    },
    {
        id: "status.auto",
        name: { en: "Automatic switched on", de: "Automatik eingeschaltet" },
        type: "boolean",
        role: "indicator",
        status: "auto",
    },
    {
        id: "status.setupDone",
        name: { en: "Setup completed", de: "Einrichtung abgeschlossen" },
        type: "boolean",
        role: "indicator",
        status: "setupDone",
    },
    {
        id: "status.mode",
        name: { en: "Operating mode", de: "Betriebsart" },
        type: "number",
        role: "value",
        states: { 1: "Vertical only", 2: "Vertical + horizontal" },
        status: "mode",
    },
    {
        id: "status.windSensor",
        name: { en: "Wind sensor type", de: "Windmesser-Typ" },
        type: "number",
        role: "value",
        states: { 1: "Wind speed only", 2: "Wind speed + direction" },
        status: "windSensor",
    },
    {
        id: "status.park",
        name: { en: "Park request active", de: "Parkanforderung besteht" },
        type: "boolean",
        role: "indicator",
        status: "park",
    },
    {
        id: "status.remoteLocked",
        name: { en: "Remote control locked at the display", de: "Fernsteuerung am Display gesperrt" },
        type: "boolean",
        role: "indicator",
        status: "remoteLocked",
    },
    {
        id: "status.design",
        name: { en: "Design chosen at the device", de: "Am Gerät gewähltes Design" },
        type: "number",
        role: "value",
        status: "design",
    },
    {
        id: "status.faultIo",
        name: { en: "Fault: I/O component", de: "Störung: E/A-Baustein" },
        type: "boolean",
        role: "indicator.alarm",
        status: "fault.io",
    },
    {
        id: "status.faultMotor",
        name: { en: "Fault: runtime of a drive", de: "Störung: Laufzeit eines Antriebs" },
        type: "boolean",
        role: "indicator.alarm",
        status: "fault.motor",
    },
    {
        id: "status.stormActive",
        name: { en: "Storm protection active", de: "Sturmschutz aktiv" },
        type: "boolean",
        role: "indicator.alarm",
        status: "storm.active",
    },
    {
        id: "status.stormRemaining",
        name: { en: "Storm protection: remaining time", de: "Sturmschutz: Restzeit" },
        type: "number",
        role: "value.timer",
        unit: "s",
        status: "storm.remainingMs",
        convert: "msToSeconds",
    },
    {
        id: "status.pendingConfirm",
        name: {
            en: "Settings waiting for confirmation at the display",
            de: "Einstellungen, die am Display auf Bestätigung warten",
        },
        type: "string",
        role: "json",
        status: "pendingConfirm",
        convert: "json",
    },

    // --- axes ---
    ...axisStates("elevation", { en: "UP", de: "RAUF" }, { en: "DOWN", de: "RUNTER" }),
    ...axisStates("azimuth", { en: "EAST", de: "OST" }, { en: "WEST", de: "WEST" }),

    // --- sun sensor ---
    {
        id: "sun.ok",
        name: { en: "Sun sensor ok", de: "Sonnensensor in Ordnung" },
        type: "boolean",
        role: "indicator",
        status: "sun.ok",
    },
    { id: "sun.east", name: { en: "East", de: "Ost" }, type: "number", role: "value", status: "sun.east" },
    { id: "sun.west", name: { en: "West", de: "West" }, type: "number", role: "value", status: "sun.west" },
    { id: "sun.south", name: { en: "South", de: "Süd" }, type: "number", role: "value", status: "sun.south" },
    { id: "sun.north", name: { en: "North", de: "Nord" }, type: "number", role: "value", status: "sun.north" },

    // --- wind ---
    {
        id: "wind.ok",
        name: { en: "Wind sensor answers", de: "Windmesser antwortet" },
        type: "boolean",
        role: "indicator",
        status: "wind.ok",
    },
    {
        id: "wind.speed",
        name: { en: "Wind speed", de: "Windgeschwindigkeit" },
        type: "number",
        role: "value.speed.wind",
        unit: "km/h",
        status: "wind.kmh",
    },
    {
        id: "wind.gust",
        name: { en: "Gust", de: "Böe" },
        type: "number",
        role: "value.speed.wind.gust",
        unit: "km/h",
        status: "wind.gustKmh",
    },
    {
        id: "wind.maxGust",
        name: { en: "Strongest gust", de: "Höchste Böe" },
        type: "number",
        role: "value.speed.max.wind",
        unit: "km/h",
        status: "wind.maxGustKmh",
    },
    {
        id: "wind.stormThreshold",
        name: { en: "Storm threshold (gust)", de: "Sturmschwelle (Böe)" },
        type: "number",
        role: "value",
        unit: "km/h",
        status: "wind.stormKmh",
    },
    {
        id: "wind.hasDirection",
        name: { en: "Wind sensor with direction", de: "Windmesser mit Richtung" },
        type: "boolean",
        role: "indicator",
        status: "wind.hasDirection",
    },
    {
        id: "wind.directionOk",
        name: { en: "Wind direction valid", de: "Windrichtung gültig" },
        type: "boolean",
        role: "indicator",
        status: "wind.dirOk",
    },
    {
        id: "wind.direction",
        name: { en: "Wind direction", de: "Windrichtung" },
        type: "number",
        role: "value.direction.wind",
        unit: "°",
        status: "wind.dirDeg",
    },

    // --- components and supplies ---
    {
        id: "io.relayOk",
        name: { en: "Component of the switching outputs answers", de: "Baustein der Schaltausgänge antwortet" },
        type: "boolean",
        role: "indicator.reachable",
        status: "io.relayOk",
    },
    {
        id: "io.ledOk",
        name: { en: "Component of the indicator lights answers", de: "Baustein der Meldeleuchten antwortet" },
        type: "boolean",
        role: "indicator.reachable",
        status: "io.ledOk",
    },
    {
        id: "supply.monitored",
        name: { en: "Current limiters monitored", de: "Strombegrenzer überwacht" },
        type: "boolean",
        role: "indicator",
        status: "supply.monitored",
    },
    {
        id: "supply.sensorFault",
        name: { en: "Fault: sensor supply", de: "Störung: Sensorversorgung" },
        type: "boolean",
        role: "indicator.alarm",
        status: "supply.sensorFault",
    },
    {
        id: "supply.ledFault",
        name: { en: "Fault: supply of the lights", de: "Störung: Leuchtenversorgung" },
        type: "boolean",
        role: "indicator.alarm",
        status: "supply.ledFault",
    },
    {
        id: "leds.ready",
        name: { en: "Light READY", de: "Leuchte BEREIT" },
        type: "string",
        role: "text",
        states: { off: "off", on: "on", blink: "blinking" },
        status: "leds.ready",
    },
    {
        id: "leds.fail",
        name: { en: "Light FAIL", de: "Leuchte FAIL" },
        type: "string",
        role: "text",
        states: { off: "off", red: "red", yellow: "yellow", blue: "blue" },
        status: "leds.fail",
    },

    // --- remote manual drive (read only in this version) ---
    {
        id: "jog.active",
        name: { en: "Remote manual drive running", de: "Handfahrt aus der Ferne läuft" },
        type: "boolean",
        role: "indicator.working",
        status: "jog.active",
    },
    { id: "jog.axis", name: { en: "Axis", de: "Achse" }, type: "string", role: "text", status: "jog.axis" },
    {
        id: "jog.direction",
        name: { en: "Direction", de: "Richtung" },
        type: "number",
        role: "value",
        states: { "-1": "MINUS", 0: "Stop", 1: "PLUS" },
        status: "jog.dir",
    },

    // --- counters ---
    counter("relayIoErrors", { en: "Errors: switching outputs", de: "Fehler: Schaltausgänge" }),
    counter("ledIoErrors", { en: "Errors: indicator lights", de: "Fehler: Meldeleuchten" }),
    counter("lightErrors", { en: "Errors: sun sensor", de: "Fehler: Sonnensensor" }),
    counter("windErrors", { en: "Errors: wind speed", de: "Fehler: Windgeschwindigkeit" }),
    counter("windDirErrors", { en: "Errors: wind direction", de: "Fehler: Windrichtung" }),
    counter("sensorSupplyFaults", { en: "Faults: sensor supply", de: "Störungen: Sensorversorgung" }),
    counter("ledSupplyFaults", { en: "Faults: supply of the lights", de: "Störungen: Leuchtenversorgung" }),
    {
        id: "counters.logLost",
        name: { en: "Messages dropped by the device", de: "Vom Gerät verworfene Meldungen" },
        type: "number",
        role: "value",
        status: "logLost",
    },

    // --- commands ---
    {
        id: "control.auto",
        name: { en: "Automatic on/off", de: "Automatik ein/aus" },
        type: "boolean",
        role: "switch",
        write: true,
        status: "auto",
    },
    {
        id: "control.park",
        name: { en: "Park flat on/off", de: "Flach parken ein/aus" },
        type: "boolean",
        role: "switch",
        write: true,
        status: "park",
    },
    {
        id: "control.acknowledge",
        name: { en: "Acknowledge fault", de: "Störung quittieren" },
        type: "boolean",
        role: "button",
        write: true,
        read: false,
    },
    {
        id: "control.jogElevation",
        name: {
            en: "Manual drive elevation (write again at least once per second)",
            de: "Handfahrt Elevation (mindestens einmal pro Sekunde neu schreiben)",
        },
        type: "number",
        role: "level",
        write: true,
        min: -1,
        max: 1,
        states: { "-1": "DOWN", 0: "Stop", 1: "UP" },
    },
    {
        id: "control.jogAzimuth",
        name: {
            en: "Manual drive azimuth (write again at least once per second)",
            de: "Handfahrt Azimut (mindestens einmal pro Sekunde neu schreiben)",
        },
        type: "number",
        role: "level",
        write: true,
        min: -1,
        max: 1,
        states: { "-1": "WEST", 0: "Stop", 1: "EAST" },
    },
    {
        id: "control.design",
        name: { en: "Design of the display and the web page", de: "Design von Display und Weboberfläche" },
        type: "number",
        role: "level",
        write: true,
        min: 0,
        status: "design",
    },
    {
        id: "control.endSimulation",
        name: { en: "End the simulation (the device restarts)", de: "Simulation beenden (das Gerät startet neu)" },
        type: "boolean",
        role: "button",
        write: true,
        read: false,
    },
    {
        id: "control.lastResult",
        name: { en: "Result of the last command", de: "Ergebnis des letzten Befehls" },
        type: "string",
        role: "json",
    },

    // --- setup: both values are chosen first and then saved together, like at the display ---
    {
        id: "setup.mode",
        name: {
            en: "Operating mode (takes effect with setup.save)",
            de: "Betriebsart (gilt erst mit setup.save)",
        },
        type: "number",
        role: "level",
        write: true,
        min: 1,
        max: 2,
        states: { 1: "Vertical only", 2: "Vertical + horizontal" },
        status: "mode",
    },
    {
        id: "setup.windSensor",
        name: {
            en: "Wind sensor type (takes effect with setup.save)",
            de: "Windmesser-Typ (gilt erst mit setup.save)",
        },
        type: "number",
        role: "level",
        write: true,
        min: 1,
        max: 2,
        states: { 1: "Wind speed only", 2: "Wind speed + direction" },
        status: "windSensor",
    },
    {
        id: "setup.save",
        name: {
            en: "Save the setup (drives stop, the device restarts)",
            de: "Einrichtung speichern (Antriebe stoppen, das Gerät startet neu)",
        },
        type: "boolean",
        role: "button",
        write: true,
        read: false,
    },

    // --- settings: the states of the single settings are created from GET /api/params ---
    {
        id: "params.pending",
        name: {
            en: "Proposals waiting for confirmation at the display",
            de: "Vorschläge, die am Display auf Bestätigung warten",
        },
        type: "string",
        role: "json",
    },
    {
        id: "params.lastResult",
        name: { en: "Result of the last change", de: "Ergebnis der letzten Änderung" },
        type: "string",
        role: "json",
    },

    // --- messages ---
    {
        id: "messages.last",
        name: { en: "Last message", de: "Letzte Meldung" },
        type: "string",
        role: "text",
    },
    {
        id: "messages.lastJson",
        name: { en: "Last message with time and level", de: "Letzte Meldung mit Zeit und Stufe" },
        type: "string",
        role: "json",
    },
    {
        id: "messages.lastFault",
        name: { en: "Last warning or error", de: "Letzte Warnung oder Störung" },
        type: "string",
        role: "text",
    },
    {
        id: "messages.history",
        name: { en: "Latest messages, newest first", de: "Letzte Meldungen, neueste zuerst" },
        type: "string",
        role: "json",
    },
    {
        id: "messages.lastSeq",
        name: { en: "Sequence number of the last message", de: "Laufende Nummer der letzten Meldung" },
        type: "number",
        role: "value",
    },
    {
        id: "messages.lost",
        name: {
            en: "Messages lost since the start of the adapter",
            de: "Seit dem Start des Adapters verlorene Meldungen",
        },
        type: "number",
        role: "value",
    },
];

/**
 * Converts a raw value of the device to the value of a state.
 *
 * @param def definition of the state
 * @param raw value from the device
 * @returns the state value, or undefined when the value is missing or has the wrong type
 */
export function convertValue(def: StateDef, raw: unknown): StateValue | undefined {
    if (raw === undefined) {
        return undefined;
    }
    if (def.convert === "json") {
        return JSON.stringify(raw);
    }
    if (raw === null) {
        return null;
    }
    if (def.convert === "msToSeconds") {
        return typeof raw === "number" ? Math.floor(raw / 1000) : undefined;
    }
    return typeof raw === def.type ? (raw as StateValue) : undefined;
}

/**
 * Maps a status of the device (GET /api/status, frame `status`) to state values.
 *
 * @param status the status
 * @returns state id => value; states whose value is missing in the status are left out
 */
export function statusToValues(status: DeviceStatus): Map<string, StateValue> {
    const values = new Map<string, StateValue>();
    for (const def of STATES) {
        if (!def.status) {
            continue;
        }
        const value = convertValue(def, readPath(status, def.status));
        if (value !== undefined) {
            values.set(def.id, value);
        }
    }
    return values;
}

/**
 * Maps the answer of GET /api/info to state values.
 *
 * @param info the info
 * @returns state id => value
 */
export function infoToValues(info: DeviceInfo): Map<string, StateValue> {
    const values = new Map<string, StateValue>();
    for (const def of STATES) {
        if (!def.info) {
            continue;
        }
        const value = convertValue(def, readPath(info, def.info));
        if (value !== undefined) {
            values.set(def.id, value);
        }
    }
    return values;
}
