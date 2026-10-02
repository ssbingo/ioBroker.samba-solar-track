import { expect } from "chai";
import { MessageStore, formatMessage, hostLevel, isFault, parseHistory, shouldForward } from "./messages";

/**
 * A log line as the device sends it.
 *
 * @param seq sequence number
 * @param ms uptime of the device
 * @param lvl level
 */
function line(seq: number, ms: number, lvl = "I"): { seq: number; ms: number; lvl: string; tag: string; msg: string } {
    return { seq, ms, lvl, tag: "track", msg: `message ${seq}` };
}

describe("messages => shouldForward", () => {
    it("forwards from the chosen level upwards", () => {
        expect(shouldForward("E", "W")).to.equal(true);
        expect(shouldForward("W", "W")).to.equal(true);
        expect(shouldForward("I", "W")).to.equal(false);
        expect(shouldForward("V", "D")).to.equal(false);
        expect(shouldForward("V", "V")).to.equal(true);
    });

    it("forwards nothing when switched off", () => {
        expect(shouldForward("E", "off")).to.equal(false);
    });

    it("treats an unknown level as info", () => {
        expect(shouldForward("X", "I")).to.equal(true);
        expect(shouldForward("X", "W")).to.equal(false);
    });
});

describe("messages => hostLevel and isFault", () => {
    it("maps device levels to levels of the ioBroker log, never to error", () => {
        expect(hostLevel("E")).to.equal("warn");
        expect(hostLevel("W")).to.equal("warn");
        expect(hostLevel("I")).to.equal("info");
        expect(hostLevel("D")).to.equal("debug");
        expect(hostLevel("V")).to.equal("silly");
        expect(hostLevel("X")).to.equal("info");
    });

    it("counts warnings and errors as faults", () => {
        expect(isFault("E")).to.equal(true);
        expect(isFault("W")).to.equal(true);
        expect(isFault("I")).to.equal(false);
    });
});

describe("messages => MessageStore", () => {
    it("calculates the time of a message from the uptime of the device", () => {
        const store = new MessageStore(10);
        store.setBootId("a");
        const bootEpoch = 1_700_000_000_000;
        const { message } = store.add(line(1, 121_990), bootEpoch);
        expect(message?.ts).to.equal(bootEpoch + 121_990);
        expect(formatMessage(message!)).to.equal("[I][track] message 1");
    });

    it("keeps the newest messages first and respects the limit", () => {
        const store = new MessageStore(3);
        store.setBootId("a");
        for (let seq = 1; seq <= 5; seq++) {
            store.add(line(seq, seq * 10), 0);
        }
        expect(store.messages.map(m => m.seq)).to.deep.equal([5, 4, 3]);
        expect(store.lastSeq).to.equal(5);
    });

    it("skips lines that were already received", () => {
        const store = new MessageStore(10);
        store.setBootId("a");
        store.add(line(4, 40), 0);
        expect(store.add(line(4, 40), 0).message).to.equal(undefined);
        expect(store.add(line(3, 30), 0).message).to.equal(undefined);
        expect(store.messages).to.have.length(1);
    });

    it("counts a gap in the sequence numbers as lost", () => {
        const store = new MessageStore(10);
        store.setBootId("a");
        store.add(line(10, 100), 0);
        const result = store.add(line(14, 140), 0);
        expect(result.gap).to.equal(3);
        expect(store.lost).to.equal(3);
    });

    it("does not count a gap before the very first line", () => {
        const store = new MessageStore(10);
        store.setBootId("a");
        expect(store.add(line(4712, 100), 0).gap).to.equal(0);
        expect(store.lost).to.equal(0);
    });

    it("does not count twice what the device reported as lost", () => {
        const store = new MessageStore(10);
        store.setBootId("a");
        store.add(line(10, 100), 0);
        store.addLost(5, 15);
        expect(store.add(line(16, 160), 0).gap).to.equal(0);
        expect(store.lost).to.equal(5);
    });

    it("starts the sequence numbers again after a restart of the device", () => {
        const store = new MessageStore(10);
        expect(store.setBootId("a")).to.equal(false);
        store.add(line(500, 100), 0);
        expect(store.setBootId("a")).to.equal(false);
        expect(store.setBootId("b")).to.equal(true);
        expect(store.lastSeq).to.equal(0);
        const result = store.add(line(1, 5), 1000);
        expect(result.message?.seq).to.equal(1);
        expect(result.gap).to.equal(0);
        expect(store.messages.map(m => m.seq)).to.deep.equal([1, 500]);
    });

    it("restores the position of the last run", () => {
        const store = new MessageStore(2);
        store.restore("a", 42, [
            { ts: 3, seq: 42, lvl: "I", tag: "t", msg: "c" },
            { ts: 2, seq: 41, lvl: "I", tag: "t", msg: "b" },
            { ts: 1, seq: 40, lvl: "I", tag: "t", msg: "a" },
        ]);
        expect(store.bootId).to.equal("a");
        expect(store.lastSeq).to.equal(42);
        expect(store.messages).to.have.length(2);
        expect(store.setBootId("a")).to.equal(false);
        expect(store.add(line(42, 1), 0).message).to.equal(undefined);
        expect(store.add(line(43, 2), 0).message?.seq).to.equal(43);
    });
});

describe("messages => parseHistory", () => {
    it("reads a saved history", () => {
        const saved = JSON.stringify([{ ts: 1, seq: 2, lvl: "W", tag: "wind", msg: "text" }]);
        expect(parseHistory(saved)).to.deep.equal([{ ts: 1, seq: 2, lvl: "W", tag: "wind", msg: "text" }]);
    });

    it("gives an empty history for broken content", () => {
        expect(parseHistory(undefined)).to.deep.equal([]);
        expect(parseHistory("")).to.deep.equal([]);
        expect(parseHistory("{not json")).to.deep.equal([]);
        expect(parseHistory('{"a":1}')).to.deep.equal([]);
        expect(parseHistory('[{"seq":1},5,null]')).to.deep.equal([]);
    });
});
