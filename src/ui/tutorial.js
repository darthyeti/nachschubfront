// The guided walk through the first two rounds (M10 E3, for every device).
//
// One element at a time is lit, the rest is dimmed and takes no taps, a short
// text says what to do, and the whole thing can be skipped at any moment. It
// follows the study (reference/studien/handy-bedienung.js, 13 steps) with one
// step more: in round 2 the player buys supply once.
//
// It only READS. Every fact it goes by is taken off the game state each frame
// (phase, zones marked, emplacements built, supply level, speed), so it sees a
// zone being marked, the salvo, the capsule choice, the purchase and the wave
// the way the simulation reports them, and it never calls into the simulation.
// A match with the tutorial therefore plays back from its protocol exactly like
// one without (tests/unit/tutorial.test.js).
//
// Layout of the file: the step table and the flow (pure, no DOM, checked in
// node), the picking of the highlighted field and of the card position (pure),
// then the layer that draws it all.

import { STRINGS } from '../data/strings.js';
import { canBuySupply } from '../sim/economy.js';
import { selectionOptions } from '../sim/selection.js';
import { canMarkZone } from '../sim/zones.js';
import { routeWith } from '../sim/route.js';
import { actionsFor } from './selection.js';
import { el, button } from './controls.js';

const T = STRINGS.tutorial;

// ---------------------------------------------------------------- Facts

/**
 * What the tutorial knows about the game, taken from the state and from nothing
 * else. `merge` is only filled during the capsule choice.
 *
 * @typedef {object} Facts
 * @property {string} phase
 * @property {number} wave      the last wave fought; 0 before the first
 * @property {number} zones     landing zones marked
 * @property {number} towers    emplacements standing
 * @property {number} supply    supply level
 * @property {number} speed
 * @property {boolean} canBuy   the next supply level is for sale and affordable
 * @property {null | {anchor: number, doctrine: string, actionIndex: number}} merge
 *           the first pair of equal capsules of the salvo, and where its action button stands
 */

/** @returns {Facts} */
export function readFacts(state, merge = null) {
  return {
    phase: state.phase,
    wave: state.wave,
    zones: state.zones.length,
    towers: state.towers.length,
    supply: state.supplyLevel,
    speed: state.speed,
    canBuy: canBuySupply(state).ok,
    merge,
  };
}

/**
 * The first merge the capsule choice offers, for the round 2 steps.
 * @returns {null | {anchor: number, doctrine: string, actionIndex: number}}
 */
export function findMerge(state) {
  const options = selectionOptions(state);
  const merge = options.merges[0];
  if (!merge) return null;
  const anchor = merge.anchors[0];
  const actionIndex = actionsFor(options, anchor).findIndex((a) => a.choice.type === 'merge');
  return actionIndex < 0 ? null : { anchor, doctrine: merge.doctrine, actionIndex };
}

/** Past the last stage: the match is over or the third round has begun. */
export const STAGE_DONE = 7;

/**
 * Where the match stands on the way through the first two rounds, as one number
 * that only ever grows: 0 planning round 1, 1 capsule choice round 1, 2 wave 1,
 * 3 planning round 2, 4 capsule choice round 2, 5 wave 2, 6 planning after wave 2.
 * Steps carry the stage they belong to, so a step the player has outrun (a key
 * that called the salvo behind the dimmed screen) drops out instead of hanging.
 */
export function stageOf(f) {
  if (f.phase === 'defeat' || f.phase === 'victory') return STAGE_DONE;
  if (f.phase === 'selection') return f.wave === 0 ? 1 : f.wave === 1 ? 4 : STAGE_DONE;
  if (f.phase === 'wave' || f.phase === 'evaluation') return f.wave <= 1 ? 2 : f.wave === 2 ? 5 : STAGE_DONE;
  // planning, and the salvo coming down, which still belongs to its planning
  return f.wave === 0 ? 0 : f.wave === 1 ? 3 : f.wave === 2 ? 6 : STAGE_DONE;
}

// ---------------------------------------------------------------- Steps

const inPlanning = (f) => f.phase === 'planning';
const inSelection = (f) => f.phase === 'selection';

