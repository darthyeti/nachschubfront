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
import { iso, mapBounds, SLAB_DEPTH, PLATE_THICK, PLATE_OVERHANG } from './iso.js';
import { worldToScreen } from './camera.js';
import { poly, ell } from './draw.js';
import { C } from './palette.js';
import { biomeOf, paletteOf, shade } from './biomes.js';
import { castShadows, footStrip, rectCorners, EDGE_LIGHT_ALPHA, EDGE_LIGHT_WIDTH } from './shadows.js';
import { STEP, flatField } from './terrain.js';
import { REVEAL } from '../data/art.js';
import { blockHull, cellsKey } from './occlusion.js';

/** Largest offscreen backing store in pixels (iPad Safari caps canvas memory). */
const MAX_PIXELS = 12_000_000;
/** Rebuild after the zoom has not changed for this long (ms). */
const SETTLE_MS = 160;
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

/** Steel of the base plate: three darker steps of the palette's steel (top, left face, right face). */
const PLATE_TOP = shade(C.steel, -38);
const PLATE_LEFT = shade(C.steelD, -4);
const PLATE_RIGHT = shade(C.steelD, -30);
const PLATE_RUST = ['#7a3c1e', '#5a2c16'];
const RUST_BAND_TOP = 9.5;
const RUST_BAND_BOTTOM = 13;
/** Squash of the table shadow ellipse and its size against the plate. */
const TABLE_SHADOW_SQUASH = 0.5;
const TABLE_SHADOW_SPREAD = 0.62;

/** Soft shadow on the table: a radial gradient squeezed into the iso ellipse. */
function paintTableShadow(g, N) {
  const [cx, cy] = iso(N / 2, N / 2, -SLAB_DEPTH - PLATE_THICK);
  g.save();
  g.translate(cx, cy + 6);
  g.scale(1, TABLE_SHADOW_SQUASH);
  const R = (N + PLATE_OVERHANG * 2) * 32 * TABLE_SHADOW_SPREAD * Math.SQRT2;
  const sh = g.createRadialGradient(0, 0, R * 0.35, 0, 0, R * 1.12);
  sh.addColorStop(0, 'rgba(0,0,0,.7)');
  sh.addColorStop(0.65, 'rgba(0,0,0,.5)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh;
  g.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4);
  g.restore();
}

/** The steel base plate under the slab: two side faces, a rust band, four rivets. */
function paintPlate(g, N) {
  const lo = -PLATE_OVERHANG;
  const hi = N + PLATE_OVERHANG;
  const zt = -SLAB_DEPTH;
  const zb = zt - PLATE_THICK;
  poly(g, [iso(lo, hi, zt), iso(hi, hi, zt), iso(hi, hi, zb), iso(lo, hi, zb)], PLATE_LEFT, C.ink, 3);
  poly(g, [iso(hi, hi, zt), iso(hi, lo, zt), iso(hi, lo, zb), iso(hi, hi, zb)], PLATE_RIGHT, C.ink, 3);
  poly(g, [iso(lo, lo, zt), iso(hi, lo, zt), iso(hi, hi, zt), iso(lo, hi, zt)], PLATE_TOP, C.ink, 3);
  // Rust band with a ragged upper edge on both faces.
  for (const axis of ['y', 'x']) {
    const at = (u, z) => (axis === 'y' ? iso(lo + u * (hi - lo), hi, z) : iso(hi, hi - u * (hi - lo), z));
    const z0 = zt - RUST_BAND_TOP;
    const z1 = zt - RUST_BAND_BOTTOM;
    g.beginPath();
    const a = at(0, z1);
    g.moveTo(a[0], a[1]);
    for (let i = 0; i <= 40; i++) {
      const p = at(i / 40, z0 + (Math.sin(i * 2.3) + Math.sin(i * 0.9 + 1)) * 0.9);
      g.lineTo(p[0], p[1]);
    }
    const b = at(1, z1);
    g.lineTo(b[0], b[1]);
    g.closePath();
    g.fillStyle = axis === 'y' ? PLATE_RUST[0] : PLATE_RUST[1];
    g.fill();
  }
  const zr = zt - 5;
  for (const p of [iso(lo + 0.35, hi, zr), iso(hi - 0.35, hi, zr), iso(hi, hi - 0.35, zr), iso(hi, lo + 0.35, zr)]) {
    ell(g, p[0], p[1], 3, 2.6, C.steel, C.ink, 1.5);
    ell(g, p[0] - 0.8, p[1] - 0.8, 1, 0.9, C.steelL, null);
  }
}

/** Random stream of one field, so a single field can be drawn again exactly as the cache drew it. */
const cellRng = (seed, x, y) => createRng(`ground:${seed}:${x},${y}`);

/**
 * @param {object} [only]  Optional `{skip, window}` for the reveal layer: `skip` is a Set of
 *   field indexes left out, `window` a world-pixel rectangle; fields outside it are not drawn.
 */
