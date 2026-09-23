# M4b: Designanpassungen aus Spieltest 1

## Ziel
Die späte Partie wieder interessant machen und das Abreißen bedienbar. Grundlage ist `docs/GDD-update-v2.md`.

## Vorarbeit
Die Abschnitte aus `docs/GDD-update-v2.md` in `docs/GDD.md` übernehmen (gleichnamige Abschnitte ersetzen, Abschnitt 14 ergänzen). Danach ist das GDD wieder die einzige Quelle, `GDD-update-v2.md` kann gelöscht werden.

## Umfang
1. **Zwei Signalfeuer** statt vier, mit den Platzierungsregeln aus Abschnitt 4. Kartengenerator und Wegkette anpassen, Unit-Tests für die Abstandsregeln und die Wegprüfung erweitern.
2. **Salvengröße nach Welle** (6 / 5 / 4) samt Mindestrang Veteran ab Welle 36. Werte als Tabelle in `src/data/`, nicht im Code. Die Anzahl in der Planungsphase anzeigen.
3. **Sanfterer Einstieg**: Wellen 1 bis 5 mit 30 Prozent weniger Gegnern, Brecher ab Welle 4, Flieger ab Welle 6.
4. **Abbruchmodus** nach Abschnitt 13, inklusive Abreißen eigener Stellungen mit dem dreifachen Preis und Wegprüfung vor jedem Abriss.
5. **Beschriftung der Nachschubstufe** nach Abschnitt 13, mit Rangchancen und Erklärung.

## Nicht im Umfang
Die Aufwertungsoption aus Abschnitt 14. Die wird erst nach dem nächsten Spieltest entschieden.

## Hinweise
- Ein kürzerer Grundweg bedeutet zu Beginn weniger Beschuss und damit weniger Requisition. Bitte nach der Umsetzung eine Partie mit dem Debug-Panel bis etwa Welle 15 durchspielen und melden, ob Leben und Requisition in einem plausiblen Rahmen bleiben. Balancing-Werte nicht eigenmächtig ändern, sondern Beobachtungen berichten.
- Bestehende Bestwerte und Seeds sind nach dieser Änderung nicht mehr vergleichbar. In `docs/PROGRESS.md` vermerken und beim Speichern der Bestwerte eine Regelversion mitschreiben, damit alte und neue Partien getrennt bleiben.

## Abnahme
- Der Grundweg einer frischen Karte ist deutlich kürzer als bisher und lässt sich über viele Wellen hinweg weiter verlängern.
- Salvengröße und Mindestrang ändern sich an den festgelegten Wellen.
- Im Abbruchmodus lassen sich mehrere Felder zügig räumen, auch per Touch, und ein wegblockierender Abriss wird abgelehnt.
- Der Nachschub-Knopf erklärt sich selbst.
- Alle Unit-Tests grün.
