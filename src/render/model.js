// Turnable models: figures built from simple bodies in local coordinates, so
// they read correctly in all four axis directions (docs/ART.md, "Drehbare
// Modelle"). The Koloss and the gunship are drawn this way.
//
// Everything else in the game is a drawing that gets mirrored. These two cannot
// be: an SVG has no normals, so the shading that makes a box look like a box
// would have to be redrawn for every direction. Here the face normals are
// worked out per frame, which is why they turn.
//
// At most one Koloss and one gunship exist at a time (docs/ART.md), so drawing
// them live costs nothing worth saving; what is cached is the shading, which is
// a string per colour and brightness.
//
// Ported from reference/studien/koloss-studie.html, which is the binding shape.

import { iso } from './iso.js';
import { poly, ell } from './draw.js';
import { C } from './palette.js';

/** The four axis directions a model can face, as [dx, dy] in cells. */
export const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** Index of the direction nearest a heading, for a model that only drives on axes. */
export function directionOf(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 2;
  return dy >= 0 ? 1 : 3;
}

const shadeCache = new Map();

/** A colour at a brightness, cached: the same few hundred strings all game. */
export function shade(hex, brightness) {
  const key = `${hex}${brightness.toFixed(2)}`;
  let value = shadeCache.get(key);
  if (!value) {
    const n = parseInt(hex.slice(1), 16);
    const b = brightness;
    value = `rgb(${Math.round(((n >> 16) & 255) * b)},${Math.round(((n >> 8) & 255) * b)},${Math.round((n & 255) * b)})`;
    shadeCache.set(key, value);
  }
  return value;
}

/** A face is drawn only while its world normal points towards the camera. */
export function visible(n) {
  return n[0] + n[1] + n[2] * 1.2 > 0.01;
}

/**
 * Brightness from the normal: the top face brightest, +y in between, +x
 * darkest. One light for every direction, so nothing flips when a model turns.
 */
export function bright(n) {
  return Math.max(0.4, Math.min(1, 0.62 + 0.38 * n[2] + 0.14 * n[1] - 0.1 * n[0]));
}

/**
 * The local frame of a model standing at world (wx, wy), `alt` pixels up,
 * facing `dir`, at `scale` cells.
 *
 * Local axes: lx forward and ly sideways, both in cells; z upwards in pixels.
 * A local point is centre + lx · forward + ly · sideways, with sideways =
 * (-forward.y, forward.x), and then the ordinary isometric projection.
 */
export function modelFrame(wx, wy, alt, dir, scale) {
  const f = DIRECTIONS[dir];
  const side = [-f[1], f[0]];
  const world = (lx, ly) => [wx + (lx * f[0] + ly * side[0]) * scale, wy + (lx * f[1] + ly * side[1]) * scale];
  return {
    forward: f,
    side,
    scale,
    alt,
    /** A local point on screen. */
    W: (lx, ly, z) => {
      const [x, y] = world(lx, ly);
      return iso(x, y, alt + z * scale);
    },
    /** A local point in cell coordinates on the ground, for shadows. */
    Wc: (lx, ly) => world(lx, ly),
    /** The same point on the ground, for shadows. */
    Wg: (lx, ly) => {
      const [x, y] = world(lx, ly);
      return iso(x, y, 0);
    },
    /** Depth of a local point, in the same measure the scene sorts by. */
    xy: (lx, ly) => {
      const [x, y] = world(lx, ly);
      return x + y;
    },
    /** A local normal in world axes. */
    wn: (nx, ny, nz) => [nx * f[0] + ny * side[0], nx * f[1] + ny * side[1], nz],
    /** Which way forward runs on screen, as a unit vector. */
    fwdScreen: () => {
      const a = iso(0, 0);
      const b = iso(f[0], f[1]);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    },
  };
}

/**
 * A prism: a cross-section in (lx, z), extruded sideways from ly `a` to `b`.
 * A box is the special case with a rectangular section.
 * @param {boolean} [band]  A decorative band draws only its sides, never its top
 *   or bottom — otherwise it covers the hull it is meant to sit on.
 */
