# Nachschubfront: Grafikleitfaden

Verbindliche Gestaltungsregeln für alle Figuren. Die Konzeptskizzen liegen als SVG in `reference/konzept/` und sind die Grafikquelle für das Spiel.

## Grundregeln

- **Silhouette vor Detail.** Jede Figur muss als reiner Schatten eindeutig erkennbar sein, auch auf der kleinsten Zoomstufe.
- **Comicstil wie im Stiltest.** Dunkle Tuschekonturen (#1a1410), zwei bis drei harte Schattierungsstufen, keine weichen Verläufe auf Figuren. Leuchten nur über halbtransparente Flächen.
- **Blickrichtung.** Gegner sind nach links gezeichnet. Im Spiel werden sie je nach Laufrichtung horizontal gespiegelt. Keine acht Richtungen.

## Stellungen

- Alle Stellungen stehen auf demselben Betonsockel mit Warnstreifen (`sockel.svg`). Er grenzt eigene Bauwerke klar von Trümmern ab.
- Jede Doktrin hat eine eigene Grundform und eine Leitfarbe, die auch im Kapsel-Hologramm verwendet wird:

| Doktrin | Grundform | Leitfarbe |
|---|---|---|
| Flamme | Gedrungener Bunker, rote Tanks, Düse nach vorn | #ff8a2a |
| Autokanone | Drehkanone mit drei Läufen, Sandsackring, Munitionskasten | #f0e2b8 |
| Laser | Schlanker Mast, schwenkbare Strahlkanone mit Energiezellen | #ff4a4a |
| Mörser | Flache Grube, steiles Rohr, Granatkiste | #d8ae5f |
| Psi | Gotischer Schrein, schwebender Kristall mit Ringen | #b784ff |
| Tesla | Kupferspule mit Kugel, Blitze | #5fd4ff |

### Spezialstellungen

Die sechs Rezept-Stellungen (GDD Abschnitt 8) haben noch keine Konzeptgrafik. Bis dahin (M4) zeichnet das Spiel sie als Sprite der erstgenannten Zutat im Legendenrang, dazu ein goldener Bodenring und ein Halo in der Leitfarbe. Sie brauchen jeweils eine eigene Silhouette, die sich auf der kleinsten Zoomstufe von den sechs Grundformen unterscheidet.

### Ränge

Jeder Rang ergänzt ein sichtbares Detail, kumulativ:

| Rang | Ergänzung | Winkel am Sockel |
|---|---|---|
| Rekrut | Grundform | 1 |
| Veteran | Sandsackring | 2 |
| Elite | Panzerplatten an der Waffe | 3 |
| Held | Banner | 4 |
| Legende | Goldkanten, Halo | 5 (gold) |

Die Winkel sitzen auf der linken Vorderseite des Sockels.

## Gegner: insektoide Brut

Eigenständige Schwarmkreaturen aus Chitin, Klingen und Fleisch. Stimmungsvorbild sind Arachniden und Schwarmbrut aus dem Science-Fiction-Genre, aber keine Nachbildung geschützter Designs.

Grundpalette: Chitin #3e3026 / #5f4a38 / #7a6048, Knochenkanten #d8c9a8, Fleisch #8a2e26, Augen #e0a030.

Die Rüstungsart muss auf einen Blick lesbar sein:

| Rüstungsart | Erkennungsmerkmal |
|---|---|
| Fleisch | Sichtbares rotes Fleisch zwischen den Platten |
| Panzer | Schwerer, gewölbter Plattenpanzer in Rostbraun (#553626) mit Knochengraten |
| Warp-Schild | Violett glühende Adern (#9a6ae0), gestrichelte Schildblase |
| Flieger | Flügel, schwebt deutlich über dem eigenen Schatten |

Sonderfähigkeiten sind sichtbar: Brut im Säuresack des Zerplatzers (#8fbf3a), leuchtende Nährblasen und Bodenaura beim Heiler (#9ccf4a).

| Datei | Gegner |
|---|---|
| schwaermer.svg | Schwärmer |
| krieger.svg | Krieger |
| brecher.svg | Brecher |
| warp-seher.svg | Warp-Seher |
| aasflieger.svg | Aasflieger |
| zerplatzer.svg | Zerplatzer |
| heiler.svg | Heiler |

## Technische Umsetzung

- **SVG als Quelle, Canvas als Ausgabe.** Die SVGs werden beim Start einmal in Offscreen-Canvas gerastert und danach nur noch per `drawImage` gezeichnet. Kein SVG-Zeichnen pro Frame.
- **Rasterstufen nach Zoom.** Pro Figur werden wenige Auflösungsstufen vorgehalten (etwa 0,5x, 1x, 2x mal devicePixelRatio) und die passende gewählt, damit beim Zoomen nichts unscharf wird.
- **Statische Teile als Sprite, Bewegung im Code.** Sockel, Gehäuse, Körper, Köpfe und Klingen kommen aus dem SVG. Was sich bewegt, wird wie im Stiltest per Code gezeichnet: drehende Läufe, schwenkende Waffen, Flammen, Blitze, Insektenbeine im Laufzyklus, Flügelschlag.
- Dafür werden die SVGs in Teile zerlegt (z. B. `krieger-koerper`, `krieger-klinge`) und jeweils mit Ankerpunkt versehen. Die Zerlegung ist Teil von M1b.
- Treffer-Aufblitzen über eine vorgerenderte helle Variante des Sprites, nicht über Filter pro Frame.
