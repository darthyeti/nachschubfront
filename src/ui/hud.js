// DOM HUD above the canvas. Updates only touch the DOM when a value changed.

import { STRINGS } from '../data/strings.js';
import { GAME_SPEEDS } from '../data/settings.js';
import { RANK_COLORS } from '../data/ranks.js';
import { supplyWeights, MAX_SUPPLY_LEVEL } from '../data/supply.js';
import { previewRoute, zoneLimit } from '../sim/zones.js';
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
    if (b.dataset.heldOpen === '1') {
      // The long press already answered; swallow the click that follows it.
      delete b.dataset.heldOpen;
      return;
    }
    onClick(ev);
    // Give focus back, so Space keeps toggling pause instead of re-pressing this button.
    // (Not preventDefault on pointerdown: WebKit then drops the click after a touch.)
    b.blur();
  });
  return b;
}

/** Seconds a finger has to rest on a button before it counts as a long press. */
const LONG_PRESS_MS = 450;

/**
 * Explains a button on hover and on a long press. `title` alone would leave the
 * text out of reach on a tablet, and nothing may be hover-only (GDD section 13).
 */
function explain(b, text, show) {
  b.title = text;
  let timer = null;
  const cancel = () => {
    clearTimeout(timer);
    timer = null;
  };
  b.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse') return;
    timer = setTimeout(() => {
      timer = null;
      b.dataset.heldOpen = '1';
      show();
    }, LONG_PRESS_MS);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    b.addEventListener(type, cancel);
  }
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
  // The supply button says what it buys and what that changes (GDD section 13):
  // the level it moves to, the price, and the rank chances that follow, as bars
  // in the rank colours. The explanation hangs off `title`, so hovering is never
  // the only way to it: a long press on a touch device shows the same text.
  const buySupplyButton = button('', 'alt supply-button', () => onAction('buySupply'));
  const supplyLabel = el('span', 'supply-label');
  const supplyChances = el('span', 'supply-chances');
  supplyChances.setAttribute('aria-label', T.supplyChancesLabel);
  const supplyBars = RANK_COLORS.map((color, i) => {
    const bar = el('span', 'supply-bar');
    const fill = el('span', 'supply-bar-fill');
    fill.style.background = color;
    bar.append(fill);
    bar.title = STRINGS.ranks[i + 1];
    supplyChances.append(bar);
    return fill;
  });
  buySupplyButton.append(supplyLabel, supplyChances);
  explain(buySupplyButton, T.supplyHint, () => onAction('supplyHint'));
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
      set('buySupply', `${state.supplyLevel}/${supplyCost}`, () => {
        const top = supplyCost === null;
        supplyLabel.textContent = top
          ? T.supplyMax
          : T.buySupply(state.supplyLevel, state.supplyLevel + 1, supplyCost);
        // At the top there is no next level, so the bars show what is in force.
        const shown = supplyWeights(top ? MAX_SUPPLY_LEVEL : state.supplyLevel + 1);
        supplyBars.forEach((fill, i) => {
          fill.style.height = `${shown[i]}%`;
          fill.parentElement.title = T.supplyChance(STRINGS.ranks[i + 1], shown[i]);
        });
        supplyChances.setAttribute(
          'aria-label',
          `${T.supplyChancesLabel}: ${shown.map((p, i) => T.supplyChance(STRINGS.ranks[i + 1], p)).join(', ')}`,
        );
      });
      set('canBuySupply', canBuySupply(state).ok, (v) => (buySupplyButton.disabled = !v));
      const rubbleCost = nextRubbleCost(state);
      set('demolishCost', rubbleCost, (v) => (demolishButton.textContent = T.demolish(v)));
      set('canDemolish', state.phase === 'planning' && state.requisition >= rubbleCost, (v) => {
        demolishButton.disabled = !v;
      });
      set('demolishMode', ui.demolishMode, (v) => demolishButton.classList.toggle('on', v));
      // The salvo size changes with the wave, so the limit is part of the key.
      const limit = zoneLimit(state);
      set('zones', state.phase === 'planning' ? `${state.zones.length}/${limit}` : '', (v) => {
        zones.hidden = v === '';
        if (v !== '') zones.textContent = T.zones(...v.split('/'));
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
