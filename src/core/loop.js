// Fixed-timestep driver. Pure logic without DOM access, so it runs in node tests.

/**
 * @param {object} options
 * @param {number} options.step          Simulation step in seconds.
 * @param {number} options.maxSteps      Maximum steps per advance() call.
 * @param {number} options.maxFrameTime  Real frame time is clamped to this (seconds).
 */
export function createFixedStepper({ step, maxSteps, maxFrameTime }) {
  let accumulator = 0;

  return {
    /**
     * Feeds real elapsed time and runs as many fixed steps as are due.
     * @param {number} realDt  Real seconds since the last frame.
     * @param {number} speed   Game speed multiplier (0 = paused).
     * @param {(dt: number) => void} onStep
     * @returns {number} Number of steps executed.
     */
    advance(realDt, speed, onStep) {
      if (!(realDt > 0) || !(speed > 0)) return 0;
      accumulator += Math.min(realDt, maxFrameTime) * speed;

      let steps = 0;
      // The small epsilon keeps float drift from swallowing a due step
      // (e.g. 1/60 + 1/60 + 1/60 < 3/60 in floating point).
      while (accumulator + 1e-9 >= step && steps < maxSteps) {
        onStep(step);
        accumulator -= step;
        steps++;
      }
      if (steps === maxSteps && accumulator >= step) {
        // Too far behind: drop the backlog instead of catching up over many frames.
        accumulator = 0;
      }
      if (accumulator < 0) accumulator = 0;
      return steps;
    },

    /** Fraction of a step that is pending, in [0, 1). Useful for render interpolation. */
    get alpha() {
      return accumulator / step;
    },

    reset() {
      accumulator = 0;
    },
  };
}
