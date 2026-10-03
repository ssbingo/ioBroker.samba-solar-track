![Logo](../../admin/samba-solar-track.png)
# ioBroker.samba-solar-track

> [English README](../../README.md)

Surveille le contrôleur **Samba Solar Track** : un suiveur solaire pour modules photovoltaïques avec protection contre les tempêtes, basé sur une carte ESP32-S3 avec écran tactile de 7 pouces. L'adaptateur affiche l'état du contrôleur dans ioBroker et reçoit chaque message que l'appareil écrit dans son journal.

Matériel, micrologiciel et manuel de l'appareil : <https://github.com/ssbingo/samba-solar-track> (ce dépôt n'est pas encore public)

« Samba » est le nom du projet. L'adaptateur n'a aucun rapport avec le service de partage de fichiers Samba (SMB).

## Fonctionnement

C'est l'appareil qui décide. Le suivi, la protection contre les tempêtes, les fins de course et la surveillance du temps de marche fonctionnent entièrement sans réseau et sans ioBroker. L'adaptateur est un complément : il se connecte à l'appareil dans le WLAN domestique (HTTP et WebSocket sur le port 80) et reflète ce que l'appareil signale. Si ioBroker ou le WLAN tombe en panne, rien ne change pour le suiveur.

## État du projet

Version précoce en cours de développement, publiée sur npm, mais pas encore dans les dépôts ioBroker. Disponible : connexion avec reconnexion automatique, état du contrôleur sous forme d'états, messages avec heure et historique, commandes (automatique, mise à plat, acquittement de défaut, déplacement manuel avec homme mort) et réglages de l'appareil (valeurs avec limites, propositions avec confirmation à l'écran, configuration, design), voir le [README anglais](../../README.md#commands). S'y ajoutent des notifications via un adaptateur de messagerie (tempête, défauts, anémomètre, capteur solaire, connexion, redémarrage). Prévu : widgets vis-2. La connexion et la lecture ont été testées avec un appareil réel (firmware 0.0.3, 03/10/2026) ; les commandes, les réglages et les notifications uniquement avec un appareil simulé.

## Prérequis

- Samba Solar Track avec micrologiciel 0.0.1 ou plus récent (version de protocole 1), WLAN activé sur l'écran
- ioBroker js-controller 6.0.11 ou plus récent, admin 8.0.0 ou plus récent, Node.js 22 ou plus récent

## Configuration

| Réglage | Signification |
| --- | --- |
| Adresse de l'appareil | Adresse IP ou nom d'hôte ; l'écran affiche les deux sous configuration > réseau. |
| Port | L'appareil utilise le port 80. |
| Jeton, bloc 1 à 4 | Le jeton de l'appareil : quatre champs côte à côte, chacun avec un bloc de 8 caractères (0-9, a-f). L'écran l'affiche sous roue dentée > NETZWERK, titre « TOKEN FUER DEN ADAPTER » : blocs 1 et 2 sur la première ligne, 3 et 4 sur la deuxième ; saisissez-les de gauche à droite. La saisie est masquée comme un mot de passe ; pendant la saisie, l'œil l'affiche. Les champs sont enregistrés chiffrés et un bloc enregistré reste masqué : pour le modifier, effacez-le entièrement et saisissez-le de nouveau. Sans jeton, l'adaptateur ne fait que lire. Un bloc erroné ou incomplet est marqué en rouge, une ligne rouge sous les champs en indique la raison et l'enregistrement est bloqué ; si un jeton erroné parvient malgré tout à l'adaptateur, le journal indique le bloc. Un jeton de l'ancien champ unique (version 0.0.4 ou antérieure) est transféré dans les quatre champs au premier démarrage de la 0.0.6 ou plus récente, puis l'adaptateur redémarre une fois ; une ancienne valeur inutilisable n'est pas transférée et est signalée comme erreur jusqu'à ce que les quatre champs soient remplis. |
| Écrire les messages de l'appareil dans le journal ioBroker | À partir de quel niveau les messages de l'appareil apparaissent aussi dans le journal ioBroker. Tous les messages sont de toute façon enregistrés dans les états sous `messages`. |
| Messages dans l'historique | Nombre de messages dans `messages.history` (1 à 500). |

## Journalisation et débogage

Les niveaux de journalisation, les balises et le changement de niveau sont décrits dans le [README anglais](../../README.md#logging-and-debugging). Le jeton n'apparaît jamais dans le journal.

## Changelog

### 0.0.7 (2026-10-03)
- (ssbingo) saisie du jeton : une ligne rouge sous les quatre champs indique la raison quand un bloc est incomplet ou erroné ; un bloc enregistré peut de nouveau être modifié (l'effacer entièrement et le saisir de nouveau) ; sur téléphone chaque champ occupe toute la largeur ; après le transfert de l'ancien jeton, le premier démarrage se termine proprement avant que js-controller ne redémarre l'adaptateur (pas de seconde connexion en mode compact) ; textes de journal plus clairs sur l'ancien champ du jeton

### 0.0.6 (2026-10-03)
- (ssbingo) saisie du jeton : quatre champs côte à côte (bloc 1 à 4) sans lignes d'aide ; l'ancien champ unique n'est plus affiché : un jeton qui y a été saisi avec la 0.0.4 ou antérieure est transféré dans les quatre champs au premier démarrage (chiffré), et l'ancien champ est vidé

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
