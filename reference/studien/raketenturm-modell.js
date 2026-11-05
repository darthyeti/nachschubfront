// Study issue 96: the siege mortar as a rocket tower, three drafts of the model.
//
// Since 0.11.21 (issue 90) the siege mortar fires one heavy rocket with a big impact, but its model is still
// the old mortar tube on 50 degrees. Till asked for a launcher with two bigger rockets, close to today's
// mortar. The three drafts keep what the special weapons share (turntable, the special base, the scale of
// the siege mortar) and differ in how the two rockets are carried and reloaded:
//
//   A  Doppelrohr     two closed launch tubes on today's wedge carriage; the warheads stand out of the mouths.
//                     Reloading: the nose slides back out of the empty tube, a lamp at the breech turns
//                     from red to the guide colour.
//   B  Startschienen  two whole rockets with fins lie open on two rails over an armoured shield; a blast
//                     deflector behind. Reloading: the new rocket rises out of the crate up the empty rail.
//   C  Ladearme       two separate arms on a pylon, each with one rocket on top, wide apart (a "Y" seen from
//                     the front). Reloading: the empty arm nods down onto the rack at its side, takes the
//                     next rocket and rises again.
//
// A model from bodies in local coordinates, exactly like src/render/specials.js (lx forward and ly sideways
// in cells, z up in px above the roof plate, SOLID_K px of z per cell for round bodies). Every body belongs
// to one of the named parts below, so the study can draw a single part, and the concept SVGs
// (tests/tools/raketenturm-stills.mjs) can export one symbol per part with its anchor points.
//
// Nothing here is game code; src/ stays as it is. The simulation is untouched: one shell per shot, aim
// 0.8 s, reload 3.2 s. The two rockets go off in turn, one per shot; the empty one is loaded over the reload
// while the other waits ready, so the next shot never waits for the loader.

import { solidKit, SOLID_K as K } from '../../src/render/model.js';

// Steel tones of the capsule, as in src/render/specials.js.
const STEEL = '#a6adb8';
const STEEL_M = '#8d94a0';
const STEEL_D = '#717884';
const STEEL_DD = '#4a505b';
const DARK = '#2a2d33';
const COPPER = '#b2723d';
const GOLD = '#e0b83e';
/** Body of a rocket: lighter than the launcher so it reads against it. */
const SHELL = '#d6d9de';
const BORE = '#14100c';
const LENS = '#ff4a4a';
const LENS_OFF = '#7a2a2a';
const LAMP_OFF = '#5a1c1c';

/** The parts a model is made of, in the order of the concept sheet. */
export const PARTS = ['sockel', 'gehaeuse', 'werfer', 'rakete0', 'rakete1'];
export const PART_NAMES = {
  sockel: 'Sockel (Drehkranz)',
  gehaeuse: 'Gehäuse (Lafette)',
  werfer: 'Werfer (schwenkbar)',
  rakete0: 'Rakete links',
  rakete1: 'Rakete rechts',
};

/**
 * Share of the reload over which the empty rocket comes back, from and to (0 is the shot, 1 the next shot).
 * It ends before the last 0.8 s, so the aiming phase always shows two ready rockets.
 */
export const LOAD = { from: 0.2, to: 0.7 };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (u) => u * u * (3 - 2 * u);

/** Pose of a draft at one moment: everything the model needs besides the angle. */
export function rtRestPose(accent) {
  return { accent, load: [1, 1], kick: [0, 0], seek: 0, tube: 0 };
}

/** Axis helpers for a launcher tilted by `elev` about a pivot [px, 0, pz]. */
function axisOf(elev, pivot) {
  const c = Math.cos(elev);
  const s = Math.sin(elev);
  /** A local point at `t` cells along the axis from the pivot, `ly` sideways, `h` cells above the axis. */
  const at = (t, ly = 0, h = 0) => [pivot[0] + t * c - h * s, ly, pivot[2] + (t * s + h * c) * K];
  /** The same as an (lx, z) pair for a prism section. */
  const xz = (t, h = 0) => {
    const p = at(t, 0, h);
    return [p[0], p[2]];
  };
  return { c, s, at, xz, dir: [c, 0, s] };
}

