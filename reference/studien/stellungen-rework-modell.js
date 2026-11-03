// Study: rework of the emplacements, part 1: the bodies, the bunker and the seven weapons.
//
// The weapons are turnable models in the sense of docs/ART.md ("Drehbare Modelle"):
// built from bodies in local coordinates, a face is drawn only while its normal
// points at the camera, shaded by that normal, parts sorted by depth. Unlike the
// Koloss and the gunship they turn by ANY angle, not only the four axes, because an
// emplacement has to face its target. That is why this file brings its own frame
// (`makeFrame` takes an angle in radians); `shade`, `bright` and `visible` are the
// game's own functions from src/render/model.js.
//
// Local axes as in model.js: lx forward and ly sideways in cells, z up in pixels.
// Round bodies use K pixels of z per cell so a barrel is not an egg in the iso view.
//
// The bunker is a static part and stays a sprite: `drawBunker` draws it around the
// origin and the scene caches it per rank and zoom step.
//
// Nothing here touches src/; the study only reads it.

import { poly, ell } from '../../src/render/draw.js';
import { iso } from '../../src/render/iso.js';
import { C } from '../../src/render/palette.js';
import { shade, bright, visible } from '../../src/render/model.js';

export const K = 36;
/** The weapons are authored small and drawn at this scale. */
export const WEAPON_SCALE = 1.5;
const INK = C.ink;

// Steel tones of the capsule (reference/studien/kapsel-studie.js, draft B), concrete and brass.
export const STEEL = '#a6adb8';
export const STEEL_M = '#8d94a0';
export const STEEL_D = '#717884';
export const STEEL_DD = '#4a505b';
export const DARK = '#2a2d33';
export const CONCRETE = '#a8a398';
export const COPPER = '#b2723d';
export const BRASS = '#e8c872';
const HAZARD = '#d9a82a';
const SAND = '#b39b6c';

// ---------- frame ----------

/**
 * The local frame of a model standing at the origin, `alt` pixels up, facing `theta`
 * (radians, 0 = along +x in cell coordinates). The scene translates to the tower.
 * `scale` makes the whole model bigger without touching its numbers (the weapons are drawn
 * at WEAPON_SCALE, so a barrel is wide enough to carry an ink outline).
 */
export function makeFrame(theta, alt = 0, scale = 1) {
  const fx = Math.cos(theta);
  const fy = Math.sin(theta);
  const sx = -fy;
  const sy = fx;
  return {
    theta,
    alt,
    f: [fx, fy],
    s: [sx, sy],
    /** A local point on screen, relative to the tower's ground point. */
    W: (lx, ly, z) => iso((lx * fx + ly * sx) * scale, (lx * fy + ly * sy) * scale, alt + z * scale),
    /** A local point as world cells, relative to the tower's centre. */
    world: (lx, ly) => [(lx * fx + ly * sx) * scale, (lx * fy + ly * sy) * scale],
    xy: (lx, ly) => (lx * (fx + fy) + ly * (sx + sy)) * scale,
    scale,
    wn: (nx, ny, nz) => [nx * fx + ny * sx, nx * fy + ny * sy, nz],
  };
}

// ---------- small vector helpers (true units: cells on all three axes) ----------

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const toTrue = (p) => [p[0], p[1], p[2] / K];
const toPx = (p) => [p[0], p[1], p[2] * K];

/** Normal of a triangle (true units), turned away from `inside`. */
function triNormal(p0, p1, p2, inside) {
  let n = norm(cross(sub(p1, p0), sub(p2, p0)));
  if (dot(n, sub(p0, inside)) < 0) n = mul(n, -1);
  return n;
}

// ---------- faces and solids ----------

