// Core match rules (GDD section 12).

/**
 * Which set of rules a match was played under. M4b changed the map (two signal
 * fires instead of four), the salvo size and the opening waves, so a score from
 * before it says nothing about one after it, not even on the same seed. Best
 * scores are stored with this number (M5) so the two never end up in one list.
 * Raise it whenever a change makes old results incomparable.
 */
export const RULESET_VERSION = 2;

/**
 * True while the numbers are still being tuned (M6). It turns on what only a
 * test version wants — the rating line after every wave — and it is a separate
 * flag from the version number on purpose: the version says which rules a score
 * was played under, this says whether the rules are settled. Set it to false
 * with the last balancing round.
 */
export const RULESET_TESTING = true;

export const RULES = {
  /** Bastion lives at the start of a match. */
  startLives: 20,
  /** Lives lost when an enemy reaches the bastion. */
  leakCost: 1,
  /** Lives lost when a boss reaches the bastion. */
  bossLeakCost: 5,
  /** Lives lost when the Koloss reaches the bastion (GDD section 12, v3). */
  kolossLeakCost: 15,
  /** Seconds the evaluation banner stays before planning resumes. */
  evaluationSeconds: 2,

  /** Score (GDD section 12): wave x 1000 plus kills plus lives x 200. */
  scorePerWave: 1000,
  scorePerKill: 1,
  scorePerLife: 200,
};
