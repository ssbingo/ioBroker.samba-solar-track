/*
 * Commands to the device: automatic on/off, park, acknowledge and the manual drive (jog).
 * Pure logic without I/O: sending, timers and the clock come in from outside.
 *
 * Manual drive works with a dead man from end to end (rule F3 of the device):
 * - Whoever drives (a widget, a script) has to write the drive command again and again.
 * - While these writes keep coming, this class renews the command at the device every 300 ms.
 * - If the writes stop for more than a second, the drive is stopped here; if this adapter or the
 *   connection fails, the device stops by itself after one second without renewal.
 *
 * Log tags: [cmd] commands, [jog] manual drive.
 */
import type { ClientLogger, ClientTimers } from "./device-client";

/** Axis of the tracker */
export type Axis = "elevation" | "azimuth";

/** Direction: 1 = PLUS (up, east), -1 = MINUS (down, west), 0 = stop */
export type Direction = -1 | 0 | 1;

/** Commands of POST /api/command and the `cmd` frame */
export type Command = "auto" | "park" | "ack";

/** Result of a command */
export interface CommandResult {
    /** true = the device accepted the command */
    ok: boolean;
    /** Why not: a reason of the device (auth, locked, ...) or of this adapter (timeout, disconnected, ...) */
    reason?: string;
    /** Time until the answer in ms */
    durationMs: number;
}

/** Times in ms */
export interface RemoteTiming {
    /** The device has to answer a command within this time (it answers within 250 ms) */
    resultTimeoutMs: number;
    /** A running drive is renewed at the device this often (the device stops after 1000 ms without) */
    jogRenewMs: number;
    /** Without a new write for this time the drive is stopped (dead man) */
    jogHoldMs: number;
    /** After the start of a drive the status of the device is not evaluated for this time */
    jogGraceMs: number;
}

/** Default times */
export const DEFAULT_REMOTE_TIMING: RemoteTiming = {
    resultTimeoutMs: 2000,
    jogRenewMs: 300,
    jogHoldMs: 1000,
    jogGraceMs: 1500,
};

/** Reasons in plain words, for the log and for `control.lastResult` */
export const REASON_TEXT: Record<string, string> = {
    auth: "the token is missing or wrong",
    locked: "remote control is locked at the display",
    setup: "the setup of the device is not completed",
    state: "the state of the controller does not allow it",
    local: "someone is operating the display, the display has priority",
    range: "the value is outside the limits",
    unknown: "unknown command or axis",
    format: "malformed request",
    busy: "another connection is driving or the device was busy, try again",
    timeout: "the device did not answer in time",
    disconnected: "not connected to the device",
    protocol: "the device speaks a newer protocol, commands are disabled",
    unsupported: "the firmware does not support this command",
    hold: "the drive command was not renewed in time (dead man)",
    type: "the value has the wrong type",
    same: "the value is already valid",
    answer: "the answer of the device could not be read",
    device: "the device ended the drive",
};

/**
 * Text for a reason.
 *
 * @param reason reason code
 */
export function reasonText(reason: string | undefined): string {
    if (!reason) {
        return "";
    }
    return REASON_TEXT[reason] ?? reason;
}

/** Settings of the remote control */
export interface RemoteControlOptions {
    /**
     * Sends a frame to the device.
     *
     * @returns false when there is no connection
     */
    send(frame: Record<string, unknown>): boolean;
    /** Timers */
    timers: ClientTimers;
    /** Logger */
    log: ClientLogger;
    /**
     * A running drive has ended without a stop command from ioBroker.
     *
     * @param axis axis that was driving
     * @param reason why it ended (hold, device, disconnected or a reason of the device)
     */
    onJogEnd(axis: Axis, reason: string): void;
    /** Clock (tests) */
    now?: () => number;
    /** Other times than the default (tests) */
    timing?: Partial<RemoteTiming>;
}

interface Pending {
    resolve(result: CommandResult): void;
    timer: unknown;
    started: number;
    what: string;
}

interface Drive {
    axis: Axis;
    dir: Direction;
    /** Time of the last write from ioBroker */
    lastHold: number;
    started: number;
    confirmed: boolean;
}

/** Number of renewal ids remembered to recognise their rejection */
const RENEW_IDS_KEPT = 20;

/** Sends commands and keeps a manual drive alive */
export class RemoteControl {
    private readonly timing: RemoteTiming;
    private readonly now: () => number;
    private readonly pending = new Map<number, Pending>();
    private renewIds: number[] = [];
    /** Ids of stops sent without waiting for the answer */
    private releaseIds: number[] = [];
    private nextId = 1;
    private drive: Drive | undefined;
    private renewTimer: unknown;

