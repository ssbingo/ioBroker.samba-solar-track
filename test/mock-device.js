// @ts-nocheck
"use strict";
/*
 * A Samba Solar Track that exists only in memory: HTTP and WebSocket as described in PROTOCOL.md
 * of the firmware project. Used by the unit tests of the device client and by the integration
 * test. It is not part of the published adapter.
 */
const http = require("node:http");
const { WebSocketServer } = require("ws");
const FIRMWARE_PARAMS = require("./mock-params");

/** Settings that exist only with two axes or with a wind sensor with direction */
const AZIMUTH_ONLY = ["motorMaxRunMsAzimuth", "limitSwitchesAzimuth", "nightReturnEast", "syncResetAzimuth"];
const DIRECTION_ONLY = ["windDirAddr", "windDirFunction", "windDirRegister", "windDirScale"];
/** Settings that exist only with one axis (vertical only) */
const ELEVATION_ONLY = [
    "elevTravelSteepMs",
    "elevTravelFlatMs",
    "elevGeometry",
    "elevStartLossMs",
    "elevPreset1",
    "elevPreset2",
    "elevHall",
    "elevHallInvert",
    "elevHallSteps",
    "rackAzimuth",
    "cloudAstro",
    "cloudLevel",
];
/** Settings that exist only with a feature of the firmware (PROTOCOL.md, section 8) */
const FEATURE_OF = {
    elevTravelSteepMs: "position",
    elevTravelFlatMs: "position",
    elevGeometry: "position",
    elevStartLossMs: "position",
    elevPreset1: "position",
    elevPreset2: "position",
    elevHall: "hall",
    elevHallInvert: "hall",
    elevHallSteps: "hall",
    syncResetElevation: "syncreset",
    syncResetAzimuth: "syncreset",
    siteLatitude: "sunpos",
    siteLongitude: "sunpos",
    rackAzimuth: "sunpos",
    nightAfterSunsetMin: "sunpos",
    dayBeforeSunriseMin: "sunpos",
    cloudAstro: "sunpos",
    cloudLevel: "sunpos",
};

/** Every feature of the firmware 0.7.8 (as FEATURES in src/net/net.cpp of the firmware project) */
const FEATURES_078 = [
    "status",
    "log",
    "command",
    "jog",
    "park",
    "setup",
    "params",
    "update",
    "time",
    "fwonline",
    "duty",
    "position",
    "hall",
    "battery",
    "lang",
    "updatepark",
    "power",
    "chargecheck",
    "syncreset",
    "sunpos",
    "commissioning",
    "reportjson",
];

/** Test report as text, as the firmware writes it (shortened example) */
const REPORT_TEXT =
    "PRUEFBERICHT SAMBA SOLAR TRACK\nDatum: 2026-11-11 14:32\nFirmware: 0.7.8\nBetriebsart: nur vertikal\n" +
    " 1 Sicherheit: BESTANDEN\n 6 Fahrweg der Elevation: BESTANDEN (steiler 52300 ms, flacher 49600 ms)\n";

/** Data set of the same report (GET /api/report?format=json), example of PROTOCOL.md for one axis */
function reportData() {
    return {
        v: 1,
        fw: "0.7.8",
        epoch: 1794407520,
        durationS: 6420,
        done: true,
        simulation: false,
        dualAxis: false,
        windDirection: true,
        plant: {
            limitElevation: false,
            limitAzimuth: false,
            hall: true,
            syncResetElevation: 1,
            syncResetAzimuth: 0,
            maxRunElevationMs: 60000,
            maxRunAzimuthMs: 90000,
        },
        site: { set: true, lat: 51.0504, lon: 13.7373, rackAz: 0 },
        steps: [
            { n: 1, key: "safety", result: "passed" },
            { n: 6, key: "elevtravel", result: "passed" },
            { n: 9, key: "position", result: "passed" },
            { n: 11, key: "network", result: "skipped" },
            { n: 13, key: "signals", result: "skipped" },
            { n: 14, key: "tracktest", result: "open" },
        ],
        values: {
            windSpinKmh: 18.4,
            windDirDeg: 3,
            flatPlus: true,
            flatDirChanged: false,
            flatRunMs: 41800,
            elevSteepMs: 52300,
            elevFlatMs: 49600,
            elevHallSteps: 1184,
            azEastMs: 0,
            azWestMs: 0,
            azBackMs: 0,
            syncOk: true,
            posReadDeg: 30,
            sun: { east: 1, west: 0, south: 2, north: 3 },
            sensorFixes: 1,
            trackFixes: 0,
            leds: "unchecked",
            sound: "unchecked",
            motion: "unchecked",
        },
    };
}

