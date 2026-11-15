# CLAUDE.md – ioBroker.samba-solar-track

Projektkontext für die Arbeit an diesem Adapter. Texte für den Nutzer (Antworten, diese Datei)
sind deutsch; Code, Kommentare, Log-Texte und README sind englisch, wie bei ioBroker üblich.

## Was wir bauen

Den ioBroker-Adapter zur Steuerung **Samba Solar Track** (Solarnachführung mit Sturmschutz,
Waveshare ESP32-P4-WIFI6-Touch-LCD-10.1 mit 10,1-Zoll-Touch-Display). Der Adapter enthält den Adapter selbst **und vis-2-Widgets**.

- Firmware, Hardware, Handbuch und Regelwerk: `/home/ssternitzke/samba-solar/samba-solar-track/development`, Ordner `zehnzoll/`
  (GitHub: `ssbingo/samba-solar-track-dev`, privat; bleibt privat). Öffentlich sind seit 22.10.2026 nur
  `ssbingo/samba-solar-track` (Nachbau: Handbuch, Platinen) und `ssbingo/samba-solar-track-firmware` (Abbilder).
- Dieses Repository (`ssbingo/ioBroker.samba-solar-track`) ist seit dem 2.10.2026 öffentlich,
  damit sich der Adapter in ioBroker über GitHub installieren lässt.
- Vertrag zwischen Gerät und Adapter: `PROTOCOL.md` im Firmware-Projekt (Protokollversion 1).
  Ändert sich das Protokoll, wird es dort geändert und hier nachgezogen, nie umgekehrt.
- Planung: `docs/planung/iobroker-adapter.md` im Firmware-Projekt.

## Grundsätze (vom Nutzer festgelegt)

- **Das Gerät ist der Kopf, das Display das Hauptgerät.** Weboberfläche und Adapter sind
  Zusätze (Regel F17 des Firmware-Regelwerks). Der Adapter erfindet keine Funktion, die es am
  Display nicht gibt, und das Gerät arbeitet ohne ihn vollständig weiter (F1).
- Befehle aus der Ferne wirken nur über das Protokoll; Sturmschutz, Endschalter, Totzeit und
  Laufzeitüberwachung lassen sich nicht umgehen (F2). Sicherheitswerte gelten erst nach
  Bestätigung am Display (F7).
- **Lizenz: CC BY-NC-SA 4.0**, wie Hardware und Firmware (F12). SPDX `CC-BY-NC-SA-4.0` in
  `package.json` und `io-package.json`. Der Creator kennt diese Lizenz nicht; sie wurde nach
  dem Erzeugen von Hand eingetragen.
- **Der Adapter wurde mit dem Creator erzeugt** (`@iobroker/create-adapter` 3.1.5, Antworten in
  `.create-adapter.json`). Das Gerüst bleibt Creator-konform.
- Sprache **TypeScript**, Einstellungen als JSON-Config, vis-2-Widgets in **React** nach dem
  Muster von `ioBroker.pondpump` (`src-widgets/`, Vite, Ergebnis in `widgets/`).
- **Kein Commit, kein Push, kein Tag, kein Release und keine Veröffentlichung auf npm ohne
  ausdrückliche Anweisung.** Ein Tag `v*` startet den Job `deploy`; veröffentlicht wird erst,
  wenn bei npm „Trusted Publishing“ für dieses Paket eingerichtet ist.
- Das Token des Geräts erscheint nie im Log und in keinem Test-Ergebnis.
- Autor und Copyright lauten in diesem Projekt **`ssbingo`** (wie in den anderen Adaptern des
  Nutzers), nicht der volle Name. Das Repository ist öffentlich: keine persönlichen Angaben,
  keine Zugangsdaten und nichts aus dem privaten Firmware-Repository hineinkopieren, das dort
  nicht für die Öffentlichkeit gedacht ist.

## Verbindlicher Skill

`.claude/skills/iobroker-adapter-dev/` (SKILL.md und `references/`) ist bei jeder Arbeit
einzuhalten: Versionspflege, `io-package.json`, 11 Sprachen, README in 11 Fassungen
(`README.md` und `doc/<sprache>/README.md`), Workflows, ESLint 9, Rollen, Objekt-Hierarchie,
`ack`, Aufräumen in `onUnload`, Logging nach Abschnitt 11 und der Adapter-Checker vor jedem
Commit:

```bash
OWN_GITHUB_TOKEN="$(gh auth token)" npx @iobroker/repochecker ssbingo/ioBroker.samba-solar-track main
```

