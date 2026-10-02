// The mode screen (M7a, A5): one card per mode, a difficulty row once there is
// more than one difficulty, and a separate "Los" that starts the match.
//
// Picking a card only marks it. Starting takes a second, deliberate press, so a
// slip of the finger on a tablet does not throw the player into the wrong mode.
// The screen exists only while more than one mode is offered; with one, "Neue
// Partie" starts straight away as it always did (menu.js decides).

import { STRINGS } from '../data/strings.js';
import { DIFFICULTIES, DEFAULT_CONFIG, runKey } from '../data/modes.js';
import { bestList } from '../storage/profile.js';

const T = STRINGS.menu;

/**
 * A small sketch of each map layout for its card (B9): the bastion as a red
 * block, rifts as purple marks, beacons as gold dots, the ban zone hatched.
 * Drawn from the layout, not per mode, so a new mode on a known layout has one.
 */
const SKETCHES = {
  chain: `
    <rect x="4" y="4" width="56" height="56" fill="#2e2620" stroke="#000" stroke-width="2"/>
    <path d="M14 8 L22 24 L44 34 L40 54" stroke="#e8c872" stroke-width="2" stroke-dasharray="4 3" fill="none"/>
    <ellipse cx="14" cy="8" rx="6" ry="3" fill="#8a5bc0" stroke="#000" stroke-width="1.5"/>
    <circle cx="22" cy="24" r="3" fill="#e8c872" stroke="#000" stroke-width="1.2"/>
    <circle cx="44" cy="34" r="3" fill="#e8c872" stroke="#000" stroke-width="1.2"/>
    <rect x="35" y="51" width="10" height="7" fill="#b2462e" stroke="#000" stroke-width="1.5"/>`,
  center: `
    <defs><pattern id="mode-ban" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <path d="M0 0 V4" stroke="#ff6a4a" stroke-width="1.4"/></pattern></defs>
    <rect x="4" y="4" width="56" height="56" fill="#2e2620" stroke="#000" stroke-width="2"/>
    <circle cx="32" cy="32" r="11" fill="url(#mode-ban)" stroke="#ff6a4a" stroke-width="1.2" stroke-dasharray="3 2"/>
    <rect x="27" y="27" width="10" height="10" fill="#b2462e" stroke="#000" stroke-width="1.5"/>
    <ellipse cx="32" cy="7" rx="6" ry="2.6" fill="#8a5bc0" stroke="#000" stroke-width="1.5"/>
    <ellipse cx="32" cy="57" rx="6" ry="2.6" fill="#8a5bc0" stroke="#000" stroke-width="1.5"/>
    <ellipse cx="7" cy="32" rx="2.6" ry="6" fill="#8a5bc0" stroke="#000" stroke-width="1.5"/>
    <ellipse cx="57" cy="32" rx="2.6" ry="6" fill="#8a5bc0" stroke="#000" stroke-width="1.5"/>`,
};

function sketch(mode) {
  const svg = SKETCHES[mode.map?.layout ?? 'chain'];
  if (!svg) return null;
  const box = el('span', 'mode-card-sketch');
  box.setAttribute('aria-hidden', 'true');
  box.innerHTML = `<svg viewBox="0 0 64 64" width="64" height="64">${svg}</svg>`;
  return box;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className, onClick) {
  const b = el('button', className, label);
  b.type = 'button';
  b.addEventListener('click', (ev) => {
    onClick(ev);
    b.blur();
  });
  return b;
}

/**
 * The configuration to preselect: the last one played, as long as this build
 * still offers its mode and knows its difficulty; otherwise the default.
 */
export function initialChoice(lastRun, modes) {
  const mode = modes.some((m) => m.id === lastRun?.mode) ? lastRun.mode : DEFAULT_CONFIG.mode;
  const difficulty = Object.hasOwn(DIFFICULTIES, lastRun?.difficulty) ? lastRun.difficulty : DEFAULT_CONFIG.difficulty;
  return { mode, difficulty };
}

/**
 * @param {HTMLElement} panel
 * @param {object} options
 * @param {object[]} options.modes  The selectable mode records.
 * @param {{values: object}} options.profile  For each card's best run.
 * @param {{values: object}} options.prefs  For the last configuration played.
 * @param {(config: {mode: string, difficulty: string}) => void} options.onGo
 * @param {() => void} options.onBack
 */
export function createModeScreen(panel, { modes, profile, prefs, onGo, onBack }) {
  let choice = initialChoice(prefs.values.lastRun, modes);

  panel.append(el('h2', 'menu-title', T.modeTitle));
  panel.append(el('p', 'menu-subtitle', T.modeIntro));

  const cards = el('div', 'mode-cards');
  cards.setAttribute('role', 'radiogroup');
  cards.setAttribute('aria-label', T.modeTitle);
  panel.append(cards);

  // Reserved now, shown once a second difficulty exists (A5).
  const difficultyRow = el('div', 'menu-choice mode-difficulty');
  difficultyRow.setAttribute('role', 'radiogroup');
  difficultyRow.setAttribute('aria-label', T.difficultyLabel);
  const difficulties = Object.values(DIFFICULTIES);
  difficultyRow.hidden = difficulties.length < 2;
  difficultyRow.append(el('span', 'menu-seed-label', T.difficultyLabel));
  const difficultyButtons = difficulties.map((d) => {
    const b = button(STRINGS.difficulties[d.id] ?? d.id, 'alt', () => {
      choice = { ...choice, difficulty: d.id };
      refresh();
    });
    b.dataset.difficulty = d.id;
    b.setAttribute('role', 'radio');
    difficultyRow.append(b);
    return b;
  });
  panel.append(difficultyRow);

  const actions = el('div', 'menu-actions');
  actions.append(
    button(T.modeGo, 'primary menu-primary', () => onGo({ ...choice })),
    button(T.back, 'alt', () => onBack()),
  );
  panel.append(actions);

  function bestLine(mode) {
    const best = bestList(profile.values, runKey(mode.id, mode.rev, choice.difficulty))[0];
    return best ? T.modeBest(best.score, best.wave) : T.modeNoRun;
  }

  function card(mode) {
    const picked = mode.id === choice.mode;
    const b = el('button', `mode-card${picked ? ' on' : ''}`);
    b.type = 'button';
    b.dataset.mode = mode.id;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(picked));
    const head = el('span', 'mode-card-head');
    head.append(el('span', 'mode-card-name', STRINGS.modes[mode.id]?.name ?? mode.id));
    if (mode.status === 'experimental') head.append(el('span', 'mode-card-badge', T.modeExperimental));
    b.append(head);
    const body = el('span', 'mode-card-body');
    const picture = sketch(mode);
    if (picture) body.append(picture);
    body.append(el('span', 'mode-card-desc', STRINGS.modes[mode.id]?.desc ?? ''));
    b.append(body);
    b.append(el('span', 'mode-card-best', bestLine(mode)));
    b.addEventListener('click', () => {
      choice = { ...choice, mode: mode.id };
      refresh();
      cards.querySelector(`[data-mode="${mode.id}"]`)?.focus();
    });
    return b;
  }

  function refresh() {
    cards.replaceChildren(...modes.map(card));
    cards.classList.toggle('is-many', modes.length > 4);
    for (const b of difficultyButtons) {
      const on = b.dataset.difficulty === choice.difficulty;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    }
  }

  refresh();

  return {
    /** Called every time the screen opens: the last run and the records may have moved. */
    refresh() {
      choice = initialChoice(prefs.values.lastRun, modes);
      refresh();
    },
    get choice() {
      return { ...choice };
    },
  };
}
