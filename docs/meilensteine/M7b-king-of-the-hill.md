# M7b: Modus "King of the Hill"

Status: **freigegeben am 02.10.2026**, läuft parallel zu M6, **erst nach Auftrag A** ([`M7a-modi.md`](M7a-modi.md)).
Referenz: `reference/studien/king-of-the-hill.html` (spielbarer Prototyp mit Bots, Tabs Spiel, Bots, Werte).

## Entscheidungen vom 02.10.2026

- **Name „King of the Hill“**, Modus-ID `koth`. Der Name bleibt englisch, als Eigenname, und steht wie jeder sichtbare Text nur in `src/data/strings.js`. Beschreibung und Kennzeichen sind deutsch. Die Studie hieß „Mittelbastion“.
- **Aufwertung über `upgrade.kind`** (siehe B5): `'pod'` im Standardmodus, `'ladder'` hier.
- **Erste Salve mit 8 Kapseln** (Standard: 6) wird als Moduswert umgesetzt und im GDD-Abschnitt „Spielmodi“ als Abweichung genannt.
- **Freigabe erst nach einer gespielten Partie.** Die Bots aus M6 eichen nicht (siehe `docs/PROGRESS.md`); ihre Zahlen sind auch hier nur Richtwerte. Der Modus bleibt „Experimentell“, bis Till eine Partie gespielt und das Protokoll freigegeben hat.

## Berührte Bereiche und Dateien

| Bereich | Dateien | Art der Änderung |
| --- | --- | --- |
| Daten | `src/data/modes.js`, `src/data/strings.js` | Modus-Datensatz `koth`, Texte |
| Core (geteilt) | `src/core/state.js`, Seed-Helfer in `src/core/` | aktiver Riss, Sperrmaske, Richtungsfolge |
| Sim | `src/sim/` (Wegfindung, Wellen, Gegner, Wirtschaft) | mehrere Risse, Entfernungsfeld von der Bastion, Aufwertung statt Salve |
| Render | `src/render/*` | Risse, Sperrzone, Route des aktiven Risses |
| UI | `src/ui/*` | Aufwertungsknopf, Anzeige des nächsten Risses, Modus-Karte |
| Input | `src/input/*` | Aufwertung per Tap mit Zwei-Tipp-Bestätigung |
| Werkzeuge | `tests/tools/` | Bots für den Modus, Kalibrierungslauf |
| Dokumentation | `docs/GDD.md`, `docs/ART.md`, `docs/PROGRESS.md` | siehe unten |

Geteilte Quellen, die dieser Auftrag ändert: **src/core** (ausdrücklich, siehe B3), **src/data** (nur die neuen Modus-Einträge und eine modusbezogene Stelle für den Gegner-Lebenspunktfaktor, keine bestehende Zahl), **docs/GDD.md** (Abschnitte 3, 4, 5, 11 und neuer Abschnitt "Spielmodi"), **docs/ART.md** (Risse, Sperrzone).

## Ziel

Ein zweiter Modus: Die Bastion liegt in der Mitte einer 24x24-Karte, die Gegner kommen aus vier Rissen an den Kartenrändern im Wechsel. Es gibt keine Signalfeuer. Gegen Ring-Strategien (alles dicht um die Bastion) gibt es eine Sperrzone. Im Planungsschritt kann statt einer Salve ein Stellungsrang angehoben werden.

Der Modus erscheint im Menü als **"Experimentell"**, bis die Kalibrierung (B7) abgenommen ist.

## Verbindlich und nicht verbindlich in der Studie

Verbindlich: Geometrie, Regeln, Reihenfolge der Risse, Sperrzone, Aufwertungsregel, Preise.
Nicht verbindlich: alle Zahlen für Gegner-Lebenspunkte und Kampfstärke (Platzhalter, siehe B6), Bot-Heuristiken, Zeichnung, Math.random und der eigene Zufallsgenerator der Studie. Die Studie ist ein Prototyp, nie die Architektur.

## Anforderungen

### B1 Karte und Risse

- Karte 24x24. Bastion 2x2 auf den Feldern (11,11) bis (12,12).
- Vier Risse, je zwei Torfelder (x,y):
  - Nord: (11,0), (12,0)
  - Ost: (23,11), (23,12)
  - Süd: (11,23), (12,23)
  - West: (0,11), (0,12)
