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
  /** A position of your own costs this many times the current rubble price. */
  towerCostFactor: 3,

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
 * Cost of the next demolition of a heap of rubble.
 * @param {number} demolished  Cells already cleared in this match, rubble and
 *   positions alike: every demolition makes the next one dearer.
 */
export function rubbleCost(demolished) {
  return ECONOMY.rubbleCost + ECONOMY.rubbleCostStep * demolished;
}

/**
 * Cost of tearing down one of your own positions: three times the current
 * rubble price, and it gives nothing back (GDD section 10).
 */
export function towerCost(demolished) {
  return rubbleCost(demolished) * ECONOMY.towerCostFactor;
}
