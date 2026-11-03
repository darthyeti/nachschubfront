// The trail (docs/ART.md, "Gelände, Licht und Biome"): what the walking enemies leave behind.
// Every section of the current route (the stretch between two consecutive cells) carries a wear
// from 0 to 1. It grows with every ground enemy that enters the section and fades on sections
// that are no longer part of the route. Presentation state beside `ui`: never in `state`, never
// saved, never recorded. The numbers are the starting points of reference/studien/optik-studie.js.

import { createRng } from '../core/random.js';
import { iso } from './iso.js';

/** Width of the three layers in cells, and the opacity factor of each layer (times the wear). */
export const TRAIL_WIDTHS = [0.55, 0.42, 0.28];
export const TRAIL_ALPHAS = [0.7, 0.7, 0.7];
/** Raggedness of the edges as a fraction of the layer width, and the spacing of the samples in cells. */
export const TRAIL_RAG = 0.3;
export const TRAIL_SAMPLE = 0.5;
/** Sideways shift of a layer against the route line, in cells (at most half of this either way). */
export const TRAIL_SHIFT = 0.06;
/**
 * Dark hem on the outside of every layer, so the trail reads under the gold route line of the
 * planning: its width in cells and its opacity (times the wear). Colour is `palette.pathEdge`.
 */
export const TRAIL_EDGE = { width: 0.08, alpha: 0.5 };
/** Wear gained when an enemy enters a section, lost per second on abandoned sections. */
export const WEAR_PER_PASS = 0.04;
export const WEAR_FADE_PER_SECOND = 0.02;
/** A section that fades below this is forgotten. */
export const WEAR_MIN = 0.01;
/** Wear is drawn in this many steps, so equal steps share one fill. */
const WEAR_STEPS = 10;

const keyOf = (a, b) => `${a.x},${a.y}>${b.x},${b.y}`;

/**
 * The sections of a route (or of several lanes): one per pair of consecutive cells.
 * @param {{cells: {x: number, y: number}[], lanes?: {cells: object[]}[]} | null} route
 * @returns {{key: string, a: {x: number, y: number}, b: {x: number, y: number}}[]}
 */
export function sectionsOf(route) {
  const out = [];
  if (!route) return out;
  const seen = new Set();
  for (const lane of route.lanes ?? [route]) {
    const cells = lane.cells;
    for (let i = 0; i + 1 < cells.length; i++) {
      const a = cells[i];
      const b = cells[i + 1];
      if (a.x === b.x && a.y === b.y) continue;
      const key = keyOf(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, a, b });
    }
  }
  return out;
}

/**
 * One step of the wear: `passed` keys gain WEAR_PER_PASS (capped at 1), sections that are not in
 * `current` lose WEAR_FADE_PER_SECOND * dt, and sections under WEAR_MIN are dropped. Mutates and
 * returns `wear` (a Map from section key to wear).
 * @param {Map<string, number>} wear
 * @param {Set<string>} current  Keys of the sections of the current route.
 * @param {Iterable<string>} passed  A key per enemy that newly entered a section.
 * @param {number} dt  Seconds.
 */
export function advanceWear(wear, current, passed, dt) {
  for (const key of passed) wear.set(key, Math.min(1, (wear.get(key) ?? 0) + WEAR_PER_PASS));
  for (const [key, value] of wear) {
    if (current.has(key)) continue;
    const next = value - WEAR_FADE_PER_SECOND * dt;
    if (next < WEAR_MIN) wear.delete(key);
    else wear.set(key, next);
  }
  return wear;
}

/** Index of the section of `line` that distance `d` lies in (the last one at the end). */
function sectionIndexAt(line, d, from) {
  const { cumulative } = line;
  const last = cumulative.length - 2;
  let i = Math.min(from, Math.max(0, last));
  while (i < last && cumulative[i + 1] <= d) i++;
  return i;
}

/**
 * Follows one enemy along its line. `memo` ({line, index, d}) is updated in place. Returns the
 * index of the section it entered, or -1 if it entered none: it stayed in its section, or its
 * line was replaced or it moved backwards (the Koloss swaps the lines mid-wave and resets `d`),
 * in which case the section is searched again from the start and nothing is counted.
 */
export function followEnemy(memo, line, d) {
  const fresh = memo.line === undefined;
  const reset = !fresh && (memo.line !== line || d < memo.d);
  const index = sectionIndexAt(line, d, fresh || reset ? 0 : memo.index);
  const entered = !reset && (fresh || index !== memo.index);
  memo.line = line;
  memo.index = index;
  memo.d = d;
  return entered ? index : -1;
}

