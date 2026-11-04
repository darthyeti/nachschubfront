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
import { shade, bright } from '../../src/render/model.js';

export const K = 36;
/** Ink of the weapon parts relative to what is authored. */
const INK_WEAPON = 0.62;
/** The weapons are authored small and drawn at 1.5 times, times the BASE_SCALE of the bunker. */
export const WEAPON_SCALE = 1.5 * 0.74;
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
//
// Order of drawing: every body hands over its faces; the faces that look at the camera
// (a true back-face test, see FACING) are sorted one by one by the depth of their centre
// along the view direction, nearest last. Long faces are cut into pieces first, so the
// centre of a piece says where it really is. Sorting whole bodies by one depth value, as
// the first version did, let rear faces and parts show through in front.

/** The way the camera looks, as a ray in (x, y in cells, z in cells). Matches iso(): z px / 36. */
const FACING = [1, 1, 0.89];
/** Pixels of z that count as one cell of depth along the view ray. */
const DEPTH_Z = 40;
/** Longest edge of a face piece in cells before it is cut. */
const MAX_EDGE = 0.24;

const faceFacing = (n) => n[0] * FACING[0] + n[1] * FACING[1] + n[2] * FACING[2] > 0.004;

const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const edgeLen = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], (b[2] - a[2]) / K);

/** Cuts a plain quad into a grid of pieces; `edge` marks the sides that lie on the outline. */
function splitFace(f) {
  if (f.p.length !== 4 || f.hole || f.inner) return [f];
  const [p0, p1, p2, p3] = f.p;
  const m = Math.min(4, Math.max(1, Math.ceil(Math.max(edgeLen(p0, p1), edgeLen(p3, p2)) / MAX_EDGE)));
  const n = Math.min(4, Math.max(1, Math.ceil(Math.max(edgeLen(p1, p2), edgeLen(p0, p3)) / MAX_EDGE)));
  if (m * n === 1) return [f];
  const at = (u, v) => lerp3(lerp3(p0, p1, u), lerp3(p3, p2, u), v);
  const out = [];
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      const u0 = i / m;
      const u1 = (i + 1) / m;
      const v0 = j / n;
      const v1 = (j + 1) / n;
      // edge flags: bottom (v0), right (u1), top (v1), left (u0)
      out.push({ ...f, p: [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)], piece: [j === 0, i === m - 1, j === n - 1, i === 0] });
    }
  }
  return out;
}

function drawFace(ctx, F, f, nw, colour, lw) {
  const fill = shade(f.c ?? colour, bright(nw) * (f.k ?? 1));
  const pts = f.p.map((p) => F.W(p[0], p[1], p[2]));
  const width = f.lw ?? lw;
  if (f.hole) {
    ctx.beginPath();
    for (const ring of [pts, f.hole.map((p) => F.W(p[0], p[1], p[2]))]) {
      ctx.moveTo(ring[0][0], ring[0][1]);
      for (let i = 1; i < ring.length; i++) ctx.lineTo(ring[i][0], ring[i][1]);
      ctx.closePath();
    }
    ctx.fillStyle = fill;
    ctx.fill('evenodd');
    ctx.lineWidth = width;
    ctx.strokeStyle = INK;
    ctx.stroke();
  } else if (f.piece) {
    // A piece of a cut face: fill it, lay a hair of the same colour over its inner seams so
    // they do not show, and ink only the sides that lie on the outline of the whole face.
    poly(ctx, pts, fill, null, 0);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = fill;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let e = 0; e < 4; e++) {
      if (f.piece[e]) continue;
      // Stop short of the ends so the hair never touches the ink of the outline.
      const [ax, ay] = pts[e];
      const [bx, by] = pts[(e + 1) % 4];
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 3) continue;
      const ux = ((bx - ax) / len) * 0.7;
      const uy = ((by - ay) / len) * 0.7;
      ctx.moveTo(ax + ux, ay + uy);
      ctx.lineTo(bx - ux, by - uy);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let e = 0; e < 4; e++) {
      if (!f.piece[e]) continue;
      ctx.moveTo(pts[e][0], pts[e][1]);
      ctx.lineTo(pts[(e + 1) % 4][0], pts[(e + 1) % 4][1]);
    }
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.stroke();
  } else {
    poly(ctx, pts, fill, INK, width);
  }
  if (f.inner) {
    // Concentric discs on a cap: bore, lens, warhead.
    for (const { k, c } of f.inner) {
      poly(ctx, f.p.map((p) => F.W(f.centre[0] + (p[0] - f.centre[0]) * k, f.centre[1] + (p[1] - f.centre[1]) * k, f.centre[2] + (p[2] - f.centre[2]) * k)), c, INK, 1.1);
    }
  }
}

