# Runde 1 — die drei Klippen

**Stand:** Vorschlag, nichts geändert. Die Werte unten liegen als
`runde-1/vorschlag.json` bereit und sind über `npm run replay -- … --data`
nachvollziehbar, aber nicht in `src/data/`.

**Grundlage:** vier von Till gespielte Partien vom 28.09.2026, 147 bewertete
Wellen, keine Debug-Hebel. Drei davon sind verwertbar; MZGGZJ fällt weg, weil das
Nachspielen die Partie seit `88fc725` nicht mehr ergibt. Dazu die Kraftkurve über
50 Wellen und die Bot-Läufe aus Runde 0.

Zwei Stile sind darin: einmal Labyrinth (8425CM, Route bis 108), dreimal „an der
Strecke entlang" (Route 43 bis 60).

---

## Was gemessen wurde

### 87 % aller Wellen sind „zu leicht"

128 von 147 Bewertungen. Die Kraftkurve rechnet dasselbe aus, ohne Till zu
fragen: die Reserve — lieferbarer Schaden geteilt durch die wirksamen
Lebenspunkte der Welle — liegt in **W5–W30 im Mittel bei 1396 %**. 44 von 50
Wellen liegen über 200 %. Der Spieler kann das Vierzehnfache dessen austeilen,
was eine Welle aushält.

Entsprechend passiert nichts: in seiner gewonnenen Partie über 50 Wellen kostet
ihn **eine einzige Welle überhaupt etwas** — Welle 30. Die anderen 49 sind
folgenlos.

### Aber an drei Stellen verliert er sehr viel auf einmal

| Welle | was passiert | Kosten | in wie vielen Partien |
|---|---|---|---|
| 8 | Fliegerwelle gegen einen Bau ohne Luftabwehr | **14 von 20 Leben** | 1 von 3 |
| 30 | Der Warpherold kommt durch | 5 Leben | **2 von 2**, die so weit kamen |
| 35 | Der Koloss kommt durch | **15 Leben = sofort verloren** | noch nie — siehe unten |

Das ist kein Schwierigkeitsverlauf, das sind drei Schalter. Zwischen ihnen
passiert nichts, an ihnen passiert alles.

### Welle 30: der Boss ist doppelt so zäh, wie seine Zahlen sagen

Der Warpherold steht in der Tabelle mit 3000 Lebenspunkten, 1500 Schild und Tempo
0,8. Gerechnet, was daraus im Spiel wird:

- Der Warpsprung von 3 Feldern alle 6 Sekunden sind **+0,5 Felder/s**. Wirksames
  Tempo **1,30 statt 0,8 — 63 % schneller**, schneller als ein Krieger (1,1).
- Damit steht er auf einer Route von 57 Feldern **44 s unter Feuer statt 71 s**.
- In diesen 44 s regeneriert das Schild bei 120/s **5262 zusätzliche
  Lebenspunkte**.

Wirksam sind es also rund **9700 Lebenspunkte**, nicht die 4500 der Tabelle.

Und er kommt in **jeder** Partie durch, 19 von 20 Gegnern getötet, einer
durch — bei Route 57 genauso wie bei Route 108. **Die Routenlänge ändert daran
nichts**, und das ist der eigentliche Vorwurf: Der Spieler baut ein Labyrinth und
die Welle, die als einzige etwas kostet, interessiert sich nicht dafür.

Gegengeprobt, jeweils Welle 30 in beiden Partien:

| Änderung | EFDXE8 (Route 57) | 8425CM (Route 108) |
|---|---|---|
| unverändert | 1 durch | 1 durch |
| Sprung 3 → 1 Feld | 1 durch | 0 durch |
| Sprung alle 12 s | 1 durch | 0 durch |
| Schildregen 120 → 40 | 1 durch | 0 durch |
| **Sprung aus** | **0 durch** | **0 durch** |

Jede Abschwächung belohnt das lange Labyrinth. Nur das Abschalten hilft auch dem
kurzen Weg.

### Welle 35: eine Klippe, die niemand so gebaut hat

Die Rechnung geht genau auf, und das ist das Beunruhigende:

1. Der Warpherold kostet in Welle 30 **immer** 5 Leben. Aus 20 werden 15.
2. `kolossLeakCost` ist **genau 15**.
3. Kommt der Koloss in Welle 35 durch, ist die Partie in diesem Moment vorbei.

Durchgekommen ist der Koloss in keiner der drei Partien: Till hat ihn beide Male
getötet, in Welle 35 und in Welle 45. **Wie knapp das war, zeigt sich, sobald man
irgendetwas anfasst:** Schon `healthGrowth` von 1,12 auf 1,13 —
ein knappes Prozent — reicht, damit der Koloss überlebt und die Partie in Welle 35
endet. Dasselbe bei jeder Rangabsenkung.

Das hat auch eine Folge für die Arbeit selbst: **solange diese Klippe steht, lässt
sich keine Schwierigkeitsänderung messen.** Jede Änderung, egal wie klein, endet
in Welle 35, und das Ergebnis sagt nichts über die anderen 49 Wellen.

### Tills Verdacht zu den Rängen trifft nicht zu

Der Auftrag nennt als erste Baustelle die Rangfaktoren (1 / 2,2 / 5 / 12 / 30)
gegen das Lebenspunktwachstum (1,12 je Welle). Gemessen über die Partien wächst
**der Gegner schneller als der Spieler**, nicht umgekehrt:

| Partie | Lebenspunkte | Feuerkraft-Index | Vorsprung |
|---|---|---|---|
| 7CT7LQ (W5→16) | ×1,109 je Welle | ×1,224 | Spieler +10 % |
| 8425CM (W5→35) | ×1,200 je Welle | ×1,109 | **Gegner +8 %** |
| EFDXE8 (W5→50) | ×1,162 je Welle | ×1,088 | **Gegner +7 %** |

