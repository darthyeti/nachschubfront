// The player's record: best runs and lifetime statistics.
//
// Kept apart from core/prefs.js on purpose. Settings belong to the device — a
// profile imported from somewhere else must not change how loud this machine
// plays — so they live under their own key and never travel in an export.
//
// Everything here is pure except createProfileStore, which is the only part that
// touches the storage layer. That makes the format, the migration and the
// sanitizer testable without a browser.

import { RULESET_VERSION } from '../data/rules.js';
import { DOCTRINE_IDS } from '../data/doctrines.js';
import { APP_VERSION } from '../data/version.js';

export const PROFILE_KEY = 'profile';

/** Format version of the stored document. Raise it and add a migration step. */
export const PROFILE_VERSION = 1;

/** Kennung in an exported file, so a foreign JSON is refused before parsing. */
export const PROFILE_MAGIC = 'nachschubfront.profile';

/**
 * Best runs kept per ruleset version. One entry per seed, so the list doubles as
 * the per-seed record; the menu shows the top ten of it.
 */
export const MAX_BEST_ENTRIES = 50;

export function emptyStats() {
  return {
    matches: 0,
    victories: 0,
    kills: 0,
    bestWave: 0,
    seconds: 0,
    /** Towers built, by doctrine. The largest is the "liebste Doktrin". */
    doctrines: Object.fromEntries(DOCTRINE_IDS.map((id) => [id, 0])),
  };
}

export function emptyProfile() {
  return {
    version: PROFILE_VERSION,
    /** Keyed by ruleset version as a string: a score only compares within one. */
    best: {},
    stats: emptyStats(),
    meta: { app: APP_VERSION, updated: 0 },
  };
}

// ---------- Sanitizing ----------

function int(value, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(max, Math.floor(value));
}

function seedOf(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 32 ? value : null;
}

/** One best-list row. Returns null when the record is not usable. */
export function sanitizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const seed = seedOf(raw.seed);
  if (seed === null) return null;
  return {
    seed,
    wave: int(raw.wave, 9999),
    kills: int(raw.kills),
    lives: int(raw.lives, 9999),
    score: int(raw.score),
    victory: raw.victory === true,
    /** Milliseconds since the epoch; 0 when the file did not say. */
    date: int(raw.date),
    /** How often this seed was played. At least the one run stored here. */
    runs: Math.max(1, int(raw.runs)),
  };
}

function sanitizeStats(raw) {
  const out = emptyStats();
  if (!raw || typeof raw !== 'object') return out;
  out.matches = int(raw.matches);
  out.victories = Math.min(out.matches, int(raw.victories));
  out.kills = int(raw.kills);
  out.bestWave = int(raw.bestWave, 9999);
  out.seconds = int(raw.seconds);
  const doctrines = raw.doctrines;
  if (doctrines && typeof doctrines === 'object') {
    // Unknown doctrine ids are dropped: the list of doctrines is ours, not the file's.
    for (const id of DOCTRINE_IDS) out.doctrines[id] = int(doctrines[id]);
  }
  return out;
}

/** Sorts best first; equal scores keep the older run in front. */
function byScore(a, b) {
  return b.score - a.score || a.date - b.date || a.seed.localeCompare(b.seed);
}

function sanitizeBest(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, list] of Object.entries(raw)) {
    // Ruleset versions are plain positive integers; anything else is not ours.
    if (!/^\d{1,4}$/.test(key) || !Array.isArray(list)) continue;
    const bySeed = new Map();
    for (const item of list) {
      const entry = sanitizeEntry(item);
      if (!entry) continue;
      const seen = bySeed.get(entry.seed);
      // A file listing the same seed twice keeps the better run, not both.
      if (!seen || byScore(entry, seen) < 0) bySeed.set(entry.seed, entry);
    }
    if (bySeed.size === 0) continue;
    out[key] = [...bySeed.values()].sort(byScore).slice(0, MAX_BEST_ENTRIES);
  }
  return out;
}

/**
 * Keeps what we understand and throws the rest away. A broken or foreign
 * document therefore reads as an empty profile instead of stopping the game.
 */
export function sanitizeProfile(raw) {
  const out = emptyProfile();
  if (!raw || typeof raw !== 'object') return out;
  out.best = sanitizeBest(raw.best);
  out.stats = sanitizeStats(raw.stats);
  if (raw.meta && typeof raw.meta === 'object') {
    if (typeof raw.meta.app === 'string' && raw.meta.app.length <= 32) out.meta.app = raw.meta.app;
    out.meta.updated = int(raw.meta.updated);
  }
  return out;
}

// ---------- Migration ----------

/**
 * One step per version jump: `MIGRATIONS[n]` turns a version-n document into a
 * version-(n+1) one. There is nothing to convert yet — before M5 no profile was
 * ever written — but the path exists, so the first real change has somewhere to go.
 * @type {Record<number, (doc: object) => object>}
 */
const MIGRATIONS = {};

/**
 * Brings a stored document up to the current format.
 * @returns {{profile: object, future: boolean}} `future` is true when the
 *   document was written by a newer build. Its contents are then left alone and
 *   the caller must not overwrite them: the player has the newer data elsewhere.
 */
export function migrateProfile(raw) {
  if (!raw || typeof raw !== 'object') return { profile: emptyProfile(), future: false };
  const version = typeof raw.version === 'number' && Number.isFinite(raw.version) ? Math.floor(raw.version) : 0;
  if (version > PROFILE_VERSION) return { profile: emptyProfile(), future: true };

  let doc = raw;
  for (let v = Math.max(0, version); v < PROFILE_VERSION; v += 1) {
    const step = MIGRATIONS[v];
    // A missing step means nothing had to change between those two versions.
    if (step) doc = step(doc);
  }
  return { profile: sanitizeProfile(doc), future: false };
}

