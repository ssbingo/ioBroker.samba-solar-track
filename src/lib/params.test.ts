import { expect } from "chai";
import FIRMWARE_PARAMS from "../../test/mock-params";
import {
    groupName,
    paramCommon,
    paramStateId,
    parseParam,
    parseParams,
    pendingMap,
    readParamResult,
    toDeviceValue,
    type ParamEntry,
} from "./params";

/**
 * A setting from the list the firmware prints.
 *
 * @param key key of the setting
 */
function firmware(key: string): ParamEntry {
    const entry = parseParam(FIRMWARE_PARAMS.find(p => p.key === key));
    if (!entry) {
        throw new Error(`setting ${key} is missing in the list of the firmware`);
    }
    return entry;
}

describe("params => parseParams", () => {
    it("accepts every setting the firmware reports", () => {
        const { entries, dropped } = parseParams(FIRMWARE_PARAMS);
        expect(dropped).to.equal(0);
        expect(entries).to.have.length(32);
        expect(new Set(entries.map(e => e.group))).to.deep.equal(
            new Set(["safety", "commissioning", "control", "diagnostics"]),
        );
    });

    it("reads types, limits and the way a change becomes valid", () => {
        expect(firmware("stormKmh")).to.deep.equal({
            key: "stormKmh",
            group: "safety",
            type: "float",
            unit: "km/h",
            value: 40,
            default: 40,
            min: 20,
            max: 60,
            apply: "confirm",
            pending: null,
        });
        expect(firmware("limitSwitchesElevation")).to.include({
            type: "bool",
            value: true,
            min: null,
            max: null,
            apply: "standstill",
        });
        expect(firmware("trackStartPermille")).to.include({ type: "int", apply: "now", min: 30, max: 300 });
    });

    it("drops entries it cannot use and counts them", () => {
        const { entries, dropped } = parseParams([
            { key: "stormKmh", group: "safety", type: "float", value: 40 },
            { key: "noType", group: "safety", value: 1 },
            { key: "wrongValue", group: "safety", type: "int", value: "12" },
            { key: "bad.key", group: "safety", type: "int", value: 1 },
            { key: "x", group: "bad group", type: "int", value: 1 },
            "text",
        ]);
        expect(entries.map(e => e.key)).to.deep.equal(["stormKmh"]);
        expect(dropped).to.equal(5);
        expect(entries[0]).to.include({ unit: "", default: 40, min: null, max: null, apply: "now", pending: null });
    });

    it("gives an empty list for something that is no list", () => {
        expect(parseParams(undefined)).to.deep.equal({ entries: [], dropped: 0 });
        expect(parseParams({ params: [] })).to.deep.equal({ entries: [], dropped: 0 });
    });
});

describe("params => states", () => {
    it("builds the id from group and key", () => {
        expect(paramStateId(firmware("stormKmh"))).to.equal("params.safety.stormKmh");
        expect(paramStateId(firmware("logLevel"))).to.equal("params.diagnostics.logLevel");
    });

    it("describes a number with unit, limits and default", () => {
        expect(paramCommon(firmware("stormKmh"))).to.deep.equal({
            name: {
                en: "Storm threshold (gust) (needs confirmation at the display)",
                de: "Sturmschwelle (Böe) (braucht die Bestätigung am Display)",
            },
            type: "number",
            role: "level",
            read: true,
            write: true,
            def: 40,
            unit: "km/h",
            min: 20,
            max: 60,
        });
    });

    it("describes a yes/no value as a switch without limits", () => {
        const common = paramCommon(firmware("nightReturnEast"));
        expect(common).to.include({ type: "boolean", role: "switch", def: true });
        expect(common).to.not.have.property("min");
        expect(common).to.not.have.property("unit");
    });

    it("translates the units the device writes in ASCII", () => {
        expect(paramCommon(firmware("trackStartPermille")).unit).to.equal("‰");
        expect(paramCommon(firmware("windDirScale")).unit).to.equal("°");
    });

    it("has a name in English and German for every setting of the firmware", () => {
        for (const entry of parseParams(FIRMWARE_PARAMS).entries) {
            const name = paramCommon(entry).name as { en: string; de: string };
            expect(name.en.startsWith(entry.key), `${entry.key} has no English name`).to.equal(false);
            expect(name.de.startsWith(entry.key), `${entry.key} has no German name`).to.equal(false);
        }
    });

    it("shows a setting it does not know yet with its key", () => {
        const entry = parseParam({ key: "brandNew", group: "future", type: "int", value: 1 });
        expect(paramCommon(entry!).name).to.deep.equal({ en: "brandNew", de: "brandNew" });
        expect(groupName("future")).to.deep.equal({ en: "Settings: future", de: "Einstellungen: future" });
    });
});

describe("params => toDeviceValue", () => {
    it("passes numbers and accepts numbers written as text", () => {
        expect(toDeviceValue(firmware("stormKmh"), 45.5)).to.equal(45.5);
        expect(toDeviceValue(firmware("stormKmh"), "45")).to.equal(45);
    });

    it("refuses what is no number", () => {
        expect(toDeviceValue(firmware("stormKmh"), "fast")).to.equal(undefined);
        expect(toDeviceValue(firmware("stormKmh"), "")).to.equal(undefined);
        expect(toDeviceValue(firmware("stormKmh"), true)).to.equal(undefined);
        expect(toDeviceValue(firmware("stormKmh"), null)).to.equal(undefined);
        expect(toDeviceValue(firmware("stormKmh"), Number.NaN)).to.equal(undefined);
    });

    it("accepts the usual ways to write yes and no", () => {
        const entry = firmware("nightReturnEast");
        expect(toDeviceValue(entry, false)).to.equal(false);
        expect(toDeviceValue(entry, 1)).to.equal(true);
        expect(toDeviceValue(entry, "false")).to.equal(false);
        expect(toDeviceValue(entry, 5)).to.equal(undefined);
        expect(toDeviceValue(entry, "yes")).to.equal(undefined);
    });
});

describe("params => readParamResult", () => {
    const answer = {
        ok: true,
        results: {
            trackStartPermille: { result: "applied", value: 100 },
            stormKmh: { result: "pending", value: 40, pending: 45 },
            windBaud: { result: "rejected", reason: "range" },
            odd: { result: "maybe" },
        },
    };

    it("reads applied, pending and rejected", () => {
        expect(readParamResult(answer, "trackStartPermille")).to.include({ result: "applied", value: 100 });
        expect(readParamResult(answer, "stormKmh")).to.include({ result: "pending", value: 40, pending: 45 });
        expect(readParamResult(answer, "windBaud")).to.include({ result: "rejected", reason: "range" });
    });

    it("gives undefined for a missing or unknown result", () => {
        expect(readParamResult(answer, "missing")).to.equal(undefined);
        expect(readParamResult(answer, "odd")).to.equal(undefined);
        expect(readParamResult({ ok: false, reason: "auth" }, "stormKmh")).to.equal(undefined);
        expect(readParamResult(undefined, "stormKmh")).to.equal(undefined);
    });
});

describe("params => pendingMap", () => {
    it("lists only the settings with a waiting proposal", () => {
        const storm = { ...firmware("stormKmh"), pending: 45 };
        const park = { ...firmware("stormParkElevationPlus"), pending: false };
        expect(pendingMap([storm, firmware("windBaud"), park])).to.deep.equal({
            stormKmh: 45,
            stormParkElevationPlus: false,
        });
        expect(pendingMap([])).to.deep.equal({});
    });
});
