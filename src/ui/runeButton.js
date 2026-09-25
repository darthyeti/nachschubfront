// The rune disc: the one fitting every icon button in the running game wears
// (docs/ART.md, "Runenscheiben-Knopf"). Dark stone core, thin gold rim, ten
// runes cut into the band, the symbol on top.
//
// Three states, the same for every disc: ready, cooling down (a dark wedge over
// the disc and the waves left in the middle), and locked (the whole disc dimmed
// behind a padlock, with the unlock wave on a gold badge).
//
// Pressing fires. Resting a finger on it — or, with a mouse, hovering — opens
// the explanation as a speech bubble instead; the press that opened it does not
// also fire (GDD section 13: nothing may be reachable by hover alone).

import { STRINGS } from '../data/strings.js';
import { el, explain } from './controls.js';
import { icon } from './icons.js';

const T = STRINGS.rune;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** How long a newly unlocked disc shows its name before falling silent again. */
const FLASH_MS = 2600;

/** How long a bubble opened by a finger stays; a mouse closes it by leaving. */
const BUBBLE_MS = 4000;

/**
 * The face of a disc, as the HUD hands it over. Everything the disc shows is
 * in here, so the same component serves a command, the supply and the two
 * ground modes.
 *
 * @typedef {object} RuneFace
 * @property {'ready'|'cooldown'|'locked'} state
 * @property {number|null} [waves]    waves left, shown in the middle while cooling down
 * @property {number} [fraction]     how much of the wait is left, for the wedge (0 to 1)
 * @property {string|null} [badge]    gold badge top right: supply level, or the unlock wave
 * @property {string|null} [note]     small line under the disc, normally the price
 * @property {boolean} [enabled]      false greys the disc out without changing its state
 * @property {boolean} [on]           the mode this disc switches is currently running
 */

/**
 * The face of a special command, from `commandStatus()` (sim/commands.js).
 * Kept apart from the DOM so the three states can be checked without a browser.
 *
 * @param {{unlocked: boolean, ready: boolean, wavesLeft: number, usable: boolean,
 *          command: {fromWave: number, cost: number}}} status
 * @returns {RuneFace}
 */
export function commandFace(status) {
  const { command } = status;
  if (!status.unlocked) {
    return { state: 'locked', badge: String(command.fromWave), note: null, enabled: false };
  }
  if (!status.ready) {
    const total = command.cooldownWaves || 1;
    return {
      state: 'cooldown',
      waves: status.wavesLeft,
      fraction: Math.min(1, Math.max(0, status.wavesLeft / total)),
      note: null,
      enabled: false,
    };
  }
  return { state: 'ready', note: String(command.cost), enabled: status.usable };
}

/** The ten runes cut into the band, alternating, as on the sheet. */
function runeBand() {
  const marks = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + Math.cos(a) * 39;
    const y = 50 + Math.sin(a) * 39;
    const d =
      i % 2 === 0
        ? `M${x - 3.4} ${y} h6.8 M${x} ${y - 3.4} v6.8`
        : `M${x - 3} ${y - 3} l6 6 M${x + 3} ${y - 3} l-6 6`;
    marks.push(`<path d="${d}"/>`);
  }
  return marks.join('');
}

function disc() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'rune-plate');
  svg.innerHTML =
    '<circle cx="50" cy="50" r="47" fill="#453b32" stroke="#1a1410" stroke-width="3"/>' +
    '<circle cx="50" cy="50" r="30" fill="#3a322b" stroke="none"/>' +
    `<g stroke="#8a5bc0" stroke-width="2.4" stroke-linecap="round" fill="none">${runeBand()}</g>` +
    '<circle cx="50" cy="50" r="45.5" fill="none" stroke="#e8c872" stroke-width="2.6"/>';
  return svg;
}

