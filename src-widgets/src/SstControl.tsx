import React from "react";

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps } from "@iobroker/types-vis-2";

import SstWidgetBase, { type SstBaseRxData, type SstBaseState } from "./SstWidgetBase";
import { parseJson, sstCommonGroup, VIS_SET } from "./common";
import { driveLock, LOCK_IDS, remoteLock } from "./lock";

const REL_IDS = [
    ...LOCK_IDS,
    "status.auto",
    "status.mode",
    "status.park",
    "status.faultMotor",
    "axes.elevation.flatDirection",
    "axes.elevation.syncResetAvailable",
    "axes.elevation.syncResetPhase",
    "axes.azimuth.syncResetAvailable",
    "axes.azimuth.syncResetPhase",
    "jog.active",
    "position.presets",
    "position.target",
    "position.calibrated",
];

/**
 * The manual drive is written again this often while a button is held. The adapter stops the drive when the
 * state is not written again within one second (dead man, rule F3), so 400 ms leave room for a slow browser.
 */
const JOG_RENEW_MS = 400;

type JogAxis = "elevation" | "azimuth";

interface ControlRxData extends SstBaseRxData {
    showAngles?: boolean;
    showSyncReset?: boolean;
}

interface ControlState extends SstBaseState {
    /** running manual drive of this widget, null = none */
    held: { axis: JogAxis; value: number; button: string } | null;
    /** axis of the reset of the synchronous control waiting for the confirmation, null = no question */
    confirmReset: JogAxis | null;
}

/**
 * Widget 2 - control, the commands of the display (rule F17: nothing the display does not have):
 * automatic switch, STEEPER/FLATTER (manual drive with dead man), EAST/WEST with two axes, angle buttons with one
 * axis, park flat, acknowledge and optionally the reset of the synchronous control (with a question first).
 *
 * Dead man (F3): while a drive button is held, `control.jogElevation`/`control.jogAzimuth` is written again every
 * 400 ms; releasing the button (or losing the pointer, the focus or the page) writes 0. The adapter and the device
 * stop by themselves when the renewal stops. Storm protection, limit switches, dead time and run time monitoring
 * stay with the device (F2); the display has priority and its lock "remote control locked" disables every button
 * here (F4).
 */
export default class SstControl extends SstWidgetBase<ControlRxData, ControlState> {
    private jogTimer: ReturnType<typeof setInterval> | null = null;

    constructor(props: VisRxWidgetProps) {
        super(props);
        this.state = { ...this.state, held: null, confirmReset: null };
    }

    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: "tplSambaSolarTrackControl",
            visSet: VIS_SET,
            visName: "SstControl",
            visWidgetLabel: "SstControl",
            visHelp: "help_control",
            visAttrs: [
                sstCommonGroup(),
                {
                    name: "options",
                    label: "group_options",
                    fields: [
                        { name: "showAngles", type: "checkbox", label: "show_angles", default: true },
                        { name: "showSyncReset", type: "checkbox", label: "show_sync_reset", default: false },
                    ],
                },
            ],
            visDefaultStyle: { width: 300, height: 290 },
            visPrev: "widgets/samba-solar-track/img/SstControl.svg",
            visOrder: 2,
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo(): RxWidgetInfo {
        return SstControl.getWidgetInfo();
    }

    // eslint-disable-next-line class-methods-use-this
    protected relIds(): string[] {
        return REL_IDS;
    }

    // eslint-disable-next-line class-methods-use-this
    protected objectIds(): string[] {
        return ["control.jogElevation"];
    }

    componentDidMount(): void {
        super.componentDidMount();
        window.addEventListener("blur", this.stopJog);
        document.addEventListener("visibilitychange", this.onVisibility);
    }

    componentDidUpdate(prevProps: VisRxWidgetProps, prevState: ControlState): void {
        super.componentDidUpdate(prevProps, prevState);
        // a lock that comes up while a button is held ends the drive at once
        if (this.state.held && this.jogBlocked()) {
            this.stopJog();
        }
    }

    componentWillUnmount(): void {
        this.stopJog();
        window.removeEventListener("blur", this.stopJog);
        document.removeEventListener("visibilitychange", this.onVisibility);
        super.componentWillUnmount();
    }

    private onVisibility = (): void => {
        if (document.hidden) {
            this.stopJog();
        }
    };

    /**
     * Value of `control.jogElevation` that makes the module steeper. `axes.elevation.flatDirection` says in which
     * direction the flat position lies (1 = PLUS, the default); without it the names in `common.states` of
     * `control.jogElevation` decide (the adapter names them STEEPER/FLATTER after the device).
     */
    private steeperValue(): number {
        const flatDir = this.num("axes.elevation.flatDirection");
        if (flatDir === 1 || flatDir === -1) {
            return -flatDir;
        }
        const states = this.state.objStates["control.jogElevation"];
        if (states) {
            const key = Object.keys(states).find(k => /STEEPER/i.test(states[k]));
            if (key === "1" || key === "-1") {
                return Number(key);
            }
        }
        return -1;
    }

