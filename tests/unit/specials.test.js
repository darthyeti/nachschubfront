// The recipe emplacements of M9 D4: their weapons as turned models, the stages of the cache for them, and
// the fire at their muzzles. Render-side only; the simulation does not know any of this.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { turnFrame, faceList, SOLID_K } from '../../src/render/model.js';
import {
  buildSpecial,
  specialRestPose,
  SPECIAL_IDS,
  SPECIAL_MUZZLES,
  SPECIAL_MOUNT_Z,
  specialScale,
  siegeSight,
} from '../../src/render/specials.js';
import { weaponOf, weaponBox, weaponModel, weaponMuzzle } from '../../src/render/weapons.js';
import { stageEntry, stageIndex, STAGE_STEP, resetTurretCache, turretStats } from '../../src/render/turretCache.js';
import { drawTowerSprite, towerAnchor, turretView, towerDraw, towerPictureBox } from '../../src/render/towerSprites.js';
import { drainFxQueue, fxOf, noteTowerEvent, muzzleWorld, shellPosition, auraLevel } from '../../src/render/towerFx.js';
import { createEffects } from '../../src/render/effects.js';
import { iso } from '../../src/render/iso.js';
import {
  TURRET_STAGES,
  SPECIAL_SCALE,
  SPECIAL_MUZZLE,
  SPECIAL_ROOF_HEIGHT,
  SPECIAL_TURN_SPEED,
  FX_SIGHT_SECONDS,
  FX_OBELISK_CHARGE_SECONDS,
  FX_AURA_IDLE,
  FX_SHELL,
  TURRET_SCALE,
} from '../../src/data/art.js';
import { SPECIALS as SPECIAL_DEFS } from '../../src/data/specials.js';
import { RECIPE_IDS } from '../../src/data/recipes.js';

// ---------- a canvas that only counts ----------

function fakeContext(width = 100, height = 100) {
  const calls = { drawImage: 0 };
  return new Proxy(
    { canvas: { width, height }, calls },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'drawImage') return () => (calls.drawImage += 1);
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
    canvas.getContext = () => fakeContext(canvas.width, canvas.height);
    return canvas;
  },
};

let clock = 1000;
const realNow = performance.now.bind(performance);
performance.now = () => clock;
const nextFrame = () => (clock += 20);

beforeEach(() => {
  resetTurretCache();
  turretStats.rasterized = 0;
  turretStats.evicted = 0;
  nextFrame();
});

const sprites = { get: () => ({ canvas: {}, shadow: {}, flash: {}, w: 10, h: 10 }) };
const special = (id, extra = {}) => ({
  id: 1, x: 5, y: 5, doctrine: SPECIAL_DEFS[id].doctrine, rank: null, special: id,
  aim: { x: 8.5, y: 5.5 }, cooldown: 0, firing: false, flash: 0, ...extra,
});

/** Draws `n` frames of `t`, and fires once at the first one (the reload counter jumps up). */
function frames(t, n, { shoot = false, reduced = false, dt = 1 / 60 } = {}) {
  const ctx = fakeContext();
  for (let i = 0; i < n; i++) {
    if (shoot && i === 0) t.cooldown += 1;
    nextFrame();
    drawTowerSprite(ctx, sprites, t, 1, 1, 10 + i * dt, dt, reduced);
    if (t.cooldown > 0) t.cooldown = Math.max(0, t.cooldown - dt);
  }
}

// ---------- the models ----------

test('every recipe has a weapon model, keyed by its id, and the data agrees', () => {
  assert.deepEqual([...SPECIAL_IDS].sort(), RECIPE_IDS.slice().sort());
  for (const id of RECIPE_IDS) {
    assert.ok(SPECIAL_SCALE[id] > 0, id);
    assert.ok(SPECIAL_TURN_SPEED[id] > 0, id);
    const model = weaponModel(id);
    assert.equal(model.special, true);
    assert.equal(model.mount, SPECIAL_MOUNT_Z);
    assert.equal(model.scale, specialScale(id));
    assert.equal(model.scale, TURRET_SCALE * SPECIAL_SCALE[id]);
  }
  assert.equal(SPECIAL_MOUNT_Z, SPECIAL_ROOF_HEIGHT);
  assert.throws(() => buildSpecial('bogus', turnFrame(0, SPECIAL_MOUNT_Z, 1), specialRestPose('#fff')));
  assert.equal(weaponModel('bogus'), null);
});

