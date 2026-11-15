import { expect } from "chai";
import { FEATURES_078, MockDevice, reportData } from "../../test/mock-device";
import {
    NODES,
    STATES,
    elevationLabelStates,
    infoToValues,
    isAvailable,
    reportToValues,
    statusToValues,
    type Layout,
} from "./states";

/**
 * Status of the mock device with every feature of firmware 0.7.8.
 *
 * @param mode operating mode
 */
function status078(mode: 1 | 2): Record<string, unknown> {
    return new MockDevice({ features: FEATURES_078, mode }).statusBody();
}

/** Features of firmware 0.7.8 */
const ALL: ReadonlySet<string> = new Set(FEATURES_078);

/** Example of GET /api/status from PROTOCOL.md */
const STATUS = {
    bootId: "a3f91c20",
    uptimeMs: 123456,
    logNext: 4812,
    logLost: 0,
    heapFree: 180000,
    wifiRssi: -61,
    simulation: false,
    design: 0,
    state: "IDLE",
    auto: true,
    setupDone: true,
    mode: 2,
    windSensor: 1,
    park: false,
    remoteLocked: false,
    fault: { io: false, motor: false },
    storm: { active: false, remainingMs: 0 },
    axes: {
        elevation: {
            enabled: true,
            out: 0,
            limitPlus: false,
            limitMinus: false,
            blockedPlus: false,
            blockedMinus: false,
            fault: false,
            errPermille: 7,
        },
        azimuth: {
            enabled: true,
            out: -1,
            limitPlus: false,
            limitMinus: true,
            blockedPlus: false,
            blockedMinus: true,
            fault: false,
            errPermille: 1,
        },
    },
    sun: { ok: true, east: 15130, west: 15070, south: 14990, north: 15210 },
    wind: {
        ok: true,
        kmh: 12.4,
        gustKmh: 14.1,
        maxGustKmh: 22.3,
        stormKmh: 40.0,
        hasDirection: false,
        dirOk: false,
        dirDeg: null,
    },
    io: { relayOk: true, ledOk: true },
    supply: { monitored: true, sensorFault: false, ledFault: false },
    leds: { ready: "on", fail: "off" },
    jog: { active: false, axis: null, dir: 0 },
    pendingConfirm: ["stormKmh"],
    counters: {
        relayIoErrors: 0,
        ledIoErrors: 0,
        lightErrors: 0,
        windErrors: 3,
        windDirErrors: 0,
        sensorSupplyFaults: 0,
        ledSupplyFaults: 0,
    },
};

describe("states => definitions", () => {
    it("have unique ids", () => {
        const ids = [...NODES.map(n => n.id), ...STATES.map(s => s.id)];
        expect(new Set(ids).size).to.equal(ids.length);
    });

    it("never use the generic role and always have a name in English and German", () => {
        for (const def of STATES) {
            expect(def.role, def.id).to.be.a("string").and.not.equal("state");
            expect(def.name.en, def.id).to.be.a("string").and.not.equal("");
            expect(def.name.de, def.id).to.be.a("string").and.not.equal("");
        }
    });

    it("keep the hierarchy: every state lies in a channel, no state below a state", () => {
        const nodes = new Set([...NODES.map(n => n.id), "info"]);
        const states = new Set(STATES.map(s => s.id));
        for (const def of STATES) {
            const parent = def.id.slice(0, def.id.lastIndexOf("."));
            expect(nodes.has(parent), `${def.id} needs the channel ${parent}`).to.equal(true);
            expect(states.has(parent), `${def.id} lies below a state`).to.equal(false);
        }
    });

    it("declare channels and folders before their children", () => {
        const seen = new Set<string>();
        for (const node of NODES) {
            const dot = node.id.lastIndexOf(".");
            if (dot > 0) {
                expect(seen.has(node.id.slice(0, dot)), node.id).to.equal(true);
            }
            seen.add(node.id);
        }
    });
});

