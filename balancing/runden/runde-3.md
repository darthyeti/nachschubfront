# Runde 3 — zwölf leere Wellen

**Stand:** Vorschlag, nichts geändert.

**Grundlage:** Tills Partie WFQZ4M vom 29.09., Version 0.9.3, Regelversion 5, 50
Wellen, Sieg mit 7 Leben, Route 176 — die erste Messung unter Runde 2, und im
selben Labyrinth-Stil wie die Partie davor, also direkt vergleichbar.

---

## Runde 2 hat gewirkt

| | vorher (ASQ7XY) | jetzt (WFQZ4M) |
|---|---|---|
| „zu leicht" | 43 von 49 (**88 %**) | 25 von 49 (**51 %**) |
| „passt" | 6 | **24** |
| Leben am Ende | 12 | **7** |
| Leben verloren bei | W35 | **W35, W40** |

Reserve, beide Seiten aus Tills eigenem Spiel: **W5–W30 von 1556 % auf 798 %**,
W31–W50 von 673 % auf 288 %.

Das Spätspiel ist damit dort, wo es hingehört: **W35 bis W49 sind durchgehend
„passt"**, und Till hat in 50 Wellen kein einziges Mal „zu schwer" gesagt.

---

## Was übrig ist: eine zusammenhängende Lücke

```
W 1–W 7   passt
W 8–W19   zu leicht          ← zwölf Wellen am Stück
W20–W30   wechselnd (passt bei 20, 23, 27, 30)
W31–W34   zu leicht
W35–W49   passt
```

Die Kraftkurve sagt dasselbe: In W8–W19 liegt die Reserve zwischen **782 % und
1486 %**, während W31–W50 im Mittel bei 288 % liegt.

### Ein globaler Hebel kann das nicht beheben — gemessen

Die Mitte müsste etwa **2,7-mal stärker** werden, das Spätspiel steht schon
richtig. Ein Wert, der alle Wellen anfasst, kippt deshalb hinten um, bevor er
vorne ankommt:

| | Ergebnis |
|---|---|
| `healthGrowth` 1,125 (heute) | 50 Wellen, 7 Leben, Sieg |
| `healthGrowth` 1,13 | unverändert |
| `healthGrowth` 1,14 | **verloren in Welle 48** |
| `healthGrowth` 1,16 | verloren in Welle 38 |
| `baseCount` 12→18 oder 12→24 | unverändert |
| Wellenmischung angeglichen (+30 % LP bei Horde/Luft/Warp) | unverändert |

**Zwischen „wirkt nichts" und „verliert hinten" liegt nichts.** Der Grund ist die
Form: `scale = healthGrowth ^ (Welle − 1)` ist eine einzige Exponentialkurve,
während die Kraft des Spielers linear mit der Stellungszahl und stufig mit den
Rängen wächst. Eine Exponentialkurve kann diese Form nicht treffen.

### Und die Lücke ist gar kein Überlebensproblem

Till verliert in dieser Partie Leben an **genau zwei Stellen: W35 (Koloss) und
W40 (Boss)** — beides einzelne Kreaturen, die durchkommen oder nicht. Die Stärke
der Wellen dazwischen ändert daran nichts, und genau deshalb bewegt sich in der
Tabelle oben nichts.

W8–W19 ist nicht zu leicht im Sinne von „hier könnte ich verlieren". **Es ist
leer im Sinne von „hier gibt es nichts zu entscheiden".**

---

## Warum dort nichts zu entscheiden ist

| | |
|---|---|
| Nachschubkäufe | Welle 1, 2, 4, 6, 8, 10, **13** |
| erstes Bollwerk | **Welle 32** |
| Abrisse in der ganzen Partie | **keiner** |

**Ab Welle 13 ist die Nachschubstufe auf dem Maximum**, und danach gibt es 37
Wellen lang nichts mehr zu kaufen. Das Geld staut sich entsprechend:

| Requisition | W13 | W20 | W30 | W40 | W50 |
|---|---|---|---|---|---|
| | 455 | 1190 | 3155 | 3500 | **5338** |

Fünftausend Requisition, die nie eine Entscheidung waren. In der Partie davor
waren es 757 — der Unterschied ist nur, dass dort mehr Bollwerke gebaut wurden.

