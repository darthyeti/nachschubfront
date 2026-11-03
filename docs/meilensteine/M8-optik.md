# M8: Optik

Status: **abgenommen am 03.11.2026** (Akte E-16; die Prüfung auf dem iPad holt Till nach). Freigegeben am 02.11.2026 (E-08), umgesetzt in C1 bis C5b, Version 0.10.0 bis 0.10.5. Läuft parallel zu M6; M7 ruht (Entscheidung 02.11.2026, E-02).
Referenz: `reference/studien/optik-studie.html` (dieselbe Karte heute und neu, vier Bausteine schaltbar, Standbilder in `reference/konzept/optik/`). Die Trümmer-Entwürfe aus `reference/studien/truemmer-studie.html` kommen als eigener Schritt dazu, sobald Akte E-07 entschieden ist.

## Entscheidungen vom 02.11.2026

- **Alle vier Bausteine** aus der Studie (E-06): Farbtrennung, Licht und Schatten, Blockgelände, Diorama-Rahmen. Reihenfolge der Umsetzung: Farbe, Licht, Gelände, Rahmen, jeder Baustein ein eigener Pull Request mit Vorschau, jeder nach Tills Blick gemergt.
- **Das Gelände folgt dem Seed, nie dem Weg.** Der Spieler ändert den Weg jede Runde; die Route läuft über die Stufen, Gegner nehmen eine Stufe wie eine Bordsteinkante, an Kreuzungen liegt ein Erdkeil als Rampe.
- **Der Weg ist eine Spur, keine gefärbte Kachel.** Sie wächst mit jedem Gegner, der sie geht, und verblasst auf verlassenen Abschnitten.
- **Drei Biome** (Asche, Rost, Gift), je Partie aus dem Seed, nie innerhalb einer Karte. Vorgabe bei gleichem Seed ist für alle gleich.
- **Die Simulation wird nicht angefasst.** Keine Zahl in `src/data` ändert sich, `RULESET_VERSION` bleibt, `tests/unit/golden.json` bleibt, jedes Protokoll spielt sich unverändert nach. Alles in M8 ist Darstellung und Eingabe.

## Berührte Bereiche und Dateien

| Bereich | Dateien | Art der Änderung |
| --- | --- | --- |
| Render | `src/render/iso.js`, `ground.js`, `backdrop.js`, `objects.js`, `scene.js`, `draw.js`, `palette.js`, `towerSprites.js`, `enemySprites.js`, `pods.js`, `effects.js`, `koloss.js`, `gunship.js`, `sprites/rasterizer.js`, neu `terrain.js`, `biomes.js`, `trail.js`, `shadows.js` | Paletten je Biom, Höhenfeld, Schatten, Spur, Rahmen, Zeichnen auf Feldhöhe |
| Kapsel (C5b) | `reference/konzept/kapsel/` (neue Konzept-SVGs), `src/render/sprites/` (erzeugt, `npm run sprites`), `src/render/pods.js`, `effects.js` | neue Kapsel nach Entwurf B, Landung, Auswahl |
| Input | `src/render/camera.js` (`screenToCell`), `src/main.js` | Treffer auf Feldhöhe |
| Daten | `src/data/settings.js` oder neu `src/data/art.js` | die Zahlen der Studie als benannte Konstanten, keine Spielregel |
| Werkzeuge | `tests/perf.mjs`, `tests/screenshots.mjs`, `tests/sprites.js` | Messung mit Gelände, Standbilder je Biom, Galerie mit Schatten |
| Dokumentation | `docs/ART.md` (neuer Abschnitt „Gelände, Licht und Biome“), `docs/PROGRESS.md` | siehe unten |

Geteilte Quellen, die dieser Auftrag ändert: **docs/ART.md**. Nicht geändert werden **src/sim**, **src/core**, **docs/GDD.md** und die Balancing-Zahlen in **src/data**. Die Zahlen der Darstellung (Höhenstufe, Schattenversatz, Deckkräfte) sind keine Spielregeln; sie stehen trotzdem an einer Stelle und nicht verstreut im Zeichencode.

## Ziel

Die Karte liest sich auf einen Blick: Boden, Weg, Trümmer, Stellungen und die Anker (Bastion, Riss, Signalfeuer) sind an Farbe und Form zu trennen. Das Gelände hat Volumen, ein Licht gibt allem Schlagschatten in dieselbe Richtung, die Platte steht als Diorama im Raum. Das Spiel bleibt bei 60 fps mit 200 Gegnern auf dem iPad.

## Verbindlich und nicht verbindlich in der Studie

