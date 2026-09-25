# Nachschubfront: Game-Design-Dokument

Stand: Grundlagen v3 (nach Spieltest 2: Koloss als späte Bedrohung, Bollwerk, Landezonen auf Trümmern, Luftschlag und geschärfte Kommandos). Alle Zahlen sind Startwerte für das Balancing und liegen später in Datendateien, nicht im Code.

## 1. Vision

Ein Tower-Defense-Spiel im Stil der klassischen Mazing-Maps (Vorbild: Gem TD aus Warcraft 3), angesiedelt in einem eigenen Grimdark-Sci-Fi-Setting. Der Spieler verteidigt eine Bastion gegen immer stärkere Wellen einer insektoiden Schwarmbrut und ihrer Warp-Kreaturen. Vor jeder Welle fordert er eine Salve Nachschubkapseln an, bestimmt ihre Landezonen, behält eine Waffenstellung und lässt die übrigen zu Trümmern werden. So entsteht Runde für Runde ein Labyrinth, das in jeder Partie anders aussieht.

Kernerlebnis: Jede Runde verlangt eine Abwägung zwischen Feuerkraft (welche Stellung behalte ich?) und Wegführung (wo stehen meine Trümmer?). Die Kapseleinschläge sind der spektakuläre Höhepunkt jeder Runde.

Setting: eigene Namen und Fraktionen, inspiriert vom Grimdark-Genre (gotische Ruinen, fanatische Verteidiger, Schwarmbrut aus Chitin und Klingen, Warp-Kreaturen). Keine geschützten Namen, Logos oder Figuren aus Warhammer 40k oder One Page Rules.

Optik: 2D-Isometrie im Comicstil mit dicken Tuschekonturen, harter Zellschattierung, schmutziger Palette (Rost, Knochenweiß, Blutrot, Giftgrün) und kräftigen Effekten. Referenz: `reference/stiltest.html`. Gestaltungsregeln für Stellungen und Gegner (Silhouetten, Leitfarben, Rangdetails, Rüstungsmerkmale, Sprite-Technik): `docs/ART.md`, Konzeptgrafiken in `reference/konzept/`.

## 2. Plattform und Rahmen

- Browser-Spiel, gehostet auf GitHub Pages, installierbar als PWA (Vollbild, offline spielbar).
- Desktop mit Maus und Tablet mit Touch sind gleichwertige Zielplattformen. Das Tablet auf der Couch ist der wichtigste Einsatzfall. Querformat.
- Oberfläche auf Deutsch.
- Spielgeschwindigkeit: Pause, 1x, 2x, 3x.
- Partielänge: grob 45 bis 60 Minuten für 50 Wellen. Kein Zwischenspeichern mitten in der Partie in Version 1.
- Speichern nur lokal im Browser (Bestwerte, Statistiken, Einstellungen), mit Export und Import als Datei. Architektur so, dass später eine Online-Bestenliste ergänzt werden kann.

## 3. Spielablauf

Eine Partie besteht aus bis zu 50 Wellen. Jede Runde hat vier Phasen:

1. **Planung** (ohne Zeitdruck): Der Spieler markiert bis zu so viele Landezonen auf freien Feldern, wie die kommende Salve Kapseln hat. Die aktuelle Route der Gegner wird als gestrichelte Linie mit Längenangabe angezeigt und aktualisiert sich bei jeder Markierung. Eine Markierung, die den Weg blockieren würde, wird rot angezeigt und ist ungültig. In dieser Phase kann auch Requisition ausgegeben werden. Nicht markierte Zonen werden beim Anfordern zufällig ergänzt.
2. **Salve:** Die Kapseln schlagen gestaffelt ein (Vorwarnung, Absturz, Bremstriebwerke, Einschlag, Öffnen, Hologramm). Jede enthält eine zufällige Doktrin mit einem Rang gemäß Nachschubstufe.
3. **Auswahl:** Der Spieler wählt genau eine der Optionen:
   - eine Stellung behalten,
   - zwei identische Stellungen (gleiche Doktrin, gleicher Rang) aus dieser Salve verschmelzen: das Ergebnis hat einen Rang mehr und steht auf dem Feld einer der beiden,
   - vier identische verschmelzen: zwei Ränge mehr,
   - ein Rezept erfüllen (siehe Abschnitt 8).

   Alle nicht verwendeten Kapseln dieser Salve werden zu Trümmern (Hindernis, kein Angriff).
