# Runde 2 — die 1556 %

**Stand:** Vorschlag, nichts geändert. Die Werte liegen als
`runde-2/vorschlag.json` bereit und sind über `npm run replay -- … --data` und
`npm run powercurve -- --data` nachvollziehbar.

**Neu seit Runde 1:** Tills Partie ASQ7XY vom 29.09., Version 0.9.2,
Regelversion 4, 50 Wellen, Sieg mit 12 Leben — die erste Messung unter den neuen
Regeln, und mit **Route 178** ein Stil, den es vorher nicht gab.

---

## Runde 1 hat gehalten, was sie versprochen hat

| Welle 30 | getötet | durch | Leben | Tills Urteil |
|---|---|---|---|---|
| EFDXE8, Route 57, vor Runde 1 | 19/20 | 1 | −5 | **zu schwer** |
| ASQ7XY, Route 178, nach Runde 1 | **20/20** | **0** | **0** | **passt** |

Das Labyrinth hält den Warpherold, und Till hat die Welle zum ersten Mal mit
„passt" bewertet statt mit „zu schwer". Welle 30 bringt jetzt Mazing bei.

Welle 35 kostete ihn 8 Leben — der Koloss kam durch, zum neuen Preis — und die
Partie ging weiter und wurde gewonnen. Genau das war gemeint mit „der Koloss soll
keine Partie entscheiden".

---

## Was übrig ist: das Spiel ist überall zu leicht

Runde 1 hat die Klippen geräumt, an der Schwierigkeit aber nichts geändert. Das
zeigt sich unverändert:

| | zu leicht | passt | zu schwer |
|---|---|---|---|
| EFDXE8 (Route 57) | 43 (90 %) | 4 | 1 |
| ASQ7XY (Route 178) | 43 (88 %) | 6 | 0 |

Und die „passt"-Wellen sind in beiden Partien fast dieselben: **W1, W30, W35,
W40, W44/45**. Das sind die Bosswellen und die Kolosse. **Alles dazwischen ist
für den Spieler Rauschen** — 44 von 50 Wellen fallen ohne Zutun.

Die Kraftkurve rechnet dasselbe und wird durch die neue Partie noch deutlicher:

| Reserve | W1–W10 | W5–W30 | W31–W50 |
|---|---|---|---|
| vor der neuen Partie | 534 % | 1414 % | 444 % |
| **mit ASQ7XY** | 534 % | **1556 %** | 673 % |

47 von 50 Wellen liegen über 200 %. Ein gebautes Labyrinth macht es **nicht
schwerer, sondern lockerer** — es kauft Zeit unter Feuer, und die Reserve steigt.

### Ein Nebenbefund: Geld ist nur für den Labyrinth-Bauer knapp

| Requisition | W30 | W40 | W50 |
|---|---|---|---|
| EFDXE8 (5 Bollwerke) | 1586 | 1741 | **2625** |
| ASQ7XY (15 Bollwerke) | 1943 | 918 | **757** |

Bis Welle 30 sammeln beide gleich. Danach gibt der Labyrinth-Bauer sein Geld für
Bollwerke aus, der andere hat **nichts, wofür er es ausgeben könnte**. Ab
Nachschubstufe 8 ist Bauen am Gelände die einzige Senke. Keiner der beiden hat je
`demolish` benutzt.

Das ist der alte Punkt „Requisition staut sich" — und er ist **stilabhängig**,
nicht allgemein. Für Runde 3 vorgemerkt, nicht für diese.

---

## Was nicht geht: Gegnerzahl allein

Naheliegend wäre, mehr Gegner zu schicken: Das wächst linear mit der Wellenzahl
und träfe damit genau die Delle in der Mitte. Es geht aber nicht weit genug.

| `countPerWave` | stärkste Welle | ASQ7XY endet mit |
|---|---|---|
| 0,5 (heute) | 94 Gegner | 12 Leben |
| 1,0 | 156 | 12 Leben |
| **1,25** | **183** | 12 Leben |
| 1,5 | 216 | 10 Leben |

Das Leistungsziel steht bei **200 Gegnern** (CLAUDE.md, Rendering-Regeln). Bei
1,25 sind es 183 in Welle 45 — gerade noch drin, und ohne jede Wirkung. Bei 1,5
wird es spürbar und das Ziel ist überschritten.

