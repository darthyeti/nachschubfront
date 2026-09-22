// Enemies drawn from concept-art sprites: ground shadow, bob, facing by walking direction.

import { iso } from './iso.js';
import { shadow } from './draw.js';
import { drawSprite } from './sprites/rasterizer.js';
import { enemySprite, nextFlip, ENEMY_TYPES } from './sprites/compose.js';
import { ENEMY_SHADOW } from './sprites/manifest.js';

const DEFS = Object.fromEntries(ENEMY_TYPES.map((type) => [type, enemySprite(type)]));

/** Sprite definitions of all enemies, e.g. for preloading. */
export const ENEMY_SPRITE_DEFS = Object.values(DEFS);

/** Visual-only sideways offset per enemy, so a column does not render as one blob. */
export function lateralOffset(e) {
  return (((e.id * 0.6180339887) % 1) - 0.5) * 0.36;
}

/**
 * @returns {(ctx: CanvasRenderingContext2D, e: object, t: number, zoom: number, dpr: number) => boolean}
 *   Draw function; returns false if no sprite is available yet (caller falls back).
 */
export function createEnemySpriteRenderer(cache) {
  // Facing is render-side state; a WeakMap forgets enemies once they are gone.
  const flipped = new WeakMap();

  return function drawEnemySprite(ctx, e, t, zoom, dpr) {
    const def = DEFS[e.type];
    const entry = def && cache.get(def, zoom, dpr);
    if (!entry) return false;

    const flip = nextFlip(flipped.get(e) ?? false, e.dx, e.dy);
    flipped.set(e, flip);

    const off = lateralOffset(e);
    const [sx, sy] = iso(e.x - e.dy * off, e.y + e.dx * off);
    const alpha = Math.min(1, e.d / 0.5);
    if (alpha <= 0) return true;
    ctx.globalAlpha = alpha;

    const r = ENEMY_SHADOW[e.type] ?? 14;
    shadow(ctx, sx, sy + 1, r, r * 0.42, e.flying ? 0.2 : 0.3);
    const bob = e.flying ? Math.sin(t * 3 + e.id) * 3 : Math.abs(Math.sin(t * 9 + e.id)) * 1.6;
    drawSprite(ctx, def, entry, sx, sy - bob, { flip, flash: (e.flash ?? 0) > 0 });

    ctx.globalAlpha = 1;
    return true;
  };
}
