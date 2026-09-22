// Maps game types to concept-art symbols and sets their size in the world.
// Rules: docs/ART.md. Symbol ids come from the generated enemies.js / towers.js.

import { MAX_RANK } from '../../data/ranks.js';
import { BOSSES } from '../../data/enemies.js';

/** World pixels per SVG unit. A cell is 64 x 32 world pixels. */
export const SPRITE_SCALE = {
  /** The base's top face (88 SVG units wide) covers 90 % of a cell. */
  tower: (64 * 0.9) / 88,
  /** Enemies share one scale so their relative sizes from the concept sheet are kept. */
  enemy: 0.42,
};

/** Height of the base's top face above ground, in SVG units (the symbol origin sits on it). */
export const TOWER_BASE_TOP = 18;

export const ENEMY_SYMBOLS = {
  swarmer: 'e-swarm',
  warrior: 'e-mutant',
  breaker: 'e-brute',
  warpseer: 'e-ghost',
  carrionflyer: 'e-flyer',
  burster: 'e-burst',
  healer: 'e-heal',
};

/**
 * Bosses have no concept art yet (ART.md): until M4 each one borrows the symbol
 * of a related enemy and is drawn larger. Both values come from data/enemies.js.
 */
export const BOSS_SYMBOLS = Object.fromEntries(
  Object.entries(BOSSES).map(([id, boss]) => [id, ENEMY_SYMBOLS[boss.sprite]]),
);

/** Extra size factor on top of SPRITE_SCALE.enemy; 1 for normal enemies. */
export const ENEMY_EXTRA_SCALE = Object.fromEntries(
  Object.entries(BOSSES).map(([id, boss]) => [id, boss.scale]),
);

/** Every drawable enemy symbol, normal types first. */
export const ALL_ENEMY_SYMBOLS = { ...ENEMY_SYMBOLS, ...BOSS_SYMBOLS };

/** Ground shadow per enemy (radius in world pixels) and hover height for flyers. */
const BASE_SHADOW = {
  swarmer: 13,
  warrior: 15,
  breaker: 22,
  warpseer: 14,
  carrionflyer: 16,
  burster: 17,
  healer: 14,
};

export const ENEMY_SHADOW = {
  ...BASE_SHADOW,
  ...Object.fromEntries(
    Object.entries(BOSSES).map(([id, boss]) => [id, BASE_SHADOW[boss.sprite] * boss.scale]),
  ),
};

export const DOCTRINE_SYMBOLS = {
  flame: 't-flame',
  autocannon: 't-ac',
  laser: 't-laser',
  mortar: 't-mortar',
  psi: 't-psi',
  tesla: 't-tesla',
};

/**
 * These doctrines already carry a sandbag ring in their base form, so the veteran
 * ring is skipped for them (decision M1b; a dedicated veteran detail follows later).
 */
export const OWN_SANDBAGS = new Set(['autocannon', 'mortar']);

export const RANK_COUNT = MAX_RANK;
