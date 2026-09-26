// Status effects on enemies: burning, slowed, frozen.
//
// They live as plain fields on the enemy record instead of in a list, because
// every enemy can carry at most one of each and the systems run over all
// enemies anyway.

import { damageEnemy } from './damage.js';

/**
 * How long a slow lasts after the last touch. Auras re-apply it every step, so
 * this only has to bridge the gap until the next one.
 */
const SLOW_LINGER_SECONDS = 0.15;

/** Slows an enemy; the strongest slow wins, they do not add up. */
export function applySlow(state, enemy, fraction) {
  if (fraction <= 0) return;
  if (fraction > enemy.slow || state.time >= enemy.slowUntil) enemy.slow = fraction;
  else enemy.slow = Math.max(enemy.slow, fraction);
  enemy.slowUntil = state.time + SLOW_LINGER_SECONDS;
}

/** Freezes an enemy in place; the longer freeze wins. */
export function applyStun(state, enemy, seconds) {
  enemy.stunUntil = Math.max(enemy.stunUntil, state.time + seconds);
}

/**
 * Sets an enemy on fire.
 * @param {{damagePerSecond: number, seconds: number}} burn  Values of the source.
 * @param {boolean} [stack]  True adds to the burn already running (purge shrine),
 *   false refreshes it (GDD section 6: the flame doctrine burns for 3 s).
 */
export function applyBurn(state, enemy, burn, doctrine, towerId, { stack = false } = {}) {
  const until = state.time + burn.seconds;
  if (!enemy.burn || state.time >= enemy.burn.until) {
    enemy.burn = { dps: burn.damagePerSecond, until, doctrine, towerId };
    return;
  }
  enemy.burn.dps = stack ? enemy.burn.dps + burn.damagePerSecond : Math.max(enemy.burn.dps, burn.damagePerSecond);
  enemy.burn.until = Math.max(enemy.burn.until, until);
  enemy.burn.doctrine = doctrine;
  enemy.burn.towerId = towerId;
}

/** Speed of an enemy right now, in cells per second (0 while frozen). */
export function enemySpeed(state, enemy) {
  if (state.time < enemy.stunUntil) return 0;
  // The Koloss holds still while it turns on the spot, while it is stunned
  // after a bulwark stopped it, and while it rams (sim/koloss.js).
  if (enemy.holdUntil && state.time < enemy.holdUntil) return 0;
  const slow = state.time < enemy.slowUntil ? enemy.slow : 0;
  return enemy.speed * (1 - slow);
}

/**
 * Burns tick, expired effects are dropped. Burn damage is credited to the tower
 * that lit the fire, so the wave statistics stay honest.
 */
export function updateEffects(state, dt) {
  let towers = null;
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (e.slowUntil && state.time >= e.slowUntil) e.slow = 0;
    if (!e.burn) continue;
    if (state.time >= e.burn.until) {
      e.burn = null;
      continue;
    }
    const dealt = damageEnemy(e, e.burn.dps * dt, e.burn.doctrine);
    if (dealt > 0 && e.burn.towerId != null) {
      if (!towers) towers = new Map(state.towers.map((t) => [t.id, t]));
      const tower = towers.get(e.burn.towerId);
      if (tower) tower.damage += dealt;
    }
  }
}
