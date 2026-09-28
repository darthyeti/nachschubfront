// What every wave brings against what the defence can deliver (M6, part 1,
// step 3).
//
//   npm run powercurve
//   npm run powercurve -- --protocol balancing/protokolle/<datei>.json
//   npm run powercurve -- --html balancing/runden/kraftkurve.html
//
// Pure arithmetic, no fight. It is a pre-check: it says which waves are worth
// looking at before a single match is played, and it is cheap enough to run
// after every change to the tables.
//
// **It is a model, and a model has to be checked.** A protocol records what a
// wave really brought and what really arrived, wave by wave, so this tool puts
// its own numbers next to those and prints how far off it was. Where no protocol
// is given it falls back to the typical values of the calibrated bot, and then
// its own error is unknown — which it says.
//
// The two curves:
//   what the wave brings   health and shields of everything in it, divided by
//                          how much of a hit actually arrives through its armour
//   what can be delivered  the emplacements standing that wave, their ranks, the
//                          damage per second of their doctrines, times the
//                          seconds an enemy spends inside their reach

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { WAVES } from '../../src/data/waves.js';
import { ENEMIES, BOSSES, enemyDef } from '../../src/data/enemies.js';
import { DOCTRINES, DOCTRINE_IDS } from '../../src/data/doctrines.js';
import { DAMAGE_MATRIX } from '../../src/data/combat.js';
import { RANKS } from '../../src/data/ranks.js';
import { parseProtocol } from '../../src/storage/protocol.js';
import { isMeasurable } from '../../src/sim/record.js';
import { reference } from './reference.mjs';
import { playBotMatch } from './bot-player.mjs';

/**
 * The estimates this model rests on. They are not in the GDD and not in
 * src/data/ — they are properties of the *shape* of a weapon, and they live here
 * together so that whoever distrusts the curve can see exactly what to argue
 * with.
 */
const MODEL = {
  /**
   * How many enemies one shot of a doctrine reaches on average, in a wave dense
   * enough for it to matter. A laser pierces the line, a tesla jumps four times
   * at minus twenty per cent a jump, a flame cone and a psi ring cover an area,
   * a mortar shell splashes.
   */
  spread: { flame: 3, autocannon: 1, laser: 2, mortar: 3, psi: 4, tesla: 2.4 },
  /**
   * Cells of route one emplacement keeps under fire. Twice its range would be
   * the stretch straight past it; a maze folds the path, so an emplacement often
   * reaches two or three passes of it. This is the single most uncertain number
   * in the model.
   */
  coverPerTower: 2.4,
  /** A healer's output over a wave, as a share of the wave's health added back. */
  healerShare: 0.12,
  /** Seconds of the wave an emplacement has nothing in range and holds fire. */
  idleShare: 0.25,
};

const args = process.argv.slice(2);
const option = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const htmlFile = option('html', 'balancing/runden/kraftkurve.html');
const given = option('protocol');
const protocols = given ? [given] : listProtocols();

const measured = [];
const unusable = [];
for (const file of protocols) {
  const parsed = parseProtocol(readFileSync(file, 'utf8'));
  if (!parsed.ok || !isMeasurable(parsed.match)) continue;
  // Only a replay that still produces the recorded match may feed the model; a
  // rule changed under an older protocol otherwise passes for measured reality
  // (reference.mjs).
  const check = reference(parsed.match, parsed.app);
  if (!check.ok) {
    unusable.push({ file, why: check.why });
    continue;
  }
  measured.push({ file, seed: parsed.match.seed, waves: check.played.waves });
}
for (const { file, why } of unusable) console.log(`${file} übersprungen. ${why}\n`);

let typical;
let source;
if (measured.length > 0) {
  typical = typicalFrom(measured.flatMap((m) => m.waves));
  source = `${measured.length} ${measured.length === 1 ? 'Protokoll' : 'Protokolle'} (${measured.map((m) => m.seed).join(', ')})`;
} else {
  // No hand-played match to hand: the calibrated bot stands in, and the model's
  // own error then cannot be known.
  const run = playBotMatch({ seed: 'M6KURVE', strategy: 'refine' });
  typical = typicalFrom(run.waves);
  source = 'geeichtem Bot (refine), kein Protokoll vorhanden';
}

