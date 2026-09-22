// Supply pods: how many land per salvo and how the landing is timed
// (GDD section 3). The staging follows reference/stiltest.html but runs faster:
// the style test plays one salvo for its own sake, here it happens every round.
// SALVO_SECONDS below is what the player waits; keep an eye on it when tuning.
// The full staging with brake thrusters, bolts and hatches follows in M4.

export const PODS = {
  /** Landing zones and pods per salvo. */
  perSalvo: 5,

  /** Target marker blinks before the pod becomes visible (seconds). */
  warnSeconds: 0.5,
  /** Fall from the sky to the impact. */
  fallSeconds: 0.55,
  /** Delay between two pods of the same salvo. */
  staggerSeconds: 0.24,
  /** After the impact: petals open, then the hologram fades in. */
  openDelaySeconds: 0.5,
  openSeconds: 0.35,
  hologramDelaySeconds: 0.85,
  hologramSeconds: 0.3,

  /**
   * Randomly added zones keep this Manhattan distance to the other zones, so a
   * salvo does not clump into one corner. Dropped when space runs out.
   */
  minRandomDistance: 2,
};

/** Seconds from requesting the salvo until the last pod has opened. */
export const SALVO_SECONDS =
  (PODS.perSalvo - 1) * PODS.staggerSeconds +
  PODS.warnSeconds +
  PODS.fallSeconds +
  PODS.hologramDelaySeconds +
  PODS.hologramSeconds;
