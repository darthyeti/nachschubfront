// Special commands: unlocking, cost, cooldown and effect.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGameState } from '../../src/core/state.js';
import { spawnEnemy, removeDead } from '../../src/sim/enemies.js';
import { addTower, towerStats } from '../../src/sim/towers.js';
import { updateCombat } from '../../src/sim/combat.js';
import {
  canUseCommand,
  useCommand,
  updateCommands,
  commandStatus,
  currentWave,
  bannerBonus,
  takeSupplyBonus,
} from '../../src/sim/commands.js';
import { createPods } from '../../src/sim/pods.js';
import { beginWave } from '../../src/sim/waves.js';
import { createPolyline } from '../../src/sim/route.js';
import { commandById } from '../../src/data/commands.js';
import { commandNote } from '../../src/ui/commands.js';
import { MAX_RANK } from '../../src/data/ranks.js';
import { SIM_STEP } from '../../src/data/settings.js';

function battlefield(wave = 30) {
  const state = createGameState('COMMAND');
  const line = createPolyline([
    { x: 0.5, y: 10.5 },
    { x: 20.5, y: 10.5 },
  ]);
  state.phase = 'wave';
  state.wave = wave;
  state.waveRoutes = { ground: line, flyer: line };
  state.waveStats = { spawned: 0, leaked: 0, killed: 0, bossKills: 0 };
  state.commandPoints = 20;
  state.enemies = [];
  state.towers = [];
  state.events = [];
  return state;
}

const put = (state, type, d) => spawnEnemy(state, type, { d });

test('a command is locked until its wave, then costs points', () => {
  const state = battlefield(14);
  assert.equal(canUseCommand(state, 'orbitalStrike', { x: 5, y: 10 }).reason, 'locked');
  state.wave = 15;
  assert.equal(commandStatus(state, 'orbitalStrike').unlocked, true);
  state.commandPoints = 1;
  assert.equal(canUseCommand(state, 'orbitalStrike', { x: 5, y: 10 }).reason, 'points');
  state.commandPoints = 4;
  assert.ok(canUseCommand(state, 'orbitalStrike', { x: 5, y: 10 }).ok);
});

test('using a command spends points and starts its cooldown', () => {
  const state = battlefield(15);
  const command = commandById('orbitalStrike');
  assert.ok(useCommand(state, 'orbitalStrike', { x: 5, y: 10 }).ok);
  assert.equal(state.commandPoints, 20 - command.cost);
  assert.equal(canUseCommand(state, 'orbitalStrike', { x: 6, y: 10 }).reason, 'cooldown');
  state.wave = 15 + command.cooldownWaves - 1;
  assert.equal(commandStatus(state, 'orbitalStrike').wavesLeft, 1);
  state.wave = 15 + command.cooldownWaves;
  assert.ok(canUseCommand(state, 'orbitalStrike', { x: 6, y: 10 }).ok);
});

test('the orbital strike warns first, then clears the area', () => {
  const state = battlefield(15);
  const command = commandById('orbitalStrike');
  const inside = put(state, 'warrior', 5);
  const outside = put(state, 'warrior', 12);
  useCommand(state, 'orbitalStrike', { x: 5, y: 10 });
  assert.equal(state.pendingStrikes.length, 1);
  updateCommands(state, command.warnSeconds - 0.1);
  assert.equal(inside.health, inside.maxHealth, 'nothing happens during the warning');
  updateCommands(state, 0.2);
  assert.equal(state.pendingStrikes.length, 0);
  assert.ok(inside.dead, 'a normal enemy is wiped out');
  assert.equal(outside.health, outside.maxHealth);
});

test('a boss loses at most a quarter of its bar to one strike', () => {
  const state = battlefield(15);
  const boss = put(state, 'colossusbreaker', 5);
  useCommand(state, 'orbitalStrike', { x: 5, y: 10 });
  updateCommands(state, commandById('orbitalStrike').warnSeconds);
  const lost = (boss.maxHealth - boss.health) / boss.maxHealth;
  assert.ok(Math.abs(lost - 0.25) < 1e-6, `lost ${lost}`);
  assert.ok(!boss.dead);
});

test('the stasis field freezes at once, bosses for less', () => {
  const state = battlefield(20);
  const command = commandById('stasisField');
  const enemy = put(state, 'warrior', 5);
  const boss = put(state, 'colossusbreaker', 5.2);
  assert.ok(useCommand(state, 'stasisField', { x: 5, y: 10 }).ok);
  assert.equal(enemy.stunUntil - state.time, command.seconds);
  assert.equal(boss.stunUntil - state.time, command.bossSeconds);
});

