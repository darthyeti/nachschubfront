// The choice after a salvo: keep, merge two or four, fulfil a recipe.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectionOptions, applySelection, mergeGroups, mergeResultRank, findOption } from '../../src/sim/selection.js';
import { addTower } from '../../src/sim/towers.js';
import { isBlocked } from '../../src/sim/grid.js';
import { MAX_RANK } from '../../src/data/ranks.js';
import { mapFromAscii, planningState } from './helpers.js';
import { actionsFor } from '../../src/ui/selection.js';

const OPEN = [
  '..........',
  '.1......2.',
  '..........',
  '..........',
  'R........B',
  '..........',
  '..........',
  '..........',
  '.4......3.',
  '..........',
];

const CELLS = [
  { x: 2, y: 5 },
  { x: 4, y: 6 },
  { x: 6, y: 5 },
  { x: 3, y: 2 },
  { x: 7, y: 7 },
];

/** A state in the selection phase whose pods carry the given contents. */
function selectionState(contents, towers = []) {
  const state = planningState(mapFromAscii(OPEN), { phase: 'selection' });
  state.pods = contents.map(([doctrine, rank], i) => ({
    index: i,
    x: CELLS[i].x,
    y: CELLS[i].y,
    doctrine,
    rank,
    t: 99,
    landed: true,
  }));
  state.zones = state.pods.map(({ x, y }) => ({ x, y }));
  for (const pod of state.pods) state.map.grid.blocked[pod.y * state.map.size + pod.x] = 1;
  for (const [doctrine, rank, x, y] of towers) addTower(state, { x, y, doctrine, rank });
  return state;
}

const FIVE_DIFFERENT = [
  ['flame', 1],
  ['autocannon', 2],
  ['laser', 1],
  ['mortar', 3],
  ['psi', 1],
];

function blockedCount(state) {
  return state.map.grid.blocked.reduce((a, b) => a + b, 0);
}

test('every pod can simply be kept', () => {
  const state = selectionState(FIVE_DIFFERENT);
  const { keep, merges, recipes } = selectionOptions(state);
  assert.equal(keep.length, CELLS.length);
  assert.deepEqual(keep[3], { type: 'keep', anchors: [3], doctrine: 'mortar', rank: 3 });
  assert.equal(merges.length, 0, 'nothing identical');
  assert.equal(recipes.length, 0, 'no ingredient reaches veteran');
});

test('keeping builds one tower and four heaps of rubble', () => {
  const state = selectionState(FIVE_DIFFERENT);
  const before = blockedCount(state);
  const result = applySelection(state, { type: 'keep', anchor: 3 });

  assert.ok(result.ok);
  assert.equal(state.towers.length, 1);
  assert.deepEqual(
    { x: state.towers[0].x, y: state.towers[0].y, doctrine: state.towers[0].doctrine, rank: state.towers[0].rank },
    { x: CELLS[3].x, y: CELLS[3].y, doctrine: 'mortar', rank: 3 },
  );
  assert.equal(state.map.obstacles.filter((o) => o.kind === 'rubble').length, CELLS.length - 1);
  assert.equal(blockedCount(state), before, 'the pods had already blocked their cells');
  for (const cell of CELLS) assert.ok(isBlocked(state.map.grid, cell.x, cell.y), `${cell.x},${cell.y}`);
  assert.equal(state.pods.length, 0);
  assert.equal(state.zones.length, 0);
  assert.ok(state.route, 'route recomputed');
  assert.ok(state.events.some((e) => e.type === 'towerBuilt' && e.choice === 'keep'));
});

test('two identical pods merge one rank up, on the chosen cell', () => {
  const state = selectionState([
    ['tesla', 2],
    ['laser', 1],
    ['tesla', 2],
    ['mortar', 1],
    ['psi', 1],
  ]);
  const { merges } = selectionOptions(state);
  assert.equal(merges.length, 1);
  assert.deepEqual(merges[0], {
    type: 'merge',
    size: 2,
    doctrine: 'tesla',
    rank: 2,
    resultRank: 3,
    anchors: [0, 2],
  });

  assert.ok(applySelection(state, { type: 'merge', size: 2, anchor: 2 }).ok);
  assert.equal(state.towers.length, 1);
  assert.equal(state.towers[0].rank, 3);
  assert.equal(state.towers[0].doctrine, 'tesla');
  assert.deepEqual({ x: state.towers[0].x, y: state.towers[0].y }, CELLS[2]);
  assert.equal(state.map.obstacles.filter((o) => o.kind === 'rubble').length, CELLS.length - 1);
});

