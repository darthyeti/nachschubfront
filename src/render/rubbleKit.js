// Rubble kit (M8 C5): ruins, walls, craters and capsule remains from a small set of parts.
//
// Ported from reference/studien/truemmer-studie.js (the diamond-filling version; the round
// one is not part of the game). Every obstacle cell gets one of eight kit variants per kind,
// chosen from its field position and the simulation's `variant` (0 to 3), so neighbours look
// different and the same seed always gives the same picture. Details (chips, stones, jags)
// come from a seeded stream per cell, never from Math.random. Presentation only: nothing
// here touches a game stream, and `variant` stays as the map generator draws it.
//
// Craters and capsule remains fill the diamond of their field and throw no (crater) or a
// flat (capsule) shadow; ruins and walls stand on a slab or a footing and throw the shadow
// of their tallest bodies (`kitShadow`).

import { iso } from './iso.js';
import { rectCorners } from './shadows.js';
import { shade } from './biomes.js';
import { poly, box, ell } from './draw.js';
import { C } from './palette.js';
import { seedFromString, createRng } from '../core/random.js';

const INK = C.ink;
const MORTAR = 'rgba(26,20,16,0.36)';
const SOOT = 'rgba(18,12,9,0.42)';
const CONC = [C.concL, C.conc, C.concD];
const BRICK = C.brick;
const SLAB = ['#80735f', '#5f5446', '#433a31'];
const WOOD = ['#8a6a4a', '#6b4f36', '#4a3626'];
// The capsule's own plates (reference/konzept/kapsel/kapsel-geoeffnet.svg).
const PLATE = ['#8b857c', '#6f6a63', '#4a4642'];
/** Boxes stand in the scene's light (foot shade, bright edge). */
const LIT = { lit: true };
const lerp = (a, b, t) => a + (b - a) * t;

/** Biome stone and pit colour of the cell being drawn; set by `drawKitCell` and read by the parts. */
let STONE = C.stone;
let PIT = '#1c1511';

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
  for (const it of items) box(ctx, it.x - it.w / 2, it.y - it.dd / 2, it.w, it.dd, it.h, z, it.pal, 1.6, LIT);
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
// ---------- Ruins: eight compositions from the kit ----------

/** Straight wall piece along an axis; the front face is fF for 'x' and fR for 'y'. */
function ruinWall(ctx, rng, { axis, x, y, len, thick, z = 5, h0, h1, pal = STONE, jag = 3, amp = 6, mortar = 6 }) {
  const c = axis === 'x'
    ? chunk(ctx, x, y, len, thick, z, [h0, h1, h1, h0], pal, { rng, jag, amp, mortar })
    : chunk(ctx, x, y, thick, len, z, [h0, h0, h1, h1], pal, { rng, jag, amp, mortar });
  return { front: axis === 'x' ? c.fF : c.fR, ...c };
}

function ruinChapel(ctx, ox, oy, rng) {
  chippedSlab(ctx, ox, oy, rng);
  const back = ruinWall(ctx, rng, { axis: 'x', x: ox + 0.1, y: oy + 0.1, len: 0.8, thick: 0.2, h0: 38 + rng.int(0, 3), h1: 26 });
  archWindow(ctx, back.front, 0.3, 0.6, 8, 19, 8);
  sootTongue(ctx, back.front, 0.28, 0.62, 20, 30, rng);
  const side = ruinWall(ctx, rng, { axis: 'y', x: ox + 0.1, y: oy + 0.3, len: 0.5, thick: 0.2, h0: 30, h1: 12, jag: 2 });
  archWindow(ctx, side.front, 0.22, 0.52, 7, 14, 6);
  heap(ctx, rng, ox + 0.68, oy + 0.7, 0.2, 7, [BRICK, STONE], 9, 5);
}

function ruinTower(ctx, ox, oy, rng) {
  chippedSlab(ctx, ox, oy, rng);
  const t = chunk(ctx, ox + 0.2, oy + 0.18, 0.6, 0.6, 5, [46, 42, 34, 40], STONE, { rng, jag: 4, amp: 8, mortar: 6 });
  gate(ctx, t.fF, 0.34, 0.66, 0, 13);
  archWindow(ctx, t.fR, 0.38, 0.58, 20, 28, 6);
  sootTongue(ctx, t.fR, 0.3, 0.7, 29, 38, rng);
  heap(ctx, rng, ox + 0.22, oy + 0.82, 0.15, 6, [BRICK, STONE], 9, 5);
  chunk(ctx, ox + 0.68, oy + 0.7, 0.22, 0.22, 5, [13, 11, 6, 10], BRICK, { rng, jag: 1, amp: 3, mortar: 4 });
}