/** The turntable under every special weapon: a steel ring with a gold band and one in the guide colour. */
function turntable(T, add, r, acc) {
  add('sockel', T.column(0, 0, r, r - 0.01, 0, 4, STEEL_DD, { n: 8, lw: 1.6 }));
  add('sockel', T.column(0, 0, r + 0.012, r + 0.012, 0.9, 1.9, GOLD, { n: 8, lw: 1.1, top: false }));
  add('sockel', T.column(0, 0, r + 0.012, r + 0.012, 2.3, 3.2, acc, { n: 8, lw: 1.1, top: false }));
  add('sockel', T.column(0, 0, r - 0.02, r - 0.04, 4, 6.5, STEEL_D, { n: 8, layer: 0.5, lw: 1.8 }));
}

/**
 * A heavy rocket along an axis: body, a dark band, the warhead in the guide colour of the mortar doctrine
 * and, with `fins`, three fins at the tail (up and to both sides; the one below would hide in the rail).
 * `base` and `tip` are cells along the axis, `R` the radius. `from` cuts it off below (the part still in a
 * tube or behind a mouth is not built).
 */
function rocket(T, add, part, ax, ly, base, tip, R, acc, layer, o = {}) {
  const len = tip - base;
  const from = Math.max(base, o.from ?? -Infinity);
  const head = base + len * 0.66;
  const neck = base + len * 0.84;
  if (from < head - 0.01) {
    add(part, T.tube(ax.at(from, ly), ax.at(head, ly), R, R, SHELL, { n: 8, layer, capA: from > base + 0.001 ? false : [{ k: 0.6, c: DARK }, { k: 0.3, c: BORE }], capB: false, lw: 1.2 }));
    if (from < base + len * 0.5) {
      add(part, T.tube(ax.at(base + len * 0.5, ly), ax.at(base + len * 0.56, ly), R + 0.006, R + 0.006, DARK, { n: 8, layer: layer + 0.02, sides: true, lw: 0.9 }));
    }
  }
  const w0 = Math.max(from, head);
  if (w0 < neck) add(part, T.tube(ax.at(w0, ly), ax.at(neck, ly), R, R * 0.72, acc, { n: 8, layer: layer + 0.03, capA: false, capB: false, lw: 0.9 }));
  const w1 = Math.max(from, neck);
  if (w1 < tip - 0.01) add(part, T.tube(ax.at(w1, ly), ax.at(tip, ly), R * 0.72 * (1 - (w1 - neck) / (tip - neck)), 0.006, acc, { n: 8, layer: layer + 0.04, capA: false, capB: false, lw: 0.8 }));
  if (o.fins && from <= base + 0.001) {
    const f0 = base + 0.01;
    const f1 = base + len * 0.2;
    const span = o.fins;
    const th = 0.009;
    // Upper fin: a plate in the plane of the axis, standing up from the body.
    add(part, T.prism([ax.xz(f0, R), ax.xz(f1, R), ax.xz(f0 + 0.03, R + span), ax.xz(f0 - 0.03, R + span)], ly - th, ly + th, STEEL_D, { layer: layer + 0.05, lw: 1.1 }));
    // Side fins: plates in the plane of the axis and the sideways line.
    for (const side of [-1, 1]) {
      const y0 = ly + side * R * 0.7;
      const y1 = ly + side * (R + span);
      add(part, T.prism([ax.xz(f0, -th * 1.6), ax.xz(f1, -th * 1.6), ax.xz(f1, th * 1.6), ax.xz(f0, th * 1.6)], Math.min(y0, y1), Math.max(y0, y1), STEEL_D, { layer: layer + 0.05, lw: 1.1 }));
    }
  }
}

/** A small lamp: red while its rocket is loaded, the guide colour when it is ready. */
function lamp(T, add, part, at, ready, acc, layer) {
  add(part, T.gem(at, 0.026, 2.4, 1.2, ready ? acc : LAMP_OFF, { n: 6, layer, lw: 1 }));
}

/** Where the rocket of tube `k` sits along its axis at load `u` (0 empty, 1 ready), for drafts A and B. */
const slide = (u, ready, travel) => ready - (1 - smooth(clamp01(u))) * travel;

