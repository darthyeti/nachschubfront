# Meilensteine

Definiert waren sieben: **M0 bis M6**. M6 ist der Abschluss, nach ihm kommt
keiner. Alles mit Buchstaben war ein Einschub aus einem Update-Paket.

Die Arbeitsaufträge der abgeschlossenen Meilensteine sind am 28.09.2026 aus dem
Ordner genommen worden — sie waren Bestellungen, die alle ausgeliefert und
abgenommen sind. Nachlesbar bleiben sie über die Historie:

```bash
git log --diff-filter=D --name-only -- docs/meilensteine/
git show <commit>:docs/meilensteine/M3-kampf-und-inhalte.md
```

| | Inhalt | abgenommen |
|---|---|---|
| M0 | Projektgerüst, Canvas, HUD-Rahmen, Werkzeuge | 22.09.2026 |
| M1 | Spielkern: Karte, Kamera, Wegfindung, Phasen, Leben | 22.09.2026 |
| M1b | Grafik-Pipeline: Konzept-SVGs als gerasterte Sprites | 22.09.2026 |
| M2 | Kapselmechanik: Landezonen, Salve, Verschmelzen, Rezepte | 28.09.2026 |
| M3 | Kampf und Inhalte: Doktrinen, Gegner, Bosse, Wirtschaft, Kommandos | 28.09.2026 |
| M4 | Präsentation: Diorama, bewegliche Teile, Ränge, Ton, Titelbildschirm | 28.09.2026 |
| M4b | Update 2 — späte Partie, Abbruchmodus, zwei Signalfeuer | 28.09.2026 |
| M4c | Update 3 — neue Kapselform | 28.09.2026 |
| M4d | Update 4 — Bunker, Fahrzeuge, Rangabzeichen | 28.09.2026 |
| M5 | Speichern und PWA: Bestwerte, Export/Import, Offline-Betrieb | 28.09.2026 |
| M5b | Update 5 — Koloss, Bollwerk, geschärfte Kommandos | 28.09.2026 |
| M5c | Update 6 — HUD, Menüs, letzte vier Spezialstellungen | 28.09.2026 |
| M5d | Update 7 — Koloss-Verhalten, Stellungsgrafik, Gunship | 27.09.2026 |
| **M6** | **Balancing und Feinschliff** — [M6-balancing.md](M6-balancing.md) | **in Arbeit** |

Der Stand steht in [`docs/PROGRESS.md`](../PROGRESS.md).
