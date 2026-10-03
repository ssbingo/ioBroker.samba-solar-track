![Logo](../../admin/samba-solar-track.png)
# ioBroker.samba-solar-track

> [English README](../../README.md)

Supervisa el controlador **Samba Solar Track**: un seguidor solar para módulos fotovoltaicos con protección contra tormentas, basado en una placa ESP32-S3 con pantalla táctil de 7 pulgadas. El adaptador muestra el estado del controlador en ioBroker y recibe cada mensaje que el dispositivo escribe en su registro.

Hardware, firmware y manual del dispositivo: <https://github.com/ssbingo/samba-solar-track> (este repositorio aún no es público)

«Samba» es el nombre del proyecto. El adaptador no tiene nada que ver con el servicio de archivos compartidos Samba (SMB).

## Cómo funciona

El dispositivo es el que manda. El seguimiento, la protección contra tormentas, los finales de carrera y la supervisión del tiempo de marcha funcionan completamente sin red y sin ioBroker. El adaptador es un complemento: se conecta al dispositivo en la WLAN doméstica (HTTP y WebSocket en el puerto 80) y refleja lo que el dispositivo comunica. Si ioBroker o la WLAN fallan, nada cambia en el seguidor.

## Estado del proyecto

Versión temprana en desarrollo, publicada en npm, pero aún no en los repositorios de ioBroker. Disponible: conexión con reconexión automática, estado del controlador como estados, mensajes con hora e historial, comandos (automático, aparcar en horizontal, confirmar avería, movimiento manual con hombre muerto) y ajustes del dispositivo (valores con límites, propuestas con confirmación en la pantalla, configuración, diseño), véase el [README en inglés](../../README.md#commands). Además, notificaciones a través de un adaptador de mensajería (tormenta, averías, anemómetro, sensor solar, conexión, reinicio). Previsto: widgets vis-2. La conexión y la lectura se han probado con un dispositivo real (firmware 0.0.3, 03/10/2026); los comandos, los ajustes y las notificaciones solo con un dispositivo simulado.

## Requisitos

- Samba Solar Track con firmware 0.0.1 o posterior (versión de protocolo 1), WLAN activada en la pantalla
- ioBroker js-controller 6.0.11 o posterior, admin 8.0.0 o posterior, Node.js 22 o posterior

## Configuración

| Ajuste | Significado |
| --- | --- |
| Dirección del dispositivo | Dirección IP o nombre de host; la pantalla muestra ambos en configuración > red. |
| Puerto | El dispositivo utiliza el puerto 80. |
| Token, bloque 1 a 4 | El token del dispositivo: cuatro campos uno al lado del otro, cada uno con un bloque de 8 caracteres (0-9, a-f). La pantalla lo muestra en rueda dentada > NETZWERK, título «TOKEN FUER DEN ADAPTER»: bloques 1 y 2 en la primera línea, 3 y 4 en la segunda; introdúzcalos de izquierda a derecha. La entrada está oculta como una contraseña; al escribir, el ojo la muestra. Los campos se guardan cifrados y un bloque guardado permanece oculto: para cambiarlo, bórrelo por completo e introdúzcalo de nuevo. Sin token el adaptador solo lee. Un bloque erróneo o incompleto se marca en rojo, una línea roja bajo los campos indica el motivo y no se puede guardar; si aun así llega un token erróneo al adaptador, el registro indica el bloque. Un token del antiguo campo único (versión 0.0.4 o anterior) pasa a los cuatro campos en el primer arranque de la 0.0.6 o posterior y el adaptador se reinicia una vez; un valor antiguo inservible no se traslada y se notifica como error hasta que se rellenen los cuatro campos. |
| Escribir los mensajes del dispositivo en el registro de ioBroker | A partir de qué nivel los mensajes del dispositivo aparecen también en el registro de ioBroker. Todos los mensajes se guardan en cualquier caso en los estados bajo `messages`. |
| Mensajes en el historial | Número de mensajes en `messages.history` (1 a 500). |

## Registro y depuración

Los niveles de registro, las etiquetas y el cambio de nivel se describen en el [README en inglés](../../README.md#logging-and-debugging). El token nunca aparece en el registro.

## Changelog

### 0.0.7 (2026-10-03)
- (ssbingo) introducción del token: una línea roja bajo los cuatro campos indica el motivo cuando un bloque está incompleto o es erróneo; un bloque guardado se puede volver a cambiar (borrarlo por completo e introducirlo de nuevo); en el móvil cada campo ocupa todo el ancho; tras trasladar el token antiguo, el primer arranque termina limpiamente antes de que js-controller reinicie el adaptador (sin segunda conexión en modo compacto); textos de registro más claros sobre el antiguo campo del token

### 0.0.6 (2026-10-03)
- (ssbingo) introducción del token: cuatro campos uno al lado del otro (bloque 1 a 4) sin líneas de ayuda; el antiguo campo único ya no se muestra: un token introducido allí con la 0.0.4 o anterior pasa a los cuatro campos en el primer arranque (cifrado) y el campo antiguo se vacía

### 0.0.5 (2026-10-03)
- (ssbingo) introducción del token en cuatro campos, un bloque de 8 caracteres cada uno como en la pantalla; un token introducido antes con espacios también funciona; un bloque erróneo se indica en el registro; los textos indican el lugar correcto del token (engranaje > NETZWERK); los cuatro campos están ocultos como una contraseña, el ojo muestra lo escrito

### 0.0.4 (2026-10-02)
- (ssbingo) notificaciones a través de un adaptador de mensajería: tormenta, averías, anemómetro, sensor solar, conexión, reinicio

### 0.0.3 (2026-10-02)
- (ssbingo) ajustes del dispositivo como estados: valores con límites, propuestas que esperan confirmación en la pantalla, configuración, diseño

### 0.0.2 (2026-10-02)
- (ssbingo) comandos: automático encendido/apagado, aparcar en horizontal, confirmar avería y movimiento manual con hombre muerto

### 0.0.1 (2026-10-02)
- (ssbingo) primera versión: conexión con el dispositivo, estado del controlador y mensajes como estados

## Licencia

Copyright (c) 2026 ssbingo <s.sternitzke@online.de>

Este adaptador, incluido el logotipo, está bajo la licencia [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), igual que el hardware y el firmware del dispositivo. No se permite el uso comercial. El uso privado y la réplica privada están permitidos; las adaptaciones deben compartirse bajo la misma licencia. El texto completo está en [LICENSE](../../LICENSE).
