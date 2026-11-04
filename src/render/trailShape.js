// Shape of the trail (docs/ART.md, "Spur"): pure geometry, nothing here draws or reads the state.
//
// A trail is a chain of sections (the stretch between two consecutive route cells), each with its
// own wear. Drawn one by one, every section ended square at its ends and left spikes at the bends
// of the route. Here the sections are cut into pieces (a section that joins two levels is cut at the
// border of its cells), pieces of equal wear that follow each other are chained into one run, and
// a run is outlined as one polygon with round joins at its bends and round caps at its ends.
// Everything is in cell coordinates until the caller projects it.

import { createRng } from '../core/random.js';
import { TRAIL } from '../data/art.js';

/** Sample points of a round cap, as (cos, sin) of the angle from the side to the front. */
const CAP = [
  [0.7071, 0.7071],
  [0, 1],
  [-0.7071, 0.7071],
];
/** The inner side of a bend is mitred up to this: 1 + cos(turn angle) must stay above it. */
const MITRE_MIN = 0.35;
/** Spacing of the samples along a section in cells; an even count keeps one on the cell border. */
const SAMPLE = TRAIL.sample;

const dist = (ax, ay, bx, by) => Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));

/**
 * Outline of a polyline with a half width per vertex and side, as one closed polygon: the left
 * side forwards, the end cap, the right side backwards, the start cap. At a bend the outer side
 * is an arc of the vertex' half width, the inner side a mitre (or the two offset points for a
 * very sharp bend), so no point lies further from the line than its half width.
 * @param {{x: number, y: number, l: number, r: number}[]} pts  Vertices; `l` and `r` are the half
 *   widths to the left and the right of the direction of travel (cells).
 * @param {'round' | 'butt'} capStart
 * @param {'round' | 'butt'} capEnd
 * @returns {number[][]} Points `[x, y]`.
 */
export function lineOutline(pts, capStart = 'round', capEnd = 'round') {
  const m = pts.length;
  const dir = [];
  for (let i = 0; i + 1 < m; i++) {
    const len = dist(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) || 1;
    dir.push([(pts[i + 1].x - pts[i].x) / len, (pts[i + 1].y - pts[i].y) / len]);
  }
  // Left normal of a direction (dx, dy) is (-dy, dx).
  const side = (i, sign) => {
    const p = pts[i];
    const w = sign > 0 ? p.l : p.r;
    if (i === 0) return [[p.x - dir[0][1] * w * sign, p.y + dir[0][0] * w * sign]];
    if (i === m - 1) return [[p.x - dir[i - 1][1] * w * sign, p.y + dir[i - 1][0] * w * sign]];
    const [ax, ay] = dir[i - 1];
    const [bx, by] = dir[i];
    const n0 = [-ay * sign, ax * sign];
    const n1 = [-by * sign, bx * sign];
    const dot = n0[0] * n1[0] + n0[1] * n1[1];
    if (dot > 1 - 1e-9) return [[p.x + n1[0] * w, p.y + n1[1] * w]];
    const cross = ax * by - ay * bx;
    if (cross * sign < 0) {
      // Outer side: an arc around the vertex.
      const k = dot > 0.7 ? 2 : dot > 0 ? 3 : 4;
      const out = [];
      for (let t = 0; t <= k; t++) {
        const u = t / k;
        const vx = n0[0] * (1 - u) + n1[0] * u;
        const vy = n0[1] * (1 - u) + n1[1] * u;
        const len = dist(0, 0, vx, vy) || 1;
        out.push([p.x + (vx / len) * w, p.y + (vy / len) * w]);
      }
      return out;
    }
    if (1 + dot > MITRE_MIN) {
      const f = w / (1 + dot);
      return [[p.x + (n0[0] + n1[0]) * f, p.y + (n0[1] + n1[1]) * f]];
    }
    return [[p.x + n0[0] * w, p.y + n0[1] * w], [p.x + n1[0] * w, p.y + n1[1] * w]];
  };
  const out = [];
  for (let i = 0; i < m; i++) out.push(...side(i, 1));
  if (capEnd === 'round') out.push(...cap(pts[m - 1], dir[m - 2], 1));
  const right = [];
  for (let i = 0; i < m; i++) right.push(...side(i, -1));
  for (let i = right.length - 1; i >= 0; i--) out.push(right[i]);
  if (capStart === 'round') out.push(...cap(pts[0], dir[0], -1));
  return out;
}

