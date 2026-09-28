# Fortschritt

Kurzfassung des Stands. Was hier nicht steht, steht in der Historie: `git log`
erzählt jeden Meilenstein ausführlich, jede Entscheidung mit Begründung. Am
28.09.2026 auf diesen Umfang eingekürzt — die Datei war auf 531 Zeilen
gewachsen und wird vor jeder Aufgabe mitgelesen.

## Stand

Version **0.9.0**. Alle Inhalts-Meilensteine sind abgenommen. Offen ist nur noch
**M6 Balancing**, der Abschluss des Projekts.

| | | abgenommen |
|---|---|---|
| M0 | Projektgerüst | 22.09.2026 |
| M1 · M1b | Spielkern, Grafik-Pipeline | 22.09.2026 |
| M2 … M5c | Kapseln, Kampf, Präsentation, Speichern, HUD | 28.09.2026 |
| M5d | Koloss, Stellungsgrafik, Gunship (Update 7) | 27.09.2026 |
| **M6** | **Balancing und Feinschliff** | **in Arbeit** |

Die Updates 2 bis 7 waren Einschübe, keine Meilensteine: 2 → M4b, 3 → M4c,
4 → M4d, 5 → M5b, 6 → M5c, 7 → M5d. Nach M6 kommt keiner mehr.

## M6: wo wir stehen

Plan freigegeben am 27.09.2026, Auftrag in
[`docs/meilensteine/M6-balancing.md`](meilensteine/M6-balancing.md) mit sieben
dort benannten Entscheidungen. Teil 1 sind die Werkzeuge, Teil 2 die Abstimmung
der Zahlen; **Teil 2 hat noch keine Freigabe.**

- **Schritt 1 ✓** (27.09.) Aufzeichnung jeder Partie (`src/sim/record.js`),
  eigenes Speicherdokument (`src/storage/protocol.js`), Bewertungszeile nach
  jeder Welle (`src/ui/rating.js`), Exportknopf im Pausenmenü und auf dem
  Ende-Bildschirm. Debug-Hebel färben das Protokoll als `tainted`.
- **Schritt 2 ✓** (27.09.) Nachspielen ohne Grafik (`src/sim/replay.js`,
  `npm run replay`), Werte überschreiben ohne `src/data/` anzufassen (`--data`),
  Wellenregeln als Modul (`tests/tools/wave-rules.mjs`). **Abgenommen an Tills
  erster Partie:** 35 Wellen, 331 Aktionen, Welle für Welle identisch.
- **Schritt 3 ✓** (28.09.) Fünf Bot-Strategien (`npm run bots`), Eichung an
  gespielten Partien (`npm run calibrate`), Kraftkurve (`npm run powercurve`).
- **Schritt 4 offen:** Testeinstieg ab Welle 10, 20, 30 und 35. Braucht den
  Nachspieler im Browser; er ist dafür schon DOM-frei gebaut.

**Stand der Eichung:** `refine` liegt Till am nächsten (28 von 35 Wellen, Route
105,6 gegen 89,4, Abstand 0,51). Das Abnahmekriterium „dieselbe Größenordnung"
ist erfüllt, eine echte Eichung ist es nicht. **Ein Protokoll ist zu wenig** —
das Werkzeug sagt das selbst, solange weniger als drei vorliegen.

**Was die Kraftkurve rechnet:** Reserve (lieferbarer Schaden geteilt durch die
wirksamen Lebenspunkte der Welle) im Median 512 % in W1–W10, **1199 % in
W5–W30**, 322 % in W31–W50. Welle 1 liegt bei −9 %, Welle 50 bei −39 %. Die
Lebenspunkte des Modells stimmen auf 6 % über 35 gemessene Wellen. Die Reserve
sagt **keinen** Durchbruch vorher: Tills drei verlustreiche Wellen lagen bei 418
bis 1018 %, die 32 verlustfreien im Median bei 1061 %. Grund ist die Annahme des
Modells, der Spieler habe alle sechs Doktrinen stehen — wer ohne Luftabwehr
baut, richtet gegen Flieger null Schaden an.

**Erste Beobachtung, unbewertet:** In frühen Wellen wird mehr Schaden
verschwendet als ankommt (Tills Welle 1: 1329 vergeudet, 750 angekommen). Eine
Stellung, die einen Schwärmer zweimal tötet, ist nicht stark, sondern falsch
eingestellt.

## Werkzeuge

| Befehl | Zweck |
|---|---|
| `npm test` | Unit-Tests (401) |
| `npm run test:input` | 58 Browser-Checks, Touch und Maus (`-- --browser webkit` für Safari) |
| `npm run test:perf` | 200 Gegner, prüft 60 fps und dass im Betrieb nichts gerastert wird |
| `npm run test:battle` | spielt eine lange Partie im Browser, scheitert an jedem Konsolenfehler |
| `npm run test:offline` · `test:webkit` | Service Worker · alles in WebKit |
| `npm run replay -- <protokoll>` | Partie ohne Grafik nachspielen, `--data` mit geänderten Werten |
| `npm run bots` · `calibrate` · `powercurve` | Bots über viele Seeds · Eichung · Kraftkurve |
| `npm run playmatch -- <seed> --protocol <datei>` | eine Bot-Partie als Protokoll |
| `npm run waves` · `sprites` · `studies` · `icons` | erzeugte Dateien neu schreiben |
| `npm run precache` | `sw.js` neu schreiben — **vor jeder Veröffentlichung** |

