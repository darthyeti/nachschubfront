// The rocket tower (draft B of reference/studien/raketenturm-modell.js, issue 99): two rockets on rails,
// one goes off per shot and the empty rail is loaded again between 20 and 70 % of the reload. The state is
// read from the reload counter, never reported.
import test from 'node:test';
import assert from 'node:assert/strict';

import { turnFrame } from '../../src/render/model.js';
import { buildSpecial, specialRestPose, siegeLoadAt, SPECIAL_MOUNT_Z, specialScale } from '../../src/render/specials.js';

const F = () => turnFrame(0.6, SPECIAL_MOUNT_Z, specialScale('siegeMortar'));
const count = (pose, layer) => buildSpecial('siegeMortar', F(), pose, layer).parts.length;

test('the empty rail is loaded between 20 and 70 % of the reload', () => {
  assert.equal(siegeLoadAt(0), 0);
  assert.equal(siegeLoadAt(0.2), 0);
  assert.equal(siegeLoadAt(0.7), 1);
  assert.equal(siegeLoadAt(1), 1);
  assert.ok(siegeLoadAt(0.45) > 0.4 && siegeLoadAt(0.45) < 0.6);
  // The aiming phase (last 0.8 s of 3.2 s) starts at 75 %: two rockets are ready by then.
  assert.equal(siegeLoadAt(0.75), 1);
});

test('the live layer holds the rockets, lamps and scope; the base is the same for every pose', () => {
  const rest = specialRestPose('#fff');
  const empty = { ...rest, load: [0, 1] };
  const half = { ...rest, load: [0.5, 1] };
  assert.equal(count(rest, 'base'), count(empty, 'base'), 'the base does not depend on the load');
  assert.ok(count(rest, 'float') > count(empty, 'float'), 'an empty rail has no rocket');
  assert.ok(count(half, 'float') > count(empty, 'float'), 'a rocket rises out of the crate');
  assert.equal(count(rest, 'all'), count(rest, 'base') + count(rest, 'float'));
});

test('the fired rocket is gone, the other one waits', () => {
  const rest = specialRestPose('#fff');
  const both = count(rest, 'float');
  const one = count({ ...rest, load: [0, 1] }, 'float');
  const none = count({ ...rest, load: [0, 0] }, 'float');
  assert.ok(both > one && one > none);
});
