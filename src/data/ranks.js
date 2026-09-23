// Tower ranks (GDD section 6). Ranks are 1-based numbers everywhere in the code:
// 1 = recruit ... 5 = legend. RANKS[rank - 1] holds the values.

// `color` is the rank's colour in the supply readout (GDD section 13). ART.md
// only fixes gold for the legend; the rest is a ramp from plain steel through
// bone and the toxic green up to rust, taken from the palette so the bars sit in
// the same world as everything else. Nothing in the simulation reads it.
export const RANKS = [
  { id: 'recruit', damage: 1, range: 1, color: '#c3bcae' },
  { id: 'veteran', damage: 2.2, range: 1.05, color: '#e8dcc0' },
  { id: 'elite', damage: 5, range: 1.1, color: '#9ccf4a' },
  { id: 'hero', damage: 12, range: 1.15, color: '#c9713f' },
  { id: 'legend', damage: 30, range: 1.2, color: '#f2c14e' },
];

/** Rank colours by rank number, for the HUD. */
export const RANK_COLORS = RANKS.map((r) => r.color);

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