Einzelheiten zu den Balancing-Werkzeugen: [`balancing/README.md`](../balancing/README.md).

## Offen

**Für M6 vorgemerkt** (im Auftrag als Teil 2, Punkt 11 und 12 aufgefangen):
Requisitions- und KP-Stau, Flieger ohne Luftabwehr, Welle 2 als reine
Kriegerwelle, die Bedienführung von Welle 1, die Koloss-Häufigkeit
(`KOLOSS_RUN.waves` — er tritt nur in Welle 35 und 45 auf), der hergeleitete
Bollwerk-Preis, und die Zahlen, die das GDD offen lässt (Spezialstellungen,
Boss-Werte, Kegel-, Strahl- und Sprungweiten).

**Was ein neues Grafikblatt mitbringen muss**, damit es ohne Codeänderung
einrastet (aus M5c gelernt, Werkzeug `tests/tools/split-shrines.py`):

- Die Figur steht frei auf dem Boden mit eigenem Schlagschatten. Das Werkzeug
  hebt sie um dessen Höhe auf den gemeinsamen Sockel und wirft den Schatten weg.
- Was der Code zeichnet, gehört **nicht** ins Blatt: Feuer, Glut, Leuchten,
  Ringe, Blitze, Mündungsblitze, Hülsen.
- Eine Waffe, die zielt, ruht **nach links**; der Renderer spiegelt sie, wenn das
  Ziel rechts steht. Ein nach rechts gezeichnetes Rohr schwenkt sonst durch die
  eigene Lafette (so geschehen beim Belagerungsmörser).
- Der viewBox braucht Luft über der Figur, sonst schneidet das Blatt an, was nach
  dem Anheben übersteht.
- Teile heißen `-back`, `-gun` (dreht oder schwebt) und `-front`. Der
  Wirkungsanker kommt aus `manifest.js`, nicht aus dem Blatt.

**Drei Beobachtungen an den Blättern der Spezialstellungen**, zurückgestellt bis
zum nächsten Grafiksatz: Die vier Tesla-Elektroden des Glutkessels sitzen alle
auf der rechten Kesselhälfte statt rings um den Rand (Ankerliste
`CAULDRON_ELECTRODES`); der Gittermast des Gewitterturms ist die schwächste
Silhouette der sechs; der Glutkessel ist deutlich kleiner als die übrigen fünf.

**Kleinere offene Fragen:**

- Der Ende-Bildschirm hat vier Knöpfe, die Skizze nennt zwei. „Gleicher Seed"
  und „Bestenliste" sind aus M5 geblieben; falls die Skizze wörtlich gemeint ist,
  fallen sie weg.
- `docs/ART.md` nennt für die Kapsel „Höhe etwa doppelte Fußbreite", die
  Zeichnung `pod-b` ist das 1,2-fache. Umgesetzt ist die Zeichnung, weil M4c die
  Skizzen für verbindlich erklärt.
- Die Versionsnummer wird von Hand gepflegt (`src/data/version.js`). Der
  Unit-Test erinnert an `npm run precache`, nicht an die Erhöhung.

## Bekannte Probleme

- **`npm run test:input` ist unter Last unzuverlässig.** Eine Prüfung wartet in
  echten Sekunden darauf, dass eine Welle bei 1x durchläuft (180 s Grenze). Die
  Simulation hängt an der Bildrate; laufen daneben weitere Playwright-Browser,
  reicht die Zeit nicht. Kein Fehler im Spiel — beim Prüfen nichts nebenher.
- **`npm run test:battle` stützt die Bastion** mit dem Unverwundbar-Hebel ab.
  Ohne ihn verliert der Lauf Welle 1. Die Prüfung fragt, ob eine lange Partie
  fehlerfrei durchläuft, nicht ob sie zu gewinnen ist.
- **Ohne eigene Markierungen ist Welle 1 verloren** (gemessen: 30 Durchbrüche,
  Niederlage nach 55 s). Bedienführung, nicht Balancing — das Spiel sagt
  nirgends, dass die Zonen gesetzt werden wollen. Thema von M6.
- **Bestwerte sind nur innerhalb einer `RULESET_VERSION` vergleichbar.** Wer
  Kartenaufbau, Salvengröße oder Wellen ändert, muss die Zahl erhöhen.
- Das Ergänzen fehlender Landezonen prüft im schlimmsten Fall alle freien Felder
  (~75 ms in einem sehr engen Labyrinth), einmal pro Salve.
