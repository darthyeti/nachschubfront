// Guards for the balancing tables from the GDD. They are data, so the tests check
// structure and totals instead of repeating every number.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DOCTRINES, DOCTRINE_IDS, DOCTRINE_COLORS } from '../../src/data/doctrines.js';
import { RANKS, MAX_RANK, MIN_RANK, isRank, rankStats } from '../../src/data/ranks.js';
import { SUPPLY_LEVELS, MAX_SUPPLY_LEVEL, supplyWeights, supplyCost } from '../../src/data/supply.js';
import { RECIPES, RECIPE_IDS, recipeById } from '../../src/data/recipes.js';
import { ENEMIES, ENEMY_IDS, BOSSES, BOSS_IDS, ALL_ENEMIES, enemyDef } from '../../src/data/enemies.js';
import { WAVES, waveScale } from '../../src/data/waves.js';
import { SPECIALS, specialDef } from '../../src/data/specials.js';
import { ARMOR_TYPES, DAMAGE_MATRIX, damageFactor } from '../../src/data/combat.js';
import { ECONOMY, waveBonus, rubbleCost } from '../../src/data/economy.js';
import { COMMANDS, COMMAND_IDS, commandById } from '../../src/data/commands.js';
import { STRINGS } from '../../src/data/strings.js';
import { APP_VERSION } from '../../src/data/version.js';
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
  assert.equal(COMMANDS.length, 5);
  assert.equal(new Set(COMMAND_IDS).size, COMMANDS.length, 'ids are unique');
  for (const c of COMMANDS) {
    assert.ok(c.cost > 0, c.id);
    assert.ok(c.fromWave > 0, c.id);
    assert.ok(c.cooldownWaves > 0, c.id);
    assert.ok(c.phase === 'wave' || c.phase === 'planning', `${c.id}: ${c.phase}`);
    assert.ok(['cell', 'none', 'line'].includes(c.target), `${c.id}: ${c.target}`);
    if (c.target === 'cell') assert.ok(c.radius > 0, c.id);
    if (c.target === 'line') {
      assert.ok(c.halfWidth > 0 && c.maxLength > c.halfWidth, c.id);
    }
    assert.equal(typeof STRINGS.commands[c.id]?.name, 'string', c.id);
    assert.equal(typeof STRINGS.commands[c.id]?.effect, 'string', c.id);
    assert.equal(commandById(c.id), c);
  }
  assert.deepEqual(Object.keys(STRINGS.commands), COMMAND_IDS);
  assert.equal(commandById('nope'), null);
  const waves = COMMANDS.map((c) => c.fromWave);
  assert.deepEqual(waves, [...waves].sort((a, b) => a - b), 'listed in unlock order');
  assert.ok(COMMANDS.find((c) => c.id === 'orbitalStrike').bossDamageFraction <= 0.25);
  // v3 raised both radii; the GDD names the new numbers.
  assert.equal(commandById('orbitalStrike').radius, 3);
  assert.equal(commandById('stasisField').radius, 2.5);
  // No command may take a boss out in one use (GDD section 9).
  for (const c of COMMANDS) {
    if (c.bossDamageFraction !== undefined) assert.ok(c.bossDamageFraction < 1, c.id);
  }
  assert.ok(commandById('airstrike').bossDamageFraction <= 0.3);
});

test('bosses have their own values, artwork and a name', () => {
  assert.equal(BOSS_IDS.length, 5);
  const waves = [];
  for (const id of BOSS_IDS) {
    const boss = BOSSES[id];
    assert.equal(boss.boss, true, id);
    assert.ok(ARMOR_TYPES.includes(boss.armor), `${id}: ${boss.armor}`);
    assert.ok(boss.health > ENEMIES.breaker.health * 5, `${id}: bosses outlast a breaker by far`);
    assert.ok(boss.speed > 0 && boss.speed <= 1, `${id}: bosses are slower than the swarm`);
    assert.ok(boss.reward > ENEMIES.breaker.reward, id);
    assert.ok(ENEMIES[boss.sprite], `${id}: borrows the artwork of a known enemy`);
    assert.ok(boss.scale > 1, `${id}: drawn larger`);
    assert.equal(typeof STRINGS.enemies[id], 'string', id);
    if (boss.spawnTrail) assert.ok(ENEMIES[boss.spawnTrail.type], id);
    if (boss.armorCycle) {
      for (const a of boss.armorCycle.types) assert.ok(ARMOR_TYPES.includes(a), `${id}: ${a}`);
      assert.ok(boss.armorCycle.seconds > 0, id);
    }
    waves.push(boss.wave);
  }
  assert.deepEqual(waves, [10, 20, 30, 40, 50], 'one boss every tenth wave');
  assert.deepEqual(Object.keys(STRINGS.enemies), [...ENEMY_IDS, ...BOSS_IDS]);
  assert.equal(enemyDef('broodmother'), BOSSES.broodmother);
});

test('the wave list covers 50 waves of known enemies', () => {
  assert.equal(WAVES.length, 50);
  for (const [i, wave] of WAVES.entries()) {
    const n = i + 1;
    assert.ok(wave.groups.length > 0, `wave ${n}`);
    assert.equal(typeof STRINGS.waveKinds[wave.kind], 'string', `wave ${n}: ${wave.kind}`);
    for (const g of wave.groups) {
      assert.ok(ALL_ENEMIES[g.type], `wave ${n}: ${g.type}`);
      assert.ok(g.count > 0, `wave ${n}: ${g.type}`);
      assert.ok(g.interval >= 0 && g.delay >= 0, `wave ${n}: ${g.type}`);
      if (ALL_ENEMIES[g.type].boss) assert.equal(g.count, 1, `wave ${n}: one boss at a time`);
    }
  }
});

