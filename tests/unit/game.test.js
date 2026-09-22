import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../../src/core/state.js';
import { canTransition, setPhase } from '../../src/core/phases.js';
import { stepSimulation } from '../../src/sim/step.js';
import { startWave, setSpeed, toggleObstacle, canStartWave } from '../../src/sim/actions.js';
import { buildSpawns, totalWaves } from '../../src/sim/waves.js';
import { spawnEnemy, updateEnemies } from '../../src/sim/enemies.js';
import { groundPolyline, flyerPolyline, computeRoute } from '../../src/sim/route.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { RULES } from '../../src/data/rules.js';
import { SIM_STEP } from '../../src/data/settings.js';

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
  state.waveStats = { spawned: 0, leaked: 0 };
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

test('starting a wave passes salvo and selection, then spawns enemies', () => {
  const state = createGameState(SEED);
  assert.ok(startWave(state));
  stepSimulation(state, SIM_STEP);
  assert.equal(state.phase, 'wave');
  assert.equal(state.wave, 1);
  assert.equal(state.enemies.length, 1, 'first enemy spawns at t = 0');
  const phases = state.events.filter((e) => e.type === 'phase').map((e) => e.phase);
  assert.deepEqual(phases, ['salvo', 'selection', 'wave']);
});

test('waves cannot start outside planning', () => {
  const state = createGameState(SEED);
  startWave(state);
  stepSimulation(state, SIM_STEP);
  assert.equal(canStartWave(state), false);
  assert.equal(startWave(state), false);
});

test('buildSpawns orders all groups by time', () => {
  const spawns = buildSpawns({
    groups: [
      { type: 'mutant', count: 3, interval: 1, delay: 0 },
      { type: 'swarmer', count: 2, interval: 1, delay: 0.5 },
    ],
  });
  assert.deepEqual(spawns.map((s) => [s.time, s.type]), [
    [0, 'mutant'], [0.5, 'swarmer'], [1, 'mutant'], [1.5, 'swarmer'], [2, 'mutant'],
  ]);
});

test('an enemy reaches the bastion after route length / speed', () => {
  const state = withRoutes(createGameState(SEED));
  const e = spawnEnemy(state, 'mutant');
  const expected = state.waveRoutes.ground.length / ENEMIES.mutant.speed;
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
  const walker = spawnEnemy(state, 'mutant');
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
  const e = spawnEnemy(state, 'mutant');
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
  startWave(state);
  stepSimulation(state, SIM_STEP);
  assert.deepEqual(toggleObstacle(state, { x: 12, y: 12 }), { ok: false, reason: 'phase' });
});

test('a full wave ends in evaluation, then planning', () => {
  const state = createGameState(SEED);
  startWave(state);
  runUntil(state, (s) => s.phase === 'evaluation');
  assert.equal(state.enemies.length, 0);
  assert.equal(state.waveStats.leaked, state.waveStats.spawned, 'without towers everything leaks');
  runUntil(state, (s) => s.phase === 'planning', RULES.evaluationSeconds + 1);
});

test('losing all lives ends the game in defeat', () => {
  const state = createGameState(SEED);
  state.lives = 3;
  startWave(state);
  runUntil(state, (s) => s.phase === 'defeat');
  assert.equal(state.lives, 0);
  assert.equal(canStartWave(state), false);
});

test('surviving the last wave wins', () => {
  const state = createGameState(SEED);
  state.lives = 100000;
  for (let w = 0; w < totalWaves(); w++) {
    assert.ok(startWave(state), `wave ${w + 1}`);
    runUntil(state, (s) => s.phase === 'planning' || s.phase === 'victory');
  }
  assert.equal(state.phase, 'victory');
});

test('same seed and actions give the same run', () => {
  const run = () => {
    const state = createGameState(SEED);
    startWave(state);
    for (let i = 0; i < 900; i++) stepSimulation(state, SIM_STEP);
    return JSON.stringify({ enemies: state.enemies, lives: state.lives });
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
