// Study: supply capsule, landing and selection.
//
// "Heute" calls the game's own functions (createPodRenderer, drawPodTarget,
// drawPodHologram, drawPodHighlight and the effects of src/render/effects.js).
// The three drafts A, B and C are drawn here from parts: a heat shield, a wall of
// four or five segments that fall outwards like petals, a standing core, a collar
// with brake nozzles and a roof. They are colour neutral; the doctrine colour
// lives in the core and in the hologram only, as it does today.
//
// Every effect of the drafts is a pure function of the clock (particles carry
// their spawn time and lifetime), so the time slider can scrub in both
// directions and the slow motion button needs nothing but a smaller time step.
// Nothing here touches src/; the study only reads it.

import { iso, mapBounds } from '../../src/render/iso.js';
import { poly, ell, shadow } from '../../src/render/draw.js';
import { C } from '../../src/render/palette.js';
import { createRng } from '../../src/core/random.js';
import { CAMERA } from '../../src/data/settings.js';
import { DOCTRINE_IDS, DOCTRINE_COLORS } from '../../src/data/doctrines.js';
import { STRINGS } from '../../src/data/strings.js';
import { PODS } from '../../src/data/pods.js';
import { IMPACT_SECONDS } from '../../src/sim/pods.js';
import { createCanvasView } from '../../src/render/canvas.js';
import { createCamera, clampCamera, panBy, zoomAt, applyCamera } from '../../src/render/camera.js';
import { createGroundLayer } from '../../src/render/ground.js';
import { createSpriteCache } from '../../src/render/sprites/rasterizer.js';
import { allTowerDefs, drawTowerSprite } from '../../src/render/towerSprites.js';
import { createPodRenderer, drawPodTarget, drawPodHologram, drawPodHighlight, POD_SPRITE_DEFS } from '../../src/render/pods.js';
import { createEffects } from '../../src/render/effects.js';
import { attachPointerInput } from '../../src/input/pointer.js';
import { installPageGuards } from '../../src/input/guards.js';

const INK = C.ink;
const E = 0.5; // ground circles are squashed to this on screen
const TAU = Math.PI * 2;
const SIZE = 8;
const SEED = 'KAPSEL';

// ---------- Constants of the drafts (all times in seconds) ----------

/** Loop length of the landing on the slider. */
const LOOP = 8.5;
/** Upper bound for the particles of one landing (CLAUDE.md: ceilings for particles). */
const MAX_PARTICLES = 160;
/** Where the pod starts, in screen pixels above the ground. */
const FALL_HEIGHT = 900;
/** Height at which the brake nozzles light. */
const BRAKE_HEIGHT = 170;
/** Speed at touchdown relative to the start speed of the brake, in px/s. */
const TOUCHDOWN_SPEED = 300;
/** Seconds the shell glows after the impact until it is cold. */
const COOL_SECONDS = 2.8;
/** Slow motion factor of the "Zeitlupe" button. */
const SLOW = 0.25;
/** Light direction for the facet shading (screen angle, 0 = right, clockwise). */
const LIGHT = 2.7;
const HOT = '#ff9c4a';
const SOOT = '#2b221d';

const DESIGNS = {
  a: {
    id: 'a',
    label: 'A schwer',
    n: 5,
    seamAtFront: false,
    gap: 0,
    S: 0.92,
    R0: 25, R1: 19, H: 32, lip: 5,
    belly: 1.15, tipW: 0.8, chamfer: 0.8,
    pal: ['#a8a592', '#7d7d6c', '#53544b'],
    bounce: 0.06,
    // appear: pod becomes visible; v0: speed before the brake; the rest is seconds after the impact
    T: { appear: 0.5, v0: 640, bolts: 0.5, petal0: 0.8, stagger: 0.2, petalDur: 0.42, holoAt: 1.7 },
    order: [0, 2, 4, 1, 3],
  },
  b: {
    id: 'b',
    label: 'B schlank',
    n: 4,
    seamAtFront: true,
    gap: 0,
    S: 0.95,
    R0: 19, R1: 11, H: 50, lip: 4,
    belly: 1.12, tipW: 0.72, chamfer: 0.72,
    pal: ['#a6adb8', '#717884', '#4a505b'],
    bounce: 0.12,
    T: { appear: 0.5, v0: 820, bolts: 0.45, petal0: 0.7, stagger: 0.14, petalDur: 0.3, holoAt: 1.2 },
    order: [0, 2, 1, 3],
  },
  c: {
    id: 'c',
    label: 'C Segmente',
    n: 5,
    seamAtFront: true,
    gap: 0.075,
    S: 0.92,
    R0: 25, R1: 18, H: 34, lip: 5,
    belly: 1.12, tipW: 0.75, chamfer: 0.76,
    pal: ['#a8937f', '#76675a', '#4e4237'],
    bounce: 0.09,
    T: { appear: 0.5, v0: 720, bolts: 0.5, petal0: 0.75, stagger: 0.17, petalDur: 0.38, holoAt: 1.5 },
    order: [0, 3, 1, 4, 2],
  },
};

const INNER = ['#968c7f', '#6c645a', '#4a433b'];
const CORE_PAL = ['#51473d', '#383029', '#231d19'];

// ---------- Small helpers ----------

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (u) => u * u * (3 - 2 * u);
const rgbCache = new Map();
function rgb(h) {
  let v = rgbCache.get(h);
  if (!v) {
    v = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    rgbCache.set(h, v);
  }
  return v;
}
/** Mix of two '#rrggbb' colours as an rgb() string. */
function mixc(a, b, t) {
  const A = rgb(a);
  const B = rgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}
/** Colour with the alpha of a '#rrggbb'. */
function rgba(h, a) {
  const v = rgb(h);
  return `rgba(${v[0]},${v[1]},${v[2]},${a})`;
}
/** Re-entry heat tint of a palette. */
const heated = (pal, heat) => (heat > 0.01 ? pal.map((c) => mixc(c, HOT, heat * 0.3)) : pal);

/** Facet shade by the screen angle of the face normal. */
function shade(pal, am) {
  const c = Math.cos(am - LIGHT);
  return c > 0.72 ? pal[0] : c > -0.05 ? pal[1] : pal[2];
}

/** Local pod point (radius, angle on the ground, height) to screen, origin at the pod's foot. */
const pt = (r, a, z) => [r * Math.cos(a), r * Math.sin(a) * E - z];
/** Same with a lateral offset l across the direction a. */
const ptl = (r, l, a, z) => [r * Math.cos(a) - l * Math.sin(a), (r * Math.sin(a) + l * Math.cos(a)) * E - z];

function ink(ctx, pts, lw = 2) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function line(ctx, a, b, col, lw) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function dot(ctx, p, r, fill, hl) {
  ell(ctx, p[0], p[1], r + 0.9, r + 0.9, INK, null);
  ell(ctx, p[0], p[1], r, r, fill, null);
  if (hl) ell(ctx, p[0] - r * 0.3, p[1] - r * 0.3, r * 0.45, r * 0.45, hl, null);
}

/** Vertical cylinder at the foot, z0 to z1, three tones across. */
function cyl(ctx, r, z0, z1, [top, mid, dark], lw = 2) {
  const x = 0;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - r, -z1);
  ctx.lineTo(x - r, -z0);
  ctx.ellipse(x, -z0, r, r * E, 0, Math.PI, 0, true);
  ctx.lineTo(x + r, -z1);
  ctx.ellipse(x, -z1, r, r * E, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = mid;
  ctx.fillRect(x - r, -z1 - r, r * 2, z1 - z0 + r * 2);
  ctx.fillStyle = top;
  ctx.fillRect(x - r, -z1 - r, r * 0.55, z1 - z0 + r * 2);
  ctx.fillStyle = dark;
  ctx.fillRect(x + r * 0.35, -z1 - r, r, z1 - z0 + r * 2);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(x - r, -z1);
  ctx.lineTo(x - r, -z0);
  ctx.ellipse(x, -z0, r, r * E, 0, Math.PI, 0, true);
  ctx.lineTo(x + r, -z1);
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ell(ctx, x, -z1, r, r * E, top, INK, lw);
}

