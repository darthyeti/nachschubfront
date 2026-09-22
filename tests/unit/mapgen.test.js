import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMap } from '../../src/sim/mapgen.js';
import { computeRoute } from '../../src/sim/route.js';
import { createRng } from '../../src/core/random.js';
import { MAP } from '../../src/data/map.js';

const gen = (seed) => generateMap(createRng(seed).fork('map'));

function snapshot(map) {
  return JSON.stringify({
    rift: map.rift,
    bastion: map.bastion,
    beacons: map.beacons,
    obstacles: map.obstacles,
    blocked: [...map.grid.blocked],
  });
}

test('same seed gives the same map', () => {
  assert.equal(snapshot(gen('Bastion')), snapshot(gen('Bastion')));
  assert.equal(snapshot(gen(42)), snapshot(gen(42)));
});

test('different seeds give different maps', () => {
  assert.notEqual(snapshot(gen(1)), snapshot(gen(2)));
});

test('all four edges occur', () => {
  const edges = new Set();
  for (let s = 0; s < 100; s++) edges.add(gen(s).edge);
  assert.equal(edges.size, 4);
});

// Invariants over many seeds.
const SEEDS = Array.from({ length: 500 }, (_, i) => i);
const maps = SEEDS.map((s) => [s, gen(s)]);

test('rift and bastion sit on opposite edges', () => {
  const last = MAP.size - 1;
  const onEdge = (p) => p.x === 0 || p.y === 0 || p.x === last || p.y === last;
  for (const [seed, map] of maps) {
    assert.ok(onEdge(map.rift) && onEdge(map.bastion), `seed ${seed}`);
    const opposite =
      (map.rift.x === 0 && map.bastion.x === last) || (map.rift.x === last && map.bastion.x === 0) ||
      (map.rift.y === 0 && map.bastion.y === last) || (map.rift.y === last && map.bastion.y === 0);
    assert.ok(opposite, `seed ${seed}: rift ${JSON.stringify(map.rift)}, bastion ${JSON.stringify(map.bastion)}`);
  }
});

test('one beacon per quadrant', () => {
  const half = MAP.size / 2;
  for (const [seed, map] of maps) {
    const quadrants = new Set(map.beacons.map((b) => `${b.x < half ? 0 : 1}${b.y < half ? 0 : 1}`));
    assert.equal(quadrants.size, 4, `seed ${seed}`);
  }
});

test('beacon order makes the two diagonal legs cross', () => {
  // Legs 1 -> 2 and 3 -> 4 connect diagonally opposite quadrants.
  const half = MAP.size / 2;
  const q = (b) => [b.x < half ? 0 : 1, b.y < half ? 0 : 1];
  for (const [seed, map] of maps) {
    const [a, b, c, d] = map.beacons.map(q);
    assert.ok(a[0] !== b[0] && a[1] !== b[1], `seed ${seed}: 1 -> 2 not diagonal`);
    assert.ok(c[0] !== d[0] && c[1] !== d[1], `seed ${seed}: 3 -> 4 not diagonal`);
  }
});

test('obstacle count within range, never on protected cells', () => {
  for (const [seed, map] of maps) {
    const n = map.obstacles.length;
    assert.ok(n >= MAP.obstacleCount.min && n <= MAP.obstacleCount.max, `seed ${seed}: ${n} obstacles`);
    for (const o of map.obstacles) {
      for (const { x, y } of o.cells) {
        assert.equal(map.protected[y * map.size + x], 0, `seed ${seed}: obstacle on protected ${x},${y}`);
        assert.equal(map.grid.blocked[y * map.size + x], 1);
      }
    }
    const blockedCount = map.grid.blocked.reduce((a, b) => a + b, 0);
    const cellCount = map.obstacles.reduce((a, o) => a + o.cells.length, 0);
    assert.equal(blockedCount, cellCount, `seed ${seed}: grid matches obstacle list`);
  }
});

test('protected ring around rift, beacons and bastion', () => {
  for (const [seed, map] of maps) {
    for (const p of [map.rift, map.bastion, ...map.beacons]) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = p.x + dx;
          const y = p.y + dy;
          if (x < 0 || y < 0 || x >= map.size || y >= map.size) continue;
          assert.equal(map.protected[y * map.size + x], 1, `seed ${seed}: ${x},${y}`);
        }
      }
    }
  }
});

test('route over all beacons always exists', () => {
  for (const [seed, map] of maps) {
    assert.ok(computeRoute(map), `seed ${seed}`);
  }
});

test('wall remnants are 2-3 cells in a straight line', () => {
  for (const [, map] of maps) {
    for (const o of map.obstacles.filter((o) => o.kind === 'wall')) {
      assert.ok(o.cells.length >= 2 && o.cells.length <= 3);
      const xs = new Set(o.cells.map((c) => c.x));
      const ys = new Set(o.cells.map((c) => c.y));
      assert.ok(xs.size === 1 || ys.size === 1);
    }
  }
});
