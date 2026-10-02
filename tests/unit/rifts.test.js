// The order of the rifts in King of the Hill (M7b, B2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riftForWave, blockOrder, RIFT_ORDERS } from '../../src/sim/rifts.js';
import { createRng } from '../../src/core/random.js';
import { MODES } from '../../src/data/modes.js';

const SEEDS = ['BASTION', 'HUEGEL', 'KOENIG', 'M7B', 'X1', 'RISS'];
const koth = (seed, riftOrder = 'mixed') => ({ seed, mode: { ...MODES.koth, riftOrder } });
const order = (seed, riftOrder, waves = 50) =>
  Array.from({ length: waves }, (_, i) => riftForWave(koth(seed, riftOrder), i + 1));

test('mixed: every block of four holds all four rifts', () => {
  for (const seed of SEEDS) {
    const all = order(seed, 'mixed', 48);
    for (let b = 0; b < 12; b++) {
      assert.deepEqual([...all.slice(b * 4, b * 4 + 4)].sort(), [0, 1, 2, 3], `${seed}, block ${b}`);
    }
  }
});

test('mixed: the same rift never attacks twice in a row, not even across a block', () => {
  for (const seed of SEEDS) {
    const all = order(seed, 'mixed', 200);
    for (let w = 1; w < all.length; w++) assert.notEqual(all[w], all[w - 1], `${seed}, wave ${w + 1}`);
  }
});

test('mixed: the order hangs on seed and block alone, no other roll moves it', () => {
  const before = order('BASTION', 'mixed');
  // Draws on every other stream of the same seed, the way a match makes them.
  const rng = createRng('BASTION');
  for (const label of ['map', 'pods', 'rifts']) for (let i = 0; i < 1000; i++) rng.fork(label).next();
  assert.deepEqual(order('BASTION', 'mixed'), before);
  assert.deepEqual(blockOrder('BASTION', 3, 4), blockOrder('BASTION', 3, 4));
  assert.notDeepEqual(order('ANDERER', 'mixed'), before, 'another seed, another order');
});

test('cycle: strictly north, east, south, west', () => {
  assert.deepEqual(order('BASTION', 'cycle', 9), [0, 1, 2, 3, 0, 1, 2, 3, 0]);
});

test('a map with one rift always has rift 0', () => {
  assert.equal(riftForWave({ seed: 'X', mode: MODES.standard }, 17), 0);
});

test('an unknown order is a fault, not a quiet fallback', () => {
  assert.throws(() => riftForWave(koth('X', 'zufall'), 1), /Unknown rift order/);
  assert.deepEqual(Object.keys(RIFT_ORDERS).sort(), ['cycle', 'mixed']);
});
