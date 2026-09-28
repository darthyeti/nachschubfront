// Landing zones (GDD section 3): as many cells as the coming salvo has pods,
// marked during planning. A zone is only a marker; the cell is blocked when the
// pod lands.

import { PODS, salvoSize } from '../data/pods.js';
import { checkPlacement, routeWith } from './route.js';
import { isBlocked } from './grid.js';
import { isRubble, nextRubbleCost } from './rubble.js';
import { upcomingWave } from './pods.js';
import { record } from './record.js';

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
 * Whether a capsule that came down on this cell could be built on at all. A zone
 * on a free cell always can; one on a heap of rubble only while the purse covers
 * the demolition, because that is what building there costs (GDD section 3).
 *
 * Nothing is earned between the planning phase and the selection, so what this
 * says while the marker is set still holds when the capsule opens.
 */
export function zoneAffordable(state, cell) {
  return !isRubble(state.map, cell) || state.requisition >= nextRubbleCost(state);
}

/**
 * Whether a capsule may still come down on that cell: the one part of
 * `checkPlacement`'s per-cell rule that can change while a marker is standing.
 * Free ground and heaps of rubble take a capsule, nothing else does — a bulwark
 * raised on the marked heap is the case this catches. Bounds and protected cells
 * are fixed when the map is made.
 *
 * Why not `checkPlacement` itself: that also asks whether the route stays open,
 * which is a question about the whole salvo rather than this one cell, and was
 * answered when the marker went down. A cell that was blocked already — rubble —
 * cannot have made it worse since.
 */
export function zoneGroundOk(state, cell) {
  return !isBlocked(state.map.grid, cell.x, cell.y) || isRubble(state.map, cell);
}

/** Why a standing marker is no longer any good, or null while it still is. */
export function zoneFault(state, cell) {
  if (!zoneGroundOk(state, cell)) return 'occupied';
  return zoneAffordable(state, cell) ? null : 'funds';
}

/**
 * Checks a cell against all zones marked so far: the whole salvo must leave the
 * chain of legs walkable, not each pod on its own.
 * @returns {{ok: true} | {ok: false, reason: 'phase' | 'full' | 'funds' | 'outside' | 'protected' | 'occupied' | 'blocks'}}
 */
export function canMarkZone(state, cell) {
  if (state.phase !== 'planning' || state.stress) return { ok: false, reason: 'phase' };
  if (zonesFull(state)) return { ok: false, reason: 'full' };
  // A heap nobody can clear makes the capsule on it unbuildable, and a marker
  // there would be a wasted slot rather than a choice: an unchosen capsule
  // leaves the heap exactly as it was, so it does not even add an obstacle.
  if (!zoneAffordable(state, cell)) return { ok: false, reason: 'funds' };
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
    record(state, 'zone', { x: cell.x, y: cell.y, on: false });
    return { ok: true, action: 'removed' };
  }
  const check = canMarkZone(state, cell);
  if (!check.ok) return check;
  state.zones.push({ x: cell.x, y: cell.y });
  refreshZonePreview(state);
  record(state, 'zone', { x: cell.x, y: cell.y, on: true });
  return { ok: true, action: 'added' };
}

export function clearZones(state) {
  state.zones.length = 0;
  refreshZonePreview(state);
}

/**
 * Drops the markers that are no longer any good and returns them with the reason.
 * What the player does next in the planning phase can pull the ground out from
 * under a marker set a moment before:
 *
 * - buying a supply level empties the purse below the demolition,
 * - demolishing or raising a bulwark does that too, and pushes the price of the
 *   next heap up as well,
 * - raising a bulwark on the marked heap leaves a cell no capsule may land on,
 * - and the debug obstacle tool can bury a marked free cell under rubble.
 *
 * The later action wins and the marker goes, which is the same way round as
 * everywhere else here. Refusing the purchase instead would mean a bulwark that
 * fails to go up for a reason nobody can see.
 *
 * Each removal is recorded like a marker the player took back, so a protocol
 * replays the same way (sim/replay.js reads `zone` actions).
 * @returns {{x: number, y: number, reason: 'occupied' | 'funds'}[]}
 */
export function dropInvalidZones(state) {
  const dropped = [];
  for (const zone of [...state.zones]) {
    const reason = zoneFault(state, zone);
    if (!reason) continue;
    const index = zoneIndexAt(state, zone);
    if (index < 0) continue;
    state.zones.splice(index, 1);
    record(state, 'zone', { x: zone.x, y: zone.y, on: false });
    dropped.push({ x: zone.x, y: zone.y, reason });
  }
  if (dropped.length > 0) {
    refreshZonePreview(state);
    state.events.push({ type: 'zonesDropped', cells: dropped });
  }
  return dropped;
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
 * the player never asked for — so rubble is only used when nothing else fits,
 * and a heap the player could not clear only when nothing else is left at all.
 * That last round can hand out a capsule nobody can build on; the selection
 * phase lets the salvo be given up rather than sit on an impossible choice
 * (sim/actions.js, `forfeitSalvo`).
 * @param {ReturnType<import('../core/random.js').createRng>} rng
 * @returns {number} Number of zones added.
 */
export function fillZones(state, rng) {
  const missing = zoneLimit(state) - state.zones.length;
  if (missing <= 0) return 0;
  const candidates = rng.shuffle(allCells(state.map.size));
  let added = 0;
  // Four rounds, each looser than the one before: spread and free, close and
  // free, then affordable rubble, then anything that is allowed at all.
  for (const [spread, freeOnly, affordableOnly] of [
    [true, true, true],
    [false, true, true],
    [false, false, true],
    [false, false, false],
  ]) {
    for (const cell of candidates) {
      if (zonesFull(state)) break;
      if (zoneIndexAt(state, cell) >= 0) continue;
      if (spread && state.zones.some((z) => manhattan(z, cell) < PODS.minRandomDistance)) continue;
      if (freeOnly && isRubble(state.map, cell)) continue;
      if (affordableOnly && !zoneAffordable(state, cell)) continue;
      if (!checkPlacement(state.map, [...state.zones, cell]).ok) continue;
      state.zones.push({ x: cell.x, y: cell.y });
      added++;
    }
    if (zonesFull(state)) break;
  }
  refreshZonePreview(state);
  return added;
}
