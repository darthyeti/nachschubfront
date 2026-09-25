// Maps game types to concept-art symbols and sets their size in the world.
// Rules: docs/ART.md. Symbol ids come from the generated enemies.js / towers.js.

import { MAX_RANK } from '../../data/ranks.js';
import { BOSSES, KOLOSS } from '../../data/enemies.js';

/** World pixels per SVG unit. A cell is 64 x 32 world pixels. */
export const SPRITE_SCALE = {
  /** The base's top face (88 SVG units wide) covers 90 % of a cell. */
  tower: (64 * 0.9) / 88,
  /** Enemies share one scale so their relative sizes from the concept sheet are kept. */
  enemy: 0.42,
  /**
   * The capsule's heat shield (66 SVG units wide). It used to cover 90 % of a
   * cell like an emplacement's base; since v3 it is a fifth smaller, so up to
   * six capsules on neighbouring landing zones no longer hide one another
   * (docs/ART.md, "Größe und Falldauer").
   */
  pod: (64 * 0.9 * 0.8) / 66,
};

/**
 * The supply pod (docs/ART.md, "Nachschubkapsel"). Closed it is one piece; open
 * it is a core, which since M4d keeps the roof on top, and four wall segments
 * that fold down around it, named for the direction they fall in.
 *
 * `hinge` is the midpoint of the edge a segment shares with the core, in SVG
 * units (printed by tests/tools/split-pod-open.py). A segment grows out of that
 * point while it opens, which is what turns the standing wall into the lying
 * plate. `layer` says whether it is drawn behind or in front of the core.
 */
export const POD_PETALS = [
  { id: 'pod-petal-bl', hinge: [-12.5, -5.6], layer: 'back' },
  { id: 'pod-petal-br', hinge: [12.5, -5.6], layer: 'back' },
  { id: 'pod-petal-fr', hinge: [12.5, 5.6], layer: 'front' },
  { id: 'pod-petal-fl', hinge: [-12.5, 5.6], layer: 'front' },
];

/**
 * The order the segments blow open in. Opposite corners first, so the capsule
 * does not unpeel tidily round the circle.
 */
export const POD_PETAL_ORDER = ['pod-petal-br', 'pod-petal-fr', 'pod-petal-bl', 'pod-petal-fl'];

/**
 * The opened pod is drawn this much smaller than the sketch. Open, it spans
 * almost two cells, and neighbouring emplacements would disappear under it
 * (docs/ART.md).
 */
export const POD_OPEN_SCALE = 0.85;

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
export const SPECIAL_SYMBOLS = {
  purgeShrine: 't-purge',
  stormBattery: 't-storm',
  emberCauldron: 't-ember',
  siegeMortar: 't-siege',
  thunderTower: 't-thunder',
  soulfireObelisk: 't-obelisk',
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
 * The mortar already carries a sandbag ring in its base form, so the veteran
 * ring is skipped for it (decision M1b). The autocannon was in this set until
 * M4d took its own ring away with the shared bunker.
 */
export const OWN_SANDBAGS = new Set(['mortar']);

/**
 * Veteran detail for the doctrine that already has a ring: an ammunition crate.
 * The mortar's right side is taken by its own crate, so it gets the mirrored
 * one (decision M1b, settled in M4).
 */
export const VETERAN_CRATE = { mortar: 'crate-l' };

/**
 * Where the elite armour plates sit on doctrines whose weapon does not aim
 * (SVG units), optionally followed by the plate's size and the screen angle it
 * lies along. The bunkers get theirs flat against the left front face, which in
 * the isometric view runs down to the right at 1:2. Everything else gets the
 * plate on the barrel, along its axis.
 */
const ISO_FACE = Math.atan2(0.5, 1);
export const PLATE_SPOT = {
  psi: [0, -46],
  tesla: [0, -52],
  flame: [-14, -3, 5.5, ISO_FACE],
  autocannon: [-14, -3, 5.5, ISO_FACE],
};

/**
 * The three embrasures of the shared bunker (docs/ART.md, "Gemeinsamer Bunker"),
 * in SVG units, left to right across its front.
 */
export const BUNKER_EMBRASURES = [[-11, -12.5], [0, -12.5], [11, -12.5]];

/**
 * The four barrel mouths of the storm battery's quad flak, in the same frame.
 * It stands still and fires out of all four at once (docs/ART.md).
 */
const BATTERY_MOUTHS = [[-15.1, -60], [-3.7, -63], [7.7, -63], [19.1, -60]];

/**
 * The tips of the ember cauldron's four tesla electrodes, from which the bolts
 * that set enemies alight leave (docs/ART.md, "Wirkungsanker"). Lifted onto the
 * socket like the rest of the figure.
 */
const CAULDRON_ELECTRODES = [[11, -76.9], [20.7, -72.7], [20.7, -67.3], [11, -63.1]];

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
 * - `ports`   openings the effect comes out of instead of one muzzle: the
 *             bunker's three embrasures, the storm battery's four barrel mouths.
 * - `anchor`  where the emplacement's effect starts on the figure (docs/ART.md,
 *             "Wirkungsanker"). The simulation keeps working from the middle of
 *             the cell; only the drawing starts here. A weapon that aims has no
 *             anchor of its own: its muzzle is the point, and it moves.
 * - `sparks`  several such points, when the effect leaves from more than one.
 * - `glow`    the halo and rings around a hovering part, when the doctrine's own
 *             would be the wrong colour or missing altogether.
 * - `sight`   the weapon draws a thin aiming line before it fires.
 */
