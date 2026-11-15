import React from "react";

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps } from "@iobroker/types-vis-2";

import SstWidgetBase, { type SstBaseRxData, type SstBaseState } from "./SstWidgetBase";
import { clock, fmt, sstCommonGroup, VIS_SET } from "./common";
import { compass } from "./lock";

const REL_IDS = [
    "info.connection",
    "status.state",
    "status.mode",
    "sunPosition.known",
    "sunPosition.timeOk",
    "sunPosition.siteSet",
    "sunPosition.latitude",
    "sunPosition.azimuth",
    "sunPosition.elevation",
    "sunPosition.sunrise",
    "sunPosition.sunset",
    "sunPosition.noon",
    "sunPosition.noonElevation",
    "sunPosition.alwaysUp",
    "sunPosition.alwaysDown",
    "sunPosition.night",
    "sunPosition.nightStart",
    "sunPosition.dayStart",
    "sunPosition.rackAzimuth",
    "sunPosition.bestTilt",
];

/** Drawing area of the day (viewBox 380 x 170): x of 0:00 and 24:00, the horizon and the top */
const X0 = 10;
const X1 = 370;
const BASE = 142;
const TOP = 30;

type SunRxData = SstBaseRxData;
type SunState = SstBaseState;

/**
 * Widget 5 - position of the sun today, from `sunPosition.*` (firmware 0.7.0 or newer, feature `sunpos`): arc of
 * the day between sunrise and sunset, noon with its height, the night windows, the sun now, the orientation of the
 * rack and the best tilt (one axis only). The times are shown in the time zone of the browser.
 */
export default class SstSunPath extends SstWidgetBase<SunRxData, SunState> {
    constructor(props: VisRxWidgetProps) {
        super(props);
        this.tickMs = 60000; // the sun moves on the arc between two values of the device
    }

    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: "tplSambaSolarTrackSunPath",
            visSet: VIS_SET,
            visName: "SstSunPath",
            visWidgetLabel: "SstSunPath",
            visHelp: "help_sun_path",
            visAttrs: [sstCommonGroup()],
            visDefaultStyle: { width: 400, height: 250 },
            visPrev: "widgets/samba-solar-track/img/SstSunPath.svg",
            visOrder: 5,
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo(): RxWidgetInfo {
        return SstSunPath.getWidgetInfo();
    }

    // eslint-disable-next-line class-methods-use-this
    protected relIds(): string[] {
        return REL_IDS;
    }

    /** x of a time of day (local time of the browser) on the drawing */
    private static xOf(ms: number, dayStart: number): number {
        const f = Math.max(0, Math.min(1, (ms - dayStart) / 86400000));
        return X0 + f * (X1 - X0);
    }

