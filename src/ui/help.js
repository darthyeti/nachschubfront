// The "?" in the bottom left corner: opens a layer that explains every HUD
// symbol with a speech bubble, joined to its symbol by a dashed line. Any tap
// closes it again, so nothing depends on hover (GDD section 13).
//
// The layer is only a picture on top of the game: it does not pause the
// simulation, so it can be opened in the middle of a wave to look something up.
// It gives way to every other layer (menu, codex, pod selection, end screen).

import { STRINGS } from '../data/strings.js';
import { COMMANDS, commandById } from '../data/commands.js';
import { railOrder } from './commands.js';
import { el } from './controls.js';

const T = STRINGS.help;

const BUBBLE_W = 132;
const GAP = 6;
/** Distance between a symbol and the nearest bubble edge, room for the line. */
const LIFT = 40;
const MARGIN = 6;
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Where the bubbles of one edge go. Pure, so the placement can be checked
 * without a browser.
 *
 * Bubbles stand in line with their symbol: above or below it for the bars,
 * beside it for the command rail. Where symbols are too close for that, the
 * bubble moves to a further row (`tier`), still as near its own symbol as it can.
 *
 * @param {{rect: {left: number, top: number, right: number, bottom: number}, height: number}[]} items
 * @param {'below'|'above'|'left'} side  which side of its symbol a bubble stands
 * @param {{width: number, height: number}} view
 * @param {{width?: number, gap?: number, lift?: number, margin?: number, rightLimit?: number,
 *          avoid?: {left: number, top: number, right: number, bottom: number}[]}} [opts]
 *        `avoid` are boxes already taken, which a bubble beside a symbol keeps clear of
 * @returns {{x: number, y: number, tier: number, line: {x1: number, y1: number, x2: number, y2: number}}[]}
 */
export function layoutBubbles(items, side, view, opts = {}) {
  const width = opts.width ?? BUBBLE_W;
  const gap = opts.gap ?? GAP;
  const lift = opts.lift ?? LIFT;
  const margin = opts.margin ?? MARGIN;
  // Bubbles that must stay left of something (the command rail) get a narrower view.
  if (opts.rightLimit !== undefined) view = { ...view, width: Math.min(view.width, opts.rightLimit) };
  if (side === 'left') return layoutBeside(items, view, { width, gap, lift, margin, avoid: opts.avoid ?? [] });
  const order = items.map((it, i) => i).sort((a, b) => items[a].rect.left - items[b].rect.left);

  // First pass: the free row for each bubble along the edge.
  const placed = new Array(items.length);
  const tierEnd = [];
  for (const i of order) {
    const { rect, height } = items[i];
    const cx = (rect.left + rect.right) / 2;
    const along = Math.min(Math.max(cx - width / 2, margin), view.width - width - margin);
    let tier = 0;
    while ((tierEnd[tier] ?? -Infinity) + gap > along && tier < 6) tier += 1;
    tierEnd[tier] = along + width;
    placed[i] = { along, tier };
  }

  // Second pass: each row is as deep as its deepest bubble.
  const tierDepth = [];
  for (const i of order) {
    const { tier } = placed[i];
    tierDepth[tier] = Math.max(tierDepth[tier] ?? 0, items[i].height);
  }
  const offsetOf = (tier) => {
    let offset = 0;
    for (let t = 0; t < tier; t++) offset += tierDepth[t] + gap;
    return offset;
  };

  return items.map((it, i) => {
    const { rect, height } = it;
    const { along, tier } = placed[i];
    const offset = offsetOf(tier);
    const cx = (rect.left + rect.right) / 2;
    if (side === 'below') {
      const y = rect.bottom + lift + offset;
      return { x: along, y, tier, line: { x1: along + width / 2, y1: y, x2: cx, y2: rect.bottom + 3 } };
    }
    const y = rect.top - lift - offset - height;
    return { x: along, y, tier, line: { x1: along + width / 2, y1: y + height, x2: cx, y2: rect.top - 3 } };
  });
}

/**
 * Bubbles to the left of a column of symbols. Each takes the spot nearest its
 * own symbol that is free: straight out to the left if it can, otherwise a
 * little up or down (the line then runs slanted), otherwise a column further out.
 */
function layoutBeside(items, view, { width, gap, lift, margin, avoid }) {
  const taken = avoid.map((r) => ({ ...r }));
  const hits = (a, b) => !(a.right + gap <= b.left || b.right + gap <= a.left ||
    a.bottom + gap <= b.top || b.bottom + gap <= a.top);
  const step = 6;
  const result = new Array(items.length);
  const order = items.map((it, i) => i).sort((a, b) => items[a].rect.top - items[b].rect.top);
  for (const i of order) {
    const { rect, height } = items[i];
    const cy = (rect.top + rect.bottom) / 2;
    let spot = null;
    for (let column = 0; column < 4 && !spot; column++) {
      const x = rect.left - lift - column * (width + gap) - width;
      if (x < margin) break;
      for (let d = 0; d <= 240 && !spot; d += step) {
        for (const sign of d === 0 ? [1] : [1, -1]) {
          const y = cy - height / 2 + sign * d;
          if (y < margin || y + height > view.height - margin) continue;
          const box = { left: x, top: y, right: x + width, bottom: y + height };
          if (taken.some((t) => hits(box, t))) continue;
          spot = { x, y, box };
          break;
        }
      }
    }
    // No free place at all: keep it in line and let it overlap rather than vanish.
    spot ??= {
      x: Math.max(margin, rect.left - lift - width),
      y: Math.min(Math.max(cy - height / 2, margin), view.height - height - margin),
    };
    const box = spot.box ?? { left: spot.x, top: spot.y, right: spot.x + width, bottom: spot.y + height };
    taken.push(box);
    result[i] = {
      x: spot.x, y: spot.y, tier: 0,
      line: { x1: box.right, y1: spot.y + height / 2, x2: rect.left - 3, y2: cy },
    };
  }
  return result;
}

