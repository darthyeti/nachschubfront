// Study: ruins, walls, craters and capsule remains with more variety and detail.
//
// Everything below the "Baukasten" headings is a design proposal, drawn with the
// game's own helpers (iso, poly, box, ell, shadow) and palette. The left column
// of every row calls the game's real drawObstacleCell; the right columns are
// assembled from a small kit of parts with a fixed seed per variant, so that the
// game could later build many variants from few parts (M8). Nothing here touches
// src/; the study only reads it.

import { iso, mapBounds } from '../../src/render/iso.js';
import { poly, box, ell, shadow, comicText } from '../../src/render/draw.js';
import { C } from '../../src/render/palette.js';
import { createRng } from '../../src/core/random.js';
import { CAMERA } from '../../src/data/settings.js';
import { DOCTRINE_IDS } from '../../src/data/doctrines.js';
import { createCanvasView } from '../../src/render/canvas.js';
import { createCamera, fitCamera, clampCamera, panBy, zoomAt, applyCamera } from '../../src/render/camera.js';
import { createGroundLayer } from '../../src/render/ground.js';
import { createSpriteCache } from '../../src/render/sprites/rasterizer.js';
import { allTowerDefs, drawTowerSprite } from '../../src/render/towerSprites.js';
import { drawObstacleCell, drawBeacon } from '../../src/render/objects.js';
import { attachPointerInput } from '../../src/input/pointer.js';
import { installPageGuards } from '../../src/input/guards.js';

const INK = C.ink;
const MORTAR = 'rgba(26,20,16,0.36)';
const SOOT = 'rgba(18,12,9,0.42)';
const CONC = [C.concL, C.conc, C.concD];
const STONE = C.stone;
const BRICK = C.brick;
const SLAB = ['#80735f', '#5f5446', '#433a31'];
const WOOD = ['#8a6a4a', '#6b4f36', '#4a3626'];
// The capsule's own plates (reference/konzept/kapsel/kapsel-geoeffnet.svg).
const PLATE = ['#8b857c', '#6f6a63', '#4a4642'];
const PIT = '#1c1511';
const lerp = (a, b, t) => a + (b - a) * t;

/** Seed offset of "Neu würfeln"; 0 gives exactly the fixed seeds of the study. */
let reroll = 0;
const rngFor = (art, variant, extra = '') => createRng(`truemmer:${art}:${variant}${extra}${reroll ? `:${reroll}` : ''}`);

// ---------- Baukasten: general primitives ----------

/** A thick line with ink outline between two screen points. */
function seg(ctx, a, b, w, col, hl = null) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + 3;
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.stroke();
  if (hl) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1] - w * 0.22);
    ctx.lineTo(b[0], b[1] - w * 0.22);
    ctx.strokeStyle = hl;
    ctx.lineWidth = Math.max(1, w * 0.26);
    ctx.stroke();
  }
}

/** A bent bar through several screen points. */
function bar(ctx, pts, w, col, hl = null) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  };
  path();
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + 3;
  ctx.stroke();
  path();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.stroke();
  if (hl) {
    ctx.save();
    ctx.translate(0, -w * 0.22);
    path();
    ctx.strokeStyle = hl;
    ctx.lineWidth = Math.max(1, w * 0.26);
    ctx.stroke();
    ctx.restore();
  }
}

/** Closed screen-space blob with smoothed radial noise (clockwise on screen). */
function blobS(rng, sx, sy, rx, ry, n, jit) {
  const ks = [];
  for (let i = 0; i < n; i++) ks.push(1 + rng.range(-jit, jit));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const k = (ks[(i + n - 1) % n] + 2 * ks[i] + ks[(i + 1) % n]) / 4;
    const a = (i / n) * Math.PI * 2;
    pts.push([sx + Math.cos(a) * rx * k, sy + Math.sin(a) * ry * k]);
  }
  return pts;
}
const scalePts = (pts, cx, cy, s, dy = 0) => pts.map(([x, y]) => [cx + (x - cx) * s, cy + (y - cy) * s + dy]);

/** Prism over a clockwise ground polygon in grid coordinates, faces shaded by normal. */
function prism(ctx, pts, z, h, pal, lw = 2.2) {
  const n = pts.length;
  const faces = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const nx = q[1] - p[1];
    const ny = -(q[0] - p[0]);
    if (nx + ny <= 0) continue;
    faces.push({ p, q, key: p[0] + q[0] + p[1] + q[1], dark: nx > ny });
  }
  faces.sort((a, b) => a.key - b.key);
  for (const f of faces) {
    poly(ctx, [iso(f.p[0], f.p[1], z), iso(f.q[0], f.q[1], z), iso(f.q[0], f.q[1], z + h), iso(f.p[0], f.p[1], z + h)], f.dark ? pal[2] : pal[1], INK, lw);
  }
  if (pal[0]) poly(ctx, pts.map((p) => iso(p[0], p[1], z + h)), pal[0], INK, lw);
}

