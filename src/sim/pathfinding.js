// A* on an 8-connected grid (GDD section 5).
// Straight steps cost 1, diagonal steps cost sqrt(2). A diagonal step is only
// allowed if both orthogonally adjacent cells are free (no corner cutting).
// Tie-breaking is fixed, so the same grid always yields the same path.

import { isBlocked } from './grid.js';

const SQRT2 = Math.SQRT2;

// Fixed neighbour order: orthogonal first, then diagonal. [dx, dy, cost]
const NEIGHBOURS = [
  [1, 0, 1], [0, 1, 1], [-1, 0, 1], [0, -1, 1],
  [1, 1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2], [1, -1, SQRT2],
];

/** Octile distance: exact shortest distance on an empty 8-connected grid. */
export function octile(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

/** Minimal binary heap over node indices, ordered by (f, h, insertion order). */
function createHeap(capacity) {
  const nodes = new Int32Array(capacity);
  const f = new Float64Array(capacity);
  const h = new Float64Array(capacity);
  const order = new Int32Array(capacity);
  let size = 0;
  let counter = 0;

  const less = (i, j) =>
    f[i] < f[j] - 1e-9 ||
    (Math.abs(f[i] - f[j]) <= 1e-9 && (h[i] < h[j] - 1e-9 || (Math.abs(h[i] - h[j]) <= 1e-9 && order[i] < order[j])));

  function swap(i, j) {
    [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
    [f[i], f[j]] = [f[j], f[i]];
    [h[i], h[j]] = [h[j], h[i]];
    [order[i], order[j]] = [order[j], order[i]];
  }

  return {
    get size() {
      return size;
    },
    push(node, fv, hv) {
      let i = size++;
      nodes[i] = node;
      f[i] = fv;
      h[i] = hv;
      order[i] = counter++;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (!less(i, parent)) break;
        swap(i, parent);
        i = parent;
      }
    },
    pop() {
      const top = nodes[0];
      size--;
      if (size > 0) {
        swap(0, size);
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < size && less(l, m)) m = l;
          if (r < size && less(r, m)) m = r;
          if (m === i) break;
          swap(i, m);
          i = m;
        }
      }
      return top;
    },
  };
}

/**
 * Shortest path between two cells.
 * @param {{size: number, blocked: Uint8Array}} grid
 * @returns {{cells: {x: number, y: number}[], length: number} | null}
 *   Cells from start to goal (inclusive), or null if unreachable.
 */
export function findPath(grid, start, goal) {
  const { size } = grid;
  const count = size * size;
  if (isBlocked(grid, start.x, start.y) || isBlocked(grid, goal.x, goal.y)) return null;

  const g = new Float64Array(count).fill(Infinity);
  const cameFrom = new Int32Array(count).fill(-1);
  const closed = new Uint8Array(count);
  // Each node can be pushed once per improvement; 8 * count is a safe bound.
  const open = createHeap(count * 8);

  const startIdx = start.y * size + start.x;
  const goalIdx = goal.y * size + goal.x;
  g[startIdx] = 0;
  const h0 = octile(start.x, start.y, goal.x, goal.y);
  open.push(startIdx, h0, h0);

  while (open.size > 0) {
    const current = open.pop();
    if (closed[current]) continue;
    if (current === goalIdx) break;
    closed[current] = 1;

    const cx = current % size;
    const cy = (current - cx) / size;
    for (const [dx, dy, cost] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (isBlocked(grid, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (isBlocked(grid, cx + dx, cy) || isBlocked(grid, cx, cy + dy))) continue;
      const next = ny * size + nx;
      if (closed[next]) continue;
      const tentative = g[current] + cost;
      if (tentative < g[next] - 1e-9) {
        g[next] = tentative;
        cameFrom[next] = current;
        const hv = octile(nx, ny, goal.x, goal.y);
        open.push(next, tentative + hv, hv);
      }
    }
  }

  if (g[goalIdx] === Infinity) return null;

  const cells = [];
  for (let i = goalIdx; i !== -1; i = cameFrom[i]) {
    const x = i % size;
    cells.push({ x, y: (i - x) / size });
  }
  cells.reverse();
  return { cells, length: g[goalIdx] };
}
