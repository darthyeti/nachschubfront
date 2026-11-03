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

**Spezialbasis.** Höherer Bunker (Höhe 40 statt der Standardhöhe). Der **Korpus hat exakt die Grundfläche eines Standardbunkers**, also genau ein Feld. Nur die vier schrägen Stützen ragen optisch über die Feldgrenze hinaus; sie sind reine Grafik ohne Kollision und werden bei der Tiefensortierung mit dem Bunker gezeichnet. Oben eine kleinere Luke, darauf sitzt die Spezialwaffe mit Grundskalierung 0,84. Die Leitfarbe bleibt die der erstgenannten Zutat, der goldene Bodenring bleibt.

**Wirkungsanker.** Jede Zeile nennt die Stelle am Modell, von der Schuss, Flamme, Blitz oder Aura ausgeht, damit die Wirkung aus GDD Abschnitt 8 nicht an einer generischen Mitte ansetzt. Die Simulation rechnet weiter mit der Feldmitte; den sichtbaren Ursprung setzt allein der Renderer ein (Simulation und Darstellung bleiben getrennt). Die Werte stehen in `src/render/sprites/manifest.js`.

| Spezialstellung | Aufsatz | Effekt und Anker |
|---|---|---|
| Reinigungsschrein | Kleiner Schrein aus zwei Säulen mit Bogen, darin schwebt ein goldenes Artefakt mit Leuchtpunkt, drei goldene Funken kreisen | **Kein Mörser mehr.** Dauerhafte goldene Aura am Boden mit Runen, pulsierend. Anker: das Artefakt. Gegner in der Aura leuchten golden, der violette Verlangsamungsring wird bei ihnen unterdrückt |
| Sturmbatterie | Gewölbtes Gehäuse, zwei quadratische Luken, 2 x 2 Läufe, Faktor 1,2 | **Kein Tesla-Aufbau mehr.** Blaue Leuchtspur und blaue Mündungsblitze, Hülsen fliegen nach hinten aus. Anker: die vier Mündungen, abwechselnd |
| Glutkessel | Bauchiger schwarzer Kessel auf drei Beinen, Feuer in der Öffnung, vier Elektroden am Rand | **Keine Aura.** Feuerblitze von den Elektroden zu den Zielen. Brand als Flammen am Gegner, Übersprung als kurzer Glutbogen zwischen zwei Gegnern |
| Belagerungsmörser | Keilförmige Lafette, überlanges Rohr mit Rückstoß, Zielfernrohr mit rotem Punkt | Rote Laserlinie vom Fernrohr zum Ziel während des Anvisierens, dann große Granate und große Explosion |
| Gewitterturm | Zylindersockel, Spule aus sieben blauen Ringen, darüber schwebender violetter Ring mit blauer Kugel | Kettenblitz von der Kugel von Ziel zu Ziel |
| Seelenfeuer-Obelisk | Schlanker Obelisk mit violetten Runen, Flammen am Fuß, darüber schwebendes Auge mit rotem Blick | Seelenstrahl vom Auge zum Ziel, violette Partikel beim Treffer |

Referenz: `reference/konzept/stellungen/spezialstellungen.png` und die Studie im Modus „Spezial". Die Blätter in `reference/konzept/spezialstellungen/` bleiben als Entwurfsstand v4 liegen, werden aber nicht mehr importiert.

**Der Reinigungsschrein bleibt eine Aura.** Die Ergänzung v4 hatte ihn als Mörser beschrieben, dessen Flammenring am Zielort entsteht; in M5c blieb es aus Balancing-Gründen bei der Aura um den Schrein selbst (Entscheidung vom 25.09.2026). v5 entscheidet dauerhaft für die Aura, jetzt in Gold statt in Flammen, und ohne Mörserrohr. Die offene Frage aus M5c ist damit erledigt.

