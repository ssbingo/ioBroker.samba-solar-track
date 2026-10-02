/*
 * Connection to the device: GET /api/info, then the WebSocket /ws with status and messages.
 * Reconnects by itself. Knows nothing about ioBroker: logging, timers and the handling of the
 * received data come in from outside, so the client can be tested without an adapter.
 *
 * Log tags: [conn] connection handling, [rx] received frames, [tx] sent frames.
 */
import WebSocket from "ws";
import {
    PROTOCOL_VERSION,
    isObject,
    parseHello,
    parseInfo,
    parseLogLine,
    type DeviceInfo,
    type DeviceStatus,
    type HelloFrame,
    type LogLine,
    type LostFrame,
} from "./protocol";

/** The part of the ioBroker logger the client uses */
export interface ClientLogger {
    /** A problem the user has to act on */
    warn(message: string): void;
    /** Milestones of the connection */
    info(message: string): void;
    /** Every step */
    debug(message: string): void;
    /** Raw frames */
    silly(message: string): void;
}

/**
 * Timers of the adapter (they are cancelled automatically when the adapter stops).
 * The adapter passes its own this.setTimeout and this.clearTimeout.
 */
export interface ClientTimers {
    /** Starts a timer; may return undefined when the adapter is stopping */
    set(callback: () => void, ms: number): unknown;
    /** Cancels a timer */
    clear(handle: unknown): void;
}

/** Times of the client in ms */
export interface ClientTiming {
    /** Timeout of an HTTP request */
    httpTimeoutMs: number;
    /** Timeout of the WebSocket handshake */
    handshakeTimeoutMs: number;
    /** Interval of the WebSocket ping */
    pingMs: number;
    /** Without any frame for this time the connection counts as dead */
    watchdogMs: number;
    /** Pauses before the next attempt; the last one repeats */
    reconnectMs: number[];
}

/** Default times. The device sends a status at least every 5 s. */
export const DEFAULT_TIMING: ClientTiming = {
    httpTimeoutMs: 5000,
    handshakeTimeoutMs: 5000,
    pingMs: 10000,
    watchdogMs: 15000,
    reconnectMs: [2000, 5000, 10000, 30000, 60000],
};

/** What the client reports */
export interface ClientEvents {
    /** GET /api/info was answered by a Samba Solar Track */
    onInfo(info: DeviceInfo): void;
    /**
     * The WebSocket is connected and the device said hello.
     *
     * @returns the sequence number from which messages are subscribed
     */
    onHello(hello: HelloFrame): number;
    /** A status frame arrived */
    onStatus(status: DeviceStatus): void;
    /** A message arrived */
    onLog(line: LogLine): void;
    /** The device reports lost messages */
    onLost(lost: LostFrame): void;
    /** The connection was established (after hello) or lost */
    onConnection(connected: boolean): void;
    /**
     * The device answered a command.
     *
     * @param id id of the command, null when the device could not read it
     * @param ok true = accepted
     * @param reason why not
     */
    onResult(id: number | null, ok: boolean, reason: string | undefined): void;
    /**
     * Settings or proposals have changed at the device.
     *
     * @param changed entries like in GET /api/params, unchecked
     */
    onParams(changed: unknown): void;
}

/** Settings of the client */
export interface ClientOptions {
    /** Address of the device (IP or host name) */
    host: string;
    /** Port of the device */
    port: number;
    /** Token shown at the display; empty = read only */
    token: string;
    /** Logger */
    log: ClientLogger;
    /** Timers */
    timers: ClientTimers;
    /** Handlers */
    events: ClientEvents;
    /** Other times than the default (tests) */
    timing?: Partial<ClientTiming>;
}

/**
 * Text of an unknown error.
 *
 * @param error the caught value
 */
function errorText(error: unknown): string {
    if (error instanceof Error) {
        // fetch wraps the real reason (ECONNREFUSED, EHOSTUNREACH, ...) in `cause`
        const cause = (error as Error & { cause?: unknown }).cause;
        const code = isObject(cause) && typeof cause.code === "string" ? ` (${cause.code})` : "";
        return `${error.message}${code}`;
    }
    return String(error);
}

/**
 * Text of a received WebSocket frame.
 *
 * @param data payload as the ws library delivers it
 */
