import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIOME_IDS, PALETTES, biomeOf, paletteOf } from '../../src/render/biomes.js';

test('the biome of a seed is fixed across versions', () => {
  assert.equal(biomeOf('BASTION'), 'toxic');
  assert.equal(biomeOf('AMBOSS'), 'ash');
  assert.equal(biomeOf('OFFLINE'), 'ash');
  assert.equal(biomeOf('GALLERY'), 'toxic');
  assert.equal(biomeOf('C3'), 'rust');
});

test('every palette has every key, in the same shape', () => {
  const shape = { ground: 3, cliff: 3, stone: 3, slab: 2 };
  for (const id of BIOME_IDS) {
    const p = paletteOf(id);
    assert.equal(p, PALETTES[id]);
    for (const [key, n] of Object.entries(shape)) assert.equal(p[key].length, n, `${id}.${key}`);
    for (const key of ['path', 'pathEdge', 'decor', 'pit']) assert.match(p[key], /^#[0-9a-f]{6}$/, `${id}.${key}`);
  }
  assert.deepEqual(Object.keys(PALETTES.ash).sort(), Object.keys(PALETTES.toxic).sort());
  assert.deepEqual(Object.keys(PALETTES.rust).sort(), Object.keys(PALETTES.toxic).sort());
});

test('an unknown biome falls back to ash', () => {
  assert.equal(paletteOf('nope'), PALETTES.ash);
});
