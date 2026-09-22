// Requisition and command points (GDD section 10).
// Requisition per kill is the `reward` of the enemy type (data/enemies.js),
// the cost of a supply level is in data/supply.js.

export const ECONOMY = {
  /** Requisition at the start of a match; the first wave pays for the first level. */
  startRequisition: 0,
  /** Command points at the start of a match. */
  startCommandPoints: 0,

  /** Requisition paid after a cleared wave. */
  waveBonusBase: 10,
  waveBonusPerWave: 1,

  /** Demolishing rubble: the first one costs this much ... */
  rubbleCost: 15,
  /** ... and every further demolition in the same match costs this much more. */
  rubbleCostStep: 5,

  /** Command points for a defeated boss. */
  pointsPerBoss: 3,
  /** Command points for a wave without a single breakthrough. */
  pointsPerCleanWave: 1,
};

/** Requisition bonus for clearing a wave (GDD: 10 plus the wave number). */
export function waveBonus(wave) {
  return ECONOMY.waveBonusBase + ECONOMY.waveBonusPerWave * wave;
}

/**
 * Cost of the next demolition.
 * @param {number} demolished  Rubble piles already cleared in this match.
 */
export function rubbleCost(demolished) {
  return ECONOMY.rubbleCost + ECONOMY.rubbleCostStep * demolished;
}
