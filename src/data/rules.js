// Core match rules (GDD section 12).

/**
 * Which set of rules a match was played under. M4b changed the map (two signal
 * fires instead of four), the salvo size and the opening waves, so a score from
 * before it says nothing about one after it, not even on the same seed. Best
 * scores are stored with this number (M5) so the two never end up in one list.
 * Raise it whenever a change makes old results incomparable.
 *
 * 8 since 09.10.2026: balancing round 5 capped the brood mother's trail at 30
 * swarmers. Uncapped it grew with how long she lived, and on a long maze she
 * lived long.
 *
 * 7 since 02.10.2026: the mortar's lead and the choice of target read the
 * Koloss on its own line. Before, they read it on the wave's line, and the
 * shells landed where it was not (1 to 3 of a Koloss wave's shells on it).
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
export const RULESET_VERSION = 8;

/**
 * True while the numbers are still being tuned (M6). It turns on what only a
 * test version wants — the rating line after a wave — and it is a separate flag
 * from the version number on purpose: the version says which rules a score was
 * played under, this says whether the rules are settled. Set it to false with the
 * last balancing round.
 */
export const RULESET_TESTING = true;

/**
 * The waves the rating line asks about. Ten of fifty, since balancing round 4.
 *
 * It used to ask after every wave, and that stopped working: in the match of
 * 01.10.2026 all 49 answers were "passt", covering waves from -9 % reserve to
 * 967 %. The same word for the tightest wave in the game and for one with ten
 * times the firepower it needs is not an answer, it is a reflex. Fifty questions
 * in a row produce reflexes; ten produce answers.
 *
 * Which ten, and why these: wave 1 because it is the one genuinely tight wave,
 * 8/13/18 because that stretch was twelve empty waves until round 3 and is what
 * the band is being judged on, 24/30 for the end of the band, 35 for the Koloss,
 * and 41/46/50 for the late game that has been reading right for two rounds. The
 * point is to tell those stretches apart, which needs samples from each — not the
 * most dramatic waves, which would all come back "passt" again.
 *
 * A data value and not a rule in the code, so a tuning round can look elsewhere
 * without touching src/ui.
 */
export const RATED_WAVES = [1, 8, 13, 18, 24, 30, 35, 41, 46, 50];

/** Whether the rating line asks after this wave. */
export function isRatedWave(wave) {
  return RATED_WAVES.includes(wave);
}

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