export const TOWER_WEAPONS = {
  // The two bunkers have nothing that aims (M4d). Their pivot is the middle
  // embrasure, which is where the idle pilot light of the flame sits.
  flame: { pivot: [0, -12.5], ports: BUNKER_EMBRASURES },
  autocannon: { pivot: [0, -12.5], ports: BUNKER_EMBRASURES },
  // The laser kept its design and its pose; update 4 only scaled the figure
  // down by 0.68 and lifted it by 16 units, so pivot and muzzle follow.
  laser: { pivot: [0, -92.2], rest: 2.78, muzzle: 32.7, track: 1, turn: 8, recoil: 1.7 },
  mortar: { pivot: [4, -6], rest: -1.7819, muzzle: 57.3, track: 0.22, turn: 5, recoil: 7 },
  psi: { pivot: [0, -100], float: true },
  tesla: { pivot: [0, -100], static: true },
  // Recipe emplacements (all six finished in M5c). The siege mortar leans its
  // tube, the storm battery's quad flak points upwards and flashes out of all
  // four mouths, two of them hover a psi part instead of aiming, and the
  // cauldron stands still and works through its aura.
  stormBattery: { pivot: [2, -40], ports: BATTERY_MOUTHS, casings: true, anchor: [2, -61.5] },
  // Lafette and tube from the M5c sheet: the pivot is where the tube sits on
  // the carriage, the muzzle the far end of it, both lifted onto the socket.
  siegeMortar: { pivot: [0, -26], rest: -2.6522, muzzle: 72.5, track: 0.18, turn: 4, recoil: 9, sight: true },
  // The psi splinter over the shrine and the psi core over the thunder tower's
  // coil hover, like the psi crystal and the obelisk's eye.
  // The shrine burns in its bowl; the splinter above it is violet, not the
  // orange of the flame doctrine it inherits.
  purgeShrine: {
    pivot: [0, -62],
    float: true,
    anchor: [0, -36],
    glow: { kind: 'psi', colour: '#b784ff' },
  },
  // The aura rises out of the cauldron's mouth, the bolts leave the electrodes.
  emberCauldron: { pivot: [0, -54], static: true, anchor: [0, -54], sparks: CAULDRON_ELECTRODES },
  // The chain over eight targets starts at the coil on the mast, not at the psi
  // core hovering above it.
  thunderTower: {
    pivot: [0, -128],
    float: true,
    anchor: [0, -114],
    glow: { kind: 'psi', colour: '#5fd4ff' },
  },
  soulfireObelisk: { pivot: [0, -214], float: true, anchor: [0, -214] },
};

export const RANK_COUNT = MAX_RANK;