/** Horizontal mortar courses and staggered joints on one face, clipped to it. */
function faceMortar(ctx, facePts, fp, zTop, step, bl) {
  ctx.save();
  ctx.beginPath();
  facePts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = MORTAR;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let k = 0; k * step < zTop; k++) {
    const zb = k * step;
    const zt = zb + step;
    const a = fp(0, zt);
    const b = fp(1, zt);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    for (let u = (k % 2 ? bl * 0.5 : bl); u < 1; u += bl) {
      const c = fp(u, zb);
      const d = fp(u, zt);
      ctx.moveTo(c[0], c[1]);
      ctx.lineTo(d[0], d[1]);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Box with its four top corners at their own heights hs = [A(x,y), B(x+w,y),
 * C(x+w,y+d), D(x,y+d)] (slanted breaks) and optionally a jagged top edge along
 * the two visible faces. Returns point functions for decoration on both faces.
 */
function chunk(ctx, x, y, w, d, z, hs, pal, o = {}) {
  const rng = o.rng;
  const nJ = rng ? o.jag ?? 0 : 0;
  const amp = o.amp ?? 5;
  const lw = o.lw ?? 2.2;
  const mk = (p, q, hp, hq) => {
    const out = [[p[0], p[1], z + hp]];
    for (let i = 1; i <= nJ; i++) {
      const t = i / (nJ + 1);
      out.push([lerp(p[0], q[0], t), lerp(p[1], q[1], t), z + lerp(hp, hq, t) - rng.range(-amp * 0.25, amp)]);
    }
    out.push([q[0], q[1], z + hq]);
    return out;
  };
  const S = (p) => iso(p[0], p[1], p[2]);
  const eF = mk([x, y + d], [x + w, y + d], hs[3], hs[2]);
  const eR = mk([x + w, y], [x + w, y + d], hs[1], hs[2]);
  const faceF = [iso(x, y + d, z), iso(x + w, y + d, z), ...eF.slice().reverse().map(S)];
  const faceR = [iso(x + w, y + d, z), iso(x + w, y, z), ...eR.map(S)];
  const top = [iso(x, y, z + hs[0]), ...eR.map(S), ...eF.slice().reverse().map(S)];
  const fF = (u, zz) => iso(x + u * w, y + d, z + zz);
  const fR = (u, zz) => iso(x + w, y + u * d, z + zz);
  poly(ctx, faceF, pal[1], INK, lw);
  poly(ctx, faceR, pal[2], INK, lw);
  if (o.mortar) {
    const zTop = Math.max(...hs) + 4;
    faceMortar(ctx, faceF, fF, zTop, o.mortar, 0.17 / w);
    faceMortar(ctx, faceR, fR, zTop, o.mortar, 0.17 / d);
  }
  poly(ctx, top, pal[0], INK, lw);
  return { fF, fR, top };
}

/** Round body from an ellipse base; `broken` gives a ragged top. Bands: [{z0, z1, col, colD}]. */
function cyl(ctx, x, y, rx, ry, h, [top, mid, dark], o = {}) {
  const lw = o.lw ?? 2.2;
  const N = 24;
  let ring = null;
  if (o.broken && o.rng) {
    ring = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const front = Math.sin(a) > -0.1;
      ring.push([x + Math.cos(a) * rx, y - h + Math.sin(a) * ry - (front ? o.rng.range(0, o.broken) : o.rng.range(0, 1.5))]);
    }
  }
  const side = () => {
    ctx.beginPath();
    ctx.moveTo(x - rx, y);
    ctx.ellipse(x, y, rx, ry, 0, Math.PI, 0, true);
    if (!ring) {
      ctx.lineTo(x + rx, y - h);
      ctx.lineTo(x - rx, y - h);
    } else {
      for (let i = 0; i <= N / 2; i++) ctx.lineTo(ring[i % N][0], ring[i % N][1]);
    }
    ctx.closePath();
  };
  side();
  ctx.fillStyle = mid;
  ctx.fill();
  ctx.save();
  side();
  ctx.clip();
  ctx.fillStyle = dark;
  ctx.fillRect(x + rx * 0.28, y - h - ry - 8, rx, h + ry * 2 + 16);
  for (const b of o.bands ?? []) {
    const band = () => {
      ctx.beginPath();
      ctx.moveTo(x - rx, y - b.z0);
      ctx.ellipse(x, y - b.z0, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(x + rx, y - b.z1);
      ctx.ellipse(x, y - b.z1, rx, ry, 0, 0, Math.PI, false);
      ctx.closePath();
    };
    band();
    ctx.fillStyle = b.col;
    ctx.fill();
    ctx.save();
    band();
    ctx.clip();
    ctx.fillStyle = b.colD ?? b.col;
    ctx.fillRect(x + rx * 0.28, y - h - ry - 8, rx, h + ry * 2 + 16);
    ctx.restore();
    band();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  ctx.strokeStyle = MORTAR;
  ctx.lineWidth = 1.1;
  for (const rz of o.rings ?? []) {
    ctx.beginPath();
    ctx.ellipse(x, y - rz, rx, ry, 0, 0, Math.PI, false);
    ctx.stroke();
  }
  ctx.restore();
  side();
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.stroke();
  if (ring) poly(ctx, ring, top, INK, lw);
  else ell(ctx, x, y - h, rx, ry, top, INK, lw);
}
/** Cylinder at grid position, radius in cells (a circle of r cells is 45.25r x 22.63r on screen). */
function gcyl(ctx, gx, gy, z, r, h, pal, o) {
  const [sx, sy] = iso(gx, gy, z);
  cyl(ctx, sx, sy, 45.25 * r, 22.63 * r, h, pal, o);
}

/** A flat plate with every corner at its own height and a visible thickness. */
function plate(ctx, pts3, top, edge, th = 2, lw = 1.8) {
  const p = pts3.map(([gx, gy, gz]) => iso(gx, gy, gz));
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    poly(ctx, [a, b, [b[0], b[1] + th], [a[0], a[1] + th]], edge, INK, lw);
  }
  poly(ctx, p, top, INK, lw);
  return p;
}

// ---------- Baukasten: details ----------

/** Pointed-arch opening on a face. fp(u, z) maps a face position to screen. */
function archWindow(ctx, fp, u0, u1, z0, z1, ah, fill = PIT) {
  const um = (u0 + u1) / 2;
  poly(ctx, [fp(u0, z0), fp(u1, z0), fp(u1, z1), fp(lerp(u1, um, 0.55), z1 + ah * 0.72), fp(um, z1 + ah), fp(lerp(u0, um, 0.55), z1 + ah * 0.72), fp(u0, z1)], fill, INK, 2);
}
/** Round-headed gate on a face (the opening reaches the ground). */
function gate(ctx, fp, u0, u1, z0, z1) {
  const um = (u0 + u1) / 2;
  const r = (u1 - u0) / 2;
  const pts = [fp(u0, z0), fp(u1, z0)];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI;
    pts.push(fp(um + Math.cos(a) * r, z1 + Math.sin(a) * (z1 - z0) * 0.45));
  }
  poly(ctx, pts, PIT, INK, 2.2);
}
function rectHole(ctx, fp, u0, u1, z0, z1, fill = PIT) {
  poly(ctx, [fp(u0, z0), fp(u1, z0), fp(u1, z1), fp(u0, z1)], fill, INK, 2);
}
function sootTongue(ctx, fp, u0, u1, z0, z1, rng) {
  const n = 5;
  const pts = [fp(u0, z0), fp(u1, z0)];
  for (let i = n; i >= 0; i--) pts.push(fp(lerp(u0, u1, i / n), z1 - (i % 2) * rng.range(3, 9) - rng.range(0, 4)));
  poly(ctx, pts, SOOT, null);
}
function bulletMarks(ctx, fp, rng, n, u0, u1, z0, z1) {
  for (let i = 0; i < n; i++) {
    const p = fp(rng.range(u0, u1), rng.range(z0, z1));
    ell(ctx, p[0], p[1], 3.2, 2.2, null, 'rgba(232,220,192,0.55)', 1.2);
    ell(ctx, p[0], p[1], 2.3, 1.6, INK, null);
  }
}
function lichen(ctx, fp, rng, n, u0, u1, z0, z1) {
  for (let i = 0; i < n; i++) {
    const p = fp(rng.range(u0, u1), rng.range(z0, z1));
    const rx = rng.range(3, 5);
    ell(ctx, p[0], p[1], rx, rx * 0.6, C.toxicD, INK, 1.2);
    ell(ctx, p[0] - 1, p[1] - 1, rx * 0.45, rx * 0.25, C.toxic, null);
  }
}
/** Thin steel rods sticking out of a broken concrete top, rusted. */
function rebar(ctx, gx, gy, z, rng, n, spread = 0.2) {
  for (let i = 0; i < n; i++) {
    const [px, py] = iso(gx + (i / Math.max(1, n - 1) - 0.5) * spread * 2, gy + (i % 2) * 0.05, z);
    const l1 = rng.range(6, 11);
    const dx = rng.range(-4, 4);
    const pts = [[px, py], [px + dx * 0.3, py - l1], [px + dx, py - l1 - rng.range(4, 8)]];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.strokeStyle = C.rustL;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
function beam(ctx, a, b, w = 5) {
  seg(ctx, a, b, w, WOOD[1], WOOD[0]);
  ell(ctx, b[0], b[1], w * 0.55, w * 0.4, '#a8895f', INK, 1.2);
}
function skull(ctx, x, y) {
  poly(ctx, [[x - 2.6, y - 0.6], [x + 2.6, y - 0.6], [x + 2, y + 2.6], [x - 2, y + 2.6]], C.boneD, INK, 1.1);
  ell(ctx, x, y - 2.8, 4.4, 3.8, C.bone, INK, 1.3);
  ell(ctx, x - 1.7, y - 2.6, 1.1, 1.2, INK, null);
  ell(ctx, x + 1.7, y - 2.6, 1.1, 1.2, INK, null);
}
function boneBar(ctx, a, b) {
  seg(ctx, a, b, 2.4, C.bone);
  ell(ctx, a[0], a[1], 2, 1.6, C.bone, INK, 1);
  ell(ctx, b[0], b[1], 2, 1.6, C.bone, INK, 1);
}
/** Barbed wire between two screen points: ink and steel line, a zig-zag, a barb every third step. */
function wire(ctx, a, b) {
  const n = 14;
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n) + (i % 2 ? 2.4 : -2.4)]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.stroke();
  ctx.strokeStyle = C.steelL;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 1; i < n; i += 3) {
    const [x, y] = pts[i];
    ctx.moveTo(x - 2.6, y - 2.6);
    ctx.lineTo(x + 2.6, y + 2.6);
    ctx.moveTo(x - 2.6, y + 2.6);
    ctx.lineTo(x + 2.6, y - 2.6);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
/** A heap of small bricks and stones in a disc. */
function heap(ctx, rng, cx, cy, R, n, pals, hmax, z = 0, hmin = 2) {
  const items = [];
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * R;
    items.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, w: rng.range(0.08, 0.17), dd: rng.range(0.08, 0.15), h: rng.range(hmin, lerp(hmin, hmax, 1 - d / R + 0.2)), pal: rng.pick(pals) });
  }
  items.sort((p, q) => p.x + p.y - (q.x + q.y));
  for (const it of items) box(ctx, it.x - it.w / 2, it.y - it.dd / 2, it.w, it.dd, it.h, z, it.pal, 1.6);
}
/** Chipped slab under a ruin: the cell, corners cut at random. */
function chippedSlab(ctx, ox, oy, rng, h = 5, pal = SLAB, inset = 0.05) {
  const corners = [[inset, inset], [1 - inset, inset], [1 - inset, 1 - inset], [inset, 1 - inset]];
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const c = corners[i];
    const prev = corners[(i + 3) % 4];
    const next = corners[(i + 1) % 4];
    const t1 = rng.range(0.02, 0.26);
    const t2 = rng.range(0.02, 0.26);
    pts.push([ox + lerp(c[0], prev[0], t1), oy + lerp(c[1], prev[1], t1)]);
    pts.push([ox + lerp(c[0], next[0], t2), oy + lerp(c[1], next[1], t2)]);
  }
  prism(ctx, pts, 0, h, pal, 2.4);
  const a = iso(ox + rng.range(0.2, 0.4), oy + rng.range(0.55, 0.8), h);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(a[0] + rng.range(6, 12), a[1] + rng.range(1, 4));
  ctx.lineTo(a[0] + rng.range(10, 18), a[1] - rng.range(0, 3));
  ctx.strokeStyle = 'rgba(26,20,16,0.5)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}
const cellShadow = (ctx, ox, oy, rx, ry, a = 0.3, dx = 9, dy = 4) => {
  const [sx, sy] = iso(ox + 0.5, oy + 0.5);
  shadow(ctx, sx + dx, sy + dy, rx, ry, a);
};
// ---------- Ruins: eight compositions from the kit ----------

