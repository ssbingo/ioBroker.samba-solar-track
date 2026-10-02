# CLAUDE.md – ioBroker.samba-solar-track

Projektkontext für die Arbeit an diesem Adapter. Texte für den Nutzer (Antworten, diese Datei)
sind deutsch; Code, Kommentare, Log-Texte und README sind englisch, wie bei ioBroker üblich.

## Was wir bauen

Den ioBroker-Adapter zur Steuerung **Samba Solar Track** (Solarnachführung mit Sturmschutz,
ESP32-S3 mit 7-Zoll-Touch-Display). Der Adapter enthält den Adapter selbst **und vis-2-Widgets**.

- Firmware, Hardware, Handbuch und Regelwerk: `/home/ssternitzke/samba-solar-track`
  (GitHub: `ssbingo/samba-solar-track`, privat; bleibt privat).
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

**Offene Checker-Meldungen (Stand 2.10.2026, 0.0.1) und ihre Begründung:**

| Meldung | Begründung |
| --- | --- |
| E2000, W3038 (nicht auf npm) | Der Adapter wird ohne Anweisung des Nutzers nicht veröffentlicht |
| E3032 (0.0.1 nicht getaggt), S8005 (kein GitHub-Release) | Tag und Release nur auf Anweisung des Nutzers |
| W4001 (nicht im ioBroker-Repository) | erledigt sich mit der Aufnahme; vorher ist zu klären, ob das offizielle Repository die Lizenz CC BY-NC-SA annimmt |

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
| `src/lib/*.test.ts` | Unit-Tests (mocha) |
| `test/mock-device.js` | nachgebildetes Gerät nach `PROTOCOL.md` für Unit- und Integrationstest |
| `test/integration.js` | Adapter im echten js-controller gegen das nachgebildete Gerät |
| `build/` | Ergebnis von `npm run build`; wird committet (der Adapter-Checker verlangt es) |

Prüfen vor jeder Fertigmeldung: `npm run build`, `npm run check`, `npm run lint`, `npm test`,
`npm run test:integration`.

## Stand

- **Erledigt (0.0.1):** Verbindung zum Gerät mit Wiederverbinden, Zustand als Datenpunkte,
  Meldungen mit Uhrzeit, Verlauf und Nachholen nach einer Unterbrechung, Weitergabe ins
  ioBroker-Log. Nur gegen das nachgebildete Gerät geprüft, **nicht mit echter Hardware**.
- **Offen, in dieser Reihenfolge:** Befehle (Automatik, Parken, Quittieren, Handfahrt mit
  Totmann), Einstellungen des Geräts lesen und schreiben, Benachrichtigungen über
  Messaging-Adapter, vis-2-Widgets (Übersicht, Bedienung, Meldungen, Werte), Handbuch.

---

© ssbingo, 10/2026 · Samba Solar Track · Lizenz CC BY-NC-SA 4.0 (keine kommerzielle
Verwendung, Nachbau für private Zwecke erlaubt)