Verbindlich: die vier Bausteine und ihr Zusammenspiel, die Lichtrichtung, die drei Paletten, drei Höhenstufen zu 12 px, der Weg als Spur, die Rampe an Stufen, das Verhalten der Gegner an einer Stufe, der Rahmen mit Grundplatte.
Nicht verbindlich: der Zeichencode der Studie (sie überschreibt die Palette `C` und unterdrückt Schatten über einen Proxy, das Spiel braucht saubere Parameter), die Silhouettenschatten pro Bild (im Spiel gerastert), das Höhenfeld-Rauschen im Einzelnen (die Zahlen `NOISE_CELLS` 11 und `LEVEL_CUTS` [0,4, 0,66] sind Startwerte), die Knöpfe „Stufen“, „Weg umleiten“ und der Schieberegler (Werkzeuge der Studie).

## Anforderungen

### C1 Farbtrennung und Biome (erster Pull Request)

- Drei Paletten mit denselben Schlüsseln (`ground[3]`, `cliff[3]`, `stone[3]`, `decor`, `slab[2]`, `pit`, `path`, `pathEdge`), Startwerte aus `PALETTES` in der Studie. Sie liegen in einem Modul `src/render/biomes.js`; `src/render/palette.js` bleibt die Palette der Figuren.
- Das Biom einer Partie kommt aus dem Seed: `seedFromString(seed) % 3` oder ein eigener `fork('biome')`, der **keinen bestehenden Strom verschiebt** (Karte `fork('map')`, Kapseln `fork('pods')`, Risse `fork('rifts')` bleiben bitgleich; ein Unit-Test belegt es). Der Standardmodus und King of the Hill nutzen dieselbe Zuordnung.
- Die Zeichenfunktionen der Hindernisse und des Bodens lesen ihre Farben aus der übergebenen Palette, nicht aus `C`: `drawObstacleCell(ctx, obstacle, index, palette)`, Boden und Platte aus `createGroundLayer` mit Palette. Bastion bleibt ziegelrot, Riss warp-violett, Signalfeuer wie heute.
- Jede Stellung bekommt ein Fundament: eine Rautenplatte knapp innerhalb des Feldes in der Leitfarbe ihrer Doktrin (`DOCTRINE_COLORS`), Deckkraft 0,35, Tuschekontur, im Bodendurchgang vor den Figuren gezeichnet. Rezept-Stellungen behalten den Goldring, der liegt über dem Fundament.
- Der Weg als Spur (`src/render/trail.js`): entlang `groundPolyline` der aktuellen Route drei versetzte Streifen (Breiten 0,55, 0,42, 0,28 Felder, ausgefranste Ränder, ohne Kontur, Farbe `path` des Bioms), Deckkraft je Abschnitt gleich der Abnutzung. Abnutzung wächst um 0,04 je Gegner, der den Abschnitt passiert, und sinkt um 0,02 je Sekunde auf Abschnitten, die nicht mehr zur Route gehören; Startwert 0 in einer neuen Partie. Die Abnutzung ist Darstellungszustand (lebt neben `ui`, nicht in `state`), sie wird nicht gespeichert und nicht aufgezeichnet. Mit der Spur entfällt die heutige gestrichelte Goldroute **nicht**: Sie bleibt die Vorschau in der Planung (ART.md), die Spur ist, was die Gegner hinterlassen.
- Flache Karte in diesem Schritt; die Spur wird in C3 auf Feldhöhe gehoben.

### C2 Licht und Schatten (zweiter Pull Request)

- Eine Lichtrichtung für alles: ein Körper der Höhe h px wirft seinen Schatten um `(0,55, 0,25) · h / 32` Felder nach +x/+y. Konstante an einer Stelle (`LIGHT`).
- Klötze (Hindernisse, Bastion, Signalfeuer, Bollwerk): Schattenpolygon aus Grundfläche und verschobener Deckfläche, `rgba(10,6,4,.38)`, ohne Kontur, **im Bodendurchgang vor allen Figuren**, damit nie ein Schatten auf einem Nachbarn liegt. Fußkanten-Verschattung 4 px, Deckkraft 0,3, und eine helle Kante (Knochenweiß, 0,3, 1,5 px) an der linken oberen Kante jeder Deckfläche.
- Sprites (Stellungen, Gegner, Kapseln): die Silhouette als Schatten, geschert und auf 45 Prozent gestaucht, Deckkraft 0,35. **Gerastert, nicht pro Bild:** `sprites/rasterizer.js` hält je Eintrag neben `canvas` und `flash` eine dritte Variante `shadow` (schwarz gefüllt). `tests/perf.mjs` prüft weiter, dass im Betrieb nichts gerastert wird.
- Die Ellipsenschatten (`shadow` in `draw.js`) entfallen für alles, was einen Silhouettenschatten hat. Koloss und Gunship (drehbare Modelle) bekommen einen Schlagschatten aus ihrer Grundfläche, keine Silhouette.
- `prefers-reduced-motion` ändert hier nichts; Schatten bewegen sich nur mit der Figur.

