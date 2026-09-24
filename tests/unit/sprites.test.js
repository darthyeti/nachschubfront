import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickLevel,
  nextFlip,
  towerLayers,
  towerSpriteSet,
  plateMarkup,
  goldEdgeMarkup,
  specialSpriteSet,
  SPECIALS,
  RANK_DETAIL,
  enemySprite,
  podSpriteSet,
  chevronMarkup,
  ENEMY_TYPES,
  DOCTRINES,
  RASTER_LEVELS,
} from '../../src/render/sprites/compose.js';
import { TOWER_WEAPONS, POD_PETALS, POD_PETAL_ORDER, POD_OPEN_SCALE, SPRITE_SCALE } from '../../src/render/sprites/manifest.js';
import { ENEMY_SPRITES } from '../../src/render/sprites/enemies.js';
import { TOWER_SPRITES } from '../../src/render/sprites/towers.js';
import { POD_SPRITES } from '../../src/render/sprites/pods.js';
import { petalOpen, isOpening, shellFade, POD_SPRITE_DEFS } from '../../src/render/pods.js';
import { PODS } from '../../src/data/pods.js';
import { ENEMIES, BOSSES, ALL_ENEMIES } from '../../src/data/enemies.js';
import { RECIPE_IDS } from '../../src/data/recipes.js';

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
  // M4: every doctrine is split into a back layer, and those that aim into a weapon.
  for (const id of ['t-flame', 't-ac', 't-laser', 't-mortar', 't-psi', 't-tesla']) {
    assert.ok(TOWER_SPRITES.symbols[`${id}-back`], `${id}-back`);
  }
  for (const id of ['t-laser', 't-mortar', 't-psi']) {
    assert.ok(TOWER_SPRITES.symbols[`${id}-gun`], `${id}-gun`);
  }
  assert.ok(!TOWER_SPRITES.symbols['t-tesla-gun'], 'the tesla coil has no moving weapon');
  // M4d: the two bunkers are one piece, with nothing that aims and nothing in front.
  for (const id of ['t-flame-gun', 't-ac-gun', 't-ac-front']) {
    assert.ok(!TOWER_SPRITES.symbols[id], `${id} went with the shared bunker`);
  }
  assert.ok(!ENEMY_SPRITES.defs.includes('id="sil"'), 'unused silhouette filter is dropped');

  // M4c: the capsule, closed in one piece and open in core plus four segments.
  for (const id of ['pod-shell', 'pod-core', ...POD_PETALS.map((p) => p.id)]) {
    assert.ok(POD_SPRITES.symbols[id], id);
  }
  for (const id of ['pod-a', 'pod-c']) {
    assert.ok(!POD_SPRITES.symbols[id], `${id} is a discarded design and is not imported`);
  }
  for (const id of ['pod-b', 'pod-open']) {
    assert.ok(!POD_SPRITES.symbols[id], `${id} is only a wrapper for the concept sheet`);
  }
});

test('the capsule: one closed sprite, four segments around a core', () => {
  const set = podSpriteSet();
  assert.equal(set.petals.length, 4);
  assert.deepEqual(set.petals.map((p) => p.id), POD_PETAL_ORDER, 'drawn in opening order');
  assert.equal(set.petals.filter((p) => p.layer === 'back').length, 2, 'two behind the core');
  assert.equal(set.petals.filter((p) => p.layer === 'front').length, 2, 'two in front of it');
  assert.deepEqual([...new Set(set.petals.map((p) => p.order))].sort(), [0, 1, 2, 3], 'each opens at its own time');

  // The opened capsule is drawn smaller, so it does not bury its neighbours.
  assert.equal(set.shell.unitScale, SPRITE_SCALE.pod);
  assert.equal(set.core.unitScale, SPRITE_SCALE.pod * POD_OPEN_SCALE);
  for (const p of set.petals) assert.equal(p.sprite.unitScale, set.core.unitScale, p.id);

  // Two scales of the same artwork must not share a raster.
  const keys = [set.shell, set.core, ...set.petals.map((p) => p.sprite)].map((d) => d.key);
  assert.equal(new Set(keys).size, keys.length, 'every part has its own key');
});

