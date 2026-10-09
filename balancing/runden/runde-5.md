# Runde 5 — die Brutmutter und was neue Spieler nicht finden

**Berührt:** `src/data/enemies.js` (Brutmutter), `src/sim/abilities.js`,
`src/ui/nudges.js`, Kommandoleiste, Nachschubscheibe, Fluglinie in
`src/render/scene.js`. Regelversion 8, Version 0.9.9.

**Grundlage:** die Partien der neuen Spieler unter Regelversion 7 (JGR9H6,
3P6BA4, 76NNFC, DPBHKY, PLGDAA, L4LJRJ, 7EJY6Y; Befunde in `runde-4.md`) und
Tills 4RCC95 als Gegenprobe. Entscheidung Till, 09.10.2026: die Vorschläge
umsetzen, wie sie standen.

---

## Brutmutter: höchstens 30 Schwärmer

Ihre Spur setzte alle 3 Sekunden zwei Schwärmer aus, solange sie lebte. Auf
einem langen Labyrinth lebte sie lange: 145 bis 175 Gegner in Welle 10 statt
etwa 90, die letzten kurz vor der Bastion. Vier von sieben Partien neuer
Spieler verloren hier 15 Leben oder mehr.

Gemessen wurden zwei Varianten, beide als Daten (`spawnTrail`):

| Partie | bisher | still auf den letzten 20 Feldern | höchstens 30 |
|---|---|---|---|
| JGR9H6 | 15 durch, Niederlage | 1 durch, 10 Leben | 5 durch, 6 Leben |
| 76NNFC | 11 durch, 5 Leben | 1 durch, 15 Leben | 1 durch, 15 Leben |
| L4LJRJ | 17 durch, Niederlage | 1 durch, 15 Leben | 1 durch, 15 Leben |
| PLGDAA | 11 durch, 5 Leben | 1 durch, 15 Leben | **0 durch, 20 Leben** |
| 4RCC95 (Till) | 0 durch | unverändert | unverändert |

Bei 12 statt 20 stillen Feldern blieben in zwei Partien 5 und 9 Durchbrüche. **Genommen: die
Obergrenze 30** (`maxCount`). Sie wirkt unabhängig von der Routenlänge, und
wer die Brutmutter schnell tötet, merkt nichts — sie setzt bis dahin weniger als
30 aus. Der eine verbleibende Durchbruch ist meist sie selbst (5 Leben).

**Bots** (20 Seeds, Median der erreichten Welle, Mittel in Klammern):

| Strategie | vorher | nachher | bei Welle 15 noch im Spiel |
|---|---|---|---|
| Labyrinth-Bauer | 10 (9,7) | 10 (11,9) | 10 % → 25 % |
| Feuerkraft | 12 (13,4) | 14 (14,5) | 35 % → 45 % |
| Einfach | 10 (9,7) | 10 (10,6) | 10 % → 25 % |
| Veredler | 13 (14,8) | 13 (15,5) | 30 % → 35 % |
| Rezept-Jäger | 7 (6,2) | 7 (6,5) | 0 % |

Den Bots hilft es weniger als den Menschen: Bei ihnen kommt die Brutmutter
selbst oft durch.

**Folgen für die Protokolle:** 4RCC95 und 7EJY6Y bleiben unter Regelversion 8
in jedem Feld gleich (dort starb sie vorher). Die übrigen sechs weichen ab
Welle 10 ab und sind kein Maßstab mehr.

## Bedienführung

Kein Wert, sondern Hinweise — die Befunde waren: kein einziges Kommando in
sieben Partien, Nachschub spät oder nie, Flieger durch eine Luftabwehr, die
neben der Fluglinie stand.

- **Ruf an Kommandos:** Ein benutzbares Kommando trägt einen goldenen Ring mit
  Puls, solange in dieser Partie noch keines eingesetzt wurde.
- **Ruf an den Nachschub:** in der Planung, sobald mindestens der doppelte Preis
  der nächsten Stufe bereitliegt.
- **Fluglinie:** vor jeder Welle mit Fliegern in der Planung gezeigt,
  knochenweiß gepunktet mit Pfeilspitze an der Bastion.

Einzelheiten in `docs/ART.md` („Ruf", „Fluglinie").

## Wie es weitergeht

Neue Partien der neuen Spieler unter Version 0.9.9. Zu prüfen: ob Kommandos und
Nachschub jetzt gefunden werden, ob Welle 10 noch die Wand ist, und ob die
Fliegerwellen ihren Schrecken behalten.
