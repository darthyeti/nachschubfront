// Tower fire: targeting, the damage matrix, warp shields and rewards.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGameState } from '../../src/core/state.js';
import { addTower, towerStats, towerCentre } from '../../src/sim/towers.js';
import { spawnEnemy, removeDead } from '../../src/sim/enemies.js';
import { updateCombat } from '../../src/sim/combat.js';
import { damageEnemy, healEnemy, updateShields } from '../../src/sim/damage.js';
import { bestTarget, canTarget, inRange, targetsInRange } from '../../src/sim/targeting.js';
import { createPolyline } from '../../src/sim/route.js';
import { DOCTRINES } from '../../src/data/doctrines.js';
import { rankStats } from '../../src/data/ranks.js';
import { WARP_SHIELD } from '../../src/data/combat.js';
import { SIM_STEP } from '../../src/data/settings.js';

/**
 * A wave-phase state on a straight route, so enemies can be placed exactly.
 * The route runs along y = 10 from x = 0 to x = 20.
 */
function battlefield(scale = 1) {
  const state = createGameState('COMBAT');
  const line = createPolyline([
    { x: 0.5, y: 10.5 },
    { x: 20.5, y: 10.5 },
  ]);
  state.phase = 'wave';
  state.waveRoutes = { ground: line, flyer: line };
  state.waveScale = scale;
  state.waveStats = { spawned: 0, leaked: 0, killed: 0, bossKills: 0 };
  state.enemies = [];
  state.towers = [];
  state.events = [];
  return state;
}

/** Puts an enemy `d` cells along the route. */
function put(state, type, d) {
  return spawnEnemy(state, type, { d });
}

test('a tower shoots the enemy that is furthest along the route', () => {
  const state = battlefield();
  const tower = addTower(state, { x: 5, y: 9, doctrine: 'autocannon', rank: 1 });
  const back = put(state, 'warrior', 4);
  const front = put(state, 'warrior', 6);
  const stats = towerStats(tower);
  assert.equal(bestTarget(state, tower, stats).id, front.id);
  updateCombat(state, SIM_STEP);
  assert.ok(front.health < front.maxHealth, 'the leading enemy is hit');
  assert.equal(back.health, back.maxHealth, 'the one behind is untouched');
});

test('range, dead zone and air targets are respected', () => {
  const state = battlefield();
  const mortar = addTower(state, { x: 5, y: 10, doctrine: 'mortar', rank: 1 });
  const stats = towerStats(mortar);
  const close = put(state, 'warrior', 5.4);
  const far = put(state, 'warrior', 14);
  const good = put(state, 'warrior', 9);
  assert.ok(!inRange(mortar, stats, close), 'inside the minimum range');
  assert.ok(!inRange(mortar, stats, far), 'beyond the range');
  assert.ok(inRange(mortar, stats, good));
  assert.equal(bestTarget(state, mortar, stats).id, good.id);

  const flyer = put(state, 'carrionflyer', 9.2);
  assert.ok(!canTarget(DOCTRINES.mortar, flyer), 'mortars cannot reach flyers');
  assert.equal(bestTarget(state, mortar, stats).id, good.id);
  const ac = addTower(state, { x: 8, y: 9, doctrine: 'autocannon', rank: 1 });
  assert.equal(bestTarget(state, ac, towerStats(ac)).id, flyer.id, 'autocannons take the flyer');
});

test('rank raises damage and range by the table', () => {
  const recruit = towerStats({ doctrine: 'laser', rank: 1 });
  const legend = towerStats({ doctrine: 'laser', rank: 5 });
  assert.equal(legend.damage, DOCTRINES.laser.damage * rankStats(5).damage);
  assert.equal(legend.range, DOCTRINES.laser.range * rankStats(5).range);
  assert.ok(legend.damage > recruit.damage && legend.range > recruit.range);
});

test('the damage matrix decides how much of a hit arrives', () => {
  const state = battlefield();
  const warrior = put(state, 'warrior', 1); // flesh
  // Damage is capped at what is left: this test is about the factors, not overkill.
  warrior.health = 1e6;
  const breaker = put(state, 'breaker', 1); // plate
  assert.equal(damageEnemy(warrior, 100, 'flame'), 150, 'flame burns flesh');
  assert.equal(damageEnemy(breaker, 100, 'flame'), 50, 'plate shrugs it off');
  const flyer = put(state, 'carrionflyer', 1);
  assert.equal(damageEnemy(flyer, 100, 'flame'), 0, 'flame cannot reach the air');
  assert.equal(flyer.health, flyer.maxHealth);
});

test('a warp shield takes the hit first and the rest carries on', () => {
  const state = battlefield();
  const seer = put(state, 'warpseer', 1);
  assert.equal(seer.shield, 60);
  // Psi triples against the shield: 10 damage take 30 off it.
  assert.equal(damageEnemy(seer, 10, 'psi'), 30);
  assert.equal(seer.shield, 30);
  // A hit that breaks the shield spends the rest on the flesh below.
  const dealt = damageEnemy(seer, 20, 'psi');
  assert.equal(seer.shield, 0);
  assert.equal(dealt, 30 + 10, 'the remaining 10 raw damage hit flesh at factor 1');
  assert.equal(seer.health, seer.maxHealth - 10);
});

