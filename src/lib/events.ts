/*
 * Events worth a notification, found by comparing the status of the device with the one before.
 * Pure logic, no I/O.
 */
import { readPath, type DeviceStatus } from "./protocol";

/** Kinds of events the user can switch on and off */
export const EVENT_CATEGORIES = ["storm", "fault", "wind", "sensor", "connection", "restart"] as const;

/** Kind of event */
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** An event with the key of its text and the values for the placeholders */
export interface DeviceEvent {
    /** Kind of event */
    category: EventCategory;
    /** Key of the text in notifications.ts */
    key: string;
    /** Values for the placeholders of the text */
    params: Record<string, string | number>;
}

interface Snapshot {
    storm: boolean;
    faultIo: boolean;
    faultMotor: boolean;
    windOk: boolean;
    sunOk: boolean;
}

/**
 * Reads a yes/no value from the status.
 *
 * @param status the status
 * @param path path of the value
 * @param fallback value when the status does not contain it
 */
function flag(status: DeviceStatus, path: string, fallback: boolean): boolean {
    const value = readPath(status, path);
    return typeof value === "boolean" ? value : fallback;
}

/**
 * Formats a wind speed with one decimal.
 *
 * @param value the speed, anything else gives "?"
 */
function speed(value: unknown): string {
    return typeof value === "number" ? value.toFixed(1) : "?";
}

/** Finds the events between two status reports of the device */
export class EventDetector {
    private previous: Snapshot | undefined;

    /**
     * Compares a status with the one before.
     *
     * @param status the new status
     * @returns the events; none for the very first status, which only sets the starting point
     */
    public update(status: DeviceStatus): DeviceEvent[] {
        const now: Snapshot = {
            storm: flag(status, "storm.active", false),
            faultIo: flag(status, "fault.io", false),
            faultMotor: flag(status, "fault.motor", false),
            windOk: flag(status, "wind.ok", true),
            sunOk: flag(status, "sun.ok", true),
        };
        const before = this.previous;
        this.previous = now;
        if (!before) {
            return [];
        }
        const events: DeviceEvent[] = [];
        if (now.storm && !before.storm) {
            events.push({
                category: "storm",
                key: "stormStarted",
                params: {
                    gust: speed(readPath(status, "wind.gustKmh")),
                    threshold: speed(readPath(status, "wind.stormKmh")),
                },
            });
        } else if (!now.storm && before.storm) {
            events.push({ category: "storm", key: "stormEnded", params: {} });
        }
        if (now.faultIo && !before.faultIo) {
            events.push({ category: "fault", key: "faultIo", params: {} });
        }
        if (now.faultMotor && !before.faultMotor) {
            const axes = ["elevation", "azimuth"].filter(axis => readPath(status, `axes.${axis}.fault`) === true);
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
