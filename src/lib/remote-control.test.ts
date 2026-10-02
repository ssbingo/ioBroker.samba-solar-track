import { expect } from "chai";
import { RemoteControl, reasonText, type Axis } from "./remote-control";

/** Clock and timers that only move when the test says so */
class FakeTime {
    public now = 0;
    private nextHandle = 1;
    private readonly timers = new Map<number, { at: number; callback: () => void }>();

    public readonly api = {
        set: (callback: () => void, ms: number): unknown => {
            const handle = this.nextHandle++;
            this.timers.set(handle, { at: this.now + ms, callback });
            return handle;
        },
        clear: (handle: unknown): void => {
            this.timers.delete(handle as number);
        },
    };

    /** Number of timers that are waiting */
    public get waiting(): number {
        return this.timers.size;
    }

    /**
     * Moves the clock forward and runs the timers that become due, in the order of their time.
     *
     * @param ms time to pass
     */
    public async advance(ms: number): Promise<void> {
        const end = this.now + ms;
        for (;;) {
            let next: number | undefined;
            for (const [handle, timer] of this.timers) {
                if (timer.at <= end && (next === undefined || timer.at < this.timers.get(next)!.at)) {
                    next = handle;
                }
            }
            if (next === undefined) {
                break;
            }
            const timer = this.timers.get(next)!;
            this.timers.delete(next);
            this.now = timer.at;
            timer.callback();
            await flush();
        }
        this.now = end;
        await flush();
    }
}

/** Lets pending promise callbacks run */
async function flush(): Promise<void> {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
}

interface Setup {
    time: FakeTime;
    remote: RemoteControl;
    sent: Record<string, unknown>[];
    ended: { axis: Axis; reason: string }[];
    logs: string[];
    link: { up: boolean };
}

/** Creates a remote control whose frames are collected instead of sent */
function setup(): Setup {
    const time = new FakeTime();
    const sent: Record<string, unknown>[] = [];
    const ended: { axis: Axis; reason: string }[] = [];
    const logs: string[] = [];
    const link = { up: true };
    const log = (text: string): void => void logs.push(text);
    const remote = new RemoteControl({
        send: frame => {
            if (link.up) {
                sent.push(frame);
            }
            return link.up;
        },
        timers: time.api,
        log: { warn: log, info: log, debug: log, silly: log },
        onJogEnd: (axis, reason) => ended.push({ axis, reason }),
        now: () => time.now,
    });
    return { time, remote, sent, ended, logs, link };
}

describe("remote-control => commands", () => {
    it("sends a command with an id and resolves with the answer of the device", async () => {
        const { remote, sent, time } = setup();
        const promise = remote.command("auto", false, "test");
        expect(sent).to.deep.equal([{ t: "cmd", cmd: "auto", on: false, id: 1 }]);
        time.now = 12;
        remote.handleResult(1, true, undefined);
        expect(await promise).to.deep.equal({ ok: true, reason: undefined, durationMs: 12 });
        expect(time.waiting).to.equal(0);
    });

    it("passes on the reason of a rejected command", async () => {
        const { remote } = setup();
        const promise = remote.command("park", true, "test");
        remote.handleResult(1, false, "locked");
        expect(await promise).to.include({ ok: false, reason: "locked" });
    });

    it("sends acknowledge without a value", () => {
        const { remote, sent } = setup();
        void remote.command("ack", undefined, "test");
        expect(sent).to.deep.equal([{ t: "cmd", cmd: "ack", id: 1 }]);
    });

    it("gives up when the device does not answer", async () => {
        const { remote, time } = setup();
        const promise = remote.command("auto", true, "test");
        await time.advance(2000);
        expect(await promise).to.include({ ok: false, reason: "timeout" });
        // a late answer changes nothing and does not throw
        remote.handleResult(1, true, undefined);
    });

    it("fails at once without a connection", async () => {
        const { remote, link, sent, time } = setup();
        link.up = false;
        expect(await remote.command("auto", true, "test")).to.include({ ok: false, reason: "disconnected" });
        expect(sent).to.have.length(0);
        expect(time.waiting).to.equal(0);
    });

    it("fails open commands when the connection is lost", async () => {
        const { remote, time } = setup();
        const promise = remote.command("park", true, "test");
        remote.handleDisconnect();
        expect(await promise).to.include({ ok: false, reason: "disconnected" });
        expect(time.waiting).to.equal(0);
    });

    it("keeps answers apart by their id", async () => {
        const { remote } = setup();
        const first = remote.command("auto", true, "test");
        const second = remote.command("park", true, "test");
        remote.handleResult(2, false, "setup");
        remote.handleResult(1, true, undefined);
        expect(await first).to.include({ ok: true });
        expect(await second).to.include({ ok: false, reason: "setup" });
    });
});