/** The arc of a round cap: from the left side at the end (`forward` 1) or from the right at the start (-1). */
function cap(p, d, forward) {
  const [dx, dy] = d;
  // Direction of travel at the cap, and the normal it starts from.
  const fx = dx * forward;
  const fy = dy * forward;
  const nx = -dy * forward;
  const ny = dx * forward;
  // From the side the cap starts on to the side it ends on: left to right at the end, right to
  // left at the start. At the start the cap is seen from the line's own direction reversed.
  const wFrom = forward > 0 ? p.l : p.r;
  const wTo = forward > 0 ? p.r : p.l;
  return CAP.map(([c, s]) => {
    const w = c >= 0 ? wFrom : wTo;
    return [p.x + nx * c * w + fx * s * w, p.y + ny * c * w + fy * s * w];
  });
}

/**
 * The pie slice on the outer side of a bend between directions `a` and `b` at `p`, for a place
 * where two runs of different wear meet at a bend and the outer corner would stay open.
 * @returns {number[][]} Polygon `[x, y]`; with `inner` > 0 only the ring between the radii.
 */
export function bendWedge(p, a, b, radius, inner = 0) {
  const cross = a[0] * b[1] - a[1] * b[0];
  if (Math.abs(cross) < 1e-9 && a[0] * b[0] + a[1] * b[1] > 0) return [];
  // The outer side is opposite to the side the path turns to.
  const sign = cross > 0 ? -1 : 1;
  const n0 = [-a[1] * sign, a[0] * sign];
  const n1 = [-b[1] * sign, b[0] * sign];
  const arc = (r) => {
    const out = [];
    for (let t = 0; t <= 3; t++) {
      const u = t / 3;
      const vx = n0[0] * (1 - u) + n1[0] * u;
      const vy = n0[1] * (1 - u) + n1[1] * u;
      const len = dist(0, 0, vx, vy) || 1;
      out.push([p[0] + (vx / len) * r, p[1] + (vy / len) * r]);
    }
    return out;
  };
  if (inner > 0) return [...arc(radius), ...arc(inner).reverse()];
  return [[p[0], p[1]], ...arc(radius)];
}

/** Id of a cell centre, the place pieces of neighbouring sections join. */
const centreId = (c) => `c${c.x},${c.y}`;

/**
 * The pieces of a section. A section inside one level is one piece. A section that joins two
 * levels has none: the trail ends at the cell centre before the step and does not climb it, so
 * nothing lies over a cliff or a wall. Each piece lies on one cell, whose height lifts it.
 * @param {{key: string, a: {x: number, y: number}, b: {x: number, y: number}}} section
 * @param {(cell: {x: number, y: number}) => number} levelOf  Level of the field of a cell.
 * @returns {{id: string, from: string, to: string, cell: {x: number, y: number},
 *   pts: {x: number, y: number, id: string}[]}[]}  `from` and `to` are cell centre ids.
 */
export function piecesOf(section, levelOf) {
  const { a, b } = section;
  const ax = a.x + 0.5;
  const ay = a.y + 0.5;
  const bx = b.x + 0.5;
  const by = b.y + 0.5;
  const len = dist(ax, ay, bx, by);
  const n = 2 * Math.max(1, Math.round(len / SAMPLE / 2));
  const all = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const id = k === 0 ? centreId(a) : k === n ? centreId(b) : `${section.key}#${k}`;
    all.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, id });
  }
  if (levelOf(a) !== levelOf(b)) return [];
  return [{ id: section.key, from: centreId(a), to: centreId(b), cell: a, pts: all }];
}

/**
 * Chains pieces into runs. Two pieces follow each other when one ends where the other starts (on a
 * cell centre), both have the same wear and lie on the same height, and nothing else ends or starts
 * there. A run ends with a round cap where nothing continues. Where a piece of another wear
 * continues, the run ends flat and, if the route bends there, says so (`bendTo`) so the outer corner
 * can be filled.
 * @param {{piece: object, q: number, lift: number}[]} entries  A piece with its wear step and height.
 * @returns {{q: number, lift: number, pts: {x: number, y: number, id: string}[],
 *   capStart: 'round' | 'butt', capEnd: 'round' | 'butt', bendTo: number[] | null}[]}
 */
