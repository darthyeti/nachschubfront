// Round phases (GDD section 3): planning -> salvo -> selection -> wave -> evaluation -> planning.
// In a mode with the upgrade instead of a salvo (M7b, B5) planning may go straight to the wave.
// End states: defeat, victory.

import { standDown } from '../sim/combat.js';
import { recordWave, recordEnd } from '../sim/record.js';
import { updateKoloss } from '../sim/koloss.js';

export const PHASES = ['planning', 'salvo', 'selection', 'wave', 'evaluation', 'defeat', 'victory'];

/** Allowed transitions. Anything else is a programming error. */
const NEXT = {
  planning: ['salvo', 'wave'],
  salvo: ['selection'],
  selection: ['wave'],
  wave: ['evaluation', 'defeat'],
  evaluation: ['planning', 'victory'],
  defeat: [],
  victory: [],
};

export function canTransition(from, to) {
  return NEXT[from]?.includes(to) ?? false;
}

export function setPhase(state, to) {
  if (!canTransition(state.phase, to)) {
    throw new Error(`Invalid phase transition ${state.phase} -> ${to}`);
  }
  // Leaving the wave, however it ends: nothing is shooting any more, so nothing
  // may still be drawn as shooting. One place for every way out of a wave — and
  // therefore also the one place the protocol notes how the wave went (M6).
  if (state.phase === 'wave') {
    standDown(state);
    recordWave(state);
  }
  // Leaving the planning, however it ends: the Koloss lane is fixed against the
  // maze as the player left it. The per-step update alone would make it depend
  // on whether a step ran after the last change — a replay applies a whole
  // planning without one, and in King of the Hill the rift itself changes at
  // the start of the planning.
  if (state.phase === 'planning') updateKoloss(state);
  state.phase = to;
  state.phaseTime = 0;
  if (to === 'defeat' || to === 'victory') recordEnd(state, to);
  state.events.push({ type: 'phase', phase: to });
}

export const isOver = (state) => state.phase === 'defeat' || state.phase === 'victory';

/**
 * The stretch in which the player is still laying out the map: the route
 * preview, the landing zones and the marks on cleared ground are all up.
 */
export const PLANNING_PHASES = new Set(['planning', 'salvo', 'selection']);
