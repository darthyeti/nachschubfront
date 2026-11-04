# M10: Bedienung

Status: **Entwurf, wartet auf Freigabe** (Akte E-23). Beschlossen am 04.11.2026 in E-21 (Wahl „Mergen, M10 mit Änderungen“). Läuft nach oder parallel zu M9; M9 ist Grafik, M10 ist Oberfläche, die Bereiche überschneiden sich nur in `src/data/strings.js` und `docs/ART.md`.
Referenz: `reference/studien/handy-bedienung.html` mit `handy-bedienung.js`, Standbilder und Messwerte in `reference/konzept/handy/` (Auftrag A-23, PR #40). Werkzeuge `tests/tools/handy-bestand.mjs` und `handy-studie.mjs`.

## Entscheidungen vom 04.11.2026 (E-21)

- **Für alle Geräte, nicht nur fürs Handy.** Der neue Ikonensatz, die neue Menüstruktur und das Tutorial gelten auch am PC und auf dem iPad. Das Handy-Layout (schmale Leiste, Blätter, Daumenbereich) kommt dazu, wo der Platz knapp ist.
- **Kommandopunkte und Kommando-Knöpfe gehören dazu.** Die Studie hat sie im Ikonensatz (Blitz im Sechseck für Kommandopunkte, neue Zeichen für Stasisfeld und Priorisierten Nachschub, Orbitalschlag, Heiliges Banner und Luftschlag bleiben).
- **Freischalten mit Knall.** Wenn Kommandopunkte oder ein Kommando freigeschaltet werden und ihre Ikone erscheint, geschieht das mit einem deutlich sichtbaren Effekt: Aufblitzen, Druckwelle, kurzes Nachleuchten, dazu ein Ton. Bei `prefers-reduced-motion` gedämpft, ohne Wackeln.
- **Empfehlungen des Leitstands, die Till mit der Wahl angenommen hat:** Pause bekommt einen eigenen Knopf neben dem Tempo (Pause muss mitten in einer Welle sofort erreichbar sein). Im Querformat gibt es eine Einstellung „Linkshänder“, die Werkzeuge und Salve spiegelt. Im Tutorial kauft der Spieler in Runde 2 einmal Nachschub.
- **Die Simulation wird nicht angefasst.** Keine Zahl in `src/data` ändert sich, `RULESET_VERSION` und `tests/unit/golden.json` bleiben, jedes Protokoll spielt sich unverändert nach. Das Tutorial liest Ereignisse und Zustand, es greift nicht in die Simulation ein.

## Befund (aus der Studie)

- Hochformat: Die Statusleiste ist 501 px breit, das Handy 360 bis 430 px. Rezepte und Menü liegen außerhalb des Bildes, das Pausenmenü ist per Touch nicht erreichbar. „Leben“ liegt unter „Nachschub“, der Hilfeknopf über der unteren Leiste.
- Querformat: Bei der Kapselwahl bleibt ein freies Rechteck von 9 bis 21 Prozent der Fläche.
- Die Hilfe-Blasen verdecken einander auf allen Handy-Größen.
- Trefferflächen sind überall mindestens 44 px; das Problem ist Fläche und Überlauf.

## Berührte Bereiche und Dateien

| Bereich | Dateien | Art der Änderung |
| --- | --- | --- |
| UI | `src/ui/style.css`, `hud.js`, `menu.js`, `controls.js`, `commands.js`, `runeButton.js`, `selection.js`, `info.js`, `help.js`, `codex.js`, `records.js`, `icons.js`, neu `tutorial.js` | Layout, Blätter, Ikonen, Tutorial, Freischalt-Effekt |
| Render | `src/main.js`, `src/render/camera.js` | Einzug der Kamera, wenn ein Blatt offen ist |
| Daten | `src/data/strings.js` | Beschriftungen und Tutorialtexte |
| Speicher | `src/storage/` | Merker `tutorialSeen` und `leftHanded` in den Einstellungen, `docs/SPEICHER.md` |
| Ton | wo die Töne heute liegen | Ton zum Freischalten |
| Werkzeuge | `tests/input.mjs` (oder das Skript hinter `test:input`), neu eine Handy-Prüfung, `tests/screenshots.mjs` | drei Handy-Größen hoch und quer, Tablet unverändert |
| Dokumentation | `docs/ART.md` (HUD, Ikonen), `docs/GDD.md` Abschnitt 13 (Bedienung) nur wo sich Gesten oder Knöpfe ändern, `docs/PROGRESS.md` | siehe unten |

Geteilte Quellen, die dieser Auftrag ändert: **src/data/strings.js**, **docs/ART.md**, **docs/SPEICHER.md**, **docs/GDD.md** (Abschnitt 13). Nicht geändert werden **src/sim**, **src/core** und die Balancing-Zahlen.

## Verbindlich und nicht verbindlich in der Studie

Verbindlich: die Gliederung der Statusleiste (vier Werte plus Menü), die Blätter statt Fenster, der Daumenbereich, der Ikonensatz mit seinen Bedeutungen, die Schritte des Tutorials.
Nicht verbindlich: der Zeichencode der Studie, ihre Platzhalter-Spielfelder, die genauen Pixelmaße (sie folgen dem echten HUD), der Tempo-Knopf ohne Pause (siehe Entscheidungen).

## Anforderungen

### E1 Ikonen und Menüstruktur (alle Geräte)

- Neuer Ikonensatz in `src/ui/icons.js` nach der Studie, Tuschestil, Beschriftung unter der Scheibe, wo Platz ist. Gilt für PC, Tablet und Handy.
- Menüstruktur: Rezepte ins Menü und ins Kapselblatt; Hilfe als Symbolblatt statt Sprechblasen; Pause als eigener Knopf neben dem Tempo-Knopf (1x, 2x, 3x reihum).
- Freischalt-Effekt für Kommandopunkte und jedes Kommando: Die Ikone erscheint mit Aufblitzen, Druckwelle und kurzem Nachleuchten, dazu ein Ton. Erkannt wird das Freischalten am Zustand (Welle erreicht `fromWave`), nicht über eine Meldung der Simulation. Bei reduzierter Bewegung gedämpft.
- Tablet 1180 x 820 und Desktop: Standbilder vorher und nachher, Trefferflächen mindestens 44 px, `test:input` grün.

### E2 Layout fürs Handy

- Media-Abfragen für schmale oder niedrige Bildschirme mit Touch (etwa `max-width` 600 px oder `max-height` 500 px). Tablet- und Desktop-Regeln bleiben, wie sie nach E1 sind.
- Statusleiste schmal und einklappbar, Menü immer erreichbar, auch bei 360 px.
- Werkzeuge und Salve im Daumenbereich unten, quer an den Rändern; Einstellung „Linkshänder“ spiegelt sie.
- Menüs, Kapselwahl, Stellungs-Infos, Symbolblatt und Rezepte als Blätter: hoch von unten, quer von rechts. Die Kamera bekommt einen Einzug, solange ein Blatt offen ist, damit Kapseln und Zielfeld nicht darunter liegen.
- Safe-Area (`env(safe-area-inset-*)`) überall.

### E3 Tutorial (alle Geräte)

- Neues Modul `src/ui/tutorial.js`: geführte Anleitung über die ersten zwei Runden nach der Studie, ein hervorgehobenes Element je Schritt, Tipp außerhalb wird gesperrt, jederzeit überspringbar.
- In Runde 2 kauft der Spieler einmal Nachschub.
- Startet beim ersten Spiel je Gerät, Merker `tutorialSeen` in den Einstellungen über `src/storage/`, Wiederholen unter „Hinweise“.
- Liest nur Zustand und Ereignisse (Zone gewählt, Salve, Auswahl, Kauf), verändert die Simulation nicht. Eine Partie mit Tutorial spielt sich als Protokoll genauso nach wie ohne.
- Texte in `src/data/strings.js`, kurz und im Ton des Spiels.

## Abnahme

- `npm test`, `test:input` in Chromium und WebKit, `test:offline`.
- Neue Handy-Prüfung auf drei Größen (390 x 844, 360 x 780, 430 x 932) hoch und quer: Menü erreichbar, nichts außerhalb des Bildes, alle Trefferflächen mindestens 44 px, größtes freies Rechteck bei der Kapselwahl über 40 Prozent.
- Tablet 1180 x 820: Bedienung unverändert erreichbar, Standbilder vorher und nachher.
- Unit-Test für die Schrittfolge des Tutorials, Browser-Test mit allen Schritten.
- Till prüft auf einem echten Handy und auf dem iPad (Aussparung, Daumen, Tutorial, Freischalt-Effekt).
- Jeder Schritt ein eigener Pull Request mit Vorschau (`spielgefuehl`), gemergt nach Tills Blick.

## Dokumentation

- ART.md: Abschnitt HUD und Ikonen auf den neuen Satz, Freischalt-Effekt.
- SPEICHER.md: die zwei neuen Einstellungen.
- PROGRESS.md: nur der Stand.
