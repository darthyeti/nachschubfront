// What used to be painted into the concept art and is animated in code from M4 on:
// the pilot light of the flame thrower, the lens of the laser, the aura and rings
// of the psi shrine, the glow and the arcs of the tesla coil. Since M4d also the
// muzzle flashes, casings and the flame jet at the weapon's muzzle.
//
// These belong to the emplacement itself (they are there without a shot being
// fired), unlike the muzzle flashes and beams in effects.js.

import { ell } from './draw.js';
import { iso } from './iso.js';
import { C } from './palette.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';

/** Where the hero's banner stands on the base and how big it is (SVG units). */
/** Arcs around the tesla sphere: idle it crackles, while firing it flares. */
const ARC_IDLE = 1;
const ARC_FIRING = 3;

function isFiring(tower) {
  return Boolean(tower.firing) || tower.cooldown > 0;
}

/** Soft round glow without shadowBlur (CLAUDE.md): a radial gradient. */
function glow(ctx, x, y, radius, colour, alpha) {
  const g = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
  g.addColorStop(0, `${colour}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`);
  g.addColorStop(1, `${colour}00`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** One jagged arc from the sphere outwards. */
function arc(ctx, x, y, angle, length, colour, jitter) {
  const steps = 3;
  const points = [[x, y]];
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    const off = i === steps ? 0 : (Math.random() - 0.5) * jitter;
    points.push([x + Math.cos(angle) * length * u - Math.sin(angle) * off, y + Math.sin(angle) * length * u + Math.cos(angle) * off]);
  }
  for (const [width, stroke] of [[5, C.ink], [2.2, colour]]) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
  }
}

/**
 * The glowing parts behind the weapon: psi aura and rings, tesla halo.
 * @param {{doctrine: string, pivot: number[], muzzle: number[], scale: number, t: number, reducedMotion: boolean}} view
 */
export function drawWeaponGlow(ctx, tower, view) {
  const { doctrine, pivot, scale, t, reducedMotion } = view;
  const firing = isFiring(tower);

  // Normally the doctrine decides the halo, but two recipe buildings hover a psi
  // part whose colour is not their doctrine's: the shrine's splinter is violet
  // on a flame building, the thunder tower's core is blue (docs/ART.md).
  const kind = view.glow?.kind ?? doctrine;
  const colour = view.glow?.colour ?? DOCTRINE_COLORS[doctrine] ?? C.gold;

  // Since v5 the rings and the coil are part of the drawing, so only the light
  // around them is left to the code: two sets of rings on one figure read as a
  // mistake, not as a glow (docs/ART.md).
  if (kind === 'psi' || kind === 'tesla') {
    const [ax, ay] = view.anchor ?? pivot;
    const bob = reducedMotion ? 0 : Math.sin(t * 2 + tower.x) * 2 * scale;
    glow(ctx, ax, ay - bob, 26 * scale, colour, firing ? 0.36 : 0.22);
  }
}

/** A muzzle flash: the four-pointed star of the concept sheets. */
function spark(ctx, x, y, radius, colour) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const r = i % 2 ? radius * 0.34 : radius;
    const [px, py] = [x + Math.cos(angle) * r, y + Math.sin(angle) * r];
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
}

/**
 * Spent cases tumbling out of a rapid-firing gun (style test). They live off the
 * shot's own decay instead of a particle system: the drum fire is over in a
 * fraction of a second, and nothing has to be kept between frames.
 */
/**
 * Spent brass tumbling out of the muzzle while firing. Driven by the recoil
 * phase (`view.shot`, 1 just fired, decaying to 0), so it animates per shot
 * without a persistent particle. Two cases arc out to the side away from the
 * line of fire, rise, then fall.
 */