export function prism(ctx, F, section, a, b, colour, lineWidth = 2.4, layer = 0, band = false) {
  let cx = 0;
  let cz = 0;
  for (const [x, z] of section) {
    cx += x;
    cz += z;
  }
  cx /= section.length;
  cz /= section.length;
  return {
    d: F.xy(cx, (a + b) / 2) + layer * 20 + cz * 0.0005,
    draw() {
      // The two ends.
      for (const [ly, ny] of [[b, 1], [a, -1]]) {
        const n = F.wn(0, ny, 0);
        if (visible(n)) poly(ctx, section.map(([x, z]) => F.W(x, ly, z)), shade(colour, bright(n)), C.ink, lineWidth);
      }
      // And one face per edge of the section.
      for (let i = 0; i < section.length; i++) {
        const p = section[i];
        const q = section[(i + 1) % section.length];
        let nx = q[1] - p[1];
        let nz = -(q[0] - p[0]);
        const mx = (p[0] + q[0]) / 2 - cx;
        const mz = (p[1] + q[1]) / 2 - cz;
        if (nx * mx + nz * mz < 0) {
          nx = -nx;
          nz = -nz;
        }
        const len = Math.hypot(nx, nz);
        if (len < 1e-6) continue;
        if (band && Math.abs(nz / len) > 0.5) continue;
        const n = F.wn(nx / len, 0, (nz / len) * (1 / F.scale));
        const nn = Math.hypot(n[0], n[1], n[2]);
        const unit = [n[0] / nn, n[1] / nn, n[2] / nn];
        if (!visible(unit)) continue;
        poly(
          ctx,
          [F.W(p[0], a, p[1]), F.W(q[0], a, q[1]), F.W(q[0], b, q[1]), F.W(p[0], b, p[1])],
          shade(colour, bright(unit)),
          C.ink,
          lineWidth,
        );
      }
    },
  };
}

/** A box, the common case of a prism. */
export function box(ctx, F, x0, x1, y0, y1, z0, z1, colour, lineWidth, layer, band) {
  return prism(ctx, F, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y1, colour, lineWidth, layer, band);
}

/** Pixels of z per cell of radius, so a round body is not an egg in the iso view. */
const RADIUS_Z = 36;

/**
 * A round jet nacelle: a cylinder along lx, radius `r0` at the back and `r1` at
 * the front, with two ribs, a dark intake and an orange glow inside the back.
 */
export function nacelle(ctx, F, lx0, lx1, ly, zc, r0, r1, colour, layer = 0) {
  const n = 12;
  const ring = (lx, r) => {
    const points = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      points.push([lx, ly + Math.cos(t) * r, zc + Math.sin(t) * r * RADIUS_Z, Math.cos(t), Math.sin(t)]);
    }
    return points;
  };
  const A = ring(lx0, r0);
  const B = ring(lx1, r1);
  return {
    d: F.xy((lx0 + lx1) / 2, ly) + layer * 20 + zc * 0.0005,
    draw() {
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const cy = (A[i][3] + A[j][3]) / 2;
        const cz = (A[i][4] + A[j][4]) / 2;
        const nw = F.wn(0, cy, cz);
        if (!visible(nw)) continue;
        poly(
          ctx,
          [F.W(A[i][0], A[i][1], A[i][2]), F.W(A[j][0], A[j][1], A[j][2]), F.W(B[j][0], B[j][1], B[j][2]), F.W(B[i][0], B[i][1], B[i][2])],
          shade(colour, bright(nw)),
          C.ink,
          1.2,
        );
      }
      // The two caps, and the glow down the intake.
      const back = F.wn(-1, 0, 0);
      const front = F.wn(1, 0, 0);
      if (visible(back)) {
        poly(ctx, A.map((p) => F.W(p[0], p[1], p[2])), shade(colour, bright(back)), C.ink, 2.2);
        poly(ctx, A.map((p) => F.W(p[0] - 0.02, ly + (p[1] - ly) * 0.62, zc + (p[2] - zc) * 0.62)), '#241e1a', C.ink, 1.6);
        poly(ctx, A.map((p) => F.W(p[0] - 0.02, ly + (p[1] - ly) * 0.3, zc + (p[2] - zc) * 0.3)), '#ff8a2a', null, 0);
      }
      if (visible(front)) poly(ctx, B.map((p) => F.W(p[0], p[1], p[2])), shade(colour, bright(front)), C.ink, 2.2);
      // Two ribs around it, broken where the body turns away.
      for (const t of [0.3, 0.62]) {
        const lx = lx0 + (lx1 - lx0) * t;
        const r = r0 + (r1 - r0) * t;
        ctx.beginPath();
        let first = true;
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * Math.PI * 2;
          const cy = Math.cos(a);
          const cz = Math.sin(a);
          if (!visible(F.wn(0, cy, cz))) {
            first = true;
            continue;
          }
          const p = F.W(lx, ly + cy * r, zc + cz * r * RADIUS_Z);
          if (first) {
            ctx.moveTo(p[0], p[1]);
            first = false;
          } else {
            ctx.lineTo(p[0], p[1]);
          }
        }
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = C.ink;
        ctx.stroke();
      }
    },
  };
}

