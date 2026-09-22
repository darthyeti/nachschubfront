// Special commands (GDD section 11). They cost command points, unlock with the
// wave number and have a cooldown counted in waves. They never block a cell.

/**
 * `phase` is when the command can be used: 'wave' during a running wave,
 * 'planning' only while planning. `target` is 'cell' for commands that are
 * aimed at a spot on the map and 'none' for commands without a target.
 */
export const COMMANDS = [
  {
    id: 'orbitalStrike',
    cost: 4,
    fromWave: 15,
    cooldownWaves: 3,
    phase: 'wave',
    target: 'cell',
    radius: 2,
    /** Seconds between marking the target and the impact. */
    warnSeconds: 2,
    /** Share of maximum health dealt to normal enemies ... */
    damageFraction: 1,
    /** ... and to bosses (GDD: at most 25 % of their maximum health). */
    bossDamageFraction: 0.25,
  },
  {
    id: 'stasisField',
    cost: 2,
    fromWave: 20,
    cooldownWaves: 2,
    phase: 'wave',
    target: 'cell',
    radius: 1.5,
    seconds: 5,
    bossSeconds: 2,
  },
  {
    id: 'prioritySupply',
    cost: 3,
    fromWave: 25,
    cooldownWaves: 3,
    phase: 'planning',
    target: 'none',
    /** Ranks added to every pod of the next salvo. */
    rankBonus: 1,
  },
  {
    id: 'holyBanner',
    cost: 2,
    fromWave: 30,
    cooldownWaves: 2,
    phase: 'wave',
    target: 'cell',
    radius: 2.5,
    /** Extra damage for towers inside the radius, for the rest of the wave. */
    damageBonus: 0.5,
  },
];

export const COMMAND_IDS = COMMANDS.map((c) => c.id);

export function commandById(id) {
  return COMMANDS.find((c) => c.id === id) ?? null;
}
