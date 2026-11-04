// What used to be painted into the concept art and is animated in code from M4 on:
// the pilot light of the flame thrower, the lens of the laser, the aura and rings
// of the psi shrine, the glow and the arcs of the tesla coil. Since M4d also the
// muzzle flashes, casings and the flame jet at the weapon's muzzle.
//
// These belong to the emplacement itself (they are there without a shot being
// fired), unlike the muzzle flashes and beams in effects.js.
//
// The second half of the file (M9 D3) is the fire at the barrel of the turned weapons: it reads the
// muzzle point from the model (turrets.js) and draws flash, sparks, smoke, cases, tracer, beam, bolt,
// jet, psi pulse and the flight of the rockets from there, in the direction of the shot. The shapes and
// colours are those of reference/studien/stellungen-rework.js. The recipe emplacements keep the
// older drawing above until D4.

import { ell, poly } from './draw.js';
import { iso } from './iso.js';
import { cellLift, liftAt } from './terrain.js';
import { C } from './palette.js';
import { turnFrame, SOLID_K as K } from './model.js';
import { MUZZLE, MOUNT_Z, TURRET_SCALE, CASING_PORT } from './turrets.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import {
  FX_TIP_AHEAD,
  FX_FLASH_SECONDS,
  FX_BEAM_SECONDS,
  FX_BOLT_SECONDS,
  FX_PULSE_SECONDS,
  FX_PULSE_EVERY,
  FX_LASER_CHARGE_SECONDS,
  FX_JET_LENGTH,
  FX_JET_RATE,
  FX_HIT_Z,
  FX_TRACER_SPEED,
  FX_GRAVITY,
  FX_QUEUE,
  FX_ROCKET,
} from '../data/art.js';

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
    const [ax, ay] = view.core ?? view.anchor ?? pivot;
    const bob = view.core ? 0 : reducedMotion ? 0 : Math.sin(t * 2 + tower.x) * 2 * scale;
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
function drawEjectedCasings(ctx, { muzzle, casingPort, fire, shot, scale }) {
  // The turned autocannon throws its cases from the belly of the housing; the older tops from the muzzle.
  const from = casingPort ?? muzzle;
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
    const cx = from[0] + ux * out;
    const cy = from[1] + uy * out - rise + age * age * 16 * scale;
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
  const [tx, ty] = iso(tower.aim.x + 0.5, tower.aim.y + 0.5, 6 + cellLift(tower.aim.x, tower.aim.y) - cellLift(tower.x, tower.y));
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

// ======================================================================================
// M9 D3: fire at the barrel of the turned weapons
// ======================================================================================

const TAU = Math.PI * 2;
const INK = C.ink;
const HALF = 0.5;

/** Render-side fire state of each emplacement; forgotten with it, never saved or recorded. */
const states = new WeakMap();

/**
 * The fire state of an emplacement: timers of flash, beam, bolt, jet and pulses, the last launch of a
 * rocket, what the simulation said about the last shot, and the particles waiting to be taken over by
 * effects.js (`queue`).
 */
export function fxOf(tower) {
  let fx = states.get(tower);
  if (!fx) {
    fx = {
      queue: [],
      flash: 0,
      beam: 0,
      beamEnd: null,
      bolt: 0,
      boltPoints: null,
      boltSeed: 0,
      jet: 0,
      pulses: [],
      pulseCd: 0,
      pending: null,
      launch: null,
      frame: null,
    };
    states.set(tower, fx);
  }
  return fx;
}

/** What the simulation reported about the last shot (target, chain legs), for the next muzzle flash. */
export function noteTowerEvent(tower, event) {
  fxOf(tower).pending = event;
}

const rand = (a, b) => a + Math.random() * (b - a);
const norm2 = (d) => {
  const l = Math.sqrt(d[0] * d[0] + d[1] * d[1]) || 1;
  return [d[0] / l, d[1] / l];
};

function queue(fx, p) {
  if (fx.queue.length < FX_QUEUE) fx.queue.push(p);
}

function smokeSpec(fx, lift, x, y, z, vx, vy, vz, r0, r1, life, tone = 0) {
  queue(fx, { kind: 'wsmoke', x, y, z, vx, vy, vz, r0, r1, tone, life, floor: lift });
}

function sparkSpec(fx, lift, x, y, z, count, speed, life = 0.28) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, TAU);
    const s = rand(0.3, 1) * speed;
    queue(fx, {
      kind: 'wspark', x, y, z, vx: Math.cos(a) * s * 0.02, vy: Math.sin(a) * s * 0.02, vz: rand(0.1, 1) * speed,
      life: life * rand(0.6, 1.1), floor: lift,
    });
  }
}