// ======================================================================================
// Draft A: Doppelrohr
// ======================================================================================

const A = {
  elevation: (45 * Math.PI) / 180,
  pivot: [0, 0, 24],
  tubeY: [-0.15, 0.15],
  tubeR: 0.13,
  back: -0.28,
  front: 0.4,
  noseR: 0.112,
  noseLen: 0.34,
  /** How far the nose has sunk at load 0 (cells along the tube). */
  travel: 0.3,
  kick: 0.05,
};

function buildA(T, add, p) {
  const acc = p.accent;
  const ax = axisOf(A.elevation, A.pivot);
  turntable(T, add, 0.25, acc);
  // Wedge carriage of today's mortar, wider for two tubes: two cheeks, a cross brace, the rocket crate behind.
  for (const y0 of [-0.33, 0.285]) {
    add('gehaeuse', T.prism([[-0.18, 6.5], [0.16, 6.5], [0.16, 11], [0.06, A.pivot[2] + 4], [-0.06, A.pivot[2] + 4], [-0.18, 13]], y0, y0 + 0.045, STEEL, { layer: 1 }));
  }
  add('gehaeuse', T.box(-0.2, 0.16, -0.18, 0.18, 6.5, 12.5, STEEL_D, { layer: 0.9 }));
  add('gehaeuse', T.box(-0.38, -0.21, -0.16, 0.16, 6.5, 15.5, COPPER, { layer: 0.9, lw: 1.5 }));
  add('gehaeuse', T.box(-0.382, -0.378, -0.16, 0.16, 6.5, 9, GOLD, { layer: 0.95, lw: 1 }));
  add('gehaeuse', T.tube([0, -0.35, A.pivot[2]], [0, 0.35, A.pivot[2]], 0.045, 0.05, STEEL_DD, { n: 8, layer: 1.2, lw: 1.5 }));

  // The launcher: a spine between the tubes, the two tubes with bands, clamps, a lamp per tube, the scope.
  const shift = (k) => -A.kick * (p.kick[k] ?? 0);
  add('werfer', T.prism([ax.xz(A.back + 0.05, -0.05), ax.xz(A.front - 0.06, -0.05), ax.xz(A.front - 0.06, 0.05), ax.xz(A.back + 0.05, 0.05)], -0.03, 0.03, STEEL_DD, { layer: 1.25, lw: 1.4 }));
  A.tubeY.forEach((ly, k) => {
    const s = shift(k);
    const cap = [{ k: 0.82, c: BORE }];
    add('werfer', T.tube(ax.at(A.back + s, ly), ax.at(A.front + s, ly), A.tubeR, A.tubeR, STEEL, { n: 10, layer: 1.3 + k * 0.01, capA: [{ k: 0.7, c: DARK }, { k: 0.45, c: BORE }], capB: cap, lw: 1.7 }));
    add('werfer', T.tube(ax.at(A.front - 0.07 + s, ly), ax.at(A.front - 0.03 + s, ly), A.tubeR + 0.013, A.tubeR + 0.013, GOLD, { n: 10, layer: 1.36 + k * 0.01, sides: true, lw: 1.2 }));
    add('werfer', T.tube(ax.at(A.back + 0.05 + s, ly), ax.at(A.back + 0.1 + s, ly), A.tubeR + 0.011, A.tubeR + 0.011, acc, { n: 10, layer: 1.36 + k * 0.01, sides: true, lw: 1.1 }));
    add('werfer', T.tube(ax.at(0.05 + s, ly * 0.35), ax.at(0.05 + s, ly), 0.022, 0.022, STEEL_D, { n: 5, layer: 1.28, capA: false, capB: false, lw: 1.1 }));
    lamp(T, add, 'werfer', ax.at(A.back + 0.16 + s, ly + Math.sign(ly) * 0.02, A.tubeR + 0.01), (p.load[k] ?? 1) >= 1, acc, 1.45);
    // The rocket: only the warhead out of the mouth shows; while it is loaded it slides out.
    const base = slide(p.load[k] ?? 1, A.front - 0.06, A.travel) + s;
    rocket(T, add, `rakete${k}`, ax, ly, base, base + A.noseLen + 0.06, A.noseR, acc, 1.5 + k * 0.01, { from: A.front + s + 0.004 });
  });
  scope(T, add, ax, sightA(p), acc, p.seek, 1.62, 0.31);
}

