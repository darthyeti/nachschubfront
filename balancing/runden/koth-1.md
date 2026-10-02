# King of the Hill, Kalibrierung 1 — die Lücke ist die Abdeckung, nicht die Stärke

**Berührt:** `tests/tools` (neue Bots, `npm run koth-bots`), nichts in `src/data`.

**Stand:** 02.10.2026, Zweig `koth`, Modus-Stand 1. **An den Werten ist nichts
geändert.** Der Auftrag (M7b, B7) erlaubt, `enemyHpFactor` und `banRadius`
nachzustellen, wenn die echte Simulation deutlich von der Studie abweicht. Sie
weicht ab, aber nicht so, dass einer der beiden Hebel es beheben würde.

**Grundlage:** die vier Strategien der Studie (Ring, Arm, Mischung, Ausgewogen),
nachgebaut auf der echten Simulation (`tests/tools/koth-strategies.mjs`), 20
Seeds je Einstellung, sonst wie die M6-Bots (Nachschubstufe, Abriss, Kommandos).

---

## Was die Bots erreichen

Median der erreichten Welle, in Klammern die Spanne über 20 Seeds.

| Sperrradius · LP-Faktor | Ring | Arm | Mischung | Ausgewogen |
|---|---|---|---|---|
| **4 · 0,1 (Moduswerte)** | **2** (1–23) | **7** (1–13) | **3** (1–8) | **8** (1–13) |
| 4 · 0,02 | 2 (1–50) | 7 (1–15) | 3 (1–8) | 8 (1–15) |
| 3 · 0,1 | 4 (1–18) | 6 (1–13) | 3 (1–7) | 7 (1–13) |
| 3 · 0,02 | 4 (1–50) | 6 (1–15) | 3 (1–7) | 7 (1–15) |
| 0 · 0,1 | 4 (1–35) | 7 (1–12) | 5 (1–45) | 7 (1–12) |
| 0 · 0,02 | 6 (1–50) | 7 (1–25) | 5 (1–50) | 7 (1–25) |

Ein Aufwertungsrhythmus (alle 4 Wellen, wie in der Studie) ändert nichts: In den
wenigen Wellen, die die Bots durchhalten, kommen sie nie auf 120 Requisition.

## Gemessen an den Richtwerten des Auftrags

- **„Der Arm-Bot scheitert um Welle 8 bis 13."** Median 7, Spanne bis 13 — in
  der Nähe.
- **„Keine Strategie liegt dauerhaft mehr als etwa 8 Wellen vor der besten
  anderen."** Erfüllt: Ausgewogen 8, Arm 7, Mischung 3, Ring 2.
- **Ohne Sperrzone zieht der Ring davon**, wie die Studie sagt — aber nur auf
  einzelnen Karten (bis Welle 35 bis 50), im Median nicht.

Nach den Richtwerten gibt es also keinen Grund zum Nachstellen.

## Was die Zahlen nicht sagen

**Alle Bots verlieren früh, und zwar an der Abdeckung.** In den verlorenen
Wellen steht oft keine einzige Stellung in Reichweite des angreifenden Arms: Der
Schaden der Welle ist null, alles bricht durch. Die Gegner selbst sind schwach
(Welle 1 bringt 75 Lebenspunkte). Darum ändert der LP-Faktor fast nichts — von
0,1 auf 0,02, also ein Fünftel der Gegnerstärke, gewinnen die Bots im Median
keine einzige Welle.

Mit einer Stellung pro Runde und vier Richtungen ist jede Welle, deren Riss noch
nichts in Reichweite hat, ein Totalverlust. Ein Mensch baut gezielt an den
kommenden Arm (die Vorschau zeigt ihn) und um die Mitte; die Bots tun das nur
als Heuristik. **Bots sind hier eine untere Schranke, ein Mensch muss es spielen.**

## Weitere Beobachtungen

- **Koloss (B6):** angesteuert per Wellensprung, auf drei Karten. Er wird zwei
  Wellen vorher angekündigt, kommt aus dem Riss seiner Welle und räumt ein bis
  zwei Felder. Seine Fahrspuren laufen über die ganze Kartenbreite; er kann also
  ein Feld rammen, das zu einem anderen Arm gehört. Nichts geändert.
- **Aufwertung (B5):** in Bot-Partien nie bezahlbar, solange die Partie dauert
  (Start 30, Belohnungen pro Welle klein). Ob ein Mensch sie früh nimmt, ist offen.
- **Erste Salve mit 8 Kapseln:** gebaut wird trotzdem nur eine Stellung; die
  übrigen sieben werden Trümmer. Auf der kleinen Karte mit kurzen Wegen ist das
  viel Schutt in Welle 1.

## Vorschlag

Nichts an den Werten. **Der nächste Schritt ist eine gespielte Partie** unter
`?debug&mode=koth` (der Modus ist bis dahin nur im Debug-Menü). Ist danach klar,
ob die frühen Wellen für einen Menschen zu schwer sind, sind die Hebel eher die
Wellen 1 bis 5 (Kapseln, die gebaut werden dürfen, Start-Requisition) als die
Gegnerstärke.

Nachmessen: `npm run koth-bots -- --ban 4,3,0 --hp 0.1,0.02`
