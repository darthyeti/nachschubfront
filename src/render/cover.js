// What stands in front of an emplacement on the screen (docs/ART.md, "Stellungen im Gelände").
// Pure geometry on the height field and on the pictures of obstacles; nothing here draws.
//
// Two different things hide an emplacement:
//  - Terrain in front of it, higher than its own field (a step, a cliff). The picture of that block
//    is cut out of the emplacement (`coverHulls`), so it stands behind the block and not over it.
//  - An obstacle in front of it (a ruin, a wall, a heap of rubble). The obstacle is drawn
//    see-through all the time (`coveringObstacles`), the emplacement stays solid.

import { iso } from './iso.js';
import { fieldSize, cellHeight } from './terrain.js';
import { occludersOf, blockHull } from './occlusion.js';
import { OBSTACLE_SEE_THROUGH } from '../data/art.js';

/**
 * The hull of a covering block is grown by this many world pixels when it cuts out a figure, so the
 * ink outline of the block (about 2.5 px wide, centred on the edge) stays whole.
 */
export const CUT_GROW = 1.5;
/** How far from an emplacement an obstacle can cover it, in cells. */
const OBSTACLE_REACH = 4;

/** Per field: the covering blocks and their hulls for every cell, filled when first asked. */
const hullCache = new WeakMap();

/** The box round the points of a hull, `[x0, y0, x1, y1]` in world pixels. */
function hullBounds(hull) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [px, py] of hull) {
    if (px < x0) x0 = px;
    if (px > x1) x1 = px;
    if (py < y0) y0 = py;
    if (py > y1) y1 = py;
  }
  return [x0, y0, x1, y1];
}

/**
 * The blocks of terrain in front of the field (cx, cy) that are higher than it and cover it, with
 * the outline of their picture and the box round it (`bounds`, to tell quickly whether a block can
 * touch a figure at all). Cached per height field, so asking every frame costs a lookup.
 * @returns {{cells: {x: number, y: number}[], hulls: number[][][], bounds: number[][]}}
 */
export function coverHulls(field, cx, cy) {
  let perCell = hullCache.get(field);
  if (!perCell) hullCache.set(field, (perCell = new Map()));
  const key = cy * 4096 + cx;
  let hit = perCell.get(key);
  if (!hit) {
    const cells = occludersOf(field, cx, cy);
    const hulls = cells.map((c) => blockHull(field, c.x, c.y, CUT_GROW));
    hit = { cells, hulls, bounds: hulls.map(hullBounds) };
    perCell.set(key, hit);
  }
  return hit;
}

/**
 * The blocks of terrain in front of a square of `size` x `size` fields that cover it (a bastion of
 * King of the Hill covers 2 x 2): the covering blocks of every field of the square, without
 * duplicates and without the fields of the square itself, which the figure stands on. Cached like
 * `coverHulls`.
 * @returns {{cells: {x: number, y: number}[], hulls: number[][][], bounds: number[][]}}
 */
export function coverHullsOfSquare(field, x, y, size) {
  if (size <= 1) return coverHulls(field, x, y);
  let perCell = squareCache.get(field);
  if (!perCell) squareCache.set(field, (perCell = new Map()));
  const key = (y * 4096 + x) * 8 + size;
  let hit = perCell.get(key);
  if (!hit) {
    const seen = new Set();
    const cells = [];
    const hulls = [];
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const own = coverHulls(field, x + dx, y + dy);
        own.cells.forEach((c, i) => {
          const inside = c.x >= x && c.y >= y && c.x < x + size && c.y < y + size;
          const k = c.y * 4096 + c.x;
          if (inside || seen.has(k)) return;
          seen.add(k);
          cells.push(c);
          hulls.push(own.hulls[i]);
        });
      }
    }
    hit = { cells, hulls, bounds: hulls.map(hullBounds) };
    perCell.set(key, hit);
  }
  return hit;
}
const squareCache = new WeakMap();