function drawFaces(ctx, F, faces, colour, lw) {
  ctx.lineJoin = 'round';
  for (const f of faces) {
    const nw = F.wn(f.n[0], f.n[1], f.n[2]);
    if (!visible(nw)) continue;
    const fill = shade(f.c ?? colour, bright(nw) * (f.k ?? 1));
    const pts = f.p.map((p) => F.W(p[0], p[1], p[2]));
    if (f.hole) {
      ctx.beginPath();
      for (const ring of [pts, f.hole.map((p) => F.W(p[0], p[1], p[2]))]) {
        ctx.moveTo(ring[0][0], ring[0][1]);
        for (let i = 1; i < ring.length; i++) ctx.lineTo(ring[i][0], ring[i][1]);
        ctx.closePath();
      }
      ctx.fillStyle = fill;
      ctx.fill('evenodd');
      ctx.lineWidth = f.lw ?? lw;
      ctx.strokeStyle = INK;
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else {
      poly(ctx, pts, fill, INK, f.lw ?? lw);
    }
    if (f.inner) {
      // Concentric discs on a cap: bore, lens, warhead.
      for (const { k, c } of f.inner) {
        poly(ctx, f.p.map((p) => F.W(f.centre[0] + (p[0] - f.centre[0]) * k, f.centre[1] + (p[1] - f.centre[1]) * k, f.centre[2] + (p[2] - f.centre[2]) * k)), c, INK, 1.1);
      }
    }
  }
}

function solid(F, faces, colour, lx, ly, zc, layer, lw) {
  return { d: F.xy(lx, ly) + layer * 20 + zc * 0.0005, draw: (ctx) => drawFaces(ctx, F, faces, colour, lw) };
}

/** Draws the parts of a model back to front. */
export function renderModel(ctx, parts) {
  parts.sort((a, b) => a.d - b.d);
  for (const part of parts) part.draw(ctx);
}

/** A part drawn by hand, placed in the same depth order as the bodies. */
export function custom(F, lx, ly, zc, layer, draw) {
  return { d: F.xy(lx, ly) + layer * 20 + zc * 0.0005, draw };
}

/**
 * The body builders for one frame. Every body also reports corner points to `S`,
 * from which the scene works out the cast shadow of the whole weapon.
 * @param {number[][]} S  collects local points [lx, ly, z]
 */
export function toolkit(F, S = []) {
  const tk = {};

  /** A prism: a cross-section in (lx, z) extruded sideways from ly `a` to `b`. */
  tk.prism = (section, a, b, colour, o = {}) => {
    let cx = 0;
    let cz = 0;
    for (const [x, z] of section) {
      cx += x;
      cz += z;
    }
    cx /= section.length;
    cz /= section.length;
    const faces = [
      { p: section.map(([x, z]) => [x, b, z]), n: [0, 1, 0] },
      { p: section.map(([x, z]) => [x, a, z]), n: [0, -1, 0] },
    ];
    for (let i = 0; i < section.length; i++) {
      const p = section[i];
      const q = section[(i + 1) % section.length];
      let nx = (q[1] - p[1]) / K;
      let nz = -(q[0] - p[0]);
      if (nx * ((p[0] + q[0]) / 2 - cx) + nz * (((p[1] + q[1]) / 2 - cz) / K) < 0) {
        nx = -nx;
        nz = -nz;
      }
      const len = Math.hypot(nx, nz);
      if (len < 1e-9) continue;
      if (o.band && Math.abs(nz / len) > 0.5) continue;
      faces.push({ p: [[p[0], a, p[1]], [q[0], a, q[1]], [q[0], b, q[1]], [p[0], b, p[1]]], n: [nx / len, 0, nz / len] });
    }
    for (const [x, z] of section) S.push([x, a, z], [x, b, z]);
    return solid(F, faces, colour, cx, (a + b) / 2, cz, o.layer ?? 0, o.lw ?? 1.8);
  };

  tk.box = (x0, x1, y0, y1, z0, z1, colour, o) => tk.prism([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y1, colour, o);

  /** A rectangular frustum around (cx, cy): half sizes (hx0, hy0) below, (hx1, hy1) above. */
  tk.frustum = (cx, cy, hx0, hy0, hx1, hy1, z0, z1, colour, o = {}) => {
    const dz = (z1 - z0) / K;
    const mk = (nx, ny, nz, pts) => {
      const n = norm([nx, ny, nz]);
      return { p: pts, n };
    };
    const faces = [
      mk(dz, 0, hx0 - hx1, [[cx + hx0, cy - hy0, z0], [cx + hx0, cy + hy0, z0], [cx + hx1, cy + hy1, z1], [cx + hx1, cy - hy1, z1]]),
      mk(-dz, 0, hx0 - hx1, [[cx - hx0, cy + hy0, z0], [cx - hx0, cy - hy0, z0], [cx - hx1, cy - hy1, z1], [cx - hx1, cy + hy1, z1]]),
      mk(0, dz, hy0 - hy1, [[cx - hx0, cy + hy0, z0], [cx + hx0, cy + hy0, z0], [cx + hx1, cy + hy1, z1], [cx - hx1, cy + hy1, z1]]),
      mk(0, -dz, hy0 - hy1, [[cx + hx0, cy - hy0, z0], [cx - hx0, cy - hy0, z0], [cx - hx1, cy - hy1, z1], [cx + hx1, cy - hy1, z1]]),
      mk(0, 0, 1, [[cx - hx1, cy - hy1, z1], [cx + hx1, cy - hy1, z1], [cx + hx1, cy + hy1, z1], [cx - hx1, cy + hy1, z1]]),
    ];
    for (const [x, y, z] of [[hx0, hy0, z0], [hx1, hy1, z1]]) for (const sx of [-1, 1]) for (const sy of [-1, 1]) S.push([cx + sx * x, cy + sy * y, z]);
    return solid(F, faces, colour, cx, cy, (z0 + z1) / 2, o.layer ?? 0, o.lw ?? 1.8);
  };

  /** An upright faceted column (or cone frustum) of radius r0 below and r1 above. */
  tk.column = (cx, cy, r0, r1, z0, z1, colour, o = {}) => {
    const n = o.n ?? 8;
    const dz = (z1 - z0) / K;
    const phi = (i) => (o.rot ?? 0) + (i / n) * Math.PI * 2;
    const ring = (r, z) => Array.from({ length: n }, (_, i) => [cx + Math.cos(phi(i)) * r, cy + Math.sin(phi(i)) * r, z]);
    const A = ring(r0, z0);
    const B = ring(r1, z1);
    const faces = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const pm = (phi(i) + phi(j)) / 2;
      faces.push({ p: [A[i], A[j], B[j], B[i]], n: norm([Math.cos(pm), Math.sin(pm), (r0 - r1) / dz]), k: o.stripe && i % 2 ? 0.86 : 1 });
    }
    if (o.top !== false) faces.push({ p: B.slice(), n: [0, 0, 1] });
    S.push(...A, ...B);
    return solid(F, faces, colour, cx, cy, (z0 + z1) / 2, o.layer ?? 0, o.lw ?? 2);
  };

  /**
   * A faceted tube between two local points (any direction). `capA`/`capB`: false for no cap,
   * or a list of concentric discs [{k, c}] drawn on the cap (bore, lens); `sides: true` leaves
   * both caps out (a band that must not cover what it sits on).
   */
  tk.tube = (A, B, r0, r1, colour, o = {}) => {
    const n = o.n ?? 8;
    const a = toTrue(A);
    const b = toTrue(B);
    const ad = sub(b, a);
    const len = Math.hypot(ad[0], ad[1], ad[2]) || 1e-6;
    const d = mul(ad, 1 / len);
    const ref = Math.abs(d[2]) > 0.95 ? [0, 1, 0] : [0, 0, 1];
    const u = norm(cross(ref, d));
    const v = cross(d, u);
    const phi = (i) => (o.rot ?? 0) + (i / n) * Math.PI * 2;
    const ring = (c, r) => Array.from({ length: n }, (_, i) => toPx(add(c, add(mul(u, Math.cos(phi(i)) * r), mul(v, Math.sin(phi(i)) * r)))));
    const RA = ring(a, r0);
    const RB = ring(b, r1);
    const faces = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const pm = (phi(i) + phi(j)) / 2;
      const radial = add(mul(u, Math.cos(pm)), mul(v, Math.sin(pm)));
      faces.push({ p: [RA[i], RA[j], RB[j], RB[i]], n: norm(add(radial, mul(d, (r0 - r1) / len))), k: o.stripe && i % 2 ? 0.88 : 1 });
    }
    if (!o.sides) {
      if (o.capA !== false) faces.push({ p: RA.slice().reverse(), n: mul(d, -1), inner: o.capA || null, centre: A });
      if (o.capB !== false) faces.push({ p: RB.slice(), n: d, inner: o.capB || null, centre: B });
    }
    S.push(...RA, ...RB);
    const mid = mul(add(A, B), 0.5);
    return solid(F, faces, colour, mid[0], mid[1], mid[2], o.layer ?? 0, o.lw ?? 1.8);
  };

  /**
   * A flat ring (annulus) around `c` in the plane spanned by the unit vectors u, v
   * (true units), thick `half` * 2 along w = u x v. The far inner faces come first,
   * then the outer faces, then the cap that faces the camera.
   */
  tk.ring = (c, u, v, rOut, rIn, half, colour, o = {}) => {
    const n = o.n ?? 12;
    const w = cross(u, v);
    const ct = toTrue(c);
    const phi = (i) => (i / n) * Math.PI * 2;
    const at = (i, r, side) => toPx(add(add(ct, add(mul(u, Math.cos(phi(i)) * r), mul(v, Math.sin(phi(i)) * r))), mul(w, half * side)));
    const faces = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const pm = (phi(i) + phi(j)) / 2;
      const radial = add(mul(u, Math.cos(pm)), mul(v, Math.sin(pm)));
      faces.push({ p: [at(i, rIn, -1), at(j, rIn, -1), at(j, rIn, 1), at(i, rIn, 1)], n: mul(radial, -1), c: o.inside });
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const pm = (phi(i) + phi(j)) / 2;
      const radial = add(mul(u, Math.cos(pm)), mul(v, Math.sin(pm)));
      faces.push({ p: [at(i, rOut, -1), at(j, rOut, -1), at(j, rOut, 1), at(i, rOut, 1)], n: radial });
    }
    for (const side of [-1, 1]) {
      faces.push({
        p: Array.from({ length: n }, (_, i) => at(i, rOut, side)),
        hole: Array.from({ length: n }, (_, i) => at(i, rIn, side)),
        n: mul(w, side),
      });
    }
    for (let i = 0; i < n; i++) S.push(at(i, rOut, 1), at(i, rOut, -1));
    return solid(F, faces, colour, c[0], c[1], c[2], o.layer ?? 0, o.lw ?? 1.6);
  };

  /** A faceted crystal: two pyramids on one ring. */
  tk.gem = (c, r, up, down, colour, o = {}) => {
    const n = o.n ?? 6;
    const ct = toTrue(c);
    const ringPts = Array.from({ length: n }, (_, i) => [c[0] + Math.cos((i / n) * Math.PI * 2 + (o.rot ?? 0)) * r, c[1] + Math.sin((i / n) * Math.PI * 2 + (o.rot ?? 0)) * r, c[2]]);
    const top = [c[0], c[1], c[2] + up];
    const bottom = [c[0], c[1], c[2] - down];
    const faces = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      faces.push({ p: [ringPts[i], ringPts[j], top], n: triNormal(toTrue(ringPts[i]), toTrue(ringPts[j]), toTrue(top), ct), k: i % 2 ? 0.92 : 1 });
      faces.push({ p: [ringPts[j], ringPts[i], bottom], n: triNormal(toTrue(ringPts[j]), toTrue(ringPts[i]), toTrue(bottom), ct), k: i % 2 ? 0.92 : 1 });
    }
    S.push(...ringPts, top, bottom);
    return solid(F, faces, colour, c[0], c[1], c[2], o.layer ?? 0, o.lw ?? 1.6);
  };

  return tk;
}

