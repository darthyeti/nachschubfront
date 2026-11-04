import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverHulls, plateBounds, coveringObstacles, CUT_GROW } from '../../src/render/cover.js';
import { occludersOf } from '../../src/render/occlusion.js';
import { obstacleShadow } from '../../src/render/objects.js';
import { towerPictureBox } from '../../src/render/towerSprites.js';
import { OBSTACLE_SEE_THROUGH } from '../../src/data/art.js';

/** A size x size field from rows of digits, row 0 first. */
const field = (rows) => Uint8Array.from(rows.join('').split('').map(Number));
const flat = (n) => field(Array.from({ length: n }, () => '0'.repeat(n)));

/** The picture box of a bunker (socket and top), as the scene reads it. */
const BOX = [-27, -32, 27, 16];

/** An obstacle with one tall body filling the middle of its cell (cell coordinates, height in px). */
const block = (cells, h, extra = {}) => ({
  cells,
  bodies: (i) => [{ x0: cells[i].x + 0.15, y0: cells[i].y + 0.15, x1: cells[i].x + 0.85, y1: cells[i].y + 0.85, h }],
  ...extra,
});

test('the plate keeps its overhang on open ground', () => {
  const f = flat(3);
  assert.deepEqual(plateBounds(f, 1, 1, -0.1), { x0: 0.9, y0: 0.9, x1: 2.1, y1: 2.1 });
});

test('the plate stops at the edge of a step, in front of it and behind it, and at the rim of the map', () => {
  const f = field(['000', '010', '000']);
  // (1, 1) is the high field: every neighbour is lower.
  assert.deepEqual(plateBounds(f, 1, 1, -0.1), { x0: 1, y0: 1, x1: 2, y1: 2 });
  // (0, 1) is lower, its +x neighbour is the high field: stops there, keeps the rest (the rim of the map at x = 0 as well).
  assert.deepEqual(plateBounds(f, 0, 1, -0.1), { x0: 0, y0: 0.9, x1: 1, y1: 2.1 });
});

test('a block in front covers the field behind it and the hull is cached', () => {
  const f = field(['000', '010', '000']);
  const a = coverHulls(f, 0, 1);
  assert.deepEqual(a.cells, occludersOf(f, 0, 1));
  assert.equal(a.hulls.length, a.cells.length);
  assert.equal(coverHulls(f, 0, 1), a);
  assert.deepEqual(coverHulls(f, 2, 2).cells, []);
  assert.deepEqual(coverHulls(f, 2, 2).hulls, []);
  assert.ok(CUT_GROW > 0);
});

test('an obstacle in front that covers the picture of an emplacement is found', () => {
  const f = flat(6);
  const ruin = block([{ x: 3, y: 2 }], 45);
  const found = coveringObstacles(f, [{ x: 2, y: 2, box: BOX }], [ruin]);
  assert.ok(found.has(ruin));
});

test('an obstacle behind or beside the emplacement never covers it', () => {
  const f = flat(6);
  const behind = block([{ x: 1, y: 2 }], 60);
  const behindDiagonal = block([{ x: 1, y: 1 }], 60);
  // Same x + y: drawn before the emplacement, so it cannot cover it.
  const beside = block([{ x: 3, y: 1 }], 60);
  assert.equal(coveringObstacles(f, [{ x: 2, y: 2, box: BOX }], [behind, behindDiagonal, beside]).size, 0);
});

test('a low obstacle in front does not cover enough', () => {
  const f = flat(6);
  const heap = block([{ x: 3, y: 2 }], 6);
  assert.equal(coveringObstacles(f, [{ x: 2, y: 2, box: BOX }], [heap]).size, 0);
});

test('a wall counts as a whole when one of its cells covers the emplacement', () => {
  const f = flat(8);
  const wall = block(
    [{ x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 3, y: 5 }],
    40,
  );
  const found = coveringObstacles(f, [{ x: 2, y: 2, box: BOX }], [wall]);
  assert.ok(found.has(wall));
});

test('an obstacle far in front is out of reach', () => {
  const f = flat(12);
  const far = block([{ x: 9, y: 9 }], 200);
  assert.equal(coveringObstacles(f, [{ x: 2, y: 2, box: BOX }], [far]).size, 0);
});

test('the share needed comes from the data', () => {
  const f = flat(6);
  const ruin = block([{ x: 3, y: 2 }], 45);
  const tower = [{ x: 2, y: 2, box: BOX }];
  assert.ok(coveringObstacles(f, tower, [ruin], { minShare: 0.01, grid: [4, 5] }).has(ruin));
  assert.equal(coveringObstacles(f, tower, [ruin], { minShare: 1.01, grid: [4, 5] }).size, 0);
  assert.ok(OBSTACLE_SEE_THROUGH.alpha > 0 && OBSTACLE_SEE_THROUGH.alpha < 1);
});

test('heights count: an obstacle on lower ground in front of an emplacement on a rim does not cover it', () => {
  // The emplacement stands on level 1 (12 px), the ruin in front of it on level 0 and 8 px tall: below the emplacement.
  const f = field(['11000', '11000', '00000']);
  const heap = block([{ x: 2, y: 0 }], 8);
  assert.equal(coveringObstacles(f, [{ x: 1, y: 0, box: BOX }], [heap]).size, 0);
});

test('with the real kit: capsule rubble beside a bunker never covers it, a ruin right in front does', () => {
  const f = flat(8);
  const tower = { x: 3, y: 3, doctrine: 'autocannon', rank: 3 };
  const entry = { x: tower.x, y: tower.y, box: towerPictureBox(tower) };
  const asEntry = (o) => ({
    cells: o.cells,
    bodies: (i) =>
      obstacleShadow(o, i).map(({ footprint, height }) => ({
        x0: footprint[0][0],
        y0: footprint[0][1],
        x1: footprint[2][0],
        y1: footprint[2][1],
        h: height,
      })),
  });
  // A heap of capsule rubble beside the emplacement (in front of it, in every cell next to it) is flat
  // and never covers it: the heap of the issue does not hide the socket.
  for (let variant = 0; variant < 4; variant++) {
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [2, 0], [0, 2]]) {
      const heap = { kind: 'rubble', cells: [{ x: tower.x + dx, y: tower.y + dy }], variant };
      assert.equal(coveringObstacles(f, [entry], [asEntry(heap)]).size, 0, `rubble ${variant} at ${dx},${dy}`);
    }
  }
  // A ruin right in front covers it at least in some variants.
  let covered = 0;
  for (let variant = 0; variant < 4; variant++) {
    const ruin = { kind: 'ruin', cells: [{ x: tower.x + 1, y: tower.y }], variant };
    if (coveringObstacles(f, [entry], [asEntry(ruin)]).size) covered++;
  }
  assert.ok(covered > 0);
});