test('the holy banner makes the towers under it hit harder', () => {
  const state = battlefield(30);
  const near = addTower(state, { x: 5, y: 10, doctrine: 'autocannon', rank: 1 });
  const far = addTower(state, { x: 15, y: 10, doctrine: 'autocannon', rank: 1 });
  assert.equal(bannerBonus(state, near), 1, 'nothing without a banner');
  assert.ok(useCommand(state, 'holyBanner', { x: 5, y: 10 }).ok);
  assert.equal(bannerBonus(state, near), 1 + commandById('holyBanner').damageBonus);
  assert.equal(bannerBonus(state, far), 1, 'out of its reach');

  const a = put(state, 'breaker', 5);
  const b = put(state, 'breaker', 15);
  a.health = 1e6;
  a.maxHealth = 1e6;
  b.health = 1e6;
  b.maxHealth = 1e6;
  for (let i = 0; i < 60; i++) updateCombat(state, SIM_STEP);
  assert.ok(near.damage > far.damage * 1.4, `${near.damage} vs ${far.damage}`);
});

test('priority supply raises the next salvo by one rank, once', () => {
  const state = createGameState('PRIORITY');
  state.wave = 25;
  state.commandPoints = 10;
  assert.equal(canUseCommand(state, 'prioritySupply').ok, true, 'planning only, and we are planning');
  state.phase = 'wave';
  assert.equal(canUseCommand(state, 'prioritySupply').reason, 'phase');
  state.phase = 'planning';
  assert.ok(useCommand(state, 'prioritySupply').ok);
  assert.equal(state.supplyBonus, 1);

  state.supplyLevel = 3;
  state.zones = [{ x: 3, y: 3 }, { x: 4, y: 4 }];
  const raised = createPods(state).map((p) => p.rank);
  assert.equal(state.supplyBonus, 0, 'spent on that salvo');
  state.zones = [{ x: 3, y: 3 }, { x: 4, y: 4 }];
  const plain = createPods(state).map((p) => p.rank);
  assert.deepEqual(raised, plain.map((r) => Math.min(MAX_RANK, r + 1)));
});

test('the rank bonus never pushes a pod past legend', () => {
  const state = createGameState('PRIORITY');
  state.supplyBonus = 9;
  assert.equal(takeSupplyBonus(state), MAX_RANK - 1, 'four ranks is all a recruit can climb');
  assert.equal(state.supplyBonus, 0);

  state.supplyBonus = 4;
  state.supplyLevel = 1;
  state.zones = [{ x: 3, y: 3 }];
  assert.equal(createPods(state)[0].rank, MAX_RANK);
});

test('banners and strikes do not survive into the next wave', () => {
  const state = battlefield(30);
  useCommand(state, 'holyBanner', { x: 5, y: 10 });
  state.commandUses = {};
  useCommand(state, 'orbitalStrike', { x: 5, y: 10 });
  assert.equal(state.banners.length, 1);
  assert.equal(state.pendingStrikes.length, 1);
  state.phase = 'planning';
  state.wave = 0;
  // The next wave clears them.
  beginWave(state);
  assert.equal(state.banners.length, 0);
  assert.equal(state.pendingStrikes.length, 0);
});

test('the bar tells the player what stands in the way', () => {
  const state = createGameState('BAR');
  state.wave = 5;
  assert.equal(commandNote(commandStatus(state, 'orbitalStrike')), 'ab Welle 15');
  state.wave = 20;
  state.commandPoints = 0;
  assert.equal(commandNote(commandStatus(state, 'orbitalStrike')), '4 KP');
  state.commandPoints = 10;
  state.phase = 'wave';
  useCommand(state, 'orbitalStrike', { x: 5, y: 5 });
  assert.equal(commandNote(commandStatus(state, 'orbitalStrike')), 'noch 3 Wellen');
  state.wave = 22;
  assert.equal(commandNote(commandStatus(state, 'orbitalStrike')), 'noch 1 Welle');
});

test('during planning a command counts against the wave to come', () => {
  const state = createGameState('BAR');
  state.wave = 24;
  state.phase = 'planning';
  state.commandPoints = 10;
  assert.equal(currentWave(state), 25, 'the salvo prepares wave 25');
  assert.ok(canUseCommand(state, 'prioritySupply').ok, 'so priority supply is in reach');
});
