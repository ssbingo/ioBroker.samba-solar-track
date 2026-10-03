![Logo](../../admin/samba-solar-track.png)
# ioBroker.samba-solar-track

> [English README](../../README.md)

Überwacht die Steuerung **Samba Solar Track**: eine Solarnachführung mit Sturmschutz auf einem ESP32-S3-Board mit 7-Zoll-Touch-Display. Der Adapter zeigt den Zustand der Steuerung in ioBroker und empfängt jede Meldung, die das Gerät in sein Log schreibt.

Hardware, Firmware und Handbuch des Geräts: <https://github.com/ssbingo/samba-solar-track> (dieses Repository ist noch nicht öffentlich)

„Samba“ ist der Name des Projekts. Der Adapter hat nichts mit dem Dateidienst Samba (SMB) zu tun.

## So arbeitet der Adapter

Das Gerät ist der Kopf. Nachführung, Sturmschutz, Endschalter und Laufzeitüberwachung arbeiten vollständig ohne Netzwerk und ohne ioBroker. Der Adapter ist ein Zusatz: Er verbindet sich im Heim-WLAN mit dem Gerät (HTTP und WebSocket auf Port 80) und spiegelt, was das Gerät meldet. Fällt ioBroker oder das WLAN aus, ändert sich am Tracker nichts.

## Stand des Projekts

Frühe Version in Entwicklung, nicht auf npm veröffentlicht. Vorhanden: Verbindung mit automatischem Wiederverbinden, Zustand der Steuerung als Datenpunkte, Meldungen mit Uhrzeit und Verlauf, Befehle (Automatik, flach parken, Störung quittieren, Handfahrt mit Totmann) und Einstellungen des Geräts (Werte mit Grenzen, Vorschläge mit Bestätigung am Display, Einrichtung, Design), siehe [englisches README](../../README.md#commands). Dazu Benachrichtigungen über einen Messaging-Adapter (Sturm, Störungen, Windmesser, Sonnensensor, Verbindung, Neustart). Geplant: vis-2-Widgets. Bisher nur gegen ein nachgebildetes Gerät geprüft, **nicht mit echter Hardware**.

## Voraussetzungen

- Samba Solar Track mit Firmware 0.0.1 oder neuer (Protokollversion 1), WLAN am Display eingeschaltet
- ioBroker js-controller 6.0.11 oder neuer, admin 8.0.0 oder neuer, Node.js 22 oder neuer

## Einstellungen

| Einstellung | Bedeutung |
| --- | --- |
| Adresse des Geräts | IP-Adresse oder Gerätename; beides zeigt das Display unter Einrichtung > Netzwerk. |
| Port | Das Gerät verwendet Port 80. |
| Token-Block 1 bis 4 | Das Token des Geräts, ein Block pro Feld. Das Display zeigt es unter Zahnrad > NETZWERK, Überschrift „TOKEN FUER DEN ADAPTER“, als 4 Blöcke zu je 8 Zeichen in zwei Zeilen: Block 1 und 2 in der ersten Zeile, Block 3 und 4 in der zweiten. Die Felder sind genauso angeordnet. Groß- und Kleinschreibung spielt keine Rolle. Lesen geht ohne Token; Befehle und Einstellungen brauchen es. Die Felder werden verschlüsselt gespeichert. Ein falscher Block (nicht 8 Zeichen 0-9 und a-f, oder leer, während andere ausgefüllt sind) wird rot markiert, und die Einstellungen lassen sich erst speichern, wenn er berichtigt ist oder alle vier Felder leer sind. Kommt trotzdem ein falsches Token beim Adapter an, nennt das Log den falschen Block, und der Adapter liest nur. Die Eingabe ist verdeckt wie ein Passwort; das Auge im Feld zeigt sie an. |
| Token (altes Feld) | Erscheint nur, wenn mit Version 0.0.4 oder älter ein Token eingegeben wurde. Es gilt nur, solange die vier Felder leer sind, und kann nach dem Eintragen der vier Blöcke gelöscht werden. |
| Meldungen des Geräts ins ioBroker-Log schreiben | Ab welcher Stufe Meldungen des Geräts auch im ioBroker-Log erscheinen. Alle Meldungen stehen unabhängig davon in den Datenpunkten unter `messages`. |
| Meldungen im Verlauf | Anzahl der Meldungen in `messages.history` (1 bis 500). |

## Logging und Fehlersuche

Log-Stufen, Tags und das Umschalten der Log-Stufe stehen im [englischen README](../../README.md#logging-and-debugging). Das Token erscheint nie im Log.

## Changelog

### 0.0.5 (2026-10-03)
- (ssbingo) Eingabe des Tokens in vier Feldern, je ein Block zu 8 Zeichen wie am Display; ein früher mit Leerzeichen eingegebenes Token funktioniert jetzt auch; ein falscher Block wird im Log genannt; die Texte nennen den richtigen Ort des Tokens (Zahnrad > NETZWERK); die vier Felder sind verdeckt wie ein Passwort, das Auge zeigt die Eingabe

### 0.0.4 (2026-10-02)
- (ssbingo) Benachrichtigungen über einen Messaging-Adapter: Sturm, Störungen, Windmesser, Sonnensensor, Verbindung, Neustart

### 0.0.3 (2026-10-02)
- (ssbingo) Einstellungen des Geräts als Datenpunkte: Werte mit Grenzen, Vorschläge, die am Display auf Bestätigung warten, Einrichtung, Design

### 0.0.2 (2026-10-02)
- (ssbingo) Befehle: Automatik ein/aus, flach parken, Störung quittieren und Handfahrt mit Totmann

### 0.0.1 (2026-10-02)
- (ssbingo) erste Version: Verbindung zum Gerät, Zustand der Steuerung und Meldungen als Datenpunkte

## Lizenz

Copyright (c) 2026 ssbingo <s.sternitzke@online.de>

Dieser Adapter steht samt Logo unter der Lizenz [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), wie Hardware und Firmware des Geräts. Kommerzielle Verwendung ist nicht erlaubt. Private Verwendung und privater Nachbau sind erlaubt; Abwandlungen müssen unter derselben Lizenz weitergegeben werden. Der volle Text steht in [LICENSE](../../LICENSE).
