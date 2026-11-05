// Presentation numbers that are not rules of the game (docs/ART.md). Nothing in
// src/sim or src/core reads this file.

/**
 * The standard bunker is drawn at this fraction of its authored size (decision of
 * 03.11.2026: 74 % of the first version of the study). The exported SVGs already carry
 * it; the number is here so the roof height below stays derived from it.
 */
export const BUNKER_BASE_SCALE = 0.74;

/** Authored height of the roof platform of the bunker, in px, before the scale. */
export const BUNKER_MOUNT_AUTHORED = 28;

/** Height of the roof platform above the ground in world px: the weapon top stands there. */
export const BUNKER_ROOF_HEIGHT = BUNKER_MOUNT_AUTHORED * BUNKER_BASE_SCALE;

/** Terrain in front of a selected field, a placement spot or a capsule target (reveal, issue 35). */
export const REVEAL = {
  /** Opacity of the covering blocks while the field behind them is being looked at (0 to 1). */
  blockAlpha: 0.18,
  /** Fade in and out, in milliseconds. With reduced motion it switches at once. */
  fadeMs: 150,
  /** Most layers kept at once: the current set plus those still fading out. */
  maxLayers: 3,
  /** Outline of the field over everything: ink line under the colour line, widths in world pixels. */
  outlineInk: 7,
  outlineColor: 4.5,
  /** Tint of the field's own colour inside the outline. */
  outlineFillAlpha: 0.22,
  /** The hull of a block is grown by this many world pixels, to cover its ink outline. */
  hullGrow: 3,
};

/**
 * Obstacles that stand in front of an emplacement and cover it (docs/ART.md, "Stellungen im Gelände"):
 * they are drawn see-through all the time, the emplacement stays solid.
 */
export const OBSTACLE_SEE_THROUGH = {
  /** Opacity of such an obstacle (0 to 1). */
  alpha: 0.45,
  /** It counts as covering when its picture lies over this share of the emplacement's picture. */
  minShare: 0.15,
  /** The share is measured on a grid of this many columns and rows over the emplacement's bounding box. */
  grid: [4, 5],
};

// ---------- Turned weapons on the bunkers (M9 D2) ----------
// Presentation only. The weapons are turnable models (src/render/turrets.js), pre-drawn in
// TURRET_STAGES directions by src/render/turretCache.js and drawn live only while they turn.

/** Directions a resting weapon is pre-drawn in, evenly spread over the circle. */
export const TURRET_STAGES = 16;

/**
 * The weapons are authored small and drawn at 1.5 times, times the scale of the bunker, so that a
 * barrel is wide enough to carry an ink outline.
 */
export const TURRET_SCALE = 1.5 * BUNKER_BASE_SCALE;

/**
 * How fast the drawing of a weapon turns towards its target, radians per second. This is the
 * speed of the picture, not of the weapon: the simulation fires from the middle of the cell and
 * knows no direction. Heavier is slower. The mortar doctrine is drawn as the rocket launcher.
 */
export const TURRET_TURN_SPEED = { autocannon: 5.5, flame: 4, mortar: 2.6, tesla: 5, laser: 4.2, psi: 3.2 };

/** A weapon counts as pointing at its target (and may stand on a stage) within this many radians. */
export const TURRET_ALIGN = 0.14;

/** Direction a weapon without a target stands in at first, radians in cell coordinates (+y: towards the viewer's left). */
export const TURRET_REST_ANGLE = Math.PI / 2;

/**
 * How far the whole weapon shoves back along its barrel when it fires, in cells, at full recoil.
 * A stage is shifted as a whole, nothing is redrawn for it.
 */
export const TURRET_RECOIL = { autocannon: 0.1, flame: 0, mortar: 0, tesla: 0, laser: 0.05, psi: 0 };

/**
 * The muzzle of each weapon in local coordinates: `x` along the barrel in cells from the middle
 * of the roof plate, `z` height above the plate in px (before TURRET_SCALE). The rocket launcher
 * has six mouths, worked out from TURRET_ROCKET.
 */
