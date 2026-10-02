const path = require("path");
const { tests } = require("@iobroker/testing");
const { expect } = require("chai");
const { MockDevice, TOKEN } = require("./mock-device");

const NAMESPACE = "samba-solar-track.0";

/**
 * Waits until a condition is true.
 *
 * @param {() => Promise<boolean> | boolean} condition checked every 100 ms
 * @param {string} what text for the error when the time runs out
 * @param {number} [timeoutMs] how long to wait
 */
async function until(condition, what, timeoutMs = 15000) {
    const started = Date.now();
    while (!(await condition())) {
        if (Date.now() - started > timeoutMs) {
            throw new Error(`timeout waiting for: ${what}`);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("Adapter with a Samba Solar Track (mock device)", getHarness => {
            /** @type {MockDevice} */
            let device;

            before(async () => {
                device = new MockDevice();
                await device.start();
                device.pushLog("I", "main", "Start abgeschlossen nach 460 ms");
                device.pushLog("W", "wind", "Windmesser antwortet nicht (Fehler gesamt: 1)");
            });

            after(async () => {
                await device.stop();
            });

            it("connects, mirrors status and messages into states and keeps the token out of the log", async function () {
                this.timeout(90000);
                const harness = getHarness();
                const value = async id => (await harness.states.getStateAsync(`${NAMESPACE}.${id}`))?.val;
                // The adapter does not wait for the database, so a state may arrive a moment later
                const expectState = async (id, expected) => {
                    let last;
                    await until(
                        async () => (last = await value(id)) === expected,
                        `${id} to become ${JSON.stringify(expected)}`,
                    ).catch(error => {
                        throw new Error(`${error.message} (last value ${JSON.stringify(last)})`);
                    });
                };

                await harness.changeAdapterConfig("samba-solar-track", {
                    common: { loglevel: "silly" },
                    native: { ip: "127.0.0.1", port: device.port, token: TOKEN, forwardLevel: "W", historySize: 5 },
                });
                await harness.startAdapterAndWait(true);

                // values of GET /api/info, the hello frame and the first status
                await expectState("status.state", "IDLE");
                await expectState("info.connection", true);
                await expectState("info.firmware", "0.0.1");
                await expectState("info.protocol", 1);
                await expectState("info.deviceId", "aa:bb:cc:dd:ee:ff");
                await expectState("info.authorized", true);
                await expectState("info.bootId", device.bootId);
                await until(async () => typeof (await value("info.bootTime")) === "number", "info.bootTime");
                expect(await value("info.bootTime")).to.be.closeTo(device.bootedAt, 2000);
                await expectState("status.auto", true);
                await expectState("status.mode", 2);
                await expectState("axes.elevation.deviation", 7);
                await expectState("wind.speed", 12.4);
                await expectState("wind.direction", null);
                await expectState("leds.ready", "on");

                // messages that existed before the adapter connected
                await until(async () => (await value("messages.lastSeq")) === 2, "messages.lastSeq 2");
                await expectState("messages.last", "[W][wind] Windmesser antwortet nicht (Fehler gesamt: 1)");
                await expectState("messages.lastFault", "[W][wind] Windmesser antwortet nicht (Fehler gesamt: 1)");
                await until(async () => typeof (await value("messages.history")) === "string", "messages.history");
                const history = JSON.parse(await value("messages.history"));
                expect(history.map(m => m.seq)).to.deep.equal([2, 1]);
                expect(history[0].ts).to.be.closeTo(Date.now(), 60000);
                await expectState("messages.lost", 0);

                // a change at the device arrives
                device.setStatus({ state: "STORM", storm: { active: true, remainingMs: 600000 } });
                device.pushLog("W", "track", "Sturm: Boe 44.0 km/h ueber Schwelle 40.0 km/h");
                await until(async () => (await value("status.stormActive")) === true, "status.stormActive");
                await expectState("status.state", "STORM");
                await expectState("status.stormRemaining", 600);
                await until(async () => (await value("messages.lastSeq")) === 3, "messages.lastSeq 3");

                // warnings of the device are forwarded to the ioBroker log, info lines are not
                expect(harness.hasLog("[dev] #2 [W][wind] Windmesser antwortet nicht", "warn")).to.equal(true);
                expect(harness.hasLog("[dev] #3 [W][track] Sturm", "warn")).to.equal(true);
                expect(harness.hasLog("[dev] #1 ")).to.equal(false);

                // the device restarts: connection drops and comes back with new sequence numbers
                device.restart();
                device.pushLog("I", "main", "Start abgeschlossen nach 455 ms");
                await until(async () => (await value("info.bootId")) === device.bootId, "new boot id");
                await until(async () => (await value("messages.lastSeq")) === 1, "messages.lastSeq 1 after restart");
                await expectState("info.connection", true);
                expect(harness.hasLog("The device has restarted", "info")).to.equal(true);

                // no secret in the log, even at level silly
                const logs = harness.getLogs();
                expect(logs.length).to.be.greaterThan(20);
                for (const log of logs) {
                    expect(log.message).to.not.contain(TOKEN);
                }
                expect(harness.getLogs("error")).to.deep.equal([]);
            });
        });

        suite("Commands to a Samba Solar Track (mock device)", getHarness => {
            /** @type {MockDevice} */
            let device;

            before(async () => {
                device = new MockDevice();
                await device.start();
            });

            after(async () => {
                await device.stop();
            });

            it("passes on commands, keeps a manual drive alive only while it is renewed and reports refusals", async function () {
                this.timeout(90000);
                const harness = getHarness();
                const state = async id => harness.states.getStateAsync(`${NAMESPACE}.${id}`);
                const write = (id, val) => harness.states.setStateAsync(`${NAMESPACE}.${id}`, { val, ack: false });
                const expectState = async (id, expected, ack) => {
                    let last;
                    await until(async () => {
                        last = await state(id);
                        return last?.val === expected && (ack === undefined || last.ack === ack);
                    }, `${id} to become ${JSON.stringify(expected)}`).catch(error => {
                        throw new Error(`${error.message} (last ${JSON.stringify(last)})`);
                    });
                };
                const lastResult = async () => JSON.parse((await state("control.lastResult"))?.val ?? "{}");

                await harness.changeAdapterConfig("samba-solar-track", {
                    common: { loglevel: "debug" },
                    native: { ip: "127.0.0.1", port: device.port, token: TOKEN },
                });
                await harness.startAdapterAndWait(true);
                await expectState("control.auto", true, true);
                await expectState("control.park", false, true);

                // automatic off: the device changes to manual mode and the switch is confirmed
                await write("control.auto", false);
                await expectState("status.auto", false);
                await expectState("control.auto", false, true);
                await expectState("status.state", "MANUAL");
                expect(device.status.auto).to.equal(false);
                await until(async () => (await lastResult()).command === "auto off", "result of auto off");
                expect(await lastResult()).to.include({ ok: true, reason: null });

                // park request
                await write("control.park", true);
                await expectState("status.park", true);
                await expectState("control.park", true, true);

                // manual drive: runs while the state is written again and again
                await write("control.jogElevation", 1);
                await expectState("axes.elevation.output", 1);
                await expectState("control.jogElevation", 1, true);
                await expectState("jog.active", true);
                for (let i = 0; i < 5; i++) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                    await write("control.jogElevation", 1);
                }
                expect(device.jog, "the drive is still running after 1.5 s of renewals").to.include({
                    axis: "elevation",
                    dir: 1,
                });
                expect(device.jogFrames).to.be.greaterThan(4);

                // ...and stops by itself when the writes stop (dead man)
                await expectState("control.jogElevation", 0, true);
                await expectState("axes.elevation.output", 0);
                expect(device.jog).to.equal(undefined);
                await until(async () => (await lastResult()).reason === "hold", "result of the dead man");
                expect(harness.hasLog("dead man", "warn")).to.equal(true);

                // a drive is stopped at once by writing 0
                await write("control.jogAzimuth", -1);
                await expectState("axes.azimuth.output", -1);
                await write("control.jogAzimuth", 0);
                await expectState("axes.azimuth.output", 0);
                await expectState("control.jogAzimuth", 0, true);

                // locked at the display: the command is refused and the switch goes back
                device.setStatus({ remoteLocked: true });
                await expectState("status.remoteLocked", true);
                await write("control.auto", true);
                await until(async () => (await lastResult()).reason === "locked", "result locked");
                await expectState("control.auto", false, true);
                expect(device.status.auto).to.equal(false);
                await write("control.auto", true);
                await new Promise(resolve => setTimeout(resolve, 500));
                await expectState("control.auto", false, true);
                const lockedWarnings = harness.getLogs("warn").filter(log => log.message.includes("locked at the display"));
                expect(lockedWarnings, "the same refusal is a warning only once").to.have.length(1);

                // acknowledge a fault
                device.setStatus({ remoteLocked: false, fault: { io: false, motor: true } });
                await expectState("status.faultMotor", true);
                await write("control.acknowledge", true);
                await expectState("status.faultMotor", false);

                // a value that is no direction
                await write("control.jogElevation", 5);
                await until(async () => (await lastResult()).reason === "range", "result range");
                await expectState("control.jogElevation", 0, true);

                for (const log of harness.getLogs()) {
                    expect(log.message).to.not.contain(TOKEN);
                }
                expect(harness.getLogs("error")).to.deep.equal([]);
            });
        });

        suite("Commands without a token (mock device)", getHarness => {
            /** @type {MockDevice} */
            let device;

            before(async () => {
                device = new MockDevice();
                await device.start();
            });

            after(async () => {
                await device.stop();
            });

            it("reads everything but gets every command refused", async function () {
                this.timeout(60000);
                const harness = getHarness();
                const state = async id => harness.states.getStateAsync(`${NAMESPACE}.${id}`);
                await harness.changeAdapterConfig("samba-solar-track", {
                    native: { ip: "127.0.0.1", port: device.port, token: "" },
                });
                await harness.startAdapterAndWait(true);
                await until(async () => (await state("control.auto"))?.val === true, "control.auto");
                expect((await state("info.authorized"))?.val).to.equal(false);

                await harness.states.setStateAsync(`${NAMESPACE}.control.auto`, { val: false, ack: false });
                await until(
                    async () => JSON.parse((await state("control.lastResult"))?.val ?? "{}").reason === "auth",
                    "result auth",
                );
                await until(async () => {
                    const auto = await state("control.auto");
                    return auto?.val === true && auto.ack === true;
                }, "control.auto back to true");
                expect(device.status.auto).to.equal(true);
                expect(harness.hasLog("the token is missing or wrong", "warn")).to.equal(true);
            });
        });

        suite("Adapter without configuration", getHarness => {
            it("starts, reports the missing address once and stays without connection", async function () {
                this.timeout(60000);
                const harness = getHarness();
                await harness.changeAdapterConfig("samba-solar-track", { native: { ip: "" } });
                await harness.startAdapterAndWait();
                await until(() => harness.hasLog("No address of the device configured", "error"), "error about the address");
                const connection = await harness.states.getStateAsync(`${NAMESPACE}.info.connection`);
                expect(connection?.val).to.equal(false);
                expect(harness.getLogs("error")).to.have.length(1);
            });
        });
    },
});
