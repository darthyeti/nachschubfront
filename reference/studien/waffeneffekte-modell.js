// Study A-37 (issue 71): the new pieces of the weapon effects study.
//
// 1. The siege mortar as a twin rocket launcher (working title "Raketenturm", file E-39 decides the
//    name): the carriage of today's mortar, on it two big launch tubes side by side, each with a
//    rocket whose nose stands out of the mouth, and a seeker head on the spine between them. A model
//    from bodies in local coordinates, like spezialstellungen-rework-modell.js and src/render/specials.js
//    (lx forward and ly sideways in cells, z up in px above the roof plate, round bodies with SOLID_K
//    px of z per cell). The simulation is untouched: one shell per shot, aim 0.8 s, reload 3.2 s. The
//    two rockets go off in turn, one per shot; the empty tube is loaded again over the reload, the
//    other waits ready.
//
// 2. The new effects, all drawn in world px on the camera transform, in the style of the stiltest:
//    ink under colour under a light core, glow only from half-transparent shapes and gradients, no
//    shadowBlur. Every size is a number in NEU, so the scale table of the study can print it.
//
// Nothing here is game code; src/ stays as it is. The study only imports from it.

import { solidKit, SOLID_K as K } from '../../src/render/model.js';
import { ell } from '../../src/render/draw.js';
import { C } from '../../src/render/palette.js';

const INK = C.ink;
const TAU = Math.PI * 2;

// Steel tones of the capsule, as in src/render/specials.js.
const STEEL = '#a6adb8';
const STEEL_M = '#8d94a0';
const STEEL_D = '#717884';
const STEEL_DD = '#4a505b';
const DARK = '#2a2d33';
const COPPER = '#b2723d';
const GOLD = '#e0b83e';

// ======================================================================================
// The proposal in numbers (world px at zoom 1 unless named otherwise)
// ======================================================================================

export const NEU = {
  /** Laser: ink, colour, core at full strength; it fades over `seconds`. */
  laser: { ink: 5, colour: 3, core: 1.2, seconds: 0.16, past: 0.35, rest: { width: 1.6, alpha: 0.38 }, hitGlow: 12 },
  /** Soul beam of the obelisk. */
  soul: { ink: 7, violet: 4.4, heart: 2, core: 0.8, wobble: 1.4, hitGlow: 18 },
  /** Lightning: a fine jagged line with more kinks, and a half-transparent electric aura round it. */
  bolt: {
    ink: 2.4, colour: 1.3, core: 0.55, steps: 11, jitter: 11,
    aura: [{ width: 11, alpha: 0.13 }, { width: 5.5, alpha: 0.22 }],
    filaments: 2, filamentJitter: 7, hitGlow: 13,
  },
  /** Tracer of the autocannon and the storm battery: a fixed length instead of a share of the path. */
  tracer: { ink: 3, colour: 1.6, core: 0.7, length: 0.5 },
  /** Rocket of the six-tube launcher in flight. */
  rocket: { ink: 4.2, body: 2.4, tail: 7, warhead: 1.8, flame: [3.4, 2.2] },
  /** Big rocket of the siege launcher in flight. */
  bigRocket: { ink: 6.2, body: 3.8, tail: 12, warhead: 2.9, flame: [6, 3.6], fin: 3 },
  /** Fire aura at the muzzle: a soft disc and a thin ring that opens, by weapon, radius px and seconds. */
  aura: {
    autocannon: { r: 9, s: 0.07 },
    mortar: { r: 15, s: 0.16 },
    tesla: { r: 13, s: 0.14 },
    laser: { r: 12, s: 0.16 },
    stormBattery: { r: 8, s: 0.06 },
    emberCauldron: { r: 14, s: 0.16 },
    siegeMortar: { r: 22, s: 0.22 },
    thunderTower: { r: 16, s: 0.16 },
    soulfireObelisk: { r: 17, s: 0.22 },
  },
  /** Reticle of the siege launcher on the target: radius px from start to lock, ink and colour width. */
  reticle: { from: 24, to: 11, ink: 3.2, colour: 1.6, arm: 0.42 },
};

// ======================================================================================
// The siege mortar as a twin rocket launcher
// ======================================================================================