export const TURRET_MUZZLE = {
  autocannon: { x: 0.45, z: 11 },
  flame: { x: 0.475, z: 14 },
  tesla: { x: 0.38, z: 30 },
  laser: { x: 0.465, z: 22.5 },
  psi: { x: 0.31, z: 28 },
};

/** Most pixel memory the cached stages may take, in bytes; the oldest unused stages make room. */
export const TURRET_CACHE_BYTES = 32 * 1048576;

/** Stages drawn into the cache in one frame at most; a weapon that has to wait is drawn live. */
export const TURRET_BUILDS_PER_FRAME = 4;

/** Where the spent cases of the autocannon leave it: the belly of the housing, local [lx, ly, z]. */
export const TURRET_CASING_PORT = [-0.02, 0.15, 9];

/**
 * The rocket launcher: elevation of the pod, its length in cells, the pitch between two tubes and
 * the spacing between the two rows of a tube pair, and the mouths as [column, row] in the order
 * they fire.
 */
export const TURRET_ROCKET = {
  elevation: (36 * Math.PI) / 180,
  length: 0.42,
  pitch: 0.115,
  row: 0.065,
  mouths: [[-1, 1], [1, -1], [0, 1], [-1, -1], [1, 1], [0, -1]],
};

// ---------- The special emplacements (M9 D4) ----------
// Presentation only, from reference/studien/spezialstellungen-rework-modell.js, which is binding.
// The six weapons of the recipes are turned models like the standard ones; they are keyed by the id of
// the recipe (src/data/recipes.js). The base under them is a sprite per recipe (`specialbase-<id>`).

/** Authored height of the roof platform of the special base in px, before the scale of the base. */
export const SPECIAL_MOUNT_AUTHORED = 52;

/** Height of the roof platform of the special base above the ground in world px: the weapon stands there. */
export const SPECIAL_ROOF_HEIGHT = SPECIAL_MOUNT_AUTHORED * BUNKER_BASE_SCALE;

/**
 * Size of each special weapon relative to TURRET_SCALE. They are chosen so that none of them stands
 * more than a tenth higher than its sprite did before (tests/unit/specials.test.js measures it).
 */
export const SPECIAL_SCALE = {
  purgeShrine: 0.85,
  stormBattery: 1.15,
  emberCauldron: 0.9,
  siegeMortar: 0.95,
  thunderTower: 1.0,
  soulfireObelisk: 1.0,
};

/** Turn speed of the drawing of each special weapon in radians per second (heavier is slower). */
export const SPECIAL_TURN_SPEED = {
  purgeShrine: 1.3,
  stormBattery: 3.6,
  emberCauldron: 2.2,
  siegeMortar: 1.5,
  thunderTower: 3,
  soulfireObelisk: 2.2,
};

/** How fast the recoil of the barrels dies away, per second: the four barrels of the battery, the tube of the mortar. */
export const SPECIAL_BAR_DECAY = 14;
export const SPECIAL_RECOIL_DECAY = 7;

/**
 * The muzzle of each special weapon in local coordinates (as TURRET_MUZZLE): `x` along the barrel in
 * cells, `z` above the plate in px before the scale. The battery has four barrels (`barrels`: sideways
 * offset in cells and height offset in px, two over two, fired in turn) that each slide back by `recoil`
 * cells. The siege mortar is a long tube on a low elevation about `pivot`. The shrine, the thunder tower
 * and the obelisk fire from the middle of a part that floats, which bobs on top of `z`.
 */
export const SPECIAL_MUZZLE = {
  purgeShrine: { z: 17.5 },
  stormBattery: {
    x: 0.56,
    axisZ: 12,
    recoil: 0.045,
    barrels: [[0.085, 3.1], [-0.085, -3.1], [-0.085, 3.1], [0.085, -3.1]],
  },
  emberCauldron: { x: 0.225, z: 31.5 },
  siegeMortar: { elevation: (50 * Math.PI) / 180, length: 0.8, pivot: [0, 0, 20], back: 0.12, recoil: 0.09 },
  thunderTower: { z: 42 },
  soulfireObelisk: { x: 0.06, z: 74 },
};