test('the capsule stands on the ground and fits its cell', () => {
  const PAD = 5; // stroke padding added by the importer
  const set = podSpriteSet();
  const [, y, w, h] = set.shell.bbox;
  assert.ok(Math.abs(y + h - PAD - 6) <= 1, `closed capsule bottom ${y + h - PAD}`);
  // The heat shield covers about nine tenths of a cell, like an emplacement's base.
  assert.ok(Math.abs((w - 2 * PAD) * set.shell.unitScale - 64 * 0.9) < 1.5, 'closed width');

  // Open it spans more than a cell, which docs/ART.md accepts, but not two.
  const spread = set.petals.map((p) => {
    const [bx, , bw] = p.sprite.bbox;
    return [bx, bx + bw];
  });
  const width = (Math.max(...spread.map((s) => s[1])) - Math.min(...spread.map((s) => s[0]))) * set.core.unitScale;
  assert.ok(width > 64 && width < 128, `opened capsule spans ${width.toFixed(0)} world pixels`);
});

test('the capsule opens segment by segment, and all of it within openSeconds', () => {
  const pod = (since) => ({ t: since + PODS.warnSeconds + PODS.fallSeconds });
  assert.equal(isOpening(pod(PODS.openDelaySeconds - 0.01)), false, 'shell is still one piece');
  assert.equal(isOpening(pod(PODS.openDelaySeconds)), true, 'the bolts have blown');

  // Nothing moves before the delay, and the first segment leads.
  for (let order = 0; order < 4; order++) {
    assert.equal(petalOpen(PODS.openDelaySeconds, order), 0, `segment ${order} waits for its turn`);
  }
  const midway = PODS.openDelaySeconds + PODS.openSeconds * 0.4;
  const opened = [0, 1, 2, 3].map((order) => petalOpen(midway, order));
  for (let i = 1; i < opened.length; i++) {
    assert.ok(opened[i] <= opened[i - 1], `segment ${i} is not ahead of ${i - 1}: ${opened}`);
  }
  assert.ok(opened[0] > opened[3], 'they do not all move together');

  // By the end of the opening every segment is flat, and none overshoots.
  for (let order = 0; order < 4; order++) {
    assert.equal(petalOpen(PODS.openDelaySeconds + PODS.openSeconds, order), 1, `segment ${order} is down`);
    assert.equal(petalOpen(999, order), 1, 'and stays down');
  }
});

test('the closed shell fades out while the segments come down', () => {
  // The shell and the standing core are different drawings; the shell has to be
  // gone by the time the first segment is out, or it would cover it.
  assert.equal(shellFade(PODS.openDelaySeconds), 1, 'still whole when the bolts blow');
  assert.ok(shellFade(PODS.openDelaySeconds + PODS.openSeconds * 0.2) < 1, 'coming apart');
  assert.equal(shellFade(PODS.openDelaySeconds + PODS.openSeconds), 0, 'gone once they are open');
  assert.equal(shellFade(999), 0);
  // It must not outlast the first segment, which would leave the shell on top of it.
  const gone = PODS.openDelaySeconds + PODS.openSeconds * 0.35;
  assert.ok(shellFade(gone) < 1e-9, `the shell is gone by the time a segment is fully out: ${shellFade(gone)}`);
});

test('every capsule sprite is preloaded, so the first salvo is never empty', () => {
  const set = podSpriteSet();
  const keys = new Set(POD_SPRITE_DEFS.map((d) => d.key));
  for (const def of [set.shell, set.core, ...set.petals.map((p) => p.sprite)]) {
    assert.ok(keys.has(def.key), def.key);
  }
  assert.equal(POD_SPRITE_DEFS.length, 6, 'shell, core and four segments');
});

test('the capsule renders as standalone SVG at the size asked for', () => {
  const set = podSpriteSet();
  for (const def of [set.shell, set.core, ...set.petals.map((p) => p.sprite)]) {
    const svg = def.svg(2);
    assert.match(svg, /^<svg xmlns=/, def.key);
    assert.ok(svg.includes(`<use href="#`), def.key);
    const [, , w, h] = def.bbox;
    assert.match(svg, new RegExp(`width="${Math.ceil(w * 2)}" height="${Math.ceil(h * 2)}"`), def.key);
  }
});

