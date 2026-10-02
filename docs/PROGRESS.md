# Fortschritt

Kurzfassung des Stands. Was hier nicht steht, steht in der Historie: `git log`
erzählt jeden Meilenstein ausführlich, jede Entscheidung mit Begründung. Am
28.09.2026 auf diesen Umfang eingekürzt — die Datei war auf 531 Zeilen
gewachsen und wird vor jeder Aufgabe mitgelesen.

## Stand

Version **0.9.5**. Alle Inhalts-Meilensteine sind abgenommen. Offen sind
**M6 Balancing** und, parallel dazu, **M7 Spielmodi** (freigegeben 02.10.2026).

| | | abgenommen |
|---|---|---|
| M0 | Projektgerüst | 22.09.2026 |
| M1 · M1b | Spielkern, Grafik-Pipeline | 22.09.2026 |
| M2 … M5c | Kapseln, Kampf, Präsentation, Speichern, HUD | 28.09.2026 |
| M5d | Koloss, Stellungsgrafik, Gunship (Update 7) | 27.09.2026 |
| **M6** | **Balancing und Feinschliff** | **in Arbeit** |
| M7a | Modus-Gerüst | 02.10.2026 |
| M7b | Modus „King of the Hill" (im Menü als „Experimentell") | 02.10.2026 |

**Arbeitsweise versioniert:** Rollen von Chat und Code sowie die Regeln für
paralleles Arbeiten stehen in [`docs/ARBEITSWEISE.md`](ARBEITSWEISE.md);
`CLAUDE.md` verweist darauf.

**Hilfe-Ebene (Version 0.9.4):** Der „?“-Knopf unten links über der Versionszahl
öffnet eine Ebene, die jedes Symbol der Leisten und, sobald sie steht, jede Scheibe
der Kommandoleiste mit einer Sprechblase und gestrichelter Linie erklärt
(`src/ui/help.js`, Texte in `STRINGS.help`, Zahlen der Kommandos aus
`src/data/commands.js`). Sie pausiert nichts und weicht Menü, Codex,
Kapselauswahl und Ende-Bildschirm. Die Platzierung ist eine reine Funktion
(`layoutBubbles`) mit Unit-Test.

Die Updates 2 bis 7 waren Einschübe, keine Meilensteine: 2 → M4b, 3 → M4c,
4 → M4d, 5 → M5b, 6 → M5c, 7 → M5d.

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
  gespielten Partien (`npm run calibrate`), Kraftkurve (`npm run powercurve`),
  Versionsprüfung vor jedem Maßstab (`tests/tools/reference.mjs`).
- **Schritt 4 ✓** (28.09.) Testeinstieg ab Welle 10, 20, 30 und 35
  (`src/sim/testentry.js`), Menüpunkt nur mit `?debug`. Die gewählte Welle steht
  noch bevor: „ab Welle 35" heißt, den Koloss zu spielen, nicht nach ihm
  anzukommen. Kein eigenes Speicherformat — ein Protokoll plus Wellennummer ist
  der Stand. Die Partie wird als `testEntry` gefärbt und damit von keinem
  Werkzeug für eine Messung gehalten. Quelle ist ein aufgezeichnetes Spiel aus
  diesem Browser oder eine Datei aus `balancing/protokolle/`.

**Stand der Eichung (4 Protokolle, 28.09.):** Keine Strategie eicht. Die beste
wechselt von Protokoll zu Protokoll — `simple` (0,49), `refine` (0,51),
`firepower` (0,54) — und **jeder Bot endet mit 0 Leben, Till mit 15 bis 20.**
Zwei von drei verwertbaren Protokollen erfüllen „dieselbe Größenordnung", eines
nicht. Bot-Zahlen bleiben damit Richtwerte, wie in Punkt 12 des Auftrags gefordert.

