// The Koloss (GDD section 9, v4): the announcement, the lane it picks, the
// swathe it tears, the way it finds afterwards and what happens when it is
// walled in.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGameState } from '../../src/core/state.js';
import {
  kolossStage,
  nextKolossWave,
  isKolossWave,
  firepowerAt,
  driveDirection,
  laneStart,
  laneTarget,
  chooseLane,
  updateKoloss,
  spawnKoloss,
  breachPath,
  breach,
  routeToBastion,
  updateKolossRun,
} from '../../src/sim/koloss.js';
import { addTower, removeTower } from '../../src/sim/towers.js';
import { addRubble, isRubble, raiseBulwark, isBulwark } from '../../src/sim/rubble.js';
import { computeRoute, groundPolyline, flyerPolyline, positionAt } from '../../src/sim/route.js';
import { isBlocked, setBlocked } from '../../src/sim/grid.js';
import { updateEnemies, spawnEnemy } from '../../src/sim/enemies.js';
import { updateCombat } from '../../src/sim/combat.js';
import { setPhase } from '../../src/core/phases.js';
import { KOLOSS_RUN } from '../../src/data/enemies.js';
import { RULES } from '../../src/data/rules.js';
import { SIM_STEP } from '../../src/data/settings.js';

function planning(seed = 'KOLOSS') {
  const state = createGameState(seed);
  state.phase = 'planning';
  state.lives = 100000;
  return state;
}

/**
 * The same state with an empty field: no ruins, no craters, no walls. Lanes are
 * then open all the way, and a test decides on its own what blocks where.
 */
function bareField(seed = 'KOLOSS') {
  const state = planning(seed);
  state.map.obstacles = [];
  state.map.grid.blocked.fill(0);
  state.route = computeRoute(state.map);
  state.mapVersion += 1;
  return state;
}

/**
 * Blocks `count` lanes at the same depth and returns them. Lanes are picked by
 * trying: a lane whose first blocking cell falls on protected ground is no
 * candidate, and where the beacons sit depends on the seed. They are kept well
 * apart, so a bulwark beside one cannot reach the next.
 */
function blockLanes(state, dir, count, depth = 8) {
  const used = [];
  for (let index = 0; index < state.map.size && used.length < count; index++) {
    if (used.some((u) => Math.abs(u.index - index) < 4)) continue;
    const start = laneStart(state.map, index, dir);
    const cell = { x: start.x + dir.dx * depth, y: start.y + dir.dy * depth };
    addRubble(state, cell);
    if (laneTarget(state, index, dir)?.x === cell.x && laneTarget(state, index, dir)?.y === cell.y) {
      used.push({ index, cell });
    }
  }
  assert.equal(used.length, count, 'the map offers enough usable lanes');
  return used;
}

// ---------- The announcement ----------