/**
 * One step: what is lit (`target`), what it takes to go on (`done`, or a button
 * when there is none), when it may show (`ready`), and whether it applies at all
 * (`applies`, checked when it comes up).
 *
 * Targets: none, route (plate), cell (the field to mark), salvo, cards (the whole
 * list), card (one, by index), action (a button of the sheet, by index), tempo,
 * requisition, supply, menu.
 */
export const STEPS = [
  { id: 'welcome', round: 1, stage: 0, target: () => ({ id: 'none' }), ready: inPlanning },
  { id: 'route', round: 1, stage: 0, target: () => ({ id: 'route' }), ready: inPlanning },
  {
    id: 'spot', round: 1, stage: 0, target: () => ({ id: 'cell' }), ready: inPlanning,
    done: (f) => f.zones >= 1,
  },
  {
    id: 'salvo', round: 1, stage: 0, target: () => ({ id: 'salvo' }), ready: inPlanning,
    done: (f) => f.phase !== 'planning',
  },
  {
    id: 'card', round: 1, stage: 1, target: () => ({ id: 'cards' }), ready: inSelection,
    done: (f, base, taps) => taps.includes('card'),
  },
  {
    id: 'keep', round: 1, stage: 1, target: () => ({ id: 'action', index: 0 }), ready: inSelection,
    done: (f) => f.phase !== 'selection',
  },
  {
    id: 'tempo', round: 1, stage: 2, target: () => ({ id: 'tempo' }), ready: (f) => f.phase === 'wave',
    done: (f) => f.speed >= 2,
  },
  { id: 'req', round: 2, stage: 3, target: () => ({ id: 'requisition' }), ready: inPlanning },
  {
    id: 'buy', round: 2, stage: 3, target: () => ({ id: 'supply' }), ready: inPlanning,
    // Only when the purse has the price. A first wave that leaked leaves too little, and a
    // step that cannot be done is left out rather than shown.
    applies: (f) => f.canBuy,
    done: (f, base) => f.supply > base.supply,
  },
  {
    id: 'spot2', round: 2, stage: 3, target: () => ({ id: 'cell' }), ready: inPlanning,
    done: (f) => f.zones >= 1,
  },
  {
    id: 'salvo2', round: 2, stage: 3, target: () => ({ id: 'salvo' }), ready: inPlanning,
    done: (f) => f.phase !== 'planning',
  },
  {
    id: 'pick', round: 2, stage: 4,
    target: (f) => (f.merge ? { id: 'card', index: f.merge.anchor } : { id: 'cards' }),
    ready: inSelection,
    done: (f, base, taps) => taps.includes('card'),
  },
  {
    id: 'act', round: 2, stage: 4,
    target: (f) => ({ id: 'action', index: f.merge ? f.merge.actionIndex : 0 }),
    ready: inSelection,
    done: (f) => f.phase !== 'selection',
  },
  // After wave 2, not during it: a screen that takes no taps must not stand over a running wave.
  { id: 'end', round: 2, stage: 6, last: true, target: () => ({ id: 'menu' }), ready: inPlanning },
];

/** The text of a step for the facts it is shown with (some steps have two wordings). */
export function stepText(step, f) {
  const t = T.steps[step.id];
  if (step.id === 'pick') return f.merge ? t.merge(STRINGS.doctrines[f.merge.doctrine]) : t.plain;
  if (step.id === 'act') return f.merge ? t.merge : t.plain;
  return t.text;
}

/** The line that says what to do where a step has no button of its own. */
export function stepNeed(step, f) {
  const t = T.steps[step.id];
  if (step.id === 'pick' || step.id === 'act') return f.merge ? t.needMerge : t.need;
  return t.need ?? '';
}

// ---------------------------------------------------------------- Flow

/**
 * The walk as a small machine. Feed it the facts of every frame; it says which
 * step to show, or none while the game is between two steps (the salvo coming
 * down, the wave running). No DOM, no clock, no game state: checked in node.
 *
 * @param {typeof STEPS} [steps]
 */
