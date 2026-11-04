import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineOutline, bendWedge, piecesOf, buildRuns, jitterOf, gapOf, fragmentsOf } from '../../src/render/trailShape.js';
import { TRAIL } from '../../src/data/art.js';

const TRAIL_WIDTHS = TRAIL.widths;
const TRAIL_RAG = TRAIL.rag;
const TRAIL_SHIFT = TRAIL.shift;

/** Distance of a point to a segment. */
function distToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const x = ax + dx * t - px;
  const y = ay + dy * t - py;
  return Math.sqrt(x * x + y * y);
}

/** Distance of a point to a polyline of `[x, y]`. */
function distToLine(p, line) {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) best = Math.min(best, distToSegment(p[0], p[1], line[i], line[i + 1]));
  return best;
}

/** Vertices of a route through cell centres with the samples of `piecesOf`, widths as in the game. */
function vertices(cells, width, seed = 'S', layer = 0) {
  const pts = [];
  for (let i = 0; i + 1 < cells.length; i++) {
    const key = `${cells[i].x},${cells[i].y}>${cells[i + 1].x},${cells[i + 1].y}`;
    const [piece] = piecesOf({ key, a: cells[i], b: cells[i + 1] }, () => 0);
    pts.push(...(i ? piece.pts.slice(1) : piece.pts));
  }
  return pts.map((p) => {
    const j = jitterOf(seed, p.id, 3)[layer];
    const half = width / 2;
    return {
      x: p.x,
      y: p.y,
      l: half * (1 + TRAIL_RAG * j.l) + j.shift * TRAIL_SHIFT,
      r: half * (1 + TRAIL_RAG * j.r) - j.shift * TRAIL_SHIFT,
    };
  });
}

const ROUTES = {
  zigzag: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 2], [4, 1]],
  diagonals: [[0, 0], [1, 1], [2, 2], [3, 2], [4, 3], [5, 3], [6, 2], [6, 1], [7, 0]],
  staircase: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
};

for (const [name, route] of Object.entries(ROUTES)) {
  test(`no point of the outline is further from the route than half the width plus the fringe (${name})`, () => {
    const cells = route.map(([x, y]) => ({ x, y }));
    TRAIL_WIDTHS.forEach((width, layer) => {
      const pts = vertices(cells, width, 'SEED', layer);
      const line = pts.map((p) => [p.x, p.y]);
      const outline = lineOutline(pts, 'round', 'round');
      const limit = (width / 2) * (1 + TRAIL_RAG) + TRAIL_SHIFT / 2 + 1e-9;
      assert.ok(outline.length > pts.length * 2, 'caps and arcs add points');
      for (const p of outline) {
        const d = distToLine(p, line);
        assert.ok(d <= limit, `a point lies ${d.toFixed(3)} cells off the line, the limit is ${limit.toFixed(3)}`);
      }
    });
  });
}

test('the outline of a sharp bend has no spike: a mitre never reaches further than the half width', () => {
  // A right angle with a flat sample spacing: the corner would stand out by 1.41 times with a plain offset.
  const pts = [
    { x: 0, y: 0, l: 0.3, r: 0.3 },
    { x: 1, y: 0, l: 0.3, r: 0.3 },
    { x: 1, y: 1, l: 0.3, r: 0.3 },
  ];
  const outline = lineOutline(pts, 'butt', 'butt');
  const line = pts.map((p) => [p.x, p.y]);
  for (const p of outline) assert.ok(distToLine(p, line) <= 0.3 + 1e-9);
  // The outer corner is rounded: a point on the arc at 45 degrees round the vertex.
  assert.ok(outline.some(([x, y]) => Math.abs(x - 1.2) < 0.05 && Math.abs(y + 0.2) < 0.05));
});

test('a round cap reaches one half width beyond the end and a butt end does not', () => {
  const pts = [
    { x: 0, y: 0, l: 0.3, r: 0.3 },
    { x: 2, y: 0, l: 0.3, r: 0.3 },
  ];
  const round = lineOutline(pts, 'round', 'round');
  const butt = lineOutline(pts, 'butt', 'butt');
  assert.ok(Math.max(...round.map((p) => p[0])) > 2.25);
  assert.ok(Math.min(...round.map((p) => p[0])) < -0.25);
  assert.ok(Math.max(...butt.map((p) => p[0])) <= 2 + 1e-9);
  assert.ok(Math.min(...butt.map((p) => p[0])) >= -1e-9);
});

