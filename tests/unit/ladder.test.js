// The upgrade instead of a salvo in King of the Hill (M7b, B5): upgrade.kind 'ladder'.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../../src/core/state.js';
import { addTower } from '../../src/sim/towers.js';
import { canUpgradeTower, upgradeTower } from '../../src/sim/actions.js';
import { toggleZone } from '../../src/sim/zones.js';
import { startLog } from '../../src/sim/record.js';
import { isBlocked } from '../../src/sim/grid.js';
import { MAX_RANK } from '../../src/data/ranks.js';
import { MODES } from '../../src/data/modes.js';
import { RULESET_VERSION } from '../../src/data/rules.js';

/** A fresh King of the Hill match with one flame emplacement of `rank` on a free cell. */
function ready({ rank = 1, requisition = 5000, mode = 'koth' } = {}) {
  const state = createGameState('LEITER', { mode });
  startLog(state, RULESET_VERSION, 1);
  state.requisition = requisition;
  const cell = freeCell(state);
  const tower = addTower(state, { ...cell, doctrine: 'flame', rank });
  return { state, tower };
}

function freeCell(state) {
  const { map } = state;
  for (let y = 2; y < map.size - 2; y++) {
    for (let x = 2; x < map.size - 2; x++) {
      if (!isBlocked(map.grid, x, y) && !map.protected[y * map.size + x]) return { x, y };
    }
  }
  throw new Error('no free cell');
}

test('allowed from wave 1, for the price on the ladder, one rank up', () => {
  for (const [rank, price] of [[1, 120], [2, 300], [3, 750], [4, 1875]]) {
    const { state, tower } = ready({ rank, requisition: 2000 });
    assert.equal(state.wave, 0, 'wave 1 is ahead');
    assert.deepEqual(canUpgradeTower(state, tower.id), { ok: true, cost: price, tower });
    const result = upgradeTower(state, tower.id);
    assert.equal(result.ok, true);
    assert.equal(tower.rank, rank + 1);
    assert.equal(state.requisition, 2000 - price);
  }
  assert.deepEqual(MODES.koth.upgrade.prices, [120, 300, 750, 1875]);
});

test('no salvo, no capsule, no new rubble, and the wave starts at once', () => {
  const { state, tower } = ready();
  const rubble = state.map.obstacles.length;
  upgradeTower(state, tower.id);
  assert.equal(state.phase, 'wave');
  assert.equal(state.wave, 1);
  assert.equal(state.pods.length, 0);
  assert.equal(state.map.obstacles.length, rubble);
  assert.ok(state.spawns.length > 0, 'the wave is queued');
});

test('refused with a marked landing zone, at Legende, without the requisition, on a special', () => {
  const { state, tower } = ready();
  toggleZone(state, freeCell(state));
  assert.equal(canUpgradeTower(state, tower.id).reason, 'zones');

  assert.equal(canUpgradeTower(ready({ rank: MAX_RANK }).state, 2).reason, 'tower', 'unknown id');
  const top = ready({ rank: MAX_RANK });
  assert.equal(canUpgradeTower(top.state, top.tower.id).reason, 'max');
  const poor = ready({ requisition: 119 });
  assert.equal(canUpgradeTower(poor.state, poor.tower.id).reason, 'funds');
  assert.equal(poor.state.phase, 'planning', 'a refusal changes nothing');

  const special = ready();
  special.tower.special = 'inferno';
  special.tower.rank = null;
  assert.equal(canUpgradeTower(special.state, special.tower.id).reason, 'special');
});

test('outside planning, and in a mode whose rule is another one, nothing is offered', () => {
  const { state, tower } = ready({ mode: 'standard' });
  assert.equal(canUpgradeTower(state, tower.id).reason, 'off', 'the standard upgrade is the pod one');
  const k = ready();
  k.state.phase = 'selection';
  assert.equal(canUpgradeTower(k.state, k.tower.id).reason, 'phase');
});

// The replay of a whole match with upgrades is in tests/unit/koth-replay.test.js,
// with a bot that plays King of the Hill.
test('the upgrade is recorded with the emplacement it raised', () => {
  const { state, tower } = ready({ requisition: 300 });
  upgradeTower(state, tower.id);
  const action = state.log.actions.at(-1);
  assert.equal(action.a, 'upgrade');
  assert.equal(action.towerId, tower.id);
});
