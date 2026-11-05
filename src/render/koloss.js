// The Koloss on screen (docs/ART.md, "Koloss"): a giant crawler of the brood, the "Grabwalze".
//
// A turnable model built from bodies in local coordinates and drawn every frame (there is at
// most one on the field), because it drives on all four axes and has to look right on each of
// them. The shapes and measures come from reference/studien/koloss-schwarm.html; the numbers are
// in KOLOSS_MODEL (src/data/art.js).
//
// Position, heading, turning, standing still and breaking through are all read from the
// simulation record; nothing here writes to it and nothing is reported by an event.

import { iso } from './iso.js';
import { C } from './palette.js';
import { castShadow } from './shadows.js';
import { turnFrame } from './model.js';
import { createBodyScene, limb, blade } from './bodyKit.js';
import { KOLOSS_RUN } from '../data/enemies.js';
import { KOLOSS_MODEL as M, KOLOSS_AIRSTRIKE_MARK } from '../data/art.js';

/** Render-side motion, forgotten with the enemy it belongs to. */
const motion = new WeakMap();

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (t) => t * t * (3 - 2 * t);
/** Shortest turn from angle a to b. */
function turnTo(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/**
 * Sorting depth of the Koloss. It covers several cells, so its middle alone would put it behind
 * things it stands in front of; an offset of 0.4 is what makes it sit right (docs/ART.md).
 */
export function kolossDepth(e) {
  return e.x + e.y + 0.4;
}

/**
 * What the picture needs to know, read from the record: the heading, a turn on the spot in
 * progress (seen as a change of heading, and as long as the turn takes), whether it walks, and
 * whether it is breaking through. Called once per frame.
 */
function readPose(e, simTime, dt) {
  let m = motion.get(e);
  const theta = Math.atan2(e.dy, e.dx);
  if (!m) {
    m = { x: e.x, y: e.y, theta, from: theta, turnAt: -Infinity, turn: 1, gait: 0, breach: 0, time: simTime };
    motion.set(e, m);
  }
  if (Math.abs(Math.atan2(Math.sin(theta - m.theta), Math.cos(theta - m.theta))) > 1e-6) {
    // The heading changed: the old one is where the turn starts from.
    m.from = m.turn >= 1 ? m.theta : m.from;
    m.theta = theta;
    m.turnAt = simTime;
  }
  const before = m.turn;
  m.turn = clamp01((simTime - m.turnAt) / KOLOSS_RUN.turnSeconds);
  const moved = Math.hypot(e.x - m.x, e.y - m.y);
  m.x = e.x;
  m.y = e.y;
  // The legs step with the distance walked, and with the turning on the spot.
  m.gait += moved / M.gait.cellsPerCycle + ((m.turn - before) * KOLOSS_RUN.turnSeconds) / M.gait.turnCycleSeconds;
  const breaching = Boolean(e.charging || e.ram) ? 1 : 0;
  m.breach = breaching ? 1 : Math.max(0, m.breach - Math.max(0, dt) * M.breachFade);
  m.moving = moved > 1e-6 || m.turn < 1;
  return m;
}

/** The limbs and bodies of one frame. `pose`: theta, from, turn, gait, moving, breach, t, flash, still. */
function build(ctx, pose, scene) {
  const K = M.colours;
  const breathe = pose.still ? 0 : Math.sin(pose.t * M.breath.speed) * M.breath.amplitude;
  const heading = pose.turn >= 1 ? pose.theta : null;
  // While it turns, the skull leads and the tail follows: each segment reaches the new heading a
  // little later, all of them within the turn.
  const angle = (i) => (heading !== null ? heading : turnTo(pose.from, pose.theta, smooth(clamp01(pose.turn * M.turn.spread - (i + 1) * M.turn.lag))));
  const headF = turnFrame(angle(-1));
  const H = scene.kit(headF);
  const flash = pose.flash;
  const arch = (hw, h, z0, flat) => [
    [-hw, z0], [-hw, z0 + (h - z0) * 0.42], [-hw * 0.8, z0 + (h - z0) * 0.8], [-hw * flat, h],
    [hw * flat, h], [hw * 0.8, z0 + (h - z0) * 0.8], [hw, z0 + (h - z0) * 0.42], [hw, z0],
  ];

  // Skull: the plough is a wedge, its edge forward in the middle, which splits the rubble to both
  // sides; behind it the head capsule with its eyes.
  const P = M.plough;
  for (const s of [-1, 1]) {
    H.loft(P.side.map(([x, z]) => [x, s * P.halfWidth, z]), P.edge.map(([x, z]) => [x, 0, z]), K.bone, { lw: 2.2, layer: 0.2 });
  }
  const hd = M.head;
  H.shellX(arch(hd.hw, hd.h + breathe, hd.foot, M.shell.crown), hd.from, hd.to, 1, hd.taper, K.chitinD, { lw: 2, skipLast: true });
  for (const ly of M.eyes.ly) H.gem([M.eyes.lx, ly, M.eyes.z], M.eyes.r, M.eyes.up, 0, K.eye, { n: 4, layer: 0.5 });

  M.segments.forEach((s, i) => {
    const F = turnFrame(angle(i));
    const T = scene.kit(F);
    const h = s.h + breathe * (1 - i * 0.15);
    // The shell, wider at the back so the plates lie over each other like shingles, with a bone
    // rim at its front edge. The caps at the seams between two plates are never seen.
    const first = i === 0;
    const last = i === M.segments.length - 1;
    const sec = arch(s.hw, h, M.shell.foot, M.shell.crown);
    T.shellX(sec, s.cx - s.hl, s.cx + s.hl, M.shell.taperFront, M.shell.taperBack, K.chitin, { lw: 2.2, skipLast: true, capA: last, capB: first });
    T.shellX(sec, s.cx + s.hl - M.rim.back, s.cx + s.hl + M.rim.front, M.rim.widen, M.rim.widenBack, K.boneD, { band: true, skipLast: true, lw: 1.6, layer: 0.1 });
    // The spine along the back, leaning backwards, and two side spines on the first segments.
    const sp = M.spine;
    T.tube([s.cx - 0.02, 0, h - 3], [s.cx - sp.lean, 0, h + sp.height - i * sp.shrink], sp.r0, sp.r1, K.bone, { n: 4, capA: false, capB: false, layer: 0.3 });
    if (i < M.sideSpine.count) {
      const ss = M.sideSpine;
      for (const side of [-1, 1]) {
        T.tube([s.cx, side * s.hw * 0.82, h * 0.6], [s.cx - ss.lean, side * (s.hw + ss.out), h * 0.6 + ss.rise], ss.r0, ss.r1, K.bone, { n: 3, capA: false, capB: false, layer: 0.2 });
      }
    }
    // A pair of short legs under every segment, stepping in a wave from the skull back.
    const L = M.legs;
    for (const side of [-1, 1]) {
      const p = (pose.gait - i * L.wave + (side > 0 ? 0.5 : 0)) * Math.PI * 2;
      const stride = pose.moving ? Math.sin(p) * L.stride : 0;
      const lift = pose.moving ? Math.max(0, Math.cos(p)) * L.lift : 0;
      const pts = [
        [s.cx, side * s.hw * 0.8, L.hipZ],
        [s.cx + stride * 0.4, side * (s.hw + L.kneeOut), L.kneeZ + lift],
        [s.cx + stride + L.footAhead, side * (s.hw + L.footOut), lift * 0.6],
      ];
      scene.custom(F, s.cx, side * (s.hw + 0.3), 12, () => limb(ctx, pts.map((q) => F.W(q[0], q[1], q[2])), L.width, K.chitinD, { flash }));
    }
  });
  const tail = M.tail;
  scene.kit(turnFrame(angle(M.segments.length))).tube(tail.from, tail.to, tail.r0, tail.r1, K.chitinD, { n: 5 });

  // Mandibles beside the plough, in code: they close slowly, and snap while it breaks through.
  const md = M.mandible;
  const bite = pose.still ? md.base : md.base + md.swing * Math.sin(pose.t * (pose.breach > 0 ? md.breach : md.calm));
  for (const side of [-1, 1]) {
    scene.custom(headF, 1.75, side * 0.8, 10, () => {
      const pts = [[1.3, side * 0.72, 14], [1.78, side * (0.86 - bite * 0.1), 9], [2.04, side * (0.52 - bite * 0.3), 3], [1.78, side * (0.72 - bite * 0.12), 12], [1.5, side * 0.68, 16]];
      blade(ctx, pts.map((q) => headF.W(q[0], q[1], q[2])), K.bone, flash);
    });
  }
  return angle;
}

/**
 * The ground under it for the cast shadow: the outline of the segments, each at its own heading,
 * so it bends with the body while it turns.
 */
function footprint(angle) {
  const sh = M.shadow;
  const side = (s) => [
    ...[headEdge(angle(-1), sh.tip, s)],
    ...M.segments.map((seg, i) => edge(angle(i), seg.cx, (seg.hw + sh.pad) * s)),
    edge(angle(M.segments.length), sh.tail[0], sh.tail[1] * s),
  ];
  const left = side(-1);
  const right = side(1).reverse();
  return [...left, ...right];
}
const edge = (theta, lx, ly) => {
  const F = turnFrame(theta);
  return F.world(lx, ly);
};
const headEdge = (theta, tip, s) => edge(theta, tip[0], tip[1] * s);

/**
 * Draws the Koloss. The caller places it in the depth-sorted pass by `kolossDepth`.
 * @param {object} e  The enemy record from the simulation.
 * @param {{t: number, dt: number, reducedMotion: boolean, simTime: number}} view
 * @param {object} [stats]  Receives the cost of the frame (faces, parts in code).
 */
export function drawKoloss(ctx, e, { t, dt, reducedMotion, simTime }, stats) {
  const m = readPose(e, simTime, dt);
  const pose = {
    theta: m.theta,
    from: m.from,
    turn: m.turn,
    gait: m.gait,
    moving: m.moving,
    breach: m.breach,
    t,
    flash: (e.flash ?? 0) > 0,
    still: reducedMotion,
  };
  const scene = createBodyScene(ctx, { flash: pose.flash, white: M.colours.hitWhite });
  ctx.save();
  const [px, py] = iso(e.x, e.y);
  ctx.translate(px, py);
  const angle = build(ctx, pose, scene);
  // The cast shadow first, in world cells around the position.
  ctx.save();
  ctx.translate(-px, -py);
  castShadow(ctx, footprint(angle).map(([x, y]) => [e.x + x, e.y + y]), M.shadow.height);
  ctx.restore();
  scene.render(stats);
  ctx.restore();
  drawHealthBar(ctx, e);
}

/**
 * The bar above it, with a mark at what one airstrike can take off. Drawn after the model, so
 * nothing covers it.
 */
function drawHealthBar(ctx, e) {
  if (e.dead) return;
  const [x, y] = iso(e.x, e.y, M.bar.z);
  const w = M.bar.width;
  ctx.fillStyle = C.ink;
  ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, 10);
  ctx.fillStyle = '#3a1010';
  ctx.fillRect(x - w / 2, y, w, 6);
  ctx.fillStyle = '#e04a2a';
  ctx.fillRect(x - w / 2, y, w * Math.max(0, e.health / e.maxHealth), 6);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.fillRect(x - w / 2 + w * KOLOSS_AIRSTRIKE_MARK, y, 1.5, 6);
}

/** The Koloss is the one enemy drawn as a model; everything else is a sprite. */
export const isKolossEnemy = (e) => Boolean(e.koloss);