/** Regular prism or frustum with n faces; the faces turned to the viewer are drawn, then the top. */
function prism(ctx, n, rot, r0, r1, z0, z1, pal, lw = 2) {
  const step = TAU / n;
  const faces = [];
  for (let i = 0; i < n; i++) {
    const a1 = rot + i * step;
    const a2 = a1 + step;
    const am = (a1 + a2) / 2;
    if (Math.sin(am) < -0.05) continue;
    faces.push({ a1, a2, am });
  }
  faces.sort((p, q) => Math.sin(p.am) - Math.sin(q.am));
  for (const f of faces) {
    poly(ctx, [pt(r0, f.a1, z0), pt(r0, f.a2, z0), pt(r1, f.a2, z1), pt(r1, f.a1, z1)], shade(pal, f.am), INK, lw);
  }
  const top = [];
  for (let i = 0; i < n; i++) top.push(pt(r1, rot + i * step, z1));
  poly(ctx, top, pal[0], INK, lw);
}

/**
 * A brake nozzle: a bell hanging off the collar, mouth down and outwards.
 * Returns where the mouth is and the way the flame leaves it.
 */
function bell(ctx, a, rIn, zIn, rOut, zOut, wIn, wOut, pal) {
  const A = pt(rIn, a, zIn);
  const B = pt(rOut, a, zOut);
  const dx = B[0] - A[0];
  const dy = B[1] - A[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  poly(ctx, [[A[0] + nx * wIn, A[1] + ny * wIn], [B[0] + nx * wOut, B[1] + ny * wOut], [B[0] - nx * wOut, B[1] - ny * wOut], [A[0] - nx * wIn, A[1] - ny * wIn]], pal[1], INK, 2);
  line(ctx, [A[0] + nx * wIn * 0.5, A[1] + ny * wIn * 0.5], [B[0] + nx * wOut * 0.5, B[1] + ny * wOut * 0.5], pal[0], 1.6);
  ell(ctx, B[0], B[1], wOut * 1.05, wOut * 0.6, '#150f0c', INK, 1.8);
  const out = [Math.cos(a) * 0.3, Math.sin(a) * 0.3 * E + 1];
  const k = Math.sqrt(out[0] * out[0] + out[1] * out[1]);
  return { a, mouth: B, dir: [out[0] / k, out[1] / k], wOut };
}

// ---------- The wall: segments that fall outwards like petals ----------

/** Seam angle i of a design. */
function seamAngle(dz, i) {
  const step = TAU / dz.n;
  return (dz.seamAtFront ? Math.PI / 2 - step * (dz.n === 4 ? 1.28 : 1) : Math.PI / 2 - step / 2) + i * step;
}

/**
 * One segment as a polygon in the local frame. phi 0 is closed (a face of the
 * frustum), 1 lies flat on the ground; `lift` props it up by that many radians.
 */
function petalGeom(dz, i, phi, lift) {
  const step = TAU / dz.n;
  const a1 = seamAngle(dz, i);
  const am = a1 + step / 2;
  const d = step / 2 - dz.gap;
  const r0 = dz.R0 * Math.cos(d);
  const wh = dz.R0 * Math.sin(d);
  const rt = dz.R1 * Math.cos(d);
  const wt = dz.R1 * Math.sin(d);
  const L = Math.sqrt(dz.H * dz.H + (r0 - rt) * (r0 - rt));
  const beta0 = Math.atan2(dz.H, rt - r0);
  const beta = beta0 * (1 - phi) + lift;
  const cb = Math.cos(beta);
  const sb = Math.sin(beta);
  const ch = dz.chamfer;
  const wClosed = (s) => lerp(wh, wt, s);
  const wFlat = (s) => (s <= ch ? lerp(wh, wh * dz.belly, s / ch) : lerp(wh * dz.belly, wh * dz.tipW, (s - ch) / (1 - ch)));
  const w = (s) => lerp(wClosed(s), wFlat(s), phi);
  /** Point at relative width l (-1 to 1) and relative length s (0 hinge, 1 tip). */
  const P = (l, s) => ptl(r0 + L * s * cb, l * w(s), am, dz.lip + L * s * sb);
  const outline = [P(-1, 0), P(1, 0), P(1, ch), P(1, 1), P(-1, 1), P(-1, ch)];
  let area = 0;
  for (let k = 0; k < outline.length; k++) {
    const p = outline[k];
    const q = outline[(k + 1) % outline.length];
    area += p[0] * q[1] - q[0] * p[1];
  }
  return { am, P, outline, area, reach: r0 + L, L, beta, phi };
}

/** Sign of the outline area when the outside of a segment faces the viewer. */
const OUTER_SIGN = Math.sign(petalGeom(DESIGNS.a, 0, 0, 0).area);

/** Opening progress of one segment, with the little bounce when it hits the ground. */
function swing(dz, since, k) {
  const T = dz.T;
  const age = since - T.petal0 - k * T.stagger;
  if (age <= 0) return 0;
  const x = age / T.petalDur;
  if (x < 1) return x * x;
  const b = clamp01((age - T.petalDur) / 0.24);
  // The rebound lifts the plate a few degrees and lets it settle.
  return 1 - dz.bounce * 4 * b * (1 - b);
}

function crackAmount(dz, since) {
  return smooth(clamp01((since - dz.T.bolts) / 0.08)) * 0.05;
}

function drawPetal(ctx, dz, i, phi, lift, st) {
  const g = petalGeom(dz, i, phi, lift);
  const outer = g.area * OUTER_SIGN > 0;
  const pal = heated(dz.pal, st.heat);
  const inner = heated(INNER, st.heat * 0.4);
  const n = g.beta;
  const sb = Math.sin(n);
  const nz = outer ? -Math.cos(n) : Math.cos(n);
  const k = outer ? sb : -sb;
  const lit = k * Math.cos(g.am) * -0.65 + k * Math.sin(g.am) * 0.35 + nz * 0.68;
  const fill = (outer ? pal : inner)[lit > 0.6 ? 0 : lit > 0.1 ? 1 : 2];
  poly(ctx, g.outline, fill, INK, 2.2);
  const P = g.P;
  const quad = (l0, l1, s0, s1) => [P(l0, s0), P(l1, s0), P(l1, s1), P(l0, s1)];
  const soot = (l0, l1, s0, s1, a) => poly(ctx, quad(l0, l1, s0, s1), `rgba(14,10,8,${a})`, null);
  // Everything on the plate stays inside its outline.
  ctx.save();
  ctx.beginPath();
  g.outline.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  if (outer) {
    if (dz.id === 'a') {
      // Hazard band on the foot, hatch plate in the middle, two ribs, rivets.
      const K = 7;
      for (let k = 0; k < K; k++) {
        const l0 = -1 + (2 * k) / K;
        poly(ctx, [P(l0, 0.04), P(l0 + 1 / K, 0.04), P(l0 + 1.7 / K, 0.17), P(l0 + 0.7 / K, 0.17)], k % 2 ? '#2a2018' : '#d4a53a', null);
      }
      ink(ctx, [P(-1, 0.17), P(1, 0.17)], 1.8);
      poly(ctx, quad(-0.5, 0.5, 0.34, 0.66), shade(pal, g.am + 1.2), INK, 1.8);
      ink(ctx, [P(-0.34, 0.5), P(0.34, 0.5)], 1.6);
      ink(ctx, [P(-1, 0.78), P(1, 0.78)], 1.6);
      for (const l of [-0.82, 0.82]) for (const s of [0.3, 0.55, 0.9]) dot(ctx, P(l, s), 1.5, pal[0], null);
    } else if (dz.id === 'b') {
      // Long narrow plate: a bone band, a vertical slit, two rivets at the foot.
      poly(ctx, quad(-1, 1, 0.5, 0.6), '#d8cba8', INK, 1.8);
      poly(ctx, quad(-1, 1, 0.04, 0.1), '#2a2018', null);
      poly(ctx, quad(-0.12, 0.12, 0.16, 0.44), '#1a1410', null);
      ink(ctx, [P(0, 0.64), P(0, 0.94)], 1.6);
      for (const l of [-0.7, 0.7]) dot(ctx, P(l, 0.22), 1.4, pal[0], null);
    } else {
      // Two tiers with a ledge, big corner bolts and rust-brown streaks.
      ink(ctx, [P(-1, 0.46), P(1, 0.46)], 2);
      poly(ctx, quad(-0.84, 0.84, 0.5, 0.95), shade(pal, g.am + 0.6), INK, 1.8);
      for (const l of [-0.68, 0.68]) for (const s of [0.58, 0.86]) dot(ctx, P(l, s), 2.1, pal[0], '#d8cfc0');
      poly(ctx, quad(-0.5, -0.3, 0.1, 0.4), 'rgba(110,50,25,.42)', null);
      poly(ctx, quad(0.3, 0.45, 0.2, 0.44), 'rgba(110,50,25,.36)', null);
      poly(ctx, quad(-1, 1, 0.02, 0.1), 'rgba(24,18,14,.5)', null);
    }
    // Charred foot and top edge on every design.
    soot(-1, 1, 0, 0.08, 0.38);
    soot(-1, 1, 0.94, 1, 0.3);
    if (st.heat > 0.05) poly(ctx, quad(-1, 1, 0, 0.12), `rgba(255,120,40,${st.heat * 0.4})`, null);
  } else {
    // The inside: scorched, with hairline cracks that still glow and the core's light spilling over.
    soot(-1, 1, 0.55, 1, 0.22);
    for (const l of [-0.55, 0, 0.55]) ink(ctx, [P(l, 0.05), P(l * 1.1, 0.8)], 1.3);
    const ember = clamp01(1 - (st.since ?? 0) / 3.5) * 0.5;
    if (ember > 0.02) {
      line(ctx, P(-0.3, 0.18), P(-0.12, 0.55), `rgba(255,130,50,${ember})`, 1.5);
      line(ctx, P(0.4, 0.3), P(0.55, 0.7), `rgba(255,130,50,${ember})`, 1.5);
    }
    if (st.glow > 0.01) poly(ctx, quad(-0.9, 0.9, 0.02, 0.5), rgba(st.color, st.glow * (0.2 + st.focus * 0.22)), null);
    dot(ctx, P(-0.78, 0.07), 1.7, '#8a857c', null);
    dot(ctx, P(0.78, 0.07), 1.7, '#8a857c', null);
  }
  ctx.restore();
  // Outline again over the clipped details, with a thin light edge on the lit side of an open plate.
  poly(ctx, g.outline, null, INK, 2.2);
  if (!outer) {
    line(ctx, P(-0.9, 0.05), P(-0.9, 0.94), 'rgba(255,240,215,.34)', 1.3);
    line(ctx, P(-0.9, 0.95), P(0.9, 0.95), 'rgba(255,240,215,.22)', 1.3);
  }
  return g;
}

// ---------- Shield, core and top of the three drafts ----------

function drawShield(ctx, dz, st) {
  const pal = heated(['#524940', '#3a332c', '#272119'], st.heat * 0.7);
  if (dz.id === 'a') {
    cyl(ctx, 32, 0, 5, pal, 2.2);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      const p = pt(24 + (k % 2) * 3, a, 5);
      ink(ctx, [pt(16, a, 5), p], 1.2);
    }
    for (let k = 0; k < 10; k++) {
      const a = Math.PI * 0.05 + (k / 10) * Math.PI * 0.95;
      dot(ctx, pt(31, a, 2.5), 1.2, '#6a625a', null);
    }
  } else if (dz.id === 'b') {
    cyl(ctx, 27, 0, 4, pal, 2);
    // Four landing lugs under the seams, flat wedges on the ground.
    for (let i = 0; i < dz.n; i++) {
      const a = seamAngle(dz, i);
      if (Math.sin(a) < -0.3) continue;
      const w = 0.2;
      poly(ctx, [pt(20, a - w, 4), pt(37, a - w * 0.5, 2), pt(37, a + w * 0.5, 2), pt(20, a + w, 4)], pal[1], INK, 2);
      poly(ctx, [pt(37, a - w * 0.5, 2), pt(37, a + w * 0.5, 2), pt(37, a + w * 0.5, 0), pt(37, a - w * 0.5, 0)], pal[2], INK, 1.6);
    }
  } else {
    // Five separate heat-shield plates with a gap, each with its own thickness.
    for (let i = 0; i < dz.n; i++) {
      const a1 = seamAngle(dz, i) + 0.1;
      const a2 = seamAngle(dz, i + 1) - 0.1;
      const am = (a1 + a2) / 2;
      const top = [];
      for (let k = 0; k <= 4; k++) {
        const a = lerp(a1, a2, k / 4);
        top.push(pt(31, a, 5));
      }
      for (let k = 4; k >= 0; k--) top.push(pt(15, lerp(a1, a2, k / 4), 5));
      if (Math.sin(am) > -0.4) {
        // Thickness on the outside edge.
        const side = [];
        for (let k = 0; k <= 4; k++) side.push(pt(31, lerp(a1, a2, k / 4), 5));
        for (let k = 4; k >= 0; k--) side.push(pt(31, lerp(a1, a2, k / 4), 0));
        poly(ctx, side, pal[2], INK, 1.8);
      }
      poly(ctx, top, shade(pal, am), INK, 2);
    }
  }
  if (st.heat > 0.05) {
    ctx.globalAlpha = st.heat * 0.5;
    ell(ctx, 0, -2, dz.id === 'b' ? 26 : 31, dz.id === 'b' ? 13 : 15.5, null, '#ffb15a', 3);
    ctx.globalAlpha = 1;
  }
}

