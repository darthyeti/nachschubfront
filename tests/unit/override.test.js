// Changing balancing values for one run (M6, part 1, step 2), and the guard
// that the wave table in src/data/ still is what its rules say it is.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyOverride, TARGETS } from '../../tests/tools/data-override.mjs';
import { WAVE_RULES, buildWaves } from '../../tests/tools/wave-rules.mjs';
import { waveTableSource } from '../../tests/tools/make-waves.mjs';
import { WAVES } from '../../src/data/waves.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { RANKS } from '../../src/data/ranks.js';
import { SUPPLY_LEVELS } from '../../src/data/supply.js';
import { ECONOMY } from '../../src/data/economy.js';

const WAVES_FILE = fileURLToPath(new URL('../../src/data/waves.js', import.meta.url));

test('the wave table on disk is what its rules produce', () => {
  // The rules moved out of the generator into a module of their own in M6, so
  // the balancing tools can reach them. This is what keeps the two in step: a
  // changed rule or a hand edit in src/data/waves.js fails here until
  // `npm run waves` has run.
  assert.equal(readFileSync(WAVES_FILE, 'utf8'), waveTableSource(), 'run `npm run waves`');
  assert.deepEqual(WAVES, buildWaves(WAVE_RULES));
});

test('a number is changed and put back again', () => {
  const before = ENEMIES.warrior.health;
  const run = applyOverride({ enemies: { warrior: { health: 999 } } });
  assert.deepEqual(run.refused, []);
  assert.deepEqual(run.applied, ['enemies.warrior.health']);
  assert.equal(ENEMIES.warrior.health, 999);
  run.undo();
  assert.equal(ENEMIES.warrior.health, before);
});

test('a list is addressed by index from zero', () => {
  const before = RANKS[4].damage;
  const run = applyOverride({ ranks: { 4: { damage: 24 } } });
  assert.deepEqual(run.refused, []);
  assert.equal(RANKS[4].damage, 24, 'the legend rank');
  run.undo();
  assert.equal(RANKS[4].damage, before);
});

test('changing the wave rules rebuilds the table, and undo puts it back', () => {
  const before = WAVES.map((w) => w.scale);
  const run = applyOverride({ waves: { healthGrowth: 1.05 } });
  assert.deepEqual(run.refused, []);
  assert.ok(run.applied.includes('waves (table rebuilt)'));
  assert.ok(WAVES[9].scale < before[9], 'wave 10 is milder');
  assert.equal(WAVES.length, before.length);
  run.undo();
  assert.deepEqual(
    WAVES.map((w) => w.scale),
    before,
  );
});

test('what does not exist is refused, not created', () => {
  const run = applyOverride({
    nowhere: { x: 1 },
    enemies: { warrior: { toughness: 5 } },
    supply: { 99: { cost: 1 } },
  });
  assert.deepEqual(run.applied, []);
  assert.equal(run.refused.length, 3);
  assert.match(run.refused[0].why, /unbekannte Tabelle/);
  assert.match(run.refused[1].why, /gibt es nicht/);
  assert.match(run.refused[2].why, /außerhalb der Liste \(0 bis 7\)/);
  assert.equal(ENEMIES.warrior.toughness, undefined);
  assert.equal(SUPPLY_LEVELS.length, 8, 'the ladder did not grow');
});

test('the shape of a table cannot be changed', () => {
  // The reason this is refused rather than allowed: several values are computed
  // once at import — MAX_SUPPLY_LEVEL, MAX_SALVO_SIZE, MAX_RANK, the id lists —
  // and a table that grew behind their back would make the run compute nonsense
  // without saying so.
  const run = applyOverride({
    supply: { 3: { weights: [0, 0, 100] } },
    ranks: { 0: { damage: 'viel' } },
    economy: { rubbleCost: [15] },
  });
  assert.deepEqual(run.applied, []);
  assert.match(run.refused[0].why, /behält ihre Länge \(5, bekommen 3\)/);
  assert.match(run.refused[1].why, /erwartet number, bekommen string/);
  assert.match(run.refused[2].why, /erwartet number, bekommen object/);
  assert.deepEqual(SUPPLY_LEVELS[3].weights, [40, 40, 20, 0, 0]);
  assert.equal(RANKS[0].damage, 1);
  assert.equal(ECONOMY.rubbleCost, 15);
});

test('a list may be replaced as long as it keeps its length', () => {
  const before = [...SUPPLY_LEVELS[3].weights];
  const run = applyOverride({ supply: { 3: { weights: [10, 30, 40, 20, 0] } } });
  assert.deepEqual(run.refused, []);
  assert.deepEqual(SUPPLY_LEVELS[3].weights, [10, 30, 40, 20, 0]);
  run.undo();
  assert.deepEqual(SUPPLY_LEVELS[3].weights, before);
});

test('every named table is really the table it claims to be', () => {
  for (const [name, table] of Object.entries(TARGETS)) {
    assert.equal(typeof table, 'object', `${name} is a table`);
    assert.ok(Object.keys(table).length > 0, `${name} is not empty`);
  }
  // The names a round of balancing will reach for.
  for (const name of ['doctrines', 'enemies', 'specials', 'ranks', 'economy', 'rules', 'waves']) {
    assert.ok(name in TARGETS, name);
  }
});

test('a broken override file changes nothing', () => {
  assert.deepEqual(applyOverride(null).applied, []);
  assert.deepEqual(applyOverride([1, 2]).applied, []);
  assert.equal(applyOverride('nope').refused.length, 1);
  assert.deepEqual(applyOverride({ enemies: 5 }).refused[0].path, 'enemies');
});

test('two changes to the same value unwind in the right order', () => {
  const before = ENEMIES.warrior.health;
  const first = applyOverride({ enemies: { warrior: { health: 100 } } });
  const second = applyOverride({ enemies: { warrior: { health: 200 } } });
  second.undo();
  assert.equal(ENEMIES.warrior.health, 100, 'back to what the first one set');
  first.undo();
  assert.equal(ENEMIES.warrior.health, before);
});
