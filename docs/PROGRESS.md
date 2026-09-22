# Fortschritt

## Aktueller Meilenstein
M1: Spielkern (umgesetzt, Test durch dich steht aus)

## Erledigt
- Game-Design-Grundlagen (docs/GDD.md)
- Stiltest (reference/stiltest.html)
- M0 Projektgerüst, abgenommen am 22.09.2026. Läuft unter https://darthyeti.github.io/nachschubfront/.
- M1 Spielkern (22.09.2026):
  - Wegfindung (`src/sim/pathfinding.js`): A* in acht Richtungen, gerade Schritte kosten 1, diagonale √2, kein Eckenschneiden, feste Reihenfolge bei Gleichstand (gleiche Karte, gleicher Weg).
  - Route (`src/sim/route.js`): Kette Riss → 1 → 2 → 3 → 4 → Bastion. Die Blockadeprüfung für ein Feld braucht etwa 0,15 ms. Flieger fliegen gerade von Punkt zu Punkt.
  - Kartengenerator (`src/sim/mapgen.js`, Werte in `src/data/map.js`): 24 × 24, Riss und Bastion an gegenüberliegenden Kanten, ein Signalfeuer pro Viertel, 12 bis 20 Ruinen, Krater und Mauerreste, geschützte Ringe. Über 500 Seeds geprüft.
  - Kamera (`src/render/camera.js`): Startansicht mit der ganzen Karte, Felder mindestens 40 px breit. Zoom um den Zeiger oder die Fingermitte, Begrenzung auf die Karte.
  - Eingabe (`src/input/`): Gestenerkennung ohne DOM mit Unit-Tests. Tippen und Ziehen werden über 8 px Schwelle unterschieden, dazu langes Drücken (für M3 vorbereitet), Pinch, Mausrad und Trackpad-Pinch, Pfeiltasten und Tastenkürzel.
  - Phasenautomat (`src/core/phases.js`): Planung → Salve → Auswahl → Welle → Auswertung → Planung, dazu Niederlage und Sieg. Salve und Auswahl laufen bis M2 ohne Inhalt durch.
  - Gegner laufen die bei Wellenstart festgeschriebene Route. Durchbrüche kosten Leben, bei 0 Leben ist die Partie verloren.
  - Fünf Testwellen in `src/data/waves.js`, Gegnertabelle aus dem GDD in `src/data/enemies.js`, Regeln in `src/data/rules.js`.
  - Platzhaltergrafik im Stil des Stiltests: Boden im Offscreen-Cache, Riss, Signalfeuer, Bastion, Ruinen, Krater, Mauern, Trümmer und vier Gegnerformen. Die Routenvorschau ist eine laufende gestrichelte Linie, bei `prefers-reduced-motion` steht sie still.
  - HUD: Welle, Leben, Phase, Routenlänge, Seed, Pause/1x/2x/3x, „Welle starten“, „Neue Partie“, Banner nach Wellen und bei Niederlage oder Sieg.
  - Debug-Werkzeug: Taste `H` oder mit `?debug` der Hindernis-Modus. Abgelehnte Felder blinken rot mit Grund.
  - Tests: 91 Unit-Tests. Dazu `npm run test:input` mit 13 Prüfungen im Browser (Touch-Wischen, Tippen, Pinch, Maus, Tastatur, Welle auf 3x, Niederlage und neue Partie).

## Offen
- M1-Abnahme durch dich: am Desktop und auf dem iPad testen (`?debug` für den Hindernis-Modus).
- M2 Kapselmechanik: Plan vorlegen.

## Bekannte Probleme
- Gegner laufen optisch durch die Signalfeuer-Säulen, weil das Signalfeuerfeld der Wegpunkt ist. Kann mit der finalen Grafik gelöst werden (z. B. Feuerschale neben dem Wegpunkt oder Säule als Torbogen).
- Ohne Stellungen fällt die Bastion in Welle 2 (12 Mutanten plus 24 Schwärmer bei 20 Leben). Das ist bis M2 erwartbar, zum Testen einfach „Neue Partie“.
- Der Boden-Cache ist auf 12 Megapixel begrenzt (Speichergrenze von Safari). Bei maximalem Zoom auf dem iPad kann der Boden leicht unscharf werden, Objekte und Gegner bleiben scharf.
- Headless-Chromium mit Software-Rendering schafft nur etwa 30 bis 60 fps. Mit GPU (Apple M2) stabil 60 fps. Auf echtem iPad noch nicht gemessen.
- Hinweis: iPadOS ignoriert `display: fullscreen` im Manifest und nutzt `standalone`.

## Entscheidungen
- Plattform: Desktop und Tablet gleichwertig, Tablet ist der Haupteinsatz.
- Hosting: GitHub Pages, PWA. Speichern lokal, Speicherschicht für spätere Online-Bestenliste vorbereitet.
- Kapseln nur in der Planungsphase. Spezialkommandos auch während der Welle.
- Fortschritt über mehrere Partien: vertagt bis nach den ersten Tests.
- Schriften werden selbst ausgeliefert statt über Google Fonts (offline-fähig, Datenschutz).
- Zufallsgenerator mulberry32. Seeds dürfen Text sein (FNV-1a-Hash). Karte und Kapseln bekommen eigene Zweige über `fork('map')` und `fork('pods')`. Ein Test hält die Zahlenfolge fest, damit geteilte Seeds über Versionen gleich bleiben.
- Nach einer langen Unterbrechung (Hintergrund-Tab) holt die Simulation nicht auf, sondern verwirft den Rückstand.
- Die Speicherschicht speichert JSON. `set` meldet mit `false`, wenn nicht dauerhaft gespeichert werden konnte.
- Das Screenshot-Skript startet einen eigenen kleinen Node-Server (`tests/tools/server.mjs`).
- M1, freigegeben am 22.09.2026:
  - Signalfeuer-Reihenfolge vom Riss aus: nahes Viertel links → fernes rechts → fernes links → nahes rechts. Die Teilstrecken 1 → 2 und 3 → 4 kreuzen sich in der Mitte.
  - Der Seed wählt die Kante des Risses, die Bastion liegt gegenüber, die Position entlang der Kante ist zufällig (mindestens 6 Felder von den Ecken).
  - Ruinen und Krater belegen 1 Feld, Mauerreste 2 bis 3 Felder in einer Linie. 12 bis 20 zählt Objekte.
  - Ziehen mit der linken Maustaste verschiebt die Karte ebenfalls (ab 8 px), ein Klick bleibt Auswahl.
  - Routenlänge: echte Weglänge, eine Diagonale zählt √2, gerundet angezeigt.
  - Die Auswertung läuft nach 2 s von selbst weiter (`RULES.evaluationSeconds`).
- Seeds für neue Partien bestehen aus 6 Zeichen ohne verwechselbare Zeichen (kein 0/O, 1/I). Eingaben werden in Großbuchstaben umgewandelt. „Neue Partie“ schreibt den Seed in die Adresse, damit man die Karte teilen kann.
- Signalfeuer sind begehbare Wegpunkte, Riss und Bastion auch. Gegner laufen durch ihre Mitte.
- Debug-Hindernisse sind Trümmer (`kind: 'rubble'`). Diese Grafik nutzt M2 für die nicht gewählten Kapseln weiter. Das Entfernen per Debug löscht das ganze Hindernisobjekt, also bei Mauerresten alle Felder.
- Tiefensortierung: Objekte auf einem Feld nach `x + y + 1`, Gegner nach `x + y`. Der seitliche Versatz der Gegner in der Kolonne ist rein optisch und hängt an der Gegner-ID.
