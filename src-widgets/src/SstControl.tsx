import React from "react";

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps } from "@iobroker/types-vis-2";

import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControlLabel,
    Switch,
} from "@mui/material";

import SstWidgetBase, { type SstBaseRxData, type SstBaseState } from "./SstWidgetBase";
import { parseJson, sstCommonGroup, sstGrid, VIS_SET } from "./common";
import { driveLock, LOCK_IDS, remoteLock } from "./lock";
import { Label, Reason } from "./parts";
import { stateText } from "./theme";

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
            visDefaultStyle: { width: 320, height: 330, position: "absolute" },
            visDefaultGrid: sstGrid(8, 7),
            visResizable: true,
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
    protected titleKey(): string {
        return "SstControl";
    }

    // eslint-disable-next-line class-methods-use-this
    protected designSize(): [number, number] {
        return [288, 260];
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

    private holdProps(
        axis: JogAxis,
        value: number,
        button: string,
    ): Omit<React.HTMLAttributes<HTMLButtonElement>, "color"> {
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
        if (!axis || this.editing) {
            return null;
        }
        const close = (): void => this.setState({ confirmReset: null });
        return (
            <Dialog
                open
                onClose={close}
                aria-labelledby="sst-sync-reset-title"
            >
                <DialogTitle id="sst-sync-reset-title">
                    {axis === "elevation" ? this.tx("sync_reset_elevation") : this.tx("sync_reset_azimuth")}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {axis === "elevation"
                            ? this.tx("sync_reset_question_elevation")
                            : this.tx("sync_reset_question_azimuth")}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={close}
                        autoFocus
                    >
                        {this.tx("cancel")}
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={this.onConfirmReset}
                    >
                        {this.tx("sync_reset_start")}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
        super.renderWidgetBody(props);
        const theme = this.theme;
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
        const btnSx = {
            fontSize: "0.85em",
            lineHeight: 1.15,
            minWidth: 0,
            minHeight: "2.6em",
            px: "0.4em",
            py: "0.45em",
            width: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
        } as const;
        const row = (children: React.ReactNode, cols = 2): React.JSX.Element => (
            <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: "0.45em" }}>
                {children}
            </Box>
        );
        const jogButton = (
            axis: JogAxis,
            value: number,
            key: string,
            arrow: string,
            label: string,
        ): React.JSX.Element => {
            const pressed = held?.button === key;
            return (
                <Reason
                    title={jogReason ? this.tx(jogReason) : undefined}
                    grow
                >
                    <Button
                        variant="contained"
                        color="primary"
                        disabled={!!jogReason}
                        aria-pressed={pressed}
                        disableRipple
                        {...this.holdProps(axis, value, key)}
                        sx={{
                            ...btnSx,
                            minHeight: "3.2em",
                            flexDirection: "column",
                            gap: "0.1em",
                            userSelect: "none",
                            WebkitUserSelect: "none",
                            touchAction: "none",
                            ...(pressed
                                ? {
                                      bgcolor: theme.palette.primary.dark,
                                      outline: `0.2em solid ${theme.palette.warning.main}`,
                                      outlineOffset: "-0.2em",
                                  }
                                : {}),
                        }}
                    >
                        <Box
                            component="span"
                            aria-hidden="true"
                            sx={{ fontSize: "1.2em", lineHeight: 1 }}
                        >
                            {arrow}
                        </Box>
                        {label}
                    </Button>
                </Reason>
            );
        };
        let note = this.tx("note_dead_man");
        if (drive.reason) {
            note = this.tx(`${drive.reason}_note`);
        } else if (jogReason) {
            note = this.tx(`${jogReason}_note`);
        } else if (resetRunning) {
            note = this.tx("note_sync_reset_running");
        }
        const noteKind = drive.reason || jogReason ? "warn" : "";
        const autoSwitch = (
            <Reason title={remote.reason ? this.tx(remote.reason) : undefined}>
                <FormControlLabel
                    labelPlacement="start"
                    disabled={!!remote.reason || this.str("status.state") === "SETUP"}
                    sx={{ m: 0, gap: "0.2em", "& .MuiFormControlLabel-label": { fontSize: "0.85em" } }}
                    label={this.tx("automatic")}
                    control={
                        <Switch
                            size="small"
                            checked={auto}
                            onChange={this.onToggleAuto}
                        />
                    }
                />
            </Reason>
        );
        const content = (
            <>
                {row(
                    <>
                        {jogButton("elevation", steeper, "steeper", "▲", this.tx("dir_steeper"))}
                        {jogButton("elevation", -steeper, "flatter", "▼", this.tx("dir_flatter"))}
                    </>,
                )}
                {dual
                    ? row(
                          <>
                              {jogButton("azimuth", 1, "east", "◀", this.tx("dir_east"))}
                              {jogButton("azimuth", -1, "west", "▶", this.tx("dir_west"))}
                          </>,
                      )
                    : null}
                {presets ? (
                    <>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "0.4em",
                                minHeight: "1.8em",
                            }}
                        >
                            <Label theme={theme}>{this.tx("go_to_angle")}</Label>
                            {target !== null ? (
                                <Button
                                    size="small"
                                    variant="text"
                                    disabled={!!drive.reason}
                                    onClick={this.onResume}
                                    sx={{ fontSize: "0.72em", minWidth: 0, py: 0, whiteSpace: "nowrap" }}
                                >
                                    {this.tx("resume_automatic")}
                                </Button>
                            ) : null}
                        </Box>
                        {row(
                            presets.slice(0, 5).map(deg => (
                                <Button
                                    key={deg}
                                    variant={target === deg ? "contained" : "outlined"}
                                    aria-pressed={target === deg}
                                    // angles in between need measured travel times; 0° and 60° always work
                                    disabled={!!drive.reason || (!calibrated && deg !== 0 && deg < 60)}
                                    onClick={() => this.onAngle(deg)}
                                    sx={{ ...btnSx, minHeight: "2.3em", px: 0 }}
                                >
                                    {deg}°
                                </Button>
                            )),
                            Math.min(presets.length, 5),
                        )}
                    </>
                ) : null}
                {row(
                    <>
                        <Reason
                            title={drive.reason ? this.tx(drive.reason) : undefined}
                            grow
                        >
                            <Button
                                variant="outlined"
                                color="inherit"
                                disabled={!!drive.reason}
                                onClick={this.onPark}
                                sx={btnSx}
                            >
                                {parked ? this.tx("unpark") : this.tx("park_flat")}
                            </Button>
                        </Reason>
                        <Reason
                            title={remote.reason ? this.tx(remote.reason) : undefined}
                            grow
                        >
                            <Button
                                variant="contained"
                                color="warning"
                                disabled={!!remote.reason}
                                onClick={this.onAck}
                                sx={btnSx}
                            >
                                {this.tx("acknowledge")}
                            </Button>
                        </Reason>
                    </>,
                )}
                {resetEl || resetAz
                    ? row(
                          <>
                              {resetEl ? (
                                  <Button
                                      variant="outlined"
                                      color="error"
                                      disabled={!!drive.reason || resetRunning}
                                      onClick={() => this.setState({ confirmReset: "elevation" })}
                                      sx={btnSx}
                                  >
                                      {this.tx("sync_reset_elevation")}
                                  </Button>
                              ) : null}
                              {resetAz ? (
                                  <Button
                                      variant="outlined"
                                      color="error"
                                      disabled={!!drive.reason || resetRunning}
                                      onClick={() => this.setState({ confirmReset: "azimuth" })}
                                      sx={btnSx}
                                  >
                                      {this.tx("sync_reset_azimuth")}
                                  </Button>
                              ) : null}
                          </>,
                          resetEl && resetAz ? 2 : 1,
                      )
                    : null}
                <Box
                    sx={{
                        fontSize: "0.75em",
                        lineHeight: 1.35,
                        color: noteKind ? stateText(theme, "warn") : this.muted,
                        mt: "auto",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                    }}
                    title={note}
                >
                    {note}
                </Box>
                {this.renderResetDialog()}
            </>
        );
        return this.renderCard(props, content, autoSwitch);
    }
}