/**
 * The parts of the status that exist only with a feature (PROTOCOL.md, section 5).
 *
 * @param {object} status the status to complete
 * @param {string[]} features features of the firmware
 */
function addFeatureStatus(status, features) {
    const has = feature => features.includes(feature);
    const oneAxis = status.mode === 1;
    if (has("syncreset")) {
        for (const axis of ["elevation", "azimuth"]) {
            status.axes[axis].syncReset = {
                port: axis === "elevation" ? "j23" : "off",
                available: axis === "elevation",
                phase: "idle",
                remainingMs: 0,
                phaseRemainingMs: 0,
                totalMs: 0,
                result: "none",
                reason: "",
                resultMs: null,
            };
        }
    }
    if (has("fwonline")) {
        status.fwOnline = {
            state: "available",
            current: "0.7.8",
            latest: "0.7.9",
            date: "2026-11-20",
            notes: "Beispiel",
            size: 1811856,
            checkedAgoMs: 3600000,
            error: null,
            percent: 0,
            rolledBack: null,
            newer: true,
            canInstall: true,
            keyPresent: true,
            awaitingConfirm: false,
        };
    }
    if (has("position") && oneAxis) {
        status.position = {
            target: null,
            phase: "none",
            deg: 38,
            known: true,
            uncert: 2,
            calibrated: true,
            presets: [0, 15, 30, 45, 60],
            waitMs: 0,
        };
        if (has("hall")) {
            status.position.source = "hall";
            status.position.hall = { enabled: true, ok: true, fault: null, count: 15620, steps: 60000, faults: 0 };
        }
    }
    if (has("sunpos")) {
        status.sunPos = {
            known: true,
            timeOk: true,
            siteSet: true,
            lat: 51.0504,
            lon: 13.7373,
            az: 190.5,
            el: 21.1,
            rise: 1794291186,
            set: 1794324284,
            noon: 1794307735,
            noonEl: 21.7,
            alwaysUp: false,
            alwaysDown: false,
            night: false,
            nightStart: 1794326084,
            dayStart: 1794291186,
            astroTarget: null,
        };
        if (oneAxis) {
            status.sunPos.rackAz = 0;
            status.sunPos.bestTilt = 68.5;
        }
    }
    if (has("update")) {
        status.update = { active: false, percent: 0 };
        if (has("updatepark")) {
            status.update.phase = "none";
            status.update.error = null;
        }
    }
    if (has("battery")) {
        status.battery = { fitted: true, valid: true, percent: 82, charging: true, level: "ok" };
    }
    if (has("power")) {
        status.supply.v24 = true;
        status.supply.v5 = true;
    }
    if (has("chargecheck")) {
        status.supply.adcOk = true;
        status.supply.checks = [];
    }
    if (has("commissioning")) {
        status.commissioning = {
            done: true,
            active: false,
            step: "done",
            phase: "passed",
            number: 13,
            total: 13,
            optional: false,
        };
    }
}

/** Token of the device: 32 hex characters in lower case, as the firmware expects it (invented example) */
const TOKEN = "3f9a1c2077b4e1d20a5c9e314b6f8d02";
/** The same token as the display shows it: 4 blocks of 8 characters, one field each in the settings */
const TOKEN_BLOCKS = [TOKEN.slice(0, 8), TOKEN.slice(8, 16), TOKEN.slice(16, 24), TOKEN.slice(24, 32)];

