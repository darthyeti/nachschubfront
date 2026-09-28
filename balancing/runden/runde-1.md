# Runde 1 — die drei Klippen

**Stand: entschieden und umgesetzt am 28.09.2026, Regelversion 4.**

Till hat die drei offenen Fragen beantwortet:

1. **Der Warpsprung wird kleiner, nicht abgeschaltet** — Welle 30 belohnt damit
   ausdrücklich das Labyrinth.
2. **Der Koloss soll keine Partie entscheiden** — sein Preis sinkt.
3. **Welle 8 bleibt, wie sie ist.** Das ist eine Lernkurve: „Den Fehler ohne
   Luftabwehr macht man nur einmal." Damit ist sie keine offene Baustelle mehr,
   sondern eine Entscheidung, und gehört nicht ohne neuen Anlass wieder auf die
   Liste.

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

## Was geändert wurde

**Runde 1 dreht nicht an der Schwierigkeit, sondern räumt die Klippen weg** —
weil man die Schwierigkeit erst danach messen kann.

| Wert | vorher | jetzt | Datei |
|---|---|---|---|
| `warpherald.warpJump.cells` | 3 | **1** | `src/data/enemies.js` |
| `warpherald.shieldRegen` | 120 | **40** | `src/data/enemies.js` |
| `RULES.kolossLeakCost` | 15 | **8** | `src/data/rules.js` |
| `RULESET_VERSION` | 3 | **4** | `src/data/rules.js` |
| `APP_VERSION` | 0.9.1 | **0.9.2** | `src/data/version.js` |

**1. Warpsprung 3 → 1 Feld.** Damit läuft der Warpherold wirksam 0,97 statt 1,30
Felder je Sekunde — das Tempo der Warpseher, die er anführt, statt schneller als
ein Krieger. Der Sprung bleibt als Fähigkeit erhalten, er entscheidet die Welle
nur nicht mehr allein.

Gemessen an Welle 30 heißt „kleiner statt aus" genau das, was Till gewählt hat:

| | Route 57 (ohne Labyrinth) | Route 108 (Labyrinth) |
|---|---|---|
| vorher | 1 durch, −5 Leben | 1 durch, −5 Leben |
| **jetzt** | 1 durch, −5 Leben | **0 durch, keine Kosten** |

Das Labyrinth hält den Boss, der kurze Weg zahlt. Welle 30 ist damit die Welle,
die Mazing beibringt — so wie Welle 8 die Luftabwehr beibringt.

**2. Schildregeneration 120 → 40/s.** Nicht kosmetisch, sondern nötig, damit die
erste Änderung sich nicht selbst aufhebt: Ein langsamerer Boss steht **länger**
unter Feuer und regeneriert deshalb **mehr**. Bei Sprung 1 und 120/s wären es
7076 zusätzliche Lebenspunkte über 57 Felder — mehr als vorher. Bei 40/s sind es
2359, also etwa ein zweiter Schild statt vier weiterer.

**3. `kolossLeakCost` 15 → 8.** 15 von 20 Startleben hießen: ein einzelner Gegner
entscheidet die Partie in einem Augenblick. Bei 8 ist ein Durchbruch schwer zu
verkraften, und zwei — also beide Kolosse einer Partie — beenden sie weiterhin.
Im GDD stand 15 als „Startwert, im Balancing zu justieren"; die beiden Stellen
dort sind mitgezogen.

### Was die Änderung bewirkt

Tills gewonnene Partie (EFDXE8, Route 57) endet unverändert bei 50 Wellen und 15
Leben — sie zahlt Welle 30 weiter, weil sie kein Labyrinth gebaut hat. Die
Labyrinth-Partie (8425CM) verliert ihren Durchbruch in Welle 30.

Der Unterschied zeigt sich erst, wenn man danach an der Schwierigkeit dreht:

| | vorher | **nach Runde 1** |
|---|---|---|
| `healthGrowth` 1,13 | verloren in W35 | **Sieg mit 2 Leben** |
| `healthGrowth` 1,14 | verloren in W35 | verloren in W48 |
| `countPerWave` 1,5 | verloren in W35 | Sieg mit 12 Leben |
| Ränge 1/2/4/8/16 | verloren in W35 | Sieg mit 2 Leben |

**Vorher endete jede Änderung in Welle 35 und sagte nichts.** Jetzt ist die
untere Hälfte ein Verlauf. Das ist der eigentliche Ertrag dieser Runde und die
Grundlage für Runde 2.

### Was das für die vorhandenen Protokolle heißt

Regelversion 4 macht die vier Protokolle nicht pauschal wertlos — geprüft wird,
ob sie sich noch nachspielen lassen, nicht der Stempel. Das Ergebnis:

| Protokoll | | |
|---|---|---|
| 7CT7LQ | spielt sich unverändert nach | bleibt Maßstab |
| EFDXE8 | spielt sich unverändert nach | bleibt Maßstab |
| 8425CM | weicht ab W30 ab (Labyrinth hält jetzt) | fällt weg |
| MZGGZJ | weicht ab W35 ab | fällt weg |

`calibrate` und `powercurve` lassen die beiden von allein aus. Für Runde 2
braucht es neue Partien unter Regelversion 4.

> **Einschränkung, die für jede Zeile hier gilt:** Nachgespielt werden Tills
> eigene Züge. Ein Mensch passt sich an, ein Protokoll nicht. Die Zahlen sind
> eine **Obergrenze für die Härte**, keine Vorhersage. Bei 1396 % Reserve hat ein
> Spieler sehr viel Spielraum, den das Nachspielen nicht nutzt.

---

## Welle 8 bleibt — als Entscheidung

14 von 20 Leben an eine Fliegerwelle, weil nur vier von sechs Doktrinen Flieger
treffen und der Bau zufällig keine davon hatte. Tills Entscheidung: so gewollt,
den Fehler macht man nur einmal.

Damit ist Welle 8 **keine offene Baustelle mehr**. Sie steht hier, damit sie nicht
beim nächsten Durchsehen der Zahlen wieder als Ausreißer auffällt und
„repariert" wird. Falls sie doch noch etwas braucht, dann Bedienführung — ein
Hinweis vor der Welle — und keine Zahl.

---

## Wie es weitergeht

1. **Till spielt Testeinstiege bei Welle 30 und 35** (Hauptmenü → Testeinstieg,
   nur mit `?debug`) und bewertet. Welle 30 ist der Prüfstein: Hält ein Labyrinth
   den Warpherold jetzt, und zahlt der kurze Weg spürbar?
2. Zwei bis drei neue Partien unter Regelversion 4 — die alten tragen Runde 2
   nur noch zur Hälfte.
3. Dann Runde 2, und dort geht es an die Schwierigkeit: die 1414 % Reserve im
   Mittelspiel und die bis zu 90 % verschwendeter Schaden in den ersten zehn
   Wellen.

## Dateien

| Datei | Inhalt |
|---|---|
| `runde-1/vorschlag.json` | die drei Werte, wie sie beschlossen wurden — inzwischen in `src/data/`, hier als Beleg |
| `runde-1/vergleich-schwierigkeit.json` | dieselben Werte plus `healthGrowth` 1,13, der Ausblick auf Runde 2 |
| `kraftkurve.html` | Reserve je Welle, Modell gegen die gemessenen Partien |
