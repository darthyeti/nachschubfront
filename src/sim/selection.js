// The choice after a salvo (GDD sections 3, 8 and 11): keep one tower, merge two
// or four identical pods, fulfil a recipe, or — late in the match — put a capsule
// into an emplacement that already stands and raise it a rank. Everything not
// used becomes rubble.
//
// The result always stands on one pod's cell, the anchor. Which pods count as
// "used" makes no difference to the outcome, because every other pod of the
// salvo turns into rubble anyway.

import { MAX_RANK } from '../data/ranks.js';
import { RECIPES, recipeById } from '../data/recipes.js';
import { currentRoute } from './route.js';
import { addTower, removeTower, towerById } from './towers.js';
import { addRubble, clearRubble, isRubble } from './rubble.js';
import { nextRubbleCost } from './economy.js';
import { ECONOMY, upgradeCost } from '../data/economy.js';
import { clearZones } from './zones.js';

/** Pods of the salvo grouped by doctrine and rank, in pod order. */
export function mergeGroups(pods) {
  const groups = new Map();
  pods.forEach((pod, index) => {
    const key = `${pod.doctrine}:${pod.rank}`;
    if (!groups.has(key)) groups.set(key, { doctrine: pod.doctrine, rank: pod.rank, podIndices: [] });
    groups.get(key).podIndices.push(index);
  });
  return [...groups.values()];
}

/** Rank a merge of `size` identical pods produces, or null if it would pass Legend. */
export function mergeResultRank(rank, size) {
  const gain = size === 4 ? 2 : 1;
  return rank + gain <= MAX_RANK ? rank + gain : null;
}

function podsFor(pods, doctrine, minRank) {
  const indices = [];
  pods.forEach((pod, index) => {
    if (pod.doctrine === doctrine && pod.rank >= minRank) indices.push(index);
  });
  return indices;
}

/**
 * Standing tower that is consumed for an ingredient: the lowest rank that is
 * good enough, the oldest one if two are equal. Special towers are not
 * ingredients.
 */
function cheapestTower(towers, doctrine, minRank) {
  let best = null;
  for (const tower of towers) {
    if (tower.special || tower.doctrine !== doctrine || tower.rank < minRank) continue;
    if (!best || tower.rank < best.rank || (tower.rank === best.rank && tower.id < best.id)) best = tower;
  }
  return best;
}

/**
 * Checks one recipe against this salvo plus the standing towers.
 * Pods are preferred over towers, because unused pods are lost anyway while a
 * consumed tower is a real loss.
 * @returns {{type: 'recipe', recipeId: string, anchors: number[], towerIds: number[]} | null}
 */
export function recipeOption(state, recipe) {
  const anchors = new Set();
  const towerIds = [];
  for (const doctrine of recipe.ingredients) {
    const pods = podsFor(state.pods, doctrine, recipe.minRank);
    if (pods.length > 0) {
      for (const index of pods) anchors.add(index);
      continue;
    }
    const tower = cheapestTower(state.towers, doctrine, recipe.minRank);
    if (!tower) return null;
    towerIds.push(tower.id);
  }
  // GDD section 8: at least one ingredient has to come from this salvo.
  if (anchors.size === 0) return null;
  return { type: 'recipe', recipeId: recipe.id, anchors: [...anchors].sort((a, b) => a - b), towerIds };
}

/**
 * Every choice the player has for the current salvo.
 * @returns {{keep: object[], merges: object[], recipes: object[]}}
 */
