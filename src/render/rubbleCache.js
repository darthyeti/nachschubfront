// Cache of the rubble kit (M8 C5). Drawing one kit cell is a few hundred paths and a cell never
// changes, so it is drawn once into an offscreen canvas per (cell, biome, raster step, pixel
// ratio) and from then on only blitted. The step is the smallest of 0.5, 1 and 2 that covers the
// zoom, like the sprites; `warmKit` fills the cache for a whole map before the first frame, so
// nothing is rasterized while a match runs (only a heap of rubble the player adds, once).

import { iso } from './iso.js';
import { drawKitCell } from './rubbleKit.js';

/** Screen box of one cell around the centre of its diamond, in px at zoom 1. */
const BOX = { x0: -80, y0: -104, w: 160, h: 148 };
/** Raster steps (canvas px per world px, before the pixel ratio). */
export const KIT_STEPS = [0.5, 1, 2];
/** Most cells the cache keeps before it starts over. */
const CACHE_LIMIT = 600;

let cache = new Map();
const warmed = new WeakMap();

/** Raster step for a zoom: the smallest that is not coarser than the screen needs, at most the finest. */
export function kitStep(zoom) {
  for (const s of KIT_STEPS) if (zoom <= s) return s;
  return KIT_STEPS[KIT_STEPS.length - 1];
}

function entry(ob, index, pal, step, dpr) {
  const { x, y } = ob.cells[index];
  const turn = ob.cells[1] ? ob.cells[1].y - ob.cells[0].y : 0;
  const key = `${ob.kind}:${x}:${y}:${ob.variant}:${index}:${ob.cells.length}:${turn}:${pal.ground[0]}:${step}:${dpr}`;
  let e = cache.get(key);
  if (e) return e;
  if (cache.size >= CACHE_LIMIT) cache = new Map();
  const k = step * dpr;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(BOX.w * k);
  canvas.height = Math.ceil(BOX.h * k);
  const c = canvas.getContext('2d');
  const [cx, cy] = iso(x + 0.5, y + 0.5);
  c.setTransform(k, 0, 0, k, 0, 0);
  c.translate(-(cx + BOX.x0), -(cy + BOX.y0));
  drawKitCell(c, ob, index, pal);
  e = { canvas, x: cx + BOX.x0, y: cy + BOX.y0 };
  cache.set(key, e);
  return e;
}

/** Draws one kit cell from the cache (and fills it the first time). */
export function drawKitCellCached(ctx, ob, index, pal, zoom, dpr) {
  const e = entry(ob, index, pal, kitStep(zoom), dpr);
  ctx.drawImage(e.canvas, e.x, e.y, BOX.w, BOX.h);
}

/** Fills the cache for every kit cell of a map at every step; once per map, palette and pixel ratio. */
export function warmKit(obstacles, pal, dpr) {
  const stamp = `${pal.ground[0]}:${dpr}`;
  if (warmed.get(obstacles) === stamp) return;
  warmed.set(obstacles, stamp);
  for (const ob of obstacles) {
    if (ob.kind === 'bulwark') continue;
    for (let i = 0; i < ob.cells.length; i++) for (const s of KIT_STEPS) entry(ob, i, pal, s, dpr);
  }
}
