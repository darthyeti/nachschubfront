// DOM HUD above the canvas. Updates only touch the DOM when a value changed.

import { STRINGS } from '../data/strings.js';
import { GAME_SPEEDS } from '../data/settings.js';

const T = STRINGS.hud;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className, onClick) {
  const b = el('button', className, label);
  b.type = 'button';
  b.classList.add('interactive');
  b.addEventListener('click', onClick);
  // Keep buttons from stealing keyboard focus, so Space still toggles pause.
  b.addEventListener('pointerdown', (ev) => ev.preventDefault());
  return b;
}

/**
 * @param {HTMLElement} root
 * @param {{debug: boolean, onAction: (action: string) => void}} options
 */
export function createHud(root, { debug, onAction }) {
  // Top left: title and match stats.
  const top = el('div', 'hud-top');
  const title = el('h1', 'hud-title', STRINGS.gameTitle);
  const stats = el('div', 'hud-stats');
  const wave = el('span', 'chip');
  const lives = el('span', 'chip chip-lives');
  const phase = el('span', 'chip chip-phase');
  stats.append(wave, lives, phase);
  top.append(title, stats);

  // Top right: seed and route length.
  const info = el('div', 'hud-info');
  const seed = el('span', 'chip');
  const route = el('span', 'chip');
  info.append(route, seed);

  // Bottom: speed controls and the main action.
  const bar = el('div', 'hud-bar');
  const speedGroup = el('div', 'speed-group');
  speedGroup.setAttribute('role', 'group');
  speedGroup.setAttribute('aria-label', T.speedGroup);
  const speedButtons = GAME_SPEEDS.map((s) => {
    const b = button(s === 0 ? T.pause : T.speed(s), 'alt', () => onAction(`speed${s}`));
    b.dataset.speed = String(s);
    speedGroup.append(b);
    return b;
  });
  const start = button(T.startWave, 'primary', () => onAction('startWave'));
  const restart = button(T.newGame, 'primary', () => onAction('newGame'));
  bar.append(speedGroup, start, restart);

  let obstacleButton = null;
  let artButton = null;
  let stressButton = null;
  if (debug) {
    obstacleButton = button(T.obstacleMode, 'alt', () => onAction('obstacleMode'));
    artButton = button(T.artSprites, 'alt', () => onAction('toggleArt'));
    stressButton = button(T.stress, 'alt', () => onAction('stress'));
    bar.append(obstacleButton, artButton, stressButton);
  }

  const banner = el('div', 'hud-banner');
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');

  let debugEl = null;
  if (debug) {
    debugEl = el('div', 'hud-debug');
  }

  root.append(top, info, bar, banner);
  if (debugEl) root.append(debugEl);

  const cache = new Map();
  const set = (key, value, apply) => {
    if (cache.get(key) === value) return;
    cache.set(key, value);
    apply(value);
  };

  return {
    /** Syncs the HUD with game state and render-side UI state. */
    update(state, ui, { totalWaves, canStart }) {
      set('wave', `${state.wave}/${totalWaves}`, (v) => (wave.textContent = `${T.wave} ${v}`));
      set('lives', state.lives, (v) => (lives.textContent = `${T.lives} ${v}`));
      set('phase', state.phase, (v) => {
        phase.textContent = STRINGS.phases[v];
        phase.dataset.phase = v;
      });
      set('seed', state.seed, (v) => (seed.textContent = `${T.seed} ${v}`));
      const routeText = state.route ? T.route(Math.round(state.route.length)) : T.routeBlocked;
      set('route', routeText, (v) => (route.textContent = v));
      set('speed', state.speed, (v) => {
        for (const b of speedButtons) b.classList.toggle('on', Number(b.dataset.speed) === v);
      });
      const over = state.phase === 'defeat' || state.phase === 'victory';
      set('canStart', canStart, (v) => (start.disabled = !v));
      set('over', over, (v) => {
        start.hidden = v;
        restart.hidden = !v;
      });
      if (obstacleButton) set('obstacleMode', ui.obstacleMode, (v) => obstacleButton.classList.toggle('on', v));
      if (artButton) set('art', ui.art, (v) => (artButton.textContent = v === 'sprites' ? T.artSprites : T.artPlaceholder));
      if (stressButton) {
        set('stress', state.stress, (v) => {
          stressButton.textContent = v ? T.stressOn : T.stress;
          stressButton.classList.toggle('on', v);
        });
      }
      set('banner', ui.banner?.text ?? '', (v) => {
        banner.textContent = v;
        banner.classList.toggle('show', v !== '');
      });
    },

    updateDebug({ fps, tick, view }) {
      if (!debugEl) return;
      const t = STRINGS.debug;
      debugEl.textContent =
        `${fps} ${t.fps} · ${t.steps} ${tick} · ` +
        `${t.canvas} ${view.width}×${view.height} @${view.dpr}x`;
    },
  };
}
