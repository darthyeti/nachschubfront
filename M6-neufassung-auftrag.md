# Auftrag: M6 Balancing neu fassen

An Claude Code. Bitte `docs/meilensteine/M6-balancing.md` nach diesem Auftrag neu schreiben, danach diese Datei löschen, `docs/PROGRESS.md` ergänzen und mir den neuen M6 zur Freigabe vorlegen. Noch nichts umsetzen.

## Warum
Der bisherige M6 sieht einen Simulationsmodus mit einfacher Bau-Strategie vor. Den gibt es schon (`npm run playmatch`), und er zeigt das Problem:
- Der Bot verliert auf Seed BASTION in Welle 9.
- Till meldet aus echten Partien das Gegenteil: ab Welle 3 bis 5 viel zu leicht, kaum Durchbrüche bis Welle 30.

Der Bot baut kein Labyrinth und taugt deshalb nicht als Maßstab. Till kann nicht viele ganze Partien am Stück spielen. Reine Simulation mit zufälligen Platzierungen misst etwas anderes als ein Mensch.

Der neue M6 verbindet daher vier Dinge:
- **echte Entscheidungen** aus Tills Partien,
- **geeichte Bots** für die Menge,
- **eine rechnerische Kraftkurve** als Vorprüfung,
- **kurze Testhäppchen** für Tills Gefühl.

Gute Voraussetzung: Kapselinhalte hängen schon nur an Seed und Welle (`fork('pods').fork(welle)`), und der Kampf nutzt keinen Zufall.

## Umfang des neuen M6

### Teil 1: Werkzeuge (zuerst, vor jeder Zahlenänderung)

1. **Partie-Aufzeichnung (Replay).**
   - Jede Partie schreibt ein kompaktes Protokoll:
     - Seed, Regelversion,
     - jede Spieleraktion mit Simulationsschritt, Phase und Parametern: Zonen setzen und löschen, Salve anfordern, Auswahl, Nachschub kaufen, Abriss, Bollwerk bauen, Kommandos mit Zielfeld oder Linie.
     - Die Spielgeschwindigkeit wird nicht protokolliert, weil sie am Ergebnis nichts ändert.
   - Alle Aktionen laufen schon über `src/sim/actions.js`, `zones.js`, `economy.js` und `commands.js`. Dort an einer Stelle mitschreiben, nicht in der UI.
   - Speicherung über `src/storage/`. Export als JSON-Datei über die bestehende Export-Funktion oder einen eigenen Knopf „Partie exportieren“ im Pausenmenü und auf dem Ende-Bildschirm.
   - Nicht nur ganze Partien: Auch abgebrochene Partien sind wertvoll.

2. **Nachspielen ohne Grafik** (`npm run replay -- <datei> [--data <override.json>]`).
   - Spielt ein Protokoll mit festem Zeitschritt nach und schreibt pro Welle eine Zeile:
     - Gegner, getötet, durch, Leben,
     - Summe Gegner-Lebenspunkte,
     - Summe Schaden aller Stellungen,
     - verschwendeter Schaden (Overkill),
     - Routenlänge, Requisition, Stellungen nach Rang.
   - Mit `--data` lassen sich einzelne Datenwerte überschreiben, ohne `src/data/` zu ändern. So wird dieselbe Partie mit neuen Zahlen durchgerechnet.
   - Ist eine protokollierte Aktion unter neuen Zahlen nicht mehr gültig, wird sie übersprungen und in der Ausgabe markiert. Das Nachspielen bricht dabei nicht ab. Beispiel: Ein Feld ist inzwischen blockiert.
   - Ausgabe zusätzlich als CSV.

3. **Zwei getrennte Zufallsquellen prüfen.**
   - Sicherstellen und mit einem Test belegen, dass Datenänderungen (Schaden, Lebenspunkte, Preise) weder Karte noch Kapselinhalte verschieben.
   - Einzige bekannte Stelle mit Spielerzufall ist das Auffüllen offener Zonen (`fillZones`). Hängt ihr Ergebnis von etwas ab, das sich durch Balancing ändert, fließt das Ergebnis ins Protokoll, statt es neu zu würfeln.

4. **Bots mit Strategie** (`npm run bots -- --seeds 200 --strategy <name>`).
   - Mindestens drei Strategien:
     - **Labyrinth-Bauer:** setzt Zonen so, dass die Route maximal verlängert wird, und behält die Stellung mit der meisten Wegabdeckung.
     - **Feuerkraft:** hält eine kompakte Todeszone an der längsten Engstelle und behält die stärkste Kapsel.
     - **Rezept-Jäger:** hält Zutaten zurück und erfüllt Rezepte, sobald möglich.
   - Alle Bots kaufen Nachschub nach einer einfachen Regel, reißen Trümmer ab, wenn es den Weg verlängert, und setzen Kommandos bei Bossen und beim Koloss.
   - Ausgabe als CSV über alle Seeds: Überlebensquote pro Welle, Leben am Ende, Durchbruchswellen.
   - `playmatch` bleibt als einfachster Bot bestehen oder geht in diesem Werkzeug auf.

