# Ergänzung zum Grafikleitfaden v4: HUD, Menüs, letzte vier Spezialstellungen

## 1. HUD-Knopf-Fassung: Runenscheibe

Alle Icon-Knöpfe (nicht Textknöpfe) im laufenden Spiel bekommen dieselbe kreisrunde Fassung: dunkler Steinkern, dünner Goldring außen, darauf zehn eingeritzte Runensymbole am Rand, darüber das eigentliche Symbol. Betrifft: Nachschub-Knopf, Abriss-Knopf, alle Spezialkommando-Symbole in der rechten Leiste.

**Zustände** (gelten für jeden Runenscheiben-Knopf gleich):
- **Bereit**: normale Deckkraft.
- **Abklingzeit**: dunkler Tortenausschnitt über der Scheibe, Zahl in der Mitte zeigt verbleibende Wellen.
- **Gesperrt**: komplette Scheibe abgedunkelt, kleines Schloss-Symbol, goldenes Zahlen-Badge oben rechts zeigt die Welle, ab der es freigeschaltet wird.

**Bedienung**: Klick/Tippen löst die Aktion aus. Langes Drücken (Desktop: Hover) zeigt eine kurze Erklärung als Sprechblase, dieselbe Regel wie bei Stellungen und Gegnern (siehe GDD Abschnitt 13). Bei neu freigeschalteten Knöpfen blitzt einmalig eine kurze Beschriftung auf und verschwindet von selbst, danach nur noch über langes Drücken abrufbar.

Referenz: `reference/konzept/hud/hud-uebersicht.svg` zeigt alle Knöpfe im Kontext.

## 2. Untere Leiste, Layout

Von links nach rechts: Nachschub-Knopf (Runenscheibe, Stufe als goldenes Zahlen-Badge oben rechts, Preis klein darunter), Abriss-Knopf (Runenscheibe, Mülleimer-Symbol), mittig der große goldene Haupt-Knopf "Salve anfordern" mit kleinem Kapsel-Symbol (bleibt bewusst größer und mit Text, da zentrale Handlung jeder Runde), rechts die kompakte Tempo-Gruppe (Pause, 1x, 2x, 3x) als einfache quadratische Knöpfe, aktiver Zustand golden hervorgehoben.

## 3. Rechte vertikale Kommandoleiste (neu)

Eigene senkrechte Leiste am rechten Bildschirmrand, ausschließlich Runenscheiben-Symbole ohne Text. Reihenfolge von oben nach unten entspricht der Freischalt-Reihenfolge im Spiel (aktuell: Orbitalschlag, Stasisfeld, Luftschlag, Heiliges Banner). Zustände wie in Abschnitt 1. Wächst die Zahl der Kommandos später weiter, auf ausreichend vertikalen Platz achten bzw. ab einer bestimmten Anzahl scrollbar machen.

## 4. Obere Statusleiste

Durchgehende Metallplatte statt einzelner schwarzer Kästchen, Werte in kleinen Abschnitten mit Nietentrennern. Von links: Spieltitel, Welle-Anzeige (Standarten-Symbol, "aktuelle/gesamt"), Bastion-Leben (Turm-Symbol, Zahl färbt sich bei kritischem Stand rot/orange). Rechts: Nachschubstufe (Antennen-Symbol), Requisition (Münz-Symbol), Kommandopunkte (Blitz-Chevron-Symbol), aktuelle Routenlänge (gepunktetes Pfad-Symbol). Sieg-/Niederlage-Anzeige erscheint nur situativ am Spielende, kein dauerhafter Platz in der Leiste nötig.

Hinweis: Bei sechs Feldern wird die Leiste auf dem Tablet-Querformat eng. Falls später weitere Statuswerte dazukommen, prüfen, ob manche davon besser ins Pause-Menü wandern statt dauerhaft sichtbar zu sein.

## 5. Menüs außerhalb der laufenden Partie

Fünf Bildschirme, alle mit dem Hintergrund-Skyline-Motiv aus dem Stiltest, Titel in der Pirata-One-Schrift, Fließtext in Barlow Condensed:

- **Hauptmenü**: Neue Partie (golden hervorgehoben), Fortsetzen, Seed eingeben, Bestenliste, Einstellungen.
- **Seed-Eingabe**: Dialog über abgedunkeltem Hauptmenü, Eingabefeld für den Seed-Code, Knopf "Zufällig", Knopf "Übernehmen", darunter der Start-Knopf.
- **Pause**: halbtransparente Überlagerung der laufenden Partie, Knöpfe Fortsetzen (golden), Einstellungen, Partie verlassen, darunter eine kompakte Statuszeile (Welle, Leben, Requisition) zur Orientierung.
- **Einstellungen**: Regler für Musik- und Effektlautstärke, Schalter für reduzierte Bewegung, Sprachanzeige (aktuell fix Deutsch), Knöpfe Exportieren/Importieren für den Spielstand, Knopf Zurück (golden).
- **Ende-Bildschirm**: Titel Sieg oder Niederlage, Kennzahlen (Punkte, verbleibende Leben, Abschüsse, ggf. neuer Bestwert), Knöpfe Nochmal (golden) und Hauptmenü.