    /**
     * @param options settings
     */
    public constructor(private readonly options: RemoteControlOptions) {
        this.timing = { ...DEFAULT_REMOTE_TIMING, ...options.timing };
        this.now = options.now ?? ((): number => Date.now());
    }

    /** The drive that is running, if any */
    public get jogging(): { axis: Axis; dir: Direction } | undefined {
        return this.drive ? { axis: this.drive.axis, dir: this.drive.dir } : undefined;
    }

    /**
     * Sends a command and waits for the answer of the device.
     *
     * @param cmd the command
     * @param on value for `auto` and `park`
     * @param source who gave the command, for the log
     */
    public command(cmd: Command, on: boolean | undefined, source: string): Promise<CommandResult> {
        const frame: Record<string, unknown> = { t: "cmd", cmd };
        if (cmd !== "ack") {
            frame.on = on === true;
        }
        return this.request(frame, `${cmd}${cmd === "ack" ? "" : ` on=${on === true}`}`, source, "[cmd]");
    }

    /**
     * Starts, renews or stops a manual drive. Has to be called again at least once per second
     * while the drive shall continue.
     *
     * @param axis axis to drive
     * @param dir direction, 0 = stop
     * @param source who gave the command, for the log
     */
    public async jog(axis: Axis, dir: Direction, source: string): Promise<CommandResult> {
        const { log } = this.options;
        const drive = this.drive;
        if (dir === 0) {
            if (!drive || drive.axis !== axis) {
                log.debug(`[jog] Stop for ${axis} skipped: no drive is running on this axis`);
                return { ok: true, durationMs: 0 };
            }
            this.clearDrive();
            log.debug(`[jog] Stop ${axis} after ${this.now() - drive.started} ms from ${source}`);
            return this.request({ t: "jog", axis, dir: 0 }, `jog ${axis} stop`, source, "[jog]");
        }
        if (drive && drive.axis === axis && drive.dir === dir) {
            drive.lastHold = this.now();
            log.silly(`[jog] ${axis} ${dir} held by ${source}`);
            return { ok: true, durationMs: 0 };
        }
        if (drive) {
            log.debug(`[jog] ${drive.axis} ${drive.dir} is replaced by ${axis} ${dir}`);
            this.clearDrive();
        }
        const started = this.now();
        const mine: Drive = { axis, dir, lastHold: started, started, confirmed: false };
        this.drive = mine;
        this.scheduleRenew();
        const result = await this.request({ t: "jog", axis, dir }, `jog ${axis} ${dir}`, source, "[jog]");
        if (this.drive !== mine) {
            // stopped or replaced while waiting for the answer
            return result;
        }
        if (result.ok) {
            mine.confirmed = true;
        } else {
            this.clearDrive();
            // the device refuses further drive commands of this connection until it gets a stop
            this.release(axis);
        }
        return result;
    }

    /**
     * Handles a `result` frame of the device.
     *
     * @param id id of the command, null when the device could not read it
     * @param ok true = accepted
     * @param reason why not
     */
    public handleResult(id: number | null, ok: boolean, reason: string | undefined): void {
        const { log } = this.options;
        if (id !== null) {
            const pending = this.pending.get(id);
            if (pending) {
                this.pending.delete(id);
                this.options.timers.clear(pending.timer);
                pending.resolve({
                    ok,
                    reason: ok ? undefined : (reason ?? "unknown"),
                    durationMs: this.now() - pending.started,
                });
                return;
            }
            if (this.renewIds.includes(id)) {
                if (!ok) {
                    this.endedByDevice(reason ?? "device", `renewal #${id} rejected`);
                }
                return;
            }
            if (this.releaseIds.includes(id)) {
                this.releaseIds = this.releaseIds.filter(known => known !== id);
                log.debug(`[jog] #${id} stop ${ok ? "confirmed" : `refused: ${reason ?? "unknown"}`}`);
                return;
            }
        }
        log.debug(`[cmd] Result for unknown id ${String(id)} ignored (ok=${ok}${reason ? `, ${reason}` : ""})`);
    }

    /**
     * Evaluates the status of the device: a drive the device no longer reports has ended.
     *
     * @param jogActive `jog.active` of the status
     */
    public handleStatus(jogActive: boolean): void {
        const drive = this.drive;
        if (!drive || !drive.confirmed || jogActive) {
            return;
        }
        if (this.now() - drive.started < this.timing.jogGraceMs) {
            return;
        }
        this.endedByDevice("device", "the status reports no drive");
    }

