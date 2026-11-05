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

/** Texels round every covered texel of a cell that count as covered too: the filter of a scaled `drawImage`. */
const MASK_GROW = 2;

/**
 * The texels of a cached cell that its picture covers, grown by MASK_GROW, as one byte per texel. Made once
 * per entry, on a canvas of its own (reading back the cached canvas would slow its blits down).
 */
function maskOf(e) {
  if (e.mask) return e.mask;
  const { width, height } = e.canvas;
  const g = scratch(width, height);
  g.drawImage(e.canvas, 0, 0);
  const alpha = g.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!alpha[(y * width + x) * 4 + 3]) continue;
      for (let dy = -MASK_GROW; dy <= MASK_GROW; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -MASK_GROW; dx <= MASK_GROW; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < width) mask[yy * width + xx] = 1;
        }
      }
    }
  }
  e.mask = mask;
  return mask;
}

let scratchCanvas = null;
function scratch(width, height) {
  scratchCanvas ??= document.createElement('canvas');
  scratchCanvas.width = width;
  scratchCanvas.height = height;
  const g = scratchCanvas.getContext('2d', { willReadFrequently: true });
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, width, height);
  return g;
}

/**
 * Whether the picture of a kit cell, as the cache draws it at the step in use, meets a region given as a
 * path in world pixels without the lift of its field (the coordinates the cell is drawn in): `'touches'`
 * when some of it lies in the region, `'leaves'` when some of it lies outside or on the soft edge of it.
 * Then a clip to the region (or a cut of it) changes the picture; otherwise it can be left out (issue 95).
 * Answered once per cached entry and `key`, then looked up; `path` is only asked for the first time.
 */
export function kitCellMeets(ob, index, pal, dpr, key, path, how) {
  if (activeStep === null) return true;
  const e = entry(ob, index, pal, activeStep, dpr);
  e.meets ??= new Map();
  let hit = e.meets.get(key);
  if (hit !== undefined) return hit;
  const mask = maskOf(e);
  const { width, height } = e.canvas;
  const k = width / BOX.w;
  const g = scratch(width, height);
  g.setTransform(k, 0, 0, k, -e.x * k, -e.y * k);
  g.fillStyle = '#000';
  g.fill(path());
  const region = g.getImageData(0, 0, width, height).data;
  hit = false;
  for (let i = 0; i < mask.length && !hit; i++) {
    if (!mask[i]) continue;
    const a = region[i * 4 + 3];
    hit = how === 'touches' ? a > 0 : a < 255;
  }
  e.meets.set(key, hit);
  return hit;
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
