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

// ---------- Muzzle fire and effects at the barrel (M9 D3) ----------
// Presentation only: how long the flashes last, how far a jet reaches, how many particles the
// muzzles may hold. Nothing here is a rule of the game; the shots themselves come from the simulation.

/**
 * How far in front of the muzzle point of the model the fire leaves, in cells along the barrel: the
 * noses of the rockets stand 0.12 out of their tubes, the tip of the tesla horn is 0.05 past its
 * gem. Every other weapon fires from the end of its barrel.
 */
export const FX_TIP_AHEAD = { mortar: 0.12, tesla: 0.05 };

/** Seconds a muzzle flash lasts, by doctrine (the rockets flare twice as long as a gun). */
export const FX_FLASH_SECONDS = { autocannon: 0.075, mortar: 0.15, tesla: 0.075 };

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
