// Study models for issue 75: the Koloss as a swarm beast (reference/studien/koloss-schwarm.html).
//
// Three designs of a giant creature of the brood, each a turnable model built from bodies in local
// coordinates (docs/ART.md, "Drehbare Modelle"). Frame, shading and colour cache come from
// src/render/model.js (turnFrame, bright, shade), so the model can stand at any angle while it
// turns on the spot; the bodies are a small kit below.
//
// Legs, mandibles, scythes and claws are not part of the model: their joints are worked out in
// code every frame from the gait phase (CLAUDE.md, "Statische Teile als Sprite, Bewegung im
// Code"), and drawn as inked tubes like the legs in the brood's SVGs. They take their place in the
// same depth order as the faces.
//
// Local axes as in model.js: lx forward and ly sideways in cells, z up in px.
// Nothing here touches the game; src/ is only read.

import { iso } from '../../src/render/iso.js';
import { turnFrame, shade, bright, SOLID_K } from '../../src/render/model.js';
import { C } from '../../src/render/palette.js';

/** Colours of the brood, taken from the enemy SVGs in reference/konzept/gegner/. */
export const BROOD = {
  chitinD: '#3e3026',
  chitin: '#5f4a38',
  chitinL: '#7a604a',
  bone: '#d8c9a8',
  boneD: '#b9a882',
  flesh: '#7a2a20',
  ember: '#ff8a2a',
  emberL: '#ffd06a',
  eye: '#ff6a2a',
  sac: '#8a4a32',
};

/** The camera's view ray and depth measure, as in model.js (renderSolids). */
const FACING = [1, 1, 0.89];
const DEPTH_Z = 40;
const facing = (n) => n[0] * FACING[0] + n[1] * FACING[1] + n[2] * FACING[2] > 0.004;

/** Colour of a face: shaded by its normal, or washed towards bone white while a hit flashes. */
function tone(hex, b, flash) {
  if (!flash) return shade(hex, b);
  const n = parseInt(hex.slice(1), 16);
  const mix = (v, w) => Math.round(v * b * 0.45 + w * 0.55);
  return `rgb(${mix((n >> 16) & 255, 255)},${mix((n >> 8) & 255, 246)},${mix(n & 255, 228)})`;
}

function polyPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

