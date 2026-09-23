// Sprite gallery: every doctrine x rank and every enemy in both facings, on real ground,
// with the game's camera and input. Open /tests/sprites.html (also works on GitHub Pages).

import { STRINGS } from '../src/data/strings.js';
import { CAMERA } from '../src/data/settings.js';
import { createCanvasView } from '../src/render/canvas.js';
import { createCamera, fitCamera, clampCamera, panBy, zoomAt, applyCamera } from '../src/render/camera.js';
import { mapBounds } from '../src/render/iso.js';
import { createGroundLayer } from '../src/render/ground.js';
import { createSpriteCache } from '../src/render/sprites/rasterizer.js';
import { DOCTRINES, ENEMY_TYPES, RASTER_LEVELS } from '../src/render/sprites/compose.js';
import { RECIPES } from '../src/data/recipes.js';
import { ALL_ENEMIES } from '../src/data/enemies.js';
import { iso } from '../src/render/iso.js';
import { comicText } from '../src/render/draw.js';
import { allTowerDefs, drawTowerSprite } from '../src/render/towerSprites.js';
import { ENEMY_SPRITE_DEFS, createEnemySpriteRenderer } from '../src/render/enemySprites.js';
import { attachPointerInput } from '../src/input/pointer.js';
import { installPageGuards } from '../src/input/guards.js';

const T = STRINGS.gallery;
const SIZE = 20;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
document.title = `${T.title} · ${STRINGS.gameTitle}`;
installPageGuards(canvas);

// Towers: doctrine along x, rank along y (back to front).
const towers = [];
DOCTRINES.forEach((doctrine, d) => {
  for (let rank = 1; rank <= 5; rank++) towers.push({ x: 2 + d * 2, y: rank * 2 - 1, doctrine, rank, flash: 0 });
});
// Recipe emplacements in their own row, each with the doctrine of its first ingredient.
RECIPES.forEach((recipe, i) => {
  towers.push({ x: 1 + i * 2.4, y: 11, doctrine: recipe.ingredients[0], special: recipe.id, rank: null, flash: 0 });
});

// Enemies: two rows, walking left-down (-x... facing left) and right (+x).
const enemies = [];
const isBoss = (type) => Boolean(ALL_ENEMIES[type].boss);
const plain = ENEMY_TYPES.filter((type) => !isBoss(type));
const bosses = ENEMY_TYPES.filter(isBoss);
plain.forEach((type, i) => {
  const x = 1.5 + i * 2.2;
  enemies.push({ id: i + 1, type, flying: ALL_ENEMIES[type].flying, x, y: 12.5, dx: 0, dy: 1, d: 9, flash: 0 });
  enemies.push({ id: i + 20, type, flying: ALL_ENEMIES[type].flying, x, y: 14.5, dx: 1, dy: 0, d: 9, flash: 0 });
});
// Bosses need room: their own row, facing left.
bosses.forEach((type, i) => {
  enemies.push({
    id: i + 40,
    type,
    flying: ALL_ENEMIES[type].flying,
    armor: ALL_ENEMIES[type].armor,
    x: 2 + i * 3.4,
    y: 17.5,
    dx: 0,
    dy: 1,
    d: 9,
    flash: 0,
  });
});

const camera = createCamera();
const bounds = mapBounds(SIZE);
const ground = createGroundLayer();
const cache = createSpriteCache();
const drawEnemy = createEnemySpriteRenderer(cache);
let flash = false;
/** Everything drawn in flat black, to check the rule "silhouette before detail". */
let silhouette = false;
let labels = true;

const view = createCanvasView(canvas, (v) => fitCamera(camera, v, bounds, { top: 90, bottom: 84, side: 16 }, { ...CAMERA, minCellPx: 0 }));