### C3 Blockgelände (dritter Pull Request)

- Höhenfeld in `src/render/terrain.js`: Wertrauschen auf einem Raster von `NOISE_CELLS` Feldern, geglättet interpoliert, quantisiert auf drei Stufen (0, 1, 2 mal `STEP` 12 px), dazu der Mehrheitsfilter der Studie gegen Einzelzacken. Zufall aus `createRng('terrain:' + seed)` oder einem Fork, der keinen Spielstrom verschiebt. Krater liegen eine Stufe tiefer. Riss, Bastion und Signalfeuer behalten ihr Feld, ihre Höhe ist die des Feldes.
- Die Route kreuzt Stufen. Gegner stehen auf der Höhe ihres Feldes, an Feldgrenzen über je 0,25 Feld linear überblendet; Flieger behalten ihre Flughöhe über dem Boden der Stufe 0. Wo die Route eine Stufe kreuzt, zeichnet das Gelände auf dem tieferen Feld einen Erdkeil (0,6 breit, 0,65 Auslauf, Wegfarbe, ohne Kontur nach oben).
- Alles, was auf einem Feld steht, wird um dessen Höhe gehoben: Hindernisse, Stellungen, Kapseln samt Zielmarke und Hologramm, Gegner, Koloss, Gunship-Ziel, Marker (Landezonen, Abriss, Bollwerk, Aufwertung, Rezept-Vorschau, Fluglinie, Routenvorschau), Effekte am Boden und darüber, Schadenszahlen, Spur. Der Tiefenschlüssel bleibt `x + y`; das Gelände liegt vollständig im Cache unter allen Figuren.
- Boden-Cache (`ground.js`) zeichnet das Gelände mit Klippen (Seitenflächen nur, wo der Nachbar in +x oder +y tiefer liegt, mit Schichtlinien), die Schlagschatten der Klippen und die Spur; Neubau nur bei Seed, Zoom (wie heute) und geänderter, quantisierter Abnutzung, höchstens alle 350 ms. `mapBounds` bekommt oben Luft für zwei Stufen.
- **Treffer auf Feldhöhe:** `screenToCell` prüft die Stufen von oben nach unten (2, 1, 0) und nimmt das erste Feld, dessen Raute auf seiner Höhe den Punkt enthält. Sonst landet ein Tipp auf einem hohen Feld auf dem Nachbarn dahinter. Unit-Test mit einer Karte, die alle drei Stufen hat; `npm run test:input` in Chromium und WebKit.
- Die Fluglinie und die Routenvorschau der Planung folgen der Höhe wie die Spur.

### C4 Diorama-Rahmen (vierter Pull Request)

- Unter der Erdplatte (Tiefe 30 wie heute) eine Stahlgrundplatte, 14 px dick, 0,8 Felder Überstand, dunkler Stahl mit vier Nieten an den Ecken und einem schmalen Rostband; darunter ein weicher Tischschatten.
- Kulisse: `HORIZON` von 0,26 auf 0,40, ein schwarzer Schleier 0,32 über dem Himmel, Vignette 0,82 statt 0,62. Die Parallaxe bleibt.
- Der Start-Ausschnitt (`fitCamera`) rechnet die Grundplatte mit ein, damit sie auf dem Tablet nicht abgeschnitten ist.

### C5 Trümmer-Entwürfe (fünfter Pull Request, nach Akte E-07)

- Übernahme der gewählten Varianten aus `reference/studien/truemmer-studie.html` in `src/render/objects.js`: Baukasten statt vier fester Formen je Art, Seed je Feldposition (`x`, `y`, `variant`), damit nicht jede Instanz einer Variante gleich aussieht. Kapsel-Trümmer und Krater füllen die Raute ihres Feldes.
- `variant` in `src/sim/mapgen.js` bleibt 0 bis 3 und unverändert gezogen (sonst verschiebt sich der Kartenstrom); der Renderer bildet daraus und aus der Feldposition die Baukasten-Variante.
- Was Till in E-07 streicht oder ändert, steht hier, bevor der Schritt beginnt.

### C5b Kapsel (nach Akte E-12)

Version 0.10.5 (C5 bleibt 0.10.4). Entwurf B aus `reference/studien/kapsel-studie.html` (schlank, Bremsturm, Landestützen) wird die neue Kapsel.