- Bodengegner entstehen abwechselnd auf den zwei Torfeldern ihres Risses und laufen auf die Bastion zu. Wegfindung wie im Standardmodus (8 Richtungen, kein Ecken-Schneiden, Diagonale Kosten sqrt(2)), aber mit einem **Entfernungsfeld, das einmal von der Bastion aus rückwärts berechnet wird** (Dijkstra) und für alle vier Risse gilt. Nicht pro Gegner und nicht pro Riss neu rechnen.
- Flieger fliegen auf geradem Weg vom Riss zur Bastionsmitte.
- Keine Signalfeuer in diesem Modus (`beacons: false`).
- Geschützt (kein Bauen, keine Landung): Bastion, alle Torfelder und je ein Feld Umkreis um beides (Chebyshev-Abstand 1).
- Ruinen: 12 bis 20 Stück, aus dem Seed gesetzt, nie auf geschützten Feldern, und jede Platzierung wird mit der Wegprüfung gegen alle vier Risse geprüft.

### B2 Richtungsfolge

- Pro Welle greift genau ein Riss an.
- Datenfeld `riftOrder`: `'mixed'` (Vorgabe) oder `'cycle'`.
  - `cycle`: strikt Nord, Ost, Süd, West.
  - `mixed`: Blöcke zu vier Wellen, jeder Block eine Mischung der vier Risse, derselbe Riss nie zweimal hintereinander (auch nicht über die Blockgrenze).
- **Die Mischung wird aus Seed und Blocknummer abgeleitet, nicht aus dem laufenden Zufallsstrom.** Dann bleibt die Reihenfolge unabhängig von allen anderen Würfen, und das Nachspielen bleibt deterministisch. Referenz: `blockPerm()` und `riftFor()` in der Studie, aber über den Generator aus `src/core` umsetzen, nicht über den Studien-Generator.
- Beobachtung zur Begründung der Vorgabe: Bei `cycle` kommen alle Bosse (Wellen 10, 20, 30, 40, 50) aus demselben Gegenüberpaar und die Kolosse (35, 45) aus dem anderen. Das ist ein Spielfeld, auf dem man gezielt vorbauen kann, `mixed` verhindert das.
- Die Vorschau zeigt in der Planungsphase den Riss der **nächsten** Welle samt Routenlänge.

### B3 Zustand (src/core, ausdrücklich geteilt)

- `state.route` bleibt bestehen und wird zu Beginn jeder Welle auf die Route des aktiven Risses gesetzt, damit nachgelagerter Code unverändert weiterläuft.
- Neu: `state.riftIndex` (aktiver Riss), eine Sperrmaske im Zustand (abgeleitet aus Modus-Datensatz und Karte, nicht aus der Zeit).
- Der Modus-Datensatz liefert die Geometrie als Daten. Keine Abfrage `if (mode === 'koth')` in der Simulation. Wo eine Regel strukturell anders ist (mehrere Risse, Sperrzone, Aufwertungsregel), wird sie über generische Datenfelder ausgedrückt:

```js
koth: {
  id: 'koth', rev: 1, status: 'experimental', debugOnly: false,
  map: { size: 24, bastion: [[11,11],[12,12]], beacons: false, ruins: [12, 20] },
  rifts: [ /* Nord, Ost, Süd, West mit je zwei Torfeldern */ ],
  riftOrder: 'mixed',
  banRadius: 4,                 // Sperrzone, euklidisch um die Kartenmitte
  salvo: { first: 8, early: 6, mid: 5, late: 4 },   // Wellen 1 / 2-15 / 16-35 / ab 36
  upgrade: { kind: 'ladder', prices: [120, 300, 750, 1875] },
  start: { requisition: 30, lives: 20, waves: 50 },
  balance: { enemyHpFactor: 0.1 },                   // Startwert, siehe B6
}
```

Die Zahlen in `salvo` und `start` sind Studienwerte und Balancing-Parameter. Gegen die Kapselregeln im GDD prüfen, bei Abweichung Rücksprache.
- Das `standard`-Verhalten bleibt bitgleich (Golden-Replay aus Auftrag A bleibt grün).

### B4 Sperrzone gegen Ringe

- Felder, deren Mittelpunkt höchstens `banRadius` (Vorgabe 4) Felder vom Kartenmittelpunkt entfernt ist (euklidisch, Mittelpunkt (12,12) in Feldmitten gerechnet), sind geschützt: kein Bau, keine Landung, keine Ruine.
- Zeichnung: schraffierte Fläche mit Rand, Beschriftung beim ersten Mal erklärt (Hinweisdialog, wie vorhandene Hinweise, verwerfbar).
- Hintergrund aus der Studie (Richtwerte, Bots sind Heuristiken): Ohne Sperrzone liegt die Ring-Strategie um etwa 30 bis 37 Wellen vor der besten anderen Strategie. Mit Radius 4 sind es nur noch etwa 2 bis 7. Radius 5 lässt bei den Studien-Werten alle Bots früh scheitern. Radius und Kampfstärke sind gekoppelt, deshalb kalibrieren (B7), nicht einzeln verstellen.

### B5 Aufwertung statt Salve

