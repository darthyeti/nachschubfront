// Maps game types to concept-art symbols and sets their size in the world.
// Rules: docs/ART.md. Symbol ids come from the generated enemies.js / towers.js.

import { MAX_RANK } from '../../data/ranks.js';
import { BOSSES, KOLOSS } from '../../data/enemies.js';
import { BUNKER_ROOF_HEIGHT } from '../../data/art.js';

/** World pixels per SVG unit. A cell is 64 x 32 world pixels. */
export const SPRITE_SCALE = {
  /**
   * One. The emplacement sheets are exported from the study, which draws in the
   * same isometric projection the game uses, so its units are world pixels
   * already and the bunker covers exactly one cell without being resized.
   */
  tower: 1,
  /** Enemies share one scale so their relative sizes from the concept sheet are kept. */
  enemy: 0.42,
  /**
   * The capsule (draft B of the capsule study, 0.10.5), exported at the study's own
   * scale: its heat shield is 51 SVG units across, the landing lugs 70. At 0.8 the
   * closed capsule is as wide as the old one was (docs/ART.md, "Größe und
   * Falldauer"), so up to six capsules on neighbouring landing zones do not hide
   * one another.
   */
  pod: 0.8,
};

/**
 * The supply pod (docs/ART.md, "Nachschubkapsel"). Closed it is one piece; open
 * it is the heat shield, a core that keeps collar and roof on top, and four wall
 * segments that fall outwards like petals, numbered as the study numbers them.
 *
 * `hinge` is the midpoint of the edge a segment shares with the core, in SVG
 * units (printed by `npm run studies`, "Anker der Kapsel"). A segment grows out
 * of that point while it opens, which is what turns the standing wall into the
 * lying plate. `layer` says whether it is drawn behind or in front of the core,
 * `angle` is the direction it falls in on the ground (0 right, clockwise), the
 * way the landing dust and the slam are placed.
 */
export const POD_PETALS = [
  { id: 'pod-petal-0', hinge: [12.01, -1.64], layer: 'front', angle: 0.35 },
  { id: 'pod-petal-1', hinge: [-4.32, 2.2], layer: 'front', angle: 1.92 },
  { id: 'pod-petal-2', hinge: [-12.01, -5.96], layer: 'back', angle: 3.49 },
  { id: 'pod-petal-3', hinge: [4.32, -9.8], layer: 'back', angle: 5.06 },
];

/**
 * The order the segments blow open in (the study's order for draft B): a
 * segment, then the opposite one, so the capsule does not unpeel tidily round
 * the circle.
 */
export const POD_PETAL_ORDER = ['pod-petal-0', 'pod-petal-2', 'pod-petal-1', 'pod-petal-3'];

/**
 * Where the code-drawn parts sit, in SVG units of the closed capsule (also
 * printed by `npm run studies`): the brake nozzles on the roof tower, the two
 * collar lamps, the rings of light round the core (height above the foot), the
 * core's radius and the height of the roof.
 */
export const POD_ANCHORS = {
  nozzles: [[12.51, -56.65], [-4.51, -52.64]],
  lamps: [[9.3, -50.46], [-9.3, -50.46]],
  rings: [12.35, 19.95, 27.55],
  coreRadius: 6.48,
  top: 76,
  coreTop: 54.15,
  shieldRadius: 25.65,
};

/**
 * The opened pod is drawn this much smaller than the closed one. Open, its
 * segments span almost two cells, and neighbouring emplacements would disappear
 * under it (docs/ART.md).
 */
export const POD_OPEN_SCALE = 0.85;

/** Height of the base's top face above ground, in SVG units (the symbol origin sits on it). */
/**
 * Height of the roof plate above the ground, in SVG units, for the standard
 * bunker and for the taller special base. The top sits there; the bunker's own
 * symbol has its origin on the ground.
 */
export const BUNKER_ROOF = BUNKER_ROOF_HEIGHT;
export const SPECIAL_ROOF = 40;

export const ENEMY_SYMBOLS = {
  swarmer: 'e-swarm',
  warrior: 'e-mutant',
  breaker: 'e-brute',
  warpseer: 'e-ghost',
  carrionflyer: 'e-flyer',
  burster: 'e-burst',
  healer: 'e-heal',
};

/** Since M4 every boss has a figure of its own (docs/ART.md). */
export const BOSS_SYMBOLS = {
  broodmother: 'e-brood',
  colossusbreaker: 'e-colossus',
  warpherald: 'e-herald',
  swarmqueen: 'e-queen',
  daemonprince: 'e-prince',
};

/** The Koloss is no boss of a wave, so it stands apart (GDD section 9, v3). */
export const KOLOSS_SYMBOL = { koloss: 'e-koloss' };

/** Extra size factor on top of SPRITE_SCALE.enemy; 1 for normal enemies. */
export const ENEMY_EXTRA_SCALE = {
  ...Object.fromEntries(Object.entries(BOSSES).map(([id, boss]) => [id, boss.scale])),
  koloss: KOLOSS.scale,
};

/** Every drawable enemy symbol, normal types first. */
export const ALL_ENEMY_SYMBOLS = { ...ENEMY_SYMBOLS, ...BOSS_SYMBOLS, ...KOLOSS_SYMBOL };

