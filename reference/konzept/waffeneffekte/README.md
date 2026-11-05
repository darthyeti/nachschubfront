# Studie Waffeneffekte (A-37, Issue 71)

Studie: `reference/studien/waffeneffekte.html` (Start mit `python3 -m http.server`, dann
`/reference/studien/waffeneffekte.html`). Links „Heute“, rechts „Neu“, je Waffe als Schleife mit Tempo-Regler,
Pause, Einzelschritt und Zoom 0,5x, 1x, 2x. „Heute“ ist die Spielfunktion selbst (`drawTowerSprite` und
`src/render/towerFx.js`), „Neu“ dasselbe Modell mit den neuen Effekten aus `waffeneffekte-modell.js`.
Flamme, Psi und Reinigungsschrein bleiben unverändert und werden auf beiden Seiten vom Spiel gezeichnet.
Standbilder: `node tests/tools/waffeneffekte-stills.mjs` (Chromium, deviceScaleFactor 2).

## Was die Studie zeigt

1. **Maßstab.** Tabelle „Maßstab“ in der Studie und `massstab.png`. Der Laser ist heute mit 12 px Tusche
   breiter als seine eigene Linse (8,4 px) und reicht immer bis ans Ende der Reichweite (4,5 Felder, 161 px
   entlang einer Feldachse). Vorschlag 5 / 3 / 1,2 px, hell bis knapp hinter das Ziel, dann 1,6 px bei 38 %
   bis zum Ende der Reichweite, Dauer 0,16 statt 0,22 s. Seelenstrahl 14 → 8 px, Blitze 6,2 → 3,7 px,
   Leuchtspur 4 → 3 px mit fester Länge (0,5 Felder), Rakete im Flug 6,4 → 4,2 px (so dick wie im Rohr).
2. **Raketenton.** `ROCKET_SOUNDS.rocket` (und `rocketHeavy`) in `waffeneffekte.js`, im Format von
   `src/data/audio.js`: Zündknall, Rohrschlag, Fauchen des Triebwerks, steigendes Pfeifen. Abspielbar über
   „Rakete neu“ und „Rakete schwer“, Vergleich „Start heute (launch)“; in der Schleife über „Ton“.
3. **Sturmbatterie.** Die vier Leuchtspuren fliegen parallel entlang der Läufe, so weit, wie das Hauptziel
   entlang der Laufachse liegt; die übrigen Ziele der Salve zeigen nur Trefferfunken.
4. **Feueraura.** Bei jedem Schuss eine weiche Scheibe und ein sich öffnender dünner Ring in der Leitfarbe an
   der Mündung (Radius 8 bis 22 px, 0,06 bis 0,22 s), bei „Weniger Bewegung“ halb so hell.
5. **Tesla und Gewitterturm.** Blitz 3,7 / 1,3 / 0,6 px mit bis zu 11 Knicken, zwei Haarfäden und darunter
   zwei halbtransparente Bänder (11 px bei 13 %, 5,5 px bei 22 %) als elektrische Aura. Kurze Sprünge bekommen
   weniger und kleinere Zacken.
6. **Belagerungsmörser (Arbeitstitel „Raketenturm“).** Neues Modell (`buildRocketTower`, Körper in lokalen
   Koordinaten): Lafette wie heute, darauf zwei große Startrohre mit je einer Rakete, Zielsucherkopf auf dem
   Rücken. Kein Strahl: In den letzten 0,8 s der Nachladung schließen sich vier Klammern um das Ziel, die Linse
   des Zielsuchers glüht. Ein Geschoss je Schuss, die Rohre wechseln sich ab; das leere Rohr wird zwischen 25 und
   70 % der Nachladung (3,2 s) neu geladen, die zweite Rakete wartet derweil im Rohr. Flug im Bogen auf den
   Einschlagpunkt der Simulation (mit Vorhalt), dabei Einschlagzone in wahrer Splash-Größe (2,6 Felder) und
   ein Kreuz. Bilder `raketenturm-*.png`, Modell in acht Richtungen `raketenturm-modell.png`.

## Kosten

Alle neuen Effekte sind Ebenen über der Stufe; kein Stufen-Cache ist betroffen außer dem neuen Modell des
Belagerungsmörsers. Zeichenschritte (stroke und fill) je Bild, solange der Effekt lebt:

