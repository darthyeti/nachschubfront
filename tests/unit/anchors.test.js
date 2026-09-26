// Where each emplacement's effect starts (docs/ART.md, "Wirkungsanker").
//
// This is render-side only: the simulation keeps firing from the middle of the
// cell, and the tests below say so. What they guard is that the drawing no
// longer starts there — a chain has to leave the coil, a shell the muzzle, the
// judgement the eye — and that every anchor sits on the figure it belongs to.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { iso } from '../../src/render/iso.js';
import { towerAnchor, towerSparks, towerSet } from '../../src/render/towerSprites.js';
import { specialSpriteSet, DOCTRINES, SPECIALS } from '../../src/render/sprites/compose.js';
import { TOWER_TOPS, BUNKER_ROOF, SPECIAL_ROOF } from '../../src/render/sprites/manifest.js';
import { SPECIALS as SPECIAL_STATS } from '../../src/data/specials.js';
import { MAX_RANK } from '../../src/data/ranks.js';

const CELL = { x: 3, y: 4 };

function emplacement(special) {
  return { id: 1, ...CELL, doctrine: SPECIAL_STATS[special].doctrine, rank: null, special };
}

const bunker = (doctrine, rank = 3) => ({ id: 2, ...CELL, doctrine, rank, special: null });

test('every emplacement names where its effect starts', () => {
  for (const id of [...DOCTRINES, ...SPECIALS]) {
    const top = TOWER_TOPS[id];
    assert.ok(top, `${id} has no top entry`);
    assert.ok(Array.isArray(top.tip) && top.tip.length === 2, `${id} has no muzzle`);
  }
});

test('an anchor sits on the figure, above the ground of its cell', () => {
  const ground = iso(CELL.x + 0.5, CELL.y + 0.5);
  for (const tower of [...SPECIALS.map(emplacement), ...DOCTRINES.map((d) => bunker(d))]) {
    const name = tower.special ?? tower.doctrine;
    const [ax, ay] = towerAnchor(tower);
    assert.ok(ay < ground[1], `${name}: the anchor is not above the ground (${ay} vs ${ground[1]})`);

    // Inside the drawn figure, in the same screen space. The top is a layer of
    // its own and stands on the roof, so both layers count.
    const set = towerSet(tower);
    const layers = [set.back, set.gun, set.front].filter(Boolean);
    const left = ground[0] + Math.min(...layers.map((l) => l.bbox[0] * l.unitScale));
    const right = ground[0] + Math.max(...layers.map((l) => (l.bbox[0] + l.bbox[2]) * l.unitScale));
    const bottom = ground[1] + Math.max(...layers.map((l) => (l.bbox[1] + l.bbox[3]) * l.unitScale - l.anchorZ));
    assert.ok(ax >= left - 1 && ax <= right + 1, `${name}: anchor outside the figure sideways`);
    assert.ok(ay <= bottom + 1, `${name}: anchor below the figure`);
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

test('the four points the cauldron sparks from, and nothing else has several', () => {
  const many = ['emberCauldron', 'stormBattery'];
  for (const id of SPECIALS) {
    const sparks = towerSparks(emplacement(id));
    if (many.includes(id)) assert.equal(sparks.length, 4, `${id}: one per electrode or mouth`);
    else assert.equal(sparks.length, 0, `${id} should have the one anchor`);
  }
  for (const doctrine of DOCTRINES) {
    assert.equal(towerSparks(bunker(doctrine)).length, 0, `${doctrine} fires from its one muzzle`);
  }
});

test('the siege mortar leans left, like every top in the library', () => {
  const ground = iso(CELL.x + 0.5, CELL.y + 0.5);
  const [ax, ay] = towerAnchor(emplacement('siegeMortar'));
  assert.ok(ax < ground[0], 'the tube rests pointing left');
  assert.ok(ay < ground[1], 'and upwards');
  assert.equal(TOWER_TOPS.siegeMortar.sight, true, 'and it draws its aiming line');
});

test('a hovering part that is not psi-coloured carries its own halo', () => {
  // The shrine is a flame building and the thunder tower a tesla one, but both
  // hover a part of another colour; without this the halo would take the
  // doctrine's colour.
  for (const id of ['purgeShrine', 'thunderTower']) {
    const glow = TOWER_TOPS[id].glow;
    assert.ok(glow, `${id} has no halo of its own`);
    assert.equal(glow.kind, 'psi');
    assert.match(glow.colour, /^#[0-9a-f]{6}$/i);
  }
});

test('every emplacement is a base and a top, and nothing in front of them', () => {
  // The bunker kit replaced the layered socket of v4: the ranks are drawn into
  // the bunker itself, so there is nothing left to stack (docs/ART.md).
  for (const id of SPECIALS) {
    const set = specialSpriteSet(id);
    assert.equal(set.back.key, 'tower:specialbase', `${id} stands on the special base`);
    assert.ok(set.gun, `${id} has a top`);
    assert.equal(set.front, null, `${id} has a front layer it should not have`);
  }
  for (const doctrine of DOCTRINES) {
    for (let rank = 1; rank <= MAX_RANK; rank++) {
      const set = towerSet(bunker(doctrine, rank));
      assert.equal(set.back.key, `tower:bunker-${rank}`, `${doctrine} rank ${rank}`);
      assert.equal(set.front, null);
    }
  }
});
