![Logo](admin/samba-solar-track.png)
# ioBroker.samba-solar-track

**Tests:** ![Test and Release](https://github.com/ssbingo/ioBroker.samba-solar-track/workflows/Test%20and%20Release/badge.svg)

## samba-solar-track adapter for ioBroker

Monitors and operates the **Samba Solar Track** controller: a sun tracker for solar modules with storm protection, built on an
ESP32-S3 board with a 7" touch display. The adapter shows the state of the controller in ioBroker, receives every
message the device writes to its log and passes on commands.

Hardware, firmware and manual of the device: <https://github.com/ssbingo/samba-solar-track> (this repository is
not public yet)

"Samba" is the name of the project. The adapter has nothing to do with the Samba file sharing service (SMB).

### How it works

The device is the head. Tracking, storm protection, limit switches and runtime monitoring work completely without
network and without ioBroker. The adapter is an addition: it connects to the device in the home WLAN (HTTP and
WebSocket on port 80) and mirrors what the device reports. If ioBroker or the WLAN fails, nothing changes at the
tracker.

### Project status

This is an early version under development. It is not published on npm.

| Part | Status |
| --- | --- |
| Connection to the device, automatic reconnect | available |
| State of the controller as states (state machine, axes, sun sensor, wind, supplies, lights) | available |
| Messages of the device with time of day, history, last warning | available |
| Commands (automatic on/off, park flat, acknowledge fault, manual drive with dead man) | available |
| Settings of the device | planned |
| Notifications (Telegram, Pushover, e-mail) | planned |
| vis-2 widgets (overview, operation, messages, values) | planned |

Tested against a simulated device only. **Not yet tested with real hardware.**

### Requirements

- Samba Solar Track with firmware 0.0.1 or newer (protocol version 1), WLAN switched on at the display
- ioBroker js-controller 6.0.11 or newer, admin 8.0.0 or newer, Node.js 22 or newer

### Installation

The adapter is not on npm and not in the ioBroker repositories yet. How to get this development version into an
ioBroker installation is described in [doc/install.md](doc/install.md).

### Configuration

| Setting | Meaning |
| --- | --- |
| Address of the device | IP address or host name. The display shows both under setup > network. |
| Port | The device uses port 80. |
| Token | Shown at the display under setup > network > remote access. Reading works without a token; commands need it. It is stored encrypted. |
| Write messages of the device to the ioBroker log | From which level on messages of the device also appear in the ioBroker log. Default: warnings and errors. All messages are stored in the states under `messages`, whatever is chosen here. |
| Messages in the history | Number of messages kept in `messages.history` (1 to 500, default 50). |

### States

| Channel | Content |
| --- | --- |
| `info` | connection, firmware, protocol, device id, address, start time, uptime, memory, signal strength, `info.simulation`, `info.authorized` |
| `status` | state of the controller (`status.state`), automatic, park request, lock at the display, faults, storm protection and its remaining time |
| `axes.elevation`, `axes.azimuth` | output, limit switches, blocked directions, runtime fault, deviation from the sun |
| `sun` | the four values of the sun sensor |
| `wind` | wind speed, gust, strongest gust, storm threshold, wind direction |
| `io`, `supply`, `leds` | components, supplies and indicator lights of the add-on board |
| `jog` | manual drive from remote that is running |
| `counters` | error counters of the device |
| `messages` | last message, last warning or error, history as JSON, lost messages |
| `control` | commands, see below |

If `info.simulation` is `true`, the device runs its built-in simulation: no value is a real measurement.

The device has no clock. The adapter calculates the time of each message from the uptime of the device.

### Commands

Commands are written to the states under `control`. The device checks every command itself. Storm protection, limit
switches, dead time and runtime monitoring of the device cannot be switched off or shortened from ioBroker.

| State | Effect |
| --- | --- |
| `control.auto` | automatic on or off, like the switch at the display. Shows the state of the device. |
| `control.park` | park request on or off: the module drives flat and stays there until the request is cancelled here or at the display. It survives a restart of the device. |
| `control.acknowledge` | acknowledge a runtime fault, like the button at the display |
| `control.jogElevation` | manual drive: `1` = up, `-1` = down, `0` = stop |
| `control.jogAzimuth` | manual drive: `1` = east, `-1` = west, `0` = stop |
| `control.lastResult` | result of the last command as JSON: `command`, `ok`, `reason`, `text`, `from`, `ts` |