| Effekt | heute | neu |
|---|---|---|
| Feueraura | – | +2 je Schuss (ein Verlauf, ein Ring) |
| Laser | 4 | 6 |
| Tesla, erster Sprung / jeder weitere | 7 / 4 | 8 / 8 |
| Gewitterturm mit 8 Sprüngen | 35 | 64 |
| Leuchtspur | 3 | 3 |
| Rakete im Flug | 5 | 6 (Raketenturm 8 mit Flossen) |
| Zielen Belagerungsmörser | 6 | 9 plus Einschlagzone 2 |

Der Gewitterturm ist der teuerste Fall (fast doppelt so viele Striche für 0,34 s). Bei 200 Gegnern liegt das
weit unter den Gegnerkosten. Das neue Modell hat 160 statt 88 Flächen; ruhend kommt es aus dem Stufen-Cache.
Weil sich der Ladezustand nach jedem Schuss ändert, sollten die zwei Raketen eine eigene Live-Ebene über der
Stufe sein (wie Ring und Kugel des Gewitterturms). Sonst müsste die Waffe während des Nachladens live gezeichnet
werden, also fast die ganze Zeit, solange sie feuert.

## Abweichungen

- **GDD, Rezepte-Tabelle:** „Zielt 0,8 s mit sichtbarem Laser“. Die Studie zeigt das Zielen ohne Laser. Die
  Regel (0,8 s, Vorhalt, ein Geschoss, 3,2 s) bleibt; nur der Wortlaut im GDD und `docs/ART.md` müsste
  nachgezogen werden, wenn Till zustimmt.
- **Laser:** Der helle Strahl endet am Ziel, die Simulation trifft aber alles auf der Linie bis zur vollen
  Reichweite und in 0,5 Feldern Abstand. Deshalb läuft ein blasser Rest bis zum Ende weiter. Ein Strahl, der
  ganz am Ziel endet, würde die Wirkung kleiner zeigen, als sie ist.
- **Sturmbatterie:** Parallele Spuren können Nebenziele in anderer Richtung nicht erreichen. Die Salve trifft
  laut Simulation drei Ziele; sichtbar sind dort nur Funken.
- **Glutkessel:** In der Studie mit den neuen Blitzen gezeigt, obwohl nicht gewünscht (es ist dieselbe
  Blitzfunktion).
- **Studie, nicht Spiel:** In „Neu“ fehlen die drehenden Bohrungen der Autokanone und der Schatten der Waffe.
  Die Waffe wird live aus dem Modell gezeichnet statt aus der Stufe. Die Explosionen sind die der Studie.

## Offene Fragen an Till

1. Belagerungsmörser ohne Laser: GDD-Text „mit sichtbarem Laser“ ändern (Akte nötig)?
2. Ein Raketenton für Raketenwerfer und Raketenturm, oder `rocketHeavy` für den Raketenturm? Das zweite braucht
   in der Tontabelle die Information, welche Stellung gefeuert hat. Heute meldet die Simulation für beide nur
   `launch` mit Doktrin `mortar`; dafür bräuchte das Ereignis ein Feld wie `special`.
3. Laser: blasser Rest bis zum Ende der Reichweite (Vorschlag) oder ganz am Ziel enden?
4. Sturmbatterie: Sind nur Funken an den Nebenzielen genug?
5. Glutkessel mit den neuen Blitzen: ja oder nein?
6. Einschlagzone des Raketenturms in wahrer Größe (2,6 Felder): hilfreich oder zu viel?
7. Feueraura für alle Schusswaffen oder nur für die schweren (Raketen, Laser, Obelisk)?

# Runde 2 (Issue 81, Tills Antwort vom 05.11.2026, Akte E-40)

Die Studie zeigt rechts wahlweise **Runde 1** oder **Runde 2** (Knöpfe „Rechts: Runde 1 / Runde 2“), links bleibt
„Heute“ (das Spiel, Stand 0.11.16 mit dem umbenannten Raketenwerfer). Neue Schalter: **Bodenlicht** (Aus, nur
Sturmbatterie, alle sechs Spezialstellungen; Mischung „Normal“ oder „Addiert“), **Flamme** (Strom, Ballen) und
**Nachbrennen**. Neben der Uhr zählt die Seite die Zeichenschritte (fill und stroke), Verläufe und Teilchen des
laufenden Bildes. Die neuen Teile stehen in `reference/studien/waffeneffekte-runde2.js`, alle Zahlen in `R2`.
Standbilder `r2-*.png`, Kosten `kosten.json`, beides aus `node tests/tools/waffeneffekte-stills.mjs`.
Die Bilder der ersten Runde sind mit dem aktuellen Spiel neu erzeugt (Beschriftung jetzt „Runde 1“); beim
Reinigungsschrein zeigt „Heute“ jetzt auch die Bodenaura des Spiels (Abschrift von `drawAura` aus `effects.js`,
die dort in `createEffects` steckt und sich nicht einbinden lässt).

