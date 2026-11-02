import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceWear, sectionsOf, WEAR_PER_PASS, WEAR_FADE_PER_SECOND, WEAR_MIN } from '../../src/render/trail.js';

const route = (...cells) => ({ cells: cells.map(([x, y]) => ({ x, y })) });
const keys = (r) => new Set(sectionsOf(r).map((s) => s.key));

test('a route has one section between each two consecutive cells', () => {
  const sections = sectionsOf(route([0, 0], [1, 0], [1, 1]));
  assert.equal(sections.length, 2);
  assert.notEqual(sections[0].key, sections[1].key);
  assert.deepEqual(sectionsOf(null), []);
});

test('wear grows with every passage and is capped at 1', () => {
  const r = route([0, 0], [1, 0]);
  const wear = new Map();
  const [{ key }] = sectionsOf(r);
  advanceWear(wear, keys(r), [key], 0.016);
  assert.equal(wear.get(key), WEAR_PER_PASS);
  advanceWear(wear, keys(r), [key, key], 0.016);
  assert.ok(Math.abs(wear.get(key) - 3 * WEAR_PER_PASS) < 1e-9);
  for (let i = 0; i < 100; i++) advanceWear(wear, keys(r), [key], 0.016);
  assert.equal(wear.get(key), 1);
});

test('wear fades only on sections that left the route', () => {
  const r = route([0, 0], [1, 0]);
  const [{ key }] = sectionsOf(r);
  const wear = new Map([[key, 0.5]]);
  advanceWear(wear, keys(r), [], 10);
  assert.equal(wear.get(key), 0.5);
  advanceWear(wear, new Set(), [], 10);
  assert.ok(Math.abs(wear.get(key) - (0.5 - 10 * WEAR_FADE_PER_SECOND)) < 1e-9);
});

test('a section below the threshold is forgotten', () => {
  const wear = new Map([['a', WEAR_MIN + 0.001]]);
  advanceWear(wear, new Set(), [], 1);
  assert.equal(wear.has('a'), false);
});

test('a detour leaves the old sections standing and builds the new ones', () => {
  const before = route([0, 0], [1, 0], [2, 0]);
  const after = route([0, 0], [0, 1], [1, 1], [2, 0]);
  const wear = new Map();
  for (const s of sectionsOf(before)) advanceWear(wear, keys(before), [s.key], 0);
  const oldKeys = [...wear.keys()];
  assert.equal(oldKeys.length, 2);
  const [first] = sectionsOf(after);
  advanceWear(wear, keys(after), [first.key], 1);
  for (const k of oldKeys) assert.ok(wear.get(k) < WEAR_PER_PASS && wear.get(k) > 0);
  assert.equal(wear.get(first.key), WEAR_PER_PASS);
  assert.equal(wear.size, 3);
});
