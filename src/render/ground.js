// Static ground layer (slab, block terrain, decor, cliff shadows) cached in an offscreen canvas.
// Built at the current zoom for crisp lines; while zooming the cached image is
// scaled and rebuilt once the zoom has been stable for a moment.
//
// The terrain is three levels of STEP px (terrain.js). Fields are drawn in depth order (x + y
// rising), each with its top face on z = height, cliff faces only towards a lower neighbour in
// +x or +y, and the shadows of higher fields behind it. The slab under the map is as high as
// level 0. The trail and the ramps are not in here: they depend on the route and are drawn by the
// scene each frame.

import { createRng } from '../core/random.js';
import { iso, mapBounds } from './iso.js';
import { worldToScreen } from './camera.js';
import { poly, ell } from './draw.js';
import { C } from './palette.js';
import { biomeOf, paletteOf, shade } from './biomes.js';
import { castShadows, footStrip, rectCorners, EDGE_LIGHT_ALPHA, EDGE_LIGHT_WIDTH } from './shadows.js';
import { STEP, flatField } from './terrain.js';

/** Largest offscreen backing store in pixels (iPad Safari caps canvas memory). */
const MAX_PIXELS = 12_000_000;
/** Rebuild after the zoom has not changed for this long (ms). */
const SETTLE_MS = 160;
const SLAB_DEPTH = 30;
/** Raising of the lightness of a top face per level (RGB steps), so higher ground reads lighter. */
const LEVEL_LIGHTEN = 9;
/** The horizontal layer lines of a cliff face, as fractions of its height from the top. */
const CLIFF_LAYERS = [1 / 3, 2 / 3];

const P = (x, y, z = 0) => iso(x, y, z);
const diamond = (x, y, z) => [P(x, y, z), P(x + 1, y, z), P(x + 1, y + 1, z), P(x, y + 1, z)];

function diamondPath(g, x, y, z) {
  diamond(x, y, z).forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.closePath();
}

/** One face of a block: an `axis` 'x' face (right in the picture) or 'y' face (left), with layer lines and stones. */
function cliffFace(g, axis, x, y, zTop, zBot, fill, rng) {
  const at = (u, z) => (axis === 'x' ? P(x + 1, y + u, z) : P(x + u, y + 1, z));
  poly(g, [at(0, zTop), at(1, zTop), at(1, zBot), at(0, zBot)], fill, C.ink, 2.5);
  g.strokeStyle = shade(fill, -16);
  g.lineWidth = 1.8;
  for (const f of CLIFF_LAYERS) {
    const z = zTop - (zTop - zBot) * f;
    g.beginPath();
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      const wobble = Math.sin((x * 7 + y * 3 + u * 9 + z) * 1.7) * 1.1;
      const p = at(u, z + wobble);
      if (i) g.lineTo(p[0], p[1]);
      else g.moveTo(p[0], p[1]);
    }
    g.stroke();
  }
  const stones = rng.chance(0.6) ? 1 + (rng.chance(0.4) ? 1 : 0) : 0;
  for (let i = 0; i < stones; i++) {
    const p = at(0.15 + rng.next() * 0.7, zBot + (zTop - zBot) * (0.25 + rng.next() * 0.5));
    ell(g, p[0], p[1], 2 + rng.next() * 2.5, 1.5 + rng.next() * 1.5, shade(fill, 16), null);
  }
}

