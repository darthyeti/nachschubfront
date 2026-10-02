// King of the Hill (M7b): the map, its routes and the rift taking turns.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../../src/core/state.js';
import { generateMap } from '../../src/sim/mapgen.js';
import { computeRoute, checkPlacement, routeExists, flyerPolyline } from '../../src/sim/route.js';
import { distanceField, descend, findPath } from '../../src/sim/pathfinding.js';
import { createRng } from '../../src/core/random.js';
import { isBlocked, setBlocked } from '../../src/sim/grid.js';
import { riftForWave, syncRift } from '../../src/sim/rifts.js';
import { beginWave } from '../../src/sim/waves.js';
import { spawnEnemy } from '../../src/sim/enemies.js';
import { zoneLimit } from '../../src/sim/zones.js';
import { KOTH_MAP } from '../../src/data/map.js';
import { MODES } from '../../src/data/modes.js';
import { WAVES } from '../../src/data/waves.js';

const SEEDS = ['BASTION', 'HUEGEL', 'KOENIG', 'M7B', 'X1', 'RISS', 'NORD', 'SUED'];
const koth = (seed) => createGameState(seed, { mode: 'koth' });
const at = (map, x, y) => y * map.size + x;
const isBastion = (map, c) => map.bastionCells.some((b) => b.x === c.x && b.y === c.y);

test('the bastion sits in the middle, a rift with two gates on every edge, no beacons', () => {
  const { map } = koth('BASTION');
  assert.equal(map.size, 24);
  assert.deepEqual(map.bastionCells, [{ x: 11, y: 11 }, { x: 12, y: 11 }, { x: 11, y: 12 }, { x: 12, y: 12 }]);
  assert.deepEqual(map.rifts.map((r) => r.gates), [
    [{ x: 11, y: 0 }, { x: 12, y: 0 }],
    [{ x: 23, y: 11 }, { x: 23, y: 12 }],
    [{ x: 11, y: 23 }, { x: 12, y: 23 }],
    [{ x: 0, y: 11 }, { x: 0, y: 12 }],
  ]);
  assert.deepEqual(map.beacons, []);
});

test('bastion, gates and one ring around them, and the whole ban zone, are protected', () => {
  const { map } = koth('BASTION');
  for (const c of [...map.bastionCells, ...map.rifts.flatMap((r) => r.gates)]) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = c.x + dx;
        const y = c.y + dy;
        if (x >= 0 && y >= 0 && x < 24 && y < 24) assert.equal(map.protected[at(map, x, y)], 1, `${x},${y}`);
      }
    }
  }
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 24; x++) {
      const inside = Math.hypot(x + 0.5 - 12, y + 0.5 - 12) <= 4;
      assert.equal(map.banned[at(map, x, y)], inside ? 1 : 0, `${x},${y}`);
      if (inside) assert.equal(map.protected[at(map, x, y)], 1);
    }
  }
  assert.equal(map.banned[at(map, 8, 12)], 1, 'centre 3.54 away: banned');
  assert.equal(map.banned[at(map, 7, 12)], 0, 'centre 4.53 away: free');
});

test('a cell whose centre lies exactly on the radius is banned', () => {
  // With radius 4 no cell centre lies exactly on it (half-integer offsets never
  // sum to 16 in squares), so the inclusive edge is shown on a radius that hits one.
  const radius = Math.hypot(3.5, 0.5);
  const map = generateMap(createRng('RAND').fork('map'), { ...KOTH_MAP, banRadius: radius });
  assert.equal(map.banned[at(map, 8, 11)], 1);
});

test('12 to 20 ruins, never on protected ground, and every gate of every rift reaches the bastion', () => {
  for (const seed of SEEDS) {
    const { map } = koth(seed);
    assert.ok(map.obstacles.length >= 12 && map.obstacles.length <= 20, `${seed}: ${map.obstacles.length}`);
    for (const o of map.obstacles) {
      assert.equal(o.cells.length, 1);
      for (const c of o.cells) assert.equal(map.protected[at(map, c.x, c.y)], 0, `${seed}: ruin on protected ${c.x},${c.y}`);
    }
    for (const rift of map.rifts) {
      for (const gate of rift.gates) assert.ok(findPath(map.grid, gate, map.bastionCells[0]), `${seed}: ${rift.id}`);
    }
    assert.ok(routeExists(map));
  }
});

test('the same seed gives the same map; the standard map is not touched by any of this', () => {
  const a = koth('GLEICH');
  const b = koth('GLEICH');
  assert.deepEqual([...a.map.grid.blocked], [...b.map.grid.blocked]);
  assert.deepEqual(a.route, b.route);
  const standard = createGameState('GLEICH');
  assert.equal(standard.map.rifts, undefined);
  assert.equal(standard.riftIndex, 0);
});