/** Core: the standing cylinder that remains, with light slits in the doctrine colour. */
function drawCore(ctx, dz, st) {
  const rc = dz.R1 * 0.62;
  const top = dz.lip + dz.H + 3;
  const body = heated(CORE_PAL, st.heat * 0.5);
  cyl(ctx, rc + 3, dz.lip, dz.lip + 5, body, 1.8);
  cyl(ctx, rc, dz.lip, top, body, 2);
  const glow = st.glow;
  // Rings of light round the core: dark groove first, then the doctrine colour over it.
  const rings = [dz.lip + 9, dz.lip + 17, dz.lip + 25];
  for (const z of rings) {
    ctx.beginPath();
    ctx.ellipse(0, -z, rc + 0.4, (rc + 0.4) * E, 0, 0, Math.PI, false);
    ctx.strokeStyle = '#120d0b';
    ctx.lineWidth = 5;
    ctx.stroke();
    if (glow > 0.01) {
      ctx.beginPath();
      ctx.ellipse(0, -z, rc + 0.4, (rc + 0.4) * E, 0, 0, Math.PI, false);
      ctx.strokeStyle = rgba(st.color, clamp01(glow * (0.7 + st.focus * 0.3)));
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${glow * (0.3 + st.focus * 0.4)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  if (glow > 0.01) {
    // The core's own light: a halo round it and light seeping out under the roof.
    for (const [r, a] of [[rc + 12, 0.1], [rc + 7, 0.14], [rc + 3, 0.2]]) {
      ctx.globalAlpha = glow * a * (1 + st.focus * 0.8);
      ell(ctx, 0, -dz.lip - 14, r, r * 1.5, st.color, null);
    }
    ctx.globalAlpha = glow * (0.5 + st.focus * 0.35);
    ell(ctx, 0, -top + 1, rc + 1, (rc + 1) * E, st.color, null);
    ctx.globalAlpha = 1;
  }
}

/** Collar, brake nozzles and roof. Returns the nozzle mouths for the flames. */
function drawTop(ctx, dz, st, bells) {
  const pal = heated(dz.pal, st.heat);
  const dark = heated(['#5e5a52', '#403d38', '#2a2724'], st.heat * 0.6);
  const zt = dz.lip + dz.H;
  const mouths = [];
  const step = TAU / dz.n;
  if (dz.id === 'a') {
    prism(ctx, 10, seamAngle(dz, 0), 20.5, 20, zt - 1, zt + 8, dark, 2);
    // Lugs over the seams and the five bells between the nozzle flames.
    for (let i = 0; i < dz.n; i++) {
      const a = seamAngle(dz, i);
      if (Math.sin(a) > -0.3) mouths.push(bell(ctx, a, 19.5, zt + 3, 24.5, zt - 7, 3.2, 4.3, dark));
    }
    prism(ctx, 10, seamAngle(dz, 0), 18.5, 17.5, zt + 8, zt + 12, pal, 2);
    cyl(ctx, 7.5, zt + 12, zt + 18, dark, 2);
    ell(ctx, 0, -zt - 18, 4.6, 2.3, '#120d0b', INK, 1.5);
    for (let k = 0; k < 6; k++) dot(ctx, pt(14, Math.PI * 0.1 + k * 0.5, zt + 12), 1.2, pal[0], null);
    // Red band under the collar.
    poly(ctx, [pt(20.2, Math.PI * 0.12, zt + 1), pt(20.2, Math.PI * 0.88, zt + 1), pt(20.2, Math.PI * 0.88, zt + 4), pt(20.2, Math.PI * 0.12, zt + 4)], null, null);
  } else if (dz.id === 'b') {
    prism(ctx, 8, seamAngle(dz, 0), 12.5, 12, zt - 1, zt + 6, dark, 2);
    cyl(ctx, 6.5, zt + 6, zt + 22, dark, 2);
    ink(ctx, [[-6.5, -zt - 12], [6.5, -zt - 12]], 1.3);
    cyl(ctx, 8.2, zt + 22, zt + 26, pal, 2);
    ell(ctx, 0, -zt - 26, 5.2, 2.6, '#120d0b', INK, 1.5);
    for (let i = 0; i < dz.n; i++) {
      const a = seamAngle(dz, i) + step / 2;
      if (Math.sin(a) > -0.3) mouths.push(bell(ctx, a, 9, zt + 18, 14, zt + 8, 2.4, 3.4, dark));
    }
  } else {
    // Five claw-like clamps on a pentagonal cap, with small bells low on the collar.
    prism(ctx, 5, seamAngle(dz, 0), 19.5, 18, zt - 1, zt + 7, dark, 2);
    for (let i = 0; i < dz.n; i++) {
      const a = seamAngle(dz, i) + step / 2;
      if (Math.sin(a) > -0.3) mouths.push(bell(ctx, a, 18.4, zt + 2, 22.5, zt - 6, 2.8, 3.8, dark));
    }
    prism(ctx, 5, seamAngle(dz, 0), 12, 9.5, zt + 7, zt + 12, pal, 2);
    for (let i = 0; i < dz.n; i++) {
      const a = seamAngle(dz, i);
      const base = pt(18, a, zt + 6);
      const tip = pt(8, a, zt + 12);
      const mid = pt(14, a + 0.07, zt + 12);
      if (Math.sin(a) > -0.5) {
        poly(ctx, [base, mid, tip, pt(8, a + 0.2, zt + 11), pt(14.5, a + 0.2, zt + 6)], pal[1], INK, 1.8);
        dot(ctx, pt(15.5, a + 0.09, zt + 7), 1.3, pal[0], null);
      }
    }
    cyl(ctx, 4.4, zt + 12, zt + 15, dark, 1.8);
    ell(ctx, 0, -zt - 15, 2.6, 1.3, '#120d0b', INK, 1.2);
  }
  // Positional lights on the collar: warm, the same on every design.
  const lamp = Math.floor(st.t * 2) % 2;
  for (const s of [-1, 1]) {
    const p = pt(dz.R1 + 1.5, Math.PI / 2 + s * 0.9, zt + 3);
    dot(ctx, p, 1.7, lamp ? '#ffb14a' : '#a8651f', null);
  }
  bells.push(...mouths);
}

/** Flame of one brake nozzle. */
function drawFlame(ctx, m, len, t, seed) {
  if (len < 4) return;
  const flick = 0.88 + 0.12 * Math.sin(t * 52 + seed * 3.1) + 0.06 * Math.sin(t * 91 + seed);
  const L = len * flick;
  const [x, y] = m.mouth;
  const [dx, dy] = m.dir;
  const nx = -dy;
  const ny = dx;
  const layer = (w0, w1, col) => {
    ctx.beginPath();
    ctx.moveTo(x + nx * w0, y + ny * w0);
    ctx.quadraticCurveTo(x + dx * L * 0.55 + nx * w1, y + dy * L * 0.55 + ny * w1, x + dx * L, y + dy * L);
    ctx.quadraticCurveTo(x + dx * L * 0.55 - nx * w1, y + dy * L * 0.55 - ny * w1, x - nx * w0, y - ny * w0);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  };
  layer(m.wOut * 1.5, m.wOut * 2.4, 'rgba(255,110,40,.45)');
  layer(m.wOut * 1.1, m.wOut * 1.5, 'rgba(255,184,76,.85)');
  layer(m.wOut * 0.6, m.wOut * 0.7, 'rgba(255,248,214,.95)');
}

// ---------- Timeline of a draft ----------

/** Seconds of the fall: free flight to the brake height, then the brake down to TOUCHDOWN_SPEED. */
function fallProfile(dz) {
  const v0 = dz.T.v0;
  const free = (FALL_HEIGHT - BRAKE_HEIGHT) / v0;
  const brake = (2 * BRAKE_HEIGHT) / (v0 + TOUCHDOWN_SPEED);
  return { free, brake, total: free + brake, accel: (v0 - TOUCHDOWN_SPEED) / brake };
}
function impactOf(dz) {
  return dz.T.appear + fallProfile(dz).total;
}
/** Height above the ground at a time (clock) in seconds. */
function fallZ(dz, clock) {
  const f = fallProfile(dz);
  const tt = clock - dz.T.appear;
  if (tt <= 0) return FALL_HEIGHT;
  if (tt >= f.total) return 0;
  if (tt < f.free) return FALL_HEIGHT - dz.T.v0 * tt;
  const s = tt - f.free;
  return Math.max(0, BRAKE_HEIGHT - dz.T.v0 * s + 0.5 * f.accel * s * s);
}

// ---------- Particles: a pure function of the clock ----------

const SMOKE_COLORS = {
  soot: [SOOT, '#5d544c', '#a39988', '#d3cabb'],
  dust: ['#6e5a42', '#9b8466', '#c4b08a', '#e0d4b6'],
  steam: ['#bdb6aa', '#d8d3c9', '#e9e5dc', '#f2efe8'],
};
function ramp(list, u) {
  const x = clamp01(u) * (list.length - 1);
  const i = Math.min(list.length - 2, Math.floor(x));
  return mixc(list[i], list[i + 1], x - i);
}

function buildFx(dz) {
  const rng = createRng(`kapsel:${dz.id}`);
  const out = [];
  const add = (p) => {
    if (out.length < MAX_PARTICLES) out.push(p);
  };
  const T = dz.T;
  const hit = impactOf(dz);
  const f = fallProfile(dz);
  // Embers shed on the way down; they stay where they were shed while the capsule drops on.
  for (let i = 0; i < 12; i++) {
    const ts = T.appear + rng.range(0.05, f.total * 0.92);
    add({ k: 'ember', t0: ts, life: 0.55, x: rng.range(-28, 28), z: fallZ(dz, ts) + rng.range(-8, 50), vx: rng.range(-24, 24), vz: rng.range(-60, -10) });
  }
  // Dust stirred up by the brake jets just above the ground.
  for (let i = 0; i < 10; i++) {
    const ts = hit - rng.range(0.02, 0.34);
    const a = rng.range(0, TAU);
    add({ k: 'puff', pal: 'dust', t0: ts, life: rng.range(0.9, 1.3), a, speed: rng.range(120, 190), z0: 2, vz: 8, r0: 6, r1: 20, drag: 2.4, a0: 0.75 });
  }
  // The strike: a fireball, a skirt of dust along the ground and big billows of smoke.
  for (let i = 0; i < 8; i++) {
    add({ k: 'fire', t0: hit + rng.range(0, 0.06), life: rng.range(0.32, 0.5), a: rng.range(0, TAU), speed: rng.range(30, 110), z0: 8, vz: rng.range(40, 120), r0: 8, r1: 24, drag: 3 });
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + rng.range(-0.15, 0.15);
    add({ k: 'puff', pal: 'dust', t0: hit + rng.range(0, 0.1), life: rng.range(1.3, 1.9), a, speed: rng.range(170, 260), z0: 3, vz: rng.range(8, 28), r0: 6, r1: rng.range(24, 32), drag: 2.4, a0: 0.62 });
  }
  for (let i = 0; i < 14; i++) {
    add({ k: 'puff', pal: 'soot', t0: hit + rng.range(0.02, 0.4), life: rng.range(2.6, 3.7), a: rng.range(0, TAU), speed: rng.range(10, 60), z0: 6, from: rng.range(12, 28), vz: rng.range(95, 160), r0: 12, r1: rng.range(32, 44), drag: 1.0, a0: 0.62, wind: 16 });
  }
  for (let i = 0; i < 22; i++) {
    const steel = i % 5 === 0;
    add({ k: 'chunk', t0: hit, life: rng.range(1.9, 2.5), a: rng.range(0, TAU), speed: rng.range(40, 190), z0: 6, vz: rng.range(260, 470), g: 900, size: steel ? rng.range(3, 5) : rng.range(2.5, 6.5), col: steel ? 'steel' : rng.pick(['#4b3a2c', '#5e4a38', '#3a2e24']), spin: rng.range(-9, 9), rot: rng.range(0, TAU) });
  }
  for (let i = 0; i < 14; i++) {
    add({ k: 'spark', t0: hit + rng.range(0, 0.05), life: rng.range(0.3, 0.55), a: rng.range(0, TAU), speed: rng.range(120, 260), z0: 10, vz: rng.range(120, 300), g: 600 });
  }
  // The bolts go off: a flash at every seam, a small bolt flung away, a puff of steam.
  for (let i = 0; i < dz.n; i++) {
    const a = seamAngle(dz, i);
    const ts = hit + T.bolts;
    add({ k: 'flash', t0: ts, life: 0.16, x: dz.R0 * 0.95 * Math.cos(a), y: dz.R0 * 0.95 * Math.sin(a) * E, z0: dz.lip + dz.H * 0.7, size: 12 });
    add({ k: 'chunk', t0: ts, life: 1.2, a, speed: rng.range(60, 120), z0: dz.lip + dz.H * 0.7, vz: rng.range(180, 280), g: 760, size: 3, col: 'steel', spin: rng.range(-12, 12), rot: 0, from: dz.R0 });
    add({ k: 'puff', pal: 'steam', t0: ts, life: 0.9, a, speed: 30, z0: dz.lip + dz.H * 0.7, vz: 24, r0: 3, r1: 13, drag: 2, a0: 0.8, from: dz.R0 });
  }
  // Every segment that hits the ground throws dust and a few chunks.
  dz.order.forEach((seg, k) => {
    const g = petalGeom(dz, seg, 1, 0);
    const ts = hit + T.petal0 + k * T.stagger + T.petalDur;
    for (let j = 0; j < 4; j++) {
      add({ k: 'puff', pal: 'dust', t0: ts + j * 0.012, life: rng.range(0.9, 1.4), a: g.am + rng.range(-0.5, 0.5), speed: rng.range(50, 120), z0: 2, vz: rng.range(6, 20), r0: 5, r1: rng.range(16, 24), drag: 2.2, a0: 0.8, from: g.reach * 0.9 });
    }
    for (let j = 0; j < 3; j++) {
      add({ k: 'chunk', t0: ts, life: rng.range(0.9, 1.3), a: g.am + rng.range(-0.6, 0.6), speed: rng.range(40, 100), z0: 3, vz: rng.range(120, 220), g: 800, size: rng.range(2, 4), col: rng.pick(['#4b3a2c', '#5e4a38']), spin: rng.range(-8, 8), rot: rng.range(0, TAU), from: g.reach * 0.9 });
    }
  });
  // The shell vents what is left of the heat out of the roof.
  for (let i = 0; i < 10; i++) {
    add({ k: 'puff', pal: 'steam', t0: hit + T.petal0 + i * 0.16, life: rng.range(1.4, 1.9), a: rng.range(0, TAU), speed: rng.range(2, 10), z0: dz.lip + dz.H + 16, vz: rng.range(24, 40), r0: 4, r1: 17, drag: 1, a0: 0.6, wind: 12 });
  }
  return out;
}

const fxCache = new Map();
const fxOf = (dz) => {
  if (!fxCache.has(dz.id)) fxCache.set(dz.id, buildFx(dz));
  return fxCache.get(dz.id);
};

function drawPuff(ctx, x, y, r, ry, col, hl, alpha) {
  ctx.globalAlpha = alpha;
  ell(ctx, x, y, r, ry, col, 'rgba(26,20,16,.32)', 1.3);
  ctx.globalAlpha = alpha * 0.55;
  ell(ctx, x - r * 0.28, y - ry * 0.32, r * 0.55, ry * 0.5, hl, null);
  ctx.globalAlpha = 1;
}

/** Draws every live particle at its place for the clock; (0, 0) is the foot of the capsule. */
function drawParticles(ctx, dz, clock, ox, oy) {
  const list = fxOf(dz);
  for (const p of list) {
    const age = clock - p.t0;
    if (age < 0 || age > p.life) continue;
    const u = age / p.life;
    if (p.k === 'puff' || p.k === 'fire') {
      const travel = (1 - Math.exp(-p.drag * age)) / p.drag;
      const s0 = p.from ?? 0;
      const gx = (s0 + p.speed * travel) * Math.cos(p.a) + (p.wind ?? 0) * age * (0.4 + u);
      const gy = (s0 + p.speed * travel) * Math.sin(p.a) * E;
      const z = p.z0 + p.vz * travel;
      const r = lerp(p.r0, p.r1, 1 - (1 - u) * (1 - u));
      if (p.k === 'fire') {
        const col = u < 0.25 ? '#fff0b0' : u < 0.55 ? '#ffb13b' : u < 0.8 ? '#e2531f' : '#5a3a2e';
        ctx.globalAlpha = u < 0.8 ? 0.95 : (1 - u) * 4.5;
        ell(ctx, ox + gx, oy + gy - z, r, r * 0.9, col, null);
        ctx.globalAlpha = 1;
        continue;
      }
      const pal = SMOKE_COLORS[p.pal];
      const col = ramp(pal, Math.pow(u, 0.75));
      const hl = ramp(pal, Math.min(1, Math.pow(u, 0.75) + 0.3));
      const alpha = p.a0 * Math.pow(1 - u, 1.4) * Math.min(1, age / 0.08);
      drawPuff(ctx, ox + gx, oy + gy - z, r, r * (p.pal === 'dust' ? 0.72 : 0.9), col, hl, alpha);
    } else if (p.k === 'chunk') {
      const s0 = p.from ?? 0;
      const tg = (p.vz + Math.sqrt(p.vz * p.vz + 2 * p.g * p.z0)) / p.g;
      let along;
      let z;
      if (age < tg) {
        along = s0 + p.speed * age;
        z = p.z0 + p.vz * age - 0.5 * p.g * age * age;
      } else {
        const a2 = age - tg;
        const v2 = (p.vz - p.g * tg) * -0.32;
        along = s0 + p.speed * tg + p.speed * 0.35 * a2;
        z = Math.max(0, v2 * a2 - 0.5 * p.g * a2 * a2);
      }
      const x = ox + along * Math.cos(p.a);
      const y = oy + along * Math.sin(p.a) * E - z;
      const fade = u > 0.8 ? (1 - u) / 0.2 : 1;
      ctx.globalAlpha = fade;
      const ro = p.rot + p.spin * age;
      const sz = p.size;
      const shape = [];
      for (let k = 0; k < 5; k++) {
        const a = ro + (k / 5) * TAU;
        const rr = sz * (k % 2 ? 0.75 : 1.1);
        shape.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8]);
      }
      poly(ctx, shape, p.col === 'steel' ? C.steelL : p.col, INK, 1.6);
      if (z > 0.5) shadow(ctx, ox + along * Math.cos(p.a), oy + along * Math.sin(p.a) * E, sz * 0.8, sz * 0.4, 0.25 * fade);
      ctx.globalAlpha = 1;
    } else if (p.k === 'spark') {
      const along = p.speed * age;
      const z = p.z0 + p.vz * age - 0.5 * p.g * age * age;
      const x = ox + along * Math.cos(p.a);
      const y = oy + along * Math.sin(p.a) * E - Math.max(0, z);
      const vz = p.vz - p.g * age;
      ctx.globalAlpha = 1 - u;
      line(ctx, [x, y], [x - Math.cos(p.a) * p.speed * 0.04, y + vz * 0.04 - Math.sin(p.a) * E * p.speed * 0.04], '#ffe27a', 2);
      ctx.globalAlpha = 1;
    } else if (p.k === 'flash') {
      const r = p.size * (0.5 + u);
      ctx.globalAlpha = 1 - u;
      const x = ox + p.x;
      const y = oy + p.y - p.z0;
      ell(ctx, x, y, r, r, 'rgba(255,200,90,.7)', null);
      ell(ctx, x, y, r * 0.55, r * 0.55, '#fff6d0', null);
      ctx.globalAlpha = 1;
    } else if (p.k === 'ember') {
      const x = ox + p.x + p.vx * age;
      const y = oy - (p.z + p.vz * age);
      ctx.globalAlpha = 1 - u;
      line(ctx, [x, y], [x, y - 9], '#ffb13b', 2);
      ctx.globalAlpha = 1;
    }
  }
}

// ---------- Ground effects of a draft ----------

const CRACKS = (() => {
  const rng = createRng('kapsel:cracks');
  const list = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + rng.range(-0.2, 0.2);
    const len = rng.range(14, 34);
    const kink = rng.range(-0.35, 0.35);
    list.push({ a, len, kink, branch: rng.range(0.45, 0.7) });
  }
  return list;
})();

