// Applying damage (GDD section 9): the damage matrix decides how much of a hit
// arrives, a warp shield takes it before the health underneath.

import { damageFactor, WARP_SHIELD } from '../data/combat.js';

/** Seconds an enemy shows the hit flash. Visual, but kept deterministic here. */
const FLASH_SECONDS = 0.12;

/**
 * Deals damage to one enemy.
 * @param {object} enemy  Enemy record; not removed here, only marked as dead.
 * @param {number} amount  Damage before the matrix factor.
 * @param {string} doctrine  Doctrine of the source, for the matrix.
 * @returns {number} Damage that actually arrived (shield plus health).
 */
export function damageEnemy(enemy, amount, doctrine) {
  if (enemy.dead || amount <= 0) return 0;
  let raw = amount;
  let dealt = 0;

  if (enemy.shield > 0) {
    const factor = damageFactor(doctrine, enemy.armor);
    if (factor <= 0) return 0;
    const onShield = raw * factor;
    enemy.shieldTimer = 0;
    if (onShield < enemy.shield) {
      enemy.shield -= onShield;
      enemy.flash = FLASH_SECONDS;
      return onShield;
    }
    // The shield breaks; the rest of the hit carries on to the health below.
    dealt += enemy.shield;
    raw -= enemy.shield / factor;
    enemy.shield = 0;
  }

  const factor = damageFactor(doctrine, enemy.armorBelow);
  if (factor > 0) {
    const onHealth = Math.min(enemy.health, raw * factor);
    enemy.health -= onHealth;
    dealt += onHealth;
  }
  if (dealt > 0) enemy.flash = FLASH_SECONDS;
  if (enemy.health <= 0) enemy.dead = true;
  return dealt;
}

/** Heals an enemy, never above its maximum (healers, GDD section 9). */
export function healEnemy(enemy, amount) {
  if (enemy.dead || amount <= 0) return 0;
  const healed = Math.min(amount, enemy.maxHealth - enemy.health);
  enemy.health += healed;
  return healed;
}

/** Regenerates warp shields that have not been hit for a while. */
export function updateShields(state, dt) {
  for (const e of state.enemies) {
    if (e.dead || e.maxShield <= 0) continue;
    e.shieldTimer += dt;
    if (e.shieldTimer < WARP_SHIELD.regenDelaySeconds || e.shield >= e.maxShield) continue;
    e.shield = Math.min(e.maxShield, e.shield + e.shieldRegen * dt);
  }
}

/** Counts down the hit flash of every enemy. */
export function updateFlashes(state, dt) {
  for (const e of state.enemies) if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
}