test('four identical pods offer both merges and jump two ranks', () => {
  const four = [
    ['flame', 1],
    ['flame', 1],
    ['flame', 1],
    ['flame', 1],
    ['psi', 4],
  ];
  const state = selectionState(four);
  const { merges } = selectionOptions(state);
  assert.deepEqual(merges.map((m) => m.size), [2, 4]);
  assert.deepEqual(merges.map((m) => m.resultRank), [2, 3]);

  assert.ok(applySelection(state, { type: 'merge', size: 4, anchor: 1 }).ok);
  assert.equal(state.towers[0].rank, 3);
  assert.deepEqual({ x: state.towers[0].x, y: state.towers[0].y }, CELLS[1]);
});

test('merging never passes Legend', () => {
  assert.equal(mergeResultRank(4, 2), 5);
  assert.equal(mergeResultRank(5, 2), null);
  assert.equal(mergeResultRank(3, 4), 5);
  assert.equal(mergeResultRank(4, 4), null);

  const state = selectionState([
    ['psi', MAX_RANK],
    ['psi', MAX_RANK],
    ['psi', 4],
    ['psi', 4],
    ['laser', 1],
  ]);
  const sizes = selectionOptions(state).merges.map((m) => `${m.rank}x${m.size}`);
  assert.deepEqual(sizes, ['4x2'], 'only the pair of heroes can merge');
});

test('mergeGroups keeps pod order', () => {
  const groups = mergeGroups([
    { doctrine: 'psi', rank: 1 },
    { doctrine: 'laser', rank: 1 },
    { doctrine: 'psi', rank: 1 },
    { doctrine: 'psi', rank: 2 },
  ]);
  assert.deepEqual(groups.map((g) => g.podIndices), [[0, 2], [1], [3]]);
});

test('a recipe uses pods and standing towers and needs one pod of this salvo', () => {
  // Purge shrine: flame, psi, mortar at veteran. Flame and mortar come from the
  // salvo, psi from a standing tower.
  const state = selectionState(
    [
      ['flame', 2],
      ['mortar', 2],
      ['laser', 1],
      ['tesla', 1],
      ['autocannon', 1],
    ],
    [
      ['psi', 3, 1, 7],
      ['psi', 2, 8, 2],
    ],
  );
  const { recipes } = selectionOptions(state);
  assert.deepEqual(recipes.map((r) => r.recipeId), ['purgeShrine']);
  assert.deepEqual(recipes[0].anchors, [0, 1], 'only the two ingredient pods');
  const cheaper = state.towers.find((t) => t.rank === 2);
  assert.deepEqual(recipes[0].towerIds, [cheaper.id], 'the lowest sufficient rank is consumed');

  assert.ok(applySelection(state, { type: 'recipe', recipeId: 'purgeShrine', anchor: 1 }).ok);
  const special = state.towers.find((t) => t.special);
  assert.equal(special.special, 'purgeShrine');
  assert.equal(special.rank, null);
  assert.equal(special.doctrine, 'flame', 'leading ingredient sets the colour');
  assert.deepEqual({ x: special.x, y: special.y }, CELLS[1]);
  assert.deepEqual(state.towers.map((t) => t.id).includes(cheaper.id), false, 'consumed tower is gone');
  assert.ok(state.towers.some((t) => t.rank === 3), 'the stronger psi tower stays');
  assert.ok(
    state.map.obstacles.some((o) => o.kind === 'rubble' && o.cells[0].x === 8 && o.cells[0].y === 2),
    'the consumed tower left rubble',
  );
  assert.ok(isBlocked(state.map.grid, 8, 2));
});

