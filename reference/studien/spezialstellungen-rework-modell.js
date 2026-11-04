// Study: rework of the six special emplacements (task A-21), part 1: the special base and the
// six special weapons as turnable models.
//
// Built on the machinery of stellungen-rework-modell.js (the frame, the solids, the face by
// face depth sorting, the colours, BASE_SCALE): nothing of that is copied, only imported.
// What is new here:
//   - the special base: the same capsule style bunker on exactly the footprint of one cell,
//     but tall, on four slanted steel legs, gold edges and three lamps in the colours of the
//     recipe ingredients. No sandbags, no rank.
//   - six weapons: Reinigungsschrein, Sturmbatterie, Glutkessel, Belagerungsmoerser,
//     Gewitterturm, Seelenfeuer-Obelisk. Each has a muzzle (the point its effect leaves from)
//     and, where the weapon has floating parts, a second layer for them so a resting
//     weapon can come from a pre-rendered stage while the floating parts stay alive.
//
// Local axes as in model.js: lx forward and ly sideways in cells, z up in pixels.
// Nothing here touches src/; the study only reads it.

import { poly, ell } from '../../src/render/draw.js';
import { C } from '../../src/render/palette.js';
import { shade, bright } from '../../src/render/model.js';
import {
  makeFrame,
  toolkit,
  renderModel,
  shadeRGB,
  K,
  STEEL,
  STEEL_M,
  STEEL_D,
  STEEL_DD,
  DARK,
  CONCRETE,
  COPPER,
  BRASS,
  BASE_SCALE,
  WEAPON_SCALE,
} from './stellungen-rework-modell.js';

export { makeFrame, renderModel, K, BASE_SCALE };

const INK = C.ink;
/** Ink of the weapon parts relative to what is authored, as in the standard emplacements. */
const INK_WEAPON = 0.62;
const GOLD = '#e0b83e';
const HAZARD_GOLD = '#d9a82a';

// ---------- the special base ----------
//
// Authored heights in px (before BASE_SCALE): steel lip, concrete body, rim, chamfered roof,
// roof platform. The roof of the old special base stands 40 px above the ground; the new
// one stands MOUNT_Z = 52 * 0.74 = about 38.5, so no emplacement gets higher than today.
const Z = { lip: 2.5, body: 40, rim: 46, roof: 49, mount: 52 };
/** Top of the roof platform in world px: the weapons stand on it. */
export const SPECIAL_MOUNT_Z = Z.mount * BASE_SCALE;
/** Half the footprint of the bunker body in cells: exactly the one of a standard bunker. */
export const SPECIAL_HALF = 0.47 * BASE_SCALE;
const HB = 0.44;
const HB_TOP = 0.34;
const RIM = 0.36;
const ROOF_TOP = 0.27;
const PLATFORM = 0.25;
/** The four legs: where they start on the body and where they stand (cells from the centre). */
const LEG_TOP = 0.35;
const LEG_FOOT = 0.58;
const LEG_Z = 27;

function rivet(ctx, p, r = 1, col = '#cfd5de') {
  ell(ctx, p[0], p[1], r, r, INK);
  ell(ctx, p[0] - r * 0.3, p[1] - r * 0.3, r * 0.38, r * 0.38, col);
}

/**
 * The special base around the origin of `ctx`.
 * @param {string} lead  guide colour (the doctrine of the first ingredient)
 * @param {string[]} pips  colours of the three ingredients, shown as three lamps
 * @param {{flat?: boolean}} options  `flat` draws the lamp glow as two flat translucent discs instead
 *   of a gradient, which is what the SVG export needs (no gradients in figures), as for the bunker.
 */
