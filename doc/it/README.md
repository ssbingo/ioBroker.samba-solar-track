![Logo](../../admin/samba-solar-track.png)
# ioBroker.samba-solar-track

> [English README](../../README.md)

Monitora il controllore **Samba Solar Track**: un inseguitore solare per moduli fotovoltaici con protezione dalle tempeste, basato su una scheda ESP32-S3 con display touch da 7 pollici. L'adattatore mostra lo stato del controllore in ioBroker e riceve ogni messaggio che il dispositivo scrive nel proprio log.

Hardware, firmware e manuale del dispositivo: <https://github.com/ssbingo/samba-solar-track> (questo repository non è ancora pubblico)

«Samba» è il nome del progetto. L'adattatore non ha nulla a che fare con il servizio di condivisione file Samba (SMB).

## Come funziona

È il dispositivo a comandare. Inseguimento, protezione dalle tempeste, finecorsa e controllo del tempo di funzionamento lavorano completamente senza rete e senza ioBroker. L'adattatore è un'aggiunta: si collega al dispositivo nella WLAN di casa (HTTP e WebSocket sulla porta 80) e rispecchia ciò che il dispositivo segnala. Se ioBroker o la WLAN non funzionano, per l'inseguitore non cambia nulla.

## Stato del progetto

Versione iniziale in sviluppo, pubblicata su npm, ma non ancora nei repository di ioBroker. Disponibile: connessione con riconnessione automatica, stato del controllore come stati, messaggi con ora e cronologia, comandi (automatico, parcheggio in piano, conferma del guasto, movimento manuale con uomo morto) e impostazioni del dispositivo (valori con limiti, proposte con conferma sul display, configurazione, design), vedi il [README inglese](../../README.md#commands). Inoltre notifiche tramite un adattatore di messaggistica (tempesta, guasti, anemometro, sensore solare, connessione, riavvio). Previsto: widget vis-2. Connessione e lettura sono state testate con un dispositivo reale (firmware 0.0.3, 03/10/2026); comandi, impostazioni e notifiche solo con un dispositivo simulato.

## Requisiti

- Samba Solar Track con firmware 0.0.1 o successivo (versione del protocollo 1), WLAN attivata sul display
- ioBroker js-controller 6.0.11 o successivo, admin 8.0.0 o successivo, Node.js 22 o successivo

## Configurazione

| Impostazione | Significato |
| --- | --- |
| Indirizzo del dispositivo | Indirizzo IP o nome host; il display li mostra in configurazione > rete. |
| Porta | Il dispositivo usa la porta 80. |
| Token, blocco da 1 a 4 | Il token del dispositivo: quattro campi affiancati, ciascuno con un blocco di 8 caratteri (0-9, a-f). Il display lo mostra in ingranaggio > NETZWERK, titolo «TOKEN FUER DEN ADAPTER»: blocchi 1 e 2 nella prima riga, 3 e 4 nella seconda; inserirli da sinistra a destra. L'inserimento è nascosto come una password; durante la digitazione l'occhio lo mostra. I campi sono salvati cifrati e un blocco salvato resta nascosto: per modificarlo, cancellarlo completamente e inserirlo di nuovo. Senza token l'adattatore legge soltanto. Un blocco errato o incompleto è segnato in rosso, una riga rossa sotto i campi ne indica il motivo e il salvataggio è bloccato; se comunque arriva all'adattatore un token errato, il log indica il blocco. Un token del vecchio campo unico (versione 0.0.4 o precedente) viene spostato nei quattro campi al primo avvio della 0.0.6 o successiva, poi l'adattatore si riavvia una volta; un vecchio valore inutilizzabile non viene spostato e viene segnalato come errore finché i quattro campi non sono compilati. |
| Scrivere i messaggi del dispositivo nel log di ioBroker | Da quale livello i messaggi del dispositivo compaiono anche nel log di ioBroker. Tutti i messaggi sono comunque salvati negli stati sotto `messages`. |
| Messaggi nella cronologia | Numero di messaggi in `messages.history` (da 1 a 500). |

## Log e debug

Livelli di log, tag e cambio del livello sono descritti nel [README inglese](../../README.md#logging-and-debugging). Il token non compare mai nel log.

## Changelog

### 0.0.7 (2026-10-03)
- (ssbingo) inserimento del token: una riga rossa sotto i quattro campi indica il motivo quando un blocco è incompleto o errato; un blocco salvato può essere di nuovo modificato (cancellarlo completamente e inserirlo di nuovo); sul telefono ogni campo occupa tutta la larghezza; dopo lo spostamento del vecchio token il primo avvio termina correttamente prima che js-controller riavvii l'adattatore (nessuna seconda connessione in modalità compatta); testi di log più chiari sul vecchio campo del token

### 0.0.6 (2026-10-03)
- (ssbingo) inserimento del token: quattro campi affiancati (blocco da 1 a 4) senza righe di aiuto; il vecchio campo unico non viene più mostrato: un token inserito lì con la 0.0.4 o precedente viene spostato nei quattro campi al primo avvio (cifrato) e il vecchio campo viene svuotato

### 0.0.5 (2026-10-03)
- (ssbingo) inserimento del token in quattro campi, un blocco di 8 caratteri ciascuno come sul display; anche un token inserito in precedenza con spazi ora funziona; un blocco errato viene indicato nel log; i testi indicano il punto corretto del token (ingranaggio > NETZWERK); i quattro campi sono nascosti come una password, l'occhio mostra quanto inserito

### 0.0.4 (2026-10-02)
- (ssbingo) notifiche tramite un adattatore di messaggistica: tempesta, guasti, anemometro, sensore solare, connessione, riavvio

### 0.0.3 (2026-10-02)
- (ssbingo) impostazioni del dispositivo come stati: valori con limiti, proposte in attesa di conferma sul display, configurazione, design

### 0.0.2 (2026-10-02)
- (ssbingo) comandi: automatico on/off, parcheggio in piano, conferma del guasto e movimento manuale con uomo morto

### 0.0.1 (2026-10-02)
- (ssbingo) prima versione: connessione al dispositivo, stato del controllore e messaggi come stati

## Licenza

Copyright (c) 2026 ssbingo <s.sternitzke@online.de>

Questo adattatore, logo compreso, è rilasciato con licenza [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), come l'hardware e il firmware del dispositivo. L'uso commerciale non è consentito. L'uso privato e la replica per scopi privati sono consentiti; gli adattamenti devono essere condivisi con la stessa licenza. Il testo completo si trova in [LICENSE](../../LICENSE).