**Manual drive works with a dead man.** A drive runs only while its state is written again and again: whoever drives
(a widget, a script) has to write `1` or `-1` at least once per second, best every 300 to 500 ms. If the writes stop,
the adapter stops the drive after one second and sets the state to `0`. If the adapter or the WLAN fails, the device
stops by itself. Manual drive needs automatic switched off (`control.auto` = `false`).

**You do not see the module from remote.** Drive by hand only when nobody stands at the tracker. Whoever works at the
tracker locks the remote control at the display first.

A command the device refuses is taken back: the state returns to what the device reports, the reason is in
`control.lastResult` and in the log.

| `reason` | Meaning |
| --- | --- |
| `auth` | the token is missing or wrong |
| `locked` | remote control is locked at the display |
| `setup` | the setup of the device is not completed |
| `state` | the state of the controller does not allow it, for example manual drive while automatic is on |
| `local` | someone is operating the display; the display has priority |
| `busy` | another connection is driving, or the device was busy: try again |
| `unknown` | unknown command or axis, for example azimuth with a one-axis tracker |
| `range` | the value is not allowed |
| `timeout`, `disconnected` | the device did not answer or is not connected |
| `protocol`, `unsupported` | the firmware is newer than this adapter knows, or too old for this command |
| `hold` | a manual drive was stopped because its state was not written again in time (dead man) |
| `device` | the device ended a manual drive, for example because of storm or an operation at the display |

### Logging and debugging

The log level of the instance is set in the admin under Instances (expert mode) or with
`iobroker set samba-solar-track.0 --loglevel debug`.

| Level | Content |
| --- | --- |
| `error` | The adapter cannot work, for example no address configured |
| `warn` | Something the user has to act on: device not reachable, token not accepted, messages lost, newer protocol, a command that was not executed, a manual drive that was stopped. Each problem is reported once; repetitions follow at `debug` until it is resolved. Warnings and errors of the device are forwarded at this level. |
| `info` | Milestones: configuration (without the token), connected, reachable again, device restarted |
| `debug` | Every step: attempts with their number, durations, decisions, skipped input with the reason |
| `silly` | Every frame received and sent |

Every line starts with a tag that names the part of the adapter:

| Tag | Part |
| --- | --- |
| `[cfg]` | configuration |
| `[obj]` | creating objects, writing states |
| `[conn]` | connection to the device, attempts, reconnect |
| `[rx]`, `[tx]` | frames received from and sent to the device |
| `[dev]` | messages and events of the device |
| `[msg]` | handling of the messages (sequence numbers, history) |
| `[cmd]` | commands with their number, result and duration |
| `[jog]` | manual drive: start, renewals, stop and the reason |
| `[unload]` | shutdown |

The token never appears in the log.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### 0.0.2 (2026-10-02)
- (ssbingo) commands: automatic on/off, park flat, acknowledge fault and manual drive with dead man

### 0.0.1 (2026-10-02)
- (ssbingo) initial version: connection to the device, state of the controller and messages as states

Older changelogs can be found in [CHANGELOG_OLD.md](CHANGELOG_OLD.md).

## Documentation

- 🇩🇪 [Deutsche Dokumentation](doc/de/README.md)
- 🇷🇺 [Документация на русском](doc/ru/README.md)
- 🇵🇹 [Documentação portuguesa](doc/pt/README.md)
- 🇳🇱 [Nederlandse documentatie](doc/nl/README.md)
- 🇫🇷 [Documentation française](doc/fr/README.md)
- 🇮🇹 [Documentazione italiana](doc/it/README.md)
- 🇪🇸 [Documentación en español](doc/es/README.md)
- 🇵🇱 [Dokumentacja polska](doc/pl/README.md)
- 🇺🇦 [Документація українською](doc/uk/README.md)
- 🇨🇳 [简体中文文档](doc/zh-cn/README.md)

## License

Copyright (c) 2026 ssbingo <s.sternitzke@online.de>

This adapter, including its logo, is licensed under the
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-nc-sa/4.0/)
(CC BY-NC-SA 4.0), like the hardware and the firmware of the device. Commercial use is not permitted. Private use and
private replicas are allowed; adaptations must be shared under the same license. The full text is in [LICENSE](LICENSE).
