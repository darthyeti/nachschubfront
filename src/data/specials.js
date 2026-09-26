// Special towers from the recipes (GDD section 8).
//
// The GDD names the effect of each one but no numbers. The values below are
// derived from the ingredients: a special is roughly as strong as its leading
// doctrine a rank above the recipe's minimum, and spends the rest of its budget
// on what makes it special (more targets, a ring instead of a cone, a stun).
// They are balancing values like any other and live here to be tuned in M6.
//
// `doctrine` decides the damage matrix and the guide colour. `behaviour` picks
// how the tower delivers its damage (sim/combat.js):
//   single   one target per shot
//   multi    `multiTargets` targets per shot
//   beam     pierces a line
//   chain    jumps from enemy to enemy
//   mortar   shell with flight time and splash
//   cone     continuous cone in front of the tower
//   aura     continuous, everything in range
// `aura` is an extra ring that works alongside the main weapon.

export const SPECIALS = {
  purgeShrine: {
    doctrine: 'flame',
    behaviour: 'aura',
    fire: 'aura',
    damage: 60,
    range: 3.0,
    targets: ['ground'],
    slow: 0.25,
    burn: { damagePerSecond: 10, seconds: 3 },
    /** GDD: the burn stacks instead of being refreshed. */
    burnStacks: true,
  },

  stormBattery: {
    doctrine: 'autocannon',
    behaviour: 'multi',
    fire: 6,
    damage: 14,
    range: 4.0,
    targets: ['ground', 'air'],
    multiTargets: 3,
  },

  emberCauldron: {
    // Flame is the leading ingredient, so its bolts burn like fire does: hard
    // on flesh, useless against flyers, which it therefore does not target.
    doctrine: 'flame',
    behaviour: 'chain',
    fire: 1.2,
    damage: 90,
    range: 3.2,
    targets: ['ground'],
    chain: { targets: 4, falloff: 0.15, jumpRange: 2.5 },
    /** Every bolt sets its targets alight. */
    burn: { damagePerSecond: 14, seconds: 3 },
    /** The burning aura around the cauldron. */
    aura: { damage: 20, range: 2.0, burn: { damagePerSecond: 6, seconds: 2 } },
  },

  siegeMortar: {
    doctrine: 'mortar',
    behaviour: 'mortar',
    fire: 0.4,
    damage: 260,
    range: 12,
    minRange: 2,
    targets: ['ground'],
    splashRadius: 2.6,
    flightSeconds: 1.2,
  },

  thunderTower: {
    doctrine: 'tesla',
    behaviour: 'chain',
    fire: 1,
    damage: 110,
    range: 4.0,
    targets: ['ground', 'air'],
    chain: { targets: 8, falloff: 0.12, jumpRange: 3.0, stun: 0.35 },
  },

  soulfireObelisk: {
    // Since v4 a single beam every 1.6 s instead of a standing aura: the
    // strongest weapon in the game against one big target, and no answer at all
    // to a crowd (GDD section 8).
    doctrine: 'psi',
    behaviour: 'soulfire',
    fire: 0.625,
    damage: 0,
    range: 4.2,
    targets: ['ground', 'air'],
    /**
     * Share of the target's maximum health per beam. This is what makes it the
     * answer to a boss: it does not care how much health the boss has. It goes
     * through the damage matrix like everything else.
     */
    percentPerHit: 0.22,
    /**
     * And what it does to a boss or a Koloss instead (GDD section 8). Alone it
     * takes a Koloss apart in about 32 s rather than 8, so it stays the best
     * single weapon against a boss without replacing the commands. The cap is
     * per hit; unlike the airstrike there is none per wave.
     */
    bossPercentPerHit: 0.05,
  },
};

export function specialDef(id) {
  const def = SPECIALS[id];
  if (!def) throw new Error(`Unknown special tower: ${id}`);
  return def;
}
