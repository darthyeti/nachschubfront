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
    // v4: no projectile at all. A standing golden aura that hurts and slows
    // everything inside it, for as long as it is inside (GDD section 8).
    doctrine: 'flame',
    behaviour: 'aura',
    fire: 'aura',
    damage: 11,
    range: 2.8,
    targets: ['ground'],
    slow: 0.25,
    /** Enemies in the aura glow gold instead of wearing the violet slow ring. */
    gilds: true,
  },

  stormBattery: {
    // Rapid fire with blue tracer, spread over the three leading enemies.
    doctrine: 'autocannon',
    behaviour: 'multi',
    fire: 1 / 0.06,
    damage: 5,
    range: 3.2,
    targets: ['ground', 'air'],
    multiTargets: 3,
    /** Blue tracer and blue muzzle flashes, not the doctrine's brass. */
    tracer: '#7fd8ff',
  },

  emberCauldron: {
    // v4: no aura. Fire bolts at the leading enemies, and the fire they set
    // spreads from one to the next.
    doctrine: 'flame',
    behaviour: 'multi',
    fire: 1 / 1.2,
    damage: 6,
    range: 3.2,
    targets: ['ground'],
    multiTargets: 3,
    burn: { damagePerSecond: 9, seconds: 3 },
    /**
     * The fire jumps to one enemy that is not burning yet, this often, this far
     * (GDD section 8). A fire that was caught this way does not spread again:
     * the update does not say it does, and an unbounded chain would set a whole
     * wave alight off one bolt. Derived, for the balancing pass.
     */
    spread: { everySeconds: 0.45, range: 0.85, seconds: 2.2 },
  },

  siegeMortar: {
    doctrine: 'mortar',
    behaviour: 'mortar',
    fire: 1 / 3.2,
    damage: 260,
    range: 6.6,
    minRange: 1.5,
    targets: ['ground'],
    splashRadius: 2.6,
    flightSeconds: 1.2,
    /** Seconds it holds the target in its scope before the shell leaves. */
    aimSeconds: 0.8,
  },

  thunderTower: {
    doctrine: 'tesla',
    behaviour: 'chain',
    fire: 1 / 1.3,
    damage: 14,
    range: 3.1,
    targets: ['ground', 'air'],
    chain: { targets: 8, falloff: 0, jumpRange: 1.8, stun: 0.5 },
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