function drawGroundFx(ctx, dz, since, ox, oy) {
  if (since < 0) return;
  // Scorch mark and cracks stay.
  const grow = smooth(clamp01(since / 0.16));
  for (const [r, a] of [[64, 0.16], [48, 0.2], [32, 0.24]]) {
    ell(ctx, ox, oy, r * grow, r * grow * E, `rgba(14,10,8,${a})`, null);
  }
  const cool = clamp01(1 - since / 3.5);
  for (const c of CRACKS) {
    const l = c.len * grow;
    const p0 = [ox + Math.cos(c.a) * 24, oy + Math.sin(c.a) * 24 * E];
    const p1 = [ox + Math.cos(c.a + c.kink) * l * c.branch + Math.cos(c.a) * 12, oy + (Math.sin(c.a + c.kink) * l * c.branch + Math.sin(c.a) * 12) * E];
    const p2 = [ox + Math.cos(c.a) * (24 + l), oy + Math.sin(c.a) * (24 + l) * E];
    ink(ctx, [p0, p1, p2], 2.2);
    if (cool > 0.02) {
      ctx.globalAlpha = cool * 0.7;
      line(ctx, p0, p1, '#ff8a2a', 1);
      line(ctx, p1, p2, '#ff8a2a', 1);
      ctx.globalAlpha = 1;
    }
  }
  // Shock rings.
  const ring = (delay, dur, rmax, w0, col) => {
    const u = (since - delay) / dur;
    if (u < 0 || u > 1) return;
    const r = lerp(16, rmax, 1 - (1 - u) * (1 - u));
    ctx.globalAlpha = (1 - u) * 0.85;
    ell(ctx, ox, oy, r, r * E, `rgba(255,236,200,${0.1 * (1 - u)})`, col, lerp(w0, 1.2, u));
    ctx.globalAlpha = 1;
  };
  ring(0, 0.55, 170, 9, '#fff0d4');
  ring(0.09, 0.75, 118, 5, '#ffae60');
  // White-hot flash at the moment of contact.
  const fl = 1 - since / 0.14;
  if (fl > 0) {
    ctx.globalAlpha = fl * 0.7;
    ell(ctx, ox, oy, 76, 38, 'rgba(255,214,140,.55)', null);
    ell(ctx, ox, oy, 44, 22, '#fff4cc', null);
    ctx.globalAlpha = 1;
  }
}