## Was Runde 2 zeigt

1. **Laser.** Unverändert aus Runde 1 (Till: in Ordnung).
2. **Bodenlicht.** Ein Verlauf auf der Bodenebene (Ellipse 2 : 1, hell in der Mitte, bei 35 % noch 55 %, am Rand
   0), kein shadowBlur, dazu derselbe Verlauf schwächer (35 %) über den Figuren, damit Stellung und Gegner
   mit angestrahlt werden. Ein Schuss setzt das Licht auf voll, dann fällt es quadratisch ab.
   `r2-licht-*.png`.

   | Stellung | Licht am Schuss | am Treffer | bleibend |
   |---|---|---|---|
   | Sturmbatterie | 2,2 Felder, 55 %, 0,18 s (feuert alle 0,06 s, also fast stetig mit Flackern) | 0,8 Felder, 22 %, 0,1 s | – |
   | Glutkessel | 2,4 Felder, 32 %, 0,35 s | 0,9 Felder, 26 %, 0,5 s je Ziel | Kesselfeuer 1,4 Felder, 10 % |
   | Raketenturm | Abschuss 2,6 Felder, 38 %, 0,4 s | Einschlag 2,6 Felder (Splash), 50 %, 0,6 s | – |
   | Gewitterturm | erster Einschlag 3,0 Felder, 45 %, 0,3 s | weitere Ziele 1,3 Felder, 35 %, 0,3 s | Kugel 1,2 Felder, 7 % |
   | Seelenfeuer-Obelisk | Auge 2,2 Felder, 30 %, 0,3 s | 1,0 Felder, 28 %, 0,3 s | – |
   | Reinigungsschrein | – | – | 2,8 Felder, 6 % bis 22 % nach Auralevel |

   „Addiert“ (`globalCompositeOperation = 'lighter'`) hellt den dunklen Boden wirklich auf und färbt ihn;
   „Normal“ legt die Farbe halbtransparent darüber und wirkt eher wie Dunst (`r2-licht-sturmbatterie-normal.png`).
3. **Flamme.** Beide neuen Darstellungen fallen im flachen Bogen auf das Ziel (heute steht der Strahl
   waagerecht in Mündungshöhe über dem Ziel), und das Feuer brennt nach oben. **Strom:** ein schmales
   brennendes Band (2,4 bis 7 px halbe Breite, Tusche, Orange, Gelb, Weiß), darauf acht aufrechte Flammenzungen,
   die mit dem Strahl nach außen wandern und wachsen, am Ziel ein Spritzer aus vier großen Zungen.
   **Ballen:** rollende Feuerbälle (26 je Sekunde, je 0,42 s, Radius 3 bis 13 px, höchstens 16), Wolkenform aus
   drei Kreisen mit einer gemeinsamen Tuschekontur, Farbe von Weiß über Orange zu Dunkelrot, solange er brennt
   eine aufrechte Zunge obenauf. **Nachbrennen:** alle 0,12 s ein Fleck im Kegel nahe der Strahlspitze, je
   1,4 s, höchstens 6 je Stellung: Rußfleck, warmer Schein, drei kleine Flammen, die zusammensinken, am Ende
   zwei Glutpunkte. Nur Darstellung. `r2-flamme-*.png`.
4. **Blitze**, getrennt nach Form, Farbe und Rhythmus (`r2-tesla-*`, `r2-glutkessel-*`, `r2-gewitterturm-*`):
   - **Tesla:** kalt (Cyan und Weiß), echtes Zickzack mit harten Ecken (Knick wechselt die Seite), eine Gabel,
     nur ein schmaler Schein. Rhythmus Doppelschlag: 0 bis 0,05 s, dann 0,03 s dunkel, dann ein zweiter Schlag
     in neuer Form, der bis 0,3 s verblasst.
   - **Glutkessel:** feinere Fäden (1,5 / 0,9 / 0,4 px), je Ziel drei gewundene, umeinander geflochtene Glutfäden
     in Rot, Orange und Gold, die wie ein heißer Draht durchhängen. Rhythmus Kriechen: Sie wachsen in 0,08 s mit
     hellem Kopf vom Kessel zum Ziel und brennen danach vom Kessel her aus; am Ziel bleibt Glut. Keine Ecken,
     keine breite Aura: Feuer, nicht Strom.
   - **Gewitterturm:** Die Kugel schickt einen Blitz nach oben, dann schlägt von 240 px über dem ersten Ziel ein
     dicker weiß-violetter Blitz mit zwei Ästen ein (5,5 / 3,2 / 1,4 px, Aura 20 und 9 px), Schein oben in der
     Wolke. Danach springt die Kette als Kaskade (0,035 s je Sprung) von Ziel zu Ziel. Je Treffer ein
     **Druckring** am Boden (erster 1,6 Felder, sonst 1,0, in 0,3 s), Bodenlicht und ein kurzer
     **Bildaufheller** über das ganze Bild (16 %, 0,12 s). Bei „Weniger Bewegung“: Aufheller höchstens 5 %, Ringe
     wachsen nicht und sind halb so hell, Blitze zucken nicht (`r2-gewitterturm-weniger-bewegung.png`).
