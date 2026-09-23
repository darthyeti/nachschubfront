// What used to be painted into the concept art and is animated in code from M4 on:
// the pilot light of the flame thrower, the lens of the laser, the aura and rings
// of the psi shrine, the glow and the arcs of the tesla coil.
//
// These belong to the emplacement itself (they are there without a shot being
// fired), unlike the muzzle flashes and beams in effects.js.

import { ell } from './draw.js';
import { C } from './palette.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';

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
  const colour = DOCTRINE_COLORS[doctrine] ?? C.gold;
  const firing = isFiring(tower);

  if (doctrine === 'psi') {
    const bob = reducedMotion ? 0 : Math.sin(t * 2 + tower.x) * 3 * scale;
    const y = pivot[1] - bob;
    glow(ctx, pivot[0], y, 30 * scale, colour, firing ? 0.34 : 0.22);
    // Two rings around the crystal, turning against each other.
    ctx.save();
    ctx.translate(pivot[0], y);
    for (const [speed, rx, ry, width] of [[0.6, 24, 7, 2.5], [-0.9, 22, 6, 2]]) {
      ctx.save();
      ctx.rotate(reducedMotion ? -0.3 : t * speed);
      ctx.strokeStyle = speed > 0 ? colour : '#d9c2ff';
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * scale, ry * scale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  } else if (doctrine === 'tesla') {
    glow(ctx, pivot[0], pivot[1], 30 * scale, colour, firing ? 0.38 : 0.25);
  }
}

/** The bright bits in front: pilot light, lens, arcs. */
export function drawWeaponSpark(ctx, tower, view) {
  const { doctrine, muzzle, pivot, scale, t, reducedMotion } = view;
  const colour = DOCTRINE_COLORS[doctrine] ?? C.gold;
  const firing = isFiring(tower);

  if (doctrine === 'flame') {
    // Blue pilot light when idle, a yellow tongue while burning (style test).
    const flicker = reducedMotion ? 1 : 0.85 + Math.sin(t * 20) * 0.15;
    const r = (tower.firing ? 5 : 2.5) * flicker * scale;
    ell(ctx, muzzle[0], muzzle[1], r, r, tower.firing ? '#ffd23f' : '#6fb7ff', null);
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
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      // Slow drift plus a jump per arc, so the pattern never stands still.
      const angle = -Math.PI / 2 + Math.sin(t * 3 + i * 2.1 + tower.x) * 1.6;
      arc(ctx, pivot[0], pivot[1], angle, (16 + i * 6) * scale, '#bff2ff', jitter);
    }
    ell(ctx, pivot[0] - 5 * scale, pivot[1] - 5 * scale, 4.5 * scale, 4.5 * scale, '#dff6ff', null);
  }
}