export function selectionOptions(state) {
  const keep = state.pods.map((pod, index) => ({
    type: 'keep',
    anchors: [index],
    doctrine: pod.doctrine,
    rank: pod.rank,
  }));

  const merges = [];
  for (const group of mergeGroups(state.pods)) {
    for (const size of [2, 4]) {
      if (group.podIndices.length < size) continue;
      const resultRank = mergeResultRank(group.rank, size);
      if (resultRank === null) continue;
      merges.push({
        type: 'merge',
        size,
        doctrine: group.doctrine,
        rank: group.rank,
        resultRank,
        anchors: group.podIndices,
      });
    }
  }

  const recipes = [];
  for (const recipe of RECIPES) {
    const option = recipeOption(state, recipe);
    if (option) recipes.push(option);
  }

  return { keep, merges, recipes, upgrades: upgradeKind(state).selectionOptions(state) };
}

/**
 * What each `upgrade.kind` of a mode record does (src/data/modes.js). One entry
 * per rule, looked up rather than branched on, so a mode with another rule adds
 * an entry and leaves the others alone.
 *
 * - `pod`: a capsule of the salvo goes into a standing emplacement (GDD section
 *   11), offered in the selection phase.
 * - `ladder`: an emplacement goes up a rank for a price in planning, instead of
 *   the salvo (M7b, B5; sim/actions.js, upgradeTower).
 * - `free`: the same without a price, a test lever.
 *
 * `planningCost(state, tower)` is the price of that upgrade in planning, or null
 * where the rule offers none.
 * - `off`: no upgrades.
 */
export const UPGRADE_KINDS = {
  pod: { selectionOptions: upgradeOptions, planningCost: () => null },
  // Instead of a salvo, in planning (M7b, B5); nothing is offered in the selection.
  ladder: {
    selectionOptions: () => [],
    planningCost: (state, tower) => state.mode.upgrade.prices[tower.rank - 1] ?? null,
  },
  // A test lever from the study: free upgrades early on replace the salvoes and
  // spoil the game (B5). Never the value of a mode a player gets.
  free: { selectionOptions: () => [], planningCost: () => 0 },
  off: { selectionOptions: () => [], planningCost: () => null },
};

/** The upgrade rule of the running mode. */
export function upgradeKind(state) {
  const kind = state.mode?.upgrade?.kind ?? 'pod';
  const rule = UPGRADE_KINDS[kind];
  if (!rule) throw new Error(`Unknown upgrade kind: ${kind}`);
  return rule;
}

/**
 * Putting a capsule into an emplacement that already stands, for one rank (GDD
 * section 11).
 *
 * Two conditions beyond the doctrine, and both are the point of the option
 * rather than decoration:
 *
 * - **The capsule may not outrank what it improves downward.** A recruit does not
 *   promote a hero, so `pod.rank >= tower.rank`. Without it every low capsule
 *   would be worth more poured into a legend than built anywhere, and there would
 *   be no reason left to merge.
 * - **It costs requisition, rising steeply with the rank reached.** The reason
 *   this option exists at all is that late requisition had nowhere to go; an
 *   upgrade that were free would fix the boredom and leave the purse full.
 *
 * Special emplacements are not upgraded: they have no rank (selection.js builds
 * them with `rank: null`), and a recipe is not a step on the same ladder.
 */
function upgradeOptions(state) {
  // `state.wave` is the last wave fought, so the one this salvo is arming for is
  // the next one. Read the other way round the option would first appear in the
  // selection phase leading into wave 31, not 30.
  if (state.wave + 1 < ECONOMY.upgradeFromWave) return [];
  const options = [];
  state.pods.forEach((pod, index) => {
    // One option per rank step, not one per emplacement: by wave 30 a player has
    // a couple of dozen of them and a list of twenty buttons is not a choice.
    // What is actually being decided is which rank to put the capsule into; which
    // emplacement of that rank is settled the way a recipe settles it, by taking
    // the oldest, and the map shows which one it is before the tap lands.
    const byRank = new Map();
    for (const tower of state.towers) {
      if (tower.special || tower.doctrine !== pod.doctrine) continue;
      if (tower.rank >= MAX_RANK || pod.rank < tower.rank) continue;
      const held = byRank.get(tower.rank);
      if (!held || tower.id < held.id) byRank.set(tower.rank, tower);
    }
    for (const tower of [...byRank.values()].sort((a, b) => b.rank - a.rank)) {
      options.push({
        type: 'upgrade',
        anchors: [index],
        towerId: tower.id,
        doctrine: pod.doctrine,
        rank: tower.rank,
        resultRank: tower.rank + 1,
        cost: upgradeCost(tower.rank + 1),
      });
    }
  });
  return options;
}

