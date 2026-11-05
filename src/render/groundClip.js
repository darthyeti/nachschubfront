// Keeps what lies flat on the ground on its own level (docs/ART.md, "Hindernisse im Gelände"):
// marks of a landing, goo, shock rings, remains of a capsule. Such a picture is drawn on the plane of
// the field it belongs to, so near a step it would hang over a cliff, climb the slope of the higher
// neighbour or show over a block in front that hides the ground there. The clip is the fields of
// the same level around it (swept upwards by `sweep` px so that something standing on the ground
// keeps its height) minus the pictures of the higher blocks in front (`coverHulls`).
// Built once per field and place, then only looked up; nothing is built per frame.

import { iso } from './iso.js';
import { fieldSize, cellHeight } from './terrain.js';
import { coverHulls, groundAround } from './cover.js';

const cache = new WeakMap();

/** The clip of one place, or null where the ground is level and nothing stands in front. */
function build(field, cx, cy, reach, sweep, absolute) {
  const n = fieldSize(field);
  const around = groundAround(field, cx, cy, 1, reach);
  const covers = [];
  for (const c of around.cells) {
    if (c.x < 0 || c.y < 0 || c.x >= n || c.y >= n) continue;
    const cover = coverHulls(field, c.x, c.y);
    if (cover.cells.length) covers.push(cover);
  }
  if (!around.edge && !covers.length) return null;
  const lift = absolute ? cellHeight(field, n, cx, cy) : 0;
  const ground = new Path2D();
  for (const c of around.cells) {
    const [a, b, d, e] = [iso(c.x, c.y, lift), iso(c.x + 1, c.y, lift), iso(c.x + 1, c.y + 1, lift), iso(c.x, c.y + 1, lift)];
    // The diamond swept up by `sweep`: left, bottom, right, then the same three corners raised.
    const poly = [e, d, b, [b[0], b[1] - sweep], [a[0], a[1] - sweep], [e[0], e[1] - sweep]];
    poly.forEach(([px, py], k) => (k ? ground.lineTo(px, py) : ground.moveTo(px, py)));
    ground.closePath();
  }
  const seen = new Set();
  const cuts = [];
  const bounds = [];
  for (const cover of covers) {
    cover.cells.forEach((c, i) => {
      const k = c.y * 4096 + c.x;
      if (seen.has(k)) return;
      seen.add(k);
      const path = new Path2D();
      path.rect(-100000, -100000, 200000, 200000);
      // The hulls are in absolute world pixels; inside a translation by the lift they move down by it.
      const dy = absolute ? 0 : cellHeight(field, n, cx, cy);
      cover.hulls[i].forEach(([px, py], j) => (j ? path.lineTo(px, py + dy) : path.moveTo(px, py + dy)));
      path.closePath();
      cuts.push(path);
      const [x0, y0, x1, y1] = cover.bounds[i];
      bounds.push([x0, y0 + dy, x1, y1 + dy]);
    });
  }
  return { ground, cuts, bounds };
}

function lookup(field, cx, cy, reach, sweep, absolute) {
  if (!field) return null;
  let perField = cache.get(field);
  if (!perField) cache.set(field, (perField = new Map()));
  const key = ((cy * 4096 + cx) * 16 + reach) * 128 + sweep + (absolute ? 0.5 : 0);
  let hit = perField.get(key);
  if (hit === undefined) perField.set(key, (hit = build(field, cx, cy, reach, sweep, absolute)));
  return hit;
}

/**
 * The ground that `clipToGround` would keep (same arguments), as a path, or null where it would not clip.
 * For a test whether a picture reaches past it at all.
 */
export function groundPath(field, cx, cy, reach, sweep = 0, absolute = true) {
  return lookup(field, cx, cy, reach, sweep, absolute)?.ground ?? null;
}

/**
 * Clips the context to the ground of the field (cx, cy) and what it may show, or does nothing where
 * the field lies in the open. Call between `save` and `restore`.
 * @param {number} reach  Fields around the field that the picture can reach.
 * @param {number} sweep  Height in px that something standing on the ground may rise to (0 for flat marks).
 * @param {boolean} absolute  True when drawing in world pixels with the lift of the field already in the
 *   points (marks drawn with `project`); false inside a translation by the lift of the field (objects).
 * @param {boolean} withCuts  False to keep the level only, for a figure that is cut by the blocks in front elsewhere.
 * @param {number[]|null} box  `[x0, y0, x1, y1]`, the box of what is drawn in the same coordinates: blocks clear of
 *   it are not cut out. Null when the caller cannot say.
 * @returns {boolean} Whether a clip was set.
 */
export function clipToGround(ctx, field, cx, cy, reach, sweep = 0, absolute = true, withCuts = true, box = null) {
  const hit = lookup(field, cx, cy, reach, sweep, absolute);
  if (!hit) return false;
  ctx.clip(hit.ground);
  if (!withCuts) return true;
  for (let i = 0; i < hit.cuts.length; i++) {
    // A block whose picture stays clear of what is drawn cuts nothing out of it (issue 95).
    if (box) {
      const [x0, y0, x1, y1] = hit.bounds[i];
      if (x0 - SLACK >= box[2] || x1 + SLACK <= box[0] || y0 - SLACK >= box[3] || y1 + SLACK <= box[1]) continue;
    }
    ctx.clip(hit.cuts[i], 'evenodd');
  }
  return true;
}

/** Room round a box when a block is tested against it: the soft edge of a clip reaches about a pixel past it. */
const SLACK = 2;