/**
 * The muzzle of a weapon in the world: x, y in cells, z in px above level 0 and the direction of the
 * shot (x, y, and z in cells). The point follows the weapon as it is shown, the direction follows the
 * way it points. The fire leaves a little in front of the model's muzzle where something sticks out
 * (FX_TIP_AHEAD: the noses of the rockets, the tip of the tesla horn).
 * @param {{recoil?: number, tube?: number, bob?: number}} pose
 * @param {number} push  cells the stage has been shoved back along the barrel
 */
export function muzzleWorld(tower, shown, theta, pose, push = 0) {
  const doctrine = tower.doctrine;
  const lift = cellLift(tower.x, tower.y);
  const Fs = turnFrame(shown, MOUNT_Z, TURRET_SCALE);
  const Fa = turnFrame(theta, MOUNT_Z, TURRET_SCALE);
  const m = MUZZLE[doctrine]({ recoil: 0, tube: 0, bob: 0, ...pose });
  const ahead = FX_TIP_AHEAD[doctrine] ?? 0;
  const d = m.dir;
  const at = [m.at[0] + d[0] * ahead, m.at[1] + d[1] * ahead, m.at[2] + d[2] * ahead * K];
  const [px, py] = Fs.world(at[0], at[1]);
  return {
    x: tower.x + HALF + px - push * Math.cos(shown),
    y: tower.y + HALF + py - push * Math.sin(shown),
    z: lift + MOUNT_Z + at[2] * TURRET_SCALE,
    dir: Fa.wn(d[0], d[1], d[2]),
    lift,
  };
}

/** Screen point of a world point (x, y in cells, z in px above level 0). */
const P = (x, y, z) => iso(x, y, z);

/**
 * Advances the fire of one turned weapon by `dt` real seconds and works out where its muzzle is this
 * frame. Called from the drawing of the emplacement, after the direction has been settled.
 * @param {{dt: number, shot: boolean, tube: number, shown: number, theta: number, push: number,
 *   recoil: number, bob: number, t: number, reducedMotion: boolean}} o  `shot` is true on the frame the
 *   reload counter jumped back up; `tube` is the tube of the rocket launcher that fired last.
 */
