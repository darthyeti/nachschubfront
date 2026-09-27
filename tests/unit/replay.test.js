// The acceptance of M6 part 1, step 2: a recorded match played again without
// graphics gives exactly the same result, and with changed numbers it still
// runs through instead of stopping at the first difference.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../../src/core/state.js';
import { stepSimulation } from '../../src/sim/step.js';
import { requestSalvo, chooseSelection } from '../../src/sim/actions.js';
import { toggleZone, canMarkZone } from '../../src/sim/zones.js';
import { buySupply } from '../../src/sim/economy.js';
import { setLives, setWave, grant } from '../../src/sim/debug.js';
import { useCommand } from '../../src/sim/commands.js';
import { selectionOptions } from '../../src/sim/selection.js';
import { startLog } from '../../src/sim/record.js';
import { replayMatch, compareWaves } from '../../src/sim/replay.js';
import { RULESET_VERSION } from '../../src/data/rules.js';
import { SIM_STEP } from '../../src/data/settings.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { ECONOMY } from '../../src/data/economy.js';
import { SUPPLY_LEVELS } from '../../src/data/supply.js';

const SEED = 'NACHSPIEL';

function runUntil(state, until, maxSeconds = 600) {
  const steps = Math.round(maxSeconds / SIM_STEP);
  for (let i = 0; i < steps; i++) {
    stepSimulation(state, SIM_STEP);
    if (until(state)) return true;
  }
  return false;
}

/** A free cell beside the route, asked for rather than tried out. */
function besideRoute(state) {
  for (const step of state.route?.cells ?? []) {
    for (const off of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const cell = { x: step.x + off.x, y: step.y + off.y };
      if (canMarkZone(state, cell).ok) return cell;
    }
  }
  return null;
}

/**
 * Plays a few rounds the way a player would — a marker beside the route, the
 * salvo, a kept capsule, and the supply level whenever it is affordable — with
 * the recorder running. This stands in for one of Till's protocols until they
 * arrive; the same test then runs against a real one.
 */
function recordMatch(rounds, { seed = SEED } = {}) {
  const state = createGameState(seed);
  startLog(state, RULESET_VERSION, 1);
  for (let i = 0; i < rounds; i++) {
    while (buySupply(state).ok);
    const cell = besideRoute(state);
    if (cell) toggleZone(state, cell);
    if (!requestSalvo(state)) break;
    assert.ok(runUntil(state, (s) => s.phase === 'selection', 60), 'the salvo landed');
    const options = selectionOptions(state);
    const keep = options.keep[options.keep.length - 1];
    assert.ok(chooseSelection(state, { type: 'keep', anchor: keep.anchors[0] }).ok);
    // Wave 1 without a tower on the route is a loss (docs/PROGRESS.md), and
    // this test is about the replay rather than the balance, so the bastion is
    // propped up — through the debug lever, which the protocol records, and not
    // by writing to the state behind the recorder's back.
    setLives(state, 200);
    assert.ok(runUntil(state, (s) => s.phase !== 'wave'), 'the wave ended');
    if (state.phase === 'defeat' || state.phase === 'victory') break;
    runUntil(state, (s) => s.phase === 'planning', 10);
  }
  return state.log;
}

/** Sets one field and hands back the function that puts it back. */
function set(object, key, value) {
  const before = object[key];
  object[key] = value;
  return () => {
    object[key] = before;
  };
}

test('a recorded match replays to exactly the same result', () => {
  const log = recordMatch(3);
  assert.equal(log.waves.length, 3, 'three waves were recorded');
  assert.deepEqual(log.tainted, ['setLives'], 'the propped-up bastion is declared');

  const run = replayMatch(log);
  assert.equal(run.skipped.length, 0, `nothing was skipped: ${JSON.stringify(run.skipped)}`);
  assert.equal(run.applied, log.actions.length, 'every action was repeated');

  // The whole wave line, not just the lives: enemies, kills, breakthroughs,
  // requisition, route length, emplacements by rank, damage, overkill.
  assert.deepEqual(run.waves, log.waves);
  assert.deepEqual(compareWaves(log.waves, run.waves), [], 'and the comparison agrees');
});

test('the replay is repeatable: twice over the same protocol gives the same match', () => {
  const log = recordMatch(2);
  const first = replayMatch(log);
  const second = replayMatch(log);
  assert.deepEqual(second.waves, first.waves);
  assert.equal(second.steps, first.steps, 'down to the number of simulation steps');
});

test('a wave line carries what a balancing run reads', () => {
  const [wave] = recordMatch(1).waves;
  assert.ok(wave.health > 0, 'the health the wave brought');
  assert.ok(wave.damage >= 0, 'the damage the emplacements landed');
  assert.equal(wave.commandDamage, 0, 'no commands were used');
  assert.ok(wave.overkill >= 0, 'and what was thrown at the already dead');
  assert.ok(wave.overkill <= wave.damage + wave.health, 'overkill stays in the same order of size');
  assert.equal(wave.byRank.length, 5, 'one count per rank');
  assert.equal(
    wave.byRank.reduce((a, b) => a + b, 0) + wave.specials,
    wave.towers,
    'the ranks plus the specials add up to the emplacements',
  );
  assert.ok(wave.route > 0);
});

