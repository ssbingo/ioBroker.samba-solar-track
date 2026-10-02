import { expect } from "chai";
import { EventDetector } from "./events";

/**
 * A status with everything in order, changed by the given parts.
 *
 * @param parts parts of the status to replace
 */
function status(parts: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        storm: { active: false, remainingMs: 0 },
        fault: { io: false, motor: false },
        wind: { ok: true, gustKmh: 14.1, stormKmh: 40 },
        sun: { ok: true },
        axes: { elevation: { fault: false }, azimuth: { fault: false } },
        ...parts,
    };
}

describe("events => EventDetector", () => {
    it("reports nothing for the first status, whatever it says", () => {
        const detector = new EventDetector();
        expect(detector.update(status({ storm: { active: true }, wind: { ok: false } }))).to.deep.equal([]);
    });

    it("reports nothing while nothing changes", () => {
        const detector = new EventDetector();
        detector.update(status());
        expect(detector.update(status())).to.deep.equal([]);
        expect(detector.update(status({ wind: { ok: true, gustKmh: 30, stormKmh: 40 } }))).to.deep.equal([]);
    });

    it("reports the beginning of a storm with gust and threshold, and its end", () => {
        const detector = new EventDetector();
        detector.update(status());
        expect(
            detector.update(status({ storm: { active: true }, wind: { ok: true, gustKmh: 44, stormKmh: 40 } })),
        ).to.deep.equal([{ category: "storm", key: "stormStarted", params: { gust: "44.0", threshold: "40.0" } }]);
        expect(detector.update(status({ storm: { active: true } }))).to.deep.equal([]);
        expect(detector.update(status())).to.deep.equal([{ category: "storm", key: "stormEnded", params: {} }]);
    });

    it("names the axes of a runtime fault and reports when the fault is cleared", () => {
        const detector = new EventDetector();
        detector.update(status());
        expect(
            detector.update(
                status({
                    fault: { io: false, motor: true },
                    axes: { elevation: { fault: false }, azimuth: { fault: true } },
                }),
            ),
        ).to.deep.equal([{ category: "fault", key: "faultMotor", params: { axes: "azimuth" } }]);
        expect(detector.update(status())).to.deep.equal([{ category: "fault", key: "faultCleared", params: {} }]);
    });

    it("reports a fault of the switching outputs and waits with the all-clear until every fault is gone", () => {
        const detector = new EventDetector();
        detector.update(status());
        expect(detector.update(status({ fault: { io: true, motor: true } })).map(e => e.key)).to.deep.equal([
            "faultIo",
            "faultMotor",
        ]);
        expect(detector.update(status({ fault: { io: false, motor: true } }))).to.deep.equal([]);
        expect(detector.update(status()).map(e => e.key)).to.deep.equal(["faultCleared"]);
    });

    it("reports the wind sensor and the sun sensor going and coming back", () => {
        const detector = new EventDetector();
        detector.update(status());
        expect(
            detector.update(status({ wind: { ok: false }, sun: { ok: false } })).map(e => `${e.category}/${e.key}`),
        ).to.deep.equal(["wind/windLost", "sensor/sunLost"]);
        expect(detector.update(status()).map(e => e.key)).to.deep.equal(["windBack", "sunBack"]);
    });

    it("treats a status without these fields as everything in order", () => {
        const detector = new EventDetector();
        detector.update({});
        expect(detector.update({ state: "IDLE" })).to.deep.equal([]);
    });
});