/** Status as in the example of PROTOCOL.md */
function defaultStatus() {
    return {
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
                flatDir: 1,
                deg: 38,
                degSource: "time",
                errPermille: 7,
            },
            azimuth: {
                enabled: true,
                out: 0,
                limitPlus: false,
                limitMinus: false,
                blockedPlus: false,
                blockedMinus: false,
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
        pendingConfirm: [],
        counters: {
            relayIoErrors: 0,
            ledIoErrors: 0,
            lightErrors: 0,
            windErrors: 0,
            windDirErrors: 0,
            sensorSupplyFaults: 0,
            ledSupplyFaults: 0,
        },
    };
}

class MockDevice {
    /**
     * @param {{ device?: string, protocol?: number, ringSize?: number, autoPong?: boolean, jogTimeoutMs?: number, features?: string[], mode?: number, fw?: string }} [options]
     */
    constructor(options = {}) {
        this.device = options.device ?? "samba-solar-track";
        this.protocol = options.protocol ?? 1;
        this.ringSize = options.ringSize ?? 300;
        /** a manual drive stops after this time without renewal (the firmware uses 1000 ms) */
        this.jogTimeoutMs = options.jogTimeoutMs ?? 1000;
        this.features = options.features ?? ["status", "log", "command", "jog", "park", "setup", "params"];
        /** true = someone operates the display: manual drive from remote is refused with "local" */
        this.localActive = false;
        /** running manual drive: { ws, axis, dir, renewed } */
        this.jog = undefined;
        /** after the device ended a drive itself: { ws, reason } until that connection sends a stop */
        this.release = undefined;
        /** number of jog frames received, including renewals */
        this.jogFrames = 0;
        /** all settings; which of them are reported depends on mode and wind sensor */
        this.params = FIRMWARE_PARAMS.map(entry => ({ ...entry }));
        /** bodies of the POST requests received, with the token that came with them */
        this.posts = [];
        this.token = TOKEN;
        this.fw = options.fw ?? "0.0.1";
        this.status = defaultStatus();
        if (options.mode === 1) {
            this.status.mode = 1;
            this.status.axes.azimuth.enabled = false;
        }
        addFeatureStatus(this.status, this.features);
        /** test reports as text, newest first (feature commissioning) */
        this.reports = this.features.includes("commissioning") ? [REPORT_TEXT] : [];
        /** data set of the newest report (feature reportjson), null = none */
        this.reportJson = this.features.includes("reportjson") ? reportData() : null;
        /** number of GET /api/report requests */
        this.reportRequests = 0;
        /** frames received from clients, parsed */
        this.received = [];
        /** number of answered GET /api/info */
        this.infoRequests = 0;
        /** false = the device answers no HTTP request and no WebSocket frame */
        this.answering = true;
        this.port = 0;
        this.boot();
        this.server = http.createServer((req, res) => this.handleHttp(req, res));
        // autoPong false = the device does not answer pings (to test the watchdog of the client)
        this.wss = new WebSocketServer({ noServer: true, autoPong: options.autoPong ?? true });
        this.server.on("upgrade", (req, socket, head) => {
            const url = new URL(req.url ?? "/", "http://device");
            if (url.pathname !== "/ws" || !this.answering) {
                socket.destroy();
                return;
            }
            this.wss.handleUpgrade(req, socket, head, ws => this.handleSocket(ws, url));
        });
    }

    boot() {
        this.bootId = Math.random().toString(16).slice(2, 10).padEnd(8, "0");
        this.bootedAt = Date.now();
        this.lines = [];
        this.nextSeq = 1;
    }

    get uptimeMs() {
        return Date.now() - this.bootedAt;
    }

    /** number of open WebSocket connections */
    get connections() {
        return this.wss.clients.size;
    }