export function createTrail() {
  /** @type {Map<string, number>} */
  const wear = new Map();
  /** Section index each enemy was in last (monotone along its line). */
  let entered = new WeakMap();
  let lastState = null;
  let lastTime = 0;
  let sections = [];
  let currentKeys = new Set();
  let routeRef = null;
  /** Ribbon geometry per section key, rebuilt when the seed changes. */
  let geometry = new Map();
  let geometrySeed = null;

  function reset() {
    wear.clear();
    entered = new WeakMap();
    geometry = new Map();
  }

  /** Ribbon of one layer: left and right edge points per sample, in cell coordinates. */
  function ribbonOf(section, seed) {
    let g = geometry.get(section.key);
    if (g) return g;
    const base = createRng(`trail:${seed}`);
    const { a, b } = section;
    const ax = a.x + 0.5;
    const ay = a.y + 0.5;
    const bx = b.x + 0.5;
    const by = b.y + 0.5;
    const len = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    const n = Math.max(1, Math.round(len / TRAIL_SAMPLE));
    // The two end samples come from the cell they sit in, so neighbouring sections join up.
    const rngs = [];
    for (let k = 0; k <= n; k++) {
      const label = k === 0 ? `c${a.x},${a.y}` : k === n ? `c${b.x},${b.y}` : `${section.key}#${k}`;
      rngs.push(base.fork(label));
    }
    g = TRAIL_WIDTHS.map(() => ({ left: [], right: [], outerLeft: [], outerRight: [] }));
    for (let k = 0; k <= n; k++) {
      const r = rngs[k];
      const t = k / n;
      const px = ax + (bx - ax) * t;
      const py = ay + (by - ay) * t;
      TRAIL_WIDTHS.forEach((w, layer) => {
        const shift = (r.next() - 0.5) * TRAIL_SHIFT;
        const l = (w / 2) * (1 + TRAIL_RAG * (r.next() * 2 - 1));
        const rr = (w / 2) * (1 + TRAIL_RAG * (r.next() * 2 - 1));
        g[layer].left.push([px + nx * (shift + l), py + ny * (shift + l)]);
        g[layer].right.push([px - nx * (rr - shift), py - ny * (rr - shift)]);
        g[layer].outerLeft.push([px + nx * (shift + l + TRAIL_EDGE.width), py + ny * (shift + l + TRAIL_EDGE.width)]);
        g[layer].outerRight.push([px - nx * (rr - shift + TRAIL_EDGE.width), py - ny * (rr - shift + TRAIL_EDGE.width)]);
      });
    }
    geometry.set(section.key, g);
    return g;
  }

  return {
    /** Wear of every section, for tests and the debug view. */
    wear,

    /**
     * Reads the state (never writes it): grows the wear for enemies that entered a new section
     * and fades abandoned ones. Call once per frame with the real frame time.
     */
    update(state, dt) {
      if (state !== lastState || state.time < lastTime) reset();
      lastState = state;
      lastTime = state.time;
      if (state.route !== routeRef) {
        routeRef = state.route;
        sections = sectionsOf(state.route);
        currentKeys = new Set(sections.map((s) => s.key));
      }
      const passed = [];
      const routes = state.waveRoutes;
      for (const e of state.enemies) {
        if (e.flying || e.koloss) continue;
        const line = routes?.lanes?.[e.lane ?? 0] ?? routes?.ground;
        if (!line || line.points.length < 2) continue;
        let memo = entered.get(e);
        if (!memo) entered.set(e, (memo = {}));
        const i = followEnemy(memo, line, e.d);
        if (i < 0) continue;
        const a = line.points[i];
        const b = line.points[i + 1];
        passed.push(keyOf({ x: Math.floor(a.x), y: Math.floor(a.y) }, { x: Math.floor(b.x), y: Math.floor(b.y) }));
      }
      advanceWear(wear, currentKeys, passed, dt);
    },

    /** Draws the trail on the ground, in world coordinates (the camera is already applied). */
    draw(ctx, palette, art, seed) {
      if (art !== 'sprites' || !wear.size) return;
      if (seed !== geometrySeed) {
        geometry = new Map();
        geometrySeed = seed;
      }
      const byStep = new Map();
      const all = new Map(sections.map((s) => [s.key, s]));
      for (const [key, w] of wear) {
        let section = all.get(key);
        if (!section) section = parseKey(key);
        const q = Math.round(w * WEAR_STEPS);
        if (q <= 0) continue;
        if (!byStep.has(q)) byStep.set(q, []);
        byStep.get(q).push(section);
      }
      ctx.save();
      // The hems first, wide layers before narrow ones, so the fills of the wider layers
      // soften the hems inside and only the outer ones stay clear.
      ctx.fillStyle = palette.pathEdge;
      for (let layer = 0; layer < TRAIL_WIDTHS.length; layer++) {
        for (const [q, list] of byStep) {
          ctx.globalAlpha = (q / WEAR_STEPS) * TRAIL_EDGE.alpha;
          ctx.beginPath();
          for (const section of list) {
            const g = ribbonOf(section, seed)[layer];
            strip(ctx, g.outerLeft, g.left);
            strip(ctx, g.right, g.outerRight);
          }
          ctx.fill();
        }
      }
      ctx.fillStyle = palette.path;
      for (let layer = 0; layer < TRAIL_WIDTHS.length; layer++) {
        for (const [q, list] of byStep) {
          ctx.globalAlpha = (q / WEAR_STEPS) * TRAIL_ALPHAS[layer];
          ctx.beginPath();
          for (const section of list) {
            const { left, right } = ribbonOf(section, seed)[layer];
            strip(ctx, left, right);
          }
          ctx.fill();
        }
      }
      ctx.restore();
    },
  };
}

function parseKey(key) {
  const [a, b] = key.split('>').map((part) => {
    const [x, y] = part.split(',').map(Number);
    return { x, y };
  });
  return { key, a, b };
}

/** Adds the band between two polylines of cell points as a closed subpath, in world pixels. */
function strip(ctx, a, b) {
  let p = iso(a[0][0], a[0][1]);
  ctx.moveTo(p[0], p[1]);
  for (let k = 1; k < a.length; k++) {
    p = iso(a[k][0], a[k][1]);
    ctx.lineTo(p[0], p[1]);
  }
  for (let k = b.length - 1; k >= 0; k--) {
    p = iso(b[k][0], b[k][1]);
    ctx.lineTo(p[0], p[1]);
  }
  ctx.closePath();
}
