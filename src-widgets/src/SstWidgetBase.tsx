import React from "react";

import type { VisRxWidgetProps, VisRxWidgetState } from "@iobroker/types-vis-2";
import type VisRxWidget from "@iobroker/types-vis-2/visRxWidget";

import { injectStyles } from "./styles";
import { ADAPTER, fill, instancePrefix } from "./common";

export interface SstBaseRxData {
    /** Adapter instance: "0" or "samba-solar-track.0" */
    instance?: string;
    /** true = no card background (the widget sits on a background of its own) */
    noCard?: boolean;
}

export interface SstBaseState extends VisRxWidgetState {
    /** Live values of the subscribed states, keyed by their id relative to the instance (null = no value) */
    fv: Record<string, ioBroker.StateValue | null>;
    /** `common.states` of the objects read once by `objectIds()`, keyed like `fv` */
    objStates: Record<string, Record<string, string>>;
    /** Monotonic tick for periodic re-renders (clocks, counters) */
    tick: number;
}

/**
 * Common base of all Samba Solar Track widgets (like `PumpWidgetBase` of ioBroker.pondpump).
 *
 * The widget is bound to an adapter instance only; it subscribes to the states it needs (`relIds()`) relative to
 * `samba-solar-track.<instance>.`, keeps their values in `this.state.fv` and offers small typed helpers.
 * Every state is read and subscribed on its own: a state that an older firmware does not provide (and the
 * adapter therefore does not create) just stays null and never blanks out the widget.
 * `write()` always writes with `ack:false`, i.e. as a command; the adapter forwards it to the device, which
 * decides (storm protection, limit switches, dead time and run time monitoring cannot be bypassed, F2).
 */
export default abstract class SstWidgetBase<
    TRxData extends SstBaseRxData,
    TState extends SstBaseState,
> extends (window.visRxWidget as typeof VisRxWidget)<TRxData, TState> {
    static adapter: string;

    protected subscribedIds: string[] = [];
    protected sstMounted = false;
    private tickTimer: ReturnType<typeof setInterval> | null = null;
    /** Set > 0 in a subclass constructor to receive a periodic re-render */
    protected tickMs = 0;

    /** States (relative to the instance) this widget subscribes to */
    protected abstract relIds(): string[];

    /** States (relative to the instance) whose `common.states` the widget needs (read once) */
    // eslint-disable-next-line class-methods-use-this
    protected objectIds(): string[] {
        return [];
    }

    constructor(props: VisRxWidgetProps) {
        super(props);
        this.state = { ...this.state, fv: {}, objStates: {}, tick: 0 };
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
        injectStyles();
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
        this.unsubscribeAll();
        super.componentWillUnmount();
    }

    onRxDataChanged(): void {
        void this.subscribeAll();
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

    /** The outer card with the class names of the set */
    protected card(children: React.ReactNode, extraClass = ""): React.JSX.Element {
        const noCard = this.state.rxData.noCard === true;
        return <div className={`sst${noCard ? "" : " sst-card"}${extraClass ? ` ${extraClass}` : ""}`}>{children}</div>;
    }
}
