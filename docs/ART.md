# Nachschubfront: Grafikleitfaden

Verbindliche Gestaltungsregeln für alle Figuren. Die Konzeptskizzen liegen als SVG in `reference/konzept/` und sind die Grafikquelle für das Spiel.

Für Bunker, Aufsätze, Spezialstellungen, Koloss und Gunship sind seit v5 die beiden interaktiven Studien in `reference/studien/` die verbindliche Vorlage. Sie laufen direkt im Browser und enthalten den vollständigen Zeichencode. Maße, Farben und Formen dort übernehmen, nicht nachempfinden. Die PNGs in `reference/konzept/stellungen/` und `reference/konzept/koloss/` sind Standbilder daraus.

- `stellungen-simulation.html`: Bunker mit allen Rängen, sechs Standard-Aufsätze, Spezialbasis, sechs Spezialwaffen inklusive Effekten.
- `koloss-studie.html`: Koloss, Zielvorhersage, Durchbruch, Bollwerk-Stopp, Luftschlag mit Gunship, alle vier Fahrtrichtungen.
- `optik-studie.html`: dieselbe Karte heute (echte Spielmodule) und neu (Licht und Schlagschatten, Farbtrennung, Blockgelände, Diorama-Rahmen, drei Biome), Bausteine einzeln schaltbar, Vergleich mit ziehbarer Trennlinie; Standbilder in `reference/konzept/optik/`. Entscheidungsgrundlage für M8, noch keine Regel.
- `truemmer-studie.html`: Entwurf für Ruinen, Mauern, Krater und Kapsel-Trümmer (Baukasten, acht Varianten je Art) neben den heutigen Hindernissen und dem Bollwerk. Der Baukasten ist seit M8 C5 im Spiel (`src/render/rubbleKit.js`); die Studie bleibt als Entwurfsblatt.
- `kapsel-studie.html`: Rework der Nachschubkapsel (Auftrag A-14): die Landung als Schleife mit Zeitregler und Zeitlupe (Glühen, Bremstriebwerke, Druckwelle, Trümmer, Rauch und Staub, die verfliegen, Sprengbolzen, Klappen) und der Auswahlmodus, heute mit den echten Spielfunktionen neben drei Entwürfen (A schwer, B schlank, C Segmente); Standbilder `studie-*.png` in `reference/konzept/kapsel/`. Entwurf B ist seit M8 C5b die Kapsel im Spiel (`reference/konzept/kapsel/kapsel.svg` wird aus dieser Studie erzeugt, `npm run studies`); die Studie bleibt als Entwurfsblatt, ihre Schaltfläche „Heute“ zeigt jetzt die neue Kapsel.
- `stellungen-rework.html` (mit `stellungen-rework-modell.js`): Entwurf zum Rework der Stellungen (Auftrag A-19, noch keine Regel): kleinerer Bunker im Stil der neuen Kapsel (facettierte Betonplatte, Stahlkanten, Nieten, Gefahrenband, Licht aus C2), Ränge ohne Sandsäcke nur über Zierrat und Farbe, alle sechs Aufsätze als drehbare Modelle mit Tiefensortierung je Fläche, eigene Gehäuse für Autokanone (breit, flach) und Laser (schmal, hoch), Mündungsfeuer am Laufende, Raketenwerfer als Variante des Mörsers; schaltbar zwischen Drehbar, Hybrid mit 16 vorgerenderten Stufen und nur Stufen, dazu Silhouette, Zoom, Biom, 30 Stellungen und „Heute“; Standbilder `rework-*.png` in `reference/konzept/stellungen/`.
- `handy-bedienung.html` (mit `handy-bedienung.js`): Studie zu HUD, Menüs und Tutorial auf dem Handy (Auftrag A-23, noch keine Regel): schmale, einklappbare Statusleiste, Werkzeuge und Salve im Daumenbereich (quer an den Rändern), Menüs und Kapselwahl als Blätter von unten bzw. von rechts, neuer Ikonensatz neben den heutigen, Tutorial der ersten zwei Runden durchklickbar, Bestandsaufnahme mit Messwerten; Standbilder `heute-*.jpg`, `neu-vergleich-*.png`, `neu-ikonen.png` und Messwerte `bestand.json` in `reference/konzept/handy/`, Werkzeuge `tests/tools/handy-bestand.mjs` und `handy-studie.mjs`.
- `spezialstellungen-rework.html` (mit `spezialstellungen-rework-modell.js`, baut auf `stellungen-rework-modell.js` auf): Entwurf zum Rework der sechs Spezialstellungen (Auftrag A-21, noch keine Regel): Spezialbasis im Kapselstil auf genau einem Feld, höher als der Standardbunker, auf vier schrägen Stahlstützen, Goldkanten und drei Lampen in den Farben der Rezeptzutaten, ohne Sandsäcke; alle sechs Spezialwaffen als drehbare Modelle mit Mündungspunkt (Spur und Hülsen der Sturmbatterie, Blitze vom Kessel, Zielfernrohr-Laser und Granate des Belagerungsmörsers, Kettenblitz vom Gewitterturm, Seelenstrahl aus der Pupille des Obelisken, Goldaura des Schreins); schaltbar zwischen Drehbar und Hybrid mit 16 Stufen (schwebende Teile als eigene Ebene), dazu Silhouette, Zoom, Biom, „Heute“, „Mit Standard“ und ziehbares Ziel; Standbilder `spezial-*.png` in `reference/konzept/stellungen/`.

Stand: v5 (Bunker-Baukasten mit allen fünf Rängen, überarbeitete Aufsätze aller sechs Doktrinen, Spezialbasis und neue Rollen der Spezialwaffen, Koloss und Gunship als drehbare Modelle).

## Grundregeln