const sightA = (p) => axisOf(A.elevation, A.pivot).at(0.16 - A.kick * Math.max(...p.kick) * 0.5, 0, 0.13);

// ======================================================================================
// Draft B: Startschienen
// ======================================================================================

const B = {
  elevation: (38 * Math.PI) / 180,
  pivot: [-0.04, 0, 23],
  railY: [-0.15, 0.15],
  R: 0.1,
  base: -0.34,
  tip: 0.5,
  /** Height of a rocket's axis over its rail. */
  over: 0.11,
  /** How far a rocket sits down the rail at load 0: in the crate. */
  travel: 0.62,
  kick: 0.03,
};

function buildB(T, add, p) {
  const acc = p.accent;
  const ax = axisOf(B.elevation, B.pivot);
  turntable(T, add, 0.25, acc);
  // A low carriage: a block on the turntable, two short cheeks to the trunnion, the crate behind, and an
  // armoured shield in front that leans back, with a gold rim.
  add('gehaeuse', T.box(-0.22, 0.16, -0.2, 0.2, 6.5, 13, STEEL_D, { layer: 0.9 }));
  for (const y0 of [-0.205, 0.16]) {
    add('gehaeuse', T.prism([[-0.12, 12], [0.06, 12], [0.02, B.pivot[2] + 3], [-0.1, B.pivot[2] + 3]], y0, y0 + 0.045, STEEL, { layer: 1 }));
  }
  add('gehaeuse', T.box(-0.42, -0.2, -0.19, 0.19, 6.5, 14, COPPER, { layer: 0.9, lw: 1.5 }));
  add('gehaeuse', T.box(-0.422, -0.418, -0.19, 0.19, 6.5, 9, GOLD, { layer: 0.95, lw: 1 }));
  add('gehaeuse', T.prism([[0.17, 6.5], [0.26, 6.5], [0.22, 15], [0.16, 15]], -0.22, 0.22, STEEL, { layer: 1.05, lw: 1.7 }));
  add('gehaeuse', T.prism([[0.16, 15], [0.22, 15], [0.215, 16.6], [0.155, 16.6]], -0.222, 0.222, GOLD, { layer: 1.08, lw: 1.1 }));
  add('gehaeuse', T.tube([B.pivot[0], -0.22, B.pivot[2]], [B.pivot[0], 0.22, B.pivot[2]], 0.045, 0.05, STEEL_DD, { n: 8, layer: 1.2, lw: 1.5 }));

  // The launch frame: a spine, two rails with cross members, a blast deflector at the back.
  add('werfer', T.prism([ax.xz(B.base, -0.06), ax.xz(B.tip - 0.18, -0.06), ax.xz(B.tip - 0.18, 0.0), ax.xz(B.base, 0.0)], -0.04, 0.04, STEEL_DD, { layer: 1.25, lw: 1.4 }));
  for (const t of [B.base + 0.06, 0.26]) {
    add('werfer', T.tube(ax.at(t, -0.17, 0), ax.at(t, 0.17, 0), 0.02, 0.02, STEEL_D, { n: 6, layer: 1.27, lw: 1.1 }));
  }
  B.railY.forEach((ly, k) => {
    add('werfer', T.prism([ax.xz(B.base - 0.02, -0.0), ax.xz(B.tip - 0.12, -0.0), ax.xz(B.tip - 0.12, B.over - B.R), ax.xz(B.base - 0.02, B.over - B.R)], ly - 0.022, ly + 0.022, STEEL, { layer: 1.3 + k * 0.01, lw: 1.3 }));
    lamp(T, add, 'werfer', ax.at(B.tip - 0.14, ly + Math.sign(ly) * 0.03, 0.01), (p.load[k] ?? 1) >= 1, acc, 1.34);
    // The rocket on its rail: it rises out of the crate while it is loaded (nothing of it shows at first).
    const u = p.load[k] ?? 1;
    if (u > 0.12) {
      const shift = slide(u, 0, B.travel) - B.kick * (p.kick[k] ?? 0);
      rocket(T, add, `rakete${k}`, { ...ax, at: (t, y, h = 0) => ax.at(t, y, h + B.over), xz: (t, h = 0) => ax.xz(t, h + B.over) }, ly, B.base + shift, B.tip + shift, B.R, acc, 1.5 + k * 0.01, { fins: 0.075 });
    }
  });
  add('werfer', T.prism([ax.xz(B.base - 0.03, -0.07), ax.xz(B.base - 0.0, -0.07), ax.xz(B.base - 0.0, 0.2), ax.xz(B.base - 0.03, 0.2)], -0.21, 0.21, STEEL_DD, { layer: 1.22, lw: 1.4 }));
  // The scope on the left cheek, as today: the red line comes from its lens.
  scope(T, add, axisOf(B.elevation, [B.pivot[0], 0, B.pivot[2]]), sightB(), acc, p.seek, 1.7, 0.3);
}

