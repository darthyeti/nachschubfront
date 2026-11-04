// The trail (docs/ART.md, "Gelände, Licht und Biome"): what the walking enemies leave behind.
// Every section of the current route (the stretch between two consecutive cells) carries a wear
// from 0 to 1. It grows with every ground enemy that enters the section and fades on sections
// that are no longer part of the route. Presentation state beside `ui`: never in `state`, never
// saved, never recorded. The numbers are the starting points of reference/studien/optik-studie.js.

import { iso } from './iso.js';
import { TRAIL } from '../data/art.js';
import { STEP, cellHeight, fieldSize } from './terrain.js';
import { lineOutline, bendWedge, piecesOf, buildRuns, jitterOf, gapOf, fragmentsOf } from './trailShape.js';

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
  /** Outlines of the runs, rebuilt when the wear steps, the seed or the field change. */
  let shapes = { seed: null, field: null, groups: new Map(), steps: null };

  function reset() {
    wear.clear();
    entered = new WeakMap();
    shapes = { seed: null, field: null, groups: new Map(), steps: null };
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

    /**
     * Draws the trail on the ground, in world coordinates (the camera is already applied).
     * @param {Uint8Array} [field]  Height field: the trail then lies on the height of each cell
     *   and a ramp joins two cells of different levels.
     */
    draw(ctx, palette, art, seed, field = null) {
      if (art !== 'sprites') return;
      const all = new Map(sections.map((s) => [s.key, s]));
      if (wear.size) {
        const steps = [];
        for (const [key, w] of wear) {
          const q = Math.round(w * WEAR_STEPS);
          if (q > 0) steps.push({ section: all.get(key) ?? parseKey(key), q });
        }
        const groups = shapesOf(steps, seed, field);
        ctx.save();
        // The hems first, wide layers before narrow ones, so the fills of the wider layers
        // soften the hems inside and only the outer ones stay clear.
        ctx.fillStyle = palette.pathEdge;
        for (let layer = 0; layer < TRAIL.widths.length; layer++) {
          for (const [q, runs] of groups) {
            ctx.globalAlpha = (q / WEAR_STEPS) * TRAIL.edge.alpha;
            ctx.beginPath();
            for (const run of runs) {
              for (const shape of run.layers[layer]) {
                addPoly(ctx, shape.hemOuter, false);
                addPoly(ctx, shape.fill, true);
                for (const wedge of shape.hemWedges) addPoly(ctx, wedge, false);
              }
            }
            ctx.fill();
          }
        }
        ctx.fillStyle = palette.path;
        for (let layer = 0; layer < TRAIL.widths.length; layer++) {
          for (const [q, runs] of groups) {
            ctx.globalAlpha = (q / WEAR_STEPS) * TRAIL.alphas[layer];
            ctx.beginPath();
            for (const run of runs) {
              for (const shape of run.layers[layer]) {
                addPoly(ctx, shape.fill, false);
                for (const wedge of shape.fillWedges) addPoly(ctx, wedge, false);
              }
            }
            ctx.fill();
          }
        }
        ctx.restore();
      }
    },
  };

  /**
   * The outlines of all runs, by wear step. Cached: they only change when a section changes its
   * wear step, the seed or the field.
   * @returns {Map<number, object[]>}
   */
  function shapesOf(steps, seed, field) {
    // Compared entry by entry with the last call: nothing is built per frame while the wear steps stand.
    const prev = shapes.steps;
    let same = shapes.seed === seed && shapes.field === field && prev && prev.length === steps.length;
    for (let i = 0; same && i < steps.length; i++) same = prev[i].key === steps[i].section.key && prev[i].q === steps[i].q;
    if (same) return shapes.groups;
    const size = field ? fieldSize(field) : 0;
    const lift = (cell) => (field ? cellHeight(field, size, cell.x, cell.y) : 0);
    const levelOf = (cell) => lift(cell) / STEP;
    const entries = [];
    for (const { section, q } of steps) {
      for (const piece of piecesOf(section, levelOf)) entries.push({ piece, q, lift: lift(piece.cell) });
    }
    const jitter = new Map();
    const jitterAt = (id) => {
      let j = jitter.get(id);
      if (!j) jitter.set(id, (j = jitterOf(seed, id, TRAIL.widths.length)));
      return j;
    };
    const gaps = new Map();
    const gapAt = (id) => {
      let g = gaps.get(id);
      if (g === undefined) gaps.set(id, (g = gapOf(seed, id)));
      return g;
    };
    const groups = new Map();
    const { presence } = TRAIL;
    for (const run of buildRuns(entries)) {
      const wear = run.q / WEAR_STEPS;
      const layers = TRAIL.widths.map((width, layer) => {
        const half = width / 2;
        const limit = presence.base + presence.gain * wear - presence.cut * layer;
        const project = (poly) => poly.map(([x, y]) => iso(x, y, run.lift));
        const shapes = [];
        const pts = run.pts.map((p) => {
          const j = jitterAt(p.id)[layer];
          const shift = j.shift * TRAIL.shift;
          return { x: p.x, y: p.y, id: p.id, l: half * (1 + TRAIL.rag * j.l) + shift, r: half * (1 + TRAIL.rag * j.r) - shift };
        });
        for (const frag of fragmentsOf(pts, run.capStart, run.capEnd, (id) => gapAt(id) < limit)) {
          const fill = project(lineOutline(frag.pts, frag.capStart, frag.capEnd));
          const hem = frag.pts.map((p) => ({ ...p, l: p.l + TRAIL.edge.width, r: p.r + TRAIL.edge.width }));
          const hemOuter = project(lineOutline(hem, frag.capStart, frag.capEnd));
          const fillWedges = [];
          const hemWedges = [];
          if (run.bendTo && frag.atEnd) {
            const m = frag.pts.length;
            const last = frag.pts[m - 1];
            const prev = frag.pts[m - 2];
            const d = Math.sqrt((last.x - prev.x) * (last.x - prev.x) + (last.y - prev.y) * (last.y - prev.y)) || 1;
            const dir = [(last.x - prev.x) / d, (last.y - prev.y) / d];
            const w = (last.l + last.r) / 2;
            fillWedges.push(project(bendWedge([last.x, last.y], dir, run.bendTo, w)));
            hemWedges.push(project(bendWedge([last.x, last.y], dir, run.bendTo, w + TRAIL.edge.width, w)));
          }
          shapes.push({ fill, hemOuter, fillWedges, hemWedges });
        }
        return shapes;
      });
      if (!groups.has(run.q)) groups.set(run.q, []);
      groups.get(run.q).push({ layers });
    }
    shapes = { seed, field, groups, steps: steps.map((e) => ({ key: e.section.key, q: e.q })) };
    return groups;
  }
}

/**
 * Adds a polygon of world pixels as a closed subpath, backwards if `reverse` (the inner edge of a
 * hem ring runs against the outer one, so the ring is what is left between them).
 */
function addPoly(ctx, poly, reverse) {
  const m = poly.length;
  if (m < 3) return;
  const at = (i) => poly[reverse ? m - 1 - i : i];
  ctx.moveTo(at(0)[0], at(0)[1]);
  for (let i = 1; i < m; i++) ctx.lineTo(at(i)[0], at(i)[1]);
  ctx.closePath();
}

function parseKey(key) {
  const [a, b] = key.split('>').map((part) => {
    const [x, y] = part.split(',').map(Number);
    return { x, y };
  });
  return { key, a, b };
}