// ---------- A draft capsule ----------

/**
 * @param {{x: number, y: number, doctrine: string, rank: number}} pod
 * @param {number} clock  Time on the draft's own timeline.
 * @param {{focus?: number, rest?: boolean, t: number}} opt
 */
function drawDesignPod(ctx, dz, pod, clock, opt) {
  const [gx, gy] = iso(pod.x + 0.5, pod.y + 0.5);
  const hit = impactOf(dz);
  const since = clock - hit;
  if (clock < dz.T.appear) return;
  const z = since >= 0 ? 0 : fallZ(dz, clock);
  const falling = since < 0;
  const heat = falling ? 1 : clamp01(1 - since / COOL_SECONDS);
  const focus = opt.focus ?? 0;
  const color = DOCTRINE_COLORS[pod.doctrine];
  const f = fallProfile(dz);
  const brakeOn = clock >= dz.T.appear + f.free && since < 0.14 ? clamp01((clock - dz.T.appear - f.free) / 0.06) * (since > 0 ? 1 - since / 0.14 : 1) : 0;
  const glow = smooth(clamp01((since - dz.T.petal0 - (dz.n - 1) * dz.T.stagger * 0.55) / 0.5));
  const st = { heat, glow, focus, color, since, t: opt.t };

  // Shadow: grows while it comes down, then a soft silhouette under the pod and its plates.
  if (falling) {
    const k = 1 - Math.min(1, z / FALL_HEIGHT);
    shadow(ctx, gx, gy + 2, 18 + 15 * k, 7 + 7 * k, 0.45 * k + 0.05);
  } else {
    const open = clamp01(since / (dz.T.petal0 + dz.T.stagger * dz.n));
    shadow(ctx, gx + 5, gy + 2, 30 + 18 * open, 15 + 9 * open, 0.34);
  }

  ctx.save();
  ctx.translate(gx, gy - z);

  // Re-entry: the veil of hot air around the capsule and the tail behind it.
  if (falling) {
    const top = (dz.lip + dz.H + 26) * dz.S;
    const tail = Math.min(520, 150 + (FALL_HEIGHT - z) * 0.6, z + 400);
    const wob = Math.sin(opt.t * 40) * 1.5;
    const layer = (w, col, len) => {
      ctx.beginPath();
      ctx.moveTo(-w, -top * 0.4);
      ctx.quadraticCurveTo(-w * 0.9, -top - len * 0.4, wob, -top - len);
      ctx.quadraticCurveTo(w * 0.9, -top - len * 0.4, w, -top * 0.4);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    };
    layer(34, 'rgba(255,92,30,.16)', tail);
    layer(24, 'rgba(255,150,60,.26)', tail * 0.8);
    layer(14, 'rgba(255,214,130,.4)', tail * 0.55);
    for (let k = 0; k < 6; k++) {
      const xx = (k - 2.5) * 9 + Math.sin(opt.t * 17 + k) * 2;
      ctx.globalAlpha = 0.5;
      line(ctx, [xx, -top - 20 - k * 6], [xx * 1.1, -top - tail * (0.5 + 0.08 * ((k * 5) % 4))], 'rgba(255,230,170,.8)', 1.6);
      ctx.globalAlpha = 1;
    }
    // Hot air hugging the shell: wide, translucent, no hard edge.
    for (const [rx, ry, a] of [[44, 56, 0.1], [36, 46, 0.14], [28, 36, 0.18]]) {
      ell(ctx, 0, -top * 0.45, rx, ry, `rgba(255,150,70,${a})`, null);
    }
    // Hot bow below the shield.
    ell(ctx, 0, 4, 40, 20, 'rgba(255,190,100,.28)', null);
    ell(ctx, 0, 3, 26, 13, 'rgba(255,236,170,.45)', null);
  }

  ctx.scale(dz.S * (1 + 0.06 * focus), dz.S * (1 + 0.06 * focus));
  const bells = [];

  // Pre-roll of the shell: build the parts back to front.
  drawShield(ctx, dz, st);
  if (glow > 0.01) {
    // The core lights the ground between the plates.
    for (const [r, a] of [[60, 0.1], [46, 0.14], [32, 0.2]]) {
      ctx.globalAlpha = glow * a * (1 + focus * 0.6);
      ell(ctx, 0, 0, r, r * E, color, null);
    }
    ctx.globalAlpha = 1;
  }

  // Phase of every segment.
  const crack = crackAmount(dz, since);
  const phis = new Array(dz.n).fill(0);
  dz.order.forEach((seg, k) => {
    phis[seg] = Math.max(crack, swing(dz, since, k));
  });
  const lift = focus * 0.3;

  // The bell flames of the back row go behind the wall, the front row in front of it.
  // Order: back segments, core, front segments, collar and roof.
  const geoms = [];
  for (let i = 0; i < dz.n; i++) {
    const am = seamAngle(dz, i) + TAU / dz.n / 2;
    geoms.push({ i, am, back: Math.sin(am) < -0.05 });
  }
  for (const g of geoms) if (g.back) drawPetal(ctx, dz, g.i, phis[g.i], phis[g.i] > 0.9 ? lift : 0, st);
  drawCore(ctx, dz, st);
  const frontOrder = geoms.filter((g) => !g.back).sort((p, q) => Math.sin(p.am) - Math.sin(q.am));
  for (const g of frontOrder) drawPetal(ctx, dz, g.i, phis[g.i], phis[g.i] > 0.9 ? lift : 0, st);
  drawTop(ctx, dz, st, bells);

  // Brake flames.
  if (brakeOn > 0.01) {
    for (const m of bells) {
      const len = Math.min(120 * brakeOn, z / dz.S + (-m.mouth[1]) + 8);
      drawFlame(ctx, m, len, opt.t, m.a);
    }
  }
  ctx.restore();
}

