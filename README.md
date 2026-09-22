# Nachschubfront

Grimdark-Tower-Defense mit Labyrinthbau (Vorbild Gem TD) im isometrischen Comicstil. Ein Browser-Spiel für Desktop und Tablet, reines JavaScript ohne Build-Schritt.

- Spielregeln: [docs/GDD.md](docs/GDD.md)
- Stand: [docs/PROGRESS.md](docs/PROGRESS.md)
- Stilreferenz: [reference/stiltest.html](reference/stiltest.html)

## Lokal starten

ES-Module brauchen HTTP, `file://` funktioniert nicht.

```bash
python3 -m http.server 8000
```

Danach <http://localhost:8000> öffnen. Mit <http://localhost:8000/?debug> erscheinen fps und Simulationsschritte.

## Entwicklung

Das Spiel selbst hat keine Abhängigkeiten. Nur die Werkzeuge brauchen Node (ab Version 22) und Playwright:

```bash
npm install
npx playwright install chromium
```

| Befehl | Zweck |
|---|---|
| `npm test` | Unit-Tests (`node:test`) |
| `npm run screenshots` | Screenshots Desktop 1440 × 900 und Tablet 1180 × 820 mit Touch nach `tests/output/`, bricht bei Konsolenfehlern ab |
| `npm run screenshots -- --query debug` | wie oben, mit Debug-Anzeige |
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