describe("states => statusToValues", () => {
    const values = statusToValues(STATUS);

    it("maps the example of PROTOCOL.md", () => {
        expect(values.get("status.state")).to.equal("IDLE");
        expect(values.get("status.auto")).to.equal(true);
        expect(values.get("status.mode")).to.equal(2);
        expect(values.get("status.faultMotor")).to.equal(false);
        expect(values.get("axes.elevation.deviation")).to.equal(7);
        expect(values.get("axes.azimuth.output")).to.equal(-1);
        expect(values.get("axes.azimuth.limitMinus")).to.equal(true);
        expect(values.get("sun.north")).to.equal(15210);
        expect(values.get("wind.speed")).to.equal(12.4);
        expect(values.get("wind.stormThreshold")).to.equal(40);
        expect(values.get("leds.ready")).to.equal("on");
        expect(values.get("counters.windErrors")).to.equal(3);
        expect(values.get("counters.logLost")).to.equal(0);
        expect(values.get("info.bootId")).to.equal("a3f91c20");
    });

    it("converts milliseconds to whole seconds", () => {
        expect(values.get("info.uptime")).to.equal(123);
        expect(statusToValues({ storm: { active: true, remainingMs: 61999 } }).get("status.stormRemaining")).to.equal(
            61,
        );
    });

    it("keeps null for values the device does not have", () => {
        expect(values.has("wind.direction")).to.equal(true);
        expect(values.get("wind.direction")).to.equal(null);
        expect(values.get("jog.axis")).to.equal(null);
    });

    it("writes lists as JSON", () => {
        expect(values.get("status.pendingConfirm")).to.equal('["stormKmh"]');
    });

    it("leaves out values that are missing or have the wrong type", () => {
        const partial = statusToValues({ state: 5, auto: "yes", wind: { kmh: "12" }, unknownField: 1 });
        expect(partial.has("status.state")).to.equal(false);
        expect(partial.has("status.auto")).to.equal(false);
        expect(partial.has("wind.speed")).to.equal(false);
        expect(partial.size).to.equal(0);
    });

    it("covers every state that reads from the status (firmware 0.7.8, both operating modes)", () => {
        const one = statusToValues(status078(1), { features: ALL, mode: 1 });
        const two = statusToValues(status078(2), { features: ALL, mode: 2 });
        for (const def of STATES.filter(d => d.status)) {
            expect(one.has(def.id) || two.has(def.id), def.id).to.equal(true);
        }
    });

    it("maps the new states of the controller and keeps unknown ones", () => {
        for (const state of ["POSITION", "COMMISSION", "ASTRO", "SOMETHINGNEW"]) {
            expect(statusToValues({ state }).get("status.state")).to.equal(state);
        }
        const def = STATES.find(d => d.id === "status.state");
        expect(def?.states).to.include({
            POSITION: "Tilt on command",
            COMMISSION: "Setup program not completed",
            ASTRO: "Automatic: cloudy, calculated angle",
        });
    });
});

describe("states => features and operating mode", () => {
    const old: Layout = { features: new Set(["status", "log", "command", "jog", "park", "setup", "params"]), mode: 2 };

    it("leaves out the states of features an older firmware does not report", () => {
        const values = statusToValues(status078(1), { ...old, mode: 1 });
        for (const id of values.keys()) {
            expect(/^(sunPosition|position|commissioning|firmware|battery|update)\./.test(id), id).to.equal(false);
            expect(/^supply\.(v24|v5|adcOk|checks)$/.test(id), id).to.equal(false);
            expect(id.includes("syncReset"), id).to.equal(false);
        }
        expect(values.get("axes.elevation.angle")).to.equal(38);
    });

    it("creates the tilt on command and the rack orientation only with one axis", () => {
        const one = statusToValues(status078(1), { features: ALL, mode: 1 });
        const two = statusToValues(status078(2), { features: ALL, mode: 2 });
        expect(one.get("position.angle")).to.equal(38);
        expect(one.get("sunPosition.bestTilt")).to.equal(68.5);
        expect(one.has("axes.azimuth.syncResetPort")).to.equal(false);
        expect(two.has("position.angle")).to.equal(false);
        expect(two.has("sunPosition.rackAzimuth")).to.equal(false);
        expect(two.get("axes.azimuth.syncResetPort")).to.equal("off");
        const control = (id: string): boolean =>
            isAvailable(
                STATES.find(d => d.id === id)!,
                { features: ALL, mode: 2 },
            );
        expect(control("control.position")).to.equal(false);
        expect(control("control.syncResetAzimuth")).to.equal(true);
        expect(control("control.fwInstall")).to.equal(true);
    });

    it("has a channel for every conditional state with the same or a weaker condition", () => {
        for (const def of STATES.filter(d => d.feature || d.mode)) {
            const parent = NODES.find(n => n.id === def.id.slice(0, def.id.lastIndexOf(".")));
            // the Hall tap exists only with the tilt on command, the report data set only with the setup program
            const implied: Record<string, string> = {
                hall: "position",
                reportjson: "commissioning",
                updatepark: "update",
            };
            if (parent?.feature) {
                const feature = def.feature ?? "";
                expect([feature, implied[feature]].includes(parent.feature), def.id).to.equal(true);
                expect(parent.mode === undefined || parent.mode === def.mode, def.id).to.equal(true);
            }
        }
    });
});

