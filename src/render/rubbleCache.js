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

/** A changed zoom must stand still this long (ms) before another step is rastered, like ground.js. */
const SETTLE_MS = 160;

let cache = new Map();
/** Step in use; the cache holds this step only. Null before the first frame. */
let activeStep = null;
let pendingStep = null;
let pendingSince = 0;
const warmed = new WeakMap();
/** Cells rastered so far; the browser checks read it to see that nothing is rastered while a match runs. */
export const kitStats = { rasterized: 0 };

/** Raster step for a zoom: the smallest that is not coarser than the screen needs, at most the finest. */
export function kitStep(zoom) {
  for (const s of KIT_STEPS) if (zoom <= s) return s;
  return KIT_STEPS[KIT_STEPS.length - 1];
}

/**
 * Picks the step in use: the first one at once, a different one only after the zoom has asked
 * for it for SETTLE_MS; until then the step in use is drawn scaled. Entries of the step left behind
 * are dropped, so one step at a time is in memory.
 */
function settle(zoom, nowMs) {
  const want = kitStep(zoom);
  if (activeStep === null) activeStep = want;
  if (want === activeStep) {
    pendingStep = null;
    return;
  }
  if (pendingStep !== want) {
    pendingStep = want;
    pendingSince = nowMs;
  }
  if (nowMs - pendingSince >= SETTLE_MS) {
    activeStep = want;
    pendingStep = null;
    cache = new Map();
  }
}

function entry(ob, index, pal, step, dpr) {
  const { x, y } = ob.cells[index];
  const turn = ob.cells[1] ? ob.cells[1].y - ob.cells[0].y : 0;
  const key = `${ob.kind}:${x}:${y}:${ob.variant}:${index}:${ob.cells.length}:${turn}:${pal.ground[0]}:${step}:${dpr}`;
  let e = cache.get(key);
  if (e) return e;
  if (cache.size >= CACHE_LIMIT) cache = new Map();
  kitStats.rasterized++;
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

/** Draws one kit cell from the cache (and fills it the first time) at the step in use. */
export function drawKitCellCached(ctx, ob, index, pal, zoom, dpr) {
  if (activeStep === null) settle(zoom, performance.now());
  const e = entry(ob, index, pal, activeStep, dpr);
  ctx.drawImage(e.canvas, e.x, e.y, BOX.w, BOX.h);
}

/**
 * Once per frame, before the cells: settles the step and fills the cache with every kit cell of
 * the map at that step (once per map, palette, pixel ratio and step).
 */
export function warmKit(obstacles, pal, dpr, zoom) {
  settle(zoom, performance.now());
  const stamp = `${pal.ground[0]}:${dpr}:${activeStep}:${cache.size ? 1 : 0}`;
  if (warmed.get(obstacles) === stamp) return;
  warmed.set(obstacles, stamp);
  for (const ob of obstacles) {
    if (ob.kind === 'bulwark') continue;
    for (let i = 0; i < ob.cells.length; i++) entry(ob, i, pal, activeStep, dpr);
  }
}
