/*
 * Protocol between the Samba Solar Track controller and this adapter (protocol version 1).
 * The contract is PROTOCOL.md of the firmware project (https://github.com/ssbingo/samba-solar-track).
 * This file only contains types and pure functions, no I/O.
 */

/** Value of `device` in GET /api/info and in the `hello` frame */
export const DEVICE_NAME = "samba-solar-track";

/** Highest protocol version this adapter knows */
export const PROTOCOL_VERSION = 1;

/** Answer of GET /api/info (only the fixed contract is mandatory) */
export interface DeviceInfo {
    /** Always "samba-solar-track" */
    device: string;
    /** Firmware version */
    fw: string;
    /** Protocol version */
    protocol: number;
    /** Unique id of the device (MAC address) */
    id: string;
    /** What the firmware can do */
    features: string[];
    /** Changes on every start of the device */
    bootId?: string;
    /** Time since the start of the device in ms */
    uptimeMs?: number;
    /** Name of the device in the network */
    hostname?: string;
    /** IP address in the WLAN */
    ip?: string;
    /** Signal strength of the WLAN in dBm */
    wifiRssi?: number;
    /** Free heap in bytes */
    heapFree?: number;
    /** Lowest free heap since start in bytes */
    heapMin?: number;
    /** Reason of the last reset (German text of the firmware) */
    resetReason?: string;
    /** true = the device simulates the tracker, no value is a real measurement */
    simulation?: boolean;
}

/** `hello` frame, sent by the device right after the WebSocket is connected */
export interface HelloFrame {
    /** Frame type */
    t: "hello";
    /** Always "samba-solar-track" */
    device: string;
    /** Firmware version */
    fw: string;
    /** Protocol version */
    protocol: number;
    /** Changes on every start of the device */
    bootId: string;
    /** Time since the start of the device in ms */
    uptimeMs: number;
    /** true = the token was valid, commands are allowed */
    auth: boolean;
    /** Oldest sequence number in the ring buffer of the device */
    logFirst: number;
    /** Sequence number the next message will get */
    logNext: number;
}

/** One log line of the firmware */
export interface LogLine {
    /** Sequence number, starts at 1 on every start of the device */
    seq: number;
    /** Uptime of the device in ms when the line was created */
    ms: number;
    /** Level: E, W, I, D or V */
    lvl: string;
    /** Module of the firmware */
    tag: string;
    /** Text (German, ASCII) */
    msg: string;
}

/** `lost` frame: messages that are no longer available */
export interface LostFrame {
    /** Frame type */
    t: "lost";
    /** First lost sequence number */
    from: number;
    /** Last lost sequence number */
    to: number;
    /** Number of lost messages */
    count: number;
}

/** Status of the controller: nested JSON, unknown fields are ignored */
export type DeviceStatus = Record<string, unknown>;

/**
 * Type guard for plain JSON objects.
 *
 * @param value any parsed JSON value
 */
export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks the answer of GET /api/info.
 *
 * @param json parsed JSON of the answer
 * @returns the info, or a text that says what is wrong
 */
export function parseInfo(json: unknown): DeviceInfo | string {
    if (!isObject(json)) {
        return "answer is not a JSON object";
    }
    if (json.device !== DEVICE_NAME) {
        return `unexpected device "${String(json.device)}" (expected "${DEVICE_NAME}")`;
    }
    if (typeof json.fw !== "string" || typeof json.protocol !== "number" || typeof json.id !== "string") {
        return "fw, protocol or id is missing";
    }
    const features = Array.isArray(json.features)
        ? json.features.filter((f): f is string => typeof f === "string")
        : [];
    return { ...json, device: DEVICE_NAME, fw: json.fw, protocol: json.protocol, id: json.id, features };
}

/**
 * Checks a `hello` frame.
 *
 * @param json parsed frame
 * @returns the frame, or a text that says what is wrong
 */
export function parseHello(json: Record<string, unknown>): HelloFrame | string {
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
        logNext: typeof json.logNext === "number" ? json.logNext : 1,
    };
}

/**
 * Checks a log line (frame `log` or an entry of GET /api/log).
 *
 * @param json parsed frame or entry
 * @returns the line, or undefined when a mandatory field is missing
 */
export function parseLogLine(json: unknown): LogLine | undefined {
    if (!isObject(json) || typeof json.seq !== "number" || typeof json.ms !== "number") {
        return undefined;
    }
    return {
        seq: json.seq,
        ms: json.ms,
        lvl: typeof json.lvl === "string" ? json.lvl : "I",
        tag: typeof json.tag === "string" ? json.tag : "",
        msg: typeof json.msg === "string" ? json.msg : "",
    };
}

/**
 * Sequence number to subscribe from after `hello` (PROTOCOL.md, section 6).
 *
 * @param hello the hello frame of the device
 * @param knownBootId boot id of the last connection, if any
 * @param lastSeq last sequence number received with that boot id, if any
 * @returns the value for `since` in the `sub` frame
 */
export function resumeSince(hello: HelloFrame, knownBootId: string | undefined, lastSeq: number | undefined): number {
    if (knownBootId === hello.bootId && typeof lastSeq === "number" && lastSeq > 0) {
        return lastSeq + 1;
    }
    return hello.logFirst;
}

/**
 * Reads a nested value, e.g. "axes.elevation.out".
 *
 * @param source object to read from
 * @param path keys separated by dots
 * @returns the value, or undefined when a part of the path is missing
 */
export function readPath(source: unknown, path: string): unknown {
    let current: unknown = source;
    for (const key of path.split(".")) {
        if (!isObject(current)) {
            return undefined;
        }
        current = current[key];
    }
    return current;
}
