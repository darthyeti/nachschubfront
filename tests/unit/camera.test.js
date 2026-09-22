import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iso, isoInverse, mapBounds } from '../../src/render/iso.js';
import {
  createCamera,
  worldToScreen,
  screenToWorld,
  screenToCell,
  zoomAt,
  panBy,
  clampCamera,
  fitCamera,
} from '../../src/render/camera.js';

const view = { width: 1180, height: 820, dpr: 2 };
const limits = { minZoom: 0.3, maxZoom: 2.5, minCellPx: 40 };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('iso projection matches the style test formula', () => {
  assert.deepEqual(iso(0, 0), [0, 0]);
  assert.deepEqual(iso(1, 0), [32, 16]);
  assert.deepEqual(iso(0, 1), [-32, 16]);
  assert.deepEqual(iso(2, 3, 10), [-32, 70]);
});

test('isoInverse undoes iso', () => {
  for (const [x, y] of [[0, 0], [3.25, 7.5], [23.9, 0.1], [12, 12]]) {
    const [px, py] = iso(x, y);
    const g = isoInverse(px, py);
    assert.ok(near(g.x, x) && near(g.y, y), `${x},${y}`);
  }
});

test('screen <-> world round trip', () => {
  const cam = { x: 120, y: 340, zoom: 0.8 };
  const [sx, sy] = worldToScreen(cam, view, 55, -20);
  const [wx, wy] = screenToWorld(cam, view, sx, sy);
  assert.ok(near(wx, 55) && near(wy, -20));
});

test('screenToCell hits the cell whose centre is on screen', () => {
  const cam = { x: 0, y: 384, zoom: 0.7 };
  for (const [cx, cy] of [[0, 0], [5, 17], [23, 23], [11, 4]]) {
    const [wx, wy] = iso(cx + 0.5, cy + 0.5);
    const [sx, sy] = worldToScreen(cam, view, wx, wy);
    assert.deepEqual(screenToCell(cam, view, sx, sy), { x: cx, y: cy });
  }
});

test('screenToCell respects cell borders', () => {
  const cam = { x: 0, y: 0, zoom: 1 };
  // Just inside the left and right tips of cell (0, 0).
  const [lx, ly] = worldToScreen(cam, view, ...iso(0.02, 0.98));
  const [rx, ry] = worldToScreen(cam, view, ...iso(0.98, 0.02));
  assert.deepEqual(screenToCell(cam, view, lx, ly), { x: 0, y: 0 });
  assert.deepEqual(screenToCell(cam, view, rx, ry), { x: 0, y: 0 });
  // Just outside across the top-right edge belongs to (0, -1).
  const [ox, oy] = worldToScreen(cam, view, ...iso(0.5, -0.02));
  assert.deepEqual(screenToCell(cam, view, ox, oy), { x: 0, y: -1 });
});

test('zoomAt keeps the world point under the pointer fixed', () => {
  const cam = { x: 10, y: 300, zoom: 1 };
  const sx = 900;
  const sy = 150;
  const before = screenToWorld(cam, view, sx, sy);
  zoomAt(cam, view, 1.7, sx, sy, limits);
  const after = screenToWorld(cam, view, sx, sy);
  assert.ok(near(before[0], after[0], 1e-6) && near(before[1], after[1], 1e-6));
  assert.ok(near(cam.zoom, 1.7));
});

test('zoom is clamped to its limits', () => {
  const cam = createCamera();
  zoomAt(cam, view, 100, 0, 0, limits);
  assert.equal(cam.zoom, limits.maxZoom);
  zoomAt(cam, view, 0.0001, 0, 0, limits);
  assert.equal(cam.zoom, limits.minZoom);
});

test('panBy moves the view with the finger', () => {
  const cam = { x: 0, y: 0, zoom: 2 };
  const before = worldToScreen(cam, view, 100, 100);
  panBy(cam, 30, -12);
  const after = worldToScreen(cam, view, 100, 100);
  assert.ok(near(after[0] - before[0], 30) && near(after[1] - before[1], -12));
});

test('clampCamera keeps the camera centre over the map', () => {
  const bounds = mapBounds(24);
  const cam = clampCamera({ x: 99999, y: -99999, zoom: 1 }, bounds, limits);
  assert.equal(cam.x, bounds.x1);
  assert.equal(cam.y, bounds.y0);
});

test('start view on the tablet shows the whole map with cells >= 40 px', () => {
  const bounds = mapBounds(24);
  const insets = { top: 64, bottom: 84, side: 16 };
  const cam = fitCamera(createCamera(), view, bounds, insets, limits);
  assert.ok(cam.zoom * 64 >= 40, `cell ${cam.zoom * 64} px`);
  const [left, top] = worldToScreen(cam, view, bounds.x0, bounds.y0);
  const [right, bottom] = worldToScreen(cam, view, bounds.x1, bounds.y1);
  assert.ok(left >= insets.side - 1 && right <= view.width - insets.side + 1, `x ${left}..${right}`);
  assert.ok(top >= insets.top - 1 && bottom <= view.height - insets.bottom + 1, `y ${top}..${bottom}`);
});

test('start view on a small screen keeps the minimum cell size', () => {
  const small = { width: 700, height: 400, dpr: 2 };
  const cam = fitCamera(createCamera(), small, mapBounds(24), { top: 64, bottom: 84, side: 16 }, limits);
  assert.ok(near(cam.zoom * 64, 40));
});
