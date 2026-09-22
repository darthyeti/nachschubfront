// The six weapon doctrines (GDD section 6).
// How well a doctrine fares against an armour type is not here but in the
// damage matrix (data/combat.js), so every factor has exactly one home.

/**
 * `fire` is either shots per second, 'stream' (continuous damage) or 'aura'.
 * Ranges are in cells, damage is the recruit value before the rank factor.
 */
export const DOCTRINES = {
  flame: {
    color: '#ff8a2a',
    damage: 18,
    fire: 'stream',
    range: 2.0,
    targets: ['ground'],
    /**
     * The cone hits every enemy inside the range whose direction is within this
     * angle of the aim (radians, about 40 degrees to each side). The GDD only
     * says "cone", the width is ours.
     */
    coneHalfAngle: 0.7,
    burn: { damagePerSecond: 6, seconds: 3 },
  },
  autocannon: {
    color: '#f0e2b8',
    damage: 6,
    fire: 5,
    range: 3.5,
    targets: ['ground', 'air'],
  },
  laser: {
    color: '#ff4a4a',
    damage: 40,
    fire: 0.8,
    range: 4.5,
    targets: ['ground', 'air'],
    /**
     * The beam pierces every enemy on its line; an enemy counts as hit while it
     * is within this distance of the beam (cells). Not in the GDD.
     */
    beamWidth: 0.5,
  },
  mortar: {
    color: '#d8ae5f',
    damage: 30,
    fire: 0.45,
    range: 7.0,
    minRange: 1.5,
    targets: ['ground'],
    splashRadius: 1.2,
    flightSeconds: 1,
  },
  psi: {
    color: '#b784ff',
    damage: 4,
    fire: 'aura',
    range: 3.0,
    targets: ['ground', 'air'],
    /** Slows enemies inside the aura by this fraction. */
    slow: 0.3,
  },
  tesla: {
    color: '#5fd4ff',
    damage: 14,
    fire: 1,
    range: 3.0,
    targets: ['ground', 'air'],
    /** `jumpRange` is how far a bolt can jump to the next enemy (cells; not in the GDD). */
    chain: { targets: 4, falloff: 0.2, jumpRange: 2.5 },
  },
};

/** Fixed order: sprite gallery and codex follow it. */
export const DOCTRINE_IDS = Object.keys(DOCTRINES);

/** Guide colours (ART.md), also used by the pod hologram. */
export const DOCTRINE_COLORS = Object.fromEntries(
  DOCTRINE_IDS.map((id) => [id, DOCTRINES[id].color]),
);
