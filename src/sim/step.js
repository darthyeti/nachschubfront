// One fixed simulation step. Knows nothing about canvas or DOM.

import { RULES } from '../data/rules.js';
import { setPhase, PASS_THROUGH } from '../core/phases.js';
import { beginWave, updateSpawns, waveCleared, totalWaves } from './waves.js';
import { updateEnemies } from './enemies.js';

export function stepSimulation(state, dt) {
  state.tick += 1;
  state.time += dt;
  state.phaseTime += dt;

  // Placeholder phases pass straight through until they get content.
  while (PASS_THROUGH.has(state.phase)) {
    if (state.phase === 'salvo') setPhase(state, 'selection');
    else if (state.phase === 'selection') {
      setPhase(state, 'wave');
      beginWave(state);
    }
  }

  if (state.phase === 'wave') {
    updateSpawns(state);
    updateEnemies(state, dt);
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