/** Where the spent cases of the storm battery leave it: the back of the housing, local [lx, ly, z]. */
export const SPECIAL_CASING_PORT = [-0.21, 0, 15];

/** Local points of the fire that belongs to a model: the flames in the cauldron, the foot of the obelisk. */
export const SPECIAL_FIRE = {
  cauldron: [0, 0, 21.5],
  obeliskFeet: [[0.13, 0], [-0.13, 0], [0, 0.13], [0, -0.13]],
  obeliskFootZ: 9,
};

/** Special weapons whose floating part is a layer of its own over a cached stage; the shrine is always drawn live. */
export const SPECIAL_FLOATS = ['thunderTower', 'soulfireObelisk'];
export const SPECIAL_LIVE_ALWAYS = ['purgeShrine'];

// ---------- Muzzle fire and effects at the barrel (M9 D3) ----------
// Presentation only: how long the flashes last, how far a jet reaches, how many particles the
// muzzles may hold. Nothing here is a rule of the game; the shots themselves come from the simulation.

/**
 * How far in front of the muzzle point of the model the fire leaves, in cells along the barrel: the
 * noses of the rockets stand 0.12 out of their tubes, the tip of the tesla horn is 0.05 past its
 * gem. Every other weapon fires from the end of its barrel.
 */
export const FX_TIP_AHEAD = { mortar: 0.12, tesla: 0.05 };

/**
 * Seconds a muzzle flash lasts, by doctrine (the rockets flare twice as long as a gun) and by special
 * emplacement (M9 D4: one flash per barrel of the battery, a long one for the siege mortar).
 */
export const FX_FLASH_SECONDS = {
  autocannon: 0.075,
  mortar: 0.15,
  tesla: 0.075,
  stormBattery: 0.07,
  siegeMortar: 0.154,
  emberCauldron: 0.14,
  thunderTower: 0.07,
};

/** Seconds the laser beam stays, the tesla bolt stays, and a psi pulse takes to run out. */
export const FX_BEAM_SECONDS = 0.22;
export const FX_BOLT_SECONDS = 0.3;
export const FX_PULSE_SECONDS = 0.8;
/** Seconds between two psi pulses while the weapon has something in reach. */
export const FX_PULSE_EVERY = 1.1;
/** The laser lens charges over the last seconds of its reload, when it has a target. */
export const FX_LASER_CHARGE_SECONDS = 0.4;

/** Reach of the flame jet in cells, and how fast it swells and dies (per second, eased). */
export const FX_JET_LENGTH = 1.9;
export const FX_JET_RATE = 8;

/** Height above the ground, in px, where a shot hits its target. */
export const FX_HIT_Z = 12;
/** Speed of the tracer of the autocannon in cells per second. */
export const FX_TRACER_SPEED = 16;
/** Fall of cases and sparks in px per second squared. */
export const FX_GRAVITY = 620;
/** Most particles all muzzles together may have alive; the rest of the effects keep their share. */
export const FX_MAX_PARTICLES = 200;
/** Most particles one frame may queue per emplacement (nobody drains the queue without effects). */
export const FX_QUEUE = 24;

/**
 * The flight of a rocket: it climbs this many px over the straight line, its first leg runs this share
 * of the way along the barrel, and it ends this many px above the ground. The flight time and the
 * end point are those of the shell of the simulation.
 */
export const FX_ROCKET = { lift: 28, reach: 0.42, endZ: 12, trail: 0.025, tail: 10 };

// ---------- Fire of the special emplacements (M9 D4) ----------

/**
 * Seconds the bolt of the cauldron and the chain of the thunder tower stay, the soul beam of the
 * obelisk stays, and the eye of the obelisk charges over the end of its reload when it has a target.
 */
export const FX_SPECIAL_BOLT_SECONDS = { emberCauldron: 0.32, thunderTower: 0.34 };
export const FX_OBELISK_BEAM_SECONDS = 0.26;
export const FX_OBELISK_CHARGE_SECONDS = 0.4;