**Protokolle sind an eine Version gebunden.** Ein Protokoll vom 28.09. 14:23 ließ
sich nach dem Platzierungsfix `88fc725` nicht mehr nachspielen: aus einem Sieg in
Welle 50 mit 15 Leben wurde eine Niederlage in Welle 35. `npm run calibrate` hat
diese Niederlage stillschweigend als Maßstab genommen. Seither prüft
`tests/tools/reference.mjs` vor jeder Verwendung, ob das Nachspielen die
aufgezeichnete Partie noch ergibt; `calibrate` und `powercurve` überspringen
sonst das Protokoll, `npm run replay` sagt, ob die Version oder der Determinismus
schuld ist. **`RULESET_VERSION` steht seit dem 28.09. auf 3**, weil `88fc725` und
`b4bba94` die Platzierungsregeln geändert haben. Bestwerte aus Regelversion 2
liegen dadurch in einer eigenen Liste; die Menüzeile sagt, wie viele es sind.

Tills vier Protokolle sind unter Regelversion 2 aufgezeichnet. Drei spielen sich
trotzdem unverändert nach und bleiben damit Maßstab — geprüft wird das
Nachspielen, nicht der Stempel. Nur MZGGZJ ist verloren.

**Was die Kraftkurve rechnet:** Reserve (lieferbarer Schaden geteilt durch die
wirksamen Lebenspunkte der Welle) im Median 512 % in W1–W10, **1199 % in
W5–W30**, 322 % in W31–W50. Welle 1 liegt bei −9 %, Welle 50 bei −39 %. Die
Lebenspunkte des Modells stimmen auf 6 % über 35 gemessene Wellen. Die Reserve
sagt **keinen** Durchbruch vorher: Tills drei verlustreiche Wellen lagen bei 418
bis 1018 %, die 32 verlustfreien im Median bei 1061 %. Grund ist die Annahme des
Modells, der Spieler habe alle sechs Doktrinen stehen — wer ohne Luftabwehr
baut, richtet gegen Flieger null Schaden an.

## Was die vier Protokolle sagen (Befunde, nichts geändert)

Grundlage: 4 Partien von Till, 28.09.2026, alle ohne Debug-Hebel, 147 bewertete
Wellen. Zwei Stile: einmal Labyrinth (8425CM, Route bis 108), dreimal „an der
Strecke entlang" (Route 43 bis 60).

1. **87 % aller Wellen sind „zu leicht"** (128 von 147), 11 % „passt", 2 % „zu
   schwer". Nur drei Wellen wurden je als zu schwer bewertet: W1, W8, W30.
2. **Leben gehen an genau einer Stelle verloren: Welle 30.** In allen drei
   Partien, die so weit kamen, kostet der Boss dort 5 Leben — und sonst passiert
   über 50 Wellen nichts. Die zwei Siege enden mit 15 von 20 Leben, beide mit
   demselben Verlust an derselben Welle.
3. **Labyrinth zahlt sich nicht aus, es bestraft.** Die eine Labyrinth-Partie
   (Route 108) verlor in Welle 35; die drei Partien, die nur an der Strecke
   bauten (Route 57 bis 60), gewannen zweimal. In Welle 35 fällt die Route von
   108,1 auf 60,7 — der Koloss räumt das Labyrinth weg, und die Partie, die am
   meisten hineingesteckt hatte, verliert am meisten.
4. **Geld verliert ab Welle 20 seine Bedeutung.** Requisition am Ende: 2625 und
   2074. Von W25 an liegt die Reserve über 1000, ohne dass sie gebraucht wird.
5. **Verschwendeter Schaden früh, kaum noch spät.** In W1–W10 bis zu 90 % des
   angekommenen Schadens (EFDXE8), in W41–W50 nur 3 bis 4 %. Eine Stellung, die
   einen Schwärmer zweimal tötet, ist nicht stark, sondern falsch eingestellt.
6. **Kommandos tragen 14 bis 21 % des Schadens** in den langen Partien, in der
   kurzen 0 %.

Was diese Befunde nicht beantworten: ob W1 und W8 die richtigen harten Wellen
sind (jede kam nur in einer Partie vor) und ob Welle 30 als einzige Hürde
Absicht ist.

## M6 Teil 2: Abstimmung

