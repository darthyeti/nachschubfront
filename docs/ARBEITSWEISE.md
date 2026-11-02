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
`docs/PROGRESS.md` auf den jetzt geltenden Stand bringen: was gilt, was offen
ist, welche Entscheidungen weiter wirken. Was erledigt ist und warum, steht nicht
dort, sondern in den Commit-Nachrichten. Die Datei bleibt kurz; Abgeschlossenes
wird gestrichen, nicht angehängt.

## GitHub

Seit dem 02.11.2026 läuft der Code über GitHub, der Leitstand bedient ihn.

- **Issues sind die Aufgabenliste.** Jede Aufgabe A-nn aus dem Leitstand, die
  Code berührt, bekommt ein Issue; die Karte im Board verweist darauf.
- **Ein Zweig je Aufgabe:** `claude/<nr>-<name>`, abgezweigt von `origin/main`,
  `<nr>` ist die Issue-Nummer. Der Leitstand verteilt die Arbeit auf Agenten
  (`.claude/agents/entwickler.md`) oder eigene Sitzungen, je Bereich.
- **Ein Pull Request je Zweig**, nach der Vorlage
  (`.github/pull_request_template.md`): Issue, was und warum, gelaufene Tests,
  und ob die Änderung Tills Blick im Browser braucht. Vor dem Vorlegen liest der
  Prüfer (`.claude/agents/pruefer.md`) das Diff gegen die Regeln.
- **CI** (`.github/workflows/tests.yml`): Der Job `schnell` (Unit-Tests,
  Eingabe- und Offline-Prüfung in Chromium) ist Pflicht-Check für jeden Pull
  Request und jeden Push auf `main`. Der Job `voll` (WebKit, Screenshots, Battle,
  Perf) läuft nachts, von Hand oder mit dem Label `voller-lauf`.
- **Pages-Vorschau** (`.github/workflows/pages.yml`, `tools/pages-site.sh`):
  `main` liegt im Wurzelordner, jeder offene Pull Request mit dem Label
  `spielgefuehl` unter `pr/<nr>/`; der Link kommt als Kommentar
  (`?debug` angehängt). Erst beim Bauen bekommt jede Kopie ihren
  Service-Worker-Block (`npm run precache`), im Repository bleibt `sw.js` mit
  dem Platzhalter, der nichts cacht.
- **Zusammenführen** per Squash-Merge, nachdem der Check grün ist und, wenn das
  Spielgefühl betroffen ist, Till im Board freigegeben hat. Der Leitstand pusht
  und mergt; was lokal entsteht, pusht weiter Till.
- **Veröffentlichen** heißt: Version in `src/data/version.js` anheben,
  `docs/PROGRESS.md` nachziehen, nach `main` mergen. Den Rest tut Pages.

## Leitstand

Seit dem 02.11.2026 laufen Entscheidungen, Aufgaben und Protokolle über ein
gemeinsames Artefakt, den **Leitstand**:
<https://claude.ai/artifact/FeLG9xnf4koUpNy1FbWyUd> (privat, Besitzer Till).
Vorbild ist das Entscheidungs-Artefakt aus Holdup.

Rollen darin:

- **Till** (Spieldesigner) beantwortet Akten, legt Themen ab und liefert
  Protokolle als Datei ab. Er entscheidet, der Leitstand schlägt vor.
- **Der Leitstand** (die Code-Hauptsitzung in der Cloud) legt Akten und
  Aufgaben an, liest Antworten, Themen und Protokolle aus, plant die Arbeit,
  verteilt sie auf parallele Sitzungen oder Agenten (je Bereich, siehe Tabelle
  oben), pusht, öffnet Pull Requests, mergt und trägt den Stand nach. Er ist
  die einzige Stelle, die `fragen`, `aufgaben` und `meta` schreibt. Stündlich
  sieht er im Board nach, ob es Neues gibt.

Was im Speicher des Artefakts liegt (Sammlung → Bedeutung):

| Sammlung | Schreibt | Inhalt |
|---|---|---|
| `fragen` | Leitstand | Entscheidungsakten E-nn: Titel, Lage, Optionen, Empfehlung, `status`, `ergebnis` |
| `antworten` | Till | Wahl und Text je Akte, Schlüssel ist die Akten-ID |
| `aufgaben` | Leitstand | Aufgaben A-nn mit `status` (geplant, laeuft, pruefung, wartet, erledigt), `wer`, `haengt_an` |
| `protokolle` | Till | abgelieferte Partien: Dateien als Asset-IDs, Text, `status` (neu, gelesen, ausgewertet), `ergebnis` |
| `themen` | Till | freie Themen, `status` (neu, uebernommen), `antwort` |
| `meta/leitstand` | Leitstand | wann der Leitstand zuletzt gelesen hat |

Ablauf jeder Leitstand-Sitzung: zuerst `antworten`, `themen` und `protokolle`
lesen (ArtifactData), neue Protokolldateien aus den Assets nach
`balancing/protokolle/` holen und nachspielen, dann Akten schließen
(`ergebnis`), Aufgaben fortschreiben und `meta/leitstand` stempeln. Was
daraus im Repository landet, gilt wie bisher: `docs/PROGRESS.md` hält den
Stand, die Commits die Geschichte. Der Leitstand ersetzt keine Freigabe im
Chat, er hält sie fest.
