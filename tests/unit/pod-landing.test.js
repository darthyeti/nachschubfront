// The landing of the capsule as it is drawn (docs/ART.md, "Nachschubkapsel"): the fall
// profile, the segments lying down one after another, and smoke that is gone after
// about 3.5 seconds even when a whole salvo has come down.

import test from 'node:test';
import assert from 'node:assert/strict';

import { PODS } from '../../src/data/pods.js';
import { IMPACT_SECONDS } from '../../src/sim/pods.js';
import {
  FALL_HEIGHT,
  SMOKE_SECONDS,
  brakePower,
  petalLands,
  petalOpen,
  podHeight,
} from '../../src/render/podTiming.js';
import { createEffects } from '../../src/render/effects.js';

const pod = (since, extra = {}) => ({ x: 3, y: 4, index: 0, doctrine: 'laser', rank: 1, landed: since >= 0, t: IMPACT_SECONDS + since, ...extra });

test('the capsule falls at constant speed, brakes, and touches down on the impact', () => {
  assert.equal(podHeight({ t: 0 }), FALL_HEIGHT, 'still up there while the marker blinks');
  assert.equal(podHeight({ t: PODS.warnSeconds }), FALL_HEIGHT);
  assert.equal(podHeight({ t: IMPACT_SECONDS }), 0);
  assert.equal(podHeight({ t: IMPACT_SECONDS + 5 }), 0);
  let last = FALL_HEIGHT;
  const steps = 200;
  for (let i = 0; i <= steps; i++) {
    const z = podHeight({ t: PODS.warnSeconds + (PODS.fallSeconds * i) / steps });
    assert.ok(z <= last + 1e-9, `it never rises again (step ${i})`);
    assert.ok(z >= 0);
    last = z;
  }
  // The brake takes it slower over the last stretch than the free flight before.
  const fall = PODS.fallSeconds;
  const early = podHeight({ t: PODS.warnSeconds + fall * 0.2 }) - podHeight({ t: PODS.warnSeconds + fall * 0.3 });
  const late = podHeight({ t: PODS.warnSeconds + fall * 0.9 }) - podHeight({ t: PODS.warnSeconds + fall * 0.99 });
  assert.ok(late / 0.09 < early / 0.1, 'slower at the end than at the start');
});

test('the brake nozzles burn in the last stretch and are out a moment after the touchdown', () => {
  assert.equal(brakePower(pod(-PODS.fallSeconds)), 0, 'dark in free flight');
  assert.equal(brakePower(pod(-0.05)), 1, 'burning shortly before the touchdown');
  assert.ok(brakePower(pod(0.05)) > 0 && brakePower(pod(0.05)) < 1, 'dying down on the ground');
  assert.equal(brakePower(pod(0.5)), 0, 'and out');
});

test('the segments lie down one after another, each when it has finished swinging', () => {
  let last = 0;
  for (let order = 0; order < 4; order++) {
    const lands = petalLands(order);
    assert.ok(lands > last, `segment ${order} lands after the one before`);
    assert.ok(Math.abs(petalOpen(lands, order) - 1) < 1e-9, `segment ${order} is down when it lands`);
    assert.ok(petalOpen(lands - 0.05, order) < 1);
    last = lands;
  }
  assert.ok(petalLands(3) <= PODS.openDelaySeconds + PODS.openSeconds + 1e-9, 'all within openSeconds');
});

/** A state with a salvo of that many capsules landing 0.3 s apart. */
function salvo(count) {
  return Array.from({ length: count }, (_, i) => ({ x: 2 + i * 2, y: 3, index: i, doctrine: 'laser', rank: 1, landed: false, t: -i * PODS.staggerSeconds }));
}

function run(effects, state, seconds, dt = 1 / 60) {
  let peak = 0;
  for (let time = 0; time < seconds; time += dt) {
    state.events = [];
    for (const p of state.pods) {
      p.t += dt;
      if (!p.landed && p.t >= IMPACT_SECONDS) {
        p.landed = true;
        state.events.push({ type: 'podImpact', x: p.x, y: p.y, index: p.index });
      }
    }
    effects.update(dt, state, false);
    peak = Math.max(peak, effects.counts().particles);
  }
  return peak;
}

const emptyState = (pods) => ({ events: [], enemies: [], towers: [], projectiles: [], pendingStrikes: [], banners: [], map: { obstacles: [] }, pods });

test('smoke and dust of a landing are gone after 3.5 seconds, and a full salvo stays under the ceiling', () => {
  assert.equal(SMOKE_SECONDS, 3.5);
  const effects = createEffects();
  const pods = salvo(6);
  const state = emptyState(pods);
  const peak = run(effects, state, IMPACT_SECONDS + 5 * PODS.staggerSeconds);
  assert.ok(peak > 40, `the landing throws something: ${peak}`);
  assert.ok(peak <= 520, `the particle ceiling holds: ${peak}`);
  // The last capsule has been down for a moment; from its impact on, 3.5 s clear the air.
  run(effects, state, SMOKE_SECONDS + 0.2);
  assert.equal(effects.counts().particles, 0, 'nothing of the landing is left in the air');
});

test('a single landing clears within 3.5 seconds of its impact', () => {
  const effects = createEffects();
  const state = emptyState([pod(-IMPACT_SECONDS, { landed: false, t: 0 })]);
  run(effects, state, IMPACT_SECONDS + 0.05);
  assert.ok(effects.counts().particles > 20, 'dust and fire are up');
  run(effects, state, SMOKE_SECONDS - 0.05);
  assert.equal(effects.counts().particles, 0);
});