Der Checker liest den Stand auf GitHub, nicht die Arbeitskopie: Meldungen zu einer neuen
Änderung zeigen sich erst nach dem Push. Deshalb nach dem Push noch einmal laufen lassen.

**Offene Checker-Meldungen (Stand 3.10.2026, nach 0.0.7) und ihre Begründung:**

| Meldung | Begründung |
| --- | --- |
| E2001 (`bluefox` nicht Mitinhaber auf npm) | nur für die Aufnahme ins ioBroker-Repository nötig (`npm owner add bluefox iobroker.samba-solar-track`); vorher die Lizenzfrage klären |
| W4001 (nicht im ioBroker-Repository) | erledigt sich mit der Aufnahme; vorher ist zu klären, ob das offizielle Repository die Lizenz CC BY-NC-SA annimmt |

Tag `v0.0.5` und GitHub-Release v0.0.5 gibt es seit dem 3.10.2026 (auf Anweisung des Nutzers);
den Release hat Claude von Hand angelegt, weil `deploy` vor dem Anlegen abbrach. Auf npm liegt
0.0.5 seit dem 3.10.2026 (vom Nutzer von Hand veröffentlicht, davor ein Platzhalter
`0.0.0-stage` für „staged publishing“). **0.0.6** (Tag `v0.0.6`, 3.10.2026) hat der Workflow
vollständig veröffentlicht: npm über Trusted Publishing mit Herkunftsnachweis, dazu den
GitHub-Release „Release v0.0.6“. Damit sind E2008 und E3032 erledigt. **0.0.7** (Tag `v0.0.7`,
3.10.2026) ebenso über den Workflow; danach meldet der Checker nur noch E2001 und W4001 (W5508
ist mit 0.0.7 behoben). npm meldet weiter, dass
es `repository.url` in `package.json` selbst berichtigt (`git+https://…`); behoben werden kann
das mit `npm pkg fix` (offen).

