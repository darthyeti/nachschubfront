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