test('the wave cycle and the boss waves follow the GDD', () => {
  const cycle = ['horde', 'armour', 'air', 'warp', 'mixed'];
  // The gentler start (GDD section 9) holds breakers back until wave 4 and
  // flyers until wave 6, so the cycle slots before that are called what is left
  // of them: a horde of warriors and swarmers.
  const eased = { 2: 'horde', 3: 'horde' };
  for (const [i, wave] of WAVES.entries()) {
    const n = i + 1;
    const expected = n % 10 === 0 ? 'boss' : eased[n] ?? cycle[(n - 1) % cycle.length];
    assert.equal(wave.kind, expected, `wave ${n}`);
    const bossGroup = wave.groups.find((g) => ALL_ENEMIES[g.type].boss);
    if (n % 10 === 0) {
      assert.ok(bossGroup, `wave ${n} has a boss`);
      assert.equal(BOSSES[bossGroup.type].wave, n, `wave ${n}: the right boss`);
      assert.ok(wave.groups.length > 1, `wave ${n}: the boss comes with an escort`);
    } else {
      assert.equal(bossGroup, undefined, `wave ${n} has no boss`);
    }
  }
});

test('the opening waves are eased in (GDD section 9)', () => {
  const total = (wave) => WAVES[wave - 1].groups.reduce((sum, g) => sum + g.count, 0);
  const types = (wave) => new Set(WAVES[wave - 1].groups.map((g) => g.type));

  // No armour before wave 4, no flyers before wave 6.
  for (let n = 1; n <= 3; n++) assert.ok(!types(n).has('breaker'), `wave ${n}: no breakers yet`);
  for (let n = 1; n <= 5; n++) assert.ok(!types(n).has('carrionflyer'), `wave ${n}: no flyers yet`);
  assert.ok(types(5).has('breaker'), 'breakers have arrived by wave 5');
  // Wave 8 is the first air slot after the flyers unlock at 6; waves 6 and 7
  // are a horde and an armour wave, neither of which fields flyers anyway.
  assert.ok(types(8).has('carrionflyer'), 'flyers are back in the air wave');

  // The first five waves are the thinned-out ones; wave 6 is back to full size.
  assert.ok(total(1) < total(6), `${total(1)} vs ${total(6)}`);

  // A locked lead enemy hands its share on, so no wave is a mere handful.
  for (let n = 1; n <= 5; n++) assert.ok(total(n) >= 8, `wave ${n} has only ${total(n)} enemies`);
});

test('health grows by 12 percent per wave and waves get bigger', () => {
  assert.equal(waveScale(1), 1);
  for (let n = 2; n <= WAVES.length; n++) {
    const grown = waveScale(n - 1) * 1.12;
    assert.ok(Math.abs(waveScale(n) - grown) < 0.01, `wave ${n}: ${waveScale(n)} vs ${grown}`);
  }
  assert.equal(waveScale(51), 1, 'outside the table nothing is scaled');
  const total = (wave) => WAVES[wave - 1].groups.reduce((sum, g) => sum + g.count, 0);
  // Same kind of wave, ten waves apart: the later one is the bigger one.
  for (const kind of [1, 2, 3, 4]) assert.ok(total(kind + 10) > total(kind), `wave ${kind + 10}`);
});

test('every recipe has a special tower whose values fit its ingredients', () => {
  assert.deepEqual(Object.keys(SPECIALS), RECIPE_IDS, 'one special per recipe, same order');
  const behaviours = new Set(['single', 'multi', 'beam', 'chain', 'mortar', 'cone', 'aura']);
  for (const recipe of RECIPES) {
    const def = specialDef(recipe.id);
    assert.equal(def.doctrine, recipe.ingredients[0], `${recipe.id}: the leading ingredient types it`);
    assert.ok(behaviours.has(def.behaviour), `${recipe.id}: ${def.behaviour}`);
    assert.ok(def.damage > 0 && def.range > 0, recipe.id);
    assert.ok(def.fire === 'aura' || def.fire > 0, recipe.id);
    for (const t of def.targets) assert.ok(t === 'ground' || t === 'air', `${recipe.id}: ${t}`);
    // A special must not shoot at armour it cannot hurt.
    if (def.targets.includes('air')) assert.ok(damageFactor(def.doctrine, 'flyer') > 0, recipe.id);
    if (def.behaviour === 'chain') assert.ok(def.chain.targets > 1, recipe.id);
    if (def.behaviour === 'multi') assert.ok(def.multiTargets > 1, recipe.id);
    if (def.behaviour === 'mortar') assert.ok(def.splashRadius > 0 && def.flightSeconds > 0, recipe.id);
  }
  assert.throws(() => specialDef('nope'));
});

test('a special tower beats the doctrine it is built from', () => {
  // Rough guard against a special that would not be worth three towers.
  const damagePerSecond = (def) => (def.fire === 'aura' ? def.damage : def.damage * def.fire);
  for (const recipe of RECIPES) {
    const def = specialDef(recipe.id);
    const plain = DOCTRINES[recipe.ingredients[0]];
    const plainDps = (plain.fire === 'aura' || plain.fire === 'stream' ? plain.damage : plain.damage * plain.fire)
      * RANKS[recipe.minRank - 1].damage;
    assert.ok(damagePerSecond(def) >= plainDps, `${recipe.id}: ${damagePerSecond(def)} vs ${plainDps}`);
  }
});

test('the version is one plain number triple, and the corner label shows it', () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(STRINGS.version(APP_VERSION), `v${APP_VERSION}`);
});
