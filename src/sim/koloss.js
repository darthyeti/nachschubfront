// The Koloss (GDD section 9, v4): the late threat.
//
// It announces itself two waves ahead, picks a lane one wave ahead, then enters
// from the map edge on the rift side, drives straight along that lane, tears a
// swathe through the maze and finds its own way on towards the bastion.
// Everything it does is on the state, so the render side only reads.
//
// A lane is a row or a column that starts at the rift edge and runs towards the
// bastion. Its target is the first cell on it that blocks: the Koloss never has
// to steer around anything before it gets there.

import { KOLOSS_RUN } from '../data/enemies.js';
import { isBulwark, bulwarkIndexAt, crushCell } from './rubble.js';
import { towerAt, towerStats, towerCentre, removeTower } from './towers.js';
import { computeRoute, createPolyline, groundPolyline, nearestDistanceOn } from './route.js';
import { findPath } from './pathfinding.js';
import { inBounds, isBlocked, setBlocked } from './grid.js';
import { spawnEnemy } from './enemies.js';

/** The next wave that carries a Koloss, or null once they are all past. */
export function nextKolossWave(wave) {
  return KOLOSS_RUN.waves.find((w) => w >= wave) ?? null;
}

export function isKolossWave(wave) {
  return KOLOSS_RUN.waves.includes(wave);
}

/**
 * How loudly the run announces itself in the wave the player is planning.
 * - 'none'      nothing on the horizon
 * - 'warning'   two waves out: it is coming, no target yet
 * - 'predicted' one wave out: the target is shown and still moves
 * - 'arrived'   this wave: the target is fixed and it is on the field
 * @param {number} wave  The wave being planned or played.
 */
export function kolossStage(wave) {
  const next = nextKolossWave(wave);
  if (next === null) return 'none';
  const away = next - wave;
  if (away === 0) return 'arrived';
  if (away === 1) return 'predicted';
  if (away <= KOLOSS_RUN.warningWaves) return 'warning';
  return 'none';
}

/**
 * Firepower that can reach a cell: damage per second of every emplacement in
 * range, plus what the bulwarks nearby are worth. Bulwarks carry no weapon, but
 * the GDD wants the prediction to move when the player reinforces the marked
 * spot, and a bulwark is the one thing that stops the ram.
 */
export function firepowerAt(state, cell) {
  const x = cell.x + 0.5;
  const y = cell.y + 0.5;
  let power = 0;
  for (const tower of state.towers) {
    const stats = towerStats(tower);
    const centre = towerCentre(tower);
    const dx = centre.x - x;
    const dy = centre.y - y;
    if (dx * dx + dy * dy > stats.range * stats.range) continue;
    // A stream or an aura has no reload; count its damage as one shot a second.
    const rate = typeof stats.fire === 'number' && stats.fire > 0 ? stats.fire : 1;
    power += stats.damage * rate;
  }
  const r2 = KOLOSS_RUN.bulwarkRadius * KOLOSS_RUN.bulwarkRadius;
  for (const obstacle of state.map.obstacles) {
    if (obstacle.kind !== 'bulwark') continue;
    const c = obstacle.cells[0];
    const dx = c.x + 0.5 - x;
    const dy = c.y + 0.5 - y;
    if (dx * dx + dy * dy <= r2) power += KOLOSS_RUN.bulwarkFirepower;
  }
  return power;
}

/**
 * The direction the Koloss drives in: away from the rift edge, towards the
 * bastion. Read off the rift's own position, so it does not depend on how the
 * map generator happens to rotate its local coordinates.
 * @returns {{dx: number, dy: number}} One of the four axis directions.
 */
export function driveDirection(map) {
  const last = map.size - 1;
  if (map.rift.x === 0) return { dx: 1, dy: 0 };
  if (map.rift.x === last) return { dx: -1, dy: 0 };
  if (map.rift.y === 0) return { dx: 0, dy: 1 };
  return { dx: 0, dy: -1 };
}

/**
 * Where lane `index` starts, on the map edge of the rift side. Lanes run across
 * the drive direction, so the index counts rows for a sideways drive and
 * columns for one up or down.
 */
export function laneStart(map, index, dir = driveDirection(map)) {
  const last = map.size - 1;
  if (dir.dx !== 0) return { x: dir.dx > 0 ? 0 : last, y: index };
  return { x: index, y: dir.dy > 0 ? 0 : last };
}

/**
 * The first cell on a lane that blocks: rubble, a bulwark, an emplacement or a
 * piece of terrain. Everything before it is open by definition, which is what
 * lets the Koloss drive the lane in a straight line.
 *
 * Protected ground (the rift, the beacons, the bastion and their surroundings)
 * is no target: a threat there is one the player is not allowed to answer,
 * because nothing may be built on those cells. A lane that blocks for the first
 * time on protected ground is dropped.
 *
 * @returns {{x: number, y: number} | null} Null if the lane is open all the way
 *   or blocks only where the player cannot answer.
 */
