// The phone's room-making for sheets (M10 E2): pure parts only; the DOM side is
// covered by tests/phone.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { podsRect } from '../../src/ui/cover.js';
import { isPhone, PHONE_QUERY } from '../../src/ui/phone.js';
import { iso } from '../../src/render/iso.js';

test('the rectangle around the capsules holds every corner of every capsule cell', () => {
  const pods = [{ x: 3, y: 4 }, { x: 10, y: 2 }, { x: 6, y: 12 }];
  const rect = podsRect(pods, () => 0);
  for (const pod of pods) {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const [wx, wy] = iso(pod.x + dx, pod.y + dy, 0);
      assert.ok(wx >= rect.x0 && wx <= rect.x1, 'inside horizontally');
      assert.ok(wy >= rect.y0 && wy <= rect.y1, 'inside vertically');
    }
  }
});

test('raised ground lifts the rectangle, and room is left above for the beam', () => {
  const flat = podsRect([{ x: 5, y: 5 }], () => 0);
  const high = podsRect([{ x: 5, y: 5 }], () => 24);
  assert.ok(high.y0 < flat.y0);
  assert.ok(flat.y0 < iso(5, 5, 0)[1], 'the beam has its room');
  assert.equal(podsRect([], () => 0), null, 'no capsules, nothing to bring in');
});

test('outside a browser nothing counts as a phone', () => {
  assert.equal(isPhone(), false);
  assert.match(PHONE_QUERY, /pointer: coarse/);
});

test('style.css holds the same phone condition as ui/phone.js', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../../src/ui/style.css', import.meta.url), 'utf8');
  assert.ok(css.includes(`@media ${PHONE_QUERY} {`), 'the phone block carries PHONE_QUERY word for word');
});
