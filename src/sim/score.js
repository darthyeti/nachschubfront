// Score (GDD section 12): the wave reached, every kill and every life left.
// Saving the best runs comes with the storage layer in M5.

import { RULES, RULESET_VERSION } from '../data/rules.js';

export function score(state) {
  return state.wave * RULES.scorePerWave + state.kills * RULES.scorePerKill + state.lives * RULES.scorePerLife;
}

/**
 * A result as it goes to storage in M5. The ruleset version travels with it:
 * the same seed plays a different match before and after M4b, so a score is
 * only ever comparable to one from the same version.
 */
export function scoreEntry(state) {
  return {
    ruleset: RULESET_VERSION,
    seed: state.seed,
    wave: state.wave,
    kills: state.kills,
    lives: state.lives,
    score: score(state),
  };
}
