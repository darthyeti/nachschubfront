import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parallaxOffset } from '../../src/render/backdrop.js';

test('the backdrop follows a fraction of the camera offset', () => {
  assert.equal(parallaxOffset(0, 0.14, 260), 0);
  assert.equal(parallaxOffset(500, 0.14, 260), 70);
  assert.equal(parallaxOffset(-500, 0.14, 260), -70);
});

test('the backdrop never shifts further than the padding around the viewport', () => {
  assert.equal(parallaxOffset(1e6, 0.14, 260), 260);
  assert.equal(parallaxOffset(-1e6, 0.14, 260), -260);
  // Exactly at the limit it still returns the padding, not more.
  assert.equal(parallaxOffset(260 / 0.14, 0.14, 260), 260);
});
