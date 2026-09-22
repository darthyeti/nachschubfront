// Enemy records and movement along the frozen wave routes.

import { enemyDef } from '../data/enemies.js';
import { RULES } from '../data/rules.js';
import { positionAt } from './route.js';
import { enemySpeed } from './effects.js';

/**
 * Spawns an enemy at distance `d` along the route of its kind. Health and
 * shield are scaled with the wave (data/waves.js).
 */
export function spawnEnemy(state, type, { d = 0 } = {}) {
  const def = enemyDef(type);
  const scale = state.waveScale ?? 1;
  const line = def.flying ? state.waveRoutes.flyer : state.waveRoutes.ground;
  const health = def.health * scale;
  const shield = (def.shield ?? 0) * scale;
  const e = {
    id: state.nextEnemyId++,
    type,
    flying: def.flying,
    boss: def.boss ?? false,
    speed: def.speed,
    health,
    maxHealth: health,
    /** Warp shield in front of the health; 0 for everything else. */
    shield,
    maxShield: shield,
    /** Current armour type; the daemon prince changes it while it walks. */
    armor: def.armor,
    /** Armour under the shield; the same as `armor` for everything else. */
    armorBelow: def.armorBelow ?? def.armor,
    shieldRegen: (def.shieldRegen ?? 0) * scale,
    /** Seconds since the last hit on the shield. */
    shieldTimer: 0,
    reward: def.reward,
    /** Seconds of hit flash left, and the flag the death pass looks for. */
    flash: 0,
    dead: false,
    /** True if this type does more than walk (sim/abilities.js). */
    hasAbility: Boolean(def.heal || def.spawnTrail || def.warpJump || def.armorCycle),
    /** Seconds since the ability last went off. */
    abilityTimer: 0,
    /** Status effects (sim/effects.js): slow fraction, its end, frozen until. */
    slow: 0,
    slowUntil: 0,
    stunUntil: 0,
    burn: null,
    /** Distance travelled along the route, in cells. */
    d,
    x: 0,
    y: 0,
    dx: 1,
    dy: 0,
  };
  positionAt(line, d, e);
  state.enemies.push(e);
  return e;
}

/**
 * Removes enemies killed in this step, pays their reward and reports them.
 * Kept apart from the systems that deal damage, so nothing has to worry about
 * the list changing while it is being walked.
 */
export function removeDead(state) {
  let write = 0;
  /** What dying enemies leave behind; spawned once the list is compacted. */
  const hatch = [];
  for (let read = 0; read < state.enemies.length; read++) {
    const e = state.enemies[read];
    if (!e.dead) {
      state.enemies[write++] = e;
      continue;
    }
    state.requisition += e.reward;
    state.kills += 1;
    state.waveStats.killed += 1;
    if (e.boss) state.waveStats.bossKills += 1;
    state.events.push({ type: 'kill', enemyId: e.id, enemyType: e.type, x: e.x, y: e.y, boss: e.boss });
    const death = enemyDef(e.type).death;
    if (death) {
      for (let i = 0; i < death.count; i++) hatch.push({ type: death.type, d: Math.max(0, e.d - i * 0.15) });
    }
  }
  state.enemies.length = write;
  for (const { type, d } of hatch) {
    spawnEnemy(state, type, { d });
    state.waveStats.spawned += 1;
  }
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
    e.d += enemySpeed(state, e) * dt;
    if (e.d >= line.length) {
      const cost = e.boss ? RULES.bossLeakCost : RULES.leakCost;
      lost += cost;
      // Debug invulnerability still counts the breakthrough, it only spares the bastion.
      if (!state.invulnerable) state.lives = Math.max(0, state.lives - cost);
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
