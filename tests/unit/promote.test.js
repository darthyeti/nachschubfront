// Promoting (GDD section 11, ruleset 9, issue 85): in planning, a standing
// emplacement goes up a rank for requisition alone. From supply level 8, once
// per planning phase. The capsule upgrade is gone from ruleset 9 on and stays
// only for protocols of ruleset 8, which must replay as they were played.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../../src/core/state.js';
import { addTower } from '../../src/sim/towers.js';
import { canUpgradeTower, upgradeTower, requestSalvo, chooseSelection } from '../../src/sim/actions.js';
import { selectionOptions, upgradeKind } from '../../src/sim/selection.js';
import { stepSimulation } from '../../src/sim/step.js';
import { toggleZone, canMarkZone } from '../../src/sim/zones.js';
import { grant, setLives } from '../../src/sim/debug.js';
import { startLog } from '../../src/sim/record.js';
import { replayMatch, compareWaves } from '../../src/sim/replay.js';
import { isBlocked } from '../../src/sim/grid.js';
import { ECONOMY } from '../../src/data/economy.js';
import { MAX_RANK } from '../../src/data/ranks.js';
import { MODES } from '../../src/data/modes.js';
import { RULESET_VERSION, LEGACY_RULESET } from '../../src/data/rules.js';
import { SIM_STEP } from '../../src/data/settings.js';

function freeCell(state, skip = 0) {
  const { map } = state;
  let seen = 0;
  for (let y = 2; y < map.size - 2; y++) {
    for (let x = 2; x < map.size - 2; x++) {
      if (!isBlocked(map.grid, x, y) && !map.protected[y * map.size + x] && seen++ >= skip) return { x, y };
    }
  }
  throw new Error('no free cell');
}

/** A standard match in planning with one flame emplacement of `rank`. */
function ready({ rank = 1, requisition = 5000, supply = 8, ruleset } = {}) {
  const state = createGameState('BEFOERDERN', ruleset === undefined ? undefined : { ruleset });
  startLog(state, state.ruleset, 1);
  state.supplyLevel = supply;
  state.requisition = requisition;
  const tower = addTower(state, { ...freeCell(state), doctrine: 'flame', rank });
  return { state, tower };
}

test('ruleset 9: the standard mode promotes, the capsule upgrade is gone', () => {
  assert.equal(RULESET_VERSION, 9);
  const { state } = ready();
  assert.equal(state.ruleset, 9);
  assert.equal(upgradeKind(state), upgradeKind({ ...state, mode: { upgrade: { kind: 'pod' } } }));
  assert.equal(upgradeKind(state).startsWave, false);
  // Even late and rich, nothing is offered with a capsule any more.
  state.wave = 39;
  state.phase = 'selection';
  state.pods = [{ index: 0, x: 1, y: 1, doctrine: 'flame', rank: 4, landed: true }];
  assert.deepEqual(selectionOptions(state).upgrades, []);
});

test('ruleset 8 keeps the capsule upgrade and no promoting', () => {
  const { state, tower } = ready({ ruleset: LEGACY_RULESET });
  assert.equal(upgradeKind(state).startsWave, undefined);
  assert.equal(canUpgradeTower(state, tower.id).reason, 'off');
});

test('the prices are 180, 450, 1100 and 2800 for the rank reached', () => {
  assert.deepEqual(ECONOMY.promote.prices, [180, 450, 1100, 2800]);
  for (let rank = 1; rank < MAX_RANK; rank++) {
    const { state, tower } = ready({ rank });
    const check = canUpgradeTower(state, tower.id);
    assert.ok(check.ok, `rank ${rank}`);
    assert.equal(check.cost, ECONOMY.promote.prices[rank - 1]);
  }
});

test('promoting raises one rank, takes the price, and keeps the planning phase and the salvo', () => {
  const { state, tower } = ready({ rank: 2, requisition: 1000 });
  const mapVersion = state.mapVersion;
  const result = upgradeTower(state, tower.id);
  assert.ok(result.ok);
  assert.equal(tower.rank, 3);
  assert.equal(state.requisition, 1000 - ECONOMY.promote.prices[1], 'rank 2 to 3 costs the Elite price');
  assert.equal(state.phase, 'planning', 'the round goes on');
  assert.equal(state.pods.length, 0, 'no capsule is used or made rubble');
  assert.ok(state.mapVersion > mapVersion);
  assert.equal(state.log.actions.at(-1).a, 'promote');
  assert.equal(state.log.actions.at(-1).towerId, tower.id);
  // And the salvo can still be requested.
  assert.ok(requestSalvo(state));
});

test('marked landing zones do not stand in the way', () => {
  const { state, tower } = ready();
  const cell = freeCell(state, 40);
  if (canMarkZone(state, cell).ok) toggleZone(state, cell);
  assert.ok(canUpgradeTower(state, tower.id).ok);
});

test('locked below supply level 8, with the reason', () => {
  const { state, tower } = ready({ supply: ECONOMY.promote.fromSupplyLevel - 1 });
  assert.deepEqual(canUpgradeTower(state, tower.id), { ok: false, reason: 'supply' });
  state.supplyLevel = ECONOMY.promote.fromSupplyLevel;
  assert.ok(canUpgradeTower(state, tower.id).ok);
});

test('once per planning phase, again in the next round', () => {
  const { state, tower } = ready({ rank: 1 });
  const second = addTower(state, { ...freeCell(state, 5), doctrine: 'tesla', rank: 1 });
  assert.ok(upgradeTower(state, tower.id).ok);
  assert.equal(canUpgradeTower(state, second.id).reason, 'once');
  assert.equal(upgradeTower(state, second.id).reason, 'once');
  assert.equal(second.rank, 1, 'nothing was changed or paid');
  state.wave += 1; // the next round
  assert.ok(canUpgradeTower(state, second.id).ok);
});

