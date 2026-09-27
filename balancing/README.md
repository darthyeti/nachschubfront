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

## `runden/`

Eine Auswertung je Abstimmungsrunde (`runde-1.md`, `runde-2.md`, …): was
geändert wurde, warum, die Kurven vorher und nachher, und die Bewertungen aus
den Protokollen.