/** Straight wall piece along an axis; the front face is fF for 'x' and fR for 'y'. */
function ruinWall(ctx, rng, { axis, x, y, len, thick, z = 5, h0, h1, pal = STONE, jag = 3, amp = 6, mortar = 6 }) {
  const c = axis === 'x'
    ? chunk(ctx, x, y, len, thick, z, [h0, h1, h1, h0], pal, { rng, jag, amp, mortar })
    : chunk(ctx, x, y, thick, len, z, [h0, h0, h1, h1], pal, { rng, jag, amp, mortar });
  return { front: axis === 'x' ? c.fF : c.fR, ...c };
}

function ruinChapel(ctx, ox, oy, rng) {
  cellShadow(ctx, ox, oy, 36, 14);
  chippedSlab(ctx, ox, oy, rng);
  const back = ruinWall(ctx, rng, { axis: 'x', x: ox + 0.1, y: oy + 0.1, len: 0.8, thick: 0.2, h0: 38 + rng.int(0, 3), h1: 26 });
  archWindow(ctx, back.front, 0.3, 0.6, 8, 19, 8);
  sootTongue(ctx, back.front, 0.28, 0.62, 20, 30, rng);
  const side = ruinWall(ctx, rng, { axis: 'y', x: ox + 0.1, y: oy + 0.3, len: 0.5, thick: 0.2, h0: 30, h1: 12, jag: 2 });
  archWindow(ctx, side.front, 0.22, 0.52, 7, 14, 6);
  heap(ctx, rng, ox + 0.68, oy + 0.7, 0.2, 7, [BRICK, STONE], 9, 5);
}

function ruinTower(ctx, ox, oy, rng) {
  cellShadow(ctx, ox, oy, 34, 14);
  chippedSlab(ctx, ox, oy, rng);
  const t = chunk(ctx, ox + 0.2, oy + 0.18, 0.6, 0.6, 5, [46, 42, 34, 40], STONE, { rng, jag: 4, amp: 8, mortar: 6 });
  gate(ctx, t.fF, 0.34, 0.66, 0, 13);
  archWindow(ctx, t.fR, 0.38, 0.58, 20, 28, 6);
  sootTongue(ctx, t.fR, 0.3, 0.7, 29, 38, rng);
  heap(ctx, rng, ox + 0.22, oy + 0.82, 0.15, 6, [BRICK, STONE], 9, 5);
  chunk(ctx, ox + 0.68, oy + 0.7, 0.22, 0.22, 5, [13, 11, 6, 10], BRICK, { rng, jag: 1, amp: 3, mortar: 4 });
}

function ruinCorner(ctx, ox, oy, rng) {
  cellShadow(ctx, ox, oy, 36, 14);
  chippedSlab(ctx, ox, oy, rng);
  chunk(ctx, ox + 0.1, oy + 0.1, 0.2, 0.2, 5, [46, 45, 44, 45], STONE, { rng, jag: 2, amp: 5, mortar: 6 });
  const a = ruinWall(ctx, rng, { axis: 'x', x: ox + 0.3, y: oy + 0.1, len: 0.6, thick: 0.2, h0: 40, h1: 16 });
  rectHole(ctx, a.front, 0.18, 0.5, 11, 24);
  const b = ruinWall(ctx, rng, { axis: 'y', x: ox + 0.1, y: oy + 0.3, len: 0.55, thick: 0.2, h0: 36, h1: 12 });
  sootTongue(ctx, b.front, 0.1, 0.62, 5, 26, rng);
  // Rafters: one leaning on the long arm, two fallen from the arms' ends.
  beam(ctx, iso(ox + 0.46, oy + 0.3, 36), iso(ox + 0.7, oy + 0.52, 7), 5);
  beam(ctx, iso(ox + 0.84, oy + 0.28, 24), iso(ox + 0.5, oy + 0.74, 7), 4.5);
  beam(ctx, iso(ox + 0.14, oy + 0.7, 17), iso(ox + 0.5, oy + 0.88, 7), 4.5);
  const s = iso(ox + 0.8, oy + 0.84, 5);
  skull(ctx, s[0], s[1]);
}

function ruinFactory(ctx, ox, oy, rng) {
  cellShadow(ctx, ox, oy, 36, 14);
  chippedSlab(ctx, ox, oy, rng);
  const ch = chunk(ctx, ox + 0.12, oy + 0.1, 0.2, 0.2, 5, [41, 41, 41, 41], BRICK, { mortar: 5 });
  sootTongue(ctx, ch.fF, 0.15, 0.85, 22, 41, rng);
  chunk(ctx, ox + 0.14, oy + 0.12, 0.16, 0.16, 46, [4, 4, 4, 4], BRICK, { lw: 2 });
  const [hx, hy] = iso(ox + 0.22, oy + 0.2, 50);
  ell(ctx, hx, hy, 5, 2.4, INK, null);
  const w = chunk(ctx, ox + 0.1, oy + 0.42, 0.8, 0.24, 5, [24, 18, 16, 22], CONC, { rng, jag: 3, amp: 5, mortar: 10 });
  rectHole(ctx, w.fF, 0.1, 0.28, 6, 15);
  rectHole(ctx, w.fF, 0.42, 0.6, 6, 14);
  rebar(ctx, ox + 0.78, oy + 0.54, 5 + 16, rng, 4, 0.1);
  heap(ctx, rng, ox + 0.52, oy + 0.84, 0.14, 5, [CONC], 7, 5);
}

function ruinConcrete(ctx, ox, oy, rng) {
  cellShadow(ctx, ox, oy, 36, 14);
  chippedSlab(ctx, ox, oy, rng, 4, ['#7a6f60', '#5a5044', '#40372f']);
  const big = chunk(ctx, ox + 0.1, oy + 0.18, 0.46, 0.58, 4, [32, 28, 12, 20], CONC, { rng, jag: 3, amp: 6, mortar: 11 });
  poly(ctx, [big.fF(0.12, 4), big.fF(0.5, 6), big.fF(0.62, 15), big.fF(0.38, 18), big.fF(0.26, 12), big.fF(0.1, 14)], PIT, INK, 2);
  rebar(ctx, ox + 0.3, oy + 0.22, 4 + 30, rng, 4, 0.12);
  chunk(ctx, ox + 0.58, oy + 0.46, 0.34, 0.4, 4, [15, 11, 5, 9], CONC, { rng, jag: 2, amp: 4, mortar: 11 });
  rebar(ctx, ox + 0.76, oy + 0.54, 4 + 11, rng, 3, 0.08);
  heap(ctx, rng, ox + 0.3, oy + 0.88, 0.1, 4, [CONC], 5, 4);
}

function ruinArch(ctx, ox, oy, rng) {
  cellShadow(ctx, ox, oy, 36, 14);
  chippedSlab(ctx, ox, oy, rng);
  const w = ruinWall(ctx, rng, { axis: 'x', x: ox + 0.06, y: oy + 0.32, len: 0.88, thick: 0.22, h0: 42, h1: 30, jag: 3 });
  gate(ctx, w.front, 0.3, 0.7, 0, 20);
  gcyl(ctx, ox + 0.16, oy + 0.7, 5, 0.1, 28, STONE, { rng, broken: 5, rings: [9, 18] });
  gcyl(ctx, ox + 0.84, oy + 0.72, 5, 0.1, 13, STONE, { rng, broken: 4, rings: [7] });
  heap(ctx, rng, ox + 0.5, oy + 0.84, 0.13, 5, [STONE, BRICK], 6, 5);
}

function ruinColumns(ctx, ox, oy, rng) {
  cellShadow(ctx, ox, oy, 36, 14);
  chippedSlab(ctx, ox, oy, rng, 6, ['#8c7f6b', '#6a5d4e', '#4b4238']);
  gcyl(ctx, ox + 0.3, oy + 0.3, 6, 0.13, 34, STONE, { rng, broken: 6, rings: [9, 18, 27] });
  gcyl(ctx, ox + 0.66, oy + 0.36, 6, 0.12, 20, STONE, { rng, broken: 5, rings: [9, 17] });
  const a = iso(ox + 0.16, oy + 0.66, 12);
  const b = iso(ox + 0.54, oy + 0.66, 12);
  seg(ctx, a, b, 11, STONE[1], STONE[0]);
  ell(ctx, b[0], b[1], 4.2, 5.4, STONE[0], INK, 1.6);
  gcyl(ctx, ox + 0.76, oy + 0.76, 6, 0.1, 10, STONE, { rng, broken: 3, rings: [5] });
  const s = iso(ox + 0.4, oy + 0.88, 6);
  skull(ctx, s[0], s[1]);
}

function ruinMound(ctx, ox, oy, rng) {
  cellShadow(ctx, ox, oy, 36, 14);
  beam(ctx, iso(ox + 0.5, oy + 0.45, 12), iso(ox + 0.14, oy + 0.16, 38), 5);
  beam(ctx, iso(ox + 0.5, oy + 0.5, 12), iso(ox + 0.78, oy + 0.12, 34), 4.5);
  heap(ctx, rng, ox + 0.5, oy + 0.55, 0.42, 28, [BRICK, STONE, CONC], 20, 0, 3);
  chunk(ctx, ox + 0.36, oy + 0.42, 0.26, 0.2, 14, [8, 8, 5, 5], CONC, { rng, jag: 1, amp: 3, mortar: 8 });
  rebar(ctx, ox + 0.46, oy + 0.46, 14 + 7, rng, 3, 0.06);
  beam(ctx, iso(ox + 0.44, oy + 0.6, 16), iso(ox + 0.18, oy + 0.9, 30), 5);
}