    /** Starts listening on a free port of 127.0.0.1 */
    async start() {
        await new Promise(resolve => this.server.listen(this.port, "127.0.0.1", resolve));
        this.port = this.server.address().port;
        // dead man of the manual drive, as in the control loop of the firmware
        this.jogWatch = setInterval(() => {
            if (this.jog && Date.now() - this.jog.renewed >= this.jogTimeoutMs) {
                this.abortJog("state");
            }
        }, 20);
        return this.port;
    }

    /** Closes all connections and the server */
    async stop() {
        clearInterval(this.jogWatch);
        for (const ws of this.wss.clients) {
            ws.terminate();
        }
        this.server.closeAllConnections?.();
        await new Promise(resolve => this.server.close(resolve));
    }

    /** Simulates a restart of the device: connections drop, boot id and sequence numbers start again */
    restart() {
        for (const ws of this.wss.clients) {
            ws.terminate();
        }
        this.boot();
    }

    /** Drops all WebSocket connections, the device keeps running */
    dropClients() {
        for (const ws of this.wss.clients) {
            ws.terminate();
        }
    }

    info() {
        return {
            device: this.device,
            fw: this.fw,
            protocol: this.protocol,
            id: "aa:bb:cc:dd:ee:ff",
            hostname: "samba-solar-track",
            features: this.features,
            bootId: this.bootId,
            uptimeMs: this.uptimeMs,
            ip: "127.0.0.1",
            wifiRssi: -61,
            heapFree: 180000,
            heapMin: 150000,
            resetReason: "Einschalten",
            simulation: this.status.simulation,
        };
    }

    statusBody() {
        return {
            bootId: this.bootId,
            uptimeMs: this.uptimeMs,
            logNext: this.nextSeq,
            logLost: 0,
            heapFree: 180000,
            wifiRssi: -61,
            ...this.status,
        };
    }

    handleHttp(req, res) {
        if (!this.answering) {
            // never answer: the client has to run into its timeout
            return;
        }
        const url = new URL(req.url ?? "/", "http://device");
        const send = (code, body) => {
            res.writeHead(code, { "Content-Type": "application/json" });
            res.end(JSON.stringify(body));
        };
        if (req.method === "GET" && url.pathname === "/api/info") {
            this.infoRequests++;
            send(200, this.info());
        } else if (req.method === "GET" && url.pathname === "/api/status") {
            send(200, this.statusBody());
        } else if (req.method === "GET" && url.pathname === "/api/params") {
            send(200, { params: this.visibleParams() });
        } else if (req.method === "GET" && url.pathname === "/api/report" && this.features.includes("commissioning")) {
            this.reportRequests++;
            const n = Number(url.searchParams.get("n") ?? "0");
            if (!Number.isInteger(n) || n < 0 || n > 2) {
                send(422, { ok: false, reason: "range", detail: "n ausserhalb 0 bis 2" });
            } else if (url.searchParams.get("format") === "json" && this.features.includes("reportjson")) {
                if (n === 0 && this.reportJson) {
                    send(200, this.reportJson);
                } else {
                    send(409, { ok: false, reason: "state", detail: "kein Datensatz" });
                }
            } else if (this.reports[n] === undefined) {
                send(409, { ok: false, reason: "state", detail: "kein Bericht" });
            } else {
                res.writeHead(200, {
                    "Content-Type": "text/plain; charset=utf-8",
                    "Content-Disposition": `attachment; filename="pruefbericht-samba-solar-track-${n + 1}.txt"`,
                });
                res.end(this.reports[n]);
            }
        } else if (req.method === "GET" && url.pathname === "/api/setup") {
            send(200, { configured: this.status.setupDone, mode: this.status.mode, windSensor: this.status.windSensor });
        } else if (req.method === "POST" && (url.pathname === "/api/params" || url.pathname === "/api/setup")) {
            let text = "";
            req.on("data", chunk => (text += chunk));
            req.on("end", () => {
                let body;
                try {
                    body = JSON.parse(text);
                } catch {
                    body = undefined;
                }
                const authed = req.headers.authorization === `Bearer ${this.token}`;
                this.posts.push({ path: url.pathname, body, authed });
                const [code, answer] =
                    url.pathname === "/api/params" ? this.postParams(body, authed) : this.postSetup(body, authed);
                send(code, answer);
            });
        } else {
            send(404, { ok: false, reason: "unknown", detail: "unbekannte Adresse" });
        }
    }

