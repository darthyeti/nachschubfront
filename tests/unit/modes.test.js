// The seam for game modes (M7a): a run configuration next to the seed, mode
// records as data, and rules that differ between modes looked up in tables.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../../src/core/state.js';
import {
  MODES,
  DIFFICULTIES,
  DEFAULT_CONFIG,
  listSelectableModes,
  resolveConfig,
  sanitizeConfig,
  runKey,
} from '../../src/data/modes.js';
import { UPGRADE_KINDS } from '../../src/sim/selection.js';
import { STRINGS } from '../../src/data/strings.js';

test('a state without a configuration is a standard match on normal', () => {
  const state = createGameState('MODI');
  assert.equal(state.mode, MODES.standard, 'the mode is the record, not its id');
  assert.equal(state.difficulty, 'normal');
});

test('the configuration does not move the map', () => {
  const a = createGameState('MODI');
  const b = createGameState('MODI', { mode: 'standard-klon', difficulty: 'normal' });
  assert.equal(b.mode, MODES['standard-klon']);
  assert.deepEqual([...b.map.grid.blocked], [...a.map.grid.blocked]);
  assert.deepEqual(b.route, a.route);
});

test('an unknown id never reaches the simulation', () => {
  assert.throws(() => createGameState('MODI', { mode: 'gibtsnicht' }), /Unknown mode/);
  assert.throws(() => createGameState('MODI', { difficulty: 'albtraum' }), /Unknown difficulty/);
  assert.throws(() => resolveConfig({ mode: 'toString' }), /Unknown mode/, 'no prototype keys');
});

test('from outside, an unknown id falls back for a player and throws in debug', () => {
  const warn = console.warn;
  const said = [];
  console.warn = (...args) => said.push(args.join(' '));
  try {
    assert.deepEqual(sanitizeConfig({ mode: 'gibtsnicht' }), DEFAULT_CONFIG);
    assert.equal(said.length, 1, 'the fallback is said in the console');
  } finally {
    console.warn = warn;
  }
  assert.throws(() => sanitizeConfig({ mode: 'gibtsnicht' }, { strict: true }), /Unknown run configuration/);
  assert.deepEqual(sanitizeConfig(null), DEFAULT_CONFIG);
  assert.deepEqual(sanitizeConfig({ mode: undefined, difficulty: null }, { strict: true }), DEFAULT_CONFIG);
  assert.deepEqual(sanitizeConfig({ mode: 'standard-klon' }, { strict: true }), { mode: 'standard-klon', difficulty: 'normal' });
});

test('debug-only modes are offered only with ?debug', () => {
  assert.deepEqual(listSelectableModes(false).map((m) => m.id), ['standard']);
  assert.deepEqual(listSelectableModes(true).map((m) => m.id), ['standard', 'standard-klon', 'koth']);
});

test('every mode and difficulty is complete', () => {
  for (const [id, mode] of Object.entries(MODES)) {
    assert.equal(mode.id, id);
    assert.ok(Number.isInteger(mode.rev) && mode.rev >= 1, `${id}: rev`);
    assert.ok(['stable', 'experimental'].includes(mode.status), `${id}: status`);
    assert.equal(typeof mode.debugOnly, 'boolean', `${id}: debugOnly`);
    assert.ok(Object.hasOwn(UPGRADE_KINDS, mode.upgrade.kind), `${id}: upgrade.kind ${mode.upgrade.kind} has no rule`);
    assert.ok(STRINGS.modes[id]?.name && STRINGS.modes[id]?.desc, `${id}: name and description in strings.js`);
    assert.ok(!id.includes('|'), `${id}: the run key uses |`);
  }
  for (const [id, difficulty] of Object.entries(DIFFICULTIES)) {
    assert.equal(difficulty.id, id);
    assert.ok(Number.isInteger(difficulty.rev) && difficulty.rev >= 1);
  }
});

test('the mode screen preselects the last run while its mode is still offered', async () => {
  const { initialChoice } = await import('../../src/ui/modes.js');
  const all = listSelectableModes(true);
  const klon = { mode: 'standard-klon', difficulty: 'normal' };
  assert.deepEqual(initialChoice(klon, all), klon);
  assert.deepEqual(initialChoice(klon, listSelectableModes(false)), { ...DEFAULT_CONFIG });
  assert.deepEqual(initialChoice({ mode: 'aus-der-zukunft', difficulty: 'albtraum' }, all), { ...DEFAULT_CONFIG });
  assert.deepEqual(initialChoice(undefined, all), { ...DEFAULT_CONFIG });
});

test('the run key names mode, its revision and the difficulty', () => {
  assert.equal(runKey('standard', 1, 'normal'), 'standard|1|normal');
});