const RUINS = [
  { name: 'Kapelle', draw: ruinChapel },
  { name: 'Turmstumpf', draw: ruinTower },
  { name: 'Hausecke', draw: ruinCorner },
  { name: 'Fabrikrest', draw: ruinFactory },
  { name: 'Betonbruch', draw: ruinConcrete },
  { name: 'Torbogen', draw: ruinArch },
  { name: 'Säulenstumpf', draw: ruinColumns },
  { name: 'Trümmerhügel', draw: ruinMound },
];

// ---------- Walls: pieces that line up in runs of two or three cells ----------

/**
 * One cell of a wall run, horizontal (along x) or vertical (along y). The pieces
 * all keep the same base height `hb` at their ends, so any order joins up.
 */
function wallPiece(ctx, ox, oy, horizontal, piece, hb, rng) {
  cellShadow(ctx, ox, oy, 30, 11, 0.25, 6, 3);
  const T0 = 0.3;
  const T1 = 0.7;
  const rect = (a0, a1, inset = 0) => (horizontal
    ? [ox + a0, oy + T0 + inset, a1 - a0, T1 - T0 - 2 * inset]
    : [ox + T0 + inset, oy + a0, T1 - T0 - 2 * inset, a1 - a0]);
  const hsOf = (s, e) => (horizontal ? [s, e, e, s] : [s, s, e, e]);
  const part = (a0, a1, s, e, pal = STONE, o = {}, inset = 0, z = 0) => {
    const [x, y, w, d] = rect(a0, a1, inset);
    const c = chunk(ctx, x, y, w, d, z, hsOf(s, e), pal, { rng, mortar: 6, ...o });
    return horizontal ? c.fF : c.fR;
  };
  const topPt = (u, z) => (horizontal ? iso(ox + u, oy + 0.5, z) : iso(ox + 0.5, oy + u, z));

  if (piece === 'plain') {
    part(0, 1, hb, hb, STONE, { jag: 2, amp: 3 });
  } else if (piece === 'crenel') {
    part(0, 1, hb, hb);
    part(0.04, 0.3, 8, 8, STONE, { mortar: 4 }, 0.04, hb);
    part(0.56, 0.82, 4, 4, STONE, { mortar: 4, jag: 2, amp: 2 }, 0.04, hb);
  } else if (piece === 'breach') {
    part(0, 0.3, hb, hb * 0.55, STONE, { jag: 2, amp: 6 });
    heap(ctx, rng, ox + 0.5, oy + 0.5, 0.26, 14, [STONE, CONC], 9, 0, 2);
    part(0.7, 1, hb * 0.45, hb, STONE, { jag: 2, amp: 6 });
  } else if (piece === 'buttress') {
    part(0, 1, hb, hb);
    if (horizontal) chunk(ctx, ox + 0.28, oy + 0.7, 0.44, 0.24, 0, [hb - 2, hb - 2, hb - 12, hb - 12], STONE, { mortar: 6 });
    else chunk(ctx, ox + 0.7, oy + 0.28, 0.24, 0.44, 0, [hb - 2, hb - 12, hb - 12, hb - 2], STONE, { mortar: 6 });
  } else if (piece === 'slit') {
    const f = part(0, 1, hb, hb);
    poly(ctx, [f(0.18, 7), f(0.36, 7), f(0.32, hb - 4), f(0.22, hb - 4)], PIT, INK, 1.8);
    poly(ctx, [f(0.64, 7), f(0.82, 7), f(0.78, hb - 4), f(0.68, hb - 4)], PIT, INK, 1.8);
    sootTongue(ctx, f, 0.6, 0.84, hb - 5, hb - 1, rng);
  } else if (piece === 'stair') {
    part(0, 0.36, hb, hb, STONE, { jag: 1, amp: 2 });
    part(0.36, 0.68, hb * 0.62, hb * 0.62, STONE, { jag: 1, amp: 2 });
    part(0.68, 1, hb * 0.3, hb * 0.3, STONE, { jag: 1, amp: 2 });
    heap(ctx, rng, ox + 0.5 + (horizontal ? 0.36 : 0), oy + 0.5 + (horizontal ? 0 : 0.36), 0.1, 3, [STONE], 4, 0, 2);
  } else if (piece === 'bullet') {
    const f = part(0, 1, hb, hb, STONE, { jag: 2, amp: 3 });
    bulletMarks(ctx, f, rng, 7, 0.12, 0.88, 4, hb - 4);
    ctx.beginPath();
    const p0 = f(0.5, hb);
    const p1 = f(0.6, hb * 0.62);
    const p2 = f(0.5, hb * 0.3);
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (piece === 'moss') {
    const f = part(0, 1, hb, hb, STONE, { jag: 2, amp: 3 });
    lichen(ctx, f, rng, 3, 0.08, 0.92, 1, 4);
    lichen(ctx, f, rng, 3, 0.1, 0.9, hb - 9, hb - 3);
  } else if (piece === 'wire') {
    part(0, 1, hb, hb, STONE, { jag: 1, amp: 2 });
    const posts = [0.08, 0.5, 0.92].map((u) => topPt(u, hb));
    for (const p of posts) seg(ctx, p, [p[0], p[1] - 13], 2, C.steelD);
    for (let i = 0; i < 2; i++) {
      wire(ctx, [posts[i][0], posts[i][1] - 6], [posts[i + 1][0], posts[i + 1][1] - 6]);
      wire(ctx, [posts[i][0], posts[i][1] - 11], [posts[i + 1][0], posts[i + 1][1] - 11]);
    }
  }
}

const WALL_RUNS = [
  { name: 'Zinnenreihe', pieces: ['crenel', 'plain', 'crenel'] },
  { name: 'Bresche', pieces: ['plain', 'breach', 'plain'] },
  { name: 'Strebepfeiler', pieces: ['buttress', 'plain', 'buttress'] },
  { name: 'Schießscharten', pieces: ['plain', 'slit', 'plain'] },
  { name: 'Treppenende', pieces: ['plain', 'plain', 'stair'] },
  { name: 'Einschussmarken', pieces: ['plain', 'bullet', 'bullet'] },
  { name: 'Bewachsen', pieces: ['plain', 'moss', 'moss'] },
  { name: 'Stacheldraht', pieces: ['wire', 'wire', 'plain'] },
];

function drawNewWallCell(ctx, ob, index) {
  const { x, y } = ob.cells[index];
  const horizontal = ob.cells.length > 1 && ob.cells[1].y === ob.cells[0].y;
  const run = WALL_RUNS[ob.variant % WALL_RUNS.length];
  const count = ob.cells.length;
  const piece = run.pieces[index + (3 - count)];
  const hb = 18 + rngFor('wall', ob.variant).int(0, 4);
  wallPiece(ctx, x, y, horizontal, piece, hb, rngFor('wall', ob.variant, `:${index}`));
}
// ---------- Craters: irregular rim, dark floor, one feature each ----------

/** Rim, pit wall and floor of one crater, drawn flat on the ground around screen point (sx, sy). */
function craterBase(ctx, sx, sy, rng, o = {}) {
  const r = o.r ?? 1;
  const rimCol = o.rim ?? ['#3a2e25', '#5d4b3b'];
  const outer = blobS(rng, sx, sy, 30 * r, 15 * r, 16, 0.12);
  poly(ctx, outer, rimCol[0], INK, 2.5);
  const lift = o.lift ?? 2;
  const top = scalePts(outer, sx, sy, 0.94, -lift);
  poly(ctx, top, rimCol[1], INK, 1.6);
  const out = { outer, top };
  if (o.water) {
    out.pit = scalePts(outer, sx, sy, 0.7, -lift + 0.5);
    poly(ctx, out.pit, PIT, INK, 1.8);
  } else {
    out.pit = scalePts(outer, sx, sy, 0.62, -lift);
    poly(ctx, out.pit, '#2b211a', INK, 2);
    out.floor = scalePts(outer, sx, sy, 0.46, 0);
    poly(ctx, out.floor, PIT, INK, 1.6);
  }
  // Lit lip on the near half of the rim.
  ctx.beginPath();
  for (let i = 1; i < top.length / 2; i++) (i === 1 ? ctx.moveTo(top[i][0], top[i][1]) : ctx.lineTo(top[i][0], top[i][1]));
  ctx.strokeStyle = o.lip ?? '#8e7760';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();
  return out;
}
/** Stones on a crater rim, in grid coordinates around the cell centre; back ones first, front ones later. */
function rimStones(rng, n, r = 1, pals = [CONC, STONE]) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
    out.push({ a, dx: Math.cos(a) * 0.37 * r, dy: Math.sin(a) * 0.37 * r, w: rng.range(0.1, 0.18), d: rng.range(0.1, 0.16), h: rng.range(3, 9), pal: rng.pick(pals) });
  }
  return out.sort((p, q) => p.dx + p.dy - (q.dx + q.dy));
}
function drawRimStones(ctx, ox, oy, stones, front) {
  for (const s of stones) {
    if ((s.dx + s.dy >= 0) !== front) continue;
    box(ctx, ox + 0.5 + s.dx - s.w / 2, oy + 0.5 + s.dy - s.d / 2, s.w, s.d, s.h, 2, s.pal, 1.7);
  }
}

