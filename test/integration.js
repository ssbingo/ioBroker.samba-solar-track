const crypto = require("node:crypto");
const path = require("path");
const { tests } = require("@iobroker/testing");
const { expect } = require("chai");
const { MockDevice, TOKEN, TOKEN_BLOCKS } = require("./mock-device");

const NAMESPACE = "samba-solar-track.0";

/**
 * The four token fields of the adapter settings.
 *
 * @param {string[]} [blocks] values of the fields, in the order of the display
 */
function tokenFields(blocks = TOKEN_BLOCKS) {
    return { tokenBlock1: blocks[0], tokenBlock2: blocks[1], tokenBlock3: blocks[2], tokenBlock4: blocks[3] };
}

/**
 * Decrypts a protected setting the way js-controller stores it ($/aes-192-cbc:<iv>:<data>).
 *
 * @param {string} secret the system secret (system.config, native.secret)
 * @param {string} value the stored value
 */
function decryptSetting(secret, value) {
    const [, iv, data] = String(value).split(":", 3);
    const decipher = crypto.createDecipheriv("aes-192-cbc", Buffer.from(secret, "hex"), Buffer.from(iv, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(data, "hex")), decipher.final()]).toString();
}

/**
 * Checks that neither the token nor a block of it appears in a log line.
 *
 * @param {{ message: string }[]} logs the captured log lines
 * @param {string[]} [more] other secrets, e.g. a block as it was entered
 */
