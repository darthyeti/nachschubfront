// Which blocks of terrain stand in front of a field and hide it (docs/ART.md, "Gelände, Licht
// und Biome"). Pure geometry on the height field; nothing here draws.
//
// A field is hidden by a block when the block is nearer to the viewer (larger x + y), its top is
// higher than the field's, and the picture of the block (top face plus the walls down to its
// lower neighbours) overlaps the picture of the field's top face. Along the line of sight one
// cell step in x and y is 32 px of height (iso: screenY = (x + y) * 16 - z), so a step of 12 px
// can only reach the fields right behind it, a step of 24 px just as far.

import { STEP, fieldSize } from './terrain.js';
import { REVEAL } from '../data/art.js';

/** Points of the field's top face that are tested for being covered (inset from the border). */
const SAMPLES = [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]];
/** Fields further than this in x or y are never in the way. */
const REACH = 4;
/** Tolerance: the flat top of a block (no wall) is a single point on the sight line. */
const EPS = 1e-6;

/** Height in px of the neighbouring field, or 0 (the slab) past the rim of the map. */
function heightOrSlab(field, size, x, y) {
  return x < 0 || y < 0 || x >= size || y >= size ? 0 : field[y * size + x] * STEP;
}

/** Lowest point of the walls of the block (ox, oy): down to its lower neighbours in +x and +y. */
function wallBottom(field, size, ox, oy) {
  const top = field[oy * size + ox] * STEP;
  return Math.min(top, heightOrSlab(field, size, ox + 1, oy), heightOrSlab(field, size, ox, oy + 1));
}

/**
 * The fields that hide the field (cx, cy), nearest first. Empty when the field is in the open.
 * @param {Uint8Array} field  Level (0 to 2) per field, row by row.
 * @returns {{x: number, y: number}[]}
 */
export function occludersOf(field, cx, cy) {
  const size = fieldSize(field);
  if (cx < 0 || cy < 0 || cx >= size || cy >= size) return [];
  const hs = field[cy * size + cx] * STEP;
  const out = [];
  for (let oy = cy; oy <= Math.min(size - 1, cy + REACH); oy++) {
    for (let ox = cx; ox <= Math.min(size - 1, cx + REACH); ox++) {
      if (ox + oy <= cx + cy) continue;
      const ho = field[oy * size + ox] * STEP;
      if (ho <= hs) continue;
      const hb = wallBottom(field, size, ox, oy);
      let hit = false;
      for (const [fx, fy] of SAMPLES) {
        // The sight line through a point of the field's top face: the point (sx + u, sy + u) of
        // the block at the height hs + 32 u.
        const sx = cx + fx;
        const sy = cy + fy;
        const lo = Math.max(ox - sx, oy - sy, (hb - hs) / 32);
        const hi = Math.min(ox + 1 - sx, oy + 1 - sy, (ho - hs) / 32);
        if (hi - lo > -EPS) {
          hit = true;
          break;
        }
      }
      if (hit) out.push({ x: ox, y: oy });
    }
  }
  out.sort((a, b) => a.x + a.y - (b.x + b.y) || a.y - b.y);
  return out;
}

/** Stable key of a set of fields (any order), for the cache of a reveal layer. */
export function cellsKey(cells) {
  return cells
    .map((c) => `${c.x},${c.y}`)
    .sort()
    .join(';');
}

/** Union of the occluders of several fields, without duplicates. */
export function occludersOfAll(field, subjects) {
  const seen = new Set();
  const out = [];
  for (const s of subjects) {
    for (const c of occludersOf(field, s.x, s.y)) {
      const k = c.y * 4096 + c.x;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
  }
  return out;
}

/**
 * Outline of the picture of a block in world pixels, grown outwards by `grow`: the top face and
 * the walls towards +x and +y.
 * @returns {[number, number][]}
 */
export function blockHull(field, x, y, grow = REVEAL.hullGrow) {
  const size = fieldSize(field);
  const ho = field[y * size + x] * STEP;
  const hr = Math.min(ho, heightOrSlab(field, size, x + 1, y));
  const hl = Math.min(ho, heightOrSlab(field, size, x, y + 1));
  const p = (px, py, z) => [(px - py) * 32, (px + py) * 16 - z];
  const pts = [
    p(x, y, ho),
    p(x + 1, y, ho),
    p(x + 1, y, hr),
    p(x + 1, y + 1, hr),
    p(x + 1, y + 1, hl),
    p(x, y + 1, hl),
    p(x, y + 1, ho),
  ];
  const cx = (x - y) * 32;
  const cy = (x + y + 1) * 16 - (ho + Math.min(hr, hl)) / 2;
  return pts.map(([px, py]) => {
    const dx = px - cx;
    const dy = py - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return [px + (dx / len) * grow, py + (dy / len) * grow];
  });
}

/**
 * Fade value of one reveal layer, moved towards its target: 1 while its fields are looked at,
 * 0 otherwise. Reduced motion jumps.
 */
export function fadeStep(value, target, dtSeconds, reducedMotion, fadeMs = REVEAL.fadeMs) {
  if (reducedMotion || fadeMs <= 0) return target;
  const step = (dtSeconds * 1000) / fadeMs;
  if (value < target) return Math.min(target, value + step);
  return Math.max(target, value - step);
}
