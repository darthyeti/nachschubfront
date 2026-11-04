// DOM HUD above the canvas. Updates only touch the DOM when a value changed.

import { upgradeKind } from '../sim/selection.js';
import { canUpgradeTower } from '../sim/actions.js';
import { riftForWave } from '../sim/rifts.js';
import { STRINGS } from '../data/strings.js';
import { el, button, explain } from './controls.js';
import { createRuneButton } from './runeButton.js';
import { icon } from './icons.js';
import { createHelp } from './help.js';
import { APP_VERSION } from '../data/version.js';
import { RANK_COLORS } from '../data/ranks.js';
import { supplyWeights, MAX_SUPPLY_LEVEL } from '../data/supply.js';
import { previewRoute, zoneLimit } from '../sim/zones.js';
import { canBuySupply, nextSupplyCost, nextRubbleCost, nextBulwarkCost } from '../sim/economy.js';
import { supplyCalls } from './nudges.js';
import { pointsVisible } from './commands.js';
import { burst } from './burst.js';
import { RULES } from '../data/rules.js';

const T = STRINGS.hud;

/**
 * @param {HTMLElement} root
 * @param {{debug: boolean, onAction: (action: string) => void, onUnlock?: () => void,
 *         onFold?: (folded: boolean) => void}} options
 *        `onUnlock` is for the sound that goes with the bang of an unlocked symbol,
 *        `onFold` hears the player fold or unfold the phone's status bar so it can be remembered
 */
