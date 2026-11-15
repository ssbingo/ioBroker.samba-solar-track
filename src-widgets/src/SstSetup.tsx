import React from "react";

import type { RxRenderWidgetProps, RxWidgetInfo } from "@iobroker/types-vis-2";

import { Box, Chip, LinearProgress } from "@mui/material";

import SstWidgetBase, { type SstBaseRxData, type SstBaseState } from "./SstWidgetBase";
import { fmt, plain, sstCommonGroup, sstGrid, VIS_SET } from "./common";
import { Hint, Label, Line, Tile } from "./parts";
import { stateText } from "./theme";

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
            visDefaultStyle: { width: 320, height: 290, position: "absolute" },
            visDefaultGrid: sstGrid(8, 6),
            visResizable: true,
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
    protected titleKey(): string {
        return "SstSetup";
    }

    // eslint-disable-next-line class-methods-use-this
    protected designSize(): [number, number] {
        return [288, 258];
    }

    private row(label: string, value: string, kind: "ok" | "bad" | "" = ""): React.JSX.Element {
        return (
            <Box
                key={label}
                sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5em" }}
            >
                <Line
                    size="0.8em"
                    color={this.muted}
                >
                    {label}
                </Line>
                <Box
                    sx={{
                        fontSize: "0.9em",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        color: stateText(this.theme, kind),
                        flex: "0 0 auto",
                    }}
                >
                    {value}
                </Box>
            </Box>
        );
    }

    // eslint-disable-next-line class-methods-use-this
    private seconds(ms: number | null): string {
        return ms === null || ms <= 0 ? "–" : `${fmt(ms / 1000, 1)} s`;
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
        super.renderWidgetBody(props);
        const theme = this.theme;
        const done = this.flag("commissioning.done");
        if (done === null) {
            return this.renderCard(
                props,
                <Hint theme={theme}>
                    {this.connected() ? this.tx("setup_needs_firmware") : this.tx("band_offline")}
                </Hint>,
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
                passed === true ? "ok" : passed === false ? "bad" : "",
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
                    hall > 0 ? "ok" : "",
                ),
            );
        }
        const status = (
            <Chip
                size="small"
                variant="outlined"
                color={done ? "success" : active ? "info" : "warning"}
                label={plain(done ? this.tx("setup_done") : active ? this.tx("setup_running") : this.tx("setup_open"))}
                sx={{ fontSize: "0.75em", height: "1.9em", maxWidth: "60%" }}
            />
        );
        const content = (
            <>
                <Tile
                    theme={theme}
                    sx={{ gap: "0.3em", flex: "1 1 auto" }}
                >
                    <Box
                        sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5em" }}
                    >
                        <Label theme={theme}>{this.tx("test_report")}</Label>
                        <Line
                            size="0.78em"
                            color={this.muted}
                        >
                            {dateText}
                            {this.flag("commissioning.report.simulation") === true ? ` · ${this.tx("simulation")}` : ""}
                        </Line>
                    </Box>
                    {rows}
                </Tile>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5em" }}>
                    <Label theme={theme}>{this.tx("steps")}</Label>
                    {!done && step ? (
                        <Line size="0.8em">{STEPS.includes(step) ? this.tx(`step_${step}`) : step}</Line>
                    ) : null}
                </Box>
                <LinearProgress
                    variant="determinate"
                    value={Math.round(progress * 100)}
                    color={done ? "success" : "warning"}
                    aria-label={this.tx("steps")}
                    sx={{ height: "0.55em", borderRadius: "0.3em", flex: "0 0 auto" }}
                />
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5em" }}>
                    <Line size="0.8em">
                        {total !== null && shownNumber !== null ? this.tx("steps_of", { n: shownNumber, total }) : "–"}
                    </Line>
                    <Line
                        size="0.75em"
                        color={this.muted}
                    >
                        {this.tx("setup_display_only")}
                    </Line>
                </Box>
            </>
        );
        return this.renderCard(props, content, status);
    }
}