describe("states => position of the sun, tilt, setup program, firmware", () => {
    const values = statusToValues(status078(1), { features: ALL, mode: 1 });

    it("converts the times of the sun from Unix seconds to ms and keeps null", () => {
        expect(values.get("sunPosition.sunrise")).to.equal(1794291186000);
        expect(values.get("sunPosition.sunset")).to.equal(1794324284000);
        expect(values.get("sunPosition.noon")).to.equal(1794307735000);
        expect(values.get("sunPosition.latitude")).to.equal(51.0504);
        expect(values.get("sunPosition.azimuth")).to.equal(190.5);
        expect(values.get("sunPosition.astroTarget")).to.equal(null);
        const unknown = statusToValues(
            { sunPos: { known: false, rise: null, set: null, lat: null, night: false } },
            { features: ALL, mode: 2 },
        );
        expect(unknown.get("sunPosition.sunrise")).to.equal(null);
        expect(unknown.get("sunPosition.latitude")).to.equal(null);
        expect(unknown.get("sunPosition.night")).to.equal(false);
    });

    it("maps the tilt on command with the Hall tap", () => {
        expect(values.get("position.target")).to.equal(null);
        expect(values.get("control.position")).to.equal(null);
        expect(values.get("position.presets")).to.equal("[0,15,30,45,60]");
        expect(values.get("position.source")).to.equal("hall");
        expect(values.get("position.hallCount")).to.equal(15620);
        expect(values.get("position.hallFault")).to.equal(null);
        expect(values.get("position.wait")).to.equal(0);
    });

    it("maps the setup program, the reset of the synchronous control and the firmware", () => {
        expect(values.get("commissioning.done")).to.equal(true);
        expect(values.get("commissioning.step")).to.equal("done");
        expect(values.get("commissioning.total")).to.equal(13);
        expect(values.get("axes.elevation.syncResetPort")).to.equal("j23");
        expect(values.get("axes.elevation.syncResetRemaining")).to.equal(0);
        expect(values.get("firmware.latest")).to.equal("0.7.9");
        expect(values.get("firmware.checkedAgo")).to.equal(3600);
        expect(values.get("firmware.error")).to.equal(null);
        const running = statusToValues(
            { axes: { elevation: { syncReset: { phase: "run", remainingMs: 61000, totalMs: 65000 } } } },
            { features: ALL, mode: 1 },
        );
        expect(running.get("axes.elevation.syncResetPhase")).to.equal("run");
        expect(running.get("axes.elevation.syncResetRemaining")).to.equal(61);
        expect(running.get("axes.elevation.syncResetTotal")).to.equal(65);
    });

    it("maps the battery, the supplies 24 V / 5 V, the charge lock check and the update", () => {
        expect(values.get("battery.percent")).to.equal(82);
        expect(values.get("battery.charging")).to.equal(true);
        expect(values.get("battery.level")).to.equal("ok");
        expect(values.get("battery.fitted")).to.equal(true);
        expect(values.get("supply.v24")).to.equal(true);
        expect(values.get("supply.v5")).to.equal(true);
        expect(values.get("supply.adcOk")).to.equal(true);
        expect(values.get("supply.checks")).to.equal("[]");
        expect(values.get("update.active")).to.equal(false);
        expect(values.get("update.percent")).to.equal(0);
        expect(values.get("update.phase")).to.equal("none");
        expect(values.get("update.error")).to.equal(null);
        const unknown = statusToValues(
            {
                battery: { fitted: true, valid: false, percent: null, charging: false, level: "ok" },
                supply: { monitored: false, v24: null, v5: null, adcOk: false, checks: ["converterOff"] },
                update: { active: true, percent: 42, phase: "writing", error: null },
            },
            { features: ALL, mode: 1 },
        );
        expect(unknown.get("battery.percent")).to.equal(null);
        expect(unknown.get("supply.v24")).to.equal(null);
        expect(unknown.get("supply.checks")).to.equal('["converterOff"]');
        expect(unknown.get("update.percent")).to.equal(42);
        expect(unknown.get("update.phase")).to.equal("writing");
        // update without the feature updatepark (before 28.10.2026): only active and percent
        const plain = statusToValues(
            { update: { active: true, percent: 10 } },
            { features: new Set(["status", "update"]), mode: 1 },
        );
        expect(plain.get("update.percent")).to.equal(10);
        expect(plain.has("update.phase")).to.equal(false);
        expect(plain.has("battery.percent")).to.equal(false);
    });

    it("maps the tilt and the direction of the flat position of the elevation (since 0.5.8 and 0.6.0)", () => {
        expect(values.get("axes.elevation.flatDirection")).to.equal(1);
        expect(values.get("axes.elevation.angleSource")).to.equal("time");
        expect(statusToValues({ axes: { elevation: { deg: null } } }).get("axes.elevation.angle")).to.equal(null);
    });
});

