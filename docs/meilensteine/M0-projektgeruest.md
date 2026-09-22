# M0: Projektgerüst

## Ziel
Ein lauffähiges, leeres Projekt, das lokal und auf GitHub Pages startet, auf Desktop und Tablet sauber im Vollbild läuft und die Werkzeuge für Tests und Screenshots bereitstellt.

## Umfang
- Ordnerstruktur laut CLAUDE.md, `index.html` mit Canvas und HUD-Container, `src/main.js` mit Spielschleife (fester Zeitschritt für die Simulation, Rendering per requestAnimationFrame).
- Canvas füllt den Bildschirm, reagiert auf Größenänderungen und Drehen, berücksichtigt devicePixelRatio (max. 2) und Safe Areas.
- Geseedeter Zufallsgenerator in `src/core/random.js` mit Unit-Test.
- `src/data/strings.js` als zentrale Textdatei.
- `manifest.webmanifest` mit Name, Querformat, Vollbild-Darstellung und Platzhalter-Icons.
- Leere Speicherschicht `src/storage/` mit asynchroner Schnittstelle (get, set, remove) über localStorage.
- `package.json` nur mit devDependencies (Playwright), Skripte für Unit-Tests (`node --test`) und Screenshots (Desktop 1440 x 900 und Tablet 1180 x 820 mit Touch).
- `docs/PROGRESS.md` anlegen.
- Anleitung für GitHub Pages im README (Auslieferung aus dem main-Branch, Stammverzeichnis).

## Nicht im Umfang
Spiellogik, Grafik, Service Worker.

## Abnahme
- Lokal über `python3 -m http.server` erreichbar, keine Konsolenfehler.
- Screenshot-Skript erzeugt Desktop- und Tablet-Bild.
- Unit-Test für den Zufallsgenerator läuft grün (gleicher Seed ergibt gleiche Folge).
- Auf GitHub Pages erreichbar.
