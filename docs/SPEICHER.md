# Speichern

Was das Spiel behält, wo es liegt, und wie später ein Online-Backend dahinterpasst.
Stand: M7a, Profilformat 2, Protokollformat 2.

## Grundregel

Nur `src/storage/` fasst dauerhaften Speicher an. Kein anderes Modul kennt
`localStorage`. Die Schnittstelle ist asynchron, obwohl `localStorage` es nicht
ist — genau deshalb: eine spätere Fassung darf über das Netz gehen, ohne dass
ein einziger Aufrufer sich ändert.

Jeder Lese- und Schreibzugriff ist in `try/catch`. Ein voller, gesperrter oder
fehlender Speicher kostet den Spielstand, nie die Partie.

## Drei Dokumente

Es sind bewusst drei, nicht eins.

| Schlüssel | Inhalt | Modul | Wandert in den Export |
| --- | --- | --- | --- |
| `nachschubfront:prefs` | Lautstärken, Bewegung, weggeklickte Hinweise, zuletzt gespielter Modus | `src/core/prefs.js` | nein |
| `nachschubfront:profile` | Bestwerte und Statistik | `src/storage/profile.js` | ja |
| `nachschubfront:protocols` | die letzten fünf Partie-Protokolle (M6) | `src/storage/protocol.js` | eigene Datei |

`prefs.lastRun` (`{ mode, difficulty }`, seit M7a) merkt sich die Lauf-Konfiguration
der letzten Partie. Gespeichert werden nur die beiden Kennungen; ist der Modus in
diesem Build nicht (mehr) wählbar, nimmt das Menü den Standard.

Die Einstellungen gehören dem Gerät. Wer ein fremdes Profil einspielt, soll
nicht plötzlich mit fremder Lautstärke spielen. Deshalb bleiben sie draußen
(Entscheidung vom 24.09.2026).

## Die Schnittstelle

`src/storage/index.js`:

```js
const s = createStorage();        // ohne Backend: In-Memory, persistent === false
s.persistent                      // false, wenn nichts einen Neustart übersteht
await s.get(key, fallback = null) // fällt bei kaputtem JSON auf fallback zurück
await s.set(key, value)           // false, wenn nichts geschrieben werden konnte
await s.remove(key)
```

Die Schlüssel bekommen alle das Präfix `nachschubfront:`. Werte werden als JSON
abgelegt.

### Was ein Online-Backend braucht

`createStorage(backend)` nimmt jedes Objekt mit `getItem`, `setItem` und
`removeItem`. Für ein Backend mit Netz reicht das nicht ganz, darum hier die
Punkte, an denen es hakt, und wie sie gemeint sind:

- **Die vier Methoden sind schon asynchron.** Ein Backend darf `await`en; die
  Aufrufer tun es bereits.
- **Die In-Memory-Ebene ist die Rückfallebene.** Bleibt das Netz weg, liest und
  schreibt das Spiel weiter, nur eben flüchtig. Ein Backend soll nicht werfen,
  sondern `set` mit `false` beantworten.
- **Das Profil ist ein einziges Dokument.** Ein Server, der Bestwerte einzeln
  führt, ersetzt nicht `createStorage`, sondern `createProfileStore`: dort
  liegen `load`, `record`, `replace` und `reset`, und nur die vier fassen das
  Dokument an.
- **Regelversion und Lauf-Schlüssel stehen an jedem Ergebnis** (siehe unten).
  Eine Bestenliste im Netz muss nach beiden trennen, sonst mischt sie Läufe aus
  zwei Spielen.
- **Der Seed identifiziert eine Partie, nicht den Spieler.** Für eine Bestenliste
  fehlt eine Spielerkennung; die gibt es bisher nicht und sie müsste ins
  Profil-Meta.

## Profilformat 2

```js
{
  version: 2,
  best: {
    '6': {                         // Regelversion
      'standard|1|normal': [       // Lauf-Schlüssel: Modus | Modus-Stand | Schwierigkeit
        {
          seed: 'BASTION',
          wave: 12, kills: 340, lives: 17, score: 15740,
          victory: false,
          date: 1758672000000,     // ms seit Epoch, 0 wenn unbekannt
          runs: 3,                 // wie oft dieser Seed gespielt wurde
        },
      ],
    },
  },
  stats: {
    matches: 0, victories: 0, kills: 0, bestWave: 0, seconds: 0,
    doctrines: { flame: 0, autocannon: 0, laser: 0, mortar: 0, psi: 0, tesla: 0 },
    byMode: { standard: { matches: 0, victories: 0, bestWave: 0 } },
  },
  meta: { app: '0.5.0', updated: 1758672000000 },
}
```

Ein Eintrag pro Seed, Lauf-Schlüssel und Regelversion, absteigend nach Punkten
sortiert, höchstens `MAX_BEST_ENTRIES` (50) je Fach. Die Liste ist damit beides:
der Bestwert je Seed und die Bestenliste insgesamt. Das Menü zeigt die ersten zehn.

Der **Lauf-Schlüssel** kommt aus `src/data/modes.js` (`runKey`). Der Modus-Stand
(`rev`) zählt hoch, wenn die Regeln eines Modus alte Ergebnisse unvergleichbar
machen — wie die Regelversion, nur für einen Modus allein. Die globale Statistik
zählt alle Modi zusammen, `byMode` je Modus.

**Fächer und Statistik unbekannter Modi bleiben erhalten.** Ein Profil aus einem
Build mit mehr Modi darf auf dem Weg durch diesen nichts verlieren; angeboten
wird ein unbekannter Modus im Menü trotzdem nicht.

