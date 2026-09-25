// The Koloss (GDD section 9, v3): the late threat.
//
// It announces itself two waves ahead, predicts the weakest place on the route
// one wave ahead, then drives straight at that place, rams a swathe through the
// maze and walks on towards the bastion. Everything it does is on the state, so
// the render side only reads.

import { KOLOSS_RUN } from '../data/enemies.js';
import { isRubble, isBulwark, clearRubble } from './rubble.js';
import { towerAt, towerStats, towerCentre } from './towers.js';
import { computeRoute, createPolyline } from './route.js';
import { findPath } from './pathfinding.js';
import { inBounds } from './grid.js';
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
 * The spot the Koloss aims at: the place on the shortest way to the bastion
 * with the least firepower over it. Ties go to the cell nearer the bastion,
 * which is the more dangerous one to leave open.
 * @returns {{x: number, y: number} | null} Null if there is no route at all.
 */
export function predictTarget(state) {
  const route = state.route ?? computeRoute(state.map);
  if (!route || route.cells.length === 0) return null;
  const { map } = state;
  let best = null;
  let bestPower = Infinity;
  for (const cell of route.cells) {
    // The rift, the beacons, the bastion and their surroundings are protected
    // ground: nothing can be built there, so aiming at them would mark a spot
    // the player is not allowed to answer.
    if (map.protected[cell.y * map.size + cell.x]) continue;
    const power = firepowerAt(state, cell);
    // `<=` walks towards the bastion on a tie: the later cell is the worse one
    // to leave open, because less of the route is left to stop him on.
    if (power <= bestPower) {
      bestPower = power;
      best = { x: cell.x, y: cell.y };
    }
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
  const target = nextKolossWave(wave);
  if (!state.koloss || state.koloss.wave !== target) {
    state.koloss = { wave: target, stage, target: null, mapVersion: -1, breached: false };
  }
  const run = state.koloss;
  run.stage = stage;
  if (stage === 'warning') {
    run.target = null;
    return;
  }
  // "Die Welle des Auftritts: Das Ziel ist fest" (GDD section 9) means the wave,
  // not its planning phase: the player keeps the round before the arrival to
  // move the marker, and it freezes the moment the wave starts.
  if (stage === 'arrived' && state.phase !== 'planning' && run.target) return;
  if (run.mapVersion === state.mapVersion && run.target) return;
  run.mapVersion = state.mapVersion;
  run.target = predictTarget(state);
}

/**
 * Puts the Koloss on the field at the start of its wave. It drives straight at
 * the predicted spot, so it gets a line of its own rather than the maze route.
 */
export function spawnKoloss(state) {
  const run = state.koloss;
  if (!run || run.wave !== state.wave || !run.target) return null;
  const start = state.map.rift;
  const e = spawnEnemy(state, 'koloss');
  e.koloss = true;
  e.route = createPolyline([
    { x: start.x + 0.5, y: start.y + 0.5 },
    { x: run.target.x + 0.5, y: run.target.y + 0.5 },
  ]);
  e.d = 0;
  e.charging = true;
  state.events.push({ type: 'kolossArrived', x: e.x, y: e.y, target: { ...run.target } });
  return e;
}

/**
 * The swathe the ram tears, from `cell` in the direction (dx, dy).
 * It runs at most `breachCells` cells and stops at the first thing built to
 * stand: a bulwark or an emplacement. Heaps of rubble in between are destroyed
 * (GDD section 9).
 * @returns {{cells: object[], stoppedBy: 'bulwark' | 'tower' | 'edge' | null}}
 */
export function breachPath(state, cell, dx, dy) {
  // The ram goes along the dominant axis; a diagonal swathe would cut corners
  // the pathfinding does not allow either.
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
 * Rams the maze open where the Koloss arrived and sends it on towards the
 * bastion. The breakthrough itself costs no lives (GDD section 9).
 */
export function breach(state, e) {
  const cell = { x: Math.floor(e.x), y: Math.floor(e.y) };
  const { cells, stoppedBy } = breachPath(state, cell, e.dx, e.dy);
  let cleared = 0;
  for (const c of cells) {
    if (isRubble(state.map, c) && clearRubble(state, c)) cleared += 1;
  }
  if (cleared > 0) {
    state.route = computeRoute(state.map);
    state.mapVersion += 1;
  }
  state.koloss = state.koloss ? { ...state.koloss, breached: true } : null;
  state.events.push({
    type: 'kolossBreach',
    x: e.x,
    y: e.y,
    cells: cells.map((c) => ({ ...c })),
    cleared,
    stoppedBy,
  });

  // From here it walks like anything else, straight for the bastion: a machine
  // that has just rammed through does not tour the beacons.
  e.charging = false;
  const from = { x: Math.round(e.x - 0.5), y: Math.round(e.y - 0.5) };
  const path = findPath(state.map.grid, from, state.map.bastion);
  e.route = path
    ? createPolyline(path.cells.map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 })))
    : createPolyline([
        { x: e.x, y: e.y },
        { x: state.map.bastion.x + 0.5, y: state.map.bastion.y + 0.5 },
      ]);
  e.d = 0;
}

/** Lets a charging Koloss ram once it has reached the spot it was aimed at. */
export function updateKolossRun(state) {
  for (const e of state.enemies) {
    if (!e.koloss || !e.charging || e.dead) continue;
    if (e.d >= e.route.length) breach(state, e);
  }
}
