import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, seedFromString } from '../../src/core/random.js';

const take = (rng, n) => Array.from({ length: n }, () => rng.next());

test('same seed yields the same sequence', () => {
  assert.deepEqual(take(createRng(12345), 1000), take(createRng(12345), 1000));
});

test('string seeds are deterministic', () => {
  assert.equal(seedFromString('Bastion'), seedFromString('Bastion'));
  assert.deepEqual(take(createRng('Bastion'), 50), take(createRng('Bastion'), 50));
});

test('different seeds yield different sequences', () => {
  assert.notDeepEqual(take(createRng(1), 20), take(createRng(2), 20));
  assert.notDeepEqual(take(createRng('a'), 20), take(createRng('b'), 20));
});

test('known sequence stays stable across versions', () => {
  // Guards against accidental algorithm changes, which would break shared seeds.
  const rng = createRng(42);
  const values = take(rng, 3).map((v) => v.toFixed(10));
  assert.deepEqual(values, ['0.6011037519', '0.4482905590', '0.8524657935']);
});

test('next() stays in [0, 1)', () => {
  const rng = createRng(7);
  for (let i = 0; i < 10000; i++) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('int() is inclusive and covers the whole range', () => {
  const rng = createRng(99);
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const v = rng.int(12, 20);
    assert.ok(Number.isInteger(v) && v >= 12 && v <= 20);
    seen.add(v);
  }
  assert.equal(seen.size, 9);
});

test('range(), chance(), pick() and shuffle() behave', () => {
  const rng = createRng(3);
  for (let i = 0; i < 1000; i++) {
    const v = rng.range(1.5, 7);
    assert.ok(v >= 1.5 && v < 7);
  }
  assert.equal(rng.chance(0), false);
  assert.equal(rng.chance(1), true);

  const items = ['Flamme', 'Autokanone', 'Laser', 'Mörser', 'Psi', 'Tesla'];
  assert.ok(items.includes(rng.pick(items)));
  assert.throws(() => rng.pick([]), RangeError);

  const shuffled = rng.shuffle(items);
  assert.deepEqual([...shuffled].sort(), [...items].sort());
  assert.equal(items[0], 'Flamme', 'shuffle must not mutate its input');
});

test('forks are deterministic and independent', () => {
  const a = createRng(500);
  const b = createRng(500);
  // Draws on one fork (or the parent) must not affect another fork.
  take(a.fork('pods'), 100);
  take(a, 17);
  assert.deepEqual(take(a.fork('map'), 50), take(b.fork('map'), 50));
  assert.notDeepEqual(take(a.fork('map'), 20), take(a.fork('pods'), 20));
});

test('invalid seeds are rejected', () => {
  assert.throws(() => createRng(NaN), TypeError);
  assert.throws(() => createRng(undefined), TypeError);
});
