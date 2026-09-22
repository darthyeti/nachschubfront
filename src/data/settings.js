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
