// Rank badges for the selection panel (docs/ART.md, "Rangabzeichen im
// Auswahldialog"): a hexagonal plaque with four star slots, of which the rank's
// number are lit.
//
// These are the one place where a concept symbol is put into the DOM instead of
// onto the canvas. The panel is DOM already, the badge is not redrawn per frame,
// and as SVG it stays sharp at any display scale (decision M4d).

import { BADGE_SPRITES } from '../render/sprites/badges.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { MAX_RANK } from '../data/ranks.js';

/** The colour the sheet lights a star and draws the plaque's edge with. */
const SHEET_ACCENT = '#e8dcc0';

const GROUP = /<g\b[^>]*\bid="badge-(\d)"[^>]*>([\s\S]*?)<\/g>(?=<g\b[^>]*\bid="badge-|$)/g;

/** Pulls one badge group out of the shared library, so no id is used twice. */
function group(index) {
  GROUP.lastIndex = 0;
  for (let m = GROUP.exec(BADGE_SPRITES.defs); m; m = GROUP.exec(BADGE_SPRITES.defs)) {
    // The wrapper goes with its id, which would collide across the five cards.
    if (Number(m[1]) === index) return m[2];
  }
  throw new Error(`No artwork for badge-${index}`);
}

const cache = new Map();

/**
 * The badge of a rank as standalone SVG markup, in the doctrine's colour.
 * Legend keeps the sheet's gold instead (docs/ART.md).
 * @param {number} rank  1 (recruit) to 5 (legend).
 * @param {string} doctrine  Key of DOCTRINE_COLORS.
 */
export function badgeMarkup(rank, doctrine) {
  if (!(rank >= 1 && rank <= MAX_RANK)) throw new Error(`Invalid rank: ${rank}`);
  const colour = DOCTRINE_COLORS[doctrine];
  if (!colour) throw new Error(`Unknown doctrine: ${doctrine}`);
  const key = `${rank}:${doctrine}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const index = rank - 1;
  const body = rank >= MAX_RANK ? group(index) : group(index).replaceAll(SHEET_ACCENT, colour);
  const [x, y, w, h] = BADGE_SPRITES.symbols[`badge-${index}`].bbox;
  // The rank is written next to the badge, so it carries no meaning of its own.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" aria-hidden="true" focusable="false">` +
    `<style>${BADGE_SPRITES.style}</style>${body}</svg>`;
  cache.set(key, svg);
  return svg;
}
