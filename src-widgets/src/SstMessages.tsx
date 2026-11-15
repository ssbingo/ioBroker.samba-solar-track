import React from "react";

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps } from "@iobroker/types-vis-2";

import { Box, Chip, type Theme } from "@mui/material";

import SstWidgetBase, { type SstBaseRxData, type SstBaseState } from "./SstWidgetBase";
import { clock, parseJson, sstCommonGroup, sstGrid, VIS_SET } from "./common";
import { Hint } from "./parts";
import { tileBackground } from "./theme";

const REL_IDS = ["info.connection", "messages.history", "messages.lost"];

/** A message as the adapter keeps it in `messages.history` (newest first) */
interface Message {
    ts: number;
    seq: number;
    lvl: string;
    tag: string;
    msg: string;
}

type Filter = "all" | "warn" | "error";

interface MessagesRxData extends SstBaseRxData {
    filter?: Filter;
    showDebug?: boolean;
}

interface MessagesState extends SstBaseState {
    filter: Filter | null;
}

/** Badge per level: a sign instead of a word (the same in every language) and the translated level as title */
const LEVELS: Record<string, { color: "error" | "warning" | "info" | "grey"; sign: string; key: string }> = {
    E: { color: "error", sign: "✕", key: "level_error" },
    W: { color: "warning", sign: "!", key: "level_warning" },
    I: { color: "info", sign: "i", key: "level_info" },
    D: { color: "grey", sign: "·", key: "level_debug" },
    V: { color: "grey", sign: "·", key: "level_debug" },
};

/** Colours of a level badge from the palette */
function levelPaint(theme: Theme, color: "error" | "warning" | "info" | "grey"): { bg: string; fg: string } {
    if (color === "grey") {
        const bg = theme.palette.grey[theme.palette.mode === "dark" ? 700 : 300];
        return { bg, fg: theme.palette.getContrastText(bg) };
    }
    return { bg: theme.palette[color].main, fg: theme.palette[color].contrastText };
}

/**
 * Widget 3 - messages: the latest messages of the device (`messages.history`) with the time of day the adapter
 * calculated from the uptime of the device, the level and a filter (all / warnings / errors). The texts are the
 * log lines of the firmware as the device sends them.
 */
export default class SstMessages extends SstWidgetBase<MessagesRxData, MessagesState> {
    constructor(props: VisRxWidgetProps) {
        super(props);
        this.state = { ...this.state, filter: null };
    }

    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: "tplSambaSolarTrackMessages",
            visSet: VIS_SET,
            visName: "SstMessages",
            visWidgetLabel: "SstMessages",
            visHelp: "help_messages",
            visAttrs: [
                sstCommonGroup(),
                {
                    name: "options",
                    label: "group_options",
                    fields: [
                        {
                            name: "filter",
                            type: "select",
                            label: "default_filter",
                            options: [
                                { value: "all", label: "filter_all" },
                                { value: "warn", label: "filter_warn" },
                                { value: "error", label: "filter_error" },
                            ],
                            default: "all",
                        },
                        { name: "showDebug", type: "checkbox", label: "show_debug", default: false },
                    ],
                },
            ],
            visDefaultStyle: { width: 420, height: 300, position: "absolute" },
            visDefaultGrid: sstGrid(12, 6),
            visResizable: true,
            visPrev: "widgets/samba-solar-track/img/SstMessages.svg",
            visOrder: 3,
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo(): RxWidgetInfo {
        return SstMessages.getWidgetInfo();
    }

    // eslint-disable-next-line class-methods-use-this
    protected relIds(): string[] {
        return REL_IDS;
    }

    // eslint-disable-next-line class-methods-use-this
    protected titleKey(): string {
        return "SstMessages";
    }

    // eslint-disable-next-line class-methods-use-this
    protected designSize(): [number, number] {
        return [388, 268];
    }

    // eslint-disable-next-line class-methods-use-this
    protected scaleMode(): "fit" | "width" {
        return "width"; // the list scrolls; a flat widget must not shrink the text
    }