function frameText(data: WebSocket.RawData): string {
    if (Buffer.isBuffer(data)) {
        return data.toString("utf8");
    }
    return Array.isArray(data) ? Buffer.concat(data).toString("utf8") : Buffer.from(data).toString("utf8");
}

/** Client for one device */
export class DeviceClient {
    private readonly timing: ClientTiming;
    private readonly baseUrl: string;
    private ws: WebSocket | undefined;
    private session = 0;
    private attempt = 0;
    private failures = 0;
    private stopped = true;
    private connected = false;
    private problemReported = false;
    private tokenProblemReported = false;
    private versionProblemReported = false;
    private lastRx = 0;
    private reconnectTimer: unknown;
    private pingTimer: unknown;
    private isReadOnly = false;

    /**
     * @param options settings of the client
     */
    public constructor(private readonly options: ClientOptions) {
        this.timing = { ...DEFAULT_TIMING, ...options.timing };
        const host = options.host.includes(":") && !options.host.startsWith("[") ? `[${options.host}]` : options.host;
        this.baseUrl = `${host}:${options.port}`;
    }

    /**
     * true when the device speaks a newer protocol than this adapter knows: reading continues,
     * commands and changes must not be sent (PROTOCOL.md, section 10).
     */
    public get readOnly(): boolean {
        return this.isReadOnly;
    }

    /** Starts connecting; the client keeps the connection up until `stop` */
    public start(): void {
        if (!this.stopped) {
            this.options.log.debug("[conn] start ignored: client is already running");
            return;
        }
        this.stopped = false;
        void this.connect();
    }

    /** Closes the connection and stops all timers */
    public stop(): void {
        this.options.log.debug(`[conn] stop (connected=${this.connected}, attempts=${this.attempt})`);
        this.stopped = true;
        this.session++;
        this.clearTimers();
        if (this.ws) {
            this.ws.removeAllListeners();
            // an error after terminate must not crash the adapter
            this.ws.on("error", () => undefined);
            this.ws.terminate();
            this.ws = undefined;
        }
        this.connected = false;
    }

