import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPath, octile } from '../../src/sim/pathfinding.js';
import { createGrid, setBlocked } from '../../src/sim/grid.js';
import { gridFromAscii } from './helpers.js';

const close = (a, b) => Math.abs(a - b) < 1e-9;

function assertValidPath(grid, path) {
  for (let i = 1; i < path.cells.length; i++) {
    const a = path.cells[i - 1];
    const b = path.cells[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    assert.ok(Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx || dy), `invalid step ${i}`);
    assert.equal(grid.blocked[b.y * grid.size + b.x], 0, `path crosses obstacle at ${b.x},${b.y}`);
    if (dx && dy) {
      assert.equal(grid.blocked[a.y * grid.size + b.x], 0, `corner cut at step ${i}`);
      assert.equal(grid.blocked[b.y * grid.size + a.x], 0, `corner cut at step ${i}`);
    }
  }
}

test('straight path on an empty grid', () => {
  const grid = createGrid(10);
  const path = findPath(grid, { x: 0, y: 0 }, { x: 9, y: 0 });
  assert.equal(path.cells.length, 10);
  assert.equal(path.length, 9);
  assert.deepEqual(path.cells[0], { x: 0, y: 0 });
  assert.deepEqual(path.cells.at(-1), { x: 9, y: 0 });
});

test('diagonal moves cost sqrt(2) and yield the octile distance', () => {
  const grid = createGrid(10);
  const path = findPath(grid, { x: 0, y: 0 }, { x: 6, y: 3 });
  assert.ok(close(path.length, octile(0, 0, 6, 3)));
  assert.ok(close(path.length, 3 + 3 * Math.SQRT2));
  assertValidPath(grid, path);
});

test('start equals goal', () => {
  const path = findPath(createGrid(5), { x: 2, y: 2 }, { x: 2, y: 2 });
  assert.deepEqual(path.cells, [{ x: 2, y: 2 }]);
  assert.equal(path.length, 0);
});

test('detours around a wall', () => {
  const { grid, marks } = gridFromAscii([
    '........',
    '...#....',
    '...#....',
    'S..#..G.',
    '...#....',
    '...#....',
    '...#....',
    '........',
  ]);
  const path = findPath(grid, marks.S, marks.G);
  assertValidPath(grid, path);
  assert.ok(path.length > 6, 'must be longer than the direct line');
  // Over the top gap: two diagonals up, four straight steps around the wall end
  // (up, across, across, down; no corner cutting at the tip), two diagonals down.
  assert.ok(close(path.length, 4 + 4 * Math.SQRT2), `length ${path.length}`);
  assert.ok(path.cells.some((c) => c.y === 0), 'passes through the top gap');
});

test('returns null when the goal is walled off', () => {
  const { grid, marks } = gridFromAscii([
    '......',
    '..###.',
    '..#G#.',
    '..###.',
    'S.....',
    '......',
  ]);
  assert.equal(findPath(grid, marks.S, marks.G), null);
});

test('no corner cutting between two diagonal obstacles', () => {
  // The only connection between S and G is a diagonal squeeze between two
  // obstacles touching at a corner. That squeeze is forbidden.
  const { grid, marks } = gridFromAscii([
    'S.#',
    '.#.',
    '#.G',
  ]);
  assert.equal(findPath(grid, marks.S, marks.G), null);
});

test('diagonal step next to a single obstacle is not allowed either', () => {
  const { grid, marks } = gridFromAscii([
    'S#.',
    '...',
    '..G',
  ]);
  const path = findPath(grid, marks.S, marks.G);
  assertValidPath(grid, path);
  // First step must go down, never diagonally past the obstacle.
  assert.deepEqual(path.cells[1], { x: 0, y: 1 });
});

test('blocked start or goal yields null', () => {
  const grid = createGrid(4);
  setBlocked(grid, 3, 3, true);
  assert.equal(findPath(grid, { x: 0, y: 0 }, { x: 3, y: 3 }), null);
});

test('same grid always yields the same path (deterministic tie-breaking)', () => {
  const { grid, marks } = gridFromAscii([
    'S.......',
    '........',
    '..##....',
    '..##....',
    '........',
    '.....#..',
    '........',
    '.......G',
  ]);
  const a = findPath(grid, marks.S, marks.G);
  const b = findPath(grid, marks.S, marks.G);
  assert.deepEqual(a, b);
  assertValidPath(grid, a);
});
