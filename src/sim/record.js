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

/** Format of the protocol document. Raise when the shape changes. */
export const PROTOCOL_VERSION = 1;

/**
 * Starts recording on a state. Without this the record functions do nothing, so
 * tests and the replay itself run without a log.
 * @param {object} state
 * @param {number} ruleset  RULESET_VERSION the match is played under.
 */
export function startLog(state, ruleset) {
  state.log = {
    version: PROTOCOL_VERSION,
    seed: state.seed,
    ruleset,
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
  log.actions.push({ t: state.tick, w: state.wave, p: state.phase, a: action, ...(data ?? {}) });
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
  const { spawned, killed, leaked } = state.waveStats;
  log.waves.push({
    w: state.wave,
    spawned,
    killed,
    leaked,
    lives: state.lives,
    requisition: state.requisition,
    commandPoints: state.commandPoints,
    towers: state.towers.length,
    supply: state.supplyLevel,
    /** Length of the route the wave actually ran, rounded to one decimal. */
    route: state.waveRoutes ? Math.round(state.waveRoutes.ground.length * 10) / 10 : 0,
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

/**
 * True when the protocol is worth measuring: nothing debug touched it, and it
 * holds at least one wave.
 */
export function isMeasurable(log) {
  return Boolean(log) && log.tainted.length === 0 && log.waves.length > 0;
}