export function updateTurretFx(tower, o) {
  const fx = fxOf(tower);
  const { dt, shown, theta, t, reducedMotion } = o;
  const doctrine = tower.doctrine;
  const mw = muzzleWorld(tower, shown, theta, { recoil: o.recoil, tube: o.tube, bob: o.bob }, o.push);
  const lift = mw.lift;
  fx.frame = { ...mw, t, reducedMotion, bob: o.bob, front: mw.dir[0] + mw.dir[1] >= 0 };

  fx.flash = Math.max(0, fx.flash - dt);
  fx.beam = Math.max(0, fx.beam - dt);
  fx.bolt = Math.max(0, fx.bolt - dt);

  const aim = tower.aim ? [tower.aim.x, tower.aim.y] : [mw.x + mw.dir[0] * 3, mw.y + mw.dir[1] * 3];
  const dir = norm2(mw.dir);
  if (o.shot) {
    const event = fx.pending;
    fx.pending = null;
    if (doctrine === 'autocannon') {
      fx.flash = FX_FLASH_SECONDS.autocannon;
      // A case leaves the port on the side of the housing and falls.
      const Fs = turnFrame(shown, MOUNT_Z, TURRET_SCALE);
      const [cx, cy] = Fs.world(CASING_PORT[0], CASING_PORT[1]);
      queue(fx, {
        kind: 'wcasing', x: tower.x + HALF + cx, y: tower.y + HALF + cy, z: lift + MOUNT_Z + CASING_PORT[2] * TURRET_SCALE,
        vx: Fs.s[0] * rand(0.9, 1.5), vy: Fs.s[1] * rand(0.9, 1.5), vz: rand(90, 170), rot: rand(0, TAU), vrot: rand(-18, 18),
        life: 1.1, floor: lift,
      });
      if (Math.random() < (reducedMotion ? 0.2 : 0.35)) smokeSpec(fx, lift, mw.x, mw.y, mw.z, dir[0] * 0.4, dir[1] * 0.4, 16, 2.5, 7, 0.55);
      // The tracer flies from the muzzle to the target.
      const d = Math.sqrt((aim[0] - mw.x) ** 2 + (aim[1] - mw.y) ** 2);
      queue(fx, {
        kind: 'wtracer', x0: mw.x, y0: mw.y, z0: mw.z, x1: aim[0], y1: aim[1], z1: liftAt(aim[0], aim[1]) + FX_HIT_Z,
        life: Math.max(0.05, d / FX_TRACER_SPEED), floor: lift,
      });
    } else if (doctrine === 'laser') {
      fx.beam = FX_BEAM_SECONDS;
      fx.beamEnd = event && event.type === 'beam' ? [event.tx, event.ty] : [mw.x + dir[0] * 4.5, mw.y + dir[1] * 4.5];
      if (!reducedMotion) sparkSpec(fx, lift, aim[0], aim[1], liftAt(aim[0], aim[1]) + FX_HIT_Z, 4, 150, 0.25);
    } else if (doctrine === 'tesla') {
      fx.flash = FX_FLASH_SECONDS.tesla;
      fx.bolt = FX_BOLT_SECONDS;
      fx.boltSeed = Math.floor(t * 28);
      const legs = event && event.type === 'chain' ? event.points.slice(1).map((p) => [p.x, p.y]) : [];
      fx.boltPoints = legs.length ? legs : [aim];
      const [hx, hy] = fx.boltPoints[0];
      if (!reducedMotion) sparkSpec(fx, lift, hx, hy, liftAt(hx, hy) + FX_HIT_Z, 6, 180, 0.3);
    } else if (doctrine === 'mortar') {
      fx.flash = FX_FLASH_SECONDS.mortar;
      fx.launch = { x: mw.x, y: mw.y, z: mw.z, dir: mw.dir, lift };
      // The back blast leaves behind the pod, against the line of the tube.
      const back = [-mw.dir[0], -mw.dir[1], -mw.dir[2]];
      const n = reducedMotion ? 2 : 5;
      for (let i = 0; i < n; i++) {
        const r = 0.46 * TURRET_SCALE + i * 0.04;
        smokeSpec(
          fx, lift, mw.x + back[0] * r, mw.y + back[1] * r, mw.z + back[2] * 0.46 * TURRET_SCALE * K,
          back[0] * 0.45 + rand(-0.12, 0.12), back[1] * 0.45 + rand(-0.12, 0.12), rand(-5, 25), 3, 12, rand(0.7, 1.1), 0.5,
        );
      }
      if (!reducedMotion) sparkSpec(fx, lift, mw.x, mw.y, mw.z, 4, 140, 0.25);
    }
  }
  // The bolt flickers from frame to frame; with reduced motion it keeps the shape it was born with.
  if (!reducedMotion && fx.bolt > 0) fx.boltSeed = Math.floor(t * 28);

  if (doctrine === 'flame') {
    fx.jet += ((tower.firing ? 1 : 0) - fx.jet) * Math.min(1, dt * FX_JET_RATE);
    if (fx.jet > 0.5 && !reducedMotion && dt > 0 && Math.random() < dt * 22) {
      const d = jetLength(tower, mw) * fx.jet;
      smokeSpec(fx, lift, mw.x + dir[0] * d, mw.y + dir[1] * d, mw.z + 12, dir[0] * 0.3, dir[1] * 0.3, 40, 6, 16, 1.1, 2);
    }
  } else if (doctrine === 'psi') {
    if (tower.firing) {
      fx.pulseCd -= dt;
      if (fx.pulseCd <= 0) {
        fx.pulseCd += FX_PULSE_EVERY;
        fx.pulses.push({ age: 0 });
      }
    } else {
      fx.pulseCd = 0;
    }
    for (const pulse of fx.pulses) pulse.age += dt;
    if (fx.pulses.length && fx.pulses[0].age >= FX_PULSE_SECONDS) fx.pulses = fx.pulses.filter((pulse) => pulse.age < FX_PULSE_SECONDS);
  }
  return fx;
}

