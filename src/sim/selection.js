// The choice after a salvo (GDD sections 3 and 8): keep one tower, merge two or
// four identical pods, or fulfil a recipe. Everything not used becomes rubble.
//
// The result always stands on one pod's cell, the anchor. Which pods count as
// "used" makes no difference to the outcome, because every other pod of the
// salvo turns into rubble anyway.

import { MAX_RANK } from '../data/ranks.js';
import { RECIPES, recipeById } from '../data/recipes.js';
import { computeRoute } from './route.js';
import { addTower, removeTower, towerById } from './towers.js';
import { addRubble, clearRubble, isRubble } from './rubble.js';
import { nextRubbleCost } from './economy.js';
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

  return { keep, merges, recipes };
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
  state.route = computeRoute(state.map);
  state.mapVersion += 1;
  // Counted here rather than in addTower: only a tower the player chose says
  // anything about their taste. The stress test builds without choosing.
  state.builtByDoctrine[tower.doctrine] = (state.builtByDoctrine[tower.doctrine] ?? 0) + 1;
  state.events.push({ type: 'towerBuilt', tower, choice: option.type, cost });
  return { ok: true, tower, cost };
}