4. **Welle:** Gegner laufen vom Warp-Riss über alle Signalfeuer in fester Reihenfolge zur Bastion. In dieser Phase können Spezialkommandos eingesetzt werden. Danach Wellenbonus und zurück zur Planung.

Kapseln werden ausschließlich in der Planungsphase angefordert. Während einer Welle ändert sich das Labyrinth nicht.

### Landezonen auf Trümmern

Eine Landezone darf auch auf einem Trümmerfeld liegen. Wird die dort gelandete Kapsel in der Auswahlphase tatsächlich gewählt und dort gebaut, wird der reguläre Abrisspreis automatisch von der Requisition abgezogen. Wird stattdessen eine andere Kapsel der Salve gewählt, bleibt das Feld unverändert Trümmer und es entstehen keine Kosten. Die Route ändert sich dadurch nie, das Feld war schon blockiert.

Reicht die Requisition für den Abriss nicht, ist die Wahl dieser Kapsel nicht möglich; die übrigen Kapseln der Salve bleiben wählbar.

### Salvengröße

Die Anzahl der Kapseln pro Salve hängt von der Welle ab:

| Wellen | Kapseln pro Salve | Mindestrang |
|---|---|---|
| 1 bis 15 | 6 | keiner |
| 16 bis 35 | 5 | keiner |
| ab 36 | 4 | Veteran (kein Rekrut mehr) |

Früh entsteht das Labyrinth schneller und die Karte füllt sich dort, wo noch Platz ist. Spät entstehen weniger neue Trümmer, dafür ist jede einzelne Kapsel wertvoller. Die Anzahl wird in der Planungsphase angezeigt.

## 4. Karte

- Größe 24 x 24 Felder, Kamera mit Zoom und Verschieben.
- Jede Partie wird aus einem Zufallswert (Seed) erzeugt. Der Seed wird angezeigt und kann eingegeben werden, damit Freunde dieselbe Karte spielen und vergleichen können.
- Fest platziert: Warp-Riss an einer Kante, Bastion an der gegenüberliegenden Kante und **zwei** Signalfeuer.
- Platzierungsregel für die Signalfeuer: je eines in einer anderen Kartenhälfte, Mindestabstand 10 Felder zueinander und je 8 Felder zu Riss und Bastion. Ziel ist ein kurzer, offener Grundweg, den der Spieler selbst verlängern muss.
- Zufällig: 12 bis 20 Ruinen, Krater und Mauerreste als vorhandene Hindernisse. Der Generator stellt sicher, dass der Weg über beide Signalfeuer möglich ist.
- Geschützte Felder: Riss, Signalfeuer, Bastion und jeweils ihr direktes Umfeld (1 Feld) dürfen nicht bebaut werden.
- Bauwerke auf der Karte: Stellungen, Trümmer und **Bollwerke** (Abschnitt 10). Alle drei blockieren ihr Feld.

## 5. Wegfindung

- Gegner laufen in acht Richtungen. Diagonale Schritte sind nur erlaubt, wenn beide angrenzenden Felder frei sind (kein Eckenschneiden).
- Die Route ist eine Kette von Teilstrecken: Riss zu Signalfeuer 1, 1 zu 2, 2 zur Bastion. Jede Teilstrecke ist der kürzeste Weg.
- Eine Markierung ist gültig, wenn danach jede Teilstrecke weiterhin einen Weg hat. Die Prüfung muss schnell genug sein, um sie beim Antippen sofort anzuzeigen.
- Flieger ignorieren Hindernisse und fliegen geradlinig von Punkt zu Punkt derselben Kette.

## 6. Doktrinen (Waffenstellungen)

| Doktrin | Schaden (Rekrut) | Feuerrate | Reichweite | Ziele | Besonderheit |
|---|---|---|---|---|---|
| Flamme | 18 pro Sekunde | Dauerfeuer | 2,0 | Boden | Kegel trifft mehrere Gegner, Brand 6/s für 3 s |
| Autokanone | 6 pro Schuss | 5/s | 3,5 | Boden, Luft | Schnelles Einzelfeuer |
| Laser | 40 pro Strahl | 0,8/s | 4,5 | Boden, Luft | Durchschlägt alle Gegner auf einer Linie |
| Mörser | 30, Radius 1,2 | 0,45/s | 1,5 bis 7,0 | Boden | Flugzeit etwa 1 s, Mindestreichweite |
| Psi | 4 pro Sekunde | Aura | 3,0 | Boden, Luft | Verlangsamt um 30 %, dreifacher Schaden gegen Schilde |
| Tesla | 14 pro Blitz | 1/s | 3,0 | Boden, Luft | Springt auf bis zu 4 Ziele, je Sprung minus 20 % |