    handleSocket(ws, url) {
        ws.subscribed = false;
        ws.authed = url.searchParams.get("token") === this.token;
        ws.on("message", data => {
            let frame;
            try {
                frame = JSON.parse(String(data));
            } catch {
                return;
            }
            this.received.push(frame);
            if (!this.answering) {
                return;
            }
            if (frame.t === "sub") {
                this.subscribe(ws, frame.since);
            } else if (frame.t === "cmd") {
                this.handleCommand(ws, frame);
            } else if (frame.t === "jog") {
                this.handleJog(ws, frame);
            }
        });
        ws.on("close", () => {
            if (this.release?.ws === ws) {
                this.release = undefined;
            }
            if (this.jog?.ws === ws) {
                this.endJog();
            }
        });
        ws.send(
            JSON.stringify({
                t: "hello",
                device: this.device,
                fw: this.fw,
                protocol: this.protocol,
                bootId: this.bootId,
                uptimeMs: this.uptimeMs,
                auth: ws.authed,
                logFirst: this.lines.length ? this.lines[0].seq : this.nextSeq,
                logNext: this.nextSeq,
            }),
        );
        ws.send(JSON.stringify({ t: "status", ...this.statusBody() }));
    }

    /** The settings the firmware reports for its features, the chosen mode and wind sensor */
    visibleParams() {
        return this.params.filter(
            entry =>
                (this.status.mode === 2 || !AZIMUTH_ONLY.includes(entry.key)) &&
                (this.status.mode === 1 || !ELEVATION_ONLY.includes(entry.key)) &&
                (this.status.windSensor === 2 || !DIRECTION_ONLY.includes(entry.key)) &&
                (!FEATURE_OF[entry.key] || this.features.includes(FEATURE_OF[entry.key])),
        );
    }

    /** POST /api/params as in the firmware: one result per key */
    postParams(body, authed) {
        if (!body || typeof body.values !== "object" || body.values === null) {
            return [400, { ok: false, reason: "format", detail: "fehlerhafte Anfrage" }];
        }
        if (!authed) {
            return [401, { ok: false, reason: "auth", detail: "Token fehlt oder ist falsch" }];
        }
        if (this.status.remoteLocked) {
            return [423, { ok: false, reason: "locked", detail: "Fernsteuerung am Display gesperrt" }];
        }
        const results = {};
        const changed = [];
        for (const [key, value] of Object.entries(body.values)) {
            if (key === "design") {
                if (typeof value !== "number" || value < 0 || value > 6) {
                    results[key] = { result: "rejected", reason: "range" };
                } else {
                    this.status.design = value;
                    results[key] = { result: "applied", value };
                }
                continue;
            }
            if (key === "simulation") {
                if (value !== false) {
                    results[key] = { result: "rejected", reason: "range" };
                } else {
                    results[key] = { result: "applied", value: false };
                    setTimeout(() => {
                        this.status.simulation = false;
                        this.restart();
                    }, 50);
                }
                continue;
            }
            const entry = this.visibleParams().find(candidate => candidate.key === key);
            if (!entry) {
                results[key] = { result: "rejected", reason: "unknown" };
                continue;
            }
            const typeOk = entry.type === "bool" ? typeof value === "boolean" : typeof value === "number";
            if (!typeOk) {
                results[key] = { result: "rejected", reason: "format" };
            } else if (
                entry.type !== "bool" &&
                (value < entry.min || value > entry.max || (entry.type === "int" && !Number.isInteger(value)))
            ) {
                results[key] = { result: "rejected", reason: "range" };
            } else if (entry.apply === "standstill" && this.jog) {
                results[key] = { result: "rejected", reason: "busy" };
            } else if (entry.apply === "confirm") {
                // a proposal with the valid value withdraws the waiting one
                entry.pending = value === entry.value ? null : value;
                results[key] =
                    entry.pending === null
                        ? { result: "applied", value: entry.value }
                        : { result: "pending", value: entry.value, pending: value };
                changed.push(entry);
            } else {
                entry.value = value;
                results[key] = { result: "applied", value };
                changed.push(entry);
            }
        }
        this.status.pendingConfirm = this.params.filter(entry => entry.pending !== null).map(entry => entry.key);
        if (changed.length) {
            this.broadcast({ t: "params", changed });
        }
        this.broadcast({ t: "status", ...this.statusBody() });
        return [200, { ok: true, results }];
    }

