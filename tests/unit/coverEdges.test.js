import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverHulls, coverHullsOfSquare, groundAround, shadowPlan } from '../../src/render/cover.js';

/** A size x size field from rows of digits, row 0 first. */
const field = (rows) => Uint8Array.from(rows.join('').split('').map(Number));
const flat = (n) => field(Array.from({ length: n }, () => '0'.repeat(n)));
const body = (height) => [{ footprint: [[0, 0], [1, 0], [1, 1], [0, 1]], height }];

test('a square figure is covered by the blocks in front of any of its fields, not by its own', () => {
  // A 2 x 2 square at (1, 1) on level 0 and a high block at (3, 3) in front of it.
  const f = field(['00000', '00000', '00000', '00010', '00000']);
  const hit = coverHullsOfSquare(f, 1, 1, 2);
  assert.ok(hit.cells.some((c) => c.x === 3 && c.y === 3), 'the block in front covers');
  assert.equal(hit.hulls.length, hit.cells.length);
  assert.equal(new Set(hit.cells.map((c) => `${c.x},${c.y}`)).size, hit.cells.length, 'each block once');
  assert.equal(coverHullsOfSquare(f, 1, 1, 2), hit, 'cached');
  assert.equal(coverHullsOfSquare(f, 0, 0, 1), coverHulls(f, 0, 0), 'size 1 is the plain lookup');
});

test('a raised field inside the square never cuts the figure standing on it', () => {
  const f = field(['00000', '00000', '00100', '00000', '00000']);
  const hit = coverHullsOfSquare(f, 1, 1, 2);
  assert.ok(!hit.cells.some((c) => c.x === 2 && c.y === 2));
});

test('the ground a shadow may lie on is the fields of its level around the body', () => {
  const open = groundAround(flat(5), 2, 2);
  assert.equal(open.cells.length, 9);
  assert.equal(open.edge, false);

  const f = field(['000', '010', '000']);
  const low = groundAround(f, 0, 1);
  assert.equal(low.edge, true);
  assert.ok(!low.cells.some((c) => c.x === 1 && c.y === 1), 'the high field is no ground for it');

  // On the high field every neighbour is lower, and so is the rim of the map.
  const high = groundAround(f, 1, 1);
  assert.deepEqual(high.cells, [{ x: 1, y: 1 }]);
  assert.equal(high.edge, true);

  // On level 0 the rim of the map is the same level: no edge by itself, the fields outside count.
  const rim = groundAround(flat(3), 0, 0);
  assert.equal(rim.edge, false);
  assert.equal(rim.cells.length, 9);
});

test('a shadow in the open stays plain, one at a step is clipped', () => {
  const f = field(['0000000', '0000000', '0000000', '0001000', '0000000', '0000000', '0000000']);
  const plan = shadowPlan(f, [
    { x: 0, y: 6, bodies: body(10) }, // far from the step, nothing in front
    { x: 2, y: 3, bodies: body(20) }, // beside the block: loses the block as ground
    { x: 3, y: 3, bodies: body(30) }, // on the block (level 1)
    { x: 5, y: 5, bodies: [] },
  ]);
  assert.equal(plan[0].plain.length, 1);
  assert.equal(plan[0].plain[0].height, 10);
  assert.equal(plan[0].edge.length, 1);
  assert.equal(plan[0].edge[0].height, 20);
  assert.ok(!plan[0].ground.some((c) => c.x === 3 && c.y === 3));
  assert.equal(plan[1].edge.length, 1);
  assert.deepEqual(plan[1].ground, [{ x: 3, y: 3 }]);
  assert.equal(plan[2].plain.length + plan[2].edge.length, 0);
});

test('a shadow on a field hidden by a block in front is cut by that block, each block once', () => {
  const f = field(['000', '010', '000']);
  const plan = shadowPlan(f, [
    { x: 0, y: 1, bodies: body(20) },
    { x: 0, y: 0, bodies: body(20) },
  ]);
  const cuts = plan[0].cuts;
  assert.ok(cuts.length >= 1);
  assert.deepEqual(cuts[0], coverHulls(f, 0, 1).hulls[0]);
  assert.equal(new Set(cuts.map((h) => JSON.stringify(h))).size, cuts.length);
});

test('a body behind a block keeps what stands above the block: the hull is only top face and walls', () => {
  // A ruin 40 px tall on level 0 behind a step of 12 px: its foot lies in the picture of the block,
  // its top stands above it and is not cut away.
  const f = field(['000', '010', '000']);
  const [hull] = coverHulls(f, 0, 1).hulls;
  const inside = (px, py) => {
    let c = false;
    for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) {
      const [xi, yi] = hull[i];
      const [xj, yj] = hull[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const p = (x, y, z) => [(x - y) * 32, (x + y) * 16 - z];
  assert.equal(inside(...p(0.9, 1.9, 0)), true, 'the foot of the ruin is hidden by the block');
  assert.equal(inside(...p(0.9, 1.5, 40)), false, 'the top of the ruin stands above it');
});

test('the ground a mark may lie on grows with its reach and stays on the level of its field', () => {
  const f = field(['00000', '00000', '00100', '00000', '00000']);
  const one = groundAround(f, 0, 0, 1, 1);
  const two = groundAround(f, 0, 0, 1, 2);
  assert.ok(two.cells.length > one.cells.length);
  assert.ok(!two.cells.some((c) => c.x === 2 && c.y === 2), 'the raised field is no ground for it');
  assert.equal(one.edge, false, 'nothing differs within one field');
  assert.equal(two.edge, true, 'the raised field is within two');
});