export function createFlow(steps = STEPS) {
  let index = 0;
  let entered = false;
  let base = null;
  let finished = false;

  function advance() {
    index += 1;
    entered = false;
    base = null;
    if (index >= steps.length) finished = true;
  }

  return {
    get index() {
      return index;
    },
    get total() {
      return steps.length;
    },
    get finished() {
      return finished;
    },
    get step() {
      return finished ? null : steps[index];
    },

    /**
     * @param {Facts} facts
     * @param {string[]} [taps]  what the player tapped since the last call ('card')
     * @returns {{step: object, index: number, total: number} | null}  the step to show now
     */
    update(facts, taps = []) {
      const stage = stageOf(facts);
      // A bounded loop: every pass either returns or moves on by one step.
      for (let guard = 0; guard <= steps.length && !finished; guard++) {
        const step = steps[index];
        // Outrun: the game is further on than this step, so it has no point any more.
        if (step.stage < stage) {
          advance();
          continue;
        }
        if (entered && step.done && step.done(facts, base, taps)) {
          advance();
          continue;
        }
        if (!entered) {
          if (step.stage > stage || !step.ready(facts)) return null;
          if (step.applies && !step.applies(facts)) {
            advance();
            continue;
          }
          entered = true;
          base = facts;
          // Already true when it comes up: nothing to ask for.
          if (step.done && step.done(facts, base, taps)) {
            advance();
            continue;
          }
        } else if (!step.ready(facts)) {
          return null;
        }
        return { step, index, total: steps.length };
      }
      return null;
    },

    /** The "Weiter" button: only steps without a condition of their own go on this way. */
    next() {
      const step = steps[index];
      if (finished || !entered || step.done) return false;
      advance();
      return true;
    },

    /** "Überspringen": the walk is over, whichever step it was at. */
    skip() {
      finished = true;
    },
  };
}

// ---------------------------------------------------------------- Picking the field

/**
 * The field the tutorial lights up: a free cell on the enemies' route, so the
 * number beside the route grows when it is marked, away from the rift and the
 * bastion, and (when `usable` says so) in a place the finger can reach.
 * Falls back to any valid cell of the route when none makes the way longer.
 *
 * @param {object} state
 * @param {{fraction?: number, usable?: (cell: {x: number, y: number}) => boolean}} [options]
 *        `fraction` where on the route to start looking, 0 to 1
 * @returns {{x: number, y: number} | null}
 */
export function pickSpot(state, { fraction = 0.5, usable = () => true } = {}) {
  const cells = state.route?.cells ?? [];
  const n = cells.length;
  if (n < 8) return null;
  const length = state.route.length;
  const first = Math.min(n - 4, Math.max(3, Math.round(n * fraction)));
  let fallback = null;
  let tried = 0;
  // Outwards from the start: first, first + 1, first - 1, first + 2, ...
  for (let k = 0; k < n && tried < 40; k++) {
    const i = first + (k % 2 === 1 ? (k + 1) / 2 : -k / 2);
    if (i < 3 || i > n - 4) continue;
    const cell = { x: cells[i].x, y: cells[i].y };
    if (!canMarkZone(state, cell).ok || !usable(cell)) continue;
    tried += 1;
    const next = routeWith(state.map, [...state.zones, cell], state.riftIndex ?? 0);
    if (next && next.length > length) return cell;
    fallback ??= cell;
  }
  return fallback;
}

// ---------------------------------------------------------------- Placing the card

/**
 * Where the text card goes: beside or above or below the lit element so that it
 * covers neither it nor `clear` (the sheet the element belongs to), and stays
 * inside the picture. Wide screens try the sides first, tall ones above and below.
 *
 * @param {{x: number, y: number, w: number, h: number} | null} hole
 * @param {{x: number, y: number, w: number, h: number} | null} clear  area to stay out of; defaults to the hole
 * @param {{w: number, h: number}} card
 * @param {{w: number, h: number}} view
 * @param {{top?: number, bottom?: number, side?: number, gap?: number}} [margin]
 * @returns {{x: number, y: number}}
 */