/**
 * @param {object} options
 * @param {string} options.iconName    key in ui/icons.js
 * @param {string} options.label       the disc's name, for the bubble and screen readers
 * @param {string} options.hint        the sentence the bubble explains it with
 * @param {Node} [options.bubbleExtra] more for the bubble below the sentence, e.g. the rank bars
 * @param {'top'|'left'} [options.side] where the bubble opens; the right-hand rail needs 'left'
 * @param {() => void} options.onClick
 */
export function createRuneButton({ iconName, label, hint, bubbleExtra, side = 'top', onClick }) {
  const b = el('button', 'rune interactive');
  b.type = 'button';
  b.dataset.side = side;

  const face = el('span', 'rune-disc');
  face.append(disc(), icon(iconName, 'rune-symbol'));
  const pie = el('span', 'rune-pie');
  const waves = el('span', 'rune-waves');
  const lock = icon('lock', 'rune-lock');
  const badge = el('span', 'rune-badge');
  face.append(pie, waves, lock, badge);

  const note = el('span', 'rune-note');
  const flash = el('span', 'rune-flash', label);
  const bubble = el('span', 'rune-bubble');
  bubble.setAttribute('role', 'tooltip');
  const bubbleText = el('span', null, hint);
  bubble.append(el('b', null, label), bubbleText);
  if (bubbleExtra) bubble.append(bubbleExtra);
  b.append(face, note, flash, bubble);

  b.addEventListener('click', () => {
    if (b.dataset.heldOpen === '1') {
      // The long press answered with the bubble; it must not also fire.
      delete b.dataset.heldOpen;
      return;
    }
    onClick();
    b.blur();
  });

  let bubbleTimer = null;
  const hideBubble = () => {
    clearTimeout(bubbleTimer);
    bubbleTimer = null;
    b.classList.remove('explaining');
  };
  const showBubble = () => {
    clearTimeout(bubbleTimer);
    b.classList.add('explaining');
    // A finger has nothing to leave with, so the bubble closes itself.
    bubbleTimer = setTimeout(hideBubble, BUBBLE_MS);
  };
  explain(b, { show: showBubble, hide: hideBubble });

  let flashTimer = null;
  /** @type {RuneFace|null} */
  let shown = null;

  return {
    el: b,

    /** Closes the bubble from outside, when something else takes the screen. */
    hideBubble,

    /** The sentence in the bubble, for a disc whose explanation moves with the match. */
    setHint(text) {
      if (bubbleText.textContent !== text) bubbleText.textContent = text;
    },

    /** @param {RuneFace} next */
    update(next) {
      const key = JSON.stringify(next);
      if (shown && JSON.stringify(shown) === key) return;
      const was = shown;
      shown = next;

      b.dataset.state = next.state;
      b.disabled = next.enabled === false;
      b.classList.toggle('on', next.on === true);

      const waveText = next.state === 'cooldown' && next.waves != null ? String(next.waves) : '';
      waves.textContent = waveText;
      waves.hidden = waveText === '';
      // The wedge shrinks with the wait. A cooldown is counted in whole waves,
      // so it steps rather than sweeps.
      pie.hidden = next.state !== 'cooldown';
      pie.style.setProperty('--pie', `${Math.round((next.fraction ?? 1) * 100)}%`);

      lock.style.display = next.state === 'locked' ? '' : 'none';
      badge.textContent = next.badge ?? '';
      badge.hidden = !next.badge;
      note.textContent = next.note ?? '';
      note.hidden = !next.note;

      let name = label;
      if (next.state === 'locked' && next.badge) name = T.lockedLabel(label, next.badge);
      else if (next.state === 'cooldown' && waveText) name = T.cooldownLabel(label, waveText);
      b.setAttribute('aria-label', name);

      // Freshly unlocked: say the name once, unasked, then fall silent.
      if (was && was.state === 'locked' && next.state !== 'locked') {
        clearTimeout(flashTimer);
        b.classList.add('flashing');
        flashTimer = setTimeout(() => b.classList.remove('flashing'), FLASH_MS);
      }
    },
  };
}