/**
 * The plate under an emplacement as a rectangle in cell coordinates: it reaches `inset` (negative:
 * outwards) past each edge of its field, except at an edge where the level changes or the map ends.
 * There the plate would hang over a cliff or climb the wall of the higher field, so it stops at the
 * edge.
 * @returns {{x0: number, y0: number, x1: number, y1: number}}
 */
export function plateBounds(field, x, y, inset) {
  const size = fieldSize(field);
  const here = field[y * size + x];
  const flat = (nx, ny) => nx >= 0 && ny >= 0 && nx < size && ny < size && field[ny * size + nx] === here;
  return {
    x0: x + (flat(x - 1, y) ? inset : 0),
    x1: x + 1 - (flat(x + 1, y) ? inset : 0),
    y0: y + (flat(x, y - 1) ? inset : 0),
    y1: y + 1 - (flat(x, y + 1) ? inset : 0),
  };
}

// ---------- Obstacles in front of an emplacement ----------

/** The three faces of a box seen from the camera: the top and the walls towards +x and +y, as convex polygons. */
function bodyFaces(b, base) {
  const top = base + b.h;
  return [
    [iso(b.x0, b.y0, top), iso(b.x1, b.y0, top), iso(b.x1, b.y1, top), iso(b.x0, b.y1, top)],
    [iso(b.x1, b.y0, top), iso(b.x1, b.y1, top), iso(b.x1, b.y1, base), iso(b.x1, b.y0, base)],
    [iso(b.x0, b.y1, top), iso(b.x1, b.y1, top), iso(b.x1, b.y1, base), iso(b.x0, b.y1, base)],
  ];
}

/** Whether a point lies inside a convex polygon, whichever way it winds. */
function insideConvex(px, py, poly) {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const c = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    if (c === 0) continue;
    if (sign === 0) sign = c > 0 ? 1 : -1;
    else if (c > 0 !== sign > 0) return false;
  }
  return true;
}

/**
 * The obstacles that cover an emplacement enough to be drawn see-through. An obstacle covers it
 * when it stands nearer to the camera (larger x + y) and the picture of its bodies lies over at
 * least `minShare` of the picture of the emplacement, tested on a grid of points over the
 * emplacement's bounding box. A whole obstacle counts, not a single cell of a wall.
 * @param {Uint8Array} field  Level per field.
 * @param {{x: number, y: number, box: number[]}[]} towers  Cell of an emplacement and the box of
 *   its picture `[x0, y0, x1, y1]` in world pixels relative to the middle of its field on the ground.
 * @param {{cells: {x: number, y: number}[], bodies: (index: number) => {x0: number, y0: number, x1: number, y1: number, h: number}[]}[]} obstacles
 *   `bodies(i)` gives the boxes of cell `i` in cell coordinates, `h` in px above the field.
 * @returns {Set<object>} The covering entries of `obstacles`.
 */
export function coveringObstacles(field, towers, obstacles, { minShare, grid } = OBSTACLE_SEE_THROUGH) {
  const out = new Set();
  if (!towers.length || !obstacles.length) return out;
  const size = fieldSize(field);
  const [cols, rows] = grid;
  for (const t of towers) {
    const [fx, fy] = iso(t.x + 0.5, t.y + 0.5, cellHeight(field, size, t.x, t.y));
    const [bx0, by0, bx1, by1] = t.box;
    const samples = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        samples.push([fx + bx0 + ((c + 0.5) / cols) * (bx1 - bx0), fy + by0 + ((r + 0.5) / rows) * (by1 - by0)]);
      }
    }
    for (const ob of obstacles) {
      if (out.has(ob)) continue;
      const hit = new Set();
      ob.cells.forEach((cell, i) => {
        if (cell.x + cell.y <= t.x + t.y) return;
        if (cell.x - t.x > OBSTACLE_REACH || cell.y - t.y > OBSTACLE_REACH) return;
        if (cell.x < t.x - OBSTACLE_REACH || cell.y < t.y - OBSTACLE_REACH) return;
        const base = cellHeight(field, size, cell.x, cell.y);
        for (const body of ob.bodies(i)) {
          for (const face of bodyFaces(body, base)) {
            samples.forEach(([sx, sy], s) => {
              if (!hit.has(s) && insideConvex(sx, sy, face)) hit.add(s);
            });
          }
        }
      });
      if (hit.size / samples.length >= minShare) out.add(ob);
    }
  }
  return out;
}

