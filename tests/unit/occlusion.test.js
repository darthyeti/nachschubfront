import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occludersOf, occludersOfAll, cellsKey, blockHull, fadeStep } from '../../src/render/occlusion.js';
import { STEP } from '../../src/render/terrain.js';
import { REVEAL } from '../../src/data/art.js';

/** A size x size field from rows of digits, row 0 first. */
const field = (rows) => Uint8Array.from(rows.join('').split('').map(Number));
const keys = (cells) => cells.map((c) => `${c.x},${c.y}`);

test('a flat field hides nothing', () => {
  const f = field(['000', '000', '000']);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) assert.deepEqual(occludersOf(f, x, y), []);
});

test('a block right in front of a lower field covers it', () => {
  const f = field(['000', '010', '000']);
  assert.deepEqual(keys(occludersOf(f, 0, 1)), ['1,1']);
  assert.deepEqual(keys(occludersOf(f, 1, 0)), ['1,1']);
  assert.deepEqual(keys(occludersOf(f, 0, 0)), ['1,1']);
});

test('a block behind a field (smaller x + y) never covers it', () => {
  const f = field(['000', '010', '000']);
  assert.deepEqual(occludersOf(f, 2, 1), []);
  assert.deepEqual(occludersOf(f, 1, 2), []);
  assert.deepEqual(occludersOf(f, 2, 2), []);
});

test('a block of the same or a lower level covers nothing', () => {
  const f = field(['111', '111', '111']);
  assert.deepEqual(occludersOf(f, 0, 0), []);
  const g = field(['100', '000', '000']);
  assert.deepEqual(occludersOf(g, 1, 1), []);
});

test('cells on top of a plateau do not hide each other, the field behind its corner is hidden', () => {
  const f = field(['0000', '0110', '0110', '0000']);
  assert.deepEqual(keys(occludersOf(f, 1, 1)), []);
  assert.ok(keys(occludersOf(f, 0, 0)).includes('1,1'));
});

test('a field out of the map hides nothing and a far block is out of reach', () => {
  const rows = Array.from({ length: 10 }, () => '0000000000');
  rows[9] = '0000000002';
  const f = field(rows);
  assert.deepEqual(occludersOf(f, -1, 0), []);
  assert.deepEqual(occludersOf(f, 0, 0), []);
});

test('a two level wall hides the same fields as one level (the sight line is 32 px per cell)', () => {
  const one = field(['000', '010', '000']);
  const two = field(['000', '020', '000']);
  assert.deepEqual(keys(occludersOf(two, 0, 0)), keys(occludersOf(one, 0, 0)));
});

test('the top face of a block covers the field behind it even where it has no wall', () => {
  const f = field(['000', '011', '011']);
  assert.deepEqual(keys(occludersOf(f, 0, 0)), ['1,1']);
});

test('the union of several subjects has no duplicates', () => {
  const f = field(['000', '010', '000']);
  const all = occludersOfAll(f, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]);
  assert.deepEqual(keys(all), ['1,1']);
});

test('the key of a set does not depend on its order', () => {
  assert.equal(cellsKey([{ x: 2, y: 1 }, { x: 0, y: 3 }]), cellsKey([{ x: 0, y: 3 }, { x: 2, y: 1 }]));
});

test('the hull of a block reaches from the top face down to the lower neighbours', () => {
  const f = field(['000', '010', '000']);
  const hull = blockHull(f, 1, 1, 0);
  const ys = hull.map((p) => p[1]);
  const top = (1 + 1) * 16 - STEP;
  const bottom = (1 + 1 + 2) * 16;
  assert.equal(Math.min(...ys), top);
  assert.equal(Math.max(...ys), bottom - 0);
  const grown = blockHull(f, 1, 1, 3);
  assert.ok(Math.min(...grown.map((p) => p[1])) < top);
});

test('fading takes about fadeMs, and reduced motion switches at once', () => {
  let v = 0;
  for (let i = 0; i < 9; i++) v = fadeStep(v, 1, 1 / 60, false);
  assert.ok(Math.abs(v - 1) < 1e-9, `9 frames of 1/60 s fill 150 ms, got ${v}`);
  assert.ok(fadeStep(0, 1, 1 / 60, false) < 0.2);
  assert.equal(fadeStep(0, 1, 1 / 60, true), 1);
  assert.equal(fadeStep(1, 0, 1 / 60, true), 0);
  assert.equal(REVEAL.fadeMs, 150);
});
