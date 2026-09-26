// The Koloss on screen (docs/ART.md, "Koloss").
//
// A turnable model rather than a drawing, because it drives on all four axes
// and has to look right on each of them (src/render/model.js). The shapes are
// taken from reference/studien/koloss-studie.html, which is the binding source.
//
// Everything here reads the simulation and never writes to it.

import { iso } from './iso.js';
import { poly, ell } from './draw.js';
import { C } from './palette.js';
import {
  modelFrame,
  directionOf,
  prism,
  box,
  custom,
  renderModel,
  shade,
  visible,
  tube,
} from './model.js';
import { KOLOSS } from '../data/enemies.js';

/** How many cells across the model is drawn; the swathe stays one cell wide. */
const SCALE = 1.3;

const COLOURS = {
  hull: '#8a7666',
  track: '#3a322c',
  rust: '#a85a34',
  turret: '#8f7c6c',
  bone: '#d8c9a8',
  red: '#ff3a1a',
  gun: '#6b625a',
};

/** Width of the health bar above it, in screen pixels. */
const BAR_WIDTH = 90;

/**
 * What a single airstrike can take off it at most, as a share of full health.
 * The mark on the bar shows it, so the player can see what one run is worth
 * before spending the points (docs/ART.md).
 */
const AIRSTRIKE_MARK = 0.7;

/** Render-side motion, forgotten with the enemy it belongs to. */
const motion = new WeakMap();

/**
 * Sorting depth of the Koloss. It covers more than one cell, so its middle
 * alone would put it behind things it is standing in front of; the study's
 * offset of 0.4 is what makes it sit right (docs/ART.md).
 */
export function kolossDepth(e) {
  return e.x + e.y + 0.4;
}

/**
 * Keeps the render-side movement: how far the road wheels have turned, the
 * recoil of the main gun, and the shake while it drives.
 */
function updateMotion(e, dt, t, reducedMotion) {
  let m = motion.get(e);
  if (!m) {
    m = { rolled: 0, recoil: 0, lastFire: 0, x: e.x, y: e.y };
    motion.set(e, m);
  }
  const moved = Math.hypot(e.x - m.x, e.y - m.y);
  m.x = e.x;
  m.y = e.y;
  m.rolled += moved * 3;
  m.recoil = Math.max(0, m.recoil - dt * 3);
  // The main gun goes off on its own beat; there is no shot in the simulation
  // to hang it on, and none is wanted — it is noise, not damage.
  if (!reducedMotion && t - m.lastFire > 2.4) {
    m.lastFire = t;
    m.recoil = 1;
  }
  m.moving = moved > 1e-6;
  return m;
}

/**
 * Draws the Koloss. The caller places it in the depth-sorted pass by
 * `kolossDepth`.
 * @param {object} e  The enemy record from the simulation.
 * @param {{t: number, dt: number, reducedMotion: boolean}} view
 */
