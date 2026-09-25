// The Koloss (GDD section 9, v3): the announcement, the prediction, the ram and
// what the maze looks like afterwards.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGameState } from '../../src/core/state.js';
import {
  kolossStage,
  nextKolossWave,
  isKolossWave,
  firepowerAt,
  predictTarget,
  updateKoloss,
  spawnKoloss,
  breachPath,
  breach,
  updateKolossRun,
} from '../../src/sim/koloss.js';
import { addTower } from '../../src/sim/towers.js';
import { addRubble, isRubble, raiseBulwark } from '../../src/sim/rubble.js';
import { computeRoute, groundPolyline, flyerPolyline } from '../../src/sim/route.js';
import { isBlocked } from '../../src/sim/grid.js';
import { updateEnemies } from '../../src/sim/enemies.js';
import { KOLOSS_RUN } from '../../src/data/enemies.js';
import { RULES } from '../../src/data/rules.js';
import { SIM_STEP } from '../../src/data/settings.js';

function planning(seed = 'KOLOSS') {
  const state = createGameState(seed);
  state.phase = 'planning';
  state.lives = 100000;
  return state;
}

// ---------- The announcement ----------

test('the run announces itself two waves out and fixes its target on arrival', () => {
  const [first] = KOLOSS_RUN.waves;
  assert.equal(kolossStage(first - 3), 'none');
  assert.equal(kolossStage(first - 2), 'warning');
  assert.equal(kolossStage(first - 1), 'predicted');
  assert.equal(kolossStage(first), 'arrived');
  assert.equal(nextKolossWave(first), first);
  assert.equal(nextKolossWave(KOLOSS_RUN.waves[KOLOSS_RUN.waves.length - 1] + 1), null);
  assert.equal(isKolossWave(first), true);
  assert.equal(isKolossWave(first + 1), false);
});

test('the warning carries no target, the prediction does', () => {
  const [first] = KOLOSS_RUN.waves;
  const state = planning();

  // While planning, the wave being measured is the one the salvo prepares, so
  // state.wave is one behind the wave the stage talks about.
  state.wave = first - 4;
  updateKoloss(state);
  assert.equal(state.koloss, null, 'nothing on the horizon yet');

  state.wave = first - 3;
  updateKoloss(state);
  assert.equal(state.koloss.stage, 'warning');
  assert.equal(state.koloss.target, null, 'no target two waves out (GDD section 9)');

  state.wave = first - 2;
  updateKoloss(state);
  assert.equal(state.koloss.stage, 'predicted');
  assert.ok(state.koloss.target, 'one wave out the spot is named');
  assert.ok(
    state.route.cells.some((c) => c.x === state.koloss.target.x && c.y === state.koloss.target.y),
    'and it lies on the way to the bastion',
  );
});

// ---------- The prediction ----------

test('the prediction picks the weakest place and moves when it is reinforced', () => {
  const [first] = KOLOSS_RUN.waves;
  const state = planning();
  // Planning measures the wave the salvo prepares, so this is one wave out.
  state.wave = first - 2;
  updateKoloss(state);
  assert.equal(state.koloss.stage, 'predicted');
  const before = { ...state.koloss.target };
  assert.equal(firepowerAt(state, before), 0, 'an empty map has no firepower anywhere');

  // An emplacement that covers the marked spot: the prediction has to move off it.
  addTower(state, { x: before.x, y: before.y + 1, doctrine: 'laser', rank: 3 });
  state.mapVersion += 1;
  state.route = computeRoute(state.map);
  updateKoloss(state);
  assert.ok(firepowerAt(state, before) > 0, 'the spot is covered now');
  assert.notDeepEqual({ x: state.koloss.target.x, y: state.koloss.target.y }, before, 'the marker moved');
});