function drawEjectedCasings(ctx, { muzzle, fire, shot, scale }) {
  if (shot <= 0.05) return;
  const age = 1 - shot;
  // Sideways from the barrel, on the screen-up side, plus a fall.
  const side = [-fire[1], -Math.abs(fire[0]) - 0.4];
  const len = Math.hypot(side[0], side[1]) || 1;
  const ux = side[0] / len;
  const uy = side[1] / len;
  ctx.fillStyle = '#e8c872';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 0.8;
  for (let n = 0; n < 2; n++) {
    const out = (10 + n * 7) * scale * age;
    const rise = (1 - (age * 2 - 1) ** 2) * 13 * scale;
    const cx = muzzle[0] + ux * out;
    const cy = muzzle[1] + uy * out - rise + age * age * 16 * scale;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(age * (7 + n * 2));
    ctx.beginPath();
    ctx.rect(-1.4 * scale, -0.9 * scale, 2.8 * scale, 1.8 * scale);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}



/** The bright bits in front: pilot light, lens, arcs. */
export function drawWeaponSpark(ctx, tower, view) {
  const { doctrine, muzzle, pivot, scale, t, reducedMotion } = view;
  const colour = DOCTRINE_COLORS[doctrine] ?? C.gold;
  const firing = isFiring(tower);

  if (view.ports) {
    drawPortFire(ctx, tower, view);
  } else if (doctrine === 'flame') {
    // Blue pilot light when idle, a yellow tongue while burning (style test).
    // The shrine and the cauldron burn in a bowl, not at a nozzle, so the fire
    // sits on their anchor (docs/ART.md, "Wirkungsanker").
    const [fx, fy] = view.anchor ?? muzzle;
    const flicker = reducedMotion ? 1 : 0.85 + Math.sin(t * 20) * 0.15;
    const bowl = Boolean(view.anchor);
    const r = (tower.firing ? 5 : 2.5) * (bowl ? 1.8 : 1) * flicker * scale;
    if (bowl) glow(ctx, fx, fy, (tower.firing ? 22 : 15) * scale, '#ff8a2a', tower.firing ? 0.5 : 0.3);
    ell(ctx, fx, fy, r, r, tower.firing || bowl ? '#ffd23f' : '#6fb7ff', null);
    if (bowl) ell(ctx, fx, fy - r * 0.5, r * 0.55, r * 0.7, '#fff3c4', null);
  } else if (doctrine === 'autocannon') {
    // A muzzle flash at the barrel while firing, and brass tumbling out of it.
    if (tower.firing || view.shot > 0.05) {
      const flare = Math.max(0.3, view.shot);
      glow(ctx, muzzle[0], muzzle[1], 12 * scale * flare, '#ffd23f', 0.5 * flare);
      spark(ctx, muzzle[0], muzzle[1], (4 + 3 * flare) * scale, '#fff3b0');
    }
    if (view.casings || doctrine === 'autocannon') drawEjectedCasings(ctx, view);
  } else if (doctrine === 'laser') {
    const pulse = reducedMotion ? 0.8 : 0.6 + Math.sin(t * 6) * 0.2;
    glow(ctx, muzzle[0], muzzle[1], 14 * scale, colour, firing ? 0.55 : 0.3);
    ell(ctx, muzzle[0], muzzle[1], 3 * scale, 3 * scale, colour, C.ink, 1.5);
    ctx.globalAlpha = pulse;
    ell(ctx, muzzle[0] - scale, muzzle[1] - scale, 1.4 * scale, 1.4 * scale, '#fff3e0', null);
    ctx.globalAlpha = 1;
  } else if (doctrine === 'tesla') {
    const count = reducedMotion ? 1 : firing ? ARC_FIRING : ARC_IDLE;
    const jitter = reducedMotion ? 0 : 6 * scale;
    // The idle arcs leave the same point the chain does: the coil, not the psi
    // core hovering above it (docs/ART.md, "Wirkungsanker").
    const [cx, cy] = view.anchor ?? pivot;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      // Slow drift plus a jump per arc, so the pattern never stands still.
      const angle = -Math.PI / 2 + Math.sin(t * 3 + i * 2.1 + tower.x) * 1.6;
      arc(ctx, cx, cy, angle, (16 + i * 6) * scale, '#bff2ff', jitter);
    }
    ell(ctx, cx - 5 * scale, cy - 5 * scale, 4.5 * scale, 4.5 * scale, '#dff6ff', null);
  }

  // The siege mortar's scope draws a thin line to where the shell will go, a
  // moment before it leaves. Purely a warning; nothing is aimed by it.
  if (view.sight && tower.aim) drawSight(ctx, tower, view);
}

/**
 * The laser sight of the siege mortar: a thin red line from the muzzle to the
 * target, brightest just before the shot and gone while the tube reloads.
 */
function drawSight(ctx, tower, view) {
  const { muzzle, t, reducedMotion } = view;
  const [tx, ty] = iso(tower.aim.x + 0.5, tower.aim.y + 0.5, 6);
  const pulse = reducedMotion ? 0.5 : 0.35 + Math.abs(Math.sin(t * 5)) * 0.35;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = '#ff4a4a';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(muzzle[0], muzzle[1]);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = Math.min(1, pulse + 0.3);
  ell(ctx, tx, ty, 3, 1.6, '#ff4a4a', null);
  ctx.restore();
}