/** Reach of the jet in cells: the study's length, shortened when the target is closer. */
function jetLength(tower, mw) {
  if (!tower.aim) return FX_JET_LENGTH;
  const d = Math.sqrt((tower.aim.x - mw.x) ** 2 + (tower.aim.y - mw.y) ** 2);
  return Math.min(FX_JET_LENGTH, d + 0.25);
}

/** The particles the muzzles have queued since the last call (effects.js takes them over). */
export function drainFxQueue(tower) {
  const fx = states.get(tower);
  if (!fx || !fx.queue.length) return null;
  const out = fx.queue;
  fx.queue = [];
  return out;
}

// ---------- the pieces of drawing ----------

/** A flat kite of light from the muzzle along `dir`: one of the cross fans of a muzzle flash. */
function kite(ctx, m, dir, side, len, wid, fill) {
  const at = (a, b) => P(m.x + dir[0] * a + side[0] * b, m.y + dir[1] * a + side[1] * b, m.z + (dir[2] * a + side[2] * b) * K);
  poly(ctx, [at(-0.01, 0), at(len * 0.32, wid), at(len, 0), at(len * 0.32, -wid)], fill, INK, 1.3);
}

function fanBasis(dir) {
  const h = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1]) || 1;
  const s1 = [-dir[1] / h, dir[0] / h, 0];
  const s2 = [dir[1] * s1[2] - dir[2] * s1[1], dir[2] * s1[0] - dir[0] * s1[2], dir[0] * s1[1] - dir[1] * s1[0]];
  return [s1, s2];
}

/** The cross of two kites a muzzle flash is made of: an outer one and a smaller, brighter inner one. */
function flare(ctx, m, dir, len, wid, outer, inner) {
  const [s1, s2] = fanBasis(dir);
  for (const s of [s1, s2]) kite(ctx, m, dir, s, len, wid, outer);
  for (const s of [s1, s2]) kite(ctx, m, dir, s, len * 0.62, wid * 0.55, inner);
}

/** A jagged line with ink outline and two glows, for the lightning of the coil. */
function bolt(ctx, a, b, seed, jitter, colour, width) {
  const steps = 7;
  const pts = [a];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i < steps; i++) {
    const u = i / steps;
    const r = Math.sin((seed + 1) * 12.9898 + i * 78.233) * 43758.5453;
    const off = (r - Math.floor(r) - 0.5) * jitter;
    pts.push([a[0] + dx * u + nx * off, a[1] + dy * u + ny * off]);
  }
  pts.push(b);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const [w, col] of [[width + 3.6, INK], [width, colour], [width * 0.4, '#ffffff']]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  }
}

/** The flame jet: blobs from the nozzle along the aim, white hot at the nozzle, dark at the tip. */
function drawJet(ctx, fx, tower) {
  if (fx.jet < 0.05) return;
  const f = fx.frame;
  const dh = norm2(f.dir);
  const len = jetLength(tower, f) * fx.jet;
  const n = 13;
  const origin = P(f.x, f.y, f.z);
  const tipPoint = P(f.x + dh[0] * len, f.y + dh[1] * len, f.z + 10);
  const ang = Math.atan2(tipPoint[1] - origin[1], tipPoint[0] - origin[0]);
  const colours = ['#fff3c4', '#ffe38a', '#ffd23f', '#ffb02e', '#ff8a2a', '#e5601f', '#b8431a'];
  for (let i = n - 1; i >= 0; i--) {
    const u = i / (n - 1);
    const wob = f.reducedMotion ? 0 : Math.sin(f.t * 24 + i * 1.7 + tower.x);
    const dist = u * len;
    const p = P(f.x + dh[0] * dist, f.y + dh[1] * dist, f.z + u * u * 14 + wob * 1.6);
    const r = (3 + u * 15) * (0.88 + wob * 0.1);
    const col = colours[Math.min(colours.length - 1, Math.floor(u * colours.length))];
    ctx.save();
    ctx.translate(p[0], p[1] + wob * 1.2);
    ctx.rotate(ang);
    ell(ctx, 0, 0, r * 1.25, r * 0.85, col, INK, 1.3);
    ctx.restore();
  }
  // The white core shows at the nozzle only.
  ell(ctx, origin[0], origin[1], 3.4, 2.8, '#ffffff', null);
}

