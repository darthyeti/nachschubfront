// Core match rules (GDD section 12).

export const RULES = {
  /** Bastion lives at the start of a match. */
  startLives: 20,
  /** Lives lost when an enemy reaches the bastion. */
  leakCost: 1,
  /** Lives lost when a boss reaches the bastion. */
  bossLeakCost: 5,
  /** Seconds the evaluation banner stays before planning resumes. */
  evaluationSeconds: 2,

  /** Score (GDD section 12): wave x 1000 plus kills plus lives x 200. */
  scorePerWave: 1000,
  scorePerKill: 1,
  scorePerLife: 200,
};