function solid(F, faces, colour, lx, ly, zc, layer, lw, split = true) {
  const cut = [];
  for (const f of faces) cut.push(...(split ? splitFace(f) : [f]));
  return { F, faces: cut, colour, lw, layer, d: 0 };
}

/** The faces of all parts that look at the camera, with their depth, nearest last. */
function sortedFaces(parts) {
  const items = [];
  for (const part of parts) {
    if (!part.faces) continue;
    const F = part.F;
    for (const f of part.faces) {
      const nw = F.wn(f.n[0], f.n[1], f.n[2]);
      if (!faceFacing(nw)) continue;
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (const q of f.p) {
        cx += q[0];
        cy += q[1];
        cz += q[2];
      }
      const k = f.p.length;
      const [wx, wy] = F.world(cx / k, cy / k);
      items.push({ F, f, nw, part, key: wx + wy + (F.alt + (cz / k) * F.scale) / DEPTH_Z + part.layer * 1e-3 });
    }
  }
  items.sort((a, b) => a.key - b.key);
  return items;
}

/** Draws the parts of a model back to front. Hand drawn parts (`draw`) come after the bodies. */
export function renderModel(ctx, parts) {
  ctx.lineJoin = 'round';
  for (const it of sortedFaces(parts)) drawFace(ctx, it.F, it.f, it.nw, it.part.colour, it.part.lw);
  for (const part of parts) if (part.draw) part.draw(ctx);
}

/**
 * The faces in painter's order as screen and world points, for the test that compares the
 * order with a depth buffer (see the study's notes).
 */
export function faceList(parts) {
  return sortedFaces(parts).map(({ F, f, key, part }) => ({
    key,
    colour: part.colour,
    local: f.p,
    piece: Boolean(f.piece),
    scr: f.p.map((p) => F.W(p[0], p[1], p[2])),
    hole: f.hole ? f.hole.map((p) => F.W(p[0], p[1], p[2])) : null,
    world: f.p.map((p) => {
      const [wx, wy] = F.world(p[0], p[1]);
      return [wx, wy, F.alt + p[2] * F.scale];
    }),
  }));
}

/** A part drawn by hand, after all bodies. */
export function custom(F, lx, ly, zc, layer, draw) {
  return { d: 0, draw };
}

/**
 * The body builders for one frame. Every body also reports corner points to `S`,
 * from which the scene works out the cast shadow of the whole weapon.
 * @param {number[][]} S  collects local points [lx, ly, z]
 */
/** A #rrggbb colour scaled in brightness, as a #rrggbb string. */
export function shadeRGB(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.round(Math.min(255, v * k)).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

export function toolkit(F, S = [], { split = true } = {}) {
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
    return solid(F, faces, colour, cx, (a + b) / 2, cz, o.layer ?? 0, o.lw ?? 1.8, split);
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
    return solid(F, faces, colour, cx, cy, (z0 + z1) / 2, o.layer ?? 0, o.lw ?? 1.8, split);
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
    return solid(F, faces, colour, cx, cy, (z0 + z1) / 2, o.layer ?? 0, o.lw ?? 2, split);
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
    return solid(F, faces, colour, mid[0], mid[1], mid[2], o.layer ?? 0, o.lw ?? 1.8, split);
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
    return solid(F, faces, colour, c[0], c[1], c[2], o.layer ?? 0, o.lw ?? 1.6, split);
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
    return solid(F, faces, colour, c[0], c[1], c[2], o.layer ?? 0, o.lw ?? 1.6, split);
  };

  return tk;
}

// ---------- the bunker (static, becomes a sprite) ----------

