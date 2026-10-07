// A recording of everything the player did in a match (M6, part 1).
//
// The point of it: balancing needs real decisions. A bot that places zones by a
// rule measures something else than a person laying out a maze, so the numbers
// that count come from matches somebody actually played. A protocol plus the
// seed is enough to play the whole match again without graphics, and to play it
// again with different data values (`npm run replay`, part 1 step 2).
//
// Three rules hold this together:
//
// 1. **Recorded where the action happens**, in sim/, not in the UI. A match
//    played with a mouse, with a finger or by a bot records the same way.
// 2. **Only what was accepted.** A refused zone or a demolition nobody could
//    afford changes nothing, so it is not in the log.
// 3. **The log is an observation.** It hangs off the state, but no simulation
//    step reads from it. Nothing here calls the clock either — the storage layer
//    stamps the document when it saves it, so the simulation stays free of
//    wall-clock time and can be replayed step by step.

import { MODES, DIFFICULTIES } from '../data/modes.js';

/**
 * Format of the protocol document. Raise when the shape changes.
 * 2 (M7a): the run configuration, `mode`, `modeRev` and `difficulty`.
 */
export const PROTOCOL_VERSION = 2;

/** What a protocol from before version 2 was played as: there was only this. */
export const LEGACY_CONFIG = Object.freeze({ mode: 'standard', modeRev: 1, difficulty: 'normal' });

/**
 * The run configuration a protocol was recorded under, with the fields a
 * version-1 protocol lacks filled in.
 */
export function protocolConfig(log) {
  return {
    mode: typeof log?.mode === 'string' ? log.mode : LEGACY_CONFIG.mode,
    modeRev: Number.isInteger(log?.modeRev) ? log.modeRev : LEGACY_CONFIG.modeRev,
    difficulty: typeof log?.difficulty === 'string' ? log.difficulty : LEGACY_CONFIG.difficulty,
  };
}

/**
 * True if this build knows the mode and the difficulty the match was played in.
 * A protocol from a build with more modes is kept, but cannot be replayed here.
 */
export function playableHere(log) {
  const { mode, difficulty } = protocolConfig(log);
  return Object.hasOwn(MODES, mode) && Object.hasOwn(DIFFICULTIES, difficulty);
}

/**
 * Starts recording on a state. Without this the record functions do nothing, so
 * tests and the replay itself run without a log.
 * @param {object} state
 * @param {number} ruleset  RULESET_VERSION the match is played under.
 * @param {string|number} id  Tells two matches on the same seed apart, so saving
 *   the same one again replaces it instead of piling up. Handed in rather than
 *   made here, because nothing in this module asks the clock.
 */
export function startLog(state, ruleset, id = 0) {
  state.log = {
    version: PROTOCOL_VERSION,
    id,
    seed: state.seed,
    ruleset,
    /** Run configuration (src/data/modes.js); the replay builds the state with it. */
    mode: state.mode?.id ?? LEGACY_CONFIG.mode,
    modeRev: state.mode?.rev ?? LEGACY_CONFIG.modeRev,
    difficulty: state.difficulty ?? LEGACY_CONFIG.difficulty,
    /** Supply level the match started on; debug can raise it before wave 1. */
    supplyStart: state.supplyLevel,
    /** Debug levers pulled in this match. A tainted match is not a measurement. */
    tainted: [],
    actions: [],
    waves: [],
    end: null,
  };
  return state.log;
}

/**
 * Notes a player action. `data` carries whatever the replay needs to repeat it.
 * The tick is what makes the replay exact: actions arrive between simulation
 * steps, and the game speed only changes how many steps fit into one frame.
 */
export function record(state, action, data = null) {
  const log = state.log;
  if (!log) return;
  log.actions.push({
    /**
     * Simulation step: the order, and in the planning phases the moment the
     * replay waits for, so every wave starts on the same step as in the match.
     */
    t: state.tick,
    /**
     * Which round and which phase it belongs to. This, not the step, is what
     * the replay anchors to: under changed numbers a wave takes longer or
     * shorter, and an action tied to a step alone would land in the wrong phase
     * and be lost — with it, the same decision is made at the same point of the
     * same round, whatever the numbers do to the clock.
     */
    w: state.wave,
    p: state.phase,
    /**
     * Seconds into the phase. It matters inside a wave, where a command at the
     * eighth second is a different decision from one at the twentieth, and it
     * stays right when changed numbers move the start of the wave.
     */
    pt: Math.round(state.phaseTime * 100) / 100,
    a: action,
    ...(data ?? {}),
  });
}

/**
 * Notes that a debug lever was pulled. The match stays readable — a protocol is
 * still worth having — but nothing derived from it is a measurement, and the
 * replay says so instead of quietly reporting a mismatch.
 */
export function taint(state, lever) {
  const log = state.log;
  if (!log) return;
  if (!log.tainted.includes(lever)) log.tainted.push(lever);
}

/**
 * Notes how a wave went, at the one place every wave ends (core/phases.js).
 * This is what the replay compares itself against: same protocol, same data,
 * same lives after every wave.
 */
export function recordWave(state) {
  const log = state.log;
  if (!log) return;
  const { spawned, killed, leaked, health, damage, commandDamage, overkill } = state.waveStats;
  log.waves.push({
    w: state.wave,
    spawned,
    killed,
    leaked,
    lives: state.lives,
    requisition: state.requisition,
    commandPoints: state.commandPoints,
    towers: state.towers.length,
    /**
     * How many emplacements of each rank were standing, recruit to legend, and
     * how many special emplacements beside them — a special has no rank
     * (sim/towers.js), so counting it in one of the five would lose it.
     */
    byRank: byRank(state),
    specials: state.towers.filter((tower) => tower.special).length,
    supply: state.supplyLevel,
    /** Length of the route the wave actually ran, rounded to one decimal. */
    route: state.waveRoutes ? Math.round(state.waveRoutes.ground.length * 10) / 10 : 0,
    /**
     * What the wave brought and what was spent on it: total health plus shields,
     * the damage the emplacements landed, what the commands landed, and the
     * damage thrown at enemies that were already dead. Rounded — a balancing
     * run reads these, and the fraction behind the comma says nothing.
     */
    health: Math.round(health),
    damage: Math.round(damage),
    commandDamage: Math.round(commandDamage),
    overkill: Math.round(overkill),
    /** Set later by the player, from the line of three buttons after the wave. */
    rating: null,
  });
}

/** Attaches the player's verdict to a wave already recorded. */
export function recordRating(state, wave, rating) {
  const log = state.log;
  if (!log) return false;
  const line = log.waves.find((w) => w.w === wave);
  if (!line) return false;
  line.rating = rating;
  return true;
}

/** Notes how the match ended, at the transition into defeat or victory. */
export function recordEnd(state, phase) {
  const log = state.log;
  if (!log) return;
  log.end = { phase, wave: state.wave, lives: state.lives, kills: state.kills };
}

/** Emplacements per rank, recruit to legend. Specials are counted apart. */
function byRank(state) {
  const counts = [0, 0, 0, 0, 0];
  for (const tower of state.towers) {
    if (tower.rank >= 1 && tower.rank <= counts.length) counts[tower.rank - 1] += 1;
  }
  return counts;
}

/**
 * True when the protocol is worth measuring: nothing debug touched it, and it
 * holds at least one wave.
 */
export function isMeasurable(log) {
  return Boolean(log) && log.tainted.length === 0 && log.waves.length > 0;
}
