// Wave spawning. Wave definitions live in data/waves.js.

import { WAVES } from '../data/waves.js';
import { groundPolyline, flyerPolyline } from './route.js';
import { spawnEnemy } from './enemies.js';

/** Flattens a wave definition into spawn entries sorted by time (stable for equal times). */
export function buildSpawns(waveDef) {
  const spawns = [];
  for (const group of waveDef.groups) {
    for (let i = 0; i < group.count; i++) {
      spawns.push({ time: group.delay + i * group.interval, type: group.type, order: spawns.length });
    }
  }
  spawns.sort((a, b) => a.time - b.time || a.order - b.order);
  return spawns.map(({ time, type }) => ({ time, type }));
}

export function totalWaves() {
  return WAVES.length;
}

export function waveDef(wave) {
  return WAVES[wave - 1] ?? null;
}

/** Starts the next wave: freezes routes and queues its spawns. */
export function beginWave(state) {
  state.wave += 1;
  const def = WAVES[state.wave - 1];
  state.spawns = buildSpawns(def);
  state.waveScale = def.scale;
  state.waveRoutes = { ground: groundPolyline(state.route), flyer: flyerPolyline(state.map) };
  state.waveStats = { spawned: 0, leaked: 0, killed: 0, bossKills: 0 };
  state.projectiles.length = 0;
  // Banners and strikes belong to one wave only.
  state.pendingStrikes.length = 0;
  state.banners.length = 0;
  for (const tower of state.towers) tower.damage = 0;
  state.events.push({ type: 'waveStart', wave: state.wave });
}

/** Spawns everything that is due at the current wave time (phaseTime). */
export function updateSpawns(state) {
  while (state.spawns.length && state.spawns[0].time <= state.phaseTime + 1e-9) {
    const { type } = state.spawns.shift();
    spawnEnemy(state, type);
    state.waveStats.spawned += 1;
  }
}

export function waveCleared(state) {
  return state.spawns.length === 0 && state.enemies.length === 0;
}