- Im Planungsschritt gibt es neben "Salve anfordern" den Weg "Stellung aufwerten": eine gewählte Stellung steigt einen Rang (Rekrut, Veteran, Elite, Held, Legende; Obergrenze Legende).
- Zulässig nur, wenn keine Landeplätze markiert sind. Es gibt dann **keine Salve und keinen neuen Schutt**, die Welle beginnt sofort.
- Preis über die Leiter `[120, 300, 750, 1875]` Nachschub für Rang 1, 2, 3, 4. Die Preise sind dieselben wie in GDD Abschnitt 11, "Aufwertung statt Bau", **die Regel ist es nicht**: Im Standardmodus gibt es die Aufwertung erst ab Welle 30, in der Auswahlphase, mit einer Kapsel derselben Doktrin und mindestens gleichen Rangs, und die Salve fällt trotzdem. Hier gibt es sie ab Welle 1, in der Planung, ohne Kapsel, ohne Salve, ohne Schutt.
- **Entscheidung von Till: Aufwertung ist ab Welle 1 erlaubt. Der Preis regelt die Häufigkeit, keine Wellensperre. Preise bleiben vorerst wie angegeben.**
- **Entscheidung von Till (02.10.2026): beide Regeln über ein Datenfeld `upgrade.kind`.** Werte: `'pod'` (Kapsel in Stellung, die Regel aus GDD Abschnitt 11, Vorgabe im Standardmodus, unverändert), `'ladder'` (Aufwertung statt Salve, Vorgabe in King of the Hill), `'free'` und `'off'`. `'free'` ist Testwerkzeug: In der Studie ersetzen kostenlose Aufwertungen früh die Salven und schaden dem Spiel.
- Umsetzung als Tabelle von Regelvarianten, nicht als Verzweigung nach Modus: Jeder Wert von `upgrade.kind` hat einen eigenen Satz Funktionen (Angebot, Prüfung, Ausführung), die Simulation schlägt nach. Ein künftiger Modus mit anderer Aufwertungsregel bekommt einen neuen Eintrag, ohne die bestehenden anzufassen. Unbekannte Werte werden beim Laden des Modus abgelehnt.
- Bedienung: unumkehrbare Aktion, also Zwei-Tipp-Bestätigung wie sonst im Spiel. Trefferflächen mindestens 44 px.
- Wichtig für die Balance: Aufwertungen stärken vor allem den Ring, weil eine hohe Stufe in der Mitte alle vier Arme abdeckt. Deshalb ist die Sperrzone Pflicht, sobald die Aufwertung aktiv ist. Beide gehören in denselben Modus-Datensatz und werden nur gemeinsam kalibriert.

### B6 Wellen und Stärke

- Wellenregeln aus dem Standardmodus werden **wiederverwendet**, nicht kopiert. Die Studie hat sie aus `tests/tools/wave-rules.mjs` übernommen und dabei zwei Stellvertreter eingeführt:
  - `hpFactor` 0.1 (Wege sind etwa halb so lang, Grundrouten nur etwa 11 Felder; mit den Standard-Werten ist Welle 1 verloren),
  - `powerGrowth` 1.06 je Welle (steht in der Studie für Zusammenführen und Nachschubstufe, die dort fehlen).
- Umsetzung: `balance.enemyHpFactor` im Modus-Datensatz, im Standardmodus 1 (Multiplikation mit 1 ist exakt, Golden-Replay bleibt bitgleich). **`powerGrowth` wird nicht übernommen.** Im echten Spiel gibt es Zusammenführen und Nachschubstufe, die Stärke kommt aus dem Spiel selbst.
- Kolosse (Wellen 35, 45): Die Schneise von 5 Feldern ist auf der kurzen Route relativ größer. Beobachten und im Bericht nennen, nicht vorab ändern.

### B7 Kalibrierung und Abnahme der Spielstärke

- Die bestehenden Bot-Strategien aus M6 müssen den Modus spielen können. Zusätzlich die Strategien der Studie (Ring, Arm, Mix, Ausgewogen) als Heuristik-Vorlage in `tests/tools/`, mit Wartung (Schutt abreißen, wenn der Platz knapp wird) und Aufwertungsrhythmus (alle n Runden).
- Richtwerte aus der Studie (Bots nur Anhaltspunkt): keine Strategie liegt dauerhaft mehr als etwa 8 Wellen vor der besten anderen, der Arm-Bot scheitert um Welle 8 bis 13. Weicht die echte Simulation deutlich ab, wird `enemyHpFactor` und `banRadius` nachgestellt und das Ergebnis protokolliert.
- Ergebnis als Protokoll unter `balancing/` im bestehenden Format. Der Modus bleibt "Experimentell", bis Till ihn nach dem Protokoll freigibt.
- `modeRev` hochzählen, wenn danach Regeln des Modus geändert werden.

