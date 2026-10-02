// The device settings: only known keys in their range survive (M7a adds lastRun).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePrefs, PREF_DEFAULTS } from '../../src/core/prefs.js';

test('the last run configuration is remembered as two ids', () => {
  assert.deepEqual(PREF_DEFAULTS.lastRun, { mode: 'standard', difficulty: 'normal' });
  const p = sanitizePrefs({ lastRun: { mode: 'standard-klon', difficulty: 'normal', extra: 1 } });
  assert.deepEqual(p.lastRun, { mode: 'standard-klon', difficulty: 'normal' });
});

test('a mode this build does not know is kept as an id; the menu decides', () => {
  assert.equal(sanitizePrefs({ lastRun: { mode: 'aus-der-zukunft', difficulty: 'normal' } }).lastRun.mode, 'aus-der-zukunft');
});

test('a broken last run falls back to the default', () => {
  for (const bad of [null, 'standard', { mode: 7 }, { mode: 'standard' }, { mode: 'A B', difficulty: 'normal' }]) {
    assert.deepEqual(sanitizePrefs({ lastRun: bad }).lastRun, PREF_DEFAULTS.lastRun);
  }
});
