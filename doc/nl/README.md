![Logo](../../admin/samba-solar-track.png)
# ioBroker.samba-solar-track

> [English README](../../README.md)

Bewaakt de besturing **Samba Solar Track**: een zonnevolger voor zonnepanelen met stormbeveiliging op een ESP32-S3-board met 7-inch touchscreen. De adapter toont de toestand van de besturing in ioBroker en ontvangt elke melding die het apparaat in zijn log schrijft.

Hardware, firmware en handleiding van het apparaat: <https://github.com/ssbingo/samba-solar-track> (deze repository is nog niet openbaar)

"Samba" is de naam van het project. De adapter heeft niets te maken met de bestandsdienst Samba (SMB).

## Zo werkt het

Het apparaat heeft de leiding. Volgen, stormbeveiliging, eindschakelaars en looptijdbewaking werken volledig zonder netwerk en zonder ioBroker. De adapter is een aanvulling: hij verbindt zich in het thuis-WLAN met het apparaat (HTTP en WebSocket op poort 80) en spiegelt wat het apparaat meldt. Valt ioBroker of het WLAN uit, dan verandert er niets aan de tracker.

## Stand van het project

Vroege versie in ontwikkeling, niet op npm gepubliceerd. Beschikbaar: verbinding met automatisch opnieuw verbinden, toestand van de besturing als datapunten, meldingen met tijdstip en geschiedenis. Gepland: commando's, instellingen van het apparaat, meldingen via berichtendiensten, vis-2-widgets. Tot nu toe alleen getest met een gesimuleerd apparaat, **niet met echte hardware**.

## Vereisten

- Samba Solar Track met firmware 0.0.1 of nieuwer (protocolversie 1), WLAN ingeschakeld op het display
- ioBroker js-controller 6.0.11 of nieuwer, admin 8.0.0 of nieuwer, Node.js 22 of nieuwer

## Instellingen

| Instelling | Betekenis |
| --- | --- |
| Adres van het apparaat | IP-adres of hostnaam; het display toont beide onder instellen > netwerk. |
| Poort | Het apparaat gebruikt poort 80. |
| Token | Staat op het display onder instellen > netwerk > toegang op afstand. Lezen werkt zonder token; voor commando's is het nodig. Het wordt versleuteld opgeslagen. |
| Meldingen van het apparaat in het ioBroker-log schrijven | Vanaf welk niveau meldingen van het apparaat ook in het ioBroker-log verschijnen. Alle meldingen staan hoe dan ook in de datapunten onder `messages`. |
| Meldingen in de geschiedenis | Aantal meldingen in `messages.history` (1 tot 500). |

## Logging en foutopsporing

Logniveaus, tags en het omschakelen van het logniveau staan in de [Engelse README](../../README.md#logging-and-debugging). Het token verschijnt nooit in het log.

## Changelog

### 0.0.1 (2026-10-02)
- (ssbingo) eerste versie: verbinding met het apparaat, toestand van de besturing en meldingen als datapunten

## Licentie

Copyright (c) 2026 ssbingo <s.sternitzke@online.de>

Deze adapter valt, inclusief het logo, onder de licentie [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), net als de hardware en de firmware van het apparaat. Commercieel gebruik is niet toegestaan. Privégebruik en nabouw voor privédoeleinden zijn toegestaan; bewerkingen moeten onder dezelfde licentie worden gedeeld. De volledige tekst staat in [LICENSE](../../LICENSE).
