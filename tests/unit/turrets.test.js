// The turned weapons of M9 D2: the models, their depth order, the stage cache and the direction the
// drawing turns to. Render-side only; the simulation does not know any of this.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { turnFrame, renderSolids, faceList, SOLID_K } from '../../src/render/model.js';
import { buildTurret, restPose, muzzleOffset, MOUNT_Z, TURRET_DOCTRINES, TURRET_SCALE, MUZZLE } from '../../src/render/turrets.js';
import {
  stageEntry,
  stageIndex,
  STAGE_STEP,
  resetTurretCache,
  turretStats,
} from '../../src/render/turretCache.js';
import { drawTowerSprite, towerAnchor, turretView } from '../../src/render/towerSprites.js';
import { iso } from '../../src/render/iso.js';
import {
  TURRET_STAGES,
  TURRET_CACHE_BYTES,
  TURRET_BUILDS_PER_FRAME,
  TURRET_TURN_SPEED,
  TURRET_REST_ANGLE,
  TURRET_RECOIL,
} from '../../src/data/art.js';
import { DOCTRINES } from '../../src/data/doctrines.js';

// ---------- a canvas that only counts ----------

function fakeContext(width, height) {
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

let made = [];
globalThis.document = {
  createElement() {
    const canvas = { width: 0, height: 0 };
    canvas.getContext = () => fakeContext(canvas.width, canvas.height);
    made.push(canvas);
    return canvas;
  },
};

let clock = 1000;
const realNow = performance.now.bind(performance);
performance.now = () => clock;
/** Moves the clock on to the next frame. */
const nextFrame = () => (clock += 20);

beforeEach(() => {
  resetTurretCache();
  turretStats.rasterized = 0;
  turretStats.evicted = 0;
  made = [];
  nextFrame();
});

// ---------- the models ----------

test('every doctrine has a model, and the mortar is the rocket launcher', () => {
  assert.deepEqual([...TURRET_DOCTRINES].sort(), Object.keys(DOCTRINES).sort());
  const F = turnFrame(0, MOUNT_Z, TURRET_SCALE);
  const rocket = buildTurret('mortar', F, restPose('#d8ae5f', 3));
  // Six tubes, each with a mouth: the model has far more faces than the plain barrels do.
  const flame = buildTurret('flame', F, restPose('#ff8a2a', 3));
  assert.ok(rocket.parts.length > flame.parts.length);
  assert.equal(MUZZLE.mortar({ tube: 0 }).dir.length, 3);
  assert.throws(() => buildTurret('bogus', F, restPose('#fff')));
});

test('a model builds in every direction and has points to bound its drawing', () => {
  for (const doctrine of TURRET_DOCTRINES) {
    for (let k = 0; k < TURRET_STAGES; k++) {
      const F = turnFrame(k * STAGE_STEP, MOUNT_Z, TURRET_SCALE);
      const built = buildTurret(doctrine, F, restPose('#ff8a2a', 1 + (k % 5)));
      assert.ok(built.parts.length > 5, `${doctrine} ${k}`);
      assert.ok(built.samples.length > 20, `${doctrine} ${k}`);
      for (const [lx, ly, z] of built.samples) assert.ok(Number.isFinite(lx + ly + z), `${doctrine} ${k}`);
    }
  }
});

test('the barrel ends where the muzzle is, so fire cannot start anywhere else', () => {
  // The tip of the barrel of each straight weapon sits at the muzzle point of the model.
  for (const doctrine of ['autocannon', 'flame', 'laser']) {
    const F = turnFrame(0, MOUNT_Z, TURRET_SCALE);
    const built = buildTurret(doctrine, F, restPose('#fff', 3));
    const front = Math.max(...built.samples.map((p) => p[0]));
    const at = built.muzzle.at[0];
    assert.ok(Math.abs(front - at) < 0.03, `${doctrine}: barrel reaches ${front}, muzzle at ${at}`);
  }
});

test('the muzzle turns with the weapon, around the middle of the roof plate', () => {
  for (const doctrine of TURRET_DOCTRINES) {
    const pose = restPose('#fff', 3);
    const a = muzzleOffset(doctrine, 0, pose);
    const b = muzzleOffset(doctrine, Math.PI, pose);
    const m = MUZZLE[doctrine](pose).at;
    // Opposite directions: the horizontal reach mirrors, the height stays.
    const mid = iso(0, 0, MOUNT_Z + m[2] * TURRET_SCALE);
    const reach = m[0] * TURRET_SCALE;
    if (doctrine !== 'mortar') {
      assert.ok(Math.abs(a[0] + b[0] - 2 * mid[0]) < 0.5, `${doctrine}: mirrored sideways`);
      assert.ok(Math.abs(a[1] + b[1] - 2 * mid[1]) < 0.5, `${doctrine}: same height`);
      assert.ok(Math.abs(a[0] - mid[0]) > 0 || reach < 0.4, `${doctrine}: moves`);
    }
    assert.ok(a[1] < iso(0, 0)[1] - MOUNT_Z + 1, `${doctrine}: above the roof`);
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
  // A world point on the ray of this screen point: y = 0, then d cells along (1, 1, 32 / SOLID_K).
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

test('the face drawn last at a point is the one nearest the camera', () => {
  // The painter's order is the whole trick of the models. Check it against a depth buffer on a grid
  // of screen points, in four directions of every weapon. A rare point where two faces meet may
  // go either way; a sorting that is wrong shows in many.
  let points = 0;
  let wrong = 0;
  for (const doctrine of TURRET_DOCTRINES) {
    for (const k of [1, 5, 9, 13]) {
      const F = turnFrame(k * STAGE_STEP, MOUNT_Z, TURRET_SCALE);
      const faces = faceList(buildTurret(doctrine, F, restPose('#ff8a2a', 3)).parts);
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
      for (let y = Math.ceil(y0); y < y1; y += 1.5) {
        for (let x = Math.ceil(x0); x < x1; x += 1.5) {
          let last = null;
          let nearest = null;
          let nearestDepth = -Infinity;
          for (const f of faces) {
            if (!inside(f.scr, x, y) || (f.hole && inside(f.hole, x, y))) continue;
            const d = rayDepth(f, x, y);
            if (d === null) continue;
            last = d;
            if (d > nearestDepth) {
              nearestDepth = d;
              nearest = d;
            }
          }
          if (last === null) continue;
          points += 1;
          // 0.06 cells: the faces of two bodies that touch are the same distance away.
          if (nearest - last > 0.06) wrong += 1;
        }
      }
    }
  }
  assert.ok(points > 5000, `only ${points} points checked`);
  assert.ok(wrong / points < 0.01, `${wrong} of ${points} points show a face behind another`);
});

test('a long face is cut, so that its centre says where it is', () => {
  const F = turnFrame(0.3, MOUNT_Z, TURRET_SCALE);
  const long = buildTurret('flame', F, restPose('#fff', 3));
  const faces = faceList(long.parts);
  assert.ok(faces.some((f) => f.piece), 'long faces come in pieces');
});

test('drawing a model draws only faces that look at the camera', () => {
  const ctx = fakeContext(10, 10);
  const F = turnFrame(1.1, MOUNT_Z, TURRET_SCALE);
  const built = buildTurret('autocannon', F, restPose('#fff', 3));
  let faces = 0;
  for (const part of built.parts) faces += part.faces.length;
  assert.doesNotThrow(() => renderSolids(ctx, built.parts));
  assert.ok(faceList(built.parts).length < faces, 'the faces turned away are left out');
});

// ---------- the stage cache ----------

test('stages are the 16 directions, numbered round the circle', () => {
  assert.equal(TURRET_STAGES, 16);
  assert.equal(stageIndex(0), 0);
  assert.equal(stageIndex(STAGE_STEP * 3.2), 3);
  assert.equal(stageIndex(-STAGE_STEP), 15);
  assert.equal(stageIndex(Math.PI), 8);
  assert.equal(stageIndex(Math.PI * 2 - 0.01), 0);
});

test('a stage is made only when it is asked for, once, and at most a few in one frame', () => {
  assert.equal(turretStats.rasterized, 0, 'nothing is made up front');
  const a = stageEntry('laser', 3, 'all', 4, 1, 1);
  assert.ok(a);
  assert.equal(turretStats.rasterized, 1);
  assert.equal(stageEntry('laser', 3, 'all', 4, 1, 1), a, 'the same stage comes from the cache');
  assert.equal(turretStats.rasterized, 1);
  // Other doctrine, rank or direction: a stage of their own.
  assert.notEqual(stageEntry('flame', 3, 'all', 4, 1, 1), a);
  assert.notEqual(stageEntry('laser', 4, 'all', 4, 1, 1), a);
  assert.notEqual(stageEntry('laser', 3, 'all', 5, 1, 1), a);
  // The budget of the frame is spent: the next stage has to wait for the next frame.
  let waited = 0;
  for (let k = 6; k < 16; k++) if (stageEntry('laser', 3, 'all', k, 1, 1) === null) waited += 1;
  assert.ok(waited > 0, 'a frame makes only a few stages');
  assert.ok(turretStats.rasterized <= TURRET_BUILDS_PER_FRAME, 'and never more than its share');
  nextFrame();
  assert.ok(stageEntry('laser', 3, 'all', 15, 1, 1), 'the next frame makes the stage');
});

test('a stage is cropped to what the weapon covers', () => {
  const entry = stageEntry('laser', 3, 'all', 0, 1, 1);
  // The laser is tall and narrow, the area it covers is far smaller than a whole cell of sprite.
  assert.ok(entry.w < 64 && entry.h < 80, `${entry.w} x ${entry.h}`);
  assert.ok(entry.y < -MOUNT_Z, 'it starts above the roof');
  assert.ok(entry.canvas.width >= entry.w && entry.shadow.width < entry.canvas.width, 'the shadow is a coarser copy');
});

test('only the raster step of the zoom in use is kept', () => {
  stageEntry('laser', 3, 'all', 0, 1, 1);
  assert.equal(turretStats.entries, 1);
  // A different step asks for a different raster. It takes over once the zoom has stood still.
  nextFrame();
  stageEntry('laser', 3, 'all', 0, 2, 1);
  assert.equal(turretStats.entries, 1, 'still the old step');
  clock += 300;
  stageEntry('laser', 3, 'all', 0, 2, 1);
  assert.equal(turretStats.entries, 1, 'the old step is gone, the new one is in');
  assert.equal(turretStats.rasterized, 2);
});

test('the memory of the stages stays below its budget', () => {
  // The largest raster (2.5 x pixel ratio 2) and every doctrine and rank: far more than fits.
  for (let round = 0; round < 40; round++) {
    nextFrame();
    for (const doctrine of TURRET_DOCTRINES) {
      for (let rank = 1; rank <= 5; rank++) stageEntry(doctrine, rank, 'all', round % TURRET_STAGES, 2.5, 2);
    }
    assert.ok(turretStats.bytes <= TURRET_CACHE_BYTES * 1.1, `${turretStats.bytes} bytes held`);
  }
});

// ---------- the direction of the drawing ----------

const sprites = {
  get: () => ({ canvas: {}, flash: {}, shadow: {} }),
};
const bunker = (aim, extra = {}) => ({
  id: 1,
  x: 5,
  y: 5,
  doctrine: 'autocannon',
  rank: 3,
  special: null,
  aim,
  cooldown: 0,
  firing: false,
  flash: 0,
  ...extra,
});

/** Draws a tower for `seconds` of frames, the clock running with them. */
function run(tower, seconds, dt = 1 / 60) {
  const ctx = fakeContext(100, 100);
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames; i++) {
    nextFrame();
    drawTowerSprite(ctx, sprites, tower, 1, 1, i * dt, dt, true);
  }
  return frames * dt;
}

test('a weapon without a target stands in its resting direction', () => {
  const tower = bunker(null);
  run(tower, 0.5);
  assert.ok(Math.abs(turretView(tower).theta - TURRET_REST_ANGLE) < 1e-9);
});

test('the drawing turns towards the target at its own speed, not at once', () => {
  const tower = bunker({ x: 5.5 + 3, y: 5.5 }); // along +x, a quarter turn from rest
  const seconds = run(tower, 0.1);
  const v = turretView(tower);
  const turned = Math.abs(v.theta - TURRET_REST_ANGLE);
  assert.ok(turned > 0.1 && turned < Math.PI / 2 - 0.1, `turned ${turned}`);
  assert.ok(turned <= TURRET_TURN_SPEED.autocannon * seconds + 1e-9, 'no faster than its speed');
  assert.equal(v.staged, false, 'still turning, so drawn from the model');
  run(tower, 1.5);
  const done = turretView(tower);
  assert.ok(Math.abs(done.theta) < 1e-6, 'arrived at +x');
  assert.equal(done.staged, true, 'and on its stage again');
  assert.equal(done.shown, 0);
});

test('it takes the short way round', () => {
  const tower = bunker({ x: 5.5, y: 5.5 - 3 }, { doctrine: 'laser' }); // -y: a quarter turn back from +y... via +x
  run(tower, 0.15);
  const v = turretView(tower);
  // From +y (pi/2) to -y (-pi/2) is half a turn either way; it must still be moving and finite.
  assert.ok(Number.isFinite(v.theta));
  run(tower, 2);
  assert.ok(Math.abs(Math.abs(turretView(tower).theta) - Math.PI / 2) < 1e-6);
});

test('without a target the last direction is kept', () => {
  const tower = bunker({ x: 5.5 - 3, y: 5.5 });
  run(tower, 2);
  const before = turretView(tower).theta;
  tower.aim = null;
  run(tower, 1);
  assert.equal(turretView(tower).theta, before);
});

test('firing alone does not make a weapon expensive', () => {
  const tower = bunker({ x: 5.5, y: 5.5 + 3 }, { doctrine: 'laser' });
  run(tower, 1.5);
  assert.equal(turretView(tower).staged, true);
  const made0 = turretStats.rasterized;
  // Shots: the reload counter jumps up again and again.
  for (let shot = 0; shot < 20; shot++) {
    tower.cooldown = 1.25;
    tower.firing = true;
    run(tower, 0.1);
    assert.equal(turretView(tower).staged, true, 'still from its stage while firing');
  }
  assert.equal(turretStats.rasterized, made0, 'and nothing new was made');
});

test('the anchor of the effects is the muzzle of the model, where the weapon faces now', () => {
  const tower = bunker({ x: 5.5 + 3, y: 5.5 }, { doctrine: 'laser' });
  const before = towerAnchor(tower);
  run(tower, 2);
  const after = towerAnchor(tower);
  assert.notDeepEqual(before, after, 'the muzzle moved as the weapon turned');
  const ground = iso(5.5, 5.5);
  const off = muzzleOffset('laser', 0, restPose('#fff'));
  assert.ok(Math.abs(after[0] - (ground[0] + off[0])) < 1e-6);
  assert.ok(Math.abs(after[1] - (ground[1] + off[1])) < 1e-6);
});

test('recoil is a push along the barrel, defined for every doctrine', () => {
  for (const doctrine of TURRET_DOCTRINES) assert.ok(TURRET_RECOIL[doctrine] >= 0 && TURRET_RECOIL[doctrine] < 0.2, doctrine);
});

test.after(() => {
  performance.now = realNow;
});
