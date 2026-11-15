import React from "react";

import { alpha, Box, Button, FormControlLabel, Switch } from "@mui/material";

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps } from "@iobroker/types-vis-2";

import SstWidgetBase, { type SstBaseRxData, type SstBaseState } from "./SstWidgetBase";
import { BAND_IDS, elevationSteeper, statusBand } from "./band";
import { fmt, sstCommonGroup, sstGrid, VIS_SET } from "./common";
import { compass, LOCK_IDS, remoteLock } from "./lock";
import { Label, Line, Reason, StatusBand, Tile } from "./parts";
import { stateText, sunColor } from "./theme";

const REL_IDS = [
    ...BAND_IDS,
    ...LOCK_IDS,
    "status.auto",
    "status.mode",
    "status.remoteLocked",
    "status.setupDone",
    "wind.speed",
    "wind.gust",
    "wind.maxGust",
    "wind.stormThreshold",
    "wind.hasDirection",
    "wind.directionOk",
    "wind.direction",
    "sun.ok",
    "axes.elevation.deviation",
    "axes.azimuth.deviation",
    "axes.elevation.blockedPlus",
    "axes.elevation.blockedMinus",
    "axes.azimuth.fault",
    "axes.azimuth.blockedPlus",
    "axes.azimuth.blockedMinus",
    "axes.elevation.angleSource",
    "sunPosition.bestTilt",
    "commissioning.done",
];

/** Deviation in per mille at the edge of the cross-hair field (TARGET_FULL of the display) */
const TARGET_FULL = 300;

type OverviewRxData = SstBaseRxData;
type OverviewState = SstBaseState;

/**
 * Widget 1 - overview, with the content of the start page of the display: wind gauge, sun sensor cross-hair, tilt
 * with sketch and the status band (text per state as at the display, colour from the palette of vis-2) with the
 * button PARK FLAT / CANCEL PARKING, plus the automatic switch.
 */
export default class SstOverview extends SstWidgetBase<OverviewRxData, OverviewState> {
    constructor(props: VisRxWidgetProps) {
        super(props);
        this.tickMs = 1000; // storm countdown
    }

    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: "tplSambaSolarTrackOverview",
            visSet: VIS_SET,
            visSetLabel: "set_label",
            visSetColor: "#f5a400",
            visName: "SstOverview",
            visWidgetLabel: "SstOverview",
            visHelp: "help_overview",
            visAttrs: [sstCommonGroup()],
            visDefaultStyle: { width: 440, height: 300, position: "absolute" },
            visDefaultGrid: sstGrid(12, 6),
            visResizable: true,
            visPrev: "widgets/samba-solar-track/img/SstOverview.svg",
            visOrder: 1,
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo(): RxWidgetInfo {
        return SstOverview.getWidgetInfo();
    }

    // eslint-disable-next-line class-methods-use-this
    protected relIds(): string[] {
        return REL_IDS;
    }

    // eslint-disable-next-line class-methods-use-this
    protected titleKey(): string {
        return "SstOverview";
    }

    // eslint-disable-next-line class-methods-use-this
    protected designSize(): [number, number] {
        return [408, 268];
    }

    private axisText(axis: "elevation" | "azimuth"): string {
        const out = this.num(`axes.${axis}.output`) ?? 0;
        if (this.flag(`axes.${axis}.fault`) === true) {
            return this.tx("axis_fault");
        }
        if (out !== 0) {
            if (axis === "elevation") {
                return elevationSteeper(out, this.num("axes.elevation.flatDirection"))
                    ? this.tx("dir_steeper")
                    : this.tx("dir_flatter");
            }
            return out > 0 ? this.tx("dir_east") : this.tx("dir_west");
        }
        if (this.flag(`axes.${axis}.blockedPlus`) === true || this.flag(`axes.${axis}.blockedMinus`) === true) {
            return this.tx("axis_endstop");
        }
        return this.tx("axis_stop");
    }