- **Silhouette vor Detail.** Jede Figur muss als reiner Schatten eindeutig erkennbar sein, auch auf der kleinsten Zoomstufe.
- **Comicstil wie im Stiltest.** Dunkle Tuschekonturen (#1a1410), zwei bis drei harte Schattierungsstufen, keine weichen Verläufe auf Figuren. Leuchten nur über halbtransparente Flächen.
- **Blickrichtung.** Gegner sind nach links gezeichnet. Im Spiel werden sie je nach Laufrichtung horizontal gespiegelt. Keine acht Richtungen.

## Stellungen

**Der Bunker ist seit v5 die gemeinsame Grundform aller sechs Doktrinen.** Der niedrige Betonbunker aus Tills Skizzen ersetzt die sechs Einzelformen aus v4: Grundfläche genau ein Feld, erhöhte Dachplatte in der Mitte, zwei dunkle Schießscharten, je eine pro sichtbarer Seite. Unterschieden werden die Doktrinen über den **Aufsatz auf der Dachplatte**, die Leitfarbe und den Effekt. Damit fällt der frühere Sonderfall weg, dass Flamme und Autokanone sich einen Bunker teilen, die vier übrigen aber eigene Bauformen haben.

Der eigene Betonsockel mit Warnstreifen (`sockel.svg`) entfällt: Der Bunker ist sein eigener Sockel und grenzt eigene Bauwerke ebenso klar von Trümmern ab.

**Aufsätze.** Sie sitzen auf der Dachplatte, Grundskalierung 0,95. Die Leitfarbe wird auch im Kapsel-Hologramm verwendet:

| Doktrin | Aufsatz | Leitfarbe |
|---|---|---|
| Autokanone | Drehlauf-Gehäuse, verkleinert (Faktor 0,78) | #f0e2b8 |
| Flamme | Tankgehäuse mit Brennrohr, verkleinert (Faktor 0,78) | #ff8a2a |
| Mörser | Steiles Rohr auf Lafette, unverändert | #d8ae5f |
| Tesla | Kleine Zylindersäule | #5fd4ff |
| Laser | Kleine Scheibe mit kurzem Lauf | #ff4a4a |
| Psi | Zwei Ringe, dazu eine **dauerhafte** gestrichelte violette Aura in Reichweitengröße auf dem Boden | #b784ff |

Damit ist der offene Punkt „Waffenaufsätze der sechs Basisdoktrinen optisch überarbeiten" erledigt.

Referenz: `reference/konzept/stellungen/standard-rang1.png`, `standard-rang3.png`, `standard-rang5.png` und die Studie im Modus „Standard".

### Spezialstellungen

Die sechs Rezept-Stellungen (GDD Abschnitt 8) stehen seit v5 auf einer **gemeinsamen Spezialbasis**. Die Fahrgestell-Fassung aus v2 und die sechs eigenständigen Bauwerke aus v4 sind damit beide verworfen: Der sichtbare Unterschied zu einer Standard-Stellung entsteht über die Höhe, nicht über die Form.

**Spezialbasis.** Seit 0.11.10 (M9 D4) der Bunker der Kapsel-Studie `spezialstellungen-rework.html` im Stil der Standardbunker, hoch (Dachplatte 52 mal 0,74 Weltpixel, `SPECIAL_ROOF_HEIGHT`), auf vier schrägen Stahlstützen, Goldkanten, Gefahrenband, zwei Schießscharten. Der **Korpus hat exakt die Grundfläche eines Standardbunkers**, nur die Stützen ragen optisch über die Feldgrenze hinaus (reine Grafik ohne Kollision). Die Basis ist statisch und ein SVG **je Rezept** (`specialbase-<rezept>` in `reference/konzept/stellungen/spezialbasis.svg`, erzeugt mit `npm run studies`): Leitfarbe der ersten Zutat an Rand, Platten und Lampe, dazu drei Lampen in den Farben der drei Zutaten. Die Waffe steht auf der Luke; der goldene Bodenring bleibt.

**Waffen und Wirkungsanker.** Die sechs Waffen sind seit 0.11.10 drehbare Modelle (`src/render/specials.js`, Maße der Studie, Zahlen in `src/data/art.js`), die sich wie die Aufsätze der Standardstellungen zum Ziel drehen (Abschnitt „Aufsätze als drehbare Modelle“). Jede hat einen Mündungspunkt im Modell, von dem Schuss, Blitz, Strahl oder Aura ausgehen; die Simulation rechnet weiter mit der Feldmitte.

| Spezialstellung | Waffe | Effekt und Mündungspunkt |
|---|---|---|
| Reinigungsschrein | Vier Säulen mit Dach, dazwischen schwebt ein goldenes Artefakt mit Halo und drei Funken (Abweichung der Studie, angenommen: vier Säulen statt zwei mit Bogen, damit er aus jeder Richtung gleich aussieht). Wird immer pro Bild gezeichnet | Goldener Schein am Artefakt; dauerhafte goldene Aura am Boden mit zwölf Runen, dunkel im Leerlauf, hell solange er arbeitet (`auraLevel`). Gegner in der Aura leuchten golden |
| Sturmbatterie | Gewölbtes Gehäuse, zwei Luken, 2 x 2 Läufe, jeder gleitet einzeln zurück | Die vier Läufe feuern reihum: blauer Mündungsblitz, Leuchtspur zu einem der getroffenen Ziele, Hülse aus dem Auswurf hinten am Gehäuse |
| Glutkessel | Schwarzer Kessel auf drei Beinen, vier Elektroden am Rand | Flammen in der Öffnung (Code), Feuerblitze von der vorderen Elektrode zu jedem getroffenen Ziel; Übersprung weiter als Glutbogen (`emberJump`) |
| Belagerungsmörser | Keilförmige Lafette, langes Rohr auf 50 Grad mit Rückstoß, Zielfernrohr | Rote Laserlinie vom Fernrohr zum Ziel über die letzten `FX_SIGHT_SECONDS` der Nachladung, dann schwere Granate in hohem Bogen (Flugzeit und Ziel vom Geschoss der Simulation) und Explosion |
| Gewitterturm | Sockel, Spule aus sieben blauen Ringen; darüber schwebt ein geneigter violetter Ring mit blauer Kugel (eigene Ebene über der Stufe) | Kettenblitz von der Kugel von Ziel zu Ziel, über allem gezeichnet |
| Seelenfeuer-Obelisk | Schlanker Obelisk mit violetten Runen, Flammen am Fuß (Code); darüber schwebt das Auge (eigene Ebene) | Das Auge lädt sich über die letzten `FX_OBELISK_CHARGE_SECONDS` der Nachladung, dann Seelenstrahl aus der Pupille zum Ziel |

Stufen-Cache wie bei den Standardstellungen (16 Richtungen, bei Bedarf), Ausnahmen: der Schrein ist nie auf einer Stufe, Sturmbatterie und Mörser werden gezeichnet, solange ein Lauf zurückgleitet, und die schwebenden Teile (Ring und Kugel, Auge) kommen jedes Bild aus dem Modell; der Schatten der Stufe enthält sie trotzdem. Höhe höchstens 10 Prozent über dem früheren Sprite (`tests/unit/specials.test.js` misst es). Die Sprite-Köpfe der v5 (`stop-*`) sind aus der Bibliothek entfernt.

Referenz: `reference/konzept/stellungen/d4-feuer.png` (die Waffen im Spiel feuernd), `d4-16-richtungen.png` (Kontaktbild in 16 Richtungen, erzeugt mit `node tests/tools/special-sheet.mjs 2 out.png`), `spezialstellungen.png` und die Studie im Modus „Spezial“. Die Blätter in `reference/konzept/spezialstellungen/` bleiben als Entwurfsstand v4 liegen.

**Der Reinigungsschrein bleibt eine Aura.** In M5c blieb es aus Balancing-Gründen bei der Aura um den Schrein selbst (Entscheidung vom 25.09.2026), v5 entscheidet dauerhaft für die Aura in Gold ohne Mörserrohr.

### Ränge

Die Rangstufen bauen aufeinander auf, jede Stufe behält alles der vorherigen. Sie sitzen am Bunker selbst. Seit 0.11.0 (M9, D1) ist das der neue Bunker der Studie `stellungen-rework.html` im Stil der Kapsel (facettierte Betonplatte, Stahlkanten, Nieten, Gefahrenband, zwei Schießscharten, achteckige Dachplatte), auf 74 % der ersten Fassung verkleinert (`BUNKER_BASE_SCALE` in `src/data/art.js`). **Sandsäcke gibt es nicht mehr**; die Ränge sind Zierrat und Farbe am Bunker:

| Rang | Zierrat und Farbe |
|---|---|
| 1 Rekrut | schlicht, nur die Doktrinlampe auf der Dachecke |
| 2 Veteran | kräftiger Rand in der Doktrinfarbe (das Band reicht tiefer an der Wand herunter als bei den höheren Rängen, damit der Rang bei kleinstem Zoom von Rang 3 zu unterscheiden bleibt), Stahlschutz an der Nahecke, ein Winkel |
| 3 Elite | dunkle Platten mit Doktrinzeichen neben den Schießscharten, Dachplatte in der Doktrinfarbe, zwei Winkel |
| 4 Held | Zinnen, Totenkopf-Plakette, Antenne, drei Winkel |
| 5 Legende | Goldkanten und Goldnieten, zweite Antenne, vier goldene Winkel |

Die Doktrinfarbe (`DOCTRINE_COLORS`) steckt in der Zeichnung (Rand, Winkel, Zeichen, Dachplatte, Lampe), und ein SVG kennt keinen Farbparameter. Deshalb gibt es **einen Bunker je Doktrin und Rang**: 30 Symbole `bunker-<doktrin>-<rang>` in `reference/konzept/stellungen/bunker-raenge.svg`. Gerastert wird nur, was im Spiel vorkommt; kein Filter pro Bild. Die Lampe leuchtet mit zwei flachen, halbtransparenten Scheiben, weil die Aufnahme des Exports keine Verläufe kennt. Das Fundament in der Doktrinfarbe (M8, C1) bleibt, ebenso der Silhouettenschatten (M8, C2) und das Treffer-Aufblitzen über die helle Variante.

Der Aufsatz steht auf der Dachplatte in Höhe `BUNKER_ROOF_HEIGHT` (28 mal 0,74 Weltpixel) und richtet sich seit 0.11.2 zum Ziel aus (Abschnitt „Aufsätze als drehbare Modelle“ unten). Die Spezialstellungen stehen auf der Spezialbasis (Abschnitt „Spezialstellungen“). Das Standbild des Zustands: `reference/konzept/stellungen/d1-raenge-1x.png` und `d1-raenge-klein.png` (alle Doktrinen mal alle Ränge im Spiel bei Zoom 0,95 und 0,4, erzeugt mit `node tests/tools/rank-sheet.mjs`).

Referenz der Studie: `reference/konzept/stellungen/rework-raenge.png`; die Spezialbasis zeigt `bunker-raenge-und-spezialbasis.png` (die Bunker darauf sind die der ersten Fassung).

**Keine Fahne mehr beim Held.** Das wehende Banner aus v2 war auf Tablet-Größe nicht erkennbar und ist durch die Zinnen und den Totenkopf ersetzt. Der Rang ist am Bunker selbst abzulesen, nicht an einer Markierung darunter. Die Spezialstellungen haben wie bisher keinen Rang und tragen nur die Goldkanten.

#### Rangabzeichen im Auswahldialog

Eine Reihe kurzer waagerechter Striche in der Leitfarbe der Doktrin, direkt neben dem Rangnamen. Rekrut keinen Strich, Veteran einen, Elite zwei, Held drei, Legende vier — die vier der Legende in Gold statt in der Doktrinfarbe. Kein Rahmen, keine leeren Plätze: Die Striche stehen frei neben dem Text.

Das ersetzt die sechseckige Plakette mit vier Sternplätzen aus v2 (Update v3). Die Striche entstehen im Code, weil sie zu einfach für eine Zeichnung sind; das erzeugte Modul `src/render/sprites/badges.js` und das einmalige Werkzeug `tests/tools/fit-badges.py` sind damit weg. Die Blätter `reference/konzept/ui/rangabzeichen-*.svg` bleiben als Entwurfsstand liegen, werden aber nicht mehr importiert.

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

## Nachschubkapsel

Seit M8 C5b (Version 0.10.5) ist **Entwurf B der Kapsel-Studie** die Nachschubkapsel: schlank, mit Bremsturm auf dem Dach und Landestützen am Hitzeschild. Quelle ist der Zeichencode von `reference/studien/kapsel-studie.js`; `npm run studies` führt ihn über den Rekorder (`tests/tools/canvas-to-svg.mjs`) aus und schreibt `reference/konzept/kapsel/kapsel.svg`, `npm run sprites` macht daraus `src/render/sprites/pods.js`. Die Blätter der ersten Kapsel (Kegelstumpf, M4c) liegen in `reference/konzept/kapsel/historie/` und werden nicht mehr eingelesen. Maße, Farben und Formen aus der Studie übernehmen, nicht nachempfinden.

### Teile

| Sprite | Inhalt |
|---|---|
| `pod-shell` | die ganze geschlossene Kapsel: Hitzeschild mit zwei Landestützen, vier Wandsegmente mit Fugen, Kern, Düsenkranz und Dach |
| `pod-base` | der Hitzeschild allein; er bleibt unter den Segmenten liegen |
| `pod-core` | der stehende Kern mit Kragen, Bremsdüsen und Dach |
| `pod-petal-0` bis `-3` | je ein Wandsegment, flach liegend, in der Reihenfolge der Studie nummeriert |

Alles ist farbneutral und kalt gezeichnet. Code bleiben: das Leuchten im Kern (drei Lichtringe, Halo, Dachlicht), die Lichtsäule, das Hologramm, die Positionslampen am Kragen (sie blinken), der Glühschein des Hitzeschilds und alles, was sich bewegt. Die Anker (Scharniere der Segmente, Düsen, Lampen, Ringhöhen) druckt `npm run studies` als „Anker der Kapsel“; sie stehen in `src/render/sprites/manifest.js` (`POD_PETALS`, `POD_ANCHORS`).

### Größe

- Geschlossen **0,8 Weltpixel je SVG-Einheit** (`SPRITE_SCALE.pod`): rund 54 px breit mit den Stützen, etwa 67 px hoch. Das ist so breit wie die Kapsel vor 0.10.5 und höher; bis zu sechs Kapseln auf Nachbarfeldern verdecken einander weiter nicht.
- **Geöffnet 15 Prozent kleiner** (`POD_OPEN_SCALE` 0,85): die liegenden Segmente reichen etwa 41 px weit und decken damit keine Nachbarstellung zu. Beim Aufbrechen wächst die Gruppe aus Schild, Kern und Segmenten von der geschlossenen auf die offene Größe, während die Hülle verblasst.
- Unterscheidbar von einer Stellung: Stellungen sind ein Rautenbunker mit Aufsatz, die Kapsel ein schlanker, nach oben verjüngter Turm auf rundem Schild mit Stützen; geöffnet ein dünner Kern auf flachen Platten. Prüfen in `tests/sprites.html` (Silhouette bei 0,5x).

### Ablauf

Alle Zeiten der Simulation bleiben (`src/data/pods.js`: Warnung 0,5 s, Fall 1,15 s, Öffnen ab 0,9 s nach dem Einschlag, Hologramm ab 1,55 s). Was darum herum geschieht, ist Darstellung; die Zahlen stehen in `src/render/podTiming.js`, `pods.js` und `effects.js`, nicht in den Daten.

1. **Zielmarke**, wie bisher.
2. **Fall:** erst gleichförmig, dann bremst er (`podHeight`, 72 Prozent freier Flug). Um die Kapsel ein **Hitzeschleier** aus drei durchscheinenden Schichten mit **Schweif**, Funkenstreifen und glühendem Bug unter dem Schild. Im letzten Drittel brennen die zwei **Bremsdüsen** auf dem Turm, bis kurz (0,14 s) nach dem Aufsetzen. Schatten als wachsende Ellipse.
3. **Aufschlag:** weißglühender Blitz am Boden und **Feuerball hinter der Kapsel** (kurz, 0,2 bis 0,4 s, im Bodendurchgang gezeichnet, damit die Kapsel früh aus dem Feuer tritt), **zwei Druckwellen-Ringe** auf Feldhöhe (Radius bis 170 und 118 px, mit blassem Fülllicht), ein Kranz Staub, Rauchwolken, **Erde und Brocken** (springen, prallen ab, bleiben liegen), Funken, der Schriftzug beim ersten Einschlag, Bildschütteln und Blitz über das Bild (beides mit `prefers-reduced-motion` gedämpft oder aus). Zurück bleibt ein **Brandfleck** mit Rissen, die glühen, solange der Boden abkühlt.
4. **Sprengbolzen** 0,54 s nach dem Aufsetzen: Funken, Bolzen, ein Dampfstoß an jeder Naht. Die Hülle glüht nach (2,8 s).
5. **Segmente** brechen ab 0,9 s nacheinander auf (Reihenfolge der Studie: ein Segment, dann das gegenüber). Jedes wächst aus seinem Scharnier und **schlägt mit Staub und zwei Brocken auf**, wenn es liegt. Das Leuchten im Kern geht an, sobald die Segmente unten sind. **Dampf aus dem Dach**, sechs Stöße.
6. **Hologramm** ab 1,55 s. Die **Lichtsäule steht hinter der Kapsel**: sie wird mit der Kapsel gezeichnet (nicht mehr über allem), färbt die Figur also nicht ein. Das Schild (der „Wimpel“) mit Rang bleibt darüber; Maße und Auswahl siehe „Auswahl“.

### Rauch

Rauch, Staub und Dampf sind Partikel mit Lebensdauer. Sie **breiten sich aus** (schnelles Wachsen, das abbremst), **hellen auf** (die Farbe läuft von dunkel nach hell: Ruß, Staub, Dampf haben je eine eigene Rampe) und **werden durchsichtig**; die Deckkraft fällt gegen 0. **Nach 3,5 s (`SMOKE_SECONDS`) ist alles verflogen**: keine Wolke darf länger leben, und eine Verzögerung zählt mit. Obergrenzen: 520 Partikel insgesamt, davon höchstens 240 Wolken (`MAX_PUFFS`); eine Salve von sechs liegt bei etwa 230. Brocken und Funken zählen nur zur Gesamtgrenze. Ein Unit-Test (`tests/unit/pod-landing.test.js`) hält die 3,5 s und die Grenze fest.

### Auswahl

- **Eckwinkel-Rahmen auf der Zelle**, auf Feldhöhe, als Überlagerung nach den Figuren (`drawPodFrame`, ersetzt den Ring `drawPodHighlight`): die gewählte Kapsel mit goldenen Winkeln in den Ecken der Raute, leichtem Puls und blassem Fülllicht, die übrigen mit gestricheltem Rahmen. Mit `prefers-reduced-motion` ohne Puls und ohne laufende Striche.
- **Die gewählte Kapsel hebt ihre Klappen** (6 SVG-Einheiten, 5 Prozent größer), der **Kern leuchtet heller** (Ringe, Halo, heller Überzug) und die **Lichtsäule ist kräftiger** (drei Schichten, aufsteigende Funken). Das Heben geht weich (`FOCUS_EASE`), nicht in einem Bild.
- **Wimpel (Version 0.11.6, Issue 50).** Zahlen in `POD_PLATE` und `POD_DIM_ALPHA` (`src/data/art.js`). Der Wimpel einer ruhenden Kapsel ist ein kleines Sechseck (Faktor 0,85 des Schilds von v3, rund 25 px breit mit Kontur) in der Doktrinfarbe mit Rangwinkeln, **ohne Namen**, und hängt 84 px über dem Fuß der Kapsel (vorher 120 px plus bis zu 54 px Staffelung; die geschlossene Hülle ist 67 px hoch, der Wimpel sitzt also dicht darüber). Zwei Kapseln auf Nachbarfeldern stehen auf dem Bildschirm mindestens 32 px auseinander, die Wimpel sind schmaler, überdecken sich also nie; die Staffelung nach Feld (`hologramLift`) ist entfallen. Der Wimpel der **gewählten** Kapsel wächst auf Faktor 1,35 (Sechseck rund 38 px breit), steigt auf 108 px, bekommt einen goldenen Doppelring in Tusche, einen goldenen Zeiger zur Kapsel und trägt über sich **Namen und Rang**; das geht weich (`FOCUS_EASE`). Solange eine Kapsel gewählt ist, haben **alle übrigen Kapseln samt Lichtsäule und Wimpel nur 50 Prozent Deckkraft** (`POD_DIM_ALPHA`); die Doktrinfarbe des Wimpels bleibt lesbar. Der Eckwinkel-Rahmen der gewählten Kapsel ist dicker (Gold 5, Tusche 10), reicht bis zur Mitte der Kanten, pulsiert über die Zellkante hinaus und füllt kräftiger; der gestrichelte Rahmen der übrigen ist schwächer. Ohne gewählte Kapsel (Landung, vor der Auswahl) tragen alle nur das kleine Sechseck; die Namen stehen im Auswahlfeld.
- Die Zwei-Tipp-Regel der Auswahl bleibt unverändert; die Eingabe ist nicht angefasst.
- **Rezepte im Kapselblatt (M10 E1):** Unter den Aktionen steht ein Knopf „Rezepte“ mit dem Rezepte-Zeichen (mindestens 44 px hoch), der das Rezeptblatt öffnet; es liegt über dem Kapselblatt, die Wahl bleibt, wie sie war.
- **Rezeptblatt, Hinweise (0.11.13):** Zwischen Einleitung und Kartenliste stehen zwei kurze Absätze mit goldener Randlinie, „Was ein Rezept kostet“ und „Wann es sich lohnt“ (`.codex-notes`, zwei Spalten ab etwa 500 px, sonst untereinander). Texte in `STRINGS.codex`, Inhalt nur aus den Regeln (GDD 8, `applySelection`).

### Farbe im Kern und Leuchten

Kern-Leuchten, Lichtsäule und Hologramm tragen die Leitfarbe der Doktrin und bleiben deshalb Code, nicht Sprite. Die Sprites selbst sind farbneutral.

## Koloss

Die späte Bedrohung aus GDD Abschnitt 9. Eine monströse Kriegsmaschine, kein Insekt: Der Koloss ist das einzige Gegenstück auf dem Feld, das gebaut und nicht gezüchtet wirkt. Eigenständiger Entwurf nach Tills Skizze, keine Anlehnung an geschützte Vorlagen, Name weiterhin „Koloss".

**Aufbau:**

- Zwei Ketten mit je sechs Laufrollen. Die Rollen drehen sich mit der Fahrt und sind nur auf der sichtbaren Kettenseite gezeichnet.
- Rumpf mit schrägem Bug, rostfarbenes Band an den Seiten, Knochendornen oben, zwei Seitengeschütze pro Seite.
- Räumschild mit fünf Knochenzähnen vorn — das Teil, mit dem er die Schneise schlägt, muss sichtbar sein, damit der Durchbruch nicht aus dem Nichts kommt.
- Turm mit zwei roten Augen, Hauptgeschütz mit Rückstoß, vier schräg nach oben zeigende Flakrohre, Antenne hinten mit roter Spitze und Funken.

**Größe:** Skalierung 1,3 Felder, also optisch etwa 1,7 Felder breit. Die Schneise bleibt trotzdem 1 Feld breit (GDD Abschnitt 9). Sortierwert in der Tiefensortierung: seine Mitte plus 0,4.

**Anzeigen:**

- Lebensbalken über dem Modell, mit einer Markierung bei 70 %. Die Markierung zeigt, wie viel ein einzelner Luftschlag höchstens abziehen kann.
- Beim Treffer blitzt das Modell kurz hell auf.

**Effekte:**

- Beim Fahren wackelt das Modell leicht und wirbelt Staub hinter den Ketten auf.
- Alle 2,4 s feuert das Hauptgeschütz mit Mündungsblitz und Rauch.
- Zwischendurch geben die Flakrohre Leuchtspur-Salven nach oben ab.
- **Durchbruch:** Trümmer brechen mit Brocken, Staub und Rissen am Boden.
- **Bollwerk-Stopp:** Funkenregen und starkes Wackeln (bei reduzierter Bewegung ohne Wackeln).

Referenz: `reference/konzept/koloss/1-zielvorhersage.png`, `2-durchbruch.png`, `3-bollwerk-stoppt.png`, `modellbogen-4-richtungen.png`.

### Zielankündigung

Ersetzt den bisher wiederverwendeten goldenen Kapselring. Sichtbar ab Stufe 2 der Ankündigung (GDD Abschnitt 9):

- rote gestrichelte Fahrlinie vom Kartenrand bis zum Ende der Schneise,
- die fünf Schneisenfelder rot pulsierend,
- roter Zielring mit umlaufenden Segmenten auf dem Zielfeld,
- Textbanner in Rot mit gelbem Warnstreifen.

Bei `prefers-reduced-motion` bleibt das Pulsen erhalten, nur langsamer.

## Gunship (Luftschlag)

Massive fliegende Festung in Seitenansicht und 3D, Skalierung 1,45, Flughöhe 92 px über dem Boden, Schatten am Boden.

- **Rumpf:** Breiter Kastenrumpf mit rotem Seitenband, dunkler Seitentafel und schrägem Bug. Kanzel mit blauer Scheibe, zwei Bugkanonen, Rückenturm mit zwei Rohren.
- **Flügel:** Kurz und breit, mit Rostspitzen, darunter je zwei Behälter.
- **Heck:** Schräg abfallend statt kastig, kleine dunkle Heckklappe mit zwei Scharnieren und gelbem Warnstreifen, schmales Doppelleitwerk mit Rostspitzen.
- **Triebwerke:** Zwei runde Düsengondeln an kurzen Pylonen, nach hinten leicht verjüngt, mit zwei Ringrippen. Von hinten eine dunkle Düsenöffnung mit orangem Glühen, dahinter flackernde Flammen.
- **Bomben:** Fallen mit Beschleunigung. Einschlag mit Explosion, Schockring, Feuer- und Rauchpartikeln und Brandfleck.

Referenz: `reference/konzept/koloss/modellbogen-4-richtungen.png`, oberer Teil, und `4-luftschlag.png`.

## Bollwerk

Der Bauwerktyp aus GDD Abschnitt 10, gebaut aus einem Trümmerfeld. Es **ersetzt** das Trümmerfeld, auf dem es gebaut wird, es steht nicht darauf.

- Form wie in der Studie: Steinblock mit klarer, gerader Oberkante, zwei Stützstreben, gelbes Warnband.
- Muss von Trümmern **auf einen Blick** zu unterscheiden sein, sonst weiß der Spieler nicht, welches Feld dem Koloss standhält.
- Keine Leitfarbe, kein Rang: Es gehört keiner Doktrin und greift nicht an. Farbe aus der Geländepalette, nur die Metallteile heller, das Warnband gelb.
- Etwas höher als ein Trümmerhaufen, aber niedriger als ein Bunker, damit es die Karte nicht zustellt.

## Verhalten in der Planungsphase

Zwei Regeln, die keine Grafik sind, sondern Renderlogik.

**Rezept-Vorschau.** Sobald eine ausgewählte Kapsel ein Rezept ergeben würde, bekommen alle dafür verbrauchten bestehenden Stellungen eine pulsierende goldene Umrandung und **einen goldenen Pfeil, der von oben auf sie zeigt und langsam schwebt**. Alles andere auf der Karte — Gelände, Trümmer, unbeteiligte Stellungen — wird um **62 Prozent** abgedunkelt. Damit ist sofort erkennbar, was verloren geht.

Der Pfeil hängt am Wirkungsanker der Stellung, dem Punkt, aus dem auch ihre Waffeneffekte kommen; damit sitzt er über dem hohen Lasermast genauso richtig wie über dem flachen Bunker. Seine Größe ist in Weltpixeln konstant und wächst nicht mit der Figur, damit er auf der kleinsten Zoomstufe lesbar bleibt. Bei `prefers-reduced-motion` steht er still.

Die Werte 62 Prozent statt der früheren 40 und der Pfeil sind nach einem Test auf dem iPad gesetzt: Auf dem Tablet war der Ring um eine entfernte Stellung zu leicht zu übersehen.

**Goldener Bodenring der Rezept-Stellungen.** Zu prüfen mit `npm run ringcheck` (Rezept-Stellungen auf benachbarten Feldern, Zoom als Parameter). Der Ring liegt auf Bodenhöhe, wie der Schatten unter einer Figur, und gehört deshalb in den Bodendurchgang — gezeichnet, bevor die tiefensortierten Objekte an der Reihe sind. Er darf unter keinem Zoom und keiner Kameraposition über einem Bauwerk liegen. Bis v3 wurde er zusammen mit seiner eigenen Stellung gezeichnet und legte sich dabei über die Sockelkante der beiden Nachbarn dahinter, weil die Ellipse an den Diagonalen über den Bodenrhombus ihrer Zelle hinausragt.

**Geräumte Trümmerfelder.** Ein im Abbruchmodus geräumtes Feld behält denselben gestrichelten Goldring wie eine Zielmarkierung, nur schwächer (geringere Deckkraft), bis die Planungsphase endet oder eine Kapsel darauf landet. So findet man das freigeräumte Feld beim Anfordern der nächsten Salve wieder.

**Fluglinie.** Hat die kommende Welle Flieger, zeigt die Planung (samt Salve und Auswahl) ihre Linie: knochenweiß gepunktet über dunkler Unterlage, langsam laufend, mit einer Pfeilspitze kurz vor der Bastion. Bewusst anders als die goldene gestrichelte Bodenroute, damit beide nie verwechselt werden. Bei `prefers-reduced-motion` steht sie still. Grund (Balancing-Runde 5): Drei von sieben Partien neuer Spieler endeten in einer Fliegerwelle, die Luftabwehr stand am Labyrinth statt unter der Linie.

## HUD

Referenz: `reference/konzept/hud/hud-uebersicht.svg` zeigt alle Knöpfe im Zusammenhang. Das Blatt ist eine reine Ansichtszeichnung ohne IDs; Runenscheibe, Plattenleiste und die Symbole der Statusleiste werden im Code nachgebaut, nicht als Sprite importiert.

### Runenscheiben-Knopf

Alle Icon-Knöpfe im laufenden Spiel — Nachschub, Abriss, Bollwerk und jedes Spezialkommando — bekommen dieselbe kreisrunde Fassung: dunkler Steinkern, dünner Goldring außen, darauf zehn eingeritzte Runensymbole am Rand, darüber das eigentliche Symbol. Textknöpfe bleiben davon unberührt.

Drei Zustände, für jede Scheibe gleich:

| Zustand | Aussehen |
|---|---|
| Bereit | Normale Deckkraft |
| Abklingzeit | Dunkler Tortenausschnitt über der Scheibe, Zahl in der Mitte zeigt die verbleibenden Wellen |
| Gesperrt | Ganze Scheibe abgedunkelt, kleines Schloss-Symbol, goldenes Zahlen-Badge oben rechts nennt die Welle der Freischaltung |

**Bedienung.** Klick oder Tippen löst die Aktion aus. Langes Drücken (am Desktop: Hover) zeigt eine kurze Erklärung als Sprechblase — dieselbe Regel wie bei Stellungen und Gegnern (GDD Abschnitt 13). Das lange Drücken darf die Aktion nicht zusätzlich auslösen. Bei einer neu freigeschalteten Scheibe geht der Freischalt-Effekt los (eigener Abschnitt unten), dazu blitzt die Beschriftung einmalig auf und verschwindet von selbst; danach ist sie nur noch über langes Drücken zu erreichen.

**Beschriftung unter der Scheibe.** Wo Platz ist, steht ein kurzes Wort unter der Scheibe (Spalte „Beschriftung" in `reference/konzept/handy/neu-ikonen.png`, Texte in `STRINGS.iconLabels`), der Preis darunter. Auf der rechten Kommandoleiste nur bei mindestens 880 px Höhe; darunter bleibt der Name der Sprechblase.

**Ruf.** Eine Scheibe, die jetzt gedrückt werden sollte, trägt einen goldenen Ring am Rand und einen zweiten, der alle 1,6 Sekunden aus ihm herauswächst und verblasst (`src/ui/nudges.js`). Kein Leuchtfilter, nur Ringe; bei `prefers-reduced-motion` bleibt nur der feste Ring. Er steht nur, solange die Bedingung gilt:

- **Kommandos:** benutzbar, und in dieser Partie wurde noch kein Kommando eingesetzt. Mit dem ersten Kommando verstummt die ganze Leiste.
- **Nachschub:** in der Planung kaufbar, und es liegt mindestens das Doppelte des Preises bereit.

Grund (Balancing-Runde 5): Drei neue Spieler setzten in sieben Partien kein einziges Kommando ein und kauften Nachschub spät oder nie, obwohl beides die ganze Zeit sichtbar war.

### Untere Leiste

Von links nach rechts: Nachschub-Scheibe (Stufe als goldenes Zahlen-Badge oben rechts, Preis klein darunter), Abriss-Scheibe (Mülleimer), Bollwerk-Scheibe, mittig der große goldene Hauptknopf „Salve anfordern" mit kleinem Kapsel-Symbol — er bleibt bewusst größer und mit Text, weil er die zentrale Handlung jeder Runde ist —, rechts Pause und Tempo als zwei kleinere Scheiben (60 px). Pause ist ein Knopf für sich, damit sie mitten in einer Welle sofort erreichbar ist; sie leuchtet golden, solange das Spiel steht. Der Tempo-Knopf schaltet reihum 1x, 2x, 3x, zeigt die Stufe als ein, zwei oder drei Dreiecke und schreibt sie klein darunter. Die Tasten Leertaste, 1, 2, 3 bleiben.

Der Zonenzähler steht auf dem Salve-Knopf, nicht mehr in der Statusleiste. Die Rang-Wahrscheinlichkeiten des Nachschubs stehen in der Sprechblase seiner Scheibe, nicht mehr als Balkenreihe auf dem Knopf.

### Rechte Kommandoleiste

Eigene senkrechte Leiste am rechten Bildschirmrand, ausschließlich Runenscheiben ohne Text. Die Reihenfolge von oben nach unten ist die Freischalt-Reihenfolge (Orbitalschlag, Stasisfeld, Priorisierter Nachschub, Heiliges Banner, Luftschlag). Zustände wie oben. Scrollbar wird sie nur auf Bildschirmen unter 700 px Höhe: Eine scrollbare Leiste schneidet alles ab, was über ihren Rand ragt — die Sprechblase links und den Ruf-Ring —, und bekam für den Ring allein Scrollbalken.

**Scheibengröße:** 72 px (seit Runde 5, vorher 58 px) — auf dem Tablet waren die Scheiben auf einen Blick zu klein.

**Erklärung beim ersten Erscheinen.** Taucht die Leiste zum ersten Mal auf, hält das Spiel an und eine bildschirmfüllende Meldung im Rahmen der Menüs erklärt sie: Symbol des Orbitalschlags, Überschrift „Kommandos", drei Absätze (was Kommandos sind, woher die Punkte kommen, wie man eines einsetzt), ein Knopf „OK". Einmal pro Gerät (`commandIntroSeen` in den Einstellungen), in den Einstellungen unter „Hinweise" wieder einschaltbar (`src/ui/intro.js`). Mit `?debug` erscheint sie nur zusammen mit `&intro`, damit die Browser-Prüfungen nicht an ihr hängen bleiben.

### Obere Statusleiste

Durchgehende Metallplatte statt einzelner schwarzer Kästchen, die Werte in kleinen Abschnitten mit Nietentrennern. Von links: Spieltitel, Welle (Insektenkopf, „aktuelle/gesamt"), Bastion-Leben (Herz; die Zahl färbt sich bei kritischem Stand orange und rot). Rechts: Nachschubstufe (Kiste mit Pfeil), Requisition (Münzstapel), Kommandopunkte (Blitz im Sechseck), Routenlänge (Weg vom Riss zur Bastion). Die Kommandopunkte stehen erst, wenn die Welle des ersten Kommandos erreicht ist (oder Punkte da sind), und erscheinen mit dem Freischalt-Effekt. Ganz rechts der Plattenknopf für das Menü; die Rezepte liegen im Pausenmenü und im Kapselblatt (Taste R bleibt). Das Menü gehört zur Verwaltung, nicht zur Handlung der Runde, und darum nicht in die untere Leiste.

Was **nicht** dauerhaft in der Leiste steht: Seed und Phase (beide im Pausenmenü), der Zonenzähler (auf dem Salve-Knopf), Sieg und Niederlage (eigener Bildschirm), die Koloss-Ankündigung (situative Einblendung, solange ein Lauf angekündigt ist).

Bei sechs Feldern wird die Leiste auf dem Tablet-Querformat eng. Kommen weitere Werte dazu, gehören sie eher ins Pausenmenü als dauerhaft auf den Bildschirm.

### HUD auf dem Handy (M10 E2, seit 0.11.7)

Gilt auf einem Touch-Bildschirm, der schmal (bis 600 px) oder niedrig (bis 500 px) ist (`PHONE_QUERY` in `src/ui/phone.js`, derselbe Wortlaut in `style.css`). Tablet (1180 x 820) und Desktop erfüllen keine der beiden Hälften und behalten ihr Layout.

- **Statusleiste:** eine schmale Zeile mit vier Werten (Welle, Leben, Requisition, Weg) und dem Menüknopf rechts. Titel und Nachschubstufe entfallen (die Stufe steht als Zahl auf der Nachschub-Scheibe); Kommandopunkte, Riss-Platte und Koloss-Platte kommen dazu, wenn sie da sind, und brechen in eine zweite Zeile um. Ein Griff am unteren Rand (Ikone „fold", 64 x 44 px Trefferfläche) klappt die Leiste ein: dann bleibt nur der Menüknopf, der Griff wandert in die linke obere Ecke. Das Menü ist bei 360 px immer erreichbar. Eingeklappt oder offen: Der Zustand wird gemerkt (`statusFolded` in den Einstellungen, seit 0.11.11) und gilt beim nächsten Start. Im Querformat hat die Leiste keinen Hintergrund, die Platten schweben über der Karte.
- **Hochformat:** unten eine Leiste mit Werkzeugen (50 px), Salve (68 px) und Pause und Tempo (46 px), ohne Beschriftung unter den Scheiben. Die Kommandoleiste liegt als Spalte am rechten Rand über der unteren Leiste (46 px). Sprechblasen der Scheiben stehen als Streifen über der unteren Leiste, nicht neben der Scheibe.
- **Querformat:** Werkzeuge in einer Spalte am linken Rand, Salve über Pause und Tempo am rechten Rand, die Kommandoleiste als Reihe unter der Statusleiste am rechten Rand. Die Einstellung „Linkshänder“ (`leftHanded`, Pausenmenü, Einstellungen) vertauscht die beiden Ränder; im Hochformat ändert sie nichts.
- **Blätter statt Fenster:** Menüs (außer Titel und Ende), Rezepte, Symbolblatt, Stellungs-Info und Kapselwahl kommen im Hochformat von unten, im Querformat von rechts (bis 480 px, die Kapselwahl und die Info bis 320 px). Oben im Blatt sitzen Griff und Kreuz (je mindestens 44 x 44 px, `src/ui/sheet.js`), beide schließen; sie bleiben beim Blättern stehen. Die Kapselwahl hat keinen Schließen-Knopf, sie muss beantwortet werden; während sie offen ist, ruht die untere Leiste. **Pause bleibt trotzdem erreichbar** (seit 0.11.11): Das Blatt trägt einen eigenen Pausenknopf (`.selection-pause`, 56 x 44 px, golden, solange das Spiel steht), im Hochformat neben „Rezepte“ am Fuß des Blatts, im Querformat im freien Band oben im Blatt links vom Menüknopf der Statusleiste. Auf dem Tablet und am PC bleibt die untere Leiste mit ihrer Pause-Scheibe während der Kapselwahl sichtbar und bedienbar, dort gibt es den zweiten Knopf nicht. Im Querformat bleibt das obere Band des Blatts frei für den Menüknopf.
- **Titel- und Endbildschirm bleiben ganzseitig** (Entscheidung Till, E-29): Sie sind Fenster über der ganzen Fläche mit mittigem Panel, keine Blätter, ohne Griff und Kreuz; es gibt von dort nichts zurückzugehen. Die Handy-Prüfung hält das fest (kein `.sheet-head`, Überlagerung deckt das Bild).
- **Einzug der Kamera:** Solange Kapselwahl oder Info offen sind, rückt die Kamera die Mitte in den freien Teil (`shiftForCover`), und bei der Kapselwahl wird zusätzlich das Rechteck um alle Kapseln in den freien Teil gerückt und nötigenfalls verkleinert (`focusRect`, `src/ui/cover.js`). Beim Schließen kehrt die Ansicht zurück, wenn der Spieler sie nicht selbst verschoben hat. Reine Darstellung.
- **Safe-Area** (`env(safe-area-inset-*)`) an allen Rändern; Versionsnummer im Pausenmenü statt in der Ecke.

### Ikonensatz (M10 E1)

Der Satz folgt der Studie `reference/studien/handy-bedienung.js` (`ICON_ROWS`, Blatt `reference/konzept/handy/neu-ikonen.png`) und gilt auf PC, Tablet und Handy; im Spiel stehen alle Zeilen; „Leiste einklappen" (Pfeil nach unten, im Spiel nach oben gedreht) gehört zum Handy-Layout. Die Zeichen stehen in `src/ui/icons.js`, Tuschekontur, flache Flächen, 24 x 24. Es sind Dinge, die man benennen kann, keine Zeichen, die man lernen muss: Welle ist der Insektenkopf (die Fahne sagte „Ziel"), Leben das Herz, Requisition ein Münzstapel, Kommandopunkte ein Blitz im Sechseck, Nachschub eine Kiste mit Pfeil nach oben, Abriss der Vorschlaghammer auf Schutt, Bollwerk eine Mauer mit Zinnen, Aufwerten eine Stellung mit Pfeil, Salve die fallende Kapsel mit Feuerschweif, Rezepte drei Zutaten auf dem goldenen Ergebnis, Pause zwei Balken, Tempo ein, zwei oder drei Dreiecke, Hilfe ein goldenes Fragezeichen, Stasisfeld ein Eiskristall mit hellem Kern, Priorisierter Nachschub eine Kapsel mit goldenem Stern. Orbitalschlag, Heiliges Banner, Luftschlag und das Schloss bleiben wie sie waren.

### Symbolblatt

Der „?"-Knopf unten links (48 px, goldener Ring, Hilfe-Zeichen) und der Menüpunkt „Symbole erklären" öffnen ein Blatt in der Mitte des Bildschirms: Zeile für Zeile Scheibe mit Symbol, Name und ein Satz, in vier Gruppen (obere Leiste, untere Leiste, Kommandos mit Preis, Freischaltwelle und Pause, Menü und Hilfe), zwei Spalten, auf schmalen Bildschirmen eine. Es löst die Sprechblasen ab, die einander auf kleinen Bildschirmen verdeckten. Das Blatt hält das Spiel nicht an; ein Tipp daneben, das Kreuz (44 x 44 px) und Escape schließen es. Es liegt über den Menüs (`src/ui/help.js`, Zeilen als reine Funktion `sheetSections`). Auf dem Handy ist es ein Blatt (siehe „HUD auf dem Handy"), der „?"-Knopf entfällt dort, das Menü hat „Symbole erklären".

### Freischalt-Effekt

Wenn die Kommandopunkte oder ein Kommando freigeschaltet werden, kommt ihr Symbol nicht einfach hinzu: Es gibt einen Knall (`src/ui/burst.js`, Look in `.burst` in `style.css`).

| Zeit | Was |
|---|---|
| 0 bis 0,4 s | Aufblitzen: weißgelber Verlauf, der auf das 1,1fache anschwillt und verlischt |
| ab 0 s | Druckwelle: zwei Ringe (hell, dann golden, 0,12 s später), die auf das 3,6fache der Scheibe wachsen und ausblenden (0,85 s) |
| 0 bis 1,8 s | Nachleuchten: goldener Verlauf um das Symbol, der langsam verlischt |

Dazu der Ton `unlock` (tiefer Schlag, Rauschen, steigender Klang, kurze Glocke; `src/data/audio.js`). Erkannt wird das am Zustand, nicht an einer Meldung der Simulation: Die Kommandopunkte kommen, wenn `pointsVisible` wahr wird (Welle des ersten Kommandos erreicht oder Punkte da), eine Scheibe, wenn ihr `commandStatus` von gesperrt auf frei wechselt (`newlyUnlocked`). Der erste Blick auf den Zustand setzt nur den Ausgangswert, eine weit fortgeschrittene Partie knallt also beim Laden nicht. Ein Kommando, das freigeschaltet wird, solange die Leiste noch nicht steht, knallt, sobald sie erscheint. Nur Verläufe und halbtransparente Formen, kein `shadowBlur`, kein Filter; die Ebene lässt jeden Tipp durch. Bei `prefers-reduced-motion` gedämpft: keine Ringe, nichts wächst, nur ein weiches Aufleuchten und das Nachleuchten; Bildschirmwackeln gibt es ohnehin nicht.

### Einweisung (M10 E3, seit 0.11.11)

Geführte Anleitung über die ersten zwei Runden, auf allen Geräten (`src/ui/tutorial.js`, Texte in `STRINGS.tutorial`). Je Schritt ist **ein** Element hervorgehoben: ein goldener, leise pulsierender Rahmen (bei `prefers-reduced-motion` ruhig), der Rest des Bildes ist abgedunkelt (0,62 Schwarz) und nimmt keine Tipps an. Die Sperre besteht aus vier Platten um den Ausschnitt; im Ausschnitt gelangt der Tipp zum Knopf oder zur Karte darunter. Eine Karte mit „Schritt n von 14“, der Runde, einem Satz und einem Knopf „Überspringen“ (mindestens 44 x 44 px) sitzt neben dem Ausschnitt, nie darauf; hängt der Ausschnitt an einem Blatt (Kapselwahl), bleibt die Karte vom ganzen Blatt weg (Hochformat darüber, Querformat daneben). Schritte ohne Handlung haben „Weiter“, der letzte „Verstanden“; Schritte mit Handlung sagen rechts auf der Karte, was zu tippen ist.

| Nr. | Runde | Hervorgehoben | Weiter, wenn |
|---|---|---|---|
| 1 | 1 | nichts (ganzes Bild abgedunkelt) | „Weiter“ |
| 2 | 1 | Wegplatte oben (Länge des Wegs) | „Weiter“ |
| 3 | 1 | ein Feld auf dem Weg, das ihn verlängert | Feld markiert |
| 4 | 1 | Salve | Phase verlässt die Planung |
| 5 | 1 | Kapselliste | eine Kapsel angetippt |
| 6 | 1 | „Behalten“ | Kapselwahl beendet |
| 7 | 1 | Tempo-Knopf (nur während Welle 1) | Tempo 2x oder 3x |
| 8 | 2 | Requisitionsplatte | „Weiter“ |
| 9 | 2 | Nachschub-Scheibe, **nur wenn die Requisition reicht** | Stufe gestiegen |
| 10 | 2 | wieder ein Feld auf dem Weg | Feld markiert |
| 11 | 2 | Salve | Phase verlässt die Planung |
| 12 | 2 | die Kapsel eines gleichen Paars (×2), sonst die Liste | Kapsel angetippt |
| 13 | 2 | „Verschmelzen“, sonst „Behalten“ | Kapselwahl beendet |
| 14 | 2 | Menüknopf, erst **nach** Welle 2 | „Verstanden“ |

Gegenüber der Studie (13 Schritte) ist Schritt 9 neu (Kauf in Runde 2, Entscheidung E-21). Weil die Kapseln aus dem geseedeten Zufall kommen und die Einweisung nichts an der Simulation ändert, gibt es zwei Ausweichen: Reicht die Requisition nach Welle 1 nicht für Nachschub (eine Welle mit Durchbrüchen), entfällt Schritt 9; enthält die Salve in Runde 2 kein gleiches Paar, sagen die Schritte 12 und 13 „wähle eine, behalte sie“. Schritt 14 wartet bis nach Welle 2, damit keine Sperre über einer laufenden Welle liegt; zwischen zwei Schritten, solange die Kapseln fallen oder die Welle läuft, ist nichts abgedunkelt.

Das gewählte Feld (3 und 10) ist eine freie Wegzelle, deren Markierung die Wegzahl wachsen lässt, fern von Riss und Bastion und außerhalb von Leisten und Kommandoleiste (`pickSpot`). Auf dem Handy ist ein Feld kleiner als ein Finger; jeder Tipp, der durch den Ausschnitt kommt, zählt darum für dieses Feld.

**Zustand statt Meldung:** Die Einweisung liest jedes Bild nur den Spielzustand (Phase, Welle, markierte Zonen, Stellungen, Nachschubstufe, Tempo) und das Antippen einer Kapselkarte; sie ruft nichts in der Simulation auf. Eine Partie mit Einweisung spielt sich aus ihrem Protokoll genauso nach wie ohne (`tests/unit/tutorial.test.js`). Sie läuft hinter Menüs, Symbolblatt, Rezepten und Hinweisen nicht weiter, sondern ruht, solange eine davon offen ist. Ein anderes Spiel (neue Partie) beendet sie.

Start mit dem ersten Spiel je Gerät (`tutorialSeen` in den Einstellungen, `docs/SPEICHER.md`), Überspringen und Abschluss setzen den Merker. Wiederholen: Einstellungen, „Hinweise“, „Einweisung wiederholen“; sie läuft in der nächsten Partie. Mit `?debug` startet sie nur zusammen mit `&tutorial`. Standbilder: `reference/konzept/handy/e3-*.jpg`.

## Menüs außerhalb der Partie

Fünf Bildschirme, alle mit dem Skyline-Motiv aus dem Stiltest im Hintergrund, Titel in Pirata One, Fließtext in Barlow Condensed. Referenzen: `reference/konzept/menues/hauptmenu.svg`, `seed-eingabe.svg`, `pause.svg`, `einstellungen.svg`, `ende-sieg.svg` (Niederlage ist derselbe Bildschirm, nur Titel und Farbe anders, darum kein eigenes Blatt).

**Textknopf-Fassung.** Ergänzt die Runenscheibe: rechteckige dunkle Platte mit dünnem Goldrand und kleinen Runenstrichen als Eckakzent statt vollem Ring, weil hier der Text im Vordergrund steht. Der wichtigste Knopf jedes Bildschirms ist golden hervorgehoben, alle anderen bleiben dunkel mit hellem Text.

| Bildschirm | Inhalt |
|---|---|
| Hauptmenü | Neue Partie (golden), Fortsetzen, Seed eingeben, Bestenliste, Einstellungen |
| Seed-Eingabe | Dialog über abgedunkeltem Hauptmenü: Eingabefeld für den Seed-Code, „Zufällig", „Übernehmen", darunter der Start-Knopf |
| Pause | Halbtransparent über der laufenden Partie: Fortsetzen (golden), Rezepte, Symbole erklären, Einstellungen, Partie exportieren, Partie verlassen, darunter eine kompakte Statuszeile (Welle, Leben, Requisition) zur Orientierung. Rezepte und Symbolblatt öffnen sich über dem Menü; das Menü wartet dahinter |
| Einstellungen | Regler für Musik- und Effektlautstärke, Schalter für reduzierte Bewegung, Sprachanzeige (fest Deutsch), Exportieren und Importieren des Spielstands, Zurück (golden) |
| Ende | Titel Sieg oder Niederlage, Kennzahlen (Punkte, verbleibende Leben, Abschüsse, gegebenenfalls neuer Bestwert), Nochmal (golden) und Hauptmenü |
| Modus wählen (M7a) | Nur, wenn mehr als ein Modus wählbar ist. Eine Karte je Modus als Textknopf-Platte: Name in Pirata One, ein Satz Beschreibung, Bestwert, rotes Kennzeichen „Experimentell". Die gewählte Karte bekommt einen goldenen Innenrand. Zwei Karten nebeneinander im Querformat, untereinander im Hochformat, ab fünf scrollt die Liste. Darunter „Los" (golden) und Zurück |

**Fortsetzen ohne Zwischenspeicher.** Einen Spielstand mitten im Feldzug gibt es nicht (`docs/SPEICHER.md`). „Fortsetzen" führt deshalb in die laufende Partie zurück und ist ausgegraut, solange keine läuft — also auf dem kalten Titelbildschirm (Entscheidung vom 25.09.2026).

## King of the Hill (M7b)

Derselbe Zeichenstil, nur die Geometrie ist anders (`docs/meilensteine/M7b-king-of-the-hill.md`, B8).

- **Risse:** jedes der zwei Torfelder eines Risses ist ein eigener Warp-Schlund wie im Standardmodus, etwas kleiner (0,8). Der angreifende Riss leuchtet und pulsiert, die drei übrigen glimmen nur und stehen still; bei `prefers-reduced-motion` pulsiert keiner.
- **Beschriftung:** Nord, Ost, Süd, West in der Comic-Schrift jenseits des Kartenrands, entlang dieser Kante gedreht (Nord und Süd fallen nach rechts, Ost und West steigen), damit sie nie auf der Route liegen, die nach innen führt. Der angreifende Riss trägt seinen Namen größer und in Warp-Violett, in der Planung darunter die Routenlänge in Gold.
- **Sperrzone:** schräg schraffiert in gedämpftem Rot, darunter ein leichter dunkler Schleier, Rand gestrichelt. Sie verdeckt den Boden nicht.
- **Bastion:** dieselbe Burg über 2 x 2 Felder, etwa 45 % höher, sortiert nach ihrer vorderen Ecke.
- **Statusleiste:** eine Plakette „Nord → Süd" (Riss dieser Welle, Riss der nächsten), nur bei mehreren Rissen.
- **Aufwerten:** eine vierte Runenscheibe mit drei Rangwinkeln, der oberste golden. In ihrem Modus tragen die aufwertbaren Stellungen ihren Preis wie beim Abriss.
- **Modus-Karte:** eine kleine Skizze der Geometrie neben dem Satz.

## Gelände, Licht und Biome

Auftrag und Begründung in `docs/meilensteine/M8-optik.md`, Referenz `reference/studien/optik-studie.html`. Die Zahlen stehen als benannte Konstanten in `src/render/biomes.js`, `trail.js`, `shadows.js` und `terrain.js`. Dieser Abschnitt wächst mit den Schritten von M8; bisher gelten Biome, Fundament, Spur, Licht, Blockgelände und Rahmen.

**Biome.** Eine Partie hat ein Biom (Asche, Rost, Gift), bestimmt aus dem Seed (`biomeOf`: `seedFromString(String(seed)) % 3`, Reihenfolge `ash`, `rust`, `toxic`) und nie innerhalb einer Karte gewechselt. Es ist reine Darstellung und zieht nichts aus einem Spielzufallsstrom. Eine Palette (`paletteOf`) hat Boden (3 Töne), Weg, Wegkante, Klippe (3), Stein (3), Dekor, Platte (2) und Krater. Boden, Plattenseiten, Dekor und die Hindernisse (Ruine, Mauer, Krater, Kapsel-Trümmer, Bollwerk) lesen ihre Farben daraus, nicht aus `C`; der Ziegel-Akzent bleibt `C.brick`. Bastion, Riss und Signalfeuer behalten ihre eigenen Farben, sie sind die Anker der Karte. Pfützen sind nur im Biom Gift giftgrün, sonst dunkle Flecken in der Dekorfarbe. `src/render/palette.js` bleibt die Palette der Figuren.

**Fundament.** Jede Stellung steht auf einer Raute in der Leitfarbe ihrer Doktrin, die mit `FOUNDATION_INSET` −0,1 knapp über das Feld ragt (Deckkraft 0,45, Tuschekontur 2,5 px), dazu ein 3 px breiter Rand in der Doktrinfarbe (Deckkraft 0,8) innen an der Kontur. Der Überstand ist nötig: Der Sockel füllt sein Feld bis zur Kante, ein Fundament innerhalb des Feldes verschwindet darunter. Sie liegt im Bodendurchgang vor den tiefensortierten Objekten, der goldene Bodenring der Rezept-Stellungen darüber.

**Spur.** Der Weg ist, was die Gegner hinterlassen, keine gefärbte Kachel. Je Teilstück der aktuellen Route (zwischen zwei aufeinanderfolgenden Zellen) hält `src/render/trail.js` eine Abnutzung von 0 bis 1: sie wächst, wenn ein Bodengegner (nicht Flieger, nicht Koloss) das Stück betritt, und sinkt auf Stücken, die nicht mehr zur Route gehören; unter einem Mindestwert wird das Stück vergessen. Eine Umleitung lässt die alte Spur also stehen und verblassen, die neue wächst. Die Abnutzung ist Darstellungszustand neben `ui`: nicht im Spielzustand, nicht gespeichert, nicht aufgezeichnet, in jeder neuen Partie 0. Gezeichnet werden drei versetzte, ausgefranste Streifen (seit 0.11.9 viel schmaler und unterbrochen, siehe *Filigran*) in der Wegfarbe des Bioms, ohne Kontur, im Bodendurchgang nach dem Boden und vor den Markern; der Zufall der Ränder kommt aus einem eigenen, vom Seed abgeleiteten Strom, damit Standbilder gleich bleiben. *Linie statt Stückwerk (Version 0.11.4):* Die Streifen enden nicht mehr an jedem Teilstück. `src/render/trailShape.js` (reine Geometrie) zerlegt jedes Teilstück in Stücke (ein Teilstück über eine Stufe entfällt, siehe *Keine Spur über Stufen*), kettet aufeinanderfolgende Stücke gleicher Abnutzungsstufe und gleicher Höhe zu einem Lauf und umreißt jeden Lauf als **einen** Polygonzug: an einem Knick außen ein Bogen um den Knickpunkt (Radius gleich der halben Breite dort), innen eine Gehrung (bei sehr spitzem Knick die beiden Versatzpunkte), an freien Enden eine runde Kappe. Kein Randpunkt liegt weiter von der Mittellinie als die halbe Breite plus Fransen (`TRAIL.rag`, `TRAIL.shift`); die Fransen laufen so an der ganzen Linie. Wechselt die Abnutzungsstufe an einem Knick, endet der Lauf flach und der Außenbogen wird als Keil nachgefüllt; an Gabelungen und Schnitten über Stufen enden die Läufe flach oder rund, ohne dass etwas verkettet wird, wo mehrere Stücke zusammentreffen. Der Saum ist derselbe Umriss mit `TRAIL.edge.width` mehr Halbbreite, als Ring zwischen den beiden Umrissen gefüllt (der Ring hat an flachen Enden keine Fläche); Rampenkeile gibt es nicht mehr. Die Umrisse werden nur neu gebaut, wenn sich die Abnutzungsstufe eines Teilstücks, der Seed oder das Höhenfeld ändert. Jede Lage hat außen einen dunklen Saum (`palette.pathEdge`, `TRAIL.edge`: seit 0.11.9 0,035 Feld breit, Deckkraft 0,45 mal Abnutzung), damit die Spur in der Planung unter der Goldroute lesbar bleibt; die Säume aller Lagen werden vor den Füllungen gezeichnet, die breiteren Füllungen dämpfen die inneren Säume. Die gestrichelte Goldroute der Planung bleibt die Vorschau und liegt über der Spur.

**Blockgelände.** Die Karte hat drei Höhenstufen zu `STEP` 12 px (Stufe 0, 1, 2); die Platte ist so hoch wie Stufe 0. Das Höhenfeld (`heightField(map, seed)` in `src/render/terrain.js`, ein `Uint8Array` je Feld) kommt aus dem Seed und nie aus dem Weg: Wertrauschen auf einem Raster von `NOISE_CELLS` 11 Feldern, mit Smoothstep interpoliert, auf 0 bis 1 gedehnt, bei `LEVEL_CUTS` 0,4 und 0,66 in drei Stufen geschnitten, danach dreimal der Mehrheitsfilter (ein Feld, das von seinen vier Nachbarn höchstens einen mit gleicher Stufe hat, nimmt die Mehrheit der Nachbarn; ein Streifen von einem Feld Breite, dessen beide Nachbarn auf einer Achse anders liegen, wird auf die tiefere Stufe eingeebnet), damit Plateaus als Blöcke entstehen und nicht als Treppe. Der Zufall ist `createRng('terrain:' + seed)`, ein eigener Strom, kein Spielstrom. Krater liegen eine Stufe tiefer (nie unter 0); Riss, Bastion (alle Felder), Signalfeuer und alles, was der Spieler baut, ändern das Feld nicht. Das Feld wird je Karte und Seed einmal gebaut (`WeakMap`) und ist reine Darstellung: Die Simulation rechnet weiter auf der flachen Karte, Wege, Reichweiten und Kosten bleiben, wie sie sind.

*Klippen.* Der Boden-Cache (`ground.js`) zeichnet die Felder in Feldreihenfolge (x + y aufsteigend), je Feld die Deckfläche auf `z = Höhe` (je Stufe um 9 RGB-Schritte heller), Seitenflächen nur dort, wo der Nachbar in +x oder +y tiefer liegt (links `cliff[1]`, rechts `cliff[2]`), mit zwei Schichtlinien, ein bis zwei Steinen und Tuschekontur. Auf die Deckfläche eines tieferen Feldes fällt der Schatten der höheren Nachbarn links, hinten und diagonal dahinter (`castShadows` aus `shadows.js`, Höhe gleich dem Stufenunterschied, auf die Raute des Feldes beschnitten) samt Fußkante (`footStrip`); die helle Kante liegt an der linken oberen Kante jeder Deckfläche, deren Nachbar dahinter tiefer liegt. Am Kartenrand reichen die Klippen bis auf die Platte. Der Cache wird nur bei Seed, Karte, DPR und gesetztem Zoom neu gebaut; `mapBounds` hat oben 24 px mehr Luft für zwei Stufen.

*Filigran (Version 0.11.9, Akte E-30).* Die Spur ist nur noch etwa halb so breit (`TRAIL.widths` in `src/data/art.js`: 0,26 / 0,20 / 0,13 Felder, Saum 0,035) und kein durchgehendes Band mehr: Die Stützpunkte liegen alle `TRAIL.sample` 0,25 Feld; ein Punkt trägt eine Trittspur, wenn sein Wurf (`gapOf`, eigener Strom `trail-gap:<Seed>` je Punkt, kein Zufall pro Bild) unter `base + gain * Abnutzung - cut * Lage` liegt. Einzelne Punkte entfallen, es bleiben kurze, ausgefranste Stücke (`fragmentsOf`), deren Dichte mit der Abnutzung wächst; die schmaleren Lagen sind lückenhafter. Die Spur bleibt im Bodendurchgang und wird nur bei Wechsel der Abnutzungsstufe, des Seeds oder des Höhenfelds neu umrissen.

*Keine Spur über Stufen.* Ein Teilstück zwischen Zellen verschiedener Stufe hat kein Stück (`piecesOf`): Die Spur endet am Zellmittelpunkt vor der Kante und fängt auf der anderen Seite neu an, nichts liegt über einer Klippe oder Wand. Die Rampenkeile entfallen; `rampsOf` und `rampCorners` in `terrain.js` bleiben für Tests und Werkzeuge, gezeichnet werden sie nicht. Die Spur liegt je Zelle auf deren Höhe.

*Alles auf Feldhöhe.* Was auf einem Feld steht oder liegt, wird um dessen Höhe gehoben: Hindernisse, Bollwerk, Stellungen samt Fundament und Goldring, Kapseln (der Fall endet auf der Feldhöhe) samt Zielmarke, Hologramm und Hervorhebung, Riss, Bastion, Signalfeuer samt Beschriftung, Klotzschatten (je Stufe ein Zug), Marker (Landezonen, Abriss, Bollwerk, Aufwertung, Rezept-Vorschau samt Pfeil, Hover-Raute, Flash-Rauten, Preise), Reichweitenkreise, Zielringe, Effekte am Boden und darüber (Einschläge, Flammenkegel, Blitze, Schadenszahlen, Granaten, Bomben des Gunships), die Zielankündigung des Koloss. Meist geschieht das mit `ctx.translate(0, -h)` um den Aufruf; wo eine Linie über mehrere Felder läuft (Routenvorschau, Fluglinie, Spur, Blitze, Zielstrahl), wird jeder Punkt einzeln gehoben, die Fluglinie dafür alle halbe Feldbreite. Die Tiefensortierung bleibt `x + y`. Gegner stehen auf `heightAt(field, size, x, y)`: Feldhöhe, an der Feldgrenze über je `ENEMY_BLEND` 0,25 Feld je Seite linear zum Nachbarn überblendet (eine Stufe ist eine Bordsteinkante); der Koloss folgt derselben Höhe; Flieger behalten ihre Flughöhe über Stufe 0 (Hebung 0). Die tief liegenden Zeichenfunktionen (Effekte, Fußkante, Gunship) lesen das Feld des laufenden Bildes über `setActiveTerrain` / `cellLift` / `liftAt` aus `terrain.js`, statt dass jedes Argument ein Feld mitführt; ohne gesetztes Feld ist alles flach (Galerie, Studien, Unit-Tests). Bekannte Näherung: Das Ziel eines Blitzes oder Schusses auf einen Flieger sitzt auf der Feldhöhe unter ihm, nicht auf Stufe 0.

*Treffer auf Feldhöhe.* `screenToCell(cam, view, sx, sy, heights)` prüft die Stufen 2, 1, 0 nacheinander und nimmt das erste Feld, dessen Raute auf seiner Höhe den Punkt enthält und das genau diese Stufe hat; sonst gilt der Boden. Ein Tipp auf die Deckfläche eines hohen Feldes trifft damit dieses Feld und nicht das dahinter. Ohne `heights` bleibt die Abbildung flach. `window.__nachschub.screenOfCell` liefert die Mitte der Deckfläche auf Feldhöhe.

**Licht.** Eine Lichtrichtung für alles (`LIGHT` in `src/render/shadows.js`): Ein Körper der Höhe h Pixel wirft seinen Schatten `(0,55, 0,25) * h / 32` Felder nach +x/+y, auf dem Bildschirm nach rechts unten. Es gibt drei Arten von Schatten, und wo sie gezeichnet werden, ist Regel:

- *Klotzschatten* (Hindernisse, Bastion, Signalfeuer, Bollwerk): Die Hülle aus Grundfläche und um die Höhe verschobener Deckfläche, Füllung `rgba(10,6,4,.38)`, ohne Kontur. Jede Art nennt ihre Körper über `obstacleShadow`, `bastionShadow`, `beaconShadow` (`objects.js`: Rechtecke in Feldkoordinaten mit eigener Höhe; Ruinen und Mauern nennen die Körper ihrer Baukasten-Variante (`kitShadow` in `rubbleKit.js`: Sockelplatte und die hohen Teile, bei der Mauer Zinne, Bresche oder Treppe je Stück), das Bollwerk 26, die Bastion 30 mal `lift`, das Signalfeuer Sockel 8 und Mast 38, Kapsel-Trümmer einen flachen Körper um den Kernstumpf (5 bis 11 px), der Krater keinen). `scene.js` füllt alle in **einem** Pfad im Bodendurchgang, nach Boden und Spur und vor Fundamenten, Ring und Markern: Ein Schatten liegt so nie auf einem Nachbarn, und sich überlappende Schatten dunkeln nicht doppelt.
- *Fußkante und helle Kante:* `box(..., { lit: true })` zeichnet entlang der Unterkante beider sichtbaren Seiten eines Klotzes auf dem Boden einen 4 px breiten Verlauf (`rgba(10,6,4,.3)` nach 0) und an der linken oberen Kante der Deckfläche eine Linie Knochenweiß (Deckkraft 0,3, 1,5 px). Ohne `lit` ändert sich nichts, Studien und Galerie laufen unverändert.
- *Silhouettenschatten* (Stellungen, Bodengegner, gelandete Kapsel): `sprites/rasterizer.js` hält je Eintrag neben `canvas` und `flash` eine dritte Variante `shadow` (dieselbe Zeichnung, mit `source-in` schwarz gefüllt), erzeugt beim Rastern, nie im Betrieb. `drawSpriteShadow` legt sie geschert (`LIGHT.x - LIGHT.y` je Pixel Höhe) und auf `SPRITE_SHADOW_SQUASH` 0,45 der Höhe gestaucht um den Fußpunkt, Deckkraft 0,35, ein `drawImage`. Sie werden im tiefensortierten Durchgang direkt vor der Figur gezeichnet (nicht im Bodendurchgang), damit sie auf einem tiefer sortierten Nachbarn liegen dürfen. Eine Stellung wirft Sockel und Aufsatz in der Ruhestellung, ein Läufer Körper und Beine; die Kapsel behält im Fall die wachsende Ellipse. Flieger behalten eine schwache Ellipse (Deckkraft 0,2), weil ihre Silhouette in der Luft hängt. Die Ellipse `shadow` aus `draw.js` bleibt nur für diese beiden Fälle, für Effekte und für die Platzhalter.
- *Koloss und Gunship* (drehbare Modelle) werfen einen Schlagschatten aus ihrer Grundfläche, wie das Modell gedreht (`modelFrame.Wc`), Deckkraft 0,38, keine Silhouette. Der Koloss folgt der Höhe seines Rumpfes, das Gunship ist um seine Flughöhe entlang `LIGHT` verschoben.

`prefers-reduced-motion` ändert daran nichts; Schatten bewegen sich nur mit ihrer Figur.

**Hindernisse (Baukasten, M8 C5).** Ruine, Mauer, Krater und Kapsel-Trümmer sind keine festen Formen mehr, sondern kommen aus einem Baukasten (`src/render/rubbleKit.js`, Portierung der Fassung „Feldfüllend“ aus `reference/studien/truemmer-studie.js`; die Fassung „Rund“ ist nicht im Spiel): Bauteile (Block mit schrägem Bruch und gezackter Kante, Zylinder, Ziegelhaufen, Platte, Stahlstab, Kabel, Stacheldraht, Knochen) und je Art acht Kompositionen. *Ruine:* Kapelle, Turmstumpf, Hausecke, Fabrikrest, Betonbruch, Torbogen, Säulenstumpf, Trümmerhügel. *Mauer:* ein Lauf aus drei Stücken (Zinnenreihe, Bresche, Strebepfeiler, Schießscharten, Treppenende, Einschussmarken, Bewachsen, Stacheldraht), waagerecht und senkrecht; alle Stücke haben am Ende dieselbe Grundhöhe, damit sie in jeder Reihenfolge anschließen. *Krater* (Glutreste, Geschmolzener Rand, Wrackteil, Doppelkrater, Alter Wasserkrater, Knochenkrater, Splitterkranz, Giftpfütze) und *Kapsel-Trümmer* (Frisch gefallen, Dach abgehoben, Kern und Streben, Gestützte Klappe, Dachscheibe, Kern und Kabel, Streben und Bänder, Ausgeschlachtet) **füllen die Raute ihres Feldes** und ragen nicht darüber hinaus. Der Krater hat einen hellen Randwall um einen dunklen Schacht, das Kapselfeld ist dunkel, flach (unter 12 px) und trägt in jeder Variante den Kernstumpf mit dem toten roten Band und Reste des Hitzeschilds; so sind beide auch bei 0,5x zu trennen. Gelb gehört dem Bollwerk (Kapsel-Warnbänder sind verbrannt, nicht gelb), das Bollwerk bleibt unverändert.

*Variante je Feld.* `variant` aus der Simulation (0 bis 3, in `mapgen.js` wie bisher gezogen) bleibt; der Renderer bildet `kitVariant(x, y, variant) = seedFromString('kit:x:y:variant') % 8` (je Feld; eine Mauer nimmt Lauf und Grundhöhe vom ersten Feld) und zieht alle Einzelheiten (Brocken, Risse, Lage) aus `createRng('rubble:x:y:variant')`. Gleicher Seed, gleiches Bild; Nachbarn mit gleichem `variant` sehen verschieden aus. Steine, Pfützen und Gruben nehmen Stein- und Schachtfarbe aus der Biom-Palette, Ziegel (`C.brick`), Rost, Knochen und Glut bleiben fest.

*Zwischenspeicher.* Ein Feld wird einmal in einen Offscreen-Canvas gezeichnet, je (Feld, Biom, Rasterstufe 0,5 / 1 / 2, Pixelverhältnis) in `src/render/rubbleCache.js`, und danach nur noch mit `drawImage` gesetzt; Es liegt immer nur **eine** Stufe im Speicher: `warmKit` füllt die Stufe zu Zoom und dpr vor dem ersten Bild; ein Zoomwechsel in eine andere Stufe rastert erst, wenn der Zoom 160 ms stillsteht (bis dahin wird die vorhandene Stufe skaliert gezeichnet), und verwirft die alte Stufe. Je Stufe bei dpr 2 und etwa 30 Feldern (Karte 24) rund 3 MB (0,5), 11 MB (1) und 45 MB (2). Im laufenden Spiel rastert nur ein vom Spieler neu angelegtes Trümmerfeld einmal nach; `kitStats` (`window.__nachschub.kit()`) zählt das, der Perf-Test prüft, dass es während der Messung still steht. Ohne den Zwischenspeicher (`drawObstacleCell` ohne `raster`) zeichnen Galerie und Studien direkt.

**Rahmen (Diorama).** Die Platte steht als Gegenstand auf einem Tisch. Unter der Erdplatte (`SLAB_DEPTH` 30) liegt eine Stahlgrundplatte (`PLATE_THICK` 14 px, `PLATE_OVERHANG` 0,8 Felder rundum, beide in `src/render/iso.js`): Oberseite und die zwei sichtbaren Seiten in drei dunklen Stufen aus `C.steel` und `C.steelD`, ein Rostband mit ausgefranster Oberkante an beiden Seiten, vier Nieten an den Ecken. Darunter ein weicher Tischschatten (radialer Verlauf, auf `TABLE_SHADOW_SQUASH` 0,5 gestaucht). Alles steckt im Boden-Cache (`ground.js`); `mapBounds` rechnet Überstand, Dicke und Schatten ein (seitlich `(n + 1,6) * 32 + 12`, unten `(n + 0,8) * 32 + 144`), der Cache bleibt weit unter `MAX_PIXELS` (12 Mpx). Weil `main.js` `fitCamera` und `clampCamera` mit denselben Grenzen ruft, ist die Grundplatte im Start-Ausschnitt ganz zu sehen; die Mitte der Karte liegt in der Mitte des freien Bereichs.

**Stellungen im Gelände (Version 0.11.4, Issue 44).** Vier Dinge, die an Stufen und Hindernissen schiefgingen; die Geometrie steht in `src/render/cover.js` (rein, mit Unit-Tests), gezeichnet wird in `scene.js`.

- *Eine Stellung steht hinter dem Hang vor ihr.* Ein Block, der näher an der Kamera liegt und höher ist als das Feld der Stellung und es überdeckt (`occludersOf`, dieselbe Prüfung wie bei der Verdeckung), schneidet die Stellung aus: Sockel, Aufsatz, Fundament und goldener Ring werden mit dem Bild des Blocks (Deckfläche und Wände, `blockHull` mit `CUT_GROW` 1,5 px, damit die Tuschekontur des Blocks ganz bleibt) ausgespart. Jeder Bildpunkt einer Stellung, der in der Deckfläche eines höheren Blocks vor ihr liegt, gehört zu einem Punkt unterhalb dessen Oberkante und ist damit verdeckt; das ist der Grund, warum der Schnitt immer das ganze Bild des Blocks nimmt. Beim Ansehen des Feldes (Verdeckung, `REVEAL`) kommt der ausgeschnittene Teil im Bild des Blocks mit der Deckkraft der Überblendung zurück (die Stellung wird dort ein zweites Mal gezeichnet, geklippt auf den Block, die Waffenbewegung nur einmal). Die Hüllen je Feld werden je Höhenfeld einmal berechnet.
- *Das Fundament endet an der Kante.* `FOUNDATION_INSET` −0,1 gilt nur an Kanten, hinter denen das Nachbarfeld dieselbe Stufe hat (`plateBounds`); wo die Stufe wechselt oder die Karte endet, endet das Fundament genau an der Feldkante. Vorher hing es am Klippenrand über die Kante und kletterte am Hang des höheren Nachbarn hoch.
- *Trümmer decken den Sockel nicht (geprüft, nichts geändert).* Der neue Bunker ist 54 px breit (Sockel mit `BUNKER_BASE_SCALE` 0,74) und liegt innerhalb der Raute seines Feldes (64 px); die Kapselreste (`CAPSULE_BODIES`, 5 bis 11 px hoch) in den Feldern vor ihm überdecken weniger als `OBSTACLE_SEE_THROUGH.minShare` seines Bildfeldes, im ungünstigsten Fall rund einen Pixel seiner vorderen Sockelecke. Ein Unit-Test mit den echten Baukasten-Körpern hält das fest (`tests/unit/cover.test.js`); wächst eine Trümmerart oder ein Sockel, schlägt er an.
- *Hindernisse vor einer Stellung sind dauerhaft durchsichtig.* Ruine, Mauer und Trümmer des Baukastens (nicht Krater, nicht das Bollwerk), die näher an der Kamera liegen (größeres x + y) und mit den Bildern ihrer Körper (`obstacleShadow`: Deckfläche und die beiden Wände je Körper) mindestens `OBSTACLE_SEE_THROUGH.minShare` (0,15) der Bildfläche einer Stellung überdecken, gemessen an einem Raster von 4 x 5 Punkten über ihrem Umriss (Sockel und Aufsatz), werden mit `OBSTACLE_SEE_THROUGH.alpha` (0,45) gezeichnet, ohne Aufblenden, die ganze Mauer, wenn ein Feld von ihr deckt. Die Stellungen bleiben deckend. Die Menge wird nur neu gebildet, wenn sich Stellungen oder Hindernisse ändern (Vergleich einer flachen Liste je Bild, keine Geometrie). Beide Werte sind Darstellungswerte in `src/data/art.js`, vom Spielgefühl her Tills Entscheidung.

**Hindernisse im Gelände (Version 0.11.8, Issue 58).** Dieselbe Ursache wie bei den Stellungen, an allem, was aus `scene.js` auf eine Stufe gestellt wird: der Boden mit allen Blöcken kommt zuerst aufs Bild, Hindernisse, Bastion und Signalfeuer werden danach tiefensortiert darüber gezeichnet, und was hinter einem höheren Block lag, stand deshalb auf dessen Deckfläche und Wand. Die Geometrie steht in `cover.js` (rein, Tests in `tests/unit/coverEdges.test.js`).

- *Ruine, Mauer, Krater, Kapselreste, Bollwerk, Bastion, Signalfeuer.* Jedes Feld hat dieselbe Aussparung wie eine Stellung (`coverHulls`, `drawBehindTerrain`): Das Bild des Feldes (beim Baukasten die Zelle aus dem Cache `rubbleCache.js`, sonst live gezeichnet) wird mit den Bildern der höheren Blöcke davor ausgeschnitten. Eine Mauer wird je Zelle geschnitten, jede Zelle mit den Blöcken vor ihrem eigenen Feld. Die Bastion von King of the Hill (2 x 2 Felder) nimmt die Blöcke vor jedem ihrer Felder ohne ihre eigenen (`coverHullsOfSquare`). Was über die Oberkante des Blocks hinausragt, bleibt: Ein Punkt im Bild der Deckfläche oder Wand liegt nie über deren Oberkante, wenn er auf einem Feld hinter dem Block steht (Test dazu). Krater liegen eine Stufe tiefer als ihre Umgebung (`terrain.js`) und stehen damit in einer Senke: ihre Vorderseite verschwindet hinter dem Rand. Beim Ansehen des Feldes (Verdeckung, 0.11.1) kommt der ausgeschnittene Teil wie bei den Stellungen mit der Deckkraft der Überblendung zurück; Hindernisse, die dauerhaft durchsichtig sind (`OBSTACLE_SEE_THROUGH`), behalten ihre Deckkraft in beiden Durchgängen. Das Ausschneiden kostet nur dort etwas, wo ein Block davorliegt (ein Klippen mehr je Feld); der Rest geht unverändert durch.
- *Schatten.* Ein Schatten liegt auf der Ebene des Feldes seines Körpers und ragte vorher über die Kante eines tieferen Nachbarn (in der Luft) oder am Hang des höheren hinauf. `shadowPlan` sortiert die Schatten nach Stufe und danach, ob sie Pflege brauchen: Schatten im Freien (alle Felder ringsum auf derselben Stufe, nichts Höheres davor) bleiben ein Füllen je Stufe wie bisher; die anderen werden auf die Felder ihrer eigenen Stufe geklippt (der Kartenrand zählt als Stufe 0) und mit den Bildern der höheren Blöcke davor ausgeschnitten, die den Boden dort verdecken. Der Plan und die Klippfade werden nur neu gebaut, wenn sich Hindernisse, Bastion, Signalfeuer oder das Höhenfeld ändern (Vergleich einer flachen Liste je Bild), nicht je Bild.
- *Grundfläche.* Die Flächen der Hindernisse (Sockelplatte der Ruine, Krater, Brandfleck der Kapselreste) bleiben in der Raute ihres Feldes (bis auf die Tuschelinie); sie ragten nie über die Kante, nur das Bild hinter dem Block lag falsch. Die Aussparung nimmt sie mit.
- *Marken am Boden (Nachtrag 0.11.8).* Brandfleck der Kapsellandung (dunkler Hof, Grube, Risse bis rund 2 Felder weit), Rußflecken, Säurepfützen, Schockringe und Stasisfelder lagen auf der Ebene ihres Feldes und liefen über Kanten, auf höhere Blöcke und in Senken. `groundClip.js` (`clipToGround`) klippt sie auf die Felder derselben Stufe um ihren Mittelpunkt (Reichweite je Art: Brandfleck der Landung 2, Rußfleck `ceil(radius) + 1`, Pfütze 1, Ring und Stasis `ceil(radius) + 1`) und spart die Bilder der höheren Blöcke davor aus. Der Klipp je Ort und Reichweite wird einmal gebaut und danach nur nachgeschlagen; liegt ein Feld im Freien, entsteht keiner. Die Marken sitzen auf der Ebene ihres Feldes (`cellLift`) statt auf der geglätteten Höhe des Gehens, damit sie an einer Stufe nicht schweben. Die Kapselreste und Krater des Baukastens (flach, bis 20 beziehungsweise 24 px hoch) werden ebenfalls auf ihre Stufe geklippt, der Klipp ist die Felder derselben Stufe um 20/24 px nach oben gezogen, damit Stachel und Kern ihre Höhe behalten; was über eine tiefere Nachbarin hinausragte, fällt weg.
- *Nicht geändert, gemeldet.* Marker (Landezone, Zielmarke, Auswahlrahmen), Reichweitenringe, Zielkreise, Auren der Stellungen und der Flammenstrahl bleiben unbeschnitten: Sie sind Anzeigen, die auch hinter einer Anhöhe lesbar bleiben sollen, wie der Umriss des angesehenen Feldes. Eine Kapsel im Fall ist höher als jeder Block und lässt sich nicht einfach ausschneiden, und sie steht nur während der Wahl; die Kapsel vor der Wahl am Hang wurde nicht untersucht.

**Verdeckung (Version 0.11.1).** Liegt ein Feld, das der Spieler ansieht (unter dem Zeiger, angetippt, Ziel einer Kapsel), hinter höherem Gelände, wird dieses Gelände für die Zeit der Ansicht halb durchsichtig (`REVEAL.blockAlpha` 0,18, Ein- und Ausblenden `REVEAL.fadeMs` 150 ms, bei `prefers-reduced-motion` sofort; Zahlen in `src/data/art.js`). Die Prüfung ist reine Geometrie auf dem Höhenfeld (`src/render/occlusion.js`, `occludersOf`): ein Block verdeckt, wenn er näher liegt (größeres x + y), höher ist und seine Deckfläche oder Wand die Raute des Feldes überlappt; entlang der Blickrichtung sind 32 px Höhe ein Feldschritt. Gezeichnet wird als kleine Überlagerung in der Hülle der verdeckenden Blöcke (`ground.drawReveal`): der Boden ohne diese Blöcke (aus denselben Zufallswerten wie der Cache, je Feld ein eigener Strom) und darüber der Cache mit der Deckkraft. Das Reveal-Bild hängt am beruhigten Zoom des Boden-Caches (bis dahin wird es skaliert) und hat eine eigene kleine Pixelgrenze. Der Boden-Cache selbst wird nicht neu gebaut. Seit dieser Änderung zieht jedes Bodenfeld seine Zufallswerte aus einem eigenen Strom (`ground:<seed>:x,y`); das Bodenbild aller Karten (Kiesel, Risse, Steinchen) sieht dadurch im Detail anders aus als vor 0.11.1. Das Feld selbst behält über allem einen Umriss (Tusche, darauf Doktrin- oder Markerfarbe).

*Kulisse.* `backdrop.js`: Horizont `HORIZON` 0,40 der Ebenenhöhe (vorher 0,26), darüber ein schwarzer Schleier `BACKDROP_DARKEN` 0,32 (das Modell ist das Hellste im Raum), Parallaxe unverändert. Vignette `VIGNETTE_STRENGTH` 0,82 (vorher 0,62) in `scene.js`. King of the Hill hat denselben Rahmen; die Bastion in der Mitte bleibt, wie sie ist.

## Technische Umsetzung

- **SVG als Quelle, Canvas als Ausgabe.** Die SVGs werden beim Start einmal in Offscreen-Canvas gerastert und danach nur noch per `drawImage` gezeichnet. Kein SVG-Zeichnen pro Frame.
- **Ausnahme: drehbare Modelle.** Figuren, die in mehreren Achsrichtungen stimmen müssen — Koloss und Gunship — sind kein SVG, sondern werden aus einfachen Körpern in lokalen Koordinaten aufgebaut (siehe „Drehbare Modelle" unten). Sie werden auch nicht gerastert, sondern pro Bild gezeichnet: Es gibt höchstens einen von jedem auf dem Feld, ihre beweglichen Teile (Laufrollen, Rückstoß, Flak) gehören zum Modell, und zwischengespeichert werden die Schattierungsfarben. Genau das schreibt Abschnitt „Drehbare Modelle" als Leistungsregel fest.
- **Bunker und Aufsätze kommen aus dem Zeichencode der Studie**, aber als SVG: Der Zeichencode aus `reference/studien/stellungen-simulation.html` (Aufsätze, Spezialbasis, Spezialwaffen) und seit 0.11.0 für den Standardbunker aus `reference/studien/stellungen-rework-modell.js` (`drawBunker`, je Doktrin und Rang) wird einmalig nach `reference/konzept/stellungen/` exportiert und läuft danach durch dieselbe Pipeline wie jede andere Figur (`npm run sprites`). Sie sind statisch, also bleibt die SVG-Regel für sie in Kraft.
- **Rasterstufen nach Zoom.** Pro Figur werden wenige Auflösungsstufen vorgehalten (etwa 0,5x, 1x, 2x mal devicePixelRatio) und die passende gewählt, damit beim Zoomen nichts unscharf wird.
- **Statische Teile als Sprite, Bewegung im Code.** Bunker, Gehäuse, Körper, Köpfe und Klingen kommen aus dem SVG. Was sich bewegt, wird wie im Stiltest per Code gezeichnet: schwenkende Waffen, Flammen, Blitze, Insektenbeine im Laufzyklus, Flügelschlag.
- Die Zerlegung ist in M4 passiert (`tests/tools/split-towers.py` und `split-enemies.py`, beides einmalige Eingriffe in `reference/konzept/`). Die Symbolbibliothek trägt seitdem pro Figur mehrere Teile:

| Teil | Stellungen | Gegner |
|---|---|---|
| `-back` | Sockelaufbau, Mast, Tanks | Beine oder Flügel hinter dem Körper |
| `-gun` / `-body` | Waffe, dreht sich zum Ziel | Körper |
| `-front` | Sandsäcke und Kisten vor der Waffe | Beine oder Flügel vor dem Körper |

  Für die Stellungen tritt seit v5 der Bunker-Baukasten an die Stelle dieser Aufteilung: ein Bunkerteil je Rangstufe und ein Aufsatz je Doktrin. Der Aufsatz der Standardstellungen ist seit 0.11.2 ein drehbares Modell mit Stufen-Cache (Abschnitt „Aufsätze als drehbare Modelle“); seit 0.11.10 sind auch die Waffen der Spezialstellungen drehbare Modelle.

  Die Kapsel kommt in M4c dazu: geschlossen ein Stück, geöffnet ein Kern (seit M4d mit dem Dach darauf) und vier einzeln ansteuerbare Segmentklappen, damit sie wie bisher nacheinander aufklappen. Seit 0.10.5 ist es Entwurf B, aus der Kapsel-Studie erzeugt: Hülle, Hitzeschild, Kern und vier Segmente (Abschnitt „Nachschubkapsel“).

  Wo die Teile sitzen und wie sie sich bewegen (Drehpunkt, Ruhewinkel, Mündung, Ausschlag), steht in `src/render/sprites/manifest.js`. Der Warp-Seher schwebt und bleibt ein Stück.
- **Aus den SVGs entfernt und jetzt Code** (`src/render/towerFx.js`): Flammenstrahl, Mündungsbögen, Mörserrauch, das Leuchten von Laser und Tesla, die Blitze der Spule, die Ringe und die dauerhafte Aura der Psi-Stellung, die Feuersequenz der Sturmbatterie. Seit v5 dazu die beweglichen Teile der Aufsätze: die rotierenden Läufe der Autokanone, die Zündflamme am Brennrohr, der Rückstoß des Mörserrohrs.
- Der Bunker hat seit v5 zwei Schießscharten, je eine pro sichtbarer Seite, statt drei in der Front. Sie sind Zeichnung, kein Abschusspunkt: Gefeuert wird vom Aufsatz auf der Dachplatte. Das ersetzt die Regelung aus M4d, nach der Flamme und Autokanone ausschließlich über den Effekt an der Scharte zielten.
- Treffer-Aufblitzen über eine vorgerenderte helle Variante des Sprites, nicht über Filter pro Frame.

## Drehbare Modelle

Koloss und Gunship werden nicht als feste Flächen für eine Blickrichtung gezeichnet, sondern aus einfachen Körpern in lokalen Koordinaten aufgebaut. So stimmen sie in allen vier Achsrichtungen, ohne dass vier Zeichnungen gepflegt werden müssen. Das Prinzip steht vollständig in `reference/studien/koloss-studie.html` (Funktionen `kframe3`, `prism`, `boxP`, `nacelle`, `render`) und wird als kleines Modul in `src/render/` übernommen.

- **Lokale Achsen:** lx vorwärts und ly seitwärts, beide in Feldern, dazu z nach oben in Pixeln. Die Welt-Position ergibt sich aus Mitte + lx · vorwärts + ly · seitwärts, mit seitwärts = (-vorwärts.y, vorwärts.x). Danach folgt die normale Iso-Projektion.
- **Körper:** Prisma — ein Querschnitt in (lx, z), extrudiert entlang ly; ein Quader ist ein Sonderfall davon. Dazu Zylinder entlang lx für die Triebwerke.
- **Sichtbarkeit:** Eine Fläche wird nur gezeichnet, wenn ihre Welt-Normale n zur Kamera zeigt, also n.x + n.y + 1,2 · n.z > 0.
- **Schattierung nach Normale:** Oben am hellsten, +y mittel, +x dunkler. Damit fällt das Licht in allen Richtungen gleich.
- **Zeichenreihenfolge:** Teile nach Tiefe ihrer Mitte sortieren (x + y). Aufbauten bekommen einen Ebenen-Zuschlag, damit sie über dem Rumpf liegen.
- **Zierbänder** (Rostband, rote Streifen) zeichnen nur ihre Seitenflächen, nie Ober- oder Unterseite. Sonst überdecken sie die Oberseite des Rumpfs.
- **Rollen:** Laufrollen sind Ellipsen, die mit der Bildschirmrichtung der Fahrtachse geschert werden (`ctx.transform(u.x, u.y, 0, 1, 0, 0)`).
- **Leistung:** Koloss und Gunship existieren höchstens einmal gleichzeitig. Farbwerte der Schattierung zwischenspeichern, wie in der Studie (`shadeCache`). Ausnahme: die Aufsätze der Standardstellungen, siehe unten.

**Warum kein SVG.** Ein SVG kennt keine Normalen. Vier Standbilder statt des Modells würden bedeuten, dass jede Änderung viermal nachgezogen werden muss und die richtungsabhängige Schattierung verlorengeht. Für statische Figuren gilt die SVG-Regel deshalb unverändert weiter; die Ausnahme greift nur, wo eine Figur sich um die Hochachse dreht.

### Aufsätze als drehbare Modelle (seit 0.11.2, M9 D2)

Die sechs Aufsätze (`src/render/turrets.js`, der Mörser als Raketenwerfer) sind Modelle aus Körpern in lokalen Koordinaten, nach Form und Maß der Studie `stellungen-rework-modell.js`. Anders als Koloss und Gunship drehen sie sich um **beliebige Winkel**, deshalb sortiert `model.js` für sie (`turnFrame`, `solidKit`, `renderSolids`) jede sichtbare Fläche einzeln nach der Tiefe ihrer Mitte entlang des Sehstrahls; lange Flächen werden vorher geteilt. Koloss und Gunship behalten ihren einfacheren Weg.

- **Richtung.** Aus `tower.aim` (Weltpunkt des letzten Ziels). Der Darstellungswinkel lebt auf der Darstellungsseite (`towerSprites.js`, nicht im Zustand, nicht gespeichert, nicht aufgezeichnet) und dreht mit `TURRET_TURN_SPEED` (`src/data/art.js`) zum Ziel. Ohne Ziel bleibt die letzte Richtung.
- **Stufen-Cache** (`src/render/turretCache.js`). Zeigt die Waffe auf ihr Ziel (Abweichung unter `TURRET_ALIGN`) oder hat sie keins, steht sie auf der nächsten von 16 Stufen. Eine Stufe entsteht erst bei Bedarf, je Doktrin und Rang, zugeschnitten auf den belegten Bereich, nur für die Rasterstufe des Zooms (Wechsel erst nach 160 ms Ruhe, wie bei den Trümmern). Je Stufe liegen der Silhouettenschatten (halbe Auflösung) und, bei Bedarf, die helle Variante für das Treffer-Aufblitzen im Speicher. Höchstens `TURRET_CACHE_BYTES` (32 MB) Pixelspeicher, die am längsten ungenutzten Stufen weichen; höchstens `TURRET_BUILDS_PER_FRAME` neue Stufen je Bild, sonst wird die Waffe in diesem Bild aus dem Modell gezeichnet. Eine Waffe zwischen zwei Stufen wird pro Bild aus dem Modell gezeichnet.
- **Feuern macht nicht teuer.** Der Rückstoß verschiebt die Stufe entlang des Laufs (`TURRET_RECOIL`), die Bohrungen der Autokanone drehen sich als Ebene darüber, Mündungsblitz, Hülsen und Leuchten liegen darüber. Die Psi-Ringe schweben als eigene Stufe über dem Sockel.
- **Mündungspunkt.** Jede Waffe hat einen im Modell (`TURRET_MUZZLE`, `TURRET_ROCKET`); `towerAnchor` liefert ihn in der Richtung, in der die Waffe gerade gezeichnet wird. Das Mündungsfeuer (D3) liest ihn über `muzzleWorld` in `towerFx.js`: Position wie die Waffe gezeigt wird (Stufe samt Rückstoß oder Livewinkel), Richtung wie sie zeigt. Das Feuer tritt `FX_TIP_AHEAD` vor den Punkt, wo etwas übersteht: Raketenspitzen 0,12 Felder, Tesla-Spitze 0,05.
- Standbilder: `reference/konzept/stellungen/d2-16-richtungen.png` (alle sechs Aufsätze in 16 Richtungen im Spiel) und `d2-szene.png`.

### Mündungsfeuer und Effekte am Laufende (seit 0.11.5, M9 D3)

Form und Farbe aller Effekte sind die der Studie `stellungen-rework.js`; die Zahlen stehen als `FX_*` in `src/data/art.js`. Die Simulation weiß davon nichts: Ein Schuss wird daran erkannt, dass der Nachladezähler hochspringt (`updateTurret`), was die Simulation zum Ziel sagt (Strahlende, Kettenpunkte), kommt aus ihren Ereignissen (`noteTowerEvent`).

- **Ebene über der Stufe.** Das Feuer ist nie Teil einer Stufe; Feuern holt keine Waffe aus dem Cache.
- **Am Mündungspunkt, in Schussrichtung:** Autokanone Mündungsblitz (zwei Drachenpaare mit Schein), Hülse aus dem Auswurfschacht, Rauch, Leuchtspur zum Ziel. Flamme: Pilotflamme, Strahl aus 13 Flecken, weiß am Rohr, dunkel an der Spitze, Rauch an der Spitze; die Länge ist `FX_JET_LENGTH`, nicht länger als bis zum Ziel. Laser: Schein und Linse, die sich in den letzten `FX_LASER_CHARGE_SECONDS` der Nachladung füllt (aus dem Nachladezähler gelesen), Strahl aus Tusche, Leitfarbe und Weiß mit Schein am Ziel. Tesla: Schein an der Spitze, Blitzbogen mit Gabel und Weiterspringen zu den Kettenzielen, im Leerlauf ab und zu ein kleiner Bogen. Psi: Schein am Kern, alle `FX_PULSE_EVERY` Sekunden ein Impulsring entlang der Waffenrichtung.
- **Raketenwerfer.** Jeder Schuss der Simulation ist ein Rohr, die sechs gehen in der Reihenfolge `TURRET_ROCKET.mouths` los. Mündungsblitz mit Rückstrahl hinter dem Pod, Rauch und Funken. Die Rakete fliegt vom Rohr (Raketenspitze) in einer Kurve auf den Einschlagpunkt des Geschosses der Simulation: **Flugzeit und Ziel sind die von `state.projectiles`** (`t` von `flight`, `to`), nur die Wölbung (`FX_ROCKET`) ist Sache der Darstellung. Rauchspur alle `FX_ROCKET.trail` Sekunden. Der Einschlag bleibt das Ereignis `explosion`.
- **Tiefe.** Leuchten und Blitze am Mündungspunkt liegen über der Waffe. Was weit hinausreicht (Strahl, Blitz, Flammenstrahl, Impuls) liegt hinter der Waffe, wenn es von der Kamera weg zeigt, und sonst über allem (`drawTowerReach` aus `effects.js`).
- **Teilchen** (Hülse, Funke, Rauch, Leuchtspur) liegen in der Teilchenliste von `effects.js` in Weltkoordinaten und teilen sich deren Obergrenze (520); die Mündungen dürfen davon höchstens `FX_MAX_PARTICLES` (200) belegen, damit Explosionen nicht verdrängt werden. Jede Stellung reiht höchstens `FX_QUEUE` Teilchen je Bild ein.
- **prefers-reduced-motion:** Mündungsblitze halb so hell und 30 Prozent kleiner, keine Funken, weniger Rauch, kein Flackern von Blitz und Flamme, kein Leerlaufbogen, kein Puls des Lasers.
- Die alten Effekte (großer Blitzkreis am Düsenende, roter Laserpunkt, alte Tesla-Bögen, Ground-Kegel, Strahl-, Ketten- und Schussereignis in `effects.js`) werden für die Standardstellungen nicht mehr gezeichnet. Seit 0.11.10 (D4) gibt es sie für keine Stellung mehr.
- Standbilder: `reference/konzept/stellungen/d3-feuer.png` (alle sechs Waffen feuernd im Spiel) und `d3-raketen.png` (Folge des Raketenwerfers).
