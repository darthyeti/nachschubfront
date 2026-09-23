// Enemies drawn from concept-art sprites: ground shadow, bob, facing by walking
// direction, and limbs that move on their own.
//
// A creature is drawn in three pieces (far limbs, body, near limbs). The two limb
// groups are animated in code: legs swing around their hips in counter-phase, wings
// fold up and down through the body's plane (docs/ART.md). Creatures without limb
// groups — the warp seer hovers — are drawn in one piece.

import { iso } from './iso.js';
import { shadow } from './draw.js';
import { enemySprite, enemySpriteSet, nextFlip, ENEMY_TYPES } from './sprites/compose.js';
import { ENEMY_SHADOW } from './sprites/manifest.js';

const SETS = Object.fromEntries(ENEMY_TYPES.map((type) => [type, enemySpriteSet(type)]));

/** Sprite definitions of everything that is actually drawn, for preloading. */
export const ENEMY_SPRITE_DEFS = Object.values(SETS).flatMap((set) =>
  set.limbs ? [set.back, set.body, set.front] : [set.whole],
);

/**
 * World pixels from the ground to the top of an enemy's artwork (positive up).
 * Health bars and info labels sit above that.
 */
export const ENEMY_TOP = Object.fromEntries(
  ENEMY_TYPES.map((type) => {
    const def = enemySprite(type);
    return [type, Math.max(12, -def.bbox[1] * def.unitScale)];
  }),
);

/** Visual-only sideways offset per enemy, so a column does not render as one blob. */
export function lateralOffset(e) {
  return (((e.id * 0.6180339887) % 1) - 0.5) * 0.36;
}

/**
 * Wing position over one beat: 1 is fully raised, negative means below the body.
 * @param {number} phase  Radians.
 */
export function wingFold(phase) {
  return 0.35 + 0.65 * Math.cos(phase);
}

/** Draws a part with the context already sitting on the creature's ground point. */
function drawPart(ctx, def, entry, flash) {
  const s = def.unitScale;
  const [bx, by, bw, bh] = def.bbox;
  ctx.drawImage(flash ? entry.flash : entry.canvas, bx * s, by * s, bw * s, bh * s);
}

/** Draws a limb group with its own transform around the pivot where it meets the body. */
function drawLimbs(ctx, def, entry, pivot, transform, flash) {
  const s = def.unitScale;
  const px = pivot[0] * s;
  const py = pivot[1] * s;
  ctx.save();
  ctx.translate(px, py);
  transform(ctx);
  ctx.translate(-px, -py);
  drawPart(ctx, def, entry, flash);
  ctx.restore();
}

/**
 * @returns {(ctx: CanvasRenderingContext2D, e: object, t: number, zoom: number, dpr: number) => boolean}
 *   Draw function; returns false if no sprite is available yet (caller falls back).
 */
export function createEnemySpriteRenderer(cache) {
  // Facing is render-side state; a WeakMap forgets enemies once they are gone.
  const flipped = new WeakMap();

  return function drawEnemySprite(ctx, e, t, zoom, dpr, reducedMotion = false) {
    const set = SETS[e.type];
    if (!set) return false;
    const whole = set.limbs ? null : cache.get(set.whole, zoom, dpr);
    const body = set.limbs ? cache.get(set.body, zoom, dpr) : null;
    if (!whole && !body) return false;

    const flip = nextFlip(flipped.get(e) ?? false, e.dx, e.dy);
    flipped.set(e, flip);

    const off = lateralOffset(e);
    const [sx, sy] = iso(e.x - e.dy * off, e.y + e.dx * off);
    const alpha = Math.min(1, e.d / 0.5);
    if (alpha <= 0) return true;
    ctx.globalAlpha = alpha;

    const r = ENEMY_SHADOW[e.type] ?? 14;
    shadow(ctx, sx, sy + 1, r, r * 0.42, e.flying ? 0.2 : 0.3);
    const bob = reducedMotion ? 0 : e.flying ? Math.sin(t * 3 + e.id) * 3 : Math.abs(Math.sin(t * 9 + e.id)) * 1.6;
    const flash = (e.flash ?? 0) > 0;

    ctx.save();
    ctx.translate(sx, sy - bob);
    if (flip) ctx.scale(-1, 1);

    if (whole) {
      drawPart(ctx, set.whole, whole, flash);
    } else {
      const limbs = set.limbs;
      // Stunned or frozen creatures hold still, and so does everything with
      // prefers-reduced-motion.
      const still = reducedMotion || e.stun > 0;
      const phase = still ? 0 : t * limbs.speed + e.id;
      const back = cache.get(set.back, zoom, dpr);
      const front = cache.get(set.front, zoom, dpr);
      if (limbs.kind === 'wings') {
        const fold = still ? 1 : wingFold(phase);
        if (back) drawLimbs(ctx, set.back, back, limbs.back, (c) => c.scale(1, fold), flash);
        drawPart(ctx, set.body, body, flash);
        if (front) drawLimbs(ctx, set.front, front, limbs.front, (c) => c.scale(1, fold), flash);
      } else {
        const swing = still ? 0 : Math.sin(phase) * limbs.swing;
        if (back) drawLimbs(ctx, set.back, back, limbs.back, (c) => c.rotate(-swing), flash);
        drawPart(ctx, set.body, body, flash);
        if (front) drawLimbs(ctx, set.front, front, limbs.front, (c) => c.rotate(swing), flash);
      }
    }
    ctx.restore();

    ctx.globalAlpha = 1;
    return true;
  };
}
