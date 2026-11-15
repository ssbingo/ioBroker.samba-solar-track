import type { RxWidgetInfoAttributesField, RxWidgetInfoGrid } from "@iobroker/types-vis-2";

import translations from "./translations";

/** Name of the adapter; the widgets subscribe to the states below `<ADAPTER>.<instance>.` */
export const ADAPTER = "samba-solar-track";

/** Name of the widget set (key in common.visWidgets of io-package.json) */
export const VIS_SET = "samba-solar-track";

/**
 * Translates a widget i18n key outside of a widget (where the widget's own `t()` is not available), using the
 * shared i18n JSONs and the ioBroker UI language, falling back to English.
 *
 * @param key - the i18n key
 */
export function tr(key: string): string {
    const lang = (typeof window !== "undefined" && (window as { systemLang?: string }).systemLang) || "en";
    // `translations` also carries a `prefix: boolean` flag, so go through `unknown` for the lookup cast.
    const langs = translations as unknown as Record<string, Record<string, string> | undefined>;
    return langs[lang]?.[key] || langs.en?.[key] || key;
}

/**
 * Extracts the plain instance number from either "0" or "samba-solar-track.0".
 *
 * @param rx - the widget data
 * @param rx.instance - the instance attribute
 */
export function instanceNumber(rx: { instance?: string }): string {
    const raw = rx?.instance !== undefined && rx.instance !== "" ? String(rx.instance) : "0";
    return raw.split(".").pop() || "0";
}

/**
 * The object id prefix of the chosen adapter instance, e.g. `samba-solar-track.0`. Every widget derives its
 * concrete OIDs by appending the state id below the instance (e.g. `${prefix}.wind.speed`).
 *
 * @param rx - the widget data
 * @param rx.instance - the instance attribute
 */
export function instancePrefix(rx: { instance?: string }): string {
    return `${ADAPTER}.${instanceNumber(rx)}`;
}

/**
 * The shared "common" attribute group used by every widget of the set: adapter instance, card on/off and the
 * title of the card - the fields `noCard` and `widgetTitle` as in vis-2-widgets-material (title hidden without card).
 */
export function sstCommonGroup(): { name: string; fields: RxWidgetInfoAttributesField[] } {
    return {
        name: "common",
        fields: [
            {
                name: "instance",
                type: "instance",
                label: "instance",
                adapter: ADAPTER,
                isShort: true,
                default: "0",
            },
            {
                name: "noCard",
                type: "checkbox",
                label: "no_card",
                default: false,
                noBinding: false,
            },
            {
                name: "widgetTitle",
                label: "widget_title",
                hidden: "data.noCard === true",
            },
        ] as RxWidgetInfoAttributesField[],
    };
}

/**
 * Grid of a section (vis-2 2.20): how many cells the widget takes and its smallest size there.
 *
 * @param columns - columns of 12 per section column
 * @param rows - rows
 */
export function sstGrid(columns: number, rows: number): RxWidgetInfoGrid {
    return {
        columns,
        rows,
        minColumns: Math.max(3, Math.round(columns * 0.6)),
        minRows: Math.max(2, Math.round(rows * 0.6)),
    };
}

/**
 * Removes a leading marker (●, ✔) of a text that the widgets now show as a coloured chip.
 *
 * @param text - the translated text
 */
export function plain(text: string): string {
    return text.replace(/^[●✔]\s*/u, "");
}

/**
 * Replaces the placeholders `{name}` of a text.
 *
 * @param text - the text with placeholders
 * @param params - the values
 */
export function fill(text: string, params: Record<string, string | number>): string {
    return text.replace(/\{(\w+)\}/g, (all, name: string) => (name in params ? String(params[name]) : all));
}

/**
 * Formats a number with a fixed count of decimals, or "–" when there is no value.
 *
 * @param value - the value, null = unknown
 * @param decimals - decimals
 */
export function fmt(value: number | null | undefined, decimals = 0): string {
    return value === null || value === undefined || Number.isNaN(value) ? "–" : value.toFixed(decimals);
}

/**
 * Formats a time of day (local time of the browser) as HH:MM, or "–".
 *
 * @param ms - time in ms since 1970
 */
export function clock(ms: number | null | undefined): string {
    if (ms === null || ms === undefined || !Number.isFinite(ms) || ms <= 0) {
        return "–";
    }
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Formats a remaining time in seconds as MM:SS, as the status band of the display does.
 *
 * @param seconds - the remaining time
 */
export function mmss(seconds: number | null | undefined): string {
    const s = Math.max(0, Math.floor(seconds ?? 0));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Parses a JSON state value; returns the fallback for missing or broken values.
 *
 * @param value - the state value
 * @param fallback - returned for anything that is not valid JSON of the expected kind
 */
export function parseJson<T>(value: unknown, fallback: T): T {
    if (typeof value !== "string" || !value.trim()) {
        return fallback;
    }
    try {
        const parsed = JSON.parse(value) as unknown;
        return parsed === null || parsed === undefined ? fallback : (parsed as T);
    } catch {
        return fallback;
    }
}