/**
 * What building on that pod's cell costs on top of nothing: a landing zone may
 * lie on rubble, and the heap is torn down and paid for only if this is the pod
 * the player builds (GDD section 3). Zero for a free cell.
 */
export function anchorCost(state, anchorIndex) {
  const pod = state.pods[anchorIndex];
  if (!pod || !isRubble(state.map, pod)) return 0;
  return nextRubbleCost(state);
}

/** True if the player can pay for building on that pod's cell. */
export function canAffordAnchor(state, anchorIndex) {
  return state.requisition >= anchorCost(state, anchorIndex);
}

/**
 * True if at least one capsule of the salvo can be built on. A capsule on free
 * ground always can, so this only ever comes out false when every one of them
 * stands on a heap of rubble the purse cannot clear — which the marking rule
 * prevents, except on a map so full that the random fill had nothing else left
 * (sim/zones.js). Then the salvo can only be given up (sim/actions.js).
 */
export function salvoBuildable(state) {
  return state.pods.some((_, index) => canAffordAnchor(state, index));
}

/** Looks up the option a choice refers to, or null if the choice is not offered. */
export function findOption(state, choice) {
  const options = selectionOptions(state);
  if (choice.type === 'keep') {
    return options.keep.find((o) => o.anchors[0] === choice.anchor) ?? null;
  }
  if (choice.type === 'merge') {
    return options.merges.find((o) => o.size === choice.size && o.anchors.includes(choice.anchor)) ?? null;
  }
  if (choice.type === 'recipe') {
    return options.recipes.find((o) => o.recipeId === choice.recipeId && o.anchors.includes(choice.anchor)) ?? null;
  }
  if (choice.type === 'upgrade') {
    return options.upgrades.find((o) => o.towerId === choice.towerId && o.anchors[0] === choice.anchor) ?? null;
  }
  return null;
}

/**
 * Applies a choice: one tower is built on the anchor pod's cell, every other pod
 * of the salvo and every consumed tower become rubble.
 * @param {{type: 'keep'|'merge'|'recipe', anchor: number, size?: number, recipeId?: string}} choice
 * @returns {{ok: true, tower: object, cost: number} | {ok: false, reason: 'phase' | 'invalid' | 'funds'}}
 */