function ruinCorner(ctx, ox, oy, rng) {
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
  chippedSlab(ctx, ox, oy, rng, 4, ['#7a6f60', '#5a5044', '#40372f']);
  const big = chunk(ctx, ox + 0.1, oy + 0.18, 0.46, 0.58, 4, [32, 28, 12, 20], CONC, { rng, jag: 3, amp: 6, mortar: 11 });
  poly(ctx, [big.fF(0.12, 4), big.fF(0.5, 6), big.fF(0.62, 15), big.fF(0.38, 18), big.fF(0.26, 12), big.fF(0.1, 14)], PIT, INK, 2);
  rebar(ctx, ox + 0.3, oy + 0.22, 4 + 30, rng, 4, 0.12);
  chunk(ctx, ox + 0.58, oy + 0.46, 0.34, 0.4, 4, [15, 11, 5, 9], CONC, { rng, jag: 2, amp: 4, mortar: 11 });
  rebar(ctx, ox + 0.76, oy + 0.54, 4 + 11, rng, 3, 0.08);
  heap(ctx, rng, ox + 0.3, oy + 0.88, 0.1, 4, [CONC], 5, 4);
}

function ruinArch(ctx, ox, oy, rng) {
  chippedSlab(ctx, ox, oy, rng);
  const w = ruinWall(ctx, rng, { axis: 'x', x: ox + 0.06, y: oy + 0.32, len: 0.88, thick: 0.22, h0: 42, h1: 30, jag: 3 });
  gate(ctx, w.front, 0.3, 0.7, 0, 20);
  gcyl(ctx, ox + 0.16, oy + 0.7, 5, 0.1, 28, STONE, { rng, broken: 5, rings: [9, 18] });
  gcyl(ctx, ox + 0.84, oy + 0.72, 5, 0.1, 13, STONE, { rng, broken: 4, rings: [7] });
  heap(ctx, rng, ox + 0.5, oy + 0.84, 0.13, 5, [STONE, BRICK], 6, 5);
}

function ruinColumns(ctx, ox, oy, rng) {
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
  beam(ctx, iso(ox + 0.5, oy + 0.45, 12), iso(ox + 0.14, oy + 0.16, 38), 5);
  beam(ctx, iso(ox + 0.5, oy + 0.5, 12), iso(ox + 0.78, oy + 0.12, 34), 4.5);
  heap(ctx, rng, ox + 0.5, oy + 0.55, 0.42, 28, [BRICK, STONE, CONC], 20, 0, 3);
  chunk(ctx, ox + 0.36, oy + 0.42, 0.26, 0.2, 14, [8, 8, 5, 5], CONC, { rng, jag: 1, amp: 3, mortar: 8 });
  rebar(ctx, ox + 0.46, oy + 0.46, 14 + 7, rng, 3, 0.06);
  beam(ctx, iso(ox + 0.44, oy + 0.6, 16), iso(ox + 0.18, oy + 0.9, 30), 5);
}

// ---------- Walls: pieces that line up in runs of two or three cells ----------

/**
 * One cell of a wall run, horizontal (along x) or vertical (along y). The pieces
 * all keep the same base height `hb` at their ends, so any order joins up.
 */
function wallPiece(ctx, ox, oy, horizontal, piece, hb, rng) {
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

// ---------- Craters: irregular rim, dark floor, one feature each ----------

/** Irregular diamond filling a cell (r = 1 is the full cell): edges with chips and breakouts, corners cut deeper. */
function blobD(rng, sx, sy, r, jit, perEdge, chip) {
  const hw = 32 * r;
  const hh = 16 * r;
  const corners = [[0, -hh], [hw, 0], [0, hh], [-hw, 0]];
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    for (let k = 0; k < perEdge; k++) {
      const t = k / perEdge;
      let f = 1 - rng.range(0, k === 0 ? chip : jit);
      if (rng.chance(0.14)) f -= 0.1;
      pts.push([sx + lerp(a[0], b[0], t) * f, sy + lerp(a[1], b[1], t) * f]);
    }
  }
  return pts;
}

