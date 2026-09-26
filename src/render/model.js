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

export { ell };
