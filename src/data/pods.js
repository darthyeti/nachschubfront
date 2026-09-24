// Supply pods: how many land per salvo and how the landing is timed
// (GDD section 3). The staging follows reference/stiltest.html but runs faster:
// the style test plays one salvo for its own sake, here it happens every round.
// salvoSeconds() below is what the player waits; keep an eye on it when tuning.

import { MIN_RANK } from './ranks.js';

/**
 * Pods per salvo and their lowest rank, by wave (GDD section 3). Early on the
 * maze grows faster and the map fills where there is still room; late on fewer
 * new heaps of rubble appear, but every single pod is worth more.
 * `untilWave` is inclusive; the last row covers everything after it.
 */
export const SALVO_SIZES = [
  { untilWave: 15, pods: 6, minRank: MIN_RANK },
  { untilWave: 35, pods: 5, minRank: MIN_RANK },
  { untilWave: Infinity, pods: 4, minRank: 2 },
];

/** The row of SALVO_SIZES that governs a wave. */
export function salvoRules(wave) {
  return SALVO_SIZES.find((row) => wave <= row.untilWave) ?? SALVO_SIZES[SALVO_SIZES.length - 1];
}

/** Landing zones and pods in the salvo for that wave. */
export function salvoSize(wave) {
  return salvoRules(wave).pods;
}

/** Lowest rank a pod of that wave can hold; from wave 36 there are no recruits. */
export function salvoMinRank(wave) {
  return salvoRules(wave).minRank;
}

/** The largest salvo there is, for anything that needs an upper bound. */
export const MAX_SALVO_SIZE = Math.max(...SALVO_SIZES.map((row) => row.pods));

export const PODS = {
  /** Target marker blinks before the pod becomes visible (seconds). */
  warnSeconds: 0.5,
  /**
   * Fall from the sky to the impact. Roughly doubled in v3: at 0.55 s the
   * salvo looked hurried and the impacts ran into one another
   * (docs/ART.md, "Größe und Falldauer").
   */
  fallSeconds: 1.15,
  /**
   * Delay between two pods of the same salvo. Raised only a little while the
   * rest of the sequence grew, so a salvo does not take twice as long as
   * before (decision of 24.09.2026).
   */
  staggerSeconds: 0.3,
  /** After the impact: petals open, then the hologram fades in. */
  openDelaySeconds: 0.9,
  openSeconds: 0.65,
  hologramDelaySeconds: 1.55,
  hologramSeconds: 0.55,

  /**
   * Randomly added zones keep this Manhattan distance to the other zones, so a
   * salvo does not clump into one corner. Dropped when space runs out.
   */
  minRandomDistance: 2,
};

/** Seconds from requesting a salvo of `size` pods until the last one has opened. */
export function salvoSeconds(size = MAX_SALVO_SIZE) {
  return (
    (size - 1) * PODS.staggerSeconds +
    PODS.warnSeconds +
    PODS.fallSeconds +
    PODS.hologramDelaySeconds +
    PODS.hologramSeconds
  );
}