/** Measures of the new model; z in px above the roof plate, before the scale. */
export const RT = {
  elevation: (38 * Math.PI) / 180,
  pivot: [0, 0, 27],
  /** Sideways offset of the two tubes, cells. */
  tubeY: [-0.112, 0.112],
  tubeR: 0.094,
  /** The tube along its axis from the pivot, cells: from `back` to `front`. */
  back: -0.22,
  front: 0.46,
  /** Rocket nose: radius at the mouth, length out of the tube when loaded, cells. */
  noseR: 0.078,
  noseLen: 0.26,
  /** How far back a rocket sits while it is still being loaded (cells), at load 0. */
  loadTravel: 0.22,
  recoil: 0.06,
  /** Share of the reload over which the empty tube is loaded, from and to (0 is the shot). */
  loadFrom: 0.25,
  loadTo: 0.7,
};

const rtAxis = () => {
  const c = Math.cos(RT.elevation);
  const s = Math.sin(RT.elevation);
  return { c, s, a: [c, 0, s], up: [-s, 0, c] };
};

/** A local point along tube `ly` at `t` cells from the pivot, `h` cells above the axis. */
function along(t, ly, h = 0) {
  const { c, s } = rtAxis();
  const [px, , pz] = RT.pivot;
  return [px + t * c - h * s, ly, pz + (t * s + h * c) * K];
}

/** The pose of the launcher: which tubes hold a ready rocket (0 to 1), recoil, the seeker lamp. */
export function rtPose(accent) {
  return { accent, load: [1, 1], recoil: 0, seek: 0, tube: 0 };
}

/** Where the rocket of tube `k` leaves: the tip of its nose, local, and the direction (local, true units). */
export function rtMuzzle(pose) {
  const k = pose.tube % 2;
  const shift = -RT.recoil * pose.recoil;
  return { at: along(RT.front + RT.noseLen + shift, RT.tubeY[k]), dir: rtAxis().a };
}

/** The lens of the seeker head, local: where the lamp glows while it aims. */
export function rtSeeker(pose = { recoil: 0 }) {
  return along(0.2 - RT.recoil * pose.recoil, 0, 0.115);
}

/**
 * Builds the launcher in frame F (from turnFrame), pose from rtPose. Returns the parts for renderSolids
 * and the local sample points (shadow, bounds).
 */
