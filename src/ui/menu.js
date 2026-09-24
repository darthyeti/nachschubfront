// The screens around the game: main menu, pause, settings and the end screen.
//
// All of them are the same overlay: a panel with ink edges over the running
// picture, so the battlefield stays visible behind them. Only one is open at a
// time; the game is paused while any of them is up.

import { STRINGS } from '../data/strings.js';
import { normalizeSeed, randomSeed } from '../core/seed.js';
import { PREF_DEFAULTS } from '../core/prefs.js';
import { createRecordsScreen } from './records.js';

const T = STRINGS.menu;
const TS = STRINGS.settings;
const TE = STRINGS.endScreen;
const TR = STRINGS.records;

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

/** A slider row: label, range input and the value as a percentage. */
function slider(label, value, onInput) {
  const row = el('label', 'menu-slider');
  row.append(el('span', 'menu-slider-label', label));
  const input = el('input');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '5';
  input.value = String(Math.round(value * 100));
  const readout = el('span', 'menu-slider-value', TS.percent(value));
  input.addEventListener('input', () => {
    const v = Number(input.value) / 100;
    readout.textContent = TS.percent(v);
    onInput(v);
  });
  row.append(input, readout);
  return { row, input, readout };
}

/**
 * One overlay with its panel. `name` becomes a data attribute so the stylesheet
 * can give each screen its own look.
 */
function createOverlay(root, name, label) {
  const overlay = el('div', 'menu interactive');
  overlay.hidden = true;
  overlay.dataset.menu = name;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', label);
  const panel = el('div', 'menu-panel');
  overlay.append(panel);
  root.append(overlay);
  return { overlay, panel };
}

/**
 * @param {HTMLElement} root
 * @param {object} options
 * @param {ReturnType<import('../core/prefs.js').createPrefs>} options.prefs
 * @param {(seed: string|null) => void} options.onStart  New match; null means a random seed.
 * @param {() => void} options.onResume
 * @param {(open: boolean) => void} options.onToggle  Called whenever a screen opens or closes.
 * @param {ReturnType<import('../storage/profile.js').createProfileStore>} options.profile
 * @param {boolean} options.canStore  False shows a warning in the settings.
 */
