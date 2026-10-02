# M7a: Modus-Gerüst

Status: **freigegeben am 02.10.2026**, läuft parallel zu M6. Autor: Chat (Entwurf), Till (Abnahme).
Nachfolger: [`M7b-king-of-the-hill.md`](M7b-king-of-the-hill.md) (Auftrag B) setzt auf diesem Auftrag auf.

## Entscheidungen vom 02.10.2026

- **Parallel zu M6.** Umsetzung auf einem eigenen Zweig (`modi`), schnell nach `main` zusammenführen, weil sichtbar nichts geändert wird.
- **Golden-Test vorab auf `main`** (`tests/unit/golden.test.js`): ein Hash über eine feste Bot-Partie und die Protokolle aus `balancing/protokolle/`, die sich unter den heutigen Regeln noch nachspielen lassen. Kein Protokoll ist mehr Maßstab für das Balancing, für die Bitgleichheit taugen sie trotzdem. Der Hash wird nur in einem Commit erneuert, der `RULESET_VERSION` anhebt oder es ausdrücklich sagt.
- **Regeln, in denen sich Modi unterscheiden, sind Tabellen von Varianten**, nicht Verzweigungen nach dem Modus. Schon in diesem Auftrag bekommt die Aufwertung ihren Eintrag `upgrade.kind: 'pod'` (die heutige Regel aus GDD Abschnitt 11), ohne Verhaltensänderung. M7b ergänzt `'ladder'`.

## Berührte Bereiche und Dateien

| Bereich | Dateien | Art der Änderung |
| --- | --- | --- |
| Daten | `src/data/modes.js` (neu) | Registry für Modi und Schwierigkeiten |
| Core (geteilt) | `src/core/state.js` | `createGameState(seed, config)`, neue Felder `mode`, `difficulty` |
| Sim | `src/sim/record.js` | Protokollkopf um drei Felder erweitert |
| Speicher | `src/storage/*` (Profil, Einstellungen, Protokoll) | Profilformat 2 mit Migration, `lastRun` in den Einstellungen |
| UI | `src/ui/*` (Menüs) | Modus-Bildschirm, Modusname im Ergebnis und in der Bestenliste |
| Start | `src/main.js` | `newGame(seed, config)`, `onStart(config)` |
| Dokumentation | `docs/GDD.md`, `docs/SPEICHER.md`, `docs/PROGRESS.md` | siehe unten |

Geteilte Quellen, die dieser Auftrag ändert: **src/core** (ausdrücklich, nur die Signatur und zwei Felder), **src/data** (nur neue Datei, keine bestehende Zahl), **docs/GDD.md** (neuer Abschnitt "Spielmodi").
Nicht berührt: `src/render`, `src/input`, `src/audio`, `balancing/`, alle Balancing-Zahlen.

## Ziel

Das Spiel bekommt eine Lauf-Konfiguration `{ mode, difficulty, seed }` als einzige Eingabe für eine neue Partie. Modus und Schwierigkeit stehen im Protokollkopf, im Bestenschlüssel und im Menü. Es gibt weiterhin genau einen echten Modus (`standard`) und eine Schwierigkeit (`normal`). **Für Spielerinnen und Spieler ändert sich nichts Sichtbares**, solange nur ein Modus wählbar ist. Das Gerüst ist die Naht für Auftrag B und für spätere Modi, Schwierigkeiten und eine Kampagne.

## Nicht-Ziele

- Keine Spiellogik pro Modus. Die Simulation liest in diesem Auftrag noch nichts aus dem Modus.
- Keine Schwierigkeitsstufen außer `normal` (Zahlen warten auf die Kalibrierung durch M6).
- Keine Kampagne. Nur die Naht bleibt offen (siehe "Kampagnen-Naht").
- Kein Balancing, keine Änderung an `RULESET_VERSION`.

## Anforderungen

### A1 Lauf-Konfiguration

```js
// Form, Namen sind Vorschläge
const config = { mode: 'standard', difficulty: 'normal' };
createGameState(seed, config);   // config optional, Standardwert siehe oben
```

- `createGameState(seed)` ohne zweites Argument muss weiter funktionieren und exakt dasselbe liefern wie heute.
- Der Zustand trägt `state.mode` (Verweis auf den aufgelösten Modus-Datensatz, nicht die ID allein) und `state.difficulty` (ID). Beides wird nach dem Erzeugen nie verändert.
- Unbekannte IDs fallen nicht still zurück, sondern werfen im Entwicklungsmodus einen Fehler und laden im Normalbetrieb `standard`/`normal` mit einem Eintrag in der Konsole.

