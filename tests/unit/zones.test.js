// Landing zones: marking, removing, validity and the random fill of a salvo.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  toggleZone,
  canMarkZone,
  fillZones,
  clearZones,
  zonesFull,
  zoneIndexAt,
  zoneLimit,
  previewRoute,
} from '../../src/sim/zones.js';
import { routeExists, computeRoute } from '../../src/sim/route.js';
import { createRng } from '../../src/core/random.js';
import { createGameState } from '../../src/core/state.js';
import { PODS } from '../../src/data/pods.js';
import { setBlocked, isBlocked } from '../../src/sim/grid.js';
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

// The bastion sits behind a wall with a two-cell gate; closing both cells cuts it off.
const GATE = [
  '....#.....',
  '.1..#...2.',
  '....#.....',
  '..........',
  'R...#....B',
  '....#.....',
  '..........',
  '....#.....',
  '.4..#...3.',
  '....#.....',
];

test('marking and removing zones, at most a full salvo', () => {
  const state = planningState(mapFromAscii(OPEN));
  const limit = zoneLimit(state);
  for (let i = 0; i < limit; i++) {
    assert.deepEqual(toggleZone(state, { x: i, y: 6 }), { ok: true, action: 'added' }, `zone ${i}`);
  }
  assert.ok(zonesFull(state));
  assert.deepEqual(toggleZone(state, { x: 7, y: 6 }), { ok: false, reason: 'full' });

  assert.deepEqual(toggleZone(state, { x: 2, y: 6 }), { ok: true, action: 'removed' });
  assert.equal(state.zones.length, limit - 1);
  assert.equal(zoneIndexAt(state, { x: 2, y: 6 }), -1);
  assert.deepEqual(toggleZone(state, { x: 7, y: 6 }), { ok: true, action: 'added' });

  clearZones(state);
  assert.equal(state.zones.length, 0);
});

test('zones are refused outside, on protected cells, on obstacles and outside planning', () => {
  const map = mapFromAscii(OPEN);
  const state = planningState(map);
  map.protected[6 * map.size + 6] = 1;
  setBlocked(map.grid, 3, 3, true);

  assert.deepEqual(canMarkZone(state, { x: -1, y: 4 }), { ok: false, reason: 'outside' });
  assert.deepEqual(canMarkZone(state, { x: 6, y: 6 }), { ok: false, reason: 'protected' });
  assert.deepEqual(canMarkZone(state, { x: 3, y: 3 }), { ok: false, reason: 'occupied' });

  state.phase = 'wave';
  assert.deepEqual(canMarkZone(state, { x: 2, y: 2 }), { ok: false, reason: 'phase' });
  assert.deepEqual(toggleZone(state, { x: 2, y: 2 }), { ok: false, reason: 'phase' });
});

test('zones are checked together, not one by one', () => {
  const state = planningState(mapFromAscii(GATE));
  const upper = { x: 4, y: 3 };
  const lower = { x: 4, y: 6 };
  // Each gate cell on its own is fine.
  assert.deepEqual(canMarkZone(state, upper), { ok: true });
  assert.deepEqual(canMarkZone(state, lower), { ok: true });
  assert.deepEqual(toggleZone(state, upper), { ok: true, action: 'added' });
  // Together they would close the wall, so the second one is refused.
  assert.deepEqual(canMarkZone(state, lower), { ok: false, reason: 'blocks' });
  assert.deepEqual(toggleZone(state, lower), { ok: false, reason: 'blocks' });
  assert.equal(state.zones.length, 1);
});

test('a refused zone leaves the grid untouched', () => {
  const state = planningState(mapFromAscii(GATE));
  toggleZone(state, { x: 4, y: 3 });
  toggleZone(state, { x: 4, y: 6 });
  assert.ok(routeExists(state.map), 'route still open');
  // The wall in GATE has eight cells; rows 3 and 6 are the gate.
  assert.equal(state.map.grid.blocked.reduce((a, b) => a + b, 0), 8, 'only the wall is blocked');
});

test('fillZones completes the salvo and keeps the player marks', () => {
  const state = planningState(mapFromAscii(OPEN));
  toggleZone(state, { x: 2, y: 6 });
  const limit = zoneLimit(state);
  const added = fillZones(state, createRng('FILL'));
  assert.equal(added, limit - 1);
  assert.equal(state.zones.length, limit);
  assert.deepEqual(state.zones[0], { x: 2, y: 6 }, 'the marked zone stays first');
  assert.equal(new Set(state.zones.map((z) => `${z.x},${z.y}`)).size, limit, 'no duplicates');
});

test('fillZones is deterministic for the same seed and situation', () => {
  const run = () => {
    const state = planningState(mapFromAscii(OPEN));
    fillZones(state, createRng('SALVO'));
    return state.zones;
  };
  assert.deepEqual(run(), run());
});

test('fillZones spreads the pods apart', () => {
  const state = planningState(mapFromAscii(OPEN));
  fillZones(state, createRng('SPREAD'));
  for (let i = 0; i < state.zones.length; i++) {
    for (let j = i + 1; j < state.zones.length; j++) {
      const d = Math.abs(state.zones[i].x - state.zones[j].x) + Math.abs(state.zones[i].y - state.zones[j].y);
      assert.ok(d >= PODS.minRandomDistance, `zones ${i} and ${j} are ${d} apart`);
    }
  }
});

test('over many seeds a filled salvo always leaves the route open', () => {
  for (let i = 0; i < 40; i++) {
    const state = createGameState(`Z${i}`);
    assert.equal(fillZones(state, createRng(`pods${i}`)), zoneLimit(state));
    for (const z of state.zones) setBlocked(state.map.grid, z.x, z.y, true);
    assert.ok(routeExists(state.map), `seed Z${i}: route open after the salvo`);
    for (const z of state.zones) setBlocked(state.map.grid, z.x, z.y, false);
  }
});

test('the route preview follows every marker', () => {
  const state = planningState(mapFromAscii(OPEN));
  state.route = computeRoute(state.map);
  assert.equal(previewRoute(state), state.route, 'without zones the real route is shown');

  const onRoute = state.route.cells[Math.floor(state.route.cells.length / 2)];
  toggleZone(state, onRoute);
  const preview = previewRoute(state);
  assert.ok(preview && preview !== state.route);
  assert.ok(!preview.cells.some((c) => c.x === onRoute.x && c.y === onRoute.y), 'preview avoids the zone');
  assert.ok(preview.length > state.route.length, `${preview.length} vs ${state.route.length}`);
  assert.ok(
    state.route.cells.some((c) => c.x === onRoute.x && c.y === onRoute.y),
    'the real route is untouched until the pods land',
  );
  assert.ok(!isBlocked(state.map.grid, onRoute.x, onRoute.y), 'the preview does not block the cell');

  toggleZone(state, onRoute);
  assert.equal(previewRoute(state), state.route, 'removing the marker clears the preview');
});

test('fillZones and clearZones keep the preview in step', () => {
  const state = planningState(mapFromAscii(OPEN));
  state.route = computeRoute(state.map);
  fillZones(state, createRng('PREVIEW'));
  assert.ok(state.zonePreview, 'preview after filling the salvo');
  for (const zone of state.zones) {
    assert.ok(!state.zonePreview.cells.some((c) => c.x === zone.x && c.y === zone.y), 'preview avoids every zone');
  }
  clearZones(state);
  assert.equal(state.zonePreview, null);
});