export function drawSpecialBase(ctx, lead, pips, { flat = false } = {}) {
  ctx.lineJoin = 'round';
  const F = makeFrame(0, 0, BASE_SCALE);
  const W = (lx, ly, z) => F.W(lx, ly, z);
  const T = toolkit(F, [], { split: false });
  /** A point on a near face: u along it, v up it, both 0 to 1. */
  const face = (side, u, v) => {
    const h = HB - (HB - HB_TOP) * v;
    const z = Z.lip + (Z.body - Z.lip) * v;
    return side === 'x' ? W(h, -h + 2 * h * u, z) : W(-h + 2 * h * u, h, z);
  };
  const quad = (side, u0, u1, v0, v1) => [face(side, u0, v0), face(side, u1, v0), face(side, u1, v1), face(side, u0, v1)];
  const nOf = (side) => bright(F.wn(side === 'x' ? 1 : 0, side === 'x' ? 0 : 1, 0));

  // The legs are slanted steel struts like the landing legs of the capsule. They are graphics
  // only (no collision) and reach past the cell; the two at the sides and the near one are
  // drawn after the face decoration, the one behind the body with the body.
  const legs = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => {
    const a = [sx * LEG_TOP, sy * LEG_TOP, LEG_Z];
    const b = [sx * LEG_FOOT, sy * LEG_FOOT, 2.2];
    return {
      near: sx + sy >= 0,
      parts: [
        T.tube(a, b, 0.05, 0.062, STEEL_D, { n: 6, capA: false, lw: 1.6, layer: 0.4 }),
        T.tube([a[0] + (b[0] - a[0]) * 0.55, a[1] + (b[1] - a[1]) * 0.55, LEG_Z + (2.2 - LEG_Z) * 0.55], [a[0] + (b[0] - a[0]) * 0.62, a[1] + (b[1] - a[1]) * 0.62, LEG_Z + (2.2 - LEG_Z) * 0.62], 0.058, 0.058, GOLD, { n: 6, sides: true, lw: 1.2, layer: 0.5 }),
        T.box(sx * LEG_FOOT - 0.075, sx * LEG_FOOT + 0.075, sy * LEG_FOOT - 0.075, sy * LEG_FOOT + 0.075, 0, 2.4, STEEL_DD, { lw: 1.5, layer: 0.6 }),
      ],
    };
  });

  renderModel(ctx, [
    ...legs.filter((l) => !l.near).flatMap((l) => l.parts),
    T.frustum(0, 0, 0.47, 0.47, 0.455, 0.455, 0, Z.lip, STEEL_D, { lw: 1.7 }),
    T.frustum(0, 0, HB, HB, HB_TOP, HB_TOP, Z.lip, Z.body, CONCRETE, { lw: 1.7 }),
    T.frustum(0, 0, RIM, RIM, RIM, RIM, Z.body, Z.rim, shadeRGB(lead, 1), { lw: 1.7 }),
    T.frustum(0, 0, RIM - 0.01, RIM - 0.01, ROOF_TOP, ROOF_TOP, Z.rim, Z.roof, CONCRETE, { lw: 1.5 }),
  ]);

  for (const side of ['x', 'y']) {
    const n = nOf(side);
    // Hazard band in black and gold, outlined once.
    const band = quad(side, 0.06, 0.94, 0.04, 0.15);
    ctx.save();
    ctx.beginPath();
    band.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.clip();
    poly(ctx, band, shade('#2b2724', n), null, 0);
    const stripes = 8;
    for (let i = -1; i < stripes; i++) {
      const u0 = 0.06 + (i / stripes) * 0.88;
      const w = (0.88 / stripes) * 0.5;
      const sl = 0.04;
      poly(ctx, [face(side, u0, 0.04), face(side, u0 + w, 0.04), face(side, u0 + w + sl, 0.15), face(side, u0 + sl, 0.15)], shade(HAZARD_GOLD, n), null, 0);
    }
    ctx.restore();
    poly(ctx, band, null, INK, 1.2);

    // The three lamps of the recipe on a steel plate: one per ingredient, in its colour.
    poly(ctx, quad(side, 0.17, 0.83, 0.2, 0.36), shade(STEEL_D, n), INK, 1.1);
    poly(ctx, quad(side, 0.17, 0.83, 0.2, 0.215), shade(GOLD, n), null, 0);
    pips.forEach((col, i) => {
      const [px, py] = face(side, 0.3 + i * 0.2, 0.29);
      ell(ctx, px, py, 3.7, 3.7, INK);
      ell(ctx, px, py, 2.6, 2.6, shade(col, 1));
      ell(ctx, px - 0.8, py - 0.9, 0.9, 0.9, '#ffffffb0');
    });

    // Loop-hole: a dark slot under a steel lintel, with a gold stripe above.
    poly(ctx, quad(side, 0.27, 0.73, 0.5, 0.56), shade(STEEL_D, n), INK, 1);
    poly(ctx, quad(side, 0.29, 0.71, 0.56, 0.72), '#14100c', INK, 1.1);
    poly(ctx, quad(side, 0.05, 0.95, 0.82, 0.86), shade(GOLD, n), INK, 0.9);

    // Plates beside the loop-hole, each with a mark in the guide colour.
    for (const [u0, u1] of [[0.05, 0.15], [0.85, 0.95]]) {
      poly(ctx, quad(side, u0, u1, 0.42, 0.78), shade(STEEL_D, n), INK, 1);
      const um = (u0 + u1) / 2;
      poly(ctx, [face(side, u0 + 0.015, 0.52), face(side, u1 - 0.015, 0.52), face(side, um, 0.68)], shade(lead, n), INK, 0.8);
      rivet(ctx, face(side, um, 0.45), 0.7, GOLD);
      rivet(ctx, face(side, um, 0.74), 0.7, GOLD);
    }
    for (const u of [0.2, 0.8]) {
      const h = 0.46;
      rivet(ctx, side === 'x' ? W(h, -h + 2 * h * u, 1.5) : W(-h + 2 * h * u, h, 1.5), 0.75, GOLD);
    }
  }

  // Rim rivets, in gold.
  for (const u of [0.12, 0.32, 0.5, 0.68, 0.88]) {
    const h = RIM - 0.005;
    rivet(ctx, W(h, -h + 2 * h * u, (Z.body + Z.rim) / 2), 0.7, GOLD);
    rivet(ctx, W(-h + 2 * h * u, h, (Z.body + Z.rim) / 2), 0.7, GOLD);
  }

  // The legs at the sides and in front, over the decoration.
  renderModel(ctx, legs.filter((l) => l.near).flatMap((l) => l.parts));

  // Bright line on the upper left edge of the roof, as the light of the scene (docs/ART.md).
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = C.bone;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const l0 = W(-ROOF_TOP, ROOF_TOP, Z.roof);
  const l1 = W(-ROOF_TOP, -ROOF_TOP, Z.roof);
  ctx.moveTo(l0[0], l0[1]);
  ctx.lineTo(l1[0], l1[1]);
  ctx.stroke();
  ctx.restore();

  // The hatch the weapon stands on: a small octagon with a gold band.
  renderModel(ctx, [
    T.column(0, 0, PLATFORM, PLATFORM - 0.02, Z.roof, Z.mount, STEEL, { n: 8, rot: Math.PI / 8, lw: 1.5 }),
    T.column(0, 0, PLATFORM + 0.003, PLATFORM + 0.003, Z.roof + 0.5, Z.roof + 1.7, GOLD, { n: 8, rot: Math.PI / 8, lw: 1.1, top: false }),
  ]);

  // Gold edges: top of the rim and edge of the roof, as on a rank 5 bunker.
  ctx.lineCap = 'round';
  const line = (pts) => {
    for (const [w, col] of [[3.6, INK], [1.9, C.gold]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
    }
  };
  line([W(-RIM, RIM, Z.rim), W(RIM, RIM, Z.rim), W(RIM, -RIM, Z.rim)]);
  line([W(-ROOF_TOP, ROOF_TOP, Z.roof), W(ROOF_TOP, ROOF_TOP, Z.roof), W(ROOF_TOP, -ROOF_TOP, Z.roof)]);

  // Guide lamp on the near roof corner.
  const lampP = W(ROOF_TOP, ROOF_TOP, Z.roof + 2);
  if (flat) {
    ctx.fillStyle = lead;
    for (const [r, a] of [[8, 0.12], [5, 0.2]]) {
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(lampP[0], lampP[1] - 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    const g = ctx.createRadialGradient(lampP[0], lampP[1] - 2, 1, lampP[0], lampP[1] - 2, 8);
    g.addColorStop(0, `${lead}aa`);
    g.addColorStop(1, `${lead}00`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lampP[0], lampP[1] - 2, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  renderModel(ctx, [T.gem([ROOF_TOP, ROOF_TOP, Z.roof + 1.5], 0.034, 5, 1, lead, { n: 4, lw: 1.1 })]);
}

// ---------- the weapons ----------

/** Order of the special weapons, with their kind in this file. */
export const KINDS = ['purge', 'storm', 'kessel', 'siege', 'thunder', 'obelisk'];

/**
 * The weapons are authored small and drawn at WEAPON_SCALE times these factors, so that no
 * special gets more than about a tenth higher than its sprite today (the heights are
 * measured by the study, `heights()`). The storm battery is a heavy housing and a little
 * larger than the rest.
 */
export const SPECIAL_SCALE = { purge: 0.85, storm: 1.15, kessel: 0.9, siege: 0.95, thunder: 1.0, obelisk: 1.0 };
export const scaleOf = (kind) => WEAPON_SCALE * SPECIAL_SCALE[kind];

/** Weapons with a part that floats and moves while the rest stands: that part is its own layer. */
export const HAS_FLOAT = { purge: false, storm: false, kessel: false, siege: false, thunder: true, obelisk: true };
/** Weapons that are always built live in the hybrid: the artefact of the shrine hovers between the pillars. */
export const LIVE_ALWAYS = { purge: true };

/** Pose of a weapon at one moment; everything the model needs besides the angle. */
export function restPose(accent) {
  return { accent, bob: 0, gyro: 0.6, recoil: 0, bar: [0, 0, 0, 0], tube: 0, flame: 1, glow: 0 };
}

// Storm battery: four barrels, two over two, fired in turn: [ly, dz in px].
export const STORM_BARRELS = [[0.085, 3.1], [-0.085, -3.1], [-0.085, 3.1], [0.085, -3.1]];
const STORM_AXIS_Z = 12;
const STORM_MUZZLE_X = 0.56;
/** Where the cases leave the storm battery: the back of the housing, local coordinates. */
export const STORM_CASING_PORT = [-0.21, 0.0, 15];

// Siege mortar: a long barrel on a low elevation.
const SIEGE_ELEV = (50 * Math.PI) / 180;
const SIEGE_LEN = 0.8;
const SIEGE_PIVOT = [0, 0, 20];

function siegeAxis(p) {
  const c = Math.cos(SIEGE_ELEV);
  const s = Math.sin(SIEGE_ELEV);
  const shift = -0.09 * p.recoil;
  const a = [-0.12 * c + shift * c, 0, SIEGE_PIVOT[2] - 0.12 * s * K + shift * s * K];
  const b = [a[0] + SIEGE_LEN * c, 0, a[2] + SIEGE_LEN * s * K];
  return { a, b, c, s, dir: [c, 0, s] };
}

/** The scope lens of the siege mortar: where the red laser line starts. */
export function siegeSight() {
  const c = Math.cos(SIEGE_ELEV);
  const s = Math.sin(SIEGE_ELEV);
  return [0.36 * c - 0.12 * s, -0.1, SIEGE_PIVOT[2] + (0.36 * s + 0.12 * c) * K];
}

// Thunder tower: the coil, then mast, ring and ball float above it.
export const THUNDER_Z = 42;
// Obelisk: shaft, pyramidion, and the eye above it.
const OBELISK_TOP = 62;
export const EYE_Z = 74;

/**
 * Where the shot leaves the weapon, in local coordinates, and the direction it leaves in
 * (local, true units). Independent of the angle, so the scene places its effects without
 * building the model.
 */
export const MUZZLE_S = {
  purge: (p) => ({ at: [0, 0, 17.5 + p.bob], dir: [1, 0, 0] }),
  storm: (p) => {
    const [ly, dz] = STORM_BARRELS[p.tube];
    return { at: [STORM_MUZZLE_X - 0.045 * p.bar[p.tube], ly, STORM_AXIS_Z + dz], dir: [1, 0, 0] };
  },
  kessel: () => ({ at: [0.225, 0, 31.5], dir: [1, 0, 0] }),
  siege: (p) => ({ at: siegeAxis(p).b, dir: siegeAxis(p).dir }),
  thunder: (p) => ({ at: [0, 0, THUNDER_Z + p.bob], dir: [1, 0, 0] }),
  obelisk: (p) => ({ at: [0.06, 0, EYE_Z + p.bob], dir: [1, 0, 0] }),
};

/** Local points at the base of the cauldron's flames (px for z), for the scene's flame shapes. */
export const KESSEL_FIRE = [0, 0, 21.5];
/** Foot positions of the obelisk's flames, local (lx, ly, z): two behind and two in front, in any turn. */
export const OBELISK_FLAMES = [[0.13, 0.0], [-0.13, 0.0], [0.0, 0.13], [0.0, -0.13]];
export const OBELISK_FLAME_Z = 9;

/**
 * Builds a weapon: its parts, local points for the shadow, and the muzzle.
 * `part`: 'all', 'base' (what stands still) or 'float' (what hovers above it); a resting
 * weapon is a pre-rendered 'base' with the live 'float' on top.
 */
export function buildSpecial(kind, F, p, part = 'all') {
  const S = [];
  const T = toolkit(F, S);
  const parts = [];
  const acc = p.accent;
  const X = [1, 0, 0];
  const Y = [0, 1, 0];
  const Z3 = [0, 0, 1];
  const base = part !== 'float';
  const top = part !== 'base';
  const muzzle = MUZZLE_S[kind](p);
  const mz = muzzle.at;

  /** The turntable under every weapon: a steel ring with a gold band and a band in the guide colour. */
  const turret = (r) => {
    parts.push(T.column(0, 0, r, r - 0.01, 0, 4, STEEL_DD, { n: 8, lw: 1.6 }));
    parts.push(T.column(0, 0, r + 0.012, r + 0.012, 0.9, 1.9, GOLD, { n: 8, lw: 1.1, top: false }));
    parts.push(T.column(0, 0, r + 0.012, r + 0.012, 2.3, 3.2, acc, { n: 8, lw: 1.1, top: false }));
  };

  if (kind === 'purge') {
    // Four pillars carry a canopy; a golden artefact hovers between them. Four pillars and not
    // two, so the shrine looks the same from every side it can turn to.
    const zc = 17.5 + p.bob;
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
  } else if (kind === 'storm') {
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
    parts.push(T.box(0.28, 0.315, -0.15, 0.15, STORM_AXIS_Z - 6.4, STORM_AXIS_Z + 6.4, STEEL, { layer: 0.9, lw: 1.5 }));
    STORM_BARRELS.forEach(([ly, dz], k) => {
      const z = STORM_AXIS_Z + dz;
      const rc = 0.045 * p.bar[k];
      parts.push(T.tube([0.22 - rc, ly, z], [STORM_MUZZLE_X - rc, ly, z], 0.036, 0.032, STEEL_M, { n: 6, layer: 1 + k * 0.01, lw: 1.2, capA: false, capB: [{ k: 0.45, c: '#14100c' }] }));
      parts.push(T.tube([0.46 - rc, ly, z], [0.49 - rc, ly, z], 0.044, 0.044, '#7fd8ff', { n: 6, layer: 1.2 + k * 0.01, sides: true, lw: 1 }));
    });
    parts.push(T.tube([0.2, 0, STORM_AXIS_Z], [0.26, 0, STORM_AXIS_Z], 0.025, 0.025, DARK, { n: 5, layer: 1.1, capA: false, capB: false }));
  } else if (kind === 'kessel') {
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
  } else if (kind === 'siege') {
    const { a, b, c, s } = siegeAxis(p);
    const [px, , pz] = SIEGE_PIVOT;
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
    const sleeveA = [-0.12 * c, 0, pz - 0.12 * s * K];
    const sleeveB = [sleeveA[0] + 0.34 * c, 0, sleeveA[2] + 0.34 * s * K];
    parts.push(T.tube(sleeveA, sleeveB, 0.115, 0.115, STEEL_D, { n: 10, layer: 1.3, capA: [{ k: 0.5, c: DARK }], capB: false }));
    for (const side of [-1, 1]) {
      const ly = side * 0.125;
      parts.push(T.tube([sleeveA[0] + 0.1 * c, ly, sleeveA[2] + 0.1 * s * K], [sleeveA[0] + 0.42 * c, ly, sleeveA[2] + 0.42 * s * K], 0.026, 0.026, STEEL_M, { n: 5, layer: 1.35, capA: false, capB: false, lw: 1.2 }));
    }
    parts.push(T.tube(a, b, 0.078, 0.07, STEEL, { n: 10, layer: 1.4, capA: false, capB: false }));
    const along = (t) => [a[0] + t * c, 0, a[2] + t * s * K];
    parts.push(T.tube(along(SIEGE_LEN - 0.16), along(SIEGE_LEN - 0.12), 0.1, 0.1, GOLD, { n: 10, layer: 1.6, sides: true, lw: 1.3 }));
    parts.push(T.tube(along(SIEGE_LEN - 0.07), b, 0.095, 0.095, STEEL_DD, { n: 10, layer: 1.62, capA: false, capB: [{ k: 0.62, c: '#14100c' }], lw: 1.6 }));
    // The scope on the left cheek, with the lens that casts the red line.
    const sight = siegeSight();
    const sBack = [sight[0] - 0.34 * c, sight[1], sight[2] - 0.34 * s * K];
    parts.push(T.box(-0.02, 0.05, -0.215, -0.1, pz + 1.5, pz + 3.8, STEEL_DD, { layer: 1.45, lw: 1.2 }));
    parts.push(T.tube(sBack, sight, 0.036, 0.04, STEEL_DD, { n: 6, layer: 1.7, lw: 1.3, capB: [{ k: 0.72, c: '#4a1414' }, { k: 0.4, c: '#ff4a4a' }] }));
    parts.push(T.tube([sight[0] - 0.05 * c, sight[1], sight[2] - 0.05 * s * K], [sight[0] - 0.02 * c, sight[1], sight[2] - 0.02 * s * K], 0.05, 0.05, acc, { n: 6, layer: 1.72, sides: true, lw: 1.1 }));
  } else if (kind === 'thunder') {
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
  } else if (kind === 'obelisk') {
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
      // The eye: a bone disc that looks along the aim, with a red iris and a black pupil, in a
      // gold bezel. Its back is a violet seal.
      const z = EYE_Z + p.bob;
      parts.push(T.tube([-0.055, 0, z], [0.055, 0, z], 0.19, 0.19, '#e6dcc0', { n: 10, layer: 1.4, lw: 1.5, capA: [{ k: 0.6, c: '#8a5fd0' }, { k: 0.3, c: '#cdb0ff' }], capB: [{ k: 0.66, c: '#c23a2a' }, { k: 0.4, c: p.glow > 0 ? '#ffd0a0' : '#ff3a1a' }, { k: 0.2, c: '#14100c' }] }));
      parts.push(T.tube([-0.035, 0, z], [0.0, 0, z], 0.21, 0.21, GOLD, { n: 10, layer: 1.45, sides: true, lw: 1.3 }));
      parts.push(T.gem([0, 0, z - 0.21 * K - 2], 0.034, 1.5, 3.5, '#9a6ae0', { n: 4, layer: 1.3, lw: 1 }));
    }
  }

  // Draw the weapons smaller than authored but not the ink: thin it with them.
  for (const part2 of parts) if (part2.faces) part2.lw = Math.max(0.8, part2.lw * INK_WEAPON);
  return { parts, samples: S, muzzle };
}