Das GDD hat diesen Fall vorgesehen und zwei Mittel vorgemerkt (Abschnitt 14),
beide ausdrücklich mit „noch nicht umsetzen" und „separat aufgreifen, falls
Bollwerk und teurere Kommandos allein nicht reichen". **Die Messung sagt jetzt:
Sie reichen nicht.** Und der M6-Auftrag sagt (Punkt 12), dass eines von beiden in
einer Runde von Teil 2 zur Entscheidung gestellt wird. Das ist diese Runde.

---

## Vorschlag: zwei Teile, in dieser Reihenfolge

### A — Der Mitte eine eigene Kurve geben

Die Wellenregeln kennen schon einen Bandfaktor: `earlyWaves: 5` mit
`earlyFactor: 0.7` macht die ersten fünf Wellen milder. Vorgeschlagen ist das
Gegenstück für die Mitte — ein Faktor, der nur W8 bis W22 anhebt, in derselben
Schreibweise und an derselben Stelle.

Das ist eine kleine Code-Änderung in `tests/tools/wave-rules.mjs` und
`buildWaves`, kein reiner Datenwert: **`--data` kann sie nicht liefern**, weil es
eine neue Regel ist und nicht eine geänderte Zahl. Genau dafür gibt es die
Unterscheidung (Entscheidung 3 des M6-Plans).

Der nötige Faktor lässt sich erst nach dem Einbau messen; die Kraftkurve legt
etwa **1,5 bis 2** nahe, um von 798 % auf die 288 % des Spätspiels zu kommen.

### B — Dem Geld eine Senke geben

Hier stehen die beiden Mittel des GDD zur Wahl, und die Entscheidung ist Tills:

**B1 — Unbegrenzte Nachschubstufe.** Über Stufe 8 hinaus je Stufe eine leicht
höhere Legende-Chance bei stark steigendem Preis. Bindet späte Überschüsse,
ändert nichts am Spielablauf. Der M6-Plan warnt an einer Stelle: Eine neunte
Stufe ist eine **Formänderung** der Tabelle — `MAX_SUPPLY_LEVEL` und
`SUPPLY_WEIGHT_COUNT` werden beim Start aus ihr abgeleitet. Also echte
Code-Arbeit, kein Datenwert.

**B2 — Aufwertung statt Bau.** Ab etwa Welle 30 eine vierte Option in der
Auswahlphase: Die Kapsel wird nicht gebaut, sondern auf eine bestehende Stellung
derselben Doktrin gelegt und hebt sie um einen Rang. Verlagert die späte Partie
vom Bauen zum Veredeln, ohne weitere Felder zu belegen.

**Meine Einschätzung:** B2 ist die interessantere Entscheidung — sie gibt dem
Spieler in jeder Auswahlphase eine echte Wahl zurück, statt nur eine Geldsenke
aufzumachen. B1 ist die kleinere Änderung und bindet Geld zuverlässiger. Beides
zusammen wäre zu viel auf einmal.

### Wichtig: B macht das Spiel leichter

Beide Mittel verwandeln gestautes Geld in Kampfkraft. **Sie lösen ein
Entscheidungsproblem, kein Schwierigkeitsproblem**, und sie machen die Partie
messbar leichter. Deshalb A vor oder mit B — nicht danach, sonst wird die gerade
gewonnene Spannung im Spätspiel wieder ausgeglichen.

---

## Die Einschränkung

Nachgespielt werden Tills Züge; ein Protokoll passt sich nicht an. Er hat mit
**7 von 20 Leben** gewonnen, und `healthGrowth` 1,14 lässt ihn in Welle 48
verlieren — die Partie steht auf der Kippe. Ein Spieler, der weiß, dass es eng
wird, spielt anders. Dass Till in 50 Wellen **kein einziges Mal „zu schwer"**
gesagt hat, spricht dafür, dass noch Luft ist; die Nachrechnung zeigt sie nur
nicht.

## Wie es weitergeht

1. Till entscheidet: A, B1, B2 — und ob A zuerst allein kommt.
2. Einbau, `RULESET_VERSION` auf 6.
3. Eine gespielte Partie, gern wieder Labyrinth.
4. Runde 4: die bis zu 90 % verschwendeter Schaden in den ersten zehn Wellen —
   der letzte der ursprünglichen Befunde, der noch offen ist.
