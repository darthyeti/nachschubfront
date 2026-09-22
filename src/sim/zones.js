// Landing zones (GDD section 3): up to five cells marked during planning.
// A zone is only a marker; the cell is blocked when the pod lands.

import { PODS } from '../data/pods.js';
import { checkPlacement } from './route.js';

export function zoneIndexAt(state, cell) {
  return state.zones.findIndex((z) => z.x === cell.x && z.y === cell.y);
}

export function zonesFull(state) {
  return state.zones.length >= PODS.perSalvo;
}

/**
 * Checks a cell against all zones marked so far: the whole salvo must leave the
 * chain of legs walkable, not each pod on its own.
 * @returns {{ok: true} | {ok: false, reason: 'phase' | 'full' | 'outside' | 'protected' | 'occupied' | 'blocks'}}
 */
export function canMarkZone(state, cell) {
  if (state.phase !== 'planning' || state.stress) return { ok: false, reason: 'phase' };
  if (zonesFull(state)) return { ok: false, reason: 'full' };
  return checkPlacement(state.map, [...state.zones, cell]);
}

/**
 * Marks a free cell or removes an existing marker.
 * @returns {{ok: true, action: 'added' | 'removed'} | {ok: false, reason: string}}
 */
export function toggleZone(state, cell) {
  if (state.phase !== 'planning' || state.stress) return { ok: false, reason: 'phase' };
  const index = zoneIndexAt(state, cell);
  if (index >= 0) {
    state.zones.splice(index, 1);
    return { ok: true, action: 'removed' };
  }
  const check = canMarkZone(state, cell);
  if (!check.ok) return check;
  state.zones.push({ x: cell.x, y: cell.y });
  return { ok: true, action: 'added' };
}

export function clearZones(state) {
  state.zones.length = 0;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Every cell of the map in a fixed order, so a shuffle only depends on the rng. */
function allCells(size) {
  const cells = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) cells.push({ x, y });
  return cells;
}

/**
 * Fills the salvo up to PODS.perSalvo with random valid zones (GDD section 3).
 * Candidates are tried in a seeded shuffle, so the result only depends on the
 * seed and the zones the player marked. Every candidate is checked against all
 * zones together, which keeps the route open after the salvo.
 *
 * Spread-out cells are preferred; if space runs short, the distance rule is
 * dropped before the salvo is left incomplete.
 * @param {ReturnType<import('../core/random.js').createRng>} rng
 * @returns {number} Number of zones added.
 */
export function fillZones(state, rng) {
  const missing = PODS.perSalvo - state.zones.length;
  if (missing <= 0) return 0;
  const candidates = rng.shuffle(allCells(state.map.size));
  let added = 0;
  for (const spread of [true, false]) {
    for (const cell of candidates) {
      if (state.zones.length >= PODS.perSalvo) return added;
      if (zoneIndexAt(state, cell) >= 0) continue;
      if (spread && state.zones.some((z) => manhattan(z, cell) < PODS.minRandomDistance)) continue;
      if (!checkPlacement(state.map, [...state.zones, cell]).ok) continue;
      state.zones.push({ x: cell.x, y: cell.y });
      added++;
    }
  }
  return added;
}
