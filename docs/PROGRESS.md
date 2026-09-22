# Fortschritt

## Aktueller Meilenstein
M1: Spielkern (M0 abgeschlossen am 22.09.2026)

## Erledigt
- Game-Design-Grundlagen (docs/GDD.md)
- Stiltest (reference/stiltest.html)
- M0 Projektgerüst, abgenommen am 22.09.2026. Läuft unter https://darthyeti.github.io/nachschubfront/ ohne Konsolenfehler, geprüft mit Playwright am Desktop und auf dem Tablet mit Touch.
  - Ordnerstruktur laut CLAUDE.md, `index.html` mit Canvas und HUD-Container
  - Spielschleife: fester Zeitschritt 1/60 s (`src/core/loop.js`), Geschwindigkeit 0 bis 3, höchstens 12 Schritte pro Frame, Rendering per requestAnimationFrame
  - Canvas im Vollbild, folgt Größenänderung, Drehen und DPR (höchstens 2), HUD mit Safe-Area-Abständen
  - Geseedeter Zufallsgenerator (`src/core/random.js`, mulberry32) mit Text-Seeds und unabhängigen Zweigen (`fork`)
  - Zentrale Texte in `src/data/strings.js`, technische Konstanten in `src/data/settings.js`
  - Asynchrone Speicherschicht (`src/storage/`) mit get, set, remove, Präfix `nachschubfront:` und Ersatz im Arbeitsspeicher
  - PWA-Manifest (Vollbild, Querformat) mit Platzhalter-Icons, auch maskable und apple-touch-icon
  - Schriften lokal als woff2
  - Werkzeuge: `npm test` (24 Unit-Tests für Zufall, Schleife, Speicher), `npm run screenshots` (Desktop und Tablet mit Touch, bricht bei Konsolenfehlern ab)
  - README mit Anleitung für GitHub Pages

## Offen
- Test auf einem echten iPad: Vollbild, Drehen, Seite lässt sich nicht zoomen oder scrollen, Installation als PWA über „Zum Home-Bildschirm“.
- M1 Spielkern: Plan vorlegen.

## Bekannte Probleme
- Keine bekannt.
- Hinweis: iPadOS ignoriert `display: fullscreen` im Manifest und nutzt `standalone`, die Statusleiste bleibt also sichtbar. Das Spiel legt sich per `viewport-fit=cover` und `black-translucent` darunter.

## Entscheidungen
- Plattform: Desktop und Tablet gleichwertig, Tablet ist der Haupteinsatz.
- Hosting: GitHub Pages, PWA. Speichern lokal, Speicherschicht für spätere Online-Bestenliste vorbereitet.
- Kapseln nur in der Planungsphase. Spezialkommandos auch während der Welle.
- Fortschritt über mehrere Partien: vertagt bis nach den ersten Tests.
- Schriften werden selbst ausgeliefert statt über Google Fonts (offline-fähig, Datenschutz).
- Zufallsgenerator mulberry32. Seeds dürfen Text sein (FNV-1a-Hash). Karte und Kapseln bekommen später eigene Zweige über `fork('map')` und `fork('pods')`, damit sie sich nicht gegenseitig verschieben. Ein Test hält die Zahlenfolge fest, damit geteilte Seeds über Versionen gleich bleiben.
- Nach einer langen Unterbrechung (Hintergrund-Tab) holt die Simulation nicht auf, sondern verwirft den Rückstand.
- Die Speicherschicht speichert JSON. `set` meldet mit `false`, wenn nicht dauerhaft gespeichert werden konnte (z. B. im privaten Modus).
- Das Screenshot-Skript startet einen eigenen kleinen Node-Server, damit es ohne laufenden Python-Server und später auch in CI funktioniert.