5. **Raketenwerfer.** Ein Treffer der Simulation sind drei kleine Raketen aus drei benachbarten Rohren im Abstand
   von 0,06 s, die je `flight − 0,06 s` fliegen und dicht (0,2 Felder) um den Einschlagpunkt landen: Die mittlere
   trifft genau zum Zeitpunkt der Simulation, die anderen 0,06 s davor und danach. Kleine Explosion je Rakete
   (0,55 des Splash-Radius). Werte unverändert. `r2-raketenwerfer-*.png`.
6. **Raketenturm** wuchtiger: Rakete 8 statt 6,2 px dick, Kopf 7,6 px, langer Feuerstrahl, größere Flossen, dichter
   Rauch (alle 0,02 s, bis 18 px, 1,5 s); beim Abschuss Rückstrahl mit zehn Staubwolken am Boden und Bodenlicht;
   beim Einschlag weißer Blitz, Feuerball aus fünf Lappen, der steigt und dunkelt, Druckring bis zum wahren
   Splash-Radius (2,6 Felder), zwölf Staubwolken nach außen, vier Rauchsäulen, acht Trümmer, Krater für 2,5 s,
   Bildaufheller 10 %. `r2-raketenturm-*.png`.
7. **Reinigungsschrein: Nebelfluss.** Aus dem Artefakt fällt Nebel zum Fuß (drei Schwaden), dort ein Nebelteich;
   von dort laufen vier weiche Nebelwellen (je 3,2 s) über den Boden nach außen, bremsen ab und dünnen aus, am
   Rand der Aura (2,8 Felder) liegt eine Nebelbank. Eine dünne goldene Linie zeigt weiter die Reichweite. Alles
   Verläufe ohne Kontur, Helligkeit nach Auralevel (gedimmt ohne Ziel). Die zwölf Runen von heute entfallen.
   Bei „Weniger Bewegung“ stehen die Wellen still. `r2-schrein*.png`.

## Kosten Runde 2

Gemessen in der Studie über eine Schleife von 8 s (rechte Seite allein, Zoom 1; Boden, Sockel und Ziele sind in
beiden Zahlen enthalten, deshalb zählt der Unterschied). `kosten.json` hat alle Werte.

| Effekt | Zeichenschritte je Bild R1 → R2, Mittel (Spitze) | Verläufe je Bild (Spitze) | Teilchen Spitze |
|---|---|---|---|
| Flamme Strom mit Nachbrennen | 529 → 604 (647 → 659) | 1 → 8 | 31 → 29 |
| Flamme Strom ohne Nachbrennen | 529 → 541 (647 → 659) | 1 → 2 | 31 |
| Flamme Ballen mit Nachbrennen | 529 → 614 (647 → 633) | 1 → 7 | 31 → 35 (+16 Bälle) |
| Raketenwerfer, drei Raketen | 749 → 768 (793 → 829) | 2 → 4 | 45 → 59 |
| Tesla | 658 → 652 (707 → 689) | 7 → 6 | 15 |
| Glutkessel, Licht an | 701 → 706 (746 → 758) | 9 → 21 | 15 |
| Gewitterturm, Licht aus / an | 706 → 712 / 715 (744 → 770 / 779) | 6 → 8 / 17 | 15 → 33 |
| Raketenturm, Licht aus / an | 929 → 965 / 965 (987 → 1052 / 1054) | 2 → 2 / 4 | 51 → 110 |
| Sturmbatterie, Licht an | 845 → 849 (902 → 907) | 1 → 5 | 27 → 28 |
| Obelisk, Licht an | 660 → 660 (688 → 692) | 3 → 7 | 10 |
| Reinigungsschrein (Nebel statt Runen) | 813 → 798 (819 → 804) | 1 → 8 | 0 |

Einordnung und Obergrenzen:

