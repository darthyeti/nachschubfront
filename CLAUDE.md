# Nachschubfront

Grimdark-Tower-Defense mit Mazing-Mechanik (Vorbild Gem TD) im isometrischen Comicstil. Browser-Spiel für Desktop und Tablet, gehostet auf GitHub Pages.

Pflichtlektüre vor jeder Aufgabe:
- `docs/GDD.md` für Spielregeln und Startwerte
- `docs/PROGRESS.md` für den aktuellen Stand
- den Arbeitsauftrag des aktuellen Meilensteins in `docs/meilensteine/`
- `reference/stiltest.html` für Optik, Zeichenfunktionen und Effekte
- die Studien in `reference/studien/` für Bunker, Aufsätze, Spezialwaffen, Koloss und Gunship (verbindliche Maße und Formen)
- `docs/ART.md` für Stellungen, Gegner und Sprites (Konzeptgrafiken in `reference/konzept/`)
- `docs/SPEICHER.md` für Speicherformat, Export/Import und den Service Worker

## Technische Grundregeln

- Vanilla JavaScript mit nativen ES-Modulen. Kein Framework, keine Laufzeit-Abhängigkeiten, kein Build-Schritt. Das Repository muss direkt so, wie es ist, von GitHub Pages ausgeliefert werden können.
- Entwicklungswerkzeuge (Tests, Screenshots) dürfen npm-Pakete als devDependencies nutzen, das Spiel selbst lädt nie etwas aus `node_modules`.
- Rendering mit Canvas 2D. Kein WebGL in Version 1.
- Lokaler Start: `python3 -m http.server 8000` im Projektordner (Module brauchen HTTP, `file://` funktioniert nicht).
- Code, Bezeichner und Kommentare auf Englisch. Alle sichtbaren Texte auf Deutsch und zentral in `src/data/strings.js`.

## Architektur

```
index.html            Einstieg, Canvas, HUD-Container
manifest.webmanifest  PWA
sw.js                 Service Worker (ab M5)
src/
  main.js             Start, Spielschleife
  core/               Zustand, Phasen, Zufallsgenerator, Ereignisse
  sim/                Simulation: Wegfindung, Gegner, Stellungen, Projektile, Wellen, Wirtschaft
  render/             Kamera, Iso-Projektion, Zeichenfunktionen, Effekte, Caches
  input/              Einheitliche Pointer- und Tastatureingabe, Gesten
  ui/                 HUD, Menüs, Auswahldialoge (DOM über dem Canvas)
  storage/            Speicherschicht
  data/               Doktrinen, Ränge, Gegner, Wellen, Rezepte, Kommandos, Texte
tests/                Unit-Tests (node:test) und Screenshot-Skripte (Playwright)
docs/                 GDD, Fortschritt, Meilensteine
reference/            Stiltest
```

Verbindliche Prinzipien:

1. **Simulation und Darstellung sind getrennt.** Die Simulation läuft mit festem Zeitschritt (1/60 s) und kennt weder Canvas noch DOM. Das Rendering liest den Zustand nur. Spielgeschwindigkeit 2x und 3x bedeutet mehrere Simulationsschritte pro Frame.
2. **Deterministisch.** Alle spielrelevanten Zufallswerte (Karte, Kapselinhalte) kommen aus einem geseedeten Zufallsgenerator in `core/`. `Math.random()` nur für rein optische Effekte.
3. **Datengetrieben.** Alle Zahlen aus dem GDD stehen in `src/data/`. Im Simulationscode stehen keine Balancing-Werte.
4. **Zustand als einfache Objekte.** Keine Klassenhierarchien für Gegner oder Stellungen, sondern Datensätze plus Systeme, die darüber laufen.
5. **Speicherzugriff nur über `src/storage/`.** Kein anderes Modul greift direkt auf localStorage zu. Die Schicht hat eine asynchrone Schnittstelle, damit später ein Online-Backend dahinter passen kann. Alle Lese- und Schreibzugriffe in try/catch, das Spiel muss mit leerem oder fehlendem Speicher korrekt starten.

## Rendering-Regeln