    /** Reason why no manual drive is possible (i18n key), or undefined */
    private jogBlockReason(): string | undefined {
        const lock = driveLock(this);
        if (lock.reason) {
            return lock.reason;
        }
        if (this.flag("status.auto") === true) {
            return "lock_auto";
        }
        return undefined;
    }

    private jogBlocked(): boolean {
        return this.editing || this.jogBlockReason() !== undefined;
    }

    private startJog(axis: JogAxis, value: number, button: string): void {
        if (this.jogBlocked()) {
            return;
        }
        this.stopTimer();
        const id = axis === "elevation" ? "control.jogElevation" : "control.jogAzimuth";
        this.write(id, value);
        this.jogTimer = setInterval(() => this.write(id, value), JOG_RENEW_MS);
        this.setState({ held: { axis, value, button } });
    }

    private stopTimer(): void {
        if (this.jogTimer) {
            clearInterval(this.jogTimer);
            this.jogTimer = null;
        }
    }

    private stopJog = (): void => {
        this.stopTimer();
        const held = this.state.held;
        if (held) {
            this.write(held.axis === "elevation" ? "control.jogElevation" : "control.jogAzimuth", 0);
            if (this.sstMounted) {
                this.setState({ held: null });
            }
        }
    };

    private holdProps(axis: JogAxis, value: number, button: string): React.ButtonHTMLAttributes<HTMLButtonElement> {
        return {
            onPointerDown: e => {
                if (e.button !== 0) {
                    return;
                }
                e.preventDefault();
                try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                    /* ignore */
                }
                this.startJog(axis, value, button);
            },
            onPointerUp: this.stopJog,
            onPointerCancel: this.stopJog,
            onLostPointerCapture: this.stopJog,
            onBlur: this.stopJog,
            onContextMenu: e => e.preventDefault(),
            onKeyDown: e => {
                if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                    e.preventDefault();
                    this.startJog(axis, value, button);
                }
            },
            onKeyUp: e => {
                if (e.key === " " || e.key === "Enter") {
                    this.stopJog();
                }
            },
        };
    }

    private presets(): number[] | null {
        const raw = this.state.fv["position.presets"];
        if (raw === null || raw === undefined) {
            return null; // firmware without the tilt on command or two axes: no angle buttons
        }
        const list = parseJson<unknown[]>(raw, []).filter((v): v is number => typeof v === "number");
        return list.length ? [...new Set(list)].sort((a, b) => a - b) : null;
    }

    private onAngle = (deg: number): void => {
        if (!driveLock(this).reason) {
            this.write("control.position", deg);
        }
    };

    private onResume = (): void => {
        if (!driveLock(this).reason) {
            this.write("control.positionResume", true);
        }
    };

    private onPark = (): void => {
        if (!driveLock(this).reason) {
            this.write("control.park", !(this.flag("status.park") === true));
        }
    };

    private onAck = (): void => {
        if (!remoteLock(this).reason) {
            this.write("control.acknowledge", true);
        }
    };

    private onToggleAuto = (): void => {
        if (!remoteLock(this).reason) {
            this.write("control.auto", !(this.flag("status.auto") === true));
        }
    };

    private onConfirmReset = (): void => {
        const axis = this.state.confirmReset;
        this.setState({ confirmReset: null });
        if (axis && !driveLock(this).reason) {
            this.write(axis === "elevation" ? "control.syncResetElevation" : "control.syncResetAzimuth", true);
        }
    };

    private renderResetDialog(): React.JSX.Element | null {
        const axis = this.state.confirmReset;
        if (!axis) {
            return null;
        }
        return (
            <div
                className="sst-dialog"
                role="alertdialog"
                aria-label={this.tx("sync_reset")}
            >
                <p>
                    <b>{axis === "elevation" ? this.tx("sync_reset_elevation") : this.tx("sync_reset_azimuth")}</b>
                </p>
                <p>
                    {axis === "elevation"
                        ? this.tx("sync_reset_question_elevation")
                        : this.tx("sync_reset_question_azimuth")}
                </p>
                <div className="sst-grid2">
                    <button
                        type="button"
                        className="sst-btn"
                        onClick={() => this.setState({ confirmReset: null })}
                    >
                        {this.tx("cancel")}
                    </button>
                    <button
                        type="button"
                        className="sst-btn sst-danger"
                        onClick={this.onConfirmReset}
                    >
                        {this.tx("sync_reset_start")}
                    </button>
                </div>
            </div>
        );
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
        super.renderWidgetBody(props);
        const dual = this.num("status.mode") === 2;
        const remote = remoteLock(this);
        const drive = driveLock(this);
        const jogReason = this.jogBlockReason();
        const auto = this.flag("status.auto") === true;
        const parked = this.flag("status.park") === true;
        const held = this.state.held;
        const steeper = this.steeperValue();
        const presets = this.state.rxData.showAngles !== false && !dual ? this.presets() : null;
        const target = this.num("position.target");
        const calibrated = this.flag("position.calibrated") !== false;
        const showReset = this.state.rxData.showSyncReset === true;
        const resetEl = showReset && this.flag("axes.elevation.syncResetAvailable") === true;
        const resetAz = showReset && dual && this.flag("axes.azimuth.syncResetAvailable") === true;
        const resetRunning =
            ["wait", "pulse", "run"].includes(this.str("axes.elevation.syncResetPhase")) ||
            ["wait", "pulse", "run"].includes(this.str("axes.azimuth.syncResetPhase"));
        const jogButton = (
            axis: JogAxis,
            value: number,
            key: string,
            arrow: string,
            label: string,
        ): React.JSX.Element => (
            <button
                type="button"
                className={`sst-btn${held?.button === key ? " sst-held" : ""}`}
                disabled={!!jogReason}
                aria-pressed={held?.button === key}
                {...this.holdProps(axis, value, key)}
            >
                <span
                    className="sst-ar"
                    aria-hidden="true"
                >
                    {arrow}
                </span>
                {label}
            </button>
        );
        let note = this.tx("note_dead_man");
        if (drive.reason) {
            note = this.tx(`${drive.reason}_note`);
        } else if (jogReason) {
            note = this.tx(`${jogReason}_note`);
        } else if (resetRunning) {
            note = this.tx("note_sync_reset_running");
        }
        return this.card(
            <>
                <div className="sst-head">
                    <div className="sst-ttl">{this.tx("SstControl")}</div>
                    <span className="sst-conn">{this.tx("automatic")}</span>
                    <button
                        type="button"
                        className="sst-sw"
                        role="switch"
                        aria-checked={auto}
                        aria-label={this.tx("automatic")}
                        disabled={!!remote.reason || this.str("status.state") === "SETUP"}
                        onClick={this.onToggleAuto}
                    />
                </div>
                <div className="sst-grid2">
                    {jogButton("elevation", steeper, "steeper", "▲", this.tx("dir_steeper"))}
                    {jogButton("elevation", -steeper, "flatter", "▼", this.tx("dir_flatter"))}
                </div>
                {dual ? (
                    <div className="sst-grid2">
                        {jogButton("azimuth", 1, "east", "◀", this.tx("dir_east"))}
                        {jogButton("azimuth", -1, "west", "▶", this.tx("dir_west"))}
                    </div>
                ) : null}
                {presets ? (
                    <>
                        <div
                            className="sst-kr"
                            style={{ marginTop: 2 }}
                        >
                            <span className="sst-k">{this.tx("go_to_angle")}</span>
                            {target !== null ? (
                                <button
                                    type="button"
                                    className="sst-chip"
                                    disabled={!!drive.reason}
                                    onClick={this.onResume}
                                >
                                    {this.tx("resume_automatic")}
                                </button>
                            ) : null}
                        </div>
                        <div
                            className="sst-gridn"
                            style={{ gridTemplateColumns: `repeat(${Math.min(presets.length, 5)},1fr)` }}
                        >
                            {presets.slice(0, 5).map(deg => (
                                <button
                                    key={deg}
                                    type="button"
                                    className={`sst-btn${target === deg ? " sst-on" : ""}`}
                                    aria-pressed={target === deg}
                                    // angles in between need measured travel times; 0° and 60° always work
                                    disabled={!!drive.reason || (!calibrated && deg !== 0 && deg < 60)}
                                    onClick={() => this.onAngle(deg)}
                                >
                                    {deg}°
                                </button>
                            ))}
                        </div>
                    </>
                ) : null}
                <div
                    className="sst-grid2"
                    style={{ marginTop: 2 }}
                >
                    <button
                        type="button"
                        className="sst-btn sst-park"
                        disabled={!!drive.reason}
                        onClick={this.onPark}
                    >
                        {parked ? this.tx("unpark") : this.tx("park_flat")}
                    </button>
                    <button
                        type="button"
                        className="sst-btn sst-ack"
                        disabled={!!remote.reason}
                        onClick={this.onAck}
                    >
                        {this.tx("acknowledge")}
                    </button>
                </div>
                {resetEl || resetAz ? (
                    <div className="sst-grid2">
                        {resetEl ? (
                            <button
                                type="button"
                                className="sst-btn"
                                disabled={!!drive.reason || resetRunning}
                                onClick={() => this.setState({ confirmReset: "elevation" })}
                            >
                                {this.tx("sync_reset_elevation")}
                            </button>
                        ) : null}
                        {resetAz ? (
                            <button
                                type="button"
                                className="sst-btn"
                                disabled={!!drive.reason || resetRunning}
                                onClick={() => this.setState({ confirmReset: "azimuth" })}
                            >
                                {this.tx("sync_reset_azimuth")}
                            </button>
                        ) : null}
                    </div>
                ) : null}
                <div className="sst-note">{note}</div>
                {this.renderResetDialog()}
            </>,
            "sst-rel",
        );
    }
}
