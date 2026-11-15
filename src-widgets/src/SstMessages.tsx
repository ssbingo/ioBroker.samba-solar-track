import React from "react";

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps } from "@iobroker/types-vis-2";

import SstWidgetBase, { type SstBaseRxData, type SstBaseState } from "./SstWidgetBase";
import { clock, parseJson, sstCommonGroup, VIS_SET } from "./common";

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
const LEVELS: Record<string, { cls: string; sign: string; key: string }> = {
    E: { cls: "sst-e", sign: "✕", key: "level_error" },
    W: { cls: "sst-w", sign: "!", key: "level_warning" },
    I: { cls: "sst-i", sign: "i", key: "level_info" },
    D: { cls: "sst-d", sign: "·", key: "level_debug" },
    V: { cls: "sst-d", sign: "·", key: "level_debug" },
};

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
            visDefaultStyle: { width: 400, height: 290 },
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
        const chip = (value: Filter, key: string): React.JSX.Element => (
            <button
                type="button"
                className="sst-chip"
                aria-pressed={filter === value}
                onClick={() => this.setState({ filter: value })}
            >
                {this.tx(key)}
            </button>
        );
        const lost = this.num("messages.lost");
        return this.card(
            <>
                <div className="sst-head">
                    <div className="sst-ttl">{this.tx("SstMessages")}</div>
                    <div
                        className="sst-chips"
                        role="group"
                        aria-label={this.tx("filter")}
                    >
                        {chip("all", "filter_all")}
                        {chip("warn", "filter_warn")}
                        {chip("error", "filter_error")}
                    </div>
                </div>
                <div className="sst-log">
                    {list.length ? (
                        list.slice(0, 60).map(m => {
                            const level = LEVELS[(m.lvl || "I").toUpperCase()] ?? LEVELS.I;
                            return (
                                <div
                                    className="sst-ln"
                                    key={`${m.seq}-${m.ts}`}
                                    title={`${m.tag ? `[${m.tag}] ` : ""}${m.msg}`}
                                >
                                    <time dateTime={Number.isFinite(m.ts) ? new Date(m.ts).toISOString() : undefined}>
                                        {clock(m.ts)}
                                    </time>
                                    <span
                                        className={`sst-lv ${level.cls}`}
                                        title={this.tx(level.key)}
                                        aria-label={this.tx(level.key)}
                                    >
                                        {level.sign}
                                    </span>
                                    <span>{m.msg}</span>
                                </div>
                            );
                        })
                    ) : (
                        <div className="sst-hint">
                            {this.flag("info.connection") === true ? this.tx("no_messages") : this.tx("band_offline")}
                        </div>
                    )}
                </div>
                {lost !== null && lost > 0 ? (
                    <div className="sst-note">{this.tx("messages_lost", { n: lost })}</div>
                ) : null}
            </>,
        );
    }
}
