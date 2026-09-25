// DOM HUD above the canvas. Updates only touch the DOM when a value changed.

import { STRINGS } from '../data/strings.js';
import { el, button, explain } from './controls.js';
import { createRuneButton } from './runeButton.js';
import { icon } from './icons.js';
import { APP_VERSION } from '../data/version.js';
import { GAME_SPEEDS } from '../data/settings.js';
import { RANK_COLORS } from '../data/ranks.js';
import { supplyWeights, MAX_SUPPLY_LEVEL } from '../data/supply.js';
import { previewRoute, zoneLimit } from '../sim/zones.js';
import { canBuySupply, nextSupplyCost, nextRubbleCost, nextBulwarkCost } from '../sim/economy.js';

const T = STRINGS.hud;

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
  // The Koloss run, when one is announced. It rides with the match chips rather
  // than beside the title: the left group is as wide as the title makes it, and
  // a fourth chip there runs into this one on a tablet.
  const koloss = el('div', 'chip chip-koloss');
  koloss.hidden = true;
  const seed = el('span', 'chip');
  const route = el('span', 'chip');
  const zones = el('span', 'chip chip-zones');
  const supply = el('span', 'chip');
  const requisition = el('span', 'chip chip-requisition');
  const points = el('span', 'chip');
  points.title = T.commandPointsTitle;
  info.append(koloss, zones, supply, requisition, points, route, seed);

  // Bottom: the rune discs, the main action, the speed group (docs/ART.md,
  // "Untere Leiste").
  const bar = el('div', 'hud-bar');
  const speedGroup = el('div', 'speed-group');
  speedGroup.setAttribute('role', 'group');
  speedGroup.setAttribute('aria-label', T.speedGroup);
  const speedButtons = GAME_SPEEDS.map((s) => {
    const b = button(s === 0 ? T.pause : T.speed(s), 'alt speed', () => onAction(`speed${s}`));
    b.dataset.speed = String(s);
    speedGroup.append(b);
    return b;
  });

  // The main action keeps its size and its word: it is what every round is
  // about, and the only round button with a label.
  const start = el('button', 'salvo primary interactive');
  start.type = 'button';
  start.setAttribute('aria-label', T.requestSalvo);
  const startZones = el('span', 'salvo-zones');
  start.append(icon('salvo', 'salvo-icon'), el('span', 'salvo-label', T.requestSalvoShort), startZones);
  start.addEventListener('click', () => {
    onAction('requestSalvo');
    start.blur();
  });
  const restart = button(T.newGame, 'primary', () => onAction('newGame'));

  // The supply disc carries the level as a badge and the price under it; what
  // the next level buys is in its bubble, in the rank colours.
  const supplyChances = el('span', 'supply-chances');
  supplyChances.setAttribute('aria-label', T.supplyChancesLabel);
  const supplyBars = RANK_COLORS.map((color, i) => {
    const track = el('span', 'supply-bar');
    const fill = el('span', 'supply-bar-fill');
    fill.style.background = color;
    track.append(fill);
    track.title = STRINGS.ranks[i + 1];
    supplyChances.append(track);
    return fill;
  });
  const supplyDisc = createRuneButton({
    iconName: 'supply',
    label: T.supplyName,
    hint: T.supplyHint,
    bubbleExtra: supplyChances,
    onClick: () => onAction('buySupply'),
  });
  const demolishDisc = createRuneButton({
    iconName: 'demolish',
    label: T.demolishName,
    hint: T.demolishHint,
    onClick: () => onAction('demolishMode'),
  });
  // Beside the demolish disc because the two are the same gesture on the same
  // cells: one clears a heap, the other builds it up (GDD section 10).
  const bulwarkDisc = createRuneButton({
    iconName: 'bulwark',
    label: T.bulwarkName,
    hint: T.bulwarkHint,
    onClick: () => onAction('bulwarkMode'),
  });

  const groundGroup = el('div', 'rune-group');
  groundGroup.append(supplyDisc.el, demolishDisc.el, bulwarkDisc.el);

  const codex = button(T.codex, 'alt', () => onAction('codex'));
  const menu = button(T.menu, 'alt', () => onAction('menu'));
  bar.append(groundGroup, start, restart, speedGroup, codex, menu);

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

  // Version in the bottom left corner: quiet, but always readable, so a bug
  // report can say which build it happened on.
  const version = el('div', 'hud-version', STRINGS.version(APP_VERSION));

  root.append(top, info, bottom, banner, version);
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
      const supplyTop = supplyCost === null;
      set('buySupply', `${state.supplyLevel}/${supplyCost}`, () => {
        supplyDisc.setHint(
          supplyTop
            ? `${T.supplyMax} ${T.supplyHint}`
            : `${T.buySupply(state.supplyLevel, state.supplyLevel + 1, supplyCost)} — ${T.supplyHint}`,
        );
        // At the top there is no next level, so the bars show what is in force.
        const weights = supplyWeights(supplyTop ? MAX_SUPPLY_LEVEL : state.supplyLevel + 1);
        supplyBars.forEach((fill, i) => {
          fill.style.height = `${weights[i]}%`;
          fill.parentElement.title = T.supplyChance(STRINGS.ranks[i + 1], weights[i]);
        });
        supplyChances.setAttribute(
          'aria-label',
          `${T.supplyChancesLabel}: ${weights.map((w, i) => T.supplyChance(STRINGS.ranks[i + 1], w)).join(', ')}`,
        );
      });
      supplyDisc.update({
        state: 'ready',
        badge: String(state.supplyLevel),
        note: supplyTop ? null : String(supplyCost),
        enabled: canBuySupply(state).ok,
      });

      // Affording a demolition is a condition for *entering* the mode, never for
      // leaving it: with the disc greyed out and no keyboard, an empty purse
      // used to lock the player inside the mode.
      const rubbleCost = nextRubbleCost(state);
      const canEnterDemolish = state.phase === 'planning' && state.requisition >= rubbleCost;
      demolishDisc.update({
        state: 'ready',
        note: String(rubbleCost),
        enabled: canEnterDemolish || ui.demolishMode,
        on: ui.demolishMode,
      });

      // Same rule as the demolish disc: the purse guards the way in, never out.
      const bulwarkPrice = nextBulwarkCost(state);
      const canEnterBulwark = state.phase === 'planning' && state.requisition >= bulwarkPrice;
      bulwarkDisc.update({
        state: 'ready',
        note: String(bulwarkPrice),
        enabled: canEnterBulwark || ui.bulwarkMode,
        on: ui.bulwarkMode,
      });

      const run = state.koloss;
      const away = run ? Math.max(0, run.wave - (state.phase === 'planning' ? state.wave + 1 : state.wave)) : null;
      set('koloss', run ? `${run.stage}:${away}` : '', (v) => {
        koloss.hidden = v === '';
        if (v === '') return;
        koloss.textContent = STRINGS.koloss.chip(away);
        koloss.dataset.stage = run.stage;
      });

      // The zone counter rides on the salvo button now, not in the status bar:
      // it belongs to the action it counts down to (docs/ART.md, "Untere Leiste").
      const limit = zoneLimit(state);
      set('zones', state.phase === 'planning' ? `${state.zones.length}/${limit}` : '', (v) => {
        startZones.hidden = v === '';
        zones.hidden = v === '';
        if (v === '') return;
        startZones.textContent = v;
        // The button keeps its plain name; the count speaks for itself.
        startZones.setAttribute('aria-label', T.zones(...v.split('/')));
        zones.textContent = T.zones(...v.split('/'));
      });
      set('speed', state.speed, (v) => {
        for (const b of speedButtons) b.classList.toggle('on', Number(b.dataset.speed) === v);
      });
      const over = state.phase === 'defeat' || state.phase === 'victory';
      set('canStart', canStart, (v) => (start.disabled = !v));
      set('over', over, (v) => {
        start.hidden = v;
        restart.hidden = !v;
        groundGroup.hidden = v;
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
