// The fire at the barrel of the turned weapons (M9 D3): where it starts, in which order the rocket tubes
// go off, that the rockets follow the shell of the simulation, and that the particles keep their ceilings.
// Render-side only; the simulation does not know any of this.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MUZZLE, TURRET_DOCTRINES, TURRET_SCALE, MOUNT_Z, restPose, muzzleOffset } from '../../src/render/turrets.js';
import { turnFrame, SOLID_K } from '../../src/render/model.js';
import { iso } from '../../src/render/iso.js';
import { drawTowerSprite, towerAnchor } from '../../src/render/towerSprites.js';
import { muzzleWorld, drainFxQueue, rocketPosition, fxOf, noteTowerEvent } from '../../src/render/towerFx.js';
import { createEffects } from '../../src/render/effects.js';
import { FX_TIP_AHEAD, FX_QUEUE, FX_MAX_PARTICLES, FX_ROCKET, TURRET_ROCKET } from '../../src/data/art.js';

function fakeContext() {
  return new Proxy(
    { canvas: { width: 100, height: 100 } },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => ({ addColorStop() {} });
        return () => {};
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    },
  );
}

globalThis.document = {
  createElement() {
    const canvas = { width: 0, height: 0 };
    canvas.getContext = () => fakeContext();
    return canvas;
  },
};

const sprites = { get: () => ({ canvas: {}, w: 10, h: 10 }) };
const tower = (extra = {}) => ({
  id: 1, x: 5, y: 5, doctrine: 'autocannon', rank: 3, special: null,
  aim: { x: 8.5, y: 5.5 }, cooldown: 0, firing: false, flash: 0, ...extra,
});

/** Draws `frames` frames of `t` and fires once at the first one (the reload counter jumps up). */
function frames(t, n, { shoot = false, reduced = false, dt = 1 / 60 } = {}) {
  const ctx = fakeContext();
  for (let i = 0; i < n; i++) {
    if (shoot && i === 0) t.cooldown += 1;
    drawTowerSprite(ctx, sprites, t, 1, 1, 10 + i * dt, dt, reduced);
    if (t.cooldown > 0) t.cooldown = Math.max(0, t.cooldown - dt);
  }
}

test('the fire leaves the muzzle of the model, a little further where something sticks out', () => {
  for (const doctrine of TURRET_DOCTRINES) {
    const t = tower({ doctrine });
    const theta = 2.3;
    const mw = muzzleWorld(t, theta, theta, { tube: 0 });
    const model = MUZZLE[doctrine]({ tube: 0, recoil: 0, bob: 0 });
    // The model's own muzzle on the screen, and the fire's.
    const off = muzzleOffset(doctrine, theta, restPose('#fff'));
    const centre = iso(t.x + 0.5, t.y + 0.5);
    const fire = iso(mw.x, mw.y, mw.z);
    const ahead = FX_TIP_AHEAD[doctrine] ?? 0;
    if (!ahead) {
      assert.ok(Math.abs(fire[0] - (centre[0] + off[0])) < 1e-6, `${doctrine}: x`);
      assert.ok(Math.abs(fire[1] - (centre[1] + off[1])) < 1e-6, `${doctrine}: y`);
    } else {
      // It is in front of the model's muzzle, along the barrel.
      const F = turnFrame(theta, MOUNT_Z, TURRET_SCALE);
      const d = model.dir;
      const tip = F.W(model.at[0] + d[0] * ahead, model.at[1] + d[1] * ahead, model.at[2] + d[2] * ahead * SOLID_K);
      assert.ok(Math.abs(fire[0] - (centre[0] + tip[0])) < 1e-6, `${doctrine}: tip x`);
      assert.ok(Math.abs(fire[1] - (centre[1] + tip[1])) < 1e-6, `${doctrine}: tip y`);
      const base = F.W(...model.at);
      assert.ok(Math.hypot(tip[0] - base[0], tip[1] - base[1]) > 1, `${doctrine}: really in front of the muzzle`);
    }
    // The direction is the way the weapon points.
    assert.ok(Math.abs(mw.dir[0] - Math.cos(theta) * (model.dir[0])) < 1e-9, `${doctrine}: dir x`);
  }
  assert.equal(FX_TIP_AHEAD.mortar, 0.12);
  assert.equal(FX_TIP_AHEAD.tesla, 0.05);
});