**Was Code ist, nicht Sprite.** Am Obelisken das Leuchten um das Auge und der Seelenstrahl auf das Ziel; das Auge, die Runen und die Flammen am Fuß stehen in der Zeichnung. An der Sturmbatterie die vier Mündungsblitze und die Patronenhülsen. Am Schrein das goldene Artefakt mit seinen drei kreisenden Funken und die Bodenaura mit ihren Runen, am Glutkessel das Feuer in der Öffnung und die Blitze der vier Elektroden, am Gewitterturm die schwebende Kugel im violetten Ring und der Kettenblitz, am Belagerungsmörser die Laserlinie und der Rückstoß des Rohrs.

### Ränge

Die Rangstufen bauen aufeinander auf, jede Stufe behält alles der vorherigen. Seit v5 sitzen sie am Bunker selbst, nicht mehr an einem Sockel darunter:

| Rang | Zusatz |
|---|---|
| Rekrut | Nackter Bunker |
| Veteran | Sandsäcke vor beiden sichtbaren Seiten |
| Elite | Angenietete Panzerplatten an beiden Seiten |
| Held | Zinnen auf den oberen Kanten, Totenkopf-Emblem an der Frontkante |
| Legende | Goldene Kanten an Dach und Frontkante |

Referenz: `reference/konzept/stellungen/bunker-raenge-und-spezialbasis.png`.

**Keine Fahne mehr beim Held.** Das wehende Banner aus v2 war auf Tablet-Größe nicht erkennbar und ist durch die Zinnen und den Totenkopf ersetzt. Damit entfallen auch die Winkel am Sockel: Der Rang ist am Bunker selbst abzulesen, nicht an einer Markierung darunter. Die Spezialstellungen haben wie bisher keinen Rang und tragen nur die Goldkanten.

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
6. **Hologramm** ab 1,55 s. Die **Lichtsäule steht hinter der Kapsel**: sie wird mit der Kapsel gezeichnet (nicht mehr über allem), färbt die Figur also nicht ein. Das Schild mit Rang und Namen bleibt darüber.

### Rauch

Rauch, Staub und Dampf sind Partikel mit Lebensdauer. Sie **breiten sich aus** (schnelles Wachsen, das abbremst), **hellen auf** (die Farbe läuft von dunkel nach hell: Ruß, Staub, Dampf haben je eine eigene Rampe) und **werden durchsichtig**; die Deckkraft fällt gegen 0. **Nach 3,5 s (`SMOKE_SECONDS`) ist alles verflogen**: keine Wolke darf länger leben, und eine Verzögerung zählt mit. Obergrenzen: 520 Partikel insgesamt, davon höchstens 240 Wolken (`MAX_PUFFS`); eine Salve von sechs liegt bei etwa 230. Brocken und Funken zählen nur zur Gesamtgrenze. Ein Unit-Test (`tests/unit/pod-landing.test.js`) hält die 3,5 s und die Grenze fest.

### Auswahl

- **Eckwinkel-Rahmen auf der Zelle**, auf Feldhöhe, als Überlagerung nach den Figuren (`drawPodFrame`, ersetzt den Ring `drawPodHighlight`): die gewählte Kapsel mit goldenen Winkeln in den Ecken der Raute, leichtem Puls und blassem Fülllicht, die übrigen mit gestricheltem Rahmen. Mit `prefers-reduced-motion` ohne Puls und ohne laufende Striche.
- **Die gewählte Kapsel hebt ihre Klappen** (6 SVG-Einheiten, 5 Prozent größer), der **Kern leuchtet heller** (Ringe, Halo, heller Überzug) und die **Lichtsäule ist kräftiger** (drei Schichten, aufsteigende Funken). Das Heben geht weich (`FOCUS_EASE`), nicht in einem Bild.
- Die Zwei-Tipp-Regel der Auswahl bleibt unverändert; die Eingabe ist nicht angefasst.

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