export function buildRuns(entries) {
  const starts = new Map();
  const ends = new Map();
  const add = (map, id, e) => {
    if (id === null) return;
    const key = `${id}@${e.lift}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  };
  for (const e of entries) {
    add(starts, e.piece.from, e);
    add(ends, e.piece.to, e);
  }
  const only = (map, id, lift) => {
    const list = map.get(`${id}@${lift}`);
    return list && list.length === 1 ? list[0] : null;
  };
  const next = new Map();
  const hasPrev = new Set();
  for (const e of entries) {
    const to = e.piece.to;
    if (to === null) continue;
    const follower = only(starts, to, e.lift);
    if (!follower || follower === e || only(ends, to, e.lift) !== e || follower.q !== e.q) continue;
    next.set(e, follower);
    hasPrev.add(follower);
  }
  const runs = [];
  for (const e of entries) {
    if (hasPrev.has(e)) continue;
    const chain = [e];
    for (let cur = next.get(e); cur && chain.length < entries.length; cur = next.get(cur)) chain.push(cur);
    const pts = [];
    chain.forEach((c, i) => pts.push(...(i ? c.piece.pts.slice(1) : c.piece.pts)));
    const first = chain[0];
    const last = chain[chain.length - 1];
    // Start: flat where a cut or another run ends exactly here, round otherwise.
    let capStart = 'round';
    if (first.piece.from === null) capStart = 'butt';
    else if (only(ends, first.piece.from, first.lift) && only(starts, first.piece.from, first.lift) === first) capStart = 'butt';
    let capEnd = 'round';
    let bendTo = null;
    if (last.piece.to === null) capEnd = 'butt';
    else {
      const follower = only(starts, last.piece.to, last.lift);
      if (follower && only(ends, last.piece.to, last.lift) === last) {
        capEnd = 'butt';
        const f = follower.piece.pts;
        const d = dist(f[0].x, f[0].y, f[1].x, f[1].y) || 1;
        bendTo = [(f[1].x - f[0].x) / d, (f[1].y - f[0].y) / d];
      }
    }
    runs.push({ q: first.q, lift: first.lift, pts, capStart, capEnd, bendTo });
  }
  return runs;
}

/** Jitter of one sample point: per layer, the sideways shift and the raggedness of each side, in -1 to 1 / 0 to 1. */
export function jitterOf(seed, id, layers) {
  const r = createRng(`trail:${seed}`).fork(id);
  const out = [];
  for (let layer = 0; layer < layers; layer++) out.push({ shift: r.next() - 0.5, l: r.next() * 2 - 1, r: r.next() * 2 - 1 });
  return out;
}

/** Roll of one sample point for the gaps of the trail, 0 to 1; its own stream, apart from the jitter. */
export function gapOf(seed, id) {
  return createRng(`trail-gap:${seed}`).fork(id).next();
}

/**
 * Cuts a run into the stretches whose points `present` accepts. A stretch needs two points; a lone
 * point is dropped. A stretch keeps the run's cap where it reaches the run's end and gets a round
 * one where it ends in a gap.
 * @param {{id: string}[]} pts
 * @param {'round' | 'butt'} capStart
 * @param {'round' | 'butt'} capEnd
 * @param {(id: string) => boolean} present
 * @returns {{pts: object[], capStart: string, capEnd: string, atEnd: boolean}[]}
 */
export function fragmentsOf(pts, capStart, capEnd, present) {
  const out = [];
  const m = pts.length;
  let from = -1;
  for (let i = 0; i <= m; i++) {
    const on = i < m && present(pts[i].id);
    if (on && from < 0) from = i;
    if (on || from < 0) continue;
    if (i - from >= 2) {
      out.push({
        pts: pts.slice(from, i),
        capStart: from === 0 ? capStart : 'round',
        capEnd: i === m ? capEnd : 'round',
        atEnd: i === m,
      });
    }
    from = -1;
  }
  return out;
}
