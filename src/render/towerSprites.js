// Towers drawn from concept-art sprites: base, weapon, sandbags and rank chevrons.

import { iso } from './iso.js';
import { shadow } from './draw.js';
import { drawSprite } from './sprites/rasterizer.js';
import { towerSprite, DOCTRINES } from './sprites/compose.js';
import { RANK_COUNT } from './sprites/manifest.js';

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

/**
 * Draws a tower record { x, y, doctrine, rank, flash? } standing on its cell.
 * @returns {boolean} false if the sprite is not rasterized yet.
 */
export function drawTowerSprite(ctx, cache, tower, zoom, dpr) {
  const def = towerDef(tower.doctrine, tower.rank);
  const entry = cache.get(def, zoom, dpr);
  if (!entry) return false;
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
  shadow(ctx, sx + 6, sy + 4, 34, 15, 0.28);
  drawSprite(ctx, def, entry, sx, sy, { flash: (tower.flash ?? 0) > 0 });
  return true;
}
