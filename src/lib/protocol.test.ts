import { expect } from "chai";
import {
    TOKEN_HINT,
    assembleToken,
    migrateOldToken,
    parseHello,
    parseInfo,
    parseLogLine,
    readPath,
    resumeSince,
    tokenSummary,
    type HelloFrame,
} from "./protocol";

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

/** A token as the display shows it: two lines with two blocks each */
const BLOCKS = ["3f9a1c20", "77b4e1d2", "0a5c9e31", "4b6f8d02"];
const TOKEN = BLOCKS.join("");

describe("protocol => assembleToken", () => {
    it("puts the four blocks together", () => {
        expect(assembleToken(BLOCKS, "")).to.deep.equal({
            token: TOKEN,
            source: "blocks",
            blockLengths: [8, 8, 8, 8],
            oldLength: 0,
        });
    });

    it("removes whitespace and converts upper case in every block", () => {
        const setting = assembleToken([" 3F9A1C20", "77b4 e1d2 ", "\t0a5c9e31\n", "4B6F8D02"], "");
        expect(setting).to.include({ token: TOKEN, source: "blocks" });
        expect(setting.problem).to.equal(undefined);
    });

    it("names a block with the wrong number of characters and reads only", () => {
        const setting = assembleToken(["3f9a1c20", "77b4e1d", "0a5c9e31", "4b6f8d02"], "");
        expect(setting).to.include({ token: "", source: "blocks", problem: "block 2 has 7 characters instead of 8" });
        expect(setting.blockLengths).to.deep.equal([8, 7, 8, 8]);
    });

    it("names a block with a character other than 0-9 and a-f and its position", () => {
        expect(assembleToken(["3f9a1c2o", "77b4e1d2", "0a5c9e31", "4b6f8d02"], "").problem).to.equal(
            "block 1 has a character other than 0-9 and a-f at position 8",
        );
        expect(assembleToken(["3f9a1c20", "77b4e1d2", "0a5c9e31", "4b6g8d0z"], "").problem).to.equal(
            "block 4 has characters other than 0-9 and a-f at positions 4, 8",
        );
    });

    it("names every wrong block in one text", () => {
        const setting = assembleToken(["3f9a1c20", "", "0a5c9e31", "4b6f8d02x"], "");
        expect(setting.token).to.equal("");
        expect(setting.problem).to.equal(
            "block 2 is empty, block 4 has 9 characters instead of 8 and a character other than 0-9 and a-f at position 9",
        );
    });

    it("reads only when only some of the four fields are filled", () => {
        const setting = assembleToken(["3f9a1c20", "77b4e1d2"], "");
        expect(setting).to.include({ token: "", source: "blocks", problem: "block 3 is empty, block 4 is empty" });
    });

    it("uses the old single field with spaces and upper case while the four fields are empty", () => {
        const setting = assembleToken(["", " ", undefined, null], "3f9a1c20 77b4e1d2\n0a5c9e31 4B6F8D02");
        expect(setting).to.deep.equal({
            token: TOKEN,
            source: "old",
            blockLengths: [0, 0, 0, 0],
            oldLength: 32,
        });
    });

    it("reports a wrong old single field and reads only", () => {
        const setting = assembleToken(["", "", "", ""], "3f9a1c20 77b4e1d2 0a5c9e31 4b6f8d0");
        expect(setting).to.include({
            token: "",
            source: "old",
            problem: "the old token field has 31 characters instead of 32",
        });
    });

    it("prefers the four fields to the old single field", () => {
        expect(assembleToken(BLOCKS, "0123456789abcdef0123456789abcdef")).to.include({
            token: TOKEN,
            source: "blocks",
            oldLength: 32,
        });
        // a wrong block is not replaced by the old field
        expect(assembleToken(["3f9a1c20", "", "", ""], TOKEN)).to.include({ token: "", source: "blocks" });
    });

    it("reads only without any token", () => {
        expect(assembleToken(["", "", "", ""], "")).to.deep.equal({
            token: "",
            source: "none",
            blockLengths: [0, 0, 0, 0],
            oldLength: 0,
        });
        expect(assembleToken([], undefined)).to.include({ token: "", source: "none" });
    });

    it("takes numbers as text and ignores other values", () => {
        expect(assembleToken([12345678, "77b4e1d2", "0a5c9e31", "4b6f8d02"], "")).to.include({
            token: "1234567877b4e1d20a5c9e314b6f8d02",
            source: "blocks",
        });
        expect(assembleToken([true, {}, [], 0.5], undefined).problem).to.equal(
            "block 1 is empty, block 2 is empty, block 3 is empty, block 4 has 3 characters instead of 8 and a character other than 0-9 and a-f at position 2",
        );
    });

    it("never puts the token or a part of it into the problem text", () => {
        const wrong = [
            assembleToken(["3F9A1C20", "77b4e1d", "0a5c9e3l", "4b6f8d02"], ""),
            assembleToken([], "3f9a1c20 77b4e1d2 0a5c9e31 4b6f8d0"),
        ];
        for (const setting of wrong) {
            expect(setting.problem).to.be.a("string");
            for (const part of [...BLOCKS, "3F9A1C20", "77b4e1d", "0a5c9e3l", "4b6f8d0"]) {
                expect(setting.problem).to.not.contain(part);
                expect(tokenSummary(setting)).to.not.contain(part);
            }
        }
    });
});

