import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kitVariant, kitShadow, KIT_VARIANTS } from '../../src/render/rubbleKit.js';
import { obstacleShadow } from '../../src/render/objects.js';
import { generateMap } from '../../src/sim/mapgen.js';
import { createRng } from '../../src/core/random.js';

const gen = (seed) => generateMap(createRng(seed).fork('map'));

test('the kit variant is a pure function of position and variant, in range', () => {
  assert.equal(kitVariant(5, 9, 2), kitVariant(5, 9, 2));
  for (let x = 0; x < 24; x++) {
    for (let y = 0; y < 24; y++) {
      for (let v = 0; v < 4; v++) {
        const k = kitVariant(x, y, v);
        assert.ok(Number.isInteger(k) && k >= 0 && k < KIT_VARIANTS);
      }
    }
  }
});

test('all eight kit variants occur on a 24 x 24 map, and neighbours differ', () => {
  const seen = new Set();
  let differing = 0;
  let pairs = 0;
  for (let x = 0; x < 24; x++) {
    for (let y = 0; y < 24; y++) {
      seen.add(kitVariant(x, y, (x * 7 + y * 3) % 4));
      if (x < 23) {
        pairs++;
        if (kitVariant(x, y, 1) !== kitVariant(x + 1, y, 1)) differing++;
      }
    }
  }
  assert.equal(seen.size, KIT_VARIANTS);
  // The same simulation variant on neighbouring fields: most pairs look different.
  assert.ok(differing / pairs > 0.7, `${differing}/${pairs}`);
});

test('kit shadows: ruins and walls name bodies, a crater none, capsule remains one flat body', () => {
  for (let v = 0; v < 4; v++) {
    for (let x = 0; x < 6; x++) {
      const ob = (kind, n = 1) => ({ kind, variant: v, cells: Array.from({ length: n }, (_, i) => ({ x: x + i, y: 3 })) });
      for (const kind of ['ruin', 'wall']) {
        for (let i = 0; i < 3; i++) {
          const bodies = kitShadow(ob(kind, 3), i);
          assert.ok(bodies.length >= 1 && bodies.every((b) => b.height > 0 && b.footprint.length === 4), kind);
        }
      }
      assert.equal(kitShadow(ob('crater'), 0).length, 0);
      const cap = kitShadow(ob('rubble'), 0);
      assert.equal(cap.length, 1);
      assert.ok(cap[0].height <= 12, 'flat');
    }
  }
  const bulwark = { kind: 'bulwark', variant: 0, cells: [{ x: 4, y: 4 }] };
  assert.ok(obstacleShadow(bulwark, 0)[0].height > 12, 'the bulwark stands taller than any capsule remains');
});

test('the kit reads the map only: the generated obstacles stay as drawn by the generator', () => {
  const a = gen('RUBBLE');
  const before = JSON.stringify(a.obstacles);
  for (const o of a.obstacles) o.cells.forEach((_, i) => kitShadow(o, i));
  assert.equal(JSON.stringify(a.obstacles), before);
  assert.equal(JSON.stringify(gen('RUBBLE').obstacles), before);
  assert.ok(a.obstacles.every((o) => o.variant >= 0 && o.variant <= 3));
});
