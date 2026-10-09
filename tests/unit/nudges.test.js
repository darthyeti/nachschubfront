// Which disc calls for attention (balancing round 5): the rules, without a browser.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../../src/core/state.js';
import { commandStatus } from '../../src/sim/commands.js';
import { nextSupplyCost } from '../../src/sim/economy.js';
import { commandCalls, supplyCalls, SUPPLY_SURPLUS } from '../../src/ui/nudges.js';

function planning() {
  const state = createGameState('NUDGE');
  state.phase = 'planning';
  return state;
}

test('the supply disc calls only with a real surplus over the price', () => {
  const state = planning();
  const cost = nextSupplyCost(state);
  state.requisition = cost;
  assert.equal(supplyCalls(state), false, 'just affordable is no surplus');
  state.requisition = cost * SUPPLY_SURPLUS;
  assert.equal(supplyCalls(state), true);
  state.phase = 'wave';
  assert.equal(supplyCalls(state), false, 'not while it cannot be bought');
});

test('the supply disc falls silent at the top level', () => {
  const state = planning();
  state.supplyLevel = 8;
  state.requisition = 1e6;
  assert.equal(supplyCalls(state), false);
});

test('a usable command calls until the first command of the match is used', () => {
  const state = planning();
  const status = { usable: true };
  assert.equal(commandCalls(state, status), true);
  assert.equal(commandCalls(state, { usable: false }), false, 'never one that cannot be used');
  state.commandUses.prioritySupply = 3;
  assert.equal(commandCalls(state, status), false, 'whoever found the rail needs no pointer');
});

test('a real command reads its usability from the simulation', () => {
  const state = planning();
  state.wave = 9;
  state.commandPoints = 100;
  const status = commandStatus(state, 'prioritySupply');
  assert.equal(commandCalls(state, status), status.usable);
});