Reichweiten in Feldern. Stellungen können nicht aufgewertet, verkauft oder versetzt werden. Stärker werden sie nur über Verschmelzen und Rezepte.

### Ränge

| Rang | Schadensfaktor | Reichweite |
|---|---|---|
| Rekrut | 1 | Basis |
| Veteran | 2,2 | +5 % |
| Elite | 5 | +10 % |
| Held | 12 | +15 % |
| Legende | 30 | +20 % |

Darstellung am Hologramm und an der Stellung als Winkelabzeichen (1 bis 5).

## 7. Nachschubstufe

Die Nachschubstufe bestimmt die Rang-Wahrscheinlichkeiten jeder Kapsel. Sie wird mit Requisition erhöht.

| Stufe | Kosten | Rekrut | Veteran | Elite | Held | Legende |
|---|---|---|---|---|---|---|
| 1 | Start | 100 | 0 | 0 | 0 | 0 |
| 2 | 20 | 80 | 20 | 0 | 0 | 0 |
| 3 | 40 | 60 | 30 | 10 | 0 | 0 |
| 4 | 80 | 40 | 40 | 20 | 0 | 0 |
| 5 | 120 | 30 | 35 | 30 | 5 | 0 |
| 6 | 180 | 20 | 30 | 35 | 15 | 0 |
| 7 | 250 | 10 | 25 | 40 | 20 | 5 |
| 8 | 350 | 5 | 20 | 35 | 30 | 10 |

Angaben in Prozent.

## 8. Rezepte

Ein Rezept besteht aus drei verschiedenen Doktrinen mit Mindestrang. Es kann in der Auswahlphase erfüllt werden, wenn die Kapseln dieser Salve zusammen mit bereits stehenden Stellungen alle Zutaten enthalten und mindestens eine Zutat aus der aktuellen Salve stammt. Die Spezialstellung entsteht auf dem Feld dieser Kapsel. Verbrauchte bestehende Stellungen werden zu Trümmern, die übrigen Kapseln ebenfalls.

| Spezialstellung | Zutaten | Mindestrang | Wirkung (Startidee) |
|---|---|---|---|
| Reinigungsschrein | Flamme, Psi, Mörser | Veteran | Großer Flammenring, verlangsamt, Brand stapelt |
| Sturmbatterie | Autokanone, Laser, Tesla | Veteran | Schnellfeuer auf drei Ziele, stark gegen Luft |
| Glutkessel | Flamme, Tesla, Autokanone | Veteran | Brennende Aura, Blitze entzünden |
| Belagerungsmörser | Mörser, Laser, Autokanone | Elite | Sehr große Reichweite, riesiger Explosionsradius |
| Gewitterturm | Tesla, Psi, Laser | Elite | Kette über 8 Ziele, kurze Betäubung |
| Seelenfeuer-Obelisk | Psi, Flamme, Tesla | Held | Schaden in Prozent der maximalen Lebenspunkte, Waffe gegen Bosse |

Weitere Rezepte folgen nach den ersten Tests. Rezepte sind im Spiel über ein Nachschlagewerk einsehbar.

## 9. Gegner

### Rüstungsarten und Schadensmatrix

| | Fleisch | Panzer | Warp-Schild | Flieger |
|---|---|---|---|---|
| Flamme | 1,5 | 0,5 | 1,0 | 0 |
| Autokanone | 1,0 | 0,75 | 0,5 | 1,5 |
| Laser | 0,75 | 1,5 | 1,0 | 1,0 |
| Mörser | 1,5 | 1,0 | 1,0 | 0 |
| Psi | 1,0 | 0,5 | 3,0 | 1,0 |
| Tesla | 1,25 | 0,5 | 1,5 | 1,0 |

Warp-Schild: Der Schild absorbiert Schaden zuerst und regeneriert sich nach 2 Sekunden ohne Treffer. Die Matrix gilt für den Schild, darunter hat der Gegner Fleisch.

