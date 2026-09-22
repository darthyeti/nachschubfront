import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../../src/core/state.js';
import { canTransition, setPhase } from '../../src/core/phases.js';
import { stepSimulation } from '../../src/sim/step.js';
import { requestSalvo, chooseSelection, setSpeed, toggleObstacle, canRequestSalvo } from '../../src/sim/actions.js';
import { buildSpawns, totalWaves } from '../../src/sim/waves.js';
import { spawnEnemy, updateEnemies } from '../../src/sim/enemies.js';
import { groundPolyline, flyerPolyline, computeRoute } from '../../src/sim/route.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { RULES } from '../../src/data/rules.js';
import { PODS } from '../../src/data/pods.js';
import { MAX_SUPPLY_LEVEL } from '../../src/data/supply.js';
import { selectionOptions } from '../../src/sim/selection.js';
import { isBlocked } from '../../src/sim/grid.js';
import { SIM_STEP } from '../../src/data/settings.js';
import { playSalvo } from './helpers.js';

const SEED = 'TESTSEED';

/** Runs the simulation until `until(state)` or the step budget runs out. */
function runUntil(state, until, maxSeconds = 600) {
  const maxSteps = Math.round(maxSeconds / SIM_STEP);
  for (let i = 0; i < maxSteps; i++) {
    stepSimulation(state, SIM_STEP);
    if (until(state)) return i + 1;
  }
  throw new Error(`condition not reached within ${maxSeconds} s (phase ${state.phase})`);
}

function withRoutes(state) {
  state.waveRoutes = { ground: groundPolyline(state.route), flyer: flyerPolyline(state.map) };
  state.waveStats = { spawned: 0, leaked: 0, killed: 0 };
  return state;
}

test('phase transitions follow the round order', () => {
  assert.ok(canTransition('planning', 'salvo'));
  assert.ok(canTransition('wave', 'evaluation'));
  assert.ok(canTransition('wave', 'defeat'));
  assert.ok(canTransition('evaluation', 'planning'));
  assert.ok(!canTransition('planning', 'wave'));
  assert.ok(!canTransition('defeat', 'planning'));
  const state = createGameState(SEED);
  assert.throws(() => setPhase(state, 'evaluation'));
});

test('a new game starts in planning with full lives and a route', () => {
  const state = createGameState(SEED);
  assert.equal(state.phase, 'planning');
  assert.equal(state.lives, RULES.startLives);
  assert.equal(state.wave, 0);
  assert.ok(state.route && state.route.length > 0);
});

test('same seed, same map', () => {
  const a = createGameState('ABC123');
  const b = createGameState('ABC123');
  assert.deepEqual(a.map.obstacles, b.map.obstacles);
  assert.deepEqual(a.route, b.route);
});

test('a round runs salvo, selection and wave, then spawns enemies', () => {
  const state = createGameState(SEED);
  assert.ok(requestSalvo(state));
  assert.equal(state.phase, 'salvo');
  assert.equal(state.pods.length, PODS.perSalvo, 'missing zones were filled');

  runUntil(state, (s) => s.phase === 'selection', 30);
  assert.equal(state.towers.length, 0, 'nothing is built before the choice');
  assert.ok(chooseSelection(state, { type: 'keep', anchor: 0 }).ok);

  assert.equal(state.phase, 'wave');
  assert.equal(state.wave, 1);
  assert.equal(state.towers.length, 1);
  stepSimulation(state, SIM_STEP);
  assert.equal(state.enemies.length, 1, 'first enemy spawns at t = 0');
  const phases = state.events.filter((e) => e.type === 'phase').map((e) => e.phase);
  assert.deepEqual(phases, ['salvo', 'selection', 'wave']);
});

test('a salvo cannot be requested outside planning', () => {
  const state = createGameState(SEED);
  requestSalvo(state);
  assert.equal(canRequestSalvo(state), false);
  assert.equal(requestSalvo(state), false);
  stepSimulation(state, SIM_STEP);
  assert.equal(canRequestSalvo(state), false);
});

test('buildSpawns orders all groups by time', () => {
  const spawns = buildSpawns({
    groups: [
      { type: 'warrior', count: 3, interval: 1, delay: 0 },
      { type: 'swarmer', count: 2, interval: 1, delay: 0.5 },
    ],
  });
  assert.deepEqual(spawns.map((s) => [s.time, s.type]), [
    [0, 'warrior'], [0.5, 'swarmer'], [1, 'warrior'], [1.5, 'swarmer'], [2, 'warrior'],
  ]);
});

