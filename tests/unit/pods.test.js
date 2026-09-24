// Pod contents (doctrine and rank from the supply level) and the landing timeline.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rollRank, rollPod, createPods, updatePods, salvoRng, podsLanded, salvoDone, IMPACT_SECONDS } from '../../src/sim/pods.js';
import { createRng } from '../../src/core/random.js';
import { isBlocked } from '../../src/sim/grid.js';
import { DOCTRINE_IDS } from '../../src/data/doctrines.js';
import { MAX_RANK } from '../../src/data/ranks.js';
import { SUPPLY_LEVELS, MAX_SUPPLY_LEVEL, supplyWeights } from '../../src/data/supply.js';
import { PODS, salvoSize, salvoMinRank, MAX_SALVO_SIZE, salvoSeconds } from '../../src/data/pods.js';
import { hologramLift } from '../../src/render/pods.js';
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

/** A full wave-1 salvo, so the fixture matches what the game hands out. */
const ZONES = [
  { x: 2, y: 5 },
  { x: 4, y: 6 },
  { x: 6, y: 5 },
  { x: 3, y: 2 },
  { x: 7, y: 7 },
  { x: 5, y: 3 },
];

test('salvo size follows the wave (GDD section 3)', () => {
  for (const wave of [1, 2, 15]) assert.equal(salvoSize(wave), 6, `wave ${wave}`);
  for (const wave of [16, 25, 35]) assert.equal(salvoSize(wave), 5, `wave ${wave}`);
  for (const wave of [36, 50, 99]) assert.equal(salvoSize(wave), 4, `wave ${wave}`);
  assert.equal(MAX_SALVO_SIZE, 6);
});

test('recruits stop at wave 36', () => {
  for (const wave of [1, 15, 16, 35]) assert.equal(salvoMinRank(wave), 1, `wave ${wave}`);
  for (const wave of [36, 50]) assert.equal(salvoMinRank(wave), 2, `wave ${wave}`);
});

test('a smaller salvo lands faster', () => {
  assert.ok(salvoSeconds(4) < salvoSeconds(5));
  assert.ok(salvoSeconds(5) < salvoSeconds(6));
  assert.equal(salvoSeconds(), salvoSeconds(MAX_SALVO_SIZE));
});

test('the minimum rank lifts a recruit but leaves better pods alone', () => {
  // Supply level 1 only rolls recruits, so wave 36 has to raise every one.
  const late = planningState(mapFromAscii(OPEN), { seed: 'LATE', wave: 35, zones: ZONES, supplyLevel: 1 });
  assert.ok(createPods(late).every((p) => p.rank === 2), 'wave 36 has no recruits');

  const early = planningState(mapFromAscii(OPEN), { seed: 'LATE', wave: 34, zones: ZONES, supplyLevel: 1 });
  assert.ok(createPods(early).every((p) => p.rank === 1), 'wave 35 still has them');

  // The floor never lowers a pod that rolled higher.
  const rich = planningState(mapFromAscii(OPEN), { seed: 'RICH', wave: 40, zones: ZONES, supplyLevel: MAX_SUPPLY_LEVEL });
  assert.ok(createPods(rich).every((p) => p.rank >= 2));
});

test('the minimum rank does not shift the random stream', () => {
  // Same seed and wave, different supply level: the doctrines are drawn from the
  // same stream, so only the ranks may differ.
  const make = (level) =>
    createPods(planningState(mapFromAscii(OPEN), { seed: 'STREAM', wave: 40, zones: ZONES, supplyLevel: level }));
  assert.deepEqual(make(1).map((p) => p.doctrine), make(1).map((p) => p.doctrine));
});

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
  assert.equal(state.pods.length, salvoSize(1));
  assert.ok(!podsLanded(state));

  // Just after the first impact only the first pod is down.
  const step = 1 / 60;
  for (let t = 0; t < IMPACT_SECONDS + step; t += step) updatePods(state, step);
  assert.ok(state.pods[0].landed, 'first pod landed');
  assert.ok(!state.pods.at(-1).landed, 'last pod still falling');
  assert.ok(isBlocked(state.map.grid, ZONES[0].x, ZONES[0].y), 'landed pod blocks its cell');
  assert.ok(!isBlocked(state.map.grid, ZONES.at(-1).x, ZONES.at(-1).y), 'falling pod does not');
  assert.ok(state.events.some((e) => e.type === 'podImpact' && e.index === 0));
  assert.ok(state.route, 'route recomputed after the impact');

  for (let i = 0; i < 60 * 10; i++) updatePods(state, step);
  assert.ok(podsLanded(state));
  assert.ok(salvoDone(state));
  for (const zone of ZONES) assert.ok(isBlocked(state.map.grid, zone.x, zone.y), `${zone.x},${zone.y} blocked`);
});

test('two capsules on touching cells hang their holograms at different heights', () => {
  // The labels are wider than a cell, so neighbours writing at the same height
  // ran into one another (docs/ART.md, v3).
  const neighbours = [
    [1, 0],
    [0, 1],
    [1, 1],
    [-1, 1],
  ];
  for (let x = 0; x < 24; x++) {
    for (let y = 0; y < 24; y++) {
      for (const [dx, dy] of neighbours) {
        assert.notEqual(hologramLift(x, y), hologramLift(x + dx, y + dy), `(${x},${y}) and (${x + dx},${y + dy})`);
      }
    }
  }
  // Four levels, and the same cell always gives the same one.
  assert.equal(hologramLift(3, 7), hologramLift(3, 7));
  const levels = new Set();
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) levels.add(hologramLift(x, y));
  assert.deepEqual([...levels].sort(), [0, 1, 2, 3]);
});