test('a bulwark beside the marked spot counts as reinforcement', () => {
  const [first] = KOLOSS_RUN.waves;
  const state = planning();
  state.wave = first - 2;
  updateKoloss(state);
  const target = { ...state.koloss.target };

  const beside = { x: target.x + 1, y: target.y };
  addRubble(state, beside);
  assert.equal(firepowerAt(state, target), 0, 'rubble on its own is worth nothing');
  raiseBulwark(state, beside);
  assert.equal(firepowerAt(state, target), KOLOSS_RUN.bulwarkFirepower, 'the bulwark is');

  state.mapVersion += 1;
  updateKoloss(state);
  assert.notDeepEqual({ x: state.koloss.target.x, y: state.koloss.target.y }, target, 'the marker moved');
});

test('the prediction is not recomputed while nothing changes', () => {
  const [first] = KOLOSS_RUN.waves;
  const state = planning();
  state.wave = first - 2;
  updateKoloss(state);
  const first_target = state.koloss.target;
  updateKoloss(state);
  assert.equal(state.koloss.target, first_target, 'same object: no sweep was run');
});

test('the marker stays live through the last planning phase and freezes at wave start', () => {
  const [first] = KOLOSS_RUN.waves;
  const state = planning();
  // Planning the wave the Koloss lands in: the player still gets to react.
  state.wave = first - 1;
  updateKoloss(state);
  assert.equal(state.koloss.stage, 'arrived');
  const before = { ...state.koloss.target };
  addTower(state, { x: before.x, y: before.y + 1, doctrine: 'laser', rank: 3 });
  state.mapVersion += 1;
  state.route = computeRoute(state.map);
  updateKoloss(state);
  assert.notDeepEqual({ x: state.koloss.target.x, y: state.koloss.target.y }, before, 'it still moves');

  // Once the wave runs, it is fixed whatever the player builds.
  state.phase = 'wave';
  state.wave = first;
  updateKoloss(state);
  const fixed = { ...state.koloss.target };
  addTower(state, { x: fixed.x, y: fixed.y + 1, doctrine: 'laser', rank: 5 });
  state.mapVersion += 1;
  updateKoloss(state);
  assert.deepEqual({ x: state.koloss.target.x, y: state.koloss.target.y }, fixed, 'and now it is fixed');
});

// ---------- The ram ----------

/** A state in the wave of the Koloss, with it standing on `cell`. */
function arrived(cell) {
  const state = planning();
  const [first] = KOLOSS_RUN.waves;
  state.wave = first;
  state.phase = 'wave';
  state.waveScale = 1;
  state.waveStats = { spawned: 0, leaked: 0, killed: 0, bossKills: 0 };
  state.waveRoutes = { ground: groundPolyline(state.route), flyer: flyerPolyline(state.map) };
  updateKoloss(state);
  state.koloss.target = { ...cell };
  const e = spawnKoloss(state);
  return { state, e };
}

test('the swathe clears rubble and runs the length the table gives', () => {
  const cell = { x: 6, y: 6 };
  const { state, e } = arrived(cell);
  // A row of rubble in front of it, longer than the ram can reach.
  for (let i = 0; i < KOLOSS_RUN.breachCells + 3; i++) addRubble(state, { x: cell.x + i, y: cell.y });

  const { cells, stoppedBy } = breachPath(state, cell, 1, 0);
  assert.equal(cells.length, KOLOSS_RUN.breachCells, 'five cells, no more');
  assert.equal(stoppedBy, null);

  e.x = cell.x + 0.5;
  e.y = cell.y + 0.5;
  e.dx = 1;
  e.dy = 0;
  breach(state, e);
  for (let i = 0; i < KOLOSS_RUN.breachCells; i++) {
    assert.equal(isRubble(state.map, { x: cell.x + i, y: cell.y }), false, `cell ${i} was torn open`);
    assert.equal(isBlocked(state.map.grid, cell.x + i, cell.y), false, `cell ${i} is free`);
  }
  assert.equal(
    isRubble(state.map, { x: cell.x + KOLOSS_RUN.breachCells, y: cell.y }),
    true,
    'and the heap past the end of the run is untouched',
  );
});