export function createHud(root, { debug, onAction, onUnlock = () => {}, onFold = () => {} }) {
  // One riveted plate bar across the top, the values in sections (docs/ART.md,
  // "Obere Statusleiste"). Seed and phase are not in it: they live in the pause
  // screen now, so six fields still fit on a tablet in landscape.
  const top = el('div', 'hud-top');
  const leftPlates = el('div', 'plate-row');
  const rightPlates = el('div', 'plate-row');
  top.append(leftPlates, rightPlates);

  const title = el('div', 'plate plate-title');
  title.append(el('h1', 'hud-title', STRINGS.gameTitle));
  leftPlates.append(title);

  /** One plate: a symbol and the value beside it. */
  function plate(row, iconName, className, label) {
    const box = el('div', `plate ${className}`);
    const value = el('span', 'plate-value');
    box.append(icon(iconName, 'plate-icon'), value);
    box.setAttribute('aria-label', label);
    row.append(box);
    return { box, value };
  }

  const wave = plate(leftPlates, 'wave', 'plate-wave', T.wave);
  const lives = plate(leftPlates, 'lives', 'plate-lives', T.lives);

  // The Koloss run, when one is announced. It is situational, like victory and
  // defeat, so it takes no permanent seat in the bar.
  const koloss = el('div', 'plate plate-koloss');
  koloss.hidden = true;
  rightPlates.append(koloss);

  const supply = plate(rightPlates, 'supply', 'plate-supply', T.supplyLabel);
  const requisition = plate(rightPlates, 'requisition', 'plate-requisition', T.requisitionLabel);
  const points = plate(rightPlates, 'points', 'plate-points', T.commandPointsTitle);
  // Not there before the first command can be reached; it comes with a bang.
  points.box.hidden = true;
  // King of the Hill: which rift attacks, and which one after it (M7b, B8).
  // Only on a map with more than one rift; the standard bar stays as it was.
  const rift = plate(rightPlates, 'wave', 'plate-rift', T.riftPlateLabel);
  rift.box.hidden = true;
  const route = plate(rightPlates, 'route', 'plate-route', T.routeLabel);

  // Housekeeping, not the action of the round: the menu sits at the end of the
  // status bar rather than in the bottom bar. The recipes are in the menu and
  // on the capsule sheet now (M10 E1), the key R is still there.
  function plateButton(iconName, label, action) {
    const b = el('button', 'plate plate-button interactive');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.append(icon(iconName, 'plate-icon'));
    b.addEventListener('click', () => {
      onAction(action);
      b.blur();
    });
    rightPlates.append(b);
    return b;
  }
  plateButton('menu', T.menu, 'menu');

  // Phone only (style.css shows it there): the bar folds up to the menu button, so
  // the board gets the strip back. The menu stays in reach folded or not.
  const fold = el('button', 'hud-fold interactive');
  fold.type = 'button';
  fold.append(icon('fold', 'hud-fold-icon'));
  fold.setAttribute('aria-expanded', 'true');
  fold.setAttribute('aria-label', T.foldTop);
  function setFolded(folded) {
    top.classList.toggle('folded', folded);
    fold.setAttribute('aria-expanded', String(!folded));
    fold.setAttribute('aria-label', folded ? T.unfoldTop : T.foldTop);
  }
  fold.addEventListener('click', () => {
    const folded = !top.classList.contains('folded');
    setFolded(folded);
    onFold(folded);
    fold.blur();
  });
  top.append(fold);

  // Bottom: the rune discs, the main action, the speed group (docs/ART.md,
  // "Untere Leiste").
  const bar = el('div', 'hud-bar');
  // Pause is a button of its own, so it can be reached in the middle of a wave
  // at once; beside it one button that cycles 1x, 2x, 3x and shows the step as
  // triangles (M10 E1). The keys Space, 1, 2 and 3 do the same.
  const L = STRINGS.iconLabels;
  const speedGroup = el('div', 'speed-group');
  speedGroup.setAttribute('role', 'group');
  speedGroup.setAttribute('aria-label', T.speedGroup);
  const pauseDisc = createRuneButton({
    iconName: 'tempo-0',
    label: T.pauseName,
    hint: T.pauseHint,
    caption: L['tempo-0'],
    onClick: () => onAction('pause'),
  });
  /** The last running speed, which the tempo button goes on from. */
  let runSpeed = 1;
  const tempoDisc = createRuneButton({
    iconName: 'tempo-1',
    label: T.tempoName(1),
    hint: T.tempoHint,
    caption: L['tempo-1'],
    onClick: () => onAction(`speed${(runSpeed % 3) + 1}`),
  });
  speedGroup.append(pauseDisc.el, tempoDisc.el);

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
    caption: L.supply,
    onClick: () => onAction('buySupply'),
  });
  const demolishDisc = createRuneButton({
    iconName: 'demolish',
    label: T.demolishName,
    hint: T.demolishHint,
    caption: L.demolish,
    onClick: () => onAction('demolishMode'),
  });
  // Beside the demolish disc because the two are the same gesture on the same
  // cells: one clears a heap, the other builds it up (GDD section 10).
  const bulwarkDisc = createRuneButton({
    iconName: 'bulwark',
    label: T.bulwarkName,
    hint: T.bulwarkHint,
    caption: L.bulwark,
    onClick: () => onAction('bulwarkMode'),
  });

  // King of the Hill: up a rank instead of a salvo (M7b, B5). Only where the
  // mode's upgrade rule acts in planning; the standard bar stays as it was.
  const upgradeDisc = createRuneButton({
    iconName: 'upgrade',
    label: T.upgradeName,
    hint: T.upgradeHint,
    caption: L.upgrade,
    onClick: () => onAction('upgradeMode'),
  });
  upgradeDisc.el.hidden = true;

  const groundGroup = el('div', 'rune-group');
  groundGroup.append(supplyDisc.el, demolishDisc.el, bulwarkDisc.el, upgradeDisc.el);

  bar.append(groundGroup, start, restart, speedGroup);

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

  // The sheet goes on the page itself, not in the HUD layer: the HUD is a stacking
  // context under the menus, and the pause menu opens the sheet.
  const help = createHelp(document.body);

  root.append(top, bottom, banner, version, help.button);
  if (debugEl) root.append(debugEl);

  const cache = new Map();
  let seenPoints = false;
  const set = (key, value, apply) => {
    if (cache.get(key) === value) return;
    cache.set(key, value);
    apply(value);
  };

  return {
    /** Column above the bottom bar; panels insert themselves here. */
    bottom,

    /** The "?" overlay; the command rail hands its discs over through it. */
    help,

    /** Folds or unfolds the status bar without reporting it: the remembered state coming back. */
    setFolded,

    /** Syncs the HUD with game state and render-side UI state. */
    update(state, ui, { totalWaves, canStart }) {
      // The "?" belongs to the running game: pod selection and the end screens
      // have their own explanations and need the whole view.
      // The phone layout swaps the bottom bar for the capsule sheet by phase.
      set('phase', state.phase, (v) => (root.dataset.phase = v));
      help.setAvailable(state.phase !== 'selection' && state.phase !== 'defeat' && state.phase !== 'victory');
      set('wave', `${state.wave}/${totalWaves}`, (v) => {
        wave.value.textContent = v;
        wave.box.setAttribute('aria-label', `${T.wave} ${v}`);
      });
      set('lives', state.lives, (v) => {
        lives.value.textContent = String(v);
        lives.box.setAttribute('aria-label', `${T.lives} ${v}`);
        // Two steps, so the bar warns before it shouts (docs/ART.md).
        const share = v / RULES.startLives;
        lives.box.dataset.level = share <= 0.25 ? 'critical' : share <= 0.5 ? 'low' : 'fine';
      });
      if (state.map.rifts) {
        // In planning riftIndex is already the coming wave's rift; during a wave
        // it is the running one. Either way the next one follows the wave after.
        const nowId = state.map.rifts[state.riftIndex].id;
        const coming = state.phase === 'wave' || state.phase === 'evaluation' ? state.wave + 1 : state.wave + 2;
        const nextId = state.map.rifts[riftForWave(state, coming)].id;
        set('rift', `${nowId}/${nextId}`, () => {
          rift.box.hidden = false;
          rift.value.textContent = T.riftPlate(STRINGS.rifts[nowId], STRINGS.rifts[nextId]);
          rift.box.setAttribute('aria-label', T.riftPlateAria(STRINGS.rifts[nowId], STRINGS.rifts[nextId]));
        });
      } else {
        set('rift', '', () => {
          rift.box.hidden = true;
        });
      }
      const shown = previewRoute(state);
      set('route', shown ? String(Math.round(shown.length)) : T.routeBlockedShort, (v) => {
        route.value.textContent = v;
        route.box.setAttribute('aria-label', shown ? T.route(v) : T.routeBlocked);
      });
      set('supply', state.supplyLevel, (v) => {
        supply.value.textContent = String(v);
        supply.box.setAttribute('aria-label', T.supply(v));
      });
      set('requisition', state.requisition, (v) => {
        requisition.value.textContent = String(v);
        requisition.box.setAttribute('aria-label', T.requisition(v));
      });
      set('points', state.commandPoints, (v) => {
        points.value.textContent = String(v);
        points.box.setAttribute('aria-label', T.commandPoints(v));
      });
      // Read off the state: the plate comes once the first command is within
      // reach. The very first look only sets the baseline, so a match that is
      // loaded far on does not go off like a bomb.
      set('pointsShown', pointsVisible(state), (v) => {
        const first = !seenPoints;
        seenPoints = true;
        points.box.hidden = !v;
        if (v && !first) {
          burst(points.box);
          onUnlock();
        }
      });
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
        calling: supplyCalls(state),
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
      if (upgradeKind(state).inPlanning) {
        const offers = state.towers.map((tower) => canUpgradeTower(state, tower.id));
        const cheapest = Math.min(...offers.filter((o) => o.ok || o.reason === 'funds').map((o) => o.cost ?? Infinity));
        upgradeDisc.el.hidden = false;
        upgradeDisc.update({
          state: 'ready',
          note: Number.isFinite(cheapest) ? T.upgradeNote(cheapest) : null,
          enabled: offers.some((o) => o.ok) || ui.upgradeMode,
          on: ui.upgradeMode,
        });
      } else {
        upgradeDisc.el.hidden = true;
      }
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
        if (v === '') return;
        startZones.textContent = v;
        // The button keeps its plain name; the count speaks for itself.
        startZones.setAttribute('aria-label', T.zones(...v.split('/')));
      });
      if (state.speed > 0) runSpeed = state.speed;
      pauseDisc.update({ state: 'ready', on: state.speed === 0 });
      tempoDisc.update({
        state: 'ready',
        icon: `tempo-${runSpeed}`,
        name: T.tempoName(runSpeed),
        note: T.tempoNote(runSpeed),
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
      set('bannerDanger', ui.banner?.danger ? '1' : '', (v) => banner.classList.toggle('danger', v === '1'));
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
