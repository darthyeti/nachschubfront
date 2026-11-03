// Block terrain (docs/ART.md, "Gelände, Licht und Biome"): three height levels from the seed.
// Pure presentation. The simulation keeps working on the flat map; nothing here is read by it,
// and the noise comes from its own stream (`terrain:<seed>`), never from a game stream.
// The numbers are the starting points of reference/studien/optik-studie.js.

import { createRng } from '../core/random.js';

/** Height of one level in world pixels (levels 0, 1, 2). */
export const STEP = 12;
/** Highest level. */
export const MAX_LEVEL = 2;
/** Value-noise lattice spacing in cells: bigger gives bigger plateaus. */
export const NOISE_CELLS = 11;
/** The stretched noise is cut at these two values into level 0, 1 and 2. */
export const LEVEL_CUTS = [0.4, 0.66];
/** Something that walks blends from one field height to the next over this fraction of a cell per side. */
export const ENEMY_BLEND = 0.25;
/** Earth wedge where the route crosses a step: width and run (cells, on the lower field). */
export const RAMP_WIDTH = 0.6;
export const RAMP_RUN = 0.65;

const NEIGHBOURS_4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const smooth = (t) => t * t * (3 - 2 * t);

/** Cells of the rift, the bastion (all its cells) and the beacons: they keep their level. */
function anchorCells(map) {
  const size = map.size;
  const out = new Set();
  const add = (c) => {
    if (c && c.x >= 0 && c.y >= 0 && c.x < size && c.y < size) out.add(c.y * size + c.x);
  };
  if (map.rift) add(map.rift);
  for (const r of map.rifts ?? []) {
    add(r);
    for (const g of r.gates ?? []) add(g);
  }
  if (map.bastion) {
    add(map.bastion);
    for (const c of map.bastionCells ?? []) add(c);
  }
  for (const b of map.beacons ?? []) add(b);
  return out;
}

function buildField(map, seed) {
  const size = map.size;
  const rng = createRng(`terrain:${seed}`);
  const level = new Uint8Array(size * size);
  const L = Math.ceil(size / NOISE_CELLS) + 2;
  const lattice = Array.from({ length: L * L }, () => rng.next());
  const raw = new Float32Array(size * size);
  let lo = Infinity;
  let hi = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x + 0.5) / NOISE_CELLS;
      const fy = (y + 0.5) / NOISE_CELLS;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = smooth(fx - ix);
      const ty = smooth(fy - iy);
      const a = lattice[iy * L + ix];
      const b = lattice[iy * L + ix + 1];
      const c = lattice[(iy + 1) * L + ix];
      const d = lattice[(iy + 1) * L + ix + 1];
      const v = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
      raw[y * size + x] = v;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  for (let i = 0; i < raw.length; i++) {
    const v = (raw[i] - lo) / (hi - lo || 1);
    level[i] = v < LEVEL_CUTS[0] ? 0 : v < LEVEL_CUTS[1] ? 1 : 2;
  }

  // Majority filter: takes out single cells, and a second rule takes out strips one cell wide
  // (both neighbours on one axis differ), so plateaus come out as blocks and not as steps.
  const at = (x, y, fallback) => (x < 0 || y < 0 || x >= size || y >= size ? fallback : level[y * size + x]);
  for (let pass = 0; pass < 3; pass++) {
    const next = level.slice();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const here = level[y * size + x];
        const votes = [0, 0, 0];
        let same = 0;
        for (const [dx, dy] of NEIGHBOURS_4) {
          const v = at(x + dx, y + dy, here);
          votes[v] += 1;
          if (v === here) same += 1;
        }
        if (same <= 1) {
          next[y * size + x] = votes.indexOf(Math.max(...votes));
          continue;
        }
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const a = at(x - dx, y - dy, here);
          const b = at(x + dx, y + dy, here);
          if (a !== here && b !== here) next[y * size + x] = Math.min(a, b);
        }
      }
    }
    level.set(next);
  }

  // A crater lies one level lower than its surroundings (never below the ground); the anchors
  // keep the level the noise gave them.
  const anchors = anchorCells(map);
  for (const o of map.obstacles ?? []) {
    if (o.kind !== 'crater') continue;
    for (const c of o.cells) {
      const i = c.y * size + c.x;
      if (!anchors.has(i) && level[i] > 0) level[i] -= 1;
    }
  }
  return level;
}

/** Fields are cached per map object and seed: the map does not change during a match. */
const fields = new WeakMap();

/**
 * The level (0 to 2) of every field, row by row, from the seed. Deterministic, independent of
 * the player's obstacles and of every game stream.
 * @param {{size: number, obstacles?: object[]}} map
 * @returns {Uint8Array}
 */
export function heightField(map, seed) {
  const key = String(seed);
  const hit = fields.get(map);
  if (hit && hit.seed === key) return hit.field;
  const field = buildField(map, key);
  fields.set(map, { seed: key, field });
  return field;
}

/** A field that is flat everywhere, for the gallery and the studies. */
export function flatField(size) {
  return new Uint8Array(size * size);
}

