/*
 * Text and colour of the status band, as the display shows them (updateStatus() of the firmware, rule U3):
 * one text per state of the controller, the same colours, "SIM:" in front during the simulation.
 * The widget only knows what the adapter reports, so it derives "a drive is moving" from the outputs of the axes.
 */
import { mmss } from "./common";
import type { BandColor } from "./theme";

/** States of the adapter the status band reads */
export const BAND_IDS = [
    "info.connection",
    "info.simulation",
    "status.state",
    "status.stormRemaining",
    "status.faultIo",
    "status.faultMotor",
    "status.park",
    "io.relayOk",
    "wind.ok",
    "supply.sensorFault",
    "axes.elevation.output",
    "axes.azimuth.output",
    "axes.elevation.flatDirection",
    "axes.elevation.fault",
    "axes.elevation.angle",
    "axes.elevation.syncResetPhase",
    "axes.azimuth.syncResetPhase",
    "position.target",
    "position.phase",
    "position.angle",
    "position.known",
    "position.source",
    "sunPosition.astroTarget",
    "update.active",
    "update.percent",
];

/** Reads the values of the subscribed states */
export interface BandValues {
    num(id: string): number | null;
    str(id: string): string;
    flag(id: string): boolean | null;
}

/** Text and colour of the band */
export interface Band {
    /** text, already translated */
    text: string;
    /** colour */
    color: BandColor;
}

/** Translates a key and fills in its placeholders */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

/**
 * Direction of the elevation as the display names it.
 *
 * @param out - output of the elevation: 1 = PLUS, -1 = MINUS
 * @param flatDir - `axes.elevation.flatDirection`: 1 = PLUS is flatter (default), -1 = MINUS is flatter
 * @returns true = steeper
 */
export function elevationSteeper(out: number, flatDir: number | null): boolean {
    const flat = flatDir === -1 ? -1 : 1;
    return out !== flat;
}

/**
 * Text and colour of the status band.
 *
 * @param v - values of the states
 * @param t - translation
 */
export function statusBand(v: BandValues, t: Translate): Band {
    const band = core(v, t);
    return v.flag("info.simulation") === true ? { ...band, text: t("band_sim", { text: band.text }) } : band;
}

