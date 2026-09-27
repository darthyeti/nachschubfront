import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../../src/storage/index.js';
import {
  createProtocolStore,
  describeProtocol,
  emptyProtocols,
  exportProtocol,
  MAX_PROTOCOLS,
  parseProtocol,
  PROTOCOL_MAGIC,
  protocolFileName,
  sanitizeProtocols,
} from '../../src/storage/protocol.js';
import { startLog, record, recordWave, PROTOCOL_VERSION } from '../../src/sim/record.js';
import { APP_VERSION } from '../../src/data/version.js';

/** A log as the recorder leaves it, without playing a match for it. */
function fakeLog({ id = 1, seed = 'BASTION', waves = 2, tainted = [] } = {}) {
  const state = {
    seed,
    tick: 0,
    wave: 0,
    phase: 'planning',
    lives: 20,
    requisition: 0,
    commandPoints: 0,
    towers: [],
    supplyLevel: 1,
    waveRoutes: null,
    waveStats: { spawned: 10, killed: 10, leaked: 0, bossKills: 0 },
    kills: 0,
  };
  startLog(state, 2, id);
  state.log.tainted.push(...tainted);
  for (let w = 1; w <= waves; w++) {
    state.wave = w;
    state.tick += 100;
    record(state, 'zone', { x: w, y: w, on: true });
    recordWave(state);
  }
  return state.log;
}

test('an empty document and a broken one look the same', () => {
  assert.deepEqual(sanitizeProtocols(null), emptyProtocols());
  assert.deepEqual(sanitizeProtocols('nonsense'), emptyProtocols());
  assert.deepEqual(sanitizeProtocols({ matches: 'no' }), emptyProtocols());
  assert.deepEqual(sanitizeProtocols({ matches: [{ seed: 5 }, {}, null] }).matches, []);
  assert.equal(sanitizeProtocols(null).version, PROTOCOL_VERSION);
});

test('sanitize keeps only the newest matches', () => {
  const matches = Array.from({ length: MAX_PROTOCOLS + 3 }, (_, i) => fakeLog({ id: i, seed: `S${i}` }));
  const kept = sanitizeProtocols({ matches }).matches;
  assert.equal(kept.length, MAX_PROTOCOLS);
  assert.equal(kept[kept.length - 1].seed, `S${MAX_PROTOCOLS + 2}`, 'the newest survived');
});

test('an exported file carries its Kennung, the build and the match', () => {
  const log = fakeLog();
  const file = exportProtocol(log, 1_700_000_000_000);
  assert.equal(file.magic, PROTOCOL_MAGIC);
  assert.equal(file.app, APP_VERSION);
  assert.equal(file.exported, 1_700_000_000_000);
  assert.equal(file.match.seed, 'BASTION');
  assert.equal(file.match.waves.length, 2);

  // And it survives the round trip through a file.
  const back = parseProtocol(JSON.stringify(file));
  assert.equal(back.ok, true);
  assert.deepEqual(back.match, log);
});

test('parseProtocol takes a bare match too, and refuses what is not one', () => {
  const log = fakeLog();
  assert.equal(parseProtocol(log).ok, true, 'a bare match, as it is stored');
  assert.equal(parseProtocol('{ broken').error, 'parse');
  assert.equal(parseProtocol('[]').error, 'parse');
  assert.equal(parseProtocol({ magic: 'something.else', match: log }).error, 'magic');
  assert.equal(parseProtocol({ magic: PROTOCOL_MAGIC, match: { seed: 'X' } }).error, 'empty');
});

test('the file name says date, seed and wave', () => {
  const name = protocolFileName(fakeLog({ seed: 'RIFT-7', waves: 12 }), Date.UTC(2026, 8, 27));
  assert.equal(name, 'nachschubfront-2026-09-27-RIFT-7-welle12.json');
  // A seed the player typed can hold anything; the file name may not.
  assert.match(protocolFileName(fakeLog({ seed: 'a/b .c' })), /^nachschubfront-\d{4}-\d{2}-\d{2}-abc-welle2\.json$/);
});

test('the description is what the menu needs to tell two matches apart', () => {
  const log = fakeLog({ waves: 3 });
  log.waves[1].rating = 'hard';
  log.end = { phase: 'defeat', wave: 3, lives: 0, kills: 40 };
  const about = describeProtocol(log);
  assert.equal(about.seed, 'BASTION');
  assert.equal(about.waves, 3);
  assert.equal(about.wave, 3);
  assert.equal(about.ratings, 1);
  assert.equal(about.tainted, false);
  assert.equal(about.ended, 'defeat');
  assert.equal(describeProtocol(fakeLog({ tainted: ['grant'] })).tainted, true);
});

test('saving the same match again replaces it instead of piling up', async () => {
  const store = createProtocolStore(createStorage(null));
  const log = fakeLog({ id: 7 });
  store.save(log, 1000);
  assert.equal(store.values.matches.length, 1);

  // A match is saved after every wave; the fourth save is still one match.
  record({ ...{ tick: 500, wave: 3, phase: 'planning' }, log }, 'supply');
  store.save(log, 2000);
  store.save(log, 3000);
  assert.equal(store.values.matches.length, 1);
  assert.equal(store.values.matches[0].savedAt, 3000);
  assert.equal(store.latest.actions.length, log.actions.length, 'the later actions are in');

  // Another match on the same seed is its own entry.
  store.save(fakeLog({ id: 8 }), 4000);
  assert.equal(store.values.matches.length, 2);
});

test('the store keeps a copy, so a match still being played cannot be lost', () => {
  const store = createProtocolStore(createStorage(null));
  const log = fakeLog({ id: 1 });
  store.save(log, 1000);
  const saved = store.latest;
  log.waves.length = 0;
  log.actions.length = 0;
  assert.equal(saved.waves.length, 2, 'the copy is untouched');
});

test('the store drops the oldest match and survives a dead backend', async () => {
  const storage = createStorage(null);
  const store = createProtocolStore(storage);
  assert.equal(storage.persistent, false, 'no backend: this session only');
  for (let i = 0; i < MAX_PROTOCOLS + 2; i++) store.save(fakeLog({ id: i, seed: `S${i}` }), i);
  assert.equal(store.values.matches.length, MAX_PROTOCOLS);
  assert.equal(store.values.matches[0].seed, 'S2', 'the two oldest are gone');
  assert.equal(store.save({ nonsense: true }), null, 'what is not a match is not saved');
  // Without a backend the storage layer still keeps a copy in memory, so the
  // matches of this session are readable — they just do not survive a reload.
  const loaded = await store.load();
  assert.equal(loaded.matches.length, MAX_PROTOCOLS);
});

test('a fresh store with nothing stored reads an empty document', async () => {
  const store = createProtocolStore(createStorage(null));
  assert.deepEqual(await store.load(), emptyProtocols());
  assert.equal(store.latest, null);
});

test('a saved match comes back through the storage layer', async () => {
  const backend = new Map();
  const fake = {
    getItem: (k) => backend.get(k) ?? null,
    setItem: (k, v) => backend.set(k, v),
    removeItem: (k) => backend.delete(k),
  };
  const first = createProtocolStore(createStorage(fake));
  first.save(fakeLog({ id: 3, seed: 'WIEDER' }), 5000);

  const second = createProtocolStore(createStorage(fake));
  const loaded = await second.load();
  assert.equal(loaded.matches.length, 1);
  assert.equal(loaded.matches[0].seed, 'WIEDER');
  assert.equal(second.latest.waves.length, 2);
});