### Gegnertypen

| Typ | Rüstung | Leben (Welle 1) | Tempo | Belohnung | Besonderheit |
|---|---|---|---|---|---|
| Schwärmer | Fleisch | 30 | 1,6 | 1 | Kommt in großen Gruppen |
| Krieger | Fleisch | 70 | 1,1 | 2 | Standardgegner |
| Brecher | Panzer | 220 | 0,6 | 5 | Langsam und zäh |
| Warp-Seher | Warp-Schild | 60 + 60 Schild | 1,0 | 4 | Schild regeneriert 10/s |
| Aasflieger | Flieger | 50 | 1,4 | 3 | Ignoriert das Labyrinth |
| Zerplatzer | Fleisch | 90 | 0,9 | 3 | Setzt beim Tod 4 Schwärmer frei |
| Heiler | Fleisch | 80 | 0,9 | 4 | Heilt Gegner im Radius 1,5 um 8/s |

Tempo in Feldern pro Sekunde.

### Bosse (jede zehnte Welle)

| Welle | Boss | Idee |
|---|---|---|
| 10 | Brutmutter | Fleisch, setzt unterwegs Schwärmer frei |
| 20 | Kolossbrecher | Panzer, extrem viele Lebenspunkte |
| 30 | Warp-Herold | Warp-Schild, springt gelegentlich ein Stück entlang der Route vor |
| 40 | Schwarmkönigin | Fliegend, von Aasfliegern begleitet |
| 50 | Dämonenprinz | Wechselt alle paar Sekunden die Rüstungsart |

### Späte Bedrohung: der Koloss

Zusätzlich zur regulären Welle erscheint ab einer späten Welle ein **Koloss**: eine extrem zähe, gepanzerte Kriegsmaschine, deutlich robuster als ein normaler Boss. Eigenständiges Design, keine Anlehnung an geschützte Fahrzeugvorlagen.

Name im Spiel: **Koloss**. Nicht „Titan" — das ist im Grimdark-Sci-Fi-Genre ein feststehender, markenrechtlich belegter Begriff für genau diese Art Kriegsmaschine.

**Auftritt:** Welle 35 und 45 (Startwerte, als Datenwerte einstellbar). Das Update v3 nannte „ab Welle 30, alle 10 Wellen"; weil 30, 40 und 50 bereits Bosswellen sind, ist der Auftritt um fünf Wellen versetzt, damit Koloss und Boss einander nicht die Wirkung nehmen und der Spieler seine Kommandos gezielt für einen von beiden aufsparen kann (Entscheidung vom 24.09.2026). Der Abstand von 10 Wellen bleibt.

**Ankündigung in drei Stufen:**

