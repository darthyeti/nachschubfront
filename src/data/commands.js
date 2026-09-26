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
    /**
     * Seconds between drawing the line and the gunship coming in. The yellow
     * dashed line and the impact marks are up for this long (GDD section 11).
     */
    warnSeconds: 1.1,
    /** Seconds the gunship needs to fly the line from end to end. */
    runSeconds: 3.4,
    /** Bombs it drops along the run, alternating either side of the line. */
    bombs: 8,
    /** How far off the line they fall, in cells. */
    bombSpread: 0.35,
    /**
     * Blast radius of one bomb, in cells. Derived, and tied to `bombShare`
     * below: wide enough that consecutive blasts overlap, so every point on the
     * line is caught by at least two of them.
     */
    blastRadius: 1.5,
    /**
     * Share of an enemy's budget one bomb takes. Derived: with two blasts over
     * every point of the line, anything the run passes over loses its whole
     * share, exactly as it did when the strike landed in one piece, while
     * anything clipped at the edge of the run loses half.
     */
    bombShare: 0.5,
    /**
     * Share of maximum health, like the orbital strike and for the same reason:
     * a fixed number is decisive in wave 30 and meaningless in wave 50. Derived,
     * the GDD gives no figure — a candidate for M6.
     *
     * Since v4 it is the budget for the whole run, not one hit: each bomb takes
     * an eighth of it, so an enemy that sits under the full run loses as much
     * as it used to, and one clipped at the end of the line loses less.
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
