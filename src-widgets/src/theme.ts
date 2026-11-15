/*
 * Colours of the Samba Solar Track widgets, taken from the theme of vis-2 only (`this.props.context.theme`), so
 * the light and the dark theme of vis-2 apply. Nothing here is a fixed colour of the device design.
 *
 * The status band keeps the meaning of the colours of the display (`pal()` of the firmware) but maps them to the
 * MUI palette: running/manual = info, automatic aligned = success, tracking = warning, fault/storm = error,
 * setup/sun sensor = secondary, night/park = dark grey, not connected/ready = grey.
 */
import { alpha, type Theme } from "@mui/material";

/** Meaning of a colour of the status band, as `pal()` of the display names it */
export type BandColor = "blue" | "green" | "orange" | "red" | "gray" | "night" | "violet";

/** Background and text colour of a status band */
export interface BandPaint {
    bg: string;
    fg: string;
}

/**
 * Background and text colour of the status band from the palette of the theme.
 *
 * @param theme - the theme of vis-2
 * @param color - meaning of the colour
 */
export function bandPaint(theme: Theme, color: BandColor): BandPaint {
    const p = theme.palette;
    const from = (bg: string): BandPaint => ({ bg, fg: p.getContrastText(bg) });
    switch (color) {
        case "blue":
            return { bg: p.info.main, fg: p.info.contrastText };
        case "green":
            return { bg: p.success.main, fg: p.success.contrastText };
        case "orange":
            return { bg: p.warning.main, fg: p.warning.contrastText };
        case "red":
            return { bg: p.error.main, fg: p.error.contrastText };
        case "violet":
            return { bg: p.secondary.main, fg: p.secondary.contrastText };
        case "night":
            return from(p.grey[800]);
        default:
            return from(p.grey[p.mode === "dark" ? 600 : 500]);
    }
}

/**
 * Text colour for labels and secondary values. `text.secondary` cannot be used: the dark themes of ioBroker set it
 * to the same white as `text.primary`.
 *
 * @param theme - the theme of vis-2
 */
export function mutedText(theme: Theme): string {
    return alpha(theme.palette.text.primary, 0.68);
}

/**
 * Background of a tile inside the card (a light tint of the text colour, works on light and dark cards).
 *
 * @param theme - the theme of vis-2
 */
export function tileBackground(theme: Theme): string {
    return alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.07 : 0.045);
}

/** Text colour of a good, a bad and a warning value */
export function stateText(theme: Theme, kind: "ok" | "bad" | "warn" | ""): string | undefined {
    const p = theme.palette;
    const dark = p.mode === "dark";
    if (kind === "ok") {
        return dark ? p.success.light : p.success.dark;
    }
    if (kind === "bad") {
        return dark ? p.error.light : p.error.dark;
    }
    if (kind === "warn") {
        return dark ? p.warning.light : p.warning.dark;
    }
    return undefined;
}

/**
 * Colour of the sun (dot, arc of the day), the accent of the widgets.
 *
 * @param theme - the theme of vis-2
 */
export function sunColor(theme: Theme): string {
    return theme.palette.mode === "dark" ? theme.palette.warning.light : theme.palette.warning.main;
}