describe("protocol => migrateOldToken", () => {
    it("moves a usable token of the old field into the four empty fields", () => {
        expect(migrateOldToken(["", "", "", ""], TOKEN)).to.deep.equal({ blocks: BLOCKS, clearOld: true });
        // typed with spaces and upper case like the display shows it
        const typed = `${BLOCKS[0]} ${BLOCKS[1]}\n${BLOCKS[2]} ${BLOCKS[3].toUpperCase()}`;
        expect(migrateOldToken([undefined, null, " ", ""], typed)).to.deep.equal({ blocks: BLOCKS, clearOld: true });
        expect(migrateOldToken([], TOKEN)).to.deep.equal({ blocks: BLOCKS, clearOld: true });
    });

    it("empties the old field once the four fields are in use, even with a wrong block", () => {
        expect(migrateOldToken(BLOCKS, TOKEN)).to.deep.equal({ clearOld: true });
        expect(migrateOldToken(["3f9a1c20", "77b4e1d", "", ""], "anything")).to.deep.equal({ clearOld: true });
    });

    it("does nothing without an old value or with an old value that is no token", () => {
        expect(migrateOldToken(BLOCKS, "")).to.equal(null);
        expect(migrateOldToken(["", "", "", ""], undefined)).to.equal(null);
        expect(migrateOldToken(["", "", "", ""], "  ")).to.equal(null);
        // not usable: stays, so that the log can name the problem
        expect(migrateOldToken(["", "", "", ""], TOKEN.slice(0, 31))).to.equal(null);
        expect(migrateOldToken(["", "", "", ""], `${TOKEN.slice(0, 31)}g`)).to.equal(null);
    });
});

describe("protocol => tokenSummary", () => {
    it("names the source and whether the token is complete, without the token", () => {
        expect(tokenSummary(assembleToken(BLOCKS, ""))).to.equal("token from the four fields complete (32 characters)");
        expect(tokenSummary(assembleToken(["3f9a1c20"], ""))).to.equal(
            "token from the four fields incomplete or wrong (read only)",
        );
        expect(tokenSummary(assembleToken([], TOKEN))).to.equal(
            "token from the old token field complete (32 characters)",
        );
        expect(tokenSummary(assembleToken([], "3f9a"))).to.equal(
            "token from the old token field incomplete or wrong (read only)",
        );
        expect(tokenSummary(assembleToken([], ""))).to.equal("token not set (read only)");
    });
});

describe("protocol => TOKEN_HINT", () => {
    it("names the place of the token at the display and its form", () => {
        expect(TOKEN_HINT).to.contain('gear > NETZWERK > "TOKEN FUER DEN ADAPTER"');
        expect(TOKEN_HINT).to.contain("4 blocks of 8 characters");
        expect(TOKEN_HINT).to.not.contain("remote access");
    });
});
