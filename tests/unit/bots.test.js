// The bots (M6, part 1, step 3): every strategy has to make legal moves, and a
// bot match has to be a protocol like any other — otherwise the tools around it
// cannot read it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../../src/core/state.js';
import { STRATEGIES, strategyById } from '../../tests/tools/bot-strategies.mjs';
import { playBotMatch } from '../../tests/tools/bot-player.mjs';
import { replayMatch, compareWaves } from '../../src/sim/replay.js';
import { isMeasurable } from '../../src/sim/record.js';
import { canMarkZone, zoneLimit } from '../../src/sim/zones.js';
import { routeWith } from '../../src/sim/route.js';
import { selectionOptions } from '../../src/sim/selection.js';

/** The two quick ones; the maze builder costs seconds per match by design. */
const QUICK = ['simple', 'recipes'];

test('every strategy is named, described and findable', () => {
  assert.ok(STRATEGIES.length >= 4, 'the order asks for at least three');
  for (const strategy of STRATEGIES) {
    assert.match(strategy.id, /^[a-z]+$/);
    assert.ok(strategy.title.length > 0, `${strategy.id} has a title`);
    assert.ok(strategy.about.length > 20, `${strategy.id} says what it does`);
    assert.equal(strategyById(strategy.id), strategy);
  }
  assert.throws(() => strategyById('nonesuch'), /Unknown strategy/);
});

test('every strategy marks cells the game would accept, and never closes the way', () => {
  for (const strategy of STRATEGIES) {
    const state = createGameState('BOTZONE');
    const limit = zoneLimit(state);
    const cells = strategy.zones(state, limit) ?? [];
    assert.ok(cells.length > 0, `${strategy.id} marked nothing`);
    assert.ok(cells.length <= limit, `${strategy.id} marked more than the salvo holds`);

    const seen = new Set();
    for (const cell of cells) {
      assert.ok(cell && Number.isInteger(cell.x) && Number.isInteger(cell.y), `${strategy.id}: ${JSON.stringify(cell)}`);
      const key = `${cell.x},${cell.y}`;
      assert.ok(!seen.has(key), `${strategy.id} marked ${key} twice`);
      seen.add(key);
      assert.ok(canMarkZone(state, cell).ok, `${strategy.id}: ${key} would be refused`);
    }
    // The whole set together, which is the rule the game applies (GDD 3).
    assert.ok(routeWith(state.map, cells), `${strategy.id} closed the way`);
  }
});

test('every strategy offers choices in a preference order, fallbacks included', () => {
  for (const strategy of STRATEGIES) {
    const state = createGameState('BOTPICK');
    for (const cell of strategy.zones(state, zoneLimit(state)) ?? []) {
      state.zones.push(cell);
    }
    // A salvo of capsules to choose from, without playing the fall.
    state.pods = state.zones.map((zone, index) => ({
      index,
      x: zone.x,
      y: zone.y,
      doctrine: ['flame', 'tesla', 'psi', 'autocannon', 'laser', 'mortar'][index % 6],
      rank: 1 + (index % 3),
      t: 0,
      landed: true,
    }));
    const choices = strategy.choose(state, selectionOptions(state)) ?? [];
    assert.ok(choices.length > 0, `${strategy.id} offered nothing`);
    assert.ok(
      choices.some((c) => c.type === 'keep'),
      `${strategy.id} has no fallback that always works`,
    );
    for (const choice of choices) {
      assert.ok(['keep', 'merge', 'recipe'].includes(choice.type), `${strategy.id}: ${choice.type}`);
      assert.ok(Number.isInteger(choice.anchor), `${strategy.id}: anchor ${choice.anchor}`);
      assert.ok(choice.anchor >= 0 && choice.anchor < state.pods.length, `${strategy.id}: anchor out of range`);
    }
  }
});

test('a bot match is a protocol that replays to the same result', () => {
  for (const id of QUICK) {
    const run = playBotMatch({ seed: 'BOTLAUF', strategy: id });
    assert.ok(run.waves.length > 0, `${id} played no wave`);
    assert.ok(isMeasurable(run.log), `${id} pulled a debug lever`);

    const again = replayMatch(run.log);
    assert.deepEqual(compareWaves(run.waves, again.waves), [], `${id} does not replay`);
    assert.equal(again.skipped.length, 0, `${id}: ${JSON.stringify(again.skipped)}`);
  }
});

test('a bot keeps enough requisition to build what it chose', () => {
  // The bot before M6 spent everything on supply levels and was then refused
  // its own choice, which ended the run on some seeds with an exception.
  const run = playBotMatch({ seed: 'BOTGELD', strategy: 'simple' });
  assert.ok(run.waves.length >= 5, `only reached wave ${run.waves.length}`);
  assert.notEqual(run.stopped, 'no choice was accepted');
  for (const wave of run.waves) {
    assert.ok(wave.towers >= 1, `wave ${wave.w} has no emplacement`);
  }
});

test('two runs of the same bot on the same seed are the same match', () => {
  const first = playBotMatch({ seed: 'BOTGLEICH', strategy: 'recipes' });
  const second = playBotMatch({ seed: 'BOTGLEICH', strategy: 'recipes' });
  assert.deepEqual(second.waves, first.waves);
  assert.deepEqual(second.log.actions, first.log.actions);
});

test('the strategies really do play differently', () => {
  // Otherwise there is nothing to calibrate against: four names for one bot
  // would bracket nothing.
  const routes = new Map();
  for (const id of [...QUICK, 'firepower']) {
    const run = playBotMatch({ seed: 'BOTUNTERSCHIED', strategy: id });
    routes.set(id, run.waves[run.waves.length - 1]?.route ?? 0);
  }
  const values = [...routes.values()];
  assert.ok(new Set(values).size > 1, `all the same: ${JSON.stringify([...routes])}`);
});

test('the maze builder lengthens the route more than the simple rule does', () => {
  // One salvo only: a whole match of this strategy costs seconds, because every
  // candidate zone is a path search.
  const state = createGameState('BOTLABYRINTH');
  const limit = zoneLimit(state);
  const plain = routeWith(state.map, strategyById('simple').zones(state, limit));
  const maze = routeWith(state.map, strategyById('maze').zones(state, limit));
  assert.ok(maze.length >= plain.length, `${maze.length} vs ${plain.length}`);
});