export function placeCard(hole, clear, card, view, margin = {}) {
  const { top = 8, bottom = 8, side = 8, gap = 12 } = margin;
  const minX = side;
  const maxX = view.w - side - card.w;
  const minY = top;
  const maxY = view.h - bottom - card.h;
  const clampX = (x) => Math.min(Math.max(x, minX), Math.max(minX, maxX));
  const clampY = (y) => Math.min(Math.max(y, minY), Math.max(minY, maxY));
  if (!hole) return { x: clampX((view.w - card.w) / 2), y: clampY(view.h * 0.3) };

  const area = clear ?? hole;
  const cx = hole.x + hole.w / 2;
  const cy = hole.y + hole.h / 2;
  const candidates = {
    above: { x: clampX(cx - card.w / 2), y: area.y - gap - card.h },
    below: { x: clampX(cx - card.w / 2), y: area.y + area.h + gap },
    left: { x: area.x - gap - card.w, y: clampY(cy - card.h / 2) },
    right: { x: area.x + area.w + gap, y: clampY(cy - card.h / 2) },
  };
  const fits = (p) => p.x >= minX - 0.5 && p.x <= maxX + 0.5 && p.y >= minY - 0.5 && p.y <= maxY + 0.5;
  const wide = view.w > view.h;
  // The side with more room first.
  const vertical = cy > view.h / 2 ? ['above', 'below'] : ['below', 'above'];
  const horizontal = cx > view.w / 2 ? ['left', 'right'] : ['right', 'left'];
  const order = wide ? [...horizontal, ...vertical] : [...vertical, ...horizontal];
  for (const name of order) if (fits(candidates[name])) return candidates[name];
  // Nothing fits clear of the element: the roomier vertical side, pushed into the picture.
  const name = vertical[0];
  return { x: clampX(candidates[name].x), y: clampY(candidates[name].y) };
}

// ---------------------------------------------------------------- The layer

const SELECTORS = {
  route: '.hud-top .plate-route',
  requisition: '.hud-top .plate-requisition',
  menu: '.hud-top .plate-button',
  salvo: '.hud-bar .salvo',
  tempo: '.speed-group .rune:nth-child(2)',
  supply: '.rune-group .rune:first-child',
  cards: '.selection-cards',
};

const PAD = 6;
const MIN_HIT = 44;

