// The rules the wave table is built from (GDD section 9, "Wellenaufbau" and
// "Einstieg").
//
// They used to sit as constants inside make-waves.mjs. They are a module of
// their own since M6, because the balancing tools have to reach them: the
// biggest lever in the whole game — the enemy count and the 1.12 health growth
// per wave — lives here, and `npm run replay -- --data` would otherwise be able
// to change every number except these.
//
// Two readers, one source: `npm run waves` writes src/data/waves.js from
// `buildWaves(WAVE_RULES)`, and a replay with an override builds the same table
// in memory from changed rules. src/data/waves.js stays the generated table the
// game reads; hand edits there are still lost on the next run.

export const WAVE_RULES = {
  waveCount: 50,
  /**
   * Health grows by 12.5 % per wave, up from 12 % in balancing round 2
   * (29.09.2026). Alone this changes nothing measurable; it works together with
   * countPerWave below, and the pair was chosen over a larger single step
   * because a replay repeats the player's recorded moves and cannot adapt the
   * way a person would, so every measured hardness is an upper bound.
   */
  healthGrowth: 1.125,
  /**
   * Enemies per wave: 12 plus 1.25 per wave, swarmers twice as many.
   *
   * 1.25 since balancing round 2, up from 0.5. This is as far as the count can
   * go: the strongest wave of a played match (45, with the Koloss) spawns 183 at
   * 1.25 and 216 at 1.5, against a performance target of 200 enemies (CLAUDE.md).
   * The budget runs out before the difficulty does, which is why the count is not
   * a lever on its own.
   */
  baseCount: 12,
  countPerWave: 1.25,
  swarmerFactor: 2,

  /** The five-wave cycle; every tenth wave is replaced by a boss. */
  cycle: ['horde', 'armour', 'air', 'warp', 'mixed'],

  /** Seconds between two enemies of the same group. */
  interval: {
    swarmer: 0.4,
    warrior: 0.8,
    breaker: 1.5,
    warpseer: 1.1,
    carrionflyer: 0.8,
    burster: 1.1,
    healer: 1.6,
  },

  /**
   * First wave an enemy type can appear in (GDD section 9, "Einstieg"). Armour
   * and air arrive later than their slot in the cycle, so the opening waves stay
   * mild while the base route is still short.
   */
  unlock: {
    swarmer: 1,
    warrior: 1,
    breaker: 4,
    carrionflyer: 6,
    warpseer: 4,
    burster: 7,
    healer: 9,
  },

  /** The first waves carry 30 percent fewer enemies (GDD section 9, "Einstieg"). */
  earlyWaves: 5,
  earlyFactor: 0.7,

  /** Boss waves: the boss plus its escort, as shares of the normal wave count. */
  bossWaves: {
    10: { boss: 'broodmother', escort: [['swarmer', 1.0], ['warrior', 0.4]] },
    20: { boss: 'colossusbreaker', escort: [['breaker', 0.35], ['warrior', 0.5]] },
    30: { boss: 'warpherald', escort: [['warpseer', 0.5], ['healer', 0.2]] },
    40: { boss: 'swarmqueen', escort: [['carrionflyer', 0.8], ['warrior', 0.4]] },
    50: { boss: 'daemonprince', escort: [['breaker', 0.3], ['warpseer', 0.3], ['carrionflyer', 0.4]] },
  },

  /** Enemy mix of each kind of wave, as [type, share of the wave count] pairs. */
  composition: {
    horde: [['swarmer', 1.0], ['warrior', 0.3]],
    armour: [['breaker', 0.4], ['warrior', 0.5], ['burster', 0.25]],
    air: [['carrionflyer', 1.0], ['warrior', 0.4]],
    warp: [['warpseer', 0.6], ['warrior', 0.4], ['healer', 0.15]],
    mixed: [
      ['warrior', 0.4],
      ['swarmer', 0.4],
      ['breaker', 0.2],
      ['carrionflyer', 0.25],
      ['warpseer', 0.2],
      ['burster', 0.15],
      ['healer', 0.1],
    ],
  },

  /**
   * The enemy a cycle slot is named after. A slot whose lead enemy is still
   * locked would otherwise promise something it cannot field — an "air" wave
   * without a single flyer — so such a wave is called what is left of it.
   */
  lead: { horde: 'swarmer', armour: 'breaker', air: 'carrionflyer', warp: 'warpseer' },
};

/** Builds the whole wave table from a set of rules. */
export function buildWaves(rules = WAVE_RULES) {
  const waves = [];
  for (let wave = 1; wave <= rules.waveCount; wave++) waves.push(buildWave(rules, wave));
  return waves;
}

export function buildWave(rules, wave) {
  const scale = Number((rules.healthGrowth ** (wave - 1)).toFixed(4));
  const bossWave = rules.bossWaves[wave];
  const groups = [];
  if (bossWave) {
    groups.push({ type: bossWave.boss, count: 1, interval: 0, delay: 0 });
    for (const [type, fraction] of bossWave.escort) {
      const count = share(rules, wave, type, fraction);
      if (count > 0) groups.push({ type, count, interval: rules.interval[type], delay: 3 + groups.length });
    }
    return { kind: 'boss', scale, groups };
  }
  const kind = rules.cycle[(wave - 1) % rules.cycle.length];
  for (const [type, fraction] of unlocked(rules, kind, wave)) {
    const count = share(rules, wave, type, fraction);
    if (count > 0) groups.push({ type, count, interval: rules.interval[type], delay: groups.length * 2 });
  }
  return { kind: label(rules, kind, wave), scale, groups };
}

const waveCount = (rules, wave) => Math.round(rules.baseCount + rules.countPerWave * wave);

function share(rules, wave, type, fraction) {
  if (wave < rules.unlock[type]) return 0;
  const base =
    waveCount(rules, wave) *
    (type === 'swarmer' ? rules.swarmerFactor : 1) *
    (wave <= rules.earlyWaves ? rules.earlyFactor : 1);
  return Math.max(1, Math.round(base * fraction));
}

/**
 * The composition of a wave with the types it may not field yet taken out. Their
 * share goes to the remaining types in proportion, so a wave never ends up as a
 * handful of stragglers just because its lead enemy is still locked.
 */
function unlocked(rules, kind, wave) {
  const all = rules.composition[kind];
  const open = all.filter(([type]) => wave >= rules.unlock[type]);
  const missing = all.reduce((sum, [type, f]) => (wave < rules.unlock[type] ? sum + f : sum), 0);
  if (missing === 0 || open.length === 0) return open;
  const openShare = open.reduce((sum, [, f]) => sum + f, 0);
  const factor = (openShare + missing) / openShare;
  return open.map(([type, f]) => [type, f * factor]);
}

function label(rules, kind, wave) {
  const lead = rules.lead[kind];
  return lead && wave < rules.unlock[lead] ? 'horde' : kind;
}
