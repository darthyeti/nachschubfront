// Special commands (GDD section 11). They cost command points, unlock with the
// wave number and have a cooldown counted in waves. They never block a cell.

/**
 * `phase` is when the command can be used: 'wave' during a running wave,
 * 'planning' only while planning. `target` is 'cell' for commands aimed at a
 * spot on the map, 'line' for the airstrike, which wants a start and an end,
 * and 'none' for commands without a target.
 */
export const COMMANDS = [
  {
    id: 'orbitalStrike',
    cost: 4,
    fromWave: 15,
    cooldownWaves: 3,
    phase: 'wave',
    target: 'cell',
    /** Raised from 2 to 3 in v3. */
    radius: 3,
    /** Seconds between marking the target and the impact. */
    warnSeconds: 2,
    /** Share of maximum health dealt to normal enemies ... */
    damageFraction: 1,
    /** ... and to bosses and the Koloss (GDD: at most 25 % of maximum health). */
    bossDamageFraction: 0.25,
  },
  {
    id: 'stasisField',
    cost: 2,
    fromWave: 20,
    cooldownWaves: 2,
    phase: 'wave',
    target: 'cell',
    /** Raised from 1.5 to 2.5 in v3. */
    radius: 2.5,
    seconds: 5,
    /** Bosses and the Koloss shake it off after this long. */
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
    /** From this supply level on it lifts two ranks instead of one (v3). */
    doubleFromSupplyLevel: 6,
    rankBonusHigh: 2,
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
  {
    // Luftschlag (GDD section 11, v3): a squadron flies the line the player drew
    // and hits everything along the strip, hardest where the armour is plate.
    id: 'airstrike',
    cost: 4,
    fromWave: 30,
    cooldownWaves: 4,
    phase: 'wave',
    target: 'line',
    /** Half-width of the strip in cells: the line is two cells wide. */
    halfWidth: 1,
    /** Longest line the player may draw, in cells; a longer drag is cut short. */
    maxLength: 10,
    /** Seconds between drawing the line and the squadron arriving. */
    warnSeconds: 1.5,
    /**
     * Share of maximum health, like the orbital strike and for the same reason:
     * a fixed number is decisive in wave 30 and meaningless in wave 50. Derived,
     * the GDD gives no figure — a candidate for M6.
     */
    damageFraction: 0.5,
    /** Against the armour type plate (GDD: bonus against Panzer). */
    plateFactor: 1.5,
    /** Against bosses and the Koloss: at most 30 % of maximum health. */
    bossDamageFraction: 0.3,
  },
];

export const COMMAND_IDS = COMMANDS.map((c) => c.id);

export function commandById(id) {
  return COMMANDS.find((c) => c.id === id) ?? null;
}