test('the outline keeps one orientation whichever way the line runs', () => {
  const signedArea = (poly) => {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x0, y0] = poly[i];
      const [x1, y1] = poly[(i + 1) % poly.length];
      a += x0 * y1 - x1 * y0;
    }
    return a / 2;
  };
  const line = (dx, dy) => [
    { x: 0, y: 0, l: 0.3, r: 0.3 },
    { x: dx, y: dy, l: 0.3, r: 0.3 },
    { x: dx * 2 + dy, y: dy * 2 + dx, l: 0.3, r: 0.3 },
  ];
  const signs = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([dx, dy]) => Math.sign(signedArea(lineOutline(line(dx, dy)))));
  assert.equal(new Set(signs).size, 1, 'two runs that overlap must add up, not cancel');
});

test('a bend wedge lies on the outer side of the bend and within the radius', () => {
  const wedge = bendWedge([1, 0], [1, 0], [0, 1], 0.3);
  // The path turns towards +y, so the outer side is -y.
  assert.ok(wedge.every(([x, y]) => y <= 1e-9 || (x === 1 && y === 0)));
  assert.ok(wedge.every(([x, y]) => Math.sqrt((x - 1) * (x - 1) + y * y) <= 0.3 + 1e-9));
  assert.deepEqual(bendWedge([1, 0], [1, 0], [1, 0], 0.3), [], 'a straight continuation needs none');
  const ring = bendWedge([1, 0], [1, 0], [0, 1], 0.4, 0.3);
  assert.ok(ring.every(([x, y]) => Math.sqrt((x - 1) * (x - 1) + y * y) >= 0.3 - 1e-9));
});

/** Entries for `buildRuns` from a route and a wear step per section. */
function entriesOf(route, qOf = () => 5, levelOf = () => 0) {
  const cells = route.map(([x, y]) => ({ x, y }));
  const entries = [];
  for (let i = 0; i + 1 < cells.length; i++) {
    const key = `${cells[i].x},${cells[i].y}>${cells[i + 1].x},${cells[i + 1].y}`;
    for (const piece of piecesOf({ key, a: cells[i], b: cells[i + 1] }, levelOf)) {
      entries.push({ piece, q: qOf(i), lift: levelOf(piece.cell) * 12 });
    }
  }
  return entries;
}

test('a whole route of equal wear is one run with round ends, bends and all', () => {
  const runs = buildRuns(entriesOf(ROUTES.zigzag));
  assert.equal(runs.length, 1);
  assert.equal(runs[0].capStart, 'round');
  assert.equal(runs[0].capEnd, 'round');
  assert.equal(runs[0].bendTo, null);
  // Nine sections of four samples, the joints counted once.
  assert.equal(runs[0].pts.length, 9 * 4 + 1);
});

test('where the wear step changes the run ends flat and the next one starts flat', () => {
  const runs = buildRuns(entriesOf(ROUTES.zigzag, (i) => (i < 3 ? 6 : 3)));
  assert.equal(runs.length, 2);
  const [a, b] = runs;
  assert.equal(a.q, 6);
  assert.equal(b.q, 3);
  assert.equal(a.capStart, 'round');
  assert.equal(a.capEnd, 'butt');
  assert.equal(b.capStart, 'butt');
  assert.equal(b.capEnd, 'round');
  // The route runs straight on (down) where the wear changes: the next direction equals the last, so no wedge.
  assert.deepEqual(a.bendTo.map((v) => Math.round(v)), [0, 1]);
  assert.deepEqual(bendWedge([2, 1.5], [0, 1], a.bendTo, 0.3), []);
});

test('a change of wear at a bend asks for the outer corner to be filled', () => {
  // Section 1 runs right, section 2 runs down: the bend is at cell (2, 0), where the wear changes.
  const runs = buildRuns(entriesOf([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], (i) => (i < 2 ? 6 : 3)));
  assert.equal(runs.length, 2);
  assert.deepEqual(runs[0].bendTo.map((v) => Math.round(v)), [0, 1]);
});

