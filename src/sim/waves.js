// Wave spawning. Wave definitions live in data/waves.js.

import { WAVES } from '../data/waves.js';
import { enemyDef } from '../data/enemies.js';
import { updateKoloss, spawnKoloss } from './koloss.js';
import { freezeRoutes } from './route.js';
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

/** Whether anything in the wave flies, i.e. ignores the maze. */
export function waveFlies(wave) {
  return waveDef(wave)?.groups.some((group) => enemyDef(group.type).flying) ?? false;
}

/** Starts the next wave: freezes routes and queues its spawns. */
export function beginWave(state) {
  state.wave += 1;
  const def = WAVES[state.wave - 1];
  state.spawns = buildSpawns(def);
  // The mode's factor on top of the wave rules (M7b, B6); 1 in the standard mode,
  // and a product with 1 is exact, so the standard waves stay bit for bit.
  state.waveScale = def.scale * (state.mode?.balance?.enemyHpFactor ?? 1);
  state.waveRoutes = freezeRoutes(state);
  state.waveStats = {
    spawned: 0,
    leaked: 0,
    killed: 0,
    bossKills: 0,
    /** Health plus shields of everything that spawned: what the wave brought. */
    health: 0,
    /** Damage the emplacements landed, and what the commands landed beside them. */
    damage: 0,
    commandDamage: 0,
    /**
     * Damage thrown away on enemies that were already as good as dead. The
     * simulation caps a hit at the health left (so the statistics never show
     * more damage than there was to deal); this counts what the cap swallowed,
     * because a doctrine that overkills half its shots is badly tuned, not
     * strong (M6).
     */
    overkill: 0,
  };
  state.projectiles.length = 0;
  // Banners and strikes belong to one wave only.
  state.pendingStrikes.length = 0;
  state.banners.length = 0;
  for (const tower of state.towers) tower.damage = 0;
  state.events.push({ type: 'waveStart', wave: state.wave });
  // The Koloss arrives on top of the wave, not instead of it (GDD section 9).
  updateKoloss(state);
  spawnKoloss(state);
}

/** Spawns everything that is due at the current wave time (phaseTime). */
export function updateSpawns(state) {
  while (state.spawns.length && state.spawns[0].time <= state.phaseTime + 1e-9) {
    const { type } = state.spawns.shift();
    spawnEnemy(state, type);
    state.waveStats.spawned += 1;
  }
}

/**
 * A wave is over when nothing is left to spawn, nothing is left alive and no
 * shell is still in the air; otherwise the last mortar round would hang over
 * the map through the whole evaluation.
 */
export function waveCleared(state) {
  return state.spawns.length === 0 && state.enemies.length === 0 && state.projectiles.length === 0;
}
