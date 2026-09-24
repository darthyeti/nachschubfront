import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../../src/core/state.js';
import { canTransition, setPhase } from '../../src/core/phases.js';
import { stepSimulation } from '../../src/sim/step.js';
import { isRubble, isBulwark } from '../../src/sim/rubble.js';
import {
  requestSalvo,
  chooseSelection,
  setSpeed,
  toggleObstacle,
  canRequestSalvo,
} from '../../src/sim/actions.js';
import { buildSpawns, totalWaves } from '../../src/sim/waves.js';
import { spawnEnemy, updateEnemies } from '../../src/sim/enemies.js';
import { groundPolyline, flyerPolyline, computeRoute, checkPlacement } from '../../src/sim/route.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { RULES, RULESET_VERSION } from '../../src/data/rules.js';
import { salvoSize } from '../../src/data/pods.js';
import { MAX_SUPPLY_LEVEL, supplyCost } from '../../src/data/supply.js';
import { ECONOMY } from '../../src/data/economy.js';
import {
  buySupply,
  canBuySupply,
  demolish,
  buildBulwark,
  canBuildBulwark,
  nextRubbleCost,
  nextBulwarkCost,
  nextTowerCost,
  nextSupplyCost,
  settleWave,
} from '../../src/sim/economy.js';
import { towerAt } from '../../src/sim/towers.js';
import { selectionOptions } from '../../src/sim/selection.js';
import { score, scoreEntry } from '../../src/sim/score.js';
import { setWave, grant, forcePod, toggleInvulnerable } from '../../src/sim/debug.js';
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
  assert.equal(state.pods.length, salvoSize(state.wave + 1), 'missing zones were filled');

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
  assert.equal(seenWalker.size, beacons.length);
  assert.equal(seenFlyer.size, beacons.length);
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
    assert.equal(state.pods.length, salvoSize(state.wave + 1));
    const pods = state.pods.length;
    const cells = state.pods.map(({ x, y }) => ({ x, y }));
    // A zone may sit on rubble since v3. Such a cell grows no new heap when the
    // pod is dropped, and loses the one it had when the pod is the one built.
    const onRubble = cells.filter((c) => isRubble(state.map, c)).length;
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
      rubble + pods - 1 - onRubble + consumed,
      'every pod but one, minus the cells that were rubble already, plus the consumed towers',
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
      chooseSelection(state, { type: 'keep', anchor: round % state.pods.length });
      runUntil(state, (s) => s.phase === 'planning');
    }
    return seen;
  };
  const first = run();
  assert.deepEqual(run(), first);
  assert.equal(new Set(first).size, first.length, 'each salvo differs from the others');
});

test('a cleared wave pays the bonus and a command point', () => {
  const state = createGameState(SEED);
  state.lives = 100000;
  playSalvo(state);
  const before = state.requisition;
  runUntil(state, (s) => s.phase === 'evaluation');
  // Wave 1 leaks without towers, so only the bonus is paid.
  assert.equal(state.requisition, before + ECONOMY.waveBonusBase + ECONOMY.waveBonusPerWave);
  assert.equal(state.commandPoints, 0, 'a breakthrough costs the clean-wave point');
});

test('supply levels are bought with requisition', () => {
  const state = createGameState(SEED);
  assert.equal(canBuySupply(state).ok, false, 'nothing in the coffers');
  state.requisition = 2000;
  const first = supplyCost(state.supplyLevel);
  assert.ok(buySupply(state).ok);
  assert.equal(state.supplyLevel, 2);
  assert.equal(state.requisition, 2000 - first);
  while (state.supplyLevel < MAX_SUPPLY_LEVEL) assert.ok(buySupply(state).ok);
  assert.equal(canBuySupply(state).reason, 'max');
  assert.equal(nextSupplyCost(state), null);
});

test('demolishing rubble costs more every time', () => {
  const state = createGameState('MATCH');
  state.lives = 100000;
  state.requisition = 1000;
  playSalvo(state);
  runUntil(state, (s) => s.phase === 'planning', 600);
  const rubble = state.map.obstacles.filter((o) => o.kind === 'rubble');
  assert.ok(rubble.length >= 2, 'the salvo left rubble behind');

  const first = nextRubbleCost(state);
  const before = state.requisition;
  const cell = rubble[0].cells[0];
  assert.ok(demolish(state, cell).ok);
  assert.equal(state.requisition, before - first);
  assert.ok(!isBlocked(state.map.grid, cell.x, cell.y), 'the cell is free again');
  assert.equal(state.map.obstacles.filter((o) => o.kind === 'rubble').length, rubble.length - 1);
  assert.ok(nextRubbleCost(state) > first, 'the next one is dearer');

  assert.equal(demolish(state, cell).reason, 'target', 'nothing left to clear there');
  state.requisition = 0;
  assert.equal(demolish(state, rubble[1].cells[0]).reason, 'funds');
});