describe("states => names of the elevation directions (STEEPER/FLATTER)", () => {
    const byId = (flatDir: unknown): Map<string, (typeof STATES)[number]> =>
        new Map(elevationLabelStates(flatDir).map(def => [def.id, def]));

    it("names PLUS FLATTER when the flat position lies in direction PLUS or the field is missing", () => {
        for (const flatDir of [1, undefined]) {
            const defs = byId(flatDir);
            expect(defs.get("axes.elevation.limitPlus")?.name).to.deep.equal({
                en: "Limit switch FLATTER open",
                de: "Endschalter FLACHER offen",
            });
            expect(defs.get("axes.elevation.output")?.states).to.deep.equal({
                "-1": "STEEPER",
                0: "Stop",
                1: "FLATTER",
            });
            expect(defs.get("control.jogElevation")?.states).to.deep.equal({
                "-1": "STEEPER",
                0: "Stop",
                1: "FLATTER",
            });
        }
    });

    it("swaps the names when the flat position lies in direction MINUS", () => {
        const defs = byId(-1);
        expect(defs.get("axes.elevation.blockedMinus")?.name.de).to.equal("Richtung FLACHER gesperrt");
        expect(defs.get("control.jogElevation")?.states).to.deep.equal({ "-1": "FLATTER", 0: "Stop", 1: "STEEPER" });
    });

    it("uses the default names in the table of all states", () => {
        expect(STATES.find(d => d.id === "control.jogElevation")?.states?.[1]).to.equal("FLATTER");
        expect(STATES.find(d => d.id === "axes.azimuth.limitPlus")?.name.en).to.equal("Limit switch EAST open");
    });
});

describe("states => reportToValues", () => {
    it("maps the data set of the test report", () => {
        const values = reportToValues(reportData());
        expect(values.get("commissioning.report.date")).to.equal(1794407520000);
        expect(values.get("commissioning.report.passed")).to.equal(true);
        expect(values.get("commissioning.report.firmware")).to.equal("0.7.8");
        expect(values.get("commissioning.report.duration")).to.equal(6420);
        expect(values.get("commissioning.report.travelSteeper")).to.equal(52300);
        expect(values.get("commissioning.report.hallSteps")).to.equal(1184);
        expect(values.get("commissioning.report.stepsPassed")).to.equal(3);
        expect(values.get("commissioning.report.stepsSkipped")).to.equal(2);
        expect(values.get("commissioning.report.stepsOpen")).to.equal(1);
        expect(JSON.parse(String(values.get("commissioning.report.steps")))).to.have.length(6);
        expect(JSON.parse(String(values.get("commissioning.report.json"))).v).to.equal(1);
    });

    it("tolerates missing and unknown fields and clears everything without a report", () => {
        const partial = reportToValues({ v: 2, epoch: null, newField: 1 });
        expect(partial.get("commissioning.report.date")).to.equal(null);
        expect(partial.get("commissioning.report.travelSteeper")).to.equal(null);
        expect(partial.get("commissioning.report.stepsPassed")).to.equal(0);
        const none = reportToValues(undefined);
        const reportStates = STATES.filter(d => d.id.startsWith("commissioning.report."));
        expect(none.size).to.equal(reportStates.length);
        expect([...none.values()].every(v => v === null)).to.equal(true);
    });
});

describe("states => infoToValues", () => {
    it("maps GET /api/info", () => {
        const values = infoToValues({
            device: "samba-solar-track",
            fw: "0.0.1",
            protocol: 1,
            id: "aa:bb:cc:dd:ee:ff",
            hostname: "samba-solar-track",
            features: ["status", "log"],
            ip: "192.168.1.50",
            heapMin: 150000,
            resetReason: "Einschalten",
        });
        expect(values.get("info.firmware")).to.equal("0.0.1");
        expect(values.get("info.protocol")).to.equal(1);
        expect(values.get("info.deviceId")).to.equal("aa:bb:cc:dd:ee:ff");
        expect(values.get("info.ip")).to.equal("192.168.1.50");
        expect(values.get("info.features")).to.equal('["status","log"]');
        expect(values.get("info.heapMin")).to.equal(150000);
        expect(values.get("info.resetReason")).to.equal("Einschalten");
    });
});
