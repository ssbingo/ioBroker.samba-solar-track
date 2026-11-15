/*
 * Objects of the adapter and the mapping from the device status to state values.
 * Pure data and functions, no I/O.
 *
 * Parts of the status exist only with some firmware or in one operating mode (PROTOCOL.md: the
 * firmware names what it can do in `features`; some fields exist only with one axis or with two).
 * Channels and states of such parts carry `feature` and `mode`; they are created only when the
 * device reports the feature and the mode, so older firmware keeps working without empty states.
 */
import { isObject, readPath, type DeviceInfo, type DeviceStatus } from "./protocol";

/** Value of an ioBroker state */
export type StateValue = string | number | boolean | null;

/**
 * Name in the languages maintained by hand. The other languages of ioBroker come from the
 * table in i18n.ts, looked up by the English text.
 */
export interface Name {
    /** English */
    en: string;
    /** German */
    de: string;
}

/** Operating mode: 1 = vertical only (one axis), 2 = vertical + horizontal (two axes) */
export type Mode = 1 | 2;

/** When a channel or state exists */
export interface Availability {
    /** The device has to report this feature in `features` of GET /api/info */
    feature?: string;
    /** The device has to run in this operating mode (`mode` of the status) */
    mode?: Mode;
}

/** A channel or folder */
export interface NodeDef extends Availability {
    /** Object id relative to the instance */
    id: string;
    /** Object type */
    type: "channel" | "folder";
    /** Name */
    name: Name;
}

