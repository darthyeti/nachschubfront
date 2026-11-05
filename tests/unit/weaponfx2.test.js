// Weapon effects, step 2 (issue 90): the salvo of the rocket launcher, the rocket and the impact of the siege
// mortar, the mist of the purge shrine. Render-side only; the simulation does not know any of this.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { drawTowerSprite } from '../../src/render/towerSprites.js';
import { fxOf, salvoRockets, salvoProgress, drainFxQueue } from '../../src/render/towerFx.js';
import { createEffects } from '../../src/render/effects.js';
import { drawMistFlow, drawBigImpact, drawHeavyRocket } from '../../src/render/weaponFx.js';
import { SPECIALS as SPECIAL_DEFS } from '../../src/data/specials.js';
import { FX_SALVO, FX_BIG_BOOM, FX_THUNDER, FX_MAX_PARTICLES, FX_MIST } from '../../src/data/art.js';

function recorder() {
  const log = { gradients: 0, composite: [], shadow: [], rects: [], arcs: 0 };
  const target = { canvas: { width: 1000, height: 1000 }, globalAlpha: 1 };
  const ctx = new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
        return () => {
          log.gradients += 1;
          return { addColorStop() {} };
        };
      }
      if (prop === 'fillRect') return (...a) => log.rects.push({ style: t.fillStyle, a });
      return () => {};
    },
    set(t, prop, value) {
      if (prop === 'globalCompositeOperation') log.composite.push(value);
      if (prop === 'shadowBlur') log.shadow.push(value);
      t[prop] = value;
      return true;
    },
  });
  return { ctx, log };
}

globalThis.document = {
  createElement() {
    const canvas = { width: 0, height: 0 };
    canvas.getContext = () => recorder().ctx;
    return canvas;
  },
};

const sprites = { get: () => ({ canvas: {}, shadow: {}, flash: {}, w: 10, h: 10 }) };
const launcher = (extra = {}) => ({
  id: 1, x: 5, y: 5, doctrine: 'mortar', rank: 3, special: null,
  aim: { x: 9.5, y: 6.5 }, cooldown: 0, firing: false, flash: 0, damage: 0, ...extra,
});
const siege = (extra = {}) => ({
  id: 2, x: 3, y: 5, doctrine: SPECIAL_DEFS.siegeMortar.doctrine, rank: null, special: 'siegeMortar',
  aim: { x: 9.5, y: 6.5 }, cooldown: 0, firing: false, flash: 0, damage: 0, ...extra,
});
const shrine = (extra = {}) => ({
  id: 3, x: 6, y: 6, doctrine: SPECIAL_DEFS.purgeShrine.doctrine, rank: null, special: 'purgeShrine',
  aim: null, cooldown: 0, firing: false, flash: 0, damage: 0, ...extra,
});

let clock = 0;
function frames(t, n, { shoot = false, reduced = false, dt = 1 / 60 } = {}) {
  const { ctx } = recorder();
  for (let i = 0; i < n; i++) {
    if (shoot && i === 0) t.cooldown += 1;
    clock += dt;
    drawTowerSprite(ctx, sprites, t, 1, 1, clock, dt, reduced);
    if (t.cooldown > 0) t.cooldown = Math.max(0, t.cooldown - dt);
  }
}
const stateOf = (towers, extra = {}) => ({
  events: [], towers, projectiles: [], enemies: [], pods: [], pendingStrikes: [], banners: [], ...extra,
});
let shellId = 1;
const shellOf = (tower, extra = {}) => ({
  id: shellId++, towerId: tower.id, doctrine: 'mortar', radius: 1.2, from: { x: tower.x + 0.5, y: tower.y + 0.5 },
  to: { x: 9.5, y: 6.5 }, x: tower.x + 0.5, y: tower.y + 0.5, t: 0, flight: 1.6, ...extra,
});

/**
 * Fires `tower`, lets the drawing see the shot, and flies the shell in 1/60 s steps until it lands (the
 * simulation removes it and reports `explosion`). Returns the times (seconds since launch) of what `watch` saw.
 */
