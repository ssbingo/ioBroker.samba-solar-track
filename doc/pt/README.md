![Logo](../../admin/samba-solar-track.png)
# ioBroker.samba-solar-track

> [English README](../../README.md)

Monitoriza o controlador **Samba Solar Track**: um seguidor solar para módulos solares com proteção contra tempestades, baseado numa placa ESP32-S3 com ecrã tátil de 7 polegadas. O adaptador mostra o estado do controlador no ioBroker e recebe todas as mensagens que o dispositivo escreve no seu registo.

Hardware, firmware e manual do dispositivo: <https://github.com/ssbingo/samba-solar-track> (este repositório ainda não é público)

«Samba» é o nome do projeto. O adaptador não tem qualquer relação com o serviço de partilha de ficheiros Samba (SMB).

## Como funciona

O dispositivo é quem comanda. O seguimento, a proteção contra tempestades, os fins de curso e a monitorização do tempo de funcionamento trabalham totalmente sem rede e sem ioBroker. O adaptador é um complemento: liga-se ao dispositivo na rede WLAN doméstica (HTTP e WebSocket na porta 80) e reflete o que o dispositivo comunica. Se o ioBroker ou a WLAN falharem, nada muda no seguidor.

## Estado do projeto

Versão inicial em desenvolvimento, não publicada no npm. Disponível: ligação com reconexão automática, estado do controlador como estados, mensagens com hora e histórico, comandos (automático, estacionar na horizontal, confirmar avaria, movimento manual com homem-morto) e definições do dispositivo (valores com limites, propostas com confirmação no ecrã, configuração inicial, design), ver o [README em inglês](../../README.md#commands). Além disso, notificações através de um adaptador de mensagens (tempestade, avarias, sensor de vento, sensor solar, ligação, reinício). Planeado: widgets vis-2. Até agora testado apenas com um dispositivo simulado, **não com hardware real**.

## Requisitos

- Samba Solar Track com firmware 0.0.1 ou mais recente (versão de protocolo 1), WLAN ligada no ecrã
- ioBroker js-controller 6.0.11 ou mais recente, admin 8.0.0 ou mais recente, Node.js 22 ou mais recente

## Configuração

| Definição | Significado |
| --- | --- |
| Endereço do dispositivo | Endereço IP ou nome do anfitrião; o ecrã mostra ambos em configuração > rede. |
| Porta | O dispositivo utiliza a porta 80. |
| Token, bloco 1 a 4 | O token do dispositivo: quatro campos lado a lado, cada um com um bloco de 8 caracteres (0-9, a-f). O ecrã mostra-o em roda dentada > NETZWERK, título «TOKEN FUER DEN ADAPTER»: blocos 1 e 2 na primeira linha, 3 e 4 na segunda; introduza-os da esquerda para a direita. A entrada fica oculta como uma palavra-passe, o olho mostra-a; os campos são guardados encriptados. Sem token o adaptador apenas lê. Um bloco errado é marcado a vermelho e impede guardar; se mesmo assim chegar um token errado ao adaptador, o registo indica o bloco. Um token do antigo campo único (versão 0.0.4 ou anterior) é passado para os quatro campos no primeiro arranque da 0.0.6. |
| Escrever as mensagens do dispositivo no registo do ioBroker | A partir de que nível as mensagens do dispositivo aparecem também no registo do ioBroker. Todas as mensagens ficam, em qualquer caso, nos estados em `messages`. |
| Mensagens no histórico | Número de mensagens em `messages.history` (1 a 500). |

## Registo e depuração

Os níveis de registo, as etiquetas e a forma de mudar o nível estão no [README em inglês](../../README.md#logging-and-debugging). O token nunca aparece no registo.

## Changelog

### 0.0.6 (2026-10-03)
- (ssbingo) introdução do token: quatro campos lado a lado (bloco 1 a 4) sem linhas de ajuda; o antigo campo único já não é mostrado: um token aí introduzido com a 0.0.4 ou anterior é passado para os quatro campos no primeiro arranque (encriptado) e o campo antigo é esvaziado

### 0.0.5 (2026-10-03)
- (ssbingo) introdução do token em quatro campos, um bloco de 8 caracteres cada, como no ecrã; um token introduzido antes com espaços também funciona; um bloco errado é indicado no registo; os textos indicam o local correto do token (roda dentada > NETZWERK); os quatro campos estão ocultos como uma palavra-passe, o olho mostra o que foi escrito

### 0.0.4 (2026-10-02)
- (ssbingo) notificações através de um adaptador de mensagens: tempestade, avarias, sensor de vento, sensor solar, ligação, reinício

### 0.0.3 (2026-10-02)
- (ssbingo) definições do dispositivo como estados: valores com limites, propostas que aguardam confirmação no ecrã, configuração inicial, design

### 0.0.2 (2026-10-02)
- (ssbingo) comandos: automático ligado/desligado, estacionar na horizontal, confirmar avaria e movimento manual com homem-morto

### 0.0.1 (2026-10-02)
- (ssbingo) versão inicial: ligação ao dispositivo, estado do controlador e mensagens como estados

## Licença

Copyright (c) 2026 ssbingo <s.sternitzke@online.de>

Este adaptador, incluindo o logótipo, está licenciado sob [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), tal como o hardware e o firmware do dispositivo. Não é permitida a utilização comercial. A utilização privada e a réplica privada são permitidas; as adaptações têm de ser partilhadas sob a mesma licença. O texto completo está em [LICENSE](../../LICENSE).