test('a model builds in every direction, in every layer, with points to bound its drawing', () => {
  for (const id of SPECIAL_IDS) {
    for (let k = 0; k < TURRET_STAGES; k++) {
      const F = turnFrame(k * STAGE_STEP, SPECIAL_MOUNT_Z, specialScale(id));
      const built = buildSpecial(id, F, specialRestPose('#ff8a2a'));
      assert.ok(built.parts.length > 8, `${id} ${k}`);
      assert.ok(built.samples.length > 40, `${id} ${k}`);
      for (const [lx, ly, z] of built.samples) assert.ok(Number.isFinite(lx + ly + z), `${id} ${k}`);
    }
  }
});

test('the floating parts are a layer of their own, and base and float make up the whole weapon', () => {
  const F = turnFrame(0.7, SPECIAL_MOUNT_Z, 1);
  for (const id of ['thunderTower', 'soulfireObelisk']) {
    const pose = specialRestPose('#fff');
    const all = buildSpecial(id, F, pose, 'all').parts.length;
    const base = buildSpecial(id, F, pose, 'base').parts.length;
    const top = buildSpecial(id, F, pose, 'float').parts.length;
    assert.ok(base > 0 && top > 0, id);
    assert.equal(base + top, all, `${id}: nothing lost and nothing twice`);
  }
  // The others have no layer to split off: the float layer of them is empty or the whole weapon.
  assert.equal(weaponOf(special('stormBattery')).live.length, 0);
});

test('no special stands more than a tenth higher than its sprite did, and the obelisk is still the tallest', () => {
  // Height of the sprite of each weapon on the old base in world px (bbox of its symbol, which carries a
  // margin of 5 px, so this is slack on the side of the new weapons), measured from the ground.
  const before = { purgeShrine: 70.2, stormBattery: 85.3, emberCauldron: 71, siegeMortar: 86.5, thunderTower: 92, soulfireObelisk: 132.4 };
  const height = (id) => -weaponBox(id)[1];
  for (const id of RECIPE_IDS) {
    assert.ok(height(id) <= before[id] * 1.1, `${id}: ${height(id).toFixed(1)} against ${before[id]}`);
    assert.ok(height(id) > SPECIAL_MOUNT_Z, `${id}: stands above the roof plate`);
  }
  assert.equal(RECIPE_IDS.reduce((a, b) => (height(a) >= height(b) ? a : b)), 'soulfireObelisk');
  // It has to fit under the renderer's margin for artwork above the ground point.
  assert.ok(height('soulfireObelisk') < 260);
  const width = (id) => weaponBox(id)[2] - weaponBox(id)[0];
  assert.equal(RECIPE_IDS.reduce((a, b) => (width(a) >= width(b) ? a : b)), 'stormBattery', 'the quad gun is the broad one');
});

test('the barrels end where the muzzle is, so fire cannot start anywhere else', () => {
  const F = turnFrame(0, SPECIAL_MOUNT_Z, specialScale('stormBattery'));
  for (let tube = 0; tube < 4; tube++) {
    const pose = { ...specialRestPose('#fff'), tube };
    const built = buildSpecial('stormBattery', F, pose);
    const [, ly, z] = built.muzzle.at.length === 3 ? built.muzzle.at : [0, 0, 0];
    // Some point of the model sits at the front of this barrel.
    const near = built.samples.filter((p) => Math.abs(p[1] - ly) < 0.05 && Math.abs(p[2] - z) < 1.5);
    assert.ok(near.length && Math.max(...near.map((p) => p[0])) >= built.muzzle.at[0] - 0.03, `barrel ${tube}`);
  }
  // The tube of the mortar ends at the muzzle, in the direction the tube points.
  const siege = buildSpecial('siegeMortar', F, specialRestPose('#fff'));
  const front = Math.max(...siege.samples.map((p) => p[0]));
  assert.ok(Math.abs(front - siege.muzzle.at[0]) < 0.12, 'the brake is at the end of the tube');
  assert.ok(siege.muzzle.dir[2] > 0.5, 'which is raised');
  // The scope lens sits on the left cheek and is not on the barrel.
  assert.ok(siegeSight()[1] < 0);
});