/** Rim, pit wall and floor of one crater, drawn flat on the ground around screen point (sx, sy). */
function craterBase(ctx, sx, sy, rng, o = {}) {
  const r = o.r ?? 1;
  const rimCol = o.rimF ?? ['#6b5a46', '#a08968'];
  const outer = blobD(rng, sx, sy, 0.97 * r, 0.1, 4, 0.16);
  poly(ctx, outer, rimCol[0], INK, 2.5);
  const lift = o.lift ?? 2;
  const top = scalePts(outer, sx, sy, 0.94, -lift);
  poly(ctx, top, rimCol[1], INK, 1.6);
  const out = { outer, top };
  if (o.water) {
    out.pit = scalePts(outer, sx, sy, 0.7, -lift + 0.5);
    poly(ctx, out.pit, PIT, INK, 1.8);
  } else {
    out.pit = scalePts(outer, sx, sy, 0.68, -lift);
    poly(ctx, out.pit, '#2b211a', INK, 2);
    out.floor = scalePts(outer, sx, sy, 0.52, 0);
    poly(ctx, out.floor, PIT, INK, 1.6);
  }
  // Lit lip on the near half of the rim.
  ctx.beginPath();
  const [i0, i1] = [4, 12];
  for (let i = i0; i <= i1; i++) (i === i0 ? ctx.moveTo(top[i][0], top[i][1]) : ctx.lineTo(top[i][0], top[i][1]));
  ctx.strokeStyle = o.lipF ?? '#d9c39a';
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
    // Field mode: along the square's edges, so the stones sit on the wall of the diamond.
    const q = (i / n) * 4 + rng.range(-0.15, 0.15);
    const e = ((Math.floor(q) % 4) + 4) % 4;
    const f = q - Math.floor(q);
    const sq = [[-0.37 + 0.74 * f, -0.37], [0.37, -0.37 + 0.74 * f], [0.37 - 0.74 * f, 0.37], [-0.37, 0.37 - 0.74 * f]][e];
    out.push({ a, dx: sq[0], dy: sq[1], w: rng.range(0.1, 0.18), d: rng.range(0.1, 0.16), h: rng.range(3, 9), pal: rng.pick(pals) });
  }
  return out.sort((p, q) => p.dx + p.dy - (q.dx + q.dy));
}
function drawRimStones(ctx, ox, oy, stones, front) {
  for (const s of stones) {
    if ((s.dx + s.dy >= 0) !== front) continue;
    box(ctx, ox + 0.5 + s.dx - s.w / 2, oy + 0.5 + s.dy - s.d / 2, s.w, s.d, s.h, 2, s.pal, 1.7, LIT);
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
  const c = craterBase(ctx, sx, sy, rng, { rim: ['#241d19', '#3a302a'], lip: '#7a6c64', rimF: ['#4e4036', '#8a7562'], lipF: '#bda78c' });
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
  craterBase(ctx, sx - 12.8, sy, rng, { r: 0.62 });
  craterBase(ctx, sx + 12.8, sy, rng, { r: 0.62 });
  box(ctx, ox + 0.5 - 0.07, oy + 0.5 - 0.07, 0.14, 0.14, 7, 0, CONC, 1.6, LIT);
}

function craterWater(ctx, ox, oy, rng) {
  const [sx, sy] = iso(ox + 0.5, oy + 0.5);
  craterBase(ctx, sx, sy, rng, { r: 0.98, water: true, lift: 1, rim: ['#43372c', '#665643'], lip: '#9a8466', rimF: ['#6f5f4a', '#b09c7a'], lipF: '#dcc9a2' });
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
  box(ctx, ox + 0.12, oy + 0.62, 0.12, 0.1, 4, 1, CONC, 1.6, LIT);
  box(ctx, ox + 0.8, oy + 0.3, 0.1, 0.12, 3, 1, STONE, 1.6, LIT);
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
  boneBar(ctx, [sx - 22, sy + 3], [sx - 12, sy + 8]);
  skull(ctx, sx + 14, sy + 7);
}

function craterShards(ctx, ox, oy, rng) {
  const [sx, sy] = iso(ox + 0.5, oy + 0.5);
  const cols = [C.steelD, C.rustD, C.concD, C.steel];
  const shards = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const len = rng.range(8, 16);
    const R = 1.02 / (Math.abs(Math.cos(a)) / 32 + Math.abs(Math.sin(a)) / 16);
    const bx = sx + Math.cos(a) * R;
    const by = sy + Math.sin(a) * R;
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

// ---------- Capsule remains ----------
// Kit: heat shield (in every variant, the sign that tells it from other rubble),
// segment flaps with hinge bolt, core stump with its dead red band, roof disc
// with brake nozzles, bent struts, cables, warning-band pieces (burnt, not
// yellow: yellow belongs to the bulwark), soot ring. All lie within one cell
// and stay below 16 px.

const CORE = ['#413d39', '#4a4642', '#2e2b28'];
const SH = 3;

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

// ---------- Capsule remains, diamond-filling (default) ----------
// The field is one cell and the remains fill it: a scorched, frayed diamond of
// dark ground, the broken heat shield as a segment, half ring or tilted disc
// (still the sign of a capsule), the core stump in every variant, and flaps,
// struts, cables, bands and the roof disc spread out to the corners. Nothing
// leaves the cell, nothing is scaled, heights stay under 16 px.

const Z0 = 0.5;
const FLAT = Z0 + 2.2;

function scorchField(ctx, ox, oy, rng) {
  const [sx, sy] = iso(ox + 0.5, oy + 0.5);
  const outer = blobD(rng, sx, sy, 0.985, 0.13, 6, 0.2);
  poly(ctx, outer, '#352d26', INK, 2.2);
  poly(ctx, scalePts(outer, sx, sy, 0.8, 0), 'rgba(12,8,6,0.5)', null);
  poly(ctx, scalePts(outer, sx, sy, 0.5, 0), 'rgba(12,8,6,0.4)', null);
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r0 = rng.range(0.35, 0.55);
    ctx.moveTo(sx + Math.cos(a) * 32 * r0, sy + Math.sin(a) * 16 * r0);
    ctx.lineTo(sx + Math.cos(a) * 32 * (r0 + 0.3), sy + Math.sin(a) * 16 * (r0 + 0.3));
  }
  ctx.strokeStyle = 'rgba(12,8,6,0.55)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Broken heat shield: an arc of the ring between ri and ro, angles in grid space (0 = +x, clockwise on screen). */
function shieldArc(ctx, cx, cy, a0, a1, ro, ri, rng, th = 3) {
  const n = 7;
  const P = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r, Z0 + th];
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(P(lerp(a0, a1, i / n), ro));
  pts.push(P(a1 + rng.range(-0.08, 0.02), (ro + ri) / 2));
  for (let i = n; i >= 0; i--) pts.push(P(lerp(a0, a1, i / n), ri));
  pts.push(P(a0 + rng.range(-0.02, 0.08), (ro + ri) / 2));
  const p = plate(ctx, pts, '#5a5046', '#2a2622', th, 2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= n; i++) (i ? ctx.lineTo(p[i][0], p[i][1]) : ctx.moveTo(p[i][0], p[i][1]));
  ctx.strokeStyle = '#a99a82';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const q = iso(...P(lerp(a0, a1, i / n), (ro + ri) / 2));
    if (i) ctx.lineTo(q[0], q[1]);
    else ctx.moveTo(q[0], q[1]);
  }
  ctx.strokeStyle = 'rgba(10,6,4,0.55)';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  for (const k of [0.25, 0.75]) {
    const q = iso(...P(lerp(a0, a1, k), ro - 0.045));
    ell(ctx, q[0], q[1], 1.4, 0.9, '#8a8479', null);
  }
}

