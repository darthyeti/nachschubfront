# M7: Koloss-Verhalten, Stellungsgrafik, Gunship, Platzhalter abschließen

Kommt nach M6 (Balancing). Grundlage: `docs/GDD-update-v4.md`, `docs/ART-update-v5.md` und die beiden Studien in `reference/studien/`.

## Ziel
- Der Koloss verhält sich so, wie er angekündigt wird:
  - gerade Fahrt auf einer Rasterachse,
  - sichtbare Zerstörung genau der markierten Schneise,
  - klarer Stopp an Bollwerk oder Stellung,
  - danach eigene Wegfindung.
- Alle verbliebenen Platzhalter bei Stellungen, Koloss, Bollwerk und Luftschlag werden durch die finale Grafik ersetzt.

## Vorarbeit
1. `GDD-update-v4.md` in `docs/GDD.md` einarbeiten:
   - Koloss und Luftschlag in den in M5b angelegten Abschnitten aktualisieren.
   - Spalte "Wirkung" in Abschnitt 8 ersetzen.
2. `ART-update-v5.md` in `docs/ART.md` einarbeiten. Die Tabelle der Spezialstellungen aus v4 wird ersetzt.
3. Beide Update-Dateien danach löschen und M7 in `docs/PROGRESS.md` eintragen.

## Umfang

### A. Koloss-Logik (Simulation, mit Unit-Tests)
1. **Bewegung nur auf vier Achsen**, Drehung an Feldmitten (GDD 1.1).
2. **Auftritt am Kartenrand der Riss-Seite.** Fahrlinienwahl und Zielfeld nach GDD 1.2:
   - Das Ziel ist das erste blockierende Feld der Linie.
   - Gewählt wird die Linie, deren Ziel die geringste Feuerkraft hat.
   - Die Neuberechnung läuft live, solange Stufe 2 aktiv ist.
3. **Durchbruch** nach GDD 1.4:
   - Schneise 5 Felder lang und 1 Feld breit ab dem Zielfeld.
   - Trümmer werden zerstört, Bollwerk oder Stellung stoppt ihn, danach 3 s Betäubung.
4. **Eigene Wegfindung** nach GDD 1.5:
   - Signalfeuer werden ignoriert.
   - Trümmer sind mit Zusatzkosten 6 passierbar und werden beim Überfahren zerstört.
   - Bei vollständigem Einschluss rammt er 8 s mit Countdown.
   - Alle anderen Gegner berechnen ihren Weg nach jeder Zerstörung neu.
5. **Die Welle endet nicht, solange der Koloss lebt.** Bastion erreicht: 15 Leben.
6. **Bugfix:** Nach einem Koloss-Durchbruch feuert ein verwaister lila Effekt weiter auf der Karte (Screenshot aus der M6-Abnahme).
   - Ursache finden: vermutlich ein Effekt oder eine Aura, die an einer zerstörten Stellung oder einem Trümmerfeld hängt und beim Entfernen nicht mit aufgeräumt wird.
   - Grundsätzlich beheben: Beim Entfernen einer Stellung oder eines Trümmerfelds alle daran gebundenen Effekte mit entfernen. Kein Einzelfall-Pflaster.
   - Test dafür schreiben.

### B. Luftschlag und Bossdeckel
7. Linienziel rastet auf eine Rasterachse ein (GDD 2).
8. Ablauf wie in der Studie: 1,1 s Vorwarnung mit gelber Linie und Einschlagmarken, Gunship fliegt die Linie in Achsrichtung ab, 8 Bomben, 30-%-Deckel gegen Koloss und Bosse.
9. HUD-Symbol Luftschlag in der Runenscheiben-Fassung: `reference/konzept/hud/luftschlag.svg` (Gunship von oben).

9b. **Bossdeckel Seelenfeuer-Obelisk** (GDD-Update Abschnitt 3):
    - Gegen Bosse und den Koloss höchstens 5 % der maximalen Lebenspunkte pro Treffer, gegen alle anderen Gegner weiter 22 %.
    - Neuer Datenwert in `src/data/`.
    - Unit-Test: ein Treffer gegen den Koloss zieht genau 5 % ab, gegen einen normalen Gegner 22 %.

