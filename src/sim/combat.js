// Towers shooting at enemies (GDD section 6). Every doctrine has its own way of
// delivering damage; what they share is reload, targeting and reporting.

import { towerStats, towerCentre } from './towers.js';
import { bestTarget, targetsInRange, canTarget, distanceSq } from './targeting.js';
import { damageEnemy } from './damage.js';
import { applyBurn, applySlow, applyStun } from './effects.js';
import { launchShell } from './projectiles.js';

/** Reload time in seconds, or null for weapons that fire continuously. */
function period(stats) {
  return typeof stats.fire === 'number' ? 1 / stats.fire : null;
}

/** Deals damage and books it on the tower that caused it. */
function hit(tower, stats, enemy, amount) {
  const dealt = damageEnemy(enemy, amount, stats.doctrine);
  tower.damage += dealt;
  return dealt;
}

/** Unit vector from the tower to a point, plus the distance. */
function aimAt(tower, point) {
  const centre = towerCentre(tower);
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  const length = Math.hypot(dx, dy) || 1;
  return { centre, ux: dx / length, uy: dy / length, length };
}

// ---------- Single target ----------

function fireSingle(state, tower, stats, target) {
  hit(tower, stats, target, stats.damage);
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

// ---------- Laser: pierces everything on the line ----------

function fireBeam(state, tower, stats, target) {
  const { centre, ux, uy } = aimAt(tower, target);
  const width = stats.def.beamWidth;
  for (const e of targetsInRange(state, tower, stats)) {
    const dx = e.x - centre.x;
    const dy = e.y - centre.y;
    const along = dx * ux + dy * uy;
    if (along < 0) continue; // behind the muzzle
    const across = Math.abs(dx * uy - dy * ux);
    if (across > width) continue;
    hit(tower, stats, e, stats.damage);
  }
  state.events.push({
    type: 'beam',
    towerId: tower.id,
    doctrine: stats.doctrine,
    x: centre.x,
    y: centre.y,
    tx: centre.x + ux * stats.range,
    ty: centre.y + uy * stats.range,
  });
}

// ---------- Tesla: chain over several enemies ----------

/** Closest enemy that has not been hit yet, within the jump range. */
function nextInChain(state, stats, from, hitIds, jumpRange) {
  let best = null;
  let bestDist = jumpRange * jumpRange;
  for (const e of state.enemies) {
    if (e.dead || hitIds.has(e.id) || !canTarget(stats.def, e)) continue;
    const dx = e.x - from.x;
    const dy = e.y - from.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > bestDist || (best && d2 === bestDist && e.id > best.id)) continue;
    best = e;
    bestDist = d2;
  }
  return best;
}

function fireChain(state, tower, stats, target, { targets, falloff, jumpRange, stun = 0 } = stats.def.chain) {
  const centre = towerCentre(tower);
  const points = [centre];
  const hitIds = new Set();
  let current = target;
  let damage = stats.damage;
  while (current && hitIds.size < targets) {
    hit(tower, stats, current, damage);
    if (stun > 0) applyStun(state, current, stun);
    hitIds.add(current.id);
    points.push({ x: current.x, y: current.y });
    damage *= 1 - falloff;
    current = nextInChain(state, stats, current, hitIds, jumpRange);
  }
  state.events.push({ type: 'chain', towerId: tower.id, doctrine: stats.doctrine, points });
}

// ---------- Mortar: a shell with flight time ----------

function fireMortar(state, tower, stats, target) {
  launchShell(state, tower, stats, target);
  state.events.push({
    type: 'launch',
    towerId: tower.id,
    doctrine: stats.doctrine,
    x: tower.x + 0.5,
    y: tower.y + 0.5,
    tx: target.x,
    ty: target.y,
  });
}

// ---------- Flame: cone with burning ----------

function fireCone(state, tower, stats, dt) {
  const target = bestTarget(state, tower, stats);
  if (!target) return false;
  const { centre, ux, uy } = aimAt(tower, target);
  const cos = Math.cos(stats.def.coneHalfAngle);
  for (const e of targetsInRange(state, tower, stats)) {
    const dx = e.x - centre.x;
    const dy = e.y - centre.y;
    const length = Math.hypot(dx, dy);
    // The cone opens from the muzzle; anything sitting on top of it is hit too.
    if (length > 0.2 && (dx * ux + dy * uy) / length < cos) continue;
    hit(tower, stats, e, stats.damage * dt);
    if (stats.def.burn) applyBurn(state, e, stats.def.burn, stats.doctrine, tower.id, { stack: stats.burnStacks });
  }
  tower.aim = { x: target.x, y: target.y };
  return true;
}

// ---------- Psi: aura that damages and slows ----------

function fireAura(state, tower, stats, dt) {
  const targets = targetsInRange(state, tower, stats);
  if (targets.length === 0) return false;
  for (const e of targets) {
    hit(tower, stats, e, stats.damage * dt);
    if (stats.def.slow) applySlow(state, e, stats.def.slow);
    if (stats.def.burn) applyBurn(state, e, stats.def.burn, stats.doctrine, tower.id, { stack: stats.burnStacks });
  }
  tower.aim = { x: targets[0].x, y: targets[0].y };
  return true;
}

/** How each doctrine delivers a single shot. */
const SHOT = {
  autocannon: fireSingle,
  laser: fireBeam,
  mortar: fireMortar,
  tesla: fireChain,
};

/** How the continuous doctrines work. */
const CONTINUOUS = {
  flame: fireCone,
  psi: fireAura,
};

/** One simulation step of tower fire. */
export function updateCombat(state, dt) {
  for (const tower of state.towers) {
    const stats = towerStats(tower);
    const continuous = CONTINUOUS[stats.behaviour ?? stats.doctrine];
    if (continuous) {
      tower.firing = continuous(state, tower, stats, dt);
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
    tower.aim = { x: target.x, y: target.y };
    const shot = SHOT[stats.behaviour ?? stats.doctrine] ?? fireSingle;
    shot(state, tower, stats, target);
    const reload = period(stats);
    tower.cooldown += reload;
    if (tower.cooldown <= 0) tower.cooldown = reload;
  }
}