/** A part drawn by hand, placed in the same depth order as the bodies. */
export function custom(F, lx, ly, layer, draw) {
  return { d: F.xy(lx, ly) + layer * 20, draw };
}

/** Draws the parts of a model back to front. */
export function renderModel(parts) {
  parts.sort((a, b) => a.d - b.d);
  for (const part of parts) part.draw();
}

/** A round tube between two screen points, ink outline and highlight. */
export function tube(ctx, a, b, width, colour, highlight) {
  ctx.lineCap = 'round';
  for (const [w, stroke] of [[width + 3.4, C.ink], [width, colour]]) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  if (highlight) {
    ctx.strokeStyle = highlight;
    ctx.lineWidth = Math.max(1, width * 0.28);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1] - width * 0.25);
    ctx.lineTo(b[0], b[1] - width * 0.25);
    ctx.stroke();
  }
}


// ---------------------------------------------------------------------------
// Models that turn by any angle, sorted face by face (M9 D2).
//
// The emplacement weapons have to face their target, so they cannot be limited to the four axis
// directions of `modelFrame`. They also stand close to their own parts (barrels in front of
// housings, rings round a coil), where one depth value per body is not enough: a rear face of one
// body would show through the front of another. So here every body hands over its faces, the
// faces that look at the camera are sorted one by one by the depth of their centre along the view
// ray, nearest last, and long faces are cut into pieces first so that the centre of a piece says
// where it really is. The Koloss and the gunship keep their own, simpler pipeline above.
//
// Local axes as for `modelFrame`: lx forward and ly sideways in cells, z up in pixels. A round
// body uses SOLID_K pixels of z per cell of radius, so a barrel is not an egg in the iso view.
// Ported from reference/studien/stellungen-rework-modell.js, which is the binding shape.
// ---------------------------------------------------------------------------

/** Pixels of z per cell, the same measure the projection uses for round bodies. */
export const SOLID_K = 36;
/** The way the camera looks, as a ray in (x, y in cells, z in cells). Matches iso(): z px / 36. */
const FACING = [1, 1, 0.89];
/** Pixels of z that count as one cell of depth along the view ray. */
const DEPTH_Z = 40;
/** Longest edge of a face piece in cells before it is cut. */
const MAX_EDGE = 0.24;
/** The ink of a turned weapon relative to what is authored (it is drawn smaller than authored). */
export const SOLID_INK = 0.62;

/**
 * The local frame of a model standing on the origin, `alt` px up, facing `theta` (radians, 0 along
 * +x in cell coordinates). The caller translates to the place it stands on. `scale` makes the whole
 * model bigger without touching its numbers.
 */