**Runde 1 umgesetzt** (28.09., Regelversion 4):
[`runde-1.md`](../balancing/runden/runde-1.md). Warpsprung 3→1,
Schildregeneration 120→40, `kolossLeakCost` 15→8. **Bestätigt durch Tills Partie
ASQ7XY vom 29.09.:** Welle 30 mit Labyrinth 20/20 getötet, kein Durchbruch, von
Till mit „passt" bewertet statt „zu schwer". Welle 35 kostete 8 Leben, die Partie
ging weiter und wurde gewonnen.

**Welle 8 bleibt, wie sie ist** — die teure Fliegerwelle ohne Luftabwehr ist als
Lernkurve gewollt (Entscheidung 28.09.) und keine offene Baustelle.

**Runde 2 umgesetzt** (29.09., Regelversion 5, Version 0.9.3):
[`runde-2.md`](../balancing/runden/runde-2.md). `healthGrowth` 1,12→1,125 und
`countPerWave` 0,5→1,25, beide auch im GDD. **Gemessen an Tills Partie WFQZ4M:**
„zu leicht" von 88 % auf 51 %, Reserve in W5–W30 von 1556 % auf 798 %, W31–W49
durchgehend „passt", kein einziges „zu schwer" in 50 Wellen.

**Runde 3 umgesetzt** (29.09., Regelversion 6):
[`runde-3.md`](../balancing/runden/runde-3.md). Till hat **A plus B2** gewählt.

**A — Bandfaktor für die Mitte.** Welle 6 bis 34, Spitze ×2,5 in Welle 14
(`midFrom`/`midPeak`/`midTo`/`midFactor` in `tests/tools/wave-rules.mjs`, im GDD
Abschnitt 9). Ein Band, weil kein globaler Hebel die Mitte erreicht, ohne vorher
das Spätspiel umzukippen: `healthGrowth` 1,13 wirkte nicht, 1,14 verlor in Welle
48. Gemessen: Reserve in W5–W30 von 798 % auf 413 %, W31–W50 unverändert 288 %,
und Tills Nachspiel verliert erstmals ein Leben in der Lücke (Welle 15).

**B2 — Aufwertung statt Bau.** Ab Welle 30 die vierte Möglichkeit in der
Auswahlphase (GDD Abschnitt 11): Kapsel in eine stehende Stellung derselben
Doktrin, ein Rang hinauf, 120 bis 1875 R. Die Kapsel muss mindestens den Rang der
Stellung haben, sonst gäbe es keinen Grund mehr zu verschmelzen. Eine Möglichkeit
je Rangstufe, nicht je Stellung.

**Runde 4 läuft:** [`runde-4.md`](../balancing/runden/runde-4.md).

- **Runde 3 Teil A hat gewirkt.** Reserve in W5–W30 von 798 % auf 523 %.
- **Teil B2 wird nicht gewollt.** Die Aufwertung stand in allen 21 späten
  Auswahlphasen zur Wahl und war bezahlbar; genommen wurde sie zweimal. Eine neue
  Stellung ist mehr wert als ein Rang, weil die Routenlänge alles dominiert.
- **Die Bewertungszeile fragt jetzt an zehn Wellen** statt an fünfzig
  (`RATED_WAVES` in `src/data/rules.js`). Vorher kamen 49 von 49 „passt" zurück,
  über Reserven von −9 % bis 967 %.

**Die Schere ist der offene Punkt.** Über drei Runden sind die Enden
auseinandergelaufen: Tills Route bei Welle 30 ging von 57 auf bis zu 219, während
die Bots sich etwa halbierten (Veredler 28 → 13 Wellen im Median) und **keiner von
ihnen noch eine Partie gewinnt**. Till gewinnt dieselbe mit 20 von 20 Leben. Grund
ist, dass die Routenlänge alles multipliziert — dieselbe Erhöhung kostet einen
kurzen Weg weit mehr als einen langen, die Hebel wirken also regressiv.

