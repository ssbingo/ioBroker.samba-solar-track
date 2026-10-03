![Logo](../../admin/samba-solar-track.png)
# ioBroker.samba-solar-track

> [English README](../../README.md)

Überwacht die Steuerung **Samba Solar Track**: eine Solarnachführung mit Sturmschutz auf einem ESP32-S3-Board mit 7-Zoll-Touch-Display. Der Adapter zeigt den Zustand der Steuerung in ioBroker und empfängt jede Meldung, die das Gerät in sein Log schreibt.

Hardware, Firmware und Handbuch des Geräts: <https://github.com/ssbingo/samba-solar-track> (dieses Repository ist noch nicht öffentlich)

„Samba“ ist der Name des Projekts. Der Adapter hat nichts mit dem Dateidienst Samba (SMB) zu tun.

## So arbeitet der Adapter

Das Gerät ist der Kopf. Nachführung, Sturmschutz, Endschalter und Laufzeitüberwachung arbeiten vollständig ohne Netzwerk und ohne ioBroker. Der Adapter ist ein Zusatz: Er verbindet sich im Heim-WLAN mit dem Gerät (HTTP und WebSocket auf Port 80) und spiegelt, was das Gerät meldet. Fällt ioBroker oder das WLAN aus, ändert sich am Tracker nichts.

## Stand des Projekts

Frühe Version in Entwicklung, auf npm veröffentlicht, aber noch nicht in den ioBroker-Repositories. Vorhanden: Verbindung mit automatischem Wiederverbinden, Zustand der Steuerung als Datenpunkte, Meldungen mit Uhrzeit und Verlauf, Befehle (Automatik, flach parken, Störung quittieren, Handfahrt mit Totmann) und Einstellungen des Geräts (Werte mit Grenzen, Vorschläge mit Bestätigung am Display, Einrichtung, Design), siehe [englisches README](../../README.md#commands). Dazu Benachrichtigungen über einen Messaging-Adapter (Sturm, Störungen, Windmesser, Sonnensensor, Verbindung, Neustart). Geplant: vis-2-Widgets. Verbindung und Lesen sind mit einem echten Gerät geprüft (Firmware 0.0.3, 3.10.2026); Befehle, Einstellungen und Benachrichtigungen nur gegen ein nachgebildetes Gerät.

## Voraussetzungen

- Samba Solar Track mit Firmware 0.0.1 oder neuer (Protokollversion 1), WLAN am Display eingeschaltet
- ioBroker js-controller 6.0.11 oder neuer, admin 8.0.0 oder neuer, Node.js 22 oder neuer

## Einstellungen

| Einstellung | Bedeutung |
| --- | --- |
| Adresse des Geräts | IP-Adresse oder Gerätename; beides zeigt das Display unter Einrichtung > Netzwerk. |
| Port | Das Gerät verwendet Port 80. |
| Token, Block 1 bis 4 | Das Token des Geräts: vier Felder nebeneinander, je ein Block zu 8 Zeichen (0-9, a-f). Das Display zeigt es unter Zahnrad > NETZWERK, Überschrift „TOKEN FUER DEN ADAPTER“: Block 1 und 2 in der ersten Zeile, 3 und 4 in der zweiten; von links nach rechts eintragen. Die Eingabe ist verdeckt wie ein Passwort; beim Eintippen zeigt das Auge sie an. Die Felder werden verschlüsselt gespeichert, und ein gespeicherter Block bleibt verdeckt: zum Ändern ganz löschen und neu eintragen. Ohne Token liest der Adapter nur. Ein falscher oder unvollständiger Block wird rot markiert, eine rote Zeile unter den Feldern nennt den Grund, und Speichern ist gesperrt; kommt trotzdem ein falsches Token an, nennt das Log den Block. Ein Token aus dem früheren einzelnen Feld (Version 0.0.4 oder älter) übernimmt 0.0.6 oder neuer beim ersten Start in die vier Felder, danach startet der Adapter einmal neu; ein unbrauchbarer alter Wert wird nicht übernommen und als Fehler gemeldet, bis die vier Felder ausgefüllt sind. |
| Meldungen des Geräts ins ioBroker-Log schreiben | Ab welcher Stufe Meldungen des Geräts auch im ioBroker-Log erscheinen. Alle Meldungen stehen unabhängig davon in den Datenpunkten unter `messages`. |
| Meldungen im Verlauf | Anzahl der Meldungen in `messages.history` (1 bis 500). |

## Logging und Fehlersuche

Log-Stufen, Tags und das Umschalten der Log-Stufe stehen im [englischen README](../../README.md#logging-and-debugging). Das Token erscheint nie im Log.

## Changelog

### 0.0.7 (2026-10-03)
- (ssbingo) Eingabe des Tokens: eine rote Zeile unter den vier Feldern nennt den Grund, wenn ein Block unvollständig oder falsch ist; ein gespeicherter Block lässt sich wieder ändern (ganz löschen und neu eintragen); auf dem Handy nimmt jedes Feld die volle Breite ein; nach der Übernahme des alten Tokens endet der erste Start sauber, bevor js-controller den Adapter neu startet (keine zweite Verbindung im Compact-Modus); klarere Log-Texte zum alten Token-Feld

### 0.0.6 (2026-10-03)
- (ssbingo) Eingabe des Tokens: vier Felder nebeneinander (Block 1 bis 4) ohne Hilfezeilen; das alte einzelne Feld wird nicht mehr angezeigt: ein dort mit 0.0.4 oder älter eingetragenes Token wird beim ersten Start in die vier Felder übernommen (verschlüsselt), das alte Feld wird geleert

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
