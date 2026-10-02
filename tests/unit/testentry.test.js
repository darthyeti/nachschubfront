// The test entry (M6, part 1, step 4): a protocol plus a wave number is the
// saved position, and what comes out of it has to be a playable match that no
// tool mistakes for a measurement.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareTestEntry, TEST_WAVES } from '../../src/sim/testentry.js';
import { playBotMatch } from '../../tests/tools/bot-player.mjs';
import { isMeasurable } from '../../src/sim/record.js';
import { replayMatch } from '../../src/sim/replay.js';
import { requestSalvo } from '../../src/sim/actions.js';
import { STRINGS } from '../../src/data/strings.js';

/**
 * A match to enter, played once for the whole file.
 *
 * The wave entered is derived from it rather than written down: how far a bot
 * gets is a balancing value and moves with every tuning round, and a hard-coded
 * 10 turned six of these tests red the moment round 2 raised the wave strength.
 * What is being tested is the contract, not how strong the bots happen to be.
 */
const long = playBotMatch({ seed: 'EINSTIEG', strategy: 'simple' });
const ENTRY = Math.floor(long.waves.length / 2) + 1;
const BEFORE = ENTRY - 1;

test('the waves the order names are the ones offered', () => {
  assert.deepEqual(TEST_WAVES, [10, 20, 30, 35]);
});

test('the fixture match is long enough to enter in the middle of', () => {
  assert.ok(long.waves.length >= 6, `only ${long.waves.length} waves`);
});

test('the named wave is still ahead of the player', () => {
  // "Ab Welle 35 (Koloss)" is an invitation to fight the Koloss, not to arrive
  // after it. So the handover sits in the planning phase that leads into it.
  const entry = prepareTestEntry(long.log, ENTRY);
  assert.ok(entry.ok, entry.reason);
  assert.equal(entry.state.wave, BEFORE, 'the wave before it is fought, the chosen one to come');
  assert.equal(entry.state.phase, 'planning', 'where the player acts');
  assert.equal(entry.state.log.waves.length, BEFORE);
});

test('the position is the one the protocol had at that wave', () => {
  const entry = prepareTestEntry(long.log, ENTRY);
  const recorded = long.waves.find((w) => w.w === BEFORE);
  assert.equal(entry.about.lives, recorded.lives);
  assert.equal(entry.state.towers.length, recorded.towers);
});

test('a prepared match is never a measurement', () => {
  // It was not played, it was set up. Nothing else has to remember that: the
  // tools all ask isMeasurable.
  const entry = prepareTestEntry(long.log, ENTRY);
  assert.ok(entry.state.log.tainted.includes('testEntry'));
  assert.equal(isMeasurable(entry.state.log), false);
});

test('the handover carries no events from the waves it replayed', () => {
  // Otherwise every replayed wave's banners and rating prompts arrive at once.
  const entry = prepareTestEntry(long.log, ENTRY);
  assert.equal(entry.state.events.length, 0);
});

test('the match goes on from there, and records what happens next', () => {
  const entry = prepareTestEntry(long.log, ENTRY);
  const before = entry.state.log.actions.length;
  assert.ok(requestSalvo(entry.state), 'a salvo can be called in the handed-over state');
  assert.equal(entry.state.phase, 'salvo');
  assert.ok(entry.state.log.actions.length > before, 'and it is recorded');
});

test('what it hands over is itself a protocol that replays', () => {
  // The entry costs no save format because the log is rebuilt on the way: the
  // replayed actions are recorded again by the same functions that wrote them.
  const entry = prepareTestEntry(long.log, ENTRY);
  const again = replayMatch(entry.state.log);
  assert.equal(again.waves.length, BEFORE);
  assert.deepEqual(
    again.waves.map((w) => w.lives),
    entry.state.log.waves.map((w) => w.lives),
  );
});

test('a protocol that never reached the wave is refused, not trimmed', () => {
  const short = playBotMatch({ seed: 'KURZ', strategy: 'simple' });
  const far = short.waves.length + 5;
  const entry = prepareTestEntry(short.log, far);
  assert.equal(entry.ok, false);
  assert.equal(entry.reason, 'short');
  assert.equal(entry.about.wave, far);
  assert.ok(entry.about.reached < far - 1);
});

test('wave 1 is a new match, not an entry', () => {
  const entry = prepareTestEntry(long.log, 1);
  assert.equal(entry.ok, false);
  assert.equal(entry.reason, 'first');
});

test('a protocol that ends in defeat at that wave offers nothing to play on', () => {
  const lost = playBotMatch({ seed: 'REFBAD', strategy: 'simple' });
  assert.equal(lost.stopped, 'defeat', 'the fixture has to be a defeat');
  const entry = prepareTestEntry(lost.log, lost.waves.length + 1);
  assert.equal(entry.ok, false);
  assert.ok(['over', 'short'].includes(entry.reason), entry.reason);
});

test('a protocol of an unknown mode is turned away before the replay (M7a)', () => {
  const result = prepareTestEntry({ seed: 'X', mode: 'aus-der-zukunft', actions: [], waves: [] }, 10);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'mode');
  assert.ok(STRINGS.menu.testEntryErrors.mode(result.about).includes('aus-der-zukunft'));
});