`stats.doctrines` zählt **gebaute** Stellungen, und zwar nur solche, die der
Spieler im Auswahldialog gewählt hat (`src/sim/selection.js`). Was der
Belastungstest aufstellt, zählt nicht mit. Daraus ergibt sich die „liebste
Doktrin".

### Regelversion

`RULESET_VERSION` in `src/data/rules.js` steht an jedem gespeicherten Ergebnis.
Sie wird erhöht, sobald eine Änderung alte und neue Läufe unvergleichbar macht —
M4b hat das getan (zwei Signalfeuer statt vier, andere Salvengröße, entschärfte
erste Wellen). Läufe verschiedener Versionen landen in getrennten Listen und
werden nie gegeneinander sortiert. Die Bestenliste zeigt die aktuelle Version
und nennt darunter nur die Zahl der älteren Läufe.

### Sanitizing

`sanitizeProfile()` behält, was es versteht, und wirft den Rest weg: unbekannte
Felder, negative Zahlen, Brüche, Seeds, die keine Zeichenkette sind, Doktrinen,
die es nicht gibt, mehr Siege als Partien. Ein kaputtes oder fremdes Dokument
liest sich als leeres Profil — das Spiel startet immer.

### Migration

`MIGRATIONS[n]` macht aus einem Dokument der Version n eines der Version n+1.
Ein fehlender Schritt heißt: zwischen diesen beiden Versionen musste nichts
umgerechnet werden. Ein Dokument ohne `version` gilt als Version 0.

`MIGRATIONS[1]` (M7a) legt die Liste jeder Regelversion in das Fach
`standard|1|normal` — vor M7a gab es nur diesen Lauf — und füllt
`stats.byMode.standard` aus den globalen Zahlen. Er nennt keine Regelversion,
damit M6 sie jederzeit anheben kann.

Ein Dokument aus einer **neueren** Version wird nicht angefasst.
`migrateProfile()` meldet `future: true`, der Store schaltet auf `locked`, zeigt
eine Warnung in der Bestenliste und schreibt nichts mehr. Sonst würde ein
älterer Build Bestwerte löschen, die er nur nicht lesen kann. Ein Import ist die
Ansage des Spielers und hebt die Sperre auf.

## Export und Import

Die Exportdatei ist das Profil plus Kennung:

```js
{
  magic: 'nachschubfront.profile',
  version: 2,
  app: '0.5.0',
  exported: 1758672000000,
  best: { ... },
  stats: { ... },
}
```

Dateiname `nachschubfront-profil-JJJJ-MM-TT.json`.

`parseImport()` prüft der Reihe nach und nennt den Grund:

| Grund | Bedeutung |
| --- | --- |
| `parse` | kein lesbares JSON-Objekt |
| `magic` | die Kennung fehlt oder gehört einem anderen Spiel |
| `future` | die Datei kommt aus einer neueren Version |
| `empty` | nach dem Sanitizing steht keine beendete Partie darin |

Eine Datei im Format 1 wird beim Import migriert wie ein gespeichertes Profil.

Erst wenn eine Datei alle vier Hürden nimmt, fragt der Bildschirm nach — mit
beiden Ständen nebeneinander. **Der Import ersetzt, er führt nicht zusammen**
(Entscheidung vom 24.09.2026): Zusammenführen klingt freundlicher, zählt aber
die Statistiksummen doppelt, wenn dieselbe Datei zweimal ankommt, und das merkt
niemand.

Zwei Wege hinein, weil iPadOS Dateien aus fremden Apps nicht zuverlässig
durchreicht: Dateiauswahl und ein Einfügefeld. Zwei Wege hinaus: Download und
Zwischenablage.

## Partie-Protokolle

Format und Felder beschreibt `src/sim/record.js`. **Protokollformat 2** (M7a)
trägt im Kopf `mode`, `modeRev` und `difficulty`; das Nachspielen baut die Partie
damit auf. Einem Protokoll im Format 1 fehlen die Felder, es gilt als
`standard`, `1`, `normal`. Ein Protokoll eines Modus, den der Build nicht kennt,
bleibt gespeichert, wird aber beim Laden und beim Testeinstieg mit einer
deutschen Meldung abgelehnt, nicht erst im Nachspielen.

## Offline und Updates

Der dritte Speicher ist der Cache des Service Workers (`sw.js`).

- Die Precache-Liste schreibt `npm run precache`. Von Hand ändert sie niemand.
- Der Cache heißt `nachschubfront-<Version>-<Build>`. `Build` ist ein Hash über
  Namen **und** Inhalte aller ausgelieferten Dateien. Ein geändertes Byte ergibt
  einen neuen Cache; der alte fliegt beim `activate` weg.
- `tests/unit/precache.test.js` scheitert, sobald sw.js und die Dateien
  auseinanderlaufen, und läuft dabei den echten Importgraphen ab `src/main.js`
  ab. Das ist die Stelle, die dafür sorgt, dass Updates ankommen.
- Der Worker übernimmt **nie** von selbst (kein `skipWaiting` beim Installieren).
  Ein fertiger neuer Build meldet sich als Zeile im Haupt- und Pausenmenü; erst
  „Neu laden" lässt ihn ans Ruder. Eine laufende Partie wird nicht unterbrochen
  (Entscheidung vom 24.09.2026).

## Was hier nicht liegt

Der Spielstand einer laufenden Partie. Es gibt kein Speichern mitten im Feldzug;
eine Partie dauert eine Sitzung. Käme das später, wäre es ein drittes Dokument
mit eigener Version, nicht ein Feld im Profil.
