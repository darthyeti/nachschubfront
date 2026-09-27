import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../../src/core/state.js';
import { stepSimulation } from '../../src/sim/step.js';
import { requestSalvo, chooseSelection, toggleObstacle } from '../../src/sim/actions.js';
import { toggleZone, canMarkZone } from '../../src/sim/zones.js';
import { buySupply, demolish, buildBulwark } from '../../src/sim/economy.js';
import { useCommand } from '../../src/sim/commands.js';
import { grant, setWave } from '../../src/sim/debug.js';
import { startLog, record, recordRating, isMeasurable, PROTOCOL_VERSION } from '../../src/sim/record.js';
import { RULESET_VERSION } from '../../src/data/rules.js';
import { SIM_STEP } from '../../src/data/settings.js';
import { selectionOptions } from '../../src/sim/selection.js';
import { isRubble } from '../../src/sim/rubble.js';

const SEED = 'PROTOKOLL';

function runUntil(state, until, maxSeconds = 600) {
  const steps = Math.round(maxSeconds / SIM_STEP);
  for (let i = 0; i < steps; i++) {
    stepSimulation(state, SIM_STEP);
    if (until(state)) return true;
  }
  return false;
}

/** Marks a zone beside the route, calls the salvo and keeps a pod: into the wave. */
function playToWave(state) {
  const cell = freeCellBesideRoute(state);
  if (cell) toggleZone(state, cell);
  assert.ok(requestSalvo(state), 'salvo requested');
  assert.ok(runUntil(state, (s) => s.phase === 'selection', 60), 'reached the selection');
  const options = selectionOptions(state);
  const keep = options.keep[options.keep.length - 1];
  assert.ok(chooseSelection(state, { type: 'keep', anchor: keep.anchors[0] }).ok);
  assert.equal(state.phase, 'wave');
}

/** A whole round, from planning back to planning. */
function playRound(state) {
  playToWave(state);
  assert.ok(runUntil(state, (s) => s.phase !== 'wave'), 'the wave ended');
  runUntil(state, (s) => s.phase === 'planning', 10);
}

function freeCellBesideRoute(state) {
  const { route } = state;
  if (!route) return null;
  for (const step of route.cells) {
    for (const off of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const cell = { x: step.x + off.x, y: step.y + off.y };
      // Asked, not tried: a probe that marked and unmarked the cell would land
      // in the log twice, and the log is what these tests look at.
      if (canMarkZone(state, cell).ok) return cell;
    }
  }
  return null;
}

test('without startLog nothing is recorded and no action fails', () => {
  const state = createGameState(SEED);
  assert.equal(state.log, undefined);
  playRound(state);
  assert.equal(state.log, undefined);
  assert.equal(state.wave, 1);
});

test('a played round records the actions in order, with tick and phase', () => {
  const state = createGameState(SEED);
  startLog(state, RULESET_VERSION);
  playRound(state);

  const log = state.log;
  assert.equal(log.version, PROTOCOL_VERSION);
  assert.equal(log.seed, SEED);
  assert.equal(log.ruleset, RULESET_VERSION);
  assert.deepEqual(log.tainted, []);

  const kinds = log.actions.map((a) => a.a);
  assert.deepEqual(kinds, ['zone', 'salvo', 'select']);

  // Ticks never run backwards: that is what makes the replay exact.
  for (let i = 1; i < log.actions.length; i++) {
    assert.ok(log.actions[i].t >= log.actions[i - 1].t, 'ticks rise');
  }
  const [zone, salvo, select] = log.actions;
  assert.equal(zone.p, 'planning');
  assert.equal(zone.on, true);
  assert.equal(typeof zone.x, 'number');
  // The salvo carries the zone list as it stands after the random fill, so the
  // replay rebuilds the same maze even when prices changed what was affordable.
  assert.ok(salvo.zones.length > 0);
  assert.equal(typeof salvo.zones[0].x, 'number');
  assert.equal(select.type, 'keep');
  assert.equal(typeof select.anchor, 'number');
});

test('a refused action is not recorded', () => {
  const state = createGameState(SEED);
  startLog(state, RULESET_VERSION);
  // The bastion is protected ground, so this zone is refused.
  const result = toggleZone(state, state.map.bastion);
  assert.equal(result.ok, false);
  assert.equal(state.log.actions.length, 0);

  // And so is a demolition nobody can pay for: requisition starts at zero.
  const terrain = state.map.obstacles[0].cells[0];
  assert.equal(demolish(state, terrain).ok, false);
  assert.equal(state.log.actions.length, 0);
});

