// Game state as plain data. Systems in sim/ mutate it, render/ only reads it.

import { RULES } from '../data/rules.js';
import { MIN_SUPPLY_LEVEL } from '../data/supply.js';
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

    /** Supply level (GDD section 7); raised with requisition from M3 on. */
    supplyLevel: MIN_SUPPLY_LEVEL,
    /** Landing zones marked during planning, at most PODS.perSalvo. */
    zones: [],
    /** Route as it will be once the marked zones are built; null without zones. */
    zonePreview: null,
    /** Pods of the running salvo; empty outside salvo and selection. */
    pods: [],
    /** Towers on the map. Each one blocks its cell. */
    towers: [],
    nextTowerId: 1,

    enemies: [],
    nextEnemyId: 1,
    /** Pending spawns of the running wave, sorted by time. */
    spawns: [],
    /** Routes frozen at wave start: { ground, flyer } polylines. */
    waveRoutes: null,
    /** Health factor of the running wave (data/waves.js). */
    waveScale: 1,
    /** Stats of the running or last wave. */
    waveStats: { spawned: 0, leaked: 0, killed: 0 },

    /** Simulation steps executed so far. */
    tick: 0,
    /** Simulated seconds (scaled by game speed). */
    time: 0,

    /** Debug stress test running (enemies loop, no lives lost). */
    stress: false,
    /** Ids of the towers the stress test added, removed again when it stops. */
    stressTowers: [],

    /** Events for UI and effects, drained once per frame by main.js. */
    events: [],
  };
}
