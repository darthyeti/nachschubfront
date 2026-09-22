// The only module that touches persistent storage. Async interface so an
// online backend can replace localStorage later without changing callers.

const PREFIX = 'nachschubfront:';

/** Returns window.localStorage if it exists and is usable, otherwise null. */
function detectLocalStorage() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = `${PREFIX}__probe__`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    // Private mode, disabled cookies or quota exhausted.
    return null;
  }
}

/**
 * Creates a storage instance. Falls back to an in-memory map when the backend
 * is missing or broken, so the game always starts.
 * @param {Storage|null} [backend] Injected for tests; defaults to localStorage.
 */
export function createStorage(backend = detectLocalStorage()) {
  const memory = new Map();

  function readRaw(key) {
    if (backend) {
      try {
        return backend.getItem(PREFIX + key);
      } catch {
        // Fall through to the memory copy.
      }
    }
    return memory.has(key) ? memory.get(key) : null;
  }

  return {
    /** True if data survives a reload. */
    persistent: backend !== null,

    /** Returns the stored value, or `fallback` if missing or unreadable. */
    async get(key, fallback = null) {
      const raw = readRaw(key);
      if (raw === null || raw === undefined) return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    },

    /** Stores a JSON-serializable value. Resolves to false if it could not be persisted. */
    async set(key, value) {
      let raw;
      try {
        raw = JSON.stringify(value);
      } catch {
        return false;
      }
      memory.set(key, raw);
      if (!backend) return false;
      try {
        backend.setItem(PREFIX + key, raw);
        return true;
      } catch {
        return false;
      }
    },

    async remove(key) {
      memory.delete(key);
      if (!backend) return;
      try {
        backend.removeItem(PREFIX + key);
      } catch {
        // Nothing sensible to do; the memory copy is gone either way.
      }
    },
  };
}

/** Shared instance for the game. */
export const storage = createStorage();