test('enemies stand on the ground: sprite bottom is at SVG y = 0 (flyers hover above)', () => {
  const PAD = 5; // stroke padding added by the importer
  /** These two hover on their tentacles instead of standing (concept art). */
  const HOVERING = new Set(['warpseer', 'warpherald']);
  for (const type of ENEMY_TYPES) {
    const [, y, , h] = enemySprite(type).bbox;
    const bottom = y + h - PAD;
    if (ALL_ENEMIES[type].flying) assert.ok(bottom < -10, `${type} bottom ${bottom}`);
    else if (HOVERING.has(type)) assert.ok(bottom < 0 && bottom > -30, `${type} bottom ${bottom}`);
    else if (type === 'healer') assert.ok(bottom > 0, 'healer aura reaches below the feet');
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
  assert.deepEqual(towerLayers('flame', 1), { back: ['base', 't-flame-back'], gun: null, front: null });
  assert.deepEqual(towerLayers('flame', 2), {
    back: ['base', 'sb-back', 't-flame-back'],
    gun: null,
    front: ['sb-front'],
  });
  assert.deepEqual(towerLayers('tesla', 5), { back: ['base', 'sb-back', 't-tesla-back'], gun: null, front: ['sb-front'] });
  // The mortar brings its own sandbags inside its group and gets a crate as its
  // veteran detail instead of a second ring.
  assert.deepEqual(towerLayers('mortar', 1), {
    back: ['base', 't-mortar-back'],
    gun: ['t-mortar-gun'],
    front: ['t-mortar-front'],
  });
  assert.deepEqual(towerLayers('mortar', 2).front, ['t-mortar-front', 'crate-l']);
  // M4d: the autocannon lost its own ring with the shared bunker, so from
  // veteran on it gets the shared sandbags like everyone else.
  assert.deepEqual(towerLayers('autocannon', 1), { back: ['base', 't-ac-back'], gun: null, front: null });
  assert.deepEqual(towerLayers('autocannon', 2), {
    back: ['base', 'sb-back', 't-ac-back'],
    gun: null,
    front: ['sb-front'],
  });
  assert.throws(() => towerLayers('flame', 0));
  assert.throws(() => towerLayers('flame', 6));
  assert.throws(() => towerLayers('bogus', 1));
});

test('the shared bunker has no weapon, but three embrasures to fire from', () => {
  for (const doctrine of ['flame', 'autocannon']) {
    const set = towerSpriteSet(doctrine, 1);
    assert.equal(set.gun, null, `${doctrine} is one piece`);
    const weapon = TOWER_WEAPONS[doctrine];
    assert.equal(weapon.rest, undefined, `${doctrine} has no pose to aim from`);
    assert.equal(weapon.embrasures.length, 3, doctrine);
    // The slits sit across the front of the bunker, inside its own bounds.
    const [x, y, w, h] = set.back.bbox;
    for (const [ex, ey] of weapon.embrasures) {
      assert.ok(ex >= x && ex <= x + w && ey >= y && ey <= y + h, `${doctrine}: embrasure ${ex},${ey}`);
    }
    const xs = weapon.embrasures.map((e) => e[0]);
    assert.equal(new Set(xs).size, 3, `${doctrine}: three separate slits`);
  }
  // Both bunkers are the same building; only colour and effect differ.
  assert.deepEqual(TOWER_WEAPONS.flame.embrasures, TOWER_WEAPONS.autocannon.embrasures);
  assert.deepEqual(towerSpriteSet('flame', 1).back.bbox, towerSpriteSet('autocannon', 1).back.bbox);
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
      assert.ok(set.back.svg(1).includes(chevronMarkup(rank)), `${doctrine} ${rank}: chevrons`);
    }
  }
});

test('rank details appear at the rank ART.md sets, and stay', () => {
  for (const doctrine of DOCTRINES) {
    for (let rank = 1; rank <= 5; rank++) {
      const set = towerSpriteSet(doctrine, rank);
      const all = set.back.svg(1) + (set.gun?.svg(1) ?? '');
      // The plates sit on the weapon, or on the housing where the weapon cannot aim.
      assert.equal(all.includes(plateMarkup(doctrine)), rank >= RANK_DETAIL.plates, `${doctrine} ${rank}: plates`);
      assert.equal(set.back.svg(1).includes(goldEdgeMarkup()), rank >= RANK_DETAIL.gold, `${doctrine} ${rank}: gold`);
      // Banner and halo are drawn in code, so they are not in the sprite.
      assert.equal(set.rank, rank);
    }
  }
});