test('tearing down a position costs three times the rubble price', () => {
  const state = createGameState('MATCH');
  state.lives = 100000;
  state.requisition = 1000;
  playSalvo(state);
  runUntil(state, (s) => s.phase === 'planning', 600);
  const tower = state.towers[0];
  assert.ok(tower, 'the salvo left a position standing');

  assert.equal(nextTowerCost(state), nextRubbleCost(state) * 3);
  const cost = nextTowerCost(state);
  const before = state.requisition;
  const result = demolish(state, tower);
  assert.deepEqual(result, { ok: true, cost, kind: 'tower' });
  assert.equal(state.requisition, before - cost, 'a position gives nothing back');
  assert.equal(towerAt(state, tower), null, 'the position is gone');
  assert.ok(!isBlocked(state.map.grid, tower.x, tower.y), 'and its cell is free');
  assert.ok(!state.map.obstacles.some((o) => o.cells.some((c) => c.x === tower.x && c.y === tower.y)),
    'no rubble is left in its place');
});

test('every demolition makes the next one dearer, whatever it was', () => {
  const state = createGameState('MATCH');
  state.lives = 100000;
  state.requisition = 5000;
  playSalvo(state);
  runUntil(state, (s) => s.phase === 'planning', 600);
  const rubble = state.map.obstacles.filter((o) => o.kind === 'rubble');

  const first = nextRubbleCost(state);
  assert.ok(demolish(state, state.towers[0]).ok, 'a position first');
  assert.equal(nextRubbleCost(state), first + 5, 'the rubble price moved on too');
  assert.ok(demolish(state, rubble[0].cells[0]).ok);
  assert.equal(nextRubbleCost(state), first + 10);
});

test('terrain is not demolishable, and nothing is outside the planning phase', () => {
  const state = createGameState('MATCH');
  state.requisition = 5000;
  const terrain = state.map.obstacles.find((o) => o.kind !== 'rubble');
  assert.ok(terrain, 'the map came with ruins');
  assert.equal(demolish(state, terrain.cells[0]).reason, 'target', 'ruins stay');

  playSalvo(state);
  const tower = state.towers[0];
  state.phase = 'wave';
  assert.equal(demolish(state, tower).reason, 'phase');
  assert.ok(towerAt(state, tower), 'the position is still there');
});

test('a boss and a clean wave pay command points', () => {
  const state = createGameState(SEED);
  state.wave = 10;
  state.waveStats = { spawned: 5, leaked: 0, killed: 5, bossKills: 1 };
  const payout = settleWave(state);
  assert.equal(payout.commandPoints, ECONOMY.pointsPerBoss + ECONOMY.pointsPerCleanWave);
  assert.equal(payout.requisition, ECONOMY.waveBonusBase + 10);
  assert.equal(state.commandPoints, payout.commandPoints);
});

test('the score counts waves, kills and the lives that are left', () => {
  const state = createGameState(SEED);
  state.wave = 33;
  state.kills = 1240;
  state.lives = 7;
  assert.equal(score(state), 33 * 1000 + 1240 + 7 * 200);
  assert.equal(score(createGameState(SEED)), RULES.startLives * 200, 'a fresh match is worth its lives');
});

test('a result carries the ruleset it was played under', () => {
  const state = createGameState(SEED);
  state.wave = 12;
  state.kills = 300;
  const entry = scoreEntry(state);
  assert.equal(entry.ruleset, RULESET_VERSION, 'so old and new matches never share a list');
  assert.equal(entry.seed, SEED);
  assert.equal(entry.score, score(state));
});

test('the debug tools jump waves, grant money and spare the bastion', () => {
  const state = createGameState(SEED);
  assert.ok(setWave(state, 20));
  assert.equal(state.wave, 19, 'the next salvo prepares wave 20');
  playSalvo(state);
  assert.equal(state.wave, 20);
  assert.equal(setWave(state, 5), false, 'not while a wave is running');

  grant(state, { requisition: 500, commandPoints: 5 });
  assert.equal(state.requisition, 500);
  assert.equal(state.commandPoints, 5);

  assert.equal(toggleInvulnerable(state), true);
  const lives = state.lives;
  runUntil(state, (s) => s.waveStats.leaked > 0, 600);
  assert.equal(state.lives, lives, 'breakthroughs are counted but cost nothing');
  assert.ok(state.waveStats.leaked > 0);
});

test('forced pod contents override the draw', () => {
  const state = createGameState(SEED);
  forcePod(state, { doctrine: 'tesla', rank: 4 });
  requestSalvo(state);
  assert.ok(state.pods.every((p) => p.doctrine === 'tesla' && p.rank === 4));
  forcePod(state, null);
});

test('a whole wave with towers plays out the same way twice', () => {
  const run = () => {
    const state = createGameState('REPLAY');
    state.lives = 100000;
    state.supplyLevel = MAX_SUPPLY_LEVEL;
    for (let round = 0; round < 3; round++) {
      playSalvo(state, { type: 'keep', anchor: round % salvoSize(state.wave + 1) });
      runUntil(state, (s) => s.phase === 'planning' || s.phase === 'defeat', 600);
    }
    return JSON.stringify({
      towers: state.towers,
      requisition: state.requisition,
      kills: state.kills,
      lives: state.lives,
      obstacles: state.map.obstacles.length,
    });
  };
  assert.equal(run(), run());
});

