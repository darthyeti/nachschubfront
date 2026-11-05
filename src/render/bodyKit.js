// A small kit of convex bodies for turnable creatures (docs/ART.md, "Drehbare Modelle").
//
// The game's solidKit (model.js) cuts long faces into pieces so that every face can be sorted on
// its own. That is what a weapon needs that turns by any angle among its own parts, and it costs
// four to sixteen fills per face. A creature made of bodies that lie beside each other does not
// need it: bodies are sorted by their middle, and each body draws the faces that look at the
// camera. The faces of one convex body never cover each other, so their order inside it does not
// matter. Parts that are not bodies (limbs, blades) are drawn in code and take their place in the
// same depth order.
//
// Local axes as in model.js: lx forward and ly sideways in cells, z up in px.

import { turnFrame, shade, bright, SOLID_K } from './model.js';
import { C } from './palette.js';

/** The camera's view ray and depth measure, as in model.js (renderSolids). */
const FACING = [1, 1, 0.89];
const DEPTH_Z = 40;
const facing = (n) => n[0] * FACING[0] + n[1] * FACING[1] + n[2] * FACING[2] > 0.004;

/** Colour of a face: shaded by its normal, or washed towards `white` while a hit flashes. */
function tone(hex, b, flash, white) {
  if (!flash) return shade(hex, b);
  const n = parseInt(hex.slice(1), 16);
  const mix = (v, w) => Math.round(v * b * 0.45 + w * 0.55);
  return `rgb(${mix((n >> 16) & 255, white[0])},${mix((n >> 8) & 255, white[1])},${mix(n & 255, white[2])})`;
}

function polyPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

const K = SOLID_K;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], (a[2] - b[2]) / K];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const mean = (pts) => {
  const m = [0, 0, 0];
  for (const q of pts) for (let i = 0; i < 3; i++) m[i] += q[i] / pts.length;
  return m;
};

/** A face with its outward normal (true units: z / K), turned away from the body's middle `c`. */
function face(pts, c) {
  let n = unit(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  if (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]) < 1e-9 && pts.length > 3) n = unit(cross(sub(pts[2], pts[1]), sub(pts[3], pts[1])));
  const m = mean(pts);
  const out = sub(m, c);
  if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) n = [-n[0], -n[1], -n[2]];
  return { p: pts, n };
}

/** The kit for one frame F. Every body goes into `bodies`. */
function kit(F, bodies) {
  const add = (faces, centre, colour, o = {}) => {
    const [wx, wy] = F.world(centre[0], centre[1]);
    const body = { F, faces, colour, lw: o.lw ?? 2, key: wx + wy + (F.alt + centre[2] * F.scale) / DEPTH_Z + (o.layer ?? 0) * 0.05 };
    bodies.push(body);
    return body;
  };
  const tk = {};
  /** A body between two rings of local points (same count): the sides, and the caps unless `band`. */
  tk.loft = (A, B, colour, o = {}) => {
    const c = mean([...A, ...B]);
    const faces = [];
    for (let i = 0; i < A.length; i++) {
      const j = (i + 1) % A.length;
      // The closing side of an open section (a shell standing on the ground) is never seen.
      if (o.skipLast && i === A.length - 1) continue;
      faces.push(face([A[i], A[j], B[j], B[i]], c));
    }
    if (!o.band) {
      if (o.capA !== false) faces.push(face(A.slice(), c));
      if (o.capB !== false) faces.push(face(B.slice(), c));
    }
    return add(faces, c, colour, o);
  };
  /** A shell along lx: a section in (ly, z) from x0 to x1, scaled about its foot by s0 and s1. */
  tk.shellX = (section, x0, x1, s0, s1, colour, o) => {
    const ring = (x, s) => section.map(([ly, z]) => [x, ly * s, z * s]);
    return tk.loft(ring(x0, s0), ring(x1, s1), colour, o);
  };
  /** A prism across ly: a section in (lx, z) from ly a to b (the plough). */
  tk.prismY = (section, a, b, colour, o) =>
    tk.loft(section.map(([x, z]) => [x, a, z]), section.map(([x, z]) => [x, b, z]), colour, o);
  /** A round body between two local points, radius r0 to r1 in cells; `n` sides. */
  tk.tube = (P, Q, r0, r1, colour, o = {}) => {
    const n = o.n ?? 8;
    const d = unit([Q[0] - P[0], Q[1] - P[1], (Q[2] - P[2]) / K]);
    const ref = Math.abs(d[2]) > 0.95 ? [0, 1, 0] : [0, 0, 1];
    const u = unit(cross(ref, d));
    const v = cross(d, u);
    const ring = (C0, r) =>
      Array.from({ length: n }, (_, i) => {
        const t = (o.rot ?? 0) + (i / n) * Math.PI * 2;
        return [C0[0] + (u[0] * Math.cos(t) + v[0] * Math.sin(t)) * r, C0[1] + (u[1] * Math.cos(t) + v[1] * Math.sin(t)) * r, C0[2] + (u[2] * Math.cos(t) + v[2] * Math.sin(t)) * r * K];
      });
    return tk.loft(ring(P, r0), ring(Q, r1), colour, o);
  };
  /** A faceted crystal (eyes): a pyramid on one ring, with a second below when `down` > 0. */
  tk.gem = (c, r, up, down, colour, o = {}) => {
    const n = o.n ?? 6;
    const ring = Array.from({ length: n }, (_, i) => [c[0] + Math.cos((i / n) * Math.PI * 2) * r, c[1] + Math.sin((i / n) * Math.PI * 2) * r, c[2]]);
    const top = [c[0], c[1], c[2] + up];
    const bottom = [c[0], c[1], c[2] - down];
    const faces = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      faces.push(face([ring[i], ring[j], top], c));
      if (down > 0) faces.push(face([ring[j], ring[i], bottom], c));
    }
    return add(faces, c, colour, { lw: 1.4, ...o });
  };
  return tk;
}