const sightB = () => {
  const ax = axisOf(B.elevation, B.pivot);
  const q = ax.at(0.1, -0.25, 0.02);
  return q;
};

// ======================================================================================
// Draft C: Ladearme
// ======================================================================================

const C = {
  /** Elevation of an arm when its rocket is ready, and when it lies on its rack. */
  up: (48 * Math.PI) / 180,
  down: (-2 * Math.PI) / 180,
  hinge: [-0.05, 0, 24],
  armY: [-0.23, 0.23],
  armLen: 0.5,
  R: 0.098,
  /** The rocket on its arm, cells along the arm, and its axis over the arm. */
  base: -0.14,
  tip: 0.58,
  over: 0.105,
  kick: 0.03,
};

/** Elevation of arm `k` at load `u`: down onto the rack over the first half, up again over the second. */
function armElevation(u) {
  if (u >= 1) return C.up;
  const d = u < 0.45 ? smooth(clamp01(u / 0.3)) : 1 - smooth(clamp01((u - 0.55) / 0.45));
  return C.up + (C.down - C.up) * d;
}

/** Whether arm `k` carries its rocket at load `u`: it takes it on the rack, half way. */
const armLoaded = (u) => u >= 0.5;

function buildC(T, add, p) {
  const acc = p.accent;
  turntable(T, add, 0.25, acc);
  // A pylon with a head, the axle of both arms through it, and a rack at each side in front, low.
  add('gehaeuse', T.frustum(-0.04, 0, 0.17, 0.13, 0.11, 0.09, 6.5, C.hinge[2] - 2, STEEL_D, { layer: 0.9, lw: 1.8 }));
  add('gehaeuse', T.box(-0.16, 0.06, -0.11, 0.11, C.hinge[2] - 3, C.hinge[2] + 4, STEEL, { layer: 1, lw: 1.6 }));
  add('gehaeuse', T.box(-0.162, -0.158, -0.11, 0.11, C.hinge[2] - 3, C.hinge[2], GOLD, { layer: 1.02, lw: 1 }));
  add('gehaeuse', T.tube([C.hinge[0], -0.3, C.hinge[2]], [C.hinge[0], 0.3, C.hinge[2]], 0.04, 0.04, STEEL_DD, { n: 8, layer: 1.2, lw: 1.5 }));
  for (const ly of C.armY) {
    const y0 = ly - 0.07;
    const y1 = ly + 0.07;
    // An open cradle: two low copper blocks the waiting rocket lies on.
    add('gehaeuse', T.box(0.02, 0.46, ly - 0.03, ly + 0.03, 6.5, 8, STEEL_DD, { layer: 0.93, lw: 1.3 }));
    for (const x0 of [0.1, 0.34]) add('gehaeuse', T.box(x0, x0 + 0.07, y0, y1, 6.5, 10, COPPER, { layer: 0.95, lw: 1.3 }));
  }

  // The arms: a beam with a cradle, a counterweight behind the hinge, a lamp. Each arm is its own part of
  // the launcher, turned about the hinge by its own elevation.
  C.armY.forEach((ly, k) => {
    const u = p.load[k] ?? 1;
    const ax = axisOf(armElevation(u), C.hinge);
    const kick = -C.kick * (p.kick[k] ?? 0);
    const side = Math.sign(ly);
    add('werfer', T.prism([ax.xz(-0.04, -0.035), ax.xz(C.armLen, -0.035), ax.xz(C.armLen, 0.03), ax.xz(-0.04, 0.03)], ly - 0.035, ly + 0.035, STEEL_M, { layer: 1.3 + k * 0.01, lw: 1.5 }));
    add('werfer', T.prism([ax.xz(-0.2, -0.07), ax.xz(-0.04, -0.07), ax.xz(-0.04, 0.05), ax.xz(-0.2, 0.05)], ly - 0.05, ly + 0.05, STEEL_DD, { layer: 1.28 + k * 0.01, lw: 1.5 }));
    add('werfer', T.prism([ax.xz(-0.205, -0.07), ax.xz(-0.195, -0.07), ax.xz(-0.195, 0.05), ax.xz(-0.205, 0.05)], ly - 0.052, ly + 0.052, acc, { layer: 1.29 + k * 0.01, lw: 1 }));
    for (const t of [0.04, C.armLen - 0.08]) {
      add('werfer', T.prism([ax.xz(t, 0.03), ax.xz(t + 0.04, 0.03), ax.xz(t + 0.04, C.over), ax.xz(t, C.over)], ly - 0.06, ly + 0.06, STEEL, { layer: 1.32 + k * 0.01, lw: 1.1 }));
    }
    lamp(T, add, 'werfer', ax.at(-0.1, ly + side * 0.055, 0.0), u >= 1, acc, 1.34);
    const rx = { ...ax, at: (t, y, h = 0) => ax.at(t + kick, y, h + C.over), xz: (t, h = 0) => ax.xz(t + kick, h + C.over) };
    if (armLoaded(u)) rocket(T, add, `rakete${k}`, rx, ly, C.base, C.tip, C.R, acc, 1.5 + k * 0.01, { fins: 0.07 });
    // The next rocket waits on the rack until the arm takes it.
    else rocket(T, add, `rakete${k}`, axisOf(0, [0.04, 0, 10 + C.R * K]), ly, 0, 0.66, C.R, acc, 1.0, { fins: 0.03 });
  });
  // The scope sits on the head of the pylon, between the arms.
  scope(T, add, axisOf(0.35, C.hinge), sightC(), acc, p.seek, 1.7, 0.28);
}