**Deshalb in Runde 4 kein Eingriff in die Werte.** Was fehlt, ist eine zweite
Messung: ein Mensch, der das Spiel nicht selbst abgestimmt hat. Ein Bot ist dafür
kein Ersatz — er setzt Zonen nach einer Regel und lernt innerhalb einer Partie
nichts dazu, er ist eine untere Schranke und kein Spieler.

**Offen, unverändert:** Die Wellenarten bleiben ungleich (Luft/Horde 78–81 LP je
Zähleinheit, Panzer/Gemischt 142–146; Angleichen allein bewirkt nichts). Dazu der
verschwendete Schaden der ersten zehn Wellen.

**Protokolle: keines ist mehr Maßstab.** Alle sechs gehören zu Regeln vor Runde 3.
**Für Runde 4 braucht es eine gespielte Partie unter Regelversion 6** — und die
ist diesmal besonders nötig: Das Band lässt sich an Tills Protokoll nur zur Hälfte
prüfen (er verliert Leben ohnehin nur an Koloss und Boss), und die Aufwertung gab
es in seiner Partie noch gar nicht.

## M7: Spielmodi (parallel zu M6)

Aufträge: [`M7a-modi.md`](meilensteine/M7a-modi.md) (Modus-Gerüst, unsichtbar)
und [`M7b-king-of-the-hill.md`](meilensteine/M7b-king-of-the-hill.md) (Bastion
in der Mitte, vier Risse; Studie `reference/studien/king-of-the-hill.html`).
M7b erst nach M7a.

- **Schritt 0 ✓** (02.10.) Aufträge und Studie abgelegt, Golden-Test auf `main`.
- **M7a ✓** (02.10., von Till abgenommen und nach `main` zusammengeführt):
  `src/data/modes.js` (`standard`, `standard-klon` nur mit `?debug`),
  `createGameState(seed, config)`, Protokollformat 2, Profilformat 2 mit
  Migration, `prefs.lastRun`, Modus-Bildschirm und Umschalter in der
  Bestenliste. GDD Abschnitt 15, `docs/SPEICHER.md` und ART.md nachgezogen.
- **M7b ✓** (02.10., von Till abgenommen und nach `main` zusammengeführt,
  Version 0.9.5): King of the Hill steht **für alle im Menü, gekennzeichnet
  „Experimentell"** (Entscheidung 02.10.: schon vor der Kalibrierung). Damit
  führt „Neue Partie" jetzt immer über den Modus-Bildschirm. Karte, Wege aus
  einem Entfernungsfeld, Rissfolge, Sperrzone, Aufwertung statt Salve
  (`upgrade.kind: 'ladder'`), Darstellung, Modus-Karte, Bots
  (`npm run koth-bots`). GDD Abschnitt 15 und ART nachgezogen.
- **Offen für King of the Hill:** Kalibrierung 1
  ([`koth-1.md`](../balancing/runden/koth-1.md)) hat keine Werte geändert. Die
  Richtwerte des Auftrags sind erfüllt, aber alle Bots verlieren früh — an der
  Abdeckung, nicht an der Gegnerstärke. **Es braucht eine gespielte Partie.**
  Danach entscheidet Till, ob das Kennzeichen „Experimentell" fällt; wird dann
  eine Regel des Modus geändert, steigt sein `rev` (eigene Bestenliste).

**Wo M7b vom Auftrag abweicht:**

- Geometrie, Sperrradius und Ruinen stehen in einem Kartendatensatz
  (`KOTH_MAP` in `src/data/map.js`), nicht verteilt auf `map`, `rifts` und
  `banRadius` im Modus-Datensatz: Der Kartengenerator bekommt so eine einzige
  Quelle. Ruinen sind Einzelfelder (Ruine, Krater), wie in der Studie.
- `map.rift` zeigt auf das erste Tor des angreifenden Risses und zieht mit
  `state.riftIndex` mit (`syncRift`): Koloss und Infofeld kennen nur einen Riss
  und lesen so den richtigen.
- Geteilter Kern: Die Planung darf jetzt direkt in die Welle übergehen
  (`src/core/phases.js`), nur über die Aufwertung.
