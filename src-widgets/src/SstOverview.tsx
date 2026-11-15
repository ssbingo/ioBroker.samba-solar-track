import React from "react";

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps } from "@iobroker/types-vis-2";

import SstWidgetBase, { type SstBaseRxData, type SstBaseState } from "./SstWidgetBase";
import { BAND_IDS, elevationSteeper, statusBand } from "./band";
import { fmt, sstCommonGroup, VIS_SET } from "./common";
import { BAND_COLORS } from "./styles";
import { compass, LOCK_IDS, remoteLock } from "./lock";

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
 * Widget 1 - overview, like the start page of the display: wind gauge, sun sensor cross-hair, tilt with sketch
 * and the status band (text and colour per state as at the display) with the button PARK FLAT / CANCEL PARKING.
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
            visSetColor: "#2196F3",
            visName: "SstOverview",
            visWidgetLabel: "SstOverview",
            visHelp: "help_overview",
            visAttrs: [sstCommonGroup()],
            visDefaultStyle: { width: 420, height: 290 },
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
        const ok = this.flag("wind.ok") !== false;
        const speed = ok ? this.num("wind.speed") : null;
        const storm = this.num("wind.stormThreshold");
        const full = Math.max(60, storm !== null ? storm * 1.5 : 60);
        const frac = Math.max(0, Math.min(1, (speed ?? 0) / full));
        const a = frac * 270;
        const r = 44;
        const cx = 60;
        const cy = 58;
        const st = (135 * Math.PI) / 180;
        const en = ((135 + a) * Math.PI) / 180;
        const x1 = cx + r * Math.cos(st);
        const y1 = cy + r * Math.sin(st);
        const x2 = cx + r * Math.cos(en);
        const y2 = cy + r * Math.sin(en);
        const arc = `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${a > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
        const gust = this.num("wind.gust");
        const color = speed !== null && storm !== null && (gust ?? speed) >= storm ? BAND_COLORS.red : "#2196F3";
        const dir = this.num("wind.direction");
        const showDir =
            this.flag("wind.hasDirection") === true && this.flag("wind.directionOk") !== false && dir !== null;
        return (
            <div className="sst-tile">
                <div className="sst-k">{this.tx("wind")}</div>
                <svg
                    viewBox="0 0 120 92"
                    style={{ width: "100%", height: "auto", maxHeight: 110, minHeight: 0, flex: "1 1 auto" }}
                    aria-hidden="true"
                >
                    <path
                        d={`M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 1 1 ${(cx + r * Math.cos((45 * Math.PI) / 180)).toFixed(1)} ${(cy + r * Math.sin((45 * Math.PI) / 180)).toFixed(1)}`}
                        fill="none"
                        stroke="#2a3350"
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
                        y={62}
                        textAnchor="middle"
                        fontSize={22}
                        fontWeight={600}
                        fill="#fff"
                    >
                        {fmt(speed, 1)}
                    </text>
                    <text
                        x={60}
                        y={76}
                        textAnchor="middle"
                        fontSize={8}
                        fill="#8A93A6"
                    >
                        km/h
                    </text>
                    {storm !== null ? (
                        <text
                            x={60}
                            y={91}
                            textAnchor="middle"
                            fontSize={8}
                            fontWeight={600}
                            fill="#FFCC00"
                        >
                            {this.tx("storm_from", { v: fmt(storm) })}
                        </text>
                    ) : null}
                </svg>
                {!ok ? (
                    <div className="sst-small sst-bad">{this.tx("wind_fault")}</div>
                ) : showDir ? (
                    <div className="sst-small sst-gold">
                        {this.tx("wind_from", { dir: compass(dir, this.tx("compass")), deg: fmt(dir) })}
                    </div>
                ) : null}
                <div className="sst-mid">{this.tx("gust_value", { v: fmt(ok ? gust : null, 1) })}</div>
                <div className="sst-small">{this.tx("max_gust_value", { v: fmt(this.num("wind.maxGust"), 1) })}</div>
            </div>
        );
    }

    private renderSun(): React.JSX.Element {
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
            <div className="sst-tile">
                <div className="sst-k">{this.tx("sun_sensor")}</div>
                <svg
                    viewBox="0 0 100 100"
                    style={{
                        width: "100%",
                        height: "auto",
                        maxHeight: 104,
                        margin: "4px 0",
                        flex: "1 1 auto",
                        minHeight: 0,
                    }}
                    aria-hidden="true"
                >
                    <circle
                        cx={50}
                        cy={50}
                        r={42}
                        fill="#000"
                        stroke="#8A93A6"
                        strokeWidth={1}
                    />
                    <line
                        x1={8}
                        y1={50}
                        x2={92}
                        y2={50}
                        stroke="#8A93A6"
                        strokeWidth={0.8}
                    />
                    <line
                        x1={50}
                        y1={8}
                        x2={50}
                        y2={92}
                        stroke="#8A93A6"
                        strokeWidth={0.8}
                    />
                    <circle
                        cx={50}
                        cy={50}
                        r={10}
                        fill="none"
                        stroke="#2196F3"
                        strokeWidth={0.8}
                    />
                    {ok ? (
                        <circle
                            cx={x}
                            cy={y}
                            r={5}
                            fill="#FFCC00"
                            opacity={night ? 0.25 : 1}
                        />
                    ) : null}
                    <text
                        x={12}
                        y={48}
                        fontSize={7}
                        fill="#8A93A6"
                    >
                        {dirs[2] || ""}
                    </text>
                    <text
                        x={83}
                        y={48}
                        fontSize={7}
                        fill="#8A93A6"
                    >
                        {dirs[6] || ""}
                    </text>
                </svg>
                <div className="sst-mid sst-gold">
                    {ok ? this.tx("deviation_single", { el: sign(eEl) }) : this.tx("sensor_missing")}
                </div>
                {dual && ok ? (
                    <div className="sst-small sst-gold">{this.tx("deviation_azimuth", { az: sign(eAz) })}</div>
                ) : null}
                <div className="sst-small">{this.tx("axis_line_elevation", { s: this.axisText("elevation") })}</div>
                {dual ? (
                    <div className="sst-small">{this.tx("axis_line_azimuth", { s: this.axisText("azimuth") })}</div>
                ) : null}
            </div>
        );
    }

    private renderTilt(): React.JSX.Element {
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
            <div className="sst-tile">
                <div className="sst-k">{this.tx("tilt")}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "6px 0 2px" }}>
                    <span className="sst-big">{fmt(deg)}</span>
                    <span className="sst-small">°</span>
                </div>
                <svg
                    viewBox="0 0 100 56"
                    style={{ width: "100%", height: "auto", maxHeight: 60, flex: "1 1 auto", minHeight: 0 }}
                    aria-hidden="true"
                >
                    <line
                        x1={6}
                        y1={50}
                        x2={94}
                        y2={50}
                        stroke="#8A93A6"
                        strokeWidth={1.5}
                    />
                    <g transform={`rotate(-${shown} 22 46)`}>
                        <rect
                            x={22}
                            y={43}
                            width={66}
                            height={5}
                            rx={1}
                            fill={deg === null ? "#3a4256" : "#2196F3"}
                        />
                    </g>
                    <circle
                        cx={22}
                        cy={46}
                        r={3}
                        fill="#fff"
                    />
                </svg>
                <div className="sst-small">
                    {deg === null ? this.tx("unknown_lower") : [line, src].filter(Boolean).join(" · ") || " "}
                </div>
            </div>
        );
    }

    private onToggleAuto = (): void => {
        this.write("control.auto", !(this.flag("status.auto") === true));
    };

    private onPark = (): void => {
        this.write("control.park", !(this.flag("status.park") === true));
    };

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
        super.renderWidgetBody(props);
        const band = statusBand(this, (k, p) => this.tx(k, p));
        const lock = remoteLock(this);
        const auto = this.flag("status.auto") === true;
        const parked = this.flag("status.park") === true;
        const state = this.str("status.state");
        return this.card(
            <>
                <div className="sst-head">
                    <div
                        className="sst-logo"
                        aria-hidden="true"
                    />
                    <div className="sst-ttl">Samba Solar Track</div>
                    <span className="sst-conn">{this.tx("automatic")}</span>
                    <button
                        type="button"
                        className="sst-sw"
                        role="switch"
                        aria-checked={auto}
                        aria-label={this.tx("automatic")}
                        title={lock.reason ? this.tx(lock.reason) : this.tx("automatic")}
                        disabled={!!lock.reason || state === "SETUP"}
                        onClick={this.onToggleAuto}
                    />
                </div>
                <div
                    className="sst-tiles"
                    style={{ gridTemplateColumns: "1.05fr 1fr 1fr" }}
                >
                    {this.renderWind()}
                    {this.renderSun()}
                    {this.renderTilt()}
                </div>
                <div
                    className="sst-band"
                    style={{ background: BAND_COLORS[band.color] }}
                >
                    <span
                        className="sst-t"
                        title={band.text}
                    >
                        {band.text}
                    </span>
                    {state !== "SETUP" ? (
                        <button
                            type="button"
                            className="sst-pill"
                            disabled={!!lock.reason}
                            title={lock.reason ? this.tx(lock.reason) : undefined}
                            onClick={this.onPark}
                        >
                            {parked ? this.tx("unpark") : this.tx("park_flat")}
                        </button>
                    ) : null}
                </div>
            </>,
        );
    }
}
