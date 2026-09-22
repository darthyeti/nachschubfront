// Score (GDD section 12): the wave reached, every kill and every life left.
// Saving the best runs comes with the storage layer in M5.

import { RULES } from '../data/rules.js';

export function score(state) {
  return state.wave * RULES.scorePerWave + state.kills * RULES.scorePerKill + state.lives * RULES.scorePerLife;
}
