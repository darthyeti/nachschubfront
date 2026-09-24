// What the player sets in the settings dialog: volumes and motion.
//
// Kept apart from data/settings.js, which holds engine constants nobody changes
// while playing. Everything here goes through the storage layer, so a broken or
// empty store only means "defaults" and never stops the game.

import { storage as defaultStorage } from '../storage/index.js';

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
};

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