export function applySelection(state, choice) {
  if (state.phase !== 'selection') return { ok: false, reason: 'phase' };
  const option = findOption(state, choice);
  if (!option) return { ok: false, reason: 'invalid' };

  // An upgrade builds nothing, so it pays no ground and clears no heap: the
  // capsule goes into an emplacement somewhere else on the map and every capsule
  // of the salvo, the chosen one included, becomes rubble where it stands.
  if (option.type === 'upgrade') return applyUpgrade(state, option);

  // Refused rather than paid into the red: the other pods of the salvo stay
  // open, and one of them stands on a free cell.
  if (!canAffordAnchor(state, choice.anchor)) return { ok: false, reason: 'funds' };

  const anchorPod = state.pods[choice.anchor];
  // The heap under the chosen pod is cleared and billed here, and only here.
  const cost = anchorCost(state, choice.anchor);
  if (cost > 0) {
    clearRubble(state, anchorPod);
    state.requisition -= cost;
    state.demolished += 1;
  }
  let tower;
  if (option.type === 'recipe') {
    const recipe = recipeById(option.recipeId);
    tower = addTower(state, {
      x: anchorPod.x,
      y: anchorPod.y,
      // The leading ingredient gives the special tower its guide colour.
      doctrine: recipe.ingredients[0],
      rank: null,
      special: recipe.id,
    });
    for (const id of option.towerIds) {
      const consumed = towerById(state, id);
      removeTower(state, id);
      addRubble(state, consumed);
    }
  } else {
    tower = addTower(state, {
      x: anchorPod.x,
      y: anchorPod.y,
      doctrine: anchorPod.doctrine,
      rank: option.type === 'merge' ? option.resultRank : anchorPod.rank,
    });
  }

  for (const pod of state.pods) {
    // A pod that came down on rubble and was not chosen leaves the heap where
    // it was; adding a second one would stack two obstacles on one cell.
    if (pod.index !== anchorPod.index && !isRubble(state.map, pod)) addRubble(state, pod);
  }

  state.pods = [];
  clearZones(state);
  state.route = currentRoute(state);
  state.mapVersion += 1;
  // Counted here rather than in addTower: only a tower the player chose says
  // anything about their taste. The stress test builds without choosing.
  state.builtByDoctrine[tower.doctrine] = (state.builtByDoctrine[tower.doctrine] ?? 0) + 1;
  state.events.push({ type: 'towerBuilt', tower, choice: option.type, cost });
  return { ok: true, tower, cost };
}

/**
 * Raises a standing emplacement by one rank and turns the whole salvo to rubble.
 *
 * Kept apart from the building path rather than folded into it, because almost
 * nothing about it is the same: no cell is built on, no heap under the anchor is
 * cleared or billed, and the capsule that was chosen becomes rubble like the rest
 * of the salvo instead of becoming an emplacement.
 */
function applyUpgrade(state, option) {
  if (state.requisition < option.cost) return { ok: false, reason: 'funds' };
  const tower = towerById(state, option.towerId);
  // The option was read from this state a line ago, so this cannot happen; it is
  // here so that a future caller passing a stale option is refused rather than
  // silently spending the requisition.
  if (!tower || tower.rank !== option.rank) return { ok: false, reason: 'invalid' };

  state.requisition -= option.cost;
  tower.rank = option.resultRank;

  for (const pod of state.pods) {
    if (!isRubble(state.map, pod)) addRubble(state, pod);
  }
  state.pods = [];
  clearZones(state);
  state.route = currentRoute(state);
  state.mapVersion += 1;
  state.events.push({ type: 'towerUpgraded', tower, cost: option.cost });
  return { ok: true, tower, cost: option.cost };
}

/**
 * Gives the salvo up without building anything: the way out when not one capsule
 * of it can be paid for. GDD section 3 says every capsule not used becomes
 * rubble — here none is used, so all of them do, and the heaps the capsules came
 * down on stay as they were.
 *
 * The round goes on from there. Nothing else can: the purse only refills during
 * a wave, and every way of spending or clearing belongs to the planning phase.
 *
 * @param {{force?: boolean}} [options]  `force` skips the check that nothing can
 *   be built. Only the replay passes it: a protocol that says the salvo was
 *   given up is repeating a decision already made, and under changed numbers
 *   something in that salvo may have become affordable again.
 * @returns {{ok: true, rubble: number} | {ok: false, reason: 'phase' | 'buildable'}}
 */
export function forfeitSalvo(state, { force = false } = {}) {
  if (state.phase !== 'selection') return { ok: false, reason: 'phase' };
  // Only ever a last resort, never a way of turning a salvo into a maze.
  if (!force && salvoBuildable(state)) return { ok: false, reason: 'buildable' };
  let rubble = 0;
  for (const pod of state.pods) {
    if (isRubble(state.map, pod)) continue;
    addRubble(state, pod);
    rubble++;
  }
  state.pods = [];
  clearZones(state);
  state.route = currentRoute(state);
  state.mapVersion += 1;
  state.events.push({ type: 'salvoForfeited', rubble });
  return { ok: true, rubble };
}
