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
