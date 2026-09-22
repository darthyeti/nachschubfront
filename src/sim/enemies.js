// Enemy records and movement along the frozen wave routes.

import { ENEMIES } from '../data/enemies.js';
import { RULES } from '../data/rules.js';
import { positionAt } from './route.js';

export function spawnEnemy(state, type) {
  const def = ENEMIES[type];
  if (!def) throw new Error(`Unknown enemy type: ${type}`);
  const line = def.flying ? state.waveRoutes.flyer : state.waveRoutes.ground;
  const e = {
    id: state.nextEnemyId++,
    type,
    flying: def.flying,
    boss: def.boss ?? false,
    speed: def.speed,
    health: def.health,
    maxHealth: def.health,
    /** Distance travelled along the route, in cells. */
    d: 0,
    x: 0,
    y: 0,
    dx: 1,
    dy: 0,
  };
  positionAt(line, 0, e);
  state.enemies.push(e);
  return e;
}

/**
 * Moves all enemies; enemies reaching the bastion break through and cost lives.
 * @returns {number} Lives lost in this step.
 */
export function updateEnemies(state, dt) {
  const { ground, flyer } = state.waveRoutes;
  let lost = 0;
  let write = 0;
  for (let read = 0; read < state.enemies.length; read++) {
    const e = state.enemies[read];
    const line = e.flying ? flyer : ground;
    e.d += e.speed * dt;
    if (e.d >= line.length) {
      const cost = e.boss ? RULES.bossLeakCost : RULES.leakCost;
      lost += cost;
      state.lives = Math.max(0, state.lives - cost);
      state.waveStats.leaked += 1;
      state.events.push({ type: 'leak', enemyId: e.id, cost, x: e.x, y: e.y });
      continue;
    }
    positionAt(line, e.d, e);
    state.enemies[write++] = e;
  }
  state.enemies.length = write;
  return lost;
}