5. **Eichung der Bots an Tills Protokollen.**
   - Werkzeug, das für die Seeds aus Tills Protokollen jeden Bot spielen lässt und das Ergebnis neben Tills Ergebnis stellt: Leben pro Welle, Routenlänge pro Welle, Stellungen nach Rang.
   - Ziel ist ein Bot, der ungefähr so stark ist wie Till.
   - Ohne diese Eichung sind Bot-Zahlen nur Richtwerte.

6. **Kraftkurve** (`npm run powercurve`). Reine Rechnung ohne Kampfsimulation, pro Welle:
   - erwartete Lebenspunkte der Welle (inklusive Rüstung laut Schadensmatrix, Schilde, Heiler grob),
   - erwartete Feuerkraft des Spielers: Anzahl Stellungen, Rangverteilung aus Nachschubstufe und Verschmelzen, Schaden pro Sekunde mal typische Verweildauer in Reichweite bei typischer Routenlänge.
   - Die typischen Werte (Routenlänge, Rangverteilung, Nachschubstufe pro Welle) kommen aus Tills Protokollen, solange es keine gibt aus den geeichten Bots.
   - Ausgabe als Tabelle und als einfaches Diagramm (HTML-Datei), beide Kurven übereinander.

7. **Testhäppchen für Till.**
   - Menüpunkt „Testeinstieg“ (nur mit `?debug` oder in einem Entwicklerbereich der Einstellungen): Partie ab Welle 10, 20, 30 oder 35 (Koloss) mit einem vorbereiteten Stand.
   - Der Stand entsteht durch Nachspielen eines Protokolls bis zu dieser Welle, bevorzugt aus Tills eigenen Partien, sonst vom geeichten Bot.
   - Keine eigene Speicherlogik nötig: Ein Protokoll plus Wellennummer ist der Spielstand.

8. **Bewertung nach jeder Welle.**
   - Nach jeder Welle erscheint unaufdringlich eine Zeile mit drei Knöpfen: „zu leicht“, „passt“, „zu schwer“.
   - Tippen ist freiwillig, das Spiel wartet nicht darauf.
   - Die Bewertung wandert ins Protokoll.
   - Ein Schalter in den Einstellungen blendet die Zeile aus. Standard: an, solange die Regelversion als Testversion markiert ist.

### Teil 2: Abstimmung (erst nach Freigabe von Teil 1)

9. **Ablauf pro Runde:**
   1. Kraftkurve rechnen.
   2. Vorschlag für neue Datenwerte machen.
   3. Bots und Protokoll-Nachspiele laufen lassen.
   4. Till spielt zwei bis drei Testhäppchen an den auffälligen Wellen.
   5. Auswertung erstellen.
   6. Die nächste Runde startet.

   Jede Runde endet mit einer kurzen Auswertung in `docs/balancing/runde-N.md`: was geändert wurde, warum, Kurven vorher und nachher, Tills Bewertungen.
10. **Bekannte Baustellen, die zuerst geprüft werden:**
    - Rangfaktoren (1 / 2,2 / 5 / 12 / 30) gegen Lebenspunktwachstum (1,12 pro Welle). Tills Verdacht: Die Ränge wachsen schneller als die Gegner.
    - Die in M7 gemeldeten Startwerte der Spezialstellungen (Sturmbatterie, Glutkessel, Gewitterturm, Reinigungsschrein zu schwach je Ziel, Belagerungsmörser mit zu kurzer Reichweite, Obelisk gegen normale Gegner sehr stark).
    - Koloss in Welle 35 und 45: Stärke gegen Luftschlag, Obelisk-Deckel und Bollwerk.
    - Die zurückgestellte Idee „in den ersten zwei Runden zwei Stellungen behalten“ erst prüfen, wenn das Mittelspiel stimmt.
11. **Datenwerte** ändern sich nur in `src/data/` bzw. in den Regeln von `make-waves.mjs`, nie verstreut im Code. Jede Runde erhöht die Regelversion, damit Bestwerte und Protokolle getrennt bleiben.

## Nicht im Umfang
- Online-Bestenliste, Fortschritt über mehrere Partien, Heldenaktion.
- Neue Inhalte (Gegner, Stellungen, Kommandos).

## Abnahme von Teil 1
- Eine von Till gespielte und exportierte Partie lässt sich ohne Grafik nachspielen und ergibt ohne Datenänderung exakt dasselbe Ergebnis (Leben pro Welle identisch). Dafür gibt es einen Test.
- Mit geänderten Daten läuft dieselbe Partie durch, ungültige Aktionen sind markiert.
- Mindestens ein Bot erreicht auf Tills Seeds ein Ergebnis in derselben Größenordnung wie Till.
- Kraftkurve als HTML-Datei vorhanden.
- Testeinstieg ab Welle 10, 20, 30 und 35 funktioniert auf dem iPad.
- Bewertungszeile erscheint nach jeder Welle, blockiert nichts und landet im Protokoll.

## Übergabe der Daten
Exportierte Protokolle legt Till in `balancing/protokolle/` im Repository ab (Dateiname mit Datum und Seed). Das Repository ist öffentlich lesbar, darüber werte ich sie aus.
