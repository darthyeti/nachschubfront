// DOM HUD above the canvas. Updates only touch the DOM when a value changed.

import { STRINGS } from '../data/strings.js';
import { GAME_SPEEDS } from '../data/settings.js';
import { PODS } from '../data/pods.js';
import { previewRoute } from '../sim/zones.js';
import { canBuySupply, nextSupplyCost, nextRubbleCost } from '../sim/economy.js';

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
  b.addEventListener('click', (ev) => {
    onClick(ev);
    // Give focus back, so Space keeps toggling pause instead of re-pressing this button.
    // (Not preventDefault on pointerdown: WebKit then drops the click after a touch.)
    b.blur();
  });
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
  const zones = el('span', 'chip chip-zones');
  const supply = el('span', 'chip');
  const requisition = el('span', 'chip chip-requisition');
  const points = el('span', 'chip');
  points.title = T.commandPointsTitle;
  info.append(zones, supply, requisition, points, route, seed);

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
  const start = button(T.requestSalvo, 'primary', () => onAction('requestSalvo'));
  const restart = button(T.newGame, 'primary', () => onAction('newGame'));
  const codex = button(T.codex, 'alt', () => onAction('codex'));
  const menu = button(T.menu, 'alt', () => onAction('menu'));
  const buySupplyButton = button(T.buySupply(0), 'alt', () => onAction('buySupply'));
  const demolishButton = button(T.demolish(0), 'alt', () => onAction('demolishMode'));
  bar.append(speedGroup, start, restart, buySupplyButton, demolishButton, codex, menu);

  let obstacleButton = null;
  let artButton = null;
  let stressButton = null;
  let supplyButton = null;
  if (debug) {
    obstacleButton = button(T.obstacleMode, 'alt', () => onAction('obstacleMode'));
    artButton = button(T.artSprites, 'alt', () => onAction('toggleArt'));
    stressButton = button(T.stress, 'alt', () => onAction('stress'));
    supplyButton = button(T.supply(1), 'alt', () => onAction('supplyLevel'));
    bar.append(obstacleButton, artButton, stressButton, supplyButton);
  }

  const banner = el('div', 'hud-banner');
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  // The headline is a text node next to the detail line, so setting one never
  // touches the other.
  const bannerText = document.createTextNode('');
  const bannerDetail = el('div', 'hud-banner-detail');
  banner.append(bannerText, bannerDetail);

  let debugEl = null;
  if (debug) {
    debugEl = el('div', 'hud-debug');
  }

  // Bottom column: the selection panel sits above the bar and can never overlap it.
  const bottom = el('div', 'hud-bottom');
  bottom.append(bar);

  root.append(top, info, bottom, banner);
  if (debugEl) root.append(debugEl);

  const cache = new Map();
  const set = (key, value, apply) => {
    if (cache.get(key) === value) return;
    cache.set(key, value);
    apply(value);
  };

  return {
    /** Column above the bottom bar; panels insert themselves here. */
    bottom,

    /** Syncs the HUD with game state and render-side UI state. */
    update(state, ui, { totalWaves, canStart }) {
      set('wave', `${state.wave}/${totalWaves}`, (v) => (wave.textContent = `${T.wave} ${v}`));
      set('lives', state.lives, (v) => (lives.textContent = `${T.lives} ${v}`));
      set('phase', state.phase, (v) => {
        phase.textContent = STRINGS.phases[v];
        phase.dataset.phase = v;
      });
      set('seed', state.seed, (v) => (seed.textContent = `${T.seed} ${v}`));
      const shown = previewRoute(state);
      const routeText = shown ? T.route(Math.round(shown.length)) : T.routeBlocked;
      set('route', routeText, (v) => (route.textContent = v));
      set('supply', state.supplyLevel, (v) => (supply.textContent = T.supply(v)));
      set('requisition', state.requisition, (v) => (requisition.textContent = T.requisition(v)));
      set('points', state.commandPoints, (v) => (points.textContent = T.commandPoints(v)));
      const supplyCost = nextSupplyCost(state);
      set('buySupply', supplyCost, (v) => (buySupplyButton.textContent = v === null ? T.supplyMax : T.buySupply(v)));
      set('canBuySupply', canBuySupply(state).ok, (v) => (buySupplyButton.disabled = !v));
      const rubbleCost = nextRubbleCost(state);
      set('demolishCost', rubbleCost, (v) => (demolishButton.textContent = T.demolish(v)));
      set('canDemolish', state.phase === 'planning' && state.requisition >= rubbleCost, (v) => {
        demolishButton.disabled = !v;
      });
      set('demolishMode', ui.demolishMode, (v) => demolishButton.classList.toggle('on', v));
      set('zones', state.phase === 'planning' ? state.zones.length : -1, (v) => {
        zones.hidden = v < 0;
        if (v >= 0) zones.textContent = T.zones(v, PODS.perSalvo);
      });
      set('speed', state.speed, (v) => {
        for (const b of speedButtons) b.classList.toggle('on', Number(b.dataset.speed) === v);
      });
      const over = state.phase === 'defeat' || state.phase === 'victory';
      set('canStart', canStart, (v) => (start.disabled = !v));
      set('over', over, (v) => {
        start.hidden = v;
        restart.hidden = !v;
        buySupplyButton.hidden = v;
        demolishButton.hidden = v;
      });
      if (obstacleButton) set('obstacleMode', ui.obstacleMode, (v) => obstacleButton.classList.toggle('on', v));
      if (artButton) set('art', ui.art, (v) => (artButton.textContent = v === 'sprites' ? T.artSprites : T.artPlaceholder));
      if (supplyButton) set('supplyButton', state.supplyLevel, (v) => (supplyButton.textContent = T.supply(v)));
      if (stressButton) {
        set('stress', state.stress, (v) => {
          stressButton.textContent = v ? T.stressOn : T.stress;
          stressButton.classList.toggle('on', v);
        });
      }
      set('banner', ui.banner?.text ?? '', (v) => {
        bannerText.nodeValue = v;
        banner.classList.toggle('show', v !== '');
      });
      set('bannerDetail', ui.banner?.detail ?? '', (v) => (bannerDetail.textContent = v));
    },

    updateDebug({ fps, frameMs, enemies, view }) {
      if (!debugEl) return;
      const t = STRINGS.debug;
      debugEl.textContent =
        `${fps} ${t.fps} · ${t.frameTime(frameMs.toFixed(1))} · ${t.enemies(enemies)} · ` +
        `${t.canvas} ${view.width}×${view.height} @${view.dpr}x`;
    },
  };
}