/** The whole emplacement is drawn at this fraction of its authored size (Till: smaller). */
export const BASE_SCALE = 0.74;
// Authored heights in px: steel lip, concrete body, steel rim, chamfered roof, roof platform.
const Z_LIP = 2.5;
const Z_BODY = 17;
const Z_RIM = 23;
const Z_ROOF = 25.5;
const Z_MOUNT = 28;
/** Top of the roof platform in world px: the weapons stand on it. */
export const MOUNT_Z = Z_MOUNT * BASE_SCALE;
/** Half the footprint of the bunker in cells, for its shadow. */
export const BUNKER_HALF = 0.47 * BASE_SCALE;
/** How far the doctrine-coloured rim of rank 2 reaches down the wall, in authored px. */
const RIM_DEEP = 2.6;
const HB = 0.44;
const HB_TOP = 0.41;
const PLATFORM = 0.31;

function rivet(ctx, p, r = 1, col = '#cfd5de') {
  ell(ctx, p[0], p[1], r, r, INK);
  ell(ctx, p[0] - r * 0.3, p[1] - r * 0.3, r * 0.38, r * 0.38, col);
}

/**
 * The bunker around the origin of `ctx`: a chamfered concrete slab with steel edges, rivets,
 * hazard band, two loop-holes and a roof platform. The ranks add no objects in front of it
 * (no sandbags); they add trim and colour on the bunker itself:
 *   1  bare
 *   2  rim in the doctrine colour, steel guard on the near corner, one chevron
 *   3  dark plates beside the loop-holes with a doctrine mark, doctrine coloured roof platform, two chevrons
 *   4  merlons on the roof, skull plaque, antenna, three chevrons
 *   5  gold edges and rivets, a second antenna, four gold chevrons
 * Rank 2 carries a taller rim than the others (decision E-18, 3): the band reaches
 * RIM_DEEP px further down the wall, so the rank still reads at the smallest zoom.
 * @param {string} accent  guide colour of the doctrine
 * @param {{flat?: boolean}} options  `flat` draws the lamp glow as two flat translucent
 *   discs instead of a gradient, which is what the SVG export needs (no gradients in figures).
 */