/** Hologram of a draft: the game's own function, fed with a clock mapped to the game's timing. */
function drawDesignHologram(ctx, dz, pod, clock, t) {
  const since = clock - impactOf(dz);
  const fake = { x: pod.x, y: pod.y, doctrine: pod.doctrine, rank: pod.rank, landed: true, t: IMPACT_SECONDS + PODS.hologramDelaySeconds + (since - dz.T.holoAt) };
  drawPodHologram(ctx, fake, t);
}

// ---------- Selection ----------

/** Frame on the cell diamond instead of a ring: brackets in the corners, a faint fill, a pulse. */
function drawSelectionFrame(ctx, pod, selected, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  const inset = selected ? 0.04 - pulse * 0.02 : 0.1;
  const corners = [iso(pod.x + inset, pod.y + inset), iso(pod.x + 1 - inset, pod.y + inset), iso(pod.x + 1 - inset, pod.y + 1 - inset), iso(pod.x + inset, pod.y + 1 - inset)];
  if (selected) {
    poly(ctx, corners, `rgba(242,193,78,${0.1 + pulse * 0.08})`, null);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [lw, col] of [[7, INK], [3.4, C.gold]]) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = col;
      for (let i = 0; i < 4; i++) {
        const p = corners[i];
        const a = corners[(i + 1) % 4];
        const b = corners[(i + 3) % 4];
        ctx.beginPath();
        ctx.moveTo(p[0] + (a[0] - p[0]) * 0.44, p[1] + (a[1] - p[1]) * 0.44);
        ctx.lineTo(p[0], p[1]);
        ctx.lineTo(p[0] + (b[0] - p[0]) * 0.44, p[1] + (b[1] - p[1]) * 0.44);
        ctx.stroke();
      }
    }
  } else {
    ctx.setLineDash([5, 6]);
    poly(ctx, corners, null, 'rgba(242,193,78,.5)', 2);
    ctx.setLineDash([]);
  }
}