test('changed numbers change the outcome without derailing the replay', () => {
  const log = recordMatch(3);
  const plain = replayMatch(log);

  // Four times the health on the commonest enemy: the same decisions, a
  // different match.
  const undo = set(ENEMIES.warrior, 'health', ENEMIES.warrior.health * 4);
  try {
    const tougher = replayMatch(log);
    assert.equal(tougher.waves.length, plain.waves.length, 'the replay ran to the end');
    const diff = compareWaves(plain.waves, tougher.waves, ['killed', 'leaked', 'lives']);
    assert.ok(diff.length > 0, 'and the harder waves show in the numbers');
    // The map is untouched by a data change, so the route is the same one.
    assert.deepEqual(
      tougher.waves.map((w) => w.route),
      plain.waves.map((w) => w.route),
      'the maze the player built is unchanged',
    );
  } finally {
    undo();
  }

  assert.deepEqual(replayMatch(log).waves, plain.waves, 'and the values are back');
});

test('an action that has become impossible is skipped and named', () => {
  // A protocol that buys the supply level in the first round, then a price
  // nobody can pay: the purchase has to drop out and the rest carry on.
  const log = recordMatch(2);
  assert.ok(
    log.actions.some((a) => a.a === 'supply'),
    'the recorded match bought supply levels',
  );

  const undo = set(ECONOMY, 'startRequisition', 0);
  // A level that costs more than a short match can ever earn.
  const dear = set(SUPPLY_LEVELS[1], 'cost', 999_999);
  try {
    const run = replayMatch(log);
    assert.equal(run.waves.length, log.waves.length, 'the replay ran through');
    const refusedSupply = run.skipped.filter((s) => s.a === 'supply');
    assert.ok(refusedSupply.length > 0, 'the purchase was skipped');
    assert.match(refusedSupply[0].why, /supply refused: funds/, refusedSupply[0].why);
  } finally {
    dear();
    undo();
  }
});

test('a command in mid-wave is repeated at the same second of the wave', () => {
  // The one action whose exact moment matters: an orbital strike early in the
  // wave is a different decision from the same strike late in it. The replay
  // anchors it to the seconds into the wave, not to the simulation step, so a
  // slower wave earlier in the match cannot shift it out of its own wave.
  const state = createGameState(SEED);
  startLog(state, RULESET_VERSION, 2);
  setWave(state, 15);
  grant(state, { commandPoints: 20 });
  setLives(state, 200);

  const cell = besideRoute(state);
  if (cell) toggleZone(state, cell);
  assert.ok(requestSalvo(state));
  assert.ok(runUntil(state, (s) => s.phase === 'selection', 60));
  const options = selectionOptions(state);
  assert.ok(chooseSelection(state, { type: 'keep', anchor: options.keep[0].anchors[0] }).ok);

  // Four seconds into the wave, on the third cell of the route.
  assert.ok(runUntil(state, (s) => s.phaseTime >= 4, 30));
  const target = state.route.cells[3];
  assert.ok(useCommand(state, 'orbitalStrike', { x: target.x, y: target.y }).ok);
  const recorded = state.log.actions.find((a) => a.a === 'command');
  assert.ok(recorded.pt >= 4, `the strike was noted at ${recorded.pt} s into the wave`);

  assert.ok(runUntil(state, (s) => s.phase !== 'wave'));
  const log = state.log;
  assert.ok(log.waves[0].commandDamage > 0, 'the strike did something');

  const run = replayMatch(log);
  assert.equal(run.skipped.length, 0, JSON.stringify(run.skipped));
  assert.deepEqual(run.waves, log.waves, 'the same wave, down to the command damage');
});

test('untilWave stops the replay where the test entry needs it', () => {
  const log = recordMatch(3);
  const run = replayMatch(log, { untilWave: 2 });
  assert.equal(run.stopped, 'wave 2');
  assert.equal(run.waves.length, 2);
  assert.equal(run.state.wave, 2);
  // And the state it stops on is a playable one: the maze is standing.
  assert.ok(run.state.towers.length >= 1, 'the emplacements are built');
  assert.equal(run.state.phase === 'evaluation' || run.state.phase === 'planning', true);
});

test('every wave line is reported as it finishes', () => {
  const log = recordMatch(2);
  const seen = [];
  const run = replayMatch(log, { onWave: (line) => seen.push(line.w) });
  assert.deepEqual(seen, [1, 2]);
  assert.equal(run.waves.length, 2);
});

test('a protocol with nothing in it is not a crash', () => {
  const run = replayMatch({ seed: SEED, actions: [], waves: [] });
  assert.equal(run.waves.length, 0);
  assert.equal(run.applied, 0);
  assert.equal(run.stopped, 'end of protocol');
  assert.equal(run.state.phase, 'planning');
});

test('compareWaves names the wave, the field and both values', () => {
  const was = [{ w: 1, lives: 20, killed: 10 }];
  const now = [{ w: 1, lives: 18, killed: 10 }];
  assert.deepEqual(compareWaves(was, now), [{ wave: 1, field: 'lives', was: 20, now: 18 }]);
  assert.deepEqual(compareWaves(was, []), [{ wave: 1, field: 'wave', was: 1, now: null }]);
  assert.deepEqual(compareWaves([], now), [{ wave: 1, field: 'wave', was: null, now: 1 }]);
});
