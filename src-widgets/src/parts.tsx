/*
 * Small building blocks of the widgets, made of MUI components and sized in em (the content scales with the
 * widget). Colours come from the theme of vis-2 only.
 */
import React from "react";

import { Box, Typography, type SxProps, type Theme } from "@mui/material";

import { bandPaint, mutedText, tileBackground, type BandColor } from "./theme";

/** A tile inside the card */
export function Tile(props: {
    theme: Theme;
    children: React.ReactNode;
    sx?: SxProps<Theme>;
    title?: string;
}): React.JSX.Element {
    return (
        <Box
            title={props.title}
            sx={[
                {
                    bgcolor: tileBackground(props.theme),
                    borderRadius: `${props.theme.shape.borderRadius}px`,
                    padding: "0.5em 0.65em",
                    minWidth: 0,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                },
                ...(Array.isArray(props.sx) ? props.sx : props.sx ? [props.sx] : []),
            ]}
        >
            {props.children}
        </Box>
    );
}

/** Label of a tile or a row (small, upper case, muted) */
export function Label(props: { theme: Theme; children: React.ReactNode; sx?: SxProps<Theme> }): React.JSX.Element {
    return (
        <Typography
            component="div"
            sx={[
                {
                    fontSize: "0.72em",
                    fontWeight: 500,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: mutedText(props.theme),
                    lineHeight: 1.3,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                },
                ...(Array.isArray(props.sx) ? props.sx : props.sx ? [props.sx] : []),
            ]}
        >
            {props.children}
        </Typography>
    );
}

/** One line of text that ends with an ellipsis instead of breaking the layout */
export function Line(props: {
    children: React.ReactNode;
    size?: string;
    weight?: number;
    color?: string;
    title?: string;
}): React.JSX.Element {
    return (
        <Typography
            component="div"
            title={props.title}
            sx={{
                fontSize: props.size ?? "0.85em",
                fontWeight: props.weight ?? 400,
                color: props.color,
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
            }}
        >
            {props.children}
        </Typography>
    );
}

/** The status band: text in the colour of the state, an optional button on the right */
export function StatusBand(props: {
    theme: Theme;
    color: BandColor;
    text: string;
    action?: React.ReactNode;
}): React.JSX.Element {
    const paint = bandPaint(props.theme, props.color);
    return (
        <Box
            role="status"
            aria-live="polite"
            sx={{
                bgcolor: paint.bg,
                color: paint.fg,
                borderRadius: `${props.theme.shape.borderRadius}px`,
                padding: "0.45em 0.75em",
                minHeight: "2.4em",
                display: "flex",
                alignItems: "center",
                gap: "0.6em",
                flex: "0 0 auto",
                transition: "background-color .3s",
                "@media (prefers-reduced-motion: reduce)": { transition: "none" },
            }}
        >
            <Typography
                component="div"
                title={props.text}
                sx={{
                    flex: "1 1 auto",
                    minWidth: 0,
                    fontSize: "0.9em",
                    fontWeight: 500,
                    lineHeight: 1.25,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                }}
            >
                {props.text}
            </Typography>
            {props.action}
        </Box>
    );
}

/** A hint in the middle of the content (no data, older firmware) */
export function Hint(props: { theme: Theme; children: React.ReactNode }): React.JSX.Element {
    return (
        <Box
            sx={{
                flex: "1 1 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "0.6em",
                color: mutedText(props.theme),
                fontSize: "0.95em",
            }}
        >
            {props.children}
        </Box>
    );
}

/**
 * Wraps a disabled control so its tooltip (the reason of the lock) still shows: a disabled MUI button does not
 * receive pointer events.
 */
export function Reason(props: { title?: string; children: React.ReactNode; grow?: boolean }): React.JSX.Element {
    return (
        <Box
            component="span"
            title={props.title}
            sx={{ display: "flex", minWidth: 0, flex: props.grow ? "1 1 0" : "0 0 auto" }}
        >
            {props.children}
        </Box>
    );
}
