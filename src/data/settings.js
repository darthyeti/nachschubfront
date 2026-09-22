// Technical engine settings (not balancing values).

/** Fixed simulation time step in seconds. */
export const SIM_STEP = 1 / 60;

/**
 * Upper bound for simulation steps per rendered frame. Protects against a
 * spiral of death after a stall or when returning from a background tab.
 * 3x speed needs 3 steps per 60 Hz frame, so this leaves plenty of headroom.
 */
export const MAX_STEPS_PER_FRAME = 12;

/** Real frame time is clamped to this before being fed to the simulation (seconds). */
export const MAX_FRAME_TIME = 0.25;

/** Available game speeds; 0 is pause. */
export const GAME_SPEEDS = [0, 1, 2, 3];

/** devicePixelRatio cap for the canvas backing store. */
export const MAX_DPR = 2;

/** Camera limits. A cell is 64 world pixels wide, so zoom 0.625 means 40 CSS px per cell. */
export const CAMERA = {
  minZoom: 0.3,
  maxZoom: 2.5,
  /** Start view keeps cells at least this wide (GDD section 13). */
  minCellPx: 40,
  /** Space kept free for HUD bars in the start view (CSS pixels). */
  insets: { top: 64, bottom: 84, side: 16 },
  /** Zoom factor per mouse wheel notch and per +/- key press. */
  wheelZoomStep: 1.15,
  /** Pan speed for arrow keys in CSS pixels per second. */
  keyPanSpeed: 700,
};

/** Pointer input thresholds. */
export const POINTER = {
  /** Movement (CSS px) that turns a press into a drag instead of a tap. */
  dragThreshold: 8,
  /** Hold time (ms) that counts as a long press. */
  longPressMs: 500,
};