/** A heat shield disc, tilted: a rotated ellipse leaning in a corner. */
function shieldDisc(ctx, gx, gy, z, rot, k = 1) {
  const [sx, sy] = iso(gx, gy, z);
  const rx = 45.25 * 0.3 * k;
  const ry = 22.63 * 0.3 * k;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(rot);
  ell(ctx, 0, 3.4, rx, ry, '#2a2622', INK, 2);
  ell(ctx, 0, 0, rx, ry, '#5a5046', INK, 2);
  ell(ctx, 0, 0, rx * 0.66, ry * 0.66, null, 'rgba(10,6,4,0.55)', 2);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.93, ry * 0.93, 0, 0.3, Math.PI - 0.3);
  ctx.strokeStyle = '#a99a82';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

const bolt = (ctx, gx, gy) => {
  const [x, y] = iso(gx, gy, Z0 + 1);
  ell(ctx, x, y, 2.6, 1.6, '#a8a195', INK, 1.1);
};

/** The flaps of the field version point at the diamond's tips: th = 45 degrees steps in grid space. */
const flapF = (ctx, cx, cy, th, rng, o = {}) => flap(ctx, cx, cy, th, rng, { ri: 0.25, ro: 0.55, wi: 0.16, wo: 0.26, zi: FLAT, zo: FLAT, ...o });
const PI = Math.PI;

