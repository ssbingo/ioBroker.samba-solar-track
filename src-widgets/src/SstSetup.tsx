import React from "react";

import type { RxRenderWidgetProps, RxWidgetInfo } from "@iobroker/types-vis-2";

import SstWidgetBase, { type SstBaseRxData, type SstBaseState } from "./SstWidgetBase";
import { fmt, sstCommonGroup, VIS_SET } from "./common";

const REL_IDS = [
    "info.connection",
    "status.mode",
    "commissioning.done",
    "commissioning.active",
    "commissioning.step",
    "commissioning.phase",
    "commissioning.number",
    "commissioning.total",
    "commissioning.report.date",
    "commissioning.report.passed",
    "commissioning.report.simulation",
    "commissioning.report.travelSteeper",
    "commissioning.report.travelFlatter",
    "commissioning.report.hallSteps",
    "commissioning.report.azimuthEast",
    "commissioning.report.azimuthWest",
    "commissioning.report.stepsPassed",
    "commissioning.report.stepsSkipped",
    "commissioning.report.stepsOpen",
];

/** Steps of the setup program the widget knows a name for; unknown steps are shown as they come */
const STEPS = [
    "safety",
    "plant",
    "board",
    "wind",
    "flatdir",
    "elevtravel",
    "azimuth",
    "syncreset",
    "position",
    "sensor",
    "network",
    "site",
    "signals",
    "tracktest",
    "done",
];

type SetupRxData = SstBaseRxData;
type SetupState = SstBaseState;

/**
 * Widget 6 - setup program: state of the commissioning (`commissioning.*`, firmware 0.7.0 or newer) and the key
 * values of the newest test report (`commissioning.report.*`, firmware 0.7.6 or newer). Display only: the setup
 * program is operated only at the display, with somebody watching the rack.
 */
export default class SstSetup extends SstWidgetBase<SetupRxData, SetupState> {
    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: "tplSambaSolarTrackSetup",
            visSet: VIS_SET,
            visName: "SstSetup",
            visWidgetLabel: "SstSetup",
            visHelp: "help_setup",
            visAttrs: [sstCommonGroup()],
            visDefaultStyle: { width: 300, height: 250 },
            visPrev: "widgets/samba-solar-track/img/SstSetup.svg",
            visOrder: 6,
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo(): RxWidgetInfo {
        return SstSetup.getWidgetInfo();
    }

    // eslint-disable-next-line class-methods-use-this
    protected relIds(): string[] {
        return REL_IDS;
    }

    // eslint-disable-next-line class-methods-use-this
    private row(label: string, value: string, cls = ""): React.JSX.Element {
        return (
            <div
                className="sst-kr"
                key={label}
            >
                <span className="sst-small">{label}</span>
                <span className={`sst-mid${cls ? ` ${cls}` : ""}`}>{value}</span>
            </div>
        );
    }

    // eslint-disable-next-line class-methods-use-this
    private seconds(ms: number | null): string {
        return ms === null || ms <= 0 ? "–" : `${fmt(ms / 1000, 1)} s`;
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
        super.renderWidgetBody(props);
        const done = this.flag("commissioning.done");
        if (done === null) {
            return this.card(
                <>
                    <div className="sst-head">
                        <div className="sst-ttl">{this.tx("SstSetup")}</div>
                    </div>
                    <div className="sst-hint">
                        {this.connected() ? this.tx("setup_needs_firmware") : this.tx("band_offline")}
                    </div>
                </>,
            );
        }
        const active = this.flag("commissioning.active") === true;
        const total = this.num("commissioning.total");
        const number = this.num("commissioning.number");
        const step = this.str("commissioning.step");
        const shownNumber = done ? total : number !== null ? Math.max(0, number - 1) : null;
        const progress = total && shownNumber !== null ? Math.max(0, Math.min(1, shownNumber / total)) : done ? 1 : 0;
        const date = this.num("commissioning.report.date");
        const passed = this.flag("commissioning.report.passed");
        const dual = this.num("status.mode") === 2;
        const hall = this.num("commissioning.report.hallSteps");
        const lang = SstSetup.getLanguage?.() || "en";
        const dateText = date ? new Date(date).toLocaleDateString(lang === "zh-cn" ? "zh-CN" : lang) : "–";
        const rows = [
            this.row(
                this.tx("report_result"),
                passed === true ? this.tx("report_passed") : passed === false ? this.tx("report_not_passed") : "–",
                passed === true ? "sst-ok" : passed === false ? "sst-bad" : "",
            ),
            this.row(this.tx("report_travel_steeper"), this.seconds(this.num("commissioning.report.travelSteeper"))),
            this.row(this.tx("report_travel_flatter"), this.seconds(this.num("commissioning.report.travelFlatter"))),
        ];
        if (dual) {
            rows.push(
                this.row(this.tx("report_azimuth_east"), this.seconds(this.num("commissioning.report.azimuthEast"))),
            );
            rows.push(
                this.row(this.tx("report_azimuth_west"), this.seconds(this.num("commissioning.report.azimuthWest"))),
            );
        } else if (hall !== null) {
            rows.push(
                this.row(
                    this.tx("report_hall"),
                    hall > 0 ? this.tx("report_hall_ok", { n: hall }) : this.tx("report_hall_off"),
                    hall > 0 ? "sst-ok" : "",
                ),
            );
        }
        return this.card(
            <>
                <div className="sst-head">
                    <div className="sst-ttl">{this.tx("SstSetup")}</div>
                    <span className={`sst-conn ${done ? "sst-ok" : "sst-bad"}`}>
                        {done ? this.tx("setup_done") : active ? this.tx("setup_running") : this.tx("setup_open")}
                    </span>
                </div>
                <div
                    className="sst-tile"
                    style={{ gap: 4, flex: "1 1 auto" }}
                >
                    <div className="sst-kr">
                        <span className="sst-k">{this.tx("test_report")}</span>
                        <span className="sst-small">
                            {dateText}
                            {this.flag("commissioning.report.simulation") === true ? ` · ${this.tx("simulation")}` : ""}
                        </span>
                    </div>
                    {rows}
                </div>
                <div className="sst-kr">
                    <span className="sst-k">{this.tx("steps")}</span>
                    {!done && step ? (
                        <span className="sst-small">{STEPS.includes(step) ? this.tx(`step_${step}`) : step}</span>
                    ) : null}
                </div>
                <div className="sst-bar">
                    <div
                        style={{
                            width: `${Math.round(progress * 100)}%`,
                            background: done ? "var(--sst-auto)" : "var(--sst-warn)",
                        }}
                    />
                </div>
                <div className="sst-kr">
                    <span className="sst-small">
                        {total !== null && shownNumber !== null ? this.tx("steps_of", { n: shownNumber, total }) : "–"}
                    </span>
                    <span className="sst-note">{this.tx("setup_display_only")}</span>
                </div>
            </>,
        );
    }
}
