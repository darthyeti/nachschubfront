# Runde 4 — das Urteil sagt nichts mehr

**Berührt:** `balancing/` und `tests/tools` (Auswertung), Vorschlag betrifft
`src/ui/rating.js` und `src/core/prefs.js`.

**Stand:** Tills Antwort liegt vor — „schon besser, aber stellenweise vielleicht
doch noch zu leicht", dazu der Einwand, er sei inzwischen zu gut und nicht mehr
der Maßstab. Die Bewertungszeile fragt seit dieser Runde nur noch an zehn Wellen.
An den Spielwerten ist **nichts** geändert; warum nicht, steht unten.

**Grundlage:** Partie U4AZZQ vom 01.10.2026, Version 0.9.4, Regelversion 6,
50 Wellen, Sieg, Route 133.

---

## Runde 3, Teil A hat gewirkt

| Reserve | W1–W10 | W5–W30 | W31–W50 |
|---|---|---|---|
| vor Runde 3 (WFQZ4M) | 435 % | **798 %** | 288 % |
| nach Runde 3 (U4AZZQ) | 364 % | **523 %** | 290 % |

Das Band hat die Mitte gesenkt und das Spätspiel nicht angefasst — genau das war
die Absicht. Die zwölf leeren Wellen sind als Block verschwunden.

## Runde 3, Teil B2 wird nicht gewollt

Gemessen über alle späten Auswahlphasen seiner Partie:

| | |
|---|---|
| Auswahlphasen ab Welle 30 | **21** |
| davon mit einer Aufwertung im Angebot | **21** |
| davon bezahlbar | **21** |
| davon genommen | **2** (Welle 39 und 46) |

Es ist also **kein Reichweiten- und kein Preisproblem.** Die Option stand jedes
Mal zur Wahl und war jedes Mal bezahlbar. Er hat stattdessen 13-mal gebaut und
7-mal ein Rezept erfüllt.

Der Grund ergibt sich aus dem, was wir vorher gemessen haben: **Eine neue Stellung
ist in diesem Spiel mehr wert als ein Rang**, weil die Routenlänge alles dominiert
— ein Bau verlängert den Weg, eine Aufwertung nicht. Solange das so ist, verliert
„Aufwerten statt Bauen" die Abwägung fast immer.

Als Geldsenke hat B2 halb gewirkt: **Requisition am Ende 2056 statt 5338.** Den
größeren Teil davon haben aber 11 Bollwerke und 2 Abrisse gebunden, nicht die
2 Aufwertungen.

> Nachträglich gesehen war B2 ohnehin nicht das Mittel gegen die Langeweile: Die
> leeren Wellen lagen bei W8–W19, die Aufwertung beginnt bei W30. Das war A's
> Aufgabe, und A hat sie erledigt.

---

## Und jetzt das Problem

**Till hat 49 von 49 Wellen mit „passt" bewertet.** Kein einziges „zu leicht",
kein einziges „zu schwer".

Diese 49 „passt" umspannen Reserven von **−9 % bis 967 %** — dasselbe Wort für die
engste Welle des Spiels und für eine mit dem Zehnfachen der nötigen Feuerkraft.
Median 372 %.

Dazu: **Er hat in 50 Wellen kein einziges Leben verloren** und mit 20 von 20
gewonnen. Das ist die sicherste Partie von allen fünf.

| Partie | Leben am Ende | verlorene Leben | „zu leicht" |
|---|---|---|---|
| EFDXE8 (28.09.) | 15/20 | 5 | 90 % |
| WFQZ4M (29.09.) | 7/20 | 13 | 51 % |
| **U4AZZQ (01.10.)** | **20/20** | **0** | **0 %** |

**Das Ergebnis ist sicherer geworden und das Urteil besser.** Zwei Tage vorher
wurde eine Partie ohne Lebensverlust zu 88 % „zu leicht" genannt. Die beiden
Größen laufen auseinander, und damit ist die Bewertungszeile als Messgerät
vorerst wertlos: Sie unterscheidet nichts mehr.

### Tills Antwort

„Schon besser, aber stellenweise vielleicht doch noch zu leicht" — und dazu der
Einwand, der diese Runde bestimmt: **„ich bin mittlerweile zu gut in dem Spiel und
nicht mehr der Standard."**

Das ist messbar, und es stimmt noch deutlicher, als er vermutet.

---

## Umgesetzt: seltener fragen

Fünfzig Fragen hintereinander machen die Antwort zum Reflex. Das ist die
wahrscheinlichste Erklärung dafür, dass eine Partie ohne jede Bedrohung durchweg
„passt" bekommt.

