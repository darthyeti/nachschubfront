// Enemy routes: the chain rift -> beacons 1-4 -> bastion (GDD section 5),
// plus placement checks that keep every leg of that chain open.

import { findPath } from './pathfinding.js';
import { inBounds, isBlocked, setBlocked } from './grid.js';
import { isRubble } from './rubble.js';

/** Rift, beacons in order, bastion. */
export function waypoints(map) {
  return [map.rift, ...map.beacons, map.bastion];
}

/**
 * Ground route through all waypoints. Each leg is its own shortest path.
 * @returns {{cells: {x: number, y: number}[], length: number, legs: number[]} | null}
 *   `legs` holds the length of each leg; null if any leg is blocked.
 */
export function computeRoute(map) {
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
export function routeWith(map, cells) {
  if (cells.length === 0) return computeRoute(map);
  return withBlocked(map, cells, () => computeRoute(map));
}

/** True if every leg of the chain has a path. */
export function routeExists(map) {
  const points = waypoints(map);
  for (let i = 0; i < points.length - 1; i++) {
    if (!findPath(map.grid, points[i], points[i + 1])) return false;
  }
  return true;
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
    cumulative.push(cumulative[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return { points, cumulative, length: cumulative[cumulative.length - 1] };
}

/** Ground polyline through the centres of the route cells. */
export function groundPolyline(route) {
  return createPolyline(route.cells.map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 })));
}

/** Flyers ignore obstacles and fly straight from waypoint to waypoint. */
export function flyerPolyline(map) {
  return createPolyline(waypoints(map).map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 })));
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
    const distance = (px - x) ** 2 + (py - y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = cumulative[i - 1] + Math.sqrt(length2) * u;
    }
  }
  return best;
}
