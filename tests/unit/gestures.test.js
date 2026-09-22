import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGestureRecognizer } from '../../src/input/gestures.js';

const OPTIONS = { dragThreshold: 8, longPressMs: 500 };

/** Manual timer so long presses can be triggered deterministically. */
function fakeTimer() {
  const pending = new Map();
  let next = 1;
  return {
    set(fn) {
      const id = next++;
      pending.set(id, fn);
      return id;
    },
    clear(id) {
      pending.delete(id);
    },
    fire() {
      for (const [id, fn] of [...pending]) {
        pending.delete(id);
        fn();
      }
    },
  };
}

function setup() {
  const log = [];
  const timer = fakeTimer();
  const g = createGestureRecognizer(
    OPTIONS,
    {
      onTap: (x, y, type) => log.push(['tap', x, y, type]),
      onLongPress: (x, y) => log.push(['long', x, y]),
      onPan: (dx, dy) => log.push(['pan', dx, dy]),
      onZoom: (f, x, y) => log.push(['zoom', f, x, y]),
      onGestureStart: () => log.push(['start']),
    },
    timer,
  );
  return { g, log, timer };
}

const touch = (id, x, y) => ({ pointerId: id, x, y, pointerType: 'touch', button: 0 });
const mouse = (x, y, button = 0) => ({ pointerId: 1, x, y, pointerType: 'mouse', button });
const kinds = (log) => log.map((e) => e[0]);

test('tap without movement', () => {
  const { g, log } = setup();
  g.down(touch(1, 100, 100));
  g.up(touch(1, 100, 100));
  assert.deepEqual(log, [['tap', 100, 100, 'touch']]);
});

test('small jitter below the threshold is still a tap', () => {
  const { g, log } = setup();
  g.down(touch(1, 100, 100));
  g.move(touch(1, 104, 103));
  g.up(touch(1, 104, 103));
  assert.deepEqual(kinds(log), ['tap']);
});

test('dragging past the threshold pans and never taps', () => {
  const { g, log } = setup();
  g.down(touch(1, 100, 100));
  g.move(touch(1, 105, 100));
  g.move(touch(1, 112, 100));
  g.move(touch(1, 130, 110));
  g.up(touch(1, 130, 110));
  assert.deepEqual(kinds(log), ['start', 'pan', 'pan']);
  // The first pan includes the distance travelled below the threshold.
  assert.deepEqual(log[1], ['pan', 12, 0]);
  assert.deepEqual(log[2], ['pan', 18, 10]);
});

test('left mouse drag pans too (decision M1), click still taps', () => {
  const { g, log } = setup();
  g.down(mouse(10, 10));
  g.move(mouse(40, 10));
  g.up(mouse(40, 10));
  assert.deepEqual(kinds(log), ['start', 'pan']);
  log.length = 0;
  g.down(mouse(10, 10));
  g.up(mouse(10, 10));
  assert.deepEqual(kinds(log), ['tap']);
});

test('right and middle mouse buttons pan immediately and never tap', () => {
  for (const button of [1, 2]) {
    const { g, log } = setup();
    g.down(mouse(10, 10, button));
    g.move(mouse(12, 11, button));
    g.up(mouse(12, 11, button));
    assert.deepEqual(log, [['start'], ['pan', 2, 1]], `button ${button}`);
  }
});

test('long press fires once and suppresses the tap', () => {
  const { g, log, timer } = setup();
  g.down(touch(1, 50, 60));
  timer.fire();
  g.up(touch(1, 50, 60));
  assert.deepEqual(log, [['long', 50, 60]]);
});

test('moving cancels the long press', () => {
  const { g, log, timer } = setup();
  g.down(touch(1, 50, 60));
  g.move(touch(1, 80, 60));
  timer.fire();
  g.up(touch(1, 80, 60));
  assert.ok(!kinds(log).includes('long'));
});

test('two fingers pinch-zoom around their midpoint', () => {
  const { g, log } = setup();
  g.down(touch(1, 100, 100));
  g.down(touch(2, 200, 100));
  g.move(touch(2, 300, 100)); // distance 100 -> 200, midpoint 150 -> 200
  assert.deepEqual(log[0], ['start']);
  const zoom = log.find((e) => e[0] === 'zoom');
  assert.deepEqual(zoom, ['zoom', 2, 200, 100]);
  const pan = log.find((e) => e[0] === 'pan');
  assert.deepEqual(pan, ['pan', 50, 0]);
});

test('pinch never ends in a tap, lifting one finger continues as pan', () => {
  const { g, log } = setup();
  g.down(touch(1, 100, 100));
  g.down(touch(2, 200, 100));
  g.up(touch(2, 200, 100));
  g.move(touch(1, 110, 100));
  g.up(touch(1, 110, 100));
  assert.ok(!kinds(log).includes('tap'));
  assert.deepEqual(log.at(-1), ['pan', 10, 0]);
});

test('cancelled pointer does not tap', () => {
  const { g, log } = setup();
  g.down(touch(1, 100, 100));
  g.cancel(touch(1, 100, 100));
  assert.deepEqual(log, []);
});

test('mouse pointers do not pinch', () => {
  const { g, log } = setup();
  g.down(mouse(10, 10));
  g.down({ pointerId: 2, x: 50, y: 50, pointerType: 'mouse', button: 0 });
  g.move({ pointerId: 2, x: 90, y: 50, pointerType: 'mouse' });
  assert.ok(!kinds(log).includes('zoom'));
});
