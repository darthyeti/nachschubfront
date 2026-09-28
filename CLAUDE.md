# Nachschubfront

Grimdark-Tower-Defense mit Mazing-Mechanik (Vorbild Gem TD) im isometrischen Comicstil. Browser-Spiel für Desktop und Tablet, gehostet auf GitHub Pages.

## Was vor einer Aufgabe zu lesen ist

Immer: `docs/PROGRESS.md` (Stand, offene Punkte, geltende Regeln).

Dazu, was die Aufgabe berührt — nicht mehr:

| Aufgabe | Quelle |
|---|---|
| Spielregeln, Zahlen, Wellen, Wirtschaft | `docs/GDD.md` |
| Stellungen, Gegner, HUD, Menüs, Sprites | `docs/ART.md`, Blätter in `reference/konzept/` |
| Bunker, Aufsätze, Koloss, Gunship (verbindliche Maße) | die Studien in `reference/studien/` |
| Zeichenstil, Effekte, Zeichenfunktionen | `reference/stiltest.html` |
| Speicherformat, Export/Import, Service Worker | `docs/SPEICHER.md` |
| der laufende Meilenstein | `docs/meilensteine/M6-balancing.md` |
| Balancing-Werkzeuge und Protokolle | `balancing/README.md` |

Die abgeschlossenen Meilensteine stehen als Tabelle in `docs/meilensteine/README.md`; ihre Arbeitsaufträge sind in der Git-Historie.

## Technische Grundregeln

- Vanilla JavaScript mit nativen ES-Modulen. Kein Framework, keine Laufzeit-Abhängigkeiten, kein Build-Schritt. Das Repository muss direkt so, wie es ist, von GitHub Pages ausgeliefert werden können.
- Entwicklungswerkzeuge (Tests, Screenshots, Balancing) dürfen npm-Pakete als devDependencies nutzen, das Spiel selbst lädt nie etwas aus `node_modules`.
- Rendering mit Canvas 2D. Kein WebGL in Version 1.
- Lokaler Start: `python3 -m http.server 8000` im Projektordner (Module brauchen HTTP, `file://` funktioniert nicht).
- Code, Bezeichner und Kommentare auf Englisch. Alle sichtbaren Texte auf Deutsch und zentral in `src/data/strings.js`.

## Architektur

```
index.html            Einstieg, Canvas, HUD-Container
manifest.webmanifest  PWA
sw.js                 Service Worker (erzeugt, npm run precache)
src/
  main.js             Start, Spielschleife
  core/               Zustand, Phasen, Zufallsgenerator, Ereignisse
  sim/                Simulation: Wegfindung, Gegner, Stellungen, Projektile, Wellen,
                      Wirtschaft, Aufzeichnung und Nachspielen
  render/             Kamera, Iso-Projektion, Zeichenfunktionen, Effekte, Caches
  input/              Einheitliche Pointer- und Tastatureingabe, Gesten
  ui/                 HUD, Menüs, Auswahldialoge (DOM über dem Canvas)
  storage/            Speicherschicht
  data/               Doktrinen, Ränge, Gegner, Wellen, Rezepte, Kommandos, Texte
tests/                Unit-Tests (node:test), Browser-Prüfungen und Werkzeuge (Playwright)
docs/                 GDD, ART, SPEICHER, Fortschritt, Meilensteine
reference/            Stiltest, Studien, Konzeptblätter
balancing/            Aufgezeichnete Partien und Auswertungen (M6)
```

Verbindliche Prinzipien:

1. **Simulation und Darstellung sind getrennt.** Die Simulation läuft mit festem Zeitschritt (1/60 s) und kennt weder Canvas noch DOM. Das Rendering liest den Zustand nur. Spielgeschwindigkeit 2x und 3x bedeutet mehrere Simulationsschritte pro Frame.
2. **Deterministisch.** Alle spielrelevanten Zufallswerte (Karte, Kapselinhalte) kommen aus einem geseedeten Zufallsgenerator in `core/`. `Math.random()` nur für rein optische Effekte. Keine Echtzeit in `sim/` und `core/` — kein `Date.now`, keine Bildrate: Eine Partie muss sich Schritt für Schritt wiederholen lassen (`src/sim/replay.js`).
3. **Datengetrieben.** Alle Zahlen aus dem GDD stehen in `src/data/`, die Wellenregeln in `tests/tools/wave-rules.mjs`. Im Simulationscode stehen keine Balancing-Werte.
4. **Zustand als einfache Objekte.** Keine Klassenhierarchien für Gegner oder Stellungen, sondern Datensätze plus Systeme, die darüber laufen.
5. **Speicherzugriff nur über `src/storage/`.** Kein anderes Modul greift direkt auf localStorage zu. Die Schicht hat eine asynchrone Schnittstelle, damit später ein Online-Backend dahinter passt. Alle Zugriffe in try/catch, das Spiel muss mit leerem oder fehlendem Speicher korrekt starten.

## Rendering-Regeln