    private renderWind(): React.JSX.Element {
        const theme = this.theme;
        const p = theme.palette;
        const ok = this.flag("wind.ok") !== false;
        const speed = ok ? this.num("wind.speed") : null;
        const storm = this.num("wind.stormThreshold");
        const full = Math.max(60, storm !== null ? storm * 1.5 : 60);
        const frac = Math.max(0, Math.min(1, (speed ?? 0) / full));
        const a = frac * 270;
        const r = 44;
        const cx = 60;
        const cy = 54;
        const st = (135 * Math.PI) / 180;
        const en = ((135 + a) * Math.PI) / 180;
        const x1 = cx + r * Math.cos(st);
        const y1 = cy + r * Math.sin(st);
        const x2 = cx + r * Math.cos(en);
        const y2 = cy + r * Math.sin(en);
        const arc = `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${a > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
        const gust = this.num("wind.gust");
        const stormy = speed !== null && storm !== null && (gust ?? speed) >= storm;
        const color = stormy ? p.error.main : p.primary.main;
        const dir = this.num("wind.direction");
        const showDir =
            this.flag("wind.hasDirection") === true && this.flag("wind.directionOk") !== false && dir !== null;
        return (
            <Tile theme={theme}>
                <Label theme={theme}>{this.tx("wind")}</Label>
                <Box
                    component="svg"
                    viewBox="0 0 120 96"
                    aria-hidden="true"
                    sx={{ width: "100%", flex: "1 1 auto", minHeight: 0, display: "block" }}
                >
                    <path
                        d={`M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 1 1 ${(cx + r * Math.cos((45 * Math.PI) / 180)).toFixed(1)} ${(cy + r * Math.sin((45 * Math.PI) / 180)).toFixed(1)}`}
                        fill="none"
                        stroke={p.divider}
                        strokeWidth={9}
                        strokeLinecap="round"
                    />
                    {frac > 0.001 ? (
                        <path
                            d={arc}
                            fill="none"
                            stroke={color}
                            strokeWidth={9}
                            strokeLinecap="round"
                        />
                    ) : null}
                    <text
                        x={60}
                        y={58}
                        textAnchor="middle"
                        fontSize={22}
                        fontWeight={500}
                        fill={p.text.primary}
                        fontFamily={theme.typography.fontFamily}
                    >
                        {fmt(speed, 1)}
                    </text>
                    <text
                        x={60}
                        y={72}
                        textAnchor="middle"
                        fontSize={9}
                        fill={this.muted}
                        fontFamily={theme.typography.fontFamily}
                    >
                        km/h
                    </text>
                    {storm !== null ? (
                        <text
                            x={60}
                            y={92}
                            textAnchor="middle"
                            fontSize={9}
                            fontWeight={500}
                            fill={stateText(theme, "warn")}
                            fontFamily={theme.typography.fontFamily}
                        >
                            {this.tx("storm_from", { v: fmt(storm) })}
                        </text>
                    ) : null}
                </Box>
                {!ok ? (
                    <Line color={stateText(theme, "bad")}>{this.tx("wind_fault")}</Line>
                ) : showDir ? (
                    <Line>{this.tx("wind_from", { dir: compass(dir, this.tx("compass")), deg: fmt(dir) })}</Line>
                ) : null}
                <Line weight={500}>{this.tx("gust_value", { v: fmt(ok ? gust : null, 1) })}</Line>
                <Line
                    size="0.78em"
                    color={this.muted}
                >
                    {this.tx("max_gust_value", { v: fmt(this.num("wind.maxGust"), 1) })}
                </Line>
            </Tile>
        );
    }

    private renderSun(): React.JSX.Element {
        const theme = this.theme;
        const p = theme.palette;
        const ok = this.flag("sun.ok") !== false;
        const dual = this.num("status.mode") === 2;
        const eEl = this.num("axes.elevation.deviation") ?? 0;
        const eAz = this.num("axes.azimuth.deviation") ?? 0;
        const clamp = (v: number): number => Math.max(-TARGET_FULL, Math.min(TARGET_FULL, v));
        const half = 37;
        // east (PLUS) left, up (PLUS) up, as at the display; with one axis only the height counts
        const x = 50 + (dual ? (-clamp(eAz) * half) / TARGET_FULL : 0);
        const y = 50 + (-clamp(eEl) * half) / TARGET_FULL;
        const night = this.str("status.state") === "NIGHT";
        const sign = (v: number): string => `${v >= 0 ? "+" : ""}${(v / 10).toFixed(1)}`;
        const dirs = this.tx("compass").split(",");
        return (
            <Tile theme={theme}>
                <Label theme={theme}>{this.tx("sun_sensor")}</Label>
                <Box
                    component="svg"
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                    sx={{ width: "100%", flex: "1 1 auto", minHeight: 0, display: "block", my: "0.2em" }}
                >
                    <circle
                        cx={50}
                        cy={50}
                        r={42}
                        fill={p.action.hover}
                        stroke={p.divider}
                        strokeWidth={1}
                    />
                    <line
                        x1={8}
                        y1={50}
                        x2={92}
                        y2={50}
                        stroke={p.divider}
                        strokeWidth={0.8}
                    />
                    <line
                        x1={50}
                        y1={8}
                        x2={50}
                        y2={92}
                        stroke={p.divider}
                        strokeWidth={0.8}
                    />
                    <circle
                        cx={50}
                        cy={50}
                        r={10}
                        fill="none"
                        stroke={p.primary.main}
                        strokeWidth={1}
                    />
                    {ok ? (
                        <circle
                            cx={x}
                            cy={y}
                            r={5.5}
                            fill={sunColor(theme)}
                            opacity={night ? 0.3 : 1}
                        />
                    ) : null}
                    <text
                        x={12}
                        y={47}
                        fontSize={8}
                        fill={this.muted}
                        fontFamily={theme.typography.fontFamily}
                    >
                        {dirs[2] || ""}
                    </text>
                    <text
                        x={88}
                        y={47}
                        fontSize={8}
                        textAnchor="end"
                        fill={this.muted}
                        fontFamily={theme.typography.fontFamily}
                    >
                        {dirs[6] || ""}
                    </text>
                </Box>
                <Line weight={500}>
                    {ok ? this.tx("deviation_single", { el: sign(eEl) }) : this.tx("sensor_missing")}
                </Line>
                {dual && ok ? <Line weight={500}>{this.tx("deviation_azimuth", { az: sign(eAz) })}</Line> : null}
                <Line
                    size="0.78em"
                    color={this.muted}
                >
                    {this.tx("axis_line_elevation", { s: this.axisText("elevation") })}
                </Line>
                {dual ? (
                    <Line
                        size="0.78em"
                        color={this.muted}
                    >
                        {this.tx("axis_line_azimuth", { s: this.axisText("azimuth") })}
                    </Line>
                ) : null}
            </Tile>
        );
    }

    private renderTilt(): React.JSX.Element {
        const theme = this.theme;
        const p = theme.palette;
        const deg = this.num("axes.elevation.angle");
        const shown = deg === null ? 0 : Math.max(0, Math.min(90, deg));
        const source = this.str("axes.elevation.angleSource");
        const target = this.num("position.target");
        const astro = this.num("sunPosition.astroTarget");
        const best = this.num("sunPosition.bestTilt");
        let line = "";
        if (target !== null) {
            line = this.tx("tilt_target", { deg: fmt(target) });
        } else if (astro !== null) {
            line = this.tx("tilt_target", { deg: fmt(astro) });
        } else if (best !== null) {
            line = this.tx("tilt_best", { deg: fmt(best) });
        }
        const src =
            source === "hall" ? this.tx("source_hall_short") : source === "time" ? this.tx("source_time_short") : "";
        return (
            <Tile theme={theme}>
                <Label theme={theme}>{this.tx("tilt")}</Label>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: "0.2em", mt: "0.3em" }}>
                    <Box
                        component="span"
                        sx={{ fontSize: "1.9em", fontWeight: 500, lineHeight: 1 }}
                    >
                        {fmt(deg)}
                    </Box>
                    <Box
                        component="span"
                        sx={{ color: this.muted }}
                    >
                        °
                    </Box>
                </Box>
                <Box
                    component="svg"
                    viewBox="0 0 100 56"
                    aria-hidden="true"
                    sx={{ width: "100%", flex: "1 1 auto", minHeight: 0, display: "block" }}
                >
                    <line
                        x1={6}
                        y1={50}
                        x2={94}
                        y2={50}
                        stroke={p.divider}
                        strokeWidth={1.5}
                    />
                    <g transform={`rotate(-${shown} 22 46)`}>
                        <rect
                            x={22}
                            y={43}
                            width={66}
                            height={5}
                            rx={1}
                            fill={deg === null ? p.action.disabled : p.primary.main}
                        />
                    </g>
                    <circle
                        cx={22}
                        cy={46}
                        r={3}
                        fill={p.text.primary}
                    />
                </Box>
                <Line
                    size="0.78em"
                    color={this.muted}
                >
                    {deg === null ? this.tx("unknown_lower") : [line, src].filter(Boolean).join(" · ") || " "}
                </Line>
            </Tile>
        );
    }

    private onToggleAuto = (): void => {
        if (!remoteLock(this).reason) {
            this.write("control.auto", !(this.flag("status.auto") === true));
        }
    };

    private onPark = (): void => {
        if (!remoteLock(this).reason) {
            this.write("control.park", !(this.flag("status.park") === true));
        }
    };

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
        super.renderWidgetBody(props);
        const theme = this.theme;
        const band = statusBand(this, (k, p) => this.tx(k, p));
        const lock = remoteLock(this);
        const auto = this.flag("status.auto") === true;
        const parked = this.flag("status.park") === true;
        const state = this.str("status.state");
        const autoDisabled = !!lock.reason || state === "SETUP";
        const autoSwitch = (
            <Reason title={lock.reason ? this.tx(lock.reason) : undefined}>
                <FormControlLabel
                    labelPlacement="start"
                    disabled={autoDisabled}
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
        const bandColor = band.color;
        const content = (
            <>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "1.05fr 1fr 1fr",
                        gap: "0.5em",
                        flex: "1 1 auto",
                        minHeight: 0,
                    }}
                >
                    {this.renderWind()}
                    {this.renderSun()}
                    {this.renderTilt()}
                </Box>
                <StatusBand
                    theme={theme}
                    color={bandColor}
                    text={band.text}
                    action={
                        state !== "SETUP" ? (
                            <Reason title={lock.reason ? this.tx(lock.reason) : undefined}>
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="inherit"
                                    disabled={!!lock.reason}
                                    onClick={this.onPark}
                                    sx={{
                                        fontSize: "0.75em",
                                        lineHeight: 1.2,
                                        minWidth: 0,
                                        whiteSpace: "nowrap",
                                        px: "0.9em",
                                        py: "0.4em",
                                        borderRadius: "999px",
                                        bgcolor: theme.palette.background.paper,
                                        color: theme.palette.text.primary,
                                        "&:hover": { bgcolor: theme.palette.background.default },
                                        "&.Mui-disabled": {
                                            bgcolor: alpha(theme.palette.background.paper, 0.55),
                                            color: alpha(theme.palette.text.primary, 0.55),
                                        },
                                    }}
                                >
                                    {parked ? this.tx("unpark") : this.tx("park_flat")}
                                </Button>
                            </Reason>
                        ) : null
                    }
                />
            </>
        );
        return this.renderCard(props, content, autoSwitch);
    }
}
