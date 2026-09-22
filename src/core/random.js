// Seeded pseudo-random number generator (mulberry32).
// All gameplay-relevant randomness must come from here, never from Math.random().

/** Hashes an arbitrary string (e.g. a seed typed by the player) to an unsigned 32-bit integer. */
export function seedFromString(text) {
  // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function normalizeSeed(seed) {
  if (typeof seed === 'string') return seedFromString(seed);
  if (!Number.isFinite(seed)) throw new TypeError(`Invalid seed: ${seed}`);
  return Math.trunc(seed) >>> 0;
}

/**
 * Creates an independent random stream.
 * @param {number|string} seed
 */
export function createRng(seed) {
  const origin = normalizeSeed(seed);
  let state = origin;

  /** Float in [0, 1). */
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max], both inclusive. */
  function int(min, max) {
    return min + Math.floor(next() * (max - min + 1));
  }

  /** Float in [min, max). */
  function range(min, max) {
    return min + next() * (max - min);
  }

  /** True with probability p. */
  function chance(p) {
    return next() < p;
  }

  function pick(items) {
    if (items.length === 0) throw new RangeError('pick() on empty array');
    return items[Math.floor(next() * items.length)];
  }

  /** Returns a shuffled copy (Fisher-Yates); the input is left untouched. */
  function shuffle(items) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /**
   * Derives an independent stream from the original seed and a label.
   * Draws on one fork never shift the sequence of another (e.g. 'map' vs. 'pods').
   */
  function fork(label) {
    return createRng((origin ^ seedFromString(String(label))) >>> 0);
  }

  return { seed: origin, next, int, range, chance, pick, shuffle, fork };
}
