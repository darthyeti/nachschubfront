// Seeds shown to and typed by players.

// No 0/O and 1/I, so seeds can be read out and typed without confusion.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Picks a fresh seed for a new match. Choosing the seed is not gameplay-relevant
 * randomness (everything after it is deterministic), so crypto is fine here.
 */
export function randomSeed(length = 6) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** Normalises user input: trims, upper-cases, limits length. Empty input gives null. */
export function normalizeSeed(input) {
  const s = String(input ?? '').trim().toUpperCase().slice(0, 24);
  return s.length ? s : null;
}

/**
 * Checks a seed a player typed, for the seed screen. Spaces and hyphens are
 * dropped first: a seed is often read out or copied with them, and none of the
 * seeds the game hands out contain any.
 *
 * Letters and digits are all accepted, including the ones ALPHABET leaves out.
 * A seed is only hashed, so every string makes a map; ALPHABET exists so that
 * the seeds the game *gives* are unmistakable, not to narrow what a player may
 * bring. Refused is what is almost certainly a slip: nothing at all, something
 * far too long, or characters that belong to no seed.
 *
 * `normalizeSeed` stays as permissive as it was — it also serves the `?seed=`
 * parameter, where an old link has to keep working.
 *
 * @returns {{ok: true, seed: string} | {ok: false, reason: 'empty'|'long'|'chars', chars?: string}}
 */
export function validateSeed(input) {
  const raw = String(input ?? '').trim().toUpperCase().replace(/[\s-]+/g, '');
  if (!raw) return { ok: false, reason: 'empty' };
  if (raw.length > 24) return { ok: false, reason: 'long' };
  const bad = [...new Set([...raw].filter((c) => !/[A-Z0-9]/.test(c)))];
  if (bad.length) return { ok: false, reason: 'chars', chars: bad.join(' ') };
  return { ok: true, seed: raw };
}