test('the muzzle turns with the weapon, around the middle of the roof plate', () => {
  for (const id of SPECIAL_IDS) {
    const pose = specialRestPose('#fff');
    const a = weaponMuzzle(id, 0, pose);
    const b = weaponMuzzle(id, Math.PI, pose);
    const m = SPECIAL_MUZZLES[id](pose).at;
    const scale = specialScale(id);
    const mid = iso(0, 0, SPECIAL_MOUNT_Z + m[2] * scale);
    // Opposite directions: the horizontal reach mirrors about the middle, the height stays.
    assert.ok(Math.abs(a[0] + b[0] - 2 * mid[0]) < 0.5, `${id}: mirrored sideways`);
    assert.ok(Math.abs(a[1] + b[1] - 2 * mid[1]) < 0.5, `${id}: same height`);
    assert.ok(a[1] < iso(0, 0)[1] - SPECIAL_MOUNT_Z + 1, `${id}: above the roof`);
  }
});

// ---------- depth order ----------

/** Real distance along the view ray of the face plane at a screen point, larger = nearer the camera. */
function rayDepth(face, px, py) {
  const w = face.world;
  const true3 = (p) => [p[0], p[1], p[2] / SOLID_K];
  const p0 = true3(w[0]);
  const u = true3(w[1]).map((v, i) => v - p0[i]);
  let n = null;
  for (let i = 2; i < w.length && !n; i++) {
    const v = true3(w[i]).map((q, j) => q - p0[j]);
    const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...c) > 1e-9) n = c;
  }
  if (!n) return null;
  const x = px / 32;
  const a = [x, 0, (x * 16 - py) / SOLID_K];
  const dir = [1, 1, 32 / SOLID_K];
  const denom = n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2];
  if (Math.abs(denom) < 1e-9) return null;
  return (n[0] * (p0[0] - a[0]) + n[1] * (p0[1] - a[1]) + n[2] * (p0[2] - a[2])) / denom;
}

function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

test('nothing shows through: the face drawn last at a point is the one nearest the camera, all 16 directions', () => {
  let points = 0;
  let wrong = 0;
  for (const id of SPECIAL_IDS) {
    let wrongHere = 0;
    let pointsHere = 0;
    for (let k = 0; k < TURRET_STAGES; k++) {
      const F = turnFrame(k * STAGE_STEP, SPECIAL_MOUNT_Z, specialScale(id));
      const faces = faceList(buildSpecial(id, F, specialRestPose('#ff8a2a')).parts);
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const f of faces) {
        for (const [x, y] of f.scr) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
      for (let y = Math.ceil(y0); y < y1; y += 2) {
        for (let x = Math.ceil(x0); x < x1; x += 2) {
          let last = null;
          let nearest = -Infinity;
          for (const f of faces) {
            if (!inside(f.scr, x, y) || (f.hole && inside(f.hole, x, y))) continue;
            const d = rayDepth(f, x, y);
            if (d === null) continue;
            last = d;
            nearest = Math.max(nearest, d);
          }
          if (last === null) continue;
          pointsHere += 1;
          // 0.06 cells: the faces of two bodies that touch are the same distance away.
          if (nearest - last > 0.06) wrongHere += 1;
        }
      }
    }
    assert.ok(pointsHere > 1500, `${id}: only ${pointsHere} points checked`);
    assert.ok(wrongHere / pointsHere < 0.012, `${id}: ${wrongHere} of ${pointsHere} points show a face behind another`);
    points += pointsHere;
    wrong += wrongHere;
  }
  assert.ok(wrong / points < 0.01, `${wrong} of ${points}`);
});

// ---------- the stages ----------

test('a resting weapon stands on a stage, the floating part is drawn over it, the shrine is always live', () => {
  for (const [id, staged] of [['stormBattery', true], ['thunderTower', true], ['soulfireObelisk', true], ['purgeShrine', false]]) {
    resetTurretCache();
    const t = special(id);
    frames(t, 90);
    // Stages are built a few per frame, so it settles within a few frames of standing still.
    const view = turretView(t);
    assert.equal(view.aligned, true, id);
    assert.equal(view.staged, staged, id);
  }
  // The stage of a weapon with a floating part has no floating part in it.
  const k = 3;
  const base = stageEntry('thunderTower', 0, 'base', k, 1, 1);
  const all = stageEntry('thunderTower', 0, 'all', k, 1, 1);
  assert.ok(base.h < all.h, 'the stage is cropped to the base, the ring and ball are not in it');
  // But its shadow is that of the whole weapon, and has its own box, taller than the stage.
  assert.ok(base.shadowBox && base.shadowBox.h > base.h, 'the shadow has the floating part');
  assert.equal(stageEntry('stormBattery', 0, 'all', k, 1, 1).shadowBox, null);
});

