// What the player sets in the settings dialog: volumes and motion.
//
// Kept apart from data/settings.js, which holds engine constants nobody changes
// while playing. Everything here goes through the storage layer, so a broken or
// empty store only means "defaults" and never stops the game.

import { storage as defaultStorage } from '../storage/index.js';
import { RULESET_TESTING } from '../data/rules.js';

const KEY = 'prefs';

export const PREF_DEFAULTS = {
  /** Volumes 0 to 1; the audio mixer multiplies master with the channel. */
  master: 0.7,
  sfx: 0.9,
  music: 0.5,
  /** 'auto' follows prefers-reduced-motion, 'full' and 'reduced' override it. */
  motion: 'auto',
  /** The player waved the "add to home screen" hint away on this device. */
  installHintDismissed: false,
  /**
   * The line of three buttons after a wave (M6). On while the ruleset is marked
   * as a test version, because that is when the answers are worth having; off
   * for good once the values are settled.
   */
  rateWaves: RULESET_TESTING,
  /**
   * The run configuration of the last match started (M7a). Only ids: whether
   * the mode is still offered is decided by the menu, which falls back to the
   * default when it is not.
   */
  lastRun: { mode: 'standard', difficulty: 'normal' },
};

const isId = (value) => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,31}$/.test(value);

const VOLUMES = ['master', 'sfx', 'music'];
const MOTIONS = ['auto', 'full', 'reduced'];

/** Keeps only known keys in their allowed range; anything else falls back. */
export function sanitizePrefs(raw) {
  const out = { ...PREF_DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  for (const key of VOLUMES) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = Math.min(1, Math.max(0, value));
  }
  if (MOTIONS.includes(raw.motion)) out.motion = raw.motion;
  if (typeof raw.installHintDismissed === 'boolean') out.installHintDismissed = raw.installHintDismissed;
  if (typeof raw.rateWaves === 'boolean') out.rateWaves = raw.rateWaves;
  const last = raw.lastRun;
  if (last && typeof last === 'object' && isId(last.mode) && isId(last.difficulty)) {
    out.lastRun = { mode: last.mode, difficulty: last.difficulty };
  }
  return out;
}

/** True when motion should be damped: the player's choice, or the system's. */
export function wantsReducedMotion(prefs, systemPrefersReduced) {
  if (prefs.motion === 'reduced') return true;
  if (prefs.motion === 'full') return false;
  return systemPrefersReduced;
}

export function createPrefs(storage = defaultStorage) {
  let values = { ...PREF_DEFAULTS };
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) listener(values);
  }

  return {
    get values() {
      return values;
    },

    /** Reads the stored settings. Never throws; missing data means defaults. */
    async load() {
      values = sanitizePrefs(await storage.get(KEY, null));
      notify();
      return values;
    },

    /** Sets one value and writes the whole set back. */
    set(key, value) {
      const next = sanitizePrefs({ ...values, [key]: value });
      if (next[key] === values[key]) return values;
      values = next;
      notify();
      storage.set(KEY, values);
      return values;
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
