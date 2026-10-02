![Logo](../../admin/samba-solar-track.png)
# ioBroker.samba-solar-track

> [English README](../../README.md)

Überwacht die Steuerung **Samba Solar Track**: eine Solarnachführung mit Sturmschutz auf einem ESP32-S3-Board mit 7-Zoll-Touch-Display. Der Adapter zeigt den Zustand der Steuerung in ioBroker und empfängt jede Meldung, die das Gerät in sein Log schreibt.

Hardware, Firmware und Handbuch des Geräts: <https://github.com/ssbingo/samba-solar-track> (dieses Repository ist noch nicht öffentlich)

„Samba“ ist der Name des Projekts. Der Adapter hat nichts mit dem Dateidienst Samba (SMB) zu tun.

## So arbeitet der Adapter

Das Gerät ist der Kopf. Nachführung, Sturmschutz, Endschalter und Laufzeitüberwachung arbeiten vollständig ohne Netzwerk und ohne ioBroker. Der Adapter ist ein Zusatz: Er verbindet sich im Heim-WLAN mit dem Gerät (HTTP und WebSocket auf Port 80) und spiegelt, was das Gerät meldet. Fällt ioBroker oder das WLAN aus, ändert sich am Tracker nichts.

## Stand des Projekts

Frühe Version in Entwicklung, nicht auf npm veröffentlicht. Vorhanden: Verbindung mit automatischem Wiederverbinden, Zustand der Steuerung als Datenpunkte, Meldungen mit Uhrzeit und Verlauf. Geplant: Befehle, Einstellungen des Geräts, Benachrichtigungen, vis-2-Widgets. Bisher nur gegen ein nachgebildetes Gerät geprüft, **nicht mit echter Hardware**.

## Voraussetzungen

- Samba Solar Track mit Firmware 0.0.1 oder neuer (Protokollversion 1), WLAN am Display eingeschaltet
- ioBroker js-controller 6.0.11 oder neuer, admin 8.0.0 oder neuer, Node.js 22 oder neuer

## Einstellungen

| Einstellung | Bedeutung |
| --- | --- |
| Adresse des Geräts | IP-Adresse oder Gerätename; beides zeigt das Display unter Einrichtung > Netzwerk. |
| Port | Das Gerät verwendet Port 80. |
| Token | Steht am Display unter Einrichtung > Netzwerk > Fernzugriff. Lesen geht ohne Token; für Befehle wird es gebraucht. Es wird verschlüsselt gespeichert. |
| Meldungen des Geräts ins ioBroker-Log schreiben | Ab welcher Stufe Meldungen des Geräts auch im ioBroker-Log erscheinen. Alle Meldungen stehen unabhängig davon in den Datenpunkten unter `messages`. |
| Meldungen im Verlauf | Anzahl der Meldungen in `messages.history` (1 bis 500). |

## Logging und Fehlersuche

Log-Stufen, Tags und das Umschalten der Log-Stufe stehen im [englischen README](../../README.md#logging-and-debugging). Das Token erscheint nie im Log.

## Changelog

### 0.0.1 (2026-10-02)
- (ssbingo) erste Version: Verbindung zum Gerät, Zustand der Steuerung und Meldungen als Datenpunkte

## Lizenz

Copyright (c) 2026 ssbingo <s.sternitzke@online.de>

Dieser Adapter steht samt Logo unter der Lizenz [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), wie Hardware und Firmware des Geräts. Kommerzielle Verwendung ist nicht erlaubt. Private Verwendung und privater Nachbau sind erlaubt; Abwandlungen müssen unter derselben Lizenz weitergegeben werden. Der volle Text steht in [LICENSE](../../LICENSE).