### B8 Darstellung (src/render, docs/ART.md)

- Risse als Einschläge in der Randzone mit Beschriftung (Nord, Ost, Süd, West, Text bei Ost und West gedreht), aktiver Riss pulsiert, bei `prefers-reduced-motion` ohne Puls.
- Route des aktiven Risses mit Längenangabe in der Planung, Beschriftungen überdecken Pfeile nicht.
- Sperrzone schraffiert. Bastion mittig, größer als im Standardmodus lesbar.
- Reihenfolge der kommenden Risse (mindestens die nächste Welle) im HUD, Texte deutsch aus `strings.js`.
- 60 fps mit 200 Gegnern auf dem iPad. Die 24x24-Karte braucht wie der Standardmodus Zoom und Schwenken, damit Zellen mindestens 44 px treffbar sind. In der Studie sind Zellen kleiner, das ist dort bekannt und akzeptiert, im Spiel nicht.

### B9 Menü

- Modus-Karte "King of the Hill": Beschreibung (ein Satz), Kennzeichen "Experimentell", kleine Skizze der Geometrie (Bastion in der Mitte, vier Risse, Sperrzone), eigener Bestwert.
- Eigene Bestenliste über Auftrag A (`koth|1|normal`).
- Eine Beschreibung als Vorschlag, bitte sprachlich prüfen: "Die Bastion steht mitten im Feld. Aus vier Rissen am Rand brechen die Gegner im Wechsel hervor. Halte alle vier Wege offen und lang, aber der Kern bleibt frei."

## Tests und Abnahme

1. Golden-Replay des Standardmodus bleibt bitgleich (Auftrag A). `RULESET_VERSION` wird durch diesen Auftrag nicht angehoben, solange der Standardmodus identisch bleibt.
2. **Determinismus:** gleicher Seed und gleiche Konfiguration liefern gleichen Endzustand. Aufgezeichnete Partien im neuen Modus lassen sich ohne Grafik nachspielen und stimmen überein.
3. **Richtungsfolge:** bei `mixed` kommt derselbe Riss nie zweimal hintereinander, jeder Viererblock enthält alle vier Risse, die Folge hängt nur von Seed und Blocknummer ab (Test: andere Würfe dazwischen ändern sie nicht). Bei `cycle` strikt N, O, S, W.
4. **Wegprüfung:** Landung, die einen der vier Risse von der Bastion trennt, wird abgelehnt. Mehrere markierte Landeplätze werden als Menge geprüft.
5. **Sperrzone:** kein Bau, keine Landung, keine Ruine auf geschützten Feldern (Rand: Feld mit Mittelpunkt genau auf Radius 4 gilt als gesperrt).
6. **Aufwertung:** nur ohne markierte Landeplätze, kostet den Leiterpreis, keine Salve, kein Schutt, Welle startet sofort, Rang 4 ist die Obergrenze, zu wenig Nachschub lehnt ab, Zwei-Tipp-Bestätigung.
7. Flieger erreichen die Bastion auf dem geraden Weg aus jedem Riss, kein Gegner verlässt die Karte.
8. Leistung: 200 Gegner, 60 fps auf dem Zielgerät (Messung wie bisher, Hinweis falls nur im Browser auf dem Desktop messbar).
9. Playwright, Tablet-Viewport: eine Partie bis Welle 3 im neuen Modus, Screenshots der Planungsphase aller vier Risse, Aufwertungsdialog, Sperrzone. Keine Konsolenfehler.
10. `docs/GDD.md`, `docs/ART.md`, `docs/PROGRESS.md` nachgezogen. GDD-Abweichungen nennen und begründen, nicht still ändern.

## Offene Punkte (nicht Teil des Auftrags, bitte im Bericht erwähnen)

- Wirkung der Schneise der Kolosse auf der kurzen Route.
- Ob die Aufwertung später an den Modus oder an die Schwierigkeit gekoppelt wird.
- Nachlauf: GDD Abschnitt 9 und `wave-rules.mjs` widersprechen sich beim Mittelband (siehe Auftrag A, Hinweis).

## Überschneidungen mit offenen Aufträgen

- **Auftrag A:** Voraussetzung. Beide ändern `src/core/state.js`.
- **M6 Runde 4:** berührt Wellenregeln in `src/data` und vermutlich `RULESET_VERSION`. B hängt sich nur über `balance.enemyHpFactor` in die Wellen ein. Reihenfolge entscheidet Till.
- Namen von Dateien und Funktionen stammen teils aus einer Lektüre der Quellen im Chat. Vor dem Umbau gegen den Ist-Stand prüfen, bei Abweichung gilt der Code und die Abweichung kommt in `docs/PROGRESS.md`.
