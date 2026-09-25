# M5c: HUD, Menüs, letzte Spezialstellungen

Kann parallel zu oder nach M5b eingeplant werden, da inhaltlich unabhängig (reine Präsentation, keine neue Spiellogik).

## Ziel
Grundlage: `docs/ART-update-v4.md`. Das komplette HUD (obere Statusleiste, untere Leiste, neue rechte Kommandoleiste) in der abgestimmten Runenscheiben-Optik, alle fünf Menü-Bildschirme, und die letzten vier der sechs Spezialstellungen.

## Vorarbeit
`docs/ART-update-v4.md` in `docs/ART.md` einarbeiten (neue Abschnitte ergänzen, Abschnitt 5 der Spezialstellungen-Tabelle aus `ART-update-v2.md` vervollständigen). Danach kann `ART-update-v4.md` gelöscht werden.

## Umfang

1. **Runenscheiben-Knopf-Komponente**: einmal als wiederverwendbare Komponente bauen (Zustände bereit/Abklingzeit/gesperrt wie in Abschnitt 1), dann für Nachschub- und Abriss-Knopf sowie alle Kommando-Symbole einsetzen.
2. **Rechte vertikale Kommandoleiste**: neue UI-Struktur, ersetzt die bisherige Unterbringung der Spezialkommandos (falls diese bisher anders lag). Reihenfolge nach Freischalt-Welle, wächst mit, sobald neue Kommandos aus M5b dazukommen (Luftschlag).
3. **Obere Statusleiste** auf durchgehende Plattenoptik mit Icons umstellen wie in Abschnitt 4.
4. **Tap/Klick-Verhalten**: Klick löst aus, langes Drücken/Hover zeigt Erklärung, einmaliges Aufblitzen der Beschriftung bei Neufreischaltung. Gilt für alle Runenscheiben-Knöpfe.
5. **Fünf Menü-Bildschirme** umsetzen: Hauptmenü, Seed-Eingabe, Pause-Overlay, Einstellungen (inkl. Anbindung an bestehende Export/Import-Funktion aus M5 und den reduced-motion-Schalter aus CLAUDE.md), Ende-Bildschirm (Sieg und Niederlage als Variante desselben Bildschirms).
6. **Vier fehlende Spezialstellungen** einbauen: Reinigungsschrein, Glutkessel, Belagerungsmörser, Gewitterturm, siehe Abschnitt 6. Rezeptlogik existiert bereits aus M2, hier nur die finale Grafik ergänzen. Wichtig: Die vier sind jetzt eigenständige Bauwerke ohne Fahrgestell (nicht mehr Kampfpanzer/Artillerie wie in einer früheren Fassung dieses Updates). Für alle sechs Spezialstellungen inklusive der beiden bereits vorhandenen (Sturmbatterie, Seelenfeuer-Obelisk) die Wirkungsanker aus Abschnitt 6 der Tabelle verwenden, damit die im GDD Abschnitt 8 beschriebenen Effekte (Flammenring, Kette über 8 Ziele usw.) am richtigen Punkt des jeweiligen Modells ansetzen statt an einer generischen Mitte.

## Nicht im Umfang
Sound/Musik (kommt mit den Reglern aus Abschnitt 5 der Einstellungen erst zum Tragen, wenn Audio überhaupt existiert, siehe ursprüngliches M4). Die Überarbeitung der Waffenaufsätze der sechs Basisdoktrinen (weiterhin ohne konkreten Auftrag).

## Abnahme
- Alle Runenscheiben-Knöpfe funktionieren mit allen drei Zuständen, auch per Touch (langes Drücken zeigt Erklärung, ohne versehentlich die Aktion auszulösen).
- Rechte Kommandoleiste zeigt alle verfügbaren Kommandos korrekt gestaffelt nach Freischaltwelle.
- Alle fünf Menü-Bildschirme erreichbar und bedienbar, Seed-Eingabe validiert eine ungültige Eingabe sinnvoll.
- Sechs von sechs Spezialstellungen im Spiel sichtbar und über ihre Rezepte baubar.