    private hint(text: string): React.JSX.Element {
        return this.card(
            <>
                <div className="sst-head">
                    <div className="sst-ttl">{this.tx("SstSunPath")}</div>
                </div>
                <div className="sst-hint">{text}</div>
            </>,
        );
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
        super.renderWidgetBody(props);
        const known = this.flag("sunPosition.known");
        if (known === null) {
            return this.hint(this.connected() ? this.tx("sun_needs_firmware") : this.tx("band_offline"));
        }
        if (!known) {
            return this.hint(
                this.flag("sunPosition.timeOk") === false
                    ? this.tx("sun_no_time")
                    : this.flag("sunPosition.siteSet") === false
                      ? this.tx("sun_no_site")
                      : this.tx("sun_unknown"),
            );
        }
        const rise = this.num("sunPosition.sunrise");
        const set = this.num("sunPosition.sunset");
        const noon = this.num("sunPosition.noon");
        const noonEl = this.num("sunPosition.noonElevation");
        const el = this.num("sunPosition.elevation");
        const nightStart = this.num("sunPosition.nightStart");
        const dayStartTime = this.num("sunPosition.dayStart");
        const ref = noon ?? rise ?? Date.now();
        const midnight = new Date(ref);
        midnight.setHours(0, 0, 0, 0);
        const day = midnight.getTime();
        const xRise = rise !== null ? SstSunPath.xOf(rise, day) : X0;
        const xSet = set !== null ? SstSunPath.xOf(set, day) : X1;
        const xNoon = noon !== null ? SstSunPath.xOf(noon, day) : (xRise + xSet) / 2;
        // apex of the arc: height of the sun at noon, 90° = top of the drawing
        const apex = BASE - Math.max(0.12, Math.min(1, (noonEl ?? 30) / 90)) * (BASE - TOP);
        const ctrlY = 2 * apex - BASE; // quadratic curve through the apex
        const point = (t: number): [number, number] => {
            const x = (1 - t) * (1 - t) * xRise + 2 * t * (1 - t) * ((xRise + xSet) / 2) + t * t * xSet;
            const y = (1 - t) * (1 - t) * BASE + 2 * t * (1 - t) * ctrlY + t * t * BASE;
            return [x, y];
        };
        const now = Date.now();
        const up = rise !== null && set !== null && now >= rise && now <= set;
        const tNow = up ? (now - rise) / (set - rise) : 0;
        const steps = 48;
        const donePts: string[] = [];
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * tNow;
            const [x, y] = point(t);
            donePts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        }
        const [sx, sy] = point(tNow);
        const alwaysUp = this.flag("sunPosition.alwaysUp") === true;
        const alwaysDown = this.flag("sunPosition.alwaysDown") === true;
        const lat = this.num("sunPosition.latitude");
        const rackAz = this.num("sunPosition.rackAzimuth");
        const best = this.num("sunPosition.bestTilt");
        const state = this.str("status.state");
        const bearing = rackAz !== null ? (((180 + rackAz) % 360) + 360) % 360 : null;
        const footer: string[] = [];
        if (bearing !== null) {
            footer.push(this.tx("rack_orientation", { deg: fmt(bearing), dir: compass(bearing, this.tx("compass")) }));
        }
        if (best !== null) {
            footer.push(this.tx("best_tilt", { deg: fmt(best) }));
        }
        const latText =
            lat !== null
                ? `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? this.tx("lat_north") : this.tx("lat_south")}`
                : "";
        return this.card(
            <>
                <div className="sst-head">
                    <div className="sst-ttl">{this.tx("SstSunPath")}</div>
                    <span className="sst-conn">{latText}</span>
                </div>
                <svg
                    viewBox="0 0 380 170"
                    style={{ width: "100%", height: "auto", flex: "1 1 auto", minHeight: 0 }}
                    role="img"
                    aria-label={this.tx("SstSunPath")}
                >
                    <rect
                        x={0}
                        y={0}
                        width={380}
                        height={170}
                        fill="#12161F"
                    />
                    {dayStartTime !== null ? (
                        <rect
                            x={X0}
                            y={20}
                            width={Math.max(0, SstSunPath.xOf(dayStartTime, day) - X0)}
                            height={BASE - 20}
                            fill="#8E44AD"
                            opacity={0.16}
                        />
                    ) : null}
                    {nightStart !== null ? (
                        <rect
                            x={SstSunPath.xOf(nightStart, day)}
                            y={20}
                            width={Math.max(0, X1 - SstSunPath.xOf(nightStart, day))}
                            height={BASE - 20}
                            fill="#8E44AD"
                            opacity={0.16}
                        />
                    ) : null}
                    {alwaysDown ? (
                        <rect
                            x={X0}
                            y={20}
                            width={X1 - X0}
                            height={BASE - 20}
                            fill="#8E44AD"
                            opacity={0.16}
                        />
                    ) : null}
                    <line
                        x1={X0}
                        y1={BASE}
                        x2={X1}
                        y2={BASE}
                        stroke="#8A93A6"
                        strokeWidth={1}
                    />
                    {rise !== null && set !== null ? (
                        <>
                            <path
                                d={`M${xRise.toFixed(1)} ${BASE} Q${((xRise + xSet) / 2).toFixed(1)} ${ctrlY.toFixed(1)} ${xSet.toFixed(1)} ${BASE}`}
                                fill="none"
                                stroke="#2a3350"
                                strokeWidth={3}
                            />
                            {up ? (
                                <polyline
                                    points={donePts.join(" ")}
                                    fill="none"
                                    stroke="#FFCC00"
                                    strokeWidth={3}
                                />
                            ) : null}
                            {noon !== null ? (
                                <line
                                    x1={xNoon}
                                    y1={BASE}
                                    x2={xNoon}
                                    y2={apex - 4}
                                    stroke="#8A93A6"
                                    strokeDasharray="3 3"
                                />
                            ) : null}
                            {up ? (
                                <>
                                    <circle
                                        cx={sx}
                                        cy={sy}
                                        r={8}
                                        fill="#FFCC00"
                                    />
                                    <text
                                        x={sx}
                                        y={sy - 14}
                                        textAnchor="middle"
                                        fontSize={11}
                                        fontWeight={700}
                                        fill="#fff"
                                    >
                                        {`${fmt(el, 1)}°`}
                                    </text>
                                </>
                            ) : null}
                            <text
                                x={xRise}
                                y={158}
                                textAnchor="middle"
                                fontSize={10}
                                fill="#8A93A6"
                            >
                                {`↑ ${clock(rise)}`}
                            </text>
                            <text
                                x={xNoon}
                                y={158}
                                textAnchor="middle"
                                fontSize={10}
                                fill="#8A93A6"
                            >
                                {`${clock(noon)} · ${fmt(noonEl, 1)}°`}
                            </text>
                            <text
                                x={xSet}
                                y={158}
                                textAnchor="middle"
                                fontSize={10}
                                fill="#8A93A6"
                            >
                                {`↓ ${clock(set)}`}
                            </text>
                        </>
                    ) : (
                        <text
                            x={190}
                            y={90}
                            textAnchor="middle"
                            fontSize={12}
                            fill="#8A93A6"
                        >
                            {alwaysUp ? this.tx("polar_day") : alwaysDown ? this.tx("polar_night") : "–"}
                        </text>
                    )}
                    {dayStartTime !== null && SstSunPath.xOf(dayStartTime, day) - X0 > 40 ? (
                        <text
                            x={(X0 + SstSunPath.xOf(dayStartTime, day)) / 2}
                            y={34}
                            textAnchor="middle"
                            fontSize={9}
                            fill="#c79ae0"
                        >
                            {this.tx("night")}
                        </text>
                    ) : null}
                    {nightStart !== null && X1 - SstSunPath.xOf(nightStart, day) > 40 ? (
                        <text
                            x={(X1 + SstSunPath.xOf(nightStart, day)) / 2}
                            y={34}
                            textAnchor="middle"
                            fontSize={9}
                            fill="#c79ae0"
                        >
                            {this.tx("night")}
                        </text>
                    ) : null}
                    {!up && rise !== null && set !== null ? (
                        <text
                            x={190}
                            y={70}
                            textAnchor="middle"
                            fontSize={11}
                            fill="#8A93A6"
                        >
                            {this.tx("sun_below", { deg: fmt(el, 1) })}
                        </text>
                    ) : null}
                </svg>
                <div className="sst-kr">
                    <span className="sst-small">{footer.join(" · ") || " "}</span>
                    <span className="sst-small sst-gold">{state ? this.tx(`state_${state}`) : ""}</span>
                </div>
            </>,
        );
    }
}