// ---------- Recording a match ----------

/** The list for a ruleset version, newest state included. */
export function bestList(profile, ruleset = RULESET_VERSION) {
  return profile.best[String(ruleset)] ?? [];
}

/** The stored run for one seed, or null. */
export function bestForSeed(profile, seed, ruleset = RULESET_VERSION) {
  return bestList(profile, ruleset).find((e) => e.seed === seed) ?? null;
}

/** The doctrine with the most towers built, or null while nothing was built. */
export function favouriteDoctrine(stats) {
  let best = null;
  for (const id of DOCTRINE_IDS) {
    const n = stats.doctrines[id] ?? 0;
    if (n > 0 && (best === null || n > stats.doctrines[best])) best = id;
  }
  return best;
}

/**
 * Folds a finished match into a profile and returns a new document. Pure: the
 * caller decides whether to keep or store the result.
 *
 * @param {object} profile
 * @param {object} result  scoreEntry(state) plus victory, seconds and doctrines.
 * @param {number} [now]   Injected in tests.
 */
export function recordMatch(profile, result, now = Date.now()) {
  const entry = sanitizeEntry({ ...result, date: now, runs: 1 });
  if (!entry) return profile;
  const key = String(int(result.ruleset, 9999));

  const list = [...bestList(profile, key)];
  const index = list.findIndex((e) => e.seed === entry.seed);
  if (index === -1) {
    list.push(entry);
  } else {
    // The seed keeps its best run, but the play count keeps counting.
    const previous = list[index];
    entry.runs = previous.runs + 1;
    list[index] = byScore(entry, previous) < 0 ? entry : { ...previous, runs: entry.runs };
  }
  list.sort(byScore);

  const stats = { ...profile.stats, doctrines: { ...profile.stats.doctrines } };
  stats.matches += 1;
  if (entry.victory) stats.victories += 1;
  stats.kills += entry.kills;
  stats.bestWave = Math.max(stats.bestWave, entry.wave);
  stats.seconds += int(result.seconds);
  if (result.doctrines && typeof result.doctrines === 'object') {
    for (const id of DOCTRINE_IDS) stats.doctrines[id] += int(result.doctrines[id]);
  }

  return sanitizeProfile({
    ...profile,
    best: { ...profile.best, [key]: list.slice(0, MAX_BEST_ENTRIES) },
    stats,
    meta: { app: APP_VERSION, updated: now },
  });
}

// ---------- Export and import ----------

/** The document as it goes into a file: the profile plus what identifies it. */
export function exportProfile(profile, now = Date.now()) {
  return {
    magic: PROFILE_MAGIC,
    version: PROFILE_VERSION,
    app: APP_VERSION,
    exported: now,
    best: profile.best,
    stats: profile.stats,
  };
}

/** Why an import was refused; the UI turns these into German sentences. */
export const IMPORT_ERRORS = {
  parse: 'parse',
  magic: 'magic',
  future: 'future',
  empty: 'empty',
};

/**
 * Checks a pasted or loaded file. Never throws and never touches storage.
 * @param {string|object} input  The file text, or an already parsed object.
 * @returns {{ok: true, profile: object, summary: object} | {ok: false, error: string}}
 */
export function parseImport(input) {
  let raw = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return { ok: false, error: IMPORT_ERRORS.parse };
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: IMPORT_ERRORS.parse };
  if (raw.magic !== PROFILE_MAGIC) return { ok: false, error: IMPORT_ERRORS.magic };

  const { profile, future } = migrateProfile(raw);
  if (future) return { ok: false, error: IMPORT_ERRORS.future };
  if (summarize(profile).runs === 0) return { ok: false, error: IMPORT_ERRORS.empty };
  return { ok: true, profile, summary: summarize(profile) };
}

/** The few numbers the replace dialog shows for both sides. */
export function summarize(profile) {
  const entries = Object.values(profile.best).flat();
  return {
    runs: profile.stats.matches,
    seeds: entries.length,
    bestWave: profile.stats.bestWave,
    bestScore: entries.reduce((max, e) => Math.max(max, e.score), 0),
  };
}

// ---------- The stored instance ----------

/**
 * Reads and writes the profile through the storage layer. Writes are
 * fire-and-forget: a full or disabled store may lose the record, but never the
 * match.
 * @param {{get: Function, set: Function}} storage
 */
export function createProfileStore(storage) {
  let profile = emptyProfile();
  let future = false;
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) listener(profile);
  }

  function write() {
    // A document from a newer build stays untouched: overwriting it would throw
    // away records this build cannot even display.
    if (future) return false;
    storage.set(PROFILE_KEY, profile);
    return true;
  }

  return {
    get values() {
      return profile;
    },
    /** True when a newer build wrote the stored profile; nothing is saved then. */
    get locked() {
      return future;
    },

    async load() {
      const result = migrateProfile(await storage.get(PROFILE_KEY, null));
      profile = result.profile;
      future = result.future;
      notify();
      return profile;
    },

    /** Folds a finished match in and saves. */
    record(result, now = Date.now()) {
      profile = recordMatch(profile, result, now);
      write();
      notify();
      return profile;
    },

    /** Replaces everything with an imported document. */
    replace(next) {
      profile = sanitizeProfile(next);
      // An import is the player saying "this one counts"; it unlocks the slot.
      future = false;
      write();
      notify();
      return profile;
    },

    /** Throws the record away. Settings are not touched. */
    reset() {
      profile = emptyProfile();
      future = false;
      write();
      notify();
      return profile;
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