/** Whether the picture of a field (top face and its faces down to the slab) touches a world-pixel rectangle. */
function cellInWindow(x, y, hz, w) {
  const left = (x - y - 1) * 32;
  const right = (x - y + 1) * 32;
  const top = (x + y) * 16 - hz;
  const bottom = (x + y + 2) * 16;
  return right >= w.x0 && left <= w.x1 && bottom + 4 >= w.y0 && top - 4 <= w.y1;
}

function drawGround(g, size, seed, biome, field, only = null) {
  const rng = createRng(`ground:${seed}`);
  const pal = paletteOf(biome);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const N = size;
  const lvl = (x, y) => field[y * N + x];

  paintTableShadow(g, N);
  paintPlate(g, N);

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
      if (only?.skip?.has(i)) continue;
      const L = field[i];
      const hz = L * STEP;
      if (only?.window && !cellInWindow(x, y, hz, only.window)) continue;
      const lift = L * LEVEL_LIGHTEN;
      const rng = cellRng(seed, x, y);

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
    drawGround(g, size, seed, biomeOf(seed), field);
    built = { size, seed, zoom, dpr, bounds: b, field, scale };
    reveals.clear();
  }

  /** Reveal images by key of the covering fields: the ground drawn without those blocks. */
  const reveals = new Map();

  /** The ground without `cells`, cut to their outline, at the zoom of the cache. */
  function revealOf(cells, key) {
    const hit = reveals.get(key);
    if (hit && Math.abs(hit.zoom - lastZoom) / lastZoom <= 0.02) {
      reveals.delete(key);
      reveals.set(key, hit);
      return hit;
    }
    const { size, seed, field, bounds: b, dpr } = built;
    const hulls = cells.map((c) => blockHull(field, c.x, c.y));
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const h of hulls) {
      for (const [px, py] of h) {
        x0 = Math.min(x0, px);
        y0 = Math.min(y0, py);
        x1 = Math.max(x1, px);
        y1 = Math.max(y1, py);
      }
    }
    const scale = Math.min(lastZoom * dpr, Math.sqrt(MAX_PIXELS / ((x1 - x0) * (y1 - y0))));
    const image = hit?.canvas ?? document.createElement('canvas');
    image.width = Math.ceil((x1 - x0) * scale);
    image.height = Math.ceil((y1 - y0) * scale);
    const r = image.getContext('2d');
    r.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
    r.beginPath();
    for (const h of hulls) {
      h.forEach(([px, py], k) => (k ? r.lineTo(px, py) : r.moveTo(px, py)));
      r.closePath();
    }
    r.clip();
    const skip = new Set(cells.map((c) => c.y * size + c.x));
    drawGround(r, size, seed, biomeOf(seed), field, { skip, window: { x0, y0, x1, y1 } });
    const entry = { canvas: image, zoom: lastZoom, hulls, box: { x0, y0, x1, y1 } };
    reveals.delete(key);
    reveals.set(key, entry);
    while (reveals.size > REVEAL.maxLayers + 3) reveals.delete(reveals.keys().next().value);
    return entry;
  }

  return {
    /**
     * Lets the player see through blocks of terrain that cover a field: over the cached ground,
     * inside the outline of `cells`, the ground drawn without those blocks is laid down and the
     * cached picture is put back on top with the opacity `REVEAL.blockAlpha`. At `fade` 0 this
     * is the cached ground itself, at 1 the blocks are see-through. Call right after `draw`.
     * @param {{x: number, y: number}[]} cells  The covering fields.
     * @param {number} fade  0 to 1.
     */
    drawReveal(ctx, cam, view, cells, fade) {
      if (!built || fade <= 0 || !cells.length) return;
      const e = revealOf(cells, cellsKey(cells));
      const b = built.bounds;
      const k = cam.zoom;
      const [ox, oy] = worldToScreen(cam, view, e.box.x0, e.box.y0);
      const w = (e.box.x1 - e.box.x0) * k;
      const h = (e.box.y1 - e.box.y0) * k;
      ctx.save();
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.beginPath();
      for (const hull of e.hulls) {
        hull.forEach(([px, py], i) => {
          const [sx, sy] = worldToScreen(cam, view, px, py);
          if (i) ctx.lineTo(sx, sy);
          else ctx.moveTo(sx, sy);
        });
        ctx.closePath();
      }
      ctx.clip();
      ctx.globalAlpha = fade;
      ctx.drawImage(e.canvas, ox, oy, w, h);
      ctx.globalAlpha = 1 - fade * (1 - REVEAL.blockAlpha);
      const sc = built.scale;
      ctx.drawImage(
        canvas,
        (e.box.x0 - b.x0) * sc,
        (e.box.y0 - b.y0) * sc,
        (e.box.x1 - e.box.x0) * sc,
        (e.box.y1 - e.box.y0) * sc,
        ox,
        oy,
        w,
        h,
      );
      ctx.restore();
    },

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
