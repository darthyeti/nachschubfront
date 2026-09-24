// Landing zones (GDD section 3): as many cells as the coming salvo has pods,
// marked during planning. A zone is only a marker; the cell is blocked when the
// pod lands.

import { PODS, salvoSize } from '../data/pods.js';
import { checkPlacement, routeWith } from './route.js';
import { isRubble } from './rubble.js';
import { upcomingWave } from './pods.js';

/**
 * Recomputes the route the enemies would take once the marked zones are built
 * (GDD section 3: the preview follows every marker). Null clears it.
 */
export function refreshZonePreview(state) {
  state.zonePreview = state.zones.length > 0 ? routeWith(state.map, state.zones) : null;
  state.mapVersion += 1;
}

/** Route to show and measure during planning: the preview if zones are marked. */
export function previewRoute(state) {
  return state.zonePreview ?? state.route;
}

export function zoneIndexAt(state, cell) {
  return state.zones.findIndex((z) => z.x === cell.x && z.y === cell.y);
}

/** Zones the coming salvo can use; the size follows the wave (GDD section 3). */
export function zoneLimit(state) {
  return salvoSize(upcomingWave(state));
}

export function zonesFull(state) {
  return state.zones.length >= zoneLimit(state);
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
    refreshZonePreview(state);
    return { ok: true, action: 'removed' };
  }
  const check = canMarkZone(state, cell);
  if (!check.ok) return check;
  state.zones.push({ x: cell.x, y: cell.y });
  refreshZonePreview(state);
  return { ok: true, action: 'added' };
}

export function clearZones(state) {
  state.zones.length = 0;
  refreshZonePreview(state);
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
 * Fills the salvo up to its wave's size with random valid zones (GDD section 3).
 * Candidates are tried in a seeded shuffle, so the result only depends on the
 * seed and the zones the player marked. Every candidate is checked against all
 * zones together, which keeps the route open after the salvo.
 *
 * Spread-out cells are preferred; if space runs short, the distance rule is
 * dropped before the salvo is left incomplete.
 *
 * Free cells come before heaps of rubble. A zone on rubble is allowed since v3,
 * but building there costs the demolition, and the game must not run up a bill
 * the player never asked for — so rubble is only used when nothing else fits.
 * @param {ReturnType<import('../core/random.js').createRng>} rng
 * @returns {number} Number of zones added.
 */
export function fillZones(state, rng) {
  const missing = zoneLimit(state) - state.zones.length;
  if (missing <= 0) return 0;
  const candidates = rng.shuffle(allCells(state.map.size));
  let added = 0;
  // Three rounds, each looser than the one before: spread and free, close and
  // free, then anything that is allowed at all.
  for (const [spread, freeOnly] of [
    [true, true],
    [false, true],
    [false, false],
  ]) {
    for (const cell of candidates) {
      if (zonesFull(state)) break;
      if (zoneIndexAt(state, cell) >= 0) continue;
      if (spread && state.zones.some((z) => manhattan(z, cell) < PODS.minRandomDistance)) continue;
      if (freeOnly && isRubble(state.map, cell)) continue;
      if (!checkPlacement(state.map, [...state.zones, cell]).ok) continue;
      state.zones.push({ x: cell.x, y: cell.y });
      added++;
    }
    if (zonesFull(state)) break;
  }
  refreshZonePreview(state);
  return added;
}