const sightC = () => axisOf(0.35, C.hinge).at(0.1, 0, 0.17);

// ======================================================================================
// Shared parts and the table of drafts
// ======================================================================================

/** A scope housing on a short post, pointing along `ax`, with the lens at `lens` that glows while it aims. */
function scope(T, add, ax, lens, acc, seek, layer, len) {
  const back = [lens[0] - len * ax.c, lens[1], lens[2] - len * ax.s * K];
  const mid = [(lens[0] + back[0]) / 2, lens[1], (lens[2] + back[2]) / 2];
  add('werfer', T.tube([mid[0], mid[1], mid[2] - 5], mid, 0.016, 0.016, STEEL_DD, { n: 5, layer: layer - 0.02, capA: false, capB: false, lw: 1 }));
  add('werfer', T.tube(back, lens, 0.036, 0.042, STEEL_DD, { n: 8, layer, lw: 1.3, capB: [{ k: 0.74, c: '#3a1010' }, { k: 0.42, c: seek > 0 ? LENS : LENS_OFF }] }));
  add('werfer', T.tube([lens[0] - 0.06 * ax.c, lens[1], lens[2] - 0.06 * ax.s * K], [lens[0] - 0.035 * ax.c, lens[1], lens[2] - 0.035 * ax.s * K], 0.048, 0.048, acc, { n: 8, layer: layer + 0.02, sides: true, lw: 1 }));
}

/** Muzzle of each draft: where rocket `k` leaves (its nose, ready), local, and the direction (true units). */
function muzzleA(k) {
  const ax = axisOf(A.elevation, A.pivot);
  return { at: ax.at(A.front - 0.06 + A.noseLen + 0.06, A.tubeY[k]), dir: ax.dir };
}
function muzzleB(k) {
  const ax = axisOf(B.elevation, B.pivot);
  return { at: ax.at(B.tip, B.railY[k], B.over), dir: ax.dir };
}
function muzzleC(k) {
  const ax = axisOf(C.up, C.hinge);
  return { at: ax.at(C.tip, C.armY[k], C.over), dir: ax.dir };
}