// ---------- the bunker (static, becomes a sprite) ----------

// Heights in px: steel lip, concrete body, steel rim, chamfered roof, roof platform.
const Z_LIP = 2.5;
const Z_BODY = 19.5;
const Z_RIM = 21.5;
const Z_ROOF = 24;
/** Top of the roof platform in px: the weapons stand on it. */
export const MOUNT_Z = 26.5;
const HB = 0.44;
const HB_TOP = 0.41;
const PLATFORM = 0.31;

function rivet(ctx, p, r = 1.05, col = '#cfd5de') {
  ell(ctx, p[0], p[1], r, r, INK);
  ell(ctx, p[0] - r * 0.3, p[1] - r * 0.3, r * 0.38, r * 0.38, col);
}

/**
 * The bunker around the origin of `ctx`: a chamfered concrete slab with steel edges, rivets,
 * hazard band, two loop-holes, a roof platform and, per rank, sandbags, armour plates,
 * merlons with a skull, gold edges and antennas. The doctrine colour is only the roof lamp
 * (and the foundation, which the scene lays on the ground).
 * @param {string} accent  guide colour of the doctrine
 */
export function drawBunker(ctx, rank, accent) {
  ctx.lineJoin = 'round';
  const F = makeFrame(0, 0);
  const W = (lx, ly, z) => F.W(lx, ly, z);
  const T = toolkit(F);
  /** A point on a near face: u along it, v up it, both 0 to 1. */
  const face = (side, u, v) => {
    const h = HB - (HB - HB_TOP) * v;
    const z = Z_LIP + (Z_BODY - Z_LIP) * v;
    return side === 'x' ? W(h, -h + 2 * h * u, z) : W(-h + 2 * h * u, h, z);
  };
  const quad = (side, u0, u1, v0, v1) => [face(side, u0, v0), face(side, u1, v0), face(side, u1, v1), face(side, u0, v1)];
  const nOf = (side) => bright(F.wn(side === 'x' ? 1 : 0, side === 'x' ? 0 : 1, 0));

  // Steel lip and concrete body, with steel angle bars up the near corner and the two side corners.
  renderModel(ctx, [
    T.frustum(0, 0, 0.47, 0.47, 0.455, 0.455, 0, Z_LIP, STEEL_D, { lw: 2 }),
    T.frustum(0, 0, HB, HB, HB_TOP, HB_TOP, Z_LIP, Z_BODY, CONCRETE, { lw: 2, layer: 0.1 }),
  ]);

  for (const side of ['x', 'y']) {
    const n = nOf(side);
    // Hazard band: yellow and black stripes on a quiet ground, no outline of its own.
    const band = quad(side, 0.06, 0.94, 0.07, 0.3);
    ctx.save();
    ctx.beginPath();
    band.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.clip();
    poly(ctx, band, shade('#2b2724', n), null, 0);
    const stripes = 8;
    for (let i = -1; i < stripes; i++) {
      const u0 = 0.06 + (i / stripes) * 0.88;
      const w = (0.88 / stripes) * 0.5;
      const sl = 0.05;
      poly(ctx, [face(side, u0, 0.07), face(side, u0 + w, 0.07), face(side, u0 + w + sl, 0.3), face(side, u0 + sl, 0.3)], shade(HAZARD, n), null, 0);
    }
    ctx.restore();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    band.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.stroke();

    // Loop-hole: a dark slot under a steel lintel.
    poly(ctx, quad(side, 0.26, 0.74, 0.54, 0.62), shade(STEEL_D, n), INK, 1.4);
    poly(ctx, quad(side, 0.28, 0.72, 0.62, 0.85), '#14100c', INK, 1.5);

    // Armour plates (rank 3 up), bolted on beside the loop-hole.
    if (rank >= 3) {
      for (const [u0, u1] of [[0.05, 0.22], [0.78, 0.95]]) {
        poly(ctx, quad(side, u0, u1, 0.38, 0.92), shade(STEEL_M, n), INK, 1.5);
        for (const [uu, vv] of [[(u0 + u1) / 2, 0.45], [(u0 + u1) / 2, 0.85]]) rivet(ctx, face(side, uu, vv), 0.9);
      }
    }
    // Rivets along the steel lip.
    for (const u of [0.14, 0.38, 0.62, 0.86]) {
      const h = 0.46;
      rivet(ctx, side === 'x' ? W(h, -h + 2 * h * u, 1.5) : W(-h + 2 * h * u, h, 1.5), 0.85);
    }
  }

  // Steel rim and the chamfered roof.
  renderModel(ctx, [
    T.frustum(0, 0, 0.43, 0.43, 0.43, 0.43, Z_BODY, Z_RIM, STEEL_D, { lw: 2 }),
    T.frustum(0, 0, 0.41, 0.41, PLATFORM, PLATFORM, Z_RIM, Z_ROOF, CONCRETE, { lw: 1.8, layer: 0.1 }),
  ]);
  for (const u of [0.12, 0.32, 0.5, 0.68, 0.88]) {
    const h = 0.43;
    rivet(ctx, W(h, -h + 2 * h * u, (Z_BODY + Z_RIM) / 2), 0.75);
    rivet(ctx, W(-h + 2 * h * u, h, (Z_BODY + Z_RIM) / 2), 0.75);
  }

  // Bright line on the upper left edge of the roof, as the light of the scene (docs/ART.md).
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = C.bone;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const l0 = W(-PLATFORM, PLATFORM, Z_ROOF);
  const l1 = W(-PLATFORM, -PLATFORM, Z_ROOF);
  ctx.moveTo(l0[0], l0[1]);
  ctx.lineTo(l1[0], l1[1]);
  ctx.stroke();
  ctx.restore();

  // Roof platform for the weapon: an octagon with rivets.
  renderModel(ctx, [T.column(0, 0, 0.31, 0.29, Z_ROOF, MOUNT_Z, STEEL, { n: 8, rot: Math.PI / 8, lw: 1.8 })]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    if (Math.cos(a) + Math.sin(a) > -0.3) rivet(ctx, W(Math.cos(a) * 0.255, Math.sin(a) * 0.255, MOUNT_Z), 0.75);
  }

  // Merlons (rank 4 up) on the two near roof edges.
  if (rank >= 4) {
    const m = [];
    for (const y of [-0.2, -0.07, 0.07, 0.2]) m.push(T.box(0.255, 0.31, y - 0.04, y + 0.04, Z_ROOF, Z_ROOF + 5.5, '#b9b3a6', { lw: 1.6 }));
    for (const x of [-0.2, -0.07, 0.07, 0.2]) m.push(T.box(x - 0.04, x + 0.04, 0.255, 0.31, Z_ROOF, Z_ROOF + 5.5, '#b9b3a6', { lw: 1.6 }));
    renderModel(ctx, m);
  }

  // Doctrine lamp on the near roof corner: the only colour on the bunker.
  const lampP = W(PLATFORM, PLATFORM, Z_ROOF + 2);
  const g = ctx.createRadialGradient(lampP[0], lampP[1] - 2, 1, lampP[0], lampP[1] - 2, 9);
  g.addColorStop(0, `${accent}aa`);
  g.addColorStop(1, `${accent}00`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(lampP[0], lampP[1] - 2, 9, 0, Math.PI * 2);
  ctx.fill();
  renderModel(ctx, [T.gem([PLATFORM, PLATFORM, Z_ROOF + 1.5], 0.034, 5, 1, accent, { n: 4, lw: 1.3 })]);

  // Skull on the near vertical edge (rank 4 up).
  if (rank >= 4) {
    const [sx, sy] = W(HB - 0.012, HB - 0.012, 13);
    ell(ctx, sx, sy, 4.4, 4, C.bone, INK, 1.4);
    poly(ctx, [[sx - 2.4, sy + 2.8], [sx + 2.4, sy + 2.8], [sx + 1.9, sy + 5.8], [sx - 1.9, sy + 5.8]], C.bone, INK, 1.2);
    ell(ctx, sx - 1.7, sy - 0.4, 1.1, 1.3, INK);
    ell(ctx, sx + 1.7, sy - 0.4, 1.1, 1.3, INK);
    poly(ctx, [[sx, sy + 0.8], [sx - 0.7, sy + 2.1], [sx + 0.7, sy + 2.1]], INK, null, 0);
  }

  // Antennas (rank 4 up): a thin mast with a crossbar and a lamp in the doctrine colour.
  if (rank >= 4) {
    const masts = rank >= 5 ? [[0.33, -0.33, 62], [-0.33, 0.33, 50]] : [[0.33, -0.33, 58]];
    for (const [mx, my, top] of masts) {
      const a = W(mx, my, Z_ROOF);
      const b = W(mx, my, top);
      ctx.lineCap = 'round';
      for (const [w, col] of [[4, INK], [1.9, STEEL_D]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      const c1 = W(mx, my, top - 8);
      for (const [w, col] of [[3.4, INK], [1.4, STEEL]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(c1[0] - 5, c1[1] + 1.8);
        ctx.lineTo(c1[0] + 5, c1[1] - 1.8);
        ctx.stroke();
      }
      ell(ctx, b[0], b[1] - 1, 2, 2, rank >= 5 ? C.gold : accent, INK, 1.2);
    }
  }

  // Gold edges (rank 5): rim top, roof edge and the near vertical corner.
  if (rank >= 5) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const line = (pts) => {
      for (const [w, col] of [[4.2, INK], [2.2, C.gold]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.stroke();
      }
    };
    line([W(-0.43, 0.43, Z_RIM), W(0.43, 0.43, Z_RIM), W(0.43, -0.43, Z_RIM)]);
    line([W(-PLATFORM, PLATFORM, Z_ROOF), W(PLATFORM, PLATFORM, Z_ROOF), W(PLATFORM, -PLATFORM, Z_ROOF)]);
    line([W(HB_TOP + 0.012, HB_TOP + 0.012, Z_BODY), W(HB + 0.012, HB + 0.012, Z_LIP)]);
  }

  // Sandbags (rank 2 up) along the foot of both near faces.
  if (rank >= 2) {
    const bags = [];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 5; i++) {
        const t = -0.3 + i * 0.15 + (row ? 0.075 : 0);
        if (row && i === 4) continue;
        bags.push(W(HB + 0.1, t, 2.5 + row * 4.2), W(t, HB + 0.1, 2.5 + row * 4.2));
      }
    }
    bags.sort((a, b) => a[1] - b[1]);
    for (const p of bags) {
      ell(ctx, p[0], p[1], 5.6, 3.4, SAND, INK, 1.4);
      ctx.beginPath();
      ctx.moveTo(p[0] - 3.4, p[1] - 0.2);
      ctx.quadraticCurveTo(p[0], p[1] + 1.2, p[0] + 3.4, p[1] - 0.2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(26,20,16,.55)';
      ctx.stroke();
    }
  }
}

// ---------- the weapons ----------

/** Pose of a weapon at one moment; everything the model needs besides the angle. */
export function restPose(accent) {
  return { accent, recoil: 0, spin: 0, bob: 0, gyro: 0.6, loaded: [true, true, true, true, true, true], tube: 0, firing: false };
}

const MORTAR_ELEV = (64 * Math.PI) / 180;
const MORTAR_LEN = 0.5;
const ROCKET_ELEV = (36 * Math.PI) / 180;
const ROCKET_LEN = 0.42;
/** Mouths of the six rocket tubes: [column, row]. Fired in this order. */
const ROCKET_TUBES = [[-1, 1], [1, -1], [0, 1], [-1, -1], [1, 1], [0, -1]];
export const ROCKET_ORDER = [0, 1, 2, 3, 4, 5];
const ROCKET_PITCH = 0.115;
const ROCKET_ROW = 0.065;

function rocketFrame() {
  const c = Math.cos(ROCKET_ELEV);
  const s = Math.sin(ROCKET_ELEV);
  const centre = [0, 0, 20 / K];
  return { c, s, centre, a: [c, 0, s], p: [-s, 0, c] };
}

/** Local centre of the mouth of rocket tube `k` (px for z). */
export function rocketMouth(k) {
  const { a, p, centre } = rocketFrame();
  const [col, row] = ROCKET_TUBES[k];
  const m = add(add(centre, mul(a, ROCKET_LEN / 2 + 0.02)), mul(p, row * ROCKET_ROW));
  return [m[0], col * ROCKET_PITCH, m[2] * K];
}

function mortarAxis(p) {
  const c = Math.cos(MORTAR_ELEV);
  const s = Math.sin(MORTAR_ELEV);
  const shift = -0.07 * p.recoil;
  const a = [-0.1 + shift * c, 0, 14 + shift * s * K];
  const b = [a[0] + MORTAR_LEN * c, 0, a[2] + MORTAR_LEN * s * K];
  return { a, b, dir: [c, 0, s] };
}

/**
 * Where the shot leaves the weapon, in local coordinates, and the direction it leaves in
 * (local, true units). Independent of the angle, so the scene can place its effects
 * without building the model.
 */
export const MUZZLE = {
  autocannon: (p) => ({ at: [0.45 - 0.05 * p.recoil, 0, 13], dir: [1, 0, 0] }),
  flame: () => ({ at: [0.475, 0, 14], dir: [1, 0, 0] }),
  mortar: (p) => ({ at: mortarAxis(p).b, dir: mortarAxis(p).dir }),
  rocket: (p) => ({ at: rocketMouth(p.tube), dir: rocketFrame().a }),
  tesla: () => ({ at: [0.38, 0, 30], dir: [1, 0, 0] }),
  laser: () => ({ at: [0.465, 0, 13], dir: [1, 0, 0] }),
  psi: (p) => ({ at: [0.31, 0, 28 + p.bob], dir: [1, 0, 0] }),
};

/**
 * Builds a weapon: its parts, local points for the shadow, and the muzzle.
 * Every part is drawn with `renderModel(ctx, parts)`.
 */
export function buildWeapon(kind, F, p) {
  const S = [];
  const T = toolkit(F, S);
  const parts = [];
  const acc = p.accent;
  const X = [1, 0, 0];
  const Y = [0, 1, 0];
  const Z = [0, 0, 1];
  // The barrel ends are taken from the muzzle, so the fire cannot come from anywhere else.
  const mz = MUZZLE[kind](p).at;
  const turret = (r = 0.17) => parts.push(T.column(0, 0, r, r - 0.01, 0, 4, STEEL_DD, { n: 8, lw: 2 }));

  if (kind === 'autocannon') {
    const rc = 0.05 * p.recoil;
    const zc = 13;
    turret();
    parts.push(T.prism([[-0.17, 4], [0.11, 4], [0.11, 18], [0.05, 22], [-0.13, 22], [-0.17, 18]], -0.115, 0.115, STEEL, { layer: 1 }));
    parts.push(T.box(-0.14, -0.01, -0.205, -0.115, 6, 17, STEEL_D, { layer: 1 }));
    parts.push(T.box(-0.12, -0.03, -0.2085, -0.205, 9, 12.5, acc, { layer: 1.2, lw: 1.2 }));
    parts.push(T.box(-0.04, 0.05, 0.115, 0.1255, 11, 15, DARK, { layer: 1.2, lw: 1.2 }));
    parts.push(T.tube([0.1 - rc, 0, zc], [mz[0] - 0.05, 0, zc], 0.036, 0.036, STEEL_DD, { n: 6, layer: 1.4, capA: false, capB: false }));
    for (let k = 0; k < 6; k++) {
      const ang = p.spin + (k * Math.PI) / 3;
      const ly = 0.066 * Math.cos(ang);
      const z = zc + 0.066 * K * Math.sin(ang);
      parts.push(T.tube([0.1 - rc, ly, z], [mz[0] - 0.01, ly, z], 0.031, 0.029, STEEL_M, { n: 6, layer: 1.5, lw: 1.2, capB: [{ k: 0.42, c: '#14100c' }] }));
    }
    parts.push(T.ring([0.27 - rc, 0, zc], Y, Z, 0.118, 0.098, 0.02, STEEL, { layer: 2 }));
    parts.push(T.ring([0.4 - rc, 0, zc], Y, Z, 0.112, 0.096, 0.014, STEEL, { layer: 2.1 }));
    parts.push(T.ring([0.335 - rc, 0, zc], Y, Z, 0.108, 0.098, 0.008, acc, { layer: 2.05, lw: 1.2 }));
  } else if (kind === 'flame') {
    turret();
    parts.push(T.box(-0.08, 0.1, -0.09, 0.09, 4, 15, STEEL, { layer: 1 }));
    parts.push(T.tube([-0.24, 0, 21], [0.0, 0, 21], 0.125, 0.125, STEEL_D, { n: 10, layer: 1.3, stripe: true }));
    for (const x of [-0.2, -0.06]) parts.push(T.tube([x, 0, 21], [x + 0.032, 0, 21], 0.133, 0.133, acc, { n: 10, layer: 1.6, sides: true, lw: 1.4 }));
    parts.push(T.column(-0.12, 0, 0.032, 0.028, 21 + 0.125 * K, 21 + 0.125 * K + 5, STEEL_DD, { n: 6, layer: 1.4, lw: 1.4 }));
    parts.push(T.column(-0.12, 0, 0.018, 0.018, 21 + 0.125 * K + 5, 21 + 0.125 * K + 8, acc, { n: 6, layer: 1.45, lw: 1.2 }));
    parts.push(T.tube([0.1, 0, 14], [0.42, 0, 14], 0.03, 0.03, STEEL_DD, { n: 6, layer: 1.5, capA: false, capB: false }));
    parts.push(T.tube([0.42, 0, 14], [mz[0], 0, 14], 0.03, 0.054, STEEL_D, { n: 8, layer: 1.6, capB: [{ k: 0.6, c: '#14100c' }] }));
    parts.push(T.tube([0.4, 0, 14], [0.43, 0, 14], 0.062, 0.062, acc, { n: 8, layer: 1.7, sides: true, lw: 1.3 }));
    parts.push(T.box(0.1, 0.3, -0.045, 0.045, 8.6, 9.6, DARK, { layer: 1.1, lw: 1.4 }));
    parts.push(T.tube([0.0, 0, 20], [0.1, 0, 15], 0.02, 0.02, DARK, { n: 5, layer: 1.2, capA: false, capB: false, lw: 1.2 }));
  } else if (kind === 'mortar') {
    const { a, b } = mortarAxis(p);
    turret(0.2);
    parts.push(T.column(0, 0, 0.2, 0.18, 4, 7, STEEL_D, { n: 8, layer: 0.5, lw: 2 }));
    for (const side of [-1, 1]) {
      const y0 = side > 0 ? 0.1 : -0.15;
      parts.push(T.prism([[-0.14, 7], [0.12, 7], [0.04, 25], [-0.09, 25]], y0, y0 + 0.05, STEEL, { layer: 1 }));
    }
    const c = Math.cos(MORTAR_ELEV);
    const s = Math.sin(MORTAR_ELEV);
    // Buffer sleeve (does not recoil) and the tube (does), with a gold collar at the mouth.
    const sa = [-0.1, 0, 14];
    parts.push(T.tube(sa, [sa[0] + 0.22 * c, 0, sa[2] + 0.22 * s * K], 0.125, 0.125, STEEL_D, { n: 10, layer: 1.2, capA: false, capB: false }));
    parts.push(T.tube(a, b, 0.095, 0.1, STEEL, { n: 10, layer: 1.4, capA: false, capB: [{ k: 0.8, c: '#14100c' }] }));
    const cA = [a[0] + (MORTAR_LEN - 0.07) * c, 0, a[2] + (MORTAR_LEN - 0.07) * s * K];
    parts.push(T.tube(cA, [cA[0] + 0.035 * c, 0, cA[2] + 0.035 * s * K], 0.118, 0.118, acc, { n: 10, layer: 1.6, sides: true, lw: 1.4 }));
    parts.push(T.tube([sa[0] - 0.05 * c, 0, sa[2] - 0.05 * s * K], sa, 0.1, 0.125, STEEL_DD, { n: 10, layer: 1.1, capA: [{ k: 0.5, c: DARK }], capB: false }));
  } else if (kind === 'rocket') {
    const { c, s, centre, a, p: pp } = rocketFrame();
    turret(0.19);
    // Trunnion frame: two legs and the pod resting in them.
    for (const y of [-0.255, 0.205]) parts.push(T.prism([[-0.12, 4], [0.1, 4], [0.05, 22], [-0.06, 22]], y, y + 0.05, STEEL, { layer: 1 }));
    // Pod casing: a rotated rectangle in (lx, z), extruded over three tubes.
    const hl = ROCKET_LEN / 2;
    const hw = 0.125;
    const corner = (da, dp) => {
      const q = add(add(centre, mul(a, da)), mul(pp, dp));
      return [q[0], q[2] * K];
    };
    parts.push(T.prism([corner(-hl, -hw), corner(hl, -hw), corner(hl, hw), corner(-hl, hw)], -0.205, 0.205, STEEL_D, { layer: 1.2, lw: 1.8 }));
    // Accent stripe along the casing on the top side.
    parts.push(T.prism([corner(-hl + 0.04, hw), corner(hl - 0.04, hw), corner(hl - 0.04, hw + 0.006), corner(-hl + 0.04, hw + 0.006)], -0.05, 0.05, acc, { layer: 1.25, lw: 1.1 }));
    for (let k = 0; k < 6; k++) {
      const m = rocketMouth(k);
      const front = [m[0] - 0.045 * c * 1, m[1], m[2] - 0.045 * s * K];
      const tip = [{ k: 0.72, c: '#14100c' }];
      parts.push(T.tube(front, [m[0] + 0.01 * c, m[1], m[2] + 0.01 * s * K], 0.056, 0.056, STEEL, { n: 8, layer: 1.5, lw: 1.3, capA: false, capB: tip }));
      // A loaded tube shows the nose of its rocket.
      if (p.loaded[k]) parts.push(T.tube([m[0] - 0.01 * c, m[1], m[2] - 0.01 * s * K], [m[0] + 0.12 * c, m[1], m[2] + 0.12 * s * K], 0.04, 0.005, acc, { n: 6, layer: 1.55, lw: 1.1, capA: false, capB: false }));
    }
    parts.push(T.box(-0.02 - 0.18, -0.02 - 0.1, -0.1, 0.1, 6, 18, STEEL_DD, { layer: 1.0 }));
  } else if (kind === 'tesla') {
    turret(0.15);
    parts.push(T.column(0, 0, 0.14, 0.125, 4, 8, STEEL_D, { n: 8, layer: 1, lw: 1.8 }));
    parts.push(T.column(0, 0, 0.135, 0.135, 8, 9.5, acc, { n: 8, layer: 1.1, lw: 1.3, top: false }));
    for (let i = 0; i < 4; i++) {
      const z0 = 9.5 + i * 3.8;
      parts.push(T.column(0, 0, 0.112 - i * 0.009, 0.108 - i * 0.009, z0, z0 + 3.5, COPPER, { n: 8, layer: 1.2 + i * 0.01, lw: 1.5, stripe: true }));
    }
    parts.push(T.column(0, 0, 0.03, 0.03, 24.5, 31, STEEL_D, { n: 6, layer: 1.3, lw: 1.3 }));
    parts.push(T.gem([0, 0, 27.5], 0.1, 6, 3, STEEL, { n: 8, layer: 1.5, lw: 1.6 }));
    parts.push(T.gem([0, 0, 27.5], 0.05, 9.5, 3, acc, { n: 6, layer: 1.55, lw: 1.3 }));
    // The emitter horn points at the target; a counterweight balances it behind.
    parts.push(T.tube([0.0, 0, 30], [0.34, 0, 30], 0.02, 0.017, STEEL_D, { n: 6, layer: 1.6, capA: false, capB: false, lw: 1.4 }));
    for (const x of [0.12, 0.24]) parts.push(T.tube([x, 0, 30], [x + 0.025, 0, 30], 0.045, 0.045, acc, { n: 8, layer: 1.65, sides: true, lw: 1.2 }));
    parts.push(T.gem(mz, 0.05, 6, 6, acc, { n: 6, layer: 1.7, lw: 1.3 }));
    parts.push(T.tube([0.0, 0, 30], [-0.15, 0, 30], 0.018, 0.018, STEEL_D, { n: 6, layer: 1.55, capA: false, lw: 1.3 }));
    parts.push(T.gem([-0.16, 0, 30], 0.042, 3.5, 3.5, STEEL_DD, { n: 6, layer: 1.56, lw: 1.3 }));
  } else if (kind === 'laser') {
    turret();
    parts.push(T.prism([[-0.2, 4], [0.02, 4], [0.02, 16], [-0.04, 19], [-0.16, 19], [-0.2, 16]], -0.105, 0.105, STEEL, { layer: 1 }));
    // Cooling fins on the back.
    for (const y of [-0.07, 0, 0.07]) parts.push(T.box(-0.18, -0.03, y - 0.016, y + 0.016, 19, 23, STEEL_D, { layer: 1.1, lw: 1.3 }));
    // The lens housing and its lens.
    parts.push(T.tube([0.0, 0, 13], [0.16, 0, 13], 0.115, 0.115, STEEL_D, { n: 10, layer: 1.3, capA: false, capB: [{ k: 0.76, c: '#4a1414' }, { k: 0.58, c: acc }, { k: 0.28, c: '#fff1e4' }] }));
    // The emitter barrel with two cooling rings and a focus band.
    parts.push(T.tube([0.16, 0, 13], [0.43, 0, 13], 0.04, 0.032, STEEL_M, { n: 6, layer: 1.4, capA: false, capB: false }));
    for (const x of [0.23, 0.31]) parts.push(T.ring([x, 0, 13], Y, Z, 0.075, 0.036, 0.012, STEEL, { layer: 1.7, n: 8, lw: 1.2 }));
    parts.push(T.tube([0.385, 0, 13], [0.415, 0, 13], 0.055, 0.055, acc, { n: 8, layer: 1.7, sides: true, lw: 1.2 }));
    parts.push(T.tube([0.43, 0, 13], [mz[0], 0, 13], 0.04, 0.046, STEEL, { n: 8, layer: 1.75, capA: false, capB: [{ k: 0.6, c: '#4a1414' }, { k: 0.3, c: acc }] }));
  } else if (kind === 'psi') {
    const z0 = 28 + p.bob;
    // The rings float above a pedestal with three slender prongs.
    parts.push(T.column(0, 0, 0.15, 0.13, 0, 5, STEEL_DD, { n: 8, layer: 0, lw: 1.8 }));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      parts.push(T.tube([Math.cos(a) * 0.115, Math.sin(a) * 0.115, 5], [Math.cos(a) * 0.07, Math.sin(a) * 0.07, 15], 0.04, 0.026, STEEL, { n: 5, layer: 0.5, capA: false, lw: 1.3 }));
      parts.push(T.gem([Math.cos(a) * 0.07, Math.sin(a) * 0.07, 15], 0.034, 3.5, 1, acc, { n: 4, layer: 0.55, lw: 1.1 }));
    }
    const c0 = [0, 0, z0];
    // A flat ring that never goes edge-on, and a second one that precesses about it.
    parts.push(T.ring(c0, X, Y, 0.27, 0.2, 0.02, STEEL, { n: 14, layer: 1.4, lw: 1.4 }));
    parts.push(T.ring(c0, X, Y, 0.2, 0.185, 0.012, acc, { n: 14, layer: 1.42, lw: 1 }));
    const tau = 0.95;
    const al = p.gyro;
    const u1 = [-Math.sin(al), Math.cos(al), 0];
    const u2 = [Math.cos(tau) * Math.cos(al), Math.cos(tau) * Math.sin(al), -Math.sin(tau)];
    parts.push(T.ring(c0, u1, u2, 0.225, 0.165, 0.02, STEEL_M, { n: 14, layer: 1.5, lw: 1.4 }));
    // The core and the lens crystal that points at the target and sends the pulse.
    parts.push(T.gem(c0, 0.065, 10, 10, acc, { n: 6, layer: 1.55, lw: 1.3, rot: p.gyro }));
    parts.push(T.tube([0.05, 0, z0], [mz[0] - 0.01, 0, z0], 0.05, 0.008, acc, { n: 6, layer: 1.6, capA: false, capB: false, lw: 1.2 }));
  }

  const muzzle = MUZZLE[kind](p);
  return { parts, samples: S, muzzle };
}
