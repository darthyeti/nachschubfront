// Plays a recorded match again without graphics and prints one line per wave
// (M6, part 1, step 2).
//
//   npm run replay -- balancing/protokolle/nachschubfront-2026-09-27-BASTION-welle12.json
//   npm run replay -- <protokoll> --data balancing/aenderungen.json
//   npm run replay -- <protokoll> --csv balancing/runden/runde-1.csv
//
// Without --data the run has to come out exactly as the match did; the last
// block of the output says so. With --data the same decisions are played
// against different numbers, and the differences are the measurement.
//
// An action that has become impossible under the new numbers — a demolition
// nobody can afford any more — is skipped, named, and the run carries on.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseProtocol, describeProtocol } from '../../src/storage/protocol.js';
import { replayMatch, compareWaves } from '../../src/sim/replay.js';
import { isMeasurable } from '../../src/sim/record.js';
import { applyOverride } from './data-override.mjs';
import { STRINGS } from '../../src/data/strings.js';
import { WAVES } from '../../src/data/waves.js';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

if (!file) {
  console.error('Usage: npm run replay -- <protokoll.json> [--data <aenderungen.json>] [--csv <datei.csv>]');
  process.exit(1);
}

const parsed = parseProtocol(readFileSync(file, 'utf8'));
if (!parsed.ok) {
  console.error(`${file}: kein Protokoll (${parsed.error}).`);
  process.exit(1);
}
const protocol = parsed.match;
const about = describeProtocol(protocol);

// Changed values go in before the run, so every reader sees them.
let override = { applied: [], refused: [], undo: () => {} };
const dataFile = option('data');
if (dataFile) {
  override = applyOverride(JSON.parse(readFileSync(dataFile, 'utf8')));
}

console.log(`Protokoll ${file}`);
console.log(
  `Seed ${about.seed} · Regelversion ${protocol.ruleset} · ${about.waves} Wellen bis Welle ${about.wave} · ` +
    `${about.actions} Aktionen · ${about.ratings} bewertet · ` +
    (isMeasurable(protocol) ? 'saubere Partie' : `Debug-Hebel: ${protocol.tainted.join(', ')}`),
);
if (dataFile) {
  console.log(`Daten ${dataFile}: ${override.applied.length ? override.applied.join(', ') : 'nichts geändert'}`);
  for (const { path, why } of override.refused) console.log(`  abgelehnt ${path}: ${why}`);
}
console.log('');

const COLUMNS = [
  ['Welle', (w) => w.w, 5],
  ['Art', (w) => STRINGS.waveKinds[WAVES[w.w - 1]?.kind] ?? '?', 8],
  ['Gegner', (w) => w.spawned, 6],
  ['tot', (w) => w.killed, 4],
  ['durch', (w) => w.leaked, 5],
  ['Leben', (w) => w.lives, 5],
  ['LP', (w) => w.health, 7],
  ['Schaden', (w) => w.damage, 8],
  ['Kmd', (w) => w.commandDamage, 6],
  ['Übrig', (w) => w.overkill, 7],
  ['Route', (w) => w.route, 6],
  ['Req', (w) => w.requisition, 5],
  ['KP', (w) => w.commandPoints, 3],
  ['Stellungen', (w) => `${(w.byRank ?? []).join('/')}+${w.specials ?? 0}`, 13],
  ['Bewertung', (w) => rating(w), 9],
];

function rating(wave) {
  const answers = { easy: 'zu leicht', fine: 'passt', hard: 'zu schwer' };
  const recorded = protocol.waves.find((x) => x.w === wave.w);
  return answers[recorded?.rating] ?? '';
}

const header = COLUMNS.map(([name, , width]) => name.padStart(width)).join(' ');
console.log(header);
console.log('-'.repeat(header.length));

const run = replayMatch(protocol, {
  onWave(wave) {
    console.log(COLUMNS.map(([, read, width]) => String(read(wave)).padStart(width)).join(' '));
  },
});

console.log('');
console.log(`Ende: ${run.stopped}, ${run.steps} Simulationsschritte, ${run.applied} Aktionen wiederholt.`);

if (run.skipped.length > 0) {
  console.log('');
  console.log(`Übersprungen: ${run.skipped.length} ${run.skipped.length === 1 ? 'Aktion' : 'Aktionen'}`);
  for (const s of run.skipped) console.log(`  Runde ${s.w}, ${s.p}, ${s.a}: ${s.why}`);
}

// The promise of the whole exercise: without changed numbers the replay has to
// agree with the match it is replaying, wave for wave.
const diff = compareWaves(protocol.waves, run.waves, [
  'lives',
  'spawned',
  'killed',
  'leaked',
  'requisition',
  'route',
]);
console.log('');
if (!dataFile) {
  if (diff.length === 0) {
    console.log('Gleiches Ergebnis wie die aufgezeichnete Partie, Welle für Welle.');
  } else {
    console.log(`ABWEICHUNG ohne Datenänderung — ${diff.length} Unterschiede:`);
    for (const d of diff) console.log(`  Welle ${d.wave} ${d.field}: ${d.was} → ${d.now}`);
    process.exitCode = 1;
  }
} else if (diff.length === 0) {
  console.log('Die geänderten Werte haben am Ergebnis nichts verändert.');
} else {
  console.log(`Unterschiede zur aufgezeichneten Partie: ${diff.length}`);
  for (const d of diff) console.log(`  Welle ${d.wave} ${d.field}: ${d.was} → ${d.now}`);
}

const csvFile = option('csv');
if (csvFile) {
  const names = COLUMNS.map(([name]) => name);
  const rows = run.waves.map((w) => COLUMNS.map(([, read]) => read(w)));
  const csv = [names, ...rows].map((row) => row.join(',')).join('\n');
  mkdirSync(dirname(csvFile), { recursive: true });
  writeFileSync(csvFile, `${csv}\n`);
  console.log(`\nCSV: ${csvFile}`);
}

override.undo();
