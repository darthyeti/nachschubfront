// The info panel's content, checked without a browser.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGameState } from '../../src/core/state.js';
import { addTower } from '../../src/sim/towers.js';
import { spawnEnemy } from '../../src/sim/enemies.js';
import { damageEnemy } from '../../src/sim/damage.js';
import { applyBurn, applySlow } from '../../src/sim/effects.js';
import { createPolyline } from '../../src/sim/route.js';
import { describeCell, enemyOn, damagePerSecond } from '../../src/ui/info.js';
import { towerStats } from '../../src/sim/towers.js';
import { DOCTRINES } from '../../src/data/doctrines.js';
import { STRINGS } from '../../src/data/strings.js';

function world() {
  const state = createGameState('INFO');
  const line = createPolyline([
    { x: 0.5, y: 10.5 },
    { x: 20.5, y: 10.5 },
  ]);
  state.phase = 'wave';
  state.waveRoutes = { ground: line, flyer: line };
  state.waveStats = { spawned: 0, leaked: 0, killed: 0, bossKills: 0 };
  return state;
}

test('a tower shows what it does', () => {
  const state = world();
  const tower = addTower(state, { x: 4, y: 4, doctrine: 'laser', rank: 3 });
  tower.damage = 1234.6;
  const info = describeCell(state, { x: 4, y: 4 });
  assert.equal(info.kind, 'tower');
  assert.equal(info.title, 'Laser · Elite');
  const values = Object.fromEntries(info.lines);
  assert.equal(values[STRINGS.info.targets], STRINGS.info.groundAndAir);
  assert.equal(values[STRINGS.info.waveDamage], '1235');
  assert.equal(Number(values[STRINGS.info.damagePerSecond]), damagePerSecond(towerStats(tower)));
});

test('damage per second covers shots, streams and auras', () => {
  assert.equal(damagePerSecond(towerStats({ doctrine: 'autocannon', rank: 1 })), DOCTRINES.autocannon.damage * 5);
  assert.equal(damagePerSecond(towerStats({ doctrine: 'flame', rank: 1 })), DOCTRINES.flame.damage);
  assert.equal(damagePerSecond(towerStats({ doctrine: 'psi', rank: 1 })), DOCTRINES.psi.damage);
});

test('a special tower is named after its recipe', () => {
  const state = world();
  addTower(state, { x: 5, y: 5, doctrine: 'tesla', rank: null, special: 'thunderTower' });
  const info = describeCell(state, { x: 5, y: 5 });
  assert.equal(info.title, STRINGS.recipes.thunderTower.name);
  assert.equal(info.subtitle, STRINGS.info.special);
});

test('an enemy shows health, armour and what ails it', () => {
  const state = world();
  const enemy = spawnEnemy(state, 'warpseer', { d: 5 });
  damageEnemy(enemy, 5, 'autocannon');
  applyBurn(state, enemy, { damagePerSecond: 6, seconds: 3 }, 'flame', null);
  applySlow(state, enemy, 0.3);
  const info = describeCell(state, { x: 5, y: 10 });
  assert.equal(info.kind, 'enemy');
  assert.equal(info.title, STRINGS.enemies.warpseer);
  const values = Object.fromEntries(info.lines);
  assert.ok(values[STRINGS.info.shield], 'a warp seer shows its shield');
  assert.equal(values[STRINGS.info.armor], STRINGS.armor.warpshield);
  assert.match(values[STRINGS.info.status], /brennt/);
  assert.match(values[STRINGS.info.status], /verlangsamt/);
});

test('a boss says that it is one', () => {
  const state = world();
  spawnEnemy(state, 'broodmother', { d: 3 });
  assert.equal(describeCell(state, { x: 3, y: 10 }).subtitle, STRINGS.info.boss);
});

test('the enemy on a cell is the one closest to its middle', () => {
  const state = world();
  const near = spawnEnemy(state, 'warrior', { d: 6.1 });
  spawnEnemy(state, 'warrior', { d: 6.4 });
  assert.equal(enemyOn(state, { x: 6, y: 10 }).id, near.id);
  assert.equal(enemyOn(state, { x: 15, y: 10 }), null);
});

test('an empty cell still says where it is and whether it is walkable', () => {
  const state = world();
  const info = describeCell(state, state.map.rift);
  assert.equal(info.title, STRINGS.info.terrainNames.rift);
  assert.equal(describeCell(state, { x: -1, y: 0 }), null);
  assert.equal(describeCell(state, null), null);
});

test('enemies come before towers, towers before the ground', () => {
  const state = world();
  addTower(state, { x: 7, y: 10, doctrine: 'psi', rank: 1 });
  assert.equal(describeCell(state, { x: 7, y: 10 }).kind, 'tower');
  spawnEnemy(state, 'swarmer', { d: 7 });
  assert.equal(describeCell(state, { x: 7, y: 10 }).kind, 'enemy');
});
