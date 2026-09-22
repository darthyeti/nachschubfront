// Towers shooting at enemies. The per-doctrine behaviour (cone, beam, chain,
// shells) is added on top of this core in the next step; what lives here is the
// part every doctrine shares: reload, target, damage, report.

import { towerStats } from './towers.js';
import { bestTarget, targetsInRange } from './targeting.js';
import { damageEnemy } from './damage.js';

/** Reload time of a tower in seconds, or null for continuous fire. */
function period(stats) {
  return typeof stats.fire === 'number' ? 1 / stats.fire : null;
}

/** Records the hit on the tower's statistics and reports it for the effects. */
function hit(state, tower, stats, enemy, amount) {
  const dealt = damageEnemy(enemy, amount, stats.doctrine);
  tower.damage += dealt;
  return dealt;
}

/**
 * One shot at the chosen target. Split out because the doctrines take it over
 * one by one in the next step.
 */
function fireShot(state, tower, stats, target) {
  tower.aim = { x: target.x, y: target.y };
  hit(state, tower, stats, target, stats.damage);
  state.events.push({
    type: 'shot',
    towerId: tower.id,
    doctrine: stats.doctrine,
    x: tower.x + 0.5,
    y: tower.y + 0.5,
    tx: target.x,
    ty: target.y,
  });
}

/** Continuous weapons: damage per second on everything they cover. */
function fireContinuous(state, tower, stats, dt) {
  if (stats.fire === 'aura') {
    const targets = targetsInRange(state, tower, stats);
    if (targets.length === 0) return;
    for (const e of targets) hit(state, tower, stats, e, stats.damage * dt);
    tower.aim = { x: targets[0].x, y: targets[0].y };
    return;
  }
  const target = bestTarget(state, tower, stats);
  if (!target) return;
  tower.aim = { x: target.x, y: target.y };
  hit(state, tower, stats, target, stats.damage * dt);
}

/** One simulation step of tower fire. */
export function updateCombat(state, dt) {
  for (const tower of state.towers) {
    const stats = towerStats(tower);
    const reload = period(stats);
    if (reload === null) {
      fireContinuous(state, tower, stats, dt);
      continue;
    }
    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;
    const target = bestTarget(state, tower, stats);
    if (!target) {
      // Ready to fire: wait for a target instead of banking up shots.
      tower.cooldown = 0;
      continue;
    }
    fireShot(state, tower, stats, target);
    tower.cooldown += reload;
    if (tower.cooldown <= 0) tower.cooldown = reload;
  }
}