Vorgeschlagen: **nur noch an wenigen Wellen fragen** — etwa acht, die die
Kraftkurve als interessant benennt (die engste, die weiteste, die Bosse, der
Koloss). Wer achtmal gefragt wird, überlegt; wer fünfzigmal gefragt wird, tippt.

Umgesetzt als `RATED_WAVES` in `src/data/rules.js`: **1, 8, 13, 18, 24, 30, 35,
41, 46, 50.** Nicht die dramatischsten Wellen — die kämen alle wieder als „passt"
zurück —, sondern eine Probe aus jedem Abschnitt, den die Abstimmung
auseinanderhalten muss: die eine wirklich enge Welle, die Strecke, die bis Runde 3
leer war, das Ende des Bandes, der Koloss, und das Spätspiel.

Ein Datenwert, keine Regel im Code: Eine Runde kann woanders hinschauen, ohne
`src/ui` anzufassen. Keine Regeländerung, also auch keine neue Regelversion.

---

## Was sonst noch offen steht

Unverändert aus Runde 3, beide gemessen und beide ohne Eile:

- **Die Wellenarten bleiben ungleich.** Luft und Horde tragen je Zähleinheit 78
  bis 81 Lebenspunkte, Panzer und Gemischt 142 bis 146. Angleichen allein bewirkt
  nichts, zusammen mit dem Band vielleicht.
- **Verschwendeter Schaden in den ersten zehn Wellen** — der letzte der
  ursprünglichen Befunde aus Runde 1, der noch nicht angefasst wurde.

## Wie es weitergeht

1. Till beantwortet die Frage oben.
2. Je nach Antwort: Abschluss von M6, oder Runde 4 mit einem Messgerät, das
   wieder unterscheidet.


---

## Die Schere: das Spiel wird für Schwächere härter und für Till leichter

Tills Einwand lässt sich beziffern. Zuerst sein eigenes Spiel — nur Größen, die
davon handeln, **was er gebaut hat**, nicht wie die Wellen zurückschlugen, denn
die bleiben über Regeländerungen hinweg vergleichbar:

| | Route bei Welle 30 |
|---|---|
| 28.09., Regelversion 2 | 57 · 57 · 108 |
| 29.09., Regelversion 4 und 5 | **169 · 219** |
| 01.10., Regelversion 6 | 132 |

Sein Labyrinthbau hat sich fast vervierfacht, und der Sprung liegt zwischen dem
28. und 29.09. — also unmittelbar nachdem die Auswertung von Runde 1 ihm gesagt
hatte, dass Labyrinth sich bisher nicht auszahlt, und Runde 1 es dann belohnt hat.
**Er hat sein Spiel an der Auswertung ausgerichtet.** Kein Vorwurf, aber eine
Rückkopplung im Messaufbau: Runde 2 und 3 wurden gegen einen stärkeren Spieler
gemessen als Runde 1.

Und jetzt die andere Seite. Die Bots über 20 Seeds, vor Runde 1 und heute:

| Strategie | Median vor Runde 1 | Median jetzt | Siege |
|---|---|---|---|
| Veredler | 28 Wellen | **13** | 0 von 20 |
| Feuerkraft | 23 | **12** | 0 von 20 |
| Labyrinth-Bauer | 18 | **10** | 0 von 20 |
| Einfach | 10 | **10** | 0 von 20 |
| Rezept-Jäger | 8 | **7** | 0 von 20 |

**Kein einziger Bot gewinnt mehr eine Partie.** Die beste Strategie kommt im
Median bis Welle 13; über Welle 20 kommen 20 % einer Strategie und sonst
niemand. Till gewinnt im selben Spiel mit 20 von 20 Leben.

Die drei Runden haben die Bots ungefähr **halbiert**, während Till von „Sieg mit
15 Leben" auf „Sieg ohne einen Kratzer" gegangen ist. Das ist eine Schere, und sie
hat einen Grund: **Die Routenlänge multipliziert alles.** Dieselbe
Lebenspunkt-Erhöhung kostet einen Spieler mit 57 Feldern Weg weit mehr als einen
mit 219. Die Hebel, an denen wir gedreht haben, wirken regressiv.

Besonders deutlich an Runde 3: Das Band hebt W6 bis W34, und die Bots sterben
jetzt gehäuft bei **W8, W10 und W13** — genau dort. Bei Till hat dasselbe Band in
der wirklich gespielten Partie **null** gekostet.

### Was das heißt

- Tills „stellenweise vielleicht noch zu leicht" ist das Urteil eines Spielers,
  der viermal besser mazt als zu Beginn. Danach weiterzudrehen, würde die Schere
  weiter öffnen.
