import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../../src/core/state.js';
import { createRng } from '../../src/core/random.js';
import {
  STEP,
  ENEMY_BLEND,
  heightField,
  heightAt,
  cellHeight,
  rampsOf,
  rampCorners,
  flatField,
  setActiveTerrain,
  cellLift,
  liftAt,
} from '../../src/render/terrain.js';

const SEEDS = ['4RCC95', '7EJY6Y', 'ABC123', 'ZZZ999', 'K3Q8TV', 'M0NDAY'];
const plain = (size = 24) => ({ size, obstacles: [] });

test('the height field is deterministic and cached per map and seed', () => {
  const map = plain();
  const a = heightField(map, '4RCC95');
  assert.equal(heightField(map, '4RCC95'), a);
  assert.deepEqual([...heightField(plain(), '4RCC95')], [...a]);
  assert.notDeepEqual([...heightField(plain(), 'ABC123')], [...a]);
});

test('levels are 0 to 2 and all three occur on the usual seeds', () => {
  for (const seed of SEEDS) {
    const field = heightField(plain(), seed);
    assert.equal(field.length, 24 * 24);
    const seen = new Set(field);
    assert.ok([...seen].every((v) => v >= 0 && v <= 2), seed);
    assert.equal(seen.size, 3, `${seed} has ${[...seen]}`);
  }
});

test('the field of a real game is the same as the plain one, whatever the player builds', () => {
  const state = createGameState('4RCC95');
  const before = [...heightField(state.map, '4RCC95')];
  const other = { ...state.map, obstacles: [...state.map.obstacles, { kind: 'bulwark', cells: [{ x: 3, y: 3 }] }] };
  assert.deepEqual([...heightField(other, '4RCC95')], before);
  assert.equal(before.length, state.map.size * state.map.size);
});

test('building the field draws from its own stream and none of the game', () => {
  const rng = createRng('map:Q1');
  const twin = createRng('map:Q1');
  heightField(plain(), 'Q1');
  assert.equal(rng.next(), twin.next());
});

test('a crater lies one level lower than the noise gave it, never below the ground', () => {
  const base = heightField(plain(), 'KRATER');
  const cells = [];
  for (let i = 0; i < base.length; i++) cells.push({ x: i % 24, y: Math.floor(i / 24) });
  const lowered = heightField({ size: 24, obstacles: [{ kind: 'crater', cells }] }, 'KRATER');
  for (let i = 0; i < base.length; i++) assert.equal(lowered[i], Math.max(0, base[i] - 1), `cell ${i}`);
});

test('rift, bastion and beacons keep the level of the noise', () => {
  const base = heightField(plain(), 'ANKER');
  const anchors = [{ x: 3, y: 3 }, { x: 12, y: 12 }, { x: 20, y: 5 }];
  const all = [];
  for (let i = 0; i < base.length; i++) all.push({ x: i % 24, y: Math.floor(i / 24) });
  const map = { size: 24, rift: anchors[0], bastion: anchors[1], beacons: [anchors[2]], obstacles: [{ kind: 'crater', cells: all }] };
  const field = heightField(map, 'ANKER');
  for (const a of anchors) assert.equal(field[a.y * 24 + a.x], base[a.y * 24 + a.x]);
});

test('the majority filter leaves no single field among others of another level', () => {
  const size = 24;
  for (const seed of SEEDS) {
    const field = heightField(plain(size), seed);
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const here = field[y * size + x];
        let differ = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if ((dx || dy) && field[(y + dy) * size + x + dx] !== here) differ++;
          }
        }
        assert.ok(differ < 8, `${seed}: single field at ${x},${y}`);
      }
    }
  }
});

test('heightAt is exact in the middle of a field and continuous across a border', () => {
  const size = 4;
  const field = new Uint8Array(size * size);
  field[1 * size + 1] = 2;
  assert.equal(heightAt(field, size, 1.5, 1.5), 2 * STEP);
  assert.equal(heightAt(field, size, 2.5, 1.5), 0);
  const eps = 1e-9;
  assert.ok(Math.abs(heightAt(field, size, 2 - eps, 1.5) - heightAt(field, size, 2 + eps, 1.5)) < 1e-6);
  assert.ok(Math.abs(heightAt(field, size, 2, 1.5) - STEP) < 1e-6);
  // The blend reaches ENEMY_BLEND into each field and no further.
  assert.equal(heightAt(field, size, 2 - ENEMY_BLEND, 1.5), 2 * STEP);
  assert.equal(heightAt(field, size, 2 + ENEMY_BLEND, 1.5), 0);
  let last = Infinity;
  for (let x = 1.7; x <= 2.3; x += 0.01) {
    const h = heightAt(field, size, x, 1.5);
    assert.ok(h <= last + 1e-9);
    last = h;
  }
  assert.equal(heightAt(field, size, -3, -3), cellHeight(field, size, 0, 0));
});

test('ramps join consecutive route cells of different levels, on the lower field', () => {
  const size = 4;
  const field = new Uint8Array(size * size);
  field[2] = 1;
  field[3] = 1;
  const sections = [
    { key: 'a', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
    { key: 'b', a: { x: 1, y: 0 }, b: { x: 2, y: 0 } },
    { key: 'c', a: { x: 2, y: 0 }, b: { x: 3, y: 0 } },
  ];
  const ramps = rampsOf(sections, field);
  assert.equal(ramps.length, 1);
  assert.deepEqual({ x: ramps[0].x, y: ramps[0].y, dx: ramps[0].dx, dy: ramps[0].dy }, { x: 1, y: 0, dx: 1, dy: 0 });
  assert.equal(ramps[0].lowH, 0);
  assert.equal(ramps[0].hiH, STEP);
  const corners = rampCorners(ramps[0]);
  assert.equal(corners.filter((c) => c[2] === STEP).length, 2);
  assert.equal(corners.filter((c) => c[2] === 0).length, 2);
  // The two upper corners sit on the border of the step (x = 2).
  assert.ok(corners.filter((c) => c[2] === STEP).every((c) => Math.abs(c[0] - 2) < 1e-9));
  // Going down the same step gives the same ramp; a flat field has none.
  assert.equal(rampsOf([{ key: 'r', a: { x: 2, y: 0 }, b: { x: 1, y: 0 } }], field).length, 1);
  assert.deepEqual(rampsOf(sections, flatField(size)), []);
});

test('lift helpers read the active terrain and are flat without one', () => {
  setActiveTerrain(null);
  assert.equal(cellLift(3, 3), 0);
  assert.equal(liftAt(3.5, 3.5), 0);
  const field = new Uint8Array(16);
  field[5] = 2;
  setActiveTerrain(field);
  assert.equal(cellLift(1, 1), 2 * STEP);
  assert.equal(liftAt(1.5, 1.5), 2 * STEP);
  setActiveTerrain(null);
});
