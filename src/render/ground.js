// Static ground layer (slab, tiles, decor) cached in an offscreen canvas.
// Built at the current zoom for crisp lines; while zooming the cached image is
// scaled and rebuilt once the zoom has been stable for a moment.

import { createRng } from '../core/random.js';
import { iso, mapBounds } from './iso.js';
import { worldToScreen } from './camera.js';
import { poly, ell } from './draw.js';
import { C } from './palette.js';

/** Largest offscreen backing store in pixels (iPad Safari caps canvas memory). */
const MAX_PIXELS = 12_000_000;
/** Rebuild after the zoom has not changed for this long (ms). */
const SETTLE_MS = 160;
const SLAB_DEPTH = 30;

const DIRT = ['#5f4e3e', '#65533f', '#5a4a3b', '#6a5743', '#61503f'];

function drawGround(g, size, rng) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const N = size;

  // Shadow under the slab.
  const [cx, cy] = iso(N, N);
  g.save();
  // Kept flat enough to stay inside the cached bounds (mapBounds `below`).
  g.translate(0, cy + 18);
  g.scale(1, 0.12);
  const sh = g.createRadialGradient(0, 0, 50, 0, 0, N * 30);
  sh.addColorStop(0, 'rgba(0,0,0,.6)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh;
  g.fillRect(-N * 40, -N * 40, N * 80, N * 80);
  g.restore();

  // Slab sides with strata lines and embedded stones.
  const left = [iso(0, N, 0), iso(N, N, 0), iso(N, N, -SLAB_DEPTH), iso(0, N, -SLAB_DEPTH)];
  const right = [iso(N, N, 0), iso(N, 0, 0), iso(N, 0, -SLAB_DEPTH), iso(N, N, -SLAB_DEPTH)];
  poly(g, left, '#4a3a2d', C.ink, 3);
  poly(g, right, '#302419', C.ink, 3);
  for (const [face, col, stone] of [[0, '#3a2d23', '#5c4a3a'], [1, '#241b14', '#3f3126']]) {
    for (const z of [-11, -21]) {
      g.strokeStyle = col;
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i <= N * 2; i++) {
        const u = (i / (N * 2)) * N;
        const w = Math.sin(i * 1.7) * 1.5;
        const p = face === 0 ? iso(u, N, z + w) : iso(N, N - u, z + w);
        if (i) g.lineTo(p[0], p[1]);
        else g.moveTo(p[0], p[1]);
      }
      g.stroke();
    }
    for (let i = 0; i < N * 1.3; i++) {
      const u = rng.next() * N;
      const z = -5 - rng.next() * 20;
      const p = face === 0 ? iso(u, N, z) : iso(N, u, z);
      ell(g, p[0], p[1], 2 + rng.next() * 3, 1.5 + rng.next() * 2, stone, null);
    }
  }

  // Tiles with pebbles and cracks.
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      poly(g, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], rng.pick(DIRT), 'rgba(26,20,16,.25)', 1);
      if (rng.chance(0.4)) {
        for (let i = 0; i < 3; i++) {
          const p = iso(x + 0.2 + rng.next() * 0.6, y + 0.2 + rng.next() * 0.6);
          ell(g, p[0], p[1], 1.5 + rng.next() * 1.8, 1 + rng.next(), '#4a3c30', null);
        }
      }
      if (rng.chance(0.25)) {
        g.strokeStyle = '#3b2f25';
        g.lineWidth = 1.4;
        g.beginPath();
        let p = iso(x + 0.2 + rng.next() * 0.6, y + 0.2 + rng.next() * 0.6);
        g.moveTo(p[0], p[1]);
        for (let i = 0; i < 3; i++) {
          p = [p[0] + (rng.next() - 0.5) * 14, p[1] + (rng.next() - 0.5) * 7];
          g.lineTo(p[0], p[1]);
        }
        g.stroke();
      }
    }
  }

  // Scattered decor: toxic puddles, bones, soot stains.
  const spot = () => [rng.int(0, N - 1), rng.int(0, N - 1)];
  for (let i = 0; i < Math.round(N / 5); i++) {
    const [x, y] = spot();
    const p = iso(x + 0.5, y + 0.5);
    ell(g, p[0], p[1], 20, 9, '#4f7a24', C.ink, 2);
    ell(g, p[0] - 4, p[1] - 2, 9, 3.5, '#8fc24a', null);
    ell(g, p[0] + 7, p[1] + 2, 2.5, 1.5, C.toxicL, null);
  }
  for (let i = 0; i < Math.round(N / 2); i++) {
    const [x, y] = spot();
    const p = iso(x + 0.3 + rng.next() * 0.4, y + 0.3 + rng.next() * 0.4);
    ell(g, p[0], p[1] - 3, 5, 4.5, C.bone, C.ink, 1.5);
    g.fillStyle = C.bone;
    g.fillRect(p[0] - 3, p[1] - 1, 6, 3.5);
    g.strokeStyle = C.ink;
    g.lineWidth = 1.2;
    g.strokeRect(p[0] - 3, p[1] - 1, 6, 3.5);
    ell(g, p[0] - 1.8, p[1] - 3, 1.4, 1.4, C.ink, null);
    ell(g, p[0] + 1.8, p[1] - 3, 1.4, 1.4, C.ink, null);
  }
  for (let i = 0; i < Math.round(N / 4); i++) {
    const [x, y] = spot();
    const p = iso(x + 0.5, y + 0.5);
    g.save();
    g.translate(p[0], p[1]);
    g.scale(1, 0.5);
    const sg = g.createRadialGradient(0, 0, 2, 0, 0, 30);
    sg.addColorStop(0, 'rgba(15,10,8,.55)');
    sg.addColorStop(1, 'rgba(15,10,8,0)');
    g.fillStyle = sg;
    g.fillRect(-32, -32, 64, 64);
    g.restore();
  }

  poly(g, [iso(0, 0), iso(N, 0), iso(N, N), iso(0, N)], null, C.ink, 3);
}

export function createGroundLayer() {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  let built = null;
  let lastZoom = null;
  let lastZoomChange = 0;

  function build(size, seed, zoom, dpr) {
    const b = mapBounds(size);
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    const scale = Math.min(zoom * dpr, Math.sqrt(MAX_PIXELS / (w * h)));
    canvas.width = Math.ceil(w * scale);
    canvas.height = Math.ceil(h * scale);
    g.setTransform(scale, 0, 0, scale, -b.x0 * scale, -b.y0 * scale);
    g.clearRect(b.x0, b.y0, w, h);
    drawGround(g, size, createRng(`ground:${seed}`));
    built = { size, seed, zoom, dpr, bounds: b };
  }

  return {
    /** Draws the cached ground; rebuilds when the map, DPR or (settled) zoom changed. */
    draw(ctx, cam, view, size, seed, nowMs) {
      if (cam.zoom !== lastZoom) {
        lastZoom = cam.zoom;
        lastZoomChange = nowMs;
      }
      const stale = !built || built.size !== size || built.seed !== seed || built.dpr !== view.dpr;
      const zoomOff = built && Math.abs(built.zoom - cam.zoom) / cam.zoom > 0.02;
      if (stale || (zoomOff && nowMs - lastZoomChange > SETTLE_MS)) build(size, seed, cam.zoom, view.dpr);

      const b = built.bounds;
      const [dx, dy] = worldToScreen(cam, view, b.x0, b.y0);
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(canvas, dx, dy, (b.x1 - b.x0) * cam.zoom, (b.y1 - b.y0) * cam.zoom);
    },
  };
}
