// Where each emplacement's effect starts (docs/ART.md, "Wirkungsanker").
//
// This is render-side only: the simulation keeps firing from the middle of the
// cell, and the tests below say so. What they guard is that the drawing no
// longer starts there — a chain has to leave the coil, a shell the muzzle, the
// judgement the eye — and that every anchor sits on the figure it belongs to.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { iso } from '../../src/render/iso.js';
import { towerAnchor, towerSet, towerPictureBox } from '../../src/render/towerSprites.js';
import { specialSpriteSet, DOCTRINES, SPECIALS } from '../../src/render/sprites/compose.js';
import { TOWER_TOPS, BUNKER_ROOF, SPECIAL_ROOF } from '../../src/render/sprites/manifest.js';
import { weaponOf } from '../../src/render/weapons.js';
import { SPECIAL_MUZZLE, FX_SIGHT_SECONDS } from '../../src/data/art.js';
import { SPECIALS as SPECIAL_STATS } from '../../src/data/specials.js';
import { MAX_RANK } from '../../src/data/ranks.js';

const CELL = { x: 3, y: 4 };

function emplacement(special) {
  return { id: 1, ...CELL, doctrine: SPECIAL_STATS[special].doctrine, rank: null, special };
}

const bunker = (doctrine, rank = 3) => ({ id: 2, ...CELL, doctrine, rank, special: null });

test('every emplacement names where its effect starts', () => {
  for (const id of DOCTRINES) {
    const top = TOWER_TOPS[id];
    assert.ok(top, `${id} has no top entry`);
    assert.ok(Array.isArray(top.tip) && top.tip.length === 2, `${id} has no muzzle`);
  }
  // Since 0.11.10 the recipe emplacements have a model with a muzzle of its own, like the doctrines.
  for (const id of SPECIALS) {
    const model = weaponOf(emplacement(id));
    assert.ok(model, `${id} has no weapon model`);
    const { at, dir } = model.muzzle({ tube: 0, bob: 0, recoil: 0, bar: [0, 0, 0, 0] });
    assert.ok(at.every(Number.isFinite) && dir.length === 3, `${id} has no muzzle`);
  }
});

test('an anchor sits on the figure, above the ground of its cell', () => {
  const ground = iso(CELL.x + 0.5, CELL.y + 0.5);
  for (const tower of [...SPECIALS.map(emplacement), ...DOCTRINES.map((d) => bunker(d))]) {
    const name = tower.special ?? tower.doctrine;
    const [ax, ay] = towerAnchor(tower);
    assert.ok(ay < ground[1], `${name}: the anchor is not above the ground (${ay} vs ${ground[1]})`);

    // Inside the drawn figure, in the same screen space: the base, the top that stands on the roof and
    // the area the turned weapon covers.
    const [x0, , x1, y1] = towerPictureBox(tower);
    assert.ok(ax >= ground[0] + x0 - 1 && ax <= ground[0] + x1 + 1, `${name}: anchor outside the figure sideways`);
    assert.ok(ay <= ground[1] + y1 + 1, `${name}: anchor below the figure`);
  }
});

test('no anchor is simply the middle of the cell', () => {
  const ground = iso(CELL.x + 0.5, CELL.y + 0.5);
  for (const tower of [...SPECIALS.map(emplacement), ...DOCTRINES.map((d) => bunker(d))]) {
    const [ax, ay] = towerAnchor(tower);
    assert.ok(
      Math.hypot(ax - ground[0], ay - ground[1]) > 10,
      `${tower.special ?? tower.doctrine}: the effect would still start at the generic middle`,
    );
  }
});

test('an anchor is up on the roof, not down at the foot of the bunker', () => {
  const ground = iso(CELL.x + 0.5, CELL.y + 0.5);
  for (const doctrine of DOCTRINES) {
    const [, ay] = towerAnchor(bunker(doctrine));
    assert.ok(ay <= ground[1] - BUNKER_ROOF, `${doctrine}: the effect starts below the roof plate`);
  }
  for (const id of SPECIALS) {
    const [, ay] = towerAnchor(emplacement(id));
    assert.ok(ay <= ground[1] - SPECIAL_ROOF, `${id}: the effect starts below the hatch`);
  }
});

test('the battery fires from four barrels, each with a muzzle of its own', () => {
  const model = weaponOf(emplacement('stormBattery'));
  const muzzles = SPECIAL_MUZZLE.stormBattery.barrels.map((_, tube) => model.muzzle({ tube, bar: [0, 0, 0, 0] }).at.join());
  assert.equal(new Set(muzzles).size, 4, 'two over two, every barrel in its own place');
  // And the barrel that has just fired is slid back.
  const back = model.muzzle({ tube: 1, bar: [0, 1, 0, 0] }).at[0];
  assert.ok(back < model.muzzle({ tube: 1, bar: [0, 0, 0, 0] }).at[0]);
});

test('the siege mortar leans left, like every top in the library', () => {
  const ground = iso(CELL.x + 0.5, CELL.y + 0.5);
  const [ax, ay] = towerAnchor(emplacement('siegeMortar'));
  assert.ok(ax < ground[0], 'the tube rests pointing left');
  assert.ok(ay < ground[1], 'and upwards');
  assert.ok(FX_SIGHT_SECONDS > 0, 'and it draws its aiming line');
});

test('a part that hovers is a layer of its own, and the shrine is always drawn live', () => {
  // The ring and ball of the thunder tower and the eye of the obelisk are drawn over the cached stage;
  // the artefact of the shrine floats between its pillars, so the shrine has no stage to rest on.
  assert.deepEqual(weaponOf(emplacement('thunderTower')).live, ['float']);
  assert.deepEqual(weaponOf(emplacement('soulfireObelisk')).live, ['float']);
  assert.equal(weaponOf(emplacement('purgeShrine')).always, true);
  for (const id of ['stormBattery', 'emberCauldron', 'siegeMortar']) assert.deepEqual(weaponOf(emplacement(id)).live, [], id);
});

test('every emplacement is a base and a top, and nothing in front of them', () => {
  // The bunker kit replaced the layered socket of v4: the ranks are drawn into
  // the bunker itself, so there is nothing left to stack (docs/ART.md).
  for (const id of SPECIALS) {
    const set = specialSpriteSet(id);
    assert.equal(set.back.key, `tower:specialbase-${id}`, `${id} stands on a special base in its colours`);
    assert.equal(set.gun, null, `${id}: the weapon is a model, not a sprite`);
    assert.equal(set.front, null, `${id} has a front layer it should not have`);
  }
  for (const doctrine of DOCTRINES) {
    for (let rank = 1; rank <= MAX_RANK; rank++) {
      const set = towerSet(bunker(doctrine, rank));
      assert.equal(set.back.key, `tower:bunker-${doctrine}-${rank}`, `${doctrine} rank ${rank}`);
      assert.equal(set.front, null);
    }
  }
});