### C. Grafik
10. **Bunker mit allen Rängen** und **sechs Standard-Aufsätzen** (ART 1 und 2).
11. **Spezialbasis** passt exakt auf ein Feld, nur die Stützen ragen über (ART 3).
12. **Sechs Spezialwaffen** mit neuen Rollen und Effekten (ART 4, GDD 3):
    - Reinigungsschrein als Aura.
    - Glutkessel mit Brand-Übersprung.
    - Sturmbatterie mit blauer Munition.
13. **Drehbares Modellmodul** in `src/render/` (ART 7). Darauf aufbauend den **Koloss** (ART 5) und das **Gunship** (ART 6), jeweils in allen vier Richtungen.
14. **Zielankündigung des Koloss:**
    - rote gestrichelte Fahrlinie,
    - rot pulsierende Schneisenfelder,
    - roter Zielring mit umlaufenden Segmenten,
    - Textbanner mit Warnstreifen.
    Ersetzt den bisher wiederverwendeten goldenen Kapselring.
15. **Bollwerk** in der finalen Grafik wie in der Studie: Steinblock, zwei Stützstreben, gelbes Warnband. Es ersetzt das Trümmerfeld, auf dem es gebaut wird.
16. Kurze Durchsicht der bestehenden Kommando-Effekte (Orbitalschlag, Stasisfeld, Heiliges Banner): Stil und Tuschekontur passen zum Rest, keine Platzhalter mehr.

## Nicht im Umfang
- Balancing-Werte über die in `GDD-update-v4.md` genannten Startwerte hinaus.
- Sound.

## Hinweise zur Umsetzung
- Die Studien sind Prototypen mit `Math.random()`, Einzeldatei und festen Zahlen. Übernommen werden nur Formen, Farben, Abläufe und Effekte. Für die Architektur gelten weiter die Regeln aus `CLAUDE.md`:
  - Simulation und Rendering getrennt,
  - Zufall aus dem geseedeten Generator,
  - Zahlen in `src/data/`.
- Die Tiefensortierung von Koloss und Gunship muss mit Trümmern, Stellungen und Gegnern zusammenpassen. Der Koloss belegt optisch mehr als ein Feld. Sortierwert wie in der Studie: seine Mitte plus 0,4.
- Bei `prefers-reduced-motion`: kein Wackeln, gedämpfte Mündungsblitze. Die Pulsanimation der Zielmarkierung bleibt, aber langsamer.

## Abnahme
- Koloss in allen vier Fahrtrichtungen:
  - korrekt gezeichnet, keine verdrehten oder durchscheinenden Flächen,
  - Zielring auf dem ersten Hindernis der Fahrlinie,
  - genau die 5 markierten Felder werden bearbeitet, vorhandene Trümmer darin sichtbar zerstört,
  - kein Durchfahren von Trümmern ohne Zerstörung.
- Bollwerk auf dem Zielfeld stoppt ihn. Danach sucht er einen Weg zur Bastion und ignoriert die Signalfeuer.
- Eingeschlossen: Countdown sichtbar, danach Durchbruch.
- Luftschlag rastet ein, Gunship fliegt in Achsrichtung, der Deckel wirkt.
- Obelisk-Treffer gegen Koloss und Bosse ziehen höchstens 5 % ab.
- Der verwaiste lila Effekt tritt nach mehreren Koloss-Durchbrüchen nicht mehr auf.
- Alle Ränge und alle zwölf Stellungen im Spiel sichtbar, Spezialstellungen belegen genau ein Feld.
- Bestehende Tests grün. Neue Tests für:
  - Fahrlinienwahl und Zielfeld,
  - Schneisenlänge,
  - Wegfindung mit Trümmerkosten,
  - Einschluss,
  - Effekt-Aufräumen.
- Screenshots aller vier Koloss-Richtungen und beider Stellungsmodi in Tablet-Größe (1180 x 820).