test('one distance field: each rift walks down it to a bastion cell, one lane per gate', () => {
  const { map } = koth('BASTION');
  const field = distanceField(map.grid, map.bastionCells);
  map.rifts.forEach((rift, index) => {
    const route = computeRoute(map, index);
    assert.equal(route.lanes.length, 2);
    route.lanes.forEach((lane, g) => {
      assert.deepEqual(lane.cells[0], rift.gates[g]);
      assert.ok(isBastion(map, lane.cells.at(-1)), `${rift.id} ends on the bastion`);
      assert.equal(lane.length, field[at(map, rift.gates[g].x, rift.gates[g].y)]);
      // As short as A* finds to the nearest bastion cell.
      const best = Math.min(...map.bastionCells.map((b) => findPath(map.grid, rift.gates[g], b).length));
      assert.ok(Math.abs(lane.length - best) < 1e-9, `${rift.id} gate ${g}: ${lane.length} vs ${best}`);
      for (const c of lane.cells) assert.ok(!isBlocked(map.grid, c.x, c.y));
    });
    assert.deepEqual(route.cells, route.lanes[0].cells, 'the route is its first lane');
  });
});

test('the way down a field never cuts a corner', () => {
  const grid = { size: 3, blocked: new Uint8Array(9) };
  setBlocked(grid, 1, 0, true);
  const field = distanceField(grid, [{ x: 2, y: 0 }]);
  const path = descend(grid, field, { x: 0, y: 0 });
  // (0,0) -> (1,1) would squeeze past the block at (1,0).
  for (let i = 1; i < path.cells.length; i++) {
    const a = path.cells[i - 1];
    const b = path.cells[i];
    if (a.x !== b.x && a.y !== b.y) assert.ok(!isBlocked(grid, b.x, a.y) && !isBlocked(grid, a.x, b.y));
  }
  assert.equal(descend(grid, distanceField(grid, []), { x: 0, y: 0 }), null, 'no goal, no way');
});

test('flyers go straight from the middle of the rift to the middle of the bastion', () => {
  const { map } = koth('BASTION');
  const line = flyerPolyline(map, 1);
  assert.deepEqual(line.points, [{ x: 23.5, y: 12 }, { x: 12, y: 12 }]);
  for (let i = 0; i < 4; i++) {
    const { points } = flyerPolyline(map, i);
    for (const p of points) assert.ok(p.x >= 0 && p.y >= 0 && p.x <= 24 && p.y <= 24, 'never off the map');
  }
});

test('a landing that cuts off any rift is refused, the one not attacking as well', () => {
  const { map } = koth('BASTION');
  // A wall across row 3 shuts the north rift out and leaves the others open.
  const wall = [];
  for (let x = 0; x < 24; x++) if (!isBlocked(map.grid, x, 3)) wall.push({ x, y: 3 });
  assert.deepEqual(checkPlacement(map, wall), { ok: false, reason: 'blocks' });
  // Checked as a set: all but one cell of the wall is fine.
  assert.deepEqual(checkPlacement(map, wall.slice(1)), { ok: true });
  assert.deepEqual(checkPlacement(map, [{ x: 12, y: 9 }]), { ok: false, reason: 'protected' }, 'ban zone');
});

test('the match plans against the rift of the coming wave and moves on with it', () => {
  const state = koth('BASTION');
  assert.equal(state.riftIndex, riftForWave(state, 1));
  assert.deepEqual(state.map.rift, state.map.rifts[state.riftIndex].gates[0]);
  assert.deepEqual(state.route, computeRoute(state.map, state.riftIndex));

  state.wave = 1;
  const version = state.mapVersion;
  assert.equal(syncRift(state), true, 'a mixed order never repeats a rift');
  assert.equal(state.riftIndex, riftForWave(state, 2));
  assert.deepEqual(state.map.rift, state.map.rifts[state.riftIndex].gates[0]);
  assert.deepEqual(state.route, computeRoute(state.map, state.riftIndex));
  assert.equal(state.mapVersion, version + 1);
});

test('ground enemies come out of the two gates in turn; flyers from the rift itself', () => {
  const state = koth('BASTION');
  beginWave(state);
  const a = spawnEnemy(state, 'swarmer');
  const b = spawnEnemy(state, 'swarmer');
  const c = spawnEnemy(state, 'swarmer');
  assert.deepEqual([a.lane, b.lane, c.lane], [0, 1, 0]);
  const gates = state.map.rifts[state.riftIndex].gates;
  assert.deepEqual([a.x, a.y], [gates[0].x + 0.5, gates[0].y + 0.5]);
  assert.deepEqual([b.x, b.y], [gates[1].x + 0.5, gates[1].y + 0.5]);
});

test('the mode values reach the match: health factor, starting requisition, salvo of 8', () => {
  const state = koth('BASTION');
  assert.equal(state.requisition, 30);
  assert.equal(zoneLimit(state), 8);
  beginWave(state);
  assert.equal(state.waveScale, WAVES[0].scale * MODES.koth.balance.enemyHpFactor);
  assert.equal(zoneLimit(state), 6, 'wave 2 is back to the standard six');
  const standard = createGameState('BASTION');
  beginWave(standard);
  assert.equal(standard.waveScale, WAVES[0].scale, 'the standard factor is exactly 1');
});
