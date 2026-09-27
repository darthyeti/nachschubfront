// The gunship of the airstrike on screen (docs/ART.md, "Gunship").
//
// A turnable model like the Koloss (src/render/model.js), because it flies the
// line the player drew and that line can run along any of the four axes. The
// shapes come from reference/studien/koloss-studie.html, which is binding.
//
// It only ever exists during the run of one airstrike, so it is drawn live and
// reads the pending strike; it never writes to the simulation.

import { C } from './palette.js';
import { iso } from './iso.js';
import {
  modelFrame,
  directionOf,
  prism,
  box,
  nacelle,
  custom,
  renderModel,
  shade,
  visible,
  ell,
} from './model.js';

/** How many cells across the model is drawn. */
const SCALE = 1.45;

/** Flight height above the ground, in screen pixels. */
const HEIGHT = 92;

/** Cells the gunship enters before the line and leaves after it. */
const LEAD = 5;

/** How long a bomb is seen falling before it lands, as a share of the run. */
const FALL_WINDOW = 0.09;

const COLOURS = {
  hull: '#a39582',
  rust: '#b0643a',
  dark: '#5a5048',
  pod: '#5a534c',
  glass: '#3f6a80',
};

/**
 * Draws the gunship for one airstrike in its run phase. Called from the
 * above-everything pass, so it flies over the field.
 * @param {object} hit  A pending strike of kind 'airstrike'.
 * @param {number} t  Render time, for the flames.
 */
