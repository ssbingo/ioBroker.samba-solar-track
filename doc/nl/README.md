![Logo](../../admin/samba-solar-track.png)
# ioBroker.samba-solar-track

> [English README](../../README.md)

Bewaakt de besturing **Samba Solar Track**: een zonnevolger voor zonnepanelen met stormbeveiliging op een ESP32-S3-board met 7-inch touchscreen. De adapter toont de toestand van de besturing in ioBroker en ontvangt elke melding die het apparaat in zijn log schrijft.

Hardware, firmware en handleiding van het apparaat: <https://github.com/ssbingo/samba-solar-track> (deze repository is nog niet openbaar)

"Samba" is de naam van het project. De adapter heeft niets te maken met de bestandsdienst Samba (SMB).

## Zo werkt het

Het apparaat heeft de leiding. Volgen, stormbeveiliging, eindschakelaars en looptijdbewaking werken volledig zonder netwerk en zonder ioBroker. De adapter is een aanvulling: hij verbindt zich in het thuis-WLAN met het apparaat (HTTP en WebSocket op poort 80) en spiegelt wat het apparaat meldt. Valt ioBroker of het WLAN uit, dan verandert er niets aan de tracker.

## Stand van het project

Vroege versie in ontwikkeling, op npm gepubliceerd, maar nog niet in de ioBroker-repositories. Beschikbaar: verbinding met automatisch opnieuw verbinden, toestand van de besturing als datapunten, meldingen met tijdstip en geschiedenis, commando's (automatisch, vlak parkeren, storing bevestigen, handmatig rijden met dodemansfunctie) en instellingen van het apparaat (waarden met grenzen, voorstellen met bevestiging op het display, inrichting, design), zie de [Engelse README](../../README.md#commands). Daarnaast meldingen via een berichtenadapter (storm, storingen, windmeter, zonnesensor, verbinding, herstart). Gepland: vis-2-widgets. Verbinding en uitlezen zijn getest met een echt apparaat (firmware 0.0.3, 03-10-2026); opdrachten, instellingen en meldingen alleen met een gesimuleerd apparaat.

## Vereisten

- Samba Solar Track met firmware 0.0.1 of nieuwer (protocolversie 1), WLAN ingeschakeld op het display
- ioBroker js-controller 6.0.11 of nieuwer, admin 8.0.0 of nieuwer, Node.js 22 of nieuwer

## Instellingen

| Instelling | Betekenis |
| --- | --- |
| Adres van het apparaat | IP-adres of hostnaam; het display toont beide onder instellen > netwerk. |
| Poort | Het apparaat gebruikt poort 80. |
| Token, blok 1 tot 4 | Het token van het apparaat: vier velden naast elkaar, elk met een blok van 8 tekens (0-9, a-f). Het display toont het onder tandwiel > NETZWERK, kop „TOKEN FUER DEN ADAPTER”: blok 1 en 2 op de eerste regel, 3 en 4 op de tweede; van links naar rechts invoeren. De invoer is verborgen zoals een wachtwoord; tijdens het typen toont het oog hem. De velden worden versleuteld opgeslagen en een opgeslagen blok blijft verborgen: om het te wijzigen, wis het volledig en voer het opnieuw in. Zonder token leest de adapter alleen. Een fout of onvolledig blok wordt rood gemarkeerd, een rode regel onder de velden noemt de reden en opslaan is geblokkeerd; komt er toch een fout token bij de adapter aan, dan noemt het log het blok. Een token uit het vroegere enkele veld (versie 0.0.4 of ouder) zet 0.0.6 of nieuwer bij de eerste start in de vier velden, daarna start de adapter één keer opnieuw; een onbruikbare oude waarde wordt niet overgenomen en als fout gemeld tot de vier velden zijn ingevuld. |
| Meldingen van het apparaat in het ioBroker-log schrijven | Vanaf welk niveau meldingen van het apparaat ook in het ioBroker-log verschijnen. Alle meldingen staan hoe dan ook in de datapunten onder `messages`. |
| Meldingen in de geschiedenis | Aantal meldingen in `messages.history` (1 tot 500). |

## Logging en foutopsporing

Logniveaus, tags en het omschakelen van het logniveau staan in de [Engelse README](../../README.md#logging-and-debugging). Het token verschijnt nooit in het log.

## Changelog

### 0.0.7 (2026-10-03)
- (ssbingo) invoer van het token: een rode regel onder de vier velden noemt de reden als een blok onvolledig of fout is; een opgeslagen blok kan weer worden gewijzigd (volledig wissen en opnieuw invoeren); op de telefoon neemt elk veld de volle breedte in; na het overnemen van het oude token eindigt de eerste start netjes voordat js-controller de adapter opnieuw start (geen tweede verbinding in compacte modus); duidelijkere logteksten over het oude tokenveld

### 0.0.6 (2026-10-03)
- (ssbingo) invoer van het token: vier velden naast elkaar (blok 1 tot 4) zonder hulpregels; het oude enkele veld wordt niet meer getoond: een daar met 0.0.4 of ouder ingevoerd token wordt bij de eerste start in de vier velden gezet (versleuteld) en het oude veld wordt leeggemaakt

### 0.0.5 (2026-10-03)
- (ssbingo) invoer van het token in vier velden, één blok van 8 tekens per veld zoals op het display; een eerder met spaties ingevoerd token werkt nu ook; een fout blok wordt in het log genoemd; de teksten noemen de juiste plek van het token (tandwiel > NETZWERK); de vier velden zijn verborgen zoals een wachtwoord, het oog toont de invoer

### 0.0.4 (2026-10-02)
- (ssbingo) meldingen via een berichtenadapter: storm, storingen, windmeter, zonnesensor, verbinding, herstart

### 0.0.3 (2026-10-02)
- (ssbingo) instellingen van het apparaat als datapunten: waarden met grenzen, voorstellen die op bevestiging op het display wachten, inrichting, design

### 0.0.2 (2026-10-02)
- (ssbingo) commando's: automatisch aan/uit, vlak parkeren, storing bevestigen en handmatig rijden met dodemansfunctie

### 0.0.1 (2026-10-02)
- (ssbingo) eerste versie: verbinding met het apparaat, toestand van de besturing en meldingen als datapunten

## Licentie

Copyright (c) 2026 ssbingo <s.sternitzke@online.de>

Deze adapter valt, inclusief het logo, onder de licentie [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), net als de hardware en de firmware van het apparaat. Commercieel gebruik is niet toegestaan. Privégebruik en nabouw voor privédoeleinden zijn toegestaan; bewerkingen moeten onder dezelfde licentie worden gedeeld. De volledige tekst staat in [LICENSE](../../LICENSE).
