// The guard that keeps a replay from standing in for a match it no longer
// reproduces (M6, part 1). It exists because calibrate silently ranked bots
// against a 30-wave defeat that the player had actually won at wave 50, after a
// placement rule changed under an already-recorded protocol.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reference } from '../../tests/tools/reference.mjs';
import { playBotMatch } from '../../tests/tools/bot-player.mjs';
import { exportProtocol, parseProtocol } from '../../src/storage/protocol.js';
import { APP_VERSION } from '../../src/data/version.js';
import { RULESET_VERSION } from '../../src/data/rules.js';

test('a protocol that still replays is accepted as a reference', () => {
  const run = playBotMatch({ seed: 'REFOK', strategy: 'simple' });
  const check = reference(run.log, APP_VERSION);
  assert.ok(check.ok, check.why ?? '');
  assert.equal(check.diff.length, 0);
  assert.equal(check.why, null);
  assert.equal(check.played.waves.length, run.waves.length);
});

test('a protocol whose waves no longer come back is refused', () => {
  const run = playBotMatch({ seed: 'REFBAD', strategy: 'simple' });
  // What a changed rule looks like from here: the recorded match says something
  // the replay does not produce. Faked rather than re-created, because the point
  // is the guard, not the rule that once broke it.
  const tampered = structuredClone(run.log);
  tampered.waves[0].lives -= 3;
  const check = reference(tampered, APP_VERSION);
  assert.equal(check.ok, false);
  assert.ok(check.diff.length > 0);
  assert.match(check.why, /Welle 1/);
});

test('the reason separates the three causes, which are not equally bad', () => {
  const run = playBotMatch({ seed: 'REFVERSION', strategy: 'simple' });
  const tampered = structuredClone(run.log);
  tampered.waves[0].killed += 1;

  // Another rule version: the protocol simply belongs to rules that are gone.
  const oldRules = structuredClone(tampered);
  oldRules.ruleset = RULESET_VERSION - 1;
  assert.match(reference(oldRules, APP_VERSION).why, /Regelversion/);
  assert.match(reference(oldRules, APP_VERSION).why, /nicht mehr gelten/);

  // Same rule version, older build: a rule changed and nobody raised the
  // version. That is the case that has to be pointed at, not swallowed.
  const older = reference(tampered, '0.0.1');
  assert.match(older.why, /0\.0\.1/);
  assert.match(older.why, /RULESET_VERSION/);

  // Same build and same rules: then the simulation is not deterministic, which
  // is a fault in the game and must not be blamed on the protocol.
  const same = reference(tampered, APP_VERSION);
  assert.match(same.why, /nicht deterministisch/);
  assert.doesNotMatch(same.why, /RULESET_VERSION/);
});

test('the build stamp comes back from parsing, so the tools can report it', () => {
  const run = playBotMatch({ seed: 'REFSTAMP', strategy: 'simple' });
  const parsed = parseProtocol(JSON.stringify(exportProtocol(run.log, 1759000000000)));
  assert.ok(parsed.ok);
  assert.equal(parsed.app, APP_VERSION);
  assert.equal(parsed.exported, 1759000000000);

  // A bare match carries no wrapper, and must not pretend to.
  const bare = parseProtocol(run.log);
  assert.ok(bare.ok);
  assert.equal(bare.app, null);
  assert.equal(bare.exported, null);
});