test('every recipe emplacement has a silhouette of its own', () => {
  assert.deepEqual([...SPECIALS].sort(), RECIPE_IDS.slice().sort());
  const symbols = new Set();
  for (const id of SPECIALS) {
    const set = specialSpriteSet(id);
    const svg = set.back.svg(1);
    assert.ok(svg.includes(goldEdgeMarkup()), `${id}: gold edging`);
    assert.ok(!svg.includes(chevronMarkup(1)), `${id}: no rank chevrons`);
    assert.equal(set.rank, 0);
    // The whole figure, weapon included, stands taller than the bare base.
    const boxes = [set.back.bbox, ...(set.gun ? [set.gun.bbox] : [])];
    const top = Math.min(...boxes.map((b) => b[1]));
    const bottom = Math.max(...boxes.map((b) => b[1] + b[3]));
    assert.ok(bottom - top > TOWER_SPRITES.symbols.base.bbox[3], `${id}: bigger than the base`);
    assert.ok(top < -40, `${id}: reaches up`);
    symbols.add(set.back.key);
  }
  assert.equal(symbols.size, SPECIALS.length, 'no two share a sprite');
});

test('layers that look the same at several ranks share one raster', () => {
  // Only the back layer changes with the rank (chevrons, sandbags).
  assert.equal(towerSpriteSet('laser', 3).gun.key, towerSpriteSet('laser', 5).gun.key);
  assert.notEqual(towerSpriteSet('laser', 3).back.key, towerSpriteSet('laser', 5).back.key);
  assert.notEqual(towerSpriteSet('mortar', 1).gun.key, towerSpriteSet('laser', 1).gun.key);
});

test('effects painted into the concept art are gone; code draws them now', () => {
  // Flame jet, muzzle arcs, mortar smoke, laser and tesla glow, lightning.
  assert.ok(!TOWER_SPRITES.defs.includes('id="ac-core"'), 'the old autocannon core is gone');
  for (const id of ['bunker-mg', 'bunker-flame', 'bunker2-mg', 'bunker2-flame', 't-laser-s']) {
    assert.ok(!TOWER_SPRITES.defs.includes(`id="${id}"`), `${id} lives on in the split parts`);
  }
  // M4d: the bursts and flashes drawn into the bunkers are code now. Both keep
  // an accent line in their doctrine colour, which is a stroke, not a fill.
  const flame = towerSpriteSet('flame', 1).back.svg(1);
  assert.ok(!flame.includes('fill="#ff8a2a"'), 'no flame burst is baked into the bunker');
  assert.ok(flame.includes('stroke="#ff8a2a"'), 'the accent line stays');
  const ac = towerSpriteSet('autocannon', 1).back.svg(1);
  assert.ok(!ac.includes('fill="#f0e2b8"'), 'no muzzle flash is baked into the bunker');
  assert.ok(ac.includes('stroke="#f0e2b8"'), 'the accent line stays');
});

test('the bunker is squatter than the laser it replaced the tall doctrines with', () => {
  // docs/ART.md: gedrungen, breiter als hoch. The base is 88 units wide.
  const [, , w, h] = towerSpriteSet('flame', 1).back.bbox;
  assert.ok(w > h, `bunker ${w} x ${h} is wider than it is tall`);
  // The laser shrank by about 30 percent with update 4.
  const laser = towerSpriteSet('laser', 1);
  const top = Math.min(laser.back.bbox[1], laser.gun.bbox[1]);
  assert.ok(top > -120 && top < -80, `laser reaches to ${top}`);
});

test('svg pixel size follows the requested scale', () => {
  const s = enemySprite('warrior');
  const svg = s.svg(3);
  const [, , w, h] = s.bbox;
  assert.ok(svg.includes(`width="${Math.ceil(w * 3)}"`) && svg.includes(`height="${Math.ceil(h * 3)}"`));
});

test('every boss has a figure of its own and towers over its kin', () => {
  const height = (def) => def.bbox[3] * def.unitScale;
  const symbols = new Set(Object.keys(ENEMIES).map((type) => enemySprite(type).svg(1)));
  for (const [id, boss] of Object.entries(BOSSES)) {
    const s = enemySprite(id);
    const kin = enemySprite(boss.sprite);
    assert.notDeepEqual(s.bbox, kin.bbox, `${id}: own artwork, not borrowed`);
    assert.ok(!symbols.has(s.svg(1)), `${id}: own symbol`);
    assert.ok(height(s) > height(kin) * 1.5, `${id}: ${height(s)} vs ${height(kin)}`);
  }
});