    /**
     * Someone answers the question at the display.
     *
     * @param {string} key key of the setting
     * @param {boolean} accept true = UEBERNEHMEN, false = ABLEHNEN
     */
    confirmAtDisplay(key, accept) {
        const entry = this.params.find(candidate => candidate.key === key);
        if (!entry || entry.pending === null) {
            return;
        }
        if (accept) {
            entry.value = entry.pending;
        }
        entry.pending = null;
        this.status.pendingConfirm = this.params.filter(e => e.pending !== null).map(e => e.key);
        this.broadcast({ t: "params", changed: [entry] });
        this.broadcast({ t: "status", ...this.statusBody() });
    }

    /** POST /api/setup as in the firmware: saves and restarts */
    postSetup(body, authed) {
        const valid = v => v === 1 || v === 2;
        if (!body || typeof body.mode !== "number" || typeof body.windSensor !== "number") {
            return [400, { ok: false, reason: "format", detail: "fehlerhafte Anfrage" }];
        }
        if (!authed) {
            return [401, { ok: false, reason: "auth", detail: "Token fehlt oder ist falsch" }];
        }
        if (this.status.remoteLocked) {
            return [423, { ok: false, reason: "locked", detail: "Fernsteuerung am Display gesperrt" }];
        }
        if (!valid(body.mode) || !valid(body.windSensor)) {
            return [422, { ok: false, reason: "range", detail: "Wert ausserhalb der Grenzen" }];
        }
        setTimeout(() => {
            this.status.mode = body.mode;
            this.status.windSensor = body.windSensor;
            this.status.axes.azimuth.enabled = body.mode === 2;
            this.status.wind.hasDirection = body.windSensor === 2;
            for (const entry of this.params) {
                entry.pending = null;
            }
            this.status.pendingConfirm = [];
            this.restart();
        }, 50);
        return [200, { ok: true, restart: true }];
    }

    /** Answers a command like the firmware: {"t":"result","id":…,"ok":…,"reason":…,"detail":…} */
    result(ws, id, reason, detail) {
        const frame = { t: "result", id: typeof id === "number" ? id : null, ok: !reason };
        if (reason) {
            frame.reason = reason;
        }
        if (detail) {
            frame.detail = detail;
        }
        ws.send(JSON.stringify(frame));
    }

