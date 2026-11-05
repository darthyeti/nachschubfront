// Stand-in page for the Koloss model of the game (src/render/koloss.js): the real drawing function
// on a plain ground, driven by a fake enemy record like the simulation hands it over. For
// tests/tools/koloss-modell.mjs (stills, silhouette at the smallest zoom, cost per frame).
// Open /tests/koloss.html; `window.__koloss` is the handle.

import { iso } from '../src/render/iso.js';
import { PALETTES } from '../src/render/biomes.js';
import { drawKoloss } from '../src/render/koloss.js';
import { KOLOSS } from '../src/data/enemies.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const PAL = PALETTES.ash;
const MAP = 12;

const S = {
  x: 6.5,
  y: 5.5,
  dx: 1,
  dy: 0,
  simTime: 0,
  t: 0,
  flash: 0,
  charging: false,
  health: 6200,
  zoom: 1,
  silhouette: false,
  reduced: false,
};
const enemy = () => ({ koloss: true, x: S.x, y: S.y, dx: S.dx, dy: S.dy, health: S.health, maxHealth: KOLOSS.health, flash: S.flash, charging: S.charging });
let e = enemy();

function ground() {
  for (let y = 0; y < MAP; y++) {
    for (let x = 0; x < MAP; x++) {
      const pts = [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)];
      ctx.beginPath();
      ctx.moveTo(...pts[0]);
      for (const p of pts.slice(1)) ctx.lineTo(...p);
      ctx.closePath();
      ctx.fillStyle = PAL.ground[(x * 7 + y * 3) % 3];
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(26,20,16,.35)';
      ctx.stroke();
    }
  }
}

function draw(target = ctx, stats) {
  const [cx, cy] = iso(S.x, S.y, 40);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = canvas.clientWidth * dpr;
  const h = canvas.clientHeight * dpr;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const z = S.zoom * dpr;
  const place = (c) => c.setTransform(z, 0, 0, z, w / 2 - cx * z, h * 0.52 - cy * z);
  if (S.silhouette) {
    // Only the solid parts, in ink on paper: the shape the eye reads at a glance. The cast shadow
    // and anything translucent drop out at a hard threshold.
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const o = off.getContext('2d');
    place(o);
    e = Object.assign(e, enemy());
    drawKoloss(o, e, { t: S.t, dt: 1 / 60, reducedMotion: S.reduced, simTime: S.simTime }, stats);
    const img = o.getImageData(0, 0, w, h);
    const px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      const solid = px[i + 3] > 150;
      px[i] = 26;
      px[i + 1] = 20;
      px[i + 2] = 16;
      px[i + 3] = solid ? 255 : 0;
    }
    o.putImageData(img, 0, 0);
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.fillStyle = '#d9c9a6';
    target.fillRect(0, 0, w, h);
    target.drawImage(off, 0, 0);
    return;
  }
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.fillStyle = '#1c1410';
  target.fillRect(0, 0, w, h);
  place(target);
  ground();
  e = Object.assign(e, enemy());
  drawKoloss(target, e, { t: S.t, dt: 1 / 60, reducedMotion: S.reduced, simTime: S.simTime }, stats);
}

window.__koloss = {
  S,
  /** Sets the scene and draws it once. */
  set(o) {
    Object.assign(S, o);
    draw();
  },
  /** Moves the simulated time on by `dt` and draws; the heading is changed through `set`. */
  step(dt, vx = 0, vy = 0) {
    S.simTime += dt;
    S.t += dt;
    S.x += vx * dt;
    S.y += vy * dt;
    draw();
  },
  /** Fills, strokes and faces of one frame (model alone), and the average time of `n` draws. */
  bench(n = 600) {
    const off = document.createElement('canvas');
    off.width = 700;
    off.height = 600;
    const o = off.getContext('2d');
    o.translate(350, 420);
    const fill = o.fill;
    const stroke = o.stroke;
    let fills = 0;
    let strokes = 0;
    o.fill = function (...a) {
      fills++;
      return fill.apply(this, a);
    };
    o.stroke = function (...a) {
      strokes++;
      return stroke.apply(this, a);
    };
    const record = (dx, dy) => ({ koloss: true, x: 0, y: 0, dx, dy, health: 1, maxHealth: 1, flash: 0 });
    // One frame walking in each direction, and one in the middle of a turn, the dearest moment.
    const counts = {};
    for (const [label, dir] of [['plus-x', [1, 0]], ['plus-y', [0, 1]], ['minus-x', [-1, 0]], ['minus-y', [0, -1]], ['turning', null]]) {
      const e = record(dir ? dir[0] : 1, dir ? dir[1] : 0);
      const view = { t: 1, dt: 0.016, reducedMotion: false, simTime: 1000 };
      drawKoloss(o, e, view);
      if (!dir) {
        e.dx = 0;
        e.dy = 1;
        view.simTime = 1000.3;
      }
      fills = 0;
      strokes = 0;
      const stats = {};
      drawKoloss(o, e, view, stats);
      counts[label] = { fills, strokes, faces: stats.faces, code: stats.code };
    }
    o.fill = fill;
    o.stroke = stroke;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      drawKoloss(o, record(1, 0), { t: i * 0.016, dt: 0.016, reducedMotion: false, simTime: i * 0.016 });
    }
    return { counts, ms: (performance.now() - t0) / n };
  },
  /** The box of the opaque pixels of the model alone, facing `dir` (0..3). */
  measure(dir) {
    const dxy = [[1, 0], [0, 1], [-1, 0], [0, -1]][dir];
    const off = document.createElement('canvas');
    off.width = 700;
    off.height = 600;
    const o = off.getContext('2d');
    o.translate(350, 420);
    drawKoloss(o, { koloss: true, dead: true, x: 0, y: 0, dx: dxy[0], dy: dxy[1], health: 1, maxHealth: 1, flash: 0 }, { t: 0, dt: 0, reducedMotion: true, simTime: 0 });
    const data = o.getImageData(0, 0, 700, 600).data;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let y = 0; y < 600; y++) {
      for (let x = 0; x < 700; x++) {
        if (data[(y * 700 + x) * 4 + 3] > 200) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
    }
    return { width: x1 - x0, height: y1 - y0, top: 420 - y0 };
  },
};
draw();