function drawGround(g, size, rng, biome, field) {
  const pal = paletteOf(biome);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const N = size;
  const lvl = (x, y) => field[y * N + x];

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

  // Slab sides with strata lines and embedded stones. The slab is as high as level 0.
  const left = [iso(0, N, 0), iso(N, N, 0), iso(N, N, -SLAB_DEPTH), iso(0, N, -SLAB_DEPTH)];
  const right = [iso(N, N, 0), iso(N, 0, 0), iso(N, 0, -SLAB_DEPTH), iso(N, N, -SLAB_DEPTH)];
  poly(g, left, pal.slab[0], C.ink, 3);
  poly(g, right, pal.slab[1], C.ink, 3);
  for (const [face, col, stone] of [[0, shade(pal.slab[0], -14), shade(pal.slab[0], 22)], [1, shade(pal.slab[1], -10), shade(pal.slab[1], 18)]]) {
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

  // Scattered decor, picked up front and drawn with its field so cliffs in front can cover it.
  const decor = new Map();
  const place = (kind, count) => {
    for (let i = 0; i < count; i++) {
      const x = rng.int(0, N - 1);
      const y = rng.int(0, N - 1);
      const key = y * N + x;
      if (!decor.has(key)) decor.set(key, []);
      decor.get(key).push({ kind, ox: 0.3 + rng.next() * 0.4, oy: 0.3 + rng.next() * 0.4 });
    }
  };
  place('puddle', Math.round(N / 5));
  place('bones', Math.round(N / 2));
  place('soot', Math.round(N / 4));

  // Fields in depth order (x + y rising), so a block in front covers what lies behind it.
  for (let s = 0; s <= 2 * N - 2; s++) {
    for (let x = Math.max(0, s - N + 1); x <= Math.min(N - 1, s); x++) {
      const y = s - x;
      const i = y * N + x;
      const L = field[i];
      const hz = L * STEP;
      const lift = L * LEVEL_LIGHTEN;

      // ---- top face, lighter the higher it lies
      poly(g, diamond(x, y, hz), shade(rng.pick(pal.ground), lift), 'rgba(26,20,16,.25)', 1);

      // ---- pebbles and cracks
      if (rng.chance(0.4)) {
        for (let k = 0; k < 3; k++) {
          const p = P(x + 0.2 + rng.next() * 0.6, y + 0.2 + rng.next() * 0.6, hz);
          ell(g, p[0], p[1], 1.5 + rng.next() * 1.8, 1 + rng.next(), shade(pal.ground[0], lift - 22), null);
        }
      }
      if (rng.chance(0.25)) {
        g.strokeStyle = shade(pal.ground[0], lift - 36);
        g.lineWidth = 1.4;
        g.beginPath();
        let p = P(x + 0.2 + rng.next() * 0.6, y + 0.2 + rng.next() * 0.6, hz);
        g.moveTo(p[0], p[1]);
        for (let k = 0; k < 3; k++) {
          p = [p[0] + (rng.next() - 0.5) * 14, p[1] + (rng.next() - 0.5) * 7];
          g.lineTo(p[0], p[1]);
        }
        g.stroke();
      }

      // ---- decor: toxic puddles, bones, soot stains
      for (const d of decor.get(i) ?? []) {
        if (d.kind === 'puddle') {
          const p = P(x + 0.5, y + 0.5, hz);
          if (biome === 'toxic') {
            ell(g, p[0], p[1], 20, 9, '#4f7a24', C.ink, 2);
            ell(g, p[0] - 4, p[1] - 2, 9, 3.5, '#8fc24a', null);
            ell(g, p[0] + 7, p[1] + 2, 2.5, 1.5, C.toxicL, null);
          } else {
            // Dry biomes: a dark stain instead of a toxic puddle.
            ell(g, p[0], p[1], 18, 8, pal.decor, null);
            ell(g, p[0] - 3, p[1] - 1.5, 9, 3.5, shade(pal.decor, 16), null);
          }
        } else if (d.kind === 'bones') {
          const p = P(x + d.ox, y + d.oy, hz);
          ell(g, p[0], p[1] - 3, 5, 4.5, C.bone, C.ink, 1.5);
          g.fillStyle = C.bone;
          g.fillRect(p[0] - 3, p[1] - 1, 6, 3.5);
          g.strokeStyle = C.ink;
          g.lineWidth = 1.2;
          g.strokeRect(p[0] - 3, p[1] - 1, 6, 3.5);
          ell(g, p[0] - 1.8, p[1] - 3, 1.4, 1.4, C.ink, null);
          ell(g, p[0] + 1.8, p[1] - 3, 1.4, 1.4, C.ink, null);
        } else {
          const p = P(x + 0.5, y + 0.5, hz);
          g.save();
          g.beginPath();
          diamondPath(g, x, y, hz);
          g.clip();
          g.translate(p[0], p[1]);
          g.scale(1, 0.5);
          const sg = g.createRadialGradient(0, 0, 2, 0, 0, 30);
          sg.addColorStop(0, 'rgba(15,10,8,.55)');
          sg.addColorStop(1, 'rgba(15,10,8,0)');
          g.fillStyle = sg;
          g.fillRect(-32, -32, 64, 64);
          g.restore();
        }
      }

      // ---- walls towards the lower neighbours (and down to the slab at the map's front rims)
      const faceY = pal.cliff[1];
      const faceX = pal.cliff[2];
      if (y === N - 1) {
        if (hz > 0) cliffFace(g, 'y', x, y, hz, 0, faceY, rng);
      } else if (lvl(x, y + 1) < L) {
        cliffFace(g, 'y', x, y, hz, lvl(x, y + 1) * STEP, faceY, rng);
      }
      if (x === N - 1) {
        if (hz > 0) cliffFace(g, 'x', x, y, hz, 0, faceX, rng);
      } else if (lvl(x + 1, y) < L) {
        cliffFace(g, 'x', x, y, hz, lvl(x + 1, y) * STEP, faceX, rng);
      }

      // ---- the back rims of the map carry the ink line the flat map had
      g.strokeStyle = C.ink;
      g.lineWidth = 3;
      if (y === 0) {
        const a = P(x, y, hz);
        const b = P(x + 1, y, hz);
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
      }
      if (x === 0) {
        const a = P(x, y, hz);
        const b = P(x, y + 1, hz);
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
      }

      // ---- light: shadows of the higher fields behind this one, and the shade at their foot
      const bodies = [];
      g.save();
      g.beginPath();
      diamondPath(g, x, y, hz);
      g.clip();
      for (const [dx, dy] of [[-1, 0], [0, -1], [-1, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0) continue;
        const delta = lvl(nx, ny) * STEP - hz;
        if (delta <= 0) continue;
        bodies.push({ footprint: rectCorners(nx, ny, nx + 1, ny + 1), height: delta });
        if (dx === -1 && dy === 0) footStrip(g, x, y, x, y + 1, 1, 0, hz);
        if (dx === 0 && dy === -1) footStrip(g, x, y, x + 1, y, 0, 1, hz);
      }
      if (bodies.length) {
        // The shadow of a block is cast on the plane of this field.
        g.translate(0, -hz);
        castShadows(g, bodies);
      }
      g.restore();

      // Bright line on the upper left edge, where the field behind it is lower (or the map ends).
      if (x === 0 || lvl(x - 1, y) < L) {
        const a = P(x, y, hz);
        const b = P(x, y + 1, hz);
        g.strokeStyle = `rgba(232,220,192,${EDGE_LIGHT_ALPHA})`;
        g.lineWidth = EDGE_LIGHT_WIDTH;
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
      }
    }
  }
}

export function createGroundLayer() {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  let built = null;
  let lastZoom = null;
  let lastZoomChange = 0;
  /** The flat field used when the caller gives none, kept so the cache key stays stable. */
  let flat = null;

  function build(size, seed, zoom, dpr, field) {
    const b = mapBounds(size);
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    const scale = Math.min(zoom * dpr, Math.sqrt(MAX_PIXELS / (w * h)));
    canvas.width = Math.ceil(w * scale);
    canvas.height = Math.ceil(h * scale);
    g.setTransform(scale, 0, 0, scale, -b.x0 * scale, -b.y0 * scale);
    g.clearRect(b.x0, b.y0, w, h);
    drawGround(g, size, createRng(`ground:${seed}`), biomeOf(seed), field);
    built = { size, seed, zoom, dpr, bounds: b, field };
  }

  return {
    /**
     * Draws the cached ground; rebuilds when the map, DPR or (settled) zoom changed.
     * @param {Uint8Array} [field]  Height field (terrain.js); flat when missing (gallery, studies).
     */
    draw(ctx, cam, view, size, seed, nowMs, field = null) {
      if (!field && flat?.size !== size) flat = { size, field: flatField(size) };
      const heights = field ?? flat.field;
      if (cam.zoom !== lastZoom) {
        lastZoom = cam.zoom;
        lastZoomChange = nowMs;
      }
      const stale = !built || built.size !== size || built.seed !== seed || built.dpr !== view.dpr || built.field !== heights;
      const zoomOff = built && Math.abs(built.zoom - cam.zoom) / cam.zoom > 0.02;
      if (stale || (zoomOff && nowMs - lastZoomChange > SETTLE_MS)) build(size, seed, cam.zoom, view.dpr, heights);

      const b = built.bounds;
      const [dx, dy] = worldToScreen(cam, view, b.x0, b.y0);
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(canvas, dx, dy, (b.x1 - b.x0) * cam.zoom, (b.y1 - b.y0) * cam.zoom);
    },
  };
}
