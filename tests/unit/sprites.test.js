import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickLevel,
  nextFlip,
  towerLayers,
  towerSpriteSet,
  specialSpriteSet,
  SPECIALS,
  enemySprite,
  podSpriteSet,
  ENEMY_TYPES,
  DOCTRINES,
  RASTER_LEVELS,
} from '../../src/render/sprites/compose.js';
import {
  TOWER_TOPS,
  BUNKER_ROOF,
  SPECIAL_ROOF,
  POD_PETALS,
  POD_PETAL_ORDER,
  POD_OPEN_SCALE,
  SPRITE_SCALE,
} from '../../src/render/sprites/manifest.js';
import { ENEMY_SPRITES } from '../../src/render/sprites/enemies.js';
import { TOWER_SPRITES } from '../../src/render/sprites/towers.js';
import { POD_SPRITES } from '../../src/render/sprites/pods.js';
import { rankMarks, markCount } from '../../src/ui/badges.js';
import { DOCTRINE_COLORS } from '../../src/data/doctrines.js';
import { MAX_RANK } from '../../src/data/ranks.js';
import { petalOpen, isOpening, shellFade, keepClearedCells, POD_SPRITE_DEFS } from '../../src/render/pods.js';
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
  // v5: five bunkers, the taller special base, and a top per doctrine and recipe.
  for (let rank = 1; rank <= 5; rank++) assert.ok(TOWER_SPRITES.symbols[`bunker-${rank}`], `bunker-${rank}`);
  assert.ok(TOWER_SPRITES.symbols.specialbase, 'specialbase');
  for (const doctrine of DOCTRINES) {
    assert.ok(TOWER_SPRITES.symbols[towerLayers(doctrine, 1).top], doctrine);
  }
  for (const id of SPECIALS) assert.ok(TOWER_SPRITES.symbols[`stop-${id}`], id);
  // The hand-drawn sheets of v4 are out of the library for good.
  for (const id of ['base', 'sb-back', 'sb-front', 'crate-l', 't-flame-back', 't-laser-gun', 't-obelisk-back']) {
    assert.ok(!TOWER_SPRITES.symbols[id], `${id} went with the bunker kit`);
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
  // Since v3 the heat shield is a fifth narrower than an emplacement's base, so
  // six capsules on neighbouring cells do not hide one another (docs/ART.md).
  assert.ok(Math.abs((w - 2 * PAD) * set.shell.unitScale - 64 * 0.9 * 0.8) < 1.5, 'closed width');

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
  // A hair past the delay, not exactly on it: building t by adding and then
  // subtracting the same two numbers loses the last bit, and the simulation
  // never lands on the boundary anyway — it counts in steps of 1/60 s.
  assert.equal(isOpening(pod(PODS.openDelaySeconds + 0.01)), true, 'the bolts have blown');

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

  // By the end of the opening every segment is flat, and none overshoots. The
  // exact end is checked with a tolerance, because the ratio behind it is a
  // float division that can land a hair under one.
  for (let order = 0; order < 4; order++) {
    const atEnd = petalOpen(PODS.openDelaySeconds + PODS.openSeconds, order);
    assert.ok(atEnd > 0.999 && atEnd <= 1, `segment ${order} is down: ${atEnd}`);
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

test('a cleared cell keeps its mark until a capsule takes it or the wave runs', () => {
  const cells = [{ x: 3, y: 4 }, { x: 8, y: 2 }];
  const falling = [{ x: 3, y: 4, landed: false }];
  const landed = [{ x: 3, y: 4, landed: true }];

  // While the map is still being laid out, the marks stay up.
  for (const phase of ['planning', 'salvo', 'selection']) {
    assert.deepEqual(keepClearedCells(phase, [], cells), cells, phase);
    assert.deepEqual(keepClearedCells(phase, falling, cells), cells, `${phase}: still on its way`);
  }
  // A capsule on the ground takes that cell's mark, and only that one.
  assert.deepEqual(keepClearedCells('salvo', landed, cells), [{ x: 8, y: 2 }]);
  // Once the wave runs, nothing is being planned and every mark goes.
  for (const phase of ['wave', 'evaluation', 'defeat', 'victory']) {
    assert.deepEqual(keepClearedCells(phase, [], cells), [], phase);
  }
  // Nothing marked, nothing to do; the same array comes back.
  const empty = [];
  assert.equal(keepClearedCells('wave', landed, empty), empty);
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

test('an emplacement is a bunker and a top, one per rank', () => {
  assert.deepEqual(towerLayers('flame', 1), { base: 'bunker-1', top: 'top-fire' });
  assert.deepEqual(towerLayers('tesla', 5), { base: 'bunker-5', top: 'top-tesla' });
  assert.deepEqual(towerLayers('mortar', 3), { base: 'bunker-3', top: 'top-mortar' });
  // Every doctrine gets the same five bunkers; only the top tells them apart.
  assert.equal(new Set(DOCTRINES.map((d) => towerLayers(d, 4).base)).size, 1, 'one bunker per rank');
  assert.equal(new Set(DOCTRINES.map((d) => towerLayers(d, 4).top)).size, DOCTRINES.length, 'a top each');

  assert.throws(() => towerLayers('flame', 0));
  assert.throws(() => towerLayers('flame', 6));
  assert.throws(() => towerLayers('bogus', 1));
});

test('every top knows the point its effect leaves from', () => {
  for (const id of [...DOCTRINES, ...SPECIALS]) {
    const top = TOWER_TOPS[id];
    assert.ok(top, id);
    const [tx, ty] = top.tip;
    assert.equal(typeof tx, 'number', id);
    assert.ok(ty < 0, `${id}: the muzzle is above the roof it stands on`);
    // Inside the figure's own bounds, so no effect starts in mid-air.
    const set = SPECIALS.includes(id) ? specialSpriteSet(id) : towerSpriteSet(id, 1);
    const [x, y, w, h] = set.gun.bbox;
    assert.ok(tx >= x - 1 && tx <= x + w + 1, `${id}: muzzle x`);
    assert.ok(ty >= y - 1 && ty <= y + h + 1, `${id}: muzzle y`);
  }
});

test('the bunker sits on the ground and its top on the roof plate', () => {
  for (const doctrine of DOCTRINES) {
    const set = towerSpriteSet(doctrine, 1);
    assert.equal(set.back.anchorZ, 0, `${doctrine}: the bunker's own origin is on the ground`);
    assert.equal(set.gun.anchorZ, BUNKER_ROOF * SPRITE_SCALE.tower, `${doctrine}: the top stands on the roof`);
  }
  for (const id of SPECIALS) {
    const set = specialSpriteSet(id);
    assert.equal(set.back.anchorZ, 0, id);
    assert.equal(set.gun.anchorZ, SPECIAL_ROOF * SPRITE_SCALE.tower, `${id}: higher base, higher hatch`);
  }
  assert.ok(SPECIAL_ROOF > BUNKER_ROOF, 'the special base is the taller building (docs/ART.md)');
});

test('the bunker covers exactly one cell', () => {
  // The sheets come out of the study, which draws in the same projection the
  // game uses, so a unit is a world pixel and a cell is 64 of them across.
  assert.equal(SPRITE_SCALE.tower, 1);
  const [x, , w, h] = towerSpriteSet('flame', 1).back.bbox;
  assert.ok(Math.abs(x + w / 2) < 1, 'centred on its cell');
  assert.ok(w >= 60 && w <= 96, `a bunker is ${w} world pixels wide, a cell is 64 plus its ink`);
  assert.ok(w > h, `${w} x ${h}: squat, wider than it is tall (docs/ART.md)`);
});

test('tower sprites cover both layers and render as standalone SVG', () => {
  for (const doctrine of DOCTRINES) {
    for (let rank = 1; rank <= 5; rank++) {
      const set = towerSpriteSet(doctrine, rank);
      const layers = towerLayers(doctrine, rank);
      assert.equal(set.front, null, `${doctrine} ${rank}: nothing stands in front any more`);
      for (const [name, id] of [['back', layers.base], ['gun', layers.top]]) {
        const svg = set[name].svg(2);
        assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
        assert.ok(svg.includes(`<use href="#${id}"/>`), id);
      }
      assert.equal(set.rank, rank);
    }
  }
});

test('the ranks are drawn into the bunker, not stacked on it', () => {
  // Every rank is its own symbol and no two are alike; nothing is added in code
  // any more (docs/ART.md, "Ränge").
  const symbol = (id) => {
    const at = TOWER_SPRITES.defs.indexOf(`id="${id}"`);
    assert.ok(at > 0, id);
    const from = TOWER_SPRITES.defs.lastIndexOf('<g', at);
    const to = TOWER_SPRITES.defs.indexOf('</g>', at);
    return TOWER_SPRITES.defs.slice(from, to);
  };
  const bunkers = [1, 2, 3, 4, 5].map((rank) => symbol(`bunker-${rank}`));
  assert.equal(new Set(bunkers).size, 5, 'five distinct bunkers');
  // Cumulative: each rank is longer than the one below it.
  for (let i = 1; i < bunkers.length; i++) {
    assert.ok(bunkers[i].length > bunkers[i - 1].length, `rank ${i + 1} adds to rank ${i}`);
  }
  // The legend's gold edging is in the drawing, and only there.
  assert.ok(bunkers[4].includes('#f2c14e'), 'the legend has gold edges');
  assert.ok(!bunkers[0].includes('#f2c14e'), 'the recruit has none');
});


test('every recipe emplacement has a silhouette of its own', () => {
  assert.deepEqual([...SPECIALS].sort(), RECIPE_IDS.slice().sort());
  const tops = new Set();
  const base = TOWER_SPRITES.symbols.specialbase.bbox;
  for (const id of SPECIALS) {
    const set = specialSpriteSet(id);
    assert.equal(set.rank, 0, `${id}: a recipe emplacement has no rank`);
    // They all stand on the same base; the top is what tells them apart, and
    // the whole figure reaches higher than the bare base does.
    assert.equal(set.back.key, 'tower:specialbase', id);
    const top = set.gun.bbox[1] - SPECIAL_ROOF;
    assert.ok(top < base[1], `${id}: reaches above the base (${top} vs ${base[1]})`);
    tops.add(set.gun.key);
  }
  assert.equal(tops.size, SPECIALS.length, 'no two share a top');
});

test('the obelisk is the tallest thing on the field, and the battery the widest', () => {
  const height = (id) => SPECIAL_ROOF - specialSpriteSet(id).gun.bbox[1];
  const tallest = SPECIALS.reduce((a, b) => (height(a) >= height(b) ? a : b));
  assert.equal(tallest, 'soulfireObelisk', `the obelisk reaches ${height('soulfireObelisk')}`);
  // It has to fit under the renderer's margin for artwork above the ground point.
  assert.ok(height('soulfireObelisk') * SPRITE_SCALE.tower < 260, 'and still fits the draw margin');

  const width = (id) => specialSpriteSet(id).gun.bbox[2];
  const widest = SPECIALS.reduce((a, b) => (width(a) >= width(b) ? a : b));
  assert.equal(widest, 'stormBattery', 'the quad flak is the broad one');
  assert.equal(TOWER_TOPS.stormBattery.sparks.length, 4, 'four barrel mouths');
  assert.ok(TOWER_TOPS.stormBattery.casings, 'and cases flying out of them');
});


test('rank marks: one stroke fewer than the rank, gold only at legend', () => {
  const gold = '#f2c14e';
  assert.equal(markCount(1), 0, 'a recruit wears nothing');
  for (let rank = 1; rank <= MAX_RANK; rank++) assert.equal(markCount(rank), rank - 1);

  for (const doctrine of DOCTRINES) {
    const colour = DOCTRINE_COLORS[doctrine];
    for (let rank = 1; rank < MAX_RANK; rank++) {
      const markup = rankMarks(rank, doctrine);
      assert.equal(markup.split('<i>').length - 1, rank - 1, `${doctrine} ${rank}`);
      assert.ok(markup.includes(`--mark:${colour}`), `${doctrine} ${rank} is tinted`);
    }
    const legend = rankMarks(MAX_RANK, doctrine);
    assert.equal(legend.split('<i>').length - 1, MAX_RANK - 1, 'legend wears four');
    assert.ok(legend.includes(`--mark:${gold}`), 'legend is gold');
    if (colour !== gold) assert.ok(!legend.includes(colour), 'legend drops the doctrine colour');
  }

  assert.throws(() => rankMarks(0, 'laser'));
  assert.throws(() => rankMarks(MAX_RANK + 1, 'laser'));
  assert.throws(() => rankMarks(1, 'bogus'));
});

test('layers that look the same at several ranks share one raster', () => {
  // Only the back layer changes with the rank (chevrons, sandbags).
  assert.equal(towerSpriteSet('laser', 3).gun.key, towerSpriteSet('laser', 5).gun.key);
  assert.notEqual(towerSpriteSet('laser', 3).back.key, towerSpriteSet('laser', 5).back.key);
  assert.notEqual(towerSpriteSet('mortar', 1).gun.key, towerSpriteSet('laser', 1).gun.key);
});

test('effects painted into the concept art are gone; code draws them now', () => {
  // The hand-drawn sheets and everything that was baked into them are gone with
  // the bunker kit; what moves or glows is drawn in code (docs/ART.md).
  for (const id of ['ac-core', 'bunker-mg', 'bunker-flame', 'bunker2-mg', 'bunker2-flame', 't-laser-s']) {
    assert.ok(!TOWER_SPRITES.defs.includes(`id="${id}"`), `${id} is out of the library`);
  }
  // The two bunkers of M4d are one building for all six doctrines now, so the
  // doctrine colour is not in the base at all — it is in the top and the effect.
  for (let rank = 1; rank <= 5; rank++) {
    const svg = towerSpriteSet('flame', rank).back.svg(1);
    const bunker = svg.slice(svg.indexOf('id="bunker-'), svg.indexOf('</g>', svg.indexOf('id="bunker-')));
    assert.ok(!bunker.includes('#ff8a2a'), `rank ${rank}: no flame colour in the bunker`);
    assert.ok(!bunker.includes('#f0e2b8'), `rank ${rank}: no autocannon colour either`);
  }
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
