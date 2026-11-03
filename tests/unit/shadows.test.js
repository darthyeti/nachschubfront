import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIGHT, convexHull, rectCorners, shadowOutline } from '../../src/render/shadows.js';
import { obstacleShadow, bastionShadow, beaconShadow } from '../../src/render/objects.js';

const bounds = (pts) => ({
  x0: Math.min(...pts.map((p) => p[0])),
  y0: Math.min(...pts.map((p) => p[1])),
  x1: Math.max(...pts.map((p) => p[0])),
  y1: Math.max(...pts.map((p) => p[1])),
});

test('the hull of a square and its shifted copy has six corners', () => {
  const hull = convexHull([...rectCorners(0, 0, 1, 1), ...rectCorners(0.5, 0.25, 1.5, 1.25)]);
  assert.equal(hull.length, 6);
});

test('a body of height h casts LIGHT * h / 32 cells towards +x and +y, never the other way', () => {
  const foot = rectCorners(2, 3, 3, 4);
  const b = bounds(shadowOutline(foot, 64));
  assert.ok(Math.abs(b.x0 - 2) < 1e-9 && Math.abs(b.y0 - 3) < 1e-9, 'nothing grows towards the light');
  assert.ok(Math.abs(b.x1 - (3 + LIGHT.x * 2)) < 1e-9);
  assert.ok(Math.abs(b.y1 - (4 + LIGHT.y * 2)) < 1e-9);
});

test('a lifted body casts a shifted footprint, not a column', () => {
  const foot = rectCorners(0, 0, 1, 1);
  const b = bounds(shadowOutline(foot, 0.0001, 32));
  assert.ok(Math.abs(b.x0 - LIGHT.x) < 1e-3 && Math.abs(b.y0 - LIGHT.y) < 1e-3);
});

test('every kind of obstacle names its bodies, and a crater none', () => {
  const at = (kind, n = 1) => ({ kind, variant: 1, cells: Array.from({ length: n }, (_, i) => ({ x: 4 + i, y: 4 })) });
  for (const kind of ['ruin', 'wall', 'rubble', 'bulwark']) {
    const bodies = obstacleShadow(at(kind, 2), 1);
    assert.ok(bodies.length >= 1 && bodies.every((b) => b.height > 0 && b.footprint.length === 4), kind);
  }
  assert.deepEqual(obstacleShadow(at('crater'), 0), []);
  // The tall body of a ruin reaches further than its low base.
  const ruin = obstacleShadow(at('ruin'), 0);
  assert.ok(ruin[1].height > ruin[0].height);
});

test('the bastion grows with its size and the beacon has a plinth and a mast', () => {
  assert.ok(bastionShadow({ x: 0, y: 0 }, 2)[0].height > bastionShadow({ x: 0, y: 0 }, 1)[0].height);
  assert.equal(beaconShadow({ x: 1, y: 1 }).length, 2);
});
