// Game modes and difficulties (M7a, docs/meilensteine/M7a-modi.md).
//
// A new match takes one run configuration, `{ mode, difficulty }`, next to its
// seed. The mode record carries the rules a mode changes as data; the simulation
// looks them up and never asks which mode it is in. Where a rule works
// differently from one mode to the next, the record names a variant (such as
// `upgrade.kind`) and sim/ holds a table of what each variant does — a new mode
// with a new rule adds an entry instead of a branch.
//
// Names and descriptions are in src/data/strings.js under `modes.<id>`.

export const MODES = {
  standard: {
    id: 'standard',
    /** Raise when the rules of THIS mode make old results incomparable. */
    rev: 1,
    /** 'stable' | 'experimental' */
    status: 'stable',
    /** True: only offered with ?debug. */
    debugOnly: false,
    /**
     * How a standing emplacement goes up a rank (sim/selection.js, UPGRADE_KINDS).
     * 'pod': a capsule of the salvo goes into it, GDD section 11.
     */
    upgrade: { kind: 'pod' },
  },
  /**
   * The same rules as `standard` under another id. Exists only so the mode
   * screen, the separate leaderboards and the migration can be tested without a
   * second real mode; stays as a tool once there is one (M7a, A2).
   */
  'standard-klon': {
    id: 'standard-klon',
    rev: 1,
    status: 'stable',
    debugOnly: true,
    upgrade: { kind: 'pod' },
  },
};

export const DIFFICULTIES = {
  normal: { id: 'normal', rev: 1 },
};

export const DEFAULT_CONFIG = Object.freeze({ mode: 'standard', difficulty: 'normal' });

/** Modes the menu offers: the debug-only ones only with ?debug. */
export function listSelectableModes(debug = false) {
  return Object.values(MODES).filter((mode) => debug || !mode.debugOnly);
}

/**
 * The mode and difficulty records a configuration names. Throws on an unknown
 * id: the simulation is never handed a mode it does not know. What a player's
 * browser does with an unknown id is decided before, by sanitizeConfig.
 * @param {{mode?: string, difficulty?: string}} [config]
 */
export function resolveConfig(config = DEFAULT_CONFIG) {
  const modeId = config?.mode ?? DEFAULT_CONFIG.mode;
  const difficultyId = config?.difficulty ?? DEFAULT_CONFIG.difficulty;
  const mode = Object.hasOwn(MODES, modeId) ? MODES[modeId] : null;
  const difficulty = Object.hasOwn(DIFFICULTIES, difficultyId) ? DIFFICULTIES[difficultyId] : null;
  if (!mode) throw new Error(`Unknown mode: ${modeId}`);
  if (!difficulty) throw new Error(`Unknown difficulty: ${difficultyId}`);
  return { mode, difficulty };
}

/**
 * A configuration from outside (URL, settings) made safe to start. With `strict`
 * (the debug build) an unknown id is a fault and throws; otherwise it falls back
 * to the default and says so in the console, so a stale setting or a mistyped
 * link never stops a player from playing.
 */
export function sanitizeConfig(config, { strict = false } = {}) {
  const given = Object.entries(config ?? {}).filter(([, value]) => value !== undefined && value !== null);
  const wanted = { ...DEFAULT_CONFIG, ...Object.fromEntries(given) };
  const out = { ...wanted };
  if (!Object.hasOwn(MODES, wanted.mode)) out.mode = DEFAULT_CONFIG.mode;
  if (!Object.hasOwn(DIFFICULTIES, wanted.difficulty)) out.difficulty = DEFAULT_CONFIG.difficulty;
  if (out.mode !== wanted.mode || out.difficulty !== wanted.difficulty) {
    const what = `${wanted.mode}/${wanted.difficulty}`;
    if (strict) throw new Error(`Unknown run configuration: ${what}`);
    console.warn(`Unknown run configuration ${what}, playing ${out.mode}/${out.difficulty}`);
  }
  return out;
}

/** Key of a leaderboard compartment: "<mode>|<modeRev>|<difficulty>". */
export function runKey(mode, modeRev, difficulty) {
  return `${mode}|${modeRev}|${difficulty}`;
}