test('a shield only regenerates after a quiet moment', () => {
  const state = battlefield();
  const seer = put(state, 'warpseer', 1);
  damageEnemy(seer, 10, 'psi');
  const hurt = seer.shield;
  updateShields(state, WARP_SHIELD.regenDelaySeconds - 0.1);
  assert.equal(seer.shield, hurt, 'still shaken');
  updateShields(state, 0.2);
  assert.ok(seer.shield > hurt, 'and then it grows back');
  updateShields(state, 100);
  assert.equal(seer.shield, seer.maxShield, 'never above the maximum');
});

test('wave scaling raises health and shield together', () => {
  const state = battlefield(4);
  const seer = put(state, 'warpseer', 1);
  assert.equal(seer.maxHealth, 60 * 4);
  assert.equal(seer.maxShield, 60 * 4);
  assert.equal(seer.shieldRegen, 10 * 4);
});

test('a kill pays its reward and is reported once', () => {
  const state = battlefield();
  const enemy = put(state, 'swarmer', 1);
  damageEnemy(enemy, 1000, 'laser');
  assert.ok(enemy.dead);
  assert.equal(state.enemies.length, 1, 'the dead are cleared in their own pass');
  removeDead(state);
  assert.equal(state.enemies.length, 0);
  assert.equal(state.requisition, 1);
  assert.equal(state.kills, 1);
  assert.equal(state.waveStats.killed, 1);
  assert.equal(state.events.filter((e) => e.type === 'kill').length, 1);
  removeDead(state);
  assert.equal(state.requisition, 1, 'and paid only once');
});

test('healing never goes above the maximum', () => {
  const state = battlefield();
  const enemy = put(state, 'warrior', 1);
  damageEnemy(enemy, 20, 'autocannon');
  assert.equal(healEnemy(enemy, 5), 5);
  assert.equal(healEnemy(enemy, 1000), 15);
  assert.equal(enemy.health, enemy.maxHealth);
});

test('a tower fires at its rate, not once per step', () => {
  const state = battlefield();
  const tower = addTower(state, { x: 5, y: 9, doctrine: 'autocannon', rank: 1 });
  const enemy = put(state, 'breaker', 5);
  enemy.health = 1e9;
  enemy.maxHealth = 1e9;
  for (let i = 0; i < 60; i++) updateCombat(state, SIM_STEP);
  const shots = state.events.filter((e) => e.type === 'shot').length;
  assert.equal(shots, DOCTRINES.autocannon.fire, 'five shots per second');
  assert.equal(tower.damage, shots * DOCTRINES.autocannon.damage * 0.75, 'plate takes three quarters');
});

test('a tower without a target keeps its shot ready', () => {
  const state = battlefield();
  const tower = addTower(state, { x: 5, y: 9, doctrine: 'laser', rank: 1 });
  for (let i = 0; i < 300; i++) updateCombat(state, SIM_STEP);
  assert.equal(state.events.length, 0);
  const enemy = put(state, 'warrior', 5);
  updateCombat(state, SIM_STEP);
  assert.ok(enemy.health < enemy.maxHealth, 'the first enemy in range is hit at once');
});

test('continuous weapons deal their damage per second', () => {
  const state = battlefield();
  const flame = addTower(state, { x: 5, y: 10, doctrine: 'flame', rank: 1 });
  const enemy = put(state, 'warrior', 5.5);
  enemy.health = 1e6;
  enemy.maxHealth = 1e6;
  for (let i = 0; i < 60; i++) updateCombat(state, SIM_STEP);
  const expected = DOCTRINES.flame.damage * 1.5; // one second against flesh
  assert.ok(Math.abs(flame.damage - expected) < 0.001, `${flame.damage} vs ${expected}`);
});

test('an aura hits everything it covers', () => {
  const state = battlefield();
  const psi = addTower(state, { x: 5, y: 10, doctrine: 'psi', rank: 1 });
  const a = put(state, 'warrior', 4);
  const b = put(state, 'warrior', 6);
  const out = put(state, 'warrior', 12);
  for (let i = 0; i < 60; i++) updateCombat(state, SIM_STEP);
  assert.ok(a.health < a.maxHealth && b.health < b.maxHealth, 'both inside the aura');
  assert.equal(out.health, out.maxHealth, 'the far one is spared');
  assert.equal(towerCentre(psi).x, 5.5);
});

test('targets in range come back with the leading enemy first', () => {
  const state = battlefield();
  const tower = addTower(state, { x: 5, y: 10, doctrine: 'tesla', rank: 1 });
  put(state, 'warrior', 4);
  put(state, 'warrior', 6);
  put(state, 'warrior', 5);
  const list = targetsInRange(state, tower, towerStats(tower));
  assert.deepEqual(list.map((e) => e.d), [6, 5, 4]);
});

test('the same situation always produces the same fight', () => {
  const run = () => {
    const state = battlefield();
    addTower(state, { x: 5, y: 9, doctrine: 'autocannon', rank: 2 });
    addTower(state, { x: 7, y: 11, doctrine: 'tesla', rank: 1 });
    for (let i = 0; i < 10; i++) put(state, i % 2 ? 'warrior' : 'swarmer', 2 + i * 0.4);
    for (let i = 0; i < 600; i++) {
      updateCombat(state, SIM_STEP);
      removeDead(state);
    }
    return JSON.stringify({ enemies: state.enemies, requisition: state.requisition });
  };
  assert.equal(run(), run());
});
