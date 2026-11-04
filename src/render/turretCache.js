// The cached stages of the weapons (M9 D2, and D4 for the recipe emplacements). A resting weapon is not
// drawn from its model every frame: it is drawn once per direction into an offscreen canvas and from then
// on only blitted.
// The directions are TURRET_STAGES evenly spread angles, and a stage is made only when a weapon
// needs it, for the doctrine and rank it needs it in, at the raster step of the zoom in use (like
// the rubble kit of M8, C5): a match with three kinds of weapon never makes the other fifteen.
//
// Each stage is cropped to the area the model covers, and carries its shadow (the black silhouette
// at half resolution, laid on the ground like the shadow of every sprite) and, once a hit asks for
// it, a bright variant for the hit flash. Memory is bounded: past TURRET_CACHE_BYTES the stages
// longest unused go, and a weapon whose stage has to wait is drawn from its model for that frame.

import { turnFrame, renderSolids } from './model.js';
import { weaponModel } from './weapons.js';
import { TURRET_STAGES, TURRET_CACHE_BYTES, TURRET_BUILDS_PER_FRAME } from '../data/art.js';
import { SPRITE_SHADOW_ALPHA, SPRITE_SHADOW_SQUASH, SPRITE_SHADOW_SHEAR } from './shadows.js';
import { pickLevel } from './sprites/compose.js';

/** Angle between two neighbouring stages. */
export const STAGE_STEP = (Math.PI * 2) / TURRET_STAGES;
/** Margin round the covered area, in world px: the ink outside the corner points. */
const PAD = 3;
/** The shadow canvas has this fraction of the resolution of the colour one; it is soft anyway. */
const SHADOW_RES = 0.5;
/** Tint of the hit-flash variant, as for the sprites. */
const FLASH_TINT = 'rgba(255, 246, 228, 0.65)';
/** A changed zoom must stand still this long (ms) before another step is drawn, like ground.js. */
const SETTLE_MS = 160;
/** Frames are told apart by this many ms, for the build budget. */
const FRAME_MS = 16;

/** Statistics the browser checks read: stages made, pixel memory held, stages held. */
export const turretStats = { rasterized: 0, bytes: 0, entries: 0, evicted: 0 };

let cache = new Map();
let activeStep = null;
let activeDpr = null;
let pendingStep = null;
let pendingSince = 0;
let frameBucket = -1;
let builtInFrame = 0;

/** Number of the stage nearest an angle, 0 to TURRET_STAGES - 1. */
export function stageIndex(theta) {
  const k = Math.round(theta / STAGE_STEP) % TURRET_STAGES;
  return k < 0 ? k + TURRET_STAGES : k;
}

/** Forgets every stage. For tests and for a change of pixel ratio. */
export function resetTurretCache() {
  cache = new Map();
  activeStep = null;
  activeDpr = null;
  pendingStep = null;
  turretStats.bytes = 0;
  turretStats.entries = 0;
}

/**
 * The raster step in use: the first one at once, another only after the zoom has asked for it for
 * SETTLE_MS; until then the stages of the step in use are drawn scaled. The stages of the step left
 * behind are dropped, so one step at a time is in memory.
 */
function settle(zoom, dpr, nowMs) {
  const want = pickLevel(zoom);
  if (activeStep === null || dpr !== activeDpr) {
    resetTurretCache();
    activeStep = want;
    activeDpr = dpr;
    return;
  }
  if (want === activeStep) {
    pendingStep = null;
    return;
  }
  if (pendingStep !== want) {
    pendingStep = want;
    pendingSince = nowMs;
  }
  if (nowMs - pendingSince >= SETTLE_MS) {
    resetTurretCache();
    activeStep = want;
    activeDpr = dpr;
  }
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** Bounding box of the points of a built model on screen, `[x0, y0, x1, y1]` padded and rounded out. */
function boundsOf(F, samples) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [lx, ly, z] of samples) {
    const [px, py] = F.W(lx, ly, z);
    if (px < x0) x0 = px;
    if (px > x1) x1 = px;
    if (py < y0) y0 = py;
    if (py > y1) y1 = py;
  }
  return [Math.floor(x0 - PAD), Math.floor(y0 - PAD), Math.ceil(x1 + PAD), Math.ceil(y1 + PAD)];
}

/**
 * The silhouette for the shadow: a drawing filled black, at a lower resolution. `source` is a canvas
 * with the drawing and the scale it was made at.
 */
function silhouette(source, width, height) {
  const sw = Math.max(1, Math.ceil(width * SHADOW_RES));
  const sh = Math.max(1, Math.ceil(height * SHADOW_RES));
  const shadow = makeCanvas(sw, sh);
  const s = shadow.getContext('2d');
  s.drawImage(source, 0, 0, sw, sh);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = '#000';
  s.fillRect(0, 0, sw, sh);
  return shadow;
}

