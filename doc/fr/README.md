![Logo](../../admin/samba-solar-track.png)
# ioBroker.samba-solar-track

> [English README](../../README.md)

Surveille le contrôleur **Samba Solar Track** : un suiveur solaire pour modules photovoltaïques avec protection contre les tempêtes, basé sur une carte ESP32-S3 avec écran tactile de 7 pouces. L'adaptateur affiche l'état du contrôleur dans ioBroker et reçoit chaque message que l'appareil écrit dans son journal.

Matériel, micrologiciel et manuel de l'appareil : <https://github.com/ssbingo/samba-solar-track> (ce dépôt n'est pas encore public)

« Samba » est le nom du projet. L'adaptateur n'a aucun rapport avec le service de partage de fichiers Samba (SMB).

## Fonctionnement

C'est l'appareil qui décide. Le suivi, la protection contre les tempêtes, les fins de course et la surveillance du temps de marche fonctionnent entièrement sans réseau et sans ioBroker. L'adaptateur est un complément : il se connecte à l'appareil dans le WLAN domestique (HTTP et WebSocket sur le port 80) et reflète ce que l'appareil signale. Si ioBroker ou le WLAN tombe en panne, rien ne change pour le suiveur.

## État du projet

Version précoce en cours de développement, non publiée sur npm. Disponible : connexion avec reconnexion automatique, état du contrôleur sous forme d'états, messages avec heure et historique, commandes (automatique, mise à plat, acquittement de défaut, déplacement manuel avec homme mort) et réglages de l'appareil (valeurs avec limites, propositions avec confirmation à l'écran, configuration, design), voir le [README anglais](../../README.md#commands). S'y ajoutent des notifications via un adaptateur de messagerie (tempête, défauts, anémomètre, capteur solaire, connexion, redémarrage). Prévu : widgets vis-2. Testé jusqu'ici uniquement avec un appareil simulé, **pas avec du matériel réel**.

## Prérequis

- Samba Solar Track avec micrologiciel 0.0.1 ou plus récent (version de protocole 1), WLAN activé sur l'écran
- ioBroker js-controller 6.0.11 ou plus récent, admin 8.0.0 ou plus récent, Node.js 22 ou plus récent

## Configuration

| Réglage | Signification |
| --- | --- |
| Adresse de l'appareil | Adresse IP ou nom d'hôte ; l'écran affiche les deux sous configuration > réseau. |
| Port | L'appareil utilise le port 80. |
| Blocs 1 à 4 du jeton | Le jeton de l'appareil, un bloc par champ. L'écran l'affiche sous roue dentée > NETZWERK, sous le titre « TOKEN FUER DEN ADAPTER », en 4 blocs de 8 caractères sur deux lignes : blocs 1 et 2 sur la première ligne, blocs 3 et 4 sur la seconde. Les champs sont disposés de la même façon. Les majuscules et les minuscules n'ont pas d'importance. La lecture fonctionne sans jeton ; les commandes et les réglages en ont besoin. Les champs sont stockés chiffrés. Un bloc erroné (pas 8 caractères 0-9 et a-f, ou vide alors que d'autres sont remplis) est marqué en rouge, et les réglages ne peuvent être enregistrés qu'une fois le bloc corrigé ou les quatre champs vidés. Si un jeton erroné parvient malgré tout à l'adaptateur, le journal indique le bloc erroné et l'adaptateur ne fait que lire. La saisie est masquée comme un mot de passe ; l'œil de chaque champ l'affiche. |
| Jeton (ancien champ) | N'apparaît que si un jeton a été saisi avec la version 0.0.4 ou antérieure. Il n'est utilisé que tant que les quatre champs sont vides et peut être supprimé après la saisie des quatre blocs. |
| Écrire les messages de l'appareil dans le journal ioBroker | À partir de quel niveau les messages de l'appareil apparaissent aussi dans le journal ioBroker. Tous les messages sont de toute façon enregistrés dans les états sous `messages`. |
| Messages dans l'historique | Nombre de messages dans `messages.history` (1 à 500). |

## Journalisation et débogage

Les niveaux de journalisation, les balises et le changement de niveau sont décrits dans le [README anglais](../../README.md#logging-and-debugging). Le jeton n'apparaît jamais dans le journal.

## Changelog

### 0.0.5 (2026-10-03)
- (ssbingo) saisie du jeton dans quatre champs, un bloc de 8 caractères chacun comme à l'écran ; un jeton saisi auparavant avec des espaces fonctionne aussi ; un bloc erroné est signalé dans le journal ; les textes indiquent le bon emplacement du jeton (roue dentée > NETZWERK); les quatre champs sont masqués comme un mot de passe, l'œil affiche la saisie

### 0.0.4 (2026-10-02)
- (ssbingo) notifications via un adaptateur de messagerie : tempête, défauts, anémomètre, capteur solaire, connexion, redémarrage

### 0.0.3 (2026-10-02)
- (ssbingo) réglages de l'appareil sous forme d'états : valeurs avec limites, propositions en attente de confirmation à l'écran, configuration, design

### 0.0.2 (2026-10-02)
- (ssbingo) commandes : automatique marche/arrêt, mise à plat, acquittement de défaut et déplacement manuel avec homme mort

### 0.0.1 (2026-10-02)
- (ssbingo) première version : connexion à l'appareil, état du contrôleur et messages sous forme d'états

## Licence

Copyright (c) 2026 ssbingo <s.sternitzke@online.de>

Cet adaptateur, logo compris, est placé sous licence [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), comme le matériel et le micrologiciel de l'appareil. L'utilisation commerciale n'est pas autorisée. L'utilisation privée et la reproduction à titre privé sont autorisées ; les adaptations doivent être partagées sous la même licence. Le texte complet se trouve dans [LICENSE](../../LICENSE).