function fieldFresh(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  scorchField(ctx, ox, oy, rng);
  shieldArc(ctx, cx, cy, PI, PI * 1.5, 0.47, 0.28, rng);
  flapF(ctx, cx, cy, PI * 1.75, rng);
  flapF(ctx, cx, cy, PI * 0.75, rng, { broken: true });
  coreStump(ctx, cx, cy, Z0, 7, rng, 0.2);
  roofDisc(ctx, cx, cy, Z0 + 9.5, -0.2, 0.9);
  flapF(ctx, cx, cy, PI * 0.25, rng);
}

function fieldRoofOff(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  scorchField(ctx, ox, oy, rng);
  shieldArc(ctx, cx, cy, PI * 0.5, PI * 1.5, 0.47, 0.27, rng);
  flapF(ctx, cx, cy, PI * 1.75, rng);
  coreStump(ctx, cx, cy, Z0, 7, rng, 0.2);
  cable(ctx, [cx + 0.05, cy + 0.02, Z0 + 6], [cx + 0.3, cy + 0.26, Z0 + 1], [4, 6]);
  roofDisc(ctx, cx + 0.22, cy + 0.2, FLAT, 0.5, 1.05);
}

function fieldStruts(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  scorchField(ctx, ox, oy, rng);
  shieldDisc(ctx, cx + 0.22, cy - 0.22, Z0 + 4, 0.7, 0.85);
  flapF(ctx, cx, cy, PI * 0.75, rng, { broken: true });
  coreStump(ctx, cx, cy, Z0, 7, rng, 0.2);
  strut(ctx, [[cx - 0.05, cy + 0.12, Z0 + 1], [cx - 0.2, cy + 0.28, Z0 + 1], [cx - 0.3, cy + 0.38, Z0 + 6]]);
  strut(ctx, [[cx + 0.06, cy + 0.14, Z0 + 1], [cx + 0.25, cy + 0.24, Z0 + 1], [cx + 0.34, cy + 0.12, Z0 + 7]]);
}

function fieldLeaning(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  scorchField(ctx, ox, oy, rng);
  shieldArc(ctx, cx, cy, PI, PI * 1.5, 0.47, 0.3, rng);
  warnPiece(ctx, cx + 0.3, cy - 0.22, FLAT, 0.5);
  coreStump(ctx, cx, cy, Z0, 6, rng, 0.2);
  warnPiece(ctx, cx - 0.28, cy + 0.2, FLAT, 0.6);
  flapF(ctx, cx, cy, PI * 0.25, rng, { zi: Z0 + 9, zo: FLAT, ri: 0.2, ro: 0.5 });
}

function fieldRoofDown(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  scorchField(ctx, ox, oy, rng);
  shieldArc(ctx, cx, cy, PI * 1.5, PI * 2, 0.47, 0.3, rng);
  coreStump(ctx, cx - 0.14, cy - 0.12, Z0, 5, rng, 0.18);
  strut(ctx, [[cx - 0.34, cy + 0.3, Z0 + 1], [cx - 0.1, cy + 0.36, Z0 + 1], [cx, cy + 0.28, Z0 + 4]], 2.8);
  roofDisc(ctx, cx + 0.08, cy + 0.14, FLAT, 0.1, 1.2);
}

function fieldCables(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  scorchField(ctx, ox, oy, rng);
  shieldArc(ctx, cx, cy, PI * 0.5, PI, 0.47, 0.3, rng);
  cable(ctx, [cx - 0.05, cy - 0.1, Z0 + 6], [cx - 0.36, cy - 0.36, Z0 + 0.5], [-4, 6]);
  cable(ctx, [cx + 0.1, cy - 0.05, Z0 + 6], [cx + 0.38, cy - 0.34, Z0 + 0.5], [4, 7]);
  coreStump(ctx, cx, cy, Z0, 8, rng, 0.2);
  cable(ctx, [cx + 0.12, cy + 0.08, Z0 + 6], [cx + 0.38, cy + 0.38, Z0 + 0.5], [6, 4]);
  cable(ctx, [cx + 0.0, cy + 0.12, Z0 + 5], [cx + 0.02, cy + 0.42, Z0 + 0.5], [-6, 6]);
  bolt(ctx, cx + 0.32, cy + 0.02);
  bolt(ctx, cx - 0.1, cy - 0.34);
}