/** The laser beam: from the lens along the aim, with a glow where it strikes. */
function drawBeam(ctx, fx, tower) {
  const f = fx.frame;
  const u = fx.beam / FX_BEAM_SECONDS;
  const a = P(f.x, f.y, f.z);
  const end = fx.beamEnd;
  const b = P(end[0], end[1], liftAt(end[0], end[1]) + FX_HIT_Z);
  const accent = DOCTRINE_COLORS.laser;
  ctx.lineCap = 'round';
  for (const [w, col] of [[10 * u + 2, INK], [6.5 * u + 1, accent], [2.6 * u + 0.5, '#fff1e4']]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  if (tower.aim) {
    const t = P(tower.aim.x, tower.aim.y, liftAt(tower.aim.x, tower.aim.y) + FX_HIT_Z);
    glow(ctx, t[0], t[1], 22, accent, 0.6 * u);
  }
}

/** The tesla bolt: a jagged line from the tip to the target, a fork, and on to each further target. */
function drawBolt(ctx, fx) {
  const f = fx.frame;
  const u = fx.bolt / FX_BOLT_SECONDS;
  const mp = P(f.x, f.y, f.z);
  const colour = '#bff2ff';
  let from = mp;
  fx.boltPoints.forEach(([x, y], i) => {
    const to = P(x, y, liftAt(x, y) + FX_HIT_Z);
    if (i === 0) {
      bolt(ctx, from, to, fx.boltSeed, 24 * (0.5 + u * 0.5), colour, 2.6 * (0.6 + u * 0.4));
      // A fork a little before the target.
      const fork = [mp[0] + (to[0] - mp[0]) * 0.55, mp[1] + (to[1] - mp[1]) * 0.55];
      bolt(ctx, fork, [fork[0] + 16, fork[1] - 12], fx.boltSeed + 3, 8, colour, 1.6);
    } else {
      bolt(ctx, from, to, fx.boltSeed + i * 5, 14 * (0.5 + u * 0.5), colour, 1.9 * (0.6 + u * 0.4));
    }
    glow(ctx, to[0], to[1], 20, '#5fd4ff', 0.6 * u);
    from = to;
  });
}

/** The psi pulses: rings that run out of the lens along the way the weapon points. */
function drawPulses(ctx, fx) {
  const f = fx.frame;
  const dh = norm2(f.dir);
  const s1 = [-dh[1], dh[0]];
  for (const pulse of fx.pulses) {
    const u = pulse.age / FX_PULSE_SECONDS;
    const dist = 0.1 + u * 2.4;
    const r = 0.18 + u * 0.7;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * TAU;
      const p = P(f.x + dh[0] * dist + s1[0] * Math.cos(a) * r, f.y + dh[1] * dist + s1[1] * Math.cos(a) * r, f.z + Math.sin(a) * r * K);
      if (i) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    }
    ctx.globalAlpha = Math.max(0, 1 - u) * 0.95;
    for (const [w, col] of [[4.4, INK], [2.2, '#d5b6ff']]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** Charge of the laser lens, 0 to 1: it fills over the last part of the reload while there is a target. */
function laserCharge(tower) {
  if (!tower.aim || tower.cooldown <= 0 || tower.cooldown >= FX_LASER_CHARGE_SECONDS) return 0;
  return 1 - tower.cooldown / FX_LASER_CHARGE_SECONDS;
}

/** True when this weapon has fire that reaches out of the muzzle this frame. */
function hasReach(fx, doctrine) {
  if (doctrine === 'flame') return fx.jet >= 0.05;
  if (doctrine === 'laser') return fx.beam > 0 && Boolean(fx.beamEnd);
  if (doctrine === 'tesla') return fx.bolt > 0 && Boolean(fx.boltPoints);
  if (doctrine === 'psi') return fx.pulses.length > 0;
  return false;
}

/**
 * Where an effect is drawn in an emplacement's frame. A fire in the muzzle or round it (flash, glow,
 * lens, pilot light) always goes over the weapon. Fire that reaches out (jet, beam, bolt, pulses) goes
 * behind the weapon when it runs away from the camera, and over everything (drawTowerReach, from
 * effects.js) when it runs towards it.
 *
 * The context is the one of the emplacement's own drawing, shifted down by the height of its field; the
 * drawing here is in absolute world pixels, so the shift is taken back for the duration.
 * @param {'behind'|'front'} phase  'behind': before the weapon is drawn, 'front': after it
 */
export function drawTurretFx(ctx, tower, phase) {
  const fx = states.get(tower);
  const f = fx?.frame;
  if (!f) return;
  ctx.save();
  ctx.translate(0, f.lift);
  if (phase === 'behind') {
    if (!f.front && hasReach(fx, tower.doctrine)) drawReach(ctx, fx, tower);
  } else {
    drawAtMuzzle(ctx, fx, tower);
  }
  ctx.restore();
}

/** The reaching fire of the emplacements that point towards the camera, over everything (absolute pixels). */
export function drawTowerReach(ctx, tower, t) {
  const fx = states.get(tower);
  const f = fx?.frame;
  if (!f || f.t !== t || !f.front || !hasReach(fx, tower.doctrine)) return;
  drawReach(ctx, fx, tower);
}

function drawReach(ctx, fx, tower) {
  const doctrine = tower.doctrine;
  if (doctrine === 'flame') drawJet(ctx, fx, tower);
  else if (doctrine === 'laser') drawBeam(ctx, fx, tower);
  else if (doctrine === 'tesla') drawBolt(ctx, fx);
  else if (doctrine === 'psi') drawPulses(ctx, fx);
}

/** The lights at the muzzle: flashes, glows, the lens, the pilot light, the idle arcs. */
function drawAtMuzzle(ctx, fx, tower) {
  const f = fx.frame;
  const doctrine = tower.doctrine;
  const mp = P(f.x, f.y, f.z);
  const damp = f.reducedMotion ? 0.5 : 1;
  const shrink = f.reducedMotion ? 0.7 : 1;
  const accent = DOCTRINE_COLORS[doctrine] ?? C.gold;
  if (doctrine === 'autocannon' && fx.flash > 0) {
    const u = fx.flash / FX_FLASH_SECONDS.autocannon;
    glow(ctx, mp[0], mp[1], 16, '#ffd23f', 0.5 * u * damp);
    flare(ctx, f, f.dir, 0.42 * (0.6 + 0.4 * u) * shrink, 0.1, '#ffd23f', '#fff3b0');
  } else if (doctrine === 'flame') {
    if (fx.jet < 0.1) {
      const flicker = f.reducedMotion ? 1 : 0.8 + Math.sin(f.t * 20) * 0.2;
      ell(ctx, mp[0], mp[1], 2.6 * flicker, 3.4 * flicker, '#6fb7ff', INK, 1);
    } else {
      glow(ctx, mp[0], mp[1], 14, '#ff8a2a', 0.5 * fx.jet);
    }
  } else if (doctrine === 'mortar' && fx.flash > 0) {
    const u = fx.flash / FX_FLASH_SECONDS.mortar;
    glow(ctx, mp[0], mp[1], 20, '#ffd23f', 0.5 * u * damp);
    flare(ctx, f, f.dir, 0.42 * (0.6 + 0.4 * u) * shrink, 0.11, '#ff8a2a', '#ffe38a');
    // Back blast behind the pod.
    const back = 0.45 * TURRET_SCALE;
    const rear = { x: f.x - f.dir[0] * back, y: f.y - f.dir[1] * back, z: f.z - f.dir[2] * back * K };
    flare(ctx, rear, [-f.dir[0], -f.dir[1], -f.dir[2]], 0.42 * u * shrink, 0.12, '#d89a56', '#fff0c0');
  } else if (doctrine === 'laser') {
    const charge = laserCharge(tower);
    const idle = f.reducedMotion ? 0.3 : 0.25 + 0.1 * Math.sin(f.t * 6);
    glow(ctx, mp[0], mp[1], 10 + charge * 22, accent, charge > 0 ? 0.35 + charge * 0.5 : idle);
    if (charge > 0) {
      ell(ctx, mp[0], mp[1], 2 + charge * 3.2, 2 + charge * 3.2, '#fff1e4', INK, 1);
      // Sparks converge on the lens while it charges.
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + (f.reducedMotion ? 0 : f.t * 9);
        const r = (1 - charge) * 15 + 3;
        ell(ctx, mp[0] + Math.cos(a) * r, mp[1] + Math.sin(a) * r * 0.7, 1.1, 1.1, '#ffd0c0', null);
      }
    }
  } else if (doctrine === 'tesla') {
    const bolting = fx.bolt > 0;
    glow(ctx, mp[0], mp[1], bolting ? 20 : 12, '#5fd4ff', bolting ? 0.7 * damp : 0.3 + (f.reducedMotion ? 0 : 0.1 * Math.sin(f.t * 9)));
    if (!bolting && !f.reducedMotion) {
      // Idle: a small arc now and then from the tip.
      const k = Math.floor(f.t * 7);
      const r = Math.sin(k * 91.7) * 1000;
      if (r - Math.floor(r) < 0.6) {
        const a = (Math.sin(k * 12.3) * 1000) % TAU;
        bolt(ctx, mp, [mp[0] + Math.cos(a) * 12, mp[1] + Math.sin(a) * 9 - 3], k, 5, '#bff2ff', 1.4);
      }
    }
  } else if (doctrine === 'psi') {
    const [ax, ay] = P(tower.x + HALF, tower.y + HALF, f.lift + MOUNT_Z + 28 * TURRET_SCALE + (f.bob ?? 0));
    glow(ctx, ax, ay, 30, '#b784ff', tower.firing ? 0.32 : 0.2);
  }
}

// ---------- particles in the world ----------
// Cases, sparks, smoke and tracers live in the particle list of effects.js (so the ceilings there
// hold), in world coordinates: x, y in cells, z in px above level 0.

/** Kinds that effects.js hands over to `stepWorldParticle` and `drawWorldParticle`. */
export const WORLD_KINDS = new Set(['wsmoke', 'wspark', 'wcasing', 'wtracer']);

/** Moves a particle in the world by `dt` seconds. */
export function stepWorldParticle(p, dt) {
  if (p.kind === 'wcasing' || p.kind === 'wspark') {
    p.vz -= FX_GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    const floor = liftAt(p.x, p.y);
    if (p.z < floor) {
      p.z = floor;
      p.vz = p.kind === 'wcasing' && Math.abs(p.vz) > 60 ? -p.vz * 0.3 : 0;
      p.vx *= 0.4;
      p.vy *= 0.4;
    }
  } else if (p.kind === 'wsmoke') {
    const f = Math.exp(-1.83 * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vx *= f;
    p.vy *= f;
    p.vz *= f;
  }
}

/** Draws a particle of the world; `u` is how far through its life it is, 0 to 1. */
export function drawWorldParticle(ctx, p, u) {
  if (p.kind === 'wsmoke') {
    const [x, y] = P(p.x, p.y, p.z);
    const r = p.r0 + (p.r1 - p.r0) * Math.sqrt(u);
    const base = p.tone >= 2 ? 40 : p.tone >= 1 ? 74 : 118;
    ctx.globalAlpha = Math.max(0, 0.62 * (1 - u));
    ell(ctx, x, y, r, r * 0.86, `rgb(${base + 22},${base + 16},${base + 10})`, null);
    ctx.globalAlpha = 1;
  } else if (p.kind === 'wspark') {
    const a = P(p.x, p.y, p.z);
    const b = P(p.x - p.vx * 0.03, p.y - p.vy * 0.03, p.z - p.vz * 0.03);
    ctx.globalAlpha = 1 - u * 0.7;
    ctx.strokeStyle = '#ffe38a';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (p.kind === 'wcasing') {
    const [x, y] = P(p.x, p.y, p.z);
    ctx.globalAlpha = u > 0.8 ? (1 - u) / 0.2 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.rot + p.vrot * u * p.max);
    ctx.fillStyle = '#e8c872';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.rect(-1.7, -1, 3.4, 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  } else if (p.kind === 'wtracer') {
    const at = (k) => P(p.x0 + (p.x1 - p.x0) * k, p.y0 + (p.y1 - p.y0) * k, p.z0 + (p.z1 - p.z0) * k);
    const a = at(u);
    const b = at(Math.max(0, u - 0.28));
    ctx.lineCap = 'round';
    for (const [w, col] of [[4, INK], [2.2, '#ffd23f'], [1, '#fff3b0']]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  }
}

// ---------- the rockets in flight ----------

/** Which launch (muzzle, direction) a shell of the simulation was fired from; lives as long as the shell. */
const flights = new WeakMap();

/**
 * The launch record of a shell: where the rocket left the pod and in which direction, taken from the
 * emplacement's last shot. Null while the drawing has not seen that shot yet.
 * @param {boolean} claim  true in the drawing, which sees the shot leave before anyone else: only it may
 *   tie a shell to the launch (once, so an older launch is never taken for a newer shell).
 */
export function launchOf(shell, tower, claim = true) {
  let rec = flights.get(shell);
  if (!rec && claim) {
    const fx = states.get(tower);
    if (!fx?.launch || fx.launch.claimed) return null;
    fx.launch.claimed = true;
    rec = { launch: fx.launch, trail: 0 };
    flights.set(shell, rec);
  }
  return rec ?? null;
}

/**
 * Position of a rocket: [x, y, z] along its arc. The flight time and the end point are those of the
 * shell of the simulation (`shell.t` of `shell.flight`, ending at `shell.to`); only the bend of the arc
 * is the drawing's: a curve that leaves along the barrel and falls on the target.
 */
export function rocketPosition(launch, shell, u = Math.min(1, shell.t / shell.flight)) {
  const P0 = [launch.x, launch.y, launch.z];
  const P2 = [shell.to.x, shell.to.y, liftAt(shell.to.x, shell.to.y) + FX_ROCKET.endZ];
  const d = Math.sqrt((P2[0] - P0[0]) ** 2 + (P2[1] - P0[1]) ** 2);
  const reach = d * FX_ROCKET.reach;
  const P1 = [P0[0] + launch.dir[0] * reach, P0[1] + launch.dir[1] * reach, P0[2] + launch.dir[2] * reach * K + FX_ROCKET.lift];
  const a = (1 - u) * (1 - u);
  const b = 2 * (1 - u) * u;
  const c = u * u;
  return [0, 1, 2].map((i) => a * P0[i] + b * P1[i] + c * P2[i]);
}

/**
 * The smoke the rocket leaves behind it this frame: one puff for every FX_ROCKET.trail seconds of
 * flight, at most a few if a frame was long. Returns the specs for effects.js.
 */
export function rocketTrail(rec, shell, dt) {
  const out = [];
  rec.trail -= dt;
  let guard = 3;
  while (rec.trail <= 0 && guard-- > 0) {
    rec.trail += FX_ROCKET.trail;
    const [x, y, z] = rocketPosition(rec.launch, shell);
    out.push({ kind: 'wsmoke', x, y, z, vx: 0, vy: 0, vz: 8, r0: 3, r1: 9, tone: 0, life: 0.8, floor: rec.launch.lift });
  }
  if (rec.trail < 0) rec.trail = 0;
  return out;
}

/** A rocket in flight: exhaust flame, body, warhead in the colour of the mortar doctrine. */
export function drawRocket(ctx, rec, shell) {
  const u = Math.min(1, shell.t / shell.flight);
  const pos = rocketPosition(rec.launch, shell, u);
  const before = rocketPosition(rec.launch, shell, Math.max(0, u - 0.04 / shell.flight));
  const a = P(pos[0], pos[1], pos[2]);
  const b = P(before[0], before[1], before[2]);
  const l = Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) || 1;
  const ux = (a[0] - b[0]) / l;
  const uy = (a[1] - b[1]) / l;
  const tail = [a[0] - ux * FX_ROCKET.tail, a[1] - uy * FX_ROCKET.tail];
  ell(ctx, tail[0] - ux * 3, tail[1] - uy * 3, 4.5, 3, '#ffb02e', INK, 1.1);
  ell(ctx, tail[0] - ux * 1.5, tail[1] - uy * 1.5, 2.4, 1.8, '#fff3c4', null);
  ctx.lineCap = 'round';
  for (const [w, col] of [[6.4, INK], [3.6, '#a6adb8']]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(tail[0], tail[1]);
    ctx.lineTo(a[0] - ux * 2, a[1] - uy * 2);
    ctx.stroke();
  }
  ell(ctx, a[0], a[1], 2.8, 2.8, DOCTRINE_COLORS.mortar, INK, 1.3);
}