const rows = WAVES.map((_, i) => row(i + 1, typical));

console.log(`Kraftkurve über ${WAVES.length} Wellen · typische Werte aus ${source}`);
console.log('');
const COLUMNS = [
  ['Welle', (r) => r.wave, 5],
  ['Art', (r) => r.kind, 8],
  ['Gegner', (r) => r.count, 6],
  ['Rohe LP', (r) => Math.round(r.rawHealth), 9],
  ['Wirksame LP', (r) => Math.round(r.effectiveHealth), 11],
  ['Stellungen', (r) => r.towers, 10],
  ['Schaden/s', (r) => Math.round(r.dps), 9],
  ['Lieferbar', (r) => Math.round(r.deliverable), 10],
  ['Reserve', (r) => `${Math.round((r.margin - 1) * 100)} %`, 8],
];
const header = COLUMNS.map(([n, , w]) => n.padStart(w)).join(' ');
console.log(header);
console.log('-'.repeat(header.length));
for (const r of rows) console.log(COLUMNS.map(([, read, w]) => String(read(r)).padStart(w)).join(' '));

console.log('');
// The headline of the whole curve. A reserve of 1000 % means the emplacements
// can deal ten times the damage the wave needs to die — which is what "far too
// easy from wave 3 or 5 on" looks like as arithmetic rather than as a feeling.
const middle = rows.slice(4, 30);
console.log(
  `Reserve im Mittel: W1–W10 ${percent(median(rows.slice(0, 10).map((r) => r.margin)))} · ` +
    `W5–W30 ${percent(median(middle.map((r) => r.margin)))} · ` +
    `W31–W50 ${percent(median(rows.slice(30).map((r) => r.margin)))}`,
);
const tight = rows.filter((r) => r.margin < 1.15);
console.log(
  tight.length > 0
    ? `Enge Wellen (Reserve unter 15 %): ${tight.map((r) => `W${r.wave} (${Math.round((r.margin - 1) * 100)} %)`).join(' · ')}`
    : 'Keine Welle unter 15 % Reserve.',
);
const loose = rows.filter((r) => r.margin > 3);
if (loose.length > 0) {
  console.log(`Sehr weite Wellen (Reserve über 200 %): ${loose.length} von ${rows.length}, ab W${loose[0].wave}.`);
}

// ---------- how wrong the model is ----------
if (measured.length > 0) checkModel(rows, measured);

