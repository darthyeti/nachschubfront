# M4c: Neue Kapselform

## Ziel
Die Nachschubkapsel bekommt die facettierte Kegelstumpfform aus `docs/ART-kapsel.md`.

## Umfang
- `docs/ART-kapsel.md` in `docs/ART.md` einarbeiten (eigener Abschnitt "Nachschubkapsel"), danach kann die Einzeldatei gelöscht werden.
- SVGs nach `src/render/sprites/` übernehmen und über die bestehende Rasterizer-Pipeline aus M1b einbinden.
- Bisherige Kapselgrafik ersetzen, geschlossen wie geöffnet. Die vier Segmente müssen einzeln ansteuerbar bleiben, damit sie wie bisher nacheinander aufklappen.
- Geöffnete Darstellung um etwa 15 Prozent verkleinern, damit Nachbarfelder frei bleiben.
- Prüfen, dass die Kapsel im geschlossenen Zustand nicht mit einer Stellung verwechselbar ist, auch auf der kleinsten Zoomstufe.

## Nicht im Umfang
Der Ablauf der Sequenz und alle Effekte. Die bleiben unverändert.

## Abnahme
- Kapsel entspricht den Skizzen, auf Desktop und Tablet scharf.
- Aufklappen funktioniert wie bisher, Leistungsziel unverändert erreicht.