function fly(effects, tower, shell, watch, { reduced = false, extraSeconds = 0.5 } = {}) {
  const state = stateOf([tower], { projectiles: [shell] });
  const { ctx } = recorder();
  frames(tower, 5, { reduced });
  frames(tower, 2, { shoot: true, reduced });
  const seen = [];
  const dt = 1 / 60;
  let now = 0;
  for (let step = 0; step < Math.ceil((shell.flight + extraSeconds) / dt); step++) {
    state.events = [];
    if (state.projectiles.length) {
      shell.t += dt;
      if (shell.t >= shell.flight) {
        state.projectiles = [];
        state.events.push({ type: 'explosion', x: shell.to.x, y: shell.to.y, radius: shell.radius, doctrine: 'mortar' });
      }
    }
    effects.update(dt, state, reduced);
    effects.drawAbove(ctx, state, now, reduced);
    now += dt;
    watch?.(now, state, seen);
  }
  return seen;
}

// ---------- the salvo ----------

test('three rockets per hit, the middle one lands when the shell of the simulation does', () => {
  const shell = { id: 7, to: { x: 9.5, y: 6.5 }, flight: 1.6 };
  const launch = { x: 5, y: 5, z: 30, dir: [1, 0, 0], lift: 0, tubes: [{ x: 5, y: 5.1, z: 30, dir: [1, 0, 0], lift: 0 }, { x: 5, y: 5.2, z: 30, dir: [1, 0, 0], lift: 0 }, { x: 5, y: 5.3, z: 30, dir: [1, 0, 0], lift: 0 }] };
  const rockets = salvoRockets(launch, shell).sort((a, b) => a.k - b.k);
  assert.equal(rockets.length, FX_SALVO.count);
  const lands = rockets.map((r) => r.start + r.flight);
  assert.ok(Math.abs(lands[1] - shell.flight) < 1e-9, 'the middle lands at the time of the simulation');
  assert.ok(Math.abs(lands[0] - (shell.flight - FX_SALVO.gap)) < 1e-9, 'one a gap before');
  assert.ok(Math.abs(lands[2] - (shell.flight + FX_SALVO.gap)) < 1e-9, 'one a gap after');
  assert.deepEqual(rockets[1].to, shell.to, 'the middle one exactly on the point');
  for (const r of rockets) assert.ok(Math.hypot(r.to.x - shell.to.x, r.to.y - shell.to.y) <= FX_SALVO.spread + 1e-9, 'dense round the point');
  assert.deepEqual(rockets.map((r) => r.start), [0, FX_SALVO.gap, 2 * FX_SALVO.gap]);
  assert.equal(salvoProgress(rockets[2], 0.05), -1, 'the last has not left yet');
  assert.equal(salvoProgress(rockets[0], 10), 1);
  assert.equal(salvoRockets(launch, shell, 1).length, 1, 'with room for one only the middle one is drawn');
  assert.equal(salvoRockets(launch, shell, 1)[0].k, 1);
});

test('the salvo lives on after the shell of the simulation has landed, for the last rocket', () => {
  const effects = createEffects();
  const t = launcher();
  const shell = shellOf(t);
  const alive = [];
  fly(effects, t, shell, (now) => alive.push([now, effects.counts().salvos]), { extraSeconds: 0.4 });
  const at = (time) => alive.find(([n]) => n >= time)[1];
  assert.equal(at(shell.flight - 0.2), 1, 'in flight');
  assert.equal(at(shell.flight + FX_SALVO.gap * 0.5), 1, 'the last rocket is still on its way');
  assert.equal(at(shell.flight + FX_SALVO.gap + 0.1), 0, 'and then it is over');
});

test('the salvo keeps its rockets in flight under the ceiling, however often the launcher fires', () => {
  const effects = createEffects();
  const t = launcher();
  const { ctx } = recorder();
  const state = stateOf([t]);
  let peak = 0;
  for (let i = 0; i < 400; i++) {
    if (i % 12 === 0) {
      const shell = shellOf(t, { flight: 1.4 });
      state.projectiles.push(shell);
      frames(t, 2, { shoot: true });
    }
    for (const s of state.projectiles) s.t += 1 / 60;
    state.projectiles = state.projectiles.filter((s) => s.t < s.flight);
    effects.update(1 / 60, state, false);
    effects.drawAbove(ctx, state, i / 60, false);
    peak = Math.max(peak, effects.counts().salvos);
  }
  assert.ok(peak > 1, 'there were several in flight');
  const c = effects.counts();
  assert.ok(c.muzzle <= FX_MAX_PARTICLES, `muzzle particles ${c.muzzle}`);
});