function checkModel(rows, measured) {
  console.log('');
  console.log('Modell gegen die gemessenen Partien:');
  let healthError = 0;
  let n = 0;
  const clean = [];
  const bleeding = [];
  for (const match of measured) {
    for (const line of match.waves) {
      const model = rows[line.w - 1];
      if (!model || !line.health) continue;
      healthError += Math.abs(model.rawHealth - line.health) / line.health;
      n += 1;
      (line.leaked > 0 ? bleeding : clean).push({ wave: line.w, margin: model.margin, leaked: line.leaked });
    }
  }
  if (n === 0) return;

  console.log(`  Lebenspunkte der Welle: ${Math.round((healthError / n) * 100)} % mittlerer Fehler über ${n} Wellen`);
  console.log(
    '  Der lieferbare Schaden lässt sich so nicht prüfen: In einer Welle, die fällt, kommt genau so\n' +
      '  viel Schaden an, wie die Welle Lebenspunkte hatte — gemessen wird die Nachfrage, gerechnet die\n' +
      '  Kapazität. Prüfbar ist nur, ob die Reserve die Durchbrüche vorhersagt:',
  );
  console.log(
    `  Wellen ohne Durchbruch (${clean.length}): Reserve im Mittel ${percent(median(clean.map((c) => c.margin)))}`,
  );
  if (bleeding.length > 0) {
    console.log(
      `  Wellen mit Durchbruch (${bleeding.length}): ${bleeding
        .map((b) => `W${b.wave} ${percent(b.margin)} (${b.leaked} durch)`)
        .join(' · ')}`,
    );
    const missed = bleeding.filter((b) => b.margin > 1.15);
    if (missed.length > 0) {
      console.log(
        `  Nicht vorhergesagt: ${missed.map((m) => `W${m.wave}`).join(', ')}. ` +
          'Die Ursache ist bekannt und liegt nicht in den Zahlen:',
      );
      console.log(
        '  Das Modell nimmt an, der Spieler habe alle sechs Doktrinen zu gleichen Teilen stehen, und\n' +
          '  rechnet gegen Flieger nur mit den vier, die sie überhaupt treffen. Wer ohne Luftabwehr baut,\n' +
          '  hat gegen eine Fliegerwelle null Schaden — das sieht diese Kurve nicht. Es ist der Punkt, der\n' +
          '  in docs/PROGRESS.md unter „Offen" steht, und in der gemessenen Partie der teuerste.',
      );
    }
  }
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function percent(margin) {
  return `${Math.round((margin - 1) * 100)} %`;
}

writeHtml(rows, measured, source);
console.log('');
console.log(`Diagramm: ${htmlFile}`);

// ---------- the model ----------

/** One wave: what it brings, and what could be delivered against it. */
function row(wave, typicalBy) {
  const def = WAVES[wave - 1];
  const at = typicalBy(wave);
  let rawHealth = 0;
  let effectiveHealth = 0;
  let count = 0;
  let healers = 0;
  let slowest = Infinity;

  for (const group of def.groups) {
    const enemy = enemyDef(group.type);
    const health = enemy.health * def.scale;
    const shield = (enemy.shield ?? 0) * def.scale;
    count += group.count;
    rawHealth += group.count * (health + shield);
    // Health as the player meets it: a hit arrives reduced by the matrix, so an
    // armour the doctrines are bad against is worth more health than it has.
    effectiveHealth +=
      group.count * (shield / factorAgainst(enemy.armor) + health / factorAgainst(enemy.armorBelow ?? enemy.armor));
    if (group.type === 'healer') healers += group.count;
    slowest = Math.min(slowest, enemy.speed);
  }
  if (healers > 0) effectiveHealth *= 1 + MODEL.healerShare;

  // How long the wave is under fire: the spawn schedule, plus the walk through
  // the stretch the emplacements cover.
  const spawnSeconds = Math.max(
    ...def.groups.map((g) => g.delay + Math.max(0, g.count - 1) * g.interval),
  );
  const cover = Math.min(at.route, at.towers * MODEL.coverPerTower);
  const walkSeconds = cover / Math.max(0.1, slowest);
  const seconds = (spawnSeconds + walkSeconds) * (1 - MODEL.idleShare);

  const dps = at.towers * averageDps(at.ranks);
  const deliverable = dps * seconds;

  return {
    wave,
    kind: def.kind,
    count,
    rawHealth,
    effectiveHealth,
    towers: at.towers,
    route: at.route,
    dps,
    seconds,
    deliverable,
    margin: effectiveHealth > 0 ? deliverable / effectiveHealth : Infinity,
  };
}

/**
 * How much of a hit arrives against one armour type, averaged over the
 * doctrines that may fire at it at all. A flyer is only reached by four of the
 * six, and averaging the other two in as zero would make flyers look four times
 * tougher than they are.
 */
function factorAgainst(armor) {
  const factors = DOCTRINE_IDS.map((id) => DAMAGE_MATRIX[id][armor]).filter((f) => f > 0);
  if (factors.length === 0) return 0.01;
  return factors.reduce((a, b) => a + b, 0) / factors.length;
}

/** Damage per second of one average emplacement at the given rank mix. */
function averageDps(ranks) {
  const total = ranks.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const rankFactor = ranks.reduce((sum, n, i) => sum + n * RANKS[i].damage, 0) / total;
  const perDoctrine = DOCTRINE_IDS.map((id) => {
    const d = DOCTRINES[id];
    const rate = typeof d.fire === 'number' ? d.fire : 1;
    return d.damage * rate * (MODEL.spread[id] ?? 1);
  });
  return (perDoctrine.reduce((a, b) => a + b, 0) / perDoctrine.length) * rankFactor;
}

/**
 * The typical emplacements, ranks and route length at each wave, read off real
 * matches. Waves nobody reached keep the last values seen, because a curve that
 * stopped where the protocols stop would say nothing about the late game.
 */
function typicalFrom(waves) {
  const byWave = new Map();
  for (const line of waves) {
    const seen = byWave.get(line.w) ?? { towers: 0, route: 0, ranks: [0, 0, 0, 0, 0], n: 0 };
    seen.towers += line.towers ?? 0;
    seen.route += line.route ?? 0;
    for (let i = 0; i < 5; i++) seen.ranks[i] += line.byRank?.[i] ?? 0;
    seen.n += 1;
    byWave.set(line.w, seen);
  }
  let last = { towers: 1, route: 40, ranks: [1, 0, 0, 0, 0] };
  const table = new Map();
  for (let w = 1; w <= WAVES.length; w++) {
    const seen = byWave.get(w);
    if (seen && seen.n > 0) {
      last = {
        towers: Math.max(1, Math.round(seen.towers / seen.n)),
        route: seen.route / seen.n,
        ranks: seen.ranks.map((n) => n / seen.n),
      };
    }
    table.set(w, last);
  }
  return (wave) => table.get(wave) ?? last;
}

function listProtocols() {
  try {
    return readdirSync('balancing/protokolle')
      .filter((n) => n.endsWith('.json'))
      .map((n) => join('balancing/protokolle', n));
  } catch {
    return [];
  }
}

/** A plain SVG chart in a plain page: no build step, no libraries, no network. */
function writeHtml(rows, measured, source) {
  const width = 1100;
  const height = 520;
  const pad = { left: 90, right: 30, top: 60, bottom: 50 };
  // Logarithmic, because health grows by 12 % a wave: on a linear axis the first
  // twenty waves lie flat on the bottom edge, and those are the ones where the
  // two curves come apart. The gap between the lines is then a ratio, which is
  // what the reserve is anyway.
  const values = rows.flatMap((r) => [r.effectiveHealth, r.deliverable]).filter((v) => v > 0);
  const minY = Math.min(...values) / 2;
  const maxY = Math.max(...values) * 2;
  const span = Math.log10(maxY) - Math.log10(minY);
  const x = (wave) => pad.left + ((wave - 1) / (rows.length - 1)) * (width - pad.left - pad.right);
  const y = (value) =>
    height -
    pad.bottom -
    ((Math.log10(Math.max(minY, value)) - Math.log10(minY)) / span) * (height - pad.top - pad.bottom);

  /** One gridline per power of ten, labelled. */
  const decades = [];
  for (let power = Math.ceil(Math.log10(minY)); power <= Math.floor(Math.log10(maxY)); power++) {
    const value = 10 ** power;
    decades.push(
      `<line x1="${pad.left}" y1="${y(value).toFixed(1)}" x2="${width - pad.right}" y2="${y(value).toFixed(1)}" stroke="#332a22"/>` +
        `<text x="${pad.left - 8}" y="${(y(value) + 4).toFixed(1)}" fill="#8d8478" font-size="11" text-anchor="end">${label(value)}</text>`,
    );
  }
  const line = (read) => rows.map((r) => `${x(r.wave).toFixed(1)},${y(read(r)).toFixed(1)}`).join(' ');

  const actual = measured.flatMap((m) =>
    m.waves
      .filter((w) => w.health)
      .map((w) => `<circle cx="${x(w.w).toFixed(1)}" cy="${y(w.damage + w.commandDamage).toFixed(1)}" r="3" fill="#7fd8ff"/>`),
  );

  const ticks = [10, 20, 30, 40, 50]
    .map((w) => `<line x1="${x(w)}" y1="${pad.top}" x2="${x(w)}" y2="${height - pad.bottom}" stroke="#3a2f27"/>
      <text x="${x(w)}" y="${height - pad.bottom + 18}" fill="#c3bcae" font-size="12" text-anchor="middle">W${w}</text>`)
    .join('');

  const html = `<!doctype html>
<html lang="de">
<meta charset="utf-8">
<title>Kraftkurve</title>
<style>
  body { background: #1a1410; color: #e8dcc0; font-family: system-ui, sans-serif; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { color: #c3bcae; font-size: 13px; margin: 0 0 16px; }
  .key { display: flex; gap: 18px; font-size: 13px; margin-bottom: 8px; flex-wrap: wrap; }
  .key span::before { content: ''; display: inline-block; width: 14px; height: 3px; margin-right: 6px; vertical-align: 3px; }
  .health::before { background: #ff4a4a; }
  .deliver::before { background: #f2c14e; }
  .real::before { background: #7fd8ff; }
  table { border-collapse: collapse; margin-top: 24px; font-size: 13px; }
  th, td { padding: 3px 10px; text-align: right; border-bottom: 1px solid #3a2f27; }
  th { color: #c3bcae; font-weight: 600; }
  td.tight { color: #ff8a2a; font-weight: 700; }
</style>
<h1>Kraftkurve</h1>
<p>Was die Welle mitbringt gegen das, was die Stellungen liefern können. Typische Werte aus ${escape(source)}.
Gerechnet, nicht gespielt — eine Vorprüfung.</p>
<div class="key">
  <span class="health">Wirksame Lebenspunkte der Welle</span>
  <span class="deliver">Lieferbarer Schaden (Modell)</span>
  <span class="real">Tatsächlich angekommen (Protokoll)</span>
</div>
<svg width="${width}" height="${height}" role="img" aria-label="Kraftkurve über 50 Wellen">
  <rect width="${width}" height="${height}" fill="#241c17"/>
  ${decades.join('\n  ')}
  ${ticks}
  <polyline points="${line((r) => r.effectiveHealth)}" fill="none" stroke="#ff4a4a" stroke-width="2.5"/>
  <polyline points="${line((r) => r.deliverable)}" fill="none" stroke="#f2c14e" stroke-width="2.5"/>
  ${actual.join('\n  ')}
  <text x="${pad.left}" y="${pad.top - 24}" fill="#c3bcae" font-size="12">Lebenspunkte und Schaden, logarithmisch — der Abstand der Linien ist die Reserve</text>
</svg>
<table>
  <tr><th>Welle</th><th>Art</th><th>Gegner</th><th>Wirksame LP</th><th>Stellungen</th><th>Schaden/s</th><th>Lieferbar</th><th>Reserve</th></tr>
  ${rows
    .map(
      (r) => `<tr><td>${r.wave}</td><td>${r.kind}</td><td>${r.count}</td><td>${Math.round(r.effectiveHealth)}</td>` +
        `<td>${r.towers}</td><td>${Math.round(r.dps)}</td><td>${Math.round(r.deliverable)}</td>` +
        `<td class="${r.margin < 1.15 ? 'tight' : ''}">${Math.round((r.margin - 1) * 100)} %</td></tr>`,
    )
    .join('\n  ')}
</table>
</html>
`;
  mkdirSync(dirname(htmlFile), { recursive: true });
  writeFileSync(htmlFile, html);
}

/** 1200 as "1,2k", 3400000 as "3,4M": a readable axis label. */
function label(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toString().replace('.', ',')}M`;
  if (value >= 1000) return `${(value / 1000).toString().replace('.', ',')}k`;
  return String(value);
}

function escape(text) {
  return String(text).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}
