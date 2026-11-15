![Logo](admin/samba-solar-track.png)
# ioBroker.samba-solar-track

**Tests:** ![Test and Release](https://github.com/ssbingo/ioBroker.samba-solar-track/workflows/Test%20and%20Release/badge.svg)

## samba-solar-track adapter for ioBroker

Monitors and operates the **Samba Solar Track** controller: a sun tracker for solar modules with storm protection, built on an
ESP32-P4 board with a 10.1" touch display. The adapter shows the state of the controller in ioBroker, receives every
message the device writes to its log and passes on commands.

Hardware and manual of the device (10.1-inch version): <https://github.com/ssbingo/samba-solar-track>. The firmware is available compiled only:
<https://firmware.samba-solar.de/>

"Samba" is the name of the project. The adapter has nothing to do with the Samba file sharing service (SMB).

### How it works

The device is the head. Tracking, storm protection, limit switches and runtime monitoring work completely without
network and without ioBroker. The adapter is an addition: it connects to the device in the home WLAN (HTTP and
WebSocket on port 80) and mirrors what the device reports. If ioBroker or the WLAN fails, nothing changes at the
tracker.

### Project status

This is an early version under development. It is published on npm but not yet in the ioBroker repositories.

| Part | Status |
| --- | --- |
| Connection to the device, automatic reconnect | available |
| State of the controller as states (state machine, axes, sun sensor, wind, supplies, lights) | available |
| Messages of the device with time of day, history, last warning | available |
| Commands (automatic on/off, park flat, acknowledge fault, manual drive with dead man) | available |
| Settings of the device (values with limits, proposals, setup, design) | available |
| Notifications through a messaging adapter (Telegram, Pushover, e-mail and others) | available |
| Features of firmware 0.4 to 0.7.8: position of the sun, setup program and test reports, tilt on command, Hall tap, reset of the synchronous control, firmware over the internet, STEEPER/FLATTER | available (0.1.1) |
| vis-2 widgets (overview, control, messages, values, position of the sun, setup program) | available (0.1.1) |

Connection and reading were tested with a real device (firmware 0.0.3, 2026-10-03); commands, settings, notifications
and everything of version 0.1.1 only against a simulated device that follows the protocol of firmware 0.7.8. The
widgets were loaded in vis-2 2.20.9 against that simulated device.

### Requirements

- Samba Solar Track with firmware 0.0.1 or newer (protocol version 1), WLAN switched on at the display. Older firmware
  keeps working: the adapter creates the states of a feature only when the firmware reports it (`info.features`).
- ioBroker js-controller 6.0.11 or newer, admin 8.0.0 or newer, Node.js 22 or newer

### Installation

The adapter is on npm but not yet in the ioBroker repositories. How to get this development version into an
ioBroker installation is described in [doc/install.md](doc/install.md).

### Configuration

| Setting | Meaning |
| --- | --- |
| Address of the device | IP address or host name. The display shows both under setup > network. |
| Port | The device uses port 80. |
| Token, block 1 to 4 | The token of the device: four fields side by side, one block of 8 characters (0-9, a-f) each. The display shows it under the gear > NETWORK, heading "TOKEN FOR THE ADAPTER": blocks 1 and 2 in the first line, 3 and 4 in the second; enter them from left to right. The entry is hidden like a password; while typing, the eye shows it. The fields are stored encrypted, and a saved block stays hidden: to change it, delete it completely and enter it again. Without a token the adapter only reads. A wrong or incomplete block is marked red, a red line under the fields names the reason, and saving is blocked; if a wrong token reaches the adapter anyway, the log names the block. A token from the former single field (version 0.0.4 or older) is moved into the four fields at the first start of 0.0.6 or newer, then the adapter restarts once; an unusable old value is not moved and is reported as an error until the four fields are filled in. |
| Write messages of the device to the ioBroker log | From which level on messages of the device also appear in the ioBroker log. Default: warnings and errors. All messages are stored in the states under `messages`, whatever is chosen here. |
| Messages in the history | Number of messages kept in `messages.history` (1 to 500, default 50). |
| Send notifications, send through | Switches notifications on and chooses the instance of a messaging adapter, see [Notifications](#notifications). |

### States

| Channel | Content |
| --- | --- |
| `info` | connection, firmware, protocol, device id, address, start time, uptime, memory, signal strength, `info.simulation`, `info.authorized` |
| `status` | state of the controller (`status.state`), automatic, park request, lock at the display, faults, storm protection and its remaining time |
| `axes.elevation`, `axes.azimuth` | output, limit switches, blocked directions, runtime fault, deviation from the sun; for the elevation also the direction of the flat position (`flatDirection`), the tilt in degrees (`angle`, `null` = unknown) and where it comes from (`angleSource`: `hall` counted, `time` estimated); with the reset of the synchronous control the states `syncReset…` (connection, phase, remaining times, last result and reason of an abort) |
| `sun` | the four values of the sun sensor |
| `sunPosition` | position of the sun from site and time (feature `sunpos`, firmware 0.7.0): time and site known, latitude, longitude, azimuth and elevation of the sun, sunrise, sunset, highest position, polar day/night, night by the position of the sun, beginning of night and day (times as ms since 1970); with one axis also the orientation of the rack and the best tilt; `astroTarget` = angle driven to when cloudy (state `ASTRO`) |
| `position` | tilt of the elevation on command (feature `position`, one axis only): commanded angle, phase, tilt, uncertainty, travel times measured, offered angles (`presets`), waiting time; with the Hall tap (feature `hall`) the source of the tilt and the state of the Hall tap |
| `commissioning` | setup program (feature `commissioning`, firmware 0.7.0): completed, open at the display, step, phase, number of the step and of all steps, step optional; the last three test reports as text (`report0` = newest to `report2`, empty = none); with the feature `reportjson` (firmware 0.7.6) the folder `commissioning.report` with the data set of the newest report (date, passed, firmware, duration, travel times, Hall steps, steps with their result and the numbers of passed, skipped and open steps, the complete data set as JSON) |
| `firmware` | version check and update over the internet (feature `fwonline`): state, running and newest version, date, notes, size, time since the last check, error, progress, version taken back, `canInstall` |
| `wind` | wind speed, gust, strongest gust, storm threshold, wind direction |
| `io`, `supply`, `leds` | components, supplies and indicator lights of the add-on board; with the feature `power` also `supply.v24` and `supply.v5` (24 V and 5 V present, `null` = unknown), with the feature `chargecheck` `supply.adcOk` (the component that checks the charge lock answers) and `supply.checks` (pending findings of that check as a JSON list, empty = none) |
| `battery` | built-in battery of the board as at the top right of the display (feature `battery`): battery fitted (setting), valid measurement, charge level in % (`null` without a valid measurement), charging, level `ok`/`low`/`critical`. Display only, no effect on the controller |
| `update` | firmware update in progress (feature `update`): new firmware is being written (all outputs off, commands refused), progress in %; with the feature `updatepark` also the phase (`none`, `loading`, `parking`, `writing`) and why the last update over the network was not written |
| `jog` | manual drive from remote that is running |
| `counters` | error counters of the device |
| `messages` | last message, last warning or error, history as JSON, lost messages |
| `control` | commands, see below |
| `setup`, `params` | setup and settings of the device, see below |

If `info.simulation` is `true`, the device runs its built-in simulation: no value is a real measurement.

`status.state` names the state of the controller, highest priority first: `SETUP`, `FAULT`, `STORM`, `MANUAL`, `PARK`,
`WINDFAULT`, `POSITION` (tilt on command), `SENSOR`, `COMMISSION` (setup program not completed: automatic and night
position rest, storm protection works), `NIGHT`, and the automatic `ASTRO` (cloudy, calculated angle), `IDLE`,
`TRACKING`, `SETTLING`. Since firmware 0.7.0 the night follows the position of the sun once time and site are known
(`sunPosition.known`); without them it follows the brightness (`params.control.nightEnterLevel` and
`nightExitLevel`). The adapter accepts states it does not know yet.

The display shows the directions of the elevation as STEEPER and FLATTER (firmware 0.5.8). Which output is which
depends on the direction of the flat position (`axes.elevation.flatDirection`); the adapter names the states of the
elevation and the values of `control.jogElevation` accordingly. The state ids stay `limitPlus`, `limitMinus` and so on.

The test reports are read after connecting, when `commissioning.done` changes and when the setup program is closed at
the display. The setup program itself is operated only at the display (someone has to watch the rack); there is no
command for it.

The device has no clock. The adapter calculates the time of each message from the uptime of the device.

### Commands

Commands are written to the states under `control`. The device checks every command itself. Storm protection, limit
switches, dead time and runtime monitoring of the device cannot be switched off or shortened from ioBroker.

| State | Effect |
| --- | --- |
| `control.auto` | automatic on or off, like the switch at the display. Shows the state of the device. |
| `control.park` | park request on or off: the module drives flat and stays there until the request is cancelled here or at the display. It survives a restart of the device. |
| `control.acknowledge` | acknowledge a runtime fault, like the button at the display |
| `control.jogElevation` | manual drive: `1` = PLUS (output UP), `-1` = MINUS (output DOWN), `0` = stop; the object names which of them is STEEPER and FLATTER |
| `control.jogAzimuth` | manual drive: `1` = east, `-1` = west, `0` = stop |
| `control.position` | tilt the elevation to one of the offered angles in `position.presets` (feature `position`, one axis only); shows the commanded angle, `null` = none. Like a park request it stays until it is cancelled and survives a restart; a higher state (storm, fault, manual mode, park, wind sensor failed) has priority |
| `control.positionResume` | cancel the tilt on command, the automatic continues |
| `control.syncResetElevation`, `control.syncResetAzimuth` | reset of the synchronous control of the axis (feature `syncreset`; azimuth only with two axes). **The rack then drives into its end position by itself: make sure the swivel range is clear first** (the display asks for this; a widget or script has to ask as well) |
| `control.fwCheck` | check now whether newer firmware exists; the result is in `firmware` |
| `control.fwInstall` | install the newest firmware over the internet: write the version from `firmware.latest`. A wrong version is refused (`range`). The device loads and checks the image, drives the elevation flat and only then writes it; it refuses during storm protection or while a drive is running |
| `control.lastResult` | result of the last command as JSON: `command`, `ok`, `reason`, `text`, `detail` (text of the device, for example why a reset was refused), `from`, `ts` |

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
| `format`, `type` | the command or value is malformed, for example `control.fwInstall` without a version |

### Settings of the device

The device tells the adapter which values can be set, with their limits and defaults. The adapter creates one state
per value under `params`, in the groups of the display: `params.control`, `params.commissioning`, `params.safety` and
`params.diagnostics`. Which values exist depends on the firmware and the setup: with one axis the values of the azimuth
are missing, without a wind sensor with direction the values of the wind direction. Newer firmware adds, each only
with its feature: site latitude and longitude, night after sunset, day before sunrise (`sunpos`); orientation of the
rack, drive to the calculated angle when cloudy and its brightness (`sunpos`, one axis); travel times, frame of the
rack, start loss and two preset angles (`position`, one axis); Hall tap, its counting direction and steps per stroke
(`hall`, one axis); reset contacts of the synchronous control (`syncreset`).

Writing a state sends the value to the device. The device checks it against its limits and answers:

| Result | Meaning |
| --- | --- |
| `applied` | the value is valid, the state shows it |
| `pending` | the value is a proposal. **Safety values, the direction of the flat position and the data of the wind sensor become valid only after someone confirms them at the display**, which shows the old and the new value. Until then the state keeps the old value and the proposal is listed in `params.pending`. |
| `rejected` | the device refused the value, for example `range` (outside the limits), `busy` (only possible while no drive is running), `locked` or `auth`. The state keeps the old value. |

The result of the last change is in `params.lastResult`. Changes made at the display arrive in the states by themselves.

| State | Meaning |
| --- | --- |
| `params.<group>.<key>` | one value; unit, limits (`min`, `max`) and default (`def`) are in the object |
| `params.pending` | proposals that wait for confirmation at the display, as JSON: `{"stormKmh": 45}` |
| `params.lastResult` | result of the last change as JSON: `key`, `value`, `result`, `reason`, `text`, `from`, `ts` |
| `setup.mode`, `setup.windSensor` | operating mode (1 = vertical only, 2 = vertical + horizontal) and wind sensor type (1 = speed only, 2 = speed + direction). Writing only chooses the value. |
| `setup.save` | saves the chosen setup. Like at the display the drives stop and **the device restarts**. |
| `control.design` | design of the display and of the web page of the device |
| `control.endSimulation` | ends the simulation of the device; the device restarts. Switching the simulation on is only possible at the display. |

WLAN, host name and token of the device cannot be changed from ioBroker; a mistake there would lock the adapter out.

### Notifications

The adapter can report important events through a messaging adapter (Telegram, Pushover, e-mail, WhatsApp, Signal,
Discord, Matrix, Gotify, ntfy). Switch "Send notifications" on in the adapter settings, choose the instance and tick
the events:

| Event | Notification |
| --- | --- |
| Storm protection | when it begins, with gust and threshold, and when it ends |
| Faults | a drive ran longer than its maximum runtime (with the axis), the component of the switching outputs does not answer, and when the fault is cleared |
| Wind sensor | when it stops answering and when it answers again |
| Sun sensor | when it reports a fault and when it works again |
| Setup program | when the controller changes to the state `COMMISSION` (setup program not completed); once per occurrence, again only after it was completed in between |
| Connection | when the device was not reachable for the chosen number of minutes (default 5), and when it is reachable again. A short interruption of the WLAN causes no notification. |
| Restart | when the device has restarted, with the reason (off by default) |

The texts are written in the language of the ioBroker system. Nothing is sent for the state the device is in when
the adapter starts; only changes are reported.

### vis-2 widgets

The adapter brings the widget set "Samba Solar Track" for vis-2 (React with MUI, module federation, built like the
widgets of ioBroker.pondpump). The widgets follow the design of vis-2 and the official MUI widget sets
(vis-2-widgets-material): a card of vis-2 with a title, MUI buttons, switches, chips and progress bars, colours only
from the theme of vis-2 (light and dark theme), the font of vis-2. They may therefore look different from the display;
content and functions are those of the display. The status band keeps one text per state as at the display and shows
its meaning in the colours of the theme: info (moving, manual), success (aligned), warning (tracking), error (storm,
fault), secondary (setup, sun sensor), dark grey (night, parked), grey (ready, not connected).

Every widget only needs the adapter instance (attribute "Adapter instance"); it reads the states below
`samba-solar-track.<instance>.` itself. The content scales with the size of the widget (the font size follows the size
against the default size; the list of messages follows the width and scrolls), nothing is cut off. All texts exist in
the 11 languages of ioBroker; the status band uses the texts of the display. States that an older firmware does not
provide show "–" or a hint, they never leave a widget empty.

Attributes of every widget (group "General"): adapter instance, "Without card background" (`noCard`) and "Title"
(`widgetTitle`, empty = name of the widget; hidden without card), as in vis-2-widgets-material.

| Widget | Default size | Content | Further attributes |
| --- | --- | --- | --- |
| Overview | 440 × 300 | like the start page of the display: wind gauge with storm threshold, gust and peak, cross-hair of the sun sensor with the deviation, tilt with sketch and target, status band with text and colour per state, automatic switch, button PARK FLAT / CANCEL PARKING | – |
| Control | 320 × 330 | automatic switch; STEEPER/FLATTER, with two axes also EAST/WEST (manual drive with dead man); with one axis the angle buttons of `position.presets` (0°, 30°, 60° and the preferred angles) and RESUME AUTOMATIC; park flat, acknowledge; optionally the reset of the synchronous control with a question first (dialog) | show angle buttons, offer the reset of the synchronous control |
| Messages | 420 × 300 | latest messages of the device with time and level, filter all / warnings / errors (chips), list scrolls | filter at the start, show debug messages |
| Values | 380 × 270 | wind, gust, direction, tilt, height and azimuth of the sun, battery, 24 V / 5 V, firmware, connection | – |
| Position of the sun | 420 × 280 | arc of the sun today from `sunPosition.*` (firmware 0.7.0): sunrise, noon with its height, sunset, night windows, the sun now, orientation of the rack and best tilt (one axis), state | – |
| Setup program | 320 × 290 | state of the setup program and key values of the newest test report (result, travel times, Hall tap or azimuth), progress of the steps; display only | – |

All buttons, switches and chips can be used with the keyboard (Tab, Space, Enter); a drive button runs while Space or
Enter is held. A disabled button names the reason of the lock as its tooltip.

Safety rules of the widgets:

- Manual drive only while the button is held (dead man): the widget writes `control.jogElevation` or
  `control.jogAzimuth` again every 400 ms and writes 0 when the button is released, the pointer is lost or the page is
  hidden. If the browser disappears, the adapter stops the drive after one second without renewal.
- The direction of STEEPER/FLATTER comes from `axes.elevation.flatDirection`, without it from the names of
  `control.jogElevation`.
- Manual drive needs the automatic off (as at the display). Drive commands are locked during storm protection, without
  completed setup and without completed setup program; every button is locked when "remote control locked" is on at the
  display, while a firmware update is written and without connection. The device checks every command itself.
- In the vis-2 editor no command is sent.
- The widgets show the times in the time zone of the browser. The texts of the messages are the log lines of the
  firmware as the device sends them.

### Logging and debugging

The log level of the instance is set in the admin under Instances (expert mode) or with
`iobroker set samba-solar-track.0 --loglevel debug`.

| Level | Content |
| --- | --- |
| `error` | A wrong configuration: no address configured (the adapter cannot work), or a token in the settings that cannot be used (the message names the wrong block, or an unusable token saved by version 0.0.4 or older; the adapter only reads) |
| `warn` | Something the user has to act on: device not reachable, token not accepted, messages lost, newer protocol, a command that was not executed, a manual drive that was stopped, a setting that was not accepted, an old token field that could not be moved or emptied. Each problem is reported once; repetitions follow at `debug` until it is resolved. Warnings and errors of the device are forwarded at this level. |
| `info` | Milestones: configuration (where the token comes from and whether it is complete, never the token itself; a token moved from the old field, after which the adapter restarts once), connected, reachable again, device restarted |
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
| `[par]` | settings and setup of the device: old and new value, proposals, refusals |
| `[rep]` | test reports of the setup program: why they are read, which exist, the data set |
| `[ntf]` | notifications: every event, whether it was sent and to which instance |
| `[unload]` | shutdown |

The token never appears in the log.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### 0.1.1 (2026-11-15)
- (ssbingo) firmware up to 0.7.8: states `POSITION`, `COMMISSION` and `ASTRO`; channel `sunPosition` (position of the sun, sunrise, sunset, night); channel `commissioning` with the setup program and its test reports (text and data set); tilt on command with Hall tap (`position`, `control.position`, `control.positionResume`); reset of the synchronous control (`axes.*.syncReset…`, `control.syncReset…`); firmware over the internet (`firmware`, `control.fwCheck`, `control.fwInstall`); tilt of the elevation in degrees; names STEEPER/FLATTER of the elevation directions; names of the new settings; notification when the setup program is not completed; every object name in 11 languages. States of a feature are created only when the firmware reports it; vis-2 widgets overview, control, messages, values, position of the sun and setup program (React with MUI in the design of vis-2, light and dark theme of vis-2, content scales with the widget, 11 languages); new states `battery.*`, `supply.v24`, `supply.v5`, `supply.adcOk`, `supply.checks` and `update.*`; the settings page no longer repeats the English text in other languages (port, token parts, headings)

### 0.0.7 (2026-10-03)
- (ssbingo) token entry: a red line under the four fields names the reason when a block is incomplete or wrong; a saved block can be changed again (delete it completely and enter it again); on phones each field takes the full width; after moving the old token the first start ends cleanly before js-controller restarts the adapter (no second connection in compact mode); clearer log texts about the old token field

### 0.0.6 (2026-10-03)
- (ssbingo) token entry: four fields side by side (Block 1 to 4) without help lines; the old single token field is no longer shown: a token entered there with 0.0.4 or older is moved into the four fields at the first start (encrypted), and the old field is emptied

### 0.0.5 (2026-10-03)
- (ssbingo) token entry in four fields, one per block of 8 characters as shown at the display; a token entered earlier with spaces works too; a wrong block is named in the log; the texts name the right place of the token (gear > NETWORK); the four fields are hidden like a password, the eye shows the entry

### 0.0.4 (2026-10-02)
- (ssbingo) notifications through a messaging adapter: storm, faults, wind sensor, sun sensor, connection, restart

### 0.0.3 (2026-10-02)
- (ssbingo) settings of the device as states: values with limits, proposals that wait for confirmation at the display, setup, design

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
