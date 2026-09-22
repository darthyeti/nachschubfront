// Supply level (GDD section 7). The level sets the rank probabilities of every pod
// and is raised with requisition (economy follows in M3).

import { MAX_RANK } from './ranks.js';

/** `weights[rank - 1]` is the chance of that rank in percent; each row sums to 100. */
export const SUPPLY_LEVELS = [
  { level: 1, cost: 0, weights: [100, 0, 0, 0, 0] },
  { level: 2, cost: 20, weights: [80, 20, 0, 0, 0] },
  { level: 3, cost: 40, weights: [60, 30, 10, 0, 0] },
  { level: 4, cost: 80, weights: [40, 40, 20, 0, 0] },
  { level: 5, cost: 120, weights: [30, 35, 30, 5, 0] },
  { level: 6, cost: 180, weights: [20, 30, 35, 15, 0] },
  { level: 7, cost: 250, weights: [10, 25, 40, 20, 5] },
  { level: 8, cost: 350, weights: [5, 20, 35, 30, 10] },
];

export const MIN_SUPPLY_LEVEL = 1;
export const MAX_SUPPLY_LEVEL = SUPPLY_LEVELS.length;

/** Percentages per rank for a level; throws outside 1..8. */
export function supplyWeights(level) {
  if (!Number.isInteger(level) || level < MIN_SUPPLY_LEVEL || level > MAX_SUPPLY_LEVEL) {
    throw new RangeError(`Invalid supply level: ${level}`);
  }
  return SUPPLY_LEVELS[level - 1].weights;
}

/** Requisition cost to reach the next level, or null at the top. */
export function supplyCost(level) {
  return level < MAX_SUPPLY_LEVEL ? SUPPLY_LEVELS[level].cost : null;
}

/** Guard so a wrong table can never be shipped unnoticed. */
export const SUPPLY_WEIGHT_COUNT = MAX_RANK;
