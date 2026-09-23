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
import { allTowerDefs, drawTowerSprite } from '../src/render/towerSprites.js';
import { ENEMY_SPRITE_DEFS, createEnemySpriteRenderer } from '../src/render/enemySprites.js';
import { attachPointerInput } from '../src/input/pointer.js';
import { installPageGuards } from '../src/input/guards.js';

const T = STRINGS.gallery;
const SIZE = 16;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
document.title = `${T.title} · ${STRINGS.gameTitle}`;
installPageGuards(canvas);

// Towers: doctrine along x, rank along y (back to front).
const towers = [];
DOCTRINES.forEach((doctrine, d) => {
  for (let rank = 1; rank <= 5; rank++) towers.push({ x: 2 + d * 2, y: rank * 2 - 1, doctrine, rank, flash: 0 });
});
// Enemies: two rows, walking left-down (-x... facing left) and right (+x).
const enemies = [];
ENEMY_TYPES.forEach((type, i) => {
  enemies.push({ id: i + 1, type, flying: type === 'carrionflyer', x: 1.5 + i * 2, y: 12.5, dx: 0, dy: 1, d: 9, flash: 0 });
  enemies.push({ id: i + 20, type, flying: type === 'carrionflyer', x: 1.5 + i * 2, y: 14.5, dx: 1, dy: 0, d: 9, flash: 0 });
});

const camera = createCamera();
const bounds = mapBounds(SIZE);
const ground = createGroundLayer();
const cache = createSpriteCache();
const drawEnemy = createEnemySpriteRenderer(cache);
let flash = false;

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
  for (const [, kind, o] of items) {
    o.flash = flash ? 1 : 0;
    if (kind === 0) drawTowerSprite(ctx, cache, o, camera.zoom, view.dpr, t, dt);
    else drawEnemy(ctx, o, t, camera.zoom, view.dpr);
  }
  stats.textContent = T.stats(camera.zoom.toFixed(2), cache.stats.rasterized);
  requestAnimationFrame(frame);
}

cache.preload([...allTowerDefs(), ...ENEMY_SPRITE_DEFS], camera.zoom, view.dpr).then(() => {
  document.body.dataset.ready = 'true';
});
window.__gallery = { camera: () => ({ ...camera }), stats: () => ({ ...cache.stats }) };
requestAnimationFrame(frame);