### A2 Registry `src/data/modes.js`

Schema, bewusst klein. Auftrag B erweitert es um Geometrie und Regeln.

```js
export const MODES = {
  standard: {
    id: 'standard',
    rev: 1,                 // zählt hoch, wenn die Regeln DIESES Modus Ergebnisse unvergleichbar machen
    status: 'stable',       // 'stable' | 'experimental'
    debugOnly: false,       // true: nur mit ?debug sichtbar
    // Texte stehen in src/data/strings.js unter modes.<id>.name / .desc
  },
};
export const DIFFICULTIES = {
  normal: { id: 'normal', rev: 1 },
};
export const DEFAULT_CONFIG = { mode: 'standard', difficulty: 'normal' };
export function listSelectableModes(debug) { /* ... */ }
```

Zusätzlich ein Eintrag `standard-klon` mit `debugOnly: true`, Regeln identisch zu `standard`. Er existiert nur, damit Modus-Bildschirm, getrennte Bestenlisten und Migration ohne zweiten echten Modus testbar sind. Auftrag B entfernt ihn nicht, er bleibt Testwerkzeug.

### A3 Protokoll (`src/sim/record.js`)

- `PROTOCOL_VERSION` 1 wird 2. Kopf bekommt `mode`, `modeRev`, `difficulty`.
- Der Leser akzeptiert Version 1 und 2. Fehlen die Felder (Version 1), gilt `standard`, `1`, `normal`.
- Nachspielen liest den Modus aus dem Kopf und erzeugt den Zustand damit. Ein Protokoll mit unbekanntem Modus wird mit einer verständlichen deutschen Meldung abgelehnt, nicht mit einem Fehler im Spiel.
- Aufzeichnung "an dem Punkt derselben Runde" bleibt unverändert.

### A4 Speicher (`src/storage`, `docs/SPEICHER.md`)

- **Profil Format 1 wird 2.** `best` ist weiter nach Regelversion gegliedert, darunter aber nach Lauf-Schlüssel: `"<mode>|<modeRev>|<difficulty>"`, Beispiel `"standard|1|normal"`. Maximal 50 Einträge je Fach und Regelversion, absteigend nach Punkten, wie bisher.
- **Migration `MIGRATIONS[1]`** verschiebt alle bestehenden Einträge aller Regelversionen in das Fach `standard|1|normal`. Sie darf **keine Regelversion fest verdrahten** (M6 Runde 4 kann `RULESET_VERSION` gleichzeitig anheben).
- `stats` bleibt global, bekommt zusätzlich `byMode: { [modeId]: { matches, victories, bestWave } }`. Für migrierte Altbestände wird `byMode.standard` aus den globalen Werten gefüllt.
- `sanitizeProfile()` kennt die neuen Felder und verwirft unbekannte Modus-IDs nicht, sondern behält ihr Fach (ein Profil aus einer Version mit mehr Modi darf beim Import nichts verlieren). Unbekannt heißt: speichern, aber im Menü nicht anbieten.
- Export und Import: Exportdatei bekommt `version: 2`. Der Import akzeptiert 1 (wird migriert) und 2. Neuere Versionen verhalten sich wie bisher (`future: true`, Sperre, Warnung).
- **Einstellungen (`prefs`):** neues Feld `lastRun: { mode, difficulty }`. Ist der gemerkte Modus nicht (mehr) wählbar, gilt der Standardwert.
- Zugriff weiter nur über `src/storage/`, asynchron, alles in try/catch.

### A5 Menü (`src/ui`, `src/main.js`)

- Wählbar sind alle Modi mit `debugOnly === false` (bei `?debug` zusätzlich die Debug-Modi).
- **Genau ein wählbarer Modus:** "Neue Partie" startet wie heute, ohne neuen Bildschirm.
- **Mehr als ein wählbarer Modus:** "Neue Partie" öffnet den Modus-Bildschirm. Eine Karte je Modus mit Name, einem Satz Beschreibung, Statuskennzeichen "Experimentell" (wenn `status === 'experimental'`) und dem eigenen Bestwert (aus dem passenden Fach, ohne Eintrag: "noch keine Partie"). Vorbelegt ist `lastRun`. Eine Auswahl startet die Partie nicht sofort, sondern markiert die Karte, ein deutlich abgesetzter Knopf "Los" startet.
- Eine Schwierigkeitswahl erscheint erst, wenn mehr als eine Schwierigkeit existiert. Das Layout reserviert dafür eine Zeile, die sonst ausgeblendet ist.
- Zwei Karten nebeneinander im Querformat, untereinander im Hochformat, bei mehr als vier Karten scrollbar. Alle Trefferflächen mindestens 44 px, nur Pointer Events, `prefers-reduced-motion` beachten (keine Übergangsanimation).
- Ergebnisbildschirm und Bestenliste nennen den Modus. Die Bestenliste hat einen Umschalter nach Modus, sichtbar nur bei mehr als einem Modus.
- Alle sichtbaren Texte deutsch und in `src/data/strings.js`.
- `newGame(seed, config)` ruft `startLog` mit der Konfiguration auf. Die Debug-Parameter `?seed` und `?supply` bleiben erhalten, `?mode=<id>` und `?difficulty=<id>` kommen als reine Debug-Parameter dazu.