const GLASS = ['#4a403a', '#2e2723', '#1f1a17'];

function craterEmbers(ctx, ox, oy, rng) {
  const [sx, sy] = iso(ox + 0.5, oy + 0.5);
  const stones = rimStones(rng, 6);
  craterBase(ctx, sx, sy, rng);
  drawRimStones(ctx, ox, oy, stones, false);
  ell(ctx, sx, sy, 21, 10, 'rgba(255,90,30,0.15)');
  for (let i = 0; i < 8; i++) {
    const px = sx + rng.range(-10, 10);
    const py = sy + rng.range(-3.5, 4.5);
    const rad = rng.range(1.4, 2.8);
    ell(ctx, px, py, rad + 1.6, (rad + 1.6) * 0.6, 'rgba(255,100,30,0.3)');
    ell(ctx, px, py, rad, rad * 0.6, 'rgba(255,140,50,0.85)');
    ell(ctx, px, py, rad * 0.45, rad * 0.3, 'rgba(255,214,90,0.9)');
  }
  drawRimStones(ctx, ox, oy, stones, true);
}

function craterSlag(ctx, ox, oy, rng) {
  const [sx, sy] = iso(ox + 0.5, oy + 0.5);
  const stones = rimStones(rng, 6, 1, [GLASS]);
  const c = craterBase(ctx, sx, sy, rng, { rim: ['#241d19', '#3a302a'], lip: '#7a6c64' });
  ctx.beginPath();
  c.pit.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,110,40,0.3)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,170,70,0.85)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  drawRimStones(ctx, ox, oy, stones, false);
  for (let i = 0; i < 5; i++) {
    const p = c.top[(i * 3 + 1) % c.top.length];
    const q = [lerp(p[0], sx, 0.12), lerp(p[1], sy, 0.12)];
    ell(ctx, q[0], q[1], 4.2, 2.6, '#2b2420', INK, 1.4);
    ell(ctx, q[0] - 1.2, q[1] - 0.8, 1.6, 0.9, '#9a8d86', null);
  }
  drawRimStones(ctx, ox, oy, stones, true);
}

function craterWreck(ctx, ox, oy, rng) {
  const [sx, sy] = iso(ox + 0.5, oy + 0.5);
  const stones = rimStones(rng, 5);
  craterBase(ctx, sx, sy, rng);
  drawRimStones(ctx, ox, oy, stones, false);
  const a = [sx - 21, sy + 4];
  const b = [sx + 9, sy - 9];
  seg(ctx, a, b, 7, C.steel, C.steelL);
  ell(ctx, a[0], a[1], 3, 4, '#1a1410', INK, 1.2);
  ctx.beginPath();
  ctx.moveTo(sx - 8, sy - 5);
  ctx.lineTo(sx - 8, sy + 1);
  ctx.moveTo(sx + 1, sy - 8.5);
  ctx.lineTo(sx + 1, sy - 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  drawRimStones(ctx, ox, oy, stones, true);
  const p = plate(ctx, [[ox + 0.6, oy + 0.72, 3], [ox + 0.9, oy + 0.6, 11], [ox + 0.96, oy + 0.84, 11], [ox + 0.66, oy + 0.94, 3]], PLATE[0], PLATE[2], 2);
  ell(ctx, (p[0][0] + p[2][0]) / 2 - 1, (p[0][1] + p[2][1]) / 2, 3, 1.8, C.rust, null);
  ell(ctx, (p[0][0] + p[2][0]) / 2 + 6, (p[0][1] + p[2][1]) / 2 - 2, 1.8, 1.1, C.rustD, null);
}

function craterDouble(ctx, ox, oy, rng) {
  const [sx, sy] = iso(ox + 0.5, oy + 0.5);
  craterBase(ctx, sx - 12, sy - 3, rng, { r: 0.64 });
  box(ctx, ox + 0.5 - 0.06, oy + 0.5 - 0.5, 0.12, 0.12, 6, 0, CONC, 1.6);
  craterBase(ctx, sx + 13, sy + 3, rng, { r: 0.66 });
  box(ctx, ox + 0.5 + 0.4, oy + 0.5 + 0.28, 0.14, 0.12, 7, 0, STONE, 1.6);
  box(ctx, ox + 0.5 - 0.36, oy + 0.5 + 0.16, 0.12, 0.14, 5, 0, CONC, 1.6);
}

function craterWater(ctx, ox, oy, rng) {
  const [sx, sy] = iso(ox + 0.5, oy + 0.5);
  craterBase(ctx, sx, sy, rng, { r: 0.98, water: true, lift: 1, rim: ['#43372c', '#665643'], lip: '#9a8466' });
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(170,195,200,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(sx - 3, sy - 3, 12, 5, 0, 3.4, 4.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(sx - 3, sy - 3, 7, 3, 0, 3.5, 4.4);
  ctx.stroke();
  ell(ctx, sx + 8, sy + 1.5, 5, 2, null, 'rgba(170,195,200,0.4)', 1.2);
  box(ctx, ox + 0.12, oy + 0.62, 0.12, 0.1, 4, 1, CONC, 1.6);
  box(ctx, ox + 0.8, oy + 0.3, 0.1, 0.12, 3, 1, STONE, 1.6);
}

function craterBones(ctx, ox, oy, rng) {
  const [sx, sy] = iso(ox + 0.5, oy + 0.5);
  const stones = rimStones(rng, 5);
  craterBase(ctx, sx, sy, rng);
  drawRimStones(ctx, ox, oy, stones, false);
  boneBar(ctx, [sx - 8, sy - 3], [sx + 1, sy - 5]);
  boneBar(ctx, [sx - 7, sy + 0.5], [sx + 4, sy - 2.5]);
  boneBar(ctx, [sx - 5, sy + 3.5], [sx + 6, sy + 0.5]);
  drawRimStones(ctx, ox, oy, stones, true);
  boneBar(ctx, [sx - 25, sy + 5], [sx - 14, sy + 10]);
  skull(ctx, sx + 14, sy + 7);
}

function craterShards(ctx, ox, oy, rng) {
  const [sx, sy] = iso(ox + 0.5, oy + 0.5);
  const cols = [C.steelD, C.rustD, C.concD, C.steel];
  const shards = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const len = rng.range(8, 16);
    const bx = sx + Math.cos(a) * 31;
    const by = sy + Math.sin(a) * 15.5;
    const tx = bx + Math.cos(a) * len * 1.3;
    const ty = by + Math.sin(a) * len * 0.65 - rng.range(0, 3);
    shards.push({ a, bx, by, tx, ty, col: cols[i % 4], front: Math.sin(a) > 0 });
  }
  const drawShard = (s) => poly(ctx, [[s.bx + 1, s.by - 2.4], [s.bx - 1, s.by + 2.4], [s.tx, s.ty]], s.col, INK, 1.5);
  for (const s of shards) if (!s.front) drawShard(s);
  craterBase(ctx, sx, sy, rng);
  for (const s of shards) if (s.front) drawShard(s);
  for (const [dx, dy, l] of [[-14, 8, 11], [10, 9, 9], [18, -4, 8]]) {
    seg(ctx, [sx + dx, sy + dy], [sx + dx + 2, sy + dy - l], 2.6, C.steel, C.steelL);
  }
}

function craterToxic(ctx, ox, oy, rng) {
  const [sx, sy] = iso(ox + 0.5, oy + 0.5);
  const stones = rimStones(rng, 5);
  craterBase(ctx, sx, sy, rng);
  drawRimStones(ctx, ox, oy, stones, false);
  ell(ctx, sx, sy + 0.5, 11, 5, 'rgba(95,138,42,0.93)', INK, 1.4);
  ell(ctx, sx - 3, sy - 0.5, 4.5, 1.5, 'rgba(200,236,122,0.75)');
  ell(ctx, sx + 5, sy + 1.5, 1.9, 1.4, C.toxicL, INK, 1);
  ell(ctx, sx - 6, sy + 2.5, 1.3, 1, C.toxicL, INK, 1);
  drawRimStones(ctx, ox, oy, stones, true);
  ell(ctx, sx - 21, sy + 5, 5, 2, 'rgba(95,138,42,0.55)');
}

const CRATERS = [
  { name: 'Glutreste', draw: craterEmbers },
  { name: 'Geschmolzener Rand', draw: craterSlag },
  { name: 'Wrackteil', draw: craterWreck },
  { name: 'Doppelkrater', draw: craterDouble },
  { name: 'Alter Wasserkrater', draw: craterWater },
  { name: 'Knochenkrater', draw: craterBones },
  { name: 'Splitterkranz', draw: craterShards },
  { name: 'Giftpfütze', draw: craterToxic },
];

// ---------- Capsule remains ----------
// Kit: heat shield (in every variant, the sign that tells it from other rubble),
// segment flaps with hinge bolt, core stump with its dead red band, roof disc
// with brake nozzles, bent struts, cables, warning-band pieces (burnt, not
// yellow: yellow belongs to the bulwark), soot ring. All lie within one cell
// and stay below 16 px.

const SHIELD = ['#4a4038', '#342d27', '#221d19'];
const CORE = ['#413d39', '#4a4642', '#2e2b28'];
const SH = 3;

function heatShield(ctx, ox, oy, rng, o = {}) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  const [sx, sy] = iso(cx, cy);
  const k = o.soot ?? 1;
  ell(ctx, sx, sy + 1, 45.25 * 0.6 * k, 22.63 * 0.6 * k, 'rgba(10,6,4,0.24)');
  ell(ctx, sx + 2, sy + 4, 45.25 * 0.5, 22.63 * 0.5, 'rgba(10,6,4,0.28)');
  gcyl(ctx, cx, cy, 0, 0.5, SH, SHIELD);
  const rx = 45.25 * 0.5;
  const ry = 22.63 * 0.5;
  const ty = sy - SH;
  ell(ctx, sx, ty, rx * 0.8, ry * 0.8, null, 'rgba(10,6,4,0.55)', 2.4);
  ell(ctx, sx, ty, rx * 0.56, ry * 0.56, null, 'rgba(10,6,4,0.4)', 2);
  ctx.beginPath();
  ctx.ellipse(sx, ty, rx * 0.94, ry * 0.94, 0, 0.25, Math.PI - 0.25);
  ctx.strokeStyle = '#6a5c4c';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const a = 0.3 + (i / 8) * (Math.PI - 0.6);
    ell(ctx, sx + Math.cos(a) * rx * 0.86, ty + Math.sin(a) * ry * 0.86, 1.2, 0.8, '#7d776e', null);
  }
  for (let i = 0; i < (o.cracks ?? 2); i++) {
    const p = [sx + rng.range(-rx * 0.7, rx * 0.7), ty + rng.range(-ry * 0.5, ry * 0.5)];
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(p[0] + rng.range(4, 9), p[1] + rng.range(-1, 2));
    ctx.lineTo(p[0] + rng.range(9, 15), p[1] + rng.range(-3, 3));
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
}

/** Short body with the dead red band; h is its height above z. */
function coreStump(ctx, cx, cy, z, h, rng, r = 0.2) {
  gcyl(ctx, cx, cy, z, r, h, CORE, { bands: [{ z0: Math.min(2, h * 0.3), z1: Math.max(h - 2, h * 0.7), col: '#7a1616', colD: '#561010' }], rng, broken: h < 6 ? 1.6 : 0 });
  const [sx, sy] = iso(cx, cy, z + h);
  ell(ctx, sx, sy, 45.25 * r * 0.5, 22.63 * r * 0.5, '#1a1410', null);
}

function roofDisc(ctx, gx, gy, z, rot, k = 1) {
  const [sx, sy] = iso(gx, gy, z);
  const rx = 45.25 * 0.27 * k;
  const ry = 22.63 * 0.27 * k;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(rot);
  ell(ctx, 0, 2.6, rx, ry, '#2e2b28', INK, 2);
  ell(ctx, 0, 0, rx, ry, '#6f6a63', INK, 2);
  for (const [nx, ny] of [[-rx * 0.45, -0.5], [rx * 0.35, -ry * 0.45], [rx * 0.1, ry * 0.5]]) {
    ell(ctx, nx, ny + 1.1, 2.7, 1.5, '#2e2b28', null);
    ell(ctx, nx, ny, 2.7, 1.5, '#a8a195', INK, 1.1);
    ell(ctx, nx, ny, 1.3, 0.7, INK, null);
  }
  ctx.restore();
}

function flap(ctx, cx, cy, th, rng, o = {}) {
  const { ri = 0.22, ro = 0.47, wi = 0.2, wo = 0.36, zi = SH + 0.5, zo = SH + 0.5, broken = false } = o;
  const dx = Math.cos(th);
  const dy = Math.sin(th);
  const P = (r, w, z) => [cx + dx * r - dy * w, cy + dy * r + dx * w, z];
  const pts = [P(ri, -wi / 2, zi)];
  if (broken) {
    for (let j = 0; j <= 4; j++) pts.push(P(ro - rng.range(0, 0.2), lerp(-wo / 2, wo / 2, j / 4), zo));
  } else {
    pts.push(P(ro - 0.07, -wo / 2, zo), P(ro, -wo / 2 + 0.07, zo), P(ro, wo / 2 - 0.07, zo), P(ro - 0.07, wo / 2, zo));
  }
  pts.push(P(ri, wi / 2, zi));
  const p = plate(ctx, pts, PLATE[0], PLATE[2], 2.4);
  const a = iso(...P(ri + 0.04, 0, zi));
  const b = iso(...P(broken ? ro - 0.12 : ro - 0.05, 0, zo));
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = 'rgba(26,20,16,0.4)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const h = iso(...P(ri + 0.11, 0, zi + (zo - zi) * 0.2));
  ell(ctx, h[0], h[1], 2.6, 1.6, '#a8a195', INK, 1.2);
  return p;
}

function warnPiece(ctx, gx, gy, z, th, len = 0.3, wid = 0.1) {
  const dx = Math.cos(th);
  const dy = Math.sin(th);
  const P = (a, b) => [gx + dx * a - dy * b, gy + dy * a + dx * b, z];
  const p = plate(ctx, [P(-len / 2, -wid / 2), P(len / 2, -wid / 2), P(len / 2 + 0.03, wid / 2), P(-len / 2, wid / 2)], '#2a2622', '#1d1a17', 2);
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  ctx.save();
  ctx.beginPath();
  p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = '#8a3d1c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = Math.min(...xs) - 12; x < Math.max(...xs) + 12; x += 6) {
    ctx.moveTo(x, Math.max(...ys) + 4);
    ctx.lineTo(x + 10, Math.min(...ys) - 4);
  }
  ctx.stroke();
  ctx.restore();
  poly(ctx, p, null, INK, 1.8);
}