test('locked without enough requisition, on a legend, on a special emplacement, outside planning', () => {
  const poor = ready({ rank: 3, requisition: ECONOMY.promote.prices[2] - 1 });
  assert.equal(canUpgradeTower(poor.state, poor.tower.id).reason, 'funds');
  assert.equal(upgradeTower(poor.state, poor.tower.id).reason, 'funds');
  assert.equal(poor.tower.rank, 3);
  assert.equal(poor.state.requisition, ECONOMY.promote.prices[2] - 1, 'nothing taken');

  const top = ready({ rank: MAX_RANK });
  assert.equal(canUpgradeTower(top.state, top.tower.id).reason, 'max');

  const special = ready();
  special.tower.special = 'inferno';
  special.tower.rank = null;
  assert.equal(canUpgradeTower(special.state, special.tower.id).reason, 'special');

  const busy = ready();
  busy.state.phase = 'selection';
  assert.equal(canUpgradeTower(busy.state, busy.tower.id).reason, 'phase');
  assert.equal(canUpgradeTower(busy.state, 9999).reason, 'phase');

  const empty = ready();
  assert.equal(canUpgradeTower(empty.state, 9999).reason, 'tower');
});

test('a promoted emplacement counts with its new rank', () => {
  const { state, tower } = ready({ rank: 1 });
  upgradeTower(state, tower.id);
  assert.equal(state.towers.find((t) => t.id === tower.id).rank, 2);
});

test('King of the Hill keeps its own ladder', () => {
  const state = createGameState('LEITER', { mode: 'koth' });
  assert.equal(MODES.koth.upgrade.kind, 'ladder');
  assert.equal(upgradeKind(state).startsWave, undefined, 'it still starts the wave');
});

function runUntil(state, until, maxSeconds = 600) {
  for (let i = 0; i < Math.round(maxSeconds / SIM_STEP); i++) {
    stepSimulation(state, SIM_STEP);
    if (until(state)) return true;
  }
  return false;
}

/** Three rounds from supply level 8: promote when affordable, one salvo, one kept capsule. */
function recordMatch() {
  const state = createGameState('BEFOERDERT');
  state.supplyLevel = 8;
  startLog(state, state.ruleset, 1);
  for (let round = 0; round < 3; round++) {
    grant(state, { requisition: 3000 });
    const tower = state.towers.find((t) => !t.special && t.rank < MAX_RANK);
    if (tower) assert.ok(upgradeTower(state, tower.id).ok);
    for (const step of state.route.cells) {
      const cell = { x: step.x + 1, y: step.y };
      if (canMarkZone(state, cell).ok) {
        toggleZone(state, cell);
        break;
      }
    }
    assert.ok(requestSalvo(state));
    assert.ok(runUntil(state, (s) => s.phase === 'selection', 60));
    const options = selectionOptions(state);
    assert.ok(chooseSelection(state, { type: 'keep', anchor: options.keep.at(-1).anchors[0] }).ok);
    setLives(state, 200);
    assert.ok(runUntil(state, (s) => s.phase !== 'wave'));
    runUntil(state, (s) => s.phase === 'planning', 10);
  }
  return state.log;
}

test('a match with promotions replays wave for wave', () => {
  const log = recordMatch();
  assert.equal(log.ruleset, 9);
  const promotions = log.actions.filter((a) => a.a === 'promote');
  assert.equal(promotions.length, 2, 'rounds two and three had an emplacement to raise');
  const run = replayMatch(log);
  assert.deepEqual(run.skipped, []);
  assert.equal(run.applied, log.actions.length);
  assert.deepEqual(compareWaves(log.waves, run.waves), []);
  assert.deepEqual(run.waves, log.waves);
});

test('a match of ruleset 8 replays with the old rule, a promotion is not applied there', () => {
  const log = recordMatch();
  const old = JSON.parse(JSON.stringify(log));
  old.ruleset = LEGACY_RULESET;
  const run = replayMatch(old);
  assert.equal(run.state.ruleset, LEGACY_RULESET);
  // Without the rule the promotions are refused, say why, and the rest goes on.
  const refused = run.skipped.filter((s) => s.a === 'promote');
  assert.equal(refused.length, 2);
  assert.ok(refused.every((s) => s.why === 'promotion refused: off'));
  assert.equal(run.waves.length, log.waves.length, 'the match still ran through');
});

test('a protocol without a ruleset number is read as ruleset 8', () => {
  const log = recordMatch();
  const old = JSON.parse(JSON.stringify(log));
  delete old.ruleset;
  assert.equal(replayMatch(old).state.ruleset, LEGACY_RULESET);
});

test('a real protocol of ruleset 8 with a capsule upgrade still replays wave for wave', async () => {
  const { readFileSync } = await import('node:fs');
  const { parseProtocol } = await import('../../src/storage/protocol.js');
  const file = new URL('../../balancing/protokolle/nachschubfront-2026-11-04-F7SZGZ-welle38.json', import.meta.url);
  const log = parseProtocol(readFileSync(file, 'utf8')).match;
  assert.equal(log.ruleset, LEGACY_RULESET);
  assert.ok(log.actions.some((a) => a.a === 'select' && a.type === 'upgrade'), 'it holds a capsule upgrade');
  const run = replayMatch(log);
  assert.deepEqual(compareWaves(log.waves, run.waves), []);
});