- Gegner laufen optisch durch die Signalfeuer-Säulen, weil das Signalfeuerfeld
  der Wegpunkt ist. Mit finaler Grafik lösbar (Feuerschale neben dem Wegpunkt).
- Der Boden-Cache ist auf 12 Megapixel begrenzt (Safari). Bei maximalem Zoom auf
  dem iPad kann der Boden leicht unscharf werden; Objekte bleiben scharf.
- Der Auswahldialog kann auf breiten Bildschirmen das Debug-Panel überdecken.
  Nur im Debug-Modus, darum belassen.
- Headless-Chromium mit Software-Rendering schafft nur 30 bis 60 fps; mit GPU und
  auf dem iPad stabil 60. WebKit erzeugt Mehrfinger-Gesten synthetisch — das
  ersetzt den echten iPad nicht.
- iPadOS ignoriert `display: fullscreen` im Manifest und nutzt `standalone`.

## Regeln, die weiter gelten

Was nicht aus GDD, ART oder SPEICHER folgt, sondern in der Umsetzung entschieden
wurde. Die Begründungen stehen in den Commits.

**Simulation**

- Aller spielrelevante Zufall kommt aus dem geseedeten Generator;
  `Math.random()` nur für rein optische Effekte. Ein Test hält die Zahlenfolge
  fest, damit geteilte Seeds über Versionen gleich bleiben.
- Karte und Kapselinhalte hängen nur an Seed und Wellennummer (`fork('map')`,
  `fork('pods').fork(welle)`). Ein Test belegt, dass Balancing-Änderungen beide
  nicht verschieben — darauf ruht das Nachspielen.
- Keine Echtzeit in `src/sim/` und `src/core/`: kein `Date.now`, keine
  Bildrate. Sonst wäre eine Partie nicht Schritt für Schritt wiederholbar.
- Zonen werden immer als ganze Menge geprüft, nie einzeln. Darum kann eine Salve
  den Weg nie schließen.
- Verschmelzen endet bei Legende; für die Viererverschmelzung ist Elite der
  höchste Ausgangsrang.
- Deckt eine Rezept-Zutat sowohl eine Kapsel als auch eine stehende Stellung, wird
  die Kapsel verbraucht — sie würde sonst ohnehin zu Trümmern.
- Die Doktrin einer Spezialstellung ist ihre erste Zutat; sie entscheidet über
  Schadensmatrix und Leitfarbe.
- Schaden wird auf den verbleibenden Lebenspunkten gedeckelt, damit die Statistik
  nichts ausweist, was es nicht gab. Seit M6 wird gezählt, was der Deckel
  wegnimmt (`waveStats.overkill`).
- Kommandos zählen in der Planung gegen die Welle, die die Salve vorbereitet.
- Nach einer langen Unterbrechung holt die Simulation nicht auf, sie verwirft den
  Rückstand.

**Speicher**

- Drei getrennte Dokumente: Profil (Bestwerte, Statistik), Einstellungen und
  Partie-Protokolle. Die Einstellungen gehören dem Gerät und reisen nie in einem
  Export mit.
- Der Import **ersetzt** mit Bestätigung, er führt nicht zusammen.
- Der Service Worker übernimmt nie von selbst (kein `skipWaiting`); erst „Neu
  laden" im Menü lässt ihn ans Ruder. Wächter ist der Build-Hash über alle
  ausgelieferten Dateien, nicht die Versionsnummer.
- Jeder Zugriff in try/catch. Das Spiel startet mit leerem oder kaputtem Speicher
  korrekt.

**Grafik**

- SVG ist nur die Quelle, Canvas die Ausgabe: einmal beim Start rastern, danach
  nur `drawImage`. Erzeugte Dateien in `src/render/sprites/` nicht von Hand
  ändern.
- Ausnahme sind drehbare Modelle (Koloss, Gunship): aus Körpern im Code
  aufgebaut, weil ein SVG keine Normalen kennt. Regeln in `docs/ART.md`,
  Abschnitt „Drehbare Modelle".
- Gegner sind nach links gezeichnet und werden je nach Laufrichtung gespiegelt.
- Bewegung wird aus dem Zustand abgelesen, nicht gemeldet: Ein Schuss ist daran
  zu erkennen, dass der Nachladezähler hochspringt.
- Ein Element, das der Code verbirgt, braucht eine eigene
  `[hidden] { display: none }`-Regel — eine Autorenregel schlägt sonst das
  `display: none` des Browsers.
- Der Ton wird synthetisiert, nicht aus Dateien geladen.

**Balancing (M6, Entscheidung 7)**

Beurteilt wird mit an echten Partien geeichten Bots und den Protokollen selbst.
Der alte Einwand bleibt richtig — ein Bot, der kein Labyrinth baut, ist kein
Maßstab —, aber die Antwort darauf gab es vorher nicht. **Ungeeichte Bot-Zahlen
sind Richtwerte, keine Messung.** Werte ändern sich nur in `src/data/` und in den
Wellenregeln, nie verstreut im Code.