/** Size of the square a field describes. */
export function fieldSize(field) {
  return Math.round(Math.sqrt(field.length));
}

/** Height in px of the field (cx, cy); positions outside the map count as the nearest field. */
export function cellHeight(field, size, cx, cy) {
  const x = cx < 0 ? 0 : cx >= size ? size - 1 : cx;
  const y = cy < 0 ? 0 : cy >= size ? size - 1 : cy;
  return field[y * size + x] * STEP;
}

/**
 * Height in px under a point given in fractional cell coordinates. Something that walks takes a
 * step like a kerb: the height blends linearly into the neighbour's over ENEMY_BLEND of a cell
 * on each side of the border, so it is continuous across a border and exact in the middle of a
 * field.
 */
export function heightAt(field, size, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const fx = x - cx;
  const fy = y - cy;
  const weight = (f) =>
    f < ENEMY_BLEND ? 0.5 * (1 - f / ENEMY_BLEND) : f > 1 - ENEMY_BLEND ? 0.5 * (1 - (1 - f) / ENEMY_BLEND) : 0;
  const h0 = cellHeight(field, size, cx, cy);
  return (
    h0 +
    weight(fx) * (cellHeight(field, size, fx < 0.5 ? cx - 1 : cx + 1, cy) - h0) +
    weight(fy) * (cellHeight(field, size, cx, fy < 0.5 ? cy - 1 : cy + 1) - h0)
  );
}

// ---------- The field the scene is drawing right now ----------
// Effects and markers deep in the drawing code need the ground height without a field being
// threaded through every call. The scene sets it once per frame; without one everything is flat
// (the gallery, the studies, unit tests).

let activeField = null;
let activeSize = 0;

/** The field set for this frame, or null. */
export function activeTerrain() {
  return activeField;
}

export function setActiveTerrain(field) {
  activeField = field;
  activeSize = field ? fieldSize(field) : 0;
}

/** Height of the field a cell coordinate lies in, at the active terrain. */
export function cellLift(cx, cy) {
  return activeField ? cellHeight(activeField, activeSize, Math.floor(cx), Math.floor(cy)) : 0;
}

/** Smoothly blended height under a fractional position, at the active terrain. */
export function liftAt(x, y) {
  return activeField ? heightAt(activeField, activeSize, x, y) : 0;
}

/** Level (0 to 2) of a field of the active terrain. */
export function cellLevel(cx, cy) {
  return activeField ? cellHeight(activeField, activeSize, cx, cy) / STEP : 0;
}

// ---------- Ramps ----------

/**
 * Where consecutive route cells differ in level: an earth wedge on the lower field against the
 * step. `sections` are `{a, b}` pairs of cells (see trail.js, `sectionsOf`).
 * @returns {{x: number, y: number, dx: number, dy: number, lowH: number, hiH: number, key?: string}[]}
 *   `x, y` is the lower cell, `dx, dy` the unit step up to the higher neighbour.
 */
export function rampsOf(sections, field) {
  const size = fieldSize(field);
  const out = [];
  const lv = (x, y) => field[y * size + x];
  for (const s of sections) {
    const { a, b } = s;
    if (a.x < 0 || a.y < 0 || b.x < 0 || b.y < 0 || a.x >= size || a.y >= size || b.x >= size || b.y >= size) continue;
    const la = lv(a.x, a.y);
    const lb = lv(b.x, b.y);
    if (la === lb) continue;
    const low = la < lb ? a : b;
    const high = la < lb ? b : a;
    const lowLevel = Math.min(la, lb);
    let dx = high.x - low.x;
    let dy = high.y - low.y;
    if (dx !== 0 && dy !== 0) {
      // Diagonal step: the ramp goes up the axis neighbour that really is higher.
      const hx = lv(low.x + dx, low.y);
      const hy = lv(low.x, low.y + dy);
      if (hx > lowLevel) dy = 0;
      else if (hy > lowLevel) dx = 0;
      else continue;
    }
    const nx = low.x + dx;
    const ny = low.y + dy;
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
    out.push({ key: s.key, x: low.x, y: low.y, dx, dy, lowH: lowLevel * STEP, hiH: lv(nx, ny) * STEP });
  }
  return out;
}

/**
 * The four corners of a ramp as `[cellX, cellY, z]`: two on the border of the step at the height
 * of the higher field, two further inside the lower field at its own height.
 */
export function rampCorners(r) {
  const ex = r.x + 0.5 + r.dx * 0.5;
  const ey = r.y + 0.5 + r.dy * 0.5;
  const lx = -r.dy * (RAMP_WIDTH / 2);
  const ly = r.dx * (RAMP_WIDTH / 2);
  const ix = ex - r.dx * RAMP_RUN;
  const iy = ey - r.dy * RAMP_RUN;
  return [
    [ex + lx, ey + ly, r.hiH],
    [ex - lx, ey - ly, r.hiH],
    [ix - lx, iy - ly, r.lowH],
    [ix + lx, iy + ly, r.lowH],
  ];
}
