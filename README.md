![Logo](admin/samba-solar-track.png)
# ioBroker.samba-solar-track

**Tests:** ![Test and Release](https://github.com/ssbingo/ioBroker.samba-solar-track/workflows/Test%20and%20Release/badge.svg)

## samba-solar-track adapter for ioBroker

Monitors the **Samba Solar Track** controller: a sun tracker for solar modules with storm protection, built on an
ESP32-S3 board with a 7" touch display. The adapter shows the state of the controller in ioBroker and receives every
message the device writes to its log.

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
| Commands (automatic on/off, park flat, acknowledge fault, manual drive) | planned |
| Settings of the device | planned |
| Notifications (Telegram, Pushover, e-mail) | planned |
| vis-2 widgets (overview, operation, messages, values) | planned |

Tested against a simulated device only. **Not yet tested with real hardware.**

### Requirements

- Samba Solar Track with firmware 0.0.1 or newer (protocol version 1), WLAN switched on at the display
- ioBroker js-controller 6.0.11 or newer, admin 8.0.0 or newer, Node.js 22 or newer

### Installation

The adapter is not on npm and not in the ioBroker repositories. It is installed from GitHub:

- in the admin (expert mode): Adapters > Install from custom source > GitHub, URL
  `https://github.com/ssbingo/ioBroker.samba-solar-track`
- or on the command line of the ioBroker host: `iobroker url ssbingo/ioBroker.samba-solar-track`

Then create the instance: `iobroker add samba-solar-track` (or in the admin under Adapters).

Without access to GitHub the adapter can be installed from a package file: `npm run build` and `npm pack` in the
adapter directory create `iobroker.samba-solar-track-<version>.tgz`; on the ioBroker host
`iobroker url /path/to/iobroker.samba-solar-track-<version>.tgz` installs it.

### Configuration

| Setting | Meaning |
| --- | --- |
| Address of the device | IP address or host name. The display shows both under setup > network. |
| Port | The device uses port 80. |
| Token | Shown at the display under setup > network > remote access. Reading works without a token; the token will be needed for commands. It is stored encrypted. |
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

If `info.simulation` is `true`, the device runs its built-in simulation: no value is a real measurement.

The device has no clock. The adapter calculates the time of each message from the uptime of the device.

### Logging and debugging

The log level of the instance is set in the admin under Instances (expert mode) or with
`iobroker set samba-solar-track.0 --loglevel debug`.

| Level | Content |
| --- | --- |
| `error` | The adapter cannot work, for example no address configured |
| `warn` | Something the user has to act on: device not reachable, token not accepted, messages lost, newer protocol. Each problem is reported once; repetitions follow at `debug` until it is resolved. Warnings and errors of the device are forwarded at this level. |
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
| `[unload]` | shutdown |

The token never appears in the log.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
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
