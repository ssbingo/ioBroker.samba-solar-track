/*
 * Messages (log lines) of the device: time of each line, history, sequence numbers.
 * Pure logic, no I/O. Time comes in as a parameter.
 */
import type { LogLine } from "./protocol";

/** Levels of the firmware, most important first */
export const DEVICE_LEVELS = ["E", "W", "I", "D", "V"] as const;

/** Level of the firmware */
export type DeviceLevel = (typeof DEVICE_LEVELS)[number];

/** Setting "forward messages to the ioBroker log from this level": a device level or "off" */
export type ForwardLevel = DeviceLevel | "off";

/** Level of the ioBroker log */
export type HostLevel = "warn" | "info" | "debug" | "silly";

/** A message with its time of day */
export interface Message {
    /** Time of the message in ms since 1970, calculated from the uptime of the device */
    ts: number;
    /** Sequence number */
    seq: number;
    /** Level: E, W, I, D or V */
    lvl: string;
    /** Module of the firmware */
    tag: string;
    /** Text */
    msg: string;
}

/** What `MessageStore.add` found out about a line */
export interface AddResult {
    /** The message with its time, undefined for a line that was already received */
    message?: Message;
    /** Number of lines missing between the previous line and this one */
    gap: number;
}

/**
 * Rank of a level, 0 = error. Unknown levels count as info.
 *
 * @param lvl level of the firmware
 */
function rank(lvl: string): number {
    const index = DEVICE_LEVELS.indexOf(lvl as DeviceLevel);
    return index < 0 ? DEVICE_LEVELS.indexOf("I") : index;
}

/**
 * Decides whether a line is forwarded to the ioBroker log.
 *
 * @param lvl level of the line
 * @param threshold lines from this level on are forwarded
 */
export function shouldForward(lvl: string, threshold: ForwardLevel): boolean {
    return threshold !== "off" && rank(lvl) <= rank(threshold);
}

/**
 * Level of the ioBroker log for a line of the device. Errors of the device are warnings here:
 * `error` is reserved for problems that stop the adapter itself.
 *
 * @param lvl level of the line
 */
export function hostLevel(lvl: string): HostLevel {
    switch (lvl) {
        case "E":
        case "W":
            return "warn";
        case "D":
            return "debug";
        case "V":
            return "silly";
        default:
            return "info";
    }
}

/**
 * true for warnings and errors of the device.
 *
 * @param lvl level of the line
 */
export function isFault(lvl: string): boolean {
    return lvl === "E" || lvl === "W";
}

/**
 * Text of a message for one line.
 *
 * @param message the message
 */
export function formatMessage(message: Message): string {
    return `[${message.lvl}][${message.tag}] ${message.msg}`;
}

/** Keeps the latest messages and the position in the message stream of the device */
export class MessageStore {
    private readonly history: Message[] = [];
    private currentBootId: string | undefined;
    private currentLastSeq = 0;
    private lostCount = 0;

    /**
     * @param limit number of messages kept in the history
     */
    public constructor(private readonly limit: number) {}

    /** Boot id the sequence numbers belong to */
    public get bootId(): string | undefined {
        return this.currentBootId;
    }

    /** Sequence number of the last received message, 0 = none */
    public get lastSeq(): number {
        return this.currentLastSeq;
    }

    /** Messages lost since this store was created */
    public get lost(): number {
        return this.lostCount;
    }

    /** Messages, newest first */
    public get messages(): readonly Message[] {
        return this.history;
    }

    /**
     * Restores the position known from the last run of the adapter.
     *
     * @param bootId boot id of the device
     * @param lastSeq last received sequence number
     * @param history messages, newest first
     */
    public restore(bootId: string | undefined, lastSeq: number, history: Message[]): void {
        this.currentBootId = bootId;
        this.currentLastSeq = lastSeq > 0 ? lastSeq : 0;
        this.history.length = 0;
        this.history.push(...history.slice(0, this.limit));
    }

    /**
     * Tells the store which start of the device the following lines belong to.
     *
     * @param bootId boot id of the device
     * @returns true when the device has restarted (sequence numbers start again)
     */
    public setBootId(bootId: string): boolean {
        if (bootId === this.currentBootId) {
            return false;
        }
        const restarted = this.currentBootId !== undefined;
        this.currentBootId = bootId;
        this.currentLastSeq = 0;
        return restarted;
    }

    /**
     * Counts messages the device reported as lost.
     *
     * @param count number of lost messages
     * @param to last lost sequence number
     */
    public addLost(count: number, to: number): void {
        this.lostCount += count;
        if (to > this.currentLastSeq) {
            this.currentLastSeq = to;
        }
    }

    /**
     * Adds a line.
     *
     * @param line the line of the device
     * @param bootEpoch time of the start of the device in ms since 1970 (now minus uptime)
     */
    public add(line: LogLine, bootEpoch: number): AddResult {
        if (line.seq <= this.currentLastSeq) {
            // already received (the device repeats lines after a reconnect)
            return { gap: 0 };
        }
        const gap = this.currentLastSeq > 0 ? line.seq - this.currentLastSeq - 1 : 0;
        this.lostCount += gap;
        this.currentLastSeq = line.seq;
        const message: Message = {
            ts: Math.round(bootEpoch + line.ms),
            seq: line.seq,
            lvl: line.lvl,
            tag: line.tag,
            msg: line.msg,
        };
        this.history.unshift(message);
        if (this.history.length > this.limit) {
            this.history.length = this.limit;
        }
        return { message, gap };
    }
}

/**
 * Reads a history saved in a state. Broken content gives an empty history.
 *
 * @param json content of the state
 */
export function parseHistory(json: unknown): Message[] {
    if (typeof json !== "string" || !json) {
        return [];
    }
    try {
        const parsed: unknown = JSON.parse(json);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter(
            (m): m is Message =>
                typeof m === "object" &&
                m !== null &&
                typeof (m as Message).ts === "number" &&
                typeof (m as Message).seq === "number" &&
                typeof (m as Message).lvl === "string" &&
                typeof (m as Message).tag === "string" &&
                typeof (m as Message).msg === "string",
        );
    } catch {
        return [];
    }
}
