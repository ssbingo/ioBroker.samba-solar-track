![Logo](../../admin/samba-solar-track.png)
# ioBroker.samba-solar-track

> [English README](../../README.md)

Monitoruje sterownik **Samba Solar Track**: tracker słoneczny do modułów fotowoltaicznych z ochroną przed burzą, zbudowany na płytce ESP32-S3 z 7-calowym wyświetlaczem dotykowym. Adapter pokazuje stan sterownika w ioBroker i odbiera każdy komunikat, który urządzenie zapisuje w swoim dzienniku.

Sprzęt, oprogramowanie i instrukcja urządzenia: <https://github.com/ssbingo/samba-solar-track> (to repozytorium nie jest jeszcze publiczne)

„Samba” to nazwa projektu. Adapter nie ma nic wspólnego z usługą udostępniania plików Samba (SMB).

## Jak to działa

Najważniejsze jest urządzenie. Śledzenie słońca, ochrona przed burzą, wyłączniki krańcowe i kontrola czasu pracy działają całkowicie bez sieci i bez ioBroker. Adapter jest dodatkiem: łączy się z urządzeniem w domowej sieci WLAN (HTTP i WebSocket na porcie 80) i odzwierciedla to, co zgłasza urządzenie. Jeśli ioBroker lub WLAN przestanie działać, w pracy trackera nic się nie zmienia.

## Stan projektu

Wczesna wersja w trakcie rozwoju, opublikowana w npm, ale jeszcze nie w repozytoriach ioBroker. Dostępne: połączenie z automatycznym ponownym łączeniem, stan sterownika jako stany, komunikaty z godziną i historią, polecenia (automatyka, parkowanie na płasko, potwierdzenie usterki, jazda ręczna z czuwakiem) oraz ustawienia urządzenia (wartości z granicami, propozycje z potwierdzeniem na wyświetlaczu, konfiguracja, wygląd), zob. [angielskie README](../../README.md#commands). Ponadto powiadomienia przez adapter komunikatów (burza, usterki, wiatromierz, czujnik słońca, połączenie, ponowne uruchomienie). Planowane: widżety vis-2. Połączenie i odczyt przetestowano z prawdziwym urządzeniem (firmware 0.0.3, 03.10.2026); polecenia, ustawienia i powiadomienia tylko z symulowanym urządzeniem.

## Wymagania

- Samba Solar Track z oprogramowaniem 0.0.1 lub nowszym (wersja protokołu 1), WLAN włączone na wyświetlaczu
- ioBroker js-controller 6.0.11 lub nowszy, admin 8.0.0 lub nowszy, Node.js 22 lub nowszy

## Konfiguracja

| Ustawienie | Znaczenie |
| --- | --- |
| Adres urządzenia | Adres IP lub nazwa hosta; wyświetlacz pokazuje je w konfiguracja > sieć. |
| Port | Urządzenie używa portu 80. |
| Token, blok 1 do 4 | Token urządzenia: cztery pola obok siebie, w każdym blok 8 znaków (0-9, a-f). Wyświetlacz pokazuje go w zębatka > NETZWERK, nagłówek „TOKEN FUER DEN ADAPTER”: bloki 1 i 2 w pierwszym wierszu, 3 i 4 w drugim; wpisuj od lewej do prawej. Wpis jest ukryty jak hasło; podczas wpisywania oko go pokazuje. Pola są zapisywane w postaci zaszyfrowanej, a zapisany blok pozostaje ukryty: aby go zmienić, usuń go całkowicie i wpisz ponownie. Bez tokenu adapter tylko odczytuje. Błędny lub niepełny blok jest oznaczany na czerwono, czerwony wiersz pod polami podaje przyczynę, a zapisanie jest zablokowane; jeśli mimo to do adaptera trafi błędny token, dziennik wskaże blok. Token z dawnego pojedynczego pola (wersja 0.0.4 lub starsza) wersja 0.0.6 lub nowsza przenosi przy pierwszym uruchomieniu do czterech pól, po czym adapter uruchamia się ponownie jeden raz; nieużyteczna stara wartość nie jest przenoszona i jest zgłaszana jako błąd, dopóki cztery pola nie zostaną wypełnione. |
| Zapisuj komunikaty urządzenia w dzienniku ioBroker | Od którego poziomu komunikaty urządzenia pojawiają się także w dzienniku ioBroker. Wszystkie komunikaty są i tak zapisywane w stanach w `messages`. |
| Komunikaty w historii | Liczba komunikatów w `messages.history` (od 1 do 500). |

## Dziennik i debugowanie

Poziomy dziennika, znaczniki i zmiana poziomu są opisane w [angielskim README](../../README.md#logging-and-debugging). Token nigdy nie pojawia się w dzienniku.

## Changelog

### 0.0.7 (2026-10-03)
- (ssbingo) wpisywanie tokenu: czerwony wiersz pod czterema polami podaje przyczynę, gdy blok jest niepełny lub błędny; zapisany blok można znowu zmienić (usunąć go całkowicie i wpisać ponownie); na telefonie każde pole zajmuje pełną szerokość; po przeniesieniu starego tokenu pierwsze uruchomienie kończy się poprawnie, zanim js-controller uruchomi adapter ponownie (brak drugiego połączenia w trybie compact); jaśniejsze teksty dziennika o starym polu tokenu

### 0.0.6 (2026-10-03)
- (ssbingo) wpisywanie tokenu: cztery pola obok siebie (blok 1 do 4) bez linii pomocy; dawne pojedyncze pole nie jest już pokazywane: token wpisany tam w wersji 0.0.4 lub starszej jest przy pierwszym uruchomieniu przenoszony do czterech pól (zaszyfrowany), a stare pole jest czyszczone

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