export function drawKoloss(ctx, e, { t, dt, reducedMotion }) {
  const m = updateMotion(e, dt, t, reducedMotion);
  const dir = directionOf(e.dx, e.dy);
  const F = modelFrame(e.x, e.y, 0, dir, SCALE);
  // It rocks on its tracks while it drives; reduced motion holds it still.
  const jig = m.moving && !reducedMotion ? Math.sin(t * 28) * 0.8 : 0;
  const parts = [];

  ctx.save();
  poly(ctx, [F.Wg(-1.35, -0.66), F.Wg(1.45, -0.66), F.Wg(1.45, 0.66), F.Wg(-1.35, 0.66)], 'rgba(0,0,0,.4)', null, 0);

  // Tracks, with road wheels on whichever side faces the camera.
  const trackSection = [[-1.26, 1], [1.2, 1], [1.28, 10], [1.2, 19], [-1.26, 19], [-1.34, 10]];
  for (const side of [-1, 1]) {
    const a = side > 0 ? 0.46 : -0.66;
    const b = side > 0 ? 0.66 : -0.46;
    parts.push(prism(ctx, F, trackSection, a, b, COLOURS.track, 2.4));
    const n = F.wn(0, side, 0);
    if (!visible(n)) continue;
    const ly = side * 0.67;
    parts.push({
      d: F.xy(0, ly) + 0.001,
      draw() {
        const u = F.fwdScreen();
        const rot = -m.rolled;
        for (let i = 0; i < 6; i++) {
          const [x, y] = F.W(-1.05 + i * 0.42, ly, 10);
          ctx.save();
          ctx.translate(x, y);
          // Sheared along the screen direction of the axis it drives on, so a
          // wheel stays a wheel in every direction.
          ctx.transform(u[0], u[1], 0, 1, 0, 0);
          const r = 8.6 * SCALE * 0.78;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = '#7a7066';
          ctx.fill();
          ctx.lineWidth = 2.2;
          ctx.strokeStyle = C.ink;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
          ctx.fillStyle = '#4a433d';
          ctx.fill();
          ctx.lineWidth = 1.3;
          ctx.stroke();
          for (let j = 0; j < 2; j++) {
            const a2 = rot + i + (j * Math.PI) / 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a2) * r * 0.68, Math.sin(a2) * r * 0.68);
            ctx.lineTo(-Math.cos(a2) * r * 0.68, -Math.sin(a2) * r * 0.68);
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.restore();
        }
      },
    });
  }

  // Hull with its sloped bow, and the rust band along the sides.
  parts.push(prism(ctx, F, [[-1.12, 14 + jig], [1.0, 14 + jig], [0.78, 38 + jig], [-1.12, 38 + jig]], -0.46, 0.46, COLOURS.hull, 2.8));
  parts.push(box(ctx, F, -1.14, 0.93, -0.48, 0.48, 19 + jig, 24 + jig, COLOURS.rust, 1.4, 0.001, true));

  // Two side guns per side.
  for (const side of [-1, 1]) {
    for (const lx of [-0.55, 0.25]) {
      parts.push(custom(F, lx, side * 0.62, 0, () => {
        const c = F.W(lx, side * 0.46, 28 + jig);
        const mouth = F.W(lx - 0.08, side * 0.8, 20 + jig);
        ell(ctx, c[0], c[1], 6, 5, shade(COLOURS.hull, 0.8), C.ink, 2.2);
        tube(ctx, c, mouth, 3.4, '#6b625a', '#9a9187');
      }));
    }
  }

  // Dozer blade with five bone teeth: the part that tears the swathe has to be
  // visible, or the breakthrough comes out of nowhere (docs/ART.md).
  parts.push(prism(ctx, F, [[1.14, 1], [1.28, 1], [1.4, 20], [1.26, 20]], -0.62, 0.62, COLOURS.rust, 2.4));
  for (let i = 0; i < 5; i++) {
    const ly = -0.5 + i * 0.25;
    parts.push(custom(F, 1.45, ly, 0, () => {
      const a = F.W(1.28, ly - 0.06, 3);
      const b = F.W(1.28, ly + 0.06, 3);
      const tip = F.W(1.55, ly, 1);
      poly(ctx, [a, b, tip], COLOURS.bone, C.ink, 1.5);
    }));
  }

  // Turret with its two red eyes, and the bone spines on the hull.
  parts.push(prism(ctx, F, [[-0.62, 38 + jig], [0.36, 38 + jig], [0.22, 58 + jig], [-0.62, 58 + jig]], -0.34, 0.34, COLOURS.turret, 2.6, 1));
  parts.push(custom(F, 0.3, 0, 1.01, () => {
    for (const ly of [-0.14, 0.14]) {
      if (!visible(F.wn(0.8, 0, 0.6))) continue;
      const eye = F.W(0.3, ly, 48 + jig);
      ell(ctx, eye[0], eye[1], 3, 2.2, COLOURS.red, C.ink, 1.2);
    }
  }));
  for (const [lx, ly] of [[-0.9, -0.3], [-0.7, 0.3], [0.5, -0.32]]) {
    parts.push(custom(F, lx, ly, 0.9, () => {
      const b = F.W(lx, ly, 38 + jig);
      const tip = F.W(lx + 0.05, ly, 50 + jig);
      poly(ctx, [[b[0] - 3, b[1]], [b[0] + 3, b[1]], tip], COLOURS.bone, C.ink, 1.5);
    }));
  }

  // Main gun, pushed back after it fires.
  parts.push(custom(F, 1.0, 0, 1.02, () => {
    const push = m.recoil * 0.18;
    const breech = F.W(0.3, 0, 48 + jig);
    const muzzle = F.W(1.72 - push, 0, 50 + jig);
    tube(ctx, breech, muzzle, 8, '#4a433d', '#7a746c');
    for (const u of [0.62, 0.8]) {
      const p = [breech[0] + (muzzle[0] - breech[0]) * u, breech[1] + (muzzle[1] - breech[1]) * u];
      ell(ctx, p[0], p[1], 3.4, 3.4, '#5a524a', C.ink, 1.6);
    }
    ell(ctx, muzzle[0], muzzle[1], 4, 4, '#1f1a15', C.ink, 2);
    if (m.recoil > 0.7) {
      ctx.globalAlpha = (m.recoil - 0.7) * 3;
      ell(ctx, muzzle[0], muzzle[1], 11, 11, '#ffd23f', null, 0);
      ctx.globalAlpha = 1;
    }
  }));

  // The four flak barrels, angled up.
  parts.push(custom(F, 0, 0, 2, () => {
    const mount0 = F.W(-0.28, 0, 58 + jig);
    const mount1 = F.W(-0.12, 0, 68 + jig);
    tube(ctx, mount0, mount1, 6, shade(COLOURS.hull, 0.6), null);
    const firing = !reducedMotion && Math.sin(t * 0.8) > 0.6;
    [[-0.12, -0.14], [-0.12, 0.14], [-0.3, -0.14], [-0.3, 0.14]].forEach(([lx, ly], i) => {
      const kick = firing && (Math.floor(t * 24) + i) % 2 === 0 ? 0.06 : 0;
      const a = F.W(lx, ly, 60 + jig);
      const b = F.W(lx + 0.55 - kick, ly, 92 - kick * 40 + jig);
      tube(ctx, a, b, 3.4, '#7a746c', '#a8a195');
      ell(ctx, b[0], b[1], 2.2, 2.2, '#1f1a15', C.ink, 1.2);
    });
  }));

  // Antenna with its red tip and sparks.
  parts.push(custom(F, -1.05, 0.25, 2, () => {
    const foot = F.W(-1.02, 0.28, 38 + jig);
    const tip = F.W(-1.22, 0.18, 100 + jig);
    ctx.beginPath();
    ctx.moveTo(foot[0], foot[1]);
    ctx.quadraticCurveTo(foot[0] + 2, tip[1] + 20, tip[0], tip[1]);
    ctx.lineWidth = 4.6;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#8a857a';
    ctx.stroke();
    ell(ctx, tip[0], tip[1], 3.4, 3.4, COLOURS.red, C.ink, 1.6);
    if (!reducedMotion && Math.sin(t * 9) > 0.2) {
      ctx.strokeStyle = '#ffb0a0';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + t;
        ctx.beginPath();
        ctx.moveTo(tip[0] + Math.cos(a) * 6, tip[1] + Math.sin(a) * 6);
        ctx.lineTo(tip[0] + Math.cos(a) * 11, tip[1] + Math.sin(a) * 11);
        ctx.stroke();
      }
    }
  }));

  renderModel(parts);

  // A hit flashes the whole machine, the way it does for every other figure.
  if ((e.flash ?? 0) > 0) {
    ctx.globalAlpha = 0.35;
    const [cx, cy] = F.W(0, 0, 30);
    ell(ctx, cx, cy, 70, 34, '#fff3d6', null, 0);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  drawHealthBar(ctx, F, e);
}

/**
 * The bar above it, with a mark at what one airstrike can take off. Drawn after
 * the model, so nothing covers it.
 */
function drawHealthBar(ctx, F, e) {
  if (e.dead) return;
  const [x, y] = F.W(0, 0, 120);
  const w = BAR_WIDTH;
  ctx.fillStyle = C.ink;
  ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, 10);
  ctx.fillStyle = '#3a1010';
  ctx.fillRect(x - w / 2, y, w, 6);
  ctx.fillStyle = '#e04a2a';
  ctx.fillRect(x - w / 2, y, w * Math.max(0, e.health / e.maxHealth), 6);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.fillRect(x - w / 2 + w * AIRSTRIKE_MARK, y, 1.5, 6);
}

/** The Koloss is the one enemy drawn as a model; everything else is a sprite. */
export const isKolossEnemy = (e) => Boolean(e.koloss);

export { KOLOSS, iso };
