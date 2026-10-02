# King of the Hill, Kalibrierung 2 — die erste gespielte Partie

**Berührt:** nichts in `src/data`. Nebenbei gefunden und behoben: die
Koloss-Spur beim Nachspielen (Commit „Fix the Koloss lane when the planning
ends").

**Grundlage:** 75YZ4E vom 02.10.2026, Version 0.9.5, Modus-Stand 1, von Hand
gespielt. **Sieg in Welle 50 mit 5 von 20 Leben.** Spielt sich seit der
Korrektur Welle für Welle nach.

---

## Wo Leben verloren gingen

| Welle | Leben | was geschah |
|---|---|---|
| **1** | **−10** | eine Stellung, Route 11, 37 von 75 Lebenspunkten Schaden |
| 40 | −5 | der Boss, ein Durchbruch |
| sonst | 0 | |

**Die Hälfte der Leben geht in der ersten Welle verloren.** Das bestätigt
Kalibrierung 1 an einem Menschen: Mit einer Stellung und vier Richtungen ist die
erste Welle eine Frage der Abdeckung, nicht der Gegnerstärke. Die Gegner tragen
überall genau ein Zehntel der Standardwerte (`enemyHpFactor` 0,1).

## Bewertungen

| Welle | 8 | 13 | 18 | 24 | 30 | 35 | 41 | 46 |
|---|---|---|---|---|---|---|---|---|
| Urteil | passt | passt | passt | zu leicht | zu leicht | zu leicht | passt | passt |

Dasselbe Bild wie im Standard: ab dem Ende des Mittelbands bis zum ersten Koloss
eher leicht, sonst passend. Requisition staut sich in derselben Strecke (bis
2273 in Welle 32), Kommandos nur in den Wellen 35, 40, 45 und 50.

## Ergebnis

- **Gegnerstärke bleibt** (Entscheidung 02.10.): `enemyHpFactor` 0,1 und der
  Sperrradius sind nicht der Hebel.
- **Offen ist der Anfang**: Welle 1 kostet strukturbedingt die Hälfte der Leben.
  Mögliche Hebel, wie in Kalibrierung 1 genannt: mehr als eine Stellung aus der
  ersten Salve, eine kleinere erste Welle, Start-Requisition. Jede davon ist
  eine Regel des Modus und hebt seinen `rev`.