// ---------- Shadows and obstacles on the edge of a level ----------

/** A shadow reaches at most this many fields past the square of its body (0.55 cells per 32 px, bodies up to about 60 px). */
const SHADOW_REACH = 1;

/**
 * The fields a body on the square (x, y, `size`) can throw its shadow on, on the same level as the
 * square: the square and `reach` fields around it (a shadow, a mark on the ground, a ring). Fields past the rim of the map count as
 * level 0 (the slab of the diorama), so on level 0 they belong to it and on a higher level they do not.
 * @returns {{cells: {x: number, y: number}[], edge: boolean}} `edge` is true when some field around
 *   has another level (the shadow would hang over a cliff or climb a slope).
 */
export function groundAround(field, x, y, size = 1, reach = SHADOW_REACH) {
  const n = fieldSize(field);
  const level = field[y * n + x];
  const cells = [];
  let edge = false;
  for (let cy = y - reach; cy < y + size + reach; cy++) {
    for (let cx = x - reach; cx < x + size + reach; cx++) {
      const outside = cx < 0 || cy < 0 || cx >= n || cy >= n;
      const l = outside ? 0 : field[cy * n + cx];
      if (l === level) cells.push({ x: cx, y: cy });
      else edge = true;
    }
  }
  return { cells, edge };
}

/**
 * Sorts the shadows of bodies on the ground by the level they lie on and by whether they need
 * care. A shadow of a body in the open (all fields around on its level, nothing in front that is
 * higher) is `plain`. Every other one is `edge`: it must stay on the ground of its own level
 * (`ground`, the fields it may lie on) and must not show where a higher block in front hides the
 * ground (`cuts`, the pictures of those blocks), as a figure on the same field would not.
 * @param {Uint8Array} field
 * @param {{x: number, y: number, size?: number, bodies: object[]}[]} entries  A square of fields
 *   and the shadow bodies standing on it.
 * @returns {{plain: object[], edge: object[], ground: {x: number, y: number}[], cuts: number[][][]}[]}
 *   One entry per level, 0 to 2.
 */
export function shadowPlan(field, entries) {
  const levels = [0, 1, 2].map(() => ({ plain: [], edge: [], ground: [], cuts: [], groundSeen: new Set(), cutSeen: new Set() }));
  const n = fieldSize(field);
  for (const e of entries) {
    if (!e.bodies.length) continue;
    const size = e.size ?? 1;
    const lv = levels[field[e.y * n + e.x]];
    const around = groundAround(field, e.x, e.y, size);
    const covers = [];
    for (const c of around.cells) {
      if (c.x < 0 || c.y < 0 || c.x >= n || c.y >= n) continue;
      const cover = coverHulls(field, c.x, c.y);
      if (cover.cells.length) covers.push(cover);
    }
    if (!around.edge && !covers.length) {
      lv.plain.push(...e.bodies);
      continue;
    }
    lv.edge.push(...e.bodies);
    for (const c of around.cells) {
      const k = c.y * 4096 + c.x;
      if (lv.groundSeen.has(k)) continue;
      lv.groundSeen.add(k);
      lv.ground.push(c);
    }
    for (const cover of covers) {
      cover.cells.forEach((c, i) => {
        const k = c.y * 4096 + c.x;
        if (lv.cutSeen.has(k)) return;
        lv.cutSeen.add(k);
        lv.cuts.push(cover.hulls[i]);
      });
    }
  }
  return levels.map(({ plain, edge, ground, cuts }) => ({ plain, edge, ground, cuts }));
}
