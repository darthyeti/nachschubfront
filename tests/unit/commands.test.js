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
  supplyRankBonus,
  clampLine,
  snapToAxis,
} from '../../src/sim/commands.js';
import { distanceToSegment2 } from '../../src/sim/targeting.js';
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

// ---------- Luftschlag (GDD section 11, v3) ----------

/** Runs the pending strikes until the one just ordered has gone off. */
function runWarning(state, seconds) {
  for (let t = 0; t < seconds + SIM_STEP; t += SIM_STEP) updateCommands(state, SIM_STEP);
}

/** Runs an airstrike out: the warning, then the whole run of the gunship. */
function flyStrike(state) {
  const command = commandById('airstrike');
  runWarning(state, command.warnSeconds + command.runSeconds);
}

test('the airstrike needs a line, not a cell', () => {
  const state = battlefield(30);
  assert.equal(canUseCommand(state, 'airstrike', { x: 5, y: 10 }).reason, 'outside', 'a single cell is not a line');
  assert.equal(canUseCommand(state, 'airstrike', null).reason, 'outside');
  assert.equal(canUseCommand(state, 'airstrike', { from: { x: 2, y: 10 }, to: { x: -1, y: 10 } }).reason, 'outside');
  assert.ok(canUseCommand(state, 'airstrike', { from: { x: 2, y: 10 }, to: { x: 9, y: 10 } }).ok);
  assert.equal(canUseCommand(state, 'airstrike', { from: { x: 2, y: 10 }, to: { x: 9, y: 10 } }).ok, true);
});

test('the airstrike hits along the whole strip and misses what is beside it', () => {
  const state = battlefield(30);
  const command = commandById('airstrike');
  // Three enemies on the line, one well clear of it.
  // All three within the command's maximum run, which the strike clamps to.
  const near = [put(state, 'warrior', 2), put(state, 'warrior', 6), put(state, 'warrior', 10)];
  const far = put(state, 'warrior', 8);
  far.y += command.halfWidth + 1.5;
  const health = near.map((e) => e.health);

  assert.ok(useCommand(state, 'airstrike', { from: { x: 1, y: 10 }, to: { x: 15, y: 10 } }).ok);
  assert.equal(state.enemies.every((e) => e.health === e.maxHealth || e === far), true, 'nothing happens yet');
  // Halfway through the warning the line is drawn and nothing has been hit yet.
  runWarning(state, command.warnSeconds / 2);
  assert.equal(
    state.enemies.every((e) => e.health === e.maxHealth || e === far),
    true,
    'the warning is a warning, not damage',
  );
  flyStrike(state);

  near.forEach((e, i) => assert.ok(e.health < health[i] || e.dead, `enemy ${i} was hit`));
  assert.equal(far.health, far.maxHealth, 'the one beside the strip is untouched');
});

test('the line snaps onto an axis, because the gunship flies one', () => {
  const from = { x: 4, y: 4 };
  // Mostly sideways: the end is pulled onto the row of the start.
  assert.deepEqual(snapToAxis(from, { x: 12, y: 7 }), { x: 12, y: 4 });
  // Mostly up or down: onto its column.
  assert.deepEqual(snapToAxis(from, { x: 7, y: 12 }), { x: 4, y: 12 });
  // Exactly diagonal: the row, so the choice is never undecided.
  assert.deepEqual(snapToAxis(from, { x: 9, y: 9 }), { x: 9, y: 4 });

  const state = battlefield(30);
  // An enemy on the row of the start, well off the line the player drew.
  const online = put(state, 'warrior', 8);
  assert.ok(useCommand(state, 'airstrike', { from: { x: 1, y: 10 }, to: { x: 11, y: 14 } }).ok);
  const [hit] = state.pendingStrikes;
  assert.equal(hit.from.y, hit.to.y, 'the run is one row');
  assert.equal(hit.drops.length, commandById('airstrike').bombs, 'eight bombs');
  flyStrike(state);
  assert.ok(online.health < online.maxHealth, 'and it flew over the row, not the diagonal');
});