### Kampagnen-Naht (nur beachten, nichts bauen)

Eine Kampagne ist später eine geordnete Liste von Konfigurationen mit eigenem Speicherdokument `nachschubfront:campaign`. Eine Partie weiß nichts von ihr. Damit das möglich bleibt:

- `createGameState(seed, config)` darf später ein optionales `config.carry` bekommen. Der Auftrag baut es nicht, nimmt aber kein Argument-Layout in Kauf, das das verhindert.
- Der Lauf-Schlüssel und der Protokollkopf enthalten keine Annahme, dass eine Partie "für sich" steht (kein Feld wie `isCampaign`, aber auch keine Funktion, die den Zustand aus Modus und Seed allein ableitet und `carry` ausschließt).
- Eintrag im GDD unter "Ausblick", ein Absatz.

## Tests und Abnahme

1. **Golden-Replay:** Alle vorhandenen Protokolle (Fixtures in `tests/`, plus mindestens ein frisch aufgezeichnetes unter Format 1) laufen nach und liefern **bitgleich** denselben Endzustand wie vor dem Umbau. Dazu ein Hash über eine feste Partie (Seed, 20 Wellen, Bot): vor und nach dem Umbau identisch.
2. `RULESET_VERSION` bleibt unverändert. Wird sie gleichzeitig durch M6 angehoben, bleibt der Golden-Test auf dem jeweils aktuellen Stand grün.
3. **Migration:** Profil Format 1 (mehrere Regelversionen, volle Fächer) wird zu Format 2 ohne Verlust. Export aus Format 2 lässt sich importieren, Format 1 ebenfalls. Ein Profil mit unbekanntem Modus-Fach bleibt beim Import erhalten.
4. **Getrennte Fächer:** Partie im Modus `standard-klon` landet nicht in der Bestenliste von `standard` und umgekehrt.
5. **Protokoll:** Format 1 lesbar, Format 2 enthält `mode`, `modeRev`, `difficulty`, Nachspielen nutzt sie.
6. **Menü (Playwright, Tablet-Viewport 1024x768 und 768x1024):** ein Modus: kein neuer Bildschirm. Mit `?debug`: Modus-Bildschirm erscheint, Karten haben Trefferflächen von mindestens 44 px, Auswahl plus "Los" startet im richtigen Modus, `lastRun` wird gemerkt. Screenshots in `balancing/` oder dem üblichen Ablageort.
7. Keine Konsolenfehler, kein horizontaler Scroll bei 400 px Breite.
8. Kein Zugriff auf `localStorage` außerhalb von `src/storage/`.

## Hinweise außerhalb des Auftrags

- GDD Abschnitt 9 nennt das Mittelband "Welle 6 bis 30, Spitze bei Welle 18", `tests/tools/wave-rules.mjs` rechnet 6 bis 34 mit Spitze bei 14. Eines von beiden angleichen. Das gehört zu M6, nicht zu diesem Auftrag. Bitte nur melden, nicht ändern.
- Namen der Dateien und Funktionen in dieser Datei stammen aus einer Lektüre der Quellen im Chat, nicht aus dem vollständigen Code. Vor dem Umbau gegen den Ist-Stand prüfen. Weichen sie ab, gilt der Code, und die Abweichung kommt in `docs/PROGRESS.md`.

## Überschneidungen mit offenen Aufträgen

- **M6 Runde 4** (`src/data` Wellen, vermutlich `RULESET_VERSION`): dieser Auftrag ändert keine Wellenzahl. Berührungspunkt ist nur die Profilmigration (generisch halten) und die Versionsnummer. Reihenfolge entscheidet Till.
- **Auftrag B** setzt auf diesen Auftrag auf und darf erst danach zusammengeführt werden.