/** Draws one stage: the model at the angle of stage `k` in the resting pose, cropped to what it covers. */
function build(kind, rank, layer, k, step, dpr) {
  const model = weaponModel(kind);
  const theta = k * STAGE_STEP;
  const F = turnFrame(theta, model.mount, model.scale);
  const pose = model.restPose(model.accent, rank);
  const built = model.build(F, pose, layer);
  const [x0, y0, x1, y1] = boundsOf(F, built.samples);
  const k2 = step * dpr;
  const width = Math.max(1, Math.ceil((x1 - x0) * k2));
  const height = Math.max(1, Math.ceil((y1 - y0) * k2));
  const canvas = makeCanvas(width, height);
  const c = canvas.getContext('2d');
  c.setTransform(k2, 0, 0, k2, -x0 * k2, -y0 * k2);
  renderSolids(c, built.parts);

  let shadow;
  let shadowBox = null;
  if (model.live.length && layer !== 'all') {
    // The floating parts are drawn over the stage every frame and are not in it; the shadow of the weapon
    // still has them, so it is made from the whole model, over a box of its own.
    const whole = model.build(F, pose, 'all');
    const [sx0, sy0, sx1, sy1] = boundsOf(F, whole.samples);
    const sk = k2 * SHADOW_RES;
    const full = makeCanvas(Math.max(1, Math.ceil((sx1 - sx0) * sk)), Math.max(1, Math.ceil((sy1 - sy0) * sk)));
    const g = full.getContext('2d');
    g.setTransform(sk, 0, 0, sk, -sx0 * sk, -sy0 * sk);
    renderSolids(g, whole.parts);
    shadow = silhouette(full, full.width / SHADOW_RES, full.height / SHADOW_RES);
    shadowBox = { x: sx0, y: sy0, w: sx1 - sx0, h: sy1 - sy0 };
  } else {
    shadow = silhouette(canvas, width, height);
  }

  const bytes = (width * height + shadow.width * shadow.height) * 4;
  turretStats.rasterized += 1;
  return { canvas, shadow, shadowBox, flash: null, x: x0, y: y0, w: width / k2, h: height / k2, bytes };
}

/**
 * The stage nearest to a direction, made if it is not there yet.
 * @param {string} kind  A doctrine or a recipe with a weapon model (weapons.js).
 * @param {string} layer  'all', or 'base' and 'float' for the two halves of the psi weapon; 'base' for the
 *   weapons whose floating part is drawn live over the stage (thunder tower, obelisk).
 * @returns {object|null} null when this frame has used up its share of new stages: draw from the model.
 */
export function stageEntry(kind, rank, layer, k, zoom, dpr) {
  const now = performance.now();
  settle(zoom, dpr, now);
  const key = `${kind}|${rank}|${layer}|${k}`;
  let entry = cache.get(key);
  if (entry) {
    // Most recently used goes last, so the front of the map is what has been unused longest.
    cache.delete(key);
    cache.set(key, entry);
    return entry;
  }
  const bucket = Math.floor(now / FRAME_MS);
  if (bucket !== frameBucket) {
    frameBucket = bucket;
    builtInFrame = 0;
  }
  if (builtInFrame >= TURRET_BUILDS_PER_FRAME) return null;
  builtInFrame += 1;
  entry = build(kind, rank, layer, k, activeStep, dpr);
  cache.set(key, entry);
  turretStats.bytes += entry.bytes;
  turretStats.entries = cache.size;
  while (turretStats.bytes > TURRET_CACHE_BYTES && cache.size > 1) {
    const [oldKey, old] = cache.entries().next().value;
    if (oldKey === key) break;
    cache.delete(oldKey);
    turretStats.bytes -= old.bytes;
    turretStats.evicted += 1;
  }
  turretStats.entries = cache.size;
  return entry;
}

/** The bright variant of a stage for the hit flash, made on first use. */
function flashOf(entry) {
  if (!entry.flash) {
    const { width, height } = entry.canvas;
    const flash = makeCanvas(width, height);
    const f = flash.getContext('2d');
    f.drawImage(entry.canvas, 0, 0);
    f.globalCompositeOperation = 'source-atop';
    f.fillStyle = FLASH_TINT;
    f.fillRect(0, 0, width, height);
    entry.flash = flash;
    entry.bytes += width * height * 4;
    turretStats.bytes += width * height * 4;
  }
  return entry.flash;
}

/**
 * Draws a stage on the ground point (gx, gy) of its emplacement; the context carries the camera.
 * `shift` moves the whole stage, which is how recoil and hovering are drawn without redrawing it.
 * @param {{shift?: number[], flash?: boolean}} options
 */
export function drawStage(ctx, entry, gx, gy, { shift, flash = false } = {}) {
  const dx = shift ? shift[0] : 0;
  const dy = shift ? shift[1] : 0;
  ctx.drawImage(flash ? flashOf(entry) : entry.canvas, gx + entry.x + dx, gy + entry.y + dy, entry.w, entry.h);
}

/**
 * Lays the silhouette of a stage on the ground as its shadow, placed like `drawSpriteShadow`: sheared
 * so that a point `h` px above the foot lands towards the light, squashed to SPRITE_SHADOW_SQUASH.
 */
export function drawStageShadow(ctx, entry, gx, gy, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= SPRITE_SHADOW_ALPHA * alpha;
  ctx.transform(1, 0, -SPRITE_SHADOW_SHEAR, -SPRITE_SHADOW_SQUASH, SPRITE_SHADOW_SHEAR * gy, (1 + SPRITE_SHADOW_SQUASH) * gy);
  const box = entry.shadowBox ?? { x: entry.x, y: entry.y, w: entry.w, h: entry.h };
  ctx.drawImage(entry.shadow, gx + box.x, gy + box.y, box.w, box.h);
  ctx.restore();
}