function fieldBands(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  scorchField(ctx, ox, oy, rng);
  shieldArc(ctx, cx, cy, PI * 1.25, PI * 1.75, 0.47, 0.35, rng, 2.4);
  warnPiece(ctx, cx - 0.3, cy - 0.04, FLAT, 2.4);
  strut(ctx, [[cx - 0.36, cy + 0.3, Z0 + 1], [cx - 0.04, cy + 0.2, Z0 + 1], [cx + 0.3, cy + 0.12, Z0 + 5]]);
  coreStump(ctx, cx, cy, Z0, 5, rng, 0.2);
  warnPiece(ctx, cx + 0.3, cy + 0.12, FLAT, 0.3, 0.3, 0.1);
  strut(ctx, [[cx - 0.2, cy + 0.38, Z0 + 1], [cx + 0.1, cy + 0.3, Z0 + 3], [cx + 0.3, cy + 0.4, Z0 + 1]], 2.8);
  warnPiece(ctx, cx - 0.08, cy + 0.32, FLAT + 1, 1.2, 0.28, 0.1);
}

function fieldStripped(ctx, ox, oy, rng) {
  const cx = ox + 0.5;
  const cy = oy + 0.5;
  scorchField(ctx, ox, oy, rng);
  flapF(ctx, cx, cy, PI * 1.25, rng, { broken: true, ri: 0.3, ro: 0.5, wi: 0.14, wo: 0.22 });
  coreStump(ctx, cx, cy, Z0, 4, rng, 0.2);
  shieldArc(ctx, cx, cy, PI * 0.25, PI * 0.75, 0.47, 0.36, rng, 2.4);
  bolt(ctx, cx + 0.3, cy - 0.2);
  bolt(ctx, cx - 0.3, cy - 0.08);
  bolt(ctx, cx + 0.34, cy + 0.12);
}


// ---------- Entry points ----------

/** Number of kit variants per kind. */
export const KIT_VARIANTS = 8;

const RUIN_DRAW = [ruinChapel, ruinTower, ruinCorner, ruinFactory, ruinConcrete, ruinArch, ruinColumns, ruinMound];
const CRATER_DRAW = [craterEmbers, craterSlag, craterWreck, craterDouble, craterWater, craterBones, craterShards, craterToxic];
const CAPSULE_DRAW = [fieldFresh, fieldRoofOff, fieldStruts, fieldLeaning, fieldRoofDown, fieldCables, fieldBands, fieldStripped];
/** Three pieces per run; a run of two cells uses the last two. Every piece keeps the run's base height at its ends. */
const WALL_RUNS = [
  ['crenel', 'plain', 'crenel'],
  ['plain', 'breach', 'plain'],
  ['buttress', 'plain', 'buttress'],
  ['plain', 'slit', 'plain'],
  ['plain', 'plain', 'stair'],
  ['plain', 'bullet', 'bullet'],
  ['plain', 'moss', 'moss'],
  ['wire', 'wire', 'plain'],
];

/** The kit variant (0 to 7) of a field: a hash of its position and the simulation's variant. */
export function kitVariant(x, y, variant) {
  return seedFromString(`kit:${x}:${y}:${variant}`) % KIT_VARIANTS;
}

const cellRng = (x, y, variant, extra = '') => createRng(`rubble:${x}:${y}:${variant}${extra}`);

/** A wall is one run: its variant comes from its first cell, its base height too. */
function wallInfo(ob, index) {
  const first = ob.cells[0];
  const count = ob.cells.length;
  return {
    horizontal: count > 1 && ob.cells[1].y === first.y,
    piece: WALL_RUNS[kitVariant(first.x, first.y, ob.variant)][Math.min(2, index + Math.max(0, 3 - count))],
    hb: 18 + cellRng(first.x, first.y, ob.variant, ':hb').int(0, 4),
  };
}

/** The kit variant of one obstacle cell (a wall: of its run). */
export function obstacleKitVariant(ob) {
  return kitVariant(ob.cells[0].x, ob.cells[0].y, ob.variant);
}