test('an enemy reaches the bastion after route length / speed', () => {
  const state = withRoutes(createGameState(SEED));
  const e = spawnEnemy(state, 'warrior');
  const expected = state.waveRoutes.ground.length / ENEMIES.warrior.speed;
  let t = 0;
  while (state.enemies.includes(e)) {
    updateEnemies(state, SIM_STEP);
    t += SIM_STEP;
    assert.ok(t < expected + 1, 'enemy took too long');
  }
  assert.ok(Math.abs(t - expected) <= SIM_STEP + 1e-9, `${t} vs ${expected}`);
  assert.equal(state.lives, RULES.startLives - RULES.leakCost);
});

test('ground enemies pass every beacon, flyers take the straight chain', () => {
  const state = withRoutes(createGameState(SEED));
  const walker = spawnEnemy(state, 'warrior');
  const flyer = spawnEnemy(state, 'carrionflyer');
  const beacons = state.map.beacons.map((b) => ({ x: b.x + 0.5, y: b.y + 0.5 }));
  const seenWalker = new Set();
  const seenFlyer = new Set();
  while (state.enemies.length) {
    updateEnemies(state, SIM_STEP);
    beacons.forEach((b, i) => {
      if (Math.hypot(walker.x - b.x, walker.y - b.y) < 0.05) seenWalker.add(i);
      if (Math.hypot(flyer.x - b.x, flyer.y - b.y) < 0.05) seenFlyer.add(i);
    });
  }
  assert.equal(seenWalker.size, 4);
  assert.equal(seenFlyer.size, 4);
  assert.ok(state.waveRoutes.flyer.length < state.waveRoutes.ground.length);
});

test('enemies walk around a newly placed obstacle', () => {
  const state = createGameState(SEED);
  const cell = state.route.cells[Math.floor(state.route.cells.length / 3)];
  // Find a cell on the route that may be blocked.
  let placed = null;
  for (const c of state.route.cells) {
    if (toggleObstacle(state, c).ok) {
      placed = c;
      break;
    }
  }
  assert.ok(placed, `no blockable cell on the route (tried from ${cell.x},${cell.y})`);
  assert.ok(!state.route.cells.some((c) => c.x === placed.x && c.y === placed.y));
  withRoutes(state);
  const e = spawnEnemy(state, 'warrior');
  while (state.enemies.length) {
    updateEnemies(state, SIM_STEP);
    const inside = e.x >= placed.x && e.x < placed.x + 1 && e.y >= placed.y && e.y < placed.y + 1;
    assert.ok(!inside, `enemy entered blocked cell ${placed.x},${placed.y}`);
  }
});

test('toggleObstacle rejects blocking and protected cells, removes existing ones', () => {
  const state = createGameState(SEED);
  const { map } = state;
  const protectedResult = toggleObstacle(state, { x: map.rift.x, y: map.rift.y });
  assert.deepEqual(protectedResult, { ok: false, reason: 'protected' });

  const existing = map.obstacles[0].cells[0];
  const count = map.obstacles.length;
  assert.deepEqual(toggleObstacle(state, existing), { ok: true, action: 'removed' });
  assert.equal(map.obstacles.length, count - 1);

  // Wall off the bastion ring cell by cell: the last gap must be refused.
  const b = map.bastion;
  const ring = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) continue;
      const x = b.x + dx;
      const y = b.y + dy;
      if (x >= 0 && y >= 0 && x < map.size && y < map.size) ring.push({ x, y });
    }
  }
  const results = ring.map((c) => toggleObstacle(state, c));
  assert.ok(results.some((r) => r.reason === 'blocks'), 'closing the ring must be refused');
  assert.ok(computeRoute(map), 'route stays open');
});

test('maze changes are refused during a wave', () => {
  const state = createGameState(SEED);
  playSalvo(state);
  stepSimulation(state, SIM_STEP);
  assert.deepEqual(toggleObstacle(state, { x: 12, y: 12 }), { ok: false, reason: 'phase' });
});

test('a full wave ends in evaluation, then planning', () => {
  const state = createGameState(SEED);
  // Wave 1 sends more enemies than the bastion has lives, and nothing shoots
  // them yet; the phase order is what this test is about.
  state.lives = 100000;
  playSalvo(state);
  runUntil(state, (s) => s.phase === 'evaluation');
  assert.equal(state.enemies.length, 0);
  assert.equal(state.waveStats.leaked, state.waveStats.spawned, 'without towers everything leaks');
  runUntil(state, (s) => s.phase === 'planning', RULES.evaluationSeconds + 1);
});