function core(v: BandValues, t: Translate): Band {
    if (v.flag("info.connection") !== true) {
        return { text: t("band_offline"), color: "gray" };
    }
    if (v.flag("update.active") === true) {
        return { text: t("band_update", { percent: v.num("update.percent") ?? 0 }), color: "blue" };
    }
    const state = v.str("status.state");
    const elOut = v.num("axes.elevation.output") ?? 0;
    const azOut = v.num("axes.azimuth.output") ?? 0;
    const moving = elOut !== 0 || azOut !== 0;
    const flatDir = v.num("axes.elevation.flatDirection");

    // a reset of the synchronous control replaces the texts below setup, fault and storm
    if (state !== "SETUP" && state !== "FAULT" && state !== "STORM") {
        const running = (phase: string): boolean => phase === "wait" || phase === "pulse" || phase === "run";
        if (running(v.str("axes.elevation.syncResetPhase"))) {
            return { text: t("band_syncreset_elevation"), color: "blue" };
        }
        if (running(v.str("axes.azimuth.syncResetPhase"))) {
            return { text: t("band_syncreset_azimuth"), color: "blue" };
        }
    }

    const dirText = (): string => {
        if (elOut !== 0) {
            return elevationSteeper(elOut, flatDir) ? t("dir_steeper") : t("dir_flatter");
        }
        return azOut > 0 ? t("dir_east") : t("dir_west");
    };

    switch (state) {
        case "SETUP":
            return { text: t("band_setup"), color: "violet" };
        case "FAULT":
            if (v.flag("status.faultIo") === true || v.flag("io.relayOk") === false) {
                return { text: t("band_fault_io"), color: "red" };
            }
            return {
                text: v.flag("axes.elevation.fault") === false ? t("band_fault_azimuth") : t("band_fault_elevation"),
                color: "red",
            };
        case "STORM":
            return moving
                ? { text: t("band_storm_moving"), color: "red" }
                : { text: t("band_storm_parked", { time: mmss(v.num("status.stormRemaining")) }), color: "red" };
        case "MANUAL":
            if (moving) {
                return { text: t("band_manual_moving", { dir: dirText() }), color: "blue" };
            }
            if (v.flag("wind.ok") === false) {
                return { text: t("band_manual_nowind"), color: "red" };
            }
            return { text: t("band_manual_ready"), color: "gray" };
        case "PARK":
            return { text: moving ? t("band_park_moving") : t("band_park_parked"), color: "night" };
        case "WINDFAULT":
            return { text: moving ? t("band_windfault_moving") : t("band_windfault_parked"), color: "red" };
        case "SENSOR":
            return {
                text: v.flag("supply.sensorFault") === true ? t("band_sensor_supply") : t("band_sensor_fault"),
                color: "violet",
            };
        case "NIGHT":
            if (elOut !== 0) {
                return { text: t("band_night_flat"), color: "night" };
            }
            return { text: azOut !== 0 ? t("band_night_east") : t("band_night_rest"), color: "night" };
        case "COMMISSION":
            return { text: t("band_commission"), color: "violet" };
        case "ASTRO": {
            const phase = v.str("position.phase");
            const target = v.num("sunPosition.astroTarget");
            if (phase === "nocal") {
                return { text: t("band_astro_nocal"), color: "blue" };
            }
            if (phase === "hallfault") {
                return { text: t("band_astro_hallfault"), color: "blue" };
            }
            return moving
                ? { text: t("band_astro_moving", { deg: target ?? "–" }), color: "blue" }
                : { text: t("band_astro_hold", { deg: target ?? "–" }), color: "blue" };
        }
        case "IDLE":
            return { text: t("band_idle"), color: "green" };
        case "TRACKING": {
            const axis =
                elOut !== 0
                    ? t("band_tracking_elevation", { dir: dirText() })
                    : azOut !== 0
                      ? t("band_tracking_azimuth", { dir: dirText() })
                      : t("band_tracking");
            return { text: axis, color: "orange" };
        }
        case "SETTLING":
            return { text: t("band_settling"), color: "green" };
        case "POSITION":
            return { text: positionText(v, t, elOut, flatDir), color: "night" };
        default:
            return { text: state ? state : "–", color: "gray" };
    }
}

/** Status band in the state POSITION, one text per phase as at the display */
function positionText(v: BandValues, t: Translate, elOut: number, flatDir: number | null): string {
    const target = v.num("position.target");
    const deg = target ?? 0;
    const end = deg === 0 || deg >= 60;
    const angle = v.num("position.angle") ?? v.num("axes.elevation.angle");
    const known = v.flag("position.known") === true && angle !== null;
    const measured = v.str("position.source") === "hall";
    const est = known ? (measured ? `${angle}°` : t("approx_deg", { deg: angle })) : t("unknown");
    switch (v.str("position.phase")) {
        case "reference":
            return t("band_pos_reference", { deg });
        case "move": {
            if (end) {
                return deg === 0 ? t("band_pos_move_flat") : t("band_pos_move_steep", { deg });
            }
            const steeper = elOut !== 0 ? elevationSteeper(elOut, flatDir) : angle !== null && deg > angle;
            return t("band_pos_move", { deg, dir: steeper ? t("dir_steeper") : t("dir_flatter"), est });
        }
        case "hold":
            if (deg === 0) {
                return t("band_pos_hold_flat");
            }
            if (end) {
                return t("band_pos_hold_steep", { deg });
            }
            return known ? t("band_pos_hold", { est }) : t("band_pos_hold_unknown", { deg });
        case "nocal":
            return t("band_pos_nocal", { deg });
        case "hallfault":
            return t("band_pos_hallfault", { deg });
        default:
            return t("band_pos", { deg });
    }
}