Abweichungen vom Skill, die der Checker verlangt (er ist das Tor): Testmatrix mit Node.js 22,
24 **und 26**, die Jobs `check-and-lint` und `deploy` auf Node.js 24,
`ioBroker/testing-action-check@v2`, Workflow `automerge-dependabot.yml`. Der Job `deploy`
nutzt wie bei `ioBroker.pondpump` „Trusted Publishing“ statt eines `NPM_TOKEN`.

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/main.ts` | Adapter: Einstellungen prüfen, Objekte anlegen, Zustand und Meldungen in Datenpunkte schreiben |
| `src/lib/protocol.ts` | Typen und reine Funktionen zum Protokoll |
| `src/lib/states.ts` | Tabelle aller Datenpunkte und Abbildung des Geräte-Zustands darauf |
| `src/lib/messages.ts` | Meldungen: Uhrzeit aus der Laufzeit, Verlauf, laufende Nummern, Weitergabe ins Log |
| `src/lib/device-client.ts` | Verbindung: `GET /api/info`, WebSocket, Wiederverbinden, Überwachung |
| `src/lib/remote-control.ts` | Befehle und Handfahrt: Nummern, Antworten, Erneuern, Totmann |
| `src/lib/params.ts` | Einstellungen des Geräts: Liste prüfen, Datenpunkte beschreiben, Ergebnisse lesen |
| `src/lib/events.ts` | Ereignisse für Benachrichtigungen aus dem Vergleich zweier Zustände |
| `src/lib/notifications.ts` | Texte der Benachrichtigungen in 11 Sprachen, Liste der Messaging-Adapter |
| `src/lib/i18n.ts` | Sprachen von ioBroker, `fullName` (Objektname in 11 Sprachen aus Englisch/Deutsch und der Tabelle) |
| `src/lib/name-translations.ts` | Übersetzungen der Objektnamen in die übrigen 9 Sprachen, nach dem englischen Text; `i18n.test.ts` prüft Vollständigkeit, keine Kopie des Englischen (Ausnahme: „West“ im Deutschen) und keine verwaisten Einträge |
| `test/mock-params.js` | Werteliste, wie der Firmware-Code sie ausgibt (`.pio/build/screenshots_10/program - wertejson 1 2` und `… 0 1` im Firmware-Projekt, Firmware 0.7.8): Liste für zwei Achsen, dahinter die Werte nur für eine Achse; das nachgebildete Gerät filtert nach Merkmal und Betriebsart |
| `src/lib/*.test.ts` | Unit-Tests (mocha) |
| `test/mock-device.js` | nachgebildetes Gerät nach `PROTOCOL.md` für Unit- und Integrationstest |
| `test/integration.js` | Adapter im echten js-controller gegen das nachgebildete Gerät |
| `build/` | Ergebnis von `npm run build`; wird committet (der Adapter-Checker verlangt es) |
| `src-widgets/` | vis-2-Widgets in React (Vite, Module Federation, Aufbau wie `ioBroker.pondpump`): `SstWidgetBase.tsx` (Basisklasse wie `Generic` von vis-2-widgets-material: Abo relativ zur Instanz, Karte über `wrapContent()` von vis-2, `noCard`/`widgetTitle`, Skalierung per ResizeObserver), sechs Widgets `Sst*.tsx`, `band.ts` (Statusband wie `updateStatus()` der Firmware), `lock.ts` (Sperren F2–F4), `theme.ts` (Farben nur aus `context.theme.palette`, Statusband auf MUI-Farben), `parts.tsx` (Kachel, Beschriftung, Statusband aus MUI), `i18n/*.json` (11 Sprachen; Statusbandtexte aus `zehnzoll/sprachen/` übernommen) |
| `widgets/samba-solar-track/` | Ergebnis von `npm run build:widgets` (`tasks.js`); wird committet, damit `build-adapter ts` und die CI kein Vite brauchen |
| `src/lib/texts.test.ts` | prüft admin/i18n, `io-package.json` (Titel, Beschreibung, news), Benachrichtigungen und Widget-Texte: alle 11 Sprachen, keine Kopie des Englischen außer „Samba Solar Track“ |

Prüfen vor jeder Fertigmeldung: `npm run build`, nach Änderungen in `src-widgets/` auch `npm run build:widgets`
(dort vorher `npx eslint -c eslint.config.mjs src` und `npx tsc --noEmit -p .`), `npm run check`, `npm run lint`, `npm test`,
`npm run test:integration`. Der Integrationstest legt eine ioBroker-Testinstallation im
Temp-Verzeichnis an (`test-iobroker.samba-solar-track`) und verwendet sie wieder. Nach
Änderungen an `io-package.json` (neue Einstellungen, `messagebox`) enthält eine alte
Testinstallation noch das alte Instanzobjekt; dann mit frischem Temp-Verzeichnis testen:
`TMPDIR=<leerer Ordner> npm run test:integration`.

## Stand

- **Erledigt (0.0.1):** Verbindung zum Gerät mit Wiederverbinden, Zustand als Datenpunkte,
  Meldungen mit Uhrzeit, Verlauf und Nachholen nach einer Unterbrechung, Weitergabe ins
  ioBroker-Log.
- **Erledigt (0.0.2):** Befehle über die Datenpunkte unter `control`: Automatik, Parken,
  Quittieren, Handfahrt. Die Handfahrt hat einen Totmann von Ende zu Ende: Der Datenpunkt muss
  mindestens einmal pro Sekunde neu geschrieben werden, sonst stoppt der Adapter die Fahrt.
  Das gilt auch für die Widgets, die später darauf aufbauen.
- **Erledigt (0.0.3):** Einstellungen des Geräts als Datenpunkte unter `params` (vom Gerät
  gemeldet, mit Grenzen), Vorschläge mit Bestätigung am Display (`params.pending`),
  Einrichtung über `setup.mode`, `setup.windSensor` und `setup.save`, Design, Simulation
  beenden.
- **Erledigt (0.0.4):** Benachrichtigungen über einen Messaging-Adapter (`sendTo(instanz,
  "send", { text, message })`) für Sturm, Störungen, Windmesser, Sonnensensor, Verbindung und
  Neustart, in der Sprache des Systems. Die Einstellungsseite fragt den Adapter nach den
  vorhandenen Messaging-Instanzen (`getMessagingInstances`, deshalb `common.messagebox`).
- **Erledigt (0.0.5):** Eingabe des Tokens in vier Feldern `tokenBlock1` bis `tokenBlock4`,
  verdeckt wie ein Passwort, mit Auge zum Anzeigen (Wunsch des Nutzers vom 3.10.2026),
  angeordnet wie am Display (Zahnrad → NETZWERK, „TOKEN FUER DEN ADAPTER“);
  Leerzeichen und Großbuchstaben werden aufbereitet, ein falscher Block wird im Log genannt.
  Das alte Feld `token` gilt nur, solange die vier Felder leer sind, und ist nur sichtbar,
  solange es einen Wert hat. Alle Texte nennen den richtigen Ort des Tokens.
- **Erledigt (0.0.6):** Die vier Felder stehen nebeneinander (damals „Block 1“ bis „Block 4“, seit 0.1.1 „Teil 1“ bis „Teil 4“), ohne
  Hilfezeilen, verdeckt mit Auge (Wunsch des Nutzers vom 3.10.2026); das alte Feld `token` wird
  nicht mehr angezeigt. Beim Start übernimmt der Adapter ein gültiges Token daraus einmalig in
  die vier Felder (`updateConfig`, verschlüsselt) und leert es; sind die vier Felder belegt,
  wird es nur geleert. Ein unbrauchbarer alter Wert bleibt, damit das Log den Fehler nennt.
- **Erledigt (0.0.7, veröffentlicht am 3.10.2026):**
  Korrekturen aus der Prüfung von 0.0.6 im echten Admin (8.0.22) und mit echtem js-controller.
  Unter den vier Feldern erscheint nur bei falscher oder unvollständiger Eingabe eine rote Zeile
  (`_tokenError`, Text `tokenBlockError`), weil Admin den `validatorErrorText` eines Passwortfelds
  nicht anzeigt. Ohne `maxLength` lässt sich ein gespeicherter Block wieder ändern (Admin zeigt
  ihn als Platzhalter mit 11 Zeichen). Auf dem Handy nimmt jedes Feld die volle Breite ein
  (`xs: 12`, W5508). Nach `updateConfig` beendet js-controller den Lauf; `onReady` prüft vor dem
  Verbindungsaufbau `this.stopping`, sonst blieb im Compact-Modus eine zweite Verbindung offen.
  Die Warn- und Fehlertexte zum alten Feld sind nach Fall getrennt. Der Integrationstest prüft
  das bloße Leeren des alten Felds; den zweiten Start nach der Übernahme deckt ein Unit-Test ab,
  weil die Testumgebung den Adapter je Suite nur einmal starten kann („This test harness has
  already been used“). README nennt npm und den Stand am Gerät.
- Mit dem echten Gerät verbunden (3.10.2026, Firmware 0.0.3): Verbindung und Lesen gehen; das
  Token wurde nicht angenommen. Die Ursache ist nicht bestätigt; möglich sind Leerzeichen in der
  Eingabe (die 0.0.5 entfernt) oder ein Tippfehler. Alles Übrige nur gegen das nachgebildete
  Gerät geprüft.
- **Erledigt (0.1.1, 15.11.2026, als 0.1.1 veröffentlicht):** Stand der Firmware 0.7.8 nach der
  Aufgabenliste `docs/planung/iobroker-adapter-aufgaben.md` im Firmware-Projekt (A1–A9, B1–B6,
  C1–C4, C6, C8). Kanäle und Datenpunkte mit `feature`/`mode` in `states.ts` entstehen erst, wenn
  das Gerät das Merkmal in `features` meldet und die Betriebsart passt (`syncLayout` in `main.ts`,
  beim ersten Zustand nach dem Verbinden); fällt die Bedingung weg, werden sie gelöscht. Neu:
  Zustände `POSITION`, `COMMISSION`, `ASTRO`; Kanal `sunPosition` (eigener Kanal, weil `sun` der
  Sonnensensor ist; Zeiten als ms); Kanal `commissioning` mit `report0`–`report2` (Text) und
  Ordner `commissioning.report` (Datensatz, Merkmal `reportjson`), gelesen nach dem Verbinden,
  bei Änderung von `done` und beim Schließen des Setup-Programms (Tag `[rep]`); Kanal `position`
  mit Hall-Abgriff; `axes.*.syncReset…`; Kanal `firmware`; `axes.elevation.flatDirection`,
  `angle`, `angleSource`; Befehle `control.position`, `control.positionResume`,
  `control.syncResetElevation`/`Azimuth`, `control.fwCheck`, `control.fwInstall` (die Version
  muss geschrieben werden, statt einer Schaltfläche: das ist die Rückfrage); `detail` der
  Ablehnung in `control.lastResult`; die Namen der Elevation folgen `flatDir`
  (STEEPER/FLATTER wie am Display, `relabelElevation`); Namen der neuen Einstellungen;
  Benachrichtigung `commission` (Setup-Programm nicht abgeschlossen, einmal je Auftreten, ab Werk
  an); alle Objektnamen in 11 Sprachen. Geprüft nur gegen das nachgebildete Gerät.
- **Ebenfalls in 0.1.1 (15.11.2026, als 0.1.1 veröffentlicht):** Datenpunkte `battery.*` (Merkmal `battery`),
  `supply.v24`/`v5` (`power`), `supply.adcOk`/`checks` (`chargecheck`), Kanal `update` mit `active`/`percent`
  (`update`) und `phase`/`error` (`updatepark`). Texte der Einstellungsseite ohne Kopie des Englischen (de
  „Portnummer“, „Teil 1“–„Teil 4“; fr „Port réseau“, „Messages de l’appareil“, „Alertes“; pl „Port sieciowy“), geprüft
  von `texts.test.ts`. Sechs vis-2-Widgets (Übersicht, Bedienung, Meldungen, Werte, Sonnenstand, Setup-Programm) nach
  der freigegebenen Vorschau vom 15.11.2026, Satz `samba-solar-track`, `common.visWidgets` und
  `restartAdapters: ["vis-2"]` wie pondpump (ein `restrictWidgets` gibt es weder dort noch in vis-2 2.20.9).
  Totmann: das Widget schreibt `control.jogElevation`/`jogAzimuth` alle 400 ms, beim Loslassen, Fokus- oder
  Seitenverlust 0; Richtung aus `axes.elevation.flatDirection`, sonst aus `common.states`. Handfahrt nur bei
  Automatik aus; Fahrbefehle gesperrt bei Sturm, fehlender Einrichtung, fehlendem Setup-Programm; alles gesperrt bei
  „Fernsteuerung gesperrt“, Update und ohne Verbindung; im Editor wird nichts gesendet. Geprüft in einer echten vis-2
  2.20.9 (dev-server mit web und vis-2) gegen das nachgebildete Gerät, auch Totmann und Browserabbruch.
  Bewusste Abweichungen vom Display, weil kein Widget-Text dem Englischen gleichen darf: einzelne Wörter wie
  STOP, WEST, ELEVATION, „Wind“, Stufenkürzel INF/WRN/ERR (im Widget Zeichen i/!/✕ mit übersetztem Titel). Farben des
  Statusbands damals je Zustand wie am Display (abgelöst durch den Umbau im nächsten Punkt; `pal()`: Nacht und Parken #34495E, Setup-Programm, Einrichtung und
  Sonnensensor violett #8E44AD); die Vorschau hatte Nacht violett und „Setup fehlt“ orange gezeigt.
- **Ebenfalls in 0.1.1 (15.11.2026, als 0.1.1 veröffentlicht): Widgets im vis-2-Design.** Entscheidung des Nutzers vom
  15.11.2026: Display und Widgets dürfen sich unterscheiden, die Widgets folgen dem Design von vis-2 (hell/dunkel), nicht
  mehr dem Gerätedesign „Standard“. Umbau nach vis-2 2.20.9 und vis-2-widgets-material: Karte über `wrapContent()` (Titel
  `widgetTitle`, leer = Name des Widgets, ausgeblendet mit `noCard`), MUI-Bausteine (Button, Switch mit
  FormControlLabel, Chip, LinearProgress, Dialog für die Rückfrage beim Reset der Synchronsteuerung), Farben nur aus
  `this.props.context.theme`, Schrift von vis-2 (Montserrat entfernt), `visDefaultGrid` mit Mindestgrößen,
  `visResizable`, neue Vorschaubilder. Statusband: Texte wie bisher, Farben info/success/warning/error/secondary, Nacht und
  Parken grey[800], bereit/ohne Verbindung grey. Inhalt skaliert mit dem Widget (ResizeObserver, alles in em; Meldungen nach
  der Breite, Liste rollt). `@mui/system` als Abhängigkeit, weil vis-2 es teilt (`moduleFederationShared`); das Manifest
  teilt React, `react/jsx-runtime`, `react-dom`, MUI und `@emotion/react` als Singletons, im Browser wird keine
  Rückfallkopie geladen. Neuer Text `widget_title` in 11 Sprachen. Geprüft in echter vis-2 2.20.9 hell und dunkel:
  Automatik, Sturm, Nacht, Handbetrieb, zwei Achsen, gesperrt, Setup fehlt, Firmware 0.4.8, Editor; Totmann (Maus,
  Leertaste, Loslassen, Browserabbruch) erneut bestanden. Farben der Statusbänder weichen damit bewusst vom Display ab.
- **Offen, in dieser Reihenfolge:** Handbuch, Uhrzeit des Geräts (`time` in `GET /api/info`, ab Firmware 0.0.4).
  Nicht abgebildet sind weiterhin `axes.*.dutyPauseMs` und `lang` (nicht Teil der Aufgabenliste). Die Widgets sind
  noch nicht mit einem echten Gerät geprüft.

---

© ssbingo, 10/2026 · Samba Solar Track · Lizenz CC BY-NC-SA 4.0 (keine kommerzielle
Verwendung, Nachbau für private Zwecke erlaubt)
