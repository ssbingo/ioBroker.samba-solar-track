import React from "react";

import type { RxRenderWidgetProps, RxWidgetInfo } from "@iobroker/types-vis-2";

import { Box, Chip } from "@mui/material";

import SstWidgetBase, { type SstBaseRxData, type SstBaseState } from "./SstWidgetBase";
import { fmt, plain, sstCommonGroup, sstGrid, VIS_SET } from "./common";
import { compass } from "./lock";
import { Label, Tile } from "./parts";
import { stateText } from "./theme";

const REL_IDS = [
    "info.connection",
    "info.simulation",
    "info.firmware",
    "wind.ok",
    "wind.speed",
    "wind.gust",
    "wind.hasDirection",
    "wind.directionOk",
    "wind.direction",
    "axes.elevation.angle",
    "axes.elevation.angleSource",
    "sunPosition.elevation",
    "sunPosition.azimuth",
    "battery.fitted",
    "battery.valid",
    "battery.percent",
    "battery.charging",
    "battery.level",
    "supply.v24",
    "supply.v5",
];

type ValuesRxData = SstBaseRxData;
type ValuesState = SstBaseState;

/**
 * Widget 4 - values: wind, gust, direction, tilt, height and azimuth of the sun, battery, 24 V / 5 V, firmware and
 * the connection. A value the firmware does not report (older firmware, feature missing) shows "–".
 */
export default class SstValues extends SstWidgetBase<ValuesRxData, ValuesState> {
    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: "tplSambaSolarTrackValues",
            visSet: VIS_SET,
            visName: "SstValues",
            visWidgetLabel: "SstValues",
            visHelp: "help_values",
            visAttrs: [sstCommonGroup()],
            visDefaultStyle: { width: 380, height: 270, position: "absolute" },
            visDefaultGrid: sstGrid(10, 5),
            visResizable: true,
            visPrev: "widgets/samba-solar-track/img/SstValues.svg",
            visOrder: 4,
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo(): RxWidgetInfo {
        return SstValues.getWidgetInfo();
    }

    // eslint-disable-next-line class-methods-use-this
    protected relIds(): string[] {
        return REL_IDS;
    }

    // eslint-disable-next-line class-methods-use-this
    protected titleKey(): string {
        return "SstValues";
    }

    // eslint-disable-next-line class-methods-use-this
    protected designSize(): [number, number] {
        return [348, 238];
    }

    private tile(label: string, value: string, unit = "", kind: "ok" | "bad" | "warn" | "" = ""): React.JSX.Element {
        return (
            <Tile
                theme={this.theme}
                key={label}
                title={`${label}: ${value}${unit && value !== "–" ? ` ${unit}` : ""}`}
                sx={{ justifyContent: "space-between", gap: "0.15em" }}
            >
                <Label theme={this.theme}>{label}</Label>
                <Box
                    sx={{
                        fontSize: "1.25em",
                        fontWeight: 500,
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: stateText(this.theme, kind),
                    }}
                >
                    {value}
                    {unit && value !== "–" ? (
                        <Box
                            component="span"
                            sx={{ fontSize: "0.6em", color: this.muted, ml: "0.2em", fontWeight: 400 }}
                        >
                            {unit}
                        </Box>
                    ) : null}
                </Box>
            </Tile>
        );
    }

    private battery(): { value: string; unit: string; cls: "ok" | "bad" | "warn" | "" } {
        const percent = this.num("battery.percent");
        if (this.flag("battery.fitted") === false) {
            return { value: this.tx("battery_none"), unit: "", cls: "" };
        }
        if (percent === null || this.flag("battery.valid") === false) {
            return { value: "–", unit: "", cls: "" };
        }
        const level = this.str("battery.level");
        const cls = level === "critical" ? "bad" : level === "low" ? "warn" : "";
        return { value: `${fmt(percent)}`, unit: this.flag("battery.charging") === true ? "% ⚡" : "%", cls };
    }

    private supply(): { value: string; cls: "ok" | "bad" | "" } {
        const v24 = this.flag("supply.v24");
        const v5 = this.flag("supply.v5");
        if (v24 === false) {
            return { value: this.tx("supply_24_missing"), cls: "bad" };
        }
        if (v5 === false) {
            return { value: this.tx("supply_5_missing"), cls: "bad" };
        }
        if (v24 === true && v5 === true) {
            return { value: this.tx("supply_ok"), cls: "ok" };
        }
        return { value: "–", cls: "" };
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
        super.renderWidgetBody(props);
        const connected = this.connected();
        const windOk = this.flag("wind.ok") !== false;
        const dir = this.num("wind.direction");
        const hasDir =
            this.flag("wind.hasDirection") === true && this.flag("wind.directionOk") !== false && dir !== null;
        const source = this.str("axes.elevation.angleSource");
        const battery = this.battery();
        const supply = this.supply();
        const firmware = this.str("info.firmware");
        const status = (
            <Chip
                size="small"
                variant="outlined"
                color={connected ? "success" : "error"}
                label={`${plain(connected ? this.tx("conn_ok") : this.tx("conn_lost"))}${
                    connected && this.flag("info.simulation") === true ? ` · ${this.tx("simulation")}` : ""
                }`}
                sx={{ fontSize: "0.75em", height: "1.9em", maxWidth: "60%" }}
            />
        );
        const content = (
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gridAutoRows: "minmax(0, 1fr)",
                    gap: "0.45em",
                    flex: "1 1 auto",
                    minHeight: 0,
                }}
            >
                {this.tile(this.tx("wind"), fmt(windOk ? this.num("wind.speed") : null, 1), "km/h")}
                {this.tile(this.tx("gust"), fmt(windOk ? this.num("wind.gust") : null, 1), "km/h")}
                {this.tile(
                    this.tx("direction"),
                    hasDir ? fmt(dir) : "–",
                    hasDir ? `° ${compass(dir, this.tx("compass"))}` : "",
                )}
                {this.tile(
                    this.tx("tilt"),
                    fmt(this.num("axes.elevation.angle")),
                    `°${source === "hall" ? ` ${this.tx("source_hall_short")}` : source === "time" ? ` ${this.tx("source_time_short")}` : ""}`,
                )}
                {this.tile(this.tx("sun_height"), fmt(this.num("sunPosition.elevation"), 1), "°")}
                {this.tile(this.tx("sun_azimuth"), fmt(this.num("sunPosition.azimuth")), "°")}
                {this.tile(this.tx("battery"), battery.value, battery.unit, battery.cls)}
                {this.tile(this.tx("supply"), supply.value, "", supply.cls)}
                {this.tile(this.tx("firmware"), firmware || "–")}
            </Box>
        );
        return this.renderCard(props, content, status);
    }
}
