# Runde 4 — das Urteil sagt nichts mehr

**Berührt:** `balancing/` und `tests/tools` (Auswertung), Vorschlag betrifft
`src/ui/rating.js` und `src/core/prefs.js`.

**Stand:** Auswertung von Runde 3 und eine Frage, die nur Till beantworten kann.
Nichts geändert.

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

### Die Frage, die nur Till beantworten kann

**Hieß „passt" dieses Mal „so ist es richtig" — oder „nichts zu beanstanden"?**

Das ist keine Spitzfindigkeit. Davon hängt ab, was Runde 4 tut:

- Hieß es **„so ist es richtig"**, dann ist M6 inhaltlich fertig. Dann bleibt nur
  noch, `RULESET_TESTING` auf `false` zu setzen, die Bewertungszeile
  abzuschalten, die hergeleiteten Werte ins GDD zu schreiben und den Meilenstein
  abzunehmen.
- Hieß es **„nichts zu beanstanden"**, dann ist eine Partie, die man 20:0 gewinnt,
  noch zu leicht, und Runde 4 dreht weiter — dann aber ohne die Bewertungszeile
  als Kompass, weil die nichts mehr zeigt.

---

## Vorschlag, falls weitergedreht wird: seltener fragen

Fünfzig Fragen hintereinander machen die Antwort zum Reflex. Das ist die
wahrscheinlichste Erklärung dafür, dass eine Partie ohne jede Bedrohung durchweg
„passt" bekommt.

Vorgeschlagen: **nur noch an wenigen Wellen fragen** — etwa acht, die die
Kraftkurve als interessant benennt (die engste, die weiteste, die Bosse, der
Koloss). Wer achtmal gefragt wird, überlegt; wer fünfzigmal gefragt wird, tippt.

Das betrifft `src/ui/rating.js` und eine Einstellung in `src/core/prefs.js`, nicht
die Spielregeln. Die Protokolle bleiben im selben Format — `rating` ist ohnehin
`null`, wo nicht gefragt wurde.

Eine Alternative wäre, die Frage zu ändern: nicht „wie war die Welle", sondern
**„musstest du etwas tun?"** Das ist schwerer zu beantworten als mit einem Reflex
und trifft genau das, was uns interessiert.

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