    private messages(): Message[] {
        return parseJson<unknown[]>(this.state.fv["messages.history"], []).filter(
            (m): m is Message => !!m && typeof m === "object" && typeof (m as Message).msg === "string",
        );
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
        super.renderWidgetBody(props);
        const filter: Filter = this.state.filter ?? this.state.rxData.filter ?? "all";
        const showDebug = this.state.rxData.showDebug === true;
        const list = this.messages().filter(m => {
            const lvl = (m.lvl || "I").toUpperCase();
            if (filter === "error") {
                return lvl === "E";
            }
            if (filter === "warn") {
                return lvl === "W" || lvl === "E";
            }
            return showDebug || (lvl !== "D" && lvl !== "V");
        });
        const theme = this.theme;
        const chip = (value: Filter, key: string): React.JSX.Element => (
            <Chip
                size="small"
                label={this.tx(key)}
                color={filter === value ? "primary" : "default"}
                variant={filter === value ? "filled" : "outlined"}
                aria-pressed={filter === value}
                onClick={() => this.setState({ filter: value })}
                sx={{ fontSize: "0.78em", height: "1.9em", "& .MuiChip-label": { px: "0.7em" } }}
            />
        );
        const lost = this.num("messages.lost");
        const filters = (
            <Box
                role="group"
                aria-label={this.tx("filter")}
                sx={{ display: "flex", gap: "0.3em", flex: "0 0 auto" }}
            >
                {chip("all", "filter_all")}
                {chip("warn", "filter_warn")}
                {chip("error", "filter_error")}
            </Box>
        );
        const content = (
            <>
                <Box
                    role="log"
                    aria-label={this.tx("SstMessages")}
                    tabIndex={0}
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25em",
                        overflowY: "auto",
                        overflowX: "hidden",
                        flex: "1 1 auto",
                        minHeight: 0,
                        "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
                    }}
                >
                    {list.length ? (
                        list.slice(0, 60).map(m => {
                            const level = LEVELS[(m.lvl || "I").toUpperCase()] ?? LEVELS.I;
                            const paint = levelPaint(theme, level.color);
                            return (
                                <Box
                                    key={`${m.seq}-${m.ts}`}
                                    title={`${m.tag ? `[${m.tag}] ` : ""}${m.msg}`}
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: "3.6em 1.7em minmax(0, 1fr)",
                                        gap: "0.45em",
                                        alignItems: "center",
                                        bgcolor: tileBackground(theme),
                                        borderRadius: `${theme.shape.borderRadius}px`,
                                        padding: "0.3em 0.5em",
                                        fontSize: "0.82em",
                                        flex: "0 0 auto",
                                    }}
                                >
                                    <Box
                                        component="time"
                                        dateTime={Number.isFinite(m.ts) ? new Date(m.ts).toISOString() : undefined}
                                        sx={{ color: this.muted }}
                                    >
                                        {clock(m.ts)}
                                    </Box>
                                    <Box
                                        component="span"
                                        title={this.tx(level.key)}
                                        aria-label={this.tx(level.key)}
                                        sx={{
                                            bgcolor: paint.bg,
                                            color: paint.fg,
                                            borderRadius: "0.3em",
                                            textAlign: "center",
                                            fontWeight: 700,
                                            fontSize: "0.85em",
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        {level.sign}
                                    </Box>
                                    <Box
                                        component="span"
                                        sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                    >
                                        {m.msg}
                                    </Box>
                                </Box>
                            );
                        })
                    ) : (
                        <Hint theme={theme}>
                            {this.flag("info.connection") === true ? this.tx("no_messages") : this.tx("band_offline")}
                        </Hint>
                    )}
                </Box>
                {lost !== null && lost > 0 ? (
                    <Box sx={{ fontSize: "0.75em", color: this.muted }}>{this.tx("messages_lost", { n: lost })}</Box>
                ) : null}
            </>
        );
        return this.renderCard(props, content, filters);
    }
}