Der Feuerkraft-Index (Summe der Rangfaktoren über alle Stellungen) je 1000
Lebenspunkte der Welle fällt in der gewonnenen Partie von 4,87 in Welle 5 auf
0,25 in Welle 50 — auf ein Zwanzigstel.

Nur in den ersten Wellen zieht der Spieler davon, und dort sitzt auch der
verschwendete Schaden: **bis zu 90 % des angekommenen Schadens in W1–W10**, gegen
3 bis 4 % in W41–W50. Eine Stellung, die einen Schwärmer zweimal tötet, ist nicht
stark, sondern falsch eingestellt.

Ein Rangschritt ist etwa 7 bis 8 Wellen Gegnerwachstum wert (×2,2 bis ×2,5 gegen
1,12 je Welle). Das ist in sich stimmig; die Ränge sind nicht das Problem.

---

## Vorschlag für Runde 1

**Runde 1 dreht nicht an der Schwierigkeit, sondern räumt die Klippen weg** —
weil man die Schwierigkeit erst danach messen kann.

```json
{
  "bosses": {
    "warpherald": { "warpJump": { "cells": 0 }, "shieldRegen": 40 }
  },
  "rules": { "kolossLeakCost": 8 }
}
```

**1. Warpsprung aus (3 → 0 Felder).** Der Warpherold läuft dann mit seinem
angeschriebenen Tempo 0,8 und steht die volle Zeit unter Feuer. Er behält Schild
und Warprüstung, also seinen Charakter; was wegfällt, ist die Fähigkeit, die die
Routenlänge wertlos macht.

**2. Schildregeneration 120 → 40/s.** 120/s über eine lange Strecke sind mehr
Lebenspunkte, als in der Tabelle stehen. Bei 40/s bleibt der Schild eine Hürde,
die ein langes Labyrinth aufzehren kann — das ist der Weg, auf dem Mazing gegen
diesen Boss überhaupt etwas bewirkt.

**3. `kolossLeakCost` 15 → 8.** 15 von 20 Startleben sind 75 %: ein einzelner
Gegner entscheidet die ganze Partie in einem Augenblick. Bei 8 ist ein
Durchbruch schwer zu verkraften und zweimal tödlich — ein Gefälle statt eines
Schalters.

### Was der Vorschlag misst

| | Wellen | Leben am Ende | Durchbrüche |
|---|---|---|---|
| unverändert | 50 | 15, Sieg | W30 |
| **Vorschlag** | 50 | **20, Sieg** | **keine** |
| Vorschlag + `healthGrowth` 1,13 | 50 | 2, Sieg | W30, W35, W40 |
| Vorschlag + `healthGrowth` 1,14 | 48 | 0, verloren | W30, W35, W40, W48 |
| Vorschlag + `countPerWave` 1,5 | 50 | 12, Sieg | W35 |

**Der Vorschlag macht das Spiel zunächst leichter**, und das ist beabsichtigt: er
nimmt die beiden Stellen weg, die bisher als einzige etwas gekostet haben. Dafür
verhalten sich die Schwierigkeitshebel danach wie Hebel — die untere Hälfte der
Tabelle ist ein Verlauf und keine Klippe mehr. Das ist die Grundlage für Runde 2.

> **Einschränkung, die für jede Zeile hier gilt:** Nachgespielt werden Tills
> eigene Züge. Ein Mensch passt sich an, ein Protokoll nicht. Die Zahlen sind
> eine **Obergrenze für die Härte**, keine Vorhersage. Bei 1396 % Reserve hat ein
> Spieler sehr viel Spielraum, den das Nachspielen nicht nutzt.

---

## Was Till entscheiden muss

1. **Warpsprung ganz weg oder nur kleiner?** Ganz weg ist die einzige Variante,
   die auch dem kurzen Weg hilft. Kleiner (1 Feld) belohnt nur das lange
   Labyrinth — was auch eine Haltung sein kann: „Wer nicht mazet, zahlt hier."
2. **Ist der Koloss als Partie-Entscheider gewollt?** 15 von 20 Leben sind eine
   Ansage. Wenn ja, bleibt 15 und stattdessen braucht Welle 35 eine Warnung, die
   der Spieler versteht. Wenn nein, ist 8 der Vorschlag.
3. **Welle 8 ist die dritte Klippe und hier nicht behandelt.** 14 von 20 Leben an
   eine Fliegerwelle, weil vier von sechs Doktrinen Flieger überhaupt treffen und
   der Bau zufällig keine davon hatte. Das ist keine Zahlenfrage: Entweder das
   Spiel sagt vorher, dass Luftabwehr fehlt, oder Flieger dürfen nicht so viel
   kosten. Gehört nach Runde 2 oder in die Bedienführung.

---

## Wie es weitergeht

1. Till entscheidet über die drei Punkte oben.
2. Werte nach `src/data/` und in die Wellenregeln, `RULESET_VERSION` auf 4.
3. Till spielt zwei bis drei **Testeinstiege** — Welle 30 und Welle 35 sind die
   auffälligen — und bewertet.
4. Auswertung als `runde-2.md`, dann geht es an die Schwierigkeit: die 1396 %
   Reserve im Mittelspiel und der verschwendete Schaden in den ersten zehn Wellen.

## Dateien

| Datei | Inhalt |
|---|---|
| `runde-1/vorschlag.json` | die drei Werte oben, für `npm run replay -- … --data` |
| `runde-1/vergleich-schwierigkeit.json` | derselbe Vorschlag plus `healthGrowth` 1,13, als Ausblick auf Runde 2 |
| `kraftkurve.html` | Reserve je Welle, Modell gegen die gemessenen Partien |