test('only the recipe actions carry what the preview would darken the map for', () => {
  // Same salvo as above: the purge shrine eats one standing psi tower.
  const state = selectionState(
    [
      ['flame', 2],
      ['mortar', 2],
      ['laser', 1],
      ['tesla', 1],
      ['autocannon', 1],
    ],
    [
      ['psi', 3, 1, 7],
      ['psi', 2, 8, 2],
    ],
  );
  const options = selectionOptions(state);
  const cheaper = state.towers.find((t) => t.rank === 2);
  const actions = actionsFor(options, 0);

  const recipe = actions.find((a) => a.choice.type === 'recipe');
  assert.ok(recipe, 'the recipe is offered on this pod');
  assert.deepEqual(recipe.towerIds, [cheaper.id], 'and names the tower it would eat');
  // Keeping or merging costs no standing emplacement, so there is nothing to show.
  for (const action of actions) {
    if (action.choice.type === 'recipe') continue;
    assert.equal(action.towerIds, undefined, `${action.choice.type} previews nothing`);
  }
});

test('a recipe entirely from standing towers is not offered', () => {
  const state = selectionState(
    [
      ['laser', 1],
      ['laser', 1],
      ['laser', 1],
      ['laser', 1],
      ['laser', 1],
    ],
    [
      ['flame', 2, 1, 7],
      ['psi', 2, 8, 2],
      ['mortar', 2, 2, 8],
    ],
  );
  assert.deepEqual(selectionOptions(state).recipes, []);
});

test('a recipe is not offered while an ingredient is too weak or missing', () => {
  const tooWeak = selectionState(
    [
      ['flame', 1],
      ['psi', 1],
      ['mortar', 1],
      ['laser', 1],
      ['tesla', 1],
    ],
  );
  assert.deepEqual(selectionOptions(tooWeak).recipes, []);

  const missing = selectionState([
    ['flame', 2],
    ['psi', 2],
    ['laser', 2],
    ['laser', 2],
    ['tesla', 2],
  ]);
  assert.deepEqual(selectionOptions(missing).recipes, [], 'no mortar anywhere');
});

test('special towers are not recipe ingredients', () => {
  const state = selectionState(
    [
      ['flame', 2],
      ['psi', 2],
      ['laser', 1],
      ['laser', 1],
      ['tesla', 1],
    ],
    [['mortar', 2, 1, 7]],
  );
  state.towers[0].special = 'purgeShrine';
  state.towers[0].rank = null;
  assert.deepEqual(selectionOptions(state).recipes, []);
});

test('choices that are not offered are refused', () => {
  const state = selectionState(FIVE_DIFFERENT);
  assert.equal(findOption(state, { type: 'merge', size: 2, anchor: 0 }), null);
  assert.deepEqual(applySelection(state, { type: 'merge', size: 2, anchor: 0 }), { ok: false, reason: 'invalid' });
  assert.deepEqual(applySelection(state, { type: 'keep', anchor: 9 }), { ok: false, reason: 'invalid' });
  assert.deepEqual(applySelection(state, { type: 'nope', anchor: 0 }), { ok: false, reason: 'invalid' });
  assert.deepEqual(applySelection(state, { type: 'recipe', recipeId: 'purgeShrine', anchor: 0 }), {
    ok: false,
    reason: 'invalid',
  });
  assert.equal(state.towers.length, 0);

  state.phase = 'planning';
  assert.deepEqual(applySelection(state, { type: 'keep', anchor: 0 }), { ok: false, reason: 'phase' });
});

test('after any choice exactly one tower and four heaps of rubble stand', () => {
  const cases = [
    { contents: FIVE_DIFFERENT, choice: { type: 'keep', anchor: 0 } },
    {
      contents: [
        ['tesla', 2],
        ['tesla', 2],
        ['tesla', 2],
        ['tesla', 2],
        ['psi', 1],
      ],
      choice: { type: 'merge', size: 4, anchor: 3 },
    },
    {
      contents: [
        ['flame', 2],
        ['psi', 2],
        ['mortar', 2],
        ['laser', 1],
        ['tesla', 1],
      ],
      choice: { type: 'recipe', recipeId: 'purgeShrine', anchor: 2 },
    },
  ];
  for (const { contents, choice } of cases) {
    const state = selectionState(contents);
    assert.ok(applySelection(state, choice).ok, choice.type);
    assert.equal(state.towers.length, 1, `${choice.type}: one tower`);
    assert.equal(
      state.map.obstacles.filter((o) => o.kind === 'rubble').length,
      CELLS.length - 1,
      `${choice.type}: four heaps of rubble`,
    );
    assert.equal(state.pods.length, 0, `${choice.type}: salvo cleared`);
  }
});
