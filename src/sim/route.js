// Enemy routes and the placement checks that keep them open.
//
// How a route runs depends on the map's layout (data/map.js), and each layout
// is an entry in ROUTE_KINDS rather than a branch:
//
// - `chain`, the standard map: rift -> beacons -> bastion (GDD section 5), each
//   leg its own shortest path.
// - `center`, King of the Hill (M7b, B1): four rifts on the edges and the
//   bastion in the middle. One distance field, computed backwards from the
//   bastion, serves every gate of every rift; nothing is computed per enemy or
//   per rift.

import { findPath, distanceField, descend } from './pathfinding.js';
import { inBounds, isBlocked, setBlocked } from './grid.js';
import { isRubble } from './rubble.js';
import { length as vectorLength } from '../core/exact.js';

/** Rift, beacons in order, bastion: the chain of the standard map. */
export function waypoints(map) {
  return [map.rift, ...map.beacons, map.bastion];
}

function chainRoute(map) {
  const points = waypoints(map);
  const cells = [points[0]];
  const legs = [];
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const leg = findPath(map.grid, points[i], points[i + 1]);
    if (!leg) return null;
    for (let j = 1; j < leg.cells.length; j++) cells.push(leg.cells[j]);
    legs.push(leg.length);
    length += leg.length;
  }
  return { cells: cells.map(({ x, y }) => ({ x, y })), length, legs };
}

function chainExists(map) {
  const points = waypoints(map);
  for (let i = 0; i < points.length - 1; i++) {
    if (!findPath(map.grid, points[i], points[i + 1])) return false;
  }
  return true;
}

function centre(cells) {
  const x = cells.reduce((sum, c) => sum + c.x, 0) / cells.length;
  const y = cells.reduce((sum, c) => sum + c.y, 0) / cells.length;
  return { x: x + 0.5, y: y + 0.5 };
}

/**
 * The route of one rift: one lane per gate, each the way down the distance
 * field. The route itself is the first lane, so everything that reads one route
 * (the preview, the statistics, the Koloss) keeps working.
 */
function centerRoute(map, riftIndex) {
  const rift = map.rifts[riftIndex] ?? map.rifts[0];
  const field = distanceField(map.grid, map.bastionCells);
  const lanes = [];
  for (const gate of rift.gates) {
    const lane = descend(map.grid, field, gate);
    if (!lane) return null;
    lanes.push(lane);
  }
  return { cells: lanes[0].cells, length: lanes[0].length, legs: [lanes[0].length], lanes };
}

/** Every gate of every rift reaches the bastion, read off one field. */
function centerExists(map) {
  const field = distanceField(map.grid, map.bastionCells);
  return map.rifts.every((rift) => rift.gates.every(({ x, y }) => field[y * map.size + x] !== Infinity));
}

/** Flyers ignore obstacles: straight from the middle of the rift to the middle of the bastion. */
function centerFlyerPoints(map, riftIndex) {
  const rift = map.rifts[riftIndex] ?? map.rifts[0];
  return [centre(rift.gates), centre(map.bastionCells)];
}

const ROUTE_KINDS = {
  chain: {
    compute: chainRoute,
    exists: chainExists,
    flyerPoints: (map) => waypoints(map).map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 })),
  },
  center: { compute: centerRoute, exists: centerExists, flyerPoints: centerFlyerPoints },
};

function routeKind(map) {
  const kind = ROUTE_KINDS[map.layout ?? 'chain'];
  if (!kind) throw new Error(`Unknown map layout: ${map.layout}`);
  return kind;
}

/**
 * Ground route of a rift (only the active one matters; the standard map has one).
 * @returns {{cells: {x: number, y: number}[], length: number, legs: number[],
 *   lanes?: {cells: object[], length: number}[]} | null}
 *   `legs` holds the length of each leg; `lanes` one route per gate where a
 *   rift has more than one. Null if the way is blocked.
 */
export function computeRoute(map, riftIndex = 0) {
  return routeKind(map).compute(map, riftIndex);
}

/** The route of the rift the running or coming wave uses. */
export function currentRoute(state) {
  return computeRoute(state.map, state.riftIndex ?? 0);
}

/**
 * Blocks the given cells, runs `fn`, and puts every cell back the way it was.
 * A landing zone may sit on rubble, which is blocked already — restoring by
 * clearing would free a cell that has to stay shut.
 */
function withBlocked(map, cells, fn) {
  const before = cells.map(({ x, y }) => isBlocked(map.grid, x, y));
  for (const { x, y } of cells) setBlocked(map.grid, x, y, true);
  try {
    return fn();
  } finally {
    cells.forEach(({ x, y }, i) => setBlocked(map.grid, x, y, before[i]));
  }
}

/**
 * Route as it would be if `cells` were obstacles, without changing the map.
 * Used for the planning preview: marked landing zones are not blocked yet.
 */
export function routeWith(map, cells, riftIndex = 0) {
  if (cells.length === 0) return computeRoute(map, riftIndex);
  return withBlocked(map, cells, () => computeRoute(map, riftIndex));
}