export function laneTarget(state, index, dir = driveDirection(state.map)) {
  const { map } = state;
  const start = laneStart(map, index, dir);
  for (let i = 0; i < map.size; i++) {
    const x = start.x + dir.dx * i;
    const y = start.y + dir.dy * i;
    if (!inBounds(map.grid, x, y)) return null;
    if (!isBlocked(map.grid, x, y)) continue;
    return map.protected[y * map.size + x] ? null : { x, y };
  }
  return null;
}

/** Distance from a cell to the nearest cell of the route to the bastion. */
function distanceToRoute(route, cell) {
  let best = Infinity;
  for (const c of route.cells) {
    const d = Math.abs(c.x - cell.x) + Math.abs(c.y - cell.y);
    if (d < best) best = d;
  }
  return best;
}

/**
 * The lane the Koloss takes: the one whose target has the least firepower over
 * it. A tie goes to the lane nearer the current shortest way to the bastion —
 * the one that opens the maze where it hurts (GDD section 9).
 * @returns {{index: number, target: object, dx: number, dy: number} | null}
 *   Null if no lane blocks anywhere; the Koloss then goes straight to its own
 *   pathfinding.
 */
export function chooseLane(state) {
  const dir = driveDirection(state.map);
  const route = state.route ?? computeRoute(state.map);
  let best = null;
  let bestPower = Infinity;
  let bestDistance = Infinity;
  for (let index = 0; index < state.map.size; index++) {
    const target = laneTarget(state, index, dir);
    if (!target) continue;
    const power = firepowerAt(state, target);
    if (power > bestPower + 1e-9) continue;
    const distance = route ? distanceToRoute(route, target) : 0;
    if (power > bestPower - 1e-9 && distance >= bestDistance) continue;
    bestPower = power;
    bestDistance = distance;
    best = { index, target, dx: dir.dx, dy: dir.dy };
  }
  return best;
}

/**
 * Keeps the announcement in step with the wave and the maze. Called once per
 * planning step; the prediction is only recomputed when the map has actually
 * changed, so building does not cost a full sweep per frame.
 */
export function updateKoloss(state) {
  const wave = state.phase === 'planning' ? state.wave + 1 : state.wave;
  const stage = kolossStage(wave);
  if (stage === 'none') {
    state.koloss = null;
    return;
  }
  const runWave = nextKolossWave(wave);
  if (!state.koloss || state.koloss.wave !== runWave) {
    state.koloss = {
      wave: runWave,
      stage,
      lane: null,
      target: null,
      swathe: [],
      stoppedBy: null,
      mapVersion: -1,
      breached: false,
    };
  }
  const run = state.koloss;
  run.stage = stage;
  if (stage === 'warning') {
    run.lane = null;
    run.target = null;
    run.swathe = [];
    run.stoppedBy = null;
    return;
  }
  // "Die Welle des Auftritts: Die Fahrlinie ist fest" (GDD section 9) means the
  // wave, not its planning phase: the player keeps the round before the arrival
  // to move the marker, and it freezes the moment the wave starts.
  if (stage === 'arrived' && state.phase !== 'planning' && run.target) return;
  if (run.mapVersion === state.mapVersion && run.target) return;
  run.mapVersion = state.mapVersion;
  const lane = chooseLane(state);
  const path = lane ? breachPath(state, lane.target, lane.dx, lane.dy) : null;
  run.lane = lane;
  run.target = lane ? lane.target : null;
  run.swathe = path ? path.cells : [];
  // What ends the swathe, so the arrival does not have to work it out again:
  // the lane is fixed once the wave runs, and so is what stands in it.
  run.stoppedBy = path ? path.stoppedBy : null;
}

/**
 * Puts the Koloss on the field at the start of its wave. It enters at the map
 * edge of its lane, not at the rift, and drives that lane straight through the
 * target and on to the end of the swathe, so the charge is one segment on one
 * axis (GDD section 9).
 */