/** The nozzle of rocket `k`, ready: where the back blast comes out. */
function nozzleA(k) {
  return axisOf(A.elevation, A.pivot).at(A.back, A.tubeY[k]);
}
function nozzleB(k) {
  return axisOf(B.elevation, B.pivot).at(B.base, B.railY[k], B.over);
}
function nozzleC(k) {
  return axisOf(C.up, C.hinge).at(C.base, C.armY[k], C.over);
}

/** Where a new rocket comes from while it is loaded (the crate or the rack), local. */
const loaderA = (k) => [-0.3, A.tubeY[k] * 0.6, 15.5];
const loaderB = (k) => [-0.31, B.railY[k], 14];
const loaderC = (k) => [0.27, C.armY[k], 10];

/**
 * The three drafts. `build(F, pose, part)` returns the bodies for renderSolids and the local sample points;
 * `part` is 'all' or one of PARTS. `anchors(pose)` names the points the game would need: the turning point,
 * the pivot of the launcher, the muzzle and nozzle of each rocket, the lens of the scope, the loader.
 */
export const DRAFTS = [
  {
    id: 'A',
    name: 'Doppelrohr',
    note: 'Zwei geschlossene Startrohre auf der Keillafette von heute, die Sprengköpfe stehen aus den Mündungen. Nachladen: der Kopf fährt aus dem leeren Rohr, die Lampe am Verschluss wird von Rot zur Leitfarbe.',
    build: buildA,
    muzzle: muzzleA,
    nozzle: nozzleA,
    sight: (p) => sightA(p),
    pivot: A.pivot,
    loader: loaderA,
  },
  {
    id: 'B',
    name: 'Startschienen',
    note: 'Zwei ganze Raketen mit Flossen liegen offen auf zwei Schienen über einem Panzerschild, hinten ein Strahlabweiser. Nachladen: die neue Rakete steigt aus der Kiste die leere Schiene hinauf.',
    build: buildB,
    muzzle: muzzleB,
    nozzle: nozzleB,
    sight: () => sightB(),
    pivot: B.pivot,
    loader: loaderB,
  },
  {
    id: 'C',
    name: 'Ladearme',
    note: 'Zwei getrennte Arme auf einem Pfeiler, weit auseinander, je eine Rakete obenauf. Nachladen: der leere Arm nickt auf das Gestell an seiner Seite, nimmt die nächste Rakete und hebt sie wieder.',
    build: buildC,
    muzzle: muzzleC,
    nozzle: nozzleC,
    sight: () => sightC(),
    pivot: C.hinge,
    loader: loaderC,
  },
];

export const draftById = Object.fromEntries(DRAFTS.map((d) => [d.id, d]));

/**
 * Builds draft `id` in frame F (from turnFrame) with pose `p` (see rtRestPose). `part` is 'all' or one of
 * PARTS. Returns { parts, samples } like buildSpecial.
 */
export function buildDraft(id, F, p, part = 'all') {
  const S = [];
  const T = solidKit(F, S);
  const parts = [];
  const add = (group, solid) => {
    if (part === 'all' || part === group) parts.push(solid);
  };
  draftById[id].build(T, add, p);
  return { parts, samples: S };
}

/** The named anchor points of draft `id` in pose `p`, local [lx, ly, z]. */
export function anchors(id, p) {
  const d = draftById[id];
  return {
    drehpunkt: [0, 0, 0],
    kipppunkt: d.pivot,
    muendung0: d.muzzle(0).at,
    muendung1: d.muzzle(1).at,
    duese0: d.nozzle(0),
    duese1: d.nozzle(1),
    visier: d.sight(p),
    lader0: d.loader(0),
    lader1: d.loader(1),
  };
}

/** Load of the empty rocket at reload progress `prog` (0 just after the shot, 1 at the next one). */
export const loadAt = (prog) => clamp01((prog - LOAD.from) / (LOAD.to - LOAD.from));