test('the launch is read from the state: the three tubes are neighbours of the one that fired', () => {
  const t = launcher();
  frames(t, 30);
  frames(t, 2, { shoot: true });
  const launch = fxOf(t).launch;
  assert.equal(launch.tubes.length, FX_SALVO.count);
  const distinct = new Set(launch.tubes.map((u) => `${u.x.toFixed(3)},${u.y.toFixed(3)},${u.z.toFixed(2)}`));
  assert.equal(distinct.size, FX_SALVO.count, 'three different mouths');
});

// ---------- the siege mortar ----------

test('the impact of the siege mortar: one fireball, no shake, a crater that is gone after 2.5 s', () => {
  const effects = createEffects();
  const t = siege();
  const shell = shellOf(t, { radius: 2.6, flight: 1.5 });
  effects.update(1 / 60, stateOf([t], { projectiles: [shell] }), false);
  effects.update(1 / 60, stateOf([t], { events: [{ type: 'explosion', x: shell.to.x, y: shell.to.y, radius: 2.6, doctrine: 'mortar' }] }), false);
  assert.equal(effects.counts().impacts, 1, 'one big impact');
  const [sx, sy] = effects.shakeOffset(false);
  assert.ok(sx === 0 && sy === 0, 'the impact does not shake the picture');
  for (let i = 0; i < Math.round((FX_BIG_BOOM.life + 0.05) * 60); i++) effects.update(1 / 60, stateOf([t]), false);
  assert.equal(effects.counts().impacts, 0, 'the fireball is out after its life');
  assert.equal(effects.counts().craters, 1, 'the crater stays longer');
  for (let i = 0; i < Math.round(FX_BIG_BOOM.crater * 60); i++) effects.update(1 / 60, stateOf([t]), false);
  assert.equal(effects.counts().craters, 0, 'and goes after 2.5 s');
});

test('the impact counts to the ceiling of the muzzle particles', () => {
  const effects = createEffects();
  const t = siege();
  for (let round = 0; round < 40; round++) {
    const shell = shellOf(t, { radius: 2.6, to: { x: 8 + round * 0.01, y: 6.5 } });
    effects.update(1 / 60, stateOf([t], { projectiles: [shell] }), false);
    effects.update(1 / 60, stateOf([t], { events: [{ type: 'explosion', x: shell.to.x, y: shell.to.y, radius: 2.6, doctrine: 'mortar' }] }), false);
    assert.ok(effects.counts().muzzle <= FX_MAX_PARTICLES, `muzzle ${effects.counts().muzzle}`);
  }
  assert.ok(effects.counts().muzzle > 0, 'and the dust is there');
});

test('with reduced motion the impact throws no debris and half the dust', () => {
  const run = (reduced) => {
    const effects = createEffects();
    const t = siege();
    const shell = shellOf(t, { radius: 2.6 });
    effects.update(1 / 60, stateOf([t], { projectiles: [shell] }), reduced);
    effects.update(1 / 60, stateOf([t], { events: [{ type: 'explosion', x: shell.to.x, y: shell.to.y, radius: 2.6, doctrine: 'mortar' }] }), reduced);
    return effects.counts().muzzle;
  };
  assert.ok(run(true) < run(false));
});

test('the flash of the impact goes through the same once-a-second clock as the thunder tower', () => {
  const effects = createEffects();
  const t = siege();
  const lit = (reduced = false) => {
    const { ctx, log } = recorder();
    effects.drawFlash(ctx, { width: 100, height: 100, dpr: 1 }, reduced);
    const fill = log.rects.find((r) => String(r.style).startsWith('rgba(255,241,207'));
    return fill ? Number(String(fill.style).split(',')[3].replace(')', '')) : 0;
  };
  const land = (x, reduced = false) => {
    const shell = shellOf(t, { radius: 2.6, to: { x, y: 6.5 } });
    effects.update(1 / 60, stateOf([t], { projectiles: [shell] }), reduced);
    effects.update(1 / 60, stateOf([t], { events: [{ type: 'explosion', x, y: 6.5, radius: 2.6, doctrine: 'mortar' }] }), reduced);
  };
  land(8);
  assert.ok(lit() > 0 && lit() <= FX_BIG_BOOM.brighten.alpha + 1e-9, 'a flash of at most 10 percent');
  // A second impact half a second later does not flash again.
  for (let i = 0; i < 30; i++) effects.update(1 / 60, stateOf([t]), false);
  assert.equal(lit(), 0, 'the first one is over');
  land(9);
  assert.equal(lit(), 0, 'and the next one within the second does not flash');
  for (let i = 0; i < 60; i++) effects.update(1 / 60, stateOf([t]), false);
  land(10);
  assert.ok(lit() > 0, 'after a second it may');
  const reduced = createEffects();
  for (let i = 0; i < 70; i++) reduced.update(1 / 60, stateOf([t]), true);
  const shell = shellOf(t, { radius: 2.6 });
  reduced.update(1 / 60, stateOf([t], { projectiles: [shell] }), true);
  reduced.update(1 / 60, stateOf([t], { events: [{ type: 'explosion', x: shell.to.x, y: shell.to.y, radius: 2.6, doctrine: 'mortar' }] }), true);
  const { ctx, log } = recorder();
  reduced.drawFlash(ctx, { width: 100, height: 100, dpr: 1 }, true);
  const fill = log.rects.find((r) => String(r.style).startsWith('rgba(255,241,207'));
  assert.ok(fill && Number(String(fill.style).split(',')[3].replace(')', '')) <= FX_BIG_BOOM.brighten.reduced + 1e-9);
  assert.ok(FX_THUNDER.flash.every >= 1);
});