**Bedienung.** Klick oder Tippen löst die Aktion aus. Langes Drücken (am Desktop: Hover) zeigt eine kurze Erklärung als Sprechblase — dieselbe Regel wie bei Stellungen und Gegnern (GDD Abschnitt 13). Das lange Drücken darf die Aktion nicht zusätzlich auslösen. Bei einer neu freigeschalteten Scheibe blitzt die Beschriftung einmalig auf und verschwindet von selbst; danach ist sie nur noch über langes Drücken zu erreichen.

**Ruf.** Eine Scheibe, die jetzt gedrückt werden sollte, trägt einen goldenen Ring am Rand und einen zweiten, der alle 1,6 Sekunden aus ihm herauswächst und verblasst (`src/ui/nudges.js`). Kein Leuchtfilter, nur Ringe; bei `prefers-reduced-motion` bleibt nur der feste Ring. Er steht nur, solange die Bedingung gilt:

- **Kommandos:** benutzbar, und in dieser Partie wurde noch kein Kommando eingesetzt. Mit dem ersten Kommando verstummt die ganze Leiste.
- **Nachschub:** in der Planung kaufbar, und es liegt mindestens das Doppelte des Preises bereit.

Grund (Balancing-Runde 5): Drei neue Spieler setzten in sieben Partien kein einziges Kommando ein und kauften Nachschub spät oder nie, obwohl beides die ganze Zeit sichtbar war.

### Untere Leiste

Von links nach rechts: Nachschub-Scheibe (Stufe als goldenes Zahlen-Badge oben rechts, Preis klein darunter), Abriss-Scheibe (Mülleimer), Bollwerk-Scheibe, mittig der große goldene Hauptknopf „Salve anfordern" mit kleinem Kapsel-Symbol — er bleibt bewusst größer und mit Text, weil er die zentrale Handlung jeder Runde ist —, rechts die kompakte Tempo-Gruppe (Pause, 1x, 2x, 3x) als einfache quadratische Knöpfe, der aktive golden hervorgehoben.

Der Zonenzähler steht auf dem Salve-Knopf, nicht mehr in der Statusleiste. Die Rang-Wahrscheinlichkeiten des Nachschubs stehen in der Sprechblase seiner Scheibe, nicht mehr als Balkenreihe auf dem Knopf.

### Rechte Kommandoleiste

Eigene senkrechte Leiste am rechten Bildschirmrand, ausschließlich Runenscheiben ohne Text. Die Reihenfolge von oben nach unten ist die Freischalt-Reihenfolge (Orbitalschlag, Stasisfeld, Priorisierter Nachschub, Heiliges Banner, Luftschlag). Zustände wie oben. Scrollbar wird sie nur auf Bildschirmen unter 700 px Höhe: Eine scrollbare Leiste schneidet alles ab, was über ihren Rand ragt — die Sprechblase links und den Ruf-Ring —, und bekam für den Ring allein Scrollbalken.

**Scheibengröße:** 72 px (seit Runde 5, vorher 58 px) — auf dem Tablet waren die Scheiben auf einen Blick zu klein.

**Erklärung beim ersten Erscheinen.** Taucht die Leiste zum ersten Mal auf, hält das Spiel an und eine bildschirmfüllende Meldung im Rahmen der Menüs erklärt sie: Symbol des Orbitalschlags, Überschrift „Kommandos", drei Absätze (was Kommandos sind, woher die Punkte kommen, wie man eines einsetzt), ein Knopf „OK". Einmal pro Gerät (`commandIntroSeen` in den Einstellungen), in den Einstellungen unter „Hinweise" wieder einschaltbar (`src/ui/intro.js`). Mit `?debug` erscheint sie nur zusammen mit `&intro`, damit die Browser-Prüfungen nicht an ihr hängen bleiben.

### Obere Statusleiste