/** A visible element's box in CSS pixels, or null while it is hidden or has no size. */
function boxOf(node) {
  if (!node || node.closest('[hidden]')) return null;
  const r = node.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function grow(box, pad, min = 0) {
  const w = Math.max(box.w + pad * 2, min);
  const h = Math.max(box.h + pad * 2, min);
  return { x: box.x + box.w / 2 - w / 2, y: box.y + box.h / 2 - h / 2, w, h };
}

const sameBox = (a, b) =>
  a === b || (a && b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5);

/**
 * @param {HTMLElement} root
 * @param {object} options
 * @param {{values: {tutorialSeen: boolean}, set: (key: string, value: boolean) => void}} options.prefs
 * @param {(cell: {x: number, y: number}) => ({x: number, y: number, w: number, h: number} | null)} options.cellBox
 *        the box of a map cell on the screen, in CSS pixels (main.js knows the camera)
 */
export function createTutorial(root, { prefs, cellBox }) {
  const layer = el('div', 'tutorial');
  layer.hidden = true;
  layer.setAttribute('role', 'region');
  layer.setAttribute('aria-label', T.title);
  root.append(layer);

  /** @type {ReturnType<typeof createFlow> | null} */
  let flow = null;
  let matchState = null;
  let taps = [];
  let drawn = '';
  let spot = null;
  let spotKey = '';
  let lastMerge = null;
  let mergeKey = '';
  let viewKey = '';
  /** The cell the lit field stands on, while the spot step is up; main.js reads it for taps. */
  let tapTarget = null;

  // A tap on a capsule card is something the state does not show (the card is already
  // the selected one when it is tapped), so the one fact the tutorial takes from the DOM
  // is that it was pressed. Read only; it stops nothing.
  document.addEventListener(
    'click',
    (ev) => {
      if (flow && ev.target instanceof Element && ev.target.closest('.selection-card')) taps.push('card');
    },
    true,
  );

  function finish() {
    flow = null;
    matchState = null;
    spot = null;
    tapTarget = null;
    layer.hidden = true;
    layer.replaceChildren();
    drawn = '';
    mergeKey = '';
    lastMerge = null;
    viewKey = '';
    prefs.set('tutorialSeen', true);
  }

  /** Cells the finger can reach: inside the picture and clear of the bars and the rail. */
  function usable(cell) {
    const box = cellBox(cell);
    if (!box) return false;
    if (box.x < 8 || box.y < 8 || box.x + box.w > innerWidth - 8 || box.y + box.h > innerHeight - 8) return false;
    const covers = document.querySelectorAll(
      '.hud-top, .rune-group, .speed-group, .salvo, .command-rail, .help-button, .hud-fold, .debug-panel',
    );
    for (const node of covers) {
      const other = boxOf(node);
      if (!other) continue;
      if (box.x < other.x + other.w + 6 && box.x + box.w > other.x - 6 && box.y < other.y + other.h + 6 && box.y + box.h > other.y - 6) {
        return false;
      }
    }
    return true;
  }

  function spotFor(state, step) {
    const key = `${step.id}:${state.wave}:${state.mapVersion}:${state.zones.length}`;
    if (key !== spotKey) {
      spotKey = key;
      spot = pickSpot(state, { fraction: step.round === 1 ? 0.5 : 0.35, usable });
    }
    return spot;
  }

  /** The box of what a step lights up, and the area the card has to stay out of. */
  function targetBoxes(target, state, step) {
    let hole = null;
    let clear = null;
    if (target.id === 'cell') {
      const cell = spotFor(state, step);
      tapTarget = cell;
      const box = cell ? cellBox(cell) : null;
      if (box) hole = grow(box, 4, MIN_HIT);
    } else if (target.id === 'card' || target.id === 'action') {
      const box = boxOf(sheetNode(target));
      if (box) hole = grow(box, 3);
    } else {
      const node = document.querySelector(SELECTORS[target.id]);
      const box = boxOf(node);
      if (box) hole = grow(box, PAD, MIN_HIT);
    }
    if (hole && (hole.w <= 6 || hole.h <= 6)) hole = null;
    // The capsule sheet scrolls on a small screen: bring a button into view, and keep the
    // card off the sheet as a whole.
    if (target.id === 'card' || target.id === 'action' || target.id === 'cards') {
      const sheet = document.querySelector('.selection');
      clear = sheet ? boxOf(sheet) : null;
    }
    return { hole, clear };
  }

  /** The card or the action button of the capsule sheet a target names. */
  function sheetNode(target) {
    const list = target.id === 'action' ? '.selection-actions > button' : '.selection-card';
    return document.querySelectorAll(list)[target.index] ?? null;
  }

  function bringIntoView(target) {
    if (target.id === 'card' || target.id === 'action') {
      sheetNode(target)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
  }

  function draw(shown, facts, hole, clear) {
    const { step, index, total } = shown;
    const text = stepText(step, facts);
    const need = stepNeed(step, facts);
    const W = innerWidth;
    const H = innerHeight;
    const key = [step.id, index, text, W, H, hole ? [hole.x, hole.y, hole.w, hole.h].map(Math.round).join(',') : '-',
      clear ? [clear.x, clear.y, clear.w, clear.h].map(Math.round).join(',') : '-'].join('|');
    if (key === drawn) return;
    drawn = key;
    layer.replaceChildren();

    const interactive = Boolean(step.done);
    const blockers = [];
    // A step that waits for a tap but has nothing to light (the field is out of reach, the
    // sheet is not up yet) blocks nothing: better a card with a skip button than a locked screen.
    if (hole && interactive) {
      // Four slabs round the hole: only the lit element takes a tap.
      const r = {
        x0: Math.max(0, hole.x), y0: Math.max(0, hole.y),
        x1: Math.min(W, hole.x + hole.w), y1: Math.min(H, hole.y + hole.h),
      };
      blockers.push([0, 0, W, r.y0], [0, r.y1, W, H - r.y1], [0, r.y0, r.x0, r.y1 - r.y0], [r.x1, r.y0, W - r.x1, r.y1 - r.y0]);
    } else if (!interactive) {
      blockers.push([0, 0, W, H]);
    }
    for (const [x, y, w, h] of blockers) {
      const slab = el('i', 'tutorial-block');
      slab.style.cssText = `left:${x}px;top:${y}px;width:${Math.max(0, w)}px;height:${Math.max(0, h)}px`;
      layer.append(slab);
    }
    if (hole) {
      const ring = el('i', 'tutorial-hole');
      ring.style.cssText = `left:${hole.x}px;top:${hole.y}px;width:${hole.w}px;height:${hole.h}px`;
      layer.append(ring);
    } else if (!interactive) {
      layer.append(el('i', 'tutorial-dim'));
    }

    const card = el('div', 'tutorial-card');
    card.setAttribute('aria-live', 'polite');
    const meta = el('div', 'tutorial-meta');
    meta.append(el('b', null, T.step(index + 1, total)), el('span', null, T.round(step.round)));
    const words = el('p', 'tutorial-text', text);
    const row = el('div', 'tutorial-row');
    row.append(button(T.skip, 'alt tutorial-skip', () => {
      flow?.skip();
      finish();
    }));
    if (interactive) {
      if (need) row.append(el('span', 'tutorial-need', need));
    } else {
      row.append(
        button(step.last ? T.last : T.next, 'primary tutorial-next', () => {
          flow?.next();
          drawn = '';
        }),
      );
    }
    card.append(meta, words, row);
    card.style.visibility = 'hidden';
    layer.append(card);
    // Measured once it is in the page, so the placement knows its real size.
    const cardW = Math.min(300, W - 24);
    card.style.width = `${cardW}px`;
    const place = placeCard(
      hole,
      clear,
      { w: cardW, h: card.offsetHeight },
      { w: W, h: H },
      { top: 8 + inset('paddingTop'), bottom: 8 + inset('paddingBottom'), side: 12, gap: 12 },
    );
    card.style.left = `${place.x}px`;
    card.style.top = `${place.y}px`;
    card.style.visibility = '';
  }

  /** The safe-area inset the layer's padding resolved to (style.css), in CSS pixels. */
  function inset(side) {
    const n = Number.parseFloat(getComputedStyle(layer)[side]);
    return Number.isFinite(n) ? n : 0;
  }

  return {
    /** True while the walk is on. */
    get active() {
      return flow !== null;
    },

    /**
     * The cell a tap on the lit field counts for, or null. On a phone a field is
     * smaller than a finger; everything that gets through the dimming at the spot
     * step lands on the lit field, so the tap cannot miss it.
     */
    tapCell() {
      return flow?.step?.id === 'spot' || flow?.step?.id === 'spot2' ? tapTarget : null;
    },

    /**
     * Once per frame, after the game has been advanced.
     * @param {object} state
     * @param {{startable: boolean, suspended: boolean}} gate
     *   `startable`: a match is running and the settings are loaded;
     *   `suspended`: a menu, the symbol sheet or a note holds the screen
     */
    update(state, { startable, suspended }) {
      if (prefs.values.tutorialSeen) {
        if (flow) {
          flow = null;
          layer.hidden = true;
          layer.replaceChildren();
          drawn = '';
        }
        return;
      }
      if (!flow) {
        const f = readFacts(state);
        if (!startable || suspended || f.phase !== 'planning' || f.wave !== 0 || f.towers !== 0) return;
        flow = createFlow();
        matchState = state;
        taps = [];
      }
      // Another match took the place of this one (a new game from a menu or a key).
      if (state !== matchState) {
        finish();
        return;
      }
      if (suspended) {
        tapTarget = null;
        layer.hidden = true;
        drawn = '';
        return;
      }
      let merge = lastMerge;
      if (state.phase === 'selection') {
        const key = `${state.wave}:${state.pods.map((p) => `${p.doctrine}${p.rank}`).join()}`;
        if (key !== mergeKey) {
          mergeKey = key;
          lastMerge = findMerge(state);
        }
        merge = lastMerge;
      }
      const facts = readFacts(state, merge);
      const shown = flow.update(facts, taps);
      taps = [];
      if (flow.finished) {
        finish();
        return;
      }
      if (!shown) {
        tapTarget = null;
        layer.hidden = true;
        drawn = '';
        return;
      }
      const target = shown.step.target(facts);
      const stepKey = `${shown.index}:${target.index ?? ''}`;
      if (stepKey !== viewKey) {
        viewKey = stepKey;
        bringIntoView(target);
      }
      const { hole, clear } = targetBoxes(target, state, shown.step);
      layer.hidden = false;
      draw(shown, facts, hole, clear);
    },
  };
}
