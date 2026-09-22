// Debug-only simulation tools. Never used by normal play.

import { ENEMIES } from '../data/enemies.js';
import { groundPolyline, flyerPolyline, positionAt } from './route.js';
import { spawnEnemy } from './enemies.js';

/**
 * Stress test: `count` mixed enemies loop along the current route forever without
 * costing lives, so rendering can be measured. Only during planning.
 */
export function startStress(state, count) {
  if (state.phase !== 'planning' || !state.route || state.stress) return false;
  state.stress = true;
  state.waveRoutes = { ground: groundPolyline(state.route), flyer: flyerPolyline(state.map) };
  const types = Object.keys(ENEMIES);
  for (let i = 0; i < count; i++) {
    const e = spawnEnemy(state, types[i % types.length]);
    const line = e.flying ? state.waveRoutes.flyer : state.waveRoutes.ground;
    // Spread evenly along the route, starting past the fade-in at the rift.
    e.d = 0.5 + ((i + 0.5) / count) * (line.length - 1);
    positionAt(line, e.d, e);
  }
  return true;
}

export function stopStress(state) {
  if (!state.stress) return;
  state.stress = false;
  state.enemies.length = 0;
  state.waveRoutes = null;
}

/** Moves stress-test enemies and wraps them back to the rift at the end. */
export function updateStress(state, dt) {
  const { ground, flyer } = state.waveRoutes;
  for (const e of state.enemies) {
    const line = e.flying ? flyer : ground;
    e.d += e.speed * dt;
    if (e.d >= line.length) e.d = 0.5;
    positionAt(line, e.d, e);
  }
}
