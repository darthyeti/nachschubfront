// The weapons of the six recipe emplacements as turnable models (M9 D4, docs/ART.md, "Spezialstellungen"
// and "Drehbare Modelle"). They are built from bodies in local coordinates like the standard weapons
// (turrets.js), keyed by the id of the recipe, and they stand on the special base (a sprite).
//
// Local axes as in model.js: lx forward and ly sideways in cells, z up in pixels above the roof plate.
// The shapes and measures are those of reference/studien/spezialstellungen-rework-modell.js, which is
// binding; the numbers that are not shapes (muzzles, scale) are in src/data/art.js. Nothing here knows
// the simulation or the cache: `turretCache.js` pre-draws what rests, `towerSprites.js` decides which to show.
//
// Floating parts (the ring and ball of the thunder tower, the eye of the obelisk) are a layer of their own
// ('float') so a resting weapon can come from a cached stage while they stay alive on top of it. The
// artefact of the shrine hovers between its pillars: the shrine is always built live.

import { solidKit, SOLID_K as K, SOLID_INK } from './model.js';
import {
  SPECIAL_ROOF_HEIGHT,
  SPECIAL_SCALE,
  SPECIAL_MUZZLE,
  SPECIAL_FLOATS,
  SPECIAL_LIVE_ALWAYS,
  TURRET_SCALE,
} from '../data/art.js';

/** Height of the roof plate of the special base, in world px. */
export const SPECIAL_MOUNT_Z = SPECIAL_ROOF_HEIGHT;

/** Scale of a special weapon: the standard weapon scale times its own factor. */
export const specialScale = (id) => TURRET_SCALE * SPECIAL_SCALE[id];

// Steel tones of the capsule, concrete, brass and gold, as in turrets.js.
const STEEL = '#a6adb8';
const STEEL_M = '#8d94a0';
const STEEL_D = '#717884';
const STEEL_DD = '#4a505b';
const DARK = '#2a2d33';
const COPPER = '#b2723d';
const BRASS = '#e8c872';
const GOLD = '#e0b83e';

/** Pose of a weapon at one moment: everything the model needs besides the angle. */
export function specialRestPose(accent) {
  return { accent, bob: 0, gyro: 0.6, recoil: 0, bar: [0, 0, 0, 0], tube: 0, glow: 0, layer: 'all' };
}

const STORM = SPECIAL_MUZZLE.stormBattery;
const SIEGE = SPECIAL_MUZZLE.siegeMortar;
const THUNDER_Z = SPECIAL_MUZZLE.thunderTower.z;
const EYE_Z = SPECIAL_MUZZLE.soulfireObelisk.z;
const OBELISK_TOP = 62;

/** The tube of the siege mortar: its two ends, with the push back by recoil (cells along the tube). */
function siegeAxis(p) {
  const c = Math.cos(SIEGE.elevation);
  const s = Math.sin(SIEGE.elevation);
  const shift = -SIEGE.recoil * p.recoil;
  const a = [-SIEGE.back * c + shift * c, 0, SIEGE.pivot[2] - SIEGE.back * s * K + shift * s * K];
  const b = [a[0] + SIEGE.length * c, 0, a[2] + SIEGE.length * s * K];
  return { a, b, c, s, dir: [c, 0, s] };
}

/** The scope lens of the siege mortar: where the red line starts, local. */
export function siegeSight() {
  const c = Math.cos(SIEGE.elevation);
  const s = Math.sin(SIEGE.elevation);
  return [0.36 * c - 0.12 * s, -0.1, SIEGE.pivot[2] + (0.36 * s + 0.12 * c) * K];
}

/**
 * Where the shot leaves each weapon, local, and the direction it leaves in (local, true units).
 * Independent of the angle, so effects can be placed without building the model.
 */