/** The scope of the siege mortar throws its red line over the last seconds of the reload. */
export const FX_SIGHT_SECONDS = 0.8;

/** The tracer of the storm battery: speed in cells per second (it fires a lot faster than the autocannon). */
export const FX_STORM_TRACER_SPEED = 18;

/**
 * The shell of the siege mortar: it climbs `lift` px over the straight line plus `perCell` px for every cell
 * of the way, ending `endZ` px above the ground. Flight time and end point are those of the shell of the
 * simulation.
 */
export const FX_SHELL = { lift: 90, perCell: 22, endZ: 0 };

/** Slowest and brightest pulse of the gold aura of the shrine on the ground, and how fast it rises and falls. */
export const FX_AURA_IDLE = 0.35;
export const FX_AURA_RATE = 3;

// ---------- Weapon effects, step 1 (issue 86, study round 2 of issue 81) ----------
// Presentation only. Ground light, the ball flame with its afterburn, and the three kinds of lightning.
// Every size is a screen px at zoom 1 or a cell count; every time is seconds.

/**
 * Ground light by emplacement kind: radius in cells, colour, peak alpha on the ground and seconds to fade
 * after its last kick; `hit` is the light where a shot lands, `idle` one that stays while the emplacement
 * stands. `over` is the share drawn again over the figures. Mixing is the normal one (no composite mode).
 */
export const FX_LIGHT = {
  stormBattery: { r: 2.2, colour: '#9fdcff', a: 0.55, fade: 0.18, hit: { r: 0.8, a: 0.22, fade: 0.1 } },
  emberCauldron: { r: 2.4, colour: '#ff8a2a', a: 0.32, fade: 0.35, idle: { r: 1.4, a: 0.1 }, hit: { r: 0.9, a: 0.26, fade: 0.5 } },
  siegeMortar: { r: 2.6, colour: '#ffb02e', a: 0.38, fade: 0.4, hit: { r: 2.6, a: 0.5, fade: 0.6 } },
  thunderTower: { r: 3.0, colour: '#cfd8ff', a: 0.45, fade: 0.3, idle: { r: 1.2, a: 0.07 }, hit: { r: 1.3, a: 0.35, fade: 0.3 } },
  soulfireObelisk: { r: 2.2, colour: '#b784ff', a: 0.3, fade: 0.3, hit: { r: 1.0, a: 0.28, fade: 0.3 } },
  purgeShrine: { r: 2.8, colour: '#ffd36a', a: 0.16, fade: 0.5, idle: { r: 2.8, a: 0.06 } },
  /** Share of the ground light drawn again over the figures, and how many px it is lifted and shrunk. */
  over: { share: 0.35, lift: 10, shrink: 0.8 },
  /** Most lights at once (kicked ones and idle ones together); a kicked light pushes out the oldest. */
  max: 24,
  /** At most this many targets of one volley get a light of their own. */
  hitsPerShot: 3,
};

/**
 * The flame jet as rolling fireballs, in a straight line from the nozzle to the target: `rate` balls a
 * second, `life` s each, radius `r[0]` to `r[1]` px, at most `max` of one emplacement; `lick` is the
 * size of the tongue standing on a ball, `spread` the angle (rad) the balls scatter in.
 */
export const FX_BALLS = { rate: 26, life: 0.42, r: [3, 13], max: 16, lick: 0.5, spread: 0.16, lengthJitter: [0.85, 1.05] };

/**
 * The afterburn: every `every` s a patch lies near the tip of the jet, `life` s each. At most `max` of
 * one emplacement and `total` of all together. Below `flameZoom` only soot and glow are drawn.
 */
export const FX_BURN = { every: 0.12, life: 1.4, max: 6, total: 24, flames: 3, scorch: 9, glow: 14, flameZoom: 0.55, reach: [0.6, 1.0], side: 0.45 };

