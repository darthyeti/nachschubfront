// What enemies do besides walking: healers, bursters and the boss abilities.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGameState } from '../../src/core/state.js';
import { spawnEnemy, removeDead, updateEnemies } from '../../src/sim/enemies.js';
import { updateAbilities } from '../../src/sim/abilities.js';
import { damageEnemy, updateShields } from '../../src/sim/damage.js';
import { createPolyline } from '../../src/sim/route.js';
import { ENEMIES, BOSSES } from '../../src/data/enemies.js';
import { SIM_STEP } from '../../src/data/settings.js';

function battlefield() {
  const state = createGameState('ABILITY');
  const line = createPolyline([
    { x: 0.5, y: 10.5 },
    { x: 40.5, y: 10.5 },
  ]);
  state.phase = 'wave';
  state.waveRoutes = { ground: line, flyer: line };
  state.waveStats = { spawned: 0, leaked: 0, killed: 0, bossKills: 0 };
  state.enemies = [];
  state.towers = [];
  state.events = [];
  return state;
}

const put = (state, type, d) => spawnEnemy(state, type, { d });

test('a healer mends the swarm around it but not itself', () => {
  const state = battlefield();
  const healer = put(state, 'healer', 5);
  const hurt = put(state, 'warrior', 5.3);
  const far = put(state, 'warrior', 9);
  damageEnemy(hurt, 30, 'autocannon');
  damageEnemy(far, 30, 'autocannon');
  damageEnemy(healer, 20, 'autocannon');
  const healerHealth = healer.health;
  const hurtHealth = hurt.health;
  updateAbilities(state, 1);
  assert.ok(hurt.health > hurtHealth, 'the neighbour is mended');
  assert.equal(hurt.health - hurtHealth, ENEMIES.healer.heal.perSecond, 'by 8 a second');
  assert.equal(far.health, far.maxHealth - 30, 'the far one is out of reach');
  assert.equal(healer.health, healerHealth, 'and it cannot mend itself');
});

test('healing never pushes an enemy over its maximum', () => {
  const state = battlefield();
  put(state, 'healer', 5);
  const friend = put(state, 'warrior', 5.2);
  damageEnemy(friend, 5, 'autocannon');
  updateAbilities(state, 10);
  assert.equal(friend.health, friend.maxHealth);
});

test('a burster releases four swarmers where it fell', () => {
  const state = battlefield();
  const burster = put(state, 'burster', 7);
  damageEnemy(burster, 1e6, 'laser');
  removeDead(state);
  assert.equal(state.enemies.length, ENEMIES.burster.death.count);
  for (const e of state.enemies) {
    assert.equal(e.type, 'swarmer');
    assert.ok(e.d <= 7 && e.d > 6, `spawned at ${e.d}`);
  }
  assert.equal(state.waveStats.spawned, 4, 'they count as spawned, so the wave waits for them');
});

test('a dying swarmer leaves nothing behind', () => {
  const state = battlefield();
  const swarmer = put(state, 'swarmer', 3);
  damageEnemy(swarmer, 1e6, 'laser');
  removeDead(state);
  assert.equal(state.enemies.length, 0);
});

test('the brood mother drops swarmers as she walks', () => {
  const state = battlefield();
  const boss = put(state, 'broodmother', 5);
  const { intervalSeconds, count } = BOSSES.broodmother.spawnTrail;
  updateAbilities(state, intervalSeconds - 0.1);
  assert.equal(state.enemies.length, 1, 'not yet');
  updateAbilities(state, 0.2);
  assert.equal(state.enemies.length, 1 + count);
  assert.ok(state.enemies.slice(1).every((e) => e.type === 'swarmer' && e.d < boss.d));
});

test('the warp herald jumps ahead along the route', () => {
  const state = battlefield();
  const boss = put(state, 'warpherald', 5);
  const { intervalSeconds, cells } = BOSSES.warpherald.warpJump;
  const before = boss.d;
  updateAbilities(state, intervalSeconds);
  assert.equal(boss.d, before + cells);
  assert.equal(boss.x, 0.5 + boss.d, 'and stands where it landed');
  assert.equal(state.events.filter((e) => e.type === 'warpJump').length, 1);
});

test('a jump never carries a boss past the bastion', () => {
  const state = battlefield();
  const boss = put(state, 'warpherald', 39.5);
  updateAbilities(state, BOSSES.warpherald.warpJump.intervalSeconds);
  assert.ok(boss.d < state.waveRoutes.ground.length, 'it still has to walk the last step');
});

test('the daemon prince keeps changing his armour', () => {
  const state = battlefield();
  const boss = put(state, 'daemonprince', 5);
  const { types, seconds } = BOSSES.daemonprince.armorCycle;
  assert.equal(boss.armor, types[0]);
  updateAbilities(state, seconds);
  assert.equal(boss.armor, types[1]);
  assert.equal(boss.armorBelow, types[1], 'he has no shield, so both layers change');
  updateAbilities(state, seconds);
  assert.equal(boss.armor, types[2]);
  updateAbilities(state, seconds);
  assert.equal(boss.armor, types[0], 'and round again');
});

test('the armour he wears decides how much a hit takes off', () => {
  const state = battlefield();
  const boss = put(state, 'daemonprince', 5);
  boss.health = 1e9;
  boss.maxHealth = 1e9;
  const flesh = damageEnemy(boss, 100, 'flame');
  updateAbilities(state, BOSSES.daemonprince.armorCycle.seconds);
  const plate = damageEnemy(boss, 100, 'flame');
  assert.ok(flesh > plate, `flesh ${flesh} vs plate ${plate}`);
});

test('the warp herald keeps his shield and gets it back', () => {
  const state = battlefield();
  const boss = put(state, 'warpherald', 5);
  assert.ok(boss.maxShield > 0);
  damageEnemy(boss, 100, 'autocannon');
  const hurt = boss.shield;
  updateShields(state, 10);
  assert.ok(boss.shield > hurt);
});

test('enemies without abilities are skipped outright', () => {
  const state = battlefield();
  const warrior = put(state, 'warrior', 5);
  assert.equal(warrior.hasAbility, false);
  assert.equal(put(state, 'healer', 5).hasAbility, true);
  assert.equal(put(state, 'broodmother', 5).hasAbility, true);
});

test('spawned swarmers walk the same route', () => {
  const state = battlefield();
  const burster = put(state, 'burster', 7);
  damageEnemy(burster, 1e6, 'laser');
  removeDead(state);
  const swarmer = state.enemies[0];
  const before = swarmer.d;
  updateEnemies(state, 1);
  assert.ok(swarmer.d > before);
  assert.equal(swarmer.y, 10.5);
});