test('a bulwark stops the swathe where it stands, rubble does not', () => {
  const cell = { x: 6, y: 6 };
  const { state } = arrived(cell);
  for (let i = 0; i < KOLOSS_RUN.breachCells; i++) addRubble(state, { x: cell.x + i, y: cell.y });
  raiseBulwark(state, { x: cell.x + 2, y: cell.y });

  const { cells, stoppedBy } = breachPath(state, cell, 1, 0);
  assert.equal(stoppedBy, 'bulwark');
  assert.equal(cells.length, 2, 'it gets through the two heaps in front of the bulwark and no further');
});

test('an emplacement stops the swathe as well, and is not torn down', () => {
  const cell = { x: 6, y: 6 };
  const { state } = arrived(cell);
  addTower(state, { x: cell.x + 1, y: cell.y, doctrine: 'laser', rank: 1 });
  const { cells, stoppedBy } = breachPath(state, cell, 1, 0);
  assert.equal(stoppedBy, 'tower');
  assert.equal(cells.length, 1);
  assert.equal(state.towers.length, 1, 'the emplacement is still standing');
});

test('the route is open again after the ram, and the Koloss walks it', () => {
  const cell = { x: 6, y: 6 };
  const { state, e } = arrived(cell);
  e.x = cell.x + 0.5;
  e.y = cell.y + 0.5;
  e.dx = 1;
  e.dy = 0;
  breach(state, e);

  assert.equal(e.charging, false, 'the charge is over');
  assert.ok(e.route, 'it walks a route of its own');
  assert.equal(e.d, 0);
  const last = e.route.points[e.route.points.length - 1];
  assert.equal(Math.floor(last.x), state.map.bastion.x, 'which ends at the bastion');
  assert.equal(Math.floor(last.y), state.map.bastion.y);
  assert.ok(computeRoute(state.map), 'and every leg of the normal route still has a path');
  assert.equal(state.koloss.breached, true);
});

test('a charging Koloss does not leak, it rams', () => {
  const cell = { x: 6, y: 6 };
  const { state, e } = arrived(cell);
  assert.equal(e.charging, true);
  const lives = state.lives;
  // Drive it well past the end of its run: it must stop there, not break through.
  for (let i = 0; i < 40000 && e.charging; i++) {
    updateEnemies(state, SIM_STEP);
    updateKolossRun(state);
  }
  assert.equal(e.charging, false, 'it rammed');
  assert.equal(state.lives, lives, 'and the charge itself cost nothing');
  assert.equal(state.enemies.includes(e), true, 'it is still on the field');
});

test('letting the Koloss reach the bastion costs more than a boss', () => {
  const cell = { x: 6, y: 6 };
  const { state, e } = arrived(cell);
  breach(state, e);
  const lives = state.lives;
  for (let i = 0; i < 20000 && state.enemies.includes(e); i++) updateEnemies(state, SIM_STEP);
  assert.equal(state.enemies.includes(e), false, 'it got through');
  assert.equal(lives - state.lives, RULES.kolossLeakCost);
  assert.ok(RULES.kolossLeakCost > RULES.bossLeakCost);
});

// ---------- What it costs to compute ----------

test('the prediction stays cheap on a full late-game map', () => {
  // The order asks how expensive this gets when every build triggers it.
  const state = planning('LATE');
  state.wave = KOLOSS_RUN.waves[0] - 2;
  // Forty emplacements, the number the stress test uses for a busy late map.
  let placed = 0;
  for (let i = 0; placed < 40 && i < state.map.size * state.map.size; i += 7) {
    const x = i % state.map.size;
    const y = Math.floor(i / state.map.size);
    if (state.map.protected[y * state.map.size + x] || isBlocked(state.map.grid, x, y)) continue;
    addTower(state, { x, y, doctrine: 'laser', rank: 3 });
    placed += 1;
  }
  state.route = computeRoute(state.map);

  const start = performance.now();
  const runs = 200;
  for (let i = 0; i < runs; i++) predictTarget(state);
  const perRun = (performance.now() - start) / runs;
  // One sweep is route length times emplacements; it happens once per build.
  assert.ok(perRun < 5, `a prediction took ${perRun.toFixed(2)} ms`);
});
