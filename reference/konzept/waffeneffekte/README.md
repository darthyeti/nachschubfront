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