test('a full match of fifty waves runs through without a hitch', () => {
  const state = createGameState('FULLMATCH');
  // Lives are taken out of the equation: this test is about fifty waves running
  // cleanly, not about a match being winnable (that is measured with
  // npm run playmatch, where the towers are placed the way a player would).
  state.lives = 100000;
  state.supplyLevel = MAX_SUPPLY_LEVEL;
  let handled = 0;
  for (let round = 0; round < totalWaves(); round++) {
    assert.ok(playSalvo(state), `wave ${round + 1}`);
    runUntil(state, (s) => s.phase === 'planning' || s.phase === 'victory', 900);
    handled += state.waveStats.killed + state.waveStats.leaked;
    assert.equal(state.enemies.length, 0, `wave ${state.wave} left enemies behind`);
    assert.equal(state.projectiles.length, 0, `wave ${state.wave} left shells in the air`);
    assert.ok(state.waveStats.spawned > 0, `wave ${state.wave} sent nothing`);
  }
  assert.equal(state.phase, 'victory');
  assert.equal(state.wave, totalWaves());
  assert.ok(handled > 1500, `only ${handled} enemies dealt with`);
  assert.ok(state.kills > 500, `only ${state.kills} kills`);
  assert.ok(state.requisition > 0);
  assert.ok(score(state) > 50000);
});

// ---------- Bulwark (GDD section 10, v3) ----------

/** A planning state whose salvo has left heaps of rubble behind. */
function stateWithRubble(requisition = 1000) {
  const state = createGameState('MATCH');
  state.lives = 100000;
  state.requisition = requisition;
  playSalvo(state);
  runUntil(state, (s) => s.phase === 'planning', 600);
  const rubble = state.map.obstacles.filter((o) => o.kind === 'rubble');
  assert.ok(rubble.length >= 2, 'the salvo left rubble behind');
  return { state, cells: rubble.map((o) => o.cells[0]) };
}

test('a bulwark is built from rubble and costs more than clearing it', () => {
  const { state, cells } = stateWithRubble();
  const price = nextBulwarkCost(state);
  assert.ok(price > nextRubbleCost(state), 'above the demolition price (GDD section 10)');

  const before = state.requisition;
  const route = computeRoute(state.map).length;
  assert.ok(buildBulwark(state, cells[0]).ok);
  assert.equal(state.requisition, before - price);
  assert.equal(isBulwark(state.map, cells[0]), true);
  assert.equal(isRubble(state.map, cells[0]), false, 'the heap became the bulwark, it did not join it');
  assert.ok(isBlocked(state.map.grid, cells[0].x, cells[0].y), 'the cell stays blocked');
  assert.equal(computeRoute(state.map).length, route, 'the route cannot change: the cell was blocked already');
  assert.ok(nextBulwarkCost(state) > price, 'and the next one is dearer');
});

test('only rubble can become a bulwark, and only with the money for it', () => {
  const { state, cells } = stateWithRubble(0);
  assert.equal(canBuildBulwark(state, cells[0]).reason, 'funds');
  assert.equal(buildBulwark(state, cells[0]).ok, false);
  assert.equal(isRubble(state.map, cells[0]), true, 'nothing happened');

  state.requisition = 1000;
  const free = { x: state.map.rift.x, y: state.map.rift.y };
  assert.equal(canBuildBulwark(state, free).reason, 'target', 'terrain is not the player s to build on');
  assert.equal(canBuildBulwark(state, null).reason, 'target');
  assert.ok(buildBulwark(state, cells[0]).ok);
  assert.equal(canBuildBulwark(state, cells[0]).reason, 'target', 'a bulwark is not rubble any more');

  // And not during a wave.
  const running = createGameState('MATCH');
  running.phase = 'wave';
  running.requisition = 1000;
  assert.equal(canBuildBulwark(running, { x: 0, y: 0 }).reason, 'phase');
});

test('a bulwark can be torn down again, at the plain rubble price', () => {
  const { state, cells } = stateWithRubble();
  assert.ok(buildBulwark(state, cells[0]).ok);
  const price = nextRubbleCost(state);
  const before = state.requisition;
  assert.ok(demolish(state, cells[0]).ok);
  assert.equal(state.requisition, before - price);
  assert.equal(isBulwark(state.map, cells[0]), false);
  assert.ok(!isBlocked(state.map.grid, cells[0].x, cells[0].y), 'the cell is free again');
});

test('a capsule may not land on a bulwark', () => {
  const { state, cells } = stateWithRubble();
  assert.equal(checkPlacement(state.map, [cells[0]]).ok, true, 'rubble takes a landing zone');
  assert.ok(buildBulwark(state, cells[0]).ok);
  assert.equal(checkPlacement(state.map, [cells[0]]).reason, 'occupied', 'the bulwark does not');
});