**Textknopf-Fassung** (neu, ergänzt die Runenscheibe aus Abschnitt 1): rechteckige dunkle Platte mit dünnem Goldrand und kleinen Runenstrichen als Eckakzent statt vollem Ring, da hier der Textinhalt im Vordergrund steht. Der jeweils wichtigste Knopf pro Bildschirm ist golden hervorgehoben, alle anderen in der dunklen Plattenfarbe mit hellem Text.

Referenzen: `reference/konzept/menues/hauptmenu.svg`, `seed-eingabe.svg`, `pause.svg`, `einstellungen.svg`, `ende-sieg.svg` (Niederlage analog, nur Titel/Farbe anpassen, kein eigenes Bild nötig).

## 6. Alle sechs Spezialstellungen, mit Wirkungsanker

Ergänzt und korrigiert Abschnitt 5 aus `ART-update-v2.md`. Die ursprüngliche Idee, alle Rezept-Stellungen auf zwei Fahrzeug-Chassis zu bauen, ist verworfen: Die Namen legen zu unterschiedliche Formen nahe. Jede Spezialstellung ist jetzt ein eigenständiges Bauwerk. Wichtig für die Umsetzung: Jede Zeile nennt auch den **Wirkungsanker**, also die Stelle am Modell, von der aus Schuss, Flamme, Blitz oder Aura ausgehen soll, damit die bereits im GDD (Abschnitt 8, Spalte "Wirkung") beschriebenen Effekte am richtigen Punkt der neuen Grafik ansetzen.

| Spezialstellung | Bauform | Beschreibung | Wirkungsanker (für die GDD-Wirkung) |
|---|---|---|---|
| Reinigungsschrein | Gotischer Altar | Steinaltar mit brennender Feuerschale, schwebendem violettem Psi-Splitter darüber, Mörserrohr in den Sockel eingelassen | Die im Sockel eingelassene Mörserröhre ist der Abschusspunkt (Flugbahn wie beim normalen Mörser). Einschlag erzeugt den "großen Flammenring" mit Verlangsamung am Zielort, nicht am Schrein selbst |
| Sturmbatterie | Panzerfahrgestell | Offener Vierlings-Flakturm, im Feuer vier gleichzeitige Mündungsblitze, Hülsen fliegen umher | Die vier Laufmündungen des Flakturms (in der Skizze markiert) sind die Schusspunkte. "Schnellfeuer auf drei Ziele" heißt: der Turm wählt pro Salve drei Ziele, die Mündungen dürfen dabei alle gleichzeitig aufblitzen |
| Glutkessel | Eiserner Kessel | Bauchiger Kessel auf Steinsockel, loderndes Feuer innen, vier Tesla-Elektroden am Rand, seitliche Autokanonen-Auslässe | Die "brennende Aura" ist ein stehendes Feld um den Kessel selbst, Ursprung die Kesselöffnung oben. Die Blitze, die Gegner "entzünden", schlagen von den vier Elektroden am Rand aus auf Gegner in der Aura |
| Belagerungsmörser | Holz-Stahl-Lafette | Schwere Lafette mit Sandsackring, überlanges Rohr, aufgesetztes Laser-Zielfernrohr | Rohrmündung am Ende des langen Rohrs ist der Abschusspunkt (Flugbahn, riesiger Explosionsradius am Einschlag). Das Zielfernrohr zeichnet vor dem Schuss kurz eine dünne Laserlinie zum Ziel, rein optisch, als Vorwarnung |
| Gewitterturm | Schlanker Gittermast | Vierbeiniger Mast, oben Tesla-Spule mit schwebendem Psi-Ring | Die Spule an der Mastspitze ist der Ursprung der Kette über acht Ziele, dieselbe Stelle, von der die Umgebungsblitze in der Ruheanimation ausgehen |
| Seelenfeuer-Obelisk | Runenobelisk | Höchstes Bauwerk im Spiel, schwebendes Psi-Auge an der Spitze, Blitze, Flammen am Fuß | Das schwebende Auge an der Spitze ist der Ursprung des Schadens in Prozent der maximalen Lebenspunkte, als Strahl oder Blick auf das Ziel, thematisch das "Urteil" des Obelisken über Bosse |

Referenzen: `reference/konzept/spezialstellungen/reinigungsschrein.svg`, `glutkessel.svg`, `belagerungsmoerser.svg`, `gewitterturm.svg` (neu, ersetzen die bisherigen Fahrzeug-Versionen), `sturmbatterie.svg` und `seelenfeuer-obelisk.svg` (unverändert aus `ART-update-v2.md`).