test('the run announces itself two waves out and fixes its lane on arrival', () => {
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

test('the warning carries no lane, the prediction does', () => {
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
  assert.ok(state.koloss.lane, 'one wave out the lane is picked');
  assert.ok(state.koloss.target, 'and with it the spot it drives at');
  assert.ok(
    isBlocked(state.map.grid, state.koloss.target.x, state.koloss.target.y),
    'the target is the first thing in the way, so it blocks',
  );
});

// ---------- The lane ----------

test('it drives away from the rift edge, and its lanes start there', () => {
  const state = planning();
  const dir = driveDirection(state.map);
  assert.equal(Math.abs(dir.dx) + Math.abs(dir.dy), 1, 'one of the four axes, never a diagonal');

  const last = state.map.size - 1;
  const rift = state.map.rift;
  // The rift sits on the edge the lanes start from.
  const onEdge = rift.x === 0 || rift.x === last || rift.y === 0 || rift.y === last;
  assert.ok(onEdge);

  const start = laneStart(state.map, 7, dir);
  assert.ok(start.x === 0 || start.x === last || start.y === 0 || start.y === last, 'on the map edge');
  // A step against the drive direction would leave the map: the lane starts at the border.
  assert.ok(
    start.x - dir.dx < 0 || start.x - dir.dx > last || start.y - dir.dy < 0 || start.y - dir.dy > last,
  );
  // And the bastion lies ahead, not behind.
  const towardsBastion = (state.map.bastion.x - start.x) * dir.dx + (state.map.bastion.y - start.y) * dir.dy;
  assert.ok(towardsBastion > 0, 'the lane runs towards the bastion');
});

test('the target of a lane is the first cell on it that blocks', () => {
  const state = bareField();
  const dir = driveDirection(state.map);
  const index = 9;
  assert.equal(laneTarget(state, index, dir), null, 'an open lane is no candidate at all');

  const start = laneStart(state.map, index, dir);
  const near = { x: start.x + dir.dx * 5, y: start.y + dir.dy * 5 };
  const far = { x: start.x + dir.dx * 9, y: start.y + dir.dy * 9 };
  addRubble(state, far);
  addRubble(state, near);
  assert.deepEqual(laneTarget(state, index, dir), near, 'the near heap, not the far one');

  // Nothing lies in front of the target: that is what lets it drive straight.
  for (let i = 0; i < 5; i++) {
    assert.equal(isBlocked(state.map.grid, start.x + dir.dx * i, start.y + dir.dy * i), false);
  }
});

test('the lane with the least firepower over its target wins', () => {
  const state = bareField();
  const dir = driveDirection(state.map);
  // Two lanes, each blocked at the same depth, so only the firepower over the
  // two targets can decide between them.
  const [quiet, guarded] = blockLanes(state, dir, 2);
  // An emplacement covering the guarded lane's target, beside the lane so it
  // does not block the lane itself.
  const beside = { x: guarded.cell.x + dir.dy, y: guarded.cell.y + dir.dx };
  addTower(state, { ...beside, doctrine: 'laser', rank: 3 });
  state.route = computeRoute(state.map);

  assert.equal(firepowerAt(state, quiet.cell), 0);
  assert.ok(firepowerAt(state, guarded.cell) > 0);

  const lane = chooseLane(state);
  assert.deepEqual(lane.target, quiet.cell, 'it takes the way nobody is covering');
  assert.equal(lane.index, quiet.index);
});

test('a bulwark beside the target counts as firepower and pushes the lane away', () => {
  const state = bareField();
  const dir = driveDirection(state.map);
  const lanes = blockLanes(state, dir, 2);
  const picked = chooseLane(state).target;
  const other = lanes.map((l) => l.cell).find((c) => c.x !== picked.x || c.y !== picked.y);

  // Reinforce the one it picked; the prediction has to move to the other. The
  // bulwark goes behind the target, on the far side from the Koloss, so it
  // lands on no lane of its own.
  const behind = { x: picked.x + dir.dx, y: picked.y + dir.dy };
  addRubble(state, behind);
  raiseBulwark(state, behind);
  assert.equal(firepowerAt(state, picked), KOLOSS_RUN.bulwarkFirepower);
  assert.deepEqual(chooseLane(state).target, other, 'the marker moved');
});

test('protected ground is never the target, so the threat is always answerable', () => {
  const state = bareField();
  const dir = driveDirection(state.map);
  const { map } = state;
  // Block the first cell of a lane on protected ground and nothing else.
  let index = -1;
  for (let i = 0; i < map.size && index < 0; i++) {
    const start = laneStart(map, i, dir);
    for (let step = 0; step < map.size; step++) {
      const x = start.x + dir.dx * step;
      const y = start.y + dir.dy * step;
      if (map.protected[y * map.size + x]) {
        setBlocked(map.grid, x, y, true);
        index = i;
        break;
      }
    }
  }
  assert.ok(index >= 0, 'the map has protected ground on some lane');
  assert.equal(laneTarget(state, index, dir), null, 'a lane that blocks there is dropped');
});

// ---------- The swathe ----------

/** A state in the wave of the Koloss, with it on its lane. */
function arrived(state) {
  const [first] = KOLOSS_RUN.waves;
  state.wave = first;
  state.phase = 'wave';
  state.waveScale = 1;
  state.waveStats = { spawned: 0, leaked: 0, killed: 0, bossKills: 0 };
  state.waveRoutes = { ground: groundPolyline(state.route), flyer: flyerPolyline(state.map) };
  updateKoloss(state);
  const e = spawnKoloss(state);
  return e;
}

/** Runs the wave until `done` holds, or fails after a generous number of steps. */
function run(state, done, what) {
  for (let i = 0; i < 200000; i++) {
    updateEnemies(state, SIM_STEP);
    updateKolossRun(state);
    state.time += SIM_STEP;
    if (done()) return;
  }
  assert.fail(`never got to: ${what}`);
}

test('the swathe runs the length the table gives, whatever lies in it', () => {
  const state = bareField();
  const dir = driveDirection(state.map);
  const start = laneStart(state.map, 9, dir);
  const target = { x: start.x + dir.dx * 7, y: start.y + dir.dy * 7 };
  // More rubble in a row than the swathe can reach.
  for (let i = 0; i < KOLOSS_RUN.breachCells + 3; i++) {
    addRubble(state, { x: target.x + dir.dx * i, y: target.y + dir.dy * i });
  }

  const { cells, stoppedBy } = breachPath(state, target, dir.dx, dir.dy);
  assert.equal(cells.length, KOLOSS_RUN.breachCells, 'five cells, no more');
  assert.equal(stoppedBy, null);
  assert.equal(
    isRubble(state.map, { x: target.x + dir.dx * KOLOSS_RUN.breachCells, y: target.y + dir.dy * KOLOSS_RUN.breachCells }),
    true,
    'the heap past the end of the run is no part of it',
  );
});

test('it grinds down every cell of its swathe as it drives over it', () => {
  const state = bareField();
  const dir = driveDirection(state.map);
  const index = 9;
  const start = laneStart(state.map, index, dir);
  const target = { x: start.x + dir.dx * 7, y: start.y + dir.dy * 7 };
  for (let i = 0; i < KOLOSS_RUN.breachCells; i++) {
    addRubble(state, { x: target.x + dir.dx * i, y: target.y + dir.dy * i });
  }
  state.route = computeRoute(state.map);

  const e = arrived(state);
  assert.deepEqual(state.koloss.target, target, 'the only blocked lane is the one it takes');
  assert.equal(state.koloss.swathe.length, KOLOSS_RUN.breachCells);
  assert.equal(e.charging, true);

  run(state, () => !e.charging, 'the end of the charge');
  for (const cell of state.koloss.swathe) {
    assert.equal(isRubble(state.map, cell), false, `${cell.x},${cell.y} was ground down`);
    assert.equal(isBlocked(state.map.grid, cell.x, cell.y), false, 'and is open');
  }
  assert.equal(e.crushed, KOLOSS_RUN.breachCells, 'every heap in the swathe, counted once each');
});

test('a bulwark stops the swathe where it stands, rubble does not', () => {
  const state = bareField();
  const dir = driveDirection(state.map);
  const start = laneStart(state.map, 9, dir);
  const target = { x: start.x + dir.dx * 7, y: start.y + dir.dy * 7 };
  for (let i = 0; i < KOLOSS_RUN.breachCells; i++) {
    addRubble(state, { x: target.x + dir.dx * i, y: target.y + dir.dy * i });
  }
  raiseBulwark(state, { x: target.x + dir.dx * 2, y: target.y + dir.dy * 2 });

  const { cells, stoppedBy } = breachPath(state, target, dir.dx, dir.dy);
  assert.equal(stoppedBy, 'bulwark');
  assert.equal(cells.length, 2, 'the two heaps in front of the bulwark and no further');
});

test('an emplacement stops it too, is left standing, and leaves it stunned', () => {
  const state = bareField();
  const dir = driveDirection(state.map);
  const start = laneStart(state.map, 9, dir);
  const target = { x: start.x + dir.dx * 7, y: start.y + dir.dy * 7 };
  addRubble(state, target);
  addTower(state, { x: target.x + dir.dx, y: target.y + dir.dy, doctrine: 'laser', rank: 1 });
  state.route = computeRoute(state.map);

  const e = arrived(state);
  assert.equal(state.koloss.stoppedBy, 'tower');
  run(state, () => !e.charging, 'the stop at the emplacement');
  assert.equal(state.towers.length, 1, 'the emplacement is still standing');
  assert.ok(e.holdUntil > state.time, 'and it stands stunned');
  assert.ok(
    e.holdUntil - state.time <= KOLOSS_RUN.stunSeconds + 1e-6,
    `the stun is ${KOLOSS_RUN.stunSeconds} s, not longer`,
  );
});

// ---------- The way it finds afterwards ----------

test('afterwards it makes its own way: no beacons, and only on the four axes', () => {
  const state = bareField();
  const dir = driveDirection(state.map);
  const start = laneStart(state.map, 9, dir);
  addRubble(state, { x: start.x + dir.dx * 7, y: start.y + dir.dy * 7 });
  state.route = computeRoute(state.map);

  const e = arrived(state);
  run(state, () => !e.charging, 'the end of the charge');

  const points = e.route.points;
  const last = points[points.length - 1];
  assert.equal(Math.floor(last.x), state.map.bastion.x, 'it ends at the bastion');
  assert.equal(Math.floor(last.y), state.map.bastion.y);
  for (let i = 1; i < points.length; i++) {
    const dx = Math.abs(points[i].x - points[i - 1].x);
    const dy = Math.abs(points[i].y - points[i - 1].y);
    assert.ok(dx === 0 || dy === 0, 'every step is on an axis, never diagonal');
  }
  // The beacons are no waypoints for it: the way is no longer than the straight
  // run through the maze needs to be.
  const direct = Math.abs(state.map.bastion.x - e.x) + Math.abs(state.map.bastion.y - e.y);
  assert.ok(e.route.length < direct + 8, 'it heads for the bastion, it does not tour the field');
});

test('rubble is passable but expensive: round a short detour, through a long one', () => {
  const state = bareField();
  const { map } = state;
  const dir = driveDirection(map);
  const bastion = map.bastion;
  // Six cells short of the bastion, on the axis it came in on.
  const here = { x: bastion.x - dir.dx * 6, y: bastion.y - dir.dy * 6 };
  const e = { x: here.x + 0.5, y: here.y + 0.5, dx: dir.dx, dy: dir.dy, koloss: true };

  // A wall of rubble straight across, three cells in front of the bastion.
  const across = { x: dir.dy, y: dir.dx };
  const wall = { x: bastion.x - dir.dx * 3, y: bastion.y - dir.dy * 3 };
  const cellAt = (offset) => ({ x: wall.x + across.x * offset, y: wall.y + across.y * offset });
  const gaps = [];
  for (let offset = -map.size; offset <= map.size; offset++) {
    const cell = cellAt(offset);
    if (isBlocked(map.grid, cell.x, cell.y)) continue;
    if (cell.x < 0 || cell.y < 0 || cell.x >= map.size || cell.y >= map.size) continue;
    addRubble(state, cell);
    gaps.push(offset);
  }
  const open = (offset) => {
    const cell = cellAt(offset);
    const index = map.obstacles.findIndex((o) => o.cells[0].x === cell.x && o.cells[0].y === cell.y);
    if (index >= 0) map.obstacles.splice(index, 1);
    setBlocked(map.grid, cell.x, cell.y, false);
  };
  const close = (offset) => addRubble(state, cellAt(offset));

  // A gap two cells to the side: the detour is four cells, the rubble six.
  const near = gaps.find((o) => o === 2) ?? gaps[0];
  open(near);
  assert.ok(routeToBastion(state, e), 'there is a way');
  const throughGap = e.route.points.some(
    (p) => Math.floor(p.x) === cellAt(near).x && Math.floor(p.y) === cellAt(near).y,
  );
  assert.ok(throughGap, 'a detour of four cells beats grinding through rubble worth six');

  // Move the gap to the far end of the wall: now the detour costs more than the
  // rubble does, and it drives straight through.
  close(near);
  const far = gaps[gaps.length - 1];
  open(far);
  assert.ok(routeToBastion(state, e));
  const straight = e.route.points.some(
    (p) => Math.floor(p.x) === cellAt(0).x && Math.floor(p.y) === cellAt(0).y,
  );
  assert.ok(straight, 'the long way round is worse than six cells of rubble');
});

test('a bulwark is no detour but a wall: it is never routed through', () => {
  const state = bareField();
  const { map } = state;
  const dir = driveDirection(map);
  const bastion = map.bastion;
  const here = { x: bastion.x - dir.dx * 6, y: bastion.y - dir.dy * 6 };
  const e = { x: here.x + 0.5, y: here.y + 0.5, dx: dir.dx, dy: dir.dy, koloss: true };

  const across = { x: dir.dy, y: dir.dx };
  const wall = { x: bastion.x - dir.dx * 3, y: bastion.y - dir.dy * 3 };
  for (let offset = -map.size; offset <= map.size; offset++) {
    const cell = { x: wall.x + across.x * offset, y: wall.y + across.y * offset };
    if (cell.x < 0 || cell.y < 0 || cell.x >= map.size || cell.y >= map.size) continue;
    if (isBlocked(map.grid, cell.x, cell.y)) continue;
    addRubble(state, cell);
    raiseBulwark(state, cell);
  }
  assert.equal(routeToBastion(state, e), false, 'walled in behind bulwarks');
});

// ---------- Walled in ----------

test('walled in it rams, and after the countdown the obstacle is gone', () => {
  const state = bareField();
  const { map } = state;
  const cell = { x: 8, y: 8 };
  // A ring of bulwarks around one free cell, with the Koloss in the middle.
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const wall = { x: cell.x + dx, y: cell.y + dy };
    addRubble(state, wall);
    raiseBulwark(state, wall);
  }
  const e = {
    x: cell.x + 0.5,
    y: cell.y + 0.5,
    dx: 1,
    dy: 0,
    koloss: true,
    dead: false,
    charging: false,
    holdUntil: 0,
    crushed: 0,
  };
  state.enemies.push(e);
  state.phase = 'wave';

  assert.equal(routeToBastion(state, e), false);
  breach(state, e);
  assert.ok(e.ram, 'it settles in to ram');
  const rammed = { ...e.ram.cell };
  assert.equal(isBulwark(map, rammed), true);
  assert.ok(e.holdUntil - state.time > KOLOSS_RUN.ramSeconds - 1e-6, 'the countdown runs the full time');

  // Just before the end it still stands; a step later the way is open.
  state.time += KOLOSS_RUN.ramSeconds - SIM_STEP;
  updateKolossRun(state);
  assert.ok(e.ram, 'not yet');
  state.time += SIM_STEP * 2;
  updateKolossRun(state);
  assert.equal(e.ram, null, 'the countdown ran out');
  assert.equal(isBulwark(map, rammed), false, 'the bulwark fell');
  assert.equal(isBlocked(map.grid, rammed.x, rammed.y), false, 'and was ground down in the same movement');
  assert.ok(e.route, 'it has a way again');
});

// ---------- Turning ----------

test('it holds still while it turns, and only turns at cell centres', () => {
  const state = bareField();
  const { map } = state;
  const e = {
    x: 4.5,
    y: 4.5,
    dx: 1,
    dy: 0,
    koloss: true,
    dead: false,
    charging: false,
    holdUntil: 0,
    d: 0,
    corner: 0,
    crushed: 0,
    route: null,
  };
  // A path with one corner in it.
  e.route = {
    points: [
      { x: 4.5, y: 4.5 },
      { x: 7.5, y: 4.5 },
      { x: 7.5, y: 9.5 },
    ],
    cumulative: [0, 3, 8],
    length: 8,
  };
  state.enemies.push(e);
  state.phase = 'wave';

  // Short of the corner nothing happens.
  e.d = 2.9;
  updateKolossRun(state);
  assert.equal(e.holdUntil, 0);
  assert.deepEqual([e.dx, e.dy], [1, 0]);

  // A hair past it: pulled back onto the corner, turned, and held there.
  e.d = 3.02;
  updateKolossRun(state);
  assert.equal(e.d, 3, 'exactly on the corner, not a fraction past it');
  assert.deepEqual([e.dx, e.dy], [0, 1], 'now facing along the new axis');
  assert.ok(Math.abs(e.holdUntil - (state.time + KOLOSS_RUN.turnSeconds)) < 1e-9);

  // It does not turn twice at the same corner.
  const held = e.holdUntil;
  state.time += KOLOSS_RUN.turnSeconds;
  updateKolossRun(state);
  assert.equal(e.holdUntil, held);
  assert.ok(map, 'map untouched');
});

// ---------- The wave and the bastion ----------

test('letting the Koloss reach the bastion costs more than a boss', () => {
  const state = bareField();
  const dir = driveDirection(state.map);
  const start = laneStart(state.map, 9, dir);
  addRubble(state, { x: start.x + dir.dx * 7, y: start.y + dir.dy * 7 });
  state.route = computeRoute(state.map);

  const e = arrived(state);
  const lives = state.lives;
  run(state, () => !state.enemies.includes(e), 'the bastion');
  assert.equal(lives - state.lives, RULES.kolossLeakCost);
  assert.ok(RULES.kolossLeakCost > RULES.bossLeakCost);
});

test('the charge itself costs no lives', () => {
  const state = bareField();
  const dir = driveDirection(state.map);
  const start = laneStart(state.map, 9, dir);
  addRubble(state, { x: start.x + dir.dx * 7, y: start.y + dir.dy * 7 });
  state.route = computeRoute(state.map);

  const e = arrived(state);
  const lives = state.lives;
  run(state, () => !e.charging, 'the end of the charge');
  assert.equal(state.lives, lives, 'the breakthrough is free, GDD section 9');
  assert.equal(state.enemies.includes(e), true, 'and it is still on the field');
});

// ---------- What it costs to compute ----------

test('picking a lane stays cheap on a full late-game map', () => {
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

  const started = performance.now();
  const runs = 200;
  for (let i = 0; i < runs; i++) chooseLane(state);
  const perRun = (performance.now() - started) / runs;
  // One sweep is one lane per row times the emplacements over its target; it
  // happens once per build.
  assert.ok(perRun < 5, `picking a lane took ${perRun.toFixed(2)} ms`);
});

test('with nothing in the way anywhere it still turns up, and finds its own way', () => {
  const state = bareField();
  assert.equal(chooseLane(state), null, 'an empty field offers no lane at all');
  const e = arrived(state);
  assert.ok(e, 'it comes anyway');
  assert.equal(e.charging, false, 'straight to its own pathfinding, GDD section 9');
  assert.ok(e.route, 'which it has');
  const last = e.route.points[e.route.points.length - 1];
  assert.equal(Math.floor(last.x), state.map.bastion.x);
  assert.equal(Math.floor(last.y), state.map.bastion.y);
});

test('the wave behind it takes the gap it tore, without being teleported', () => {
  const state = bareField();
  const dir = driveDirection(state.map);
  const start = laneStart(state.map, 9, dir);
  const target = { x: start.x + dir.dx * 7, y: start.y + dir.dy * 7 };
  for (let i = 0; i < KOLOSS_RUN.breachCells; i++) {
    addRubble(state, { x: target.x + dir.dx * i, y: target.y + dir.dy * i });
  }
  state.route = computeRoute(state.map);

  const e = arrived(state);
  // One ordinary enemy walking the frozen wave route.
  const walker = state.enemies.find((enemy) => !enemy.koloss) ?? null;
  assert.equal(walker, null, 'the wave itself has not spawned yet in this test');

  const ground = state.waveRoutes.ground;
  const before = { x: ground.points[3].x, y: ground.points[3].y };
  const other = {
    koloss: false,
    flying: false,
    route: null,
    dead: false,
    d: ground.cumulative[3],
    x: before.x,
    y: before.y,
    dx: 1,
    dy: 0,
    speed: 1,
    slow: 0,
    slowUntil: 0,
    stunUntil: 0,
    holdUntil: 0,
  };
  state.enemies.push(other);

  run(state, () => !e.charging, 'the end of the charge');
  assert.notEqual(state.waveRoutes.ground, ground, 'the wave route was recomputed');
  // It was put back on the new line where it stands, not thrown somewhere else.
  const now = positionAt(state.waveRoutes.ground, other.d);
  assert.ok(Math.hypot(now.x - other.x, now.y - other.y) < 1.5, 'no jump');
});

// ---------- Nothing outlives what it hangs off ----------

test('the wave ending stops every effect the towers were drawing', () => {
  const state = bareField();
  const cell = state.route.cells[10];
  const tower = addTower(state, { x: cell.x, y: cell.y - 1, doctrine: 'psi', special: 'soulfireObelisk' });
  state.phase = 'wave';
  state.waveScale = 1;
  state.waveStats = { spawned: 0, leaked: 0, killed: 0, bossKills: 0 };
  state.waveRoutes = { ground: groundPolyline(state.route), flyer: flyerPolyline(state.map) };
  const e = spawnEnemy(state, 'warrior');
  e.x = cell.x + 0.5;
  e.y = cell.y + 0.5;

  updateCombat(state, SIM_STEP);
  assert.equal(tower.firing, true, 'it is working while the wave runs');

  // However the wave ends — cleared or lost — nothing may still be drawn as
  // firing, or a violet ring keeps turning over an empty map.
  setPhase(state, 'evaluation');
  assert.equal(tower.firing, false);
  assert.equal(tower.aim, null);
});

test('taking an emplacement off the field leaves nothing pointing at it', () => {
  const state = bareField();
  const cell = state.route.cells[10];
  state.phase = 'wave';
  state.waveScale = 1;
  state.waveStats = { spawned: 0, leaked: 0, killed: 0, bossKills: 0 };
  state.waveRoutes = { ground: groundPolyline(state.route), flyer: flyerPolyline(state.map) };
  const tower = addTower(state, { x: cell.x, y: cell.y - 1, doctrine: 'flame', rank: 3 });
  const e = spawnEnemy(state, 'warrior');
  e.x = cell.x + 0.5;
  e.y = cell.y + 0.5;
  e.burn = { dps: 5, until: state.time + 3, doctrine: 'flame', towerId: tower.id };
  state.projectiles.push({ id: 1, towerId: tower.id, from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, t: 0, flight: 1 });
  tower.firing = true;
  tower.aim = { x: e.x, y: e.y };

  removeTower(state, tower.id);
  assert.equal(tower.firing, false, 'it is not firing, it is gone');
  assert.equal(tower.aim, null);
  assert.equal(e.burn.towerId, null, 'the fire it lit belongs to nobody now');
  assert.equal(state.projectiles.length, 0, 'and its shell went with it');
  assert.ok(state.events.some((ev) => ev.type === 'towerRemoved'), 'the render side is told');
});

test('the ram destroys the emplacement in its way, effects and all', () => {
  const state = bareField();
  const { map } = state;
  const cell = { x: 8, y: 8 };
  const ahead = { x: cell.x + 1, y: cell.y };
  const tower = addTower(state, { ...ahead, doctrine: 'psi', special: 'soulfireObelisk' });
  tower.firing = true;
  tower.aim = { x: 1, y: 1 };
  for (const [dx, dy] of [[-1, 0], [0, 1], [0, -1]]) {
    const wall = { x: cell.x + dx, y: cell.y + dy };
    addRubble(state, wall);
    raiseBulwark(state, wall);
  }
  const e = {
    x: cell.x + 0.5,
    y: cell.y + 0.5,
    dx: 1,
    dy: 0,
    koloss: true,
    dead: false,
    charging: false,
    holdUntil: 0,
    crushed: 0,
  };
  state.enemies.push(e);
  state.phase = 'wave';

  assert.equal(routeToBastion(state, e), false, 'walled in, with the emplacement as one wall');
  breach(state, e);
  assert.deepEqual(e.ram.cell, ahead, 'it rams the emplacement');

  state.time += KOLOSS_RUN.ramSeconds + SIM_STEP;
  updateKolossRun(state);
  assert.equal(state.towers.length, 0, 'the emplacement is gone');
  assert.equal(isBlocked(map.grid, ahead.x, ahead.y), false, 'its cell with it');
  assert.equal(tower.firing, false, 'and it left no effect behind');
});
