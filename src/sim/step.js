// One fixed simulation step. Knows nothing about canvas or DOM.

import { RULES } from '../data/rules.js';
import { setPhase } from '../core/phases.js';
import { updateSpawns, waveCleared, totalWaves } from './waves.js';
import { updatePods, salvoDone } from './pods.js';
import { updateEnemies, removeDead } from './enemies.js';
import { updateCombat } from './combat.js';
import { updateShields, updateFlashes } from './damage.js';
import { updateStress } from './debug.js';

export function stepSimulation(state, dt) {
  state.tick += 1;
  state.time += dt;
  state.phaseTime += dt;

  if (state.stress) {
    updateStress(state, dt);
    return;
  }

  if (state.phase === 'salvo') {
    updatePods(state, dt);
    // The selection waits for the player; the wave starts with their choice.
    if (salvoDone(state)) setPhase(state, 'selection');
  } else if (state.phase === 'wave') {
    updateSpawns(state);
    updateEnemies(state, dt);
    updateCombat(state, dt);
    updateShields(state, dt);
    updateFlashes(state, dt);
    removeDead(state);
    if (state.lives <= 0) {
      setPhase(state, 'defeat');
    } else if (waveCleared(state)) {
      state.events.push({ type: 'waveCleared', wave: state.wave, leaked: state.waveStats.leaked });
      setPhase(state, 'evaluation');
    }
  } else if (state.phase === 'evaluation' && state.phaseTime >= RULES.evaluationSeconds) {
    setPhase(state, state.wave >= totalWaves() ? 'victory' : 'planning');
  }
}
