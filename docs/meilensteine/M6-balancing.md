# M6: Balancing und Feinschliff

Letzter Meilenstein, Abschluss des Projekts. Neu gefasst am 27.09.2026 aus dem Auftrag `M6-neufassung-auftrag.md`; die Auftragsdatei ist danach gelöscht worden, dieser Text ist die einzige Quelle.

## Warum neu gefasst

Der alte M6 sah einen „automatischen Simulationsmodus ohne Grafik mit einer einfachen Bau-Strategie" vor. Den gibt es schon als `npm run playmatch` — und er zeigt genau das Problem:

- Der Bot verliert auf Seed BASTION in Welle 9.
- Till meldet aus echten Partien das Gegenteil: ab Welle 3 bis 5 viel zu leicht, kaum Durchbrüche bis Welle 30.

Der Bot baut kein Labyrinth und taugt deshalb nicht als Maßstab. Till kann nicht viele ganze Partien am Stück spielen. Reine Simulation mit zufälligen Platzierungen misst etwas anderes als ein Mensch.

Der neue M6 verbindet daher vier Quellen:

- **echte Entscheidungen** aus Tills Partien (Aufzeichnung und Nachspielen),
- **an ihm geeichte Bots** für die Menge,
- **eine rechnerische Kraftkurve** als Vorprüfung,
- **kurze Testhäppchen** für Tills Gefühl.

Erst die Werkzeuge, dann die Zahlen.

## Was dafür schon steht

Drei Voraussetzungen sind geprüft und tragen (27.09.2026):

- **Kein `Math.random()` in `src/sim/`, `src/core/`, `src/data/`.** Der Kampf ist zufallsfrei; optische Effekte sind die einzigen Nutzer und stehen im Renderer.
- **Keine Echtzeit in der Simulation** (kein `Date.now`, kein `performance.now`). Nachspielen über Simulationsschritte ist damit exakt möglich, unabhängig von Bildrate und Spielgeschwindigkeit.
- **Der Zonen-Zufall ist pro Welle abgeschottet.** `fillZones` zieht aus `createRng(seed).fork('pods').fork(welle).fork('zones')`, also nur aus Seed und Wellennummer. Ein übersprungener oder zusätzlicher Aufruf verschiebt keine späteren Würfe. Kapselinhalte hängen genauso nur an Seed und Welle (`fork('contents')`).

## Umfang

### Teil 1: Werkzeuge (vor jeder Zahlenänderung)

Teil 1 ist in vier Schritte geteilt, weil er sonst zu groß für einen Block wäre und weil er in der Mitte eine Übergabe an Till hat: Drei der sechs Abnahmekriterien brauchen ein Protokoll von ihm, und das entsteht erst durch Schritt 1.

#### Schritt 1: Aufzeichnen und exportieren — geht fertig zu Till

1. **Partie-Aufzeichnung (Replay).**
   - Jede Partie schreibt ein kompaktes Protokoll:
     - Seed, Regelversion,
     - jede Spieleraktion mit Simulationsschritt, Phase und Parametern: Zonen setzen und löschen, Salve anfordern, Auswahl, Nachschub kaufen, Abriss, Bollwerk bauen, Kommandos mit Zielfeld oder Linie.
     - Die Spielgeschwindigkeit wird **nicht** protokolliert, weil sie am Ergebnis nichts ändert.
   - Mitgeschrieben wird an einer Stelle in der Simulation (`src/sim/actions.js`, `zones.js`, `economy.js`, `commands.js`), nicht in der UI.
   - Aufgezeichnet wird nur, was auch angenommen wurde. Abgelehnte Versuche (Zone auf einem gesperrten Feld, zu teurer Abriss) sind Rauschen und würden das Nachspielen nur verlängern.
   - Das Ergebnis von `fillZones` wandert mit ins Protokoll, statt beim Nachspielen neu gewürfelt zu werden. Der Strom selbst ist abgeschottet (siehe oben), aber die *Auswahl* hängt am Kartenzustand, und der hängt an Abrisspreisen — also an Werten, die in Teil 2 geändert werden.
   - Speicherung über `src/storage/`, als eigenes Dokument neben Profil und Einstellungen. Nur die letzten Partien werden gehalten, nicht alle.
   - **Auch abgebrochene Partien sind wertvoll** und werden aufgezeichnet.