- Umgekehrt ist „zu schwer für Schwächere" **nicht** belegt: Ein Bot ist kein
  Anfänger. Er setzt Zonen nach einer Regel und lernt innerhalb einer Partie
  nichts dazu — er ist eine untere Schranke, kein Spieler. Die Eichung ist in
  Runde 0 ausdrücklich gescheitert, und das gilt weiter.
- Belegt ist nur die **Richtung**: Über drei Runden sind die beiden Enden
  auseinandergelaufen. Welche Zahl für wen richtig ist, kann aus einem einzigen
  Spieler nicht mehr beantwortet werden.

### Vorschlag

**Kein Eingriff in die Werte in dieser Runde.** Stattdessen die eine fehlende
Messung beschaffen:

1. **Ein zweiter Mensch.** Tills Freund, der ohnehin dazustoßen will, hat das
   Spiel nie abgestimmt und kennt die Auswertungen nicht — genau die Referenz, die
   fehlt. Zwei bis drei Partien von ihm sagen mehr als zehn weitere von Till.
2. **Till spielt die zehn Fragen** einer weiteren Partie, damit die
   Bewertungszeile wieder etwas unterscheidet.
3. Erst dann entscheiden, ob weitergedreht wird — und in welche Richtung.

Falls sich bestätigt, dass die beiden Enden nicht mit einem Satz Zahlen zu
bedienen sind, ist das keine Balancing-Frage mehr, sondern eine
Schwierigkeitsstufe. Die steht nicht in M6 und wäre ein eigener Auftrag.

---

## Die zweite Messung: JGR9H6 (02.10.2026)

Die Partie des zweiten Spielers, Version 0.9.4, Regelversion 6. Sie spielt sich
Welle für Welle nach. **Niederlage in Welle 10**; bis dahin 5 Leben verloren
(W1: 4, W4: 1), in Welle 10 die übrigen 15. Keine Welle bewertet.

| | JGR9H6 | zum Vergleich |
|---|---|---|
| Route | 40 bis 47 | Till bei W10: 95 |
| Nachschubstufe | 1 bis Welle 8, dann 3 | |
| Stellungen bei W10 | 9, kaum verschmolzen (7 auf der zweiten Rangstufe) | |
| ungenutzt am Ende | 561 Requisition, 7 Kommandopunkte | |
| Ende | Welle 10 | Bots im Median 7 bis 13 |

**Woran sie verloren ging:** an der Brutmutter. Alle 15 Durchbrüche sind
Schwärmer aus ihrer Spur, ausgesetzt auf den letzten Feldern vor der Bastion
(Feld 35 bis 41 von 47) und fast unbeschädigt. Die Brutmutter selbst stand bei
Feld 43 noch mit 6765 Lebenspunkten.

**Was die Zahlen aus Runde 3 damit zu tun haben: nichts.** Nachgespielt mit
geänderten Werten:

| Änderung | Ergebnis |
|---|---|
| ohne Mittelband (Stand Runde 2) | Niederlage in Welle 10, 15 Durchbrüche |
| Mittelband 1,75 statt 2,5 | Niederlage in Welle 10, 15 Durchbrüche |
| Brutmutter mit halben Lebenspunkten | Niederlage in Welle 10 |
| Schwärmerspur halb so oft | Niederlage in Welle 10 |
| ganz ohne Schwärmerspur | übersteht Welle 10 mit 10 Leben |

Die Abwehr war für Welle 10 zu schwach, unter jeder Fassung der Wellen seit
Runde 1. Gefehlt hat nicht Glück, sondern das, was das Spiel stark macht:
Nachschub, Verschmelzen, Labyrinth, Kommandos.

### Was das heißt

- **Die Schere ist jetzt an einem Menschen belegt**, nicht nur an Bots: Der neue
  Spieler endet genau dort, wo die Bots enden.
- **Kein Eingriff in die Gegnerstärke** (Entscheidung 02.10.). Ein Zurückdrehen
  von Runde 3 hätte diese Partie nicht gerettet und Till das Spiel wieder leer
  gemacht.
- Der Hebel für das untere Ende liegt in der **Bedienführung** (die Systeme
  finden, bevor Welle 10 kommt) oder in einer **Schwierigkeitsstufe** — beides
  nicht Teil von M6. Die Brutmutter ist die erste Wand; das ist als Lernkurve
  vertretbar, solange das Spiel vorher zeigt, was man dagegen tut.
- Eine Partie ist eine Partie. Eine zweite des neuen Spielers würde zeigen, ob
  er die Systeme nach der ersten Niederlage findet.
