# Arbeitsweise

Wie an Nachschubfront gearbeitet wird. Gilt für Chat und Code gemeinsam.
`CLAUDE.md` verweist hierher, die Projektbeschreibung im Chat spiegelt das Nötige.

## Rollen

- **Chat** entwirft: Spielregeln, Grafik, Studien, Simulationen, Mockups.
  Ergebnis jedes Entwurfs ist ein in sich geschlossener Arbeitsauftrag als Paket
  aus `docs/` und `reference/`. Der Chat schreibt keinen Produktivcode.
- **Code** setzt um: Spielcode, Tests, Screenshots. Weicht nicht stillschweigend
  vom GDD ab, sondern schlägt die Abweichung vor und begründet sie.

## Parallel arbeiten

Es wird in mehreren Sitzungen gleichzeitig gearbeitet, teils an verschiedenen
Funktionen. Damit das nicht kollidiert:

- Das Repository ist die einzige Wahrheit und bewegt sich. Lies zu Beginn jeder
  Aufgabe den aktuellen Stand frisch (`docs/PROGRESS.md`, dazu nur die berührten
  Quellen laut `CLAUDE.md`). Verlass dich nicht auf einen Stand aus einem
  früheren Chat oder einer früheren Sitzung.
- Das Spiel ist in unabhängige Bereiche geschnitten. Halte jede Aufgabe
  möglichst in einem Bereich:

  | Bereich | Code | Quelle |
  |---|---|---|
  | Regeln und Zahlen | `src/sim`, `src/data` | `docs/GDD.md` |
  | Grafik und Effekte | `src/render`, `reference/` | `docs/ART.md` |
  | HUD, Menüs, Dialoge | `src/ui` | `docs/ART.md` |
  | Eingabe und Gesten | `src/input` | `docs/GDD.md` Abschnitt 13 |
  | Speichern, Export, PWA | `src/storage`, `sw.js` | `docs/SPEICHER.md` |
  | Ton | `src/audio` | `docs/GDD.md` |
  | Balancing-Werkzeuge | `tests/tools`, `balancing/` | `balancing/README.md` |

  `src/core` (Zustand, Phasen, Zufall) ist geteilt. Änderungen dort nur, wenn
  unumgänglich, und ausdrücklich benennen.
- Jeder Arbeitsauftrag nennt am Anfang die Bereiche und Dateien, die er berührt,
  und welche geteilten Quellen (`GDD.md`, `ART.md`, `src/data`, `src/core`) er
  ändert. So ist vor dem Zusammenführen sichtbar, ob zwei parallele Aufträge
  dieselbe Stelle anfassen.
- Berühren zwei offene Aufgaben denselben geteilten Bereich, melde es, statt es
  stillschweigend zu lösen. Die Reihenfolge entscheidet der Spieldesigner.
- Neue Funktionen bekommen eine eigene Auftragsdatei unter
  `docs/meilensteine/`. Laufende Meilensteine werden dafür nicht erweitert.

## Technische Leitplanken

Die vollständigen Regeln stehen in `CLAUDE.md`. Die vier, die beim parallelen
Arbeiten am leichtesten brechen:

- **Determinismus.** Spielrelevanter Zufall nur aus dem geseedeten Generator in
  `src/core`, `Math.random` nur für optische Effekte. Aufzeichnung und Balancing
  hängen daran.
- **Simulation und Darstellung getrennt.** Fester Zeitschritt, die Simulation
  kennt weder Canvas noch DOM.
- **Datengetrieben.** Balancing-Zahlen in `src/data`, nie im Simulationscode.
- **Kein Build.** Vanilla JS, native ES-Module, läuft direkt von GitHub Pages.

## Nach jedem Arbeitsblock
`docs/PROGRESS.md` aktualisieren: erledigt, offen, Entscheidungen. Kurz halten,
die Begründungen tragen die Commit-Nachrichten.