export function buildRocketTower(F, p) {
  const S = [];
  const T = solidKit(F, S);
  const parts = [];
  const acc = p.accent;
  const [px, , pz] = RT.pivot;
  const shift = -RT.recoil * p.recoil;

  // Turntable, as under every special weapon.
  const r = 0.25;
  parts.push(T.column(0, 0, r, r - 0.01, 0, 4, STEEL_DD, { n: 8, lw: 1.6 }));
  parts.push(T.column(0, 0, r + 0.012, r + 0.012, 0.9, 1.9, GOLD, { n: 8, lw: 1.1, top: false }));
  parts.push(T.column(0, 0, r + 0.012, r + 0.012, 2.3, 3.2, acc, { n: 8, lw: 1.1, top: false }));
  parts.push(T.column(0, 0, 0.22, 0.2, 4, 6.5, STEEL_D, { n: 8, layer: 0.5, lw: 1.8 }));

  // Wedge carriage: two cheeks outside the tubes, a cross brace, the rocket crate behind.
  for (const y0 of [-0.27, 0.225]) {
    parts.push(T.prism([[-0.16, 6.5], [0.12, 6.5], [0.12, 11], [0.04, 28], [-0.06, 28], [-0.16, 13]], y0, y0 + 0.045, STEEL, { layer: 1 }));
  }
  parts.push(T.box(-0.2, 0.16, -0.18, 0.18, 6.5, 12, STEEL_D, { layer: 0.9 }));
  parts.push(T.box(-0.36, -0.21, -0.15, 0.15, 6.5, 15, COPPER, { layer: 0.9, lw: 1.5 }));
  parts.push(T.box(-0.362, -0.358, -0.15, 0.15, 6.5, 8.5, GOLD, { layer: 0.95, lw: 1 }));
  parts.push(T.tube([px, -0.28, pz], [px, 0.28, pz], 0.045, 0.05, STEEL_DD, { n: 8, layer: 1.2, lw: 1.5 }));

  // The spine between the tubes: a flat rotated plate along the axis.
  const sec = (t0, t1, h0, h1) => {
    const q = (t, h) => {
      const v = along(t + shift, 0, h);
      return [v[0], v[2]];
    };
    return [q(t0, h0), q(t1, h0), q(t1, h1), q(t0, h1)];
  };
  parts.push(T.prism(sec(RT.back + 0.04, RT.front - 0.06, -0.05, 0.05), -0.03, 0.03, STEEL_DD, { layer: 1.25, lw: 1.4 }));

  // The two tubes, each with a gold band at the mouth and a band in the guide colour at the breech.
  RT.tubeY.forEach((ly, k) => {
    const A = along(RT.back + shift, ly);
    const B = along(RT.front + shift, ly);
    parts.push(T.tube(A, B, RT.tubeR, RT.tubeR, STEEL, { n: 10, layer: 1.3 + k * 0.01, capA: [{ k: 0.55, c: DARK }], capB: [{ k: 0.82, c: '#14100c' }], lw: 1.7 }));
    parts.push(T.tube(along(RT.front - 0.07 + shift, ly), along(RT.front - 0.03 + shift, ly), RT.tubeR + 0.012, RT.tubeR + 0.012, GOLD, { n: 10, layer: 1.36 + k * 0.01, sides: true, lw: 1.2 }));
    parts.push(T.tube(along(RT.back + 0.05 + shift, ly), along(RT.back + 0.09 + shift, ly), RT.tubeR + 0.01, RT.tubeR + 0.01, acc, { n: 10, layer: 1.36 + k * 0.01, sides: true, lw: 1.1 }));
    // Clamp from the tube to the spine.
    parts.push(T.tube(along(0.05 + shift, ly * 0.4), along(0.05 + shift, ly), 0.022, 0.022, STEEL_M, { n: 5, layer: 1.28, capA: false, capB: false, lw: 1.1 }));

    // The rocket in this tube: the nose stands out of the mouth; while it is loaded it slides forward.
    const load = Math.max(0, Math.min(1, p.load[k]));
    const base = RT.front - 0.01 - (1 - load) * RT.loadTravel;
    const tip = base + RT.noseLen;
    const mouth = RT.front + 0.005;
    if (tip > mouth + 0.02) {
      const from = Math.max(base, mouth);
      const rAt = (t) => RT.noseR * Math.max(0.08, 1 - (t - base) / RT.noseLen);
      // A band of the warhead in dark, the ogive in the guide colour of the mortar doctrine.
      parts.push(T.tube(along(from + shift, ly), along(tip + shift, ly), rAt(from), 0.006, acc, { n: 8, layer: 1.5 + k * 0.01, capA: false, capB: false, lw: 1.2 }));
      if (base + 0.05 > mouth) {
        parts.push(T.tube(along(base + 0.035 + shift, ly), along(base + 0.055 + shift, ly), rAt(base + 0.035) + 0.004, rAt(base + 0.055) + 0.004, DARK, { n: 8, layer: 1.52 + k * 0.01, sides: true, lw: 1 }));
      }
    }
  });

  // The seeker head on top of the spine: a short housing with a lens that glows red while it aims.
  const lensOn = p.seek > 0;
  const sA = along(-0.02 + shift, 0, 0.115);
  const sB = rtSeeker(p);
  parts.push(T.tube(along(0.02 + shift, 0, 0.05), along(0.02 + shift, 0, 0.1), 0.018, 0.018, STEEL_DD, { n: 5, layer: 1.6, capA: false, capB: false, lw: 1.1 }));
  parts.push(T.tube(sA, sB, 0.04, 0.046, STEEL_DD, { n: 8, layer: 1.65, lw: 1.3, capB: [{ k: 0.74, c: '#3a1010' }, { k: 0.42, c: lensOn ? '#ff4a4a' : '#7a2a2a' }] }));
  parts.push(T.tube(along(0.06 + shift, 0, 0.115), along(0.085 + shift, 0, 0.115), 0.052, 0.052, acc, { n: 8, layer: 1.67, sides: true, lw: 1 }));

  return { parts, samples: S };
}

// ======================================================================================
// The new effects
// ======================================================================================

