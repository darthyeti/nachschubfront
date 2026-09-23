import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickLevel,
  nextFlip,
  towerLayers,
  towerSpriteSet,
  enemySprite,
  chevronMarkup,
  ENEMY_TYPES,
  DOCTRINES,
  RASTER_LEVELS,
} from '../../src/render/sprites/compose.js';
import { TOWER_WEAPONS } from '../../src/render/sprites/manifest.js';
import { ENEMY_SPRITES } from '../../src/render/sprites/enemies.js';
import { TOWER_SPRITES } from '../../src/render/sprites/towers.js';
import { ENEMIES, BOSSES, ALL_ENEMIES } from '../../src/data/enemies.js';

test('every enemy type in the game data has a sprite', () => {
  assert.deepEqual([...ENEMY_TYPES].sort(), Object.keys(ALL_ENEMIES).sort());
  for (const type of ENEMY_TYPES) {
    const s = enemySprite(type);
    assert.ok(s.bbox[2] > 0 && s.bbox[3] > 0, type);
  }
});

test('imported libraries contain all concept symbols', () => {
  for (const id of ['e-swarm', 'e-mutant', 'e-brute', 'e-ghost', 'e-flyer', 'e-burst', 'e-heal']) {
    assert.ok(ENEMY_SPRITES.symbols[id], id);
    assert.ok(ENEMY_SPRITES.defs.includes(`id="${id}"`), id);
  }
  for (const id of ['base', 'sb-back', 'sb-front', 't-flame', 't-ac', 't-laser', 't-mortar', 't-psi', 't-tesla']) {
    assert.ok(TOWER_SPRITES.symbols[id], id);
  }
  // M4: every doctrine is split into a back layer, and all but the tesla into a weapon.
  for (const id of ['t-flame', 't-ac', 't-laser', 't-mortar', 't-psi', 't-tesla']) {
    assert.ok(TOWER_SPRITES.symbols[`${id}-back`], `${id}-back`);
  }
  for (const id of ['t-flame', 't-ac', 't-laser', 't-mortar', 't-psi']) {
    assert.ok(TOWER_SPRITES.symbols[`${id}-gun`], `${id}-gun`);
  }
  assert.ok(!TOWER_SPRITES.symbols['t-tesla-gun'], 'the tesla coil has no moving weapon');
  assert.ok(!ENEMY_SPRITES.defs.includes('id="sil"'), 'unused silhouette filter is dropped');
});

test('enemies stand on the ground: sprite bottom is at SVG y = 0 (flyers hover above)', () => {
  const PAD = 5; // stroke padding added by the importer
  for (const type of ENEMY_TYPES) {
    const [, y, , h] = enemySprite(type).bbox;
    const bottom = y + h - PAD;
    // Bosses share the artwork of the enemy they borrow it from.
    const source = ALL_ENEMIES[type].sprite ?? type;
    if (ALL_ENEMIES[type].flying) assert.ok(bottom < -10, `${type} bottom ${bottom}`);
    // The warp seer floats a little above the ground on its tentacles (concept art).
    else if (source === 'warpseer') assert.ok(bottom < 0 && bottom > -15, `${type} bottom ${bottom}`);
    else if (source === 'healer') assert.ok(bottom > 0, 'healer aura reaches below the feet');
    else assert.ok(Math.abs(bottom) <= 1, `${type} bottom ${bottom}`);
  }
});

test('pickLevel chooses the smallest sharp-enough level', () => {
  assert.equal(pickLevel(0.4), 0.5);
  assert.equal(pickLevel(0.5), 0.5);
  assert.equal(pickLevel(0.72), 1);
  assert.equal(pickLevel(1), 1);
  assert.equal(pickLevel(1.3), 2);
  assert.equal(pickLevel(2.2), 2.5);
  assert.equal(pickLevel(9), RASTER_LEVELS.at(-1));
});

test('nextFlip mirrors when moving right on screen, with a dead zone', () => {
  assert.equal(nextFlip(false, 1, 0), true, '+x moves right-down on screen');
  assert.equal(nextFlip(true, 0, 1), false, '+y moves left-down on screen');
  assert.equal(nextFlip(false, -1, 0), false);
  assert.equal(nextFlip(false, 0, -1), true);
  // Diagonal +x+y is straight down on screen: keep the current side.
  assert.equal(nextFlip(true, 0.7071, 0.7071), true);
  assert.equal(nextFlip(false, 0.7071, 0.7071), false);
});