**Die Gegnerzahl ist also kein Hebel für sich: Das Leistungsbudget ist vor der
Schwierigkeit zu Ende.**

---

## Vorschlag

```json
{ "waves": { "healthGrowth": 1.125, "countPerWave": 1.25 } }
```

Beides für sich ändert **nichts** — `healthGrowth` 1,125 allein und
`countPerWave` 1,25 allein lassen beide Partien bei 15 und 12 Leben. Zusammen
greifen sie:

| | EFDXE8 (Route 57) | ASQ7XY (Route 178) |
|---|---|---|
| unverändert | 50 W, 15 Leben, 1 Durchbruch | 50 W, 12 Leben, 1 Durchbruch |
| **Vorschlag** | 50 W, **7 Leben**, 2 Durchbrüche | 50 W, **11 Leben**, 2 Durchbrüche |

Und die Kraftkurve:

| Reserve | W1–W10 | W5–W30 | W31–W50 | Wellen über 200 % |
|---|---|---|---|---|
| heute | 534 % | 1556 % | 673 % | 47 von 50 |
| **Vorschlag** | 292 % | **634 %** | 63 % | 31 von 50 |

Die Delle in der Mitte wird auf ein Zweieinhalbstel gestutzt, und das Spätspiel
bleibt im Modell positiv.

### Die Alternative: an die Ränge

`runde-2/alternative-raenge.json` — Rangfaktoren 1 / 2,2 / **4,5 / 9 / 20** statt
1 / 2,2 / 5 / 12 / 30.

| | EFDXE8 | ASQ7XY |
|---|---|---|
| Ränge 4,5/9/20 | 50 W, 2 Leben | 50 W, 6 Leben |

Härter, und beide Partien überleben es noch. **Ich schlage es trotzdem nicht
vor**, aus einem Grund, der zur Vorsicht mahnt: Das Modell hält diese Variante
für unspielbar — Reserve **−17 %** in W31–W50, fünfzehn Wellen im Minus — während
die Messung zwei gewonnene Partien zeigt. Modell und Messung widersprechen sich,
und bei so einem Widerspruch ist der größere Schritt der falsche.

(Zur Einordnung: Tills ursprünglicher Verdacht war, die Ränge wüchsen schneller
als die Gegner. Das ist widerlegt — über eine Partie wächst der Gegner schneller.
Was hier zur Debatte stünde, ist nicht das Wachstum, sondern die **Höhe** der
oberen Ränge.)

---

## Die Einschränkung, die für alle Zahlen gilt

Nachgespielt werden Tills eigene Züge. Ein Mensch passt sich an, ein Protokoll
nicht. **Alle Zahlen hier sind eine Obergrenze für die Härte.** Bei 1556 %
Reserve hat ein Spieler sehr viel Spielraum, den das Nachspielen nicht nutzt —
die 7 und 11 Leben des Vorschlags werden in einer wirklich gespielten Partie eher
mehr sein.

Das spricht dafür, in Runde 2 **zu wenig statt zu viel** zu ändern und lieber
eine Runde 3 anzuhängen: Zwei sanfte Schritte mit einer gespielten Partie
dazwischen sind messbar, ein großer Schritt ist es nicht.

---

## Wie es weitergeht

1. Till entscheidet: Vorschlag, Alternative, oder etwas dazwischen.
2. Werte nach `src/data/` bzw. in die Wellenregeln, `RULESET_VERSION` auf 5.
3. Eine gespielte Partie unter den neuen Regeln — gern wieder mit Labyrinth, weil
   dieser Stil die größte Reserve hat und deshalb am ehesten zeigt, ob es reicht.
4. Runde 3: die Requisition ohne Senke ab Welle 30, und die bis zu 90 %
   verschwendeter Schaden in den ersten zehn Wellen.

## Dateien

| Datei | Inhalt |
|---|---|
| `runde-2/vorschlag.json` | `healthGrowth` 1,125 und `countPerWave` 1,25 |
| `runde-2/alternative-raenge.json` | die Rangvariante, zum Vergleich |
