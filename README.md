# Nachschubfront

Grimdark-Tower-Defense mit Labyrinthbau (Vorbild Gem TD) im isometrischen Comicstil. Ein Browser-Spiel für Desktop und Tablet, reines JavaScript ohne Build-Schritt.

- Spielregeln: [docs/GDD.md](docs/GDD.md)
- Stand: [docs/PROGRESS.md](docs/PROGRESS.md)
- Stilreferenz: [reference/stiltest.html](reference/stiltest.html)
- Speicherformat, Export und Offline-Betrieb: [docs/SPEICHER.md](docs/SPEICHER.md)

## Lokal starten

ES-Module brauchen HTTP, `file://` funktioniert nicht.

```bash
python3 -m http.server 8000
```

Danach <http://localhost:8000> öffnen.

- `?seed=ABC123` lädt eine bestimmte Karte (gleicher Seed, gleiche Karte).
- `?debug` zeigt fps, Rechenzeit pro Frame und Gegnerzahl. Dazu kommen drei Knöpfe:
  - „Hindernis-Modus“: Tippen setzt oder entfernt dann Trümmer.
  - „Grafik: Sprites/Platzhalter“: schaltet zwischen den Konzeptgrafiken und den einfachen Formen aus M1 um.
  - „Belastungstest“: 200 Gegner laufen in einer Schleife über die Route.
- `?art=placeholder` startet mit den einfachen Formen.
- Sprite-Galerie: `tests/sprites.html` zeigt alle Stellungen in allen Rängen und alle Gegner in beiden Blickrichtungen, mit Zoomstufen und Treffer-Variante (auch auf GitHub Pages unter `/nachschubfront/tests/sprites.html`).

## Bedienung (Stand M1)

| Aktion | Maus und Tastatur | Touch |
|---|---|---|
| Karte verschieben | Ziehen (links, rechts oder mittlere Taste), Pfeiltasten | Mit einem Finger ziehen |
| Zoomen | Mausrad, Trackpad-Pinch, `+` und `-` | Zwei Finger |
| Feld wählen | Mauszeiger darüber, Klick | Tippen |
| Welle starten | Knopf oder Enter | Knopf |
| Pause, Geschwindigkeit | Leertaste, `1`, `2`, `3` | Knöpfe unten |
| Debug-Hindernis setzen oder entfernen | `H` über dem Feld | Hindernis-Modus, dann tippen |
| Debug: Sprites oder Platzhalter | `G` | Knopf „Grafik“ |

## Entwicklung

Das Spiel selbst hat keine Abhängigkeiten. Nur die Werkzeuge brauchen Node (ab Version 22) und Playwright:

```bash
npm install
npx playwright install chromium webkit
```

Alle Browser-Skripte laufen standardmäßig in Chromium. Mit `-- --browser webkit` laufen sie in WebKit, der Engine von Safari. Das ist der nächste automatisierte Ersatz für das iPad.

| Befehl | Zweck |
|---|---|
| `npm test` | Unit-Tests (`node:test`) |
| `npm run screenshots` | Screenshots Desktop 1440 × 900 und Tablet 1180 × 820 mit Touch nach `tests/output/`, bricht bei Konsolenfehlern ab |
| `npm run screenshots -- --query debug` | wie oben, mit Debug-Anzeige |
| `npm run test:input` | Eingabetests im Browser: Touch (Wischen, Tippen, Pinch), Maus, Tastatur, eine Welle auf 3x, Niederlage, Sprite-Galerie |
| `npm run test:perf` | Belastungstest mit 200 Gegnern bei Start- und Maximalzoom, Desktop und Tablet: prüft 60 fps (nur mit echter GPU) und dass im Betrieb kein SVG gerastert wird |
| `npm run test:webkit` | Eingabetests, Screenshots und Leistungsmessung in WebKit |
| `npm run sprites` | Konzeptgrafiken aus `reference/konzept/` neu nach `src/render/sprites/` übernehmen (nach jeder Änderung an den SVGs) |
| `npm run icons` | Platzhalter-Icons neu erzeugen |
| `npm run serve` | lokaler Server auf Port 8000 |

## Veröffentlichen auf GitHub Pages

Das Repository wird so ausgeliefert, wie es ist. `.nojekyll` sorgt dafür, dass GitHub Pages die Dateien nicht umbaut.

1. Das Repository muss öffentlich sein (oder ein kostenpflichtiges GitHub-Konto haben).
2. Auf GitHub unter **Settings → Pages** bei **Build and deployment** die Quelle **Deploy from a branch** wählen.
3. Branch **main** und Ordner **/ (root)** einstellen, dann **Save**.
4. Nach ein bis zwei Minuten ist das Spiel unter `https://<benutzer>.github.io/nachschubfront/` erreichbar. Jeder Push auf `main` veröffentlicht neu.

Alle Pfade im Spiel sind relativ, damit es im Unterordner `/nachschubfront/` läuft.

## Schriften

Pirata One, Barlow Condensed und Bangers liegen als woff2 unter `assets/fonts/` (SIL Open Font License, Lizenztexte daneben). Sie werden lokal ausgeliefert, damit das Spiel offline läuft und keine Anfragen an Google gehen.

## Grafik

Stellungen und Gegner stammen aus den Konzept-SVGs in `reference/konzept/`, Regeln in `docs/ART.md`. `npm run sprites` übernimmt sie als Module nach `src/render/sprites/`. Die erzeugten Dateien nicht von Hand ändern. Im Spiel werden die SVGs einmal pro Zoomstufe in Offscreen-Canvas gerastert und danach nur noch als Bild gezeichnet.
