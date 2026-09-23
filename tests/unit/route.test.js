import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRoute,
  checkPlacement,
  routeExists,
  createPolyline,
  positionAt,
  flyerPolyline,
  groundPolyline,
} from '../../src/sim/route.js';
import { isBlocked } from '../../src/sim/grid.js';
import { mapFromAscii } from './helpers.js';

const OPEN = [
  '..........',
  '.1........',
  '..........',
  '..........',
  'R........B',
  '..........',
  '..........',
  '..........',
  '........2.',
  '..........',
];

function visits(route, p) {
  return route.cells.some((c) => c.x === p.x && c.y === p.y);
}

test('route visits every beacon in order', () => {
  const map = mapFromAscii(OPEN);
  const route = computeRoute(map);
  const indexOf = (p) => route.cells.findIndex((c) => c.x === p.x && c.y === p.y);
  const order = [map.rift, ...map.beacons, map.bastion].map(indexOf);
  assert.ok(order.every((i) => i >= 0), 'all waypoints visited');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'visited in chain order');
  assert.deepEqual(route.cells[0], map.rift);
  assert.deepEqual(route.cells.at(-1), map.bastion);
  assert.equal(route.legs.length, 3);
  const sum = route.legs.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - route.length) < 1e-9);
});

test('route has no duplicate cells at leg junctions', () => {
  const route = computeRoute(mapFromAscii(OPEN));
  for (let i = 1; i < route.cells.length; i++) {
    const a = route.cells[i - 1];
    const b = route.cells[i];
    assert.ok(a.x !== b.x || a.y !== b.y, `duplicate at ${i}`);
  }
});

test('route detours around an obstacle and gets longer', () => {
  const map = mapFromAscii(OPEN);
  const before = computeRoute(map).length;
  const onRoute = computeRoute(map).cells[5];
  assert.ok(checkPlacement(map, [onRoute]).ok);
  map.grid.blocked[onRoute.y * map.size + onRoute.x] = 1;
  const after = computeRoute(map);
  assert.ok(!visits(after, onRoute));
  assert.ok(after.length > before, `${after.length} > ${before}`);
});

test('placement that would cut off a beacon is rejected', () => {
  const map = mapFromAscii([
    '.....',
    '.###.',
    '.#1#.',
    '.#.#.',
    'R...B',
  ]);
  assert.ok(routeExists(map));
  const result = checkPlacement(map, [{ x: 2, y: 3 }]);
  assert.deepEqual(result, { ok: false, reason: 'blocks' });
  assert.ok(!isBlocked(map.grid, 2, 3), 'grid is restored after the check');
});

test('placement on protected or occupied cells is rejected', () => {
  const map = mapFromAscii(OPEN);
  map.protected[2 * map.size + 2] = 1;
  map.grid.blocked[6 * map.size + 5] = 1;
  assert.equal(checkPlacement(map, [{ x: 2, y: 2 }]).reason, 'protected');
  assert.equal(checkPlacement(map, [{ x: 5, y: 6 }]).reason, 'occupied');
  assert.equal(checkPlacement(map, [{ x: -1, y: 0 }]).reason, 'outside');
});

test('multi-cell placement is checked as a whole', () => {
  // Each cell alone leaves a gap, both together close the corridor.
  const map = mapFromAscii([
    '#####',
    '#1..#',
    'R...B',
    '#...#',
    '#####',
  ]);
  const wall = [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }];
  assert.ok(checkPlacement(map, [wall[0], wall[1]]).ok);
  assert.equal(checkPlacement(map, wall).reason, 'blocks');
});

test('blockade check is fast enough for instant feedback', () => {
  const rows = Array.from({ length: 24 }, () => '.'.repeat(24));
  const put = (x, y, ch) => {
    rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1);
  };
  put(0, 12, 'R');
  put(23, 11, 'B');
  put(5, 5, '1');
  put(18, 18, '2');
  const map = mapFromAscii(rows);
  const start = performance.now();
  const runs = 200;
  for (let i = 0; i < runs; i++) checkPlacement(map, [{ x: (i * 7) % 24, y: (i * 11) % 24 }]);
  const perCheck = (performance.now() - start) / runs;
  assert.ok(perCheck < 5, `${perCheck.toFixed(3)} ms per check`);
});

test('flyer route is the straight chain of waypoints', () => {
  const map = mapFromAscii(OPEN);
  const line = flyerPolyline(map);
  assert.equal(line.points.length, 4);
  assert.deepEqual(line.points[0], { x: 0.5, y: 4.5 });
  // Obstacles do not matter for flyers.
  map.grid.blocked.fill(1);
  assert.equal(flyerPolyline(map).length, line.length);
});

test('positionAt walks along a polyline', () => {
  const line = createPolyline([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }]);
  assert.equal(line.length, 7);
  assert.deepEqual(positionAt(line, 0), { x: 0, y: 0, dx: 1, dy: 0 });
  const mid = positionAt(line, 1.5);
  assert.equal(mid.x, 1.5);
  assert.equal(mid.y, 0);
  const corner = positionAt(line, 5);
  assert.equal(corner.x, 3);
  assert.equal(corner.y, 2);
  assert.equal(corner.dy, 1);
  const end = positionAt(line, 99);
  assert.equal(end.x, 3);
  assert.equal(end.y, 4);
});

test('ground polyline goes through cell centres', () => {
  const route = computeRoute(mapFromAscii(OPEN));
  const line = groundPolyline(route);
  assert.deepEqual(line.points[0], { x: 0.5, y: 4.5 });
  assert.ok(Math.abs(line.length - route.length) < 1e-9);
});