test('firing alone does not make the thunder tower, the cauldron or the obelisk expensive; the recoiling guns are drawn live', () => {
  for (const id of ['thunderTower', 'emberCauldron', 'soulfireObelisk']) {
    resetTurretCache();
    const t = special(id);
    frames(t, 90);
    const before = turretStats.rasterized;
    frames(t, 10, { shoot: true });
    assert.equal(turretView(t).staged, true, `${id}: still on its stage while it fires`);
    assert.equal(turretStats.rasterized, before, `${id}: nothing was made for it`);
  }
  for (const id of ['stormBattery', 'siegeMortar']) {
    const t = special(id);
    frames(t, 90);
    frames(t, 1, { shoot: true });
    assert.equal(turretView(t).staged, false, `${id}: the barrel slides back in the model`);
    frames(t, 40);
    assert.equal(turretView(t).staged, true, `${id}: and it is back on its stage afterwards`);
  }
});

test('the drawing turns at the speed of its weapon: the shrine slowly, the battery quickly', () => {
  assert.ok(SPECIAL_TURN_SPEED.purgeShrine < SPECIAL_TURN_SPEED.stormBattery);
  const t = special('purgeShrine', { aim: { x: 9.5, y: 5.5 } });
  frames(t, 1);
  const start = turretView(t).theta;
  frames(t, 6);
  const turned = Math.abs(turretView(t).theta - start);
  assert.ok(turned > 0 && turned < 6 * (1 / 60) * SPECIAL_TURN_SPEED.purgeShrine + 1e-6);
});

test('the anchor of the effects is the muzzle of the model, where the weapon faces now', () => {
  for (const id of SPECIAL_IDS) {
    const t = special(id);
    frames(t, 90);
    const view = turretView(t);
    const off = weaponMuzzle(id, view.shown, { ...specialRestPose('#fff'), tube: 0 });
    const centre = iso(t.x + 0.5, t.y + 0.5);
    const a = towerAnchor(t);
    assert.ok(Math.abs(a[0] - (centre[0] + off[0])) < 1e-6, `${id}: x`);
    assert.ok(Math.abs(a[1] - (centre[1] + off[1])) < 1e-6, `${id}: y`);
    // And the picture box takes in what the weapon covers whichever way it faces.
    const [x0, y0, x1] = towerPictureBox(t);
    assert.ok(x0 <= weaponBox(id)[0] && x1 >= weaponBox(id)[2] && y0 <= weaponBox(id)[1], id);
  }
});

// ---------- the fire at the muzzles ----------

test('the storm battery fires its four barrels in turn, each with a flash, a case and a blue tracer', () => {
  const t = special('stormBattery');
  frames(t, 90);
  const seen = [];
  for (let shot = 0; shot < 5; shot++) {
    noteTowerEvent(t, { type: 'shot', tx: 8.5, ty: 5.5 });
    noteTowerEvent(t, { type: 'shot', tx: 8.5, ty: 6.5 });
    frames(t, 1, { shoot: true });
    const fx = fxOf(t);
    const k = fx.flashK.findIndex((v, i) => v > 0 && fx.flashK.every((w, j) => j === i || w < v));
    seen.push(k);
    const queued = drainFxQueue(t);
    assert.ok(queued.some((p) => p.kind === 'wcasing'), 'a case from the back of the housing');
    const tracer = queued.find((p) => p.kind === 'wtracer');
    assert.equal(tracer.colour, '#7fd8ff', 'the tracer of the battery is blue');
    frames(t, 12);
    drainFxQueue(t);
  }
  assert.deepEqual(seen, [0, 1, 2, 3, 0]);
  // The first barrel has slid back after its shot: its muzzle is behind the resting one.
  const rest = SPECIAL_MUZZLES.stormBattery({ tube: 0, bar: [0, 0, 0, 0] }).at[0];
  assert.ok(SPECIAL_MUZZLES.stormBattery({ tube: 0, bar: [1, 0, 0, 0] }).at[0] < rest);
  assert.ok(SPECIAL_MUZZLE.stormBattery.barrels.length === 4);
});

test('the tracers of a volley go to the targets the simulation hit, in turn', () => {
  const t = special('stormBattery');
  frames(t, 90);
  const targets = [];
  for (let shot = 0; shot < 4; shot++) {
    noteTowerEvent(t, { type: 'shot', tx: 7.5, ty: 5.5 });
    noteTowerEvent(t, { type: 'shot', tx: 7.5, ty: 8.5 });
    frames(t, 1, { shoot: true });
    const tracer = drainFxQueue(t).find((p) => p.kind === 'wtracer');
    targets.push(Math.round(tracer.y1));
    frames(t, 10);
    drainFxQueue(t);
  }
  assert.ok(targets.some((y) => y <= 6) && targets.some((y) => y >= 8), `both targets are hit: ${targets}`);
});