/**
 * True if the map can be walked: every leg of the chain, or on a map with
 * several rifts every gate of every one of them — a placement that cuts off a
 * rift that is not attacking now is refused all the same.
 */
export function routeExists(map) {
  return routeKind(map).exists(map);
}

/**
 * Checks whether the given cells may take a landing zone.
 *
 * A heap of rubble is allowed: since v3 a capsule may come down on one, and the
 * cell is torn down and paid for only if that capsule is the one built
 * (GDD section 3). Everything else that blocks — terrain, an emplacement — is
 * refused, and so are protected cells.
 *
 * @returns {{ok: true} | {ok: false, reason: 'outside' | 'protected' | 'occupied' | 'blocks'}}
 */
export function checkPlacement(map, cells) {
  for (const { x, y } of cells) {
    if (!inBounds(map.grid, x, y)) return { ok: false, reason: 'outside' };
    if (map.protected[y * map.size + x]) return { ok: false, reason: 'protected' };
    if (isBlocked(map.grid, x, y) && !isRubble(map, { x, y })) return { ok: false, reason: 'occupied' };
  }
  // Rubble is already blocked, so it changes nothing here; the check is about
  // the cells that are still free.
  return withBlocked(map, cells, () => routeExists(map)) ? { ok: true } : { ok: false, reason: 'blocks' };
}

/**
 * Polyline through cell centres (or arbitrary points) with cumulative distances,
 * used for walking enemies along a route.
 * @param {{x: number, y: number}[]} points  In world units.
 */
export function createPolyline(points) {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    cumulative.push(cumulative[i - 1] + vectorLength(b.x - a.x, b.y - a.y));
  }
  return { points, cumulative, length: cumulative[cumulative.length - 1] };
}

/** Ground polyline through the centres of the route cells. */
export function groundPolyline(route) {
  return createPolyline(route.cells.map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 })));
}

/** Flyers ignore obstacles and fly straight from waypoint to waypoint. */
export function flyerPolyline(map, riftIndex = 0) {
  return createPolyline(routeKind(map).flyerPoints(map, riftIndex));
}

/**
 * The lines a wave walks, frozen at its start: one ground line per gate (the
 * standard map has one gate, so `lanes` is just `[ground]`) and the flyers' line.
 */
export function freezeRoutes(state) {
  const route = state.route;
  const lanes = (route.lanes ?? [route]).map(groundPolyline);
  return { ground: lanes[0], lanes, flyer: flyerPolyline(state.map, state.riftIndex ?? 0) };
}

/** The line an enemy walks: its own (the Koloss), the flyers', or its lane. */
export function lineOf(state, enemy) {
  return enemy.route ?? waveLineOf(state, enemy);
}

/**
 * The wave's line for an enemy, ignoring a line of its own: the flyers' or its
 * lane. Only the abilities still read this one; none of them belongs to the
 * Koloss. Targeting and the mortar's lead read `lineOf` since ruleset 7.
 */
export function waveLineOf(state, enemy) {
  const routes = state.waveRoutes;
  if (!routes) return null;
  if (enemy.flying) return routes.flyer;
  return routes.lanes?.[enemy.lane ?? 0] ?? routes.ground;
}

/**
 * Position and heading at distance d along a polyline (clamped to its ends).
 * @param {object} [out] Optional object to write into, avoids allocations per enemy per step.
 * @returns {{x: number, y: number, dx: number, dy: number}}
 */
export function positionAt(line, d, out = { x: 0, y: 0, dx: 1, dy: 0 }) {
  const { points, cumulative } = line;
  if (points.length === 1 || d <= 0) {
    out.x = points[0].x;
    out.y = points[0].y;
    return out;
  }
  if (d >= line.length) {
    const last = points[points.length - 1];
    out.x = last.x;
    out.y = last.y;
    return out;
  }
  // Binary search for the segment containing d.
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= d) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const segment = cumulative[hi] - cumulative[lo];
  const u = segment > 0 ? (d - cumulative[lo]) / segment : 0;
  out.x = a.x + (b.x - a.x) * u;
  out.y = a.y + (b.y - a.y) * u;
  if (segment > 0) {
    out.dx = (b.x - a.x) / segment;
    out.dy = (b.y - a.y) / segment;
  }
  return out;
}

/**
 * How far along a polyline the point nearest to (x, y) lies. Used when the maze
 * changes under enemies that are already walking: the route is recomputed and
 * everyone is bound to the new line at the place they are standing, instead of
 * keeping a distance that now means somewhere else entirely.
 */
export function nearestDistanceOn(line, x, y) {
  const { points, cumulative } = line;
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const length2 = vx * vx + vy * vy;
    const u = length2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / length2)) : 0;
    const px = a.x + vx * u;
    const py = a.y + vy * u;
    const distance = (px - x) * (px - x) + (py - y) * (py - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = cumulative[i - 1] + Math.sqrt(length2) * u;
    }
  }
  return best;
}