- Der Test „Feld mit Mittelpunkt genau auf Radius 4" ist so nicht möglich:
  Kein Feldmittelpunkt liegt genau auf Radius 4. Geprüft wird die Grenze mit
  einem Radius, der einen Mittelpunkt trifft.
- Die Bedienung der Aufwertung folgt der Regel des Spiels: auf dem Tablet zwei
  Tipper, mit der Maus ein Klick.
- 60 fps mit 200 Gegnern gemessen auf dem M2 dieses Macs
  (`npm run test:perf -- --mode koth`), auf dem iPad noch nicht.

**Für M6 gemeldet, nicht geändert:** Zielwahl, Mörser-Vorhalt und
Fähigkeiten lesen für den Koloss die Linie der Welle, nicht seine eigene
(`waveLineOf` in `src/sim/route.js` hält das fest). Möglicherweise ein Fehler;
eine Änderung verschiebt die Standardpartien und gehört in eine Balancing-Runde.

**Wo M7a vom Auftrag abweicht** (dort steht, dass der Code gilt):

- `onStart(seed, config)` statt `onStart(config)`: Das Menü reicht den Seed schon
  durch, die Konfiguration kommt dazu. Ohne Konfiguration gilt die der letzten
  Partie — so bleiben „Neue Partie" und „Gleicher Seed" auf dem Ende-Bildschirm
  im gespielten Modus, ohne den Modus-Bildschirm noch einmal zu zeigen.
- Die Einstellungen liegen in `src/core/prefs.js` (geteilt), nicht unter
  `src/storage/`; `lastRun` steht deshalb dort.
- Auch „Seed eingeben → Starten" führt über den Modus-Bildschirm, wenn es mehr
  als einen Modus gibt. Der Auftrag nennt nur „Neue Partie".
- Ende-Bildschirm und Bestenliste nennen den Modus nur, solange mehr als einer
  wählbar ist — sonst wäre es eine sichtbare Änderung für alle.
- Der Umschalter der Bestenliste wählt nur den Modus; die Schwierigkeit ist
  „normal", bis es eine zweite gibt.
- `startMatch` in `tests/tools/server.mjs` wählt mit `?debug` einen Modus und
  drückt „Los", weil der Modus-Bildschirm sonst jede Browser-Prüfung aufhält.
- Unbekannte Modus-IDs von außen (URL, Einstellungen): mit `?debug` ein Fehler,
  sonst Standard mit einer Zeile in der Konsole (`sanitizeConfig`).

**Golden-Test** (`tests/unit/golden.test.js`, Hashes in `golden.json`): Die
sieben Protokolle aus `balancing/protokolle/`, unter den heutigen Regeln
nachgespielt, und drei Bot-Partien müssen bitgleich bleiben. **Der Hash wird nur
in einem Commit erneuert, der `RULESET_VERSION` anhebt oder ausdrücklich sagt,
dass er das Spiel ändert** (`GOLDEN_WRITE=1 node --test tests/unit/golden.test.js`).
Gilt auch für M6: Wer Werte ändert, erneuert ihn im selben Commit.

**Wie M6 und M7 sich nicht in die Quere kommen:** M7 ändert keine
Balancing-Zahl und nicht `RULESET_VERSION`. Regeln, in denen sich Modi
unterscheiden, werden Tabellen von Varianten im Modus-Datensatz (etwa
`upgrade.kind`: `'pod'` im Standard, `'ladder'` in King of the Hill), keine
Verzweigung nach dem Modus. Die Aufwertung aus Runde 3 wird dafür in M7a der
Eintrag `'pod'` — wer sie in M6 ändert, ändert sie dort. Ins GDD schreibt M7
nur den neuen Abschnitt „Spielmodi"; Abschnitt 9 und 11 bleiben bei M6.

**Für M6 gemeldet, nicht geändert:** GDD Abschnitt 9 nennt das Mittelband
„Welle 6 bis 30, Spitze bei 18", `tests/tools/wave-rules.mjs` rechnet 6 bis 34
mit Spitze bei 14 (wie oben unter Runde 3 beschrieben).

