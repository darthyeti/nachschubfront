// Supply pods (GDD sections 3 and 7): contents, timeline and landing.

import { createRng } from '../core/random.js';
import { DOCTRINE_IDS } from '../data/doctrines.js';
import { supplyWeights } from '../data/supply.js';
import { PODS } from '../data/pods.js';
import { MAX_RANK } from '../data/ranks.js';
import { setBlocked } from './grid.js';
import { computeRoute } from './route.js';
import { takeSupplyBonus } from './commands.js';

/**
 * Random stream of the salvo that prepares the next wave. Derived from the seed
 * and the wave number only, so neither the player's markers nor earlier choices
 * shift the contents.
 */
export function salvoRng(state) {
  return createRng(state.seed).fork('pods').fork(String(state.wave + 1));
}

/** Draws a rank from the supply level's percentages (GDD section 7). */
export function rollRank(rng, supplyLevel) {
  const weights = supplyWeights(supplyLevel);
  let roll = rng.next() * 100;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) return i + 1;
  }
  // Only reachable through floating point dust at the very top of the range.
  return weights.findLastIndex((w) => w > 0) + 1;
}

/** One pod's contents: doctrine and rank. Draw order is fixed for determinism. */
export function rollPod(rng, supplyLevel) {
  const doctrine = rng.pick(DOCTRINE_IDS);
  const rank = rollRank(rng, supplyLevel);
  return { doctrine, rank };
}

/**
 * Creates the pods for the marked zones. `t` is each pod's own clock: it starts
 * negative so the pods arrive staggered, the impact is at warn + fall.
 */
export function createPods(state) {
  const rng = salvoRng(state).fork('contents');
  // Priorisierter Nachschub raises every rank of this salvo by one. The draw
  // itself is untouched, so the seed still decides what is in the pods.
  const bonus = takeSupplyBonus(state);
  const raise = (pod) => ({ ...pod, rank: Math.min(MAX_RANK, pod.rank + bonus) });
  state.pods = state.zones.map((zone, i) => ({
    index: i,
    x: zone.x,
    y: zone.y,
    ...raise(rollPod(rng, state.supplyLevel)),
    t: -i * PODS.staggerSeconds,
    landed: false,
  }));
  return state.pods;
}

export const IMPACT_SECONDS = PODS.warnSeconds + PODS.fallSeconds;

/** Seconds since the pod hit the ground; negative while it is still falling. */
export function sinceImpact(pod) {
  return pod.t - IMPACT_SECONDS;
}

export function podsLanded(state) {
  return state.pods.every((p) => p.landed);
}

/** True once every pod has landed and shown its hologram. */
export function salvoDone(state) {
  return state.pods.every((p) => sinceImpact(p) >= PODS.hologramDelaySeconds + PODS.hologramSeconds);
}

/**
 * Advances the salvo. A pod blocks its cell on impact, so the maze visibly
 * closes while the salvo lands.
 */
export function updatePods(state, dt) {
  let landings = 0;
  for (const pod of state.pods) {
    pod.t += dt;
    if (!pod.landed && pod.t >= IMPACT_SECONDS) {
      pod.landed = true;
      setBlocked(state.map.grid, pod.x, pod.y, true);
      landings++;
      state.events.push({ type: 'podImpact', x: pod.x, y: pod.y, index: pod.index });
    }
  }
  if (landings > 0) {
    state.route = computeRoute(state.map);
    state.mapVersion += 1;
  }
}

export function podAt(state, cell) {
  return state.pods.find((p) => p.x === cell.x && p.y === cell.y) ?? null;
}

export { PODS };
