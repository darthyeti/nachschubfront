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

/**
 * Bosses (GDD section 9). Every tenth wave replaces the cycle with one of them.
 * The GDD names the idea but no numbers; the values below are derived from the
 * wave they appear in: a boss is worth roughly one and a half normal waves of
 * health (see docs/PROGRESS.md) and is slower than the enemies around it.
 * `sprite` is the enemy whose artwork the boss borrows until M4, `scale` how
 * much larger it is drawn.
 */
/**
 * The five bosses. `sprite` says which creature a boss is kin to; it sets the
 * size of its ground shadow. `scale` is the size of its own figure (M4): it was
 * picked so every boss keeps the presence it had when it still borrowed the
 * artwork of that creature.
 */
export const BOSSES = {
  broodmother: {
    boss: true,
    wave: 10,
    armor: 'flesh',
    health: 1800,
    speed: 0.7,
    reward: 50,
    flying: false,
    sprite: 'burster',
    scale: 1.8,
    /** Releases swarmers while it walks. */
    spawnTrail: { type: 'swarmer', count: 2, intervalSeconds: 3 },
  },
  colossusbreaker: {
    boss: true,
    wave: 20,
    armor: 'plate',
    health: 3500,
    speed: 0.45,
    reward: 50,
    flying: false,
    sprite: 'breaker',
    scale: 1.9,
  },
  warpherald: {
    boss: true,
    wave: 30,
    armor: 'warpshield',
    armorBelow: 'flesh',
    health: 3000,
    shield: 1500,
    shieldRegen: 120,
    speed: 0.8,
    reward: 50,
    flying: false,
    sprite: 'warpseer',
    scale: 2,
    /** Jumps this many cells forward along the route now and then. */
    warpJump: { cells: 3, intervalSeconds: 6 },
  },
  swarmqueen: {
    boss: true,
    wave: 40,
    armor: 'flyer',
    health: 3500,
    speed: 0.9,
    reward: 50,
    flying: true,
    sprite: 'carrionflyer',
    scale: 1.55,
  },
  daemonprince: {
    boss: true,
    wave: 50,
    armor: 'flesh',
    health: 5000,
    speed: 0.6,
    reward: 50,
    flying: false,
    sprite: 'warrior',
    scale: 2,
    /** Cycles through these armour types, one every `seconds`. */
    armorCycle: { types: ['flesh', 'plate', 'warpshield'], seconds: 4 },
  },
};

/**
 * The Koloss (GDD section 9, v3): the late threat, a war machine rather than a
 * creature. It travels outside the boss table because it is not a wave's boss —
 * it turns up in addition to one.
 *
 * Derived numbers, none of them in the GDD (candidates for M6):
 * - `health` 9000 against the wave-50 boss's 5000, so it reads as "markedly
 *   tougher than a boss" even though it arrives fifteen waves earlier.
 * - `speed` below every boss: it should be on the field long enough to be worth
 *   spending commands on.
 * - `reward` above a boss's 50, because it costs more to bring down.
 */
export const KOLOSS = {
  koloss: true,
  /** It counts as a boss everywhere a rule says "boss": damage caps, stasis, points. */
  boss: true,
  armor: 'plate',
  health: 9000,
  speed: 0.35,
  reward: 80,
  flying: false,
  sprite: 'breaker',
  scale: 2.6,
};

/**
 * When it comes and what it does when it arrives. Every number here is a data
 * value the balancing pass can turn.
 */
export const KOLOSS_RUN = {
  /**
   * Waves it appears in. Update v3 said "from wave 30, every 10 waves"; 30, 40
   * and 50 are boss waves already, so the run is offset by five and the two do
   * not take each other's effect away (decision of 24.09.2026, see docs/GDD.md).
   */
  waves: [35, 45],
  /** Waves of warning before it lands: first a warning, then the prediction. */
  warningWaves: 2,
  /** Cells the ram tears through the maze, in its direction of travel. */
  breachCells: 5,
  /**
   * What a bulwark near the predicted spot is worth when the prediction looks
   * for the weakest place. The GDD wants the marker to move when the player
   * reinforces, and a bulwark carries no firepower of its own.
   */
  bulwarkFirepower: 40,
  /** How close a bulwark has to be to count, in cells. */
  bulwarkRadius: 1.5,
};

/** Fixed order: the sprite gallery and the stress test follow it. */
export const ENEMY_IDS = Object.keys(ENEMIES);

export const BOSS_IDS = Object.keys(BOSSES);

/** Every enemy the simulation can spawn: normal types, bosses and the Koloss. */
export const ALL_ENEMIES = { ...ENEMIES, ...BOSSES, koloss: KOLOSS };

export function enemyDef(type) {
  const def = ALL_ENEMIES[type];
  if (!def) throw new Error(`Unknown enemy type: ${type}`);
  return def;
}
