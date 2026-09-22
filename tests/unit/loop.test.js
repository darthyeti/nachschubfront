import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFixedStepper } from '../../src/core/loop.js';

const STEP = 1 / 60;
const make = () => createFixedStepper({ step: STEP, maxSteps: 12, maxFrameTime: 0.25 });

function run(stepper, frames, dt, speed) {
  let steps = 0;
  for (let i = 0; i < frames; i++) steps += stepper.advance(dt, speed, () => {});
  return steps;
}

test('one step per 60 Hz frame at 1x', () => {
  assert.equal(run(make(), 600, STEP, 1), 600);
});

test('2x and 3x run multiple steps per frame', () => {
  assert.equal(run(make(), 600, STEP, 2), 1200);
  assert.equal(run(make(), 600, STEP, 3), 1800);
});

test('simulation time is independent of frame rate', () => {
  // 120 Hz, 60 Hz and 30 Hz displays advance the same sim time over 10 s.
  assert.equal(run(make(), 1200, 1 / 120, 1), 600);
  assert.equal(run(make(), 300, 1 / 30, 1), 600);
});

test('pause runs no steps and keeps no backlog', () => {
  const s = make();
  assert.equal(run(s, 100, STEP, 0), 0);
  assert.equal(s.advance(STEP, 1, () => {}), 1);
});

test('each step receives the fixed dt', () => {
  const s = make();
  const dts = [];
  s.advance(0.05, 1, (dt) => dts.push(dt));
  assert.equal(dts.length, 3);
  assert.ok(dts.every((dt) => dt === STEP));
});

test('long stalls are capped instead of spiralling', () => {
  const s = make();
  // A 5 s hitch (e.g. background tab) runs at most maxSteps and drops the rest.
  assert.equal(s.advance(5, 3, () => {}), 12);
  assert.equal(s.advance(STEP, 1, () => {}), 1);
});

test('invalid frame times are ignored', () => {
  const s = make();
  assert.equal(s.advance(-1, 1, () => {}), 0);
  assert.equal(s.advance(NaN, 1, () => {}), 0);
});

test('alpha reports the pending fraction', () => {
  const s = make();
  s.advance(STEP * 1.5, 1, () => {});
  assert.ok(Math.abs(s.alpha - 0.5) < 1e-6);
});
