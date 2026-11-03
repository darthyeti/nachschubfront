# M9: Stellungen

Status: **Entwurf, wartet auf Freigabe** (Akte E-18). Beschlossen am 03.11.2026 in E-17 (Wahl „So in M9 übernehmen“). Läuft parallel zu M6; M7 ruht.
Referenz: `reference/studien/stellungen-rework.html` mit `stellungen-rework.js` und `stellungen-rework-modell.js`, Standbilder `rework-*.png` in `reference/konzept/stellungen/` (Auftrag A-19, PR #31).

## Entscheidungen vom 03.11.2026

- **Neuer Bunker im Stil der Kapsel** aus der Studie, auf 74 % der ersten Fassung verkleinert. Keine Stellung wird mehr als 10 % höher als ihr heutiges Sprite.
- **Ränge ohne Sandsäcke**, nur über Verzierungen und Farben an Bunker und Aufsatz (Tabelle unten).
- **Die Aufsätze richten sich zum Ziel aus.** Hybrid mit 16 Stufen: Ruhende Waffen kommen aus 16 vorgerenderten Stufen. Neu gezeichnet wird nur eine Waffe, die sich gerade dreht.
- **Mündungsfeuer am Laufende.** Jede Waffe hat einen Mündungspunkt im Modell. Feuer, Funken, Rauch, Hülsen, Strahl, Blitz und Rückstoß gehen von dort in Schussrichtung aus.
- **Die Simulation wird nicht angefasst.** Keine Zahl in `src/data` ändert sich, `RULESET_VERSION` bleibt, `tests/unit/golden.json` bleibt, jedes Protokoll spielt sich unverändert nach.

## Offen bis zur Freigabe

1. **Mörser oder Raketenwerfer.** Die Studie zeigt beide. Im Spiel bleibt einer, beide umschaltbar wäre eine Einstellung ohne Spielwert. Empfehlung: der Raketenwerfer, das war Tills Wunsch im Thema. Der Name im Spiel bleibt „Mörser“, solange GDD und Doktrin nicht umbenannt werden; eine Umbenennung wäre eine eigene Akte.
2. **Spezialstellungen.** Die sechs Rezept-Stellungen stehen auf der Spezialbasis und sind nicht Teil der Studie. Empfehlung: In M9 bleiben sie, wie sie sind; ihr Rework folgt als eigene Studie, sobald die sechs Standardstellungen im Spiel stehen.
3. **Rang 2.** Er ist bei kleinem Zoom kaum von Rang 3 zu unterscheiden. Empfehlung: kräftigerer Rand in der Doktrinfarbe.

## Berührte Bereiche und Dateien

| Bereich | Dateien | Art der Änderung |
| --- | --- | --- |
| Konzept | `reference/konzept/stellungen/` (neue Bunker-SVGs je Rang), `src/render/sprites/` (erzeugt, `npm run sprites`) | Bunker als SVG wie bisher |
| Render | `src/render/towerSprites.js`, `towerFx.js`, `objects.js`, `model.js`, `shadows.js`, neu `src/render/turrets.js` (Modelle der Aufsätze) und `turretCache.js` (die 16 Stufen) | drehbare Aufsätze, Stufen-Cache, Effekte am Mündungspunkt |
| Daten | `src/data/art.js` | Maße, Drehgeschwindigkeit der Darstellung, Mündungspunkte als benannte Konstanten, keine Spielregel |
| Werkzeuge | `tests/perf.mjs`, `tests/screenshots.mjs`, `tests/sprites.js` | Messung mit 30 feuernden Stellungen, Standbilder, Galerie |
| Dokumentation | `docs/ART.md` (Abschnitte „Bunker“, „Aufsätze“, „Drehbare Modelle“), `docs/PROGRESS.md` | siehe unten |

Geteilte Quellen, die dieser Auftrag ändert: **docs/ART.md**. Nicht geändert werden **src/sim**, **src/core**, **docs/GDD.md** und die Balancing-Zahlen in **src/data**.

## Ziel

Jede Stellung zeigt, wohin sie schießt, und das Feuer kommt aus dem Lauf. Bunker und Aufsätze passen zur Kapsel. Doktrin und Rang sind auf einen Blick zu lesen, auch als Schattenriss bei kleinem Zoom. Das Spiel bleibt bei 60 fps mit 200 Gegnern auf dem iPad.

## Verbindlich und nicht verbindlich in der Studie

Verbindlich: Form und Maße von Bunker und Aufsätzen, die Gehäuse von Autokanone und Laser, die Rangzeichen, die Mündungspunkte, die Richtung aller Effekte, die Tiefensortierung je Fläche.
Nicht verbindlich: der Zeichencode der Studie im Einzelnen, ihre Messwerte (Chromium ohne Grafikkarte), die Knöpfe „Drehbar“ und „Nur 16 Stufen“ sowie das Layout mit 30 Stellungen (Werkzeuge der Studie).

## Anforderungen

### D1 Bunker und Ränge (erster Pull Request)

- Der Bunker der Studie wird als SVG je Rang nach `reference/konzept/stellungen/` exportiert und läuft durch `npm run sprites`. Er ist statisch, die SVG-Regel gilt für ihn weiter.
- Ränge:

  | Rang | Zierrat und Farbe |
  |---|---|
  | 1 | schlicht, nur die Doktrinlampe |
  | 2 | Rand in der Doktrinfarbe, Stahlschutz an der Nahecke, ein Winkel |
  | 3 | dunkle Platten mit Doktrinzeichen neben den Schießscharten, Dachplatte in der Doktrinfarbe, zwei Winkel |
  | 4 | Zinnen, Totenkopf-Plakette, Antenne, drei Winkel |
  | 5 | Goldkanten und Goldnieten, zweite Antenne, vier goldene Winkel |

- Die Sandsäcke entfallen. Das Fundament in der Doktrinfarbe aus M8 (C1) bleibt.
- Die heutigen Aufsätze sitzen in diesem Schritt noch unverändert und gespiegelt auf dem neuen Bunker.

### D2 Drehbare Aufsätze (zweiter Pull Request)

- Die sechs Aufsätze als drehbare Modelle aus Körpern in lokalen Koordinaten, nach den Regeln in ART.md, Abschnitt „Drehbare Modelle“. `model.js` lernt dafür beliebige Drehwinkel statt nur der vier Achsen und sortiert alle sichtbaren Flächen einzeln nach Tiefe entlang des Sehstrahls. Lange Flächen werden geteilt.
- Die Richtung kommt aus dem Zustand: `tower.aim` (Weltpunkt des letzten Ziels) gibt die Sollrichtung. Gedreht wird mit einer Drehgeschwindigkeit der Darstellung (`art.js`). Der Darstellungswinkel lebt neben `ui`, nicht in `state`; er wird weder gespeichert noch aufgezeichnet. Ohne Ziel bleibt die letzte Richtung stehen.
- Stufen-Cache (`turretCache.js`): 16 Stufen je Doktrin und Rang, **erst bei Bedarf erzeugt**, auf den belegten Bereich zugeschnitten, nur für die aktuelle Zoomstufe (wie die Trümmer in M8, C5). Eine Waffe, deren Darstellungswinkel nicht auf einer Stufe liegt, wird pro Bild aus dem Modell gezeichnet; sobald sie auf ihrer Stufe angekommen ist, kommt sie wieder aus dem Cache.
- **Feuern allein macht eine Waffe nicht teuer.** Rückstoß, rotierende Läufe und Mündungsfeuer liegen als eigene Ebene über der Stufe. Rückstoß verschiebt die Stufe entlang der Laufachse.
- Silhouettenschatten aus M8 (C2): je Stufe eine Schattenvariante im Cache.
- Treffer-Aufblitzen der Stellung wie heute über eine helle Variante.

### D3 Mündungsfeuer und Effekte (dritter Pull Request)

- `towerFx.js` liest den Mündungspunkt aus dem Modell (Laufende, Raketenspitzen 0,12 Felder davor, Tesla-Spitze 0,05) und zeichnet alle Effekte von dort in Schussrichtung: Mündungsblitz, Funken, Rauch, Hülsen, Laserstrahl, Blitzbogen, Flammenstrahl, Psi-Impuls.
- Der Schuss wird wie bisher daran erkannt, dass der Nachladezähler hochspringt.
- Bei Wahl Raketenwerfer: sechs Rohre, die nacheinander abfeuern, Rauchspur und Bogenflug der Rakete bis zum Einschlag. Bogen und Flugzeit folgen dem Projektil der Simulation, nicht einer eigenen Flugbahn.
- `prefers-reduced-motion`: gedämpfte Mündungsblitze, kein Wackeln.

## Abnahme

- `npm test` grün, Golden und `RULESET_VERSION` unverändert, Protokoll 4RCC95 spielt sich nach.
- `tests/perf.mjs` mit 30 Stellungen, die alle feuern, und 200 Gegnern hält dieselben Grenzen wie nach M8. Die Zeichenzeit der Stellungen wird getrennt ausgewiesen. Im Betrieb wird nichts außer Stufen bei Bedarf gerastert.
- Speicher der Stufen bei 2x Zoom und devicePixelRatio 2 unter 40 MB, im Perf-Test gemessen.
- Kontaktbild aller sechs Aufsätze in 16 Richtungen ohne durchscheinende Flächen.
- Eine Partie auf dem iPad mit Tills Urteil zu Leistung und Lesbarkeit.
- Jeder Schritt ein eigener Pull Request mit Vorschau (`spielgefuehl`), gemergt nach Tills Blick. Version 0.11.0 bis 0.11.2.

## Dokumentation

- ART.md: Die Regel „Der Aufsatz dreht sich nicht, er wird zum Ziel hin gespiegelt“ wird ersetzt. Die Aufsätze sind drehbare Modelle mit Stufen-Cache, die Leistungsregel für drehbare Modelle bekommt diese Ausnahme. Der Abschnitt „Bunker“ bekommt die neuen Ränge.
- PROGRESS.md: nur der Stand, keine Geschichte.