    private clearTimers(): void {
        if (this.reconnectTimer !== undefined) {
            this.options.timers.clear(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        if (this.pingTimer !== undefined) {
            this.options.timers.clear(this.pingTimer);
            this.pingTimer = undefined;
        }
    }

    /**
     * Reads a JSON document from the device.
     *
     * @param path path with leading slash, e.g. "/api/info"
     */
    public async getJson(path: string): Promise<unknown> {
        const started = Date.now();
        const response = await fetch(`http://${this.baseUrl}${path}`, {
            signal: AbortSignal.timeout(this.timing.httpTimeoutMs),
            headers: { Accept: "application/json" },
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} for GET ${path}`);
        }
        const json: unknown = await response.json();
        this.options.log.debug(`[conn] GET ${path} answered after ${Date.now() - started} ms`);
        return json;
    }

    /**
     * Sends a JSON document to the device with the token (commands and changes need it).
     * An answer with an HTTP error is not an exception: the device explains the refusal in the body.
     *
     * @param path path with leading slash, e.g. "/api/params"
     * @param body the document to send
     * @returns HTTP status and the parsed answer (undefined when the answer is no JSON)
     */
    public async postJson(path: string, body: unknown): Promise<{ status: number; json: unknown }> {
        const started = Date.now();
        const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
        if (this.options.token) {
            headers.Authorization = `Bearer ${this.options.token}`;
        }
        const text = JSON.stringify(body);
        this.options.log.silly(`[tx] POST ${path} ${text}`);
        const response = await fetch(`http://${this.baseUrl}${path}`, {
            method: "POST",
            signal: AbortSignal.timeout(this.timing.httpTimeoutMs),
            headers,
            body: text,
        });
        let json: unknown;
        try {
            json = await response.json();
        } catch {
            json = undefined;
        }
        this.options.log.debug(`[conn] POST ${path} answered HTTP ${response.status} after ${Date.now() - started} ms`);
        return { status: response.status, json };
    }

    private async connect(): Promise<void> {
        const session = ++this.session;
        const attempt = ++this.attempt;
        const { log } = this.options;
        log.debug(`[conn] Attempt #${attempt}: GET http://${this.baseUrl}/api/info`);

        let info: DeviceInfo;
        try {
            const parsed = parseInfo(await this.getJson("/api/info"));
            if (typeof parsed === "string") {
                throw new Error(`not a Samba Solar Track: ${parsed}`);
            }
            info = parsed;
        } catch (error) {
            if (session === this.session) {
                this.failed(`GET /api/info failed: ${errorText(error)}`);
            }
            return;
        }
        if (session !== this.session || this.stopped) {
            log.debug(`[conn] Attempt #${attempt}: result ignored, client was stopped meanwhile`);
            return;
        }

        this.isReadOnly = info.protocol > PROTOCOL_VERSION;
        if (this.isReadOnly && !this.versionProblemReported) {
            this.versionProblemReported = true;
            log.warn(
                `[conn] The device speaks protocol version ${info.protocol}, this adapter knows version ${PROTOCOL_VERSION}. ` +
                    `Reading continues, commands and changes are disabled. Please update the adapter.`,
            );
        }
        log.debug(
            `[conn] Attempt #${attempt}: device ${info.id}, firmware ${info.fw}, protocol ${info.protocol}, ` +
                `features ${info.features.join(",") || "-"}`,
        );
        this.options.events.onInfo(info);
        this.openSocket(session, attempt, info);
    }

    private openSocket(session: number, attempt: number, info: DeviceInfo): void {
        const { log, token } = this.options;
        const query = token ? `?token=${encodeURIComponent(token)}` : "";
        log.debug(
            `[conn] Attempt #${attempt}: opening ws://${this.baseUrl}/ws${token ? "?token=***" : ""} ` +
                `(token ${token ? `set, ${token.length} characters` : "not set, read only"})`,
        );
        const started = Date.now();
        const ws = new WebSocket(`ws://${this.baseUrl}/ws${query}`, {
            handshakeTimeout: this.timing.handshakeTimeoutMs,
        });
        this.ws = ws;

        ws.on("open", () => {
            if (session !== this.session) {
                return;
            }
            this.lastRx = Date.now();
            log.debug(`[conn] Attempt #${attempt}: WebSocket open after ${Date.now() - started} ms, waiting for hello`);
            this.schedulePing(session);
        });
        ws.on("pong", () => {
            if (session === this.session) {
                this.lastRx = Date.now();
                log.silly("[rx] pong");
            }
        });
        ws.on("message", data => {
            if (session !== this.session) {
                return;
            }
            this.lastRx = Date.now();
            this.handleFrame(frameText(data), info, attempt);
        });
        ws.on("error", error => {
            if (session === this.session) {
                log.debug(`[conn] WebSocket error: ${errorText(error)}`);
            }
        });
        ws.on("close", (code, reason) => {
            if (session !== this.session) {
                return;
            }
            const text = reason.length ? ` "${String(reason)}"` : "";
            const hint = code === 1013 ? " (the device already has its maximum number of connections)" : "";
            this.failed(`WebSocket closed with code ${code}${text}${hint}`);
        });
    }

    private handleFrame(text: string, info: DeviceInfo, attempt: number): void {
        const { log, events } = this.options;
        let frame: unknown;
        try {
            frame = JSON.parse(text);
        } catch {
            log.debug(`[rx] Frame ignored: no valid JSON (${text.length} characters)`);
            return;
        }
        if (!isObject(frame) || typeof frame.t !== "string") {
            log.debug("[rx] Frame ignored: field t is missing");
            return;
        }
        log.silly(`[rx] ${text}`);
        switch (frame.t) {
            case "hello":
                this.handleHello(frame, info, attempt);
                break;
            case "status":
                events.onStatus(frame);
                break;
            case "log": {
                const line = parseLogLine(frame);
                if (line) {
                    events.onLog(line);
                } else {
                    log.debug("[rx] log frame ignored: seq or ms is missing");
                }
                break;
            }
            case "lost":
                if (typeof frame.count === "number" && typeof frame.to === "number") {
                    events.onLost({
                        t: "lost",
                        from: typeof frame.from === "number" ? frame.from : 0,
                        to: frame.to,
                        count: frame.count,
                    });
                } else {
                    log.debug("[rx] lost frame ignored: count or to is missing");
                }
                break;
            case "result":
                events.onResult(
                    typeof frame.id === "number" ? frame.id : null,
                    frame.ok === true,
                    typeof frame.reason === "string" ? frame.reason : undefined,
                );
                break;
            case "params":
                events.onParams(frame.changed);
                break;
            default:
                log.debug(`[rx] Unknown frame "${frame.t}" ignored`);
        }
    }

    private handleHello(frame: Record<string, unknown>, info: DeviceInfo, attempt: number): void {
        const { log, events, token } = this.options;
        const hello = parseHello(frame);
        if (typeof hello === "string") {
            log.debug(`[rx] hello rejected: ${hello}`);
            this.ws?.terminate();
            return;
        }
        if (this.problemReported) {
            log.info(`[conn] Device reachable again at ${this.baseUrl} after ${this.failures} failed attempt(s)`);
        } else if (!this.connected) {
            log.info(
                `[conn] Connected to Samba Solar Track "${info.hostname ?? info.id}" at ${this.baseUrl} ` +
                    `(firmware ${info.fw}, protocol ${info.protocol}${info.simulation ? ", SIMULATION" : ""})`,
            );
        }
        this.problemReported = false;
        this.failures = 0;
        this.connected = true;

        if (token && !hello.auth) {
            if (!this.tokenProblemReported) {
                this.tokenProblemReported = true;
                log.warn(
                    "[conn] The device did not accept the token. Reading works, commands will be rejected. " +
                        "Enter the token shown at the display (setup > network > remote access) in the adapter settings.",
                );
            }
        } else {
            this.tokenProblemReported = false;
        }

        const since = events.onHello(hello);
        log.debug(
            `[conn] Attempt #${attempt}: hello (bootId ${hello.bootId}, uptime ${hello.uptimeMs} ms, auth ${hello.auth}, ` +
                `log ${hello.logFirst}..${hello.logNext - 1}) -> subscribing messages since ${since}`,
        );
        this.send({ t: "sub", since });
        events.onConnection(true);
    }

    /**
     * Sends a frame to the device.
     *
     * @param frame the frame
     * @returns false when there is no connection
     */
    public send(frame: Record<string, unknown>): boolean {
        const { log } = this.options;
        if (!this.ws || !this.connected || this.ws.readyState !== WebSocket.OPEN) {
            log.debug(`[tx] Frame "${String(frame.t)}" skipped: not connected`);
            return false;
        }
        const text = JSON.stringify(frame);
        log.silly(`[tx] ${text}`);
        this.ws.send(text, error => {
            if (error) {
                log.debug(`[tx] Sending "${String(frame.t)}" failed: ${errorText(error)}`);
            }
        });
        return true;
    }

    private schedulePing(session: number): void {
        this.pingTimer = this.options.timers.set(() => {
            this.pingTimer = undefined;
            if (session !== this.session || !this.ws) {
                return;
            }
            const silent = Date.now() - this.lastRx;
            if (silent > this.timing.watchdogMs) {
                this.options.log.debug(
                    `[conn] No frame for ${silent} ms (limit ${this.timing.watchdogMs} ms): closing`,
                );
                // terminate triggers the close event, which schedules the next attempt
                this.ws.terminate();
                return;
            }
            if (this.ws.readyState === WebSocket.OPEN) {
                this.options.log.silly("[tx] ping");
                this.ws.ping();
            }
            this.schedulePing(session);
        }, this.timing.pingMs);
    }

    private failed(reason: string): void {
        const { log, events, timers } = this.options;
        // invalidate handlers of the failed connection
        this.session++;
        this.clearTimers();
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.on("error", () => undefined);
            this.ws.terminate();
            this.ws = undefined;
        }
        const wasConnected = this.connected;
        this.connected = false;
        this.failures++;
        if (wasConnected) {
            events.onConnection(false);
        }
        if (this.stopped) {
            log.debug(`[conn] ${reason}; no further attempt, client is stopped`);
            return;
        }
        const delays = this.timing.reconnectMs;
        const delay = delays[Math.min(this.failures - 1, delays.length - 1)];
        if (!this.problemReported) {
            this.problemReported = true;
            log.warn(
                `[conn] ${wasConnected ? "Connection to the device lost" : "Device not reachable"} at ${this.baseUrl}: ${reason}. ` +
                    `The adapter keeps trying in the background.`,
            );
        }
        log.debug(`[conn] ${reason}; failure #${this.failures}, next attempt in ${delay} ms`);
        this.reconnectTimer = timers.set(() => {
            this.reconnectTimer = undefined;
            if (!this.stopped) {
                void this.connect();
            }
        }, delay);
    }
}