    handleCommand(ws, frame) {
        const locked = this.status.remoteLocked;
        if (!ws.authed) {
            return this.result(ws, frame.id, "auth");
        }
        switch (frame.cmd) {
            case "auto":
                if (locked || !this.status.setupDone) {
                    return this.result(ws, frame.id, locked ? "locked" : "setup");
                }
                this.status.auto = frame.on === true;
                this.status.state = this.status.auto ? (this.status.park ? "PARK" : "IDLE") : "MANUAL";
                if (this.status.auto && this.jog) {
                    this.abortJog("state");
                }
                break;
            case "park":
                if (locked || !this.status.setupDone) {
                    return this.result(ws, frame.id, locked ? "locked" : "setup");
                }
                this.status.park = frame.on === true;
                if (this.status.auto) {
                    this.status.state = this.status.park ? "PARK" : "IDLE";
                }
                break;
            case "ack":
                if (locked) {
                    return this.result(ws, frame.id, "locked");
                }
                this.status.fault = { ...this.status.fault, motor: false };
                break;
            case "position": {
                // PROTOCOL.md, section 7: only with the feature and one axis, only offered angles
                if (!this.features.includes("position") || !this.status.position) {
                    return this.result(ws, frame.id, "unknown");
                }
                if (locked || !this.status.setupDone) {
                    return this.result(ws, frame.id, locked ? "locked" : "setup");
                }
                if (frame.on === false) {
                    this.status.position.target = null;
                    this.status.position.phase = "none";
                    if (this.status.state === "POSITION") {
                        this.status.state = this.status.auto ? "IDLE" : "MANUAL";
                    }
                    break;
                }
                if (typeof frame.deg !== "number") {
                    return this.result(ws, frame.id, "format");
                }
                if (!Number.isInteger(frame.deg) || !this.status.position.presets.includes(frame.deg)) {
                    return this.result(ws, frame.id, "range");
                }
                this.status.position.target = frame.deg;
                this.status.position.phase = "move";
                this.status.state = "POSITION";
                break;
            }
            case "syncReset": {
                const axis = this.status.axes[frame.axis];
                if (!this.features.includes("syncreset")) {
                    return this.result(ws, frame.id, "unknown");
                }
                if (frame.axis !== "elevation" && frame.axis !== "azimuth") {
                    return this.result(ws, frame.id, "format", "Achse fehlt");
                }
                if (locked || !this.status.setupDone) {
                    return this.result(ws, frame.id, locked ? "locked" : "setup");
                }
                if (!axis.syncReset || axis.syncReset.port === "off" || !axis.syncReset.available) {
                    return this.result(ws, frame.id, "unknown", "kein Anschluss fuer den Reset eingestellt");
                }
                if (axis.syncReset.phase !== "idle") {
                    return this.result(ws, frame.id, "busy", "Reset laeuft schon");
                }
                axis.syncReset = {
                    ...axis.syncReset,
                    phase: "pulse",
                    remainingMs: 65000,
                    phaseRemainingMs: 5000,
                    totalMs: 65000,
                    result: "none",
                    reason: "",
                    resultMs: null,
                };
                axis.blockedPlus = true;
                axis.blockedMinus = true;
                break;
            }
            case "fwCheck":
                if (!this.features.includes("fwonline")) {
                    return this.result(ws, frame.id, "unknown");
                }
                if (locked) {
                    return this.result(ws, frame.id, "locked");
                }
                this.status.fwOnline.state = "checking";
                this.status.fwOnline.checkedAgoMs = 0;
                break;
            case "fwInstall":
                if (!this.features.includes("fwonline")) {
                    return this.result(ws, frame.id, "unknown");
                }
                if (locked) {
                    return this.result(ws, frame.id, "locked");
                }
                if (typeof frame.version !== "string" || frame.version.length > 11) {
                    return this.result(ws, frame.id, "format");
                }
                if (frame.version !== this.status.fwOnline.latest || !this.status.fwOnline.canInstall) {
                    return this.result(ws, frame.id, "range");
                }
                this.status.fwOnline.state = "downloading";
                break;
            default:
                return this.result(ws, frame.id, "unknown");
        }
        this.result(ws, frame.id);
        this.broadcast({ t: "status", ...this.statusBody() });
    }

