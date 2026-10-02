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