export function turnFrame(theta, alt = 0, scale = 1) {
  const fx = Math.cos(theta);
  const fy = Math.sin(theta);
  const sx = -fy;
  const sy = fx;
  return {
    theta,
    alt,
    f: [fx, fy],
    s: [sx, sy],
    scale,
    /** A local point on screen, relative to the ground point of the model. */
    W: (lx, ly, z) => iso((lx * fx + ly * sx) * scale, (lx * fy + ly * sy) * scale, alt + z * scale),
    /** A local point as world cells, relative to the middle of the model. */
    world: (lx, ly) => [(lx * fx + ly * sx) * scale, (lx * fy + ly * sy) * scale],
    /** A local normal in world axes. */
    wn: (nx, ny, nz) => [nx * fx + ny * sx, nx * fy + ny * sy, nz],
  };
}

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const toTrue = (p) => [p[0], p[1], p[2] / SOLID_K];
const toPx = (p) => [p[0], p[1], p[2] * SOLID_K];

/** Normal of a triangle (true units), turned away from `inside`. */
function triNormal(p0, p1, p2, inside) {
  let n = norm3(cross3(sub3(p1, p0), sub3(p2, p0)));
  if (dot3(n, sub3(p0, inside)) < 0) n = mul3(n, -1);
  return n;
}

const faceFacing = (n) => n[0] * FACING[0] + n[1] * FACING[1] + n[2] * FACING[2] > 0.004;
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const edgeLen = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], (b[2] - a[2]) / SOLID_K);

/** Cuts a plain quad into a grid of pieces; `piece` marks the sides that lie on the outline. */
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
      // Edge flags: bottom (v0), right (u1), top (v1), left (u0).
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
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  } else if (f.piece) {
    // A piece of a cut face: fill it, lay a hair of the same colour over its inner seams so they do
    // not show, and ink only the sides that lie on the outline of the whole face.
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
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  } else {
    poly(ctx, pts, fill, C.ink, width);
  }
  if (f.inner) {
    // Concentric discs on a cap: bore, lens, warhead.
    const mid = f.centre;
    for (const { k, c } of f.inner) {
      poly(ctx, f.p.map((p) => F.W(mid[0] + (p[0] - mid[0]) * k, mid[1] + (p[1] - mid[1]) * k, mid[2] + (p[2] - mid[2]) * k)), c, C.ink, 1.1);
    }
  }
}

function solid(F, faces, colour, layer, lw) {
  const cut = [];
  for (const f of faces) cut.push(...splitFace(f));
  return { F, faces: cut, colour, lw, layer };
}