test('the back blast of the siege mortar throws dust, fewer with reduced motion, and the queue keeps its limit', () => {
  const count = (reduced) => {
    const t = siege();
    frames(t, 30, { reduced });
    frames(t, 2, { shoot: true, reduced });
    return (drainFxQueue(t) ?? []).filter((p) => p.kind === 'wsmoke' && p.tone === 0).length;
  };
  assert.ok(count(false) >= 8);
  assert.ok(count(true) < count(false));
});

// ---------- the shrine ----------

test('the mist: gradients only, no composite mode, no shadow, the waves stand still with reduced motion', () => {
  const project = (x, y) => [(x - y) * 32, (x + y) * 16];
  const draw = (t, reduced) => {
    const { ctx, log } = recorder();
    drawMistFlow(ctx, project, 6.5, 6.5, 2.8, [0, -40], 1, t, reduced);
    return log;
  };
  const a = draw(1, false);
  assert.ok(a.gradients >= 4 && a.gradients <= 9, `gradients ${a.gradients}`);
  assert.deepEqual(a.composite, []);
  assert.deepEqual(a.shadow, []);
  // Same picture at two times with reduced motion: the same number of strokes and fills.
  const count = (t) => {
    let n = 0;
    const target = { canvas: { width: 1000, height: 1000 }, globalAlpha: 1 };
    const ctx = new Proxy(target, {
      get: (o, p) => (p in o ? o[p] : p === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => { if (p === 'fill' || p === 'stroke') n += 1; }),
      set: (o, p, v) => ((o[p] = v), true),
    });
    drawMistFlow(ctx, project, 6.5, 6.5, 2.8, [0, -40], 1, t, true);
    return n;
  };
  assert.equal(count(0.2), count(2.9));
  assert.equal(FX_MIST.waves, 4);
});

test('the shrine draws its mist on the ground and no longer its runes', () => {
  const effects = createEffects();
  const t = shrine();
  const state = stateOf([t]);
  frames(t, 10);
  const { ctx, log } = recorder();
  effects.update(1 / 60, state, false);
  effects.drawGround(ctx, state, 1, false, 1);
  assert.ok(log.gradients >= 4, `mist gradients ${log.gradients}`);
  assert.deepEqual(log.composite, []);
});

test('the heavy rocket and the big impact draw without a mixing mode or a blur', () => {
  const { ctx, log } = recorder();
  drawHeavyRocket(ctx, 10, 10, 0.6, -0.8, '#e0b83e');
  for (const age of [0, 0.05, 0.3, 0.69]) drawBigImpact(ctx, 10, 10, 2.6, age, 3, false);
  assert.deepEqual(log.composite, []);
  assert.deepEqual(log.shadow, []);
});

test('a new match forgets the salvos, impacts and craters', () => {
  const effects = createEffects();
  const t = siege();
  const shell = shellOf(t, { radius: 2.6 });
  effects.update(1 / 60, stateOf([t], { projectiles: [shell] }), false);
  effects.update(1 / 60, stateOf([t], { events: [{ type: 'explosion', x: shell.to.x, y: shell.to.y, radius: 2.6, doctrine: 'mortar' }] }), false);
  assert.ok(effects.counts().impacts > 0);
  effects.clear();
  assert.equal(effects.counts().impacts, 0);
  assert.equal(effects.counts().salvos, 0);
});
