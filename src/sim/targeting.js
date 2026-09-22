// Finding targets for a tower. Deterministic: the enemy list is walked in
// spawn order and ties are broken by the enemy id, so the same situation always
// produces the same target.
//
// The search is a plain scan over all enemies. With 200 enemies and the towers
// of a late match that is a few thousand distance checks per step, which is far
// below the frame budget; a spatial index would only pay off beyond that.

/** True if the doctrine is allowed to shoot at this enemy at all. */
export function canTarget(def, enemy) {
  return enemy.flying ? def.targets.includes('air') : def.targets.includes('ground');
}

/** Squared distance in cells between a tower centre and an enemy. */
export function distanceSq(tower, enemy) {
  const dx = enemy.x - (tower.x + 0.5);
  const dy = enemy.y - (tower.y + 0.5);
  return dx * dx + dy * dy;
}

/** True if the enemy is inside the tower's range band (mortars have a dead zone). */
export function inRange(tower, stats, enemy) {
  const d2 = distanceSq(tower, enemy);
  return d2 <= stats.range * stats.range && d2 >= stats.minRange * stats.minRange;
}

/**
 * The enemy that is furthest along its route inside the range (GDD section 6:
 * default targeting), or null.
 */
export function bestTarget(state, tower, stats) {
  let best = null;
  for (const e of state.enemies) {
    if (e.dead || !canTarget(stats.def, e) || !inRange(tower, stats, e)) continue;
    if (!best || e.d > best.d || (e.d === best.d && e.id < best.id)) best = e;
  }
  return best;
}

/**
 * Every enemy inside the range, in spawn order.
 * @param {number} [radius] Overrides the tower range, e.g. for a splash radius.
 * @param {boolean} [sorted] True puts the enemy furthest along the route first.
 *   Sorting costs time in every step, so only the weapons that pick the leading
 *   targets ask for it.
 */
export function targetsInRange(state, tower, stats, radius = stats.range, sorted = false) {
  const found = [];
  const r2 = radius * radius;
  for (const e of state.enemies) {
    if (e.dead || !canTarget(stats.def, e)) continue;
    if (distanceSq(tower, e) > r2) continue;
    found.push(e);
  }
  if (sorted) found.sort((a, b) => b.d - a.d || a.id - b.id);
  return found;
}

/** Every enemy inside a radius around a world point, whatever its armour. */
export function enemiesAround(state, point, radius, { air = true, ground = true } = {}) {
  const found = [];
  const r2 = radius * radius;
  for (const e of state.enemies) {
    if (e.dead || (e.flying ? !air : !ground)) continue;
    const dx = e.x - point.x;
    const dy = e.y - point.y;
    if (dx * dx + dy * dy <= r2) found.push(e);
  }
  return found;
}