/** The line under a command's name: price, unlock wave and pause between uses. */
export function commandMeta(command) {
  return T.commandMeta(command.cost, command.fromWave, command.cooldownWaves);
}

/**
 * @param {HTMLElement} root
 * @param {{plates: Record<string, {box: HTMLElement}>, codex: HTMLElement,
 *          menu: HTMLElement, discs: HTMLElement[], salvo: HTMLElement,
 *          speed: HTMLElement}} targets
 */
export function createHelp(root, targets) {
  const layer = el('div', 'help-layer');
  layer.hidden = true;
  const button = el('button', 'help-button interactive', '?');
  button.type = 'button';
  button.setAttribute('aria-label', T.open);
  button.setAttribute('aria-pressed', 'false');

  /** Command rail discs, handed over by the rail once it exists. */
  let commandDiscs = () => [];

  const firstCommandWave = railOrder(COMMANDS)[0].fromWave;
  const top = [
    [targets.plates.wave.box, T.wave],
    [targets.plates.lives.box, T.lives],
    [targets.plates.supply.box, T.supply],
    [targets.plates.requisition.box, T.requisition],
    [targets.plates.points.box, T.points(firstCommandWave)],
    [targets.plates.route.box, T.route],
    [targets.codex, T.codex],
    [targets.menu, T.menu],
  ];
  const bottom = [
    [targets.discs[0], T.supplyDisc],
    [targets.discs[1], T.demolishDisc],
    [targets.discs[2], T.bulwarkDisc],
    [targets.salvo, T.salvo],
    [targets.speed, T.speed],
  ];

  /** Builds the bubbles of one edge, measures them, then lets `layoutBubbles` place them. */
  function place(entries, side, lines, avoid = [], rightLimit) {
    const shown = entries
      .map(([node, text]) => ({ node, text, rect: node.getBoundingClientRect() }))
      // A symbol that is not on screen (a hidden rail) has nothing to explain.
      .filter((it) => it.rect.width > 0 && it.rect.height > 0);
    for (const it of shown) {
      const ring = el('div', 'help-ring');
      Object.assign(ring.style, {
        left: `${it.rect.left - 3}px`,
        top: `${it.rect.top - 3}px`,
        width: `${it.rect.width + 6}px`,
        height: `${it.rect.height + 6}px`,
      });
      it.bubble = el('div', 'help-bubble');
      it.bubble.dataset.side = side;
      it.bubble.append(el('b', '', it.text[0]), document.createTextNode(it.text[1]));
      if (it.text[2]) it.bubble.append(el('span', 'help-meta', it.text[2]));
      layer.append(ring, it.bubble);
    }
    const spots = layoutBubbles(
      shown.map((it) => ({ rect: it.rect, height: it.bubble.offsetHeight })),
      side,
      { width: window.innerWidth, height: window.innerHeight },
      { avoid, rightLimit },
    );
    shown.forEach((it, i) => {
      const s = spots[i];
      it.bubble.style.left = `${s.x}px`;
      it.bubble.style.top = `${s.y}px`;
      it.bubble.style.animationDelay = `${s.tier * 40}ms`;
      const line = document.createElementNS(SVG_NS, 'line');
      for (const [k, v] of Object.entries(s.line)) line.setAttribute(k, String(v));
      lines.append(line);
      boxes.push({ left: s.x, top: s.y, right: s.x + BUBBLE_W, bottom: s.y + it.bubble.offsetHeight });
    });
  }

  /** Boxes the bubbles of this opening have taken so far. */
  let boxes = [];

  function open() {
    layer.replaceChildren();
    const lines = document.createElementNS(SVG_NS, 'svg');
    lines.setAttribute('class', 'help-lines');
    layer.append(lines);
    layer.hidden = false;
    button.setAttribute('aria-pressed', 'true');
    button.setAttribute('aria-label', T.close);
    boxes = [];
    // The rail stands at the right edge in the middle; the bubbles of the top
    // bar keep left of it instead of covering its discs.
    const rail = commandDiscs()
      .map(({ node }) => node.getBoundingClientRect())
      .filter((r) => r.width > 0);
    const rightLimit = rail.length ? Math.min(...rail.map((r) => r.left)) - 6 : undefined;
    place(top, 'below', lines, [], rightLimit);
    place(bottom, 'above', lines);
    place(
      commandDiscs().map(({ command, node }) => {
        const texts = STRINGS.commands[command.id];
        return [node, [texts.name, texts.effect, commandMeta(commandById(command.id))]];
      }),
      'left',
      lines,
      boxes.slice(),
    );
    layer.append(el('div', 'help-dismiss', T.dismiss));
  }

  function close() {
    layer.hidden = true;
    layer.replaceChildren();
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', T.open);
  }

  button.addEventListener('click', () => (layer.hidden ? open() : close()));
  layer.addEventListener('click', close);
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !layer.hidden) {
      ev.stopPropagation();
      close();
    }
  }, true);
  window.addEventListener('resize', () => {
    if (!layer.hidden) open();
  });

  root.append(layer);
  return {
    button,
    open,
    close,
    get isOpen() {
      return !layer.hidden;
    },
    /** @param {() => {command: object, node: HTMLElement}[]} source */
    setCommandDiscs(source) {
      commandDiscs = source;
    },
    /** The "?" has no place while another layer owns the screen. */
    setAvailable(available) {
      button.hidden = !available;
      if (!available && !layer.hidden) close();
    },
  };
}