    handleJog(ws, frame) {
        this.jogFrames++;
        if (!ws.authed) {
            return this.result(ws, frame.id, "auth");
        }
        if (frame.dir === 0) {
            // a stop is always accepted, but only ends the own drive
            if (this.release?.ws === ws) {
                this.release = undefined;
            }
            if (this.jog?.ws === ws) {
                this.endJog();
            }
            return this.result(ws, frame.id);
        }
        const axisKnown =
            (frame.axis === "elevation" || (frame.axis === "azimuth" && this.status.mode === 2)) &&
            (frame.dir === 1 || frame.dir === -1);
        let reason;
        if (this.status.remoteLocked) {
            reason = "locked";
        } else if (!this.status.setupDone) {
            reason = "setup";
        } else if (!axisKnown) {
            reason = "unknown";
        } else if (this.status.auto || this.status.state !== "MANUAL") {
            reason = "state";
        } else if (this.localActive) {
            reason = "local";
        } else if (this.jog && this.jog.ws !== ws) {
            reason = "busy";
        } else if (this.release?.ws === ws) {
            reason = this.release.reason;
        }
        if (reason) {
            return this.result(ws, frame.id, reason);
        }
        if (this.jog && this.jog.axis === frame.axis && this.jog.dir === frame.dir) {
            // renewal of a running drive: no answer
            this.jog.renewed = Date.now();
            return;
        }
        if (this.jog) {
            this.status.axes[this.jog.axis].out = 0;
        }
        this.jog = { ws, axis: frame.axis, dir: frame.dir, renewed: Date.now() };
        this.status.jog = { active: true, axis: frame.axis, dir: frame.dir };
        this.status.axes[frame.axis].out = frame.dir;
        this.result(ws, frame.id);
        this.broadcast({ t: "status", ...this.statusBody() });
    }

    endJog() {
        if (!this.jog) {
            return;
        }
        this.status.axes[this.jog.axis].out = 0;
        this.status.jog = { active: false, axis: null, dir: 0 };
        this.jog = undefined;
        this.broadcast({ t: "status", ...this.statusBody() });
    }

    /**
     * The device ends the drive itself (lock, display, state, dead man). Further drive commands
     * of that connection are refused with the reason until it sends a stop.
     *
     * @param {string} reason locked, local or state
     */
    abortJog(reason) {
        if (!this.jog) {
            return;
        }
        this.release = { ws: this.jog.ws, reason };
        this.endJog();
    }

    subscribe(ws, since) {
        ws.subscribed = true;
        if (typeof since !== "number") {
            return;
        }
        const first = this.lines.length ? this.lines[0].seq : this.nextSeq;
        if (since < first) {
            ws.send(JSON.stringify({ t: "lost", from: since, to: first - 1, count: first - since }));
        }
        for (const line of this.lines) {
            if (line.seq >= since) {
                ws.send(JSON.stringify({ t: "log", ...line }));
            }
        }
    }

    broadcast(frame, onlySubscribed = false) {
        const text = JSON.stringify(frame);
        for (const ws of this.wss.clients) {
            if (ws.readyState === 1 && (!onlySubscribed || ws.subscribed)) {
                ws.send(text);
            }
        }
    }

    /**
     * Creates a message like the firmware does and sends it to all subscribers.
     *
     * @param {string} lvl E, W, I, D or V
     * @param {string} tag module
     * @param {string} msg text
     */
    pushLog(lvl, tag, msg) {
        const line = { seq: this.nextSeq++, ms: this.uptimeMs, lvl, tag, msg };
        this.lines.push(line);
        if (this.lines.length > this.ringSize) {
            this.lines.shift();
        }
        this.broadcast({ t: "log", ...line }, true);
        return line;
    }

    /**
     * Changes the status and sends it to all connections.
     *
     * @param {Record<string, unknown>} patch top level fields to replace
     */
    setStatus(patch) {
        Object.assign(this.status, patch);
        this.broadcast({ t: "status", ...this.statusBody() });
    }

    /** Sends any frame to all connections (for frames the adapter has to ignore) */
    sendRaw(frame) {
        this.broadcast(frame);
    }
}

module.exports = { MockDevice, TOKEN, TOKEN_BLOCKS, FEATURES_078, REPORT_TEXT, reportData };
