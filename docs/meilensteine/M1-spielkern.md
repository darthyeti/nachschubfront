# M1: Spielkern

## Ziel
Ein spielbares Grundgerüst mit Platzhaltergrafik: Karte, Kamera, Wegfindung über Signalfeuer, laufende Gegner, Phasen und Leben. Noch keine Kapseln und keine Stellungen.

## Umfang
- Kartengenerator nach GDD Abschnitt 4 (24 x 24, Seed, Riss, Bastion, vier Signalfeuer, zufällige Hindernisse, geschützte Felder, Wegprüfung).
- Wegfindung nach GDD Abschnitt 5: acht Richtungen ohne Eckenschneiden, Kette der Teilstrecken, schnelle Blockadeprüfung für ein einzelnes Feld. Unit-Tests für normale Wege, Umwege, Blockaden und Diagonalregel.
- Flieger-Route als gerade Linien zwischen den Kettenpunkten.
- Kamera: Zoom und Verschieben mit Maus, Tastatur und Touch-Gesten (GDD Abschnitt 13), Begrenzung auf die Karte, sinnvolle Startansicht für Desktop und Tablet.
- Umrechnung Bildschirm in Feld für Klick und Tippen.
- Phasenautomat: Planung, Salve (vorerst übersprungen), Auswahl (vorerst übersprungen), Welle, Auswertung.
- Gegner als einfache Formen, Bewegung entlang der Route, Leben der Bastion, Durchbrüche.
- Einfache Testwellen aus `src/data/waves.js`.
- Routenvorschau in der Planung: gestrichelte Linie mit Länge in Feldern.
- Debug-Werkzeug zum Testen: Hindernis per Tastendruck auf ein Feld setzen oder entfernen, damit Umleitungen sichtbar werden.
- HUD-Grundgerüst: Welle, Leben, Phase, Geschwindigkeit (Pause, 1x, 2x, 3x), Knopf zum Starten der Welle.

## Nicht im Umfang
Kapseln, Stellungen, Schaden, Wirtschaft, finale Grafik.

## Abnahme
- Gleicher Seed ergibt gleiche Karte.
- Gegner laufen korrekt über alle Signalfeuer und weichen gesetzten Hindernissen aus.
- Ein Hindernis, das den Weg komplett blockieren würde, wird abgelehnt.
- Zoomen und Verschieben funktionieren mit Maus und mit Touch-Emulation. Beim Verschieben werden keine Felder versehentlich ausgewählt.
- Alle Unit-Tests grün.
