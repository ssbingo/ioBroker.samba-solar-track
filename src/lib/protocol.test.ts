import { expect } from "chai";
import { parseHello, parseInfo, parseLogLine, readPath, resumeSince, type HelloFrame } from "./protocol";

const INFO = {
    device: "samba-solar-track",
    fw: "0.0.1",
    protocol: 1,
    id: "aa:bb:cc:dd:ee:ff",
    hostname: "samba-solar-track",
    features: ["status", "log", "command", "jog", "park", "setup", "params"],
    bootId: "a3f91c20",
    uptimeMs: 123456,
};

const HELLO: HelloFrame = {
    t: "hello",
    device: "samba-solar-track",
    fw: "0.0.1",
    protocol: 1,
    bootId: "a3f91c20",
    uptimeMs: 123456,
    auth: true,
    logFirst: 4712,
    logNext: 4813,
};

describe("protocol => parseInfo", () => {
    it("accepts the example of PROTOCOL.md", () => {
        const info = parseInfo(INFO);
        expect(info).to.be.an("object");
        expect(info).to.include({ fw: "0.0.1", protocol: 1, id: "aa:bb:cc:dd:ee:ff", hostname: "samba-solar-track" });
    });

    it("rejects another device", () => {
        expect(parseInfo({ ...INFO, device: "pond-aeration" }))
            .to.be.a("string")
            .and.to.contain("pond-aeration");
    });

    it("rejects an answer without the fixed contract", () => {
        expect(parseInfo({ device: "samba-solar-track" })).to.be.a("string");
        expect(parseInfo([1, 2])).to.be.a("string");
        expect(parseInfo(null)).to.be.a("string");
    });

    it("drops features that are not strings and tolerates missing features", () => {
        const info = parseInfo({ ...INFO, features: ["status", 5, null] });
        expect(info).to.have.property("features").that.deep.equals(["status"]);
        const { features: _features, ...withoutFeatures } = INFO;
        expect(parseInfo(withoutFeatures)).to.have.property("features").that.deep.equals([]);
    });
});

describe("protocol => parseHello", () => {
    it("accepts a complete frame", () => {
        expect(parseHello({ ...HELLO })).to.deep.equal(HELLO);
    });

    it("treats a missing auth as not authorized", () => {
        const { auth: _auth, ...frame } = HELLO;
        expect(parseHello(frame)).to.include({ auth: false });
    });

    it("rejects a frame without bootId or from another device", () => {
        expect(parseHello({ t: "hello", device: "samba-solar-track", uptimeMs: 1 })).to.be.a("string");
        expect(parseHello({ ...HELLO, device: "other" })).to.be.a("string");
    });
});

describe("protocol => parseLogLine", () => {
    it("reads a log frame", () => {
        expect(parseLogLine({ t: "log", seq: 7, ms: 1000, lvl: "W", tag: "track", msg: "text" })).to.deep.equal({
            seq: 7,
            ms: 1000,
            lvl: "W",
            tag: "track",
            msg: "text",
        });
    });

    it("needs seq and ms", () => {
        expect(parseLogLine({ ms: 1000, msg: "text" })).to.equal(undefined);
        expect(parseLogLine({ seq: 1, msg: "text" })).to.equal(undefined);
        expect(parseLogLine("text")).to.equal(undefined);
    });
});

describe("protocol => resumeSince", () => {
    it("continues after the last received message when the device did not restart", () => {
        expect(resumeSince(HELLO, "a3f91c20", 4800)).to.equal(4801);
    });

    it("fetches everything available after a restart of the device", () => {
        expect(resumeSince(HELLO, "00000000", 4800)).to.equal(4712);
    });

    it("fetches everything available on the first connection", () => {
        expect(resumeSince(HELLO, undefined, undefined)).to.equal(4712);
        expect(resumeSince(HELLO, "a3f91c20", 0)).to.equal(4712);
    });
});

describe("protocol => readPath", () => {
    it("reads nested values and gives undefined for missing parts", () => {
        const source = { axes: { elevation: { out: -1 } }, wind: { dirDeg: null } };
        expect(readPath(source, "axes.elevation.out")).to.equal(-1);
        expect(readPath(source, "wind.dirDeg")).to.equal(null);
        expect(readPath(source, "axes.azimuth.out")).to.equal(undefined);
        expect(readPath(source, "axes.elevation.out.deeper")).to.equal(undefined);
    });
});
