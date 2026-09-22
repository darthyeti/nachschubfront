# M1b: Grafik-Pipeline

## Ziel
Die Konzeptgrafiken aus `reference/konzept/` als Sprites ins Spiel bringen, damit ab M2 mit erkennbaren Figuren statt Platzhaltern gearbeitet wird. Vollständige Animationen und Effekte bleiben in M4.

## Umfang
- Leitfaden `docs/ART.md` lesen und umsetzen.
- SVG-Quellen nach `src/render/sprites/` übernehmen, als Module mit dem SVG-Text (kein Laden per Netzwerk nötig).
- Rasterizer: SVG in Offscreen-Canvas umwandeln, mit Cache nach Zoomstufe und devicePixelRatio. Vorabladen beim Start mit Ladeanzeige.
- Horizontales Spiegeln für Gegner je nach Laufrichtung.
- Zerlegung in statische Teile und Ankerpunkte, sodass Läufe, Waffenköpfe und Beine später per Code animiert werden können. Für M1b reicht: Sockel plus Stellung als Ganzes, Gegner als Ganzes mit einfachem Wippen.
- Rangdarstellung nach ART.md (Winkel am Sockel, kumulative Details), zunächst Winkel und Sandsackring.
- Helle Treffer-Variante je Sprite vorrendern.
- Die bisherigen Platzhalter aus M1 ersetzen. Debug-Schalter, um zwischen Platzhalter und Sprite umzuschalten.
- Belastungstest: 200 Gegner mit Sprites, fps-Anzeige.

## Nicht im Umfang
Effekte, Laufanimation der Beine, Kapselsequenz, UI-Gestaltung.

## Abnahme
- Alle Stellungen und Gegner erscheinen wie in den Skizzen, scharf auf allen Zoomstufen, auch auf dem Tablet.
- Keine SVG-Zeichnung pro Frame (im Performance-Profil prüfbar).
- Leistungsziel aus CLAUDE.md mit 200 Gegnern erreicht.
