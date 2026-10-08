// The promise M6 rests on: changing a balancing value must not change the map
// or what is in the pods.
//
// Without it, replaying a recorded match with new numbers would compare two
// different matches — a different maze, different capsules — and every
// difference in the outcome would be unreadable. The map and the capsules come
// from their own branches of the seeded generator (`fork('map')`,
// `fork('pods').fork(wave)`), and this test holds that apart from the values M6
// is going to tune.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createGameState } from '../../src/core/state.js';
import { salvoRng, rollPod, upcomingWave } from '../../src/sim/pods.js';
import { DOCTRINES } from '../../src/data/doctrines.js';
import { DAMAGE_MATRIX } from '../../src/data/combat.js';
import { ENEMIES, BOSSES } from '../../src/data/enemies.js';
import { ECONOMY } from '../../src/data/economy.js';
import { SPECIALS } from '../../src/data/specials.js';
import { RANKS } from '../../src/data/ranks.js';
import { RULES } from '../../src/data/rules.js';
import { KOLOSS } from '../../src/data/enemies.js';
import { SUPPLY_LEVELS } from '../../src/data/supply.js';
import { WAVES } from '../../src/data/waves.js';

const SEEDS = ['BASTION', 'PROTOKOLL', 'RIFT42', 'M6', 'TILL'];

/** Everything about a map that decides where the enemies can walk. */
function mapPrint(seed) {
  const { map } = createGameState(seed);
  return JSON.stringify({
    size: map.size,
    rift: map.rift,
    bastion: map.bastion,
    beacons: map.beacons,
    obstacles: map.obstacles.map((o) => ({ kind: o.kind, cells: o.cells })),
    blocked: [...map.grid.blocked],
  });
}

/**
 * What every salvo of a whole match would hold. Read straight from the streams
 * rather than by playing, so the print does not depend on how a player behaved.
 */
function podPrint(seed) {
  const out = [];
  for (let wave = 1; wave <= WAVES.length; wave++) {
    const rng = salvoRng({ seed, wave: wave - 1 }).fork('contents');
    for (let supply = 1; supply <= SUPPLY_LEVELS.length; supply++) {
      for (let pod = 0; pod < 6; pod++) out.push(rollPod(rng, supply));
    }
  }
  return JSON.stringify(out);
}

/** Runs `change`, takes the prints, and puts every touched value back. */
function withChange(change) {
  const undo = change();
  try {
    return { maps: SEEDS.map(mapPrint), pods: SEEDS.map(podPrint) };
  } finally {
    undo();
  }
}

/** Sets one field of an object and hands back the function that restores it. */
function set(object, key, value) {
  const before = object[key];
  object[key] = value;
  return () => {
    object[key] = before;
  };
}

test('the pod stream only depends on the seed and the wave', () => {
  // The wave, not the state: two states in completely different shape must draw
  // the same capsules as long as they are working towards the same wave.
  const lean = { seed: 'BASTION', wave: 6 };
  const rich = { seed: 'BASTION', wave: 6, requisition: 9999, towers: [1, 2, 3], zones: [{ x: 1, y: 1 }] };
  assert.equal(upcomingWave(lean), 7);
  const a = salvoRng(lean).fork('contents');
  const b = salvoRng(rich).fork('contents');
  for (let i = 0; i < 20; i++) assert.deepEqual(rollPod(a, 4), rollPod(b, 4));
});

test('changing combat, economy or rule values moves neither map nor pods', () => {
  const before = withChange(() => () => {});

  const changes = [
    ['a doctrine damage', () => set(DOCTRINES.autocannon, 'damage', 99)],
    ['a doctrine range', () => set(DOCTRINES.laser, 'range', 12)],
    ['a matrix factor', () => set(DAMAGE_MATRIX.tesla, 'plate', 2.5)],
    ['enemy health', () => set(ENEMIES.warrior, 'health', 4000)],
    ['enemy speed', () => set(ENEMIES.swarmer, 'speed', 0.1)],
    ['enemy reward', () => set(ENEMIES.breaker, 'reward', 250)],
    ['boss health', () => set(BOSSES.broodmother, 'health', 1)],
    ['a special tower', () => set(SPECIALS.stormBattery, 'damage', 140)],
    ['the rank ladder', () => set(RANKS[4], 'damage', 99)],
    ['the rubble price', () => set(ECONOMY, 'rubbleCost', 500)],
    ['the wave bonus', () => set(ECONOMY, 'waveBonusBase', 400)],
    ['the bulwark price', () => set(ECONOMY, 'bulwarkCostFactor', 9)],
    ['starting lives', () => set(RULES, 'startLives', 3)],
    ['the Koloss', () => set(KOLOSS, 'health', 1)],
  ];

  for (const [what, change] of changes) {
    const after = withChange(change);
    assert.deepEqual(after.maps, before.maps, `the map moved after changing ${what}`);
    assert.deepEqual(after.pods, before.pods, `the pods moved after changing ${what}`);
  }

  // And everything is back where it was, so no other test inherits a change.
  const restored = withChange(() => () => {});
  assert.deepEqual(restored.maps, before.maps);
  assert.deepEqual(restored.pods, before.pods);
});

test('the supply ladder is an input to the draw, on purpose', () => {
  // The counter-example, so nobody later "fixes" this by seeding it away: the
  // rank percentages of a supply level are what the draw reads. Tuning them is
  // meant to change what comes down, and a protocol replayed with new
  // percentages therefore holds different capsules — which is the point.
  const before = podPrint('BASTION');
  const level = SUPPLY_LEVELS[3];
  const undo = set(level, 'weights', [0, 0, 0, 0, 100]);
  try {
    assert.notEqual(podPrint('BASTION'), before, 'changed percentages change the draw');
  } finally {
    undo();
  }
  assert.equal(podPrint('BASTION'), before, 'and the values are back');
});

test('the simulation uses no arithmetic an engine may round its own way', () => {
  // + - * / and Math.sqrt are the same to the bit everywhere; Math.hypot, the
  // trigonometry, exp, log and ** are left to the engine. A match recorded on
  // an iPad (WebKit) has to replay in node (7EJY6Y, 08.10.2026). Comments are
  // stripped first, so a doc comment may still name them.
  const banned = /Math\.(hypot|sin|cos|tan|asin|acos|atan2?|exp|expm1|log(1p|2|10)?|pow|cbrt|sinh|cosh|tanh)\b|[\w)\]]\s*\*\*\s*[\w(]/;
  const offenders = [];
  for (const dir of ['sim', 'core']) {
    const root = new URL(`../../src/${dir}/`, import.meta.url);
    for (const name of readdirSync(root).filter((f) => f.endsWith('.js'))) {
      const code = readFileSync(new URL(name, root), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      code.split('\n').forEach((line, i) => {
        if (banned.test(line)) offenders.push(`src/${dir}/${name}:${i + 1}: ${line.trim()}`);
      });
    }
  }
  assert.deepEqual(offenders, []);
});
