# Nachschubfront: Grafikleitfaden

Verbindliche Gestaltungsregeln für alle Figuren. Die Konzeptskizzen liegen als SVG in `reference/konzept/` und sind die Grafikquelle für das Spiel.

Für Bunker, Aufsätze, Spezialstellungen, Koloss und Gunship sind seit v5 die beiden interaktiven Studien in `reference/studien/` die verbindliche Vorlage. Sie laufen direkt im Browser und enthalten den vollständigen Zeichencode. Maße, Farben und Formen dort übernehmen, nicht nachempfinden. Die PNGs in `reference/konzept/stellungen/` und `reference/konzept/koloss/` sind Standbilder daraus.

- `stellungen-simulation.html`: Bunker mit allen Rängen, sechs Standard-Aufsätze, Spezialbasis, sechs Spezialwaffen inklusive Effekten.
- `koloss-studie.html`: Koloss, Zielvorhersage, Durchbruch, Bollwerk-Stopp, Luftschlag mit Gunship, alle vier Fahrtrichtungen.

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

Ersetzt die frühere Kapselform (schlanker Zylinder mit Kegelspitze, wirkte wie eine Rakete). Konzept: `reference/konzept/kapsel/kapsel-geschlossen.svg` (Variante `pod-b`) und `kapsel-geoeffnet.svg` (`open-b`). Die Blätter zeigen daneben verworfene Entwürfe (`pod-a`, `pod-c`, `open-a`, `open-c`); verbindlich sind `pod-b` und `open-b`.

### Geschlossen

- **Kegelstumpf, facettiert.** Unten deutlich breiter als oben, flaches Dach statt Spitze. Die Wand besteht aus ebenen Facetten mit sichtbaren Kanten, nicht aus einer gerundeten Fläche.
- Verhältnis als Richtwert: Fußbreite zu Kopfbreite etwa 5 zu 3, Höhe etwa doppelte Fußbreite.
- Vier Wandsegmente. Die Segmentfugen laufen als kräftige Kanten von oben nach unten. Von vorn sind drei Facetten zu sehen: die helle linke, die mittlere und die dunkle rechte.
- Am Fuß ein umlaufendes Warnband (Gefahrenstreifen), darunter der verrußte Hitzeschildrand.
- Unter dem Dach ein rotes Band, auf dem vorderen Segment eine dunkle Lukenplatte mit Emblem.
- Auf dem Dach drei bis vier Bremsdüsen, am Fuß zwei orangefarbene Positionsleuchten.
- Nieten entlang der Segmentkanten.

### Geöffnet

- **Das Dach bleibt stehen.** Nur der untere Teil der vier Segmente klappt nach außen; das Dach mit den Bremsdüsen bleibt oben auf dem stehenden Kern. Die Kapsel wirkt dadurch wie eine dauerhafte Station und nicht wie Trümmer. Das ersetzt die erste Fassung aus M4c, bei der zu wenig von der Kapsel übrig blieb.
- Die vier abgeklappten Segmentteile liegen flach nach außen, Ecken abgeschrägt, mit Scharnierbolzen in der Mitte jedes Segments.
- Der stehende Kern trägt weiter das rote Band unter dem Dach und leuchtet in der Farbe der Doktrin, darüber die Lichtsäule zum Hologramm.
- Geöffnet greift die Kapsel sichtbar auf die Nachbarfelder über. Die geöffnete Darstellung deshalb etwa 15 Prozent kleiner zeichnen als die Skizze, damit benachbarte Stellungen nicht verdeckt werden.
- Die Kapsel darf im geschlossenen Zustand auch auf der kleinsten Zoomstufe nicht mit einer Stellung zu verwechseln sein: Stellungen stehen auf dem Rautensockel, die Kapsel auf ihrem eigenen runden Hitzeschild.

### Größe und Falldauer (v3)

- **Etwa 20 Prozent kleiner** als bisher, geschlossen wie geöffnet. Bei bis zu sechs Kapseln pro Salve überlappten benachbarte Landezonen einander und verdeckten sich gegenseitig.
- **Der Fall dauert länger**, gut das Doppelte, damit die Salve geordneter wirkt und einzelne Einschläge auseinanderzuhalten sind. Bremstriebwerke, Einschlag, Öffnen und Hologramm ziehen proportional mit und werden nicht gestaucht. Die Staffelung zwischen zwei Kapseln steigt nur leicht, damit eine Salve nicht doppelt so lange dauert wie vorher (Entscheidung vom 24.09.2026).
- **Das Hologramm schrumpft um denselben Fünftel** und schwebt auf vier verschiedenen Höhen: Die Höhe ergibt sich aus dem Feld (zwei Schritte nach rechts, drei nach unten, modulo vier), sodass alle vier Nachbarn eines Feldes auf verschiedenen Ebenen stehen. Sonst schreiben Kapseln auf benachbarten Feldern ihre Beschriftung übereinander — die Zeile ist breiter als eine Zelle, die kleinere Kapsel allein löst das nicht (Entscheidung vom 24.09.2026).

