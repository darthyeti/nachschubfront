# Bots unter Regelversion 9 (Issue #89)

**Stand:** 05.11.2026, Regelversion 9, Version 0.11.20. Nichts im Spiel geändert, nur die Bots
(`tests/tools/bot-player.mjs`, `bots.mjs`). 20 Seeds aus dem festen Strom `M6-BOTS`, alle fünf
Strategien. **Die Bots sind weiter ungeeicht** (siehe `balancing/README.md`); die Zahlen sind
Richtwerte und ein Vergleich des Bots mit sich selbst, keine Messung von Spielern.

## Die Beförderungsstrategie

Eine Beförderung je Planung, sobald Befördern offen ist (Nachschubstufe 8, Regel von selbst),
**vor** Trümmer und Bollwerken (`--promotion first`, Standard).

- **Welche Stellung:** die mit dem größten Wert aus *Schadenszuwachs des nächsten Rangs mal Zahl der
  Routenfelder in Reichweite*. Die Preise sind schon schadensgerecht (rund 155 R je Schadenseinheit
  auf jeder Stufe, `geldsenke-vorschlag.md`), der Preis trennt die Kandidaten also nicht; der Standort
  tut es: Eine Beförderung zahlt sich aus, solange der Gegner in Reichweite läuft. Gleichstand
  entscheidet die niedrigere Kennung, das ist deterministisch. Spezialstellungen und Legenden sind
  ausgeschlossen (die Regel verbietet es).
- **Wann statt Bollwerk:** Beförderung zuerst, Bollwerk und Trümmer nehmen den Rest. Gegenprobe
  `--promotion after` (ab Welle 30 Bollwerke zuerst): In keiner der 20 Partien je Strategie kam eine
  andere Welle heraus, nur Requisition am Ende um wenige Punkte anders. Bei den Bots hat die
  Reihenfolge keine Wirkung, weil sie Welle 30 fast nie erreichen.
- **Rücklage:** ein Abriss, wie beim Nachschubkauf. Mit der Rücklage der Bollwerke (vier Abrisse)
  hätte kein Bot je befördert: bei 34 Abrissen kostet einer 185 R, vier also 740 R.
- `--promotion off` ist der Bot von vor diesem Issue (Grundlinie).

## Maßstäbe unter Version 9, mit Version 8 als Vergleich

Wellen bis zum Ende der Partie (Median, Mittel), Siege waren es nie. In Klammern: Beförderungen je Partie.

| Strategie | Version 8 | Version 9, nie befördert | **Version 9, befördert** |
|---|---|---|---|
| Labyrinth-Bauer | 10 (11,9) | 10 (11,9) | 10 (11,9) (0,8) |
| Feuerkraft | 14 (14,5) | 14 (14,5) | 14 (14,5) (0,0) |
| Rezept-Jäger | 7 (6,5) | 7 (6,5) | 7 (6,5) (0,0) |
| Veredler | 13 (15,5) | 13 (15,5) | 13 (15,5) (0,1) |
| Einfach | 10 (10,6) | 10 (10,6) | 10 (10,6) (0,0) |

Überlebensquote Labyrinth-Bauer, Veredler (unverändert gegenüber Version 8): W10 50 % / 65 %,
W20 5 % / 20 %, W30 5 % / 15 %, W35 0 % / 10 %. Die übrigen Zeilen stehen in den Läufen
(`npm run bots -- --seeds 20 --per-wave`, `--ruleset 8`, `--promotion off`).

**Version 8 und Version 9 ohne Befördern sind für die Bots identisch.** Sie nutzten die alte
Aufwertung nie (`upgradeEvery` nur im King of the Hill). Ihre Maßstäbe ändern sich also durch die
Regelversion allein nicht; nur das Befördern selbst könnte etwas ändern.

## Befund: warum Befördern bei den Bots fast nichts bewegt