test('the airstrike hits plate harder, and can never finish a boss in one go', () => {
  const command = commandById('airstrike');
  const state = battlefield(30);
  const flesh = put(state, 'warrior', 6);
  const plate = put(state, 'breaker', 8);
  const boss = put(state, 'colossusbreaker', 10);
  assert.equal(plate.armor, 'plate');
  assert.equal(boss.boss, true);

  assert.ok(useCommand(state, 'airstrike', { from: { x: 1, y: 10 }, to: { x: 15, y: 10 } }).ok);
  flyStrike(state);

  const share = (e) => 1 - e.health / e.maxHealth;
  assert.ok(Math.abs(share(flesh) - command.damageFraction) < 1e-6, `flesh lost ${share(flesh)}`);
  assert.ok(
    Math.abs(share(plate) - command.damageFraction * command.plateFactor) < 1e-6,
    `plate lost ${share(plate)}`,
  );
  assert.ok(share(plate) > share(flesh), 'plate is the point of the command');
  assert.ok(Math.abs(share(boss) - command.bossDamageFraction) < 1e-6, `boss lost ${share(boss)}`);
  assert.equal(boss.dead, false, 'and it is still standing');
});

test('a line longer than the command allows is cut short, not refused', () => {
  const command = commandById('airstrike');
  const from = { x: 0, y: 0 };
  const cut = clampLine(from, { x: 100, y: 0 }, command.maxLength);
  assert.equal(cut.x, command.maxLength);
  // A short line is left alone, and a line of length zero does not divide by it.
  assert.deepEqual(clampLine(from, { x: 2, y: 0 }, command.maxLength), { x: 2, y: 0 });
  assert.deepEqual(clampLine(from, { x: 0, y: 0 }, command.maxLength), { x: 0, y: 0 });

  const state = battlefield(30);
  const beyond = put(state, 'warrior', command.maxLength + 4);
  assert.ok(useCommand(state, 'airstrike', { from: { x: 0, y: 10 }, to: { x: 23, y: 10 } }).ok);
  runWarning(state, command.warnSeconds);
  assert.equal(beyond.health, beyond.maxHealth, 'past the end of the run nothing is hit');
});

test('the distance to a segment stops at its ends', () => {
  // Beside the middle: the perpendicular distance.
  assert.equal(distanceToSegment2(5, 2, 0, 0, 10, 0), 4);
  // Past the end: the distance to the end, not to the infinite line.
  assert.equal(distanceToSegment2(13, 0, 0, 0, 10, 0), 9);
  assert.equal(distanceToSegment2(-3, 0, 0, 0, 10, 0), 9);
  // A line drawn onto one cell is a point.
  assert.equal(distanceToSegment2(3, 4, 1, 1, 1, 1), 4 + 9);
});

// ---------- The three changes to the existing commands ----------

test('priority supply lifts two ranks from supply level 6 on', () => {
  const command = commandById('prioritySupply');
  const state = createGameState('COMMAND');
  state.phase = 'planning';
  state.wave = 25;
  state.commandPoints = 20;

  state.supplyLevel = command.doubleFromSupplyLevel - 1;
  assert.equal(supplyRankBonus(state, command), command.rankBonus);
  assert.ok(useCommand(state, 'prioritySupply').ok);
  assert.equal(takeSupplyBonus(state), command.rankBonus);

  state.commandUses = {};
  state.supplyLevel = command.doubleFromSupplyLevel;
  assert.equal(supplyRankBonus(state, command), command.rankBonusHigh);
  assert.ok(useCommand(state, 'prioritySupply').ok);
  assert.equal(takeSupplyBonus(state), command.rankBonusHigh);
});

test('the wider orbital strike and stasis field reach further than in v2', () => {
  const orbital = commandById('orbitalStrike');
  const stasis = commandById('stasisField');
  assert.equal(orbital.radius, 3);
  assert.equal(stasis.radius, 2.5);

  // An enemy that used to sit outside the old radius of 2 is now inside.
  const state = battlefield(30);
  const edge = put(state, 'warrior', 5);
  edge.y += 2.5;
  assert.ok(useCommand(state, 'orbitalStrike', { from: undefined, x: 5, y: 10 }).ok);
  runWarning(state, orbital.warnSeconds);
  assert.ok(edge.health < edge.maxHealth || edge.dead, 'the wider strike reaches it');
});