/** Tesla: a cold angular double strike. Ink, colour and core widths, kinks, and the dark gap between strikes. */
export const FX_TESLA = { ink: 2.6, colour: 1.4, core: 0.6, steps: 7, jitter: 13, gap: [0.05, 0.08], colours: ['#bff2ff', '#5fd4ff'] };

/** Ember cauldron: three fine sinuous threads per target that crawl there over `crawl` s. */
export const FX_EMBER = { strands: 3, ink: 1.5, colour: 0.9, core: 0.4, wave: 5, crawl: 0.08, colours: ['#ff5a1f', '#ffb13b', '#fff0b0'] };

/**
 * Thunder tower: a strike from `sky` px above the first target, then a cascade of `delay` s per hop; a
 * pressure ring on the ground at every hit. The picture brightens at most once every `flash.every` s
 * (alpha `flash.alpha` for `flash.seconds`), with reduced motion at most `flash.reduced`.
 */
export const FX_THUNDER = {
  sky: 240, ink: 5.5, colour: 3.2, core: 1.4, aura: [{ width: 20, alpha: 0.14 }, { width: 9, alpha: 0.26 }],
  hop: { ink: 3, colour: 1.7, core: 0.7 }, delay: 0.035,
  ring: { first: 1.6, other: 1.0, seconds: 0.3, width: 3, max: 12 },
  flash: { alpha: 0.16, seconds: 0.12, every: 1, reduced: 0.05 },
  colours: ['#ece8ff', '#8f9cff'],
};

// ---------- Choosing a capsule (issue 50) ----------

/** Opacity of the capsules, their light columns and plates that are not picked, while one is picked. */
export const POD_DIM_ALPHA = 0.5;

/**
 * The plate above an opened capsule. Heights are px above the foot of the capsule (the closed
 * shell is about 67 px high), scales multiply the plate of the study (HOLO_SCALE in
 * src/render/pods.js). A resting plate is narrower than the 32 px that separate two touching
 * cells on a diagonal, so none of them overlaps another; the picked plate is larger, higher and
 * carries the label.
 */
export const POD_PLATE = { restHeight: 84, restScale: 0.85, pickedHeight: 108, pickedScale: 1.35 };

// ---------- The trail (issue 60) ----------

/**
 * Look of the trail the enemies leave (src/render/trail.js). Widths are in cells, one per layer
 * from the widest to the narrowest; `alphas` multiply the wear. `rag` is the raggedness of the
 * edges as a fraction of the layer width, `shift` the sideways shift of a layer against the route
 * line (at most half of it either way), `edge` the dark hem outside every layer. `sample` is the
 * spacing of the points the pieces are cut at, in cells. A point carries a footprint when its roll
 * is under `base + gain * wear - cut * layer`; single points are dropped, so what is left are
 * short, frayed stretches whose density grows with the wear. The trail never crosses a step.
 */
export const TRAIL = {
  widths: [0.26, 0.2, 0.13],
  alphas: [0.7, 0.7, 0.7],
  rag: 0.35,
  shift: 0.04,
  edge: { width: 0.035, alpha: 0.45 },
  sample: 0.25,
  presence: { base: 0.3, gain: 0.6, cut: 0.12 },
};

/**
 * The Koloss as a swarm beast, the "Grabwalze" (docs/ART.md, "Koloss"; study
 * reference/studien/koloss-schwarm.html, decision E-43). All lengths in cells along the
 * model's own axes (lx forward, ly sideways), heights in px. Presentation only: the
 * simulation knows the Koloss as a point and the swathe as one cell wide.
 */
