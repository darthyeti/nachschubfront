// Pod contents (doctrine and rank from the supply level) and the landing timeline.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rollRank, rollPod, createPods, updatePods, salvoRng, podsLanded, salvoDone, IMPACT_SECONDS } from '../../src/sim/pods.js';
import { createRng } from '../../src/core/random.js';
import { isBlocked } from '../../src/sim/grid.js';
import { DOCTRINE_IDS } from '../../src/data/doctrines.js';
import { MAX_RANK } from '../../src/data/ranks.js';
import { SUPPLY_LEVELS, MAX_SUPPLY_LEVEL, supplyWeights } from '../../src/data/supply.js';
import { PODS } from '../../src/data/pods.js';
import { mapFromAscii, planningState } from './helpers.js';

const OPEN = [
  '..........',
  '.1......2.',
  '..........',
  '..........',
  'R........B',
  '..........',
  '..........',
  '..........',
  '.4......3.',
  '..........',
];

const ZONES = [
  { x: 2, y: 5 },
  { x: 4, y: 6 },
  { x: 6, y: 5 },
  { x: 3, y: 2 },
  { x: 7, y: 7 },
];

test('supply level 1 only hands out recruits', () => {
  const rng = createRng('RANK');
  for (let i = 0; i < 200; i++) assert.equal(rollRank(rng, 1), 1);
});

test('rolled ranks stay inside the table and follow its percentages', () => {
  for (const { level } of SUPPLY_LEVELS) {
    const rng = createRng(`L${level}`);
    const counts = new Array(MAX_RANK).fill(0);
    const samples = 20000;
    for (let i = 0; i < samples; i++) {
      const rank = rollRank(rng, level);
      assert.ok(rank >= 1 && rank <= MAX_RANK, `level ${level}: rank ${rank}`);
      counts[rank - 1]++;
    }
    supplyWeights(level).forEach((weight, i) => {
      const share = (counts[i] / samples) * 100;
      assert.ok(Math.abs(share - weight) < 1.5, `level ${level}, rank ${i + 1}: ${share.toFixed(1)} vs ${weight}`);
    });
  }
});

test('pods use known doctrines and repeat for the same stream', () => {
  const draw = () => {
    const rng = createRng('POD');
    return Array.from({ length: 10 }, () => rollPod(rng, MAX_SUPPLY_LEVEL));
  };
  const first = draw();
  for (const pod of first) assert.ok(DOCTRINE_IDS.includes(pod.doctrine), pod.doctrine);
  assert.deepEqual(draw(), first);
});

test('contents depend on seed and wave only, not on where the zones are', () => {
  const contents = (zones) => {
    const state = planningState(mapFromAscii(OPEN), { seed: 'SALVO', wave: 3, zones });
    return createPods(state).map(({ doctrine, rank }) => ({ doctrine, rank }));
  };
  const other = [...ZONES].reverse().map(({ x, y }) => ({ x: y, y: x }));
  assert.deepEqual(contents(other), contents(ZONES));

  const wave4 = planningState(mapFromAscii(OPEN), { seed: 'SALVO', wave: 4, zones: ZONES });
  assert.notDeepEqual(createPods(wave4).map((p) => p.doctrine), contents(ZONES).map((p) => p.doctrine));
});

test('salvo streams of different waves are independent', () => {
  const state = planningState(mapFromAscii(OPEN), { seed: 'FORK', wave: 1 });
  assert.notEqual(salvoRng(state).next(), salvoRng({ ...state, wave: 2 }).next());
});

test('pods land staggered, block their cell and reopen the route check', () => {
  const state = planningState(mapFromAscii(OPEN), { seed: 'LAND', zones: ZONES });
  createPods(state);
  assert.equal(state.pods.length, PODS.perSalvo);
  assert.ok(!podsLanded(state));

  // Just after the first impact only the first pod is down.
  const step = 1 / 60;
  for (let t = 0; t < IMPACT_SECONDS + step; t += step) updatePods(state, step);
  assert.ok(state.pods[0].landed, 'first pod landed');
  assert.ok(!state.pods[PODS.perSalvo - 1].landed, 'last pod still falling');
  assert.ok(isBlocked(state.map.grid, ZONES[0].x, ZONES[0].y), 'landed pod blocks its cell');
  assert.ok(!isBlocked(state.map.grid, ZONES[4].x, ZONES[4].y), 'falling pod does not');
  assert.ok(state.events.some((e) => e.type === 'podImpact' && e.index === 0));
  assert.ok(state.route, 'route recomputed after the impact');

  for (let i = 0; i < 60 * 10; i++) updatePods(state, step);
  assert.ok(podsLanded(state));
  assert.ok(salvoDone(state));
  for (const zone of ZONES) assert.ok(isBlocked(state.map.grid, zone.x, zone.y), `${zone.x},${zone.y} blocked`);
});