function strut(ctx, pts3, w = 3.2) {
  bar(ctx, pts3.map(([gx, gy, gz]) => iso(gx, gy, gz)), w, C.steel, C.steelL);
}
function cable(ctx, a3, b3, bend = [0, 8]) {
  const a = iso(...a3);
  const b = iso(...b3);
  const m = [(a[0] + b[0]) / 2 + bend[0], (a[1] + b[1]) / 2 + bend[1]];
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]);
  };
  ctx.lineCap = 'round';
  path();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.6;
  ctx.stroke();
  path();
  ctx.strokeStyle = '#6a5a48';
  ctx.lineWidth = 1.7;
  ctx.stroke();
  ell(ctx, b[0], b[1], 1.7, 1.2, C.rustL, INK, 1);
}

function capFresh(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  cellShadow(ctx, ox, oy, 28, 11, 0.28, 4, 3);
  heatShield(ctx, ox, oy, rng);
  flap(ctx, cx, cy, Math.PI, rng);
  flap(ctx, cx, cy, Math.PI * 1.5, rng);
  coreStump(ctx, cx, cy, SH, 7, rng);
  roofDisc(ctx, cx + 0.02, cy - 0.02, SH + 9.5, -0.2);
  flap(ctx, cx, cy, 0, rng);
  flap(ctx, cx, cy, Math.PI * 0.5, rng, { broken: true });
}

function capRoofOff(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  cellShadow(ctx, ox, oy, 28, 11, 0.28, 4, 3);
  heatShield(ctx, ox, oy, rng, { cracks: 3 });
  flap(ctx, cx, cy, Math.PI, rng);
  flap(ctx, cx, cy, Math.PI * 1.5, rng, { broken: true });
  coreStump(ctx, cx, cy, SH, 7, rng);
  cable(ctx, [cx + 0.05, cy + 0.02, SH + 6], [cx + 0.32, cy + 0.2, SH + 2], [4, 6]);
  flap(ctx, cx, cy, 0, rng);
  roofDisc(ctx, cx + 0.2, cy + 0.12, SH + 2.5, 0.55);
}

function capStruts(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  cellShadow(ctx, ox, oy, 28, 11, 0.28, 4, 3);
  heatShield(ctx, ox, oy, rng);
  flap(ctx, cx, cy, Math.PI * 1.5, rng);
  coreStump(ctx, cx, cy, SH, 7, rng);
  strut(ctx, [[cx - 0.06, cy + 0.08, SH + 1], [cx - 0.22, cy + 0.3, SH + 1], [cx - 0.3, cy + 0.4, SH + 6]]);
  strut(ctx, [[cx + 0.06, cy + 0.1, SH + 1], [cx + 0.26, cy + 0.22, SH + 1], [cx + 0.36, cy + 0.1, SH + 7]]);
  flap(ctx, cx, cy, 0, rng, { broken: true, ri: 0.3 });
}