export function drawBunker(ctx, rank, accent, { flat = false } = {}) {
  ctx.lineJoin = 'round';
  const F = makeFrame(0, 0, BASE_SCALE);
  const W = (lx, ly, z) => F.W(lx, ly, z);
  const T = toolkit(F, [], { split: false });
  const gold = rank >= 5;
  /** A point on a near face: u along it, v up it, both 0 to 1. */
  const face = (side, u, v) => {
    const h = HB - (HB - HB_TOP) * v;
    const z = Z_LIP + (Z_BODY - Z_LIP) * v;
    return side === 'x' ? W(h, -h + 2 * h * u, z) : W(-h + 2 * h * u, h, z);
  };
  const quad = (side, u0, u1, v0, v1) => [face(side, u0, v0), face(side, u1, v0), face(side, u1, v1), face(side, u0, v1)];
  const nOf = (side) => bright(F.wn(side === 'x' ? 1 : 0, side === 'x' ? 0 : 1, 0));
  const rimColour = rank >= 2 ? shadeRGB(accent, 1) : STEEL_D;

  renderModel(ctx, [
    T.frustum(0, 0, 0.47, 0.47, 0.455, 0.455, 0, Z_LIP, STEEL_D, { lw: 1.7 }),
    T.frustum(0, 0, HB, HB, HB_TOP, HB_TOP, Z_LIP, Z_BODY, CONCRETE, { lw: 1.7 }),
    T.frustum(0, 0, 0.43, 0.43, 0.43, 0.43, rank === 2 ? Z_BODY - RIM_DEEP : Z_BODY, Z_RIM, rimColour, { lw: 1.7 }),
    T.frustum(0, 0, 0.41, 0.41, PLATFORM, PLATFORM, Z_RIM, Z_ROOF, CONCRETE, { lw: 1.5 }),
  ]);

  for (const side of ['x', 'y']) {
    const n = nOf(side);
    // Hazard band: yellow and black stripes, outlined once.
    const band = quad(side, 0.06, 0.94, 0.07, 0.25);
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
      poly(ctx, [face(side, u0, 0.07), face(side, u0 + w, 0.07), face(side, u0 + w + sl, 0.25), face(side, u0 + sl, 0.25)], shade(HAZARD, n), null, 0);
    }
    ctx.restore();
    poly(ctx, band, null, INK, 1.2);

    // Loop-hole: a dark slot under a steel lintel.
    poly(ctx, quad(side, 0.27, 0.73, 0.58, 0.64), shade(STEEL_D, n), INK, 1);
    poly(ctx, quad(side, 0.29, 0.71, 0.64, 0.84), '#14100c', INK, 1.1);

    // Rank chevrons (rank - 1 of them) under the loop-hole: the pips of the rank.
    for (let i = 0; i < rank - 1; i++) {
      const w = 0.14;
      const gap = 0.17;
      const u0 = 0.5 - ((rank - 1) * gap) / 2 + i * gap + (gap - w) / 2;
      const v0 = 0.36;
      const pts = [[0, 0], [w / 2, 0.12], [w, 0], [w, -0.07], [w / 2, 0.05], [0, -0.07]].map(([du, dv]) => face(side, u0 + du, v0 + dv));
      poly(ctx, pts, shade(gold ? C.gold : accent, n), INK, 0.8);
    }

    // Plates beside the loop-hole (rank 3 up), each with a mark in the doctrine colour.
    if (rank >= 3) {
      for (const [u0, u1] of [[0.04, 0.2], [0.8, 0.96]]) {
        poly(ctx, quad(side, u0, u1, 0.34, 0.93), shade(STEEL_DD, n), INK, 1);
        const um = (u0 + u1) / 2;
        poly(ctx, [face(side, u0 + 0.02, 0.52), face(side, u1 - 0.02, 0.52), face(side, um, 0.7)], shade(gold ? C.gold : accent, n), INK, 0.8);
        for (const [uu, vv] of [[um, 0.4], [um, 0.86]]) rivet(ctx, face(side, uu, vv), 0.7);
      }
    }
    // Rivets along the steel lip.
    for (const u of [0.2, 0.8]) {
      const h = 0.46;
      rivet(ctx, side === 'x' ? W(h, -h + 2 * h * u, 1.5) : W(-h + 2 * h * u, h, 1.5), 0.75, gold ? C.gold : '#cfd5de');
    }
  }

  // Steel guard on the near vertical corner (rank 2 up).
  if (rank >= 2) {
    renderModel(ctx, [T.box(HB - 0.05, HB + 0.012, HB - 0.05, HB + 0.012, Z_LIP, Z_BODY + 1.5, gold ? '#d9b44a' : '#cfd5de', { lw: 1.4 })]);
  }
  for (const u of [0.12, 0.32, 0.5, 0.68, 0.88]) {
    const h = 0.43;
    rivet(ctx, W(h, -h + 2 * h * u, (Z_BODY + Z_RIM) / 2), 0.7, gold ? C.gold : '#cfd5de');
    rivet(ctx, W(-h + 2 * h * u, h, (Z_BODY + Z_RIM) / 2), 0.7, gold ? C.gold : '#cfd5de');
  }

  // Bright line on the upper left edge of the roof, as the light of the scene (docs/ART.md).
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = C.bone;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const l0 = W(-PLATFORM, PLATFORM, Z_ROOF);
  const l1 = W(-PLATFORM, -PLATFORM, Z_ROOF);
  ctx.moveTo(l0[0], l0[1]);
  ctx.lineTo(l1[0], l1[1]);
  ctx.stroke();
  ctx.restore();

  // Roof platform for the weapon, an octagon; in the doctrine colour from rank 4.
  renderModel(ctx, [T.column(0, 0, 0.31, 0.29, Z_ROOF, Z_MOUNT, rank >= 3 ? shadeRGB(accent, 0.85) : STEEL, { n: 8, rot: Math.PI / 8, lw: 1.5 })]);

  // Merlons (rank 4 up) on the two near roof edges.
  if (rank >= 4) {
    const m = [];
    for (const y of [-0.2, -0.07, 0.07, 0.2]) m.push(T.box(0.255, 0.31, y - 0.04, y + 0.04, Z_ROOF, Z_ROOF + 5, '#b9b3a6', { lw: 1.3 }));
    for (const x of [-0.2, -0.07, 0.07, 0.2]) m.push(T.box(x - 0.04, x + 0.04, 0.255, 0.31, Z_ROOF, Z_ROOF + 5, '#b9b3a6', { lw: 1.3 }));
    renderModel(ctx, m);
  }

  // Doctrine lamp on the near roof corner.
  const lampP = W(PLATFORM, PLATFORM, Z_ROOF + 2);
  if (flat) {
    ctx.fillStyle = accent;
    for (const [r, a] of [[8, 0.12], [5, 0.2]]) {
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(lampP[0], lampP[1] - 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    const g = ctx.createRadialGradient(lampP[0], lampP[1] - 2, 1, lampP[0], lampP[1] - 2, 8);
    g.addColorStop(0, `${accent}aa`);
    g.addColorStop(1, `${accent}00`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lampP[0], lampP[1] - 2, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  renderModel(ctx, [T.gem([PLATFORM, PLATFORM, Z_ROOF + 1.5], 0.034, 5, 1, accent, { n: 4, lw: 1.1 })]);

  // Skull plaque on the near corner (rank 4 up).
  if (rank >= 4) {
    const [sx, sy] = W(HB + 0.01, HB + 0.01, 13);
    ell(ctx, sx, sy, 4, 3.7, C.bone, INK, 1.2);
    poly(ctx, [[sx - 2.1, sy + 2.5], [sx + 2.1, sy + 2.5], [sx + 1.7, sy + 5], [sx - 1.7, sy + 5]], C.bone, INK, 1);
    ell(ctx, sx - 1.5, sy - 0.4, 1, 1.2, INK);
    ell(ctx, sx + 1.5, sy - 0.4, 1, 1.2, INK);
  }

  // Antennas (rank 4 up).
  if (rank >= 4) {
    const masts = rank >= 5 ? [[0.33, -0.33, 60], [-0.33, 0.33, 48]] : [[0.33, -0.33, 56]];
    for (const [mx, my, top] of masts) {
      const a = W(mx, my, Z_ROOF);
      const b = W(mx, my, top);
      ctx.lineCap = 'round';
      for (const [w, col] of [[3.4, INK], [1.6, STEEL_D]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      const c1 = W(mx, my, top - 8);
      for (const [w, col] of [[3, INK], [1.2, STEEL]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(c1[0] - 4.5, c1[1] + 1.6);
        ctx.lineTo(c1[0] + 4.5, c1[1] - 1.6);
        ctx.stroke();
      }
      ell(ctx, b[0], b[1] - 1, 1.8, 1.8, gold ? C.gold : accent, INK, 1);
    }
  }

  // Gold edges (rank 5): rim top and roof edge.
  if (gold) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const line = (pts) => {
      for (const [w, col] of [[3.6, INK], [1.9, C.gold]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.stroke();
      }
    };
    line([W(-0.43, 0.43, Z_RIM), W(0.43, 0.43, Z_RIM), W(0.43, -0.43, Z_RIM)]);
    line([W(-PLATFORM, PLATFORM, Z_ROOF), W(PLATFORM, PLATFORM, Z_ROOF), W(PLATFORM, -PLATFORM, Z_ROOF)]);
  }
}

// ---------- the weapons ----------

/** Pose of a weapon at one moment; everything the model needs besides the angle. */
export function restPose(accent, rank = 3) {
  return { accent, rank, recoil: 0, spin: 0, bob: 0, gyro: 0.6, loaded: [true, true, true, true, true, true], tube: 0, firing: false };
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
/** Where the cases leave the autocannon: the belly of the housing, local coordinates. */
export const CASING_PORT = [-0.02, 0.15, 9];

export const MUZZLE = {
  autocannon: (p) => ({ at: [0.45 - 0.05 * p.recoil, 0, 11], dir: [1, 0, 0] }),
  flame: () => ({ at: [0.475, 0, 14], dir: [1, 0, 0] }),
  mortar: (p) => ({ at: mortarAxis(p).b, dir: mortarAxis(p).dir }),
  rocket: (p) => ({ at: rocketMouth(p.tube), dir: rocketFrame().a }),
  tesla: () => ({ at: [0.38, 0, 30], dir: [1, 0, 0] }),
  laser: () => ({ at: [0.465, 0, 22.5], dir: [1, 0, 0] }),
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
  const turret = (r = 0.17) => {
    parts.push(T.column(0, 0, r, r - 0.01, 0, 4, STEEL_DD, { n: 8, lw: 1.6 }));
    // The rank on the weapon: a band in the doctrine colour from rank 3, gold at rank 5.
    if (p.rank >= 3) parts.push(T.column(0, 0, r + 0.012, r + 0.012, 1.2, 2.8, p.rank >= 5 ? '#e0b83e' : acc, { n: 8, lw: 1.1, top: false }));
  };

  if (kind === 'autocannon') {
    // Low and wide: an armoured cowl with an ammunition drum on each side and a shield plate in front.
    const rc = 0.05 * p.recoil;
    const zc = 11;
    turret();
    parts.push(T.box(-0.16, 0.12, -0.13, 0.13, 4, 15, STEEL));
    parts.push(T.prism([[-0.15, 15], [0.13, 15], [0.13, 17], [0.07, 21], [-0.11, 21], [-0.15, 17]], -0.12, 0.12, STEEL));
    parts.push(T.box(0.12, 0.15, -0.16, 0.16, 5, 17, STEEL_DD));
    for (const side of [-1, 1]) {
      const y0 = side * 0.13;
      parts.push(T.tube([-0.03, y0, 11], [-0.03, side * 0.25, 11], 0.085, 0.085, STEEL_D, { n: 8, stripe: true }));
      parts.push(T.tube([-0.03, side * 0.185, 11], [-0.03, side * 0.205, 11], 0.092, 0.092, acc, { n: 8, sides: true, lw: 1.1 }));
    }
    parts.push(T.tube([0.15 - rc, 0, zc], [mz[0] - 0.05, 0, zc], 0.036, 0.036, STEEL_DD, { n: 6, capA: false, capB: false }));
    for (let k = 0; k < 6; k++) {
      const ang = p.spin + (k * Math.PI) / 3;
      const ly = 0.066 * Math.cos(ang);
      const z = zc + 0.066 * K * Math.sin(ang);
      parts.push(T.tube([0.15 - rc, ly, z], [mz[0] - 0.01, ly, z], 0.031, 0.029, STEEL_M, { n: 6, lw: 1.2, capB: [{ k: 0.42, c: '#14100c' }] }));
    }
    parts.push(T.ring([0.28 - rc, 0, zc], Y, Z, 0.118, 0.098, 0.02, STEEL));
    parts.push(T.ring([0.4 - rc, 0, zc], Y, Z, 0.112, 0.096, 0.014, STEEL));
    parts.push(T.ring([0.34 - rc, 0, zc], Y, Z, 0.108, 0.098, 0.008, acc, { lw: 1.2 }));
  } else if (kind === 'flame') {
    turret();
    parts.push(T.box(-0.08, 0.1, -0.09, 0.09, 4, 15, STEEL, { layer: 1 }));
    parts.push(T.tube([-0.24, 0, 13], [0.0, 0, 13], 0.125, 0.125, STEEL_D, { n: 10, layer: 1.3, stripe: true }));
    for (const x of [-0.2, -0.06]) parts.push(T.tube([x, 0, 13], [x + 0.032, 0, 13], 0.133, 0.133, acc, { n: 10, layer: 1.6, sides: true, lw: 1.4 }));
    parts.push(T.column(-0.12, 0, 0.032, 0.028, 13 + 0.125 * K, 13 + 0.125 * K + 5, STEEL_DD, { n: 6, layer: 1.4, lw: 1.4 }));
    parts.push(T.column(-0.12, 0, 0.018, 0.018, 13 + 0.125 * K + 5, 13 + 0.125 * K + 8, acc, { n: 6, layer: 1.45, lw: 1.2 }));
    parts.push(T.tube([0.1, 0, 14], [0.42, 0, 14], 0.03, 0.03, STEEL_DD, { n: 6, layer: 1.5, capA: false, capB: false }));
    parts.push(T.tube([0.42, 0, 14], [mz[0], 0, 14], 0.03, 0.054, STEEL_D, { n: 8, layer: 1.6, capB: [{ k: 0.6, c: '#14100c' }] }));
    parts.push(T.tube([0.4, 0, 14], [0.43, 0, 14], 0.062, 0.062, acc, { n: 8, layer: 1.7, sides: true, lw: 1.3 }));
    parts.push(T.box(0.1, 0.3, -0.045, 0.045, 8.6, 9.6, DARK, { layer: 1.1, lw: 1.4 }));
    parts.push(T.tube([0.0, 0, 20], [0.1, 0, 13], 0.02, 0.02, DARK, { n: 5, layer: 1.2, capA: false, capB: false, lw: 1.2 }));
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
    // Tall and narrow: a slim pillar carries the emitter head, so it stands out from the
    // low, wide autocannon from the front and from behind.
    turret(0.14);
    parts.push(T.column(0, 0, 0.1, 0.075, 4, 22, STEEL, { n: 6 }));
    parts.push(T.column(0, 0, 0.115, 0.115, 12, 14.5, acc, { n: 6, top: false, lw: 1.1 }));
    parts.push(T.tube([-0.1, 0, 22.5], [0.15, 0, 22.5], 0.105, 0.105, STEEL_D, { n: 10, capA: [{ k: 0.6, c: STEEL_DD }], capB: [{ k: 0.76, c: '#4a1414' }, { k: 0.58, c: acc }, { k: 0.28, c: '#fff1e4' }] }));
    for (const y of [-0.045, 0.045]) parts.push(T.box(-0.08, 0.05, y - 0.012, y + 0.012, 26, 31, STEEL, { lw: 1.3 }));
    parts.push(T.tube([0.15, 0, 22.5], [0.43, 0, 22.5], 0.04, 0.032, STEEL_M, { n: 6, capA: false, capB: false }));
    for (const x of [0.23, 0.31]) parts.push(T.ring([x, 0, 22.5], Y, Z, 0.075, 0.036, 0.012, STEEL, { n: 8, lw: 1.2 }));
    parts.push(T.tube([0.385, 0, 22.5], [0.415, 0, 22.5], 0.055, 0.055, acc, { n: 8, sides: true, lw: 1.2 }));
    parts.push(T.tube([0.43, 0, 22.5], [mz[0], 0, 22.5], 0.04, 0.046, STEEL, { n: 8, capA: false, capB: [{ k: 0.6, c: '#4a1414' }, { k: 0.3, c: acc }] }));
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
    parts.push(T.ring(c0, X, Y, 0.27, 0.21, 0.02, STEEL, { n: 14, layer: 1.4, lw: 1.4 }));
    parts.push(T.ring(c0, X, Y, 0.21, 0.195, 0.012, acc, { n: 14, layer: 1.42, lw: 1 }));
    const tau = 0.95;
    const al = p.gyro;
    const u1 = [-Math.sin(al), Math.cos(al), 0];
    const u2 = [Math.cos(tau) * Math.cos(al), Math.cos(tau) * Math.sin(al), -Math.sin(tau)];
    parts.push(T.ring(c0, u1, u2, 0.195, 0.14, 0.02, STEEL_M, { n: 14, layer: 1.5, lw: 1.4 }));
    // The core and the lens crystal that points at the target and sends the pulse.
    parts.push(T.gem(c0, 0.065, 10, 10, acc, { n: 6, layer: 1.55, lw: 1.3, rot: p.gyro }));
    parts.push(T.tube([0.05, 0, z0], [mz[0] - 0.01, 0, z0], 0.05, 0.008, acc, { n: 6, layer: 1.6, capA: false, capB: false, lw: 1.2 }));
  }

  // The weapons are drawn smaller than they are authored, the ink is not: thin it with them.
  for (const part of parts) if (part.faces) part.lw = Math.max(0.8, part.lw * INK_WEAPON);
  const muzzle = MUZZLE[kind](p);
  return { parts, samples: S, muzzle };
}