- **Verläufe** sind das Neue: Bodenlicht, Nebelwellen und der Schein der Brandflecken sind je ein Radialverlauf
  mit großer Fläche. Die Füllfläche zählt auf dem iPad mehr als die Zahl der Aufrufe. Obergrenze nötig: höchstens
  `R2.light.max` = 24 Lichter auf einmal (das älteste geht), Sturmbatterie und Kesselfeuer haben je ein festes
  Licht, das nur neu gesetzt wird. Im Spiel zusätzlich ein Licht je Stellung und Art, nicht je Schuss.
- **Nachbrennen** höchstens 6 Flecken je Stellung (heute in der Studie fest), bei mehreren Flammenwerfern eine
  gemeinsame Grenze (Vorschlag 24) und unter Zoom 0,5 nur Ruß und Schein ohne Flammen.
- **Feuerbälle** höchstens 16 je Stellung; sie sind keine Teilchen der Teilchenliste, im Spiel sollten sie aber
  unter `FX_MAX_PARTICLES` fallen.
- **Raketenturm-Einschlag** ist mit +59 Teilchen der größte Posten (Staub, Rauch, Trümmer). Er feuert alle 3,2 s;
  das passt unter die Grenze von 520, sollte aber zur Mündungsgrenze (200) zählen. Trümmer sind bei „Weniger
  Bewegung“ aus.
- **Bildaufheller** ist ein `fillRect` über den ganzen Schirm: billig in Aufrufen, aber volle Füllfläche. Höchstens
  einer zur Zeit (der stärkere gewinnt), höchstens 0,12 s.
- Raketenwerfer: drei Raketen statt einer kosten etwa 20 Schritte mehr; bei vielen Raketenwerfern wären es
  dreimal so viele Raketen im Flug. Grenze: Raketen je Stellung höchstens 6 im Flug.

## Abweichungen Runde 2

- **Raketenwerfer:** Sichtbar landen drei Raketen 0,06 s vor, genau zum und 0,06 s nach dem Treffer der
  Simulation. Der Schaden kommt weiter auf einmal mit der mittleren. Wenn alle drei gleichzeitig landen sollen,
  würden sie gestaffelt fliegen (die letzte 0,12 s kürzer).
- **Gewitterturm:** Die Kaskade (bis 7 × 0,035 s = 0,25 s) ist nur Darstellung; die Simulation trifft alle Ziele
  der Kette im selben Schritt. Der Blitz „von oben“ ist Darstellung; die Kugel bleibt die Quelle.
- **Flamme:** Der Strahl endet auf Trefferhöhe am Ziel statt in Mündungshöhe darüber. Der Kegel der Simulation
  (Winkel, Reichweite 2,0) bleibt; nur die Linie im Bild ist eine andere.
- **Reinigungsschrein:** Die Runen fallen weg, die Reichweite zeigt eine dünne Linie. Wer die Aura am Rand
  braucht, sieht die Nebelbank.
- **Bodenlicht „Addiert“** ist die erste Mischung (`globalCompositeOperation`) im Projekt. Die Regeln verbieten
  sie nicht (kein shadowBlur, keine Filter), aber sie ist neu; „Normal“ kommt ohne aus.
- Wie in Runde 1: Die Explosionen sind die der Studie, die Waffe rechts wird live gezeichnet.

## Offene Fragen an Till (Runde 2)

1. Bodenlicht: nur Sturmbatterie oder alle sechs Spezialstellungen? Und „Addiert“ (heller, farbiger) oder
   „Normal“ (wie Dunst)?
2. Flamme: „Strom“ oder „Ballen“? Und das Nachbrennen am Boden ja oder nein?
3. Blitze: Sind Tesla (eckiger Doppelschlag), Glutkessel (kriechende Glutfäden) und Gewitterturm (Einschlag von
   oben mit Druckring) jetzt klar genug getrennt?
4. Gewitterturm: Bildaufheller bei jedem Schuss (alle 1,3 s) in Ordnung, oder nur Druckring und Bodenlicht? Mit
   zwei oder drei Gewittertürmen flackert das ganze Bild oft.
5. Raketenwerfer: drei Raketen gestaffelt (wie gezeigt) oder gleichzeitiger Einschlag?
6. Raketenturm: ist das wuchtig genug, oder soll zusätzlich ein Bildwackeln kommen (aus bei „Weniger Bewegung“)?
7. Schrein: Nebelfluss ohne Runen in Ordnung? Soll der Nebel heller werden, wenn Gegner in der Aura sind
   (heute schon gedimmt im Leerlauf)?