- **Sprites:** Neue Konzept-SVGs in `reference/konzept/kapsel/`, aus dem Zeichencode der Studie erzeugt (wie `tests/tools/study-to-svg.mjs` es für die Stellungen tut), danach `npm run sprites` (erzeugt `src/render/sprites/`, nicht von Hand ändern).
- **Landung** nach der Studie in `src/render/pods.js` und `effects.js`: Hitzeschleier, Druckwelle, Brocken, Brandfleck, die Segmente öffnen nacheinander, Rauch, der sich ausbreitet, aufhellt und nach etwa 3,5 s verflogen ist, Partikel mit Obergrenze. Die Zeiten in `src/data/pods.js` bleiben (Simulation); was nur Darstellung ist, wird eine benannte Konstante im Render. `golden.json` und `RULESET_VERSION` bleiben.
- **Auswahl:** Eckwinkel-Rahmen, angehobene Klappen, hellerer Kern. Die Kapsel bleibt von einer Stellung unterscheidbar und deckt geöffnet keine Nachbarn zu.
- **Beobachtungen aus der Studie:** Die Kapsel tritt früher aus dem Feuerball; die Lichtsäule färbt die Kapsel nicht ein.

### C6 Leistung und Geräte

- 60 fps mit 200 Gegnern und laufenden Effekten (`npm run test:perf`, Standard und King of the Hill), davor und danach gemessen, Zahlen im Pull Request. Obergrenzen: ein Boden-Cache von höchstens 12 Megapixeln, keine Rasterung im Betrieb, Silhouettenschatten aus dem Cache.
- Auf dem iPad von Till geprüft: Zoomstufen, Tippen auf hohe Felder, Lesbarkeit der Spur in der Übersicht. Das ist Teil der Abnahme jedes Schritts.

## Tests und Abnahme

- `npm test` grün in jedem Schritt; **`golden.json` und `RULESET_VERSION` unverändert** (das ist die Prüfung, dass die Simulation nicht angefasst wurde). `npm run replay` auf 4RCC95 und 7EJY6Y bleibt Feld für Feld gleich.
- Neue Unit-Tests: Biom-Zuordnung stabil über Versionen (feste Seeds, feste Biome), kein verschobener Spielstrom, Höhenfeld deterministisch und mit dem Mehrheitsfilter, `screenToCell` auf Feldhöhe, Abnutzung der Spur (wächst, verblasst, Umleitung).
- `npm run test:input` in Chromium und WebKit nach C3, `npm run test:perf` nach jedem Schritt, `npm run screenshots` je Biom (`?seed=` mit drei Seeds, die die drei Biome treffen) für die Standbilder im Pull Request.
- Jeder Schritt ein Pull Request mit Label `spielgefuehl`; Till schaut die Vorschau an und gibt im Board frei. Nach dem Merge steigt die Version: 0.10.0 mit C1, danach 0.10.1 bis 0.10.4 (C4 ist 0.10.3, C5b 0.10.5).
- Abnahme von M8 insgesamt: Till spielt eine Partie unter 0.10.4 auf dem iPad, das Protokoll spielt sich nach, und die Fragen aus C6 sind beantwortet.

## Offene Punkte (nicht Teil des Auftrags, bitte im Bericht erwähnen)

- Die Spur ist in der Übersicht (Zoom 0,73) schwächer als eine gefärbte Kachel. Wenn sie dort nicht trägt, ist ein dunkler Saum oder eine höhere Startabnutzung der nächste Hebel, keine Kachelfärbung.
- Im Gift-Biom liegen Boden und Trümmer im Ton nah beieinander; die Paletten sind Startwerte.
- Die Kulisse (`backdrop.js`) und die Höhen der Studie passen zum Standardmodus; King of the Hill mit Bastion in der Mitte braucht eine eigene Prüfung des Rahmens, wenn der Modus wieder aufgenommen wird.
- Ein Bollwerk auf einem hohen Feld und der Koloss, der durch Stufen fährt, sind in der Studie nicht gezeigt; der Koloss bleibt auf Feldhöhe wie ein Gegner, die Stufe ist für ihn eine Bordsteinkante.

## Überschneidungen mit offenen Aufträgen

- **M6** ändert Zahlen in `src/data` und `tests/tools/wave-rules.mjs`, M8 nicht. Berührt sich nirgends; beide Zweige können parallel gemergt werden.
- **A-09 (Rezeptfolgen im Codex)** ändert `src/ui/codex.js` und `strings.js`, M8 nicht.
- **King of the Hill** ruht; M8 zeichnet seine Karte mit, ohne Regel zu ändern.
