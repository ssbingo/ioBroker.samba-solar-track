import { expect } from "chai";
import { MockDevice, TOKEN } from "../../test/mock-device";
import { DeviceClient, type ClientEvents, type ClientTiming } from "./device-client";
import {
    resumeSince,
    type DeviceInfo,
    type DeviceStatus,
    type HelloFrame,
    type LogLine,
    type LostFrame,
} from "./protocol";

/** Short times so the tests do not have to wait */
const TIMING: ClientTiming = {
    httpTimeoutMs: 300,
    handshakeTimeoutMs: 300,
    pingMs: 60,
    watchdogMs: 200,
    reconnectMs: [40, 80],
};

/** Collects everything a client logs and reports */
class Recorder implements ClientEvents {
    public readonly logs: { level: string; text: string }[] = [];
    public readonly infos: DeviceInfo[] = [];
    public readonly hellos: HelloFrame[] = [];
    public readonly statuses: DeviceStatus[] = [];
    public readonly lines: LogLine[] = [];
    public readonly losts: LostFrame[] = [];
    public readonly connection: boolean[] = [];
    public readonly results: { id: number | null; ok: boolean; reason: string | undefined }[] = [];
    public knownBootId: string | undefined;
    public lastSeq = 0;

    public readonly log = {
        warn: (text: string): void => void this.logs.push({ level: "warn", text }),
        info: (text: string): void => void this.logs.push({ level: "info", text }),
        debug: (text: string): void => void this.logs.push({ level: "debug", text }),
        silly: (text: string): void => void this.logs.push({ level: "silly", text }),
    };

    public onInfo(info: DeviceInfo): void {
        this.infos.push(info);
    }

    public onHello(hello: HelloFrame): number {
        this.hellos.push(hello);
        const since = resumeSince(hello, this.knownBootId, this.lastSeq);
        if (this.knownBootId !== hello.bootId) {
            this.lastSeq = 0;
        }
        this.knownBootId = hello.bootId;
        return since;
    }

    public onStatus(status: DeviceStatus): void {
        this.statuses.push(status);
    }

    public onLog(line: LogLine): void {
        this.lines.push(line);
        this.lastSeq = line.seq;
    }

    public onLost(lost: LostFrame): void {
        this.losts.push(lost);
    }

    public onConnection(connected: boolean): void {
        this.connection.push(connected);
    }

    public onResult(id: number | null, ok: boolean, reason: string | undefined): void {
        this.results.push({ id, ok, reason });
    }

    public count(level: string): number {
        return this.logs.filter(l => l.level === level).length;
    }
}

/**
 * Waits until a condition is true.
 *
 * @param condition checked every few milliseconds
 * @param what text for the error when the time runs out
 * @param timeoutMs how long to wait
 */
