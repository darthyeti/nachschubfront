// Upgrading a standing emplacement instead of building (GDD section 11,
// balancing round 3). It exists because late requisition had nowhere to go and
// the selection phase had nothing left to decide, so both halves are tested:
// that it is a real choice, and that it actually costs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../../src/core/state.js';
import { selectionOptions, applySelection } from '../../src/sim/selection.js';
import { ECONOMY, upgradeCost } from '../../src/data/economy.js';
import { MAX_RANK } from '../../src/data/ranks.js';
import { playBotMatch } from '../../tests/tools/bot-player.mjs';
import { replayMatch, compareWaves } from '../../src/sim/replay.js';
import { chooseSelection } from '../../src/sim/actions.js';

/**
 * A selection phase late in a match, with emplacements worth improving.
 * `fighting` is the wave this salvo is arming for; `state.wave` is the one
 * before it, which is what the phase actually holds.
 */
function ready({ fighting = ECONOMY.upgradeFromWave, requisition = 5000, podRank = 4 } = {}) {
  const state = createGameState('AUFWERTUNG');
  state.wave = fighting - 1;
  state.phase = 'selection';
  state.requisition = requisition;
  state.towers = [
    { id: 1, x: 3, y: 3, doctrine: 'flame', rank: 2, special: null, damage: 0 },
    { id: 2, x: 4, y: 4, doctrine: 'flame', rank: 4, special: null, damage: 0 },
    { id: 3, x: 5, y: 5, doctrine: 'tesla', rank: 1, special: null, damage: 0 },
    { id: 4, x: 6, y: 6, doctrine: 'flame', rank: MAX_RANK, special: null, damage: 0 },
    { id: 5, x: 7, y: 7, doctrine: 'flame', rank: null, special: 'inferno', damage: 0 },
    { id: 6, x: 8, y: 8, doctrine: 'flame', rank: 2, special: null, damage: 0 },
  ];
  state.pods = [{ index: 0, x: 1, y: 1, doctrine: 'flame', rank: podRank, landed: true }];
  return state;
}

test('nothing is offered before the wave the rules name', () => {
  // The boundary is the wave being armed for, not the one just fought: the
  // option has to be there in the selection phase that leads into wave 30.
  const { upgradeFromWave } = ECONOMY;
  assert.equal(selectionOptions(ready({ fighting: upgradeFromWave - 1 })).upgrades.length, 0);
  assert.ok(selectionOptions(ready({ fighting: upgradeFromWave })).upgrades.length > 0);
});

test('only an emplacement of the same doctrine, with a rank and room above it', () => {
  const options = selectionOptions(ready()).upgrades;
  const ids = options.map((o) => o.towerId);
  assert.ok(!ids.includes(3), 'a different doctrine is not improved');
  assert.ok(!ids.includes(4), 'a legend has nowhere to go');
  assert.ok(!ids.includes(5), 'a special has no rank to raise');
});

test('a capsule does not promote something above itself', () => {
  // A recruit pouring into a hero would make every low capsule worth more spent
  // here than anywhere, and there would be no reason left to merge.
  const low = selectionOptions(ready({ podRank: 2 })).upgrades;
  assert.deepEqual(low.map((o) => o.rank).sort(), [2], 'only the rank-2 emplacements');
  const high = selectionOptions(ready({ podRank: 4 })).upgrades;
  assert.deepEqual(high.map((o) => o.rank).sort(), [2, 4], 'a hero capsule reaches both');
});

test('one option per rank step, and the oldest emplacement of that rank', () => {
  // Two rank-2 flames stand (ids 1 and 6); by wave 30 there are dozens, and a
  // list of one button each is not a choice.
  const options = selectionOptions(ready()).upgrades;
  assert.equal(options.filter((o) => o.rank === 2).length, 1);
  assert.equal(options.find((o) => o.rank === 2).towerId, 1, 'the older of the two');
  assert.deepEqual(options.map((o) => o.rank), [4, 2], 'best first');
});

test('the price is the rank it reaches, and it is taken', () => {
  const state = ready();
  const option = selectionOptions(state).upgrades.find((o) => o.rank === 4);
  assert.equal(option.cost, upgradeCost(5));
  const before = state.requisition;

  const result = applySelection(state, { type: 'upgrade', towerId: option.towerId, anchor: 0 });
  assert.ok(result.ok, result.reason);
  assert.equal(state.requisition, before - option.cost);
  assert.equal(state.towers.find((t) => t.id === 2).rank, 5, 'the emplacement went up');
  assert.equal(state.towers.length, 6, 'and no new one was built');
  assert.equal(state.pods.length, 0, 'the salvo is gone');
});

test('an empty purse refuses it instead of going into the red', () => {
  const state = ready({ requisition: 10 });
  const option = selectionOptions(state).upgrades[0];
  const result = applySelection(state, { type: 'upgrade', towerId: option.towerId, anchor: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'funds');
  assert.equal(state.requisition, 10, 'nothing was taken');
  assert.equal(state.pods.length, 1, 'and the salvo still stands');
});

test('the whole salvo becomes rubble, the chosen capsule included', () => {
  // Nothing is built, so the capsule the player picked is not spared either.
  const state = ready();
  state.pods = [
    { index: 0, x: 1, y: 1, doctrine: 'flame', rank: 4, landed: true },
    { index: 1, x: 2, y: 1, doctrine: 'tesla', rank: 1, landed: true },
  ];
  const before = state.map.obstacles.length;
  const option = selectionOptions(state).upgrades[0];
  assert.ok(applySelection(state, { type: 'upgrade', towerId: option.towerId, anchor: 0 }).ok);
  assert.equal(state.map.obstacles.length, before + 2, 'both capsules left a heap');
});

test('an upgrade is recorded and replays to the same match', () => {
  const state = ready();
  const option = selectionOptions(state).upgrades.find((o) => o.rank === 4);
  state.log = { version: 1, id: 1, seed: state.seed, ruleset: 6, supplyStart: state.supplyLevel, tainted: [], actions: [], waves: [], end: null };
  chooseSelection(state, { type: 'upgrade', towerId: option.towerId, anchor: 0 });
  const action = state.log.actions.at(-1);
  assert.equal(action.a, 'select');
  assert.equal(action.type, 'upgrade');
  assert.equal(action.towerId, option.towerId, 'which emplacement, or the replay cannot repeat it');
});

test('a bot match still replays with the option in the game', () => {
  // The option changes what selectionOptions returns for every late salvo, so
  // the guarantee the whole measurement chain rests on is checked again here.
  const run = playBotMatch({ seed: 'AUFWERTBOT', strategy: 'simple' });
  const again = replayMatch(run.log);
  assert.deepEqual(compareWaves(run.waves, again.waves), []);
});
