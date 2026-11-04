// The weapons on the bunker roofs as turnable models (M9 D2, docs/ART.md, "Aufsätze" and
// "Drehbare Modelle"): built from bodies in local coordinates, so they read from any angle and
// can face their target. One model per doctrine; the mortar doctrine is drawn as the rocket
// launcher (decision E-18, 1).
//
// Local axes as in model.js: lx forward and ly sideways in cells, z up in pixels above the roof
// plate. Round bodies use SOLID_K pixels of z per cell so a barrel is not an egg in the iso view.
// The shapes and measures are those of reference/studien/stellungen-rework-modell.js, which is
// binding. Nothing here knows the simulation or the cache; `turretCache.js` pre-draws the models
// in 16 directions and `towerSprites.js` decides which to show.

import { turnFrame, solidKit, SOLID_K as K, SOLID_INK } from './model.js';
import {
  BUNKER_ROOF_HEIGHT,
  TURRET_SCALE,
  TURRET_MUZZLE,
  TURRET_ROCKET,
  TURRET_CASING_PORT,
} from '../data/art.js';

/** Height of the roof plate the weapons stand on, in world px. */
export const MOUNT_Z = BUNKER_ROOF_HEIGHT;
export { TURRET_SCALE, TURRET_CASING_PORT as CASING_PORT };

// Steel tones of the capsule (reference/studien/kapsel-studie.js, draft B), concrete and brass.
const STEEL = '#a6adb8';
const STEEL_M = '#8d94a0';
const STEEL_D = '#717884';
const STEEL_DD = '#4a505b';
const DARK = '#2a2d33';
const COPPER = '#b2723d';
const GOLD = '#e0b83e';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/**
 * Pose of a weapon at one moment: everything the model needs besides the angle. The resting pose is
 * what the cached stages are drawn in; recoil and the like are layers over a stage.
 * @param {string} accent  guide colour of the doctrine
 * @param {number} rank  1 to 5, shown as a band in the doctrine colour from rank 3 and in gold at 5
 */
export function restPose(accent, rank = 3) {
  return { accent, rank, recoil: 0, spin: 0, bob: 0, gyro: 0.6, tube: 0, bores: false, layer: 'all' };
}

// ---------- the rocket launcher ----------

function rocketFrame() {
  const c = Math.cos(TURRET_ROCKET.elevation);
  const s = Math.sin(TURRET_ROCKET.elevation);
  const centre = [0, 0, 20 / K];
  return { c, s, centre, a: [c, 0, s], p: [-s, 0, c] };
}

/** Local centre of the mouth of rocket tube `k` (z in px). */
export function rocketMouth(k) {
  const { a, p, centre } = rocketFrame();
  const [col, row] = TURRET_ROCKET.mouths[k % TURRET_ROCKET.mouths.length];
  const m = add(add(centre, mul(a, TURRET_ROCKET.length / 2 + 0.02)), mul(p, row * TURRET_ROCKET.row));
  return [m[0], col * TURRET_ROCKET.pitch, m[2] * K];
}

/**
 * Where the shot leaves the weapon, in local coordinates, and the direction it leaves in (local, true
 * units). Independent of the angle, so effects can be placed without building the model.
 */
export const MUZZLE = {
  autocannon: (p) => ({ at: [TURRET_MUZZLE.autocannon.x - 0.05 * p.recoil, 0, TURRET_MUZZLE.autocannon.z], dir: [1, 0, 0] }),
  flame: () => ({ at: [TURRET_MUZZLE.flame.x, 0, TURRET_MUZZLE.flame.z], dir: [1, 0, 0] }),
  mortar: (p) => ({ at: rocketMouth(p.tube), dir: rocketFrame().a }),
  tesla: () => ({ at: [TURRET_MUZZLE.tesla.x, 0, TURRET_MUZZLE.tesla.z], dir: [1, 0, 0] }),
  laser: () => ({ at: [TURRET_MUZZLE.laser.x, 0, TURRET_MUZZLE.laser.z], dir: [1, 0, 0] }),
  psi: (p) => ({ at: [TURRET_MUZZLE.psi.x, 0, TURRET_MUZZLE.psi.z + p.bob], dir: [1, 0, 0] }),
};

/** The doctrines a model exists for. */
export const TURRET_DOCTRINES = Object.keys(MUZZLE);

