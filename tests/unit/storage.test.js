import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../../src/storage/index.js';

function fakeLocalStorage() {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

function brokenLocalStorage() {
  const fail = () => {
    throw new Error('SecurityError');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

test('set, get and remove round-trip JSON values', async () => {
  const ls = fakeLocalStorage();
  const s = createStorage(ls);
  const value = { best: 12345, seeds: ['Bastion'], volume: 0.8 };

  assert.equal(await s.set('stats', value), true);
  assert.deepEqual(await s.get('stats'), value);
  assert.ok(ls.data.has('nachschubfront:stats'), 'keys are namespaced');

  await s.remove('stats');
  assert.equal(await s.get('stats'), null);
});

test('missing keys return the fallback', async () => {
  const s = createStorage(fakeLocalStorage());
  assert.equal(await s.get('nope'), null);
  assert.deepEqual(await s.get('nope', { a: 1 }), { a: 1 });
});

test('corrupt data returns the fallback', async () => {
  const ls = fakeLocalStorage();
  ls.setItem('nachschubfront:settings', '{broken');
  const s = createStorage(ls);
  assert.equal(await s.get('settings', 'default'), 'default');
});

test('works without any backend (in-memory)', async () => {
  const s = createStorage(null);
  assert.equal(s.persistent, false);
  assert.equal(await s.set('k', 1), false, 'reports that nothing was persisted');
  assert.equal(await s.get('k'), 1);
  await s.remove('k');
  assert.equal(await s.get('k'), null);
});

test('a throwing backend never breaks the game', async () => {
  const s = createStorage(brokenLocalStorage());
  assert.equal(await s.set('k', { x: 1 }), false);
  assert.deepEqual(await s.get('k'), { x: 1 }, 'memory copy still serves reads');
  await s.remove('k');
  assert.equal(await s.get('k', 'fb'), 'fb');
});

test('unserializable values are rejected, not thrown', async () => {
  const s = createStorage(fakeLocalStorage());
  const cyclic = {};
  cyclic.self = cyclic;
  assert.equal(await s.set('k', cyclic), false);
});

test('default instance starts in node without localStorage', async () => {
  const { storage } = await import('../../src/storage/index.js');
  assert.equal(typeof storage.get, 'function');
  assert.equal(await storage.get('anything', 'fb'), 'fb');
});
