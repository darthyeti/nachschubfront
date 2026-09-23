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

Die sechs Rezept-Stellungen (GDD Abschnitt 8) haben seit M4 eine eigene Silhouette. Sie stehen auf demselben Sockel, tragen die Goldkante (sie sind die Spitze der Entwicklung, haben aber keinen Rang und darum keine Winkel) und stehen im Spiel in einem goldenen Bodenring. Die Leitfarbe bleibt die der erstgenannten Zutat.

| Spezialstellung | Grundform | Bewegliches Teil |
|---|---|---|
| Reinigungsschrein | Weite Feuerschale auf gestuftem Podest, Düsenkranz am Rand | — |
| Sturmbatterie | Drei gefächerte Läufe auf einer Drehtrommel | Läufe drehen zum Ziel |
| Glutkessel | Gedrungener Kessel auf drei Beinen, Bügel darüber | — |
| Belagerungsmörser | Riesenrohr auf einer Räderlafette | Rohr neigt sich zum Ziel |
| Gewitterturm | Gitterpylon mit Stabkrone | — |
| Seelenfeuer-Obelisk | Verjüngender Monolith mit Schädelnische und Warp-Splittern | — |

Gezeichnet werden sie von `tests/tools/add-specials.py`; die Blätter liegen wie die handgezeichneten in `reference/konzept/stellungen/`.

### Ränge

Jeder Rang ergänzt ein sichtbares Detail, kumulativ:

| Rang | Ergänzung | Winkel am Sockel | Umsetzung |
|---|---|---|---|
| Rekrut | Grundform | 1 | — |
| Veteran | Sandsackring | 2 | Symbole `sb-back`/`sb-front`; Autokanone und Mörser haben den Ring schon und bekommen stattdessen eine Munitionskiste (`crate`, `crate-l`) |
| Elite | Panzerplatten an der Waffe | 3 | erzeugtes SVG quer zum Lauf, auf einem Drittel des Wegs zur Mündung; wo die Waffe nicht zielt (Psi, Tesla) sitzt die Platte am Gehäuse |
| Held | Banner | 4 | im Code gezeichnet, weht in der Leitfarbe mit Goldsaum |
| Legende | Goldkanten, Halo | 5 (gold) | Goldkante am Sockelrand als SVG, Halo im Code |

Die Winkel sitzen auf der linken Vorderseite des Sockels. Abweichung: Die Goldkante der Legende läuft am Sockel entlang, nicht an der Figur — ein Umriss pro Doktrin wäre für jede Waffe eine eigene Zeichnung.

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

### Bosse

Die fünf Bosse (GDD Abschnitt 9) haben seit M4 eine eigene Figur (`tests/tools/add-bosses.py`). Der Faktor in `src/data/enemies.js` bezieht sich jetzt auf diese eigene Zeichnung und ist so gewählt, dass jeder Boss so groß bleibt wie vorher mit der geliehenen Figur. Das Feld `sprite` sagt weiter, mit wem der Boss verwandt ist; davon hängt die Größe seines Bodenschattens ab.

| Boss | Verwandt mit | Größe | Silhouette |
|---|---|---|---|
| Brutmutter | Zerplatzer | 1,8x | Aufgeblähter grüner Brutleib mit Brutblasen, Kranz aus sechs Beinen |
| Kolossbrecher | Brecher | 1,9x | Türmender Plattenpanzer mit Knochengraten, breiter Rammschild vorn |
| Warp-Herold | Warp-Seher | 2,0x | Drei gestrichelte Schildblasen, Warp-Risse, Robe und Knochenkrone |
| Schwarmkönigin | Aasflieger | 1,55x | Zwei Flügelpaare, gegliederter Hinterleib mit Legestachel |
| Dämonenprinz | Krieger | 2,0x | Hörnerkrone, Schulterpanzer, Umhang, geschwungene Klinge |

Der Dämonenprinz wechselt im Kampf alle vier Sekunden die Rüstungsart. Sichtbar ist das seit M4 an einem Ring auf dem Boden und einem Schild auf seinem Leib, beides in der Farbe der gerade getragenen Rüstung (Fleisch #c23a2a, Panzer #a4502a, Warp-Schild #9a6ae0); beim Wechsel läuft ein Ring nach außen.

## Technische Umsetzung

- **SVG als Quelle, Canvas als Ausgabe.** Die SVGs werden beim Start einmal in Offscreen-Canvas gerastert und danach nur noch per `drawImage` gezeichnet. Kein SVG-Zeichnen pro Frame.
- **Rasterstufen nach Zoom.** Pro Figur werden wenige Auflösungsstufen vorgehalten (etwa 0,5x, 1x, 2x mal devicePixelRatio) und die passende gewählt, damit beim Zoomen nichts unscharf wird.
- **Statische Teile als Sprite, Bewegung im Code.** Sockel, Gehäuse, Körper, Köpfe und Klingen kommen aus dem SVG. Was sich bewegt, wird wie im Stiltest per Code gezeichnet: schwenkende Waffen, Flammen, Blitze, Insektenbeine im Laufzyklus, Flügelschlag.
- Die Zerlegung ist in M4 passiert (`tests/tools/split-towers.py` und `split-enemies.py`, beides einmalige Eingriffe in `reference/konzept/`). Die Symbolbibliothek trägt seitdem pro Figur mehrere Teile:

| Teil | Stellungen | Gegner |
|---|---|---|
| `-back` | Sockelaufbau, Mast, Tanks | Beine oder Flügel hinter dem Körper |
| `-gun` / `-body` | Waffe, dreht sich zum Ziel | Körper |
| `-front` | Sandsäcke und Kisten vor der Waffe | Beine oder Flügel vor dem Körper |

  Wo die Teile sitzen und wie sie sich bewegen (Drehpunkt, Ruhewinkel, Mündung, Ausschlag), steht in `src/render/sprites/manifest.js`. Der Warp-Seher schwebt und bleibt ein Stück.
- **Aus den SVGs entfernt und jetzt Code** (`src/render/towerFx.js`): Flammenstrahl, Mündungsbögen, Mörserrauch, das Leuchten von Laser und Tesla, die Blitze der Spule, Aura und Ringe des Psi-Schreins.
- Abweichung: Die drei Läufe der Autokanone bleiben ein Teil. Ihre Drehung wird über Rückstoß und ein leichtes Wandern quer zur Achse angedeutet, statt jeden Lauf einzeln zu bewegen.
- Treffer-Aufblitzen über eine vorgerenderte helle Variante des Sprites, nicht über Filter pro Frame.
