// The line of three buttons after a wave (M6, part 1): "zu leicht", "passt",
// "zu schwer".
//
// It exists because the numbers alone cannot say whether a wave felt right. A
// power curve and a bot both measure what happened; only the player can say how
// it felt, and the cheapest moment to ask is right after the wave, while it is
// still fresh.
//
// Three rules, from the order:
//   - Tapping is voluntary. Nothing waits for it, and it never blocks the way on.
//   - It is unobtrusive: one row above the bottom bar, gone as soon as the next
//     salvo is called.
//   - A switch in the settings turns it off.

import { el, button } from './controls.js';
import { STRINGS } from '../data/strings.js';

const T = STRINGS.rating;

/** The verdicts, in the order they are shown. They go into the protocol as-is. */
export const RATINGS = ['easy', 'fine', 'hard'];

/**
 * @param {HTMLElement} parent  The column above the bottom bar (hud.bottom).
 * @param {(wave: number, rating: string) => void} options.onRate
 */
export function createRatingRow(parent, { onRate }) {
  const row = el('div', 'hud-rating');
  row.hidden = true;
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', T.label);
  row.append(el('span', 'hud-rating-label', T.question));

  /** The wave the row is currently asking about; null when it is down. */
  let asking = null;

  const buttons = RATINGS.map((rating) => {
    const b = button(T.answers[rating], 'alt hud-rating-answer', () => {
      if (asking === null) return;
      const wave = asking;
      // Down before the callback: answering is the end of the question, whatever
      // the callback then does with it.
      hide();
      onRate(wave, rating);
    });
    b.dataset.rating = rating;
    row.append(b);
    return b;
  });

  function hide() {
    asking = null;
    row.hidden = true;
    for (const b of buttons) b.classList.remove('on');
  }

  // Above the bar, so the row is in thumb reach on a tablet and never covers the
  // map's middle. Prepended, because the selection panel belongs closest to the
  // bar it grew out of.
  parent.prepend(row);

  return {
    el: row,

    /** Asks about a wave. Asking again about the same one changes nothing. */
    ask(wave) {
      if (asking === wave) return;
      asking = wave;
      row.hidden = false;
      row.firstChild.textContent = T.questionFor(wave);
    },

    hide,

    /** True while the row is up, so the caller can leave it alone. */
    get asking() {
      return asking;
    },
  };
}
