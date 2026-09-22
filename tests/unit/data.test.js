// Guards for the balancing tables from the GDD. They are data, so the tests check
// structure and totals instead of repeating every number.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DOCTRINES, DOCTRINE_IDS, DOCTRINE_COLORS } from '../../src/data/doctrines.js';
import { RANKS, MAX_RANK, MIN_RANK, isRank, rankStats } from '../../src/data/ranks.js';
import { SUPPLY_LEVELS, MAX_SUPPLY_LEVEL, supplyWeights, supplyCost } from '../../src/data/supply.js';
import { RECIPES, RECIPE_IDS, recipeById } from '../../src/data/recipes.js';
import { ENEMIES, ENEMY_IDS, enemyDef } from '../../src/data/enemies.js';
import { ARMOR_TYPES, DAMAGE_MATRIX, damageFactor } from '../../src/data/combat.js';
import { ECONOMY, waveBonus, rubbleCost } from '../../src/data/economy.js';
import { COMMANDS, COMMAND_IDS, commandById } from '../../src/data/commands.js';
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

test('the damage matrix covers every doctrine and armour type', () => {
  assert.equal(ARMOR_TYPES.length, 4);
  assert.deepEqual(Object.keys(DAMAGE_MATRIX), DOCTRINE_IDS);
  for (const id of DOCTRINE_IDS) {
    assert.deepEqual(Object.keys(DAMAGE_MATRIX[id]), ARMOR_TYPES, id);
    for (const armor of ARMOR_TYPES) assert.ok(damageFactor(id, armor) >= 0, `${id}/${armor}`);
  }
  // A doctrine that cannot hurt an armour must not target it either, otherwise
  // towers would pick targets they can never kill.
  for (const id of DOCTRINE_IDS) {
    if (damageFactor(id, 'flyer') === 0) assert.ok(!DOCTRINES[id].targets.includes('air'), id);
  }
  assert.equal(damageFactor('psi', 'warpshield'), 3, 'psi triples against shields');
  assert.throws(() => damageFactor('nope', 'flesh'));
  assert.throws(() => damageFactor('psi', 'nope'));
});

test('every armour type has a name', () => {
  for (const armor of ARMOR_TYPES) assert.equal(typeof STRINGS.armor[armor], 'string', armor);
  assert.deepEqual(Object.keys(STRINGS.armor), ARMOR_TYPES);
});

test('enemy types have health, speed, reward, a known armour and a name', () => {
  assert.equal(ENEMY_IDS.length, 7);
  for (const id of ENEMY_IDS) {
    const def = ENEMIES[id];
    assert.ok(def.health > 0, id);
    assert.ok(def.speed > 0, id);
    assert.ok(def.reward > 0, id);
    assert.ok(ARMOR_TYPES.includes(def.armor), `${id}: ${def.armor}`);
    assert.equal(typeof def.flying, 'boolean', id);
    assert.equal(def.flying, def.armor === 'flyer', `${id}: flyers and the flyer armour go together`);
    assert.equal(typeof STRINGS.enemies[id], 'string', id);
    assert.equal(enemyDef(id), def);
  }
  assert.throws(() => enemyDef('nope'));
});

test('enemy specials follow the GDD', () => {
  const seer = ENEMIES.warpseer;
  assert.ok(seer.shield > 0 && seer.shieldRegen > 0);
  assert.ok(ARMOR_TYPES.includes(seer.armorBelow), 'the shield covers a normal armour');
  assert.ok(ENEMIES.burster.death.count > 0);
  assert.ok(ENEMIES[ENEMIES.burster.death.type], 'bursters release a known enemy');
  assert.ok(ENEMIES.healer.heal.perSecond > 0 && ENEMIES.healer.heal.radius > 0);
  // Only warp shields carry a shield pool; anything else would need its own rules.
  for (const id of ENEMY_IDS) {
    if (ENEMIES[id].shield) assert.equal(ENEMIES[id].armor, 'warpshield', id);
  }
});

test('economy values grow the way the GDD describes', () => {
  assert.equal(waveBonus(1), 11);
  assert.equal(waveBonus(50), 60);
  assert.equal(rubbleCost(0), ECONOMY.rubbleCost);
  assert.equal(rubbleCost(3) - rubbleCost(2), ECONOMY.rubbleCostStep);
  assert.ok(ECONOMY.pointsPerBoss > ECONOMY.pointsPerCleanWave);
});

test('special commands unlock in order and have costs, cooldowns and texts', () => {
  assert.equal(COMMANDS.length, 4);
  assert.equal(new Set(COMMAND_IDS).size, COMMANDS.length, 'ids are unique');
  for (const c of COMMANDS) {
    assert.ok(c.cost > 0, c.id);
    assert.ok(c.fromWave > 0, c.id);
    assert.ok(c.cooldownWaves > 0, c.id);
    assert.ok(c.phase === 'wave' || c.phase === 'planning', `${c.id}: ${c.phase}`);
    assert.ok(c.target === 'cell' || c.target === 'none', `${c.id}: ${c.target}`);
    if (c.target === 'cell') assert.ok(c.radius > 0, c.id);
    assert.equal(typeof STRINGS.commands[c.id]?.name, 'string', c.id);
    assert.equal(typeof STRINGS.commands[c.id]?.effect, 'string', c.id);
    assert.equal(commandById(c.id), c);
  }
  assert.deepEqual(Object.keys(STRINGS.commands), COMMAND_IDS);
  assert.equal(commandById('nope'), null);
  const waves = COMMANDS.map((c) => c.fromWave);
  assert.deepEqual(waves, [...waves].sort((a, b) => a - b), 'listed in unlock order');
  assert.ok(COMMANDS.find((c) => c.id === 'orbitalStrike').bossDamageFraction <= 0.25);
});
