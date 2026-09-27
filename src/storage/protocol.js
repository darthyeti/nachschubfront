// Recorded matches on their way out of the game (M6, part 1).
//
// Its own document, next to the profile and the settings, for the same reason
// they are apart: the profile export is the transfer of best scores, and a
// protocol has no business travelling in it. Whoever hands their record to a
// friend is not handing over every match they played.
//
// Only the last few matches are kept. A protocol is small — a few hundred
// actions — but local storage is not, and the interesting one is always a recent
// one. Everything here is pure except createProtocolStore, which is the only
// part that touches the storage layer.

import { APP_VERSION } from '../data/version.js';
import { PROTOCOL_VERSION } from '../sim/record.js';

export const PROTOCOL_KEY = 'protocols';

/** Kennung in an exported file, so a foreign JSON is recognised as foreign. */
export const PROTOCOL_MAGIC = 'nachschubfront.protokoll';

/** Matches kept in storage. The oldest falls out when a new one arrives. */
export const MAX_PROTOCOLS = 5;

export function emptyProtocols() {
  return { version: PROTOCOL_VERSION, matches: [] };
}

/**
 * Keeps what looks like a recorded match and throws away the rest. A stored
 * document is data from an earlier build, not something to trust.
 */
export function sanitizeProtocols(raw) {
  const out = emptyProtocols();
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.matches)) return out;
  out.matches = raw.matches.filter(isMatch).slice(-MAX_PROTOCOLS);
  return out;
}

function isMatch(match) {
  return Boolean(
    match &&
      typeof match === 'object' &&
      typeof match.seed === 'string' &&
      Array.isArray(match.actions) &&
      Array.isArray(match.waves),
  );
}

/**
 * The document as it goes into a file. The match is taken as it is; the wrapper
 * says which build wrote it and when, because the recording itself never asks
 * the clock (sim/record.js).
 */
export function exportProtocol(log, now = Date.now()) {
  return {
    magic: PROTOCOL_MAGIC,
    app: APP_VERSION,
    exported: now,
    match: log,
  };
}

/**
 * Reads a protocol file back, for the replay tool and for a later import.
 * Never throws.
 * @param {string|object} input  File text, or an already parsed object.
 * @returns {{ok: true, match: object} | {ok: false, error: 'parse' | 'magic' | 'empty'}}
 */
export function parseProtocol(input) {
  let raw = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return { ok: false, error: 'parse' };
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'parse' };
  // A bare match is accepted too: that is what a protocol looks like inside the
  // stored document, and the replay tool should not care which one it was given.
  const match = raw.match ?? raw;
  if (raw.magic !== undefined && raw.magic !== PROTOCOL_MAGIC) return { ok: false, error: 'magic' };
  if (!isMatch(match)) return { ok: false, error: 'empty' };
  return { ok: true, match };
}

/**
 * The name of an exported file: date, seed and the wave it got to, so a folder
 * full of them can be read without opening one.
 */
export function protocolFileName(log, now = Date.now()) {
  const date = new Date(now).toISOString().slice(0, 10);
  const wave = log.waves.length > 0 ? log.waves[log.waves.length - 1].w : 0;
  const seed = String(log.seed).replace(/[^A-Za-z0-9-]/g, '') || 'SEED';
  return `nachschubfront-${date}-${seed}-welle${wave}.json`;
}

/** The one line the menu shows about a match: what it was and how far it got. */
export function describeProtocol(log) {
  const last = log.waves.length > 0 ? log.waves[log.waves.length - 1] : null;
  return {
    seed: log.seed,
    waves: log.waves.length,
    wave: last?.w ?? 0,
    lives: last?.lives ?? null,
    actions: log.actions.length,
    ratings: log.waves.filter((w) => w.rating !== null).length,
    tainted: log.tainted.length > 0,
    ended: log.end?.phase ?? null,
  };
}

/**
 * Keeps the recorded matches in storage. Writes are fire-and-forget, like the
 * profile's: a full store may lose a protocol, but never the match being played.
 * @param {{get: Function, set: Function}} storage
 */
export function createProtocolStore(storage) {
  let document = emptyProtocols();

  return {
    get values() {
      return document;
    },

    /** The most recently saved match, or null. */
    get latest() {
      return document.matches.length > 0 ? document.matches[document.matches.length - 1] : null;
    },

    async load() {
      document = sanitizeProtocols(await storage.get(PROTOCOL_KEY, null));
      return document;
    },

    /**
     * Saves a match, replacing an earlier save of the same one. A match is
     * saved repeatedly — after every wave — so that a session somebody breaks
     * off is on disk too, and those are worth having (the order says so).
     */
    save(log, now = Date.now()) {
      if (!isMatch(log)) return null;
      const entry = { ...structuredCopy(log), savedAt: now };
      const same = document.matches.findIndex((m) => m.seed === log.seed && m.id === log.id);
      if (same >= 0) document.matches.splice(same, 1, entry);
      else document.matches.push(entry);
      if (document.matches.length > MAX_PROTOCOLS) {
        document.matches.splice(0, document.matches.length - MAX_PROTOCOLS);
      }
      storage.set(PROTOCOL_KEY, document);
      return entry;
    },
  };
}

/** A copy that is safe to keep: the live log goes on growing behind our back. */
function structuredCopy(value) {
  return JSON.parse(JSON.stringify(value));
}