test('the cauldron throws a bolt from its electrode to every target of the volley', () => {
  const t = special('emberCauldron');
  frames(t, 90);
  noteTowerEvent(t, { type: 'shot', tx: 7.5, ty: 5.5 });
  noteTowerEvent(t, { type: 'shot', tx: 8.5, ty: 6.5 });
  noteTowerEvent(t, { type: 'shot', tx: 9.5, ty: 4.5 });
  frames(t, 1, { shoot: true });
  const fx = fxOf(t);
  assert.deepEqual(fx.boltPoints, [[7.5, 5.5], [8.5, 6.5], [9.5, 4.5]]);
  assert.ok(fx.bolt > 0 && fx.flash > 0);
  // The bolt starts at the electrode, that is the muzzle of the model.
  const mw = muzzleWorld(t, turretView(t).shown, turretView(t).theta, {});
  assert.ok(Math.abs(fx.frame.x - mw.x) < 1e-9 && Math.abs(fx.frame.z - mw.z) < 1e-9);
  frames(t, 30);
  assert.equal(fxOf(t).bolt, 0, 'and it is gone after a moment');
});

test('the thunder tower chains from the ball over every point the simulation reports', () => {
  const t = special('thunderTower');
  frames(t, 90);
  noteTowerEvent(t, { type: 'chain', points: [{ x: 5.5, y: 5.5 }, { x: 7.5, y: 5.5 }, { x: 8.5, y: 6.5 }] });
  frames(t, 1, { shoot: true });
  assert.deepEqual(fxOf(t).boltPoints, [[7.5, 5.5], [8.5, 6.5]]);
  // The ball floats, so the bolt leaves from above everything: it is drawn over the figures.
  assert.equal(fxOf(t).frame.front, true);
});

test('the eye of the obelisk charges over the end of its reload and fires the soul beam from the pupil', () => {
  const t = special('soulfireObelisk');
  frames(t, 90);
  assert.equal(fxOf(t).charge, 0);
  // The reload counter is down to 0.2 s with a target: the eye is half charged and lit.
  t.cooldown = FX_OBELISK_CHARGE_SECONDS / 2;
  frames(t, 1);
  assert.ok(Math.abs(fxOf(t).charge - 0.5) < 0.05, `charge ${fxOf(t).charge}`);
  t.cooldown = 0.05;
  frames(t, 1);
  assert.equal(fxOf(t).glow, 1, 'the pupil lights up');
  t.cooldown = 0;
  noteTowerEvent(t, { type: 'soulfire', tx: 8.5, ty: 5.5 });
  frames(t, 1, { shoot: true });
  assert.deepEqual(fxOf(t).beamEnd, [8.5, 5.5]);
  assert.ok(fxOf(t).beam > 0);
  const queued = drainFxQueue(t) ?? [];
  assert.ok(queued.some((p) => p.kind === 'wspark'), 'violet sparks where it strikes');
  // No target, no charge.
  const idle = special('soulfireObelisk', { aim: null });
  frames(idle, 5);
  idle.cooldown = 0.1;
  frames(idle, 1);
  assert.equal(fxOf(idle).charge, 0);
});

test('the siege mortar aims with its scope over the end of the reload, and the shell leaves the tube', () => {
  const t = special('siegeMortar');
  frames(t, 90);
  t.cooldown = FX_SIGHT_SECONDS * 2;
  frames(t, 1);
  assert.equal(fxOf(t).sight, 0, 'not yet');
  t.cooldown = FX_SIGHT_SECONDS / 2;
  frames(t, 1);
  assert.ok(Math.abs(fxOf(t).sight - 0.5) < 0.05);
  t.cooldown = 0;
  frames(t, 1, { shoot: true });
  assert.equal(fxOf(t).sight, 0, 'the line is gone once the shell has left');
  const launch = fxOf(t).launch;
  assert.ok(launch && launch.dir[2] > 0.5, 'it leaves along the raised tube');
  // The shell flies from there to the point of the shell of the simulation, in its flight time.
  const shell = { to: { x: 11.5, y: 6.5 }, t: 0, flight: 1.2 };
  assert.deepEqual(shellPosition(launch, shell), [launch.x, launch.y, launch.z]);
  const end = shellPosition(launch, { ...shell, t: 1.2 });
  assert.ok(Math.abs(end[0] - 11.5) < 1e-9 && Math.abs(end[1] - 6.5) < 1e-9 && Math.abs(end[2] - FX_SHELL.endZ) < 1e-9);
  const mid = shellPosition(launch, { ...shell, t: 0.6 });
  assert.ok(mid[2] > launch.z + FX_SHELL.lift * 0.9, 'a high arc');
  assert.deepEqual(shellPosition(launch, { ...shell, t: 1.2, flight: 2.4 }), mid, 'same path, whatever the time');
});