test('losing all lives ends the game in defeat', () => {
  const state = createGameState(SEED);
  state.lives = 3;
  playSalvo(state);
  runUntil(state, (s) => s.phase === 'defeat');
  assert.equal(state.lives, 0);
  assert.equal(canRequestSalvo(state), false);
});

test('surviving the last wave wins', () => {
  const state = createGameState(SEED);
  state.lives = 100000;
  for (let w = 0; w < totalWaves(); w++) {
    assert.ok(playSalvo(state), `wave ${w + 1}`);
    runUntil(state, (s) => s.phase === 'planning' || s.phase === 'victory');
  }
  assert.equal(state.phase, 'victory');
});

test('same seed and actions give the same run', () => {
  const run = () => {
    const state = createGameState(SEED);
    playSalvo(state);
    for (let i = 0; i < 900; i++) stepSimulation(state, SIM_STEP);
    return JSON.stringify({ enemies: state.enemies, lives: state.lives, towers: state.towers });
  };
  assert.equal(run(), run());
});

test('speed only accepts known values', () => {
  const state = createGameState(SEED);
  assert.ok(setSpeed(state, 3));
  assert.equal(state.speed, 3);
  assert.equal(setSpeed(state, 7), false);
  assert.equal(state.speed, 3);
});

test('every salvo of a match leaves one tower, four heaps of rubble and an open route', () => {
  const state = createGameState('MATCH');
  state.lives = 100000;
  // Debug supply level, as in the browser, so merges and recipes can come up.
  state.supplyLevel = MAX_SUPPLY_LEVEL;
  let specials = 0;

  for (let round = 0; round < totalWaves(); round++) {
    const towers = state.towers.length;
    const rubble = state.map.obstacles.filter((o) => o.kind === 'rubble').length;

    assert.ok(requestSalvo(state), `round ${round + 1}`);
    assert.equal(state.pods.length, PODS.perSalvo);
    const cells = state.pods.map(({ x, y }) => ({ x, y }));
    runUntil(state, (s) => s.phase === 'selection', 30);

    // Prefer the richest option the salvo offers.
    const options = selectionOptions(state);
    const recipe = options.recipes[0];
    const merge = [...options.merges].sort((a, b) => b.size - a.size)[0];
    const choice = recipe
      ? { type: 'recipe', recipeId: recipe.recipeId, anchor: recipe.anchors[0] }
      : merge
        ? { type: 'merge', size: merge.size, anchor: merge.anchors[0] }
        : { type: 'keep', anchor: 0 };
    const consumed = recipe ? recipe.towerIds.length : 0;
    assert.ok(chooseSelection(state, choice).ok, `round ${round + 1}: ${choice.type}`);
    if (recipe) specials += 1;

    assert.equal(state.towers.length, towers + 1 - consumed, 'exactly one new tower');
    assert.equal(
      state.map.obstacles.filter((o) => o.kind === 'rubble').length,
      rubble + PODS.perSalvo - 1 + consumed,
      'four heaps of rubble plus the consumed towers',
    );
    for (const c of cells) assert.ok(isBlocked(state.map.grid, c.x, c.y), `${c.x},${c.y} stays blocked`);
    assert.ok(state.route, `round ${round + 1}: route open after the salvo`);
    assert.ok(computeRoute(state.map), 'every leg still has a path');

    runUntil(state, (s) => s.phase === 'planning' || s.phase === 'victory');
  }
  assert.equal(state.phase, 'victory');
  assert.ok(specials > 0, 'at least one recipe came up at the top supply level');
});

test('same seed and the same decisions give the same pods', () => {
  const run = () => {
    const state = createGameState('REPLAY');
    state.lives = 100000;
    state.supplyLevel = 5;
    const seen = [];
    for (let round = 0; round < 3; round++) {
      requestSalvo(state);
      seen.push(state.pods.map((p) => `${p.x},${p.y} ${p.doctrine} ${p.rank}`).join(' | '));
      runUntil(state, (s) => s.phase === 'selection', 30);
      chooseSelection(state, { type: 'keep', anchor: round % PODS.perSalvo });
      runUntil(state, (s) => s.phase === 'planning');
    }
    return seen;
  };
  const first = run();
  assert.deepEqual(run(), first);
  assert.equal(new Set(first).size, first.length, 'each salvo differs from the others');
});