### Farbe im Kern und Leuchten

Kern-Leuchten, Lichtsäule und Hologramm tragen die Leitfarbe der Doktrin und bleiben deshalb Code, nicht Sprite. Die Sprites selbst sind farbneutral.

### Ablauf

Die Sequenz bleibt wie in M4 umgesetzt: Zielmarkierung, Absturz, Bremstriebwerke, Einschlag, Dampf, Sprengbolzen, Öffnen, Hologramm. Geändert wird nur die Form. Der geschlossene Zustand ist von M4c unverändert.

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

**Rezept-Vorschau.** Sobald eine ausgewählte Kapsel ein Rezept ergeben würde, bekommen alle dafür verbrauchten bestehenden Stellungen eine pulsierende goldene Umrandung. Alles andere auf der Karte — Gelände, Trümmer, unbeteiligte Stellungen — wird um etwa 40 Prozent abgedunkelt und leicht transparent. Damit ist sofort erkennbar, was verloren geht.

**Goldener Bodenring der Rezept-Stellungen.** Zu prüfen mit `npm run ringcheck` (Rezept-Stellungen auf benachbarten Feldern, Zoom als Parameter). Der Ring liegt auf Bodenhöhe, wie der Schatten unter einer Figur, und gehört deshalb in den Bodendurchgang — gezeichnet, bevor die tiefensortierten Objekte an der Reihe sind. Er darf unter keinem Zoom und keiner Kameraposition über einem Bauwerk liegen. Bis v3 wurde er zusammen mit seiner eigenen Stellung gezeichnet und legte sich dabei über die Sockelkante der beiden Nachbarn dahinter, weil die Ellipse an den Diagonalen über den Bodenrhombus ihrer Zelle hinausragt.

**Geräumte Trümmerfelder.** Ein im Abbruchmodus geräumtes Feld behält denselben gestrichelten Goldring wie eine Zielmarkierung, nur schwächer (geringere Deckkraft), bis die Planungsphase endet oder eine Kapsel darauf landet. So findet man das freigeräumte Feld beim Anfordern der nächsten Salve wieder.

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

### Untere Leiste

Von links nach rechts: Nachschub-Scheibe (Stufe als goldenes Zahlen-Badge oben rechts, Preis klein darunter), Abriss-Scheibe (Mülleimer), Bollwerk-Scheibe, mittig der große goldene Hauptknopf „Salve anfordern" mit kleinem Kapsel-Symbol — er bleibt bewusst größer und mit Text, weil er die zentrale Handlung jeder Runde ist —, rechts die kompakte Tempo-Gruppe (Pause, 1x, 2x, 3x) als einfache quadratische Knöpfe, der aktive golden hervorgehoben.

Der Zonenzähler steht auf dem Salve-Knopf, nicht mehr in der Statusleiste. Die Rang-Wahrscheinlichkeiten des Nachschubs stehen in der Sprechblase seiner Scheibe, nicht mehr als Balkenreihe auf dem Knopf.

### Rechte Kommandoleiste

Eigene senkrechte Leiste am rechten Bildschirmrand, ausschließlich Runenscheiben ohne Text. Die Reihenfolge von oben nach unten ist die Freischalt-Reihenfolge (Orbitalschlag, Stasisfeld, Luftschlag, Heiliges Banner). Zustände wie oben. Kommen später weitere Kommandos dazu, wird die Leiste ab einer Anzahl scrollbar, die auf dem Tablet-Querformat noch ganz sichtbar ist.

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

**Fortsetzen ohne Zwischenspeicher.** Einen Spielstand mitten im Feldzug gibt es nicht (`docs/SPEICHER.md`). „Fortsetzen" führt deshalb in die laufende Partie zurück und ist ausgegraut, solange keine läuft — also auf dem kalten Titelbildschirm (Entscheidung vom 25.09.2026).

## Technische Umsetzung

- **SVG als Quelle, Canvas als Ausgabe.** Die SVGs werden beim Start einmal in Offscreen-Canvas gerastert und danach nur noch per `drawImage` gezeichnet. Kein SVG-Zeichnen pro Frame.
- **Ausnahme: drehbare Modelle.** Figuren, die in mehreren Achsrichtungen stimmen müssen — Koloss und Gunship — sind kein SVG, sondern werden aus einfachen Körpern in lokalen Koordinaten aufgebaut (siehe „Drehbare Modelle" unten). Sie werden genauso einmal je Richtung gerastert; die Ausgabe ist identisch, nur die Quelle ist Zeichencode statt Zeichnung. Der Grund steht dort.
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

  Die Kapsel kommt in M4c dazu: geschlossen ein Stück, geöffnet ein Kern (seit M4d mit dem Dach darauf) und vier einzeln ansteuerbare Segmentklappen, damit sie wie bisher nacheinander aufklappen.

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
