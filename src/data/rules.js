// Core match rules (GDD section 12).

/**
 * Which set of rules a match was played under. M4b changed the map (two signal
 * fires instead of four), the salvo size and the opening waves, so a score from
 * before it says nothing about one after it, not even on the same seed. Best
 * scores are stored with this number (M5) so the two never end up in one list.
 * Raise it whenever a change makes old results incomparable.
 *
 * 6 since 29.09.2026: balancing round 3 gave the middle of the match a band of
 * its own and added upgrading a standing emplacement to the selection phase.
 *
 * 5 the same day: round 2 raised the health growth and the enemy count per wave. Every round of part 2 raises this, so scores stay in lists that
 * can be compared with each other.
 *
 * 4 the day before: round 1 changed the wave-30 boss and the price of a Koloss
 * breakthrough.
 *
 * 3 on the same day: the placement rules were tightened twice. A
 * landing zone may no longer stand on rubble nobody can pay to clear (88fc725),
 * and a marker whose ground gets built on is dropped (b4bba94). Both change which
 * mazes can be built at all, and it showed: a match recorded an hour before the
 * first fix replayed to a defeat in wave 35 where the player had won in wave 50.
 * Matches from 2 are therefore neither comparable nor replayable here.
 */
export const RULESET_VERSION = 6;

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
  /**
   * Lives lost when the Koloss reaches the bastion (GDD section 12).
   *
   * 8 since balancing round 1 (28.09.2026), down from 15. 15 of 20 starting lives
   * meant one creature decided the whole match, and the arithmetic fell out
   * exactly: the wave-30 boss took 5 from everyone, so everyone stood at 15 when
   * the Koloss arrived in wave 35. A one-percent change anywhere else was enough
   * to end a run there and say nothing about the other 49 waves. At 8 a
   * breakthrough is heavy and two of them — both Kolosse of a run — still end it.
   */
  kolossLeakCost: 8,
  /** Seconds the evaluation banner stays before planning resumes. */
  evaluationSeconds: 2,

  /** Score (GDD section 12): wave x 1000 plus kills plus lives x 200. */
  scorePerWave: 1000,
  scorePerKill: 1,
  scorePerLife: 200,
};