describe("remote-control => manual drive", () => {
    /**
     * Starts a drive and lets the device accept it.
     *
     * @param s the test setup
     * @param axis axis to drive
     * @param dir direction
     */
    async function start(s: Setup, axis: Axis, dir: 1 | -1): Promise<void> {
        const promise = s.remote.jog(axis, dir, "test");
        const frame = s.sent[s.sent.length - 1];
        s.remote.handleResult(frame.id as number, true, undefined);
        expect(await promise).to.include({ ok: true });
    }

    it("starts a drive and renews it at the device every 300 ms while it is held", async () => {
        const s = setup();
        await start(s, "elevation", 1);
        expect(s.sent).to.deep.equal([{ t: "jog", axis: "elevation", dir: 1, id: 1 }]);
        expect(s.remote.jogging).to.deep.equal({ axis: "elevation", dir: 1 });

        // the writer renews every 250 ms for 1.5 s
        for (let i = 0; i < 6; i++) {
            await s.time.advance(250);
            expect(await s.remote.jog("elevation", 1, "test")).to.include({ ok: true });
        }
        const renewals = s.sent.slice(1);
        expect(renewals).to.have.length(5);
        for (const frame of renewals) {
            expect(frame).to.include({ t: "jog", axis: "elevation", dir: 1 });
        }
        expect(s.ended).to.deep.equal([]);
    });

    it("stops the drive when the writer stops renewing (dead man)", async () => {
        const s = setup();
        await start(s, "azimuth", -1);
        await s.time.advance(1300);
        expect(s.ended).to.deep.equal([{ axis: "azimuth", reason: "hold" }]);
        expect(s.remote.jogging).to.equal(undefined);
        const last = s.sent[s.sent.length - 1];
        expect(last).to.include({ t: "jog", axis: "azimuth", dir: 0 });
        // nothing is sent afterwards
        const count = s.sent.length;
        await s.time.advance(5000);
        expect(s.sent).to.have.length(count);
        expect(s.time.waiting).to.equal(0);
    });

    it("stops on command and sends nothing afterwards", async () => {
        const s = setup();
        await start(s, "elevation", -1);
        const promise = s.remote.jog("elevation", 0, "test");
        const stop = s.sent[s.sent.length - 1];
        expect(stop).to.include({ t: "jog", axis: "elevation", dir: 0 });
        s.remote.handleResult(stop.id as number, true, undefined);
        expect(await promise).to.include({ ok: true });
        expect(s.remote.jogging).to.equal(undefined);
        const count = s.sent.length;
        await s.time.advance(5000);
        expect(s.sent).to.have.length(count);
        expect(s.ended).to.deep.equal([]);
    });

    it("ignores a stop for an axis that is not driving", async () => {
        const s = setup();
        expect(await s.remote.jog("azimuth", 0, "test")).to.include({ ok: true });
        expect(s.sent).to.have.length(0);
    });

    it("reports a refused start and releases the device with a stop", async () => {
        const s = setup();
        const promise = s.remote.jog("elevation", 1, "test");
        s.remote.handleResult(1, false, "state");
        expect(await promise).to.include({ ok: false, reason: "state" });
        expect(s.remote.jogging).to.equal(undefined);
        expect(s.sent[s.sent.length - 1]).to.include({ t: "jog", axis: "elevation", dir: 0 });
        const count = s.sent.length;
        await s.time.advance(2000);
        expect(s.sent).to.have.length(count);
        expect(s.ended).to.deep.equal([]);
    });

    it("ends the drive when the device refuses a renewal", async () => {
        const s = setup();
        await start(s, "elevation", 1);
        await s.time.advance(300);
        const renewal = s.sent[s.sent.length - 1];
        expect(renewal).to.include({ dir: 1 });
        s.remote.handleResult(renewal.id as number, false, "local");
        expect(s.ended).to.deep.equal([{ axis: "elevation", reason: "local" }]);
        expect(s.remote.jogging).to.equal(undefined);
        expect(s.sent[s.sent.length - 1]).to.include({ t: "jog", axis: "elevation", dir: 0 });
    });

    it("ends the drive when the status of the device reports none, but not right after the start", async () => {
        const s = setup();
        await start(s, "elevation", 1);
        s.remote.handleStatus(false);
        expect(s.ended).to.deep.equal([]);
        await s.time.advance(900);
        await s.remote.jog("elevation", 1, "test");
        await s.time.advance(700);
        s.remote.handleStatus(true);
        expect(s.ended).to.deep.equal([]);
        s.remote.handleStatus(false);
        expect(s.ended).to.deep.equal([{ axis: "elevation", reason: "device" }]);
    });

    it("ends the drive without sending when the connection is lost", async () => {
        const s = setup();
        await start(s, "azimuth", 1);
        const count = s.sent.length;
        s.link.up = false;
        s.remote.handleDisconnect();
        expect(s.ended).to.deep.equal([{ axis: "azimuth", reason: "disconnected" }]);
        expect(s.sent).to.have.length(count);
        expect(s.time.waiting).to.equal(0);
    });

    it("replaces a drive by a drive on the other axis", async () => {
        const s = setup();
        await start(s, "elevation", 1);
        await start(s, "azimuth", 1);
        expect(s.remote.jogging).to.deep.equal({ axis: "azimuth", dir: 1 });
        await s.time.advance(300);
        expect(s.sent[s.sent.length - 1]).to.include({ axis: "azimuth", dir: 1 });
        expect(s.ended).to.deep.equal([]);
    });

    it("sends a stop for a running drive when the adapter stops", async () => {
        const s = setup();
        await start(s, "elevation", 1);
        s.remote.stop();
        expect(s.sent[s.sent.length - 1]).to.include({ t: "jog", axis: "elevation", dir: 0 });
        expect(s.time.waiting).to.equal(0);
        expect(s.ended).to.deep.equal([]);
    });

    it("does not start a drive without a connection", async () => {
        const s = setup();
        s.link.up = false;
        expect(await s.remote.jog("elevation", 1, "test")).to.include({ ok: false, reason: "disconnected" });
        expect(s.remote.jogging).to.equal(undefined);
        expect(s.time.waiting).to.equal(0);
    });
});

describe("remote-control => reasonText", () => {
    it("explains known reasons and passes unknown ones through", () => {
        expect(reasonText("locked")).to.contain("locked at the display");
        expect(reasonText("hold")).to.contain("dead man");
        expect(reasonText("something-new")).to.equal("something-new");
        expect(reasonText(undefined)).to.equal("");
    });
});