export function spawnKoloss(state) {
  const run = state.koloss;
  if (!run || run.wave !== state.wave) return null;
  // No lane blocks anywhere: it enters on the lane through the rift and goes
  // straight to finding its own way (GDD section 9).
  if (!run.lane) return spawnWithoutLane(state);
  const { lane } = run;
  const start = laneStart(state.map, lane.index, lane);
  // The charge runs through the target and along the swathe. With a bulwark or
  // an emplacement on the target itself there is no swathe at all, and it comes
  // to a stand on the last open cell in front of it.
  const end =
    run.swathe.length > 0
      ? run.swathe[run.swathe.length - 1]
      : { x: lane.target.x - lane.dx, y: lane.target.y - lane.dy };
  const e = spawnEnemy(state, 'koloss');
  e.koloss = true;
  e.route = createPolyline([
    { x: start.x + 0.5, y: start.y + 0.5 },
    { x: end.x + 0.5, y: end.y + 0.5 },
  ]);
  e.d = 0;
  e.dx = lane.dx;
  e.dy = lane.dy;
  e.charging = true;
  // Which cells of the swathe it has already ground down, so each one is torn
  // open once, as it drives over it, and not all at the moment it arrives.
  e.crushed = 0;
  state.events.push({ type: 'kolossArrived', x: e.x, y: e.y, target: { ...lane.target } });
  return e;
}

/**
 * The Koloss on a field that blocks nowhere: it drives in on the lane through
 * the rift and looks for its own way from the first cell on.
 */
function spawnWithoutLane(state) {
  const dir = driveDirection(state.map);
  const index = dir.dx !== 0 ? state.map.rift.y : state.map.rift.x;
  const start = laneStart(state.map, index, dir);
  const e = spawnEnemy(state, 'koloss');
  e.koloss = true;
  e.charging = false;
  e.crushed = 0;
  e.dx = dir.dx;
  e.dy = dir.dy;
  e.x = start.x + 0.5;
  e.y = start.y + 0.5;
  if (!routeToBastion(state, e)) startRam(state, e);
  state.events.push({ type: 'kolossArrived', x: e.x, y: e.y, target: null });
  return e;
}

/**
 * The swathe the ram tears, from `cell` in the direction (dx, dy).
 * It runs at most `breachCells` cells and stops at the first thing built to
 * stand: a bulwark or an emplacement. Rubble and terrain in between are ground
 * down as it passes (GDD section 9).
 *
 * Free cells inside the swathe count towards its length. The swathe is always
 * five cells long, however much rubble happens to lie in it.
 * @returns {{cells: object[], stoppedBy: 'bulwark' | 'tower' | 'edge' | null}}
 */
export function breachPath(state, cell, dx, dy) {
  // The swathe follows one axis, like every move the Koloss makes.
  const stepX = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0;
  const stepY = stepX === 0 ? Math.sign(dy) || 1 : 0;
  const cells = [];
  for (let i = 0; i < KOLOSS_RUN.breachCells; i++) {
    const x = cell.x + stepX * i;
    const y = cell.y + stepY * i;
    if (!inBounds(state.map.grid, x, y)) return { cells, stoppedBy: 'edge' };
    if (isBulwark(state.map, { x, y })) return { cells, stoppedBy: 'bulwark' };
    if (towerAt(state, { x, y })) return { cells, stoppedBy: 'tower' };
    cells.push({ x, y });
  }
  return { cells, stoppedBy: null };
}

/**
 * Grinds one cell down and lets everything that depends on the maze know.
 * Other enemies keep their beacons but recompute their way, because the gap the
 * Koloss just opened may be shorter than the one they were walking (GDD 9).
 */
function crush(state, cell) {
  if (!crushCell(state, cell)) return false;
  openedUp(state, cell);
  return true;
}

/**
 * Tells everything that depends on the maze that a cell is open again. The gap
 * the Koloss just tore may be the shorter way now, so the enemies walking the
 * old route are put back onto the new one where they stand (GDD section 9:
 * they recompute as soon as it has destroyed rubble).
 */
function openedUp(state, cell) {
  setBlocked(state.map.grid, cell.x, cell.y, false);
  state.route = computeRoute(state.map);
  state.mapVersion += 1;
  if (state.waveRoutes && state.route) {
    const ground = groundPolyline(state.route);
    state.waveRoutes.ground = ground;
    for (const e of state.enemies) {
      // Flyers never cared about the maze, and the Koloss walks a line of its own.
      if (e.flying || e.koloss || e.route) continue;
      e.d = nearestDistanceOn(ground, e.x, e.y);
    }
  }
  state.events.push({ type: 'kolossCrush', x: cell.x + 0.5, y: cell.y + 0.5 });
}

/**
 * Sends the Koloss on its own way to the bastion: no beacons, rubble passable
 * but expensive, only a bulwark or an emplacement truly in the way.
 * @returns {boolean} False if it is walled in and has to ram.
 */
export function routeToBastion(state, e) {
  const from = { x: Math.floor(e.x), y: Math.floor(e.y) };
  const path = findPath(state.map.grid, from, state.map.bastion, {
    diagonal: false,
    extraCost: (x, y) =>
      isBulwark(state.map, { x, y }) || towerAt(state, { x, y }) ? null : KOLOSS_RUN.rubbleExtraCost,
  });
  if (!path) return false;
  e.route = createPolyline(path.cells.map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 })));
  e.d = 0;
  e.corner = 0;
  return true;
}