export const KOLOSS_MODEL = {
  /** Colours of the brood, as in the enemy sprites (reference/konzept/gegner/). */
  colours: {
    chitinD: '#3e3026',
    chitin: '#5f4a38',
    boneD: '#b9a882',
    bone: '#d8c9a8',
    eye: '#ff6a2a',
    hitWhite: [255, 246, 228],
  },
  /**
   * The five shell segments from the skull back: middle `cx`, half width `hw`, height `h`
   * and half length `hl`. Wider and taller in the middle, so the plates lie over each other.
   */
  segments: [
    { cx: 0.6, hw: 0.7, h: 44, hl: 0.3 },
    { cx: 0.04, hw: 0.68, h: 50, hl: 0.3 },
    { cx: -0.5, hw: 0.62, h: 46, hl: 0.29 },
    { cx: -1.02, hw: 0.52, h: 38, hl: 0.27 },
    { cx: -1.48, hw: 0.4, h: 29, hl: 0.24 },
  ],
  /** Shape of a shell: foot height, how flat its crown is (0 pointed, 1 flat), taper front to back. */
  shell: { foot: 4, crown: 0.38, taperFront: 1.04, taperBack: 0.92 },
  /** The bone rim at the front edge of a shell: how far it reaches in front of and behind the edge. */
  rim: { back: 0.02, front: 0.07, widen: 1.08, widenBack: 1.07 },
  /** The plough: side profile (lx, z) and the profile of its edge in the middle; half width. */
  plough: {
    side: [[0.96, 2], [1.62, 0], [1.54, 12], [1.22, 32], [0.96, 38]],
    edge: [[0.96, 2], [1.94, 0], [1.84, 14], [1.36, 38], [0.96, 44]],
    halfWidth: 0.76,
  },
  /** The head capsule behind the plough: half width, height, foot, from lx to lx. */
  head: { hw: 0.5, h: 44, foot: 18, from: 0.82, to: 1.18, taper: 0.82 },
  /** Eyes on the head capsule: ly offsets, lx, height, radius, peak. */
  eyes: { ly: [-0.24, 0.24], lx: 1.14, z: 42, r: 0.07, up: 5 },
  /** Spine along the back: how far it lies back, how tall it stands (shrinks by `shrink` per segment). */
  spine: { lean: 0.28, height: 26, shrink: 3, r0: 0.08, r1: 0.012 },
  /** Side spines on the first `count` segments. */
  sideSpine: { count: 3, out: 0.26, lean: 0.16, rise: 12, r0: 0.05, r1: 0.01 },
  /** The tail tip behind the last segment: from, to, radii. */
  tail: { from: [-1.66, 0, 16], to: [-2.0, 0, 10], r0: 0.22, r1: 0.05 },
  /** Short legs, one pair under each segment, in a wave from the skull back. */
  legs: { width: 3.8, hipZ: 10, kneeZ: 19, kneeOut: 0.22, footOut: 0.44, stride: 0.15, lift: 7, wave: 0.18, footAhead: 0.06 },
  /** Walking: cells per gait cycle, seconds per cycle while turning on the spot. */
  gait: { cellsPerCycle: 0.55, turnCycleSeconds: 0.9 },
  /**
   * Turning on the spot: the skull leads, each segment reaches the new heading a little later.
   * `spread` stretches the quarter turn over the segments, `lag` is the delay per segment.
   */
  turn: { spread: 1.7, lag: 0.12 },
  /** Breathing: height change in px and its speed. Still under reduced motion. */
  breath: { amplitude: 1.2, speed: 2.2 },
  /** Mandibles beside the plough: calm and while breaking through (closing speed, 1/s). */
  mandible: { calm: 1.6, breach: 9, base: 0.3, swing: 0.3 },
  /** How fast the breaking-through state fades after the swathe is done, per second. */
  breachFade: 1.5,
  /** Footprint for the cast shadow: skull tip, the half widths follow the segments, tail. */
  shadow: { tip: [1.9, 0.7], tail: [-2.0, 0.15], pad: 0.08, height: 40 },
  /** Health bar above the model: width in screen px, height above the ground in px. */
  bar: { width: 90, z: 104 },
};

/**
 * What a single airstrike can take off the Koloss at most, as a share of full health.
 * The mark on the bar shows it, so the player sees what one run is worth before spending
 * the points (docs/ART.md).
 */
export const KOLOSS_AIRSTRIKE_MARK = 0.7;

/** Rubble the Koloss pushes aside: how fast the pieces of the swathe fly to both sides (screen px per second). */
export const KOLOSS_DEBRIS_SIDE_SPEED = 150;