async function until(condition: () => boolean, what: string, timeoutMs = 3000): Promise<void> {
    const started = Date.now();
    while (!condition()) {
        if (Date.now() - started > timeoutMs) {
            throw new Error(`timeout waiting for: ${what}`);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

describe("device-client => DeviceClient", function () {
    this.timeout(10000);

    let device: MockDevice;
    let recorder: Recorder;
    let client: DeviceClient | undefined;

    /**
     * Creates a client for the mock device.
     *
     * @param token token to connect with
     * @param port other port than the one of the mock device
     */
    function createClient(token = TOKEN, port = device.port): DeviceClient {
        client = new DeviceClient({
            host: "127.0.0.1",
            port,
            token,
            log: recorder.log,
            timers: {
                set: (cb, ms) => setTimeout(cb, ms),
                clear: h => clearTimeout(h as NodeJS.Timeout),
            },
            events: recorder,
            timing: TIMING,
        });
        return client;
    }

    beforeEach(async () => {
        device = new MockDevice();
        await device.start();
        recorder = new Recorder();
    });

    afterEach(async () => {
        client?.stop();
        client = undefined;
        await device.stop();
    });

    it("reads the info, connects, receives hello and status and subscribes the messages", async () => {
        device.pushLog("I", "main", "Start abgeschlossen");
        device.pushLog("W", "wind", "Windmesser antwortet nicht");
        createClient().start();
        await until(() => recorder.lines.length === 2, "two messages");

        expect(recorder.infos).to.have.length(1);
        expect(recorder.infos[0]).to.include({ fw: "0.0.1", protocol: 1, id: "aa:bb:cc:dd:ee:ff" });
        expect(recorder.hellos[0]).to.include({ auth: true, logFirst: 1, logNext: 3 });
        expect(recorder.statuses[0]).to.include({ state: "IDLE", auto: true });
        expect(recorder.connection).to.deep.equal([true]);
        expect(device.received).to.deep.equal([{ t: "sub", since: 1 }]);
        expect(recorder.lines.map(l => l.msg)).to.deep.equal(["Start abgeschlossen", "Windmesser antwortet nicht"]);
        expect(recorder.count("warn")).to.equal(0);
        expect(client?.readOnly).to.equal(false);
    });

    it("receives new messages and status changes while connected", async () => {
        createClient().start();
        await until(() => recorder.connection.length === 1, "connection");
        device.setStatus({ state: "TRACKING" });
        device.pushLog("I", "track", "Zustand IDLE -> TRACKING");
        await until(() => recorder.lines.length === 1, "message");
        expect(recorder.statuses[recorder.statuses.length - 1]).to.include({ state: "TRACKING" });
        expect(recorder.lines[0]).to.include({ seq: 1, lvl: "I", tag: "track" });
    });

    it("never writes the token to the log", async () => {
        createClient().start();
        await until(() => recorder.connection.length === 1, "connection");
        device.dropClients();
        await until(() => recorder.connection.length === 3, "reconnect");
        expect(recorder.logs.length).to.be.greaterThan(5);
        for (const entry of recorder.logs) {
            expect(entry.text).to.not.contain(TOKEN);
        }
    });

    it("warns once when the device does not accept the token and keeps reading", async () => {
        createClient("wrong-token").start();
        await until(() => recorder.connection.length === 1, "connection");
        device.dropClients();
        await until(() => recorder.connection.length === 3, "reconnect");
        expect(recorder.hellos[0].auth).to.equal(false);
        const tokenWarnings = recorder.logs.filter(
            l => l.level === "warn" && l.text.includes("did not accept the token"),
        );
        expect(tokenWarnings).to.have.length(1);
        for (const entry of recorder.logs) {
            expect(entry.text).to.not.contain("wrong-token");
        }
    });

    it("works without a token (read only) without a warning", async () => {
        createClient("").start();
        await until(() => recorder.connection.length === 1, "connection");
        expect(recorder.hellos[0].auth).to.equal(false);
        expect(recorder.count("warn")).to.equal(0);
    });

    it("reconnects after a lost connection and continues after the last message", async () => {
        device.pushLog("I", "main", "eins");
        createClient().start();
        await until(() => recorder.lines.length === 1, "first message");
        device.dropClients();
        await until(() => recorder.connection.length === 2, "connection lost");
        device.pushLog("I", "main", "zwei");
        await until(() => recorder.connection.length === 3, "reconnect");
        await until(() => recorder.lines.length === 2, "second message");

        expect(recorder.connection).to.deep.equal([true, false, true]);
        expect(device.received).to.deep.equal([
            { t: "sub", since: 1 },
            { t: "sub", since: 2 },
        ]);
        expect(recorder.lines.map(l => l.seq)).to.deep.equal([1, 2]);
        expect(recorder.count("warn")).to.equal(1);
        expect(recorder.logs.some(l => l.level === "info" && l.text.includes("reachable again"))).to.equal(true);
    });

    it("fetches the messages from the beginning after a restart of the device", async () => {
        device.pushLog("I", "main", "vor dem Neustart");
        createClient().start();
        await until(() => recorder.lines.length === 1, "first message");
        const firstBootId = recorder.hellos[0].bootId;
        device.restart();
        device.pushLog("I", "main", "nach dem Neustart");
        await until(() => recorder.lines.length === 2, "message after restart");

        expect(recorder.hellos[1].bootId).to.not.equal(firstBootId);
        expect(device.received[device.received.length - 1]).to.deep.equal({ t: "sub", since: 1 });
        expect(recorder.lines[1]).to.include({ seq: 1, msg: "nach dem Neustart" });
    });

    it("reports messages the device has lost", async () => {
        const small = new MockDevice({ ringSize: 2 });
        await small.start();
        try {
            for (let i = 1; i <= 5; i++) {
                small.pushLog("I", "main", `Zeile ${i}`);
            }
            recorder.knownBootId = small.bootId;
            recorder.lastSeq = 1;
            createClient(TOKEN, small.port).start();
            await until(() => recorder.lines.length === 2, "two messages");
            expect(small.received).to.deep.equal([{ t: "sub", since: 2 }]);
            expect(recorder.losts).to.deep.equal([{ t: "lost", from: 2, to: 3, count: 2 }]);
            expect(recorder.lines.map(l => l.seq)).to.deep.equal([4, 5]);
        } finally {
            client?.stop();
            client = undefined;
            await small.stop();
        }
    });

    it("warns once while the device is not reachable and keeps trying", async () => {
        const port = device.port;
        await device.stop();
        createClient(TOKEN, port).start();
        await until(() => recorder.logs.filter(l => l.text.includes("next attempt")).length >= 3, "three attempts");
        expect(recorder.count("warn")).to.equal(1);
        expect(recorder.logs.find(l => l.level === "warn")?.text).to.contain("not reachable");
        expect(recorder.connection).to.deep.equal([]);
        // the device comes back on the same port
        device = new MockDevice();
        device.port = port;
        await device.start();
        await until(() => recorder.connection.length === 1, "connection");
        expect(recorder.logs.some(l => l.level === "info" && l.text.includes("reachable again"))).to.equal(true);
    });

    it("refuses a device that is not a Samba Solar Track", async () => {
        const other = new MockDevice({ device: "pond-aeration" });
        await other.start();
        try {
            createClient(TOKEN, other.port).start();
            await until(() => recorder.count("warn") === 1, "warning");
            expect(recorder.logs.find(l => l.level === "warn")?.text).to.contain("not a Samba Solar Track");
            expect(other.connections).to.equal(0);
            expect(recorder.infos).to.have.length(0);
        } finally {
            client?.stop();
            client = undefined;
            await other.stop();
        }
    });

    it("keeps reading from a device with a newer protocol but marks itself read only", async () => {
        const newer = new MockDevice({ protocol: 2 });
        await newer.start();
        try {
            createClient(TOKEN, newer.port).start();
            await until(() => recorder.connection.length === 1, "connection");
            expect(client?.readOnly).to.equal(true);
            expect(
                recorder.logs.filter(l => l.level === "warn" && l.text.includes("protocol version 2")),
            ).to.have.length(1);
            expect(recorder.statuses).to.have.length(1);
        } finally {
            client?.stop();
            client = undefined;
            await newer.stop();
        }
    });

    it("closes a connection without any frame and connects again", async () => {
        // this device sends hello and status and then stays silent: no pong, no frame
        const silent = new MockDevice({ autoPong: false });
        await silent.start();
        try {
            createClient(TOKEN, silent.port).start();
            await until(() => recorder.connection.length === 3, "watchdog and reconnect");
            expect(recorder.connection).to.deep.equal([true, false, true]);
            expect(recorder.logs.some(l => l.text.includes("No frame for"))).to.equal(true);
        } finally {
            client?.stop();
            client = undefined;
            await silent.stop();
        }
    });

    it("ignores unknown and broken frames", async () => {
        createClient().start();
        await until(() => recorder.connection.length === 1, "connection");
        device.sendRaw({ t: "future", value: 1 });
        device.sendRaw({ t: "params", changed: [] });
        device.sendRaw({ noType: true });
        device.sendRaw({ t: "log", msg: "ohne Nummer" });
        device.pushLog("I", "main", "danach");
        await until(() => recorder.lines.length === 1, "message after the broken frames");
        expect(recorder.lines[0].msg).to.equal("danach");
        expect(recorder.connection).to.deep.equal([true]);
    });

    it("sends commands and reports the answers of the device", async () => {
        createClient().start();
        await until(() => recorder.connection.length === 1, "connection");
        expect(client?.send({ t: "cmd", id: 7, cmd: "auto", on: false })).to.equal(true);
        expect(client?.send({ t: "cmd", id: 8, cmd: "nonsense" })).to.equal(true);
        await until(() => recorder.results.length === 2, "two results");
        expect(recorder.results).to.deep.equal([
            { id: 7, ok: true, reason: undefined },
            { id: 8, ok: false, reason: "unknown" },
        ]);
        expect(recorder.statuses[recorder.statuses.length - 1]).to.include({ auto: false, state: "MANUAL" });
    });

    it("gets the reason auth for a command without a valid token", async () => {
        createClient("").start();
        await until(() => recorder.connection.length === 1, "connection");
        client?.send({ t: "cmd", id: 1, cmd: "park", on: true });
        await until(() => recorder.results.length === 1, "result");
        expect(recorder.results[0]).to.deep.equal({ id: 1, ok: false, reason: "auth" });
    });

    it("does not send while there is no connection", async () => {
        const port = device.port;
        await device.stop();
        createClient(TOKEN, port).start();
        expect(client?.send({ t: "cmd", id: 1, cmd: "ack" })).to.equal(false);
        device = new MockDevice();
        await device.start();
    });

    it("stops completely: no further attempt and no open connection", async () => {
        createClient().start();
        await until(() => recorder.connection.length === 1, "connection");
        client?.stop();
        await until(() => device.connections === 0, "connection closed at the device");
        const requests = device.infoRequests;
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(device.infoRequests).to.equal(requests);
        expect(device.connections).to.equal(0);
    });
});
