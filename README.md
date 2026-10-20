# Trénink

Osobní PWA pro tréninkový plán s vlastní vahou: přehled cviků s technikou, průvodce tréninkem a záznam progresu. Data zůstávají jen v telefonu (`localStorage`).

Běží na https://r4gnar.github.io/trenink/ — v Chromu na Androidu *⋮ → Přidat na plochu*.

## Struktura

| Soubor | Co obsahuje |
| --- | --- |
| `js/plan.js` | Plán v datech — cviky, rozehřátí, týdny 1–5 |
| `js/content.js` | Nákresy a technika, **generováno** z `technika-cviku.html` |
| `js/store.js` | Uložení dat v telefonu |
| `js/app.js` | Obrazovky a navigace |
| `sw.js` | Offline cache |

## Úpravy

* Změna techniky v příručce: `python tools/build_content.py` (příručka leží o složku výš).
* Nové ikony: `python tools/make_icons.py`.
* **Při každém nasazení zvýšit verzi** v `sw.js` (`VERSION`) i `js/app.js` (`APP_VERSION`), jinak telefon zůstane na staré verzi.
* Lokální test: `python -m http.server 8765` a otevřít http://127.0.0.1:8765/.