// ---------- HUD ----------
const hud = document.getElementById('hud');
const top = document.createElement('div');
top.className = 'hud-top';
top.innerHTML = `<h1 class="hud-title"></h1><span class="chip" id="stats"></span>`;
top.querySelector('h1').textContent = T.title;
const intro = document.createElement('p');
intro.className = 'chip';
intro.style.cssText = 'position:absolute;left:calc(16px + var(--safe-left));top:calc(60px + var(--safe-top));white-space:normal;max-width:min(720px,90vw);font-size:15px;margin:0';
intro.textContent = T.intro;
const bar = document.createElement('div');
bar.className = 'hud-bar';
const mk = (label, on) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'alt interactive';
  b.textContent = label;
  b.addEventListener('click', on);
  bar.append(b);
  return b;
};
const flashButton = mk(T.flash, () => {
  flash = !flash;
  flashButton.classList.toggle('on', flash);
});
const silhouetteButton = mk(T.silhouette, () => {
  silhouette = !silhouette;
  silhouetteButton.classList.toggle('on', silhouette);
});
const labelButton = mk(T.labels, () => {
  labels = !labels;
  labelButton.classList.toggle('on', labels);
});
labelButton.classList.add('on');
for (const z of RASTER_LEVELS) {
  mk(T.zoom(z), () => {
    zoomAt(camera, view, z / camera.zoom, view.width / 2, view.height / 2, CAMERA);
    clampCamera(camera, bounds, CAMERA);
  });
}
hud.append(top, intro, bar);
const stats = top.querySelector('#stats');

attachPointerInput(canvas, {
  onPan(dx, dy) {
    panBy(camera, dx, dy);
    clampCamera(camera, bounds, CAMERA);
  },
  onZoom(f, x, y) {
    zoomAt(camera, view, f, x, y, CAMERA);
    clampCamera(camera, bounds, CAMERA);
  },
});

// ---------- Frame ----------
let lastT = null;
function frame(now) {
  const t = now / 1000;
  const dt = lastT === null ? 0 : Math.min(0.05, t - lastT);
  lastT = t;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#110c0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ground.draw(ctx, camera, view, SIZE, 'GALLERY', now);
  applyCamera(ctx, camera, view);

  const items = [
    ...towers.map((o) => [o.x + o.y + 1, 0, o]),
    ...enemies.map((o) => [o.x + o.y, 1, o]),
  ].sort((a, b) => a[0] - b[0]);
  // A canvas filter is fine here: this is a tool, not the game loop.
  if (silhouette) ctx.filter = 'brightness(0)';
  for (const [, kind, o] of items) {
    o.flash = flash ? 1 : 0;
    if (kind === 0) drawTowerSprite(ctx, cache, o, camera.zoom, view.dpr, t, dt);
    else drawEnemy(ctx, o, t, { zoom: camera.zoom, dpr: view.dpr, dt });
  }
  ctx.filter = 'none';

  if (labels) {
    for (const o of towers) {
      const [x, y] = iso(o.x + 0.5, o.y + 1.1);
      const label = o.special ? STRINGS.recipes[o.special].name : `${STRINGS.doctrines[o.doctrine]} ${o.rank}`;
      comicText(ctx, label, x, y, 13, '#e8dcc0');
    }
    for (const o of enemies) {
      if (o.dy !== 1) continue; // label the row facing left only, once per type
      const [x, y] = iso(o.x, o.y + 0.9);
      comicText(ctx, STRINGS.enemies[o.type], x, y, 13, '#e8dcc0');
    }
  }
  stats.textContent = T.stats(camera.zoom.toFixed(2), cache.stats.rasterized);
  requestAnimationFrame(frame);
}

cache.preload([...allTowerDefs(), ...ENEMY_SPRITE_DEFS], camera.zoom, view.dpr).then(() => {
  document.body.dataset.ready = 'true';
});
window.__gallery = {
  camera: () => ({ ...camera }),
  stats: () => ({ ...cache.stats }),
  mode: () => ({ silhouette, labels, flash, filter: ctx.filter }),
};
requestAnimationFrame(frame);