    /** The connection to the device is lost: nothing can be confirmed any more */
    public handleDisconnect(): void {
        const drive = this.drive;
        this.clearDrive();
        this.failPending("disconnected");
        if (drive) {
            this.options.log.debug(
                `[jog] ${drive.axis} ${drive.dir} ended: connection lost (the device stops by itself)`,
            );
            this.options.onJogEnd(drive.axis, "disconnected");
        }
    }

    /** Stops everything: a running drive gets its stop command, timers are cleared */
    public stop(): void {
        const drive = this.drive;
        this.clearDrive();
        if (drive) {
            this.options.log.debug(`[jog] ${drive.axis} ${drive.dir} stopped: the adapter is stopping`);
            this.release(drive.axis);
        }
        this.failPending("disconnected");
    }

    private failPending(reason: string): void {
        for (const [id, pending] of this.pending) {
            this.options.timers.clear(pending.timer);
            pending.resolve({ ok: false, reason, durationMs: this.now() - pending.started });
            this.options.log.debug(`[cmd] #${id} ${pending.what}: no answer, ${reasonText(reason)}`);
        }
        this.pending.clear();
    }

    private request(frame: Record<string, unknown>, what: string, source: string, tag: string): Promise<CommandResult> {
        const { log, send, timers } = this.options;
        const id = this.nextId++;
        const started = this.now();
        if (!send({ ...frame, id })) {
            log.debug(`${tag} #${id} ${what} from ${source} not sent: ${reasonText("disconnected")}`);
            return Promise.resolve({ ok: false, reason: "disconnected", durationMs: 0 });
        }
        log.debug(`${tag} #${id} ${what} from ${source} sent`);
        return new Promise<CommandResult>(resolve => {
            const timer = timers.set(() => {
                if (this.pending.delete(id)) {
                    resolve({ ok: false, reason: "timeout", durationMs: this.now() - started });
                }
            }, this.timing.resultTimeoutMs);
            this.pending.set(id, { resolve, timer, started, what });
        }).then(result => {
            log.debug(
                result.ok
                    ? `${tag} #${id} ${what} confirmed after ${result.durationMs} ms`
                    : `${tag} #${id} ${what} failed after ${result.durationMs} ms: ${result.reason} (${reasonText(result.reason)})`,
            );
            return result;
        });
    }

    /**
     * Sends a stop without waiting for the answer.
     *
     * @param axis axis to stop
     */
    private release(axis: Axis): void {
        const id = this.nextId++;
        if (this.options.send({ t: "jog", axis, dir: 0, id })) {
            this.releaseIds.push(id);
            if (this.releaseIds.length > RENEW_IDS_KEPT) {
                this.releaseIds.shift();
            }
            this.options.log.debug(`[jog] #${id} stop for ${axis} sent`);
        }
    }

    private clearDrive(): void {
        this.drive = undefined;
        this.renewIds = [];
        if (this.renewTimer !== undefined) {
            this.options.timers.clear(this.renewTimer);
            this.renewTimer = undefined;
        }
    }

    private endedByDevice(reason: string, detail: string): void {
        const drive = this.drive;
        if (!drive) {
            return;
        }
        this.clearDrive();
        this.options.log.debug(
            `[jog] ${drive.axis} ${drive.dir} ended by the device after ${this.now() - drive.started} ms: ` +
                `${reason} (${reasonText(reason)}; ${detail})`,
        );
        this.release(drive.axis);
        this.options.onJogEnd(drive.axis, reason);
    }

    private scheduleRenew(): void {
        this.renewTimer = this.options.timers.set(() => {
            this.renewTimer = undefined;
            const drive = this.drive;
            if (!drive) {
                return;
            }
            const silent = this.now() - drive.lastHold;
            if (silent > this.timing.jogHoldMs) {
                this.clearDrive();
                this.options.log.debug(
                    `[jog] ${drive.axis} ${drive.dir} stopped: not renewed for ${silent} ms (limit ${this.timing.jogHoldMs} ms)`,
                );
                this.release(drive.axis);
                this.options.onJogEnd(drive.axis, "hold");
                return;
            }
            const id = this.nextId++;
            if (this.options.send({ t: "jog", axis: drive.axis, dir: drive.dir, id })) {
                this.renewIds.push(id);
                if (this.renewIds.length > RENEW_IDS_KEPT) {
                    this.renewIds.shift();
                }
                this.options.log.silly(`[jog] #${id} renewal ${drive.axis} ${drive.dir}`);
            }
            this.scheduleRenew();
        }, this.timing.jogRenewMs);
    }
}
