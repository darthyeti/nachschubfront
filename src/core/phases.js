// Round phases (GDD section 3): planning -> salvo -> selection -> wave -> evaluation -> planning.
// End states: defeat, victory.

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
  state.phase = to;
  state.phaseTime = 0;
  state.events.push({ type: 'phase', phase: to });
}

export const isOver = (state) => state.phase === 'defeat' || state.phase === 'victory';