- Iso-Projektion wie im Stiltest: `screenX = (x - y) * 32`, `screenY = (x + y) * 16 - z` in Weltkoordinaten, darüber die Kameratransformation.
- Zeichenstil aus `reference/stiltest.html` übernehmen: Tuschekonturen, drei Schattierungsstufen, Palette, Comic-Schrift für Schadenszahlen.
- Tiefensortierung aller Objekte nach `x + y`.
- Statisches (Hintergrund, Boden, Kartendekor) in Offscreen-Canvas cachen und nur bei Änderung oder Größenänderung neu erzeugen.
- Kein `shadowBlur`. Leuchten mit halbtransparenten Formen oder Verläufen.
- devicePixelRatio auf höchstens 2 begrenzen.
- Obergrenzen für Partikel und Aufkleber (Decals).
- Leistungsziel: 60 fps mit 200 Gegnern und laufenden Effekten auf einem aktuellen iPad.
- `prefers-reduced-motion` beachten: kein Bildschirmwackeln, gedämpfte Blitze.

Sprites (Details in `docs/ART.md`):

- Stellungen und Gegner kommen aus den SVGs in `reference/konzept/`. Sie werden als Module mit dem SVG-Text nach `src/render/sprites/` übernommen, nicht per Netzwerk geladen.
- Ausnahme: Figuren, die in mehreren Achsrichtungen stimmen müssen (Koloss, Gunship), sind kein SVG. Sie werden aus einfachen Körpern in lokalen Koordinaten aufgebaut, weil ein SVG keine Normalen kennt und die richtungsabhängige Schattierung sonst verlorengeht. Sie werden pro Bild gezeichnet statt gerastert: Es gibt höchstens einen von jedem, und ihre beweglichen Teile gehören zum Modell. Zwischengespeichert werden die Schattierungsfarben. Regeln in `docs/ART.md`, Abschnitt „Drehbare Modelle".
- SVG ist nur die Quelle, Canvas die Ausgabe: SVGs beim Start einmal in Offscreen-Canvas rastern, danach nur `drawImage`. Kein SVG-Zeichnen pro Frame.
- Pro Figur wenige Rasterstufen nach Zoom (etwa 0,5x, 1x, 2x mal devicePixelRatio) vorhalten und die passende wählen, damit beim Zoomen nichts unscharf wird.
- Statische Teile als Sprite, Bewegung im Code: Sockel, Gehäuse, Körper, Köpfe und Klingen aus dem SVG; drehende Läufe, schwenkende Waffen, Flammen, Blitze, Beine im Laufzyklus und Flügelschlag per Code wie im Stiltest. Dazu werden die SVGs in Teile mit Ankerpunkt zerlegt.
- Gegner sind nach links gezeichnet und werden je nach Laufrichtung horizontal gespiegelt. Keine acht Richtungen.
- Treffer-Aufblitzen über eine vorgerenderte helle Variante des Sprites, keine Filter pro Frame.
- Silhouette vor Detail: Jede Figur muss auch auf der kleinsten Zoomstufe als Schattenriss erkennbar sein. Leitfarben der Doktrinen und Rüstungsmerkmale laut ART.md.

## Eingabe und Tablet

- Ausschließlich Pointer Events, keine getrennten Maus- und Touch-Pfade.
- Gesten laut GDD Abschnitt 13. Tippen und Ziehen über eine Bewegungsschwelle (etwa 8 CSS-Pixel) unterscheiden.
- Auf dem Canvas `touch-action: none`, im Dokument `overscroll-behavior: none`, keine Textauswahl, kein Kontextmenü beim langen Drücken.
- Nichts nur per Hover erreichbar. Trefferflächen mindestens 44 x 44 CSS-Pixel.
- Safe-Area-Abstände (`env(safe-area-inset-*)`) für HUD-Elemente.
- Audio erst nach der ersten Nutzerinteraktion starten (Safari).
- Am Desktop testen, aber jede Eingabe-Änderung zusätzlich mit Touch-Emulation (Playwright, `hasTouch: true`, Tablet-Viewport 1180 x 820) prüfen.

## Arbeitsweise

- Immer nur den aktuellen Meilenstein bearbeiten. Zu Beginn einen kurzen Plan vorlegen und auf Freigabe warten.
- Kleine, in sich lauffähige Schritte. Nach jedem Schritt: Tests laufen lassen, Screenshot prüfen, mit aussagekräftiger Nachricht committen.
- Wegfindung, Wellenberechnung, Verschmelzen und Rezepte bekommen Unit-Tests.
- Nach jedem Arbeitsblock `docs/PROGRESS.md` aktualisieren: erledigt, offen, bekannte Probleme, Entscheidungen.
- Abweichungen vom GDD nicht stillschweigend umsetzen, sondern vorschlagen und begründen.
- Balancing-Werte nicht eigenmächtig ändern. Auffälligkeiten melden und Vorschläge machen.
