// @ts-nocheck
"use strict";
/*
 * A Samba Solar Track that exists only in memory: HTTP and WebSocket as described in PROTOCOL.md
 * of the firmware project. Used by the unit tests of the device client and by the integration
 * test. It is not part of the published adapter.
 */
const http = require("node:http");
const { WebSocketServer } = require("ws");

const TOKEN = "0123456789abcdef0123456789abcdef";

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
     * @param {{ device?: string, protocol?: number, ringSize?: number, autoPong?: boolean, jogTimeoutMs?: number, features?: string[] }} [options]
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
        this.token = TOKEN;
        this.status = defaultStatus();
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
            fw: "0.0.1",
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
                fw: "0.0.1",
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

    /** Answers a command like the firmware: {"t":"result","id":…,"ok":…,"reason":…} */
    result(ws, id, reason) {
        const frame = { t: "result", id: typeof id === "number" ? id : null, ok: !reason };
        if (reason) {
            frame.reason = reason;
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

module.exports = { MockDevice, TOKEN };
