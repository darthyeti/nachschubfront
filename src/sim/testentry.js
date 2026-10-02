// Starting a match at wave 10, 20, 30 or 35 (M6, part 1, step 4).
//
// Balancing needs the late waves looked at again and again. Playing thirty waves
// to reach the thirty-first is not something anybody does twice, so the order
// asks for a test entry — and for it to need no save format of its own: **a
// protocol plus a wave number is the saved position.** Replaying is what produces
// it, and the replayer was built DOM-free for exactly this (src/sim/replay.js).
//
// Two things this has to get right.
//
// **The match that comes out is not a measurement.** It was not played, it was
// prepared, so the log is tainted the same way a debug lever taints it. The
// balancing tools then leave it alone by themselves (`isMeasurable`), and nothing
// has to remember that this one was special.
//
// **The player lands where decisions are made, and the named wave is still
// ahead of him.** "Ab Welle 35 (Koloss)" is an invitation to fight the Koloss,
// not to arrive after it, so the protocol is replayed to wave 34 and handed over
// in the planning phase that leads into 35. A replay stops the moment a wave is
// over, which is the evaluation phase; the simulation is carried on from there to
// the next planning phase, so the entry is a position and not a half-finished
// animation. The events the replay piled up are dropped with it — thirty waves of
// banners must not arrive at once.

import { replayMatch } from './replay.js';
import { taint, record, protocolConfig, playableHere } from './record.js';
import { stepSimulation } from './step.js';
import { SIM_STEP } from '../data/settings.js';
import { isOver } from '../core/phases.js';

/** The waves the order names: three stretches plus the Koloss. */
export const TEST_WAVES = [10, 20, 30, 35];

/** Room for the evaluation phase to run out; it lasts two seconds (RULES). */
const MAX_HANDOVER_STEPS = 600;

/**
 * Replays a protocol and hands back a state to go on playing from, with `wave`
 * as the next wave to be fought.
 *
 * @param {object} protocol  A recorded match.
 * @param {number} wave  The wave the player is to fight first. Must be at least
 *   2; wave 1 is a new match and needs nothing replayed.
 * @returns {{ok: true, state: object, about: object}
 *   | {ok: false, reason: 'short' | 'over' | 'stuck' | 'first' | 'mode', about: object}}
 */
export function prepareTestEntry(protocol, wave) {
  // Everything before the wave he is to play, and not one round more.
  const before = wave - 1;
  const about = { wave, before, reached: 0, seed: protocol.seed, skipped: 0, stopped: 'not started' };
  if (before < 1) return { ok: false, reason: 'first', about };
  about.mode = protocolConfig(protocol).mode;
  if (!playableHere(protocol)) return { ok: false, reason: 'mode', about };

  const run = replayMatch(protocol, { untilWave: before });
  const state = run.state;
  const reached = run.waves.length;
  Object.assign(about, { reached, skipped: run.skipped.length, stopped: run.stopped });

  // The protocol never got that far. Said plainly rather than handing over an
  // earlier wave under the name of the one that was asked for.
  if (reached < before) return { ok: false, reason: 'short', about };
  // It got there by losing there. There is nothing to go on playing from.
  if (isOver(state)) return { ok: false, reason: 'over', about };

  // From the end of the wave to the point where the player acts.
  let steps = 0;
  while (state.phase !== 'planning' && steps < MAX_HANDOVER_STEPS) {
    stepSimulation(state, SIM_STEP);
    steps += 1;
  }
  if (state.phase !== 'planning') return { ok: false, reason: 'stuck', about };

  // Prepared, not played: the log says so, and every tool reads that by itself.
  taint(state, 'testEntry');
  record(state, 'testEntry', { from: wave });
  if (state.wave !== before) {
    // Would mean the replay ended somewhere else than it reported. Better a
    // refusal than a position that claims to be wave `wave`.
    return { ok: false, reason: 'stuck', about };
  }
  state.events.length = 0;

  return {
    ok: true,
    state,
    about: {
      ...about,
      lives: state.lives,
      towers: state.towers.length,
      requisition: Math.round(state.requisition),
      commandPoints: state.commandPoints,
      supplyLevel: state.supplyLevel,
      route: Math.round((state.route?.length ?? 0) * 10) / 10,
    },
  };
}
