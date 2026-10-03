/*
 * Protocol between the Samba Solar Track controller and this adapter (protocol version 1).
 * The contract is PROTOCOL.md of the firmware project (https://github.com/ssbingo/samba-solar-track).
 * This file only contains types and pure functions, no I/O.
 */

/** Value of `device` in GET /api/info and in the `hello` frame */
export const DEVICE_NAME = "samba-solar-track";

/** Highest protocol version this adapter knows */
export const PROTOCOL_VERSION = 1;

/**
 * The token: exactly 32 hex characters in lower case, as the firmware creates and checks it.
 * PROTOCOL.md (section 3) describes its use, but not its form.
 */
export const TOKEN_LENGTH = 32;

/** The display shows the token as 4 blocks of 8 characters, two blocks per line */
export const TOKEN_BLOCKS = 4;

/** Characters per block */
export const TOKEN_BLOCK_LENGTH = TOKEN_LENGTH / TOKEN_BLOCKS;

/** Where the user finds the token, for log texts */
export const TOKEN_HINT =
    'The display shows it under the gear > NETZWERK > "TOKEN FUER DEN ADAPTER" as 4 blocks of 8 characters ' +
    "(0-9, a-f); enter one block per field in the adapter settings.";

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

/** Where the token of the adapter settings comes from */
export type TokenSource = "blocks" | "old" | "none";

/** Token of the adapter settings, checked */
export interface TokenSetting {
    /** The token as the device expects it; empty = read only */
    token: string;
    /** The four fields, the old single field of version 0.0.4 and older, or no token at all */
    source: TokenSource;
    /** What is wrong, in words and without the token itself; undefined = the token can be used */
    problem?: string;
    /** Characters in each of the four fields after removing whitespace (for the log) */
    blockLengths: number[];
    /** Characters in the old single field after removing whitespace (for the log) */
    oldLength: number;
}

/**
 * Removes all whitespace and converts to lower case, like the web page of the device does.
 *
 * @param value value of a field of the adapter settings
 */
function normalizeToken(value: unknown): string {
    if (typeof value !== "string" && typeof value !== "number") {
        return "";
    }
    return String(value).replace(/\s+/g, "").toLowerCase();
}

/**
 * Describes what is wrong with a token or a block, without showing its content.
 *
 * @param value token or block without whitespace, in lower case
 * @param length expected number of characters
 * @returns the problems, each fitting after "has"; empty when the value is fine
 */
function tokenProblems(value: string, length: number): string[] {
    const characters = [...value];
    const problems: string[] = [];
    if (characters.length !== length) {
        problems.push(`${characters.length} characters instead of ${length}`);
    }
    const positions: number[] = [];
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

/**
 * Puts the token together from the adapter settings. The display shows it as 4 blocks of
 * 8 characters, and the settings have one field per block. In each block whitespace is removed
 * and upper case is converted, like the web page of the device does; then every block must have
 * exactly 8 characters 0-9 and a-f. While the four fields are empty, the old single field of
 * version 0.0.4 and older is used after the same treatment.
 *
 * @param blocks values of the four fields, in the order of the display
 * @param old value of the old single field
 * @returns the token, or an empty token (read only) with the reason
 */
export function assembleToken(blocks: readonly unknown[], old: unknown): TokenSetting {
    const parts: string[] = [];
    for (let i = 0; i < TOKEN_BLOCKS; i++) {
        parts.push(normalizeToken(blocks[i]));
    }
    const single = normalizeToken(old);
    const lengths = { blockLengths: parts.map(part => [...part].length), oldLength: [...single].length };
    if (parts.every(part => part === "")) {
        if (!single) {
            return { token: "", source: "none", ...lengths };
        }
        const problems = tokenProblems(single, TOKEN_LENGTH);
        return problems.length
            ? {
                  token: "",
                  source: "old",
                  problem:
                      `the token saved by version 0.0.4 or older (no longer shown in the settings) has ${problems.join(" and ")}; ` +
                      "enter the token in the four fields, then it is removed",
                  ...lengths,
              }
            : { token: single, source: "old", ...lengths };
    }
    const problems: string[] = [];
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
    return problems.length
        ? { token: "", source: "blocks", problem: problems.join(", "), ...lengths }
        : { token: parts.join(""), source: "blocks", ...lengths };
}

/** What to do with the old single token field of version 0.0.4 and older (not shown since 0.0.6). */
export interface TokenMigration {
    /** new values for the four fields, when the token of the old field is moved there */
    blocks?: string[];
    /** the old field is emptied */
    clearOld: true;
}

/**
 * Decides whether the old single field is moved into the four fields. Since 0.0.6 the settings
 * show only the four fields. While they are empty, a usable token of the old field is moved
 * there, one block per field; once they are in use, the old field is emptied. An old value that
 * is not a usable token stays, so that the log can name the problem.
 *
 * @param blocks values of the four fields, in the order of the display
 * @param old value of the old single field
 * @returns what to write into the settings, or null if nothing is to be done
 */
export function migrateOldToken(blocks: readonly unknown[], old: unknown): TokenMigration | null {
    const single = normalizeToken(old);
    if (!single) {
        return null;
    }
    const inUse = Array.from({ length: TOKEN_BLOCKS }, (_, i) => normalizeToken(blocks[i])).some(part => part !== "");
    if (inUse) {
        return { clearOld: true };
    }
    if (tokenProblems(single, TOKEN_LENGTH).length) {
        return null;
    }
    const moved: string[] = [];
    for (let i = 0; i < TOKEN_BLOCKS; i++) {
        moved.push(single.slice(i * TOKEN_BLOCK_LENGTH, (i + 1) * TOKEN_BLOCK_LENGTH));
    }
    return { blocks: moved, clearOld: true };
}

/**
 * Describes the token for the log, without showing it.
 *
 * @param setting result of assembleToken
 */
export function tokenSummary(setting: TokenSetting): string {
    if (setting.source === "none") {
        return "token not set (read only)";
    }
    const from = setting.source === "blocks" ? "from the four fields" : "from the old token field";
    return setting.problem
        ? `token ${from} incomplete or wrong (read only)`
        : `token ${from} complete (${setting.token.length} characters)`;
}
