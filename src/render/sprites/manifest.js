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

/**
 * The autocannon's own ring is not drawn into its group: the concept sheet wraps the
 * shared sandbag symbols around it, so it always gets them, at every rank.
 */
export const SHARED_SANDBAGS = new Set(['autocannon']);

/**
 * The moving part of each emplacement (M4: the weapon comes out of the sprite and is
 * turned in code). All values are SVG units in the symbol's own frame.
 *
 * - `pivot`   where the weapon sits on its mount and turns around.
 * - `rest`    screen angle the weapon points at in the artwork (atan2, y downwards).
 * - `muzzle`  distance from the pivot to the muzzle, for flames, glows and arcs.
 * - `track`   how much of the way to the target it turns; the mortar only leans.
 * - `turn`    turning speed in radians per second.
 * - `recoil`  how far the weapon is pushed back along its axis after a shot.
 * - `spin`    sideways wobble of a barrel cluster while firing.
 * - `float`   the part hovers instead of aiming (the psi crystal).
 * - `static`  nothing moves; the entry only marks where the glow sits (tesla sphere).
 */
export const TOWER_WEAPONS = {
  flame: { pivot: [-4, -8], rest: 2.8024, muzzle: 36, track: 1, turn: 10 },
  autocannon: { pivot: [-6, -19], rest: 2.7687, muzzle: 49.4, track: 1, turn: 14, recoil: 4, spin: 1.4 },
  laser: { pivot: [0, -112], rest: 2.78, muzzle: 48.1, track: 1, turn: 8, recoil: 2.5 },
  mortar: { pivot: [4, -6], rest: -1.7819, muzzle: 57.3, track: 0.22, turn: 5, recoil: 7 },
  psi: { pivot: [0, -100], float: true },
  tesla: { pivot: [0, -100], static: true },
};

export const RANK_COUNT = MAX_RANK;