/** Draws one cell of a ruin, wall, crater or capsule remains; `pal` is the biome palette. */
export function drawKitCell(ctx, ob, index, pal) {
  const { x, y } = ob.cells[index];
  STONE = pal.stone;
  PIT = shade(pal.pit, -12);
  const rng = cellRng(x, y, ob.variant);
  if (ob.kind === 'wall') {
    const { horizontal, piece, hb } = wallInfo(ob, index);
    wallPiece(ctx, x, y, horizontal, piece, hb, rng);
    return;
  }
  const list = ob.kind === 'ruin' ? RUIN_DRAW : ob.kind === 'crater' ? CRATER_DRAW : CAPSULE_DRAW;
  list[kitVariant(x, y, ob.variant)](ctx, x, y, rng);
}

// ---------- Shadows ----------
// Bodies per variant as [x0, y0, x1, y1, height] in cell fractions and px, taken from the drawn
// compositions: the footing slab and the tall parts. Craters have none.

const RUIN_SLAB = [0.05, 0.05, 0.95, 0.95];
const RUIN_BODIES = [
  [5, [[0.1, 0.1, 0.9, 0.3, 43], [0.1, 0.3, 0.3, 0.8, 35]]],
  [5, [[0.2, 0.18, 0.8, 0.78, 51]]],
  [5, [[0.1, 0.1, 0.3, 0.3, 51], [0.3, 0.1, 0.9, 0.3, 45], [0.1, 0.3, 0.3, 0.85, 41]]],
  [5, [[0.12, 0.1, 0.32, 0.3, 51], [0.1, 0.42, 0.9, 0.66, 29]]],
  [4, [[0.1, 0.18, 0.56, 0.76, 36], [0.58, 0.46, 0.92, 0.86, 19]]],
  [5, [[0.06, 0.32, 0.94, 0.54, 47], [0.06, 0.6, 0.26, 0.8, 33]]],
  [6, [[0.17, 0.17, 0.43, 0.43, 40], [0.54, 0.24, 0.78, 0.48, 26]]],
  [0, [[0.1, 0.1, 0.9, 0.95, 24]]],
];
/** Capsule remains: core stump [x0, y0, x1, y1, height] (it stays the tallest part of the field). */
const CAPSULE_BODIES = [
  [0.3, 0.3, 0.7, 0.7, 11],
  [0.3, 0.3, 0.7, 0.7, 8],
  [0.3, 0.3, 0.7, 0.7, 8],
  [0.3, 0.3, 0.7, 0.7, 10],
  [0.16, 0.2, 0.52, 0.56, 6],
  [0.3, 0.3, 0.7, 0.7, 9],
  [0.3, 0.3, 0.7, 0.7, 6],
  [0.3, 0.3, 0.7, 0.7, 5],
];
/** Wall pieces as [from, to, height offset or factor] along the run; see `wallBodies`. */
function wallBodies(piece, hb) {
  switch (piece) {
    case 'crenel': return [[0, 1, hb], [0.04, 0.3, hb + 8]];
    case 'breach': return [[0, 0.3, hb], [0.3, 0.7, 9], [0.7, 1, hb]];
    case 'stair': return [[0, 0.36, hb], [0.36, 0.68, hb * 0.62], [0.68, 1, hb * 0.3]];
    case 'wire': return [[0, 1, hb + 4]];
    default: return [[0, 1, hb + 3]];
  }
}

/**
 * What an obstacle cell of the kit throws on the ground (bodies for `castShadows`).
 * @returns {{footprint: number[][], height: number}[]}
 */
export function kitShadow(ob, index) {
  const { x, y } = ob.cells[index];
  const rect = ([x0, y0, x1, y1, height]) => ({ footprint: rectCorners(x + x0, y + y0, x + x1, y + y1), height });
  if (ob.kind === 'wall') {
    const { horizontal, piece, hb } = wallInfo(ob, index);
    return wallBodies(piece, hb).map(([a0, a1, h]) => rect(horizontal ? [a0, 0.3, a1, 0.7, h] : [0.3, a0, 0.7, a1, h]));
  }
  const v = kitVariant(x, y, ob.variant);
  if (ob.kind === 'ruin') {
    const [slab, bodies] = RUIN_BODIES[v];
    return [...(slab ? [rect([...RUIN_SLAB, slab])] : []), ...bodies.map(rect)];
  }
  if (ob.kind === 'rubble') return [rect(CAPSULE_BODIES[v])];
  return [];
}