/** A state */
export interface StateDef extends Availability {
    /** Object id relative to the instance */
    id: string;
    /** Name */
    name: Name;
    /** Value type */
    type: "boolean" | "number" | "string";
    /** Role from the official list (stateroles.md of ioBroker.docs) */
    role: string;
    /** Unit */
    unit?: string;
    /** Texts for the possible values */
    states?: Record<string, string>;
    /** Path of the value in the status of the device (GET /api/status) */
    status?: string;
    /** Path of the value in GET /api/info */
    info?: string;
    /** Path of the value in the data set of the test report (GET /api/report?format=json) */
    report?: string;
    /** Conversion of the raw value */
    convert?: "msToSeconds" | "secondsToMs" | "json";
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

/** What the device can do and how it is set up; decides which channels and states exist */
export interface Layout {
    /** Features of GET /api/info */
    features: ReadonlySet<string>;
    /** Operating mode of the status, undefined while it is not known */
    mode?: number;
}

/**
 * Decides whether a channel or state exists for a device.
 *
 * @param def the channel or state
 * @param layout features and operating mode of the device; undefined = everything
 */
export function isAvailable(def: Availability, layout: Layout | undefined): boolean {
    if (!layout) {
        return true;
    }
    if (def.feature && !layout.features.has(def.feature)) {
        return false;
    }
    return def.mode === undefined || layout.mode === def.mode;
}

/**
 * true for channels and states that exist only with a feature or in one operating mode.
 *
 * @param def the channel or state
 */
export function isConditional(def: Availability): boolean {
    return def.feature !== undefined || def.mode !== undefined;
}

/** Channels and folders, parents before children */
export const NODES: NodeDef[] = [
    { id: "status", type: "channel", name: { en: "State of the controller", de: "Zustand der Steuerung" } },
    { id: "axes", type: "folder", name: { en: "Axes", de: "Achsen" } },
    { id: "axes.elevation", type: "channel", name: { en: "Elevation (vertical)", de: "Elevation (vertikal)" } },
    { id: "axes.azimuth", type: "channel", name: { en: "Azimuth (horizontal)", de: "Azimut (horizontal)" } },
    { id: "sun", type: "channel", name: { en: "Sun sensor", de: "Sonnensensor" } },
    {
        id: "sunPosition",
        type: "channel",
        name: { en: "Position of the sun (site and time)", de: "Sonnenstand (Standort und Uhrzeit)" },
        feature: "sunpos",
    },
    { id: "wind", type: "channel", name: { en: "Wind sensor", de: "Windmesser" } },
    { id: "io", type: "channel", name: { en: "I/O components", de: "E/A-Bausteine" } },
    { id: "supply", type: "channel", name: { en: "Supplies", de: "Versorgungen" } },
    {
        id: "battery",
        type: "channel",
        name: { en: "Built-in battery of the board", de: "Eingebauter Akku des Boards" },
        feature: "battery",
    },
    {
        id: "update",
        type: "channel",
        name: { en: "Firmware update in progress", de: "Laufendes Firmware-Update" },
        feature: "update",
    },
    { id: "leds", type: "channel", name: { en: "Indicator lights", de: "Meldeleuchten" } },
    { id: "jog", type: "channel", name: { en: "Remote manual drive", de: "Handfahrt aus der Ferne" } },
    {
        id: "position",
        type: "channel",
        name: { en: "Tilt of the elevation on command", de: "Neigung der Elevation auf Befehl" },
        feature: "position",
        mode: 1,
    },
    {
        id: "commissioning",
        type: "channel",
        name: { en: "Setup program", de: "Setup-Programm" },
        feature: "commissioning",
    },
    {
        id: "commissioning.report",
        type: "folder",
        name: { en: "Latest test report (data set)", de: "Neuester Prüfbericht (Datensatz)" },
        feature: "reportjson",
    },
    {
        id: "firmware",
        type: "channel",
        name: { en: "Firmware over the internet", de: "Firmware über das Internet" },
        feature: "fwonline",
    },
    { id: "counters", type: "channel", name: { en: "Error counters", de: "Fehlerzähler" } },
    { id: "messages", type: "channel", name: { en: "Messages of the device", de: "Meldungen des Geräts" } },
    { id: "control", type: "channel", name: { en: "Commands", de: "Befehle" } },
    { id: "setup", type: "channel", name: { en: "Setup of the device", de: "Einrichtung des Geräts" } },
    { id: "params", type: "folder", name: { en: "Settings of the device", de: "Einstellungen des Geräts" } },
];

/** Texts of the states of the controller; the adapter accepts states it does not know */
const CONTROLLER_STATES: Record<string, string> = {
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
    SETTLING: "Automatic: settling",
};

/** Names of the directions of the elevation, as display and web page show them since firmware 0.5.8 */
export const ELEVATION_STEEPER: Name = { en: "STEEPER", de: "STEILER" };
/** See ELEVATION_STEEPER */
export const ELEVATION_FLATTER: Name = { en: "FLATTER", de: "FLACHER" };
/** Names of the directions of the azimuth: PLUS = EAST, MINUS = WEST */
const AZIMUTH_PLUS: Name = { en: "EAST", de: "OST" };
const AZIMUTH_MINUS: Name = { en: "WEST", de: "WEST" };

/**
 * Names of the two directions of the elevation. `axes.elevation.flatDir` says in which direction
 * the flat position lies; without the field (firmware before 0.5.8) it is PLUS.
 *
 * @param flatDir value of `axes.elevation.flatDir`: 1 = PLUS is flatter, -1 = MINUS is flatter
 */
export function elevationDirections(flatDir: unknown): { plus: Name; minus: Name } {
    return flatDir === -1
        ? { plus: ELEVATION_STEEPER, minus: ELEVATION_FLATTER }
        : { plus: ELEVATION_FLATTER, minus: ELEVATION_STEEPER };
}

/**
 * The states of one axis whose names contain the directions.
 *
 * @param axis key of the axis in the status
 * @param plus name of the PLUS direction
 * @param minus name of the MINUS direction
 */
function directionStates(axis: "elevation" | "azimuth", plus: Name, minus: Name): StateDef[] {
    const id = `axes.${axis}`;
    return [
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
    ];
}

/**
 * Reset of the synchronous control of one axis (feature `syncreset`, field `axes.*.syncReset`).
 *
 * @param axis key of the axis in the status
 * @param mode operating mode the reset exists in, undefined = both
 */
function syncResetStates(axis: "elevation" | "azimuth", mode: Mode | undefined): StateDef[] {
    const id = `axes.${axis}`;
    const path = `${id}.syncReset`;
    const common = { feature: "syncreset", mode };
    return [
        {
            id: `${id}.syncResetPort`,
            name: {
                en: "Reset of the synchronous control: connection",
                de: "Reset der Synchronsteuerung: Anschluss",
            },
            type: "string",
            role: "text",
            states: { off: "off", j23: "J23", j5: "J5 (output azimuth PLUS)" },
            status: `${path}.port`,
            ...common,
        },
        {
            id: `${id}.syncResetAvailable`,
            name: { en: "Reset of the synchronous control: available", de: "Reset der Synchronsteuerung: verfügbar" },
            type: "boolean",
            role: "indicator",
            status: `${path}.available`,
            ...common,
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
                run: "synchronous control drives, axis blocked",
            },
            status: `${path}.phase`,
            ...common,
        },
        {
            id: `${id}.syncResetRemaining`,
            name: {
                en: "Reset of the synchronous control: remaining time",
                de: "Reset der Synchronsteuerung: Restzeit",
            },
            type: "number",
            role: "value.timer",
            unit: "s",
            status: `${path}.remainingMs`,
            convert: "msToSeconds",
            ...common,
        },
        {
            id: `${id}.syncResetPhaseRemaining`,
            name: {
                en: "Reset of the synchronous control: remaining time of the phase",
                de: "Reset der Synchronsteuerung: Restzeit der Phase",
            },
            type: "number",
            role: "value.timer",
            unit: "s",
            status: `${path}.phaseRemainingMs`,
            convert: "msToSeconds",
            ...common,
        },
        {
            id: `${id}.syncResetTotal`,
            name: {
                en: "Reset of the synchronous control: total time",
                de: "Reset der Synchronsteuerung: Gesamtzeit",
            },
            type: "number",
            role: "value.timer",
            unit: "s",
            status: `${path}.totalMs`,
            convert: "msToSeconds",
            ...common,
        },
        {
            id: `${id}.syncResetResult`,
            name: {
                en: "Reset of the synchronous control: last result",
                de: "Reset der Synchronsteuerung: letztes Ergebnis",
            },
            type: "string",
            role: "text",
            states: { none: "none", done: "done", aborted: "aborted" },
            status: `${path}.result`,
            ...common,
        },
        {
            id: `${id}.syncResetReason`,
            name: {
                en: "Reset of the synchronous control: reason of the abort",
                de: "Reset der Synchronsteuerung: Grund des Abbruchs",
            },
            type: "string",
            role: "text",
            states: {
                "": "-",
                iofault: "component of the switching outputs failed",
                nodevice: "component 0x72 does not answer",
                stopped: "all drives stopped before a restart or an update",
            },
            status: `${path}.reason`,
            ...common,
        },
    ];
}

