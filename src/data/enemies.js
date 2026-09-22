// Enemy types (GDD section 9). Health is the wave-1 value, speed is in cells
// per second, `reward` is the requisition paid for a kill.
// Bosses live in the same table and are marked with `boss: true` (added in M3
// together with the wave list).

/**
 * Optional fields:
 * - `shield` / `shieldRegen`: warp shield pool and regeneration per second.
 *   While the shield holds, hits use the `warpshield` row of the damage matrix,
 *   below it `armorBelow`.
 * - `death`: enemies released when this one dies, at its position on the route.
 * - `heal`: aura that heals other enemies inside `radius` by `perSecond`.
 */
export const ENEMIES = {
  swarmer: { armor: 'flesh', health: 30, speed: 1.6, reward: 1, flying: false },
  warrior: { armor: 'flesh', health: 70, speed: 1.1, reward: 2, flying: false },
  breaker: { armor: 'plate', health: 220, speed: 0.6, reward: 5, flying: false },
  warpseer: {
    armor: 'warpshield',
    armorBelow: 'flesh',
    health: 60,
    shield: 60,
    shieldRegen: 10,
    speed: 1.0,
    reward: 4,
    flying: false,
  },
  carrionflyer: { armor: 'flyer', health: 50, speed: 1.4, reward: 3, flying: true },
  burster: {
    armor: 'flesh',
    health: 90,
    speed: 0.9,
    reward: 3,
    flying: false,
    death: { type: 'swarmer', count: 4 },
  },
  healer: {
    armor: 'flesh',
    health: 80,
    speed: 0.9,
    reward: 4,
    flying: false,
    heal: { perSecond: 8, radius: 1.5 },
  },
};

/** Fixed order: the sprite gallery and the stress test follow it. */
export const ENEMY_IDS = Object.keys(ENEMIES);

export function enemyDef(type) {
  const def = ENEMIES[type];
  if (!def) throw new Error(`Unknown enemy type: ${type}`);
  return def;
}