export function createMenus(root, { prefs, profile, onStart, onResume, onToggle, canStore = true }) {
  /** @type {'main'|'pause'|'settings'|'end'|null} */
  let open = null;
  /** Where "back" leads from the settings. */
  let settingsReturn = 'main';
  /** The same for the records screen, which the end screen also opens. */
  let recordsReturn = 'main';

  // ---------- Main menu ----------
  const main = createOverlay(root, 'main', STRINGS.gameTitle);
  main.panel.append(el('h1', 'menu-title', STRINGS.gameTitle));
  main.panel.append(el('p', 'menu-subtitle', T.subtitle));

  const seedRow = el('div', 'menu-seed');
  const seedLabel = el('label', 'menu-seed-label', T.seedLabel);
  const seedInput = el('input', 'menu-seed-input');
  seedInput.type = 'text';
  seedInput.maxLength = 12;
  seedInput.autocapitalize = 'characters';
  seedInput.spellcheck = false;
  seedInput.setAttribute('aria-label', T.seedLabel);
  seedLabel.append(seedInput);
  seedRow.append(seedLabel, button(T.seedRandom, 'alt', () => (seedInput.value = randomSeed())));
  main.panel.append(seedRow, el('p', 'menu-hint', T.seedHint));

  const mainActions = el('div', 'menu-actions');
  mainActions.append(
    button(T.start, 'primary menu-primary', () => {
      const typed = normalizeSeed(seedInput.value);
      close();
      onStart(typed);
    }),
    button(T.records, 'alt', () => show('records', 'main')),
    button(T.settings, 'alt', () => show('settings', 'main')),
  );
  main.panel.append(mainActions);
  main.panel.append(el('p', 'menu-howto', T.howTo));
  main.panel.append(el('p', 'menu-hint', T.hint));

  // ---------- Pause ----------
  const pause = createOverlay(root, 'pause', T.pauseTitle);
  pause.panel.append(el('h2', 'menu-title', T.pauseTitle));
  const pauseActions = el('div', 'menu-actions');
  pauseActions.append(
    button(T.resume, 'primary menu-primary', () => {
      close();
      onResume();
    }),
    button(T.settings, 'alt', () => show('settings', 'pause')),
    button(T.newGame, 'alt', () => {
      close();
      onStart(null);
    }),
    button(T.toMenu, 'alt', () => show('main')),
  );
  pause.panel.append(pauseActions, el('p', 'menu-hint', T.hint));

  // ---------- Settings ----------
  const settings = createOverlay(root, 'settings', TS.title);
  settings.panel.append(el('h2', 'menu-title', TS.title));
  settings.panel.append(el('h3', 'menu-section', TS.volumes));
  const sliders = {};
  for (const [key, label] of [
    ['master', TS.master],
    ['sfx', TS.sfx],
    ['music', TS.music],
  ]) {
    const made = slider(label, PREF_DEFAULTS[key], (v) => prefs.set(key, v));
    sliders[key] = made;
    settings.panel.append(made.row);
  }

  settings.panel.append(el('h3', 'menu-section', TS.motion));
  const motionGroup = el('div', 'menu-choice');
  motionGroup.setAttribute('role', 'group');
  motionGroup.setAttribute('aria-label', TS.motion);
  const motionButtons = [
    ['auto', TS.motionAuto],
    ['full', TS.motionFull],
    ['reduced', TS.motionReduced],
  ].map(([value, label]) => {
    const b = button(label, 'alt', () => prefs.set('motion', value));
    b.dataset.motion = value;
    motionGroup.append(b);
    return b;
  });
  settings.panel.append(motionGroup, el('p', 'menu-hint', TS.motionHint));
  if (!canStore) settings.panel.append(el('p', 'menu-warning', TS.storageWarning));
  const settingsActions = el('div', 'menu-actions');
  settingsActions.append(button(T.back, 'primary menu-primary', () => show(settingsReturn)));
  settings.panel.append(settingsActions);

  /** Mirrors the stored settings into the controls. */
  function syncSettings(values) {
    for (const [key, made] of Object.entries(sliders)) {
      made.input.value = String(Math.round(values[key] * 100));
      made.readout.textContent = TS.percent(values[key]);
    }
    for (const b of motionButtons) b.classList.toggle('on', b.dataset.motion === values.motion);
  }
  prefs.onChange(syncSettings);
  syncSettings(prefs.values);

  // ---------- Records ----------
  // Its own module: the table, the statistics and the transfer are enough code
  // to crowd this file out.
  const records = createOverlay(root, 'records', TR.title);
  const recordsScreen = createRecordsScreen(records.panel, {
    profile,
    canStore,
    onSeed(seed) {
      seedInput.value = seed;
      show('main');
    },
    onBack: () => show(recordsReturn),
  });

  // ---------- End screen ----------
  const end = createOverlay(root, 'end', TE.victory);
  const endTitle = el('h2', 'menu-title');
  const endDetail = el('p', 'menu-subtitle');
  const endScore = el('dl', 'menu-score');
  // One line under the score: either the new record or the one still standing.
  const endRecord = el('p', 'menu-record');
  const endActions = el('div', 'menu-actions');
  let endSeed = null;
  endActions.append(
    button(TE.again, 'primary menu-primary', () => {
      close();
      onStart(null);
    }),
    button(TE.sameSeed, 'alt', () => {
      close();
      onStart(endSeed);
    }),
    button(TE.records, 'alt', () => show('records', 'end')),
    button(T.toMenu, 'alt', () => show('main')),
  );
  end.panel.append(endTitle, endDetail, endScore, endRecord, endActions);

  const screens = { main, pause, settings, records, end };

  function show(name, from) {
    if (from) {
      if (name === 'records') recordsReturn = from;
      else settingsReturn = from;
    }
    if (name === 'records') recordsScreen.refresh();
    for (const [key, screen] of Object.entries(screens)) screen.overlay.hidden = key !== name;
    const wasOpen = open !== null;
    open = name;
    if (!wasOpen) onToggle?.(true);
    // The main action first, so Enter does the obvious thing.
    const panel = screens[name].panel;
    (panel.querySelector('.menu-primary') ?? panel.querySelector('button'))?.focus();
  }

  function close() {
    for (const screen of Object.values(screens)) screen.overlay.hidden = true;
    if (open !== null) onToggle?.(false);
    open = null;
  }

  // A tap beside the panel resumes, but only where that is safe: the main menu
  // and the end screen have no game to go back to.
  for (const [name, screen] of Object.entries(screens)) {
    screen.overlay.addEventListener('click', (ev) => {
      if (ev.target !== screen.overlay) return;
      if (name === 'pause') {
        close();
        onResume();
      } else if (name === 'settings') {
        show(settingsReturn);
      } else if (name === 'records') {
        show(recordsReturn);
      }
    });
  }

  return {
    get open() {
      return open;
    },
    show,
    close,
    /** Opens the pause screen; used by Escape and the HUD. */
    togglePause() {
      if (open === 'pause') {
        close();
        onResume();
      } else if (open === null) {
        show('pause');
      }
    },
    /** Shows the result of a finished match. */
    showEnd({ victory, wave, seed, lines, record = null, previousBest = null }) {
      endSeed = seed;
      endTitle.textContent = victory ? TE.victory : TE.defeat;
      endDetail.textContent = victory ? TE.victoryDetail : TE.defeatDetail(wave);
      end.overlay.dataset.result = victory ? 'victory' : 'defeat';
      endScore.replaceChildren();
      for (const [label, value] of lines) {
        endScore.append(el('dt', null, label), el('dd', null, String(value)));
      }
      endRecord.textContent =
        record === 'new' ? TE.newRecord : previousBest !== null ? TE.previousBest(previousBest) : '';
      endRecord.classList.toggle('is-record', record === 'new');
      show('end');
    },
    /** Fills the seed field, e.g. with the seed of the running match. */
    setSeed(seed) {
      seedInput.value = seed ?? '';
    },
  };
}