/**
 * States of one axis.
 *
 * @param axis key of the axis in the status
 * @param plus name of the PLUS direction
 * @param minus name of the MINUS direction
 */
function axisStates(axis: "elevation" | "azimuth", plus: Name, minus: Name): StateDef[] {
    const id = `axes.${axis}`;
    const states: StateDef[] = [
        {
            id: `${id}.enabled`,
            name: { en: "Axis in use", de: "Achse in Verwendung" },
            type: "boolean",
            role: "indicator",
            status: `${id}.enabled`,
        },
        ...directionStates(axis, plus, minus),
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
    if (axis === "elevation") {
        states.push(
            {
                id: `${id}.flatDirection`,
                name: { en: "Direction of the flat position", de: "Richtung der Flachstellung" },
                type: "number",
                role: "value",
                states: { "-1": "MINUS (output DOWN)", 1: "PLUS (output UP)" },
                status: `${id}.flatDir`,
            },
            {
                id: `${id}.angle`,
                name: { en: "Tilt", de: "Neigung" },
                type: "number",
                role: "value",
                unit: "°",
                status: `${id}.deg`,
            },
            {
                id: `${id}.angleSource`,
                name: { en: "Source of the tilt", de: "Herkunft der Neigung" },
                type: "string",
                role: "text",
                states: { hall: "counted (Hall tap)", time: "estimated from the travel time" },
                status: `${id}.degSource`,
            },
            ...syncResetStates("elevation", undefined),
        );
    } else {
        states.push(...syncResetStates("azimuth", 2));
    }
    return states;
}

/**
 * State of the manual drive of one axis.
 *
 * @param axis axis
 * @param plus name of the PLUS direction
 * @param minus name of the MINUS direction
 */
function jogState(axis: "elevation" | "azimuth", plus: Name, minus: Name): StateDef {
    return {
        id: axis === "elevation" ? "control.jogElevation" : "control.jogAzimuth",
        name:
            axis === "elevation"
                ? {
                      en: "Manual drive elevation (write again at least once per second)",
                      de: "Handfahrt Elevation (mindestens einmal pro Sekunde neu schreiben)",
                  }
                : {
                      en: "Manual drive azimuth (write again at least once per second)",
                      de: "Handfahrt Azimut (mindestens einmal pro Sekunde neu schreiben)",
                  },
        type: "number",
        role: "level",
        write: true,
        min: -1,
        max: 1,
        states: { "-1": minus.en, 0: "Stop", 1: plus.en },
    };
}

/**
 * The states whose names or value texts contain the directions of the elevation. They are
 * written again when `axes.elevation.flatDir` changes.
 *
 * @param flatDir value of `axes.elevation.flatDir`
 */
export function elevationLabelStates(flatDir: unknown): StateDef[] {
    const { plus, minus } = elevationDirections(flatDir);
    return [...directionStates("elevation", plus, minus), jogState("elevation", plus, minus)];
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

/** Defaults for the states of the sun position */
const SUN: Availability = { feature: "sunpos" };
/** Defaults for the states of the tilt on command */
const POSITION: Availability = { feature: "position", mode: 1 };
/** Defaults for the states of the Hall tap */
const HALL: Availability = { feature: "hall", mode: 1 };
/** Defaults for the states of the setup program */
const COMMISSIONING: Availability = { feature: "commissioning" };
/** Defaults for the states of the data set of the test report */
const REPORT: Availability = { feature: "reportjson" };
/** Defaults for the states of the firmware over the internet */
const FIRMWARE: Availability = { feature: "fwonline" };
/** Defaults for the states of the built-in battery */
const BATTERY: Availability = { feature: "battery" };
/** Defaults for the inputs "24 V present" and "5 V present" */
const POWER: Availability = { feature: "power" };
/** Defaults for the plausibility check of the charge lock (E34) */
const CHARGECHECK: Availability = { feature: "chargecheck" };
/** Defaults for the progress of a firmware update */
const UPDATE: Availability = { feature: "update" };
/** Defaults for the phase and the error of a firmware update (park before writing) */
const UPDATEPARK: Availability = { feature: "updatepark" };

/** Steps of the setup program (`commissioning.step`, `key` of the steps in the report) */
const COMMISSIONING_STEPS: Record<string, string> = {
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
    done: "Completion",
};

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

    // --- axes: the names of the elevation directions follow axes.elevation.flatDir (main.ts) ---
    ...axisStates("elevation", elevationDirections(1).plus, elevationDirections(1).minus),
    ...axisStates("azimuth", AZIMUTH_PLUS, AZIMUTH_MINUS),

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

    // --- position of the sun (feature sunpos): times are Unix seconds at the device, here ms ---
    {
        id: "sunPosition.known",
        name: { en: "Time and site known", de: "Uhrzeit und Standort bekannt" },
        type: "boolean",
        role: "indicator",
        status: "sunPos.known",
        ...SUN,
    },
    {
        id: "sunPosition.timeOk",
        name: { en: "Time set by the time server", de: "Uhrzeit vom Zeitserver gestellt" },
        type: "boolean",
        role: "indicator",
        status: "sunPos.timeOk",
        ...SUN,
    },
    {
        id: "sunPosition.siteSet",
        name: { en: "Site entered", de: "Standort eingegeben" },
        type: "boolean",
        role: "indicator",
        status: "sunPos.siteSet",
        ...SUN,
    },
    {
        id: "sunPosition.latitude",
        name: { en: "Latitude of the site", de: "Breite des Standorts" },
        type: "number",
        role: "value.gps.latitude",
        unit: "°",
        status: "sunPos.lat",
        ...SUN,
    },
    {
        id: "sunPosition.longitude",
        name: { en: "Longitude of the site", de: "Länge des Standorts" },
        type: "number",
        role: "value.gps.longitude",
        unit: "°",
        status: "sunPos.lon",
        ...SUN,
    },
    {
        id: "sunPosition.azimuth",
        name: { en: "Azimuth of the sun (0 = north, 90 = east)", de: "Himmelsrichtung der Sonne (0 = Nord, 90 = Ost)" },
        type: "number",
        role: "value.sun.azimuth",
        unit: "°",
        status: "sunPos.az",
        ...SUN,
    },
    {
        id: "sunPosition.elevation",
        name: { en: "Elevation of the sun above the horizon", de: "Höhe der Sonne über dem Horizont" },
        type: "number",
        role: "value.sun.elevation",
        unit: "°",
        status: "sunPos.el",
        ...SUN,
    },
    {
        id: "sunPosition.sunrise",
        name: { en: "Sunrise today", de: "Sonnenaufgang heute" },
        type: "number",
        role: "date.sunrise",
        status: "sunPos.rise",
        convert: "secondsToMs",
        ...SUN,
    },
    {
        id: "sunPosition.sunset",
        name: { en: "Sunset today", de: "Sonnenuntergang heute" },
        type: "number",
        role: "date.sunset",
        status: "sunPos.set",
        convert: "secondsToMs",
        ...SUN,
    },
    {
        id: "sunPosition.noon",
        name: { en: "Highest position of the sun today", de: "Höchster Sonnenstand heute" },
        type: "number",
        role: "value.time",
        status: "sunPos.noon",
        convert: "secondsToMs",
        ...SUN,
    },
    {
        id: "sunPosition.noonElevation",
        name: { en: "Elevation of the sun at its highest position", de: "Höhe der Sonne beim höchsten Stand" },
        type: "number",
        role: "value",
        unit: "°",
        status: "sunPos.noonEl",
        ...SUN,
    },
    {
        id: "sunPosition.alwaysUp",
        name: { en: "Polar day today", de: "Polartag heute" },
        type: "boolean",
        role: "indicator",
        status: "sunPos.alwaysUp",
        ...SUN,
    },
    {
        id: "sunPosition.alwaysDown",
        name: { en: "Polar night today", de: "Polarnacht heute" },
        type: "boolean",
        role: "indicator",
        status: "sunPos.alwaysDown",
        ...SUN,
    },
    {
        id: "sunPosition.night",
        name: { en: "Night by the position of the sun", de: "Nacht nach dem Sonnenstand" },
        type: "boolean",
        role: "indicator",
        status: "sunPos.night",
        ...SUN,
    },
    {
        id: "sunPosition.nightStart",
        name: { en: "Beginning of the night today", de: "Beginn der Nacht heute" },
        type: "number",
        role: "value.time",
        status: "sunPos.nightStart",
        convert: "secondsToMs",
        ...SUN,
    },
    {
        id: "sunPosition.dayStart",
        name: { en: "Beginning of the day today", de: "Beginn des Tages heute" },
        type: "number",
        role: "value.time",
        status: "sunPos.dayStart",
        convert: "secondsToMs",
        ...SUN,
    },
    {
        id: "sunPosition.rackAzimuth",
        name: {
            en: "Orientation of the rack (0 = south, west positive)",
            de: "Ausrichtung des Racks (0 = Süd, nach Westen positiv)",
        },
        type: "number",
        role: "value",
        unit: "°",
        status: "sunPos.rackAz",
        ...SUN,
        mode: 1,
    },
    {
        id: "sunPosition.bestTilt",
        name: { en: "Best tilt now", de: "Bester Neigungswinkel jetzt" },
        type: "number",
        role: "value",
        unit: "°",
        status: "sunPos.bestTilt",
        ...SUN,
        mode: 1,
    },
    {
        id: "sunPosition.astroTarget",
        name: { en: "Calculated angle when cloudy", de: "Berechneter Winkel bei Bewölkung" },
        type: "number",
        role: "value",
        unit: "°",
        status: "sunPos.astroTarget",
        ...SUN,
    },

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

    {
        id: "supply.v24",
        name: { en: "24 V present", de: "24 V vorhanden" },
        type: "boolean",
        role: "indicator",
        status: "supply.v24",
        ...POWER,
    },
    {
        id: "supply.v5",
        name: { en: "5 V present", de: "5 V vorhanden" },
        type: "boolean",
        role: "indicator",
        status: "supply.v5",
        ...POWER,
    },
    {
        id: "supply.adcOk",
        name: {
            en: "Component for checking the charge lock answers",
            de: "Baustein zur Prüfung der Ladesperre antwortet",
        },
        type: "boolean",
        role: "indicator.reachable",
        status: "supply.adcOk",
        ...CHARGECHECK,
    },
    {
        id: "supply.checks",
        name: {
            en: "Pending findings of the charge lock check",
            de: "Anstehende Befunde der Prüfung der Ladesperre",
        },
        type: "string",
        role: "json",
        status: "supply.checks",
        convert: "json",
        ...CHARGECHECK,
    },

    // --- built-in battery of the board (feature battery), display only ---
    {
        id: "battery.fitted",
        name: { en: "Battery fitted (setting)", de: "Akku eingebaut (Einstellung)" },
        type: "boolean",
        role: "indicator",
        status: "battery.fitted",
        ...BATTERY,
    },
    {
        id: "battery.valid",
        name: { en: "Valid measurement of the battery", de: "Gültige Messung des Akkus" },
        type: "boolean",
        role: "indicator",
        status: "battery.valid",
        ...BATTERY,
    },
    {
        id: "battery.percent",
        name: { en: "Charge level of the battery", de: "Füllstand des Akkus" },
        type: "number",
        role: "value.battery",
        unit: "%",
        min: 0,
        max: 100,
        status: "battery.percent",
        ...BATTERY,
    },
    {
        id: "battery.charging",
        name: { en: "Battery is charging", de: "Akku wird geladen" },
        type: "boolean",
        role: "indicator",
        status: "battery.charging",
        ...BATTERY,
    },
    {
        id: "battery.level",
        name: { en: "Level of the battery", de: "Stufe des Akkus" },
        type: "string",
        role: "text",
        states: { ok: "ok", low: "low", critical: "critical" },
        status: "battery.level",
        ...BATTERY,
    },

    // --- firmware update over the network or the internet (feature update) ---
    {
        id: "update.active",
        name: { en: "New firmware is being written", de: "Neue Firmware wird geschrieben" },
        type: "boolean",
        role: "indicator.working",
        status: "update.active",
        ...UPDATE,
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
        ...UPDATE,
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
            writing: "writing",
        },
        status: "update.phase",
        ...UPDATEPARK,
    },
    {
        id: "update.error",
        name: {
            en: "Reason why the last update was not written",
            de: "Grund, warum das letzte Update nicht geschrieben wurde",
        },
        type: "string",
        role: "text",
        status: "update.error",
        ...UPDATEPARK,
    },

    // --- remote manual drive ---
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

    // --- tilt on command (feature position, vertical only) ---
    {
        id: "position.target",
        name: { en: "Commanded angle", de: "Befohlener Winkel" },
        type: "number",
        role: "value",
        unit: "°",
        status: "position.target",
        ...POSITION,
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
            hallfault: "Hall tap failed: no drive",
        },
        status: "position.phase",
        ...POSITION,
    },
    {
        id: "position.angle",
        name: { en: "Tilt", de: "Neigung" },
        type: "number",
        role: "value",
        unit: "°",
        status: "position.deg",
        ...POSITION,
    },
    {
        id: "position.known",
        name: { en: "Tilt known", de: "Neigung bekannt" },
        type: "boolean",
        role: "indicator",
        status: "position.known",
        ...POSITION,
    },
    {
        id: "position.uncertainty",
        name: { en: "Estimated uncertainty of the tilt", de: "Geschätzte Unsicherheit der Neigung" },
        type: "number",
        role: "value",
        unit: "°",
        status: "position.uncert",
        ...POSITION,
    },
    {
        id: "position.calibrated",
        name: {
            en: "Travel times measured (angles in between possible)",
            de: "Fahrzeiten eingemessen (Zwischenwinkel möglich)",
        },
        type: "boolean",
        role: "indicator",
        status: "position.calibrated",
        ...POSITION,
    },
    {
        id: "position.presets",
        name: { en: "Angles offered", de: "Angebotene Winkel" },
        type: "string",
        role: "json",
        status: "position.presets",
        convert: "json",
        ...POSITION,
    },
    {
        id: "position.wait",
        name: {
            en: "Waiting time until a drive to the end position",
            de: "Wartezeit bis zu einer Fahrt in die Endlage",
        },
        type: "number",
        role: "value.timer",
        unit: "s",
        status: "position.waitMs",
        convert: "msToSeconds",
        ...POSITION,
    },
    {
        id: "position.source",
        name: { en: "Source of the tilt", de: "Herkunft der Neigung" },
        type: "string",
        role: "text",
        states: { hall: "counted (Hall tap)", time: "estimated from the travel time" },
        status: "position.source",
        ...HALL,
    },
    {
        id: "position.hallEnabled",
        name: { en: "Hall tap switched on", de: "Hall-Abgriff eingeschaltet" },
        type: "boolean",
        role: "indicator",
        status: "position.hall.enabled",
        ...HALL,
    },
    {
        id: "position.hallOk",
        name: { en: "Hall tap ok", de: "Hall-Abgriff in Ordnung" },
        type: "boolean",
        role: "indicator",
        status: "position.hall.ok",
        ...HALL,
    },
    {
        id: "position.hallFault",
        name: { en: "Fault of the Hall tap", de: "Störung des Hall-Abgriffs" },
        type: "string",
        role: "text",
        states: {
            nodriver: "counter of the board not set up",
            nosteps: "no Hall pulses",
            reversed: "counts against the direction of travel",
            noise: "more steps than the drive can deliver",
        },
        status: "position.hall.fault",
        ...HALL,
    },
    {
        id: "position.hallCount",
        name: { en: "Hall steps from the flat position", de: "Hall-Schritte ab der Flachstellung" },
        type: "number",
        role: "value",
        status: "position.hall.count",
        ...HALL,
    },
    {
        id: "position.hallSteps",
        name: { en: "Hall steps per stroke (measured)", de: "Hall-Schritte je Hub (eingemessen)" },
        type: "number",
        role: "value",
        status: "position.hall.steps",
        ...HALL,
    },
    {
        id: "position.hallFaults",
        name: { en: "Failures of the Hall tap since the start", de: "Ausfälle des Hall-Abgriffs seit dem Start" },
        type: "number",
        role: "value",
        status: "position.hall.faults",
        ...HALL,
    },

    // --- setup program (feature commissioning, operated only at the display) ---
    {
        id: "commissioning.done",
        name: { en: "Setup program completed", de: "Setup-Programm abgeschlossen" },
        type: "boolean",
        role: "indicator",
        status: "commissioning.done",
        ...COMMISSIONING,
    },
    {
        id: "commissioning.active",
        name: { en: "Setup program open at the display", de: "Setup-Programm am Display geöffnet" },
        type: "boolean",
        role: "indicator.working",
        status: "commissioning.active",
        ...COMMISSIONING,
    },
    {
        id: "commissioning.step",
        name: { en: "Current step", de: "Aktueller Schritt" },
        type: "string",
        role: "text",
        states: COMMISSIONING_STEPS,
        status: "commissioning.step",
        ...COMMISSIONING,
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
            failed: "failed",
        },
        status: "commissioning.phase",
        ...COMMISSIONING,
    },
    {
        id: "commissioning.number",
        name: { en: "Number of the step", de: "Nummer des Schritts" },
        type: "number",
        role: "value",
        status: "commissioning.number",
        ...COMMISSIONING,
    },
    {
        id: "commissioning.total",
        name: { en: "Number of steps", de: "Anzahl der Schritte" },
        type: "number",
        role: "value",
        status: "commissioning.total",
        ...COMMISSIONING,
    },
    {
        id: "commissioning.optional",
        name: { en: "Step may be skipped", de: "Schritt darf übersprungen werden" },
        type: "boolean",
        role: "indicator",
        status: "commissioning.optional",
        ...COMMISSIONING,
    },
    {
        id: "commissioning.report0",
        name: { en: "Test report, newest", de: "Prüfbericht, neuester" },
        type: "string",
        role: "text",
        ...COMMISSIONING,
    },
    {
        id: "commissioning.report1",
        name: { en: "Test report, second newest", de: "Prüfbericht, zweitneuester" },
        type: "string",
        role: "text",
        ...COMMISSIONING,
    },
    {
        id: "commissioning.report2",
        name: { en: "Test report, third newest", de: "Prüfbericht, drittneuester" },
        type: "string",
        role: "text",
        ...COMMISSIONING,
    },

    // --- data set of the newest test report (feature reportjson) ---
    {
        id: "commissioning.report.date",
        name: { en: "Completion of the setup program", de: "Abschluss des Setup-Programms" },
        type: "number",
        role: "date",
        report: "epoch",
        convert: "secondsToMs",
        ...REPORT,
    },
    {
        id: "commissioning.report.passed",
        name: { en: "All mandatory steps passed", de: "Alle Pflichtschritte bestanden" },
        type: "boolean",
        role: "indicator",
        report: "done",
        ...REPORT,
    },
    {
        id: "commissioning.report.simulation",
        name: { en: "Run in the simulation", de: "In der Simulation durchlaufen" },
        type: "boolean",
        role: "indicator",
        report: "simulation",
        ...REPORT,
    },
    {
        id: "commissioning.report.firmware",
        name: { en: "Firmware of the report", de: "Firmware des Berichts" },
        type: "string",
        role: "text",
        report: "fw",
        ...REPORT,
    },
    {
        id: "commissioning.report.duration",
        name: { en: "Duration of the setup program", de: "Dauer des Setup-Programms" },
        type: "number",
        role: "time.span",
        unit: "s",
        report: "durationS",
        ...REPORT,
    },
    {
        id: "commissioning.report.flatRun",
        name: { en: "Travel time to the flat position", de: "Fahrzeit in die Flachstellung" },
        type: "number",
        role: "time.span",
        unit: "ms",
        report: "values.flatRunMs",
        ...REPORT,
    },
    {
        id: "commissioning.report.travelSteeper",
        name: { en: "Travel time 0° to 60° (steeper)", de: "Fahrzeit 0° bis 60° (steiler)" },
        type: "number",
        role: "time.span",
        unit: "ms",
        report: "values.elevSteepMs",
        ...REPORT,
    },
    {
        id: "commissioning.report.travelFlatter",
        name: { en: "Travel time 60° to 0° (flatter)", de: "Fahrzeit 60° bis 0° (flacher)" },
        type: "number",
        role: "time.span",
        unit: "ms",
        report: "values.elevFlatMs",
        ...REPORT,
    },
    {
        id: "commissioning.report.hallSteps",
        name: { en: "Hall steps per stroke", de: "Hall-Schritte je Hub" },
        type: "number",
        role: "value",
        report: "values.elevHallSteps",
        ...REPORT,
    },
    {
        id: "commissioning.report.azimuthEast",
        name: { en: "Travel time azimuth to the east", de: "Fahrzeit Azimut nach Osten" },
        type: "number",
        role: "time.span",
        unit: "ms",
        report: "values.azEastMs",
        ...REPORT,
    },
    {
        id: "commissioning.report.azimuthWest",
        name: { en: "Travel time azimuth to the west", de: "Fahrzeit Azimut nach Westen" },
        type: "number",
        role: "time.span",
        unit: "ms",
        report: "values.azWestMs",
        ...REPORT,
    },
    {
        id: "commissioning.report.azimuthBack",
        name: { en: "Travel time azimuth back", de: "Fahrzeit Azimut zurück" },
        type: "number",
        role: "time.span",
        unit: "ms",
        report: "values.azBackMs",
        ...REPORT,
    },
    {
        id: "commissioning.report.steps",
        name: { en: "Steps with their result", de: "Schritte mit ihrem Ergebnis" },
        type: "string",
        role: "json",
        report: "steps",
        convert: "json",
        ...REPORT,
    },
    {
        id: "commissioning.report.stepsPassed",
        name: { en: "Steps passed", de: "Bestandene Schritte" },
        type: "number",
        role: "value",
        ...REPORT,
    },
    {
        id: "commissioning.report.stepsSkipped",
        name: { en: "Steps skipped", de: "Übersprungene Schritte" },
        type: "number",
        role: "value",
        ...REPORT,
    },
    {
        id: "commissioning.report.stepsOpen",
        name: { en: "Steps open", de: "Offene Schritte" },
        type: "number",
        role: "value",
        ...REPORT,
    },
    {
        id: "commissioning.report.json",
        name: { en: "Complete data set of the report", de: "Vollständiger Datensatz des Berichts" },
        type: "string",
        role: "json",
        ...REPORT,
    },

    // --- firmware over the internet (feature fwonline) ---
    {
        id: "firmware.state",
        name: { en: "State of the version check", de: "Stand der Versionsprüfung" },
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
            failed: "not installed",
        },
        status: "fwOnline.state",
        ...FIRMWARE,
    },
    {
        id: "firmware.current",
        name: { en: "Running firmware", de: "Laufende Firmware" },
        type: "string",
        role: "info.firmware",
        status: "fwOnline.current",
        ...FIRMWARE,
    },
    {
        id: "firmware.latest",
        name: { en: "Newest version found", de: "Neueste gefundene Version" },
        type: "string",
        role: "text",
        status: "fwOnline.latest",
        ...FIRMWARE,
    },
    {
        id: "firmware.date",
        name: { en: "Date of the newest version", de: "Datum der neuesten Version" },
        type: "string",
        role: "date",
        status: "fwOnline.date",
        ...FIRMWARE,
    },
    {
        id: "firmware.notes",
        name: { en: "Notes of the newest version", de: "Hinweise zur neuesten Version" },
        type: "string",
        role: "text",
        status: "fwOnline.notes",
        ...FIRMWARE,
    },
    {
        id: "firmware.size",
        name: { en: "Size of the newest version", de: "Größe der neuesten Version" },
        type: "number",
        role: "value",
        unit: "bytes",
        status: "fwOnline.size",
        ...FIRMWARE,
    },
    {
        id: "firmware.checkedAgo",
        name: { en: "Time since the last check", de: "Zeit seit der letzten Prüfung" },
        type: "number",
        role: "time.span",
        unit: "s",
        status: "fwOnline.checkedAgoMs",
        convert: "msToSeconds",
        ...FIRMWARE,
    },
    {
        id: "firmware.error",
        name: { en: "Reason of the last failure", de: "Grund des letzten Fehlschlags" },
        type: "string",
        role: "text",
        status: "fwOnline.error",
        ...FIRMWARE,
    },
    {
        id: "firmware.percent",
        name: { en: "Progress of loading or writing", de: "Fortschritt beim Laden oder Schreiben" },
        type: "number",
        role: "value.progress",
        unit: "%",
        status: "fwOnline.percent",
        ...FIRMWARE,
    },
    {
        id: "firmware.rolledBack",
        name: { en: "Version taken back by the device", de: "Vom Gerät zurückgenommene Version" },
        type: "string",
        role: "text",
        status: "fwOnline.rolledBack",
        ...FIRMWARE,
    },
    {
        id: "firmware.newer",
        name: { en: "Newer version known", de: "Neuere Version bekannt" },
        type: "boolean",
        role: "indicator",
        status: "fwOnline.newer",
        ...FIRMWARE,
    },
    {
        id: "firmware.canInstall",
        name: { en: "Newest version can be installed now", de: "Neueste Version jetzt installierbar" },
        type: "boolean",
        role: "indicator",
        status: "fwOnline.canInstall",
        ...FIRMWARE,
    },
    {
        id: "firmware.keyPresent",
        name: { en: "Signing key of the project present", de: "Signierschlüssel des Projekts vorhanden" },
        type: "boolean",
        role: "indicator",
        status: "fwOnline.keyPresent",
        ...FIRMWARE,
    },
    {
        id: "firmware.awaitingConfirm",
        name: { en: "New firmware waits for its self test", de: "Neue Firmware wartet auf ihren Selbsttest" },
        type: "boolean",
        role: "indicator",
        status: "fwOnline.awaitingConfirm",
        ...FIRMWARE,
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
    jogState("elevation", elevationDirections(1).plus, elevationDirections(1).minus),
    jogState("azimuth", AZIMUTH_PLUS, AZIMUTH_MINUS),
    {
        id: "control.position",
        name: {
            en: "Tilt the elevation to an offered angle (position.presets)",
            de: "Elevation auf einen angebotenen Winkel neigen (position.presets)",
        },
        type: "number",
        role: "level",
        unit: "°",
        write: true,
        min: 0,
        max: 60,
        status: "position.target",
        ...POSITION,
    },
    {
        id: "control.positionResume",
        name: {
            en: "Cancel the tilt on command, continue the automatic",
            de: "Neigung auf Befehl aufheben, Automatik fortsetzen",
        },
        type: "boolean",
        role: "button.resume",
        write: true,
        read: false,
        ...POSITION,
    },
    {
        id: "control.syncResetElevation",
        name: {
            en: "Reset the synchronous control of the elevation (make sure the swivel range is clear)",
            de: "Synchronsteuerung der Elevation zurücksetzen (vorher den Schwenkbereich frei machen)",
        },
        type: "boolean",
        role: "button",
        write: true,
        read: false,
        feature: "syncreset",
    },
    {
        id: "control.syncResetAzimuth",
        name: {
            en: "Reset the synchronous control of the azimuth (make sure the swivel range is clear)",
            de: "Synchronsteuerung des Azimuts zurücksetzen (vorher den Schwenkbereich frei machen)",
        },
        type: "boolean",
        role: "button",
        write: true,
        read: false,
        feature: "syncreset",
        mode: 2,
    },
    {
        id: "control.fwCheck",
        name: { en: "Check for newer firmware now", de: "Jetzt nach neuerer Firmware suchen" },
        type: "boolean",
        role: "button",
        write: true,
        read: false,
        ...FIRMWARE,
    },
    {
        id: "control.fwInstall",
        name: {
            en: "Install firmware: write the version of firmware.latest",
            de: "Firmware installieren: die Version aus firmware.latest schreiben",
        },
        type: "string",
        role: "text",
        write: true,
        ...FIRMWARE,
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
    if (def.convert === "secondsToMs") {
        return typeof raw === "number" ? raw * 1000 : undefined;
    }
    return typeof raw === def.type ? (raw as StateValue) : undefined;
}

/**
 * Maps a status of the device (GET /api/status, frame `status`) to state values.
 *
 * @param status the status
 * @param layout features and operating mode; states that do not exist for it are left out (undefined = all)
 * @returns state id => value; states whose value is missing in the status are left out
 */
export function statusToValues(status: DeviceStatus, layout?: Layout): Map<string, StateValue> {
    const values = new Map<string, StateValue>();
    for (const def of STATES) {
        if (!def.status || !isAvailable(def, layout)) {
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

/**
 * Maps the data set of a test report (GET /api/report?format=json, feature reportjson) to the
 * states under `commissioning.report`. Without a data set (no report yet) every state is null.
 *
 * @param report parsed data set, undefined = no report
 * @returns state id => value for every state of the data set
 */
export function reportToValues(report: unknown): Map<string, StateValue> {
    const values = new Map<string, StateValue>();
    const defs = STATES.filter(def => def.id.startsWith("commissioning.report."));
    if (!isObject(report)) {
        for (const def of defs) {
            values.set(def.id, null);
        }
        return values;
    }
    for (const def of defs) {
        if (!def.report) {
            continue;
        }
        values.set(def.id, convertValue(def, readPath(report, def.report)) ?? null);
    }
    const steps = Array.isArray(report.steps) ? report.steps : [];
    const count = (result: string): number => steps.filter(step => isObject(step) && step.result === result).length;
    values.set("commissioning.report.stepsPassed", count("passed"));
    values.set("commissioning.report.stepsSkipped", count("skipped"));
    values.set("commissioning.report.stepsOpen", count("open"));
    values.set("commissioning.report.json", JSON.stringify(report));
    return values;
}