test('the six rocket tubes go off one after the other in the order of the mouths', () => {
  const t = tower({ doctrine: 'mortar' });
  frames(t, 90);
  const seen = [];
  for (let shot = 0; shot < 7; shot++) {
    frames(t, 3, { shoot: true });
    const a = towerAnchor(t);
    // Which of the six mouths is this?
    const shown = Math.atan2(t.aim.y - (t.y + 0.5), t.aim.x - (t.x + 0.5));
    const centre = iso(t.x + 0.5, t.y + 0.5);
    let best = -1;
    let bestD = Infinity;
    for (let k = 0; k < 6; k++) {
      const off = muzzleOffset('mortar', shown, { ...restPose('#fff'), tube: k });
      const d = Math.hypot(a[0] - (centre[0] + off[0]), a[1] - (centre[1] + off[1]));
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    assert.ok(bestD < 1e-6, 'the anchor is exactly a mouth');
    seen.push(best);
    frames(t, 40);
  }
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 0]);
  assert.equal(TURRET_ROCKET.mouths.length, 6);
});

test('a shot throws off particles, and a quiet weapon none', () => {
  const t = tower();
  frames(t, 30);
  assert.equal(drainFxQueue(t), null, 'nothing without a shot');
  frames(t, 2, { shoot: true });
  const queued = drainFxQueue(t);
  assert.ok(queued.some((p) => p.kind === 'wcasing'), 'a case');
  assert.ok(queued.some((p) => p.kind === 'wtracer'), 'a tracer');
  assert.ok(queued.length <= FX_QUEUE);
});

test('a queue nobody drains does not grow beyond its ceiling', () => {
  const t = tower({ doctrine: 'mortar' });
  for (let i = 0; i < 40; i++) frames(t, 2, { shoot: true });
  assert.ok(fxOf(t).queue.length <= FX_QUEUE);
});

test('reduced motion throws no sparks', () => {
  const count = (reduced) => {
    let sparks = 0;
    for (let i = 0; i < 20; i++) {
      const t = tower({ doctrine: 'tesla' });
      frames(t, 30, { reduced });
      frames(t, 2, { shoot: true, reduced });
      sparks += (drainFxQueue(t) ?? []).filter((p) => p.kind === 'wspark').length;
    }
    return sparks;
  };
  assert.ok(count(false) > 0);
  assert.equal(count(true), 0);
});

test('the rocket flies from its launch to the point of the shell, in the flight time of the shell', () => {
  const launch = { x: 5.5, y: 5.5, z: 40, dir: [0.8, 0, 0.6], lift: 0 };
  const shell = { to: { x: 9.5, y: 7.5 }, t: 0, flight: 1 };
  const start = rocketPosition(launch, shell);
  assert.deepEqual(start, [5.5, 5.5, 40]);
  const end = rocketPosition(launch, { ...shell, t: 1 });
  assert.ok(Math.abs(end[0] - 9.5) < 1e-9 && Math.abs(end[1] - 7.5) < 1e-9);
  assert.ok(Math.abs(end[2] - FX_ROCKET.endZ) < 1e-9);
  // Half the time: the arc has risen above the straight line between start and end.
  const mid = rocketPosition(launch, { ...shell, t: 0.5 });
  assert.ok(mid[2] > (40 + FX_ROCKET.endZ) / 2);
  // Another flight time stretches the same path: the point at u is the same.
  const slow = rocketPosition(launch, { ...shell, t: 1, flight: 2 });
  assert.deepEqual(slow, mid);
  assert.ok(SOLID_K > 0);
});

test('what the simulation says about a shot is kept for the muzzle, and the old drawing is skipped', () => {
  const t = tower({ doctrine: 'laser' });
  const effects = createEffects();
  const state = { events: [{ type: 'beam', towerId: 1, doctrine: 'laser', x: 5.5, y: 5.5, tx: 9.5, ty: 5.5 }], towers: [t], projectiles: [], enemies: [], pods: [], pendingStrikes: [], banners: [] };
  effects.update(0.016, state, false);
  assert.equal(fxOf(t).pending.type, 'beam');
  // The old beam is not in the list of shots: nothing to draw above.
  assert.equal(effects.counts().particles, 0);
  noteTowerEvent(t, { type: 'beam', tx: 9.5, ty: 5.5 });
  frames(t, 30);
  frames(t, 2, { shoot: true });
  assert.ok(fxOf(t).beam > 0);
  assert.deepEqual(fxOf(t).beamEnd, [9.5, 5.5]);
});

test('the particles of the muzzles keep to their ceiling inside the one of the effects', () => {
  const effects = createEffects();
  const towers = [];
  for (let i = 0; i < 30; i++) towers.push(tower({ id: i + 1, x: i % 10, y: Math.floor(i / 10) }));
  const state = { events: [], towers, projectiles: [], enemies: [], pods: [], pendingStrikes: [], banners: [] };
  for (let round = 0; round < 60; round++) {
    for (const t of towers) frames(t, 1, { shoot: true });
    effects.update(0.016, state, false);
    const { particles, muzzle } = effects.counts();
    assert.ok(muzzle <= FX_MAX_PARTICLES, `muzzle ${muzzle}`);
    assert.ok(particles <= 520);
  }
  assert.ok(effects.counts().muzzle > 20, 'and they do appear');
});
