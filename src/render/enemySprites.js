// Enemies drawn from concept-art sprites: ground shadow, bob, facing by walking
// direction, and limbs that move on their own.
//
// A creature is drawn in three pieces (far limbs, body, near limbs). The two limb
// groups are animated in code: legs swing around their hips in counter-phase, wings
// fold up and down through the body's plane (docs/ART.md). Creatures without limb
// groups — the warp seer hovers — are drawn in one piece.

import { iso } from './iso.js';
import { shadow, ell, poly } from './draw.js';
import { C } from './palette.js';
import { enemySprite, enemySpriteSet, nextFlip, ENEMY_TYPES } from './sprites/compose.js';
import { ENEMY_SHADOW } from './sprites/manifest.js';
import { ALL_ENEMIES } from '../data/enemies.js';

/** Creatures that change their armour while fighting: the demon prince (ART.md). */
const ARMOR_CYCLE = new Set(Object.entries(ALL_ENEMIES).filter(([, def]) => def.armorCycle).map(([id]) => id));

/** Guide colour per armour type, bright enough to read on dark chitin. */
const ARMOR_COLOURS = { flesh: '#c23a2a', plate: '#a4502a', warpshield: '#9a6ae0', flyer: '#b9a882' };

/** Seconds the ring after an armour change keeps expanding. */
const ARMOR_PULSE = 0.6;

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

/**
 * Makes the demon prince's armour readable: a ring on the ground and a shield on
 * his chest in the colour of what he is wearing right now, plus a pulse when it
 * changes. Drawn unmirrored, on top of the figure.
 */
function drawArmorSign(ctx, e, sx, sy, top, pulse) {
  const colour = ARMOR_COLOURS[e.armor] ?? C.bone;
  ctx.save();
  ctx.globalAlpha *= 0.85;
  ell(ctx, sx, sy, 22, 9, null, colour, 2.5);
  if (pulse > 0) {
    const u = 1 - pulse / ARMOR_PULSE;
    ctx.globalAlpha *= pulse / ARMOR_PULSE;
    ell(ctx, sx, sy, 22 + u * 26, 9 + u * 11, null, colour, 3);
    ctx.globalAlpha /= pulse / ARMOR_PULSE;
  }
  ctx.restore();
  // Shield badge on the body.
  const y = sy - top * 0.55;
  const w = 7;
  poly(ctx, [[sx - w, y - w], [sx + w, y - w], [sx + w, y], [sx, y + w * 1.3], [sx - w, y]], colour, C.ink, 2);
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.5, y - w * 0.6);
  ctx.lineTo(sx - w * 0.5, y - w * 0.1);
  ctx.stroke();
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
 * @returns {(ctx: CanvasRenderingContext2D, e: object, t: number, view: object) => boolean}
 *   Draw function; returns false if no sprite is available yet (caller falls back).
 */
export function createEnemySpriteRenderer(cache) {
  // Facing is render-side state; a WeakMap forgets enemies once they are gone.
  const flipped = new WeakMap();
  /** Last armour seen per enemy, to flash when it changes. */
  const armour = new WeakMap();

  /**
   * @param {{zoom: number, dpr: number, reducedMotion?: boolean, simTime?: number, dt?: number}} view
   */
  return function drawEnemySprite(ctx, e, t, view) {
    const { zoom, dpr, reducedMotion = false, simTime = 0, dt = 0 } = view;
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
    // Standing in the purge shrine's aura: a gold light on the creature itself,
    // so the aura is readable on what it is doing and not only on the ground
    // (docs/ART.md, "Spezialstellungen").
    if (e.gildUntil > simTime) {
      const pulse = reducedMotion ? 0.3 : 0.24 + Math.abs(Math.sin(t * 5 + e.id)) * 0.14;
      const g = ctx.createRadialGradient(sx, sy - r * 0.5, r * 0.2, sx, sy - r * 0.5, r * 1.5);
      g.addColorStop(0, `rgba(255,210,63,${pulse})`);
      g.addColorStop(1, 'rgba(255,210,63,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy - r * 0.5, r * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const stunned = e.stunUntil > simTime;
    const bob =
      reducedMotion || stunned ? 0 : e.flying ? Math.sin(t * 3 + e.id) * 3 : Math.abs(Math.sin(t * 9 + e.id)) * 1.6;
    const flash = (e.flash ?? 0) > 0;

    ctx.save();
    ctx.translate(sx, sy - bob);
    if (flip) ctx.scale(-1, 1);

    if (whole) {
      drawPart(ctx, set.whole, whole, flash);
    } else {
      const limbs = set.limbs;
      // Stunned creatures hold still, and so does everything with
      // prefers-reduced-motion.
      const still = reducedMotion || stunned;
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

    if (ARMOR_CYCLE.has(e.type)) {
      let mark = armour.get(e);
      if (!mark) {
        mark = { armor: e.armor, pulse: 0 };
        armour.set(e, mark);
      }
      if (mark.armor !== e.armor) {
        mark.armor = e.armor;
        mark.pulse = ARMOR_PULSE;
      }
      mark.pulse = Math.max(0, mark.pulse - dt);
      drawArmorSign(ctx, e, sx, sy, ENEMY_TOP[e.type] ?? 20, reducedMotion ? 0 : mark.pulse);
    }

    ctx.globalAlpha = 1;
    return true;
  };
}