test('every wave leaves a line with the lives it ended on', () => {
  const state = createGameState(SEED);
  startLog(state, RULESET_VERSION);
  playRound(state);
  playRound(state);

  assert.equal(state.log.waves.length, 2);
  const [first, second] = state.log.waves;
  assert.equal(first.w, 1);
  assert.equal(second.w, 2);
  for (const line of state.log.waves) {
    assert.equal(line.lives, line.lives | 0);
    assert.ok(line.spawned > 0, 'the wave had enemies');
    assert.equal(line.killed + line.leaked <= line.spawned, true);
    assert.ok(line.route > 0, 'the route the wave ran was measured');
    assert.equal(line.rating, null);
  }
  assert.ok(isMeasurable(state.log));
});

test('a rating attaches to its wave and only to that one', () => {
  const state = createGameState(SEED);
  startLog(state, RULESET_VERSION);
  playRound(state);
  playRound(state);

  assert.equal(recordRating(state, 2, 'hard'), true);
  assert.equal(recordRating(state, 7, 'easy'), false, 'no such wave yet');
  assert.equal(state.log.waves[0].rating, null);
  assert.equal(state.log.waves[1].rating, 'hard');
});

test('the end of the match is recorded, with the phase it ended in', () => {
  const state = createGameState(SEED);
  startLog(state, RULESET_VERSION);
  playRound(state);
  assert.equal(state.log.end, null, 'a match in progress has no end');

  // Into the second wave, then the bastion falls. Set by hand rather than with
  // the debug lever, so the protocol stays clean and `end` is what is measured.
  playToWave(state);
  state.lives = 0;
  stepSimulation(state, SIM_STEP);
  assert.equal(state.phase, 'defeat');
  assert.equal(state.log.end.phase, 'defeat');
  assert.equal(state.log.end.wave, 2);
  assert.equal(state.log.end.lives, 0);
  // The wave that was running still leaves its line: every way out of a wave
  // goes through the same place.
  assert.equal(state.log.waves.length, 2);
});

test('debug levers taint the protocol, and each one is named once', () => {
  const state = createGameState(SEED);
  startLog(state, RULESET_VERSION);

  grant(state, { requisition: 500 });
  grant(state, { commandPoints: 9 });
  assert.deepEqual(state.log.tainted, ['grant'], 'named once, however often it is pulled');
  assert.equal(isMeasurable(state.log), false, 'a tainted match is not a measurement');

  setWave(state, 5);
  assert.deepEqual(state.log.tainted, ['grant', 'setWave']);

  // The debug obstacle is recorded as an action as well, so a replay can follow.
  const before = state.log.actions.length;
  const free = { x: state.map.bastion.x, y: 0 };
  toggleObstacle(state, free);
  assert.ok(state.log.tainted.includes('obstacle'));
  assert.ok(state.log.actions.length >= before);
});

test('buying, demolishing, building and commands all land in the log', () => {
  const state = createGameState(SEED);
  startLog(state, RULESET_VERSION);
  // One round first: the pods nobody kept leave the rubble to work with. The
  // pre-placed ruins and craters are terrain and cannot be demolished.
  playRound(state);
  // Paid for by hand rather than by a debug lever, so the log stays clean.
  state.requisition = 4000;
  state.commandPoints = 20;

  assert.ok(buySupply(state).ok);
  const heaps = state.map.obstacles.filter((o) => isRubble(state.map, o.cells[0]));
  assert.ok(heaps.length >= 2, 'the salvo left rubble behind');
  assert.ok(demolish(state, heaps[0].cells[0]).ok);
  assert.ok(buildBulwark(state, heaps[1].cells[0]).ok);

  // Priorisierter Nachschub is the one command that works during planning.
  state.wave = 25;
  const used = useCommand(state, 'prioritySupply');
  assert.ok(used.ok, 'the command went through');

  const kinds = state.log.actions.map((a) => a.a);
  assert.ok(kinds.includes('supply'));
  assert.ok(kinds.includes('demolish'));
  assert.ok(kinds.includes('command'));
  assert.ok(kinds.includes('bulwark'));
  assert.deepEqual(state.log.tainted, [], 'paying for things is not a debug lever');

  const command = state.log.actions.find((a) => a.a === 'command');
  assert.equal(command.id, 'prioritySupply');
});

test('record ignores a state that is not being recorded', () => {
  const state = createGameState(SEED);
  assert.doesNotThrow(() => record(state, 'zone', { x: 1, y: 1, on: true }));
  assert.equal(recordRating(state, 1, 'fine'), false);
  assert.equal(isMeasurable(state.log), false);
  assert.equal(isMeasurable(null), false);
});