/**
 * A scene of one model: bodies from the kit plus parts drawn in code, sorted together.
 * `stats` (optional) receives what one frame cost: faces drawn, parts drawn in code, faces built.
 */
export function createBodyScene(ctx, { flash = false, white = [255, 246, 228] } = {}) {
  const bodies = [];
  const customs = [];
  return {
    kit: (F) => kit(F, bodies),
    /** A part drawn in code at local point (lx, ly, z) of frame F, sorted like a body there. */
    custom(F, lx, ly, z, draw) {
      const [wx, wy] = F.world(lx, ly);
      customs.push({ key: wx + wy + (F.alt + z * F.scale) / DEPTH_Z, draw });
    },
    render(stats) {
      const items = [...bodies, ...customs].sort((a, b) => a.key - b.key);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      let faces = 0;
      let code = 0;
      let built = 0;
      for (const it of items) {
        if (it.draw) {
          it.draw();
          code++;
          continue;
        }
        built += it.faces.length;
        for (const f of it.faces) {
          const nw = it.F.wn(f.n[0], f.n[1], f.n[2]);
          if (!facing(nw)) continue;
          polyPath(ctx, f.p.map((q) => it.F.W(q[0], q[1], q[2])));
          ctx.fillStyle = tone(it.colour, bright(nw), flash, white);
          ctx.fill();
          ctx.lineWidth = it.lw;
          ctx.strokeStyle = C.ink;
          ctx.stroke();
          faces++;
        }
      }
      if (stats) Object.assign(stats, { faces, code, built, bodies: bodies.length });
    },
  };
}

/** An inked limb through screen points (ink under colour, bone joints), like the legs of the brood. */
export function limb(ctx, pts, width, colour, { flash = false, jointColour = '#d8c9a8', hitColour = '#efe4cc', joints = true } = {}) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, stroke] of [[width + 3.4, C.ink], [width, flash ? hitColour : colour]]) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = w;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  if (!joints) return;
  ctx.fillStyle = jointColour;
  for (let i = 1; i < pts.length - 1; i++) {
    ctx.beginPath();
    ctx.arc(pts[i][0], pts[i][1], Math.max(1.2, width * 0.38), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A curved blade or claw as a filled outline (bone, inked), through screen points. */
export function blade(ctx, pts, fill, flash = false, hitColour = '#fff6e4') {
  polyPath(ctx, pts);
  ctx.fillStyle = flash ? hitColour : fill;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
}

export { turnFrame };
