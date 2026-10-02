// King of the Hill replays step by step (M7b, test 2): the same seed and
// configuration give the same match, and a recorded one, upgrades included,
// plays again without graphics to the same waves.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../../src/core/state.js';
import { stepSimulation } from '../../src/sim/step.js';
import { requestSalvo, chooseSelection, upgradeTower } from '../../src/sim/actions.js';
import { grant } from '../../src/sim/debug.js';
import { startLog } from '../../src/sim/record.js';
import { replayMatch, compareWaves } from '../../src/sim/replay.js';
import { playBotMatch } from '../tools/bot-player.mjs';
import { SIM_STEP } from '../../src/data/settings.js';
import { RULESET_VERSION } from '../../src/data/rules.js';

function runUntil(state, until, seconds = 600) {
  for (let i = 0; i < seconds / SIM_STEP; i++) {
    stepSimulation(state, SIM_STEP);
    if (until(state)) return true;
  }
  return false;
}

/**
 * Three rounds by hand: a salvo, a raise instead of a salvo, a salvo. The
 * requisition for the raise comes from the debug lever, which is recorded too —
 * the bots never reach 120 in the few waves they last.
 */
function play() {
  const state = createGameState('A1', { mode: 'koth' });
  startLog(state, RULESET_VERSION, 1);
  state.invulnerable = true;
  const round = () => {
    assert.ok(requestSalvo(state));
    assert.ok(runUntil(state, (s) => s.phase === 'selection'));
    assert.ok(chooseSelection(state, { type: 'keep', anchor: 0 }).ok);
    assert.ok(runUntil(state, (s) => s.phase === 'planning'));
  };
  round();
  grant(state, { requisition: 500 });
  assert.ok(upgradeTower(state, state.towers[0].id).ok);
  assert.ok(runUntil(state, (s) => s.phase === 'planning'));
  round();
  return state;
}

test('a King of the Hill match with an upgrade replays to the same waves', () => {
  const state = play();
  const { log } = state;
  assert.equal(log.mode, 'koth');
  assert.equal(log.waves.length, 3);
  assert.ok(log.actions.some((a) => a.a === 'upgrade'));
  // The bastion was held by the debug lever; the replay has to hold it too.
  const played = replayMatch({ ...log, actions: [{ t: 0, a: 'invulnerable', on: true }, ...log.actions] });
  assert.equal(played.state.mode.id, 'koth');
  assert.deepEqual(played.skipped, []);
  assert.deepEqual(compareWaves(log.waves, played.waves, ['lives', 'spawned', 'killed', 'leaked', 'route', 'damage']), []);
  assert.equal(played.state.towers[0].rank, state.towers[0].rank);
  assert.equal(played.state.riftIndex, state.riftIndex);
});

test('the same seed and configuration give the same bot match twice', () => {
  const run = () => playBotMatch({ seed: 'A1', strategy: 'balance', config: { mode: 'koth' } });
  const a = run();
  const b = run();
  assert.deepEqual(a.waves, b.waves);
  assert.deepEqual(a.log.actions, b.log.actions);
});
