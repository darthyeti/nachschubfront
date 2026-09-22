// Guards for the balancing tables from the GDD. They are data, so the tests check
// structure and totals instead of repeating every number.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DOCTRINES, DOCTRINE_IDS, DOCTRINE_COLORS } from '../../src/data/doctrines.js';
import { RANKS, MAX_RANK, MIN_RANK, isRank, rankStats } from '../../src/data/ranks.js';
import { SUPPLY_LEVELS, MAX_SUPPLY_LEVEL, supplyWeights, supplyCost } from '../../src/data/supply.js';
import { RECIPES, RECIPE_IDS, recipeById } from '../../src/data/recipes.js';
import { STRINGS } from '../../src/data/strings.js';
import { DOCTRINE_SYMBOLS, RANK_COUNT } from '../../src/render/sprites/manifest.js';

test('six doctrines with colour, range, damage and targets', () => {
  assert.equal(DOCTRINE_IDS.length, 6);
  for (const id of DOCTRINE_IDS) {
    const d = DOCTRINES[id];
    assert.match(d.color, /^#[0-9a-f]{6}$/, id);
    assert.ok(d.damage > 0, id);
    assert.ok(d.range > 0, id);
    assert.ok(d.targets.includes('ground') || d.targets.includes('air'), id);
    for (const t of d.targets) assert.ok(t === 'ground' || t === 'air', `${id}: ${t}`);
    assert.ok(d.fire === 'stream' || d.fire === 'aura' || d.fire > 0, id);
  }
  assert.ok(DOCTRINES.mortar.minRange < DOCTRINES.mortar.range);
});

test('every doctrine has a name, a guide colour and a sprite symbol', () => {
  for (const id of DOCTRINE_IDS) {
    assert.equal(typeof STRINGS.doctrines[id], 'string', id);
    assert.equal(DOCTRINE_COLORS[id], DOCTRINES[id].color, id);
    assert.equal(typeof DOCTRINE_SYMBOLS[id], 'string', id);
  }
  assert.deepEqual(Object.keys(DOCTRINE_SYMBOLS), DOCTRINE_IDS);
});

test('five ranks, rising damage and range, all named', () => {
  assert.equal(MAX_RANK, 5);
  assert.equal(RANK_COUNT, MAX_RANK, 'sprite manifest and data must agree');
  assert.deepEqual(RANKS.map((r) => r.damage), [1, 2.2, 5, 12, 30]);
  for (let rank = MIN_RANK + 1; rank <= MAX_RANK; rank++) {
    assert.ok(rankStats(rank).damage > rankStats(rank - 1).damage, `damage ${rank}`);
    assert.ok(rankStats(rank).range > rankStats(rank - 1).range, `range ${rank}`);
  }
  for (let rank = MIN_RANK; rank <= MAX_RANK; rank++) {
    assert.equal(typeof STRINGS.ranks[rank], 'string', `name ${rank}`);
  }
});

test('rank bounds are checked', () => {
  assert.ok(isRank(1) && isRank(5));
  assert.ok(!isRank(0) && !isRank(6) && !isRank(1.5) && !isRank('2'));
  assert.throws(() => rankStats(0), RangeError);
  assert.throws(() => rankStats(6), RangeError);
});

test('every supply level has one weight per rank and sums to 100 percent', () => {
  assert.equal(MAX_SUPPLY_LEVEL, 8);
  SUPPLY_LEVELS.forEach((entry, i) => {
    assert.equal(entry.level, i + 1);
    assert.equal(entry.weights.length, MAX_RANK, `level ${entry.level}`);
    for (const w of entry.weights) assert.ok(w >= 0, `level ${entry.level}`);
    const sum = entry.weights.reduce((a, b) => a + b, 0);
    assert.equal(sum, 100, `level ${entry.level} sums to ${sum}`);
  });
});

test('supply levels get more expensive and shift weight to higher ranks', () => {
  for (let level = 2; level < MAX_SUPPLY_LEVEL; level++) {
    assert.ok(supplyCost(level) > supplyCost(level - 1), `cost ${level}`);
  }
  assert.equal(supplyCost(MAX_SUPPLY_LEVEL), null);
  const recruitShare = (level) => supplyWeights(level)[0];
  for (let level = 2; level <= MAX_SUPPLY_LEVEL; level++) {
    assert.ok(recruitShare(level) < recruitShare(level - 1), `recruit share ${level}`);
  }
  assert.throws(() => supplyWeights(0), RangeError);
  assert.throws(() => supplyWeights(MAX_SUPPLY_LEVEL + 1), RangeError);
});

test('recipes use three different known doctrines at a valid minimum rank', () => {
  assert.equal(RECIPES.length, 6);
  assert.equal(new Set(RECIPE_IDS).size, RECIPES.length, 'ids are unique');
  const seen = new Set();
  for (const recipe of RECIPES) {
    assert.equal(recipe.ingredients.length, 3, recipe.id);
    assert.equal(new Set(recipe.ingredients).size, 3, `${recipe.id}: ingredients differ`);
    for (const id of recipe.ingredients) assert.ok(DOCTRINES[id], `${recipe.id}: ${id}`);
    assert.ok(isRank(recipe.minRank), recipe.id);
    // Two recipes with the same set of ingredients could never be told apart.
    const key = [...recipe.ingredients].sort().join('+');
    assert.ok(!seen.has(key), `${recipe.id}: same ingredients as another recipe`);
    seen.add(key);
    assert.equal(recipeById(recipe.id), recipe);
  }
  assert.equal(recipeById('nope'), null);
});

test('every recipe has a name and an effect text', () => {
  for (const { id } of RECIPES) {
    assert.equal(typeof STRINGS.recipes[id]?.name, 'string', id);
    assert.equal(typeof STRINGS.recipes[id]?.effect, 'string', id);
  }
  assert.deepEqual(Object.keys(STRINGS.recipes), RECIPE_IDS);
});
