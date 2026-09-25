// Where each recipe emplacement's effect starts (docs/ART.md, "Wirkungsanker").
//
// This is render-side only: the simulation keeps firing from the middle of the
// cell, and the tests below say so. What they guard is that the drawing no
// longer starts there — a chain has to leave the coil, a shell the muzzle, the
// judgement the eye — and that every anchor sits on the figure it belongs to.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { iso } from '../../src/render/iso.js';
import { towerAnchor, towerSparks, towerSet } from '../../src/render/towerSprites.js';
import { specialSpriteSet, SPECIALS } from '../../src/render/sprites/compose.js';
import { TOWER_WEAPONS } from '../../src/render/sprites/manifest.js';
import { SPECIALS as SPECIAL_STATS } from '../../src/data/specials.js';

const CELL = { x: 3, y: 4 };

function emplacement(special) {
  return { id: 1, ...CELL, doctrine: SPECIAL_STATS[special].doctrine, rank: null, special };
}

test('every recipe emplacement names where its effect starts', () => {
  for (const id of SPECIALS) {
    const weapon = TOWER_WEAPONS[id];
    assert.ok(weapon, `${id} has no weapon entry`);
    // Either a fixed anchor, or a tube whose muzzle is the point and moves.
    const aims = weapon.muzzle !== undefined && weapon.rest !== undefined;
    assert.ok(weapon.anchor || aims, `${id} has neither an anchor nor a muzzle`);
  }
});

test('an anchor sits on the figure, above the ground of its cell', () => {
  const ground = iso(CELL.x + 0.5, CELL.y + 0.5);
  for (const id of SPECIALS) {
    const tower = emplacement(id);
    const [ax, ay] = towerAnchor(tower);
    assert.ok(ay < ground[1], `${id}: the anchor is not above the ground (${ay} vs ${ground[1]})`);

    // Inside the drawn figure, in the same screen space. The tube is a layer of
    // its own and reaches past the rest, so both layers count.
    const set = towerSet(tower);
    const { unitScale } = set.back;
    const layers = [set.back.bbox, set.gun?.bbox, set.front?.bbox].filter(Boolean);
    const left = ground[0] + Math.min(...layers.map(([bx]) => bx)) * unitScale;
    const right = ground[0] + Math.max(...layers.map(([bx, , bw]) => bx + bw)) * unitScale;
    const bottom = ground[1] + Math.max(...layers.map(([, by, , bh]) => by + bh)) * unitScale;
    assert.ok(ax >= left - 1 && ax <= right + 1, `${id}: anchor outside the figure sideways`);
    // The hovering parts reach above every layer, so only the lower edge counts.
    assert.ok(ay <= bottom + 1, `${id}: anchor below the figure`);
  }
});

test('no anchor is simply the middle of the cell', () => {
  const ground = iso(CELL.x + 0.5, CELL.y + 0.5);
  for (const id of SPECIALS) {
    const [ax, ay] = towerAnchor(emplacement(id));
    assert.ok(
      Math.hypot(ax - ground[0], ay - ground[1]) > 10,
      `${id}: the effect would still start at the generic middle`,
    );
  }
});

test('only the cauldron has several points to spark from, and it has four', () => {
  for (const id of SPECIALS) {
    const sparks = towerSparks(emplacement(id));
    if (id === 'emberCauldron') assert.equal(sparks.length, 4, 'one per electrode');
    else assert.equal(sparks.length, 0, `${id} should have the one anchor`);
  }
});

test('the siege mortar aims its anchor: the muzzle, not a fixed point', () => {
  const weapon = TOWER_WEAPONS.siegeMortar;
  assert.equal(weapon.anchor, undefined, 'a tube that turns cannot have a fixed anchor');
  assert.ok(weapon.muzzle > 0 && weapon.rest !== undefined);
  assert.equal(weapon.sight, true, 'and it draws its aiming line');

  // Without a shot fired the muzzle sits at the resting angle, up and to the
  // left, which is the pose every weapon in the library is drawn in.
  const [ax, ay] = towerAnchor(emplacement('siegeMortar'));
  const ground = iso(CELL.x + 0.5, CELL.y + 0.5);
  assert.ok(ax < ground[0], 'the tube rests pointing left');
  assert.ok(ay < ground[1], 'and upwards');
});

test('a hovering part that is not psi-coloured carries its own halo', () => {
  // The shrine is a flame building and the thunder tower a tesla one, but both
  // hover a psi part; without this the halo would take the doctrine's colour.
  for (const id of ['purgeShrine', 'thunderTower']) {
    const glow = TOWER_WEAPONS[id].glow;
    assert.ok(glow, `${id} has no halo of its own`);
    assert.equal(glow.kind, 'psi');
    assert.match(glow.colour, /^#[0-9a-f]{6}$/i);
    assert.notEqual(glow.colour, undefined);
  }
});

test('only the siege mortar has something drawn in front of its weapon', () => {
  // It is the first recipe building with a front layer (the sandbags and the
  // wheels); the others must not have grown one by accident.
  assert.ok(specialSpriteSet('siegeMortar').front, 'the sandbags and wheels are drawn');
  for (const id of SPECIALS) {
    if (id === 'siegeMortar') continue;
    assert.equal(specialSpriteSet(id).front, null, `${id} has a front layer it should not have`);
  }
});
