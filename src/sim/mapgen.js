// Seeded map generator (GDD section 4).
//
// One generator per map layout (data/map.js), looked up in MAP_LAYOUTS:
//
// - `chain`, the standard map. Built in a local frame and then rotated onto one
//   of the four edges: u = position along the rift edge (0 = "left"), v = depth
//   from the rift edge. The rift sits at v = 0, the bastion at v = size - 1.
// - `center`, King of the Hill (M7b): fixed geometry from the data, only the
//   ruins come from the seed.

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

/** Distance in king steps, the measure that matches 8-way movement. */
function kingDistance(a, b) {
  return Math.max(Math.abs(a.u - b.u), Math.abs(a.v - b.v));
}

/**
 * Cells of one half that keep `minAnchorDistance` from rift and bastion, in a
 * fixed scan order so the pick below only depends on the random stream.
 * @param {{u: number, v: number}} rift  Local coordinates of the anchors.
 */
function beaconCandidates(config, half, rift, bastion) {
  const { size, beaconMargin: margin, minAnchorDistance: minAnchor } = config;
  const uFrom = half === 0 ? margin : size / 2;
  const uTo = half === 0 ? size / 2 - 1 : size - 1 - margin;
  const cells = [];
  for (let v = margin; v <= size - 1 - margin; v++) {
    for (let u = uFrom; u <= uTo; u++) {
      const cell = { u, v };
      if (kingDistance(cell, rift) < minAnchor) continue;
      if (kingDistance(cell, bastion) < minAnchor) continue;
      cells.push(cell);
    }
  }
  return cells;
}

/**
 * Picks the two beacons (GDD section 4): one per map half, `minBeaconDistance`
 * apart and `minAnchorDistance` away from rift and bastion. Candidates are
 * enumerated and then drawn, so a valid pair is always found in one pass
 * instead of being sampled until it happens to fit.
 * @returns {{u: number, v: number}[]} In the order the route visits them.
 */
function placeBeacons(rng, config, rift, bastion) {
  // Which half the route reaches first.
  const firstHalf = rng.int(0, 1);
  const halves = [firstHalf, 1 - firstHalf].map((h) => beaconCandidates(config, h, rift, bastion));
  const [first, second] = halves;

  // Every first-half cell that still leaves a partner in the other half.
  const usable = first.filter((a) => second.some((b) => kingDistance(a, b) >= config.minBeaconDistance));
  const a = rng.pick(usable);
  const b = rng.pick(second.filter((c) => kingDistance(a, c) >= config.minBeaconDistance));
  return [a, b];
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

/** Every cell whose centre lies at most `radius` from the map centre (B4). */
function banZone(size, radius) {
  const banned = new Uint8Array(size * size);
  if (!(radius > 0)) return banned;
  const mid = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Inclusive: a cell whose centre lies exactly on the radius is banned.
      if (Math.hypot(x + 0.5 - mid, y + 0.5 - mid) <= radius + 1e-9) banned[y * size + x] = 1;
    }
  }
  return banned;
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
 * Places the obstacles: each one is kept only if the map stays walkable
 * (routeExists asks the layout what that means).
 */
function placeObstacles(rng, map, config) {
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
}

/**
 * King of the Hill (M7b, B1 and B4): bastion in the middle, a rift on every
 * edge, the ban zone around the centre. Protected are the bastion, every gate
 * and one ring around both, and the whole ban zone; `banned` keeps the ban zone
 * apart so it can be drawn as such.
 *
 * `rift` is the rift of the coming wave, kept in step by sim/rifts.js, so the
 * code that knows one rift (the Koloss, the info panel) reads the active one.
 */
function generateCenterMap(rng, config) {
  const { size } = config;
  const copy = (cells) => cells.map(({ x, y }) => ({ x, y }));
  const rifts = config.rifts.map((rift) => ({ id: rift.id, gates: copy(rift.gates) }));
  const bastionCells = copy(config.bastion);
  const banned = banZone(size, config.banRadius);
  const map = {
    size,
    layout: 'center',
    edge: null,
    grid: createGrid(size),
    protected: Uint8Array.from(banned),
    banned,
    rifts,
    rift: rifts[0].gates[0],
    bastion: bastionCells[0],
    bastionCells,
    beacons: [],
    obstacles: [],
  };
  for (const p of [...bastionCells, ...rifts.flatMap((r) => r.gates)]) protect(map, p, config.protectRadius);
  placeObstacles(rng, map, config);
  return map;
}

/**
 * The standard map: rift and bastion on opposite edges, the route through two
 * beacons (GDD section 4).
 */
function generateChainMap(rng, config) {
  const { size } = config;
  const edge = rng.int(0, 3);
  const at = (u, v) => toMap(u, v, edge, size);

  const rift = { u: rng.int(config.edgeMargin, size - 1 - config.edgeMargin), v: 0 };
  const bastion = { u: rng.int(config.edgeMargin, size - 1 - config.edgeMargin), v: size - 1 };

  const map = {
    size,
    edge,
    grid: createGrid(size),
    protected: new Uint8Array(size * size),
    rift: at(rift.u, rift.v),
    bastion: at(bastion.u, bastion.v),
    beacons: placeBeacons(rng, config, rift, bastion).map((b) => at(b.u, b.v)),
    obstacles: [],
  };

  for (const p of [map.rift, map.bastion, ...map.beacons]) protect(map, p, config.protectRadius);
  placeObstacles(rng, map, config);
  return map;
}

const MAP_LAYOUTS = { chain: generateChainMap, center: generateCenterMap };

/**
 * Generates a map from a seeded random stream.
 * @param {ReturnType<import('../core/random.js').createRng>} rng  Use a dedicated fork, e.g. rng.fork('map').
 * @param {typeof MAP} [config]  The mode's map (data/map.js).
 */
export function generateMap(rng, config = MAP) {
  const generate = MAP_LAYOUTS[config.layout ?? 'chain'];
  if (!generate) throw new Error(`Unknown map layout: ${config.layout}`);
  return generate(rng, config);
}
