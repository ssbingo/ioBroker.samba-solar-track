import { expect } from "chai";
import { NODES, STATES, infoToValues, statusToValues } from "./states";

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

    it("covers every state that reads from the status", () => {
        for (const def of STATES.filter(d => d.status)) {
            expect(values.has(def.id), def.id).to.equal(true);
        }
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