test('a fork ends every run round: nothing is chained where two routes meet', () => {
  const fork = [
    ...entriesOf([[0, 0], [1, 0], [2, 0]]),
    ...entriesOf([[1, 0], [1, 1], [1, 2]]),
  ];
  const runs = buildRuns(fork);
  assert.equal(runs.length, 3, 'the cell (1, 0) is a fork: three runs meet there');
  const atFork = (r) => r.pts[0].id === 'c1,0' || r.pts[r.pts.length - 1].id === 'c1,0';
  for (const r of runs.filter(atFork)) {
    const cap = r.pts[0].id === 'c1,0' ? r.capStart : r.capEnd;
    assert.equal(cap, 'round');
  }
});

test('a section across two levels has no piece: the trail stops before every step', () => {
  const level = (c) => (c.x >= 2 ? 1 : 0);
  assert.deepEqual(piecesOf({ key: '1,0>2,0', a: { x: 1, y: 0 }, b: { x: 2, y: 0 } }, level), []);
  assert.deepEqual(piecesOf({ key: '2,0>1,0', a: { x: 2, y: 0 }, b: { x: 1, y: 0 } }, level), []);
  assert.deepEqual(piecesOf({ key: '1,0>2,1', a: { x: 1, y: 0 }, b: { x: 2, y: 1 } }, level), [], 'nor across a diagonal');
  assert.equal(piecesOf({ key: '2,0>3,0', a: { x: 2, y: 0 }, b: { x: 3, y: 0 } }, level).length, 1);
});

test('no run over a stepped route reaches the border of a step', () => {
  const level = (c) => (c.x >= 2 ? 1 : 0);
  const runs = buildRuns(entriesOf([[0, 0], [1, 0], [2, 0], [3, 0]], () => 5, level));
  for (const r of runs) for (const p of r.pts) assert.ok(p.x <= 1.5 + 1e-9 || p.x >= 2.5 - 1e-9, `a point at ${p.x} is on the edge`);
});

test('the trail is narrow: no layer is wider than half the old 0.55 cells plus the fringe', () => {
  assert.ok(TRAIL.widths[0] * (1 + TRAIL.rag) <= 0.55 / 2 * 1.35);
  assert.ok(TRAIL.widths.every((w, i) => i === 0 || w < TRAIL.widths[i - 1]));
});

test('fragments are stretches of two or more present points and keep the caps only at the ends', () => {
  const pts = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ id: `p${i}`, x: i, y: 0 }));
  const on = new Set(['p0', 'p1', 'p2', 'p4', 'p6']);
  const frags = fragmentsOf(pts, 'butt', 'butt', (id) => on.has(id));
  assert.equal(frags.length, 1, 'lone points are dropped');
  assert.equal(frags[0].pts.length, 3);
  assert.equal(frags[0].capStart, 'butt');
  assert.equal(frags[0].capEnd, 'round');
  assert.equal(frags[0].atEnd, false);
  assert.equal(fragmentsOf(pts, 'round', 'round', () => true).length, 1);
  assert.equal(fragmentsOf(pts, 'round', 'round', () => false).length, 0);
});

test('the gaps are the same wherever they are asked and denser trails keep more of the points', () => {
  assert.equal(gapOf('A', 'c3,4'), gapOf('A', 'c3,4'));
  assert.notEqual(gapOf('A', 'c3,4'), gapOf('B', 'c3,4'));
  const share = (wear) => {
    let n = 0;
    for (let i = 0; i < 400; i++) if (gapOf('S', `k${i}`) < TRAIL.presence.base + TRAIL.presence.gain * wear) n++;
    return n / 400;
  };
  assert.ok(share(0.2) < share(0.9));
  assert.ok(share(1) < 1.01 && share(0.1) > 0.2);
});

test('runs on different heights are never chained', () => {
  const level = (c) => (c.x >= 2 ? 1 : 0);
  const runs = buildRuns(entriesOf([[0, 0], [1, 0], [2, 0], [3, 0]], () => 5, level));
  assert.ok(runs.length >= 2);
  assert.ok(new Set(runs.map((r) => r.lift)).size >= 2);
  assert.ok(runs.every((r) => r.pts.every((p) => (p.x < 2) === (r.lift === 0))), 'every run lies on one level');
});

test('the jitter of a sample point is the same wherever it is asked', () => {
  assert.deepEqual(jitterOf('A', 'c3,4', 3), jitterOf('A', 'c3,4', 3));
  assert.notDeepEqual(jitterOf('A', 'c3,4', 3), jitterOf('B', 'c3,4', 3));
});