/**
 * The muzzle on screen, in world px relative to the ground point of the emplacement, for a weapon
 * facing `theta`, and the screen direction it fires in.
 */
export function muzzleOffset(doctrine, theta, pose) {
  const m = MUZZLE[doctrine](pose);
  const F = turnFrame(theta, MOUNT_Z, TURRET_SCALE);
  return F.W(m.at[0], m.at[1], m.at[2]);
}

/**
 * Builds a weapon: its parts, local points for the shadow and the bounds, and the muzzle.
 * Every part is drawn with `renderSolids(ctx, parts)`.
 * @param {string} doctrine  one of TURRET_DOCTRINES
 * @param {object} F  a frame from `turnFrame`
 * @param {object} p  a pose, see `restPose`. `layer` 'base' or 'float' keeps only the pedestal or
 *   only the hovering rings of the psi weapon (the rings bob over a still stage); every other
 *   weapon ignores it.
 */
export function buildTurret(doctrine, F, p) {
  const S = [];
  const T = solidKit(F, S);
  const parts = [];
  const acc = p.accent;
  const X = [1, 0, 0];
  const Y = [0, 1, 0];
  const Z = [0, 0, 1];
  // The barrel ends are taken from the muzzle, so the fire cannot come from anywhere else.
  const mz = MUZZLE[doctrine](p).at;
  const turret = (r = 0.17) => {
    parts.push(T.column(0, 0, r, r - 0.01, 0, 4, STEEL_DD, { n: 8, lw: 1.6 }));
    // The rank on the weapon: a band in the doctrine colour from rank 3, gold at rank 5.
    if (p.rank >= 3) parts.push(T.column(0, 0, r + 0.012, r + 0.012, 1.2, 2.8, p.rank >= 5 ? GOLD : acc, { n: 8, lw: 1.1, top: false }));
  };

  if (doctrine === 'autocannon') {
    // Low and wide: an armoured cowl with an ammunition drum on each side and a shield plate in front.
    const rc = 0.05 * p.recoil;
    const zc = 11;
    // The bores are an overlay (they turn while it fires), so the barrels carry none of their own.
    const bore = p.bores ? [{ k: 0.42, c: '#14100c' }] : [];
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
      parts.push(T.tube([0.15 - rc, ly, z], [mz[0] - 0.01, ly, z], 0.031, 0.029, STEEL_M, { n: 6, lw: 1.2, capB: bore }));
    }
    parts.push(T.ring([0.28 - rc, 0, zc], Y, Z, 0.118, 0.098, 0.02, STEEL));
    parts.push(T.ring([0.4 - rc, 0, zc], Y, Z, 0.112, 0.096, 0.014, STEEL));
    parts.push(T.ring([0.34 - rc, 0, zc], Y, Z, 0.108, 0.098, 0.008, acc, { lw: 1.2 }));
  } else if (doctrine === 'flame') {
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
  } else if (doctrine === 'mortar') {
    // The rocket launcher: a pod of six tubes on a trunnion frame, elevated at a fixed angle.
    const { c, s, centre, a, p: pp } = rocketFrame();
    turret(0.19);
    // Trunnion frame: two legs and the pod resting in them.
    for (const y of [-0.255, 0.205]) parts.push(T.prism([[-0.12, 4], [0.1, 4], [0.05, 22], [-0.06, 22]], y, y + 0.05, STEEL, { layer: 1 }));
    // Pod casing: a rotated rectangle in (lx, z), extruded over three tubes.
    const hl = TURRET_ROCKET.length / 2;
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
      const front = [m[0] - 0.045 * c, m[1], m[2] - 0.045 * s * K];
      const tip = [{ k: 0.72, c: '#14100c' }];
      parts.push(T.tube(front, [m[0] + 0.01 * c, m[1], m[2] + 0.01 * s * K], 0.056, 0.056, STEEL, { n: 8, layer: 1.5, lw: 1.3, capA: false, capB: tip }));
      // Every tube shows the nose of its rocket.
      parts.push(T.tube([m[0] - 0.01 * c, m[1], m[2] - 0.01 * s * K], [m[0] + 0.12 * c, m[1], m[2] + 0.12 * s * K], 0.04, 0.005, acc, { n: 6, layer: 1.55, lw: 1.1, capA: false, capB: false }));
    }
    parts.push(T.box(-0.02 - 0.18, -0.02 - 0.1, -0.1, 0.1, 6, 18, STEEL_DD, { layer: 1.0 }));
  } else if (doctrine === 'tesla') {
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
  } else if (doctrine === 'laser') {
    // Tall and narrow: a slim pillar carries the emitter head, so it stands out from the low, wide
    // autocannon from the front and from behind.
    turret(0.14);
    parts.push(T.column(0, 0, 0.1, 0.075, 4, 22, STEEL, { n: 6 }));
    parts.push(T.column(0, 0, 0.115, 0.115, 12, 14.5, acc, { n: 6, top: false, lw: 1.1 }));
    parts.push(T.tube([-0.1, 0, 22.5], [0.15, 0, 22.5], 0.105, 0.105, STEEL_D, { n: 10, capA: [{ k: 0.6, c: STEEL_DD }], capB: [{ k: 0.76, c: '#4a1414' }, { k: 0.58, c: acc }, { k: 0.28, c: '#fff1e4' }] }));
    for (const y of [-0.045, 0.045]) parts.push(T.box(-0.08, 0.05, y - 0.012, y + 0.012, 26, 31, STEEL, { lw: 1.3 }));
    parts.push(T.tube([0.15, 0, 22.5], [0.43, 0, 22.5], 0.04, 0.032, STEEL_M, { n: 6, capA: false, capB: false }));
    for (const x of [0.23, 0.31]) parts.push(T.ring([x, 0, 22.5], Y, Z, 0.075, 0.036, 0.012, STEEL, { n: 8, lw: 1.2 }));
    parts.push(T.tube([0.385, 0, 22.5], [0.415, 0, 22.5], 0.055, 0.055, acc, { n: 8, sides: true, lw: 1.2 }));
    parts.push(T.tube([0.43, 0, 22.5], [mz[0], 0, 22.5], 0.04, 0.046, STEEL, { n: 8, capA: false, capB: [{ k: 0.6, c: '#4a1414' }, { k: 0.3, c: acc }] }));
  } else if (doctrine === 'psi') {
    const z0 = 28 + p.bob;
    // The rings float above a pedestal with three slender prongs.
    if (p.layer !== 'float') {
      parts.push(T.column(0, 0, 0.15, 0.13, 0, 5, STEEL_DD, { n: 8, layer: 0, lw: 1.8 }));
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        parts.push(T.tube([Math.cos(a) * 0.115, Math.sin(a) * 0.115, 5], [Math.cos(a) * 0.07, Math.sin(a) * 0.07, 15], 0.04, 0.026, STEEL, { n: 5, layer: 0.5, capA: false, lw: 1.3 }));
        parts.push(T.gem([Math.cos(a) * 0.07, Math.sin(a) * 0.07, 15], 0.034, 3.5, 1, acc, { n: 4, layer: 0.55, lw: 1.1 }));
      }
    }
    if (p.layer !== 'base') {
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
  } else {
    throw new Error(`No turret model for doctrine: ${doctrine}`);
  }

  // The weapons are drawn smaller than they are authored, the ink is not: thin it with them.
  for (const part of parts) part.lw = Math.max(0.8, part.lw * SOLID_INK);
  return { parts, samples: S, muzzle: MUZZLE[doctrine](p) };
}

/**
 * Screen points of the six bores at the muzzle end of the autocannon, relative to the ground point,
 * for a barrel cluster that has turned `spin` radians, shifted back by `recoil`. They are drawn over
 * the cached stage: the barrels of the stage carry no bores of their own.
 * @returns {{points: number[][], facing: boolean}} `facing` is false while the muzzle looks away.
 */
export function autocannonBores(theta, spin, recoil = 0) {
  const F = turnFrame(theta, MOUNT_Z, TURRET_SCALE);
  const mz = MUZZLE.autocannon({ recoil });
  const x = mz.at[0] - 0.01;
  const zc = TURRET_MUZZLE.autocannon.z;
  const points = [];
  for (let k = 0; k < 6; k++) {
    const ang = spin + (k * Math.PI) / 3;
    points.push(F.W(x, 0.066 * Math.cos(ang), zc + 0.066 * K * Math.sin(ang)));
  }
  const n = F.wn(1, 0, 0);
  return { points, facing: n[0] + n[1] > 0.004 };
}
