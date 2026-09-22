// Game state as plain data. Systems in sim/ mutate it, render/ only reads it.

export function createGameState() {
  return {
    /** Simulation steps executed so far. */
    tick: 0,
    /** Simulated seconds (scaled by game speed). */
    time: 0,
    /** Current game speed multiplier, one of GAME_SPEEDS. */
    speed: 1,
  };
}
