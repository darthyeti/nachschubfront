// Rank marks for the selection panel (docs/ART.md, "Rangabzeichen im
// Auswahldialog"): a row of short horizontal strokes in the doctrine's guide
// colour, right beside the rank name. Recruit none, veteran one, elite two,
// hero three, legend four — the legend's four in gold instead.
//
// This replaces the hexagonal plaque with four star slots from v2 (update v3).
// No frame, no empty slots: the strokes stand free beside the text, which is
// too simple for a drawing and therefore lives in code.

import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { MAX_RANK } from '../data/ranks.js';

/** The legend's colour, from the palette of reference/stiltest.html. */
const GOLD = '#f2c14e';

/** Strokes a rank is worth: one fewer than the rank, so recruit shows none. */
export function markCount(rank) {
  return Math.max(0, rank - 1);
}

/**
 * The marks of a rank as markup. A string rather than DOM nodes, so the rule
 * can be tested without a browser; the panel drops it into the card.
 * @param {number} rank  1 (recruit) to 5 (legend).
 * @param {string} doctrine  Key of DOCTRINE_COLORS.
 */
export function rankMarks(rank, doctrine) {
  if (!(rank >= 1 && rank <= MAX_RANK)) throw new Error(`Invalid rank: ${rank}`);
  const colour = DOCTRINE_COLORS[doctrine];
  if (!colour) throw new Error(`Unknown doctrine: ${doctrine}`);
  const ink = rank >= MAX_RANK ? GOLD : colour;
  return `<span class="selection-rank-marks" style="--mark:${ink}">${'<i></i>'.repeat(markCount(rank))}</span>`;
}