test('tower layers: sandbag ring from veteran on, except doctrines with their own', () => {
  assert.deepEqual(towerLayers('flame', 1), { back: ['base', 't-flame-back'], gun: ['t-flame-gun'], front: null });
  assert.deepEqual(towerLayers('flame', 2), {
    back: ['base', 'sb-back', 't-flame-back'],
    gun: ['t-flame-gun'],
    front: ['sb-front'],
  });
  assert.deepEqual(towerLayers('tesla', 5), { back: ['base', 'sb-back', 't-tesla-back'], gun: null, front: ['sb-front'] });
  // The mortar brings its own sandbags inside its group, the autocannon uses the shared ones.
  assert.deepEqual(towerLayers('mortar', 2), {
    back: ['base', 't-mortar-back'],
    gun: ['t-mortar-gun'],
    front: ['t-mortar-front'],
  });
  assert.deepEqual(towerLayers('autocannon', 1), {
    back: ['base', 'sb-back', 't-ac-back'],
    gun: ['t-ac-gun'],
    front: ['sb-front', 't-ac-front'],
  });
  assert.throws(() => towerLayers('flame', 0));
  assert.throws(() => towerLayers('flame', 6));
  assert.throws(() => towerLayers('bogus', 1));
});

test('every doctrine with a weapon knows where it turns and where its muzzle is', () => {
  for (const doctrine of DOCTRINES) {
    const set = towerSpriteSet(doctrine, 1);
    const weapon = TOWER_WEAPONS[doctrine];
    assert.ok(weapon, doctrine);
    assert.equal(weapon.pivot.length, 2, doctrine);
    if (!set.gun) continue;
    // A weapon that aims needs a resting angle and a muzzle; the psi crystal only floats.
    if (weapon.float) continue;
    assert.equal(typeof weapon.rest, 'number', doctrine);
    assert.ok(weapon.muzzle > 0, doctrine);
    // The pivot has to lie inside the weapon's own bounds, otherwise it turns off its mount.
    const [x, y, w, h] = set.gun.bbox;
    assert.ok(weapon.pivot[0] >= x && weapon.pivot[0] <= x + w, `${doctrine}: pivot x`);
    assert.ok(weapon.pivot[1] >= y && weapon.pivot[1] <= y + h, `${doctrine}: pivot y`);
  }
});

test('chevrons: one per rank, gold only for legend', () => {
  for (let rank = 1; rank <= 5; rank++) {
    const markup = chevronMarkup(rank);
    // Each chevron is an ink outline plus a coloured stroke.
    assert.equal((markup.match(/<polyline/g) ?? []).length, rank * 2);
    assert.equal(markup.includes('#f2c14e'), rank === 5, `rank ${rank}`);
  }
});

test('tower sprites cover all layers and render as standalone SVG', () => {
  for (const doctrine of DOCTRINES) {
    for (let rank = 1; rank <= 5; rank++) {
      const set = towerSpriteSet(doctrine, rank);
      const layers = towerLayers(doctrine, rank);
      for (const name of ['back', 'gun', 'front']) {
        if (!layers[name]) {
          assert.equal(set[name], null, `${doctrine} ${name}`);
          continue;
        }
        const def = set[name];
        const svg = def.svg(2);
        assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
        for (const id of layers[name]) assert.ok(svg.includes(`<use href="#${id}"/>`), id);
      }
      // The base and the rank chevrons ride on the back layer.
      const [x, y, w, h] = set.back.bbox;
      const base = TOWER_SPRITES.symbols.base.bbox;
      assert.ok(x <= base[0] && y <= base[1] && x + w >= base[0] + base[2] && y + h >= base[1] + base[3]);
      assert.equal((set.back.svg(1).match(/<polyline/g) ?? []).length, rank * 2);
    }
  }
});

test('layers that look the same at several ranks share one raster', () => {
  // Only the back layer changes with the rank (chevrons, sandbags).
  assert.equal(towerSpriteSet('flame', 3).gun.key, towerSpriteSet('flame', 5).gun.key);
  assert.notEqual(towerSpriteSet('flame', 3).back.key, towerSpriteSet('flame', 5).back.key);
  assert.notEqual(towerSpriteSet('flame', 1).gun.key, towerSpriteSet('laser', 1).gun.key);
});

test('effects painted into the concept art are gone; code draws them now', () => {
  // Flame jet, muzzle arcs, mortar smoke, laser and tesla glow, lightning.
  assert.ok(!TOWER_SPRITES.defs.includes('id="ac-core"'), 'the autocannon core is split up');
  const gun = towerSpriteSet('flame', 1).gun.svg(1);
  assert.ok(!gun.includes('#ff8a2a'), 'no flame is baked into the nozzle');
});

test('svg pixel size follows the requested scale', () => {
  const s = enemySprite('warrior');
  const svg = s.svg(3);
  const [, , w, h] = s.bbox;
  assert.ok(svg.includes(`width="${Math.ceil(w * 3)}"`) && svg.includes(`height="${Math.ceil(h * 3)}"`));
});

test('bosses borrow the artwork of a normal enemy and are drawn larger', () => {
  const plain = enemySprite('breaker');
  for (const [id, boss] of Object.entries(BOSSES)) {
    const s = enemySprite(id);
    assert.deepEqual(s.bbox, enemySprite(boss.sprite).bbox, id);
    assert.ok(s.unitScale > enemySprite(boss.sprite).unitScale, id);
    assert.notEqual(s.key, enemySprite(boss.sprite).key, `${id}: own raster entry`);
    assert.ok(s.unitScale > plain.unitScale, id);
  }
});