/** Stronger light column of the focused capsule: layered, with rising sparks. */
function drawFocusColumn(ctx, pod, focus, t) {
  if (focus <= 0.01) return;
  const [gx, gy] = iso(pod.x + 0.5, pod.y + 0.5);
  const color = DOCTRINE_COLORS[pod.doctrine];
  const top = gy - 100;
  for (const [w0, w1, a] of [[22, 34, 0.12], [15, 24, 0.16], [8, 14, 0.2]]) {
    ctx.globalAlpha = a * focus;
    poly(ctx, [[gx - w0, gy - 30], [gx + w0, gy - 30], [gx + w1, top], [gx - w1, top]], color, null);
  }
  ctx.globalAlpha = 1;
  for (let k = 0; k < 7; k++) {
    const u = (t * 0.6 + k / 7) % 1;
    const x = gx + Math.sin(k * 5.1) * 14;
    ctx.globalAlpha = (1 - u) * 0.9 * focus;
    ctx.fillStyle = color;
    ctx.fillRect(x - 1.5, gy - 34 - u * 70, 3, 3);
  }
  ctx.globalAlpha = 1;
}

// ---------- State, camera, scenes ----------

const canvas = document.getElementById('game');
const mainCtx = canvas.getContext('2d', { alpha: false });
/** The context the scene functions draw into; the silhouette view swaps it for a layer. */
let ctx = mainCtx;
const layer = document.createElement('canvas');
const layerCtx = layer.getContext('2d');
installPageGuards(canvas);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = { variant: 'heute', mode: 'landing', doctrine: DOCTRINE_IDS[0], silhouette: false, playing: true, slow: false, clock: 0 };
const camera = createCamera();
const limits = { ...CAMERA, minZoom: 0.25, maxZoom: 3, minCellPx: 0 };
const bounds = mapBounds(SIZE);
const cache = createSpriteCache();
const ground = createGroundLayer();
const drawHeutePod = createPodRenderer(cache);
const view = createCanvasView(canvas, () => {
  clampCamera(camera, bounds, limits);
});

const TOWERS_LANDING = [
  { x: 2, y: 3, doctrine: DOCTRINE_IDS[0], rank: 2, flash: 0 },
  { x: 4, y: 3, doctrine: DOCTRINE_IDS[3], rank: 3, flash: 0 },
];
const TOWERS_SELECT = [
  { x: 2, y: 2, doctrine: DOCTRINE_IDS[0], rank: 2, flash: 0 },
  { x: 4, y: 3, doctrine: DOCTRINE_IDS[3], rank: 3, flash: 0 },
];
const SALVO = [
  { x: 1, y: 3, doctrine: 'laser', rank: 1 },
  { x: 4, y: 1, doctrine: 'mortar', rank: 2 },
  { x: 3, y: 4, doctrine: null, rank: 3, selected: true },
  { x: 6, y: 4, doctrine: 'psi', rank: 2 },
];
const LANDING_POD = { x: 3, y: 3, rank: 3 };

/** Selection fades in the focus of the chosen capsule; the others stay at zero. */
const focusOf = { value: 0 };

// "Heute": the game's effects run on a fake state and are replayed from zero when the clock jumps.
const heute = { fx: null, time: 0, state: null };
function resetHeute() {
  heute.fx = createEffects();
  heute.time = 0;
  heute.state = {
    events: [], enemies: [], towers: [], projectiles: [], pendingStrikes: [], banners: [], map: { obstacles: [] },
    pods: [{ x: LANDING_POD.x, y: LANDING_POD.y, t: 0, landed: false, doctrine: state.doctrine, rank: LANDING_POD.rank, index: 0 }],
  };
}
function heuteTo(clock) {
  if (!heute.fx || clock < heute.time - 1e-6) resetHeute();
  const pod = heute.state.pods[0];
  pod.doctrine = state.doctrine;
  while (heute.time < clock - 1e-6) {
    const dt = Math.min(1 / 60, clock - heute.time);
    heute.time += dt;
    pod.t = heute.time;
    if (!pod.landed && pod.t >= IMPACT_SECONDS) {
      pod.landed = true;
      heute.state.events.push({ type: 'podImpact', x: pod.x, y: pod.y, index: 0 });
    }
    heute.fx.update(dt, heute.state, reduceMotion);
    heute.state.events.length = 0;
  }
  pod.t = clock;
  pod.landed = clock >= IMPACT_SECONDS;
}

function fitCameraTo(zoom) {
  const [wx, wy] = iso(LANDING_POD.x + 0.5, LANDING_POD.y + 0.5);
  camera.zoom = zoom;
  camera.x = wx;
  camera.y = wy - 40 / zoom;
  clampCamera(camera, bounds, limits);
}
function fitAll() {
  fitCameraTo(Math.min(view.width / 560, view.height / 520));
}

/** Screen shake of a draft: a few hits that die out fast; none with reduced motion. */
function shakeOf(dz, since) {
  if (reduceMotion || since < 0) return [0, 0];
  let amp = 0;
  const hits = [[0, 7, 9]];
  dz.order.forEach((_, k) => hits.push([dz.T.petal0 + k * dz.T.stagger + dz.T.petalDur, 1.6, 12]));
  hits.push([dz.T.bolts, 2.2, 14]);
  for (const [t0, a, decay] of hits) {
    const age = since - t0;
    if (age >= 0) amp += a * Math.exp(-age * decay);
  }
  if (amp < 0.2) return [0, 0];
  return [Math.sin(since * 131) * amp, Math.cos(since * 97) * amp * 0.8];
}

function objectsFor(clock, t, dt) {
  const mode = state.mode;
  const items = [];
  const design = DESIGNS[state.variant];
  const towers = mode === 'landing' ? TOWERS_LANDING : TOWERS_SELECT;
  for (const tw of towers) items.push({ key: tw.x + tw.y + 1, draw: () => drawTowerSprite(ctx, cache, tw, camera.zoom, view.dpr, t, dt, reduceMotion) });
  if (mode === 'landing') {
    if (!design) {
      const pod = heute.state.pods[0];
      items.push({ key: pod.x + pod.y + 1, draw: () => drawHeutePod(ctx, pod, t, { zoom: camera.zoom, dpr: view.dpr }) });
    } else {
      items.push({ key: LANDING_POD.x + LANDING_POD.y + 1, draw: () => drawDesignPod(ctx, design, { ...LANDING_POD, doctrine: state.doctrine }, clock, { t }) });
    }
  } else {
    for (const s of SALVO) {
      const pod = { ...s, doctrine: s.doctrine ?? state.doctrine };
      if (!design) {
        const rec = { ...pod, t: IMPACT_SECONDS + 8, landed: true, index: 0 };
        items.push({ key: pod.x + pod.y + 1, draw: () => drawHeutePod(ctx, rec, t, { zoom: camera.zoom, dpr: view.dpr }) });
      } else {
        const focus = s.selected ? focusOf.value : 0;
        items.push({ key: pod.x + pod.y + 1, draw: () => drawDesignPod(ctx, design, pod, impactOf(design) + 8, { t, focus }) });
      }
    }
  }
  return items.sort((a, b) => a.key - b.key);
}