test('the shell of the siege mortar and the rocket of the standard mortar are both drawn from the launch of their emplacement', () => {
  const effects = createEffects();
  const siege = special('siegeMortar');
  const standard = { id: 2, x: 9, y: 9, doctrine: 'mortar', rank: 3, special: null, aim: { x: 12.5, y: 9.5 }, cooldown: 0, firing: false, flash: 0 };
  frames(siege, 90);
  frames(standard, 90);
  frames(siege, 1, { shoot: true });
  frames(standard, 1, { shoot: true });
  const shells = [
    { id: 1, towerId: 1, x: 5.5, y: 5.5, to: { x: 11.5, y: 6.5 }, t: 0.3, flight: 1.2 },
    { id: 2, towerId: 2, x: 9.5, y: 9.5, to: { x: 12.5, y: 9.5 }, t: 0.3, flight: 1.0 },
  ];
  const state = { events: [], towers: [siege, standard], projectiles: shells, enemies: [], pods: [], pendingStrikes: [], banners: [] };
  // One update drains what the muzzles queued and lets the rocket leave its trail; the heavy shell leaves none.
  const before = effects.counts().particles;
  effects.update(0.05, state, false);
  assert.ok(effects.counts().particles > before);
  assert.doesNotThrow(() => effects.drawAbove(fakeContext(), state, 1, false));
});

test('the gold aura of the shrine stands all the time and rises while it works', () => {
  const t = special('purgeShrine');
  frames(t, 10);
  assert.ok(Math.abs(auraLevel(t) - FX_AURA_IDLE) < 0.01, 'dim at rest');
  t.firing = true;
  frames(t, 90);
  assert.ok(auraLevel(t) > 0.95, 'full while it works');
  t.firing = false;
  frames(t, 120);
  assert.ok(Math.abs(auraLevel(t) - FX_AURA_IDLE) < 0.05, 'and dim again');
  // A shrine that has never been drawn has the idle level, not nothing.
  assert.equal(auraLevel({}), FX_AURA_IDLE);
});

test('reduced motion: no sparks from the muzzles of the specials', () => {
  const count = (reduced) => {
    let sparks = 0;
    for (const id of ['emberCauldron', 'thunderTower', 'soulfireObelisk', 'siegeMortar']) {
      for (let i = 0; i < 6; i++) {
        const t = special(id);
        frames(t, 30, { reduced });
        noteTowerEvent(t, { type: 'chain', points: [{ x: 5.5, y: 5.5 }, { x: 8.5, y: 5.5 }] });
        frames(t, 2, { shoot: true, reduced });
        sparks += (drainFxQueue(t) ?? []).filter((p) => p.kind === 'wspark').length;
      }
    }
    return sparks;
  };
  assert.ok(count(false) > 0);
  assert.equal(count(true), 0);
});

test('the events of the specials are kept for the muzzle, and the old drawing is skipped', () => {
  const t = special('soulfireObelisk');
  const effects = createEffects();
  const state = {
    events: [{ type: 'soulfire', towerId: 1, doctrine: 'psi', x: 5.5, y: 5.5, tx: 8.5, ty: 5.5 }],
    towers: [t], projectiles: [], enemies: [], pods: [], pendingStrikes: [], banners: [],
  };
  effects.update(0.016, state, false);
  assert.equal(fxOf(t).pending.type, 'soulfire');
  assert.equal(effects.counts().particles, 0, 'no beam of the old kind');
});

test('the old paths are gone: nothing draws a recipe emplacement from a sprite top', () => {
  assert.equal(towerDraw.calls > 0, true);
  for (const id of RECIPE_IDS) assert.equal(weaponOf(special(id)).special, true);
  assert.equal(stageIndex(0), 0);
});

test.after(() => {
  performance.now = realNow;
});