/** Soft round glow without shadowBlur: a radial gradient. */
export function glow(ctx, x, y, radius, colour, alpha) {
  if (alpha <= 0.005 || radius <= 0) return;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  const g = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
  g.addColorStop(0, `${colour}${a}`);
  g.addColorStop(1, `${colour}00`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

/**
 * The fire aura (Till's idea 4): on a shot a soft disc in the guide colour and a thin ring that opens
 * from the muzzle and fades. `u` runs from 1 at the shot to 0. One gradient and one stroke.
 */
export function fireAura(ctx, x, y, colour, u, r, reducedMotion = false) {
  if (u <= 0) return;
  const k = reducedMotion ? 0.5 : 1;
  glow(ctx, x, y, r * (1.1 - 0.3 * u), colour, 0.42 * u * k);
  const rr = r * (0.45 + 0.75 * (1 - u));
  ctx.globalAlpha = 0.55 * u * k;
  ell(ctx, x, y, rr, rr * 0.62, null, colour, 1.4);
  ctx.globalAlpha = 1;
}

/** Stroke one path a few times, wide to narrow: [width, colour, alpha?]. */
function strokes(ctx, pts, list) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, col, alpha = 1] of list) {
    if (w <= 0) continue;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * The thin laser: bright from the lens to a little past the target, then a faint thin line on to the
 * end of the range, because the beam of the simulation pierces the whole line.
 * @param {number[]} a  lens on screen
 * @param {number[]} hit  target on screen
 * @param {number[]} end  end of the range on screen
 */
export function drawLaserThin(ctx, a, hit, end, u, accent) {
  const L = NEU.laser;
  const dx = end[0] - a[0];
  const dy = end[1] - a[1];
  const full = Math.hypot(dx, dy) || 1;
  const toHit = Math.min(full, Math.hypot(hit[0] - a[0], hit[1] - a[1]) + L.past * 32);
  const b = [a[0] + (dx / full) * toHit, a[1] + (dy / full) * toHit];
  strokes(ctx, [b, end], [[L.rest.width, accent, L.rest.alpha * u]]);
  strokes(ctx, [a, b], [[L.ink * (0.5 + 0.5 * u), INK], [L.colour * (0.5 + 0.5 * u), accent], [L.core * (0.6 + 0.4 * u), '#fff1e4']]);
  glow(ctx, hit[0], hit[1], L.hitGlow, accent, 0.55 * u);
}

/** The thinner soul beam of the obelisk. */
export function drawSoulThin(ctx, a, t, u, time, reducedMotion) {
  const S = NEU.soul;
  const len = Math.hypot(t[0] - a[0], t[1] - a[1]) || 1;
  const nx = -(t[1] - a[1]) / len;
  const ny = (t[0] - a[0]) / len;
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const s = i / 12;
    const w = reducedMotion ? 0 : Math.sin(time * 30 + s * 9) * S.wobble * Math.sin(s * Math.PI);
    pts.push([a[0] + (t[0] - a[0]) * s + nx * w, a[1] + (t[1] - a[1]) * s + ny * w]);
  }
  strokes(ctx, pts, [
    [S.ink * (0.5 + 0.5 * u) + 1, INK],
    [S.violet * (0.5 + 0.5 * u), '#b784ff'],
    [S.heart * (0.5 + 0.5 * u), '#ff6a8a'],
    [S.core, '#fff1f4'],
  ]);
  glow(ctx, t[0], t[1], S.hitGlow, '#b784ff', 0.65 * u);
}

/** A seeded jagged path between two screen points. */
function jagged(a, b, seed, jitter, steps) {
  const pts = [a];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i < steps; i++) {
    const u = i / steps;
    const r = Math.sin((seed + 1) * 12.9898 + i * 78.233) * 43758.5453;
    // The kinks are largest in the middle and close in at both ends.
    const off = (r - Math.floor(r) - 0.5) * jitter * (0.35 + Math.sin(u * Math.PI));
    pts.push([a[0] + dx * u + nx * off, a[1] + dy * u + ny * off]);
  }
  pts.push(b);
  return pts;
}

/**
 * The fine lightning with its aura (Till's idea 5): two wide, half-transparent strokes in the glow colour
 * under the path, no ink round them; then a fine bolt of ink, colour and white; and one or two hair-thin
 * filaments round it that flicker. `u` is 1 at the strike and falls to 0.
 */
export function drawBoltFine(ctx, a, b, seed, u, colour, glowColour, core = '#ffffff', reducedMotion = false) {
  const B = NEU.bolt;
  // Short hops get fewer kinks and smaller ones, so a jump between two close targets stays a line.
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(3, Math.min(B.steps, Math.round(len / 9)));
  const jit = Math.min(B.jitter, len * 0.16) * (0.6 + 0.4 * u);
  const pts = jagged(a, b, seed, jit, steps);
  const auraK = reducedMotion ? 0.6 : 1;
  strokes(ctx, pts, B.aura.map((s) => [s.width * (0.7 + 0.3 * u), glowColour, s.alpha * u * auraK]));
  for (let f = 0; f < B.filaments; f++) {
    const fil = jagged(a, b, seed * 3 + f * 11 + 5, Math.min(B.filamentJitter, len * 0.12) * 2.2, steps + 2);
    strokes(ctx, fil, [[0.7, colour, 0.6 * u]]);
  }
  strokes(ctx, pts, [[B.ink + B.colour * (0.6 + 0.4 * u), INK], [B.colour * (0.6 + 0.4 * u), colour], [B.core, core]]);
  glow(ctx, b[0], b[1], B.hitGlow, glowColour, 0.5 * u);
}

