# GDD-Update v2 (nach dem ersten Spieltest)

Anlass: Im späten Spiel wird die Wahl der Landezonen eintönig. Der Weg ist ab etwa Welle 30 nicht mehr beeinflussbar, weil die Karte voll ist und vier Signalfeuer den Weg ohnehin vorgeben. Außerdem ist das Abreißen von Trümmern umständlich.

Die folgenden Abschnitte ersetzen die gleichnamigen Abschnitte in `GDD.md`.

## 3. Spielablauf (geändert: Salvengröße)

Unverändert bis auf die Anzahl der Kapseln pro Salve. Statt immer fünf gilt:

| Wellen | Kapseln pro Salve | Mindestrang |
|---|---|---|
| 1 bis 15 | 6 | keiner |
| 16 bis 35 | 5 | keiner |
| ab 36 | 4 | Veteran (kein Rekrut mehr) |

Begründung: Früh entsteht das Labyrinth schneller und die Karte füllt sich dort, wo noch Platz ist. Spät entstehen weniger neue Trümmer, dafür ist jede einzelne Kapsel wertvoller. Die Anzahl wird in der Planungsphase angezeigt.

## 4. Karte (geändert: zwei Signalfeuer)

- Größe 24 x 24 Felder, Kamera mit Zoom und Verschieben.
- Jede Partie wird aus einem Seed erzeugt, der angezeigt und eingegeben werden kann.
- Fest platziert: Warp-Riss an einer Kante, Bastion an der gegenüberliegenden Kante und **zwei** Signalfeuer statt bisher vier.
- Platzierungsregel für die Signalfeuer: je eines in einer anderen Kartenhälfte, Mindestabstand 10 Felder zueinander und je 8 Felder zu Riss und Bastion. Ziel ist ein kurzer, offener Grundweg, den der Spieler selbst verlängern muss.
- Zufällig: 12 bis 20 Ruinen, Krater und Mauerreste. Der Generator stellt sicher, dass der Weg über beide Signalfeuer möglich ist.
- Geschützte Felder: Riss, Signalfeuer, Bastion und jeweils ihr direktes Umfeld (1 Feld).

## 9. Gegner (Ergänzung: sanfterer Einstieg)

Weil der Grundweg mit zwei Signalfeuern kürzer ist, sind die ersten Wellen entschärft:

- Wellen 1 bis 5: Gegneranzahl minus 30 Prozent.
- Panzergegner (Brecher) erst ab Welle 4, Flieger erst ab Welle 6.

Alles Übrige bleibt unverändert.

## 10. Wirtschaft (geändert: Abreißen)

- Requisition wie bisher pro Abschuss und als Wellenbonus.
- Abreißen gilt jetzt für Trümmer **und** eigene Stellungen, damit späte Karten umgebaut werden können. Trümmer kosten 15, jedes weitere Abreißen in derselben Partie 5 mehr. Eine Stellung kostet das Dreifache des aktuellen Trümmerpreises und gibt nichts zurück.
- Abgerissen wird nur in der Planungsphase. Der Weg muss danach offen bleiben, sonst wird abgelehnt.
- Kommandopunkte unverändert.

## 13. Bedienung (Ergänzung: Abbruchmodus und Nachschubanzeige)

**Abbruchmodus.** Eigener Knopf in der Planungsphase. Ist er aktiv, werden alle abreißbaren Felder hervorgehoben und der Preis steht am jeweiligen Feld. Antippen reißt ab, auf dem Tablet mit kurzer Bestätigung. Der Modus bleibt aktiv, bis er beendet wird, damit mehrere Felder nacheinander geräumt werden können. Solange er aktiv ist, können keine Landezonen markiert werden.

**Nachschubstufe.** Der Knopf heißt nicht mehr "Nachschub ausbauen", sondern nennt Stufe und Preis, zum Beispiel "Nachschubstufe 3 auf 4, 80". Darunter stehen die neuen Rangchancen als Zeile (zum Beispiel 40 / 40 / 20 / 0 / 0) oder als kleine Balken, jeweils in den Rangfarben. Langes Drücken oder Hover zeigt eine kurze Erklärung: Die Stufe beeinflusst nur künftige Kapseln, nicht bestehende Stellungen.

## 14. Offene Punkte (Ergänzung)

- **Aufwertung statt Bau (vorgemerkt, noch nicht umsetzen).** Ab etwa Welle 30 könnte eine vierte Option in der Auswahlphase erscheinen: Eine Kapsel wird nicht gebaut, sondern auf eine bestehende Stellung derselben Doktrin gelegt und hebt sie um einen Rang. Das verlagert die späte Partie vom Bauen zum Veredeln, ohne weitere Felder zu belegen. Entscheidung erst nach dem nächsten Spieltest.
