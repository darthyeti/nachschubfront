// Towers drawn from concept-art sprites: base, weapon, sandbags and rank chevrons.

import { iso } from './iso.js';
import { shadow, ell } from './draw.js';
import { C } from './palette.js';
import { drawSprite } from './sprites/rasterizer.js';
import { towerSprite, DOCTRINES } from './sprites/compose.js';
import { RANK_COUNT } from './sprites/manifest.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';

const defs = new Map();

/** Sprite definition for a doctrine and rank (cached, cheap to call per frame). */
export function towerDef(doctrine, rank) {
  const key = `${doctrine}:${rank}`;
  let def = defs.get(key);
  if (!def) {
    def = towerSprite(doctrine, rank);
    defs.set(key, def);
  }
  return def;
}

/** All tower sprite definitions, e.g. for preloading the gallery. */
export function allTowerDefs() {
  const all = [];
  for (const doctrine of DOCTRINES) for (let rank = 1; rank <= RANK_COUNT; rank++) all.push(towerDef(doctrine, rank));
  return all;
}

/** Rank whose sprite a tower uses; special towers borrow the legend artwork. */
export function spriteRank(tower) {
  return tower.special ? RANK_COUNT : tower.rank;
}

/**
 * Placeholder look for special towers until they get their own concept art
 * (M4): a glowing ring and halo in the leading ingredient's guide colour.
 */
function specialHalo(ctx, sx, sy, color, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 2);
  ell(ctx, sx, sy, 30, 15, `rgba(242,193,78,.16)`, C.gold, 2.5);
  ctx.save();
  ctx.globalAlpha = 0.25 + pulse * 0.15;
  ell(ctx, sx, sy - 54, 26, 26, color, null);
  ctx.globalAlpha = 0.5;
  ell(ctx, sx, sy - 54, 26, 26, null, color, 2);
  ctx.restore();
}

/**
 * Draws a tower record { x, y, doctrine, rank, special?, flash? } on its cell.
 * @returns {boolean} false if the sprite is not rasterized yet.
 */
export function drawTowerSprite(ctx, cache, tower, zoom, dpr, t = 0) {
  const def = towerDef(tower.doctrine, spriteRank(tower));
  const entry = cache.get(def, zoom, dpr);
  if (!entry) return false;
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
  shadow(ctx, sx + 6, sy + 4, 34, 15, 0.28);
  if (tower.special) specialHalo(ctx, sx, sy, DOCTRINE_COLORS[tower.doctrine], t);
  drawSprite(ctx, def, entry, sx, sy, { flash: (tower.flash ?? 0) > 0 });
  return true;
}
