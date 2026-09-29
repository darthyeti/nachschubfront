# Balancing (M6)

Hier liegen die Daten, mit denen die Werte des Spiels abgestimmt werden. Der
Arbeitsauftrag steht in `docs/meilensteine/M6-balancing.md`.

## `protokolle/`

Aufgezeichnete Partien, wie das Spiel sie ausgibt: **Pausenmenü oder
Ende-Bildschirm → „Partie exportieren"**. Die Datei heißt schon so, wie sie
heißen soll (`nachschubfront-JAHR-MONAT-TAG-SEED-welleN.json`), sie muss nur
hier abgelegt werden.

Auch abgebrochene Partien sind wertvoll. Eine Partie, die nach acht Wellen
aufhört, sagt über die ersten acht Wellen genauso viel wie eine ganze.

Was in einer Datei steht: Seed, Regelversion, jede Aktion mit dem
Simulationsschritt, auf dem sie lag, eine Zeile pro Welle (Gegner, Abschüsse,
Durchbrüche, Leben, Requisition, Routenlänge) und die Bewertungen aus der Zeile
nach jeder Welle. Keine personenbezogenen Daten, kein Zeitstempel außer dem Tag
des Exports.

**`"tainted"` in der Datei** listet die Debug-Hebel, die in dieser Partie
benutzt wurden (Welle anspringen, Requisition geben, Unverwundbar und so
weiter). Eine Partie mit Einträgen darin lässt sich weiter nachspielen, taugt
aber nicht als Messung — eine Bastion, die nicht bluten kann, sagt nichts über
die Schwierigkeit.

## Nachspielen

Ein Protokoll lässt sich ohne Grafik wieder abspielen:

```
npm run replay -- balancing/protokolle/<datei>.json
```

Das gibt eine Zeile je Welle aus (Gegner, Abschüsse, Durchbrüche, Leben,
Lebenspunkte der Welle, Schaden der Stellungen, Schaden der Kommandos,
verschwendeter Schaden, Routenlänge, Requisition, Kommandopunkte, Stellungen
nach Rang, Bewertung) und prüft am Ende, dass dasselbe herauskommt wie in der
gespielten Partie. Kommt es nicht dasselbe heraus, ist das ein Fehler und der
Lauf endet mit einem Fehlercode.

Mit geänderten Werten:

```
npm run replay -- <protokoll>.json --data <aenderungen>.json --csv <auswertung>.csv
```

Die Änderungsdatei sieht aus wie die Tabellen, die sie ändert:

```json
{
  "enemies": { "warrior": { "health": 90 } },
  "waves": { "healthGrowth": 1.08 },
  "ranks": { "4": { "damage": 24 } }
}
```

Listen (`ranks`, `supply`, `salvo`, `commands`) werden über den **Index ab null**
angesprochen: Nachschubstufe 8 ist `"7"`, der Rang Legende ist `"4"`. Das
Werkzeug ändert nur Werte — eine Zeile hinzufügen lehnt es ab und sagt, warum
(mehrere abgeleitete Konstanten entstehen beim Start und würden eine neue Zeile
nicht bemerken). Eine Aktion, die unter den neuen Werten nicht mehr geht, wird
übersprungen und benannt; der Lauf bricht nicht ab.

Zum Entwickeln gibt es auch Protokolle vom Bot:

```
npm run playmatch -- BASTION --protocol balancing/protokolle/bot-BASTION.json
```

Ein Bot setzt seine Zonen nach einer Regel und ist damit **keine Messung** — für
das Werkzeug ist es aber eine echte Partie.

## Bots, Eichung, Kraftkurve

```
npm run bots                                   20 Seeds, alle Strategien
npm run bots -- --seeds 200 --strategy refine   viele Seeds, eine Strategie
npm run calibrate                              Bots gegen deine Protokolle
npm run powercurve                             Kraftkurve als Tabelle und HTML
```

**`npm run bots`** spielt viele Seeds mit einer Strategie und gibt Überlebensquote,
Wellen, Durchbruchswellen und verschwendeten Schaden aus. Fünf Strategien:
`maze` (verlängert die Route maximal), `firepower` (kompakte Todeszone),
`recipes` (sammelt Zutaten), `refine` (mäßiges Labyrinth, dafür hohe Ränge) und
`simple` (der Bot von vor M6, als Vergleichsmaß). Die Seeds kommen aus einem
festen Zufallsstrom, zwei Läufe vergleichen also dieselben Karten.

**`npm run calibrate`** stellt jede Strategie neben eine von Hand gespielte
Partie auf demselben Seed und nennt den Abstand. Das ist der Punkt, an dem
Bot-Zahlen überhaupt etwas bedeuten: Ohne Eichung sind sie Richtwerte.

**Ein Protokoll gilt nur, solange es sich nachspielen lässt.** Ändert sich eine
Regel, ergibt dieselbe Aufzeichnung eine andere Partie — am 28.09.2026 wurde aus
einem Sieg in Welle 50 eine Niederlage in Welle 35, und `calibrate` nahm diese
Niederlage als Maßstab. `calibrate` und `powercurve` prüfen deshalb vor jeder
Verwendung nach (`tests/tools/reference.mjs`) und überspringen das Protokoll,
wenn das Nachspielen die Partie nicht mehr ergibt. Steht in der Meldung eine
andere Version als die laufende, hat sich sehr wahrscheinlich eine Regel
geändert; steht dieselbe, ist die Simulation nicht mehr deterministisch — das
ist dann ein Fehler im Spiel.

**`npm run powercurve`** rechnet ohne Kampf, was jede Welle mitbringt und was
die Stellungen liefern können, und schreibt ein Diagramm nach
`balancing/runden/kraftkurve.html`. Liegt ein Protokoll vor, prüft das Werkzeug
sein eigenes Modell daran und sagt, wie weit es daneben liegt.

Mit `--data <aenderungen>.json` rechnet es die Kurve **unter vorgeschlagenen
Werten**, in derselben Schreibweise wie beim Nachspielen. Jede Abstimmungsrunde
beginnt damit: Interessant ist nicht die Kurve der Werte, die schon dastehen,
sondern die des Vorschlags.

```
npm run powercurve -- --data balancing/runden/runde-2/vorschlag.json
```

## Testeinstieg

Im Spiel, nur mit `?debug`: **Hauptmenü → Testeinstieg**. Ein Protokoll wählen —
eines aus diesem Browser oder eine Datei von hier aus `protokolle/` — und Welle
10, 20, 30 oder 35 antippen. Die Partie wird bis zur Welle davor nachgespielt und
übergeben; die gewählte Welle steht dann noch bevor, „ab Welle 35" heißt also, den
Koloss selbst zu spielen.

Das Nachspielen dauert ein paar Sekunden (beim ersten Mal auf einem Gerät
länger), eine Zeile im Menü sagt das solange. Die Partie ist danach als
`testEntry` gefärbt: sie taucht in keiner Messung auf, auch wenn sie exportiert
wird. Ein Protokoll plus Wellennummer ist der ganze Spielstand — es gibt hierfür
keine Speicherdatei.

## `runden/`

Eine Auswertung je Abstimmungsrunde (`runde-1.md`, `runde-2.md`, …): was
geändert wurde, warum, die Kurven vorher und nachher, und die Bewertungen aus
den Protokollen.

Erzeugte CSV- und HTML-Dateien in `runden/` bleiben aus dem Repository heraus
(`.gitignore`); sie sind in Sekunden wieder da. Was bleibt, sind die
Auswertungen `runde-N.md`.