Durchgehende Metallplatte statt einzelner schwarzer Kästchen, die Werte in kleinen Abschnitten mit Nietentrennern. Von links: Spieltitel, Welle (Standarte, „aktuelle/gesamt"), Bastion-Leben (Turm; die Zahl färbt sich bei kritischem Stand orange und rot). Rechts: Nachschubstufe (Antenne), Requisition (Münze), Kommandopunkte (Stern — die Ergänzung v4 nennt einen Blitz-Chevron, die Skizze zeichnet einen Stern, und die Skizze gilt), Routenlänge (gepunkteter Pfad). Ganz rechts zwei kleine Plattenknöpfe für Rezepte und Menü — sie gehören zur Verwaltung, nicht zur Handlung der Runde, und darum nicht in die untere Leiste.

Was **nicht** dauerhaft in der Leiste steht: Seed und Phase (beide im Pausenmenü), der Zonenzähler (auf dem Salve-Knopf), Sieg und Niederlage (eigener Bildschirm), die Koloss-Ankündigung (situative Einblendung, solange ein Lauf angekündigt ist).

Bei sechs Feldern wird die Leiste auf dem Tablet-Querformat eng. Kommen weitere Werte dazu, gehören sie eher ins Pausenmenü als dauerhaft auf den Bildschirm.

## Menüs außerhalb der Partie

Fünf Bildschirme, alle mit dem Skyline-Motiv aus dem Stiltest im Hintergrund, Titel in Pirata One, Fließtext in Barlow Condensed. Referenzen: `reference/konzept/menues/hauptmenu.svg`, `seed-eingabe.svg`, `pause.svg`, `einstellungen.svg`, `ende-sieg.svg` (Niederlage ist derselbe Bildschirm, nur Titel und Farbe anders, darum kein eigenes Blatt).

**Textknopf-Fassung.** Ergänzt die Runenscheibe: rechteckige dunkle Platte mit dünnem Goldrand und kleinen Runenstrichen als Eckakzent statt vollem Ring, weil hier der Text im Vordergrund steht. Der wichtigste Knopf jedes Bildschirms ist golden hervorgehoben, alle anderen bleiben dunkel mit hellem Text.

| Bildschirm | Inhalt |
|---|---|
| Hauptmenü | Neue Partie (golden), Fortsetzen, Seed eingeben, Bestenliste, Einstellungen |
| Seed-Eingabe | Dialog über abgedunkeltem Hauptmenü: Eingabefeld für den Seed-Code, „Zufällig", „Übernehmen", darunter der Start-Knopf |
| Pause | Halbtransparent über der laufenden Partie: Fortsetzen (golden), Einstellungen, Partie verlassen, darunter eine kompakte Statuszeile (Welle, Leben, Requisition) zur Orientierung |
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

**Spur.** Der Weg ist, was die Gegner hinterlassen, keine gefärbte Kachel. Je Teilstück der aktuellen Route (zwischen zwei aufeinanderfolgenden Zellen) hält `src/render/trail.js` eine Abnutzung von 0 bis 1: sie wächst, wenn ein Bodengegner (nicht Flieger, nicht Koloss) das Stück betritt, und sinkt auf Stücken, die nicht mehr zur Route gehören; unter einem Mindestwert wird das Stück vergessen. Eine Umleitung lässt die alte Spur also stehen und verblassen, die neue wächst. Die Abnutzung ist Darstellungszustand neben `ui`: nicht im Spielzustand, nicht gespeichert, nicht aufgezeichnet, in jeder neuen Partie 0. Gezeichnet werden drei versetzte, ausgefranste Streifen in der Wegfarbe des Bioms, ohne Kontur, im Bodendurchgang nach dem Boden und vor den Markern; der Zufall der Ränder kommt aus einem eigenen, vom Seed abgeleiteten Strom, damit Standbilder gleich bleiben. Jede Lage hat außen einen dunklen Saum (`palette.pathEdge`, `TRAIL_EDGE`: 0,08 Feld breit, Deckkraft 0,5 mal Abnutzung), damit die Spur in der Planung unter der Goldroute lesbar bleibt; die Säume aller Lagen werden vor den Füllungen gezeichnet, die breiteren Füllungen dämpfen die inneren Säume. Die gestrichelte Goldroute der Planung bleibt die Vorschau und liegt über der Spur.

**Blockgelände.** Die Karte hat drei Höhenstufen zu `STEP` 12 px (Stufe 0, 1, 2); die Platte ist so hoch wie Stufe 0. Das Höhenfeld (`heightField(map, seed)` in `src/render/terrain.js`, ein `Uint8Array` je Feld) kommt aus dem Seed und nie aus dem Weg: Wertrauschen auf einem Raster von `NOISE_CELLS` 11 Feldern, mit Smoothstep interpoliert, auf 0 bis 1 gedehnt, bei `LEVEL_CUTS` 0,4 und 0,66 in drei Stufen geschnitten, danach dreimal der Mehrheitsfilter (ein Feld, das von seinen vier Nachbarn höchstens einen mit gleicher Stufe hat, nimmt die Mehrheit der Nachbarn; ein Streifen von einem Feld Breite, dessen beide Nachbarn auf einer Achse anders liegen, wird auf die tiefere Stufe eingeebnet), damit Plateaus als Blöcke entstehen und nicht als Treppe. Der Zufall ist `createRng('terrain:' + seed)`, ein eigener Strom, kein Spielstrom. Krater liegen eine Stufe tiefer (nie unter 0); Riss, Bastion (alle Felder), Signalfeuer und alles, was der Spieler baut, ändern das Feld nicht. Das Feld wird je Karte und Seed einmal gebaut (`WeakMap`) und ist reine Darstellung: Die Simulation rechnet weiter auf der flachen Karte, Wege, Reichweiten und Kosten bleiben, wie sie sind.

*Klippen.* Der Boden-Cache (`ground.js`) zeichnet die Felder in Feldreihenfolge (x + y aufsteigend), je Feld die Deckfläche auf `z = Höhe` (je Stufe um 9 RGB-Schritte heller), Seitenflächen nur dort, wo der Nachbar in +x oder +y tiefer liegt (links `cliff[1]`, rechts `cliff[2]`), mit zwei Schichtlinien, ein bis zwei Steinen und Tuschekontur. Auf die Deckfläche eines tieferen Feldes fällt der Schatten der höheren Nachbarn links, hinten und diagonal dahinter (`castShadows` aus `shadows.js`, Höhe gleich dem Stufenunterschied, auf die Raute des Feldes beschnitten) samt Fußkante (`footStrip`); die helle Kante liegt an der linken oberen Kante jeder Deckfläche, deren Nachbar dahinter tiefer liegt. Am Kartenrand reichen die Klippen bis auf die Platte. Der Cache wird nur bei Seed, Karte, DPR und gesetztem Zoom neu gebaut; `mapBounds` hat oben 24 px mehr Luft für zwei Stufen.

*Rampen.* Wo zwei aufeinanderfolgende Zellen der Route auf verschiedenen Stufen liegen, zeichnet die Spur (`trail.js`, je Bild, weil die Route sich ändert) auf dem tieferen Feld einen Erdkeil: `RAMP_WIDTH` 0,6 Felder breit, `RAMP_RUN` 0,65 Felder Auslauf, von der Kante des höheren Feldes (auf dessen Höhe) bis auf den Boden des tieferen, in der Wegfarbe, Tusche nur an den beiden Seiten, nicht nach oben. Bei einem Schritt über die Diagonale läuft der Keil an dem Achsnachbarn hinauf, der wirklich höher liegt. Der Keil der aktuellen Route ist immer voll sichtbar, der einer verlassenen Strecke blendet mit ihrer Abnutzung aus. Die Spur selbst liegt je Zelle auf deren Höhe: ein Teilstück über eine Stufe wird an der Feldgrenze geteilt; bei einem geraden Schritt entfällt die Hälfte im tieferen Feld, dort liegt der Keil.

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

*Kulisse.* `backdrop.js`: Horizont `HORIZON` 0,40 der Ebenenhöhe (vorher 0,26), darüber ein schwarzer Schleier `BACKDROP_DARKEN` 0,32 (das Modell ist das Hellste im Raum), Parallaxe unverändert. Vignette `VIGNETTE_STRENGTH` 0,82 (vorher 0,62) in `scene.js`. King of the Hill hat denselben Rahmen; die Bastion in der Mitte bleibt, wie sie ist.

## Technische Umsetzung

- **SVG als Quelle, Canvas als Ausgabe.** Die SVGs werden beim Start einmal in Offscreen-Canvas gerastert und danach nur noch per `drawImage` gezeichnet. Kein SVG-Zeichnen pro Frame.
- **Ausnahme: drehbare Modelle.** Figuren, die in mehreren Achsrichtungen stimmen müssen — Koloss und Gunship — sind kein SVG, sondern werden aus einfachen Körpern in lokalen Koordinaten aufgebaut (siehe „Drehbare Modelle" unten). Sie werden auch nicht gerastert, sondern pro Bild gezeichnet: Es gibt höchstens einen von jedem auf dem Feld, ihre beweglichen Teile (Laufrollen, Rückstoß, Flak) gehören zum Modell, und zwischengespeichert werden die Schattierungsfarben. Genau das schreibt Abschnitt „Drehbare Modelle" als Leistungsregel fest.
- **Bunker und Aufsätze kommen aus dem Zeichencode der Studie**, aber als SVG: Der Zeichencode aus `reference/studien/stellungen-simulation.html` wird einmalig nach `reference/konzept/stellungen/` exportiert und läuft danach durch dieselbe Pipeline wie jede andere Figur (`npm run sprites`). Sie sind statisch, also bleibt die SVG-Regel für sie in Kraft.
- **Rasterstufen nach Zoom.** Pro Figur werden wenige Auflösungsstufen vorgehalten (etwa 0,5x, 1x, 2x mal devicePixelRatio) und die passende gewählt, damit beim Zoomen nichts unscharf wird.
- **Statische Teile als Sprite, Bewegung im Code.** Bunker, Gehäuse, Körper, Köpfe und Klingen kommen aus dem SVG. Was sich bewegt, wird wie im Stiltest per Code gezeichnet: schwenkende Waffen, Flammen, Blitze, Insektenbeine im Laufzyklus, Flügelschlag.
- Die Zerlegung ist in M4 passiert (`tests/tools/split-towers.py` und `split-enemies.py`, beides einmalige Eingriffe in `reference/konzept/`). Die Symbolbibliothek trägt seitdem pro Figur mehrere Teile:

| Teil | Stellungen | Gegner |
|---|---|---|
| `-back` | Sockelaufbau, Mast, Tanks | Beine oder Flügel hinter dem Körper |
| `-gun` / `-body` | Waffe, dreht sich zum Ziel | Körper |
| `-front` | Sandsäcke und Kisten vor der Waffe | Beine oder Flügel vor dem Körper |

  Für die Stellungen tritt seit v5 der Bunker-Baukasten an die Stelle dieser Aufteilung: ein Bunkerteil je Rangstufe und ein Aufsatz je Doktrin. Der Aufsatz dreht sich nicht, er wird zum Ziel hin gespiegelt, wie ein Gegner.

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
- **Leistung:** Koloss und Gunship existieren höchstens einmal gleichzeitig. Farbwerte der Schattierung zwischenspeichern, wie in der Studie (`shadeCache`).

**Warum kein SVG.** Ein SVG kennt keine Normalen. Vier Standbilder statt des Modells würden bedeuten, dass jede Änderung viermal nachgezogen werden muss und die richtungsabhängige Schattierung verlorengeht. Für statische Figuren gilt die SVG-Regel deshalb unverändert weiter; die Ausnahme greift nur, wo eine Figur sich um die Hochachse dreht.