2. **Zwei getrennte Zufallsquellen belegen.**
   - Ein Test, der eine Datenänderung (Schaden, Lebenspunkte, Preise) vornimmt und festhält, dass Karte und Kapselinhalte sich nicht verschieben.
3. **Bewertung nach jeder Welle.**
   - Nach jeder Welle erscheint unaufdringlich eine Zeile mit drei Knöpfen: „zu leicht", „passt", „zu schwer".
   - Tippen ist freiwillig, das Spiel wartet nicht darauf.
   - Die Bewertung wandert ins Protokoll.
   - Ein Schalter in den Einstellungen blendet die Zeile aus. Standard: an, solange die Regelversion als Testversion markiert ist.
   - Sie gehört in diesen Schritt und nicht ans Ende: Wäre sie erst später da, tragen genau die Partien keine Bewertung, an denen später geeicht wird.
4. **Export als eigener Knopf** „Partie exportieren" im Pausenmenü und auf dem Ende-Bildschirm, als JSON-Datei.

Am Ende dieses Schritts steht die Übergabe: Till spielt und legt seine Protokolle ab (siehe „Übergabe der Daten"). Alles Weitere lässt sich parallel bauen, aber nicht abnehmen.

#### Schritt 2: Nachspielen ohne Grafik

5. `npm run replay -- <datei> [--data <override.json>]`
   - Spielt ein Protokoll mit festem Zeitschritt nach und schreibt pro Welle eine Zeile:
     - Gegner, getötet, durch, Leben,
     - Summe Gegner-Lebenspunkte,
     - Summe Schaden aller Stellungen,
     - verschwendeter Schaden (Overkill),
     - Routenlänge, Requisition, Stellungen nach Rang.
   - Mit `--data` lassen sich einzelne Datenwerte überschreiben, ohne `src/data/` zu ändern. So wird dieselbe Partie mit neuen Zahlen durchgerechnet.
   - Ist eine protokollierte Aktion unter neuen Zahlen nicht mehr gültig, wird sie übersprungen und in der Ausgabe markiert. Das Nachspielen bricht dabei nicht ab. Beispiel: Ein Feld ist inzwischen blockiert, oder ein Abriss ist zu teuer geworden.
   - Ausgabe zusätzlich als CSV.
   - Der Nachspieler ist ein gemeinsames Modul, das ohne DOM läuft: Schritt 4 braucht ihn im Browser, die Werkzeuge in Node.

#### Schritt 3: Bots, Eichung, Kraftkurve

6. **Bots mit Strategie** (`npm run bots -- --seeds 200 --strategy <name>`).
   - Mindestens drei Strategien:
     - **Labyrinth-Bauer:** setzt Zonen so, dass die Route maximal verlängert wird, und behält die Stellung mit der meisten Wegabdeckung.
     - **Feuerkraft:** hält eine kompakte Todeszone an der längsten Engstelle und behält die stärkste Kapsel.
     - **Rezept-Jäger:** hält Zutaten zurück und erfüllt Rezepte, sobald möglich.
   - Alle Bots kaufen Nachschub nach einer einfachen Regel, reißen Trümmer ab, wenn es den Weg verlängert, und setzen Kommandos bei Bossen und beim Koloss.
   - Ausgabe als CSV über alle Seeds: Überlebensquote pro Welle, Leben am Ende, Durchbruchswellen.
   - `playmatch` bleibt als einfachster Bot bestehen und geht in diesem Werkzeug auf, damit es nur eine Spielerlogik gibt.
7. **Eichung der Bots an Tills Protokollen.**
   - Werkzeug, das für die Seeds aus Tills Protokollen jeden Bot spielen lässt und das Ergebnis neben Tills Ergebnis stellt: Leben pro Welle, Routenlänge pro Welle, Stellungen nach Rang.
   - Ziel ist ein Bot, der ungefähr so stark ist wie Till.
   - **Ohne diese Eichung sind Bot-Zahlen nur Richtwerte.**
8. **Kraftkurve** (`npm run powercurve`). Reine Rechnung ohne Kampfsimulation, pro Welle:
   - erwartete Lebenspunkte der Welle (inklusive Rüstung laut Schadensmatrix, Schilde, Heiler grob),
   - erwartete Feuerkraft des Spielers: Anzahl Stellungen, Rangverteilung aus Nachschubstufe und Verschmelzen, Schaden pro Sekunde mal typische Verweildauer in Reichweite bei typischer Routenlänge.
   - Die typischen Werte (Routenlänge, Rangverteilung, Nachschubstufe pro Welle) kommen aus Tills Protokollen, solange es keine gibt aus den geeichten Bots.
   - Ausgabe als Tabelle und als einfaches Diagramm (HTML-Datei), beide Kurven übereinander.

#### Schritt 4: Testhäppchen für Till

9. **Menüpunkt „Testeinstieg"** (nur mit `?debug` oder in einem Entwicklerbereich der Einstellungen): Partie ab Welle 10, 20, 30 oder 35 (Koloss) mit einem vorbereiteten Stand.
   - Der Stand entsteht durch Nachspielen eines Protokolls bis zu dieser Welle, bevorzugt aus Tills eigenen Partien, sonst vom geeichten Bot.
   - Keine eigene Speicherlogik nötig: Ein Protokoll plus Wellennummer ist der Spielstand.

### Teil 2: Abstimmung (erst nach Freigabe von Teil 1)

10. **Ablauf pro Runde:**
    1. Kraftkurve rechnen.
    2. Vorschlag für neue Datenwerte machen.
    3. Bots und Protokoll-Nachspiele laufen lassen.
    4. Till spielt zwei bis drei Testhäppchen an den auffälligen Wellen.
    5. Auswertung erstellen.
    6. Die nächste Runde startet.

    Jede Runde endet mit einer kurzen Auswertung in `balancing/runden/runde-N.md`: was geändert wurde, warum, Kurven vorher und nachher, Tills Bewertungen.
11. **Bekannte Baustellen, die zuerst geprüft werden:**
    - Rangfaktoren (1 / 2,2 / 5 / 12 / 30) gegen Lebenspunktwachstum (1,12 pro Welle). Tills Verdacht: Die Ränge wachsen schneller als die Gegner.
    - Die in M5d gemeldeten Startwerte der Spezialstellungen (Sturmbatterie, Glutkessel, Gewitterturm, Reinigungsschrein zu schwach je Ziel, Belagerungsmörser mit zu kurzer Reichweite, Obelisk gegen normale Gegner sehr stark).
    - Koloss in Welle 35 und 45: Stärke gegen Luftschlag, Obelisk-Deckel und Bollwerk.
    - Die zurückgestellte Idee „in den ersten zwei Runden zwei Stellungen behalten" erst prüfen, wenn das Mittelspiel stimmt.
12. **Was über sieben Meilensteine hinweg für M6 gemeldet wurde** und in `docs/PROGRESS.md` unter „Offen" steht. Der Auftrag nennt es nicht, es fällt aber nicht weg:
    - **Requisition und Kommandopunkte stauen sich.** Ab Nachschubstufe 8 (etwa Welle 20) gibt es nur noch Abreißen und Bollwerke als Ausgabe; am Ende liegen über 4000 Requisition und rund 50 KP ungenutzt. Das GDD hat zwei Gegenmittel ausdrücklich vorgemerkt, aber nicht freigegeben: unbegrenzte Nachschubstufe und „Aufwertung statt Bau" (GDD Abschnitt 14). Eines von beiden wird in einer Runde von Teil 2 zur Entscheidung gestellt.
    - **Flieger überfliegen das Labyrinth**, und nur Autokanone, Laser, Psi und Tesla treffen sie. Wer ohne Luftabwehr baut, verliert an einer Flieger-Welle, egal wie gut das Labyrinth ist. Zu entscheiden, ob das so gewollt ist oder ob das Spiel darauf hinweist.
    - **Welle 2 ist eine reine Kriegerwelle**; ein Seed verlor dort zehn Leben auf einen Schlag. Kleinster Eingriff wäre, ihren Anteil auch auf Schwärmer zu verteilen.
    - **Ohne eigene Markierungen ist Welle 1 verloren** (gemessen: 30 Durchbrüche, Niederlage nach 55 s). Das ist Bedienführung, nicht Balancing — das Spiel sagt nirgends, dass die Zonen gesetzt werden wollen. Es ist der Rest des alten M6-Punktes „Bedienkomfort nach Testnotizen" und bleibt in dessen Umfang.
    - **Der Koloss tritt nur zweimal pro Partie auf** (Welle 35 und 45), Folge der versetzten Wellen. Falls das zu dünn wirkt, ist `KOLOSS_RUN.waves` der Hebel.
    - **Boss-Werte, Kegelwinkel, Strahlbreite und Sprungweite stehen nirgends im GDD.** Sie sind seit M3 hergeleitet. Was am Ende von Teil 2 steht, gehört ins GDD, damit die Tabellen wieder eine Quelle haben.
    - **`bulwarkCostFactor: 2` ist hergeleitet**, nicht gegeben (Räumen 1×, eigene Stellung 3×, Bollwerk dazwischen).
13. **Datenwerte** ändern sich nur in `src/data/` bzw. in den Regeln des Wellengenerators, nie verstreut im Code. Jede Runde erhöht die Regelversion, damit Bestwerte und Protokolle getrennt bleiben.

## Nicht im Umfang

- Online-Bestenliste, Fortschritt über mehrere Partien, Heldenaktion.
- Neue Inhalte (Gegner, Stellungen, Kommandos).

## Entscheidungen, die dieser Plan vorschlägt

Sieben Stellen, an denen der Auftrag offen ist oder an vorhandenen Code stößt. Sie sind hier benannt statt stillschweigend gelöst.

1. **Teil 1 wird in vier Schritte geteilt, mit einer Übergabe nach Schritt 1.** Acht Werkzeuge in einem Block widersprechen der Regel „kleine, in sich lauffähige Schritte", und drei Abnahmekriterien hängen an einem Protokoll von Till, das erst durch Schritt 1 entstehen kann. Die Bewertungszeile rutscht deshalb nach vorn in Schritt 1: käme sie später, tragen genau die Partien keine Bewertung, an denen danach geeicht wird.
2. **Der Wellengenerator wird zum importierbaren Modul.** `--data` erreicht nur, was zur Laufzeit aus `src/data/` gelesen wird. `waves.js` ist aber erzeugt, und der interessanteste Hebel überhaupt — Gegnerzahl, das Wachstum 1,12 pro Welle, die Freischaltwellen, der Frühstart-Abschlag — steht als Konstanten in `tests/tools/make-waves.mjs`. Genau dieser Hebel ist Tills Hauptverdacht (Baustelle 1). Die Regeln wandern darum in ein eigenes Modul, das Generator und `--data` beide lesen. Der Generator bleibt die einzige Quelle der Tabelle, Handänderungen in `waves.js` bleiben verboten.
3. **`--data` ändert Zahlen in Zeilen, nicht die Form der Tabellen.** Geprüft: Einige Werte werden beim Import zu abgeleiteten Konstanten verrechnet — `MAX_SALVO_SIZE` aus `SALVO_SIZES`, `MAX_SUPPLY_LEVEL` und `SUPPLY_WEIGHT_COUNT` aus `SUPPLY_LEVELS`, `MAX_RANK` und `RANK_COLORS` aus `RANKS`, `IMPACT_SECONDS` aus den Kapselzeiten, dazu die Id-Listen der Doktrinen, Gegner, Rezepte und Kommandos. Ein Override, der eine Zeile *hinzufügt* (etwa eine neunte Nachschubstufe), würde von diesen Konstanten nicht bemerkt. Solche Formänderungen sind eine echte Codeänderung und keine Sache von `--data`; das Werkzeug lehnt sie ab, statt still Falsches zu rechnen.
4. **Ein Baum für die Balancing-Daten.** Der Auftrag legt Protokolle nach `balancing/protokolle/` und Auswertungen nach `docs/balancing/runde-N.md` — zwei gleichnamige Ordner an zwei Orten. Vorschlag: alles unter `balancing/`, die Auswertungen in `balancing/runden/`. Rohdaten sind keine Dokumentation, darum nicht unter `docs/`. Für die PWA unbedenklich: `make-precache` läuft über eine Positivliste (`src`, `assets/fonts`, `assets/icons`), Protokolle landen nicht im Offline-Cache.
5. **Protokolle bekommen einen eigenen Exportknopf, nicht den bestehenden.** Der Auftrag lässt beides offen. Der Profil-Export ist seit M5 die Bestenliste-Übertragung, und dort gilt die Entscheidung, dass nicht alles mitfährt (die Einstellungen tun es auch nicht). Ein Protokoll gehört nicht in dieselbe Datei.
6. **Die Regelversion braucht ein zweites Feld.** `RULESET_VERSION` ist heute eine nackte Zahl; „solange die Regelversion als Testversion markiert ist" setzt ein Kennzeichen voraus, das es noch nicht gibt. Es kommt nach `src/data/rules.js`. Dazu die Folge von „jede Runde erhöht die Regelversion": Die Bestenliste zerfällt über die Runden in viele getrennte Listen. Für die Abstimmungsphase richtig, aber zum Abschluss muss eine Zahl stehenbleiben.
7. **Die alte Entscheidung „kein Balancing mit automatischen Werkzeugen" wird abgelöst, nicht übergangen.** In `docs/PROGRESS.md` steht seit dem 23.09.2026: „Balancing wird **nicht** mit den automatischen Werkzeugen beurteilt." Begründet war das mit genau dem, was dieser Auftrag auch feststellt — der Bot baut kein Labyrinth. Die Eichung an Tills Protokollen ist die Antwort darauf, die es damals nicht gab. Die alte Entscheidung wird als abgelöst gekennzeichnet, mit Grund, damit sich nicht zwei Stellen der Dokumentation widersprechen.

## Hinweise zur Umsetzung

- **Der Labyrinth-Bauer braucht eine beschränkte Suche.** „Route maximal verlängern" ist eine Suche über alle freien Felder, und eine Blockadeprüfung kostet etwa 0,15 ms. Greedy über die ganze Karte wäre bei 200 Seeds knapp eine Stunde pro Strategie; beschränkt auf die Felder am Rand der aktuellen Route sind es rund zwölf Minuten. Die Beschränkung gehört von Anfang an hinein, sonst ist `--seeds 200` unbenutzbar.
- **Aufzeichnen darf die Simulation nicht verändern.** Das Protokoll ist eine Beobachtung; es hängt an derselben Stelle wie die Aktion, aber kein Simulationsschritt liest daraus.
- Die Simulation kennt weiter kein DOM. Der Nachspieler auch nicht, damit er in Node und im Browser (Schritt 4) derselbe ist.
- Balancing-Werte bleiben in `src/data/` und in den Wellenregeln. Kein Wert wandert in den Simulationscode.

## Abnahme von Teil 1

- Eine von Till gespielte und exportierte Partie lässt sich ohne Grafik nachspielen und ergibt ohne Datenänderung exakt dasselbe Ergebnis (Leben pro Welle identisch). Dafür gibt es einen Test.
- Mit geänderten Daten läuft dieselbe Partie durch, ungültige Aktionen sind markiert.
- Ein Test belegt, dass eine Datenänderung Karte und Kapselinhalte nicht verschiebt.
- Mindestens ein Bot erreicht auf Tills Seeds ein Ergebnis in derselben Größenordnung wie Till.
- Kraftkurve als HTML-Datei vorhanden.
- Testeinstieg ab Welle 10, 20, 30 und 35 funktioniert auf dem iPad.
- Bewertungszeile erscheint nach jeder Welle, blockiert nichts und landet im Protokoll.

## Abnahme von Teil 2

Nach Absprache mit dem Spieldesigner, Runde für Runde. Jede Runde hat ihre eigene Auswertung in `balancing/runden/`.

## Übergabe der Daten

Exportierte Protokolle legt Till in `balancing/protokolle/` im Repository ab (Dateiname mit Datum und Seed). Das Repository ist öffentlich lesbar, darüber werden sie ausgewertet.
