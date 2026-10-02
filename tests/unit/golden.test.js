// The safety net for refactoring under M6 (M7a, decision of 02.10.2026): a
// change that is not meant to change the game must leave every match exactly as
// it was.
//
// Two kinds of match are fingerprinted. The recorded protocols in
// balancing/protokolle/, replayed under today's rules — most of them no longer
// give the match that was played (docs/PROGRESS.md), but what they give is still
// fixed by the code, and they reach wave 50 with merges, recipes, commands,
// bulwarks and the Koloss. And a few bot matches, which are fast and cover the
// early game from a fresh state.
//
// The fingerprint is a fixed list of fields, not the whole state: a refactoring
// may add a field to the state (M7a adds `mode`), and that alone must not count
// as a different match.
//
// The hashes are renewed only in a commit that raises RULESET_VERSION or says
// outright that it changes the game:
//
//   GOLDEN_WRITE=1 node --test tests/unit/golden.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { parseProtocol } from '../../src/storage/protocol.js';
import { replayMatch } from '../../src/sim/replay.js';
import { playBotMatch } from '../tools/bot-player.mjs';

const PROTOCOLS = new URL('../../balancing/protokolle/', import.meta.url);
const EXPECTED = new URL('./golden.json', import.meta.url);

/** Fast strategies only: the maze bot takes twenty seconds a match. */
const BOTS = [
  { seed: 'GOLDEN', strategy: 'simple' },
  { seed: 'GOLDEN', strategy: 'firepower' },
  { seed: 'GOLDEN', strategy: 'recipes' },
];

/** Everything about the end of a match that tells two matches apart. */
function fingerprint(state, waves) {
  const print = {
    phase: state.phase,
    wave: state.wave,
    lives: state.lives,
    requisition: state.requisition,
    commandPoints: state.commandPoints,
    supplyLevel: state.supplyLevel,
    kills: state.kills,
    demolished: state.demolished,
    towers: state.towers.map((t) => [t.id, t.x, t.y, t.doctrine, t.rank, t.special ?? null, t.damage]),
    obstacles: state.map.obstacles.map((o) => [o.kind, o.cells]),
    blocked: [...state.map.grid.blocked],
    waves,
  };
  return createHash('sha256').update(JSON.stringify(print)).digest('hex');
}

function actual() {
  const out = {};
  for (const file of readdirSync(PROTOCOLS).filter((f) => f.endsWith('.json')).sort()) {
    const parsed = parseProtocol(readFileSync(new URL(file, PROTOCOLS), 'utf8'));
    assert.ok(parsed.ok, `${file} lässt sich nicht lesen`);
    const { state, waves } = replayMatch(parsed.match);
    out[`protocol ${file}`] = fingerprint(state, waves);
  }
  for (const { seed, strategy } of BOTS) {
    const { state, waves } = playBotMatch({ seed, strategy });
    out[`bot ${strategy} ${seed}`] = fingerprint(state, waves);
  }
  return out;
}

test('every match plays exactly as before', () => {
  const now = actual();
  if (process.env.GOLDEN_WRITE) {
    writeFileSync(EXPECTED, `${JSON.stringify(now, null, 2)}\n`);
    return;
  }
  const expected = JSON.parse(readFileSync(EXPECTED, 'utf8'));
  assert.deepEqual(Object.keys(now).sort(), Object.keys(expected).sort(), 'Andere Partien als beim letzten Festhalten');
  for (const [name, hash] of Object.entries(expected)) {
    assert.equal(now[name], hash, `${name} spielt sich anders als festgehalten`);
  }
});