let lastNow = null;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = lastNow === null ? 0 : Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  const t = now / 1000;
  if (state.playing) {
    state.clock += dt * (state.slow ? SLOW : 1);
    if (state.clock > LOOP) state.clock -= LOOP;
    scrub.value = String(Math.round(state.clock * 100));
  }
  clockOut.textContent = `${state.clock.toFixed(2).replace('.', ',')} s`;
  // Selection focus eases in over real time, so the change is visible in the video of the study.
  const targetFocus = state.mode === 'auswahl' && state.variant !== 'heute' ? 1 : 0;
  focusOf.value += (targetFocus - focusOf.value) * Math.min(1, dt * 7);
  if (Math.abs(targetFocus - focusOf.value) < 0.003) focusOf.value = targetFocus;

  const design = DESIGNS[state.variant];
  const clock = state.clock;
  if (!design && state.mode === 'landing') heuteTo(clock);

  // Camera shake and white flash.
  let shake = [0, 0];
  let flash = 0;
  if (state.mode === 'landing') {
    if (design) {
      const since = clock - impactOf(design);
      shake = shakeOf(design, since);
      flash = since >= 0 ? clamp01(1 - since / 0.2) * (reduceMotion ? 0.1 : 0.4) : 0;
    } else {
      shake = heute.fx.shakeOffset(reduceMotion);
    }
  }
  const cam = { x: camera.x - shake[0] / camera.zoom, y: camera.y - shake[1] / camera.zoom, zoom: camera.zoom };

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = C.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ground.draw(ctx, cam, view, SIZE, SEED, now);
  applyCamera(ctx, cam, view);

  // Ground level: markers, rings, scorch, selection frames.
  if (state.mode === 'landing') {
    const [gx, gy] = iso(LANDING_POD.x + 0.5, LANDING_POD.y + 0.5);
    if (design) {
      const hit = impactOf(design);
      if (clock < hit) {
        const mark = { x: LANDING_POD.x, y: LANDING_POD.y, landed: false, t: (clock * IMPACT_SECONDS) / hit };
        drawPodTarget(ctx, mark, t);
      } else {
        drawGroundFx(ctx, design, clock - hit, gx, gy);
      }
    } else {
      const pod = heute.state.pods[0];
      drawPodTarget(ctx, pod, t);
      heute.fx.drawGround(ctx, heute.state, t, reduceMotion);
    }
  }

  if (state.silhouette) {
    // Everything that stands on the map goes into a layer, which is then filled black.
    if (layer.width !== canvas.width || layer.height !== canvas.height) {
      layer.width = canvas.width;
      layer.height = canvas.height;
    }
    layerCtx.setTransform(1, 0, 0, 1, 0, 0);
    layerCtx.globalCompositeOperation = 'source-over';
    layerCtx.clearRect(0, 0, layer.width, layer.height);
    ctx = layerCtx;
    applyCamera(ctx, cam, view);
    for (const item of objectsFor(clock, t, dt)) item.draw();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, layer.width, layer.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx = mainCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    applyCamera(ctx, cam, view);
  } else {
    for (const item of objectsFor(clock, t, dt)) item.draw();
  }
  // The frame of the selection is an overlay on the cell, so the plates do not hide it.
  if (state.mode === 'auswahl' && design) {
    for (const s of SALVO) drawSelectionFrame(ctx, s, Boolean(s.selected) && focusOf.value > 0.5, t);
  }

  // Above the objects: smoke, light column, hologram.
  if (state.mode === 'landing') {
    const [gx, gy] = iso(LANDING_POD.x + 0.5, LANDING_POD.y + 0.5);
    if (design) {
      drawParticles(ctx, design, clock, gx, gy);
      drawDesignHologram(ctx, design, { ...LANDING_POD, doctrine: state.doctrine }, clock, t);
    } else {
      heute.fx.drawAbove(ctx, heute.state, t, reduceMotion);
      drawPodHologram(ctx, heute.state.pods[0], t);
    }
  } else {
    for (const s of SALVO) {
      const pod = { ...s, doctrine: s.doctrine ?? state.doctrine };
      const rec = { ...pod, t: IMPACT_SECONDS + 8, landed: true, index: 0 };
      if (design) {
        drawFocusColumn(ctx, pod, s.selected ? focusOf.value : 0, t);
        drawDesignHologram(ctx, design, pod, impactOf(design) + 8, t);
      } else {
        drawPodHighlight(ctx, rec, { selected: Boolean(s.selected), t, reducedMotion: reduceMotion });
        drawPodHologram(ctx, rec, t);
      }
    }
  }

  if (flash > 0.01) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(255,240,210,${flash})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (!design && state.mode === 'landing') {
    heute.fx.drawFlash(ctx, view, reduceMotion);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------- HUD ----------

const $ = (id) => document.getElementById(id);
const scrub = $('scrub');
const clockOut = $('clock');
const NOTES = {
  heute: 'Heute: die echten Spielfunktionen samt den Effekten aus effects.js.',
  a: 'A schwer: fünf Segmente, breiter Hitzeschild, Gefahrenband, Bremsdüsen an der Schulter.',
  b: 'B schlank: vier Segmente, hoher Rumpf, Bremsturm auf dem Dach, Landestützen am Schild.',
  c: 'C Segmente: fünf getrennte Platten mit Fugen, gestufte Wand, Klammerkrone, geteilter Hitzeschild.',
};

function refreshButtons() {
  for (const v of ['heute', 'a', 'b', 'c']) $(`v-${v}`).classList.toggle('on', state.variant === v);
  for (const m of ['landing', 'auswahl']) $(`m-${m}`).classList.toggle('on', state.mode === m);
  $('silhouette').classList.toggle('on', state.silhouette);
  $('play').textContent = state.playing ? 'Pause' : 'Abspielen';
  $('play').classList.toggle('on', !state.playing);
  $('slow').classList.toggle('on', state.slow);
  for (const id of DOCTRINE_IDS) $(`d-${id}`).classList.toggle('on', state.doctrine === id);
  $('note').textContent = `${NOTES[state.variant]} Ziehen verschiebt, Mausrad oder Zwei-Finger-Geste zoomt.`;
  scrub.disabled = state.mode === 'auswahl';
}

for (const v of ['heute', 'a', 'b', 'c']) {
  $(`v-${v}`).addEventListener('click', () => {
    state.variant = v;
    resetHeute();
    refreshButtons();
  });
}
for (const m of ['landing', 'auswahl']) {
  $(`m-${m}`).addEventListener('click', () => {
    state.mode = m;
    refreshButtons();
  });
}
for (const id of DOCTRINE_IDS) {
  const b = document.createElement('button');
  b.id = `d-${id}`;
  b.type = 'button';
  b.className = 'dot';
  b.style.setProperty('--dot', DOCTRINE_COLORS[id]);
  b.textContent = STRINGS.doctrines[id];
  b.addEventListener('click', () => {
    state.doctrine = id;
    refreshButtons();
  });
  $('doctrines').append(b);
}
$('silhouette').addEventListener('click', () => {
  state.silhouette = !state.silhouette;
  refreshButtons();
});
$('play').addEventListener('click', () => {
  state.playing = !state.playing;
  refreshButtons();
});
$('slow').addEventListener('click', () => {
  state.slow = !state.slow;
  refreshButtons();
});
scrub.addEventListener('input', () => {
  state.clock = Number(scrub.value) / 100;
  state.playing = false;
  refreshButtons();
});
for (const [id, z] of [['zoom-05', 0.5], ['zoom-1', 1], ['zoom-2', 2]]) $(id).addEventListener('click', () => fitCameraTo(z));
$('fit').addEventListener('click', fitAll);

attachPointerInput(canvas, {
  onPan(dx, dy) {
    panBy(camera, dx, dy);
    clampCamera(camera, bounds, limits);
  },
  onZoom(f, x, y) {
    zoomAt(camera, view, f, x, y, limits);
    clampCamera(camera, bounds, limits);
  },
});

/** Hooks for the screenshot script. */
window.__kapsel = {
  set(opts = {}) {
    Object.assign(state, opts);
    if ('clock' in opts) scrub.value = String(Math.round(state.clock * 100));
    resetHeute();
    if ('mode' in opts && opts.mode === 'auswahl') focusOf.value = state.variant === 'heute' ? 0 : 1;
    refreshButtons();
  },
  zoom: fitCameraTo,
  /** Clock value of the strike of the current variant plus an offset. */
  impact: (offset = 0) => (DESIGNS[state.variant] ? impactOf(DESIGNS[state.variant]) : IMPACT_SECONDS) + offset,
  loop: LOOP,
  particleCount: (id) => fxOf(DESIGNS[id]).length,
  state: () => ({ ...state }),
};

refreshButtons();
resetHeute();
fitCameraTo(1.6);
cache.preload([...allTowerDefs(), ...POD_SPRITE_DEFS], 1, view.dpr).then(() => cache.preload([...allTowerDefs(), ...POD_SPRITE_DEFS], 2, view.dpr)).then(() => {
  document.body.dataset.ready = 'true';
});
requestAnimationFrame(frame);

