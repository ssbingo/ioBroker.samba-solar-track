/*
 * When the widgets refuse a command, before the device does (rules F2, F3, F4 of the firmware project).
 * The device checks every command itself; the widget only greys out what would be refused anyway and says why.
 */

/** Reads the values of the subscribed states */
export interface LockValues {
    num(id: string): number | null;
    str(id: string): string;
    flag(id: string): boolean | null;
}

/** Result: the i18n key of the reason, or undefined = allowed */
export interface Lock {
    reason?: string;
}

/** States the locks read */
export const LOCK_IDS = [
    "info.connection",
    "status.remoteLocked",
    "status.state",
    "status.setupDone",
    "status.stormActive",
    "commissioning.done",
    "update.active",
];

/**
 * Every command: no connection, "remote control locked" at the display (F4) or an update in progress.
 *
 * @param v - values
 */
export function remoteLock(v: LockValues): Lock {
    if (v.flag("info.connection") !== true) {
        return { reason: "lock_offline" };
    }
    if (v.flag("status.remoteLocked") === true) {
        return { reason: "lock_remote" };
    }
    if (v.flag("update.active") === true) {
        return { reason: "lock_update" };
    }
    return {};
}

/**
 * Drive commands (manual drive, angles, park, reset of the synchronous control): additionally locked during the
 * storm protection, without completed setup and without completed setup program.
 *
 * @param v - values
 */
export function driveLock(v: LockValues): Lock {
    const remote = remoteLock(v);
    if (remote.reason) {
        return remote;
    }
    if (v.flag("status.stormActive") === true || v.str("status.state") === "STORM") {
        return { reason: "lock_storm" };
    }
    if (v.str("status.state") === "SETUP" || v.flag("status.setupDone") === false) {
        return { reason: "lock_setup" };
    }
    // missing with firmware before 0.7.0: then there is no setup program and nothing is locked
    if (v.flag("commissioning.done") === false || v.str("status.state") === "COMMISSION") {
        return { reason: "lock_commission" };
    }
    return {};
}

/**
 * Cardinal direction of a wind direction.
 *
 * @param deg - direction in degrees, 0 = north
 * @param names - the eight names N, NE, E, SE, S, SW, W, NW, separated by commas (translated)
 */
export function compass(deg: number, names: string): string {
    const list = names.split(",");
    const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
    return list[i] ?? "";
}