/** The faces of all parts that look at the camera, with their depth, nearest last. */
function sortedFaces(parts) {
  const items = [];
  for (const part of parts) {
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

/** Draws the bodies of a turned model, every face in its own place in the depth order. */
export function renderSolids(ctx, parts) {
  ctx.lineJoin = 'round';
  for (const it of sortedFaces(parts)) drawFace(ctx, it.F, it.f, it.nw, it.part.colour, it.part.lw);
}

/**
 * The faces in painter's order as screen and world points, for the unit test that compares the
 * order with a depth buffer.
 */
export function faceList(parts) {
  return sortedFaces(parts).map(({ F, f, key, part }) => ({
    key,
    colour: part.colour,
    piece: Boolean(f.piece),
    scr: f.p.map((p) => F.W(p[0], p[1], p[2])),
    hole: f.hole ? f.hole.map((p) => F.W(p[0], p[1], p[2])) : null,
    world: f.p.map((p) => {
      const [wx, wy] = F.world(p[0], p[1]);
      return [wx, wy, F.alt + p[2] * F.scale];
    }),
  }));
}

/**
 * The body builders for one frame of a turned model. Every body also reports corner points to
 * `S`, from which the cached shadow and the bounds of the drawing are worked out.
 * @param {number[][]} S  collects local points [lx, ly, z]
 */
export function solidKit(F, S = []) {
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
      let nx = (q[1] - p[1]) / SOLID_K;
      let nz = -(q[0] - p[0]);
      if (nx * ((p[0] + q[0]) / 2 - cx) + nz * (((p[1] + q[1]) / 2 - cz) / SOLID_K) < 0) {
        nx = -nx;
        nz = -nz;
      }
      const len = Math.hypot(nx, nz);
      if (len < 1e-9) continue;
      if (o.band && Math.abs(nz / len) > 0.5) continue;
      faces.push({ p: [[p[0], a, p[1]], [q[0], a, q[1]], [q[0], b, q[1]], [p[0], b, p[1]]], n: [nx / len, 0, nz / len] });
    }
    for (const [x, z] of section) S.push([x, a, z], [x, b, z]);
    return solid(F, faces, colour, o.layer ?? 0, o.lw ?? 1.8);
  };

  tk.box = (x0, x1, y0, y1, z0, z1, colour, o) => tk.prism([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y1, colour, o);

  /** A rectangular frustum around (cx, cy): half sizes (hx0, hy0) below, (hx1, hy1) above. */
  tk.frustum = (cx, cy, hx0, hy0, hx1, hy1, z0, z1, colour, o = {}) => {
    const dz = (z1 - z0) / SOLID_K;
    const mk = (nx, ny, nz, pts) => ({ p: pts, n: norm3([nx, ny, nz]) });
    const faces = [
      mk(dz, 0, hx0 - hx1, [[cx + hx0, cy - hy0, z0], [cx + hx0, cy + hy0, z0], [cx + hx1, cy + hy1, z1], [cx + hx1, cy - hy1, z1]]),
      mk(-dz, 0, hx0 - hx1, [[cx - hx0, cy + hy0, z0], [cx - hx0, cy - hy0, z0], [cx - hx1, cy - hy1, z1], [cx - hx1, cy + hy1, z1]]),
      mk(0, dz, hy0 - hy1, [[cx - hx0, cy + hy0, z0], [cx + hx0, cy + hy0, z0], [cx + hx1, cy + hy1, z1], [cx - hx1, cy + hy1, z1]]),
      mk(0, -dz, hy0 - hy1, [[cx + hx0, cy - hy0, z0], [cx - hx0, cy - hy0, z0], [cx - hx1, cy - hy1, z1], [cx + hx1, cy - hy1, z1]]),
      mk(0, 0, 1, [[cx - hx1, cy - hy1, z1], [cx + hx1, cy - hy1, z1], [cx + hx1, cy + hy1, z1], [cx - hx1, cy + hy1, z1]]),
    ];
    for (const [x, y, z] of [[hx0, hy0, z0], [hx1, hy1, z1]]) for (const sx of [-1, 1]) for (const sy of [-1, 1]) S.push([cx + sx * x, cy + sy * y, z]);
    return solid(F, faces, colour, o.layer ?? 0, o.lw ?? 1.8);
  };

  /** An upright faceted column (or cone frustum) of radius r0 below and r1 above. */
  tk.column = (cx, cy, r0, r1, z0, z1, colour, o = {}) => {
    const n = o.n ?? 8;
    const dz = (z1 - z0) / SOLID_K;
    const phi = (i) => (o.rot ?? 0) + (i / n) * Math.PI * 2;
    const ring = (r, z) => Array.from({ length: n }, (_, i) => [cx + Math.cos(phi(i)) * r, cy + Math.sin(phi(i)) * r, z]);
    const A = ring(r0, z0);
    const B = ring(r1, z1);
    const faces = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const pm = (phi(i) + phi(j)) / 2;
      faces.push({ p: [A[i], A[j], B[j], B[i]], n: norm3([Math.cos(pm), Math.sin(pm), (r0 - r1) / dz]), k: o.stripe && i % 2 ? 0.86 : 1 });
    }
    if (o.top !== false) faces.push({ p: B.slice(), n: [0, 0, 1] });
    S.push(...A, ...B);
    return solid(F, faces, colour, o.layer ?? 0, o.lw ?? 2);
  };

  /**
   * A faceted tube between two local points (any direction). `capA`/`capB`: false for no cap, or a
   * list of concentric discs [{k, c}] drawn on the cap (bore, lens); `sides: true` leaves both caps
   * out (a band that must not cover what it sits on).
   */
  tk.tube = (A, B, r0, r1, colour, o = {}) => {
    const n = o.n ?? 8;
    const a = toTrue(A);
    const b = toTrue(B);
    const ad = sub3(b, a);
    const len = Math.hypot(ad[0], ad[1], ad[2]) || 1e-6;
    const d = mul3(ad, 1 / len);
    const ref = Math.abs(d[2]) > 0.95 ? [0, 1, 0] : [0, 0, 1];
    const u = norm3(cross3(ref, d));
    const v = cross3(d, u);
    const phi = (i) => (o.rot ?? 0) + (i / n) * Math.PI * 2;
    const ring = (c, r) => Array.from({ length: n }, (_, i) => toPx(add3(c, add3(mul3(u, Math.cos(phi(i)) * r), mul3(v, Math.sin(phi(i)) * r)))));
    const RA = ring(a, r0);
    const RB = ring(b, r1);
    const faces = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const pm = (phi(i) + phi(j)) / 2;
      const radial = add3(mul3(u, Math.cos(pm)), mul3(v, Math.sin(pm)));
      faces.push({ p: [RA[i], RA[j], RB[j], RB[i]], n: norm3(add3(radial, mul3(d, (r0 - r1) / len))), k: o.stripe && i % 2 ? 0.88 : 1 });
    }
    if (!o.sides) {
      if (o.capA !== false) faces.push({ p: RA.slice().reverse(), n: mul3(d, -1), inner: o.capA || null, centre: A });
      if (o.capB !== false) faces.push({ p: RB.slice(), n: d, inner: o.capB || null, centre: B });
    }
    S.push(...RA, ...RB);
    return solid(F, faces, colour, o.layer ?? 0, o.lw ?? 1.8);
  };

  /**
   * A flat ring (annulus) around `c` in the plane spanned by the unit vectors u, v (true units),
   * thick `half` * 2 along w = u x v: the far inner faces, then the outer ones, then the caps.
   */
  tk.ring = (c, u, v, rOut, rIn, half, colour, o = {}) => {
    const n = o.n ?? 12;
    const w = cross3(u, v);
    const ct = toTrue(c);
    const phi = (i) => (i / n) * Math.PI * 2;
    const at = (i, r, side) => toPx(add3(add3(ct, add3(mul3(u, Math.cos(phi(i)) * r), mul3(v, Math.sin(phi(i)) * r))), mul3(w, half * side)));
    const faces = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const pm = (phi(i) + phi(j)) / 2;
      const radial = add3(mul3(u, Math.cos(pm)), mul3(v, Math.sin(pm)));
      faces.push({ p: [at(i, rIn, -1), at(j, rIn, -1), at(j, rIn, 1), at(i, rIn, 1)], n: mul3(radial, -1), c: o.inside });
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const pm = (phi(i) + phi(j)) / 2;
      const radial = add3(mul3(u, Math.cos(pm)), mul3(v, Math.sin(pm)));
      faces.push({ p: [at(i, rOut, -1), at(j, rOut, -1), at(j, rOut, 1), at(i, rOut, 1)], n: radial });
    }
    for (const side of [-1, 1]) {
      faces.push({
        p: Array.from({ length: n }, (_, i) => at(i, rOut, side)),
        hole: Array.from({ length: n }, (_, i) => at(i, rIn, side)),
        n: mul3(w, side),
      });
    }
    for (let i = 0; i < n; i++) S.push(at(i, rOut, 1), at(i, rOut, -1));
    return solid(F, faces, colour, o.layer ?? 0, o.lw ?? 1.6);
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
    return solid(F, faces, colour, o.layer ?? 0, o.lw ?? 1.6);
  };

  return tk;
}

export { ell };
