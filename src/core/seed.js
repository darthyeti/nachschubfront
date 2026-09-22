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
