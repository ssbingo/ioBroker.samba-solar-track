![Logo](../../admin/samba-solar-track.png)
# ioBroker.samba-solar-track

> [English README](../../README.md)

Monitora il controllore **Samba Solar Track**: un inseguitore solare per moduli fotovoltaici con protezione dalle tempeste, basato su una scheda ESP32-S3 con display touch da 7 pollici. L'adattatore mostra lo stato del controllore in ioBroker e riceve ogni messaggio che il dispositivo scrive nel proprio log.

Hardware, firmware e manuale del dispositivo: <https://github.com/ssbingo/samba-solar-track> (questo repository non è ancora pubblico)

«Samba» è il nome del progetto. L'adattatore non ha nulla a che fare con il servizio di condivisione file Samba (SMB).

## Come funziona

È il dispositivo a comandare. Inseguimento, protezione dalle tempeste, finecorsa e controllo del tempo di funzionamento lavorano completamente senza rete e senza ioBroker. L'adattatore è un'aggiunta: si collega al dispositivo nella WLAN di casa (HTTP e WebSocket sulla porta 80) e rispecchia ciò che il dispositivo segnala. Se ioBroker o la WLAN non funzionano, per l'inseguitore non cambia nulla.

## Stato del progetto

Versione iniziale in sviluppo, non pubblicata su npm. Disponibile: connessione con riconnessione automatica, stato del controllore come stati, messaggi con ora e cronologia, comandi (automatico, parcheggio in piano, conferma del guasto, movimento manuale con uomo morto) e impostazioni del dispositivo (valori con limiti, proposte con conferma sul display, configurazione, design), vedi il [README inglese](../../README.md#commands). Inoltre notifiche tramite un adattatore di messaggistica (tempesta, guasti, anemometro, sensore solare, connessione, riavvio). Previsto: widget vis-2. Finora testato solo con un dispositivo simulato, **non con hardware reale**.

## Requisiti

- Samba Solar Track con firmware 0.0.1 o successivo (versione del protocollo 1), WLAN attivata sul display
- ioBroker js-controller 6.0.11 o successivo, admin 8.0.0 o successivo, Node.js 22 o successivo

## Configurazione

| Impostazione | Significato |
| --- | --- |
| Indirizzo del dispositivo | Indirizzo IP o nome host; il display li mostra in configurazione > rete. |
| Porta | Il dispositivo usa la porta 80. |
| Blocchi 1-4 del token | Il token del dispositivo, un blocco per campo. Il display lo mostra in ingranaggio > NETZWERK, sotto il titolo «TOKEN FUER DEN ADAPTER», come 4 blocchi di 8 caratteri su due righe: blocchi 1 e 2 nella prima riga, blocchi 3 e 4 nella seconda. I campi sono disposti allo stesso modo. Maiuscole e minuscole non contano. La lettura funziona senza token; comandi e impostazioni lo richiedono. I campi vengono salvati cifrati. Un blocco errato (non 8 caratteri 0-9 e a-f, oppure vuoto mentre altri sono compilati) viene segnato in rosso, e le impostazioni si possono salvare solo dopo averlo corretto o dopo aver svuotato tutti e quattro i campi. Se un token errato arriva comunque all'adattatore, il log indica il blocco errato e l'adattatore legge soltanto. L'inserimento è nascosto come una password; l'occhio in ogni campo lo mostra. |
| Token (campo precedente) | Compare solo se è stato inserito un token con la versione 0.0.4 o precedente. Viene usato solo finché i quattro campi sono vuoti e può essere cancellato dopo aver inserito i quattro blocchi. |
| Scrivere i messaggi del dispositivo nel log di ioBroker | Da quale livello i messaggi del dispositivo compaiono anche nel log di ioBroker. Tutti i messaggi sono comunque salvati negli stati sotto `messages`. |
| Messaggi nella cronologia | Numero di messaggi in `messages.history` (da 1 a 500). |

## Log e debug

Livelli di log, tag e cambio del livello sono descritti nel [README inglese](../../README.md#logging-and-debugging). Il token non compare mai nel log.

## Changelog

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