- Iso-Projektion wie im Stiltest: `screenX = (x - y) * 32`, `screenY = (x + y) * 16 - z` in Weltkoordinaten, darüber die Kameratransformation.
- Zeichenstil aus `reference/stiltest.html`: Tuschekonturen, drei Schattierungsstufen, Palette, Comic-Schrift für Schadenszahlen.
- Tiefensortierung aller Objekte nach `x + y`.
- Statisches (Hintergrund, Boden, Kartendekor) in Offscreen-Canvas cachen und nur bei Änderung oder Größenänderung neu erzeugen.
- Kein `shadowBlur`. Leuchten mit halbtransparenten Formen oder Verläufen.
- devicePixelRatio auf höchstens 2 begrenzen. Obergrenzen für Partikel und Aufkleber.
- Leistungsziel: 60 fps mit 200 Gegnern und laufenden Effekten auf einem aktuellen iPad.
- `prefers-reduced-motion` beachten: kein Bildschirmwackeln, gedämpfte Blitze.
- Ein Element, das der Code über `hidden` verbirgt, braucht eine eigene `[hidden] { display: none }`-Regel — eine Autorenregel wie `display: flex` schlägt sonst die Browserregel.

Sprites (Details in `docs/ART.md`):

- Stellungen und Gegner kommen aus den SVGs in `reference/konzept/`, als Module mit dem SVG-Text nach `src/render/sprites/` übernommen (`npm run sprites`), nie per Netzwerk geladen. Die erzeugten Dateien nicht von Hand ändern.
- SVG ist nur die Quelle, Canvas die Ausgabe: beim Start einmal in Offscreen-Canvas rastern, danach nur `drawImage`. Kein SVG-Zeichnen pro Frame. Pro Figur wenige Rasterstufen nach Zoom (etwa 0,5x, 1x, 2x mal devicePixelRatio).
- **Ausnahme drehbare Modelle** (Koloss, Gunship): kein SVG, sondern aus Körpern in lokalen Koordinaten aufgebaut, weil ein SVG keine Normalen kennt und die richtungsabhängige Schattierung sonst verlorengeht. Pro Bild gezeichnet statt gerastert — es gibt höchstens einen von jedem. Regeln in `docs/ART.md`, Abschnitt „Drehbare Modelle".
- Statische Teile als Sprite, Bewegung im Code: Sockel, Gehäuse, Körper, Köpfe und Klingen aus dem SVG; drehende Läufe, schwenkende Waffen, Flammen, Blitze, Beine im Laufzyklus und Flügelschlag per Code. Dazu sind die SVGs in Teile mit Ankerpunkt zerlegt.
- Bewegung wird aus dem Zustand abgelesen, nicht gemeldet: Ein Schuss ist daran zu erkennen, dass der Nachladezähler hochspringt.
- Gegner sind nach links gezeichnet und werden je nach Laufrichtung horizontal gespiegelt. Keine acht Richtungen.
- Treffer-Aufblitzen über eine vorgerenderte helle Variante des Sprites, keine Filter pro Frame.
- Silhouette vor Detail: Jede Figur muss auch auf der kleinsten Zoomstufe als Schattenriss erkennbar sein.

## Eingabe und Tablet

- Ausschließlich Pointer Events, keine getrennten Maus- und Touch-Pfade.
- Gesten laut GDD Abschnitt 13. Tippen und Ziehen über eine Bewegungsschwelle (etwa 8 CSS-Pixel) unterscheiden.
- Auf dem Canvas `touch-action: none`, im Dokument `overscroll-behavior: none`, keine Textauswahl, kein Kontextmenü beim langen Drücken.
- Nichts nur per Hover erreichbar. Trefferflächen mindestens 44 x 44 CSS-Pixel.
- Safe-Area-Abstände (`env(safe-area-inset-*)`) für HUD-Elemente.
- Audio erst nach der ersten Nutzerinteraktion starten (Safari).
- Jede Eingabe-Änderung zusätzlich mit Touch-Emulation prüfen (`npm run test:input`, Tablet-Viewport 1180 x 820) und in WebKit, der Engine des iPads (`-- --browser webkit`).

## Arbeitsweise

- Immer nur den aktuellen Meilenstein bearbeiten. Zu Beginn einen kurzen Plan vorlegen und auf Freigabe warten.
- Kleine, in sich lauffähige Schritte. Nach jedem Schritt: Tests laufen lassen, im Browser prüfen, mit aussagekräftiger Nachricht committen.
- Wegfindung, Wellenberechnung, Verschmelzen, Rezepte und das Nachspielen bekommen Unit-Tests.
- **Die Geschichte gehört in die Commits, nicht in `docs/PROGRESS.md`.** Dort steht nur, was jetzt gilt: Stand, offene Punkte, bekannte Probleme, Regeln, die weiter gelten. Wer wissen will, warum etwas so ist, liest `git log`. Die Datei war einmal auf 531 Zeilen gewachsen, weil jeder Arbeitsblock sie verlängert hat.
- Abweichungen vom GDD oder vom Arbeitsauftrag nicht stillschweigend umsetzen, sondern vorschlagen und begründen. Auch wenn ein Auftrag etwas verlangt, was nicht eintreten kann, wird das gesagt und nicht umgedeutet.
- Balancing-Werte nicht eigenmächtig ändern. Auffälligkeiten melden und Vorschläge machen.
- Vor einer Veröffentlichung: Versionsnummer in `src/data/version.js` erhöhen und `npm run precache` laufen lassen.