1. **Zwei Wellen vor Ankunft:** allgemeine Warnung („Ein Koloss nähert sich, Ankunft in 2 Wellen"), noch kein Ziel.
2. **Eine Welle vor Ankunft:** Zielvorhersage — die Stelle mit der geringsten Feuerkraft in Reichweite auf dem kürzesten Weg zur Bastion. Geschützte Felder (Riss, Signalfeuer, Bastion und ihr Umfeld) sind ausgenommen: Eine Markierung dort wäre eine Drohung, auf die der Spieler nicht antworten darf. Verstärkt er die Stelle, rückt die Vorhersage sofort auf die nächstschwächste. Als Verstärkung zählt Feuerkraft in Reichweite und ein Bollwerk in der Nähe.
3. **Die Welle des Auftritts:** Das Ziel ist fest, sobald die Welle beginnt — die Planungsphase davor gehört noch dem Spieler. Der Koloss erscheint und fährt direkt darauf zu.

**Durchbruch:** Am Ziel angekommen reißt der Koloss eine gerade Schneise von etwa 5 Feldern (Startwert) in seiner Fahrtrichtung durch das Labyrinth. Getroffene Trümmerfelder werden zerstört. Die Schneise endet, wo sie auf etwas Gebautes trifft: ein **Bollwerk** oder eine **Stellung**. Beide bleiben dabei stehen. Der Durchbruch selbst kostet keine Leben. Danach nimmt der Koloss den kürzesten Weg zur Bastion — eine Maschine, die gerade durchgebrochen ist, läuft die Signalfeuer nicht mehr ab — und bleibt durch Stellungen und Kommandos bekämpfbar.

„Ausreichend verstärkt" heißt also: mit Bollwerken abgeriegelt (Entscheidung vom 24.09.2026). Feuerkraft verhindert den Rammstoß nicht, sie verhindert, dass er überhaupt ankommt.

**Erreicht der Koloss die Bastion**, kostet das 15 Leben statt der 5 eines normalen Bosses (Startwert, im Balancing zu justieren).

**Stärke:** Der Koloss ist so ausgelegt, dass unverstärkte Stellungen ihn in der Regel nicht rechtzeitig stoppen. Der gezielte Einsatz von Spezialkommandos, besonders des Luftschlags, ist meist nötig, um Durchbruch oder das Erreichen der Bastion zu verhindern. Jeder Schadensdeckel gegen Bosse (Orbitalschlag, Luftschlag) gilt gegen den Koloss genauso; kein Kommando darf ihn in einem Einsatz töten können.

### Wellenaufbau

- Fünferzyklus: Horde, Panzer, Flieger, Warp, gemischt. Jede zehnte Welle ersetzt den Zyklus durch einen Boss mit Begleitung.
- Lebenspunkte wachsen um 12 % pro Welle (Faktor 1,12 hoch Welle minus 1).
- Gegneranzahl steigt langsam, etwa 12 plus 0,5 pro Welle, bei Schwärmern das Doppelte.
- Die komplette Wellenliste liegt als Datentabelle vor und ist ohne Codeänderung anpassbar.

### Einstieg

Weil der Grundweg mit zwei Signalfeuern kürzer ist, sind die ersten Wellen entschärft:

- Wellen 1 bis 5: Gegneranzahl minus 30 Prozent.
- Panzergegner (Brecher) erst ab Welle 4, Flieger erst ab Welle 6.

## 10. Wirtschaft

- **Requisition** gibt es pro Abschuss (Belohnung laut Tabelle) und als Wellenbonus (10 plus Wellennummer).
- Ausgaben: Nachschubstufe erhöhen (Abschnitt 7), Abreißen und Bollwerke bauen.
- Abreißen gilt für Trümmer **und** eigene Stellungen, damit späte Karten umgebaut werden können. Trümmer kosten 15, jedes weitere Abreißen in derselben Partie 5 mehr. Eine Stellung kostet das Dreifache des aktuellen Trümmerpreises und gibt nichts zurück.
- Abgerissen wird nur in der Planungsphase. Der Weg muss danach offen bleiben, sonst wird abgelehnt.
- **Kommandopunkte** sind eine eigene Währung: 3 pro besiegtem Boss, 1 pro Welle ohne Durchbruch.

### Bollwerk

Ein **Bollwerk** entsteht aus einem Trümmerfeld. Es greift nicht an und blockiert die Route wie Trümmer, übersteht aber im Gegensatz zu ihnen den Rammstoß eines Koloss-Durchbruchs. Damit ist es zugleich eine Senke für überschüssige Requisition im späten Spiel.

Der Preis liegt über dem regulären Abrisspreis, weil ein Bollwerk zusätzlich zum Räumen auch einen Neubau darstellt. Gebaut wird nur in der Planungsphase. Der Weg bleibt unverändert, das Feld war schon blockiert.

## 11. Spezialkommandos

Einsatz jederzeit während einer Welle, außer wo anders angegeben. Sie setzen keine Hindernisse.

| Kommando | Kosten | Ab Welle | Abklingzeit | Wirkung |
|---|---|---|---|---|
| Orbitalschlag | 4 KP | 15 | 3 Wellen | Ziel markieren, 2 s Vorwarnung, dann massiver Flächenschaden (Radius 3). Gegen Bosse und den Koloss höchstens 25 % ihrer maximalen Lebenspunkte |
| Stasisfeld | 2 KP | 20 | 2 Wellen | Friert Gegner im Radius 2,5 für 5 s ein, Bosse und den Koloss für 2 s |
| Priorisierter Nachschub | 3 KP | 25 | 3 Wellen | Nur in der Planung: nächste Salve erhält garantiert einen Rang mehr, ab Nachschubstufe 6 zwei Ränge |
| Heiliges Banner | 2 KP | 30 | 2 Wellen | Stellungen im Radius 2,5 verursachen eine Welle lang 50 % mehr Schaden |
| Luftschlag | 4 KP | 30 | 4 Wellen | Linienziel: Start- und Endpunkt markieren. Nach kurzer Vorwarnung fliegt ein Geschwader die Linie ab und verursacht Flächenschaden entlang des ganzen Streifens, mit Bonus gegen die Rüstungsart Panzer. Gegen Bosse und den Koloss höchstens 30 % ihrer maximalen Lebenspunkte |

## 12. Sieg, Niederlage, Wertung

- Die Bastion hat 20 Leben. Normale Gegner kosten beim Durchbruch 1, Bosse 5, der Koloss 15. Bei 0 ist die Partie verloren.
- Nach Welle 50 ist die Partie gewonnen, optional geht es im Endlosmodus weiter.
- Punkte: erreichte Welle x 1000 plus Abschüsse plus verbleibende Leben x 200. Gespeichert werden Bestwerte pro Seed und insgesamt.

## 13. Bedienung

| Aktion | Maus | Touch |
|---|---|---|
| Landezone markieren oder entfernen | Linksklick | Tippen |
| Karte verschieben | Rechte oder mittlere Maustaste ziehen, Pfeiltasten | Mit einem Finger ziehen |
| Zoomen | Mausrad | Zwei Finger |
| Infos zu Stellung, Gegner, Feld | Mauszeiger darüber oder Klick | Langes Drücken |
| Kommando zielen | Klick auf Ziel | Tippen auf Ziel |

**Abbruchmodus.** Eigener Knopf in der Planungsphase. Ist er aktiv, werden alle abreißbaren Felder hervorgehoben und der Preis steht am jeweiligen Feld. Antippen reißt ab, auf dem Tablet mit kurzer Bestätigung. Der Modus bleibt aktiv, bis er beendet wird, damit mehrere Felder nacheinander geräumt werden können. Solange er aktiv ist, können keine Landezonen markiert werden.

**Nachschubstufe.** Der Knopf heißt nicht "Nachschub ausbauen", sondern nennt Stufe und Preis, zum Beispiel "Nachschubstufe 3 auf 4, 80". Darunter stehen die neuen Rangchancen als Zeile (zum Beispiel 40 / 40 / 20 / 0 / 0) oder als kleine Balken, jeweils in den Rangfarben. Langes Drücken oder Hover zeigt eine kurze Erklärung: Die Stufe beeinflusst nur künftige Kapseln, nicht bestehende Stellungen.

Regeln: Nichts darf ausschließlich über Hover erreichbar sein. Trefferflächen mindestens 44 x 44 CSS-Pixel. Die Standard-Zoomstufe auf dem Tablet sorgt dafür, dass ein Feld mindestens etwa 40 Pixel breit ist. Wichtige Knöpfe liegen in Daumenreichweite am unteren Rand. Zwischen Tippen und Ziehen wird über eine kleine Bewegungsschwelle unterschieden, damit beim Verschieben keine Markierungen entstehen.

## 14. Offene Punkte

- Fortschritt über mehrere Partien (Freischaltungen, Erfahrung): Entscheidung nach den ersten Tests.
- Online-Bestenliste für Freunde: später, über die vorbereitete Speicherschicht.
- Weitere Rezepte, Karten, Endlosmodus-Details.
- Sprites für Gegner (Blender mit Toon-Shader) falls die Code-Grafik nicht reicht.
- **Unbegrenzte Nachschubstufe (vorgemerkt, noch nicht umsetzen).** Aus der Auswertung von Spieltest 2 stammt die Idee, die Nachschubstufe über Stufe 8 hinaus weiterführbar zu machen: jede weitere Stufe eine leicht höhere Legende-Chance bei stark steigendem Preis, damit auch ganz späte Requisitionsüberschüsse gebunden werden. Mit Till nicht final abgestimmt und deshalb nicht Teil von v3. Separat aufgreifen, falls Bollwerk und teurere Kommandos allein nicht reichen.
- **Aufwertung statt Bau (vorgemerkt, noch nicht umsetzen).** Ab etwa Welle 30 könnte eine vierte Option in der Auswahlphase erscheinen: Eine Kapsel wird nicht gebaut, sondern auf eine bestehende Stellung derselben Doktrin gelegt und hebt sie um einen Rang. Das verlagert die späte Partie vom Bauen zum Veredeln, ohne weitere Felder zu belegen. Entscheidung erst nach dem nächsten Spieltest.
