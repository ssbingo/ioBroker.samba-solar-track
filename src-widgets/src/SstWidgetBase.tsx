import React from "react";

import { Box, Typography, type Theme } from "@mui/material";

import type { RxRenderWidgetProps, VisRxWidgetProps, VisRxWidgetState } from "@iobroker/types-vis-2";
import type VisRxWidget from "@iobroker/types-vis-2/visRxWidget";

import { ADAPTER, fill, instancePrefix } from "./common";
import { mutedText } from "./theme";

export interface SstBaseRxData {
    /** Adapter instance: "0" or "samba-solar-track.0" */
    instance?: string;
    /** true = no card (the widget sits on a background of its own), as `noCard` of vis-2-widgets-material */
    noCard?: boolean | "true";
    /** Title of the card, as `widgetTitle` of vis-2-widgets-material; empty = name of the widget */
    widgetTitle?: string;
}

export interface SstBaseState extends VisRxWidgetState {
    /** Live values of the subscribed states, keyed by their id relative to the instance (null = no value) */
    fv: Record<string, ioBroker.StateValue | null>;
    /** `common.states` of the objects read once by `objectIds()`, keyed like `fv` */
    objStates: Record<string, Record<string, string>>;
    /** Monotonic tick for periodic re-renders (clocks, counters) */
    tick: number;
    /** Factor of the content against the default size of the widget (1 = `visDefaultStyle`) */
    sstScale: number;
}

/** Font size of the content at the default size of the widget, in px */
const BASE_FONT = 13;
/** Limits of the scale, so the content stays readable on a tiny widget and does not explode on a huge one */
const MIN_SCALE = 0.7;
const MAX_SCALE = 2.6;

/**
 * Common base of all Samba Solar Track widgets, like `Generic` of vis-2-widgets-material.
 *
 * - The widget is bound to an adapter instance only; it subscribes to the states it needs (`relIds()`) relative to
 *   `samba-solar-track.<instance>.`, keeps their values in `this.state.fv` and offers small typed helpers. Every
 *   state is read and subscribed on its own: a state that an older firmware does not provide (and the adapter
 *   therefore does not create) just stays null and never blanks out the widget.
 * - `write()` always writes with `ack:false`, i.e. as a command; the adapter forwards it to the device, which
 *   decides (storm protection, limit switches, dead time and run time monitoring cannot be bypassed, F2). In the
 *   editor nothing is written.
 * - `renderCard()` draws the card with `wrapContent()` of vis-2 (the card of every MUI widget set), or no card with
 *   `noCard`. Colours and font come from the theme of vis-2 only.
 * - The content scales with the size of the widget: a ResizeObserver compares the content area with the default
 *   size (`visDefaultStyle`) and sets the font size of the content; everything inside is sized in `em`.
 */
export default abstract class SstWidgetBase<
    TRxData extends SstBaseRxData,
    TState extends SstBaseState,
