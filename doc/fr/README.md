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
| Jeton | Affiché à l'écran sous configuration > réseau > accès à distance. La lecture fonctionne sans jeton ; il sera nécessaire pour les commandes. Il est stocké chiffré. |
| Écrire les messages de l'appareil dans le journal ioBroker | À partir de quel niveau les messages de l'appareil apparaissent aussi dans le journal ioBroker. Tous les messages sont de toute façon enregistrés dans les états sous `messages`. |
| Messages dans l'historique | Nombre de messages dans `messages.history` (1 à 500). |

## Journalisation et débogage

Les niveaux de journalisation, les balises et le changement de niveau sont décrits dans le [README anglais](../../README.md#logging-and-debugging). Le jeton n'apparaît jamais dans le journal.

## Changelog

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