// ---------- Bodies ----------
// A small kit of convex bodies made of whole faces. The game's solidKit (model.js) cuts long faces
// into pieces so that every face can be sorted on its own; that is what a weapon turning by any
// angle among its own parts needs, and it costs four to sixteen fills per face. A creature this size
// is made of bodies that lie beside each other, so here bodies are sorted by their middle (as the
// game's Koloss is, model.js renderModel) and every body draws its faces that look at the camera.
// Faces of one convex body never cover each other, so their order inside it does not matter.

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
  /**
   * A body between two rings of local points (same count): the sides, and the caps unless `band`.
   * Stripes darken every other side face.
   */
  tk.loft = (A, B, colour, o = {}) => {
    const c = mean([...A, ...B]);
    const faces = [];
    for (let i = 0; i < A.length; i++) {
      const j = (i + 1) % A.length;
      const f = face([A[i], A[j], B[j], B[i]], c);
      if (o.stripe && i % 2) f.k = 0.86;
      faces.push(f);
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
  /** A prism across ly: a section in (lx, z) from ly a to b (the plough, a rim). */
  tk.prismY = (section, a, b, colour, o) =>
    tk.loft(section.map(([x, z]) => [x, a, z]), section.map(([x, z]) => [x, b, z]), colour, o);
  tk.box = (x0, x1, y0, y1, z0, z1, colour, o) => tk.prismY([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y1, colour, o);
  /** A round body between two local points, radius r0 to r1 in cells; `n` sides. */
  tk.tube = (P, Q, r0, r1, colour, o = {}) => {
    const n = o.n ?? 8;
    const a = [P[0], P[1], P[2] / K];
    const d = unit([Q[0] - P[0], Q[1] - P[1], (Q[2] - P[2]) / K]);
    const ref = Math.abs(d[2]) > 0.95 ? [0, 1, 0] : [0, 0, 1];
    const u = unit(cross(ref, d));
    const v = cross(d, u);
    const ring = (C0, r) =>
      Array.from({ length: n }, (_, i) => {
        const t = (o.rot ?? 0) + (i / n) * Math.PI * 2;
        return [C0[0] + (u[0] * Math.cos(t) + v[0] * Math.sin(t)) * r, C0[1] + (u[1] * Math.cos(t) + v[1] * Math.sin(t)) * r, C0[2] + (u[2] * Math.cos(t) + v[2] * Math.sin(t)) * r * K];
      });
    void a;
    return tk.loft(ring(P, r0), ring(Q, r1), colour, o);
  };
  /** An upright column of `n` sides around (cx, cy). */
  tk.column = (cx, cy, r0, r1, z0, z1, colour, o = {}) => tk.tube([cx, cy, z0], [cx, cy, z1], r0, r1, colour, { ...o, capA: false });
  /** A faceted crystal (eyes, sacs): two pyramids on one ring. */
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
 * A scene of one model: bodies from the kit, plus parts drawn in code. `stats` counts what one
 * frame costs: faces drawn, parts drawn in code, bodies built.
 */
function makeScene(ctx, flash) {
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
          ctx.fillStyle = tone(it.colour, bright(nw) * (f.k ?? 1), flash);
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

/** An inked limb through screen points, like the legs of the brood (ink under colour, bone joints). */
function limb(ctx, pts, width, colour, flash, joints = true) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, stroke] of [[width + 3.4, C.ink], [width, flash ? '#efe4cc' : colour]]) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = w;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  if (!joints) return;
  ctx.fillStyle = BROOD.bone;
  for (let i = 1; i < pts.length - 1; i++) {
    ctx.beginPath();
    ctx.arc(pts[i][0], pts[i][1], Math.max(1.2, width * 0.38), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A curved blade or claw as a filled outline (bone, inked), through screen points. */
function blade(ctx, pts, flash, fill = BROOD.bone) {
  polyPath(ctx, pts);
  ctx.fillStyle = flash ? '#fff6e4' : fill;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (t) => t * t * (3 - 2 * t);
/** Shortest turn from angle a to b. */
const turnTo = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

// ---------------------------------------------------------------------------
// Pose: what the page hands over every frame.
//   theta     direction it faces now (radians, 0 = +x)
//   from, turn   while it turns on the spot: the old direction and progress 0..1, else turn = 1
//   gait      gait phase in cycles, driven by distance walked (and by turning)
//   moving    true while it walks or turns: legs step, otherwise they stand
//   breach    0..1, how hard it is pushing through rubble right now
//   t         seconds, for idle motion (breathing, glow)
//   flash     true while a hit flashes
//   still     prefers-reduced-motion or stunned: no idle motion
// ---------------------------------------------------------------------------

/** An arched section in (ly, z): a shell `hw` half wide and `h` high, standing on `z0`. */
function arch(hw, h, z0 = 4, flat = 0.38) {
  return [[-hw, z0], [-hw, z0 + (h - z0) * 0.42], [-hw * 0.8, z0 + (h - z0) * 0.8], [-hw * flat, h], [hw * flat, h], [hw * 0.8, z0 + (h - z0) * 0.8], [hw, z0 + (h - z0) * 0.42], [hw, z0]];
}

/** A leg: hip, knee and foot as local points, drawn as an inked limb. */
function leg(ctx, scene, F, pts, width, pose, key) {
  scene.custom(F, key[0], key[1], key[2], () => limb(ctx, pts.map((q) => F.W(q[0], q[1], q[2])), width, BROOD.chitinD, pose.flash));
}

/**
 * A: the Grabwalze. A long, low, segmented crawler with a bone plough for a skull and a row of
 * spines along its back. Five shell segments with bone rims, five pairs of short legs in a wave.
 */
function grabwalze(ctx, pose, scene) {
  const segs = [
    { cx: 0.6, hw: 0.7, h: 44, hl: 0.3 },
    { cx: 0.04, hw: 0.68, h: 50, hl: 0.3 },
    { cx: -0.5, hw: 0.62, h: 46, hl: 0.29 },
    { cx: -1.02, hw: 0.52, h: 38, hl: 0.27 },
    { cx: -1.48, hw: 0.4, h: 29, hl: 0.24 },
  ];
  const breathe = pose.still ? 0 : Math.sin(pose.t * 2.2) * 1.2;
  // While it turns, the skull leads and the tail follows: each segment reaches the new direction a
  // little later, all of them within the turn (0.6 s per quarter turn in the game).
  const angle = (i) => (pose.turn >= 1 ? pose.theta : turnTo(pose.from, pose.theta, smooth(clamp01(pose.turn * 1.7 - (i + 1) * 0.12))));
  const headF = turnFrame(angle(-1));
  const H = scene.kit(headF);

  // Skull: the plough in front, sloped back, and the head capsule with its eyes behind it.
  // The plough is a wedge, its edge forward in the middle: it splits the rubble to both sides.
  const side = [[0.96, 2], [1.62, 0], [1.54, 12], [1.22, 32], [0.96, 38]];
  const mid = [[0.96, 2], [1.94, 0], [1.84, 14], [1.36, 38], [0.96, 44]];
  for (const s of [-1, 1]) {
    H.loft(side.map(([x, z]) => [x, s * 0.76, z]), mid.map(([x, z]) => [x, 0, z]), BROOD.bone, { lw: 2.2, layer: 0.2 });
  }
  H.shellX(arch(0.5, 44 + breathe, 18), 0.82, 1.18, 1, 0.82, BROOD.chitinD, { lw: 2 });
  for (const ly of [-0.24, 0.24]) H.gem([1.14, ly, 42], 0.07, 5, 0, BROOD.eye, { n: 5, layer: 0.5 });

  segs.forEach((s, i) => {
    const F = turnFrame(angle(i));
    const T = scene.kit(F);
    const h = s.h + breathe * (1 - i * 0.15);
    // Shell, wider at the back so the plates lie over each other like shingles, a bone rim at its
    // rear edge, and flesh between the plates.
    T.shellX(arch(s.hw * 0.86, 12, 2, 0.8), s.cx - s.hl * 0.9, s.cx + s.hl * 0.9, 1, 1, BROOD.flesh, { lw: 1.6 });
    T.shellX(arch(s.hw, h), s.cx - s.hl, s.cx + s.hl, 1.04, 0.92, BROOD.chitin, { lw: 2.2 });
    T.shellX(arch(s.hw, h), s.cx - s.hl - 0.02, s.cx - s.hl + 0.07, 1.08, 1.07, BROOD.boneD, { band: true, lw: 1.6, layer: 0.1 });
    // The spine along the back, leaning backwards, and two side spines on the front three.
    T.tube([s.cx - 0.02, 0, h - 3], [s.cx - 0.28, 0, h + 26 - i * 3], 0.08, 0.012, BROOD.bone, { n: 5, capA: false, layer: 0.3 });
    if (i < 3) {
      for (const side of [-1, 1]) {
        T.tube([s.cx, side * s.hw * 0.82, h * 0.6], [s.cx - 0.16, side * (s.hw + 0.26), h * 0.6 + 12], 0.05, 0.01, BROOD.bone, { n: 4, capA: false, layer: 0.2 });
      }
    }
    // A pair of short legs under every segment, stepping in a wave from the skull back.
    for (const side of [-1, 1]) {
      const p = (pose.gait - i * 0.18 + (side > 0 ? 0.5 : 0)) * Math.PI * 2;
      const stride = pose.moving ? Math.sin(p) * 0.15 : 0;
      const lift = pose.moving ? Math.max(0, Math.cos(p)) * 7 : 0;
      const hip = [s.cx, side * s.hw * 0.8, 10];
      const knee = [s.cx + stride * 0.4, side * (s.hw + 0.22), 19 + lift];
      const foot = [s.cx + stride + 0.06, side * (s.hw + 0.44), lift * 0.6];
      leg(ctx, scene, F, [hip, knee, foot], 3.8, pose, [s.cx, side * (s.hw + 0.3), 12]);
    }
  });
  // Tail tip.
  scene.kit(turnFrame(angle(5))).tube([-1.66, 0, 16], [-2.0, 0, 10], 0.22, 0.05, BROOD.chitinD, { n: 6 });

  // Mandibles beside the plough, in code: they close slowly, and snap while it breaks through.
  const bite = pose.still ? 0.3 : 0.3 + 0.3 * Math.sin(pose.t * (pose.breach > 0 ? 9 : 1.6));
  for (const side of [-1, 1]) {
    const F = headF;
    scene.custom(F, 1.75, side * 0.8, 10, () => {
      const pts = [[1.3, side * 0.72, 14], [1.78, side * (0.86 - bite * 0.1), 9], [2.04, side * (0.52 - bite * 0.3), 3], [1.78, side * (0.72 - bite * 0.12), 12], [1.5, side * 0.68, 16]];
      blade(ctx, pts.map((q) => F.W(q[0], q[1], q[2])), pose.flash);
    });
  }
}

/**
 * B: the Stelzwächter. A body carried high on six long legs, knees above the back, with two
 * scythe arms that rake the ground in front: tall, open, and visible over a maze.
 */
function stelzwaechter(ctx, pose, scene) {
  const F = turnFrame(pose.turn >= 1 ? pose.theta : turnTo(pose.from, pose.theta, smooth(pose.turn)));
  const T = scene.kit(F);
  const sway = pose.moving && !pose.still ? Math.sin(pose.gait * Math.PI * 4) * 2 : 0;
  const lift = 56 + sway;
  // Thorax, head with four eyes, and the abdomen rising behind like a hood.
  T.tube([-0.12, 0, lift + 12], [0.56, 0, lift + 16], 0.4, 0.3, BROOD.chitin, { n: 8 });
  T.tube([0.56, 0, lift + 16], [0.94, 0, lift + 12], 0.24, 0.14, BROOD.chitinD, { n: 7 });
  for (const ly of [-0.14, -0.05, 0.05, 0.14]) T.gem([0.86, ly, lift + 24], 0.04, 3, 0, BROOD.eye, { n: 4, layer: 0.5 });
  T.tube([-0.12, 0, lift + 14], [-0.66, 0, lift + 28], 0.42, 0.56, BROOD.chitinL, { n: 8, capA: false });
  T.tube([-0.66, 0, lift + 28], [-1.24, 0, lift + 56], 0.56, 0.1, BROOD.chitinL, { n: 8, capA: false, stripe: true });
  // Bone plates down the abdomen and a crest on the thorax.
  for (const [lx, z] of [[-0.3, 30], [-0.62, 42], [-0.92, 50], [0.24, 28]]) {
    T.tube([lx, 0, lift + z - 6], [lx - 0.22, 0, lift + z + 16], 0.08, 0.015, BROOD.bone, { n: 5, capA: false, layer: 0.3 });
  }

  // Six legs: tripod gait, knees well above the back, feet a cell out to the sides.
  [0.42, 0.08, -0.3].forEach((lx, i) => {
    for (const side of [-1, 1]) {
      const group = (i + (side > 0 ? 1 : 0)) % 2;
      const p = (pose.gait + group * 0.5) * Math.PI * 2;
      const stride = pose.moving ? Math.sin(p) * 0.22 : 0;
      const up = pose.moving ? Math.max(0, Math.cos(p)) * 12 : 0;
      const spread = (i - 1) * 0.46;
      const hip = [lx, side * 0.3, lift + 10];
      const knee = [lx + spread * 0.6 + stride * 0.4, side * 0.86, lift + 46 + up * 0.5];
      const foot = [lx + spread + stride, side * 1.12, up];
      leg(ctx, scene, F, [hip, knee, foot], 5.4, pose, [lx + spread * 0.5, side * 0.8, (lift + 20) * 0.7]);
    }
  });

  // Two scythes in front: they rake down and outwards, harder while it breaks through.
  const rake = pose.still ? 0.2 : pose.breach > 0 ? 0.5 + 0.5 * Math.sin(pose.t * 7) : 0.2 + 0.1 * Math.sin(pose.t * 1.3);
  for (const side of [-1, 1]) {
    const sh = [0.5, side * 0.28, lift + 14];
    const el = [1.02, side * 0.5, lift + 42 - rake * 10];
    const tip = [1.52 + rake * 0.15, side * (0.36 + rake * 0.4), 6 + (1 - rake) * 20];
    scene.custom(F, 1.1, side * 0.5, lift * 0.5, () => {
      const [ps, pe, pt] = [sh, el, tip].map((q) => F.W(q[0], q[1], q[2]));
      limb(ctx, [ps, pe], 5, BROOD.chitinD, pose.flash);
      const back = F.W(el[0] + 0.12, el[1], el[2] - 10);
      const mid = F.W((el[0] + tip[0]) / 2 + 0.16, (el[1] + tip[1]) / 2, (el[2] + tip[2]) / 2 + 6);
      blade(ctx, [pe, mid, pt, back], pose.flash);
    });
  }
}

/**
 * C: the Brutberg. A wide, low crab of a body carrying the brood on its back: three chimneys of
 * flesh with glowing mouths, sacs at their feet, and two great claws held low in front as a plough.
 */
function brutberg(ctx, pose, scene) {
  const F = turnFrame(pose.turn >= 1 ? pose.theta : turnTo(pose.from, pose.theta, smooth(pose.turn)));
  const T = scene.kit(F);
  const breathe = pose.still ? 0 : Math.sin(pose.t * 1.8) * 1.5;
  T.shellX(arch(0.66, 14, 3, 0.8), -1.0, 0.9, 1, 1, BROOD.flesh, { lw: 1.6 });
  T.shellX(arch(0.84, 40 + breathe, 8, 0.5), -1.16, 0.94, 0.84, 1, BROOD.chitin, { lw: 2.4 });
  // Bone rim in front, where the claws sit.
  T.prismY([[0.9, 8], [1.16, 10], [1.08, 28], [0.9, 34]], -0.8, 0.8, BROOD.bone, { lw: 2, layer: 0.2 });
  // The brood: three chimneys, sacs at their feet.
  const chimneys = [[-0.42, -0.24, 50, 0.2], [-0.78, 0.26, 40, 0.17], [0.06, 0.22, 30, 0.15]];
  for (const [lx, ly, tall, r] of chimneys) {
    T.column(lx, ly, r, r * 0.62, 34, 40 + tall + breathe, BROOD.sac, { n: 7, stripe: true, layer: 0.4 });
  }
  for (const [lx, ly] of [[-0.2, -0.46], [-0.58, -0.02], [-0.92, -0.36], [0.3, -0.1]]) T.gem([lx, ly, 38], 0.14, 9, 0, BROOD.flesh, { n: 6, layer: 0.3 });
  // Glow in the mouths: drawn in code, it breathes.
  for (const [lx, ly, tall, r] of chimneys) {
    const z = 40 + tall + breathe + 0.5;
    scene.custom(F, lx, ly, z + 60, () => {
      const c = F.W(lx, ly, z);
      const glow = pose.still ? 0.7 : 0.55 + 0.45 * Math.abs(Math.sin(pose.t * 2.4 + lx * 3));
      ctx.globalAlpha = 0.3 * glow;
      ctx.fillStyle = BROOD.ember;
      ctx.beginPath();
      ctx.ellipse(c[0], c[1] - 4, r * 46, r * 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.ellipse(c[0], c[1], r * 0.62 * 30, r * 0.62 * 15, 0, 0, Math.PI * 2);
      ctx.fillStyle = glow > 0.8 ? BROOD.emberL : BROOD.ember;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
    });
  }

  // Four pairs of short, thick legs, splayed like a crab's; alternating.
  [0.5, 0.12, -0.28, -0.68].forEach((lx, i) => {
    for (const side of [-1, 1]) {
      const p = (pose.gait + ((i + (side > 0 ? 1 : 0)) % 2) * 0.5) * Math.PI * 2;
      const stride = pose.moving ? Math.sin(p) * 0.16 : 0;
      const up = pose.moving ? Math.max(0, Math.cos(p)) * 8 : 0;
      const hip = [lx, side * 0.74, 18];
      const knee = [lx + stride * 0.3, side * 1.12, 36 + up * 0.5];
      const foot = [lx + stride - (i - 1.5) * 0.1, side * 1.32, up];
      leg(ctx, scene, F, [hip, knee, foot], 5.4, pose, [lx, side * 1.0, 14]);
    }
  });

  // Claws: an arm forward and low, a pincer that opens and shuts (fast while breaking through).
  const open = pose.still ? 0.4 : 0.4 + 0.35 * Math.sin(pose.t * (pose.breach > 0 ? 8 : 1.4));
  for (const side of [-1, 1]) {
    const sh = [0.96, side * 0.5, 22];
    const wr = [1.42, side * 0.66, 14];
    const upper = [1.95, side * (0.46 - open * 0.08), 10 + open * 6];
    const lower = [1.86, side * (0.78 + open * 0.08), 2];
    scene.custom(F, 1.5, side * 0.66, 30, () => {
      const [ps, pw, pu, pl] = [sh, wr, upper, lower].map((q) => F.W(q[0], q[1], q[2]));
      limb(ctx, [ps, pw], 7, BROOD.chitin, pose.flash, false);
      blade(ctx, [pw, F.W(1.5, side * 0.62, 20), pu, F.W(1.62, side * 0.62, 12)], pose.flash);
      blade(ctx, [pw, F.W(1.55, side * 0.8, 10), pl, F.W(1.6, side * 0.7, 6)], pose.flash, BROOD.boneD);
    });
  }
}

/** The designs, in the order of the page. `foot` is the ground footprint for the cast shadow. */
export const DESIGNS = {
  walze: {
    name: 'Grabwalze',
    letter: 'A',
    draw: grabwalze,
    foot: [[-1.95, -0.6], [1.85, -0.72], [1.85, 0.72], [-1.95, 0.6]],
    shadowHeight: 40,
  },
  stelze: {
    name: 'Stelzwächter',
    letter: 'B',
    draw: stelzwaechter,
    foot: [[-1.2, -0.5], [1.1, -0.5], [1.1, 0.5], [-1.2, 0.5]],
    shadowHeight: 96,
  },
  brut: {
    name: 'Brutberg',
    letter: 'C',
    draw: brutberg,
    foot: [[-1.2, -0.8], [1.3, -0.8], [1.3, 0.8], [-1.2, 0.8]],
    shadowHeight: 56,
  },
};

/**
 * Draws a design standing on the ground point it is translated to. Returns the stats of the frame.
 * The caller puts the cast shadow under it (it needs world coordinates).
 */
export function drawDesign(ctx, id, pose, stats) {
  const scene = makeScene(ctx, pose.flash);
  DESIGNS[id].draw(ctx, pose, scene);
  scene.render(stats);
  return scene;
}

/** The footprint of a design turned to `theta`, as world cells around (wx, wy). */
export function footprint(id, wx, wy, theta) {
  const F = turnFrame(theta);
  return DESIGNS[id].foot.map(([lx, ly]) => {
    const [x, y] = F.world(lx, ly);
    return [wx + x, wy + y];
  });
}

export { iso, SOLID_K };
