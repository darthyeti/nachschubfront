// What used to be painted into the concept art and is animated in code from M4 on:
// the pilot light of the flame thrower, the lens of the laser, the aura and rings
// of the psi shrine, the glow and the arcs of the tesla coil. Since M4d also the
// muzzle flashes and flame bursts at the bunker's three ports.
//
// These belong to the emplacement itself (they are there without a shot being
// fired), unlike the muzzle flashes and beams in effects.js.

import { ell } from './draw.js';
import { iso } from './iso.js';
import { C } from './palette.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';

/** Where the hero's banner stands on the base and how big it is (SVG units). */
/** How far the outer two ports aim off the firing direction (radians). */
const PORT_SPREAD = 0.3;

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

/** A flame tongue out of an embrasure: a leaf along the firing direction. */
function tongue(ctx, x, y, [dx, dy], length, width, fill) {
  const [px, py] = [-dy * width, dx * width];
  ctx.beginPath();
  ctx.moveTo(x + px, y + py);
  ctx.quadraticCurveTo(x + dx * length * 0.7 + px, y + dy * length * 0.7 + py, x + dx * length, y + dy * length);
  ctx.quadraticCurveTo(x + dx * length * 0.7 - px, y + dy * length * 0.7 - py, x - px, y - py);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
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
 * The shared bunker has no barrel (docs/ART.md, "Gemeinsamer Bunker"): what tells
 * the two doctrines apart is the effect at the three ports. Both lean
 * towards the target, because nothing about the building turns.
 */
function drawPortFire(ctx, tower, view) {
  const { doctrine, ports, fire, shot, casings, scale, t, reducedMotion } = view;
  const flicker = reducedMotion ? 1 : 0.8 + Math.sin(t * 22) * 0.2;

  if (doctrine === 'flame') {
    const aim = Math.atan2(fire[1], fire[0]);
    ports.forEach(([x, y], i) => {
      if (!tower.firing) {
        // Idle: a blue pilot light, in the middle slit only (style test).
        if (i === 1) ell(ctx, x, y, 2.2 * scale, 2.2 * scale, '#6fb7ff', null);
        return;
      }
      // Fanned out around the firing direction: three tongues along the same
      // line would overlap into one smear across the front.
      const angle = aim + (i - 1) * PORT_SPREAD;
      const out = [Math.cos(angle), Math.sin(angle)];
      const wobble = reducedMotion ? 1 : 0.75 + Math.sin(t * 19 + i * 2.1) * 0.25;
      const length = 12 * scale * wobble;
      tongue(ctx, x, y, out, length, 3.4 * scale, '#ff8a2a');
      tongue(ctx, x, y, out, length * 0.55, 2 * scale, '#ffd23f');
    });
    return;
  }
  // Autocannon: every port flashes on the same beat as the shot.
  if (shot <= 0.05) return;
  for (const [x, y] of ports) {
    spark(ctx, x, y, 7 * scale * shot * flicker, '#f0e2b8');
    spark(ctx, x, y, 3 * scale * shot, '#fff3d0');
  }
  if (casings) drawCasings(ctx, view);
}

/**
 * Spent cases tumbling out of a rapid-firing gun (style test). They live off the
 * shot's own decay instead of a particle system: the drum fire is over in a
 * fraction of a second, and nothing has to be kept between frames.
 */
function drawCasings(ctx, { ports, shot, scale }) {
  const age = 1 - shot;
  ctx.fillStyle = '#e8c872';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 0.8;
  ports.forEach(([x, y], i) => {
    for (let n = 0; n < 2; n++) {
      // Fixed offsets per port and case, so the spray never jitters on a still frame.
      const out = (1.4 + i * 0.35 + n * 0.8) * scale * 26 * age;
      const rise = (1 - (age * 2 - 1) ** 2) * 14 * scale;
      const cx = x + out;
      const cy = y - rise + age * 10 * scale;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(age * (6 + i) + n);
      ctx.beginPath();
      ctx.rect(-1.4 * scale, -0.9 * scale, 2.8 * scale, 1.8 * scale);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  });
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