function capLeaning(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  cellShadow(ctx, ox, oy, 28, 11, 0.28, 4, 3);
  heatShield(ctx, ox, oy, rng);
  flap(ctx, cx, cy, Math.PI, rng, { broken: true, ri: 0.3 });
  coreStump(ctx, cx, cy, SH, 6, rng);
  warnPiece(ctx, cx + 0.3, cy - 0.12, SH + 0.8, 0.5);
  flap(ctx, cx, cy, Math.PI * 0.5, rng, { ri: 0.2, ro: 0.46, zi: SH + 10, zo: SH + 0.5 });
}

function capRoofDown(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  cellShadow(ctx, ox, oy, 28, 11, 0.28, 4, 3);
  heatShield(ctx, ox, oy, rng, { cracks: 3 });
  coreStump(ctx, cx - 0.2, cy - 0.14, SH, 4.5, rng, 0.15);
  strut(ctx, [[cx - 0.3, cy + 0.34, SH + 1], [cx + 0.02, cy + 0.38, SH + 1], [cx + 0.14, cy + 0.3, SH + 4]], 2.8);
  roofDisc(ctx, cx + 0.1, cy + 0.06, SH + 3, 0.12, 1.12);
}

function capCables(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  cellShadow(ctx, ox, oy, 28, 11, 0.28, 4, 3);
  heatShield(ctx, ox, oy, rng, { soot: 1.12 });
  flap(ctx, cx, cy, Math.PI * 1.5, rng, { broken: true, ri: 0.3, ro: 0.45 });
  cable(ctx, [cx - 0.05, cy - 0.1, SH + 6], [cx - 0.4, cy - 0.12, SH + 0.5], [-4, 7]);
  coreStump(ctx, cx, cy, SH, 7, rng);
  cable(ctx, [cx + 0.1, cy + 0.0, SH + 6], [cx + 0.44, cy + 0.06, SH + 0.5], [4, 9]);
  cable(ctx, [cx + 0.0, cy + 0.12, SH + 6], [cx + 0.1, cy + 0.44, SH + 0.5], [-6, 6]);
  cable(ctx, [cx - 0.1, cy + 0.1, SH + 5], [cx - 0.38, cy + 0.34, SH + 0.5], [-5, 8]);
}

function capBands(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  cellShadow(ctx, ox, oy, 28, 11, 0.28, 4, 3);
  heatShield(ctx, ox, oy, rng);
  const [sx, sy] = iso(cx, cy, SH);
  ell(ctx, sx, sy, 45.25 * 0.2, 22.63 * 0.2, null, 'rgba(10,6,4,0.7)', 2.6);
  flap(ctx, cx, cy, Math.PI * 1.5, rng, { broken: true, ri: 0.32 });
  strut(ctx, [[cx - 0.32, cy + 0.14, SH + 1], [cx - 0.04, cy + 0.04, SH + 1], [cx + 0.3, cy + 0.12, SH + 5]]);
  warnPiece(ctx, cx + 0.12, cy - 0.16, SH + 0.8, 2.2);
  strut(ctx, [[cx - 0.2, cy + 0.34, SH + 1], [cx + 0.1, cy + 0.26, SH + 3], [cx + 0.3, cy + 0.38, SH + 1]], 2.8);
  warnPiece(ctx, cx - 0.05, cy + 0.2, SH + 1.2, 0.6, 0.34, 0.11);
}

function capStripped(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  cellShadow(ctx, ox, oy, 28, 11, 0.28, 4, 3);
  heatShield(ctx, ox, oy, rng, { cracks: 3, soot: 1.15 });
  const holes = [[-0.3, 0.1], [0.22, -0.22], [-0.05, 0.36]];
  for (const [dx, dy] of holes) {
    const [hx, hy] = iso(cx + dx, cy + dy, SH);
    ell(ctx, hx, hy, 2.4, 1.3, '#0f0c0a', INK, 1);
  }
  coreStump(ctx, cx, cy, SH, 3.4, rng, 0.2);
  const [bx, by] = iso(cx + 0.3, cy + 0.2, SH);
  ell(ctx, bx, by, 2.8, 1.7, '#a8a195', INK, 1.2);
}

const CAPSULE_REMAINS = [
  { name: 'Frisch gefallen', draw: capFresh },
  { name: 'Dach abgehoben', draw: capRoofOff },
  { name: 'Kern und Streben', draw: capStruts },
  { name: 'Gestützte Klappe', draw: capLeaning },
  { name: 'Dachscheibe', draw: capRoofDown },
  { name: 'Kern und Kabel', draw: capCables },
  { name: 'Streben und Bänder', draw: capBands },
  { name: 'Ausgeschlachtet', draw: capStripped },
];

/** The kit's entry point, shaped like the game's drawObstacleCell: one obstacle, one of its cells. */
function drawNewCell(ctx, ob, index) {
  const { x, y } = ob.cells[index];
  const v = ob.variant;
  if (ob.kind === 'wall') return drawNewWallCell(ctx, ob, index);
  const list = ob.kind === 'ruin' ? RUINS : ob.kind === 'crater' ? CRATERS : CAPSULE_REMAINS;
  if (ob.kind !== 'rubble') return list[v % list.length].draw(ctx, x, y, rngFor(ob.kind, v));
  // The remains are drawn flat and low; scaled up about the cell centre so that the
  // heat shield stays readable at the smallest zoom. Heights stay under 16 px.
  const [sx, sy] = iso(x + 0.5, y + 0.5);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(1.18, 1.18);
  ctx.translate(-sx, -sy);
  list[v % list.length].draw(ctx, x, y, rngFor(ob.kind, v));
  ctx.restore();
}
// ---------- Sheet layout ----------

const SHEET_SIZE = 46;
const SCENE_SIZE = 8;

/**
 * The sheet is laid out along the screen axes: a column step is (+2, -2) cells,
 * which is 128 px to the right on screen, a row step is (+3, +3) cells, 96 px
 * down. Slots 0 to 3 are today's variants, slot 4 is left for the bulwark in the
 * rubble row, slots 5 to 12 are the kit's eight variants.
 */
const slot = (row, c) => ({ x: 1 + 3 * row + 2 * c, y: 27 + 3 * row - 2 * c });

/** Items of the sheet: one figure (or wall run) each, with the cells it covers and where its name goes. */
function buildSheet(vertical) {
  const items = [];
  const heads = [];
  const head = (row, key, title) => {
    const p = slot(row, -1.3);
    heads.push({ key, title, x: p.x + 0.5, y: p.y + 0.5 });
  };
  const put = (row, key, kind, set, variant, c, name) => {
    const p = slot(row, c);
    let cells = [{ x: p.x, y: p.y }];
    let label = [p.x + 0.5, p.y + 1.7];
    if (kind === 'wall') {
      cells = [0, 1, 2].map((k) => (vertical ? { x: p.x, y: p.y + k } : { x: p.x + k, y: p.y }));
      label = vertical ? [p.x + 0.5, p.y + 3.7] : [p.x + 1.5, p.y + 1.7];
    }
    items.push({ row: key, kind, set, variant, cells, name, label });
  };
  const fill = (row, key, title, kind, list) => {
    head(row, key, title);
    for (let i = 0; i < 4; i++) put(row, key, kind, 'today', i, i, `Heute ${i + 1}`);
    for (let i = 0; i < 8; i++) put(row, key, kind, 'new', i, 5 + i, list[i].name);
  };
  fill(0, 'ruin', 'RUINE', 'ruin', RUINS);
  fill(1, 'wall', 'MAUER', 'wall', WALL_RUNS);
  fill(2, 'crater', 'KRATER', 'crater', CRATERS);
  fill(3, 'rubble', 'KAPSEL-TRÜMMER', 'rubble', CAPSULE_REMAINS);
  put(3, 'rubble', 'bulwark', 'today', 0, 4, 'Bollwerk');
  // The bulwark next to the remains it could be mistaken for: remains, bulwark, remains, ...
  head(4, 'compare', 'BOLLWERK');
  [0, 2, 5, 7].forEach((v, k) => {
    put(4, 'compare', 'rubble', 'new', v, 5 + 2 * k, CAPSULE_REMAINS[v].name);
    put(4, 'compare', 'bulwark', 'today', 0, 6 + 2 * k, 'Bollwerk');
  });
  return { items, heads };
}

function boxOf(items, pad = 0) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const it of items) {
    for (const c of it.cells) {
      for (const [gx, gy] of [[c.x, c.y], [c.x + 1, c.y], [c.x, c.y + 1], [c.x + 1, c.y + 1]]) {
        const [sx, sy] = iso(gx, gy);
        x0 = Math.min(x0, sx);
        x1 = Math.max(x1, sx);
        y0 = Math.min(y0, sy - 70);
        y1 = Math.max(y1, sy + 34);
      }
    }
  }
  return { x0: x0 - pad, x1: x1 + pad, y0: y0 - pad, y1: y1 + pad };
}

// ---------- Scene ----------

