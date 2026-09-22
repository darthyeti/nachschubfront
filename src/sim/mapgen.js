// Seeded map generator (GDD section 4).
//
// Layout is built in a local frame and then rotated onto one of the four edges:
//   u = position along the rift edge (0 = "left"), v = depth from the rift edge.
// The rift sits at v = 0, the bastion at v = size - 1.

import { MAP } from '../data/map.js';
import { createGrid, setBlocked, isBlocked } from './grid.js';
import { routeExists } from './route.js';

/** Rotates local (u, v) into map coordinates for the given edge (0-3, quarter turns). */
function toMap(u, v, edge, size) {
  let x = v;
  let y = u;
  for (let i = 0; i < edge; i++) [x, y] = [size - 1 - y, x];
  return { x, y };
}

function pickWeighted(rng, entries) {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng.next() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll < 0) return e;
  }
  return entries[entries.length - 1];
}

function protect(map, center, radius) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = center.x + dx;
      const y = center.y + dy;
      if (x >= 0 && y >= 0 && x < map.size && y < map.size) map.protected[y * map.size + x] = 1;
    }
  }
}

function obstacleCells(rng, kind, config) {
  const x = rng.int(0, config.size - 1);
  const y = rng.int(0, config.size - 1);
  if (kind !== 'wall') return [{ x, y }];
  const length = rng.int(config.wallLength.min, config.wallLength.max);
  const horizontal = rng.chance(0.5);
  return Array.from({ length }, (_, i) => (horizontal ? { x: x + i, y } : { x, y: y + i }));
}

function canOccupy(map, cells) {
  return cells.every(
    ({ x, y }) =>
      x >= 0 && y >= 0 && x < map.size && y < map.size &&
      !map.protected[y * map.size + x] && !isBlocked(map.grid, x, y),
  );
}

/**
 * Generates a map from a seeded random stream.
 * @param {ReturnType<import('../core/random.js').createRng>} rng  Use a dedicated fork, e.g. rng.fork('map').
 * @param {typeof MAP} [config]
 */
export function generateMap(rng, config = MAP) {
  const { size } = config;
  const half = size / 2;
  const edge = rng.int(0, 3);
  const at = (u, v) => toMap(u, v, edge, size);

  const map = {
    size,
    edge,
    grid: createGrid(size),
    protected: new Uint8Array(size * size),
    rift: at(rng.int(config.edgeMargin, size - 1 - config.edgeMargin), 0),
    bastion: at(rng.int(config.edgeMargin, size - 1 - config.edgeMargin), size - 1),
    beacons: [],
    obstacles: [],
  };

  const center = (half - 1) / 2; // centre cell of a quadrant, e.g. 5.5 for 12 cells
  for (const { depth, side } of config.beaconOrder) {
    const u0 = side === 'left' ? 0 : half;
    const v0 = depth === 'near' ? 0 : half;
    const du = Math.round(center + rng.range(-config.beaconJitter, config.beaconJitter));
    const dv = Math.round(center + rng.range(-config.beaconJitter, config.beaconJitter));
    map.beacons.push(at(u0 + du, v0 + dv));
  }

  for (const p of [map.rift, map.bastion, ...map.beacons]) protect(map, p, config.protectRadius);

  // Obstacles: each one is kept only if the whole chain stays walkable.
  const target = rng.int(config.obstacleCount.min, config.obstacleCount.max);
  let attempts = 0;
  while (map.obstacles.length < target && attempts < config.maxPlacementAttempts) {
    attempts++;
    const { kind } = pickWeighted(rng, config.obstacleKinds);
    const cells = obstacleCells(rng, kind, config);
    if (!canOccupy(map, cells)) continue;
    for (const c of cells) setBlocked(map.grid, c.x, c.y, true);
    if (!routeExists(map)) {
      for (const c of cells) setBlocked(map.grid, c.x, c.y, false);
      continue;
    }
    // Purely visual variation, drawn from the same stream so the map stays reproducible.
    map.obstacles.push({ kind, cells, variant: rng.int(0, 3) });
  }

  return map;
}
