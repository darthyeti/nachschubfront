// Game state as plain data. Systems in sim/ mutate it, render/ only reads it.

import { RULES } from '../data/rules.js';
import { createRng } from './random.js';
import { generateMap } from '../sim/mapgen.js';
import { computeRoute } from '../sim/route.js';

/**
 * @param {string} seed  Shown to the player; the same seed gives the same map.
 */
export function createGameState(seed) {
  const rng = createRng(seed);
  const map = generateMap(rng.fork('map'));
  return {
    seed,
    map,
    /** Current ground route (planning preview). Recomputed when the maze changes. */
    route: computeRoute(map),
    /** Increments on every maze change so caches know when to rebuild. */
    mapVersion: 0,

    phase: 'planning',
    /** Seconds spent in the current phase (simulation time). */
    phaseTime: 0,
    /** Current or last started wave, 1-based; 0 before the first wave. */
    wave: 0,
    lives: RULES.startLives,
    /** Game speed multiplier, one of GAME_SPEEDS. */
    speed: 1,

    enemies: [],
    nextEnemyId: 1,
    /** Pending spawns of the running wave, sorted by time. */
    spawns: [],
    /** Routes frozen at wave start: { ground, flyer } polylines. */
    waveRoutes: null,
    /** Stats of the running or last wave. */
    waveStats: { spawned: 0, leaked: 0 },

    /** Simulation steps executed so far. */
    tick: 0,
    /** Simulated seconds (scaled by game speed). */
    time: 0,

    /** Debug stress test running (enemies loop, no lives lost). */
    stress: false,

    /** Events for UI and effects, drained once per frame by main.js. */
    events: [],
  };
}