// Single cells with their variant "today" and in the kit; two rubble groups, one wall.
const SCENE_OBJECTS = [
  { kind: 'ruin', cells: [{ x: 1, y: 1 }], today: 0, neu: 2 },
  { kind: 'ruin', cells: [{ x: 6, y: 5 }], today: 2, neu: 3 },
  { kind: 'wall', cells: [{ x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }], today: 1, neu: 1 },
  { kind: 'crater', cells: [{ x: 5, y: 1 }], today: 0, neu: 0 },
  { kind: 'crater', cells: [{ x: 1, y: 6 }], today: 1, neu: 4 },
  { kind: 'rubble', cells: [{ x: 6, y: 2 }], today: 0, neu: 0 },
  { kind: 'rubble', cells: [{ x: 6, y: 3 }], today: 1, neu: 5 },
  { kind: 'rubble', cells: [{ x: 3, y: 6 }], today: 2, neu: 3 },
  { kind: 'rubble', cells: [{ x: 4, y: 6 }], today: 3, neu: 7 },
  { kind: 'bulwark', cells: [{ x: 5, y: 6 }], today: 0, neu: 0 },
];
const SCENE_TOWERS = [
  { x: 3, y: 2, doctrine: DOCTRINE_IDS[0], rank: 2, flash: 0 },
  { x: 5, y: 4, doctrine: DOCTRINE_IDS[3], rank: 3, flash: 0 },
];
const SCENE_BEACON = { x: 0, y: 3 };

// ---------- State, camera, drawing ----------

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
installPageGuards(canvas);

const state = { mode: 'sheet', scene: 'new', names: true, grid: false, silhouette: false, vertical: false };
let sheet = buildSheet(state.vertical);
const camera = createCamera();
const limits = { ...CAMERA, minZoom: 0.25, maxZoom: 3, minCellPx: 0 };
const cache = createSpriteCache();
const ground = createGroundLayer();
let dirtyUntil = 0;
const invalidate = () => {
  dirtyUntil = performance.now() + 600;
};

const sizeNow = () => (state.mode === 'scene' ? SCENE_SIZE : SHEET_SIZE);
const contentBox = () => {
  if (state.mode === 'scene') return { x0: -280, x1: 280, y0: -110, y1: 300 };
  const b = boxOf(sheet.items, 60);
  return { ...b, x0: b.x0 - 210 };
};
function fit(box = contentBox()) {
  fitCamera(camera, view, box, { top: 70, bottom: 84, side: 16 }, limits);
  clampCamera(camera, mapBounds(sizeNow()), limits);
  invalidate();
}
let view = null;
view = createCanvasView(canvas, (v) => {
  view = v;
  fit();
});

function sheetEntries() {
  const out = [];
  for (const it of sheet.items) {
    const ob = { kind: it.kind, variant: it.variant, cells: it.cells };
    it.cells.forEach((c, i) => out.push({ key: c.x + c.y, draw: () => (it.set === 'new' ? drawNewCell(ctx, ob, i) : drawObstacleCell(ctx, ob, i)) }));
  }
  return out;
}
function sceneEntries(t) {
  const out = [];
  for (const o of SCENE_OBJECTS) {
    const ob = { kind: o.kind, variant: state.scene === 'new' ? o.neu : o.today, cells: o.cells };
    const useKit = state.scene === 'new' && o.kind !== 'bulwark';
    o.cells.forEach((c, i) => out.push({ key: c.x + c.y, draw: () => (useKit ? drawNewCell(ctx, ob, i) : drawObstacleCell(ctx, ob, i)) }));
  }
  for (const tw of SCENE_TOWERS) out.push({ key: tw.x + tw.y, draw: () => drawTowerSprite(ctx, cache, tw, camera.zoom, view.dpr, t, 0) });
  out.push({ key: SCENE_BEACON.x + SCENE_BEACON.y, draw: () => drawBeacon(ctx, SCENE_BEACON, t) });
  return out;
}

function drawGrid(size) {
  ctx.beginPath();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = iso(x, y);
      const b = iso(x + 1, y);
      const c = iso(x + 1, y + 1);
      const d = iso(x, y + 1);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.closePath();
    }
  }
  ctx.strokeStyle = 'rgba(232,220,192,0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function frame(now) {
  requestAnimationFrame(frame);
  if ((state.mode === 'sheet' || state.silhouette) && now > dirtyUntil) return;
  const t = now / 1000;
  const size = sizeNow();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = C.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ground.draw(ctx, camera, view, size, state.mode === 'scene' ? 'SZENE' : 'TRUEMMER', now);
  applyCamera(ctx, camera, view);
  if (state.grid) drawGrid(size);

  const entries = state.mode === 'scene' ? sceneEntries(t) : sheetEntries();
  entries.sort((a, b) => a.key - b.key);
  if (state.silhouette) ctx.filter = 'brightness(0)';
  for (const e of entries) e.draw();
  ctx.filter = 'none';

  if (state.mode === 'sheet') {
    for (const h of sheet.heads) {
      const [x, y] = iso(h.x, h.y);
      comicText(ctx, h.title, x, y, 20, C.gold);
    }
    comicText(ctx, 'HEUTE IM SPIEL', ...iso(slot(0, 1.5).x + 0.5, slot(0, 1.5).y + 0.5, 84), 20, C.gold);
    comicText(ctx, 'ENTWÜRFE AUS DEM BAUKASTEN', ...iso(slot(0, 8.5).x + 0.5, slot(0, 8.5).y + 0.5, 84), 20, C.gold);
    if (state.names) {
      for (const it of sheet.items) {
        const [x, y] = iso(it.label[0], it.label[1]);
        comicText(ctx, it.name, x, y, 13, C.bone);
      }
    }
  }
}

// ---------- HUD ----------

const hudBar = document.getElementById('bar');
const btn = (id) => document.getElementById(id);
const toggle = (id, key, after) => {
  btn(id).addEventListener('click', () => {
    state[key] = !state[key];
    btn(id).classList.toggle('on', state[key]);
    after?.();
    invalidate();
  });
};
const setZoom = (z) => {
  zoomAt(camera, view, z / camera.zoom, view.width / 2, view.height / 2, limits);
  clampCamera(camera, mapBounds(sizeNow()), limits);
  invalidate();
};
function applyMode() {
  const scene = state.mode === 'scene';
  btn('mode-sheet').classList.toggle('on', !scene);
  btn('mode-scene').classList.toggle('on', scene);
  for (const el of hudBar.querySelectorAll('[data-for]')) el.hidden = el.dataset.for !== state.mode;
  fit();
}
btn('mode-sheet').addEventListener('click', () => {
  state.mode = 'sheet';
  applyMode();
});
btn('mode-scene').addEventListener('click', () => {
  state.mode = 'scene';
  applyMode();
});
toggle('names', 'names');
toggle('grid', 'grid');
toggle('silhouette', 'silhouette');
toggle('vertical', 'vertical', () => {
  sheet = buildSheet(state.vertical);
  fit();
});
btn('scene-today').addEventListener('click', () => {
  state.scene = 'today';
  btn('scene-today').classList.add('on');
  btn('scene-new').classList.remove('on');
  invalidate();
});
btn('scene-new').addEventListener('click', () => {
  state.scene = 'new';
  btn('scene-new').classList.add('on');
  btn('scene-today').classList.remove('on');
  invalidate();
});
for (const [id, z] of [["zoom-05", 0.5], ["zoom-1", 1], ["zoom-2", 2]]) btn(id).addEventListener('click', () => setZoom(z));
btn('fit').addEventListener('click', () => fit());
btn('reroll').addEventListener('click', () => {
  reroll += 1;
  invalidate();
});
btn('names').classList.add('on');
btn('scene-new').classList.add('on');
btn('mode-sheet').classList.add('on');
for (const el of hudBar.querySelectorAll('[data-for]')) el.hidden = el.dataset.for !== state.mode;

attachPointerInput(canvas, {
  onPan(dx, dy) {
    panBy(camera, dx, dy);
    clampCamera(camera, mapBounds(sizeNow()), limits);
    invalidate();
  },
  onZoom(f, x, y) {
    zoomAt(camera, view, f, x, y, limits);
    clampCamera(camera, mapBounds(sizeNow()), limits);
    invalidate();
  },
});

document.fonts?.ready.then(invalidate);

/** Hooks for the screenshot script: frame a group of figures. */
window.__truemmer = {
  state: () => ({ ...state, reroll, zoom: camera.zoom }),
  /** Frames the figures of one set ('today' or 'new'), one row and a range of variants. */
  focus(set = null, row = null, from = 0, to = 99) {
    const sel = sheet.items.filter((it) => (!set || it.set === set) && (!row || row.split(',').includes(it.row)) && it.variant >= from && it.variant <= to && !(set && it.kind === 'bulwark' && set === 'new'));
    fit(boxOf(sel, 50));
  },
  rows: () => sheet.heads.map((h) => h.key),
};

cache.preload(allTowerDefs(), 1, view.dpr).then(() => {
  document.body.dataset.ready = 'true';
});
invalidate();
requestAnimationFrame(frame);
