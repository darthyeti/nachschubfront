// Tower ranks (GDD section 6). Ranks are 1-based numbers everywhere in the code:
// 1 = recruit ... 5 = legend. RANKS[rank - 1] holds the values.

export const RANKS = [
  { id: 'recruit', damage: 1, range: 1 },
  { id: 'veteran', damage: 2.2, range: 1.05 },
  { id: 'elite', damage: 5, range: 1.1 },
  { id: 'hero', damage: 12, range: 1.15 },
  { id: 'legend', damage: 30, range: 1.2 },
];

export const MIN_RANK = 1;
export const MAX_RANK = RANKS.length;

export function isRank(rank) {
  return Number.isInteger(rank) && rank >= MIN_RANK && rank <= MAX_RANK;
}

/** Values of a rank; throws for anything outside 1..5. */
export function rankStats(rank) {
  if (!isRank(rank)) throw new RangeError(`Invalid rank: ${rank}`);
  return RANKS[rank - 1];
}
