// Round phases (GDD section 3): planning -> salvo -> selection -> wave -> evaluation -> planning.
// End states: defeat, victory.

import { standDown } from '../sim/combat.js';

export const PHASES = ['planning', 'salvo', 'selection', 'wave', 'evaluation', 'defeat', 'victory'];

/** Allowed transitions. Anything else is a programming error. */
const NEXT = {
  planning: ['salvo'],
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
  // may still be drawn as shooting. One place for every way out of a wave.
  if (state.phase === 'wave') standDown(state);
  state.phase = to;
  state.phaseTime = 0;
  state.events.push({ type: 'phase', phase: to });
}

export const isOver = (state) => state.phase === 'defeat' || state.phase === 'victory';

/**
 * The stretch in which the player is still laying out the map: the route
 * preview, the landing zones and the marks on cleared ground are all up.
 */
export const PLANNING_PHASES = new Set(['planning', 'salvo', 'selection']);