## Werkzeuge

| Befehl | Zweck |
|---|---|
| `npm test` | Unit-Tests (499), darunter der Golden-Test (etwa 14 s) |
| `npm run test:input` | 77 Browser-Checks, Touch und Maus (`-- --browser webkit` für Safari) |
| `npm run test:perf` | 200 Gegner, prüft 60 fps und dass im Betrieb nichts gerastert wird |
| `npm run test:battle` | spielt eine lange Partie im Browser, scheitert an jedem Konsolenfehler |
| `npm run test:offline` · `test:webkit` | Service Worker · alles in WebKit |
| `npm run replay -- <protokoll>` | Partie ohne Grafik nachspielen, `--data` mit geänderten Werten |
| `npm run bots` · `calibrate` · `powercurve` | Bots über viele Seeds · Eichung · Kraftkurve |
| `npm run koth-bots` | King of the Hill: die vier Bots der Studie, Sperrradius und LP-Faktor zum Durchprobieren |
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
- **Eine Landezone auf Trümmern nur, solange die Requisition den Abriss deckt.**
  Sinkt sie danach darunter, werden die betroffenen Markierungen entfernt und das
  gemeldet; jede Ausgabe in der Planung läuft dafür über `spend` in
  `sim/economy.js`. Sonst konnte eine Salve vollständig auf unbezahlbaren
  Trümmern landen und keine ihrer Kapseln war wählbar — eine Sackgasse, denn
  Abreißen, Bollwerk und Nachschubstufe gehören alle in die Planungsphase.
- Allgemeiner: **eine Markierung, deren Feld keine Kapsel mehr aufnehmen kann,
  wird entfernt, nicht die Handlung verweigert** (`dropInvalidZones`). Das gilt
  auch für ein Bollwerk auf dem markierten Haufen — ein Bollwerk ist in
  `checkPlacement` `occupied` — und für Debug-Trümmer auf einem markierten freien
  Feld. Die spätere Entscheidung des Spielers gewinnt; ein Bollwerk, das aus
  unsichtbarem Grund nicht hochgeht, wäre die schlechtere Bedienung.
- Bleibt trotzdem keine bebaubare Kapsel (volle Karte, das Ergänzen muss
  ausweichen), kann die Salve verfallen gelassen werden: keine Stellung, alle
  Kapseln zu Trümmern, die Welle beginnt. Nur in diesem einen Fall angeboten.
- Der Nachspieler darf ein `select` nicht einfach überspringen — es startet die
  Welle. Ist die aufgezeichnete Wahl unter neuen Zahlen unmöglich, behält er die
  gewählte Kapsel, sonst eine bezahlbare, sonst lässt er die Salve verfallen, und
  vermerkt es. Vorher lief er in diesem Fall in die Schrittgrenze.
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

**Eingabe**

- Was auf Touch nicht rückholbar ist, braucht zwei Tipper: der erste zeigt und
  merkt vor, der zweite führt aus. So arbeiten Abreißen, Bollwerk und seit 0.9.1
  Rezepte, die Stellungen verbrauchen — dort zeigt der erste Tipp die Vorschau
  und lässt sie stehen. Mit der Maus reicht ein Klick, dort sind Zeigen (Hover)
  und Auslösen (Klick) schon zwei verschiedene Dinge.
- Welche Art Druck es war, kommt vom `pointerdown` vor dem Klick. Der
  `pointerType` am Klickereignis selbst ist bei Tastaturbedienung leer und wird
  nicht von jeder Engine gleich gemeldet.

**Balancing (M6, Entscheidung 7)**

Beurteilt wird mit an echten Partien geeichten Bots und den Protokollen selbst.
Der alte Einwand bleibt richtig — ein Bot, der kein Labyrinth baut, ist kein
Maßstab —, aber die Antwort darauf gab es vorher nicht. **Ungeeichte Bot-Zahlen
sind Richtwerte, keine Messung.** Werte ändern sich nur in `src/data/` und in den
Wellenregeln, nie verstreut im Code.