1. **Die Bots erreichen Nachschubstufe 8 selten und spät.** Einfach, Feuerkraft und Rezept-Jäger in
   keiner der 20 Partien; sie sterben bei Welle 10 bis 14 auf Stufe 6 bis 7. Labyrinth-Bauer und
   Veredler erreichen sie in wenigen Partien (Welle 18 bis 21). Befördern ist offen, wo die Bots
   schon verloren haben.
2. **Das Geld reicht dann nicht für ihre Ränge.** Der Veredler hält fast nur Helden und Legenden:
   die nächste Beförderung kostet 1100 oder 2800 R, er hat 400 bis 900. Er befördert in 20 Partien
   zweimal.
3. Maße (20 Seeds): Labyrinth-Bauer 0,8 Beförderungen je Partie, Veredler 0,1, die anderen 0,0.

### Mit Stufe 8 von Anfang an (nur zum Messen, nicht spielbar)

Damit das Befördern bei den Bots überhaupt vorkommt, startet `--supply 8` auf der höchsten Stufe
(Debug-Fall, `playBotMatch({ supply })`). Die Wirkung bleibt klein:

| Strategie | Wellen Mittel, nie / befördert | Beförderungen je Partie | Requisition am Ende, nie → befördert |
|---|---|---|---|
| Labyrinth-Bauer | 17,2 / 17,1 | 1,1 | 890 → 440 |
| Feuerkraft | 16,6 / 16,6 | 0,0 | 315 → 315 |
| Rezept-Jäger | 16,6 / 16,5 | 0,2 | 350 → 319 |
| Veredler | 20,6 / 20,6 | 0,0 | 551 → 551 |
| Einfach | 12,7 / 12,6 | 0,1 | 277 → 272 |

Je Welle beim Labyrinth-Bauer (Mittel über die Partien, die die Welle erreichen; n sinkt von 20 auf
1, **ab Welle 20 sind es sieben oder weniger Partien, ab Welle 30 drei**):

| Welle | n | Leben nie / befördert | Schaden nie / befördert | Requisition nie / befördert |
|---|---|---|---|---|
| 10 | 15 | 14,4 / 14,7 | 23 546 / 23 366 | 514 / 465 |
| 15 | 10 | 15,7 / 16,0 | 76 297 / 76 312 | 902 / 838 |
| 20 | 7 | 12,6 / 13,0 | 125 359 / 129 905 (+3,6 %) | 1431 / 1004 |
| 25 | 5 / 4 | 11,8 / 13,8 | 231 368 / 233 637 | 1803 / 821 |
| 30 | 3 | 11,7 / 10,7 | 338 179 / 344 852 (+2,0 %) | 672 / 526 |

Lesart: Befördern bindet bei diesem Bot etwa 400 bis 800 R, die sonst liegen blieben (Welle 20
und 25), und bringt 2 bis 4 % mehr Schaden. Auf die Leben wirkt es nicht erkennbar; die Unterschiede
in Welle 25 und 30 liegen im Rauschen von drei bis fünf Partien. Der Rezept-Jäger zeigt in Welle 35
(n = 1) einen Ausreißer (529 237 statt 370 687 Schaden, 1 statt 0 Leben): eine Partie, kein Befund.

## Was daraus folgt

- Die Bots messen die Geldsenke nicht: Sie erreichen den Zustand nicht, in dem Requisition liegen
  bleibt. Tills Partie F7SZGZ tat es (2994 R in Welle 29). **Um das Befördern an Bots zu messen,
  müssten sie länger leben oder früher kaufen**, beides ist eine Änderung an der Strategie oder an
  Balancing-Werten und nicht Teil dieses Issues.
- Dass der Veredler 1100 oder 2800 R bräuchte und sie nie hat, ist selbst ein Hinweis zum Spiel:
  Wer früh hohe Ränge baut, kann sich die nächste Stufe lange nicht leisten. Das ist beabsichtigt
  steil (GDD Abschnitt 11), aber an dieser Stelle ist Befördern für Stellungen auf Held und Legende
  über Welle 30 hinaus kaum erreichbar.