export const SPECIAL_MUZZLES = {
  purgeShrine: (p) => ({ at: [0, 0, SPECIAL_MUZZLE.purgeShrine.z + p.bob], dir: [1, 0, 0] }),
  stormBattery: (p) => {
    const k = p.tube % STORM.barrels.length;
    const [ly, dz] = STORM.barrels[k];
    return { at: [STORM.x - STORM.recoil * p.bar[k], ly, STORM.axisZ + dz], dir: [1, 0, 0] };
  },
  emberCauldron: () => ({ at: [SPECIAL_MUZZLE.emberCauldron.x, 0, SPECIAL_MUZZLE.emberCauldron.z], dir: [1, 0, 0] }),
  siegeMortar: (p) => ({ at: siegeAxis(p).b, dir: siegeAxis(p).dir }),
  thunderTower: (p) => ({ at: [0, 0, THUNDER_Z + p.bob], dir: [1, 0, 0] }),
  soulfireObelisk: (p) => ({ at: [SPECIAL_MUZZLE.soulfireObelisk.x, 0, EYE_Z + p.bob], dir: [1, 0, 0] }),
};

/** The special weapons a model exists for. */
export const SPECIAL_IDS = Object.keys(SPECIAL_MUZZLES);

/** True when the weapon has a part that floats and is a layer of its own over the cached stage. */
export const hasFloat = (id) => SPECIAL_FLOATS.includes(id);
/** True when the weapon is never taken from a stage (the artefact of the shrine hovers between the pillars). */
export const isLiveAlways = (id) => SPECIAL_LIVE_ALWAYS.includes(id);

/**
 * Builds a weapon: its parts, local points for the shadow and the bounds, and the muzzle.
 * Every part is drawn with `renderSolids(ctx, parts)`.
 * @param {string} id  one of SPECIAL_IDS
 * @param {object} F  a frame from `turnFrame`
 * @param {object} p  a pose, see `specialRestPose`
 * @param {'all'|'base'|'float'} part  a resting weapon is a cached 'base' with the live 'float' on top
 */
