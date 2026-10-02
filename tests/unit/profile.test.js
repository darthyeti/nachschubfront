// The stored record: format, migration, what a match does to it, and what the
// import refuses. All pure functions except the last block, which uses a fake
// storage backend.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PROFILE_VERSION,
  PROFILE_MAGIC,
  MAX_BEST_ENTRIES,
  IMPORT_ERRORS,
  emptyProfile,
  sanitizeProfile,
  sanitizeEntry,
  migrateProfile,
  recordMatch,
  bestList,
  bestForSeed,
  favouriteDoctrine,
  exportProfile,
  parseImport,
  summarize,
  createProfileStore,
  DEFAULT_RUN_KEY,
} from '../../src/storage/profile.js';
import { createStorage } from '../../src/storage/index.js';
import { RULESET_VERSION } from '../../src/data/rules.js';
import { DOCTRINE_IDS } from '../../src/data/doctrines.js';

function run(overrides = {}) {
  return {
    ruleset: RULESET_VERSION,
    seed: 'BASTION',
    wave: 12,
    kills: 340,
    lives: 17,
    score: 15740,
    victory: false,
    seconds: 600,
    doctrines: { flame: 2 },
    ...overrides,
  };
}

function fakeLocalStorage() {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

// ---------- Format ----------

test('a fresh profile has every doctrine at zero and nothing else', () => {
  const p = emptyProfile();
  assert.equal(p.version, PROFILE_VERSION);
  assert.deepEqual(p.best, {});
  assert.equal(p.stats.matches, 0);
  assert.deepEqual(Object.keys(p.stats.doctrines).sort(), [...DOCTRINE_IDS].sort());
  for (const id of DOCTRINE_IDS) assert.equal(p.stats.doctrines[id], 0);
});

test('sanitize drops what it does not understand and keeps the rest', () => {
  const p = sanitizeProfile({
    version: 2,
    nonsense: 'weg damit',
    best: {
      [RULESET_VERSION]: {
        [DEFAULT_RUN_KEY]: [run({ score: 100 }), { seed: 42 }, null, { seed: 'X', score: -5, wave: 1.7 }],
        'kein schluessel': [run()],
      },
      'not-a-version': { [DEFAULT_RUN_KEY]: [run()] },
    },
    stats: { matches: 3, victories: 9, kills: -1, doctrines: { flame: 4, erfunden: 99 } },
    meta: { app: '9.9.9', updated: 12345 },
  });
  assert.equal(bestList(p).length, 2, 'the two unusable rows are gone');
  assert.equal(bestForSeed(p, 'X').score, 0, 'a negative score reads as zero');
  assert.equal(bestForSeed(p, 'X').wave, 1, 'fractions are floored');
  assert.deepEqual(
    Object.keys(p.best),
    [String(RULESET_VERSION)],
    'a key that is not a ruleset version is dropped',
  );
  assert.deepEqual(Object.keys(p.best[RULESET_VERSION]), [DEFAULT_RUN_KEY], 'a key that is not a run key is dropped');
  assert.equal(p.stats.victories, 3, 'more wins than matches is impossible');
  assert.equal(p.stats.kills, 0);
  assert.equal(p.stats.doctrines.flame, 4);
  assert.ok(!('erfunden' in p.stats.doctrines), 'the doctrine list is ours, not the file s');
  assert.equal(p.meta.updated, 12345);
});

test('the same seed twice in one list keeps only the better run', () => {
  const p = sanitizeProfile({ best: { [RULESET_VERSION]: { [DEFAULT_RUN_KEY]: [run({ score: 500 }), run({ score: 900 })] } } });
  assert.equal(bestList(p).length, 1);
  assert.equal(bestForSeed(p, 'BASTION').score, 900);
});

test('a garbage document reads as an empty profile instead of throwing', () => {
  for (const bad of [null, undefined, 42, 'text', [], { best: 'nope', stats: 7 }]) {
    const p = sanitizeProfile(bad);
    assert.deepEqual(p.best, {});
    assert.equal(p.stats.matches, 0);
  }
});

test('an entry without a usable seed is refused', () => {
  assert.equal(sanitizeEntry({ seed: '' }), null);
  assert.equal(sanitizeEntry({ seed: 'x'.repeat(33) }), null);
  assert.equal(sanitizeEntry({ seed: 7 }), null);
  assert.ok(sanitizeEntry({ seed: 'A' }));
});

// ---------- Migration ----------

test('a document without a version is read as the oldest one and lifted', () => {
  const { profile, future } = migrateProfile({
    best: { [RULESET_VERSION]: [run()] },
    stats: { matches: 1 },
  });
  assert.equal(future, false);
  assert.equal(profile.version, PROFILE_VERSION);
  assert.equal(bestList(profile).length, 1);
});

test('a profile from a newer build is reported and left alone', () => {
  const { profile, future } = migrateProfile({
    version: PROFILE_VERSION + 1,
    best: { [RULESET_VERSION]: [run()] },
  });
  assert.equal(future, true);
  assert.deepEqual(profile.best, {}, 'nothing from it is shown');
});

// ---------- Recording ----------

test('a finished match lands in the list and in the statistics', () => {
  const p = recordMatch(emptyProfile(), run({ victory: true }), 1000);
  const entry = bestForSeed(p, 'BASTION');
  assert.equal(entry.score, 15740);
  assert.equal(entry.victory, true);
  assert.equal(entry.date, 1000);
  assert.equal(entry.runs, 1);
  assert.equal(p.stats.matches, 1);
  assert.equal(p.stats.victories, 1);
  assert.equal(p.stats.kills, 340);
  assert.equal(p.stats.bestWave, 12);
  assert.equal(p.stats.seconds, 600);
  assert.equal(p.stats.doctrines.flame, 2);
});

test('a second run on the same seed keeps the better score and counts both', () => {
  let p = recordMatch(emptyProfile(), run({ score: 15740, wave: 12 }), 1000);
  p = recordMatch(p, run({ score: 9000, wave: 8 }), 2000);
  assert.equal(bestList(p).length, 1, 'one row per seed');
  assert.equal(bestForSeed(p, 'BASTION').score, 15740, 'the worse run does not replace it');
  assert.equal(bestForSeed(p, 'BASTION').runs, 2);
  assert.equal(p.stats.matches, 2);
  assert.equal(p.stats.kills, 680, 'both runs still count towards the totals');

  p = recordMatch(p, run({ score: 30000, wave: 20 }), 3000);
  assert.equal(bestForSeed(p, 'BASTION').score, 30000);
  assert.equal(bestForSeed(p, 'BASTION').runs, 3);
  assert.equal(p.stats.bestWave, 20);
});

test('two ruleset versions never share a list', () => {
  let p = recordMatch(emptyProfile(), run({ ruleset: 1, score: 99999 }), 1000);
  p = recordMatch(p, run({ ruleset: 2, score: 100 }), 2000);
  assert.equal(bestList(p, DEFAULT_RUN_KEY, 1)[0].score, 99999);
  assert.equal(bestList(p, DEFAULT_RUN_KEY, 2)[0].score, 100);
  assert.equal(bestForSeed(p, 'BASTION', DEFAULT_RUN_KEY, 2).score, 100, 'the old record does not leak into the new rules');
});

test('the list is sorted best first and capped', () => {
  let p = emptyProfile();
  for (let i = 0; i < MAX_BEST_ENTRIES + 10; i += 1) {
    p = recordMatch(p, run({ seed: `SEED${i}`, score: i * 10 }), 1000 + i);
  }
  const list = bestList(p);
  assert.equal(list.length, MAX_BEST_ENTRIES);
  assert.equal(list[0].seed, `SEED${MAX_BEST_ENTRIES + 9}`, 'the best run is first');
  for (let i = 1; i < list.length; i += 1) assert.ok(list[i - 1].score >= list[i].score);
  assert.equal(p.stats.matches, MAX_BEST_ENTRIES + 10, 'the totals count every match, capped list or not');
});

test('the favourite doctrine is the one with the most towers', () => {
  assert.equal(favouriteDoctrine(emptyProfile().stats), null);
  let p = recordMatch(emptyProfile(), run({ doctrines: { flame: 3, laser: 5 } }), 1000);
  assert.equal(favouriteDoctrine(p.stats), 'laser');
  p = recordMatch(p, run({ seed: 'B', doctrines: { flame: 9 } }), 2000);
  assert.equal(favouriteDoctrine(p.stats), 'flame');
});

// ---------- Export and import ----------

test('an exported profile is accepted again unchanged', () => {
  const p = recordMatch(emptyProfile(), run(), 1000);
  const file = JSON.stringify(exportProfile(p, 2000));
  const result = parseImport(file);
  assert.equal(result.ok, true);
  assert.deepEqual(result.profile.best, p.best);
  assert.deepEqual(result.profile.stats, p.stats);
  assert.deepEqual(result.summary, summarize(p));
});

test('broken and foreign files are refused with a reason', () => {
  assert.equal(parseImport('{kaputt').error, IMPORT_ERRORS.parse);
  assert.equal(parseImport('[]').error, IMPORT_ERRORS.parse);
  assert.equal(parseImport('"text"').error, IMPORT_ERRORS.parse);
  assert.equal(parseImport('null').error, IMPORT_ERRORS.parse);
  assert.equal(parseImport(JSON.stringify({ best: {}, stats: {} })).error, IMPORT_ERRORS.magic);
  assert.equal(parseImport(JSON.stringify({ magic: 'anderes-spiel' })).error, IMPORT_ERRORS.magic);
  assert.equal(
    parseImport(JSON.stringify({ magic: PROFILE_MAGIC, version: PROFILE_VERSION + 1 })).error,
    IMPORT_ERRORS.future,
  );
  assert.equal(parseImport(JSON.stringify(exportProfile(emptyProfile()))).error, IMPORT_ERRORS.empty);
});

test('a file with a plausible shell but rotten contents is refused, not half-read', () => {
  const file = { magic: PROFILE_MAGIC, version: PROFILE_VERSION, best: { 2: ['nope'] }, stats: 'weg' };
  assert.equal(parseImport(JSON.stringify(file)).error, IMPORT_ERRORS.empty);
});

// ---------- The stored instance ----------

test('the store round-trips through the storage layer', async () => {
  const backend = fakeLocalStorage();
  const store = createProfileStore(createStorage(backend));
  await store.load();
  store.record(run(), 1000);

  const again = createProfileStore(createStorage(backend));
  await again.load();
  assert.equal(bestForSeed(again.values, 'BASTION').score, 15740);
  assert.equal(again.values.stats.matches, 1);
  assert.equal(again.locked, false);
});

test('a store without a backend still plays, it just forgets', async () => {
  const store = createProfileStore(createStorage(null));
  await store.load();
  store.record(run(), 1000);
  assert.equal(store.values.stats.matches, 1, 'the running session still sees its record');
});

test('a profile from a newer build is never overwritten', async () => {
  const backend = fakeLocalStorage();
  const written = JSON.stringify({ version: PROFILE_VERSION + 1, best: { 2: [run()] } });
  backend.setItem('nachschubfront:profile', written);

  const store = createProfileStore(createStorage(backend));
  await store.load();
  assert.equal(store.locked, true);
  store.record(run(), 1000);
  assert.equal(backend.getItem('nachschubfront:profile'), written, 'the newer document is untouched');

  // An import is the player deciding; that releases the lock.
  store.replace(parseImport(JSON.stringify(exportProfile(recordMatch(emptyProfile(), run(), 1)))).profile);
  assert.equal(store.locked, false);
  assert.notEqual(backend.getItem('nachschubfront:profile'), written);
});

test('reset empties the record', async () => {
  const store = createProfileStore(createStorage(fakeLocalStorage()));
  await store.load();
  store.record(run(), 1000);
  store.reset();
  assert.deepEqual(store.values.best, {});
  assert.equal(store.values.stats.matches, 0);
});

// ---------- Format 2: compartments per run configuration (M7a, A4) ----------

/** A full version-1 profile: several ruleset versions, one of them at the cap. */
function formatOne() {
  const full = Array.from({ length: MAX_BEST_ENTRIES }, (_, i) => run({ seed: `S${i}`, score: 1000 + i }));
  return {
    version: 1,
    best: { 2: [run({ seed: 'ALT', score: 7 })], 5: full, [RULESET_VERSION]: [run({ score: 42 })] },
    stats: { matches: 60, victories: 4, kills: 900, bestWave: 50, seconds: 99, doctrines: { tesla: 3 } },
    meta: { app: '0.9.1', updated: 5 },
  };
}

test('format 1 becomes format 2 without losing a run, under every ruleset version', () => {
  const { profile, future } = migrateProfile(formatOne());
  assert.equal(future, false);
  assert.equal(profile.version, 2);
  assert.equal(bestList(profile, DEFAULT_RUN_KEY, 2)[0].seed, 'ALT');
  assert.equal(bestList(profile, DEFAULT_RUN_KEY, 5).length, MAX_BEST_ENTRIES, 'a full list stays full');
  assert.equal(bestList(profile, DEFAULT_RUN_KEY, RULESET_VERSION)[0].score, 42);
  assert.equal(DEFAULT_RUN_KEY, 'standard|1|normal');
  assert.deepEqual(profile.stats.byMode, { standard: { matches: 60, victories: 4, bestWave: 50 } });
  assert.equal(profile.stats.kills, 900, 'the totals stay as they were');
  assert.equal(summarize(profile).seeds, MAX_BEST_ENTRIES + 2);
});

test('the migration names no ruleset version: any number moves the same way', () => {
  const { profile } = migrateProfile({ version: 1, best: { 9999: [run()] } });
  assert.equal(bestList(profile, DEFAULT_RUN_KEY, 9999).length, 1);
});

test('a match in another mode lands in its own compartment and statistics', () => {
  let p = recordMatch(emptyProfile(), run({ score: 500 }), 1000);
  p = recordMatch(p, run({ score: 900, victory: true, mode: 'standard-klon', modeRev: 1, difficulty: 'normal' }), 2000);
  assert.equal(bestForSeed(p, 'BASTION').score, 500, 'standard does not see the clone run');
  assert.equal(bestForSeed(p, 'BASTION', 'standard-klon|1|normal').score, 900);
  assert.deepEqual(p.stats.byMode['standard-klon'], { matches: 1, victories: 1, bestWave: 12 });
  assert.deepEqual(p.stats.byMode.standard, { matches: 1, victories: 0, bestWave: 12 });
  assert.equal(p.stats.matches, 2, 'the global statistics count both');
});

test('a compartment of a mode this build does not know survives an import', () => {
  const p = recordMatch(emptyProfile(), run({ mode: 'aus-der-zukunft', modeRev: 3, difficulty: 'hart' }), 1000);
  const back = parseImport(JSON.stringify(exportProfile(p, 0)));
  assert.ok(back.ok);
  assert.equal(bestForSeed(back.profile, 'BASTION', 'aus-der-zukunft|3|hart').score, 15740);
  assert.equal(back.profile.stats.byMode['aus-der-zukunft'].matches, 1);
});

test('an export is format 2, and a format-1 file is still accepted', () => {
  const p = recordMatch(emptyProfile(), run(), 1000);
  assert.equal(exportProfile(p, 0).version, 2);
  const old = { magic: PROFILE_MAGIC, ...formatOne() };
  const result = parseImport(JSON.stringify(old));
  assert.ok(result.ok);
  assert.equal(bestList(result.profile, DEFAULT_RUN_KEY, 5).length, MAX_BEST_ENTRIES);
});