/** Ground shadow per enemy (radius in world pixels). */
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
  // The Koloss is wider than it is tall, so its shadow is wider than the factor
  // alone would make it.
  koloss: BASE_SHADOW[KOLOSS.sprite] * KOLOSS.scale * 1.15,
};

/**
 * Limbs that move by themselves (M4): the creature is drawn as far limbs, body
 * and near limbs, and the two limb groups are animated in code.
 * Pivots are SVG units, taken from where the limbs meet the body
 * (printed by tests/tools/split-enemies.py). Keyed by symbol, so bosses that
 * borrow a figure get the same movement.
 *
 * - `legs`  the group swings around its hips, far and near in counter-phase.
 * - `wings` the pair folds up and down through the body's plane.
 */
export const ENEMY_LIMBS = {
  'e-swarm': { kind: 'legs', back: [4, -15.3], front: [7.3, -12.7], swing: 0.22, speed: 13 },
  'e-mutant': { kind: 'legs', back: [1, -30], front: [4, -28], swing: 0.17, speed: 9 },
  'e-brute': { kind: 'legs', back: [-2, -24], front: [5, -20], swing: 0.12, speed: 6 },
  'e-burst': { kind: 'legs', back: [5.3, -16.7], front: [-0.7, -16], swing: 0.19, speed: 10 },
  'e-heal': { kind: 'legs', back: [2, -44], front: [4, -42], swing: 0.14, speed: 8 },
  'e-flyer': { kind: 'wings', back: [0, -78], front: [0, -78], speed: 9 },
  // Bosses carry their weight: slower steps, smaller swing. The warp herald
  // hovers and has no limb groups at all.
  'e-brood': { kind: 'legs', back: [6, -32], front: [4.7, -27.3], swing: 0.13, speed: 6 },
  'e-colossus': { kind: 'legs', back: [-2, -30], front: [6, -26], swing: 0.1, speed: 5 },
  'e-prince': { kind: 'legs', back: [-1, -48], front: [3, -44], swing: 0.14, speed: 6 },
  'e-queen': { kind: 'wings', back: [0, -80], front: [0, -80], speed: 7 },
};

/** Recipe emplacements (GDD section 8); each one has its own silhouette since M4. */
/** The top each recipe emplacement carries on the special base. */
export const SPECIAL_SYMBOLS = {
  purgeShrine: 'stop-purgeShrine',
  stormBattery: 'stop-stormBattery',
  emberCauldron: 'stop-emberCauldron',
  siegeMortar: 'stop-siegeMortar',
  thunderTower: 'stop-thunderTower',
  soulfireObelisk: 'stop-soulfireObelisk',
};

/** And the top each doctrine carries on the bunker roof. */
export const DOCTRINE_SYMBOLS = {
  flame: 'top-fire',
  autocannon: 'top-auto',
  laser: 'top-laser',
  mortar: 'top-mortar',
  psi: 'top-psi',
  tesla: 'top-tesla',
};

/**
 * Where the effect of each emplacement leaves its figure (docs/ART.md,
 * "Wirkungsanker"), in SVG units in the top's own frame — the origin of a top
 * is the roof plate it stands on. The simulation keeps working from the middle
 * of the cell; only the drawing starts here.
 *
 * The values are the `tip` the study names for each weapon, scaled the way the
 * study places it on a roof, and printed by `npm run studies` so they stay in
 * step with the figures instead of being guessed.
 *
 * - `tip`     the one point an effect leaves from.
 * - `sparks`  several such points, when it leaves from more than one.
 * - `spin`    sideways wobble of a barrel cluster while firing.
 * - `casings` spent cases tumble out while firing.
 * - `sight`   a thin aiming line is drawn before the shot.
 * - `glow`    halo and rings around a hovering part, when the doctrine's own
 *             colour would be wrong or missing.
 * - `float`   the top hovers instead of sitting still.
 */
export const TOWER_TOPS = {
  autocannon: { tip: [-28.16, -9.63], spin: 1.1 },
  flame: { tip: [-24.45, -2.96] },
  mortar: { tip: [-11.4, -28.5], recoil: 3 },
  tesla: { tip: [0, -28.5] },
  laser: { tip: [-23.75, -15.2] },
  psi: { tip: [0, -28.5], float: true },

  // The recipe emplacements. Three of them work from more than one point: the
  // battery has four mouths, the cauldron four electrodes.
  purgeShrine: { tip: [0, -14.28], float: true, glow: { kind: 'psi', colour: '#e8c872' } },
  stormBattery: {
    tip: [-32.26, -16.13],
    casings: true,
    sparks: [
      [-33.26, -21.77],
      [-27.22, -20.56],
      [-33.26, -10.68],
      [-27.22, -9.48],
    ],
  },
  emberCauldron: {
    tip: [0, -25.2],
    sparks: [
      [-13.86, -22.68],
      [-4.62, -24.36],
      [4.62, -24.36],
      [13.86, -22.68],
    ],
  },
  siegeMortar: { tip: [-21.84, -36.96], recoil: 4, sight: true },
  thunderTower: { tip: [0, -37.8], glow: { kind: 'psi', colour: '#5fd4ff' } },
  soulfireObelisk: { tip: [0, -75.6], glow: { kind: 'psi', colour: '#b784ff' } },
};

export const RANK_COUNT = MAX_RANK;