export function buildSpecial(id, F, p, part = 'all') {
  const S = [];
  const T = solidKit(F, S);
  const parts = [];
  const acc = p.accent;
  const X = [1, 0, 0];
  const Y = [0, 1, 0];
  const base = part !== 'float';
  const top = part !== 'base';
  const muzzle = SPECIAL_MUZZLES[id]?.(p);
  if (!muzzle) throw new Error(`No special weapon model for: ${id}`);

  /** The turntable under every weapon: a steel ring with a gold band and a band in the guide colour. */
  const turret = (r) => {
    parts.push(T.column(0, 0, r, r - 0.01, 0, 4, STEEL_DD, { n: 8, lw: 1.6 }));
    parts.push(T.column(0, 0, r + 0.012, r + 0.012, 0.9, 1.9, GOLD, { n: 8, lw: 1.1, top: false }));
    parts.push(T.column(0, 0, r + 0.012, r + 0.012, 2.3, 3.2, acc, { n: 8, lw: 1.1, top: false }));
  };

  if (id === 'purgeShrine') {
    // Four pillars carry a canopy; a golden artefact hovers between them. Four pillars and not two, so
    // the shrine looks the same from every side it can turn to.
    const zc = SPECIAL_MUZZLE.purgeShrine.z + p.bob;
    turret(0.21);
    parts.push(T.column(0, 0, 0.2, 0.18, 4, 8, STEEL_D, { n: 8, layer: 0.2, lw: 1.8 }));
    parts.push(T.box(-0.17, 0.17, -0.17, 0.17, 8, 9.4, STEEL, { layer: 0.3, lw: 1.4 }));
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const x = sx * 0.15;
        const y = sy * 0.15;
        parts.push(T.column(x, y, 0.058, 0.058, 9.4, 11, STEEL_D, { n: 6, layer: 0.5, lw: 1.4 }));
        parts.push(T.column(x, y, 0.04, 0.036, 11, 24.4, STEEL_M, { n: 6, layer: 0.6, lw: 1.5 }));
        parts.push(T.column(x, y, 0.045, 0.045, 14.6, 16, acc, { n: 6, layer: 0.65, lw: 1.1, top: false }));
        parts.push(T.column(x, y, 0.052, 0.052, 22.8, 24.6, GOLD, { n: 6, layer: 0.7, lw: 1.2 }));
      }
    }
    parts.push(T.frustum(0, 0, 0.215, 0.215, 0.215, 0.215, 24.6, 26, GOLD, { layer: 0.8, lw: 1.4 }));
    parts.push(T.frustum(0, 0, 0.2, 0.2, 0.06, 0.06, 26, 31, STEEL, { layer: 0.85, lw: 1.6 }));
    parts.push(T.gem([0, 0, 31], 0.045, 5, 0, GOLD, { n: 4, layer: 0.9, lw: 1.3 }));
    // The artefact: a faceted reliquary with a bright core, a halo ring and three orbiting sparks.
    parts.push(T.gem([0, 0, zc], 0.1, 8, 6, BRASS, { n: 6, layer: 1.4, lw: 1.5, rot: p.gyro * 0.5 }));
    parts.push(T.gem([0, 0, zc], 0.03, 10.5, 9, '#fff3c0', { n: 4, layer: 1.45, lw: 1.1 }));
    parts.push(T.ring([0, 0, zc], X, Y, 0.135, 0.112, 0.012, GOLD, { n: 12, layer: 1.5, lw: 1.2 }));
    for (let i = 0; i < 3; i++) {
      const a = p.gyro * 1.3 + (i * Math.PI * 2) / 3;
      parts.push(T.gem([Math.cos(a) * 0.135, Math.sin(a) * 0.135, zc + Math.sin(a * 2) * 1.5], 0.02, 2.4, 2.4, '#ffd23f', { n: 4, layer: 1.55, lw: 1 }));
    }
  } else if (id === 'stormBattery') {
    // Low and wide, vaulted: a hipped housing, two square hatches, a clamp plate and 2 x 2 barrels.
    turret(0.22);
    parts.push(T.frustum(0, 0, 0.215, 0.215, 0.205, 0.205, 4, 13, STEEL, { layer: 0.5 }));
    parts.push(T.frustum(0, 0, 0.205, 0.205, 0.17, 0.095, 13, 19.5, STEEL_M, { layer: 0.55 }));
    parts.push(T.box(0.2, 0.245, -0.2, 0.2, 5.5, 17.5, STEEL_DD, { layer: 0.7 }));
    for (const x of [-0.12, 0.03]) {
      parts.push(T.box(x - 0.012, x + 0.092, -0.074, 0.074, 19.2, 20, GOLD, { layer: 0.8, lw: 1.1 }));
      parts.push(T.box(x, x + 0.08, -0.062, 0.062, 20, 20.9, DARK, { layer: 0.85, lw: 1.2 }));
    }
    for (const side of [-1, 1]) {
      // A belt feed box on each flank, with a blue stripe.
      parts.push(T.box(-0.17, 0.05, side > 0 ? 0.21 : -0.29, side > 0 ? 0.29 : -0.21, 6, 15.5, STEEL_D, { layer: 0.6 }));
      parts.push(T.box(-0.1, -0.02, side > 0 ? 0.289 : -0.299, side > 0 ? 0.299 : -0.289, 8.6, 13, '#7fd8ff', { layer: 0.65, lw: 1 }));
    }
    parts.push(T.box(0.28, 0.315, -0.15, 0.15, STORM.axisZ - 6.4, STORM.axisZ + 6.4, STEEL, { layer: 0.9, lw: 1.5 }));
    STORM.barrels.forEach(([ly, dz], k) => {
      const z = STORM.axisZ + dz;
      const rc = STORM.recoil * p.bar[k];
      parts.push(T.tube([0.22 - rc, ly, z], [STORM.x - rc, ly, z], 0.036, 0.032, STEEL_M, { n: 6, layer: 1 + k * 0.01, lw: 1.2, capA: false, capB: [{ k: 0.45, c: '#14100c' }] }));
      parts.push(T.tube([0.46 - rc, ly, z], [0.49 - rc, ly, z], 0.044, 0.044, '#7fd8ff', { n: 6, layer: 1.2 + k * 0.01, sides: true, lw: 1 }));
    });
    parts.push(T.tube([0.2, 0, STORM.axisZ], [0.26, 0, STORM.axisZ], 0.025, 0.025, DARK, { n: 5, layer: 1.1, capA: false, capB: false }));
  } else if (id === 'emberCauldron') {
    // A black cauldron on three legs with a pouring lip in front and four electrodes on the rim.
    turret(0.24);
    for (const a of [Math.PI, Math.PI / 3, -Math.PI / 3]) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      parts.push(T.tube([c * 0.13, s * 0.13, 11], [c * 0.25, s * 0.25, 4.2], 0.042, 0.05, STEEL_DD, { n: 5, layer: 0.5, capA: false, lw: 1.5 }));
      parts.push(T.column(c * 0.25, s * 0.25, 0.07, 0.07, 3.5, 5.4, STEEL_D, { n: 6, layer: 0.52, lw: 1.3 }));
    }
    parts.push(T.column(0, 0, 0.13, 0.215, 6.5, 14, '#34302c', { n: 10, layer: 1, lw: 2, stripe: true }));
    parts.push(T.column(0, 0, 0.222, 0.222, 12.4, 13.9, acc, { n: 10, layer: 1.05, lw: 1.1, top: false }));
    parts.push(T.column(0, 0, 0.215, 0.188, 14, 21, '#34302c', { n: 10, layer: 1.1, lw: 2, top: false, stripe: true }));
    parts.push(T.column(0, 0, 0.19, 0.19, 17, 17.4, '#14100c', { n: 10, layer: 1.1, lw: 1 }));
    parts.push(T.ring([0, 0, 21], X, Y, 0.222, 0.175, 0.022, GOLD, { n: 10, layer: 1.3, lw: 1.6 }));
    parts.push(T.prism([[0.17, 19.5], [0.33, 16.5], [0.33, 18.6], [0.2, 22.4]], -0.055, 0.055, STEEL_D, { layer: 1.2, lw: 1.5 }));
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      parts.push(T.tube([c * 0.2, s * 0.2, 21], [c * 0.225, s * 0.225, 29.6], 0.022, 0.016, STEEL, { n: 5, layer: 1.4, capA: false, lw: 1.3 }));
      parts.push(T.gem([c * 0.225, s * 0.225, 30], 0.036, 3.6, 1, i === 0 ? '#ffb02e' : '#5fd4ff', { n: 4, layer: 1.5, lw: 1.1 }));
    }
  } else if (id === 'siegeMortar') {
    const { a, b, c, s } = siegeAxis(p);
    const [px, , pz] = SIEGE.pivot;
    turret(0.24);
    parts.push(T.column(0, 0, 0.22, 0.2, 4, 6.5, STEEL_D, { n: 8, layer: 0.5, lw: 1.8 }));
    // A wedge carriage: two cheeks, a cross brace and the shell crate behind.
    for (const y0 of [-0.185, 0.135]) {
      parts.push(T.prism([[-0.22, 6.5], [0.2, 6.5], [0.2, 13], [0.04, 25], [-0.14, 25], [-0.22, 15]], y0, y0 + 0.05, STEEL, { layer: 1 }));
    }
    parts.push(T.box(-0.2, 0.18, -0.14, 0.14, 6.5, 13, STEEL_D, { layer: 0.9 }));
    parts.push(T.box(-0.32, -0.2, -0.12, 0.12, 6.5, 14, COPPER, { layer: 0.9, lw: 1.5 }));
    parts.push(T.box(-0.322, -0.318, -0.12, 0.12, 6.5, 8, GOLD, { layer: 0.95, lw: 1 }));
    parts.push(T.tube([px, -0.215, pz], [px, 0.215, pz], 0.055, 0.055, STEEL_DD, { n: 8, layer: 1.2, lw: 1.5 }));
    // Buffer sleeve (does not recoil), the long tube (does), recoil rods, gold collar, muzzle brake.
    const sleeveA = [-SIEGE.back * c, 0, pz - SIEGE.back * s * K];
    const sleeveB = [sleeveA[0] + 0.34 * c, 0, sleeveA[2] + 0.34 * s * K];
    parts.push(T.tube(sleeveA, sleeveB, 0.115, 0.115, STEEL_D, { n: 10, layer: 1.3, capA: [{ k: 0.5, c: DARK }], capB: false }));
    for (const side of [-1, 1]) {
      const ly = side * 0.125;
      parts.push(T.tube([sleeveA[0] + 0.1 * c, ly, sleeveA[2] + 0.1 * s * K], [sleeveA[0] + 0.42 * c, ly, sleeveA[2] + 0.42 * s * K], 0.026, 0.026, STEEL_M, { n: 5, layer: 1.35, capA: false, capB: false, lw: 1.2 }));
    }
    parts.push(T.tube(a, b, 0.078, 0.07, STEEL, { n: 10, layer: 1.4, capA: false, capB: false }));
    const along = (t) => [a[0] + t * c, 0, a[2] + t * s * K];
    parts.push(T.tube(along(SIEGE.length - 0.16), along(SIEGE.length - 0.12), 0.1, 0.1, GOLD, { n: 10, layer: 1.6, sides: true, lw: 1.3 }));
    parts.push(T.tube(along(SIEGE.length - 0.07), b, 0.095, 0.095, STEEL_DD, { n: 10, layer: 1.62, capA: false, capB: [{ k: 0.62, c: '#14100c' }], lw: 1.6 }));
    // The scope on the left cheek, with the lens that casts the red line.
    const sight = siegeSight();
    const sBack = [sight[0] - 0.34 * c, sight[1], sight[2] - 0.34 * s * K];
    parts.push(T.box(-0.02, 0.05, -0.215, -0.1, pz + 1.5, pz + 3.8, STEEL_DD, { layer: 1.45, lw: 1.2 }));
    parts.push(T.tube(sBack, sight, 0.036, 0.04, STEEL_DD, { n: 6, layer: 1.7, lw: 1.3, capB: [{ k: 0.72, c: '#4a1414' }, { k: 0.4, c: '#ff4a4a' }] }));
    parts.push(T.tube([sight[0] - 0.05 * c, sight[1], sight[2] - 0.05 * s * K], [sight[0] - 0.02 * c, sight[1], sight[2] - 0.02 * s * K], 0.05, 0.05, acc, { n: 6, layer: 1.72, sides: true, lw: 1.1 }));
  } else if (id === 'thunderTower') {
    if (base) {
      // Cylinder plinth with a gold band, then seven blue coil rings.
      turret(0.2);
      parts.push(T.column(0, 0, 0.18, 0.16, 4, 9, STEEL_D, { n: 8, layer: 0.5, lw: 1.8 }));
      parts.push(T.column(0, 0, 0.185, 0.185, 9, 10.4, GOLD, { n: 8, layer: 0.55, lw: 1.2, top: false }));
      for (let i = 0; i < 7; i++) {
        const z0 = 10.4 + i * 3.7;
        parts.push(T.column(0, 0, 0.118 - i * 0.004, 0.112 - i * 0.004, z0, z0 + 3.4, i % 2 ? '#2a74c4' : '#3b8fe0', { n: 8, layer: 1 + i * 0.01, lw: 1.5, stripe: true }));
      }
    }
    if (top) {
      // Mast, a tilted violet ring that leans towards the target, and the blue ball in it.
      const zr = THUNDER_Z + p.bob;
      const tilt = 0.5;
      const u = Y;
      const v = [Math.cos(tilt), 0, Math.sin(tilt)];
      parts.push(T.column(0, 0, 0.03, 0.026, 36.4, zr + 4, STEEL_D, { n: 6, layer: 1.3, lw: 1.3 }));
      parts.push(T.ring([0, 0, zr], u, v, 0.27, 0.2, 0.026, '#8a5fd0', { n: 14, layer: 1.4, lw: 1.5 }));
      parts.push(T.ring([0, 0, zr], u, v, 0.2, 0.18, 0.016, '#cdb0ff', { n: 14, layer: 1.42, lw: 1 }));
      for (let i = 0; i < 3; i++) {
        const t = p.gyro * 1.6 + (i * Math.PI * 2) / 3;
        const o = [u[0] * Math.cos(t) + v[0] * Math.sin(t), u[1] * Math.cos(t) + v[1] * Math.sin(t), u[2] * Math.cos(t) + v[2] * Math.sin(t)];
        parts.push(T.gem([o[0] * 0.235, o[1] * 0.235, zr + o[2] * 0.235 * K], 0.024, 3, 3, '#dff6ff', { n: 4, layer: 1.46, lw: 1 }));
      }
      parts.push(T.gem([0, 0, zr], 0.1, 4, 4, '#3b8fe0', { n: 8, layer: 1.5, lw: 1.5 }));
      parts.push(T.gem([0, 0, zr + 0.4], 0.036, 4, 0, '#dff6ff', { n: 5, layer: 1.55, lw: 1 }));
    }
  } else if (id === 'soulfireObelisk') {
    if (base) {
      turret(0.21);
      parts.push(T.column(0, 0, 0.2, 0.17, 4, 9, STEEL_DD, { n: 8, layer: 0.5, lw: 1.8 }));
      parts.push(T.column(0, 0, 0.175, 0.175, 9, 10.4, GOLD, { n: 8, layer: 0.55, lw: 1.2, top: false }));
      const r0 = 0.125;
      const r1 = 0.05;
      parts.push(T.column(0, 0, r0, r1, 10.4, OBELISK_TOP - 6, '#5a5146', { n: 4, rot: Math.PI / 4, layer: 1, lw: 1.9 }));
      parts.push(T.column(0, 0, r1, 0.004, OBELISK_TOP - 6, OBELISK_TOP, GOLD, { n: 4, rot: Math.PI / 4, layer: 1.1, lw: 1.5 }));
      // Violet runes: a plate on each of the four faces at three heights.
      const apothem = (z) => (r0 + (r1 - r0) * ((z - 10.4) / (OBELISK_TOP - 6 - 10.4))) * Math.SQRT1_2;
      for (const z of [16, 28, 40]) {
        const ap = apothem(z) - 0.003;
        const w = 0.04 - (z - 16) * 0.0004;
        parts.push(T.box(ap, ap + 0.012, -w, w, z, z + 4, '#9a6ae0', { layer: 1.2, lw: 1 }));
        parts.push(T.box(-ap - 0.012, -ap, -w, w, z, z + 4, '#9a6ae0', { layer: 1.2, lw: 1 }));
        parts.push(T.box(-w, w, ap, ap + 0.012, z, z + 4, '#9a6ae0', { layer: 1.2, lw: 1 }));
        parts.push(T.box(-w, w, -ap - 0.012, -ap, z, z + 4, '#9a6ae0', { layer: 1.2, lw: 1 }));
      }
    }
    if (top) {
      // The eye: a bone disc that looks along the aim, with a red iris and a black pupil, in a gold
      // bezel. Its back is a violet seal.
      const z = EYE_Z + p.bob;
      parts.push(T.tube([-0.055, 0, z], [0.055, 0, z], 0.19, 0.19, '#e6dcc0', { n: 10, layer: 1.4, lw: 1.5, capA: [{ k: 0.6, c: '#8a5fd0' }, { k: 0.3, c: '#cdb0ff' }], capB: [{ k: 0.66, c: '#c23a2a' }, { k: 0.4, c: p.glow > 0 ? '#ffd0a0' : '#ff3a1a' }, { k: 0.2, c: '#14100c' }] }));
      parts.push(T.tube([-0.035, 0, z], [0.0, 0, z], 0.21, 0.21, GOLD, { n: 10, layer: 1.45, sides: true, lw: 1.3 }));
      parts.push(T.gem([0, 0, z - 0.21 * K - 2], 0.034, 1.5, 3.5, '#9a6ae0', { n: 4, layer: 1.3, lw: 1 }));
    }
  }

  // The weapons are drawn smaller than they are authored, the ink is not: thin it with them.
  for (const part2 of parts) part2.lw = Math.max(0.8, part2.lw * SOLID_INK);
  return { parts, samples: S, muzzle };
}
