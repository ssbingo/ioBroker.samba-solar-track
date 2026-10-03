![Logo](../../admin/samba-solar-track.png)
# ioBroker.samba-solar-track

> [English README](../../README.md)

Monitoruje sterownik **Samba Solar Track**: tracker słoneczny do modułów fotowoltaicznych z ochroną przed burzą, zbudowany na płytce ESP32-S3 z 7-calowym wyświetlaczem dotykowym. Adapter pokazuje stan sterownika w ioBroker i odbiera każdy komunikat, który urządzenie zapisuje w swoim dzienniku.

Sprzęt, oprogramowanie i instrukcja urządzenia: <https://github.com/ssbingo/samba-solar-track> (to repozytorium nie jest jeszcze publiczne)

„Samba” to nazwa projektu. Adapter nie ma nic wspólnego z usługą udostępniania plików Samba (SMB).

## Jak to działa

Najważniejsze jest urządzenie. Śledzenie słońca, ochrona przed burzą, wyłączniki krańcowe i kontrola czasu pracy działają całkowicie bez sieci i bez ioBroker. Adapter jest dodatkiem: łączy się z urządzeniem w domowej sieci WLAN (HTTP i WebSocket na porcie 80) i odzwierciedla to, co zgłasza urządzenie. Jeśli ioBroker lub WLAN przestanie działać, w pracy trackera nic się nie zmienia.

## Stan projektu

Wczesna wersja w trakcie rozwoju, nieopublikowana w npm. Dostępne: połączenie z automatycznym ponownym łączeniem, stan sterownika jako stany, komunikaty z godziną i historią, polecenia (automatyka, parkowanie na płasko, potwierdzenie usterki, jazda ręczna z czuwakiem) oraz ustawienia urządzenia (wartości z granicami, propozycje z potwierdzeniem na wyświetlaczu, konfiguracja, wygląd), zob. [angielskie README](../../README.md#commands). Ponadto powiadomienia przez adapter komunikatów (burza, usterki, wiatromierz, czujnik słońca, połączenie, ponowne uruchomienie). Planowane: widżety vis-2. Dotąd testowane tylko z symulowanym urządzeniem, **nie z prawdziwym sprzętem**.

## Wymagania

- Samba Solar Track z oprogramowaniem 0.0.1 lub nowszym (wersja protokołu 1), WLAN włączone na wyświetlaczu
- ioBroker js-controller 6.0.11 lub nowszy, admin 8.0.0 lub nowszy, Node.js 22 lub nowszy

## Konfiguracja

| Ustawienie | Znaczenie |
| --- | --- |
| Adres urządzenia | Adres IP lub nazwa hosta; wyświetlacz pokazuje je w konfiguracja > sieć. |
| Port | Urządzenie używa portu 80. |
| Bloki tokenu 1–4 | Token urządzenia, jeden blok na pole. Wyświetlacz pokazuje go w menu koło zębate > NETZWERK, pod nagłówkiem „TOKEN FUER DEN ADAPTER”, jako 4 bloki po 8 znaków w dwóch wierszach: bloki 1 i 2 w pierwszym wierszu, bloki 3 i 4 w drugim. Pola są ułożone tak samo. Wielkość liter nie ma znaczenia. Odczyt działa bez tokenu; polecenia i ustawienia go wymagają. Pola są zapisywane w postaci zaszyfrowanej. Błędny blok (nie 8 znaków 0-9 i a-f albo pusty, gdy inne są wypełnione) jest oznaczany na czerwono, a ustawienia można zapisać dopiero po jego poprawieniu lub wyczyszczeniu wszystkich czterech pól. Jeśli mimo to błędny token trafi do adaptera, dziennik wskazuje błędny blok, a adapter tylko odczytuje. Wpis jest ukryty jak hasło; oko w każdym polu go pokazuje. |
| Token (stare pole) | Pojawia się tylko wtedy, gdy token wpisano w wersji 0.0.4 lub starszej. Jest używany tylko wtedy, gdy cztery pola są puste, i można go usunąć po wpisaniu czterech bloków. |
| Zapisuj komunikaty urządzenia w dzienniku ioBroker | Od którego poziomu komunikaty urządzenia pojawiają się także w dzienniku ioBroker. Wszystkie komunikaty są i tak zapisywane w stanach w `messages`. |
| Komunikaty w historii | Liczba komunikatów w `messages.history` (od 1 do 500). |

## Dziennik i debugowanie

Poziomy dziennika, znaczniki i zmiana poziomu są opisane w [angielskim README](../../README.md#logging-and-debugging). Token nigdy nie pojawia się w dzienniku.

## Changelog

### 0.0.5 (2026-10-03)
- (ssbingo) wpisywanie tokenu w czterech polach, po jednym bloku 8 znaków, jak na wyświetlaczu; token wpisany wcześniej ze spacjami też działa; błędny blok jest wskazywany w dzienniku; teksty podają właściwe miejsce tokenu (koło zębate > NETZWERK); cztery pola są ukryte jak hasło, oko pokazuje wpis

### 0.0.4 (2026-10-02)
- (ssbingo) powiadomienia przez adapter komunikatów: burza, usterki, wiatromierz, czujnik słońca, połączenie, ponowne uruchomienie

### 0.0.3 (2026-10-02)
- (ssbingo) ustawienia urządzenia jako stany: wartości z granicami, propozycje czekające na potwierdzenie na wyświetlaczu, konfiguracja, wygląd

### 0.0.2 (2026-10-02)
- (ssbingo) polecenia: automatyka wł./wył., parkowanie na płasko, potwierdzenie usterki i jazda ręczna z czuwakiem

### 0.0.1 (2026-10-02)
- (ssbingo) pierwsza wersja: połączenie z urządzeniem, stan sterownika i komunikaty jako stany

## Licencja

Copyright (c) 2026 ssbingo <s.sternitzke@online.de>

Ten adapter wraz z logo jest objęty licencją [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), tak jak sprzęt i oprogramowanie urządzenia. Użycie komercyjne jest niedozwolone. Użytek prywatny i prywatne odtworzenie są dozwolone; adaptacje muszą być udostępniane na tej samej licencji. Pełny tekst znajduje się w pliku [LICENSE](../../LICENSE).