/**
 * Ends the charge: the Koloss has driven its lane and its swathe. A bulwark or
 * an emplacement that stopped it leaves it stunned for a moment; either way it
 * looks for its own way on from here (GDD section 9).
 */
export function breach(state, e, stoppedBy = null) {
  e.charging = false;
  state.koloss = state.koloss ? { ...state.koloss, breached: true } : null;
  state.events.push({
    type: 'kolossBreach',
    x: e.x,
    y: e.y,
    cells: (state.koloss?.swathe ?? []).map((c) => ({ ...c })),
    cleared: e.crushed ?? 0,
    stoppedBy,
  });
  if (stoppedBy === 'bulwark' || stoppedBy === 'tower') {
    e.holdUntil = state.time + KOLOSS_RUN.stunSeconds;
    e.stopped = stoppedBy;
  }
  if (!routeToBastion(state, e)) startRam(state, e);
}

/**
 * Walled in: it rams whatever stands in its current direction, with a countdown
 * over the obstacle. When the countdown runs out the obstacle becomes rubble
 * and is crushed on the spot (GDD section 9).
 */
export function startRam(state, e) {
  const cell = { x: Math.floor(e.x) + e.dx, y: Math.floor(e.y) + e.dy };
  e.ram = { cell, until: state.time + KOLOSS_RUN.ramSeconds };
  e.holdUntil = e.ram.until;
  state.events.push({ type: 'kolossRam', x: cell.x + 0.5, y: cell.y + 0.5, seconds: KOLOSS_RUN.ramSeconds });
}

/**
 * Finishes a ram: the bulwark or emplacement in front of it gives way. An
 * emplacement is torn down with everything hanging off it, a bulwark falls to
 * rubble and is ground down in the same movement.
 */
function finishRam(state, e) {
  const { cell } = e.ram;
  e.ram = null;
  // An emplacement leaves its cell blocked when it is taken off the list, so
  // the maze the player built survives a recipe. Here it must not: the Koloss
  // has just ground the cell open, and `openedUp` frees it either way.
  const tower = towerAt(state, cell);
  if (tower) removeTower(state, tower.id);
  const bulwark = bulwarkIndexAt(state.map, cell);
  if (bulwark >= 0) state.map.obstacles[bulwark].kind = 'rubble';
  crushCell(state, cell);
  openedUp(state, cell);
  state.events.push({ type: 'kolossRamDone', x: cell.x + 0.5, y: cell.y + 0.5 });
  if (!routeToBastion(state, e)) startRam(state, e);
}

/**
 * Everything the Koloss does per step that the generic enemy movement does not:
 * grinding the swathe down cell by cell, turning at corners, ending the charge
 * and counting the ram down. Runs after the movement pass.
 */
export function updateKolossRun(state) {
  for (const e of state.enemies) {
    if (!e.koloss || e.dead) continue;

    if (e.ram) {
      if (state.time >= e.ram.until) finishRam(state, e);
      continue;
    }

    // Whatever it stands on is ground down, on the charge and afterwards alike:
    // "kein Durchfahren von Trümmern ohne Zerstörung".
    const cell = { x: Math.floor(e.x), y: Math.floor(e.y) };
    if (isBlocked(state.map.grid, cell.x, cell.y) && !isBulwark(state.map, cell) && !towerAt(state, cell)) {
      if (crush(state, cell)) e.crushed = (e.crushed ?? 0) + 1;
    }

    if (e.charging) {
      if (e.d >= e.route.length) breach(state, e, state.koloss?.stoppedBy ?? null);
      continue;
    }

    turnAtCorners(state, e);
  }
}

/**
 * Holds the Koloss at a corner of its path while it turns on the spot: it only
 * drives on the four axes, so a change of direction costs time rather than
 * happening mid-cell (GDD section 9).
 */
function turnAtCorners(state, e) {
  const line = e.route;
  if (!line || state.time < e.holdUntil) return;
  const corner = e.corner ?? 0;
  if (corner + 1 >= line.points.length - 1) return;
  const at = line.cumulative[corner + 1];
  if (e.d < at) return;
  e.corner = corner + 1;
  const before = heading(line.points[corner], line.points[corner + 1]);
  const after = heading(line.points[corner + 1], line.points[corner + 2]);
  if (before.dx === after.dx && before.dy === after.dy) return;
  // Exactly at the corner, turned on the spot, then on along the new axis.
  e.d = at;
  e.dx = after.dx;
  e.dy = after.dy;
  e.holdUntil = state.time + KOLOSS_RUN.turnSeconds;
}

/** Axis direction from one point of a path to the next. */
function heading(a, b) {
  return { dx: Math.sign(b.x - a.x), dy: Math.sign(b.y - a.y) };
}
