// Weapon effects, step 1 (issue 86): the ground light, the ball flame with its afterburn, the three kinds of
// lightning and the brightening of the picture. Render-side only; the simulation does not know any of this.
// What is held here: the ceilings (24 lights, 24 patches, the shared 200 particles), the one-a-second rule
// of the brightening and its 5 % with reduced motion, the double strike of the tesla, no composite mode.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { drawTowerSprite } from '../../src/render/towerSprites.js';
import { fxOf, drainFxExtra } from '../../src/render/towerFx.js';
import { createEffects } from '../../src/render/effects.js';
import { drawTeslaArc, lightSpec, lightAlpha, groundLight, drawBurnPatch } from '../../src/render/weaponFx.js';
import { SPECIALS as SPECIAL_DEFS } from '../../src/data/specials.js';
import { FX_LIGHT, FX_BALLS, FX_BURN, FX_THUNDER, FX_TESLA, FX_MAX_PARTICLES } from '../../src/data/art.js';

/** A context that records what matters: gradients, composite mode, full-picture fills and lines. */
function recorder() {
  const log = { gradients: 0, composite: [], fills: [], rects: [] };
  const target = { canvas: { width: 100, height: 100 }, globalAlpha: 1 };
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
const recipe = (id, extra = {}) => ({
  id: 1, x: 5, y: 5, doctrine: SPECIAL_DEFS[id].doctrine, rank: null, special: id,
  aim: { x: 8.5, y: 5.5 }, cooldown: 0, firing: false, flash: 0, damage: 0, ...extra,
});
const flame = (extra = {}) => ({
  id: 1, x: 5, y: 5, doctrine: 'flame', rank: 3, special: null,
  aim: { x: 6.9, y: 5.5 }, cooldown: 0, firing: true, flash: 0, damage: 0, ...extra,
});

let clock = 0;
/** Draws `n` frames; fires once at the first one when `shoot` (the reload counter jumps up). */
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

// ---------- ground light ----------

test('the lights of the table are those of the study, and every special but the flame has one', () => {
  for (const kind of ['stormBattery', 'emberCauldron', 'siegeMortar', 'thunderTower', 'soulfireObelisk', 'purgeShrine']) {
    const spec = lightSpec(kind);
    assert.ok(spec && spec.r > 0 && spec.a > 0 && spec.fade > 0, kind);
  }
  assert.equal(lightSpec('autocannon'), null, 'a standard doctrine has none');
  assert.equal(FX_LIGHT.max, 24);
  assert.deepEqual(lightSpec('stormBattery', 'hit'), { r: 0.8, colour: '#9fdcff', a: 0.22, fade: 0.1 });
  assert.equal(lightSpec('stormBattery', 'idle'), null);
});

test('a light falls off quickly at first and is gone at the end of its fade', () => {
  const l = { a: 0.5, level: 1 };
  assert.equal(lightAlpha(l), 0.5);
  assert.equal(lightAlpha({ ...l, level: 0.5 }), 0.125);
  assert.equal(lightAlpha({ ...l, level: 0 }), 0);
});

test('the storm battery lights its muzzle and its lead target, one light each however fast it fires', () => {
  const t = recipe('stormBattery');
  const effects = createEffects();
  const state = stateOf([t]);
  frames(t, 10);
  for (let i = 0; i < 40; i++) {
    frames(t, 1, { shoot: true });
    effects.update(1 / 60, state, false);
  }
  const { lights } = effects.counts();
  assert.equal(lights, 2, `two lights, not one per shot (got ${lights})`);
});

test('the ground lights keep to their ceiling, however many emplacements fire', () => {
  const effects = createEffects();
  const towers = [];
  for (let i = 0; i < 12; i++) towers.push(recipe(['emberCauldron', 'thunderTower', 'soulfireObelisk'][i % 3], { id: i + 1, x: i, y: 2 }));
  const state = stateOf(towers);
  for (const t of towers) frames(t, 3);
  for (let round = 0; round < 80; round++) {
    for (const t of towers) frames(t, 1, { shoot: true });
    effects.update(1 / 60, state, false);
    assert.ok(effects.counts().lights <= FX_LIGHT.max, `lights ${effects.counts().lights}`);
  }
  assert.ok(effects.counts().lights > 4, 'and they do appear');
});

test('idle lights and kicked lights together stay within the ceiling when drawn', () => {
  const effects = createEffects();
  const towers = [];
  for (let i = 0; i < 40; i++) towers.push(recipe(i % 2 ? 'emberCauldron' : 'thunderTower', { id: i + 1, x: i % 10, y: Math.floor(i / 10) }));
  const state = stateOf(towers);
  const { ctx, log } = recorder();
  effects.drawGround(ctx, state, 1, false, 1);
  assert.ok(log.gradients <= FX_LIGHT.max, `gradients ${log.gradients}`);
  assert.ok(log.gradients > 0);
});

test('no composite mode anywhere in the weapon effects', () => {
  const effects = createEffects();
  const tower = recipe('thunderTower');
  const fl = flame();
  const state = stateOf([tower, fl, recipe('stormBattery', { id: 3, x: 3 })]);
  const { ctx, log } = recorder();
  for (let i = 0; i < 90; i++) {
    for (const t of state.towers) frames(t, 1, { shoot: i % 20 === 0 });
    effects.update(1 / 60, state, false);
    effects.drawGround(ctx, state, i / 60, false, 1);
    effects.drawAbove(ctx, state, i / 60, false);
    effects.drawFlash(ctx, { width: 100, height: 100, dpr: 1 }, false);
  }
  groundLight(ctx, 10, 10, 2, '#ffffff', 0.4);
  assert.deepEqual(log.composite, []);
});

test('a shell of a siege mortar that lands lights the ground where it fell', () => {
  const t = recipe('siegeMortar');
  const effects = createEffects();
  const shell = { towerId: 1, to: { x: 8.5, y: 5.5 }, t: 0.2, flight: 1 };
  const state = stateOf([t], { projectiles: [shell] });
  effects.update(1 / 60, state, false);
  assert.equal(effects.counts().lights, 0, 'nothing while it flies');
  state.projectiles = [];
  effects.update(1 / 60, state, false);
  assert.equal(effects.counts().lights, 1, 'a light at the impact');
});

// ---------- flame ----------

test('the flame throws fireballs only while it fires, in a straight line at the target', () => {
  const t = flame({ firing: false });
  frames(t, 30);
  assert.equal(fxOf(t).balls.length, 0, 'quiet, none');
  t.firing = true;
  frames(t, 40);
  const balls = fxOf(t).balls;
  assert.ok(balls.length > 3, `balls ${balls.length}`);
  assert.ok(balls.length <= FX_BALLS.max);
  for (const b of balls) {
    // Straight: the direction is within the scatter of the way to the target, and the end is on the line.
    const want = Math.atan2(t.aim.y - b.y0, t.aim.x - b.x0);
    const got = Math.atan2(b.dy, b.dx);
    assert.ok(Math.abs(got - want) <= FX_BALLS.spread + 1e-9, `angle ${got} vs ${want}`);
    assert.ok(Math.abs(Math.hypot(b.dx, b.dy) - 1) < 1e-9);
  }
  t.firing = false;
  frames(t, 60);
  assert.equal(fxOf(t).balls.length, 0, 'they burn out after the jet stops');
});

test('with reduced motion the flame throws half as many balls', () => {
  const count = (reduced) => {
    const t = flame();
    frames(t, 20, { reduced });
    let seen = 0;
    let last = 0;
    for (let i = 0; i < 120; i++) {
      frames(t, 1, { reduced });
      const n = fxOf(t).balls.length;
      if (n > last) seen += n - last;
      last = n;
    }
    return seen;
  };
  assert.ok(count(true) < count(false));
});

test('the fireballs share the ceiling of the muzzles', () => {
  const effects = createEffects();
  const towers = [];
  for (let i = 0; i < 30; i++) towers.push(flame({ id: i + 1, x: i % 10, y: Math.floor(i / 10), aim: { x: (i % 10) + 1.9, y: Math.floor(i / 10) + 0.5 } }));
  const state = stateOf(towers);
  let peakBalls = 0;
  for (let round = 0; round < 120; round++) {
    for (const t of towers) frames(t, 1);
    effects.update(1 / 60, state, false);
    const { muzzle, balls } = effects.counts();
    peakBalls = Math.max(peakBalls, balls);
    assert.ok(muzzle + balls <= FX_MAX_PARTICLES, `muzzle ${muzzle} + balls ${balls}`);
  }
  assert.ok(peakBalls > 50, `balls do appear (${peakBalls})`);
});

test('the afterburn keeps to its ceilings: six of one flame, 24 in all', () => {
  const effects = createEffects();
  const one = flame();
  const state = stateOf([one]);
  for (let i = 0; i < 600; i++) {
    frames(one, 1);
    effects.update(1 / 60, state, false);
    assert.ok(effects.counts().patches <= FX_BURN.max, `patches ${effects.counts().patches}`);
  }
  assert.equal(effects.counts().patches, FX_BURN.max, 'it does reach the ceiling of one flame');
  const many = [];
  for (let i = 0; i < 12; i++) many.push(flame({ id: i + 1, x: i, y: 3, aim: { x: i + 1.9, y: 3.5 } }));
  const crowd = stateOf(many);
  const effects2 = createEffects();
  for (let i = 0; i < 400; i++) {
    for (const t of many) frames(t, 1);
    effects2.update(1 / 60, crowd, false);
    assert.ok(effects2.counts().patches <= FX_BURN.total);
  }
  assert.equal(effects2.counts().patches, FX_BURN.total);
});

test('a patch far out is only soot and glow, close up it has flames too', () => {
  const count = (flames) => {
    let n = 0;
    const { ctx } = recorder();
    const probe = new Proxy(ctx, { get: (t, p) => (p === 'bezierCurveTo' ? () => (n += 1) : t[p]) });
    drawBurnPatch(probe, 0, 0, 0.1, 1, 3, false, flames);
    return n;
  };
  assert.equal(count(false), 0);
  assert.ok(count(true) > 0);
});

// ---------- lightning ----------

test('the tesla strikes twice with a dark gap between, and with reduced motion never goes dark', () => {
  const a = [0, 0];
  const b = [80, 20];
  const [g0, g1] = FX_TESLA.gap;
  const at = (age, reduced) => drawTeslaArc(recorder().ctx, a, b, 3, age, 1 - age / 0.3, reduced);
  assert.equal(at(0.01, false), true, 'first strike');
  assert.equal(at((g0 + g1) / 2, false), false, 'dark between');
  assert.equal(at(g1 + 0.02, false), true, 'second strike');
  assert.equal(at((g0 + g1) / 2, true), true, 'no flicker with reduced motion');
});

test('the tesla strike is a different shape the second time', () => {
  const shape = (age) => {
    const points = [];
    const probe = new Proxy(recorder().ctx, {
      get(t, p) {
        if (p === 'lineTo') return (x, y) => points.push([Math.round(x * 100), Math.round(y * 100)].join());
        return t[p];
      },
    });
    drawTeslaArc(probe, [0, 0], [100, 30], 5, age, 0.5, false, false);
    return points.slice(0, 8).join('|');
  };
  assert.notEqual(shape(0.01), shape(0.1));
});

test('the thunder tower lasts the whole cascade, rings at every target, and rings are a wait of their own', () => {
  const t = recipe('thunderTower');
  frames(t, 10);
  const effects = createEffects();
  const targets = [];
  for (let i = 0; i < 4; i++) targets.push({ x: 7.5 + i, y: 5.5 });
  t.aim = { x: 7.5, y: 5.5 };
  const event = { type: 'chain', towerId: 1, doctrine: 'flame', points: [{ x: 5.5, y: 5.5 }, ...targets] };
  effects.update(1 / 60, stateOf([t], { events: [event] }), false);
  frames(t, 2, { shoot: true });
  const fx = fxOf(t);
  assert.equal(fx.boltPoints.length, 4);
  assert.ok(Math.abs(fx.bolt - (0.34 + 3 * FX_THUNDER.delay)) < 0.05, `cascade lasts ${fx.bolt}`);
  const extra = drainFxExtra(t);
  assert.equal(extra.rings.length, 4);
  assert.ok(extra.rings[0].r > extra.rings[1].r, 'the first ring is the biggest');
  assert.ok(extra.rings[2].age < extra.rings[1].age, 'later rings wait longer (negative age)');
  assert.ok(extra.brighten > 0);
});

// ---------- brightening of the picture ----------

/** Fires every thunder tower once now, lets the effects take it over and returns the alpha of the fill. */
function strike(effects, towers, state, reduced) {
  for (const t of towers) frames(t, 2, { shoot: true, reduced });
  effects.update(1 / 60, state, reduced);
  const { ctx, log } = recorder();
  effects.drawFlash(ctx, { width: 100, height: 100, dpr: 1 }, reduced);
  const fill = log.rects.find((r) => String(r.style).startsWith('rgba(236,232,255'));
  return fill ? Number(String(fill.style).split(',')[3].replace(')', '')) : 0;
}

test('the picture brightens at most once a second, however many thunder towers there are', () => {
  const effects = createEffects();
  const towers = [recipe('thunderTower'), recipe('thunderTower', { id: 2, x: 8 }), recipe('thunderTower', { id: 3, x: 2 })];
  const state = stateOf(towers);
  for (const t of towers) frames(t, 10);
  const lit = () => {
    const { ctx, log } = recorder();
    effects.drawFlash(ctx, { width: 100, height: 100, dpr: 1 }, false);
    return log.rects.some((r) => String(r.style).startsWith('rgba(236,232,255'));
  };
  // Three seconds of constant thunder: every tower fires every 0.25 s (15 updates of 1/60 s).
  let starts = 0;
  let wasLit = false;
  for (let step = 0; step < 180; step++) {
    if (step % 15 === 0) for (const t of towers) frames(t, 2, { shoot: true });
    effects.update(1 / 60, state, false);
    const now = lit();
    if (now && !wasLit) starts += 1;
    wasLit = now;
  }
  assert.ok(starts >= 2, `it does brighten (${starts})`);
  assert.ok(starts <= 3, `${starts} brightenings in three seconds`);
});

test('with reduced motion the brightening is at most 5 percent', () => {
  const effects = createEffects();
  const towers = [recipe('thunderTower')];
  const state = stateOf(towers);
  frames(towers[0], 10, { reduced: true });
  const a = strike(effects, towers, state, true);
  assert.ok(a > 0, 'there is a faint one');
  assert.ok(a <= FX_THUNDER.flash.reduced + 1e-9, `alpha ${a}`);
  const full = createEffects();
  const t2 = [recipe('thunderTower')];
  frames(t2[0], 10);
  assert.ok(strike(full, t2, stateOf(t2), false) > FX_THUNDER.flash.reduced);
});

test('a new match forgets lights, patches and the brightening', () => {
  const t = flame();
  const effects = createEffects();
  const state = stateOf([t]);
  for (let i = 0; i < 90; i++) {
    frames(t, 1);
    effects.update(1 / 60, state, false);
  }
  assert.ok(effects.counts().patches > 0);
  effects.clear();
  const c = effects.counts();
  assert.equal(c.patches, 0);
  assert.equal(c.lights, 0);
  assert.equal(c.balls, 0);
});
