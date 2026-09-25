# Nachschubfront: Grafikleitfaden

Verbindliche Gestaltungsregeln für alle Figuren. Die Konzeptskizzen liegen als SVG in `reference/konzept/` und sind die Grafikquelle für das Spiel.

Stand: v4 (HUD in Runenscheiben-Optik, fünf Menü-Bildschirme, alle sechs Spezialstellungen als eigene Bauwerke mit Wirkungsanker).

## Grundregeln

- **Silhouette vor Detail.** Jede Figur muss als reiner Schatten eindeutig erkennbar sein, auch auf der kleinsten Zoomstufe.
- **Comicstil wie im Stiltest.** Dunkle Tuschekonturen (#1a1410), zwei bis drei harte Schattierungsstufen, keine weichen Verläufe auf Figuren. Leuchten nur über halbtransparente Flächen.
- **Blickrichtung.** Gegner sind nach links gezeichnet. Im Spiel werden sie je nach Laufrichtung horizontal gespiegelt. Keine acht Richtungen.

## Stellungen

- Alle Stellungen stehen auf demselben Betonsockel mit Warnstreifen (`sockel.svg`). Er grenzt eigene Bauwerke klar von Trümmern ab.
- Jede Doktrin hat eine eigene Grundform und eine Leitfarbe, die auch im Kapsel-Hologramm verwendet wird:

| Doktrin | Grundform | Leitfarbe |
|---|---|---|
| Flamme | Gemeinsamer Bunker, Flammenstoß aus den Scharten | #ff8a2a |
| Autokanone | Gemeinsamer Bunker, Mündungsblitz an den Scharten | #f0e2b8 |
| Laser | Schlanker Mast, schwenkbare Strahlkanone mit Energiezellen, seit M4d etwa 30 Prozent kleiner | #ff4a4a |
| Mörser | Flache Grube, steiles Rohr, Granatkiste | #d8ae5f |
| Psi | Gotischer Schrein, schwebender Kristall mit Ringen | #b784ff |
| Tesla | Kupferspule mit Kugel, Blitze | #5fd4ff |

**Gemeinsamer Bunker.** Flamme und Autokanone teilen sich seit M4d dieselbe Bunkerform: gedrungen, breiter als hoch, mit drei sichtbaren Schießscharten in der Front. Kein Lauf ragt mehr aus der Stellung heraus. Unterschieden werden die beiden ausschließlich über die Akzentfarbe und den Effekt an der Scharte — Autokanone ein kurzer Mündungsblitz an allen drei Scharten, Flamme ein kurzer Flammenstoß. Der Entwurf kostet die Autokanone ihre Drehkanone und den Munitionskasten; beides gehört nicht mehr zur Grundform.

### Spezialstellungen

Die sechs Rezept-Stellungen (GDD Abschnitt 8) sind seit v4 **eigenständige Bauwerke**, jedes mit eigener Grundform. Die Fahrgestell-Fassung aus v2 ist verworfen: Die Namen legen zu unterschiedliche Formen nahe, als dass zwei Chassis sie alle tragen könnten.

Wie bisher stehen sie auf demselben Sockel, tragen die Goldkante (sie sind die Spitze der Entwicklung, haben aber keinen Rang und darum keine Winkel) und stehen im Spiel in einem goldenen Bodenring. Die Leitfarbe bleibt die der erstgenannten Zutat.

**Wirkungsanker.** Jede Zeile nennt die Stelle am Modell, von der Schuss, Flamme, Blitz oder Aura ausgeht, damit die Wirkung aus GDD Abschnitt 8 nicht an einer generischen Mitte ansetzt. Die Simulation rechnet weiter mit der Feldmitte; den sichtbaren Ursprung setzt allein der Renderer ein (Simulation und Darstellung bleiben getrennt). Die Werte stehen in `src/render/sprites/manifest.js`.

| Spezialstellung | Bauform | Beschreibung | Wirkungsanker |
|---|---|---|---|
| Reinigungsschrein | Gotischer Altar | Steinaltar mit brennender Feuerschale, schwebendem violettem Psi-Splitter darüber, Mörserrohr in den Sockel eingelassen | Die Feuerschale. Der große Flammenring liegt als stehendes Feld um den Schrein selbst (Abweichung, siehe unten) |
| Sturmbatterie | Panzerfahrgestell | Offener Vierlings-Flakturm, im Feuer vier gleichzeitige Mündungsblitze, Hülsen fliegen umher | Die vier Laufmündungen. „Schnellfeuer auf drei Ziele" heißt: Der Turm wählt pro Salve drei Ziele, alle vier Mündungen dürfen dabei gleichzeitig aufblitzen. Er dreht sich nicht, er zeigt nach oben |
| Glutkessel | Eiserner Kessel | Bauchiger Kessel auf Steinsockel, loderndes Feuer innen, vier Tesla-Elektroden am Rand, seitliche Autokanonen-Auslässe | Die brennende Aura geht von der Kesselöffnung oben aus und liegt um den Kessel. Die Blitze, die Gegner entzünden, schlagen von den vier Elektroden am Rand aus |
| Belagerungsmörser | Holz-Stahl-Lafette | Schwere Lafette mit Sandsackring, überlanges Rohr, aufgesetztes Laser-Zielfernrohr | Die Rohrmündung am Ende des langen Rohrs ist der Abschusspunkt, der riesige Explosionsradius liegt am Einschlag. Das Zielfernrohr zeichnet vor dem Schuss kurz eine dünne Laserlinie zum Ziel, rein optisch, als Vorwarnung |
| Gewitterturm | Schlanker Gittermast | Vierbeiniger Mast, oben Tesla-Spule mit schwebendem Psi-Ring | Die Spule an der Mastspitze ist der Ursprung der Kette über acht Ziele, dieselbe Stelle, von der die Umgebungsblitze der Ruheanimation ausgehen |
| Seelenfeuer-Obelisk | Runenobelisk | Höchstes Bauwerk im Spiel, schwebendes Psi-Auge an der Spitze, Blitze, Flammen am Fuß | Das schwebende Auge an der Spitze ist der Ursprung des Schadens in Prozent der maximalen Lebenspunkte, als Strahl auf das Ziel: das Urteil des Obelisken |

Alle sechs Blätter liegen in `reference/konzept/spezialstellungen/`. Die Platzhalter aus M4 (`tests/tools/add-specials.py`) und die beiden nackten Fahrgestelle sind damit erledigt.

**Abweichung beim Reinigungsschrein.** Die Ergänzung v4 legt seinen Abschusspunkt in die Mörserröhre im Sockel und den Flammenring an den Zielort. Umgesetzt bleibt die Aura um den Schrein selbst (`behaviour: 'aura'` in `src/data/specials.js`), weil der Wechsel Spiellogik und Balancing wäre und M5c ausdrücklich keine neue Spiellogik bringt (Entscheidung vom 25.09.2026). Der Anker liegt darum auf der Feuerschale, die Röhre bleibt Detail der Zeichnung und feuert nicht. Wird der Schrein in M6 auf einen Mörser umgestellt, ist die Röhre der Abschusspunkt und der Ring gehört an den Einschlag.

**Sockel.** Die Skizzen zeigen die Bauwerke frei auf dem Boden, mit eigenem Schlagschatten. Im Spiel stehen sie wie jede andere Stellung auf dem gemeinsamen Sockel — er grenzt eigene Bauwerke von Trümmern ab, und der goldene Rand kennzeichnet die Rezept-Stellung. Jede Figur wird dafür um die Höhe ihres eigenen Schlagschattens angehoben, damit ihr Fuß auf der Sockeloberfläche aufsetzt. Der eigene Schlagschatten fällt weg, beim Obelisken auch sein eigener breiter Sockel.

**Was Code ist, nicht Sprite.** Am Obelisken die Flammen am Fuß, die Blitze von der Spitze zum Auge, das Leuchten und der Ring um das Auge; das Auge selbst ist ein Sprite und schwebt wie der Psi-Kristall. An der Sturmbatterie die vier Mündungsblitze und die Patronenhülsen. Dazu seit v4: das Feuer in der Schale des Reinigungsschreins und im Glutkessel samt beider Glut, die Blitze der vier Elektroden des Kessels, die Ringe um den Psi-Splitter des Schreins und um den Psi-Kern des Gewitterturms, dessen Umgebungsblitze, und die Laserlinie des Belagerungsmörsers.

Zwei Teile sind Sprites, die schweben statt zu zielen, wie der Psi-Kristall und das Auge des Obelisken: der Psi-Splitter über dem Reinigungsschrein und der Psi-Kern über der Spule des Gewitterturms. Beweglich zielt nur das Rohr des Belagerungsmörsers; es neigt sich wie das des normalen Mörsers.

### Ränge

Jeder Rang ergänzt ein sichtbares Detail, kumulativ:

| Rang | Ergänzung | Winkel am Sockel | Umsetzung |
|---|---|---|---|
| Rekrut | Grundform | 1 | — |
| Veteran | Sandsackring | 2 | Symbole `sb-back`/`sb-front`; der Mörser hat den Ring schon und bekommt stattdessen eine Munitionskiste (`crate-l`). Die Autokanone stand bis M4d auch in dieser Ausnahme; mit dem gemeinsamen Bunker hat sie keinen eigenen Ring mehr und bekommt den geteilten |
| Elite | Panzerplatten an der Waffe | 3 | erzeugtes SVG quer zum Lauf, auf einem Drittel des Wegs zur Mündung; wo die Waffe nicht zielt (Psi, Tesla, seit M4d beide Bunker) sitzt die Platte am Gehäuse. Am Bunker liegt sie flach an der linken Vorderseite, unterhalb der Scharten, damit sie keine verdeckt |
| Held | Banner | 4 | im Code gezeichnet, weht in der Leitfarbe mit Goldsaum |
| Legende | Goldkanten, Halo | 5 (gold) | Goldkante am Sockelrand als SVG, Halo im Code |

Die Winkel sitzen auf der linken Vorderseite des Sockels. Abweichung: Die Goldkante der Legende läuft am Sockel entlang, nicht an der Figur — ein Umriss pro Doktrin wäre für jede Waffe eine eigene Zeichnung.

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

Die späte Bedrohung aus GDD Abschnitt 9. Eine monströse Kriegsmaschine, kein Insekt: Der Koloss ist das einzige Gegenstück auf dem Feld, das gebaut und nicht gezüchtet wirkt.

- **Eigenständiges Design.** Keine Anlehnung an geschützte Fahrzeugvorlagen aus dem Genre.
- **Silhouette:** breit, kantig, auf Kettenlaufwerk oder schweren Stampfbeinen, deutlich höher und vor allem deutlich **breiter** als jeder Boss. Wo ein Boss eine große Kreatur ist, ist der Koloss eine fahrende Festung — schon als Schattenriss nicht zu verwechseln.
- **Rüstung Panzer**, also die Plattenfarbe der Brecher, aber mit Rost, Nieten und aufgesetzten Schilden statt Chitin.
- **Ramme vorn**: Das Teil, mit dem er die Schneise schlägt, muss sichtbar sein, damit der Durchbruch nicht aus dem Nichts kommt.
- Bewegliche Teile im Code wie bei den Bossen: mahlendes Laufwerk, schwenkender Kopf oder Turm, Rauch aus den Auspuffrohren.

## Bollwerk

Der Bauwerktyp aus GDD Abschnitt 10, gebaut aus einem Trümmerfeld.

- Muss von Trümmern **auf einen Blick** zu unterscheiden sein, sonst weiß der Spieler nicht, welches Feld dem Koloss standhält: aufgeschichtete Blöcke mit klarer, gerader Oberkante statt der unregelmäßigen Trümmerhaufen, dazu Stahlträger oder Klammern an den Ecken.
- Keine Leitfarbe, kein Rang: Es gehört keiner Doktrin und greift nicht an. Farbe aus der Geländepalette, nur die Metallteile heller.
- Etwas höher als ein Trümmerhaufen, aber niedriger als der Sockel einer Stellung, damit es die Karte nicht zustellt.

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
- **Rasterstufen nach Zoom.** Pro Figur werden wenige Auflösungsstufen vorgehalten (etwa 0,5x, 1x, 2x mal devicePixelRatio) und die passende gewählt, damit beim Zoomen nichts unscharf wird.
- **Statische Teile als Sprite, Bewegung im Code.** Sockel, Gehäuse, Körper, Köpfe und Klingen kommen aus dem SVG. Was sich bewegt, wird wie im Stiltest per Code gezeichnet: schwenkende Waffen, Flammen, Blitze, Insektenbeine im Laufzyklus, Flügelschlag.
- Die Zerlegung ist in M4 passiert (`tests/tools/split-towers.py` und `split-enemies.py`, beides einmalige Eingriffe in `reference/konzept/`). Die Symbolbibliothek trägt seitdem pro Figur mehrere Teile:

| Teil | Stellungen | Gegner |
|---|---|---|
| `-back` | Sockelaufbau, Mast, Tanks | Beine oder Flügel hinter dem Körper |
| `-gun` / `-body` | Waffe, dreht sich zum Ziel | Körper |
| `-front` | Sandsäcke und Kisten vor der Waffe | Beine oder Flügel vor dem Körper |

  Die Kapsel kommt in M4c dazu: geschlossen ein Stück, geöffnet ein Kern (seit M4d mit dem Dach darauf) und vier einzeln ansteuerbare Segmentklappen, damit sie wie bisher nacheinander aufklappen.

  Wo die Teile sitzen und wie sie sich bewegen (Drehpunkt, Ruhewinkel, Mündung, Ausschlag), steht in `src/render/sprites/manifest.js`. Der Warp-Seher schwebt und bleibt ein Stück.
- **Aus den SVGs entfernt und jetzt Code** (`src/render/towerFx.js`): Flammenstrahl, Mündungsbögen, Mörserrauch, das Leuchten von Laser und Tesla, die Blitze der Spule, Aura und Ringe des Psi-Schreins. Seit M4d dazu die Mündungsblitze und Flammenstöße an den drei Bunkerscharten und die Feuersequenz der Sturmbatterie.
- Abweichung: Der Bunker von Flamme und Autokanone hat keine zielende Waffe mehr. Beide bleiben ein Stück; gezielt wird nur noch über den Effekt an der Scharte, die zum Ziel zeigt. Das ersetzt die frühere Regelung für die drei Läufe der Autokanone.
- Treffer-Aufblitzen über eine vorgerenderte helle Variante des Sprites, nicht über Filter pro Frame.