/** A tracer of fixed length that runs from `a` to `b` on screen; `u` is how far it has come (0 to 1). */
export function drawTracerFixed(ctx, a, b, u, colour, core) {
  const T = NEU.tracer;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const head = [a[0] + dx * u, a[1] + dy * u];
  const back = Math.min(len * u, T.length * 32);
  const tail = [head[0] - (dx / len) * back, head[1] - (dy / len) * back];
  strokes(ctx, [tail, head], [[T.ink, INK], [T.colour, colour], [T.core, core]]);
}

/**
 * A rocket in flight along its screen direction (ux, uy) with its head at (x, y). `spec` is NEU.rocket or
 * NEU.bigRocket. Exhaust flame and glow behind, steel body, warhead in the guide colour.
 */
export function drawRocketBody(ctx, x, y, ux, uy, spec, accent, flick = 1) {
  const tail = [x - ux * spec.tail, y - uy * spec.tail];
  glow(ctx, tail[0] - ux * 2, tail[1] - uy * 2, spec.flame[0] * 2.6, '#ffb02e', 0.45);
  ell(ctx, tail[0] - ux * spec.flame[0] * 0.6, tail[1] - uy * spec.flame[0] * 0.6, spec.flame[0] * flick, spec.flame[1] * flick, '#ffb02e', INK, 1);
  ell(ctx, tail[0] - ux * spec.flame[0] * 0.3, tail[1] - uy * spec.flame[0] * 0.3, spec.flame[1] * 0.6, spec.flame[1] * 0.5, '#fff3c4', null);
  if (spec.fin) {
    // Two small fins at the tail, across the line of flight.
    const nx = -uy;
    const ny = ux;
    ctx.fillStyle = '#717884';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(tail[0] + ux * 3, tail[1] + uy * 3);
      ctx.lineTo(tail[0] + nx * spec.fin * sd - ux * 1, tail[1] + ny * spec.fin * sd - uy * 1);
      ctx.lineTo(tail[0] + ux * 0.5, tail[1] + uy * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  strokes(ctx, [tail, [x - ux * 1.5, y - uy * 1.5]], [[spec.ink, INK], [spec.body, '#a6adb8']]);
  ell(ctx, x, y, spec.warhead, spec.warhead, accent, INK, 1.1);
}

/**
 * The reticle of the siege launcher on the target instead of the scope laser: four corner brackets that
 * turn in and close over the aim, a dot when it has locked. `q` is the aim, 0 to 1.
 */
export function drawReticle(ctx, x, y, q, time, reducedMotion = false) {
  const R = NEU.reticle;
  const r = R.from + (R.to - R.from) * q;
  const turn = (1 - q) * 0.6;
  const lock = q > 0.92;
  const blink = reducedMotion ? 1 : lock ? 0.6 + 0.4 * Math.abs(Math.sin(time * 24)) : 1;
  const colour = lock ? '#ffd0c0' : '#ff4a4a';
  ctx.globalAlpha = (0.45 + 0.55 * q) * blink;
  for (let i = 0; i < 4; i++) {
    const a = turn + Math.PI / 4 + (i * Math.PI) / 2;
    const cx = Math.cos(a);
    const cy = Math.sin(a) * 0.55;
    const arm = R.arm;
    const p0 = [x + Math.cos(a - arm) * r, y + Math.sin(a - arm) * r * 0.55];
    const p1 = [x + cx * r, y + cy * r];
    const p2 = [x + Math.cos(a + arm) * r, y + Math.sin(a + arm) * r * 0.55];
    strokes(ctx, [p0, p1, p2], [[R.ink, INK], [R.colour, colour]]);
  }
  if (q > 0.5) ell(ctx, x, y, 1.6 + q, (1.6 + q) * 0.6, colour, INK, 1);
  ctx.globalAlpha = 1;
}

/** Where the big rocket will land: a faint dashed ring of the true splash radius and a cross, fading in over the flight. */
export function drawImpactZone(ctx, x, y, rx, u) {
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.globalAlpha = 0.08 + 0.2 * u;
  ell(ctx, x, y, rx, rx * 0.5, null, '#ff4a4a', 1.2);
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.35 + 0.5 * u;
  const k = 7;
  ctx.strokeStyle = '#ff4a4a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - k, y);
  ctx.lineTo(x + k, y);
  ctx.moveTo(x, y - k * 0.5);
  ctx.lineTo(x, y + k * 0.5);
  ctx.stroke();
  ctx.restore();
}