export function drawGunship(ctx, hit, t, reducedMotion) {
  const runU = (hit.t - hit.warnSeconds) / hit.runSeconds;
  if (runU < 0 || runU > 1) return;

  const dx = hit.to.x - hit.from.x;
  const dy = hit.to.y - hit.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const dir = directionOf(dx, dy);

  // The ship flies from a lead before the line to a lead after it.
  const travel = len + 2 * LEAD;
  const s = -LEAD + travel * runU;
  const wx = hit.from.x + ux * s;
  const wy = hit.from.y + uy * s;

  const F = modelFrame(wx, wy, HEIGHT, dir, SCALE);
  const Fg = modelFrame(wx, wy, 0, dir, SCALE);
  const parts = [];

  // Ground shadow under the two axes of the airframe.
  ctx.save();
  ctx.globalAlpha = 0.3;
  poly(ctx, [Fg.Wg(-1.2, -0.42), Fg.Wg(1.2, -0.42), Fg.Wg(1.2, 0.42), Fg.Wg(-1.2, 0.42)], '#000');
  poly(ctx, [Fg.Wg(-0.4, -1.55), Fg.Wg(0.25, -1.55), Fg.Wg(0.25, 1.55), Fg.Wg(-0.4, 1.55)], '#000');
  ctx.restore();

  // Containers under the wings, covered by the wings themselves.
  for (const ly of [-1.25, -0.85, 0.85, 1.25]) {
    parts.push(prism(ctx, F, [[-0.32, -2], [0.24, -2], [0.24, 6], [-0.32, 6]], ly - 0.08, ly + 0.08, COLOURS.pod, 1.8, -0.2));
  }

  // Wings with rust tips.
  for (const side of [-1, 1]) {
    parts.push(box(ctx, F, -0.42, 0.26, side > 0 ? 0.36 : -1.3, side > 0 ? 1.3 : -0.36, 6, 14, COLOURS.hull, 2.6));
    parts.push(box(ctx, F, -0.42, 0.26, side > 0 ? 1.3 : -1.55, side > 0 ? 1.55 : -1.3, 6, 14, COLOURS.rust, 2.2));
  }

  // Round jet nacelles on their pylons, with the flame behind each.
  for (const ly of [-0.62, 0.62]) {
    const sgn = Math.sign(ly);
    parts.push(box(ctx, F, -0.95, -0.65, sgn > 0 ? 0.4 : -0.47, sgn > 0 ? 0.47 : -0.4, 12, 20, COLOURS.dark, 1.8));
    parts.push(nacelle(ctx, F, -1.3, -0.6, ly, 16, 0.15, 0.2, '#6f655b'));
    parts.push(custom(F, -1.5, ly, 0, () => {
      const p = F.W(-1.32, ly, 16);
      const flick = reducedMotion ? 0.5 : 0.5 + Math.sin(t * 40 + ly * 5) * 0.12;
      const q = F.W(-1.32 - flick, ly, 16);
      ctx.beginPath();
      ctx.moveTo(p[0] - 4, p[1] - 5);
      ctx.lineTo(q[0], q[1]);
      ctx.lineTo(p[0] + 4, p[1] + 5);
      ctx.closePath();
      ctx.fillStyle = '#ffb13b';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
    }));
  }

  // Fuselage with its sloped bow.
  parts.push(prism(ctx, F, [[-1.02, 0], [0.78, 0], [0.78, 34], [-0.88, 34], [-1.1, 24], [-1.1, 6]], -0.42, 0.42, COLOURS.hull, 3));

  // The small tail hatch with its two hinges and the warning stripe.
  parts.push(box(ctx, F, -1.13, -1.1, -0.18, 0.18, 8, 21, '#6b5e52', 1.8, 0.002));
  parts.push(custom(F, -1.14, 0, 0.003, () => {
    if (!visible(F.wn(-1, 0, 0))) return;
    for (const ly of [-0.12, 0.12]) {
      const h = F.W(-1.135, ly, 9);
      ell(ctx, h[0], h[1], 1.8, 1.8, '#9a9187', C.ink, 1);
    }
    const a = F.W(-1.135, -0.1, 19);
    const b = F.W(-1.135, 0.1, 19);
    line(ctx, a, b, 2.2, '#e8b93a');
  }));

  // Red side band, dark side panel, and the tail cone.
  parts.push(box(ctx, F, -0.95, 0.8, -0.44, 0.44, 27, 32, '#b23a2a', 1.4, 0.001, true));
  parts.push(box(ctx, F, -0.6, 0.1, -0.435, 0.435, 6, 24, '#6b5e52', 1.8, 0.0005, true));
  parts.push(prism(ctx, F, [[0.78, 0], [1.18, 4], [1.02, 26], [0.78, 34]], -0.38, 0.38, COLOURS.hull, 2.6));

  // Cockpit with its blue glass, the swept tail, the twin fins, the back turret.
  parts.push(prism(ctx, F, [[0.46, 34], [0.78, 34], [0.78, 44], [0.46, 44]], -0.24, 0.24, COLOURS.hull, 2.2, 1));
  parts.push(prism(ctx, F, [[0.7, 34], [0.8, 34], [0.8, 43], [0.7, 43]], -0.2, 0.2, COLOURS.glass, 1.8, 1.01));
  parts.push(prism(ctx, F, [[-0.88, 34], [-0.55, 34], [-0.55, 39], [-0.8, 39]], -0.26, 0.26, COLOURS.hull, 2.2, 1));
  for (const ly of [-0.24, 0.24]) {
    parts.push(prism(ctx, F, [[-0.86, 39], [-0.6, 39], [-0.78, 60], [-0.98, 60]], ly - 0.035, ly + 0.035, COLOURS.hull, 2, 1.5));
    parts.push(prism(ctx, F, [[-0.97, 55], [-0.74, 55], [-0.78, 60], [-0.98, 60]], ly - 0.04, ly + 0.04, COLOURS.rust, 1.5, 1.51));
  }
  parts.push(box(ctx, F, -0.3, 0.05, -0.18, 0.18, 34, 44, COLOURS.hull, 2.2, 1));
  parts.push(custom(F, 0.3, 0, 1.2, () => {
    for (const ly of [-0.07, 0.07]) {
      const t0 = F.W(0.05, ly, 40);
      const t1 = F.W(0.42, ly, 43);
      line(ctx, t0, t1, 4.6, C.ink);
      line(ctx, t0, t1, 2.2, '#8a857a');
    }
  }));

  // The two nose cannons.
  parts.push(custom(F, 1.35, 0, 0.5, () => {
    for (const ly of [-0.2, 0.2]) {
      const g0 = F.W(1.08, ly, 10);
      const g1 = F.W(1.55, ly, 10);
      line(ctx, g0, g1, 6, C.ink);
      line(ctx, g0, g1, 3, '#8a857a');
    }
  }));

  renderModel(parts);

  // Bombs falling from the belly, just before each one lands (accelerating).
  for (const drop of hit.drops) {
    if (drop.done) continue;
    if (runU < drop.at - FALL_WINDOW || runU >= drop.at) continue;
    // Accelerating fall from the belly to the ground point.
    const p = (runU - (drop.at - FALL_WINDOW)) / FALL_WINDOW;
    const [bx, by] = iso(drop.x, drop.y, HEIGHT * (1 - p * p) * SCALE);
    ell(ctx, bx, by, 4, 6, '#3a342e', C.ink, 1.6);
  }
}

/** A straight round-capped line, as the study draws its cannons and struts. */
function line(ctx, a, b, width, colour) {
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = colour;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

/** A filled polygon, ink outline optional. */
function poly(ctx, points, fill, stroke = null, lineWidth = 0) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
