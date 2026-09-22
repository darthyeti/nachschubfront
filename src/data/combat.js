// Armour types and the damage matrix (GDD section 9).

/** Fixed order: the codex and the info panel follow it. */
export const ARMOR_TYPES = ['flesh', 'plate', 'warpshield', 'flyer'];

/**
 * `DAMAGE_MATRIX[doctrine][armor]` scales the damage of a hit.
 * A factor of 0 means the doctrine cannot hurt that armour at all; those
 * doctrines do not target it either (see `targets` in doctrines.js).
 */
export const DAMAGE_MATRIX = {
  flame: { flesh: 1.5, plate: 0.5, warpshield: 1.0, flyer: 0 },
  autocannon: { flesh: 1.0, plate: 0.75, warpshield: 0.5, flyer: 1.5 },
  laser: { flesh: 0.75, plate: 1.5, warpshield: 1.0, flyer: 1.0 },
  mortar: { flesh: 1.5, plate: 1.0, warpshield: 1.0, flyer: 0 },
  psi: { flesh: 1.0, plate: 0.5, warpshield: 3.0, flyer: 1.0 },
  tesla: { flesh: 1.25, plate: 0.5, warpshield: 1.5, flyer: 1.0 },
};

/**
 * Special towers do not appear in the matrix. They use the factors of their
 * leading doctrine (the first ingredient of their recipe), so their strengths
 * and weaknesses stay readable.
 */
export const WARP_SHIELD = {
  /** Seconds without a hit before the shield starts regenerating again. */
  regenDelaySeconds: 2,
};

/**
 * Damage multiplier of a doctrine against an armour type.
 * @param {string} doctrine  Doctrine id.
 * @param {string} armor  Armour type of the enemy, or of its shield.
 */
export function damageFactor(doctrine, armor) {
  const row = DAMAGE_MATRIX[doctrine];
  if (!row) throw new Error(`Unknown doctrine: ${doctrine}`);
  const factor = row[armor];
  if (factor === undefined) throw new Error(`Unknown armour: ${armor}`);
  return factor;
}