function expectNoSecret(logs, more = []) {
    for (const log of logs) {
        for (const secret of [TOKEN, ...TOKEN_BLOCKS, ...more]) {
            expect(log.message).to.not.contain(secret);
        }
    }
}

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

                // the blocks as a user may type them: upper case, a space before or after
                const typed = [TOKEN_BLOCKS[0].toUpperCase(), ` ${TOKEN_BLOCKS[1]}`, `${TOKEN_BLOCKS[2]} `, TOKEN_BLOCKS[3]];
                await harness.changeAdapterConfig("samba-solar-track", {
                    common: { loglevel: "silly" },
                    native: { ip: "127.0.0.1", port: device.port, ...tokenFields(typed), forwardLevel: "W", historySize: 5 },
                });
                await harness.startAdapterAndWait(true);

                // values of GET /api/info, the hello frame and the first status
                await expectState("status.state", "IDLE");
                await expectState("info.connection", true);
                await expectState("info.firmware", "0.0.1");
                await expectState("info.protocol", 1);
                await expectState("info.deviceId", "aa:bb:cc:dd:ee:ff");
                // the device accepts the token put together from the four fields
                await expectState("info.authorized", true);
                await until(() => harness.hasLog("token from the four fields complete (32 characters)", "info"), "summary of the token");
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
                await until(() => harness.hasLog("[dev] #2 [W][wind] Windmesser antwortet nicht", "warn"), `log line "[dev] #2 [W][wind] Windmesser antwortet nicht"`.replace(/"/g, ""));
                await until(() => harness.hasLog("[dev] #3 [W][track] Sturm", "warn"), `log line "[dev] #3 [W][track] Sturm"`.replace(/"/g, ""));
                expect(harness.hasLog("[dev] #1 ")).to.equal(false);

                // the device restarts: connection drops and comes back with new sequence numbers
                device.restart();
                device.pushLog("I", "main", "Start abgeschlossen nach 455 ms");
                await until(async () => (await value("info.bootId")) === device.bootId, "new boot id");
                await until(async () => (await value("messages.lastSeq")) === 1, "messages.lastSeq 1 after restart");
                await expectState("info.connection", true);
                await until(() => harness.hasLog("The device has restarted", "info"), `log line "The device has restarted"`.replace(/"/g, ""));

                // no secret in the log, even at level silly
                const logs = harness.getLogs();
                expect(logs.length).to.be.greaterThan(20);
                expectNoSecret(logs, typed.map(block => block.trim()));
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
                    native: { ip: "127.0.0.1", port: device.port, ...tokenFields() },
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
                await until(() => harness.hasLog("dead man", "warn"), `log line "dead man"`.replace(/"/g, ""));

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
                await until(() => harness.hasLog("locked at the display", "warn"), "warning about the lock");
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

                expectNoSecret(harness.getLogs());
                expect(harness.getLogs("error")).to.deep.equal([]);
            });
        });

        suite("Settings of a Samba Solar Track (mock device)", getHarness => {
            /** @type {MockDevice} */
            let device;

            before(async () => {
                device = new MockDevice();
                await device.start();
            });

            after(async () => {
                await device.stop();
            });

            it("creates a state for every setting, writes changes, shows proposals and saves the setup", async function () {
                this.timeout(120000);
                const harness = getHarness();
                const state = async id => harness.states.getStateAsync(`${NAMESPACE}.${id}`);
                const object = async id => harness.objects.getObjectAsync(`${NAMESPACE}.${id}`);
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
                const lastResult = async () => JSON.parse((await state("params.lastResult"))?.val ?? "{}");
                const param = key => device.params.find(entry => entry.key === key);

                await harness.changeAdapterConfig("samba-solar-track", {
                    common: { loglevel: "debug" },
                    native: { ip: "127.0.0.1", port: device.port, ...tokenFields() },
                });
                await harness.startAdapterAndWait(true);

                // every setting of the device has a state with its limits
                await expectState("params.safety.stormKmh", 40, true);
                await expectState("params.control.nightReturnEast", true, true);
                await expectState("params.diagnostics.logLevel", 4, true);
                await expectState("params.pending", "{}", true);
                const storm = await object("params.safety.stormKmh");
                expect(storm.common).to.include({ type: "number", role: "level", unit: "km/h", min: 20, max: 60, write: true });
                expect(storm.native).to.deep.equal({ key: "stormKmh", apply: "confirm" });
                expect((await object("params.safety")).type).to.equal("channel");
                expect((await object("params.commissioning.limitSwitchesAzimuth")).common).to.include({
                    type: "boolean",
                    role: "switch",
                });

                // a value that is valid at once
                await write("params.control.trackStartPermille", 100);
                await expectState("params.control.trackStartPermille", 100, true);
                expect(param("trackStartPermille").value).to.equal(100);
                await until(async () => (await lastResult()).key === "trackStartPermille", "result of the change");
                expect(await lastResult()).to.include({ result: "applied", reason: null });

                // a safety value is only a proposal until it is confirmed at the display
                await write("params.safety.stormKmh", 45);
                await expectState("params.pending", '{"stormKmh":45}', true);
                await expectState("params.safety.stormKmh", 40, true);
                await expectState("status.pendingConfirm", '["stormKmh"]');
                expect(param("stormKmh")).to.include({ value: 40, pending: 45 });
                await until(async () => (await lastResult()).result === "pending", "result pending");
                device.confirmAtDisplay("stormKmh", true);
                await expectState("params.safety.stormKmh", 45, true);
                await expectState("params.pending", "{}", true);
                await until(() => harness.hasLog("stormKmh: the proposal 45 was confirmed at the display", "info"), `log line "stormKmh: the proposal 45 was confirmed at the display"`.replace(/"/g, ""));

                // a proposal that is refused at the display
                await write("params.safety.motorDeadtimeMs", 800);
                await expectState("params.pending", '{"motorDeadtimeMs":800}', true);
                device.confirmAtDisplay("motorDeadtimeMs", false);
                await expectState("params.pending", "{}", true);
                await expectState("params.safety.motorDeadtimeMs", 500, true);
                await until(() => harness.hasLog("motorDeadtimeMs: the proposal 800 was not accepted", "info"), `log line "motorDeadtimeMs: the proposal 800 was not accepted"`.replace(/"/g, ""));

                // outside the limits: the device refuses, the old value stays
                await write("params.safety.stormKmh", 80);
                await until(async () => (await lastResult()).reason === "range", "result range");
                await expectState("params.safety.stormKmh", 45, true);
                await until(() => harness.hasLog("stormKmh = 80", "warn"), `log line "stormKmh = 80"`.replace(/"/g, ""));

                // a change made at the display arrives
                param("nightDelayMs").value = 600000;
                device.sendRaw({ t: "params", changed: [param("nightDelayMs")] });
                await expectState("params.control.nightDelayMs", 600000, true);

                // design
                await write("control.design", 3);
                await expectState("status.design", 3);
                await expectState("control.design", 3, true);
                await write("control.design", 99);
                await until(async () => (await lastResult()).key === "design" && (await lastResult()).reason === "range", "design out of range");
                await expectState("control.design", 3, true);

                // locked at the display: nothing can be changed
                device.setStatus({ remoteLocked: true });
                await expectState("status.remoteLocked", true);
                await write("params.control.trackStartPermille", 120);
                await until(async () => (await lastResult()).reason === "locked", "result locked");
                await expectState("params.control.trackStartPermille", 100, true);
                device.setStatus({ remoteLocked: false });
                await expectState("status.remoteLocked", false);

                // setup: choose first, then save; the device restarts with one axis
                await write("setup.mode", 1);
                await new Promise(resolve => setTimeout(resolve, 300));
                expect(device.status.mode, "choosing alone changes nothing").to.equal(2);
                const bootBefore = device.bootId;
                await write("setup.save", true);
                await until(() => device.bootId !== bootBefore, "restart of the device");
                await expectState("status.mode", 1);
                await expectState("setup.mode", 1, true);
                await expectState("info.connection", true);
                await until(() => harness.hasLog("Setup saved", "info"), `log line "Setup saved"`.replace(/"/g, ""));

                // the settings of the second axis are gone, the others are still there
                // the adapter deletes them one after the other: wait for each
                for (const gone of [
                    "params.safety.motorMaxRunMsAzimuth",
                    "params.commissioning.limitSwitchesAzimuth",
                    "params.control.nightReturnEast",
                ]) {
                    await until(async () => (await object(gone)) == null, `${gone} removed`);
                }
                expect(await object("params.safety.motorMaxRunMsElevation")).to.be.an("object");
                await expectState("params.control.trackStartPermille", 100, true);

                // saving again without a change does not restart the device
                const bootAfter = device.bootId;
                await write("setup.save", true);
                await until(async () => (await lastResult()).reason === "same", "result same");
                expect(device.bootId).to.equal(bootAfter);

                expectNoSecret(harness.getLogs());
                expect(harness.getLogs("error")).to.deep.equal([]);
            });
        });

        suite("Notifications (mock device)", getHarness => {
            /** @type {MockDevice} */
            let device;

            before(async () => {
                device = new MockDevice();
                await device.start();
            });

            after(async () => {
                await device.stop();
            });

            it("sends the selected events to the messaging instance and lists messaging instances for the settings page", async function () {
                this.timeout(90000);
                const harness = getHarness();
                const state = async id => harness.states.getStateAsync(`${NAMESPACE}.${id}`);
                await harness.changeAdapterConfig("samba-solar-track", {
                    common: { loglevel: "debug" },
                    native: {
                        ip: "127.0.0.1",
                        port: device.port,
                        ...tokenFields(),
                        notifyEnabled: true,
                        messagingInstance: "telegram.0",
                        notifyStorm: true,
                        notifyFault: true,
                        notifyWind: false,
                        notifySensor: true,
                        notifyConnection: true,
                        notifyRestart: true,
                    },
                });
                await harness.startAdapterAndWait(true);
                await until(async () => (await state("status.state"))?.val === "IDLE", "status.state IDLE");
                await until(() => harness.hasLog("[ntf] Notifications to telegram.0 for: storm, fault, sensor, connection, restart", "info"), "summary of the notifications");

                // storm begins and ends
                device.setStatus({
                    state: "STORM",
                    storm: { active: true, remainingMs: 600000 },
                    wind: { ...device.status.wind, gustKmh: 44 },
                });
                await until(
                    () => harness.hasLog("[ntf] storm/stormStarted sent to telegram.0: samba-solar-track: storm protection active. Gust 44.0 km/h, threshold 40.0 km/h.", "debug"),
                    "notification about the storm",
                );
                device.setStatus({ state: "IDLE", storm: { active: false, remainingMs: 0 } });
                await until(() => harness.hasLog("[ntf] storm/stormEnded sent to telegram.0", "debug"), "notification about the end of the storm");

                // an event that is not selected is not sent
                device.setStatus({ wind: { ...device.status.wind, ok: false } });
                await until(() => harness.hasLog("[ntf] wind/windLost not sent: this kind of event is not selected", "debug"), "skipped notification");
                expect(harness.hasLog("windLost sent to")).to.equal(false);

                // a runtime fault names the axis
                device.setStatus({
                    fault: { io: false, motor: true },
                    axes: { ...device.status.axes, azimuth: { ...device.status.axes.azimuth, fault: true } },
                });
                await until(() => harness.hasLog("[ntf] fault/faultMotor sent to telegram.0", "debug"), "notification about the fault");
                expect(harness.getLogs("debug").find(log => log.message.includes("fault/faultMotor sent")).message).to.contain("(azimuth)");

                // restart of the device
                device.restart();
                await until(() => harness.hasLog("[ntf] restart/deviceRestarted sent to telegram.0", "debug"), "notification about the restart");

                // the settings page asks for the messaging instances; this test system has none
                const options = await new Promise(resolve =>
                    harness.sendTo("samba-solar-track.0", "getMessagingInstances", {}, answer => resolve(answer)),
                );
                expect(options).to.deep.equal([]);

                expectNoSecret(harness.getLogs());
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
                    native: { ip: "127.0.0.1", port: device.port, ...tokenFields(["", "", "", ""]), token: "" },
                });
                await harness.startAdapterAndWait(true);
                await until(async () => (await state("control.auto"))?.val === true, "control.auto");
                expect((await state("info.authorized"))?.val).to.equal(false);
                await until(() => harness.hasLog("token not set (read only)", "info"), "summary of the token");

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
                await until(() => harness.hasLog("the token is missing or wrong", "warn"), `log line "the token is missing or wrong"`.replace(/"/g, ""));
                // no token is no mistake: neither an error nor a warning about the token
                expect(harness.getLogs("error")).to.deep.equal([]);
                expect(harness.hasLog("did not accept the token")).to.equal(false);
            });
        });

        suite("Token of version 0.0.4 and older (mock device)", getHarness => {
            /** @type {MockDevice} */
            let device;

            before(async () => {
                device = new MockDevice();
                await device.start();
            });

            after(async () => {
                await device.stop();
            });

            it("moves a token of the old single field, typed with spaces, into the four fields and uses it", async function () {
                this.timeout(60000);
                const harness = getHarness();
                const state = async id => harness.states.getStateAsync(`${NAMESPACE}.${id}`);
                const typed = `${TOKEN_BLOCKS[0]} ${TOKEN_BLOCKS[1]}\n${TOKEN_BLOCKS[2]} ${TOKEN_BLOCKS[3].toUpperCase()}`;
                await harness.changeAdapterConfig("samba-solar-track", {
                    common: { loglevel: "debug" },
                    native: { ip: "127.0.0.1", port: device.port, ...tokenFields(["", "", "", ""]), token: typed },
                });
                await harness.startAdapterAndWait(true);
                await until(async () => (await state("info.authorized"))?.val === true, "info.authorized");
                await until(() => harness.hasLog("token from the old token field complete (32 characters)", "info"), "summary of the token");

                // since 0.0.6 the settings show only the four fields: the token is moved there, encrypted
                await until(
                    () => harness.hasLog("moved from the old token field into the four fields", "info"),
                    "move of the old token",
                );
                const instance = await harness.objects.getObjectAsync(`system.adapter.${NAMESPACE}`);
                const secret = (await harness.objects.getObjectAsync("system.config"))?.native.secret;
                const stored = name => instance?.native[name];
                // js-controller stores protected settings as $/aes-192-cbc:<iv>:<data>, also an empty one
                expect(decryptSetting(secret, stored("token")), "old field").to.equal("");
                TOKEN_BLOCKS.forEach((block, index) => {
                    const name = `tokenBlock${index + 1}`;
                    expect(stored(name), `${name} stored encrypted`).to.match(/^\$\/aes-192-cbc:/);
                    expect(decryptSetting(secret, stored(name)), name).to.equal(block);
                });

                // the device takes commands with this token
                await harness.states.setStateAsync(`${NAMESPACE}.control.auto`, { val: false, ack: false });
                await until(async () => (await state("status.auto"))?.val === false, "status.auto false");
                expect(device.status.auto).to.equal(false);

                expectNoSecret(harness.getLogs(), [typed, TOKEN_BLOCKS[3].toUpperCase()]);
                expect(harness.getLogs("error")).to.deep.equal([]);
                // The restart by js-controller after the move cannot be tested here: the test harness
                // starts the adapter only once per suite. The next start is covered by the unit test
                // "protocol => migrateOldToken: the start after the move ...".
            });
        });

        suite("Wrong token block (mock device)", getHarness => {
            /** @type {MockDevice} */
            let device;

            before(async () => {
                device = new MockDevice();
                await device.start();
            });

            after(async () => {
                await device.stop();
            });

            it("names the wrong block once, reads everything and sends no token", async function () {
                this.timeout(60000);
                const harness = getHarness();
                const state = async id => harness.states.getStateAsync(`${NAMESPACE}.${id}`);
                // block 2 lacks its last character; the old field must not be used instead
                const blocks = [TOKEN_BLOCKS[0], TOKEN_BLOCKS[1].slice(0, 7), TOKEN_BLOCKS[2], TOKEN_BLOCKS[3]];
                await harness.changeAdapterConfig("samba-solar-track", {
                    common: { loglevel: "debug" },
                    native: { ip: "127.0.0.1", port: device.port, ...tokenFields(blocks), token: TOKEN },
                });
                await harness.startAdapterAndWait(true);
                await until(async () => (await state("status.state"))?.val === "IDLE", "status.state IDLE");
                await until(async () => (await state("info.connection"))?.val === true, "info.connection");
                expect((await state("info.authorized"))?.val).to.equal(false);

                const errors = harness.getLogs("error");
                expect(errors).to.have.length(1);
                expect(errors[0].message).to.contain("[cfg] The token in the adapter settings cannot be used: block 2 has 7 characters instead of 8.");
                expect(errors[0].message).to.contain('gear > NETZWERK > "TOKEN FUER DEN ADAPTER" as 4 blocks of 8 characters');
                expect(harness.hasLog("token from the four fields incomplete or wrong (read only)", "info")).to.equal(true);
                // no token was sent, so the device has nothing to refuse
                expect(harness.hasLog("did not accept the token")).to.equal(false);

                // the four fields are in use: the old field is only emptied (stored encrypted), nothing is moved
                await until(() => harness.hasLog("the old token field was emptied, the four fields are used", "info"), "old field emptied");
                expect(harness.hasLog("moved from the old token field")).to.equal(false);
                const instance = await harness.objects.getObjectAsync(`system.adapter.${NAMESPACE}`);
                const secret = (await harness.objects.getObjectAsync("system.config"))?.native.secret;
                expect(decryptSetting(secret, instance?.native.token), "old field").to.equal("");

                // commands are refused by the device
                await harness.states.setStateAsync(`${NAMESPACE}.control.auto`, { val: false, ack: false });
                await until(
                    async () => JSON.parse((await state("control.lastResult"))?.val ?? "{}").reason === "auth",
                    "result auth",
                );
                expect(device.status.auto).to.equal(true);

                expectNoSecret(harness.getLogs(), [blocks[1]]);
                expect(harness.getLogs("error")).to.have.length(1);
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
