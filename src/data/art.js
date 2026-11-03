// Numbers of the presentation (no game rule, nothing the simulation reads).

/** Terrain in front of a selected field, a placement spot or a capsule target (reveal, issue 35). */
export const REVEAL = {
  /** Opacity of the covering blocks while the field behind them is being looked at (0 to 1). */
  blockAlpha: 0.38,
  /** Fade in and out, in milliseconds. With reduced motion it switches at once. */
  fadeMs: 150,
  /** Most layers kept at once: the current set plus those still fading out. */
  maxLayers: 3,
  /** Outline of the field over everything: ink line under the colour line, widths in world pixels. */
  outlineInk: 5,
  outlineColor: 3,
  /** The hull of a block is grown by this many world pixels, to cover its ink outline. */
  hullGrow: 3,
};