> extends (window.visRxWidget as typeof VisRxWidget)<TRxData, TState> {
    static adapter: string;

    protected subscribedIds: string[] = [];
    protected sstMounted = false;
    private tickTimer: ReturnType<typeof setInterval> | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private observed: HTMLElement | null = null;
    /** Set > 0 in a subclass constructor to receive a periodic re-render */
    protected tickMs = 0;

    /** States (relative to the instance) this widget subscribes to */
    protected abstract relIds(): string[];

    /** Name of the widget (i18n key), shown as the title when `widgetTitle` is empty */
    protected abstract titleKey(): string;

    /** Size of the content area in px at the default size of the widget (the design size, scale 1) */
    protected abstract designSize(): [number, number];

    /**
     * How the content follows the size: "fit" = by the smaller of width and height (everything stays visible),
     * "width" = by the width, but not above the default size unless the height grows as well (for content that
     * scrolls vertically, like a list, so a flat widget does not shrink the text)
     */
    // eslint-disable-next-line class-methods-use-this
    protected scaleMode(): "fit" | "width" {
        return "fit";
    }

    /** States (relative to the instance) whose `common.states` the widget needs (read once) */
    // eslint-disable-next-line class-methods-use-this
    protected objectIds(): string[] {
        return [];
    }

    constructor(props: VisRxWidgetProps) {
        super(props);
        this.state = { ...this.state, fv: {}, objStates: {}, tick: 0, sstScale: 1 };
    }

    static getI18nPrefix(): string {
        return `${ADAPTER}_`;
    }

    /**
     * setState's key inference does not work through the abstract TState generic, so the updater type is relaxed
     * in exactly this one place.
     *
     * @param updater - returns the changed part of the state
     */
    protected applyPartial(updater: (s: SstBaseState) => Partial<SstBaseState>): void {
        (this.setState as unknown as (u: (s: SstBaseState) => Partial<SstBaseState>) => void)(updater);
    }

    componentDidMount(): void {
        super.componentDidMount();
        this.sstMounted = true;
        void this.subscribeAll();
        if (this.tickMs > 0) {
            this.tickTimer = setInterval(
                () => this.sstMounted && this.applyPartial(s => ({ tick: s.tick + 1 })),
                this.tickMs,
            );
        }
    }

    componentWillUnmount(): void {
        this.sstMounted = false;
        if (this.tickTimer) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
        }
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.observed = null;
        this.unsubscribeAll();
        super.componentWillUnmount();
    }

    onRxDataChanged(): void {
        void this.subscribeAll();
    }

    /** The theme of vis-2 (light or dark, as chosen in vis-2) */
    protected get theme(): Theme {
        return this.props.context.theme as unknown as Theme;
    }

    /** Object id prefix of the chosen instance, e.g. `samba-solar-track.0` */
    protected prefix(): string {
        return instancePrefix(this.state.rxData);
    }

    protected async subscribeAll(): Promise<void> {
        this.unsubscribeAll();
        const prefix = this.prefix();
        const ids = [...new Set(this.relIds())].map(id => `${prefix}.${id}`);
        this.subscribedIds = ids;
        this.applyPartial(() => ({ fv: {} }));
        // Read current values first, each on its own, so one missing state cannot block the others.
        for (const id of ids) {
            try {
                const st = await this.props.context.socket.getState(id);
                this.applyState(id, st);
            } catch {
                /* a missing or unreadable state just stays null */
            }
        }
        for (const id of ids) {
            try {
                await this.props.context.socket.subscribeState(id, this.onSstState);
            } catch {
                /* ignore: the state does not exist with this firmware */
            }
        }
        const objStates: Record<string, Record<string, string>> = {};
        for (const rel of this.objectIds()) {
            try {
                const obj = await this.props.context.socket.getObject(`${prefix}.${rel}`);
                const states = (obj?.common as { states?: unknown } | undefined)?.states;
                if (states && typeof states === "object" && !Array.isArray(states)) {
                    objStates[rel] = states as Record<string, string>;
                }
            } catch {
                /* ignore */
            }
        }
        if (this.sstMounted) {
            this.applyPartial(() => ({ objStates }));
        }
    }

    protected unsubscribeAll(): void {
        for (const id of this.subscribedIds) {
            try {
                this.props.context.socket.unsubscribeState(id, this.onSstState);
            } catch {
                /* ignore */
            }
        }
        this.subscribedIds = [];
    }

    protected onSstState = (id: string, state: ioBroker.State | null | undefined): void => {
        this.applyState(id, state);
    };

    protected applyState(id: string, state: ioBroker.State | null | undefined): void {
        if (!this.sstMounted) {
            return;
        }
        const prefix = `${this.prefix()}.`;
        if (!id.startsWith(prefix)) {
            return;
        }
        const key = id.substring(prefix.length);
        this.applyPartial(s => ({ fv: { ...s.fv, [key]: state ? state.val : null } }));
    }

    /**
     * Sends a command (ack:false) to a state of the chosen instance.
     *
     * @param rel - state id relative to the instance
     * @param val - value
     */
    protected write(rel: string, val: ioBroker.StateValue): void {
        if (this.props.editMode) {
            return; // never command the device from the editor
        }
        void this.props.context.socket.setState(`${this.prefix()}.${rel}`, val, false);
    }

    /** true while the widget shows the editor (no commands are sent then) */
    protected get editing(): boolean {
        return !!this.props.editMode;
    }

    public num(key: string): number | null {
        const v = this.state.fv[key];
        if (v === null || v === undefined || v === "" || typeof v === "boolean") {
            return null;
        }
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    public str(key: string): string {
        const v = this.state.fv[key];
        return typeof v === "string" ? v : "";
    }

    /** true / false, or null while the state has no boolean value (missing with this firmware) */
    public flag(key: string): boolean | null {
        const v = this.state.fv[key];
        return typeof v === "boolean" ? v : null;
    }

    /** Translation of a key of the widget set with placeholders `{name}` filled in */
    // eslint-disable-next-line class-methods-use-this
    protected tx(key: string, params: Record<string, string | number> = {}): string {
        return fill(SstWidgetBase.t(key), params);
    }

    /** Connection of the adapter to the device */
    protected connected(): boolean {
        return this.flag("info.connection") === true;
    }

    /** Colour of labels and secondary text */
    protected get muted(): string {
        return mutedText(this.theme);
    }

    /** Observes the size of the content area to scale the content with the widget */
    private setRoot = (el: HTMLDivElement | null): void => {
        if (el === this.observed) {
            return;
        }
        this.resizeObserver?.disconnect();
        this.observed = el;
        if (!el || typeof ResizeObserver === "undefined") {
            return;
        }
        this.resizeObserver = new ResizeObserver(entries => {
            const box = entries[0]?.contentRect;
            if (!box || !this.sstMounted || box.width <= 0 || box.height <= 0) {
                return;
            }
            const [w, h] = this.designSize();
            // "width": a flat list keeps the default text size, a big one grows with width and height
            const factor =
                this.scaleMode() === "width"
                    ? Math.min(box.width / w, Math.max(1, box.height / h))
                    : Math.min(box.width / w, box.height / h);
            const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, factor));
            if (Math.abs(scale - this.state.sstScale) > 0.02) {
                this.applyPartial(() => ({ sstScale: scale }));
            }
        });
        this.resizeObserver.observe(el);
    };

    /** Font size of the content in px (everything inside is sized in em) */
    protected get fontPx(): number {
        return BASE_FONT * this.state.sstScale;
    }

    /**
     * The widget in its card: title (`widgetTitle` or the name of the widget), optional controls on the right of
     * the title and the content. With `noCard` (or inside another widget) only the content and the controls.
     *
     * @param props - the properties of `renderWidgetBody`
     * @param content - the content below the title
     * @param extra - controls on the right of the title (switch, chips), or null
     */
    protected renderCard(
        props: RxRenderWidgetProps,
        content: React.ReactNode,
        extra: React.ReactNode = null,
    ): React.JSX.Element {
        const rx = this.state.rxData;
        const noCard = rx.noCard === true || rx.noCard === "true" || !!props.widget?.usedInWidget;
        const custom = typeof rx.widgetTitle === "string" && rx.widgetTitle.trim() ? rx.widgetTitle : "";
        const theme = this.theme;
        const fontPx = this.fontPx;
        const header = (title: string | null): React.JSX.Element | null =>
            title || extra ? (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5em",
                        width: "100%",
                        minHeight: "2em",
                        flex: "0 0 auto",
                    }}
                >
                    {title ? (
                        <Typography
                            component="div"
                            sx={{
                                fontSize: "1.25em",
                                fontWeight: 500,
                                lineHeight: 1.2,
                                flex: "1 1 auto",
                                minWidth: 0,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {title}
                        </Typography>
                    ) : (
                        <Box sx={{ flex: "1 1 auto" }} />
                    )}
                    {extra}
                </Box>
            ) : null;

        const root = (withHeader: boolean, title: string | null): React.JSX.Element => (
            <Box
                ref={this.setRoot}
                sx={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    minWidth: 0,
                    minHeight: 0,
                    flex: "1 1 auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5em",
                    overflow: "hidden",
                    boxSizing: "border-box",
                    fontFamily: theme.typography.fontFamily,
                    fontSize: `${fontPx}px`,
                    lineHeight: 1.3,
                    color: theme.palette.text.primary,
                    textAlign: "left",
                    fontVariantNumeric: "tabular-nums",
                    "& *": { boxSizing: "border-box" },
                }}
            >
                {withHeader ? header(title) : null}
                {content}
            </Box>
        );

        if (noCard) {
            return root(true, null);
        }
        if (custom) {
            // vis-2 draws the title of `widgetTitle` itself; the controls go next to it
            return this.wrapContent(
                root(false, null),
                extra ? (
                    <Box sx={{ fontSize: `${fontPx}px`, display: "flex", alignItems: "center" }}>{extra}</Box>
                ) : null,
                { boxSizing: "border-box", height: "100%", alignItems: "stretch", padding: 12, overflow: "hidden" },
                { fontSize: Math.round(fontPx * 1.25), fontWeight: 500, paddingBottom: Math.round(fontPx * 0.4) },
            ) as React.JSX.Element;
        }
        return this.wrapContent(root(true, this.tx(this.titleKey())), null, {
            boxSizing: "border-box",
            height: "100%",
            alignItems: "stretch",
            padding: 12,
            overflow: "hidden",
        }) as React.JSX.Element;
    }
}
