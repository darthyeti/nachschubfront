// The fire of the emplacements, drawn in code at the muzzle of their weapon (M9 D3 for the standard
// weapons, D4 for the recipe emplacements): it reads the muzzle point from the model (weapons.js) and
// draws flash, sparks, smoke, cases, tracer, beam, bolt, jet, pulse, scope line and the flight of the
// rockets and the shell from there, in the direction of the shot. The shapes and colours are those of
// reference/studien/stellungen-rework.js and spezialstellungen-rework.js.
//
// These belong to the emplacement itself (they are there without a shot being fired), unlike the
// explosions and impacts in effects.js, which the simulation reports.

import { ell, poly } from './draw.js';
import { iso } from './iso.js';
import { cellLift, liftAt } from './terrain.js';
import { C } from './palette.js';
import { turnFrame, SOLID_K as K } from './model.js';
import { weaponOf } from './weapons.js';
import { siegeSight } from './specials.js';
import {
  glow,
  lightSpec,
  drawFireball,
  ballRadius,
  drawTeslaArc,
  drawEmberThreads,
  drawSkyStrike,
  drawThunderHop,
} from './weaponFx.js';
import { CASING_PORT } from './turrets.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import {
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
  FX_SPECIAL_BOLT_SECONDS,
  FX_OBELISK_BEAM_SECONDS,
  FX_OBELISK_CHARGE_SECONDS,
  FX_SIGHT_SECONDS,
  FX_STORM_TRACER_SPEED,
  FX_SHELL,
  FX_AURA_IDLE,
  FX_AURA_RATE,
  FX_MAX_PARTICLES,
  FX_LIGHT,
  FX_BALLS,
  FX_BURN,
  FX_THUNDER,
  SPECIAL_CASING_PORT,
  SPECIAL_FIRE,
} from '../data/art.js';

// ======================================================================================
// Fire at the barrel of the turned weapons
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
      // The flash of each of the four barrels of the storm battery.
      flashK: [0, 0, 0, 0],
      beam: 0,
      beamEnd: null,
      bolt: 0,
      boltPoints: null,
      boltSeed: 0,
      jet: 0,
      pulses: [],
      pulseCd: 0,
      pending: null,
      // Seconds since the last shot of a bolt (the doctrines of lightning draw by age), the fireballs of the
      // flame in flight, and the accumulators of their emission and of the afterburn.
      boltAge: 0,
      balls: [],
      ballAcc: 0,
      burnAcc: 0,
      // What the emplacement asks of the ground layer of effects.js (lights, pressure rings, burning patches,
      // a brightening of the picture); effects.js takes it over each frame, like the queue of particles.
      extra: { lights: [], rings: [], patches: [], brighten: 0 },
      // Everything the simulation said since the last shot (a volley reports one shot per target).
      events: [],
      launch: null,
      frame: null,
      // 1 while the eye of the obelisk charges or fires, level of the gold aura of the shrine, and how far
      // the scope of the siege mortar has the target in its line (0 to 1).
      glow: 0,
      aura: FX_AURA_IDLE,
      sight: 0,
      charge: 0,
    };
    states.set(tower, fx);
  }
  return fx;
}

/** What the simulation reported about the last shot (target, chain legs), for the next muzzle flash. */
export function noteTowerEvent(tower, event) {
  const fx = fxOf(tower);
  fx.pending = event;
  if (fx.events.length < 8) fx.events.push(event);
}

const rand = (a, b) => a + Math.random() * (b - a);
const norm2 = (d) => {
  const l = Math.sqrt(d[0] * d[0] + d[1] * d[1]) || 1;
  return [d[0] / l, d[1] / l];
};

function queue(fx, p) {
  if (fx.queue.length < FX_QUEUE) fx.queue.push(p);
}

/** Most lights, rings and patches one emplacement hands over per frame. */
const EXTRA_MAX = 8;

/** Asks the ground layer for a light of the kind of this emplacement at (x, y); `key` keeps it one light. */
function kickLight(fx, kind, x, y, which = null, key = null, k = 1) {
  const spec = lightSpec(kind, which);
  if (!spec || fx.extra.lights.length >= EXTRA_MAX) return;
  fx.extra.lights.push({ x, y, r: spec.r, colour: spec.colour, a: spec.a * k, fade: spec.fade, key });
}

/** The volley's targets that get a light of their own: the first few. */
const hitLights = (points) => points.slice(0, FX_LIGHT.hitsPerShot);

/**
 * Room for fireballs, in the ceiling the muzzles share (FX_MAX_PARTICLES): what is left after the
 * particles of the muzzles and the balls alive. effects.js sets it every frame.
 */
let ballRoom = FX_MAX_PARTICLES;
export function setBallRoom(n) {
  ballRoom = n;
}

/** Fireballs alive over the given emplacements, for the shared ceiling. */
export function ballsAlive(towers) {
  let n = 0;
  for (const tower of towers) n += states.get(tower)?.balls.length ?? 0;
  return n;
}

/** What the emplacements asked of the ground layer since the last call, or null when nothing. */
export function drainFxExtra(tower) {
  const fx = states.get(tower);
  const e = fx?.extra;
  if (!e || (!e.lights.length && !e.rings.length && !e.patches.length && !e.brighten)) return null;
  fx.extra = { lights: [], rings: [], patches: [], brighten: 0 };
  return e;
}

function smokeSpec(fx, lift, x, y, z, vx, vy, vz, r0, r1, life, tone = 0) {
  queue(fx, { kind: 'wsmoke', x, y, z, vx, vy, vz, r0, r1, tone, life, floor: lift });
}

function sparkSpec(fx, lift, x, y, z, count, speed, life = 0.28, colour = null) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, TAU);
    const s = rand(0.3, 1) * speed;
    queue(fx, {
      kind: 'wspark', x, y, z, vx: Math.cos(a) * s * 0.02, vy: Math.sin(a) * s * 0.02, vz: rand(0.1, 1) * speed,
      life: life * rand(0.6, 1.1), floor: lift, colour,
    });
  }
}

/**
 * The muzzle of a weapon in the world: x, y in cells, z in px above level 0 and the direction of the
 * shot (x, y, and z in cells). The point follows the weapon as it is shown, the direction follows the
 * way it points. The fire leaves a little in front of the model's muzzle where something sticks out
 * (FX_TIP_AHEAD: the noses of the rockets, the tip of the tesla horn).
 * @param {{recoil?: number, tube?: number, bob?: number, bar?: number[]}} pose
 * @param {number} push  cells the stage has been shoved back along the barrel
 */
export function muzzleWorld(tower, shown, theta, pose, push = 0) {
  const model = weaponOf(tower);
  const lift = cellLift(tower.x, tower.y);
  const Fs = turnFrame(shown, model.mount, model.scale);
  const Fa = turnFrame(theta, model.mount, model.scale);
  const m = model.muzzle({ recoil: 0, tube: 0, bob: 0, bar: [0, 0, 0, 0], ...pose });
  const ahead = model.ahead;
  const d = m.dir;
  const at = [m.at[0] + d[0] * ahead, m.at[1] + d[1] * ahead, m.at[2] + d[2] * ahead * K];
  const [px, py] = Fs.world(at[0], at[1]);
  return {
    x: tower.x + HALF + px - push * Math.cos(shown),
    y: tower.y + HALF + py - push * Math.sin(shown),
    z: lift + model.mount + at[2] * model.scale,
    dir: Fa.wn(d[0], d[1], d[2]),
    lift,
  };
}

/** A local point of the weapon in the world: x, y in cells, z in px above level 0. */
function localWorld(tower, fx, lx, ly, z) {
  const model = weaponOf(tower);
  const f = fx.frame;
  const [px, py] = turnFrame(f.shown, model.mount, model.scale).world(lx, ly);
  return [tower.x + HALF + px, tower.y + HALF + py, f.lift + model.mount + z * model.scale];
}

/** Screen point of a world point (x, y in cells, z in px above level 0). */
const P = (x, y, z) => iso(x, y, z);

/**
 * Advances the fire of one turned weapon by `dt` real seconds and works out where its muzzle is this
 * frame. Called from the drawing of the emplacement, after the direction has been settled.
 * @param {{dt: number, shot: boolean, tube: number, shown: number, theta: number, push: number,
 *   recoil: number, bar: number[], bob: number, t: number, reducedMotion: boolean}} o  `shot` is true on
 *   the frame the reload counter jumped back up; `tube` is the tube of the rocket launcher or the barrel of
 *   the storm battery that fired last, `bar` the recoil of each of its barrels.
 */
export function updateTurretFx(tower, o) {
  const fx = fxOf(tower);
  const { dt, shown, theta, t, reducedMotion } = o;
  const model = weaponOf(tower);
  const doctrine = model.kind;
  const pose = { recoil: o.recoil, tube: o.tube, bob: o.bob, bar: o.bar };
  const mw = muzzleWorld(tower, shown, theta, pose, o.push);
  const lift = mw.lift;
  // What leaves from the top of a floating part (ball, eye, artefact) is above everything: it is "in front".
  const aboveAll = doctrine === 'thunderTower' || doctrine === 'soulfireObelisk' || doctrine === 'purgeShrine';
  fx.frame = {
    ...mw, t, reducedMotion, bob: o.bob, shown, theta, push: o.push, pose, scale: model.scale,
    front: aboveAll || mw.dir[0] + mw.dir[1] >= 0,
  };

  fx.flash = Math.max(0, fx.flash - dt);
  for (let k = 0; k < fx.flashK.length; k++) fx.flashK[k] = Math.max(0, fx.flashK[k] - dt);
  fx.beam = Math.max(0, fx.beam - dt);
  fx.bolt = Math.max(0, fx.bolt - dt);
  fx.boltAge += dt;

  const aim = tower.aim ? [tower.aim.x, tower.aim.y] : [mw.x + mw.dir[0] * 3, mw.y + mw.dir[1] * 3];
  const dir = norm2(mw.dir);
  // What the eye of the obelisk and the scope of the siege mortar do over the end of the reload: it fills
  // while there is a target, the way the lens of the laser does.
  fx.charge = doctrine === 'soulfireObelisk' ? chargeOf(tower, FX_OBELISK_CHARGE_SECONDS) : 0;
  fx.sight = doctrine === 'siegeMortar' ? chargeOf(tower, FX_SIGHT_SECONDS) : 0;
  if (o.shot) {
    const event = fx.pending;
    const events = fx.events;
    fx.pending = null;
    fx.events = [];
    if (doctrine === 'autocannon') {
      fx.flash = FX_FLASH_SECONDS.autocannon;
      // A case leaves the port on the side of the housing and falls.
      const Fs = turnFrame(shown, model.mount, model.scale);
      const [cx, cy] = Fs.world(CASING_PORT[0], CASING_PORT[1]);
      queue(fx, {
        kind: 'wcasing', x: tower.x + HALF + cx, y: tower.y + HALF + cy, z: lift + model.mount + CASING_PORT[2] * model.scale,
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
      fx.boltAge = 0;
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
        const r = 0.46 * model.scale + i * 0.04;
        smokeSpec(
          fx, lift, mw.x + back[0] * r, mw.y + back[1] * r, mw.z + back[2] * 0.46 * model.scale * K,
          back[0] * 0.45 + rand(-0.12, 0.12), back[1] * 0.45 + rand(-0.12, 0.12), rand(-5, 25), 3, 12, rand(0.7, 1.1), 0.5,
        );
      }
      if (!reducedMotion) sparkSpec(fx, lift, mw.x, mw.y, mw.z, 4, 140, 0.25);
    } else if (doctrine === 'stormBattery') {
      shootStorm(tower, fx, o, mw, events, aim);
    } else if (doctrine === 'emberCauldron') {
      fx.flash = FX_FLASH_SECONDS.emberCauldron;
      fx.bolt = FX_SPECIAL_BOLT_SECONDS.emberCauldron;
      fx.boltAge = 0;
      fx.boltSeed = Math.floor(t * 30);
      // One bolt to each target the volley hit.
      const legs = events.filter((e) => e.type === 'shot').map((e) => [e.tx, e.ty]);
      fx.boltPoints = legs.length ? legs : [aim];
      kickLight(fx, doctrine, tower.x + HALF, tower.y + HALF);
      for (const [hx, hy] of hitLights(fx.boltPoints)) kickLight(fx, doctrine, hx, hy, 'hit');
      if (!reducedMotion) {
        sparkSpec(fx, lift, mw.x, mw.y, mw.z, 4, 120, 0.25, '#ff8a2a');
        for (const [hx, hy] of fx.boltPoints) sparkSpec(fx, lift, hx, hy, liftAt(hx, hy) + FX_HIT_Z, 5, 150, 0.3, '#ff8a2a');
      }
    } else if (doctrine === 'siegeMortar') {
      fx.flash = FX_FLASH_SECONDS.siegeMortar;
      // The shell leaves the muzzle where the tube stood before it slid back.
      const at = muzzleWorld(tower, shown, theta, { ...pose, recoil: 0 }, 0);
      fx.launch = { x: at.x, y: at.y, z: at.z, dir: at.dir, lift };
      kickLight(fx, doctrine, at.x, at.y, null, 'muzzle');
      // A pillar of smoke up the tube and a puff behind the weapon.
      const n = reducedMotion ? 3 : 8;
      for (let i = 0; i < n; i++) {
        smokeSpec(
          fx, lift, at.x + at.dir[0] * i * 0.03, at.y + at.dir[1] * i * 0.03, at.z + i * 4,
          at.dir[0] * 0.25 + rand(-0.12, 0.12), at.dir[1] * 0.25 + rand(-0.12, 0.12), 60 + i * 12, 5, 19, 1.3 + i * 0.1,
        );
      }
      if (!reducedMotion) sparkSpec(fx, lift, at.x, at.y, at.z, 8, 140, 0.3, '#ffb02e');
    } else if (doctrine === 'thunderTower') {
      fx.flash = FX_FLASH_SECONDS.thunderTower;
      fx.boltAge = 0;
      fx.boltSeed = Math.floor(t * 30);
      const legs = event && event.type === 'chain' ? event.points.slice(1).map((p) => [p.x, p.y]) : [];
      fx.boltPoints = legs.length ? legs : [aim];
      // The strike comes down at once, the chain then hops from target to target: the whole cascade lasts
      // the life of the last hop after its start.
      fx.bolt = FX_SPECIAL_BOLT_SECONDS.thunderTower + (fx.boltPoints.length - 1) * FX_THUNDER.delay;
      const R = FX_THUNDER.ring;
      fx.boltPoints.forEach(([hx, hy], i) => {
        if (fx.extra.rings.length < EXTRA_MAX) {
          fx.extra.rings.push({ x: hx, y: hy, r: i === 0 ? R.first : R.other, age: -i * FX_THUNDER.delay, max: R.seconds, colour: FX_THUNDER.colours[1], width: R.width });
        }
      });
      kickLight(fx, doctrine, fx.boltPoints[0][0], fx.boltPoints[0][1], null, 'strike');
      for (const [hx, hy] of hitLights(fx.boltPoints.slice(1))) kickLight(fx, doctrine, hx, hy, 'hit');
      fx.extra.brighten = FX_THUNDER.flash.alpha;
      if (!reducedMotion) for (const [hx, hy] of fx.boltPoints.slice(0, 3)) sparkSpec(fx, lift, hx, hy, liftAt(hx, hy) + FX_HIT_Z, 5, 160, 0.3, '#bff2ff');
    } else if (doctrine === 'soulfireObelisk') {
      fx.beam = FX_OBELISK_BEAM_SECONDS;
      fx.beamEnd = event && event.type === 'soulfire' ? [event.tx, event.ty] : aim;
      kickLight(fx, doctrine, mw.x, mw.y, null, 'muzzle');
      kickLight(fx, doctrine, fx.beamEnd[0], fx.beamEnd[1], 'hit', 'hit');
      if (!reducedMotion) sparkSpec(fx, lift, fx.beamEnd[0], fx.beamEnd[1], liftAt(fx.beamEnd[0], fx.beamEnd[1]) + FX_HIT_Z, 14, 200, 0.5, '#b784ff');
    }
  }
  // The bolt flickers from frame to frame; with reduced motion it keeps the shape it was born with.
  if (!reducedMotion && fx.bolt > 0) fx.boltSeed = Math.floor(t * 28);

  // The eye lights up over the charge and the beam; the gold aura of the shrine rises while it works.
  fx.glow = fx.charge > 0.5 || fx.beam > 0 ? 1 : 0;
  if (doctrine === 'purgeShrine') fx.aura += ((tower.firing ? 1 : FX_AURA_IDLE) - fx.aura) * Math.min(1, dt * FX_AURA_RATE);

  if (doctrine === 'flame') {
    fx.jet += ((tower.firing ? 1 : 0) - fx.jet) * Math.min(1, dt * FX_JET_RATE);
    if (fx.jet > 0.5 && !reducedMotion && dt > 0 && Math.random() < dt * 22) {
      const d = jetLength(tower, mw) * fx.jet;
      smokeSpec(fx, lift, mw.x + dir[0] * d, mw.y + dir[1] * d, mw.z + 12, dir[0] * 0.3, dir[1] * 0.3, 40, 6, 16, 1.1, 2);
    }
    stepFlame(tower, fx, mw, dt, reducedMotion);
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

/**
 * The ball flame (issue 86): while the emplacement fires, fireballs roll from the nozzle in a straight line
 * to the target, swelling and darkening, and near the tip of the jet patches of ground burn on for a moment.
 * Read from the state (`tower.firing`, `tower.aim`), nothing is reported. The balls belong to this
 * emplacement (so they stay behind its weapon when the jet points away from the camera), count against the
 * ceiling the muzzles share, and at most FX_BALLS.max live at once; the patches go to the ground layer.
 * With reduced motion half as many balls and patches, and nothing wobbles.
 */
function stepFlame(tower, fx, mw, dt, reducedMotion) {
  for (let i = fx.balls.length - 1; i >= 0; i--) {
    const b = fx.balls[i];
    b.age += dt;
    if (b.age >= b.life) fx.balls.splice(i, 1);
  }
  if (!tower.firing || fx.jet < 0.3 || dt <= 0) {
    fx.ballAcc = 0;
    fx.burnAcc = 0;
    return;
  }
  const to = tower.aim ? norm2([tower.aim.x - mw.x, tower.aim.y - mw.y]) : norm2(mw.dir);
  const len = jetLength(tower, mw) * fx.jet;
  const half = reducedMotion ? 0.5 : 1;
  fx.ballAcc += dt * FX_BALLS.rate * half;
  let guard = 4;
  while (fx.ballAcc >= 1 && guard-- > 0) {
    fx.ballAcc -= 1;
    if (ballRoom <= 0 || fx.balls.length >= FX_BALLS.max) continue;
    ballRoom -= 1;
    const a = Math.atan2(to[1], to[0]) + rand(-FX_BALLS.spread, FX_BALLS.spread);
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const L = len * rand(...FX_BALLS.lengthJitter);
    fx.balls.push({
      x0: mw.x, y0: mw.y, z0: mw.z, dx, dy, L,
      zEnd: liftAt(mw.x + dx * L, mw.y + dy * L) + FX_HIT_Z,
      age: 0, life: FX_BALLS.life * rand(0.85, 1.1), spin: rand(0, TAU), wob: rand(0, TAU),
    });
  }
  if (fx.jet <= 0.6) return;
  fx.burnAcc += dt;
  if (fx.burnAcc >= FX_BURN.every / half) {
    fx.burnAcc = 0;
    const s = len * rand(...FX_BURN.reach);
    const side = rand(-FX_BURN.side, FX_BURN.side) * s * 0.5;
    if (fx.extra.patches.length < EXTRA_MAX) {
      fx.extra.patches.push({ x: mw.x + to[0] * s - to[1] * side, y: mw.y + to[1] * s + to[0] * side, max: FX_BURN.life * rand(0.85, 1.15), seed: rand(0, 10) });
    }
  }
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
function bolt(ctx, a, b, seed, jitter, colour, width, core = '#ffffff') {
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
  for (const [w, col] of [[width + 3.6, INK], [width, colour], [width * 0.4, core]]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  }
}

/**
 * The flame: fireballs that roll from the nozzle in a straight line to the target (issue 86), the bright
 * nozzle at the muzzle while it fires. Position by age, so nothing is stored but the start and the end.
 */
function drawFlameBalls(ctx, fx) {
  const f = fx.frame;
  for (const b of fx.balls) {
    const u = Math.min(1, b.age / b.life);
    const s = 1 - Math.pow(1 - u, 1.5);
    const r = ballRadius(u);
    const wob = f.reducedMotion ? 0 : Math.sin(f.t * 20 + b.wob) * 1.5;
    const p = P(b.x0 + b.dx * s * b.L, b.y0 + b.dy * s * b.L, b.z0 + (b.zEnd - b.z0) * s);
    drawFireball(ctx, p[0], p[1] + wob - r * 0.6, r, u, b.spin + (f.reducedMotion ? 0 : u * 3));
  }
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

/**
 * The tesla bolt: a cold angular double strike (issue 86), from the tip to the target, a fork on the first
 * leg, and on to each further target of the chain. Read by age, so the dark gap between the two strikes is
 * the same on every frame.
 */
function drawBolt(ctx, fx) {
  const f = fx.frame;
  const u = fx.bolt / FX_BOLT_SECONDS;
  let from = P(f.x, f.y, f.z);
  fx.boltPoints.forEach(([x, y], i) => {
    const to = P(x, y, liftAt(x, y) + FX_HIT_Z);
    drawTeslaArc(ctx, from, to, fx.boltSeed + i * 7, fx.boltAge, u, f.reducedMotion, i === 0);
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

/**
 * Charge of a lens, an eye or a scope, 0 to 1: it fills over the last `seconds` of the reload while there is a
 * target.
 */
function chargeOf(tower, seconds) {
  if (!tower.aim || tower.cooldown <= 0 || tower.cooldown >= seconds) return 0;
  return 1 - tower.cooldown / seconds;
}
const laserCharge = (tower) => chargeOf(tower, FX_LASER_CHARGE_SECONDS);

/** True when this weapon has fire that reaches out of the muzzle this frame. */
function hasReach(fx, kind) {
  if (kind === 'flame') return fx.jet >= 0.05 || fx.balls.length > 0;
  if (kind === 'laser') return fx.beam > 0 && Boolean(fx.beamEnd);
  if (kind === 'tesla' || kind === 'thunderTower' || kind === 'emberCauldron') return fx.bolt > 0 && Boolean(fx.boltPoints);
  if (kind === 'psi') return fx.pulses.length > 0;
  if (kind === 'soulfireObelisk') return fx.beam > 0 && Boolean(fx.beamEnd);
  if (kind === 'siegeMortar') return fx.sight > 0;
  return false;
}

/**
 * Where an effect is drawn in an emplacement's frame. A fire in the muzzle or round it (flash, glow,
 * lens, pilot light) always goes over the weapon. Fire that reaches out (jet, beam, bolt, pulses) goes
 * behind the weapon when it runs away from the camera, and over everything (drawTowerReach, from
 * effects.js) when it runs towards it; what leaves from the top of a floating part is always over it.
 *
 * The context is the one of the emplacement's own drawing, shifted down by the height of its field; the
 * drawing here is in absolute world pixels, so the shift is taken back for the duration.
 * @param {'behind'|'front'} phase  'behind': before the weapon is drawn, 'front': after it
 */
export function drawTurretFx(ctx, tower, phase) {
  const fx = states.get(tower);
  const f = fx?.frame;
  if (!f) return;
  const kind = weaponOf(tower).kind;
  ctx.save();
  ctx.translate(0, f.lift);
  if (phase === 'behind') {
    if (kind === 'soulfireObelisk') drawObeliskFlames(ctx, tower, fx, 'back');
    if (!f.front && hasReach(fx, kind)) drawReach(ctx, fx, tower);
  } else {
    if (kind === 'soulfireObelisk') drawObeliskFlames(ctx, tower, fx, 'front');
    drawAtMuzzle(ctx, fx, tower);
  }
  ctx.restore();
}

/** The reaching fire of the emplacements that point towards the camera, over everything (absolute pixels). */
export function drawTowerReach(ctx, tower, t) {
  const fx = states.get(tower);
  const f = fx?.frame;
  if (!f || f.t !== t || !f.front || !hasReach(fx, weaponOf(tower).kind)) return;
  drawReach(ctx, fx, tower);
}

function drawReach(ctx, fx, tower) {
  const kind = weaponOf(tower).kind;
  if (kind === 'flame') drawFlameBalls(ctx, fx);
  else if (kind === 'laser') drawBeam(ctx, fx, tower);
  else if (kind === 'tesla') drawBolt(ctx, fx);
  else if (kind === 'psi') drawPulses(ctx, fx);
  else if (kind === 'emberCauldron') drawEmberBolts(ctx, fx, tower);
  else if (kind === 'thunderTower') drawChain(ctx, fx);
  else if (kind === 'soulfireObelisk') drawSoulBeam(ctx, fx);
  else if (kind === 'siegeMortar') drawScope(ctx, fx, tower);
}

/** The threads of the cauldron: three fine glowing threads from its electrode to every target the volley hit. */
function drawEmberBolts(ctx, fx, tower) {
  const f = fx.frame;
  const u = fx.bolt / FX_SPECIAL_BOLT_SECONDS.emberCauldron;
  const mp = P(f.x, f.y, f.z);
  fx.boltPoints.forEach(([x, y], i) => {
    drawEmberThreads(ctx, mp, P(x, y, liftAt(x, y) + FX_HIT_Z), i * 2.1 + tower.x, fx.boltAge, u, f.t, f.reducedMotion);
  });
}

/**
 * The thunder tower: the ball sends a short bolt up, the first target is struck from the sky, and the chain
 * then hops from target to target, FX_THUNDER.delay s apart (issue 86). The simulation hits them all in one
 * step; the cascade is only the drawing's.
 */
function drawChain(ctx, fx) {
  const f = fx.frame;
  const T = FX_SPECIAL_BOLT_SECONDS.thunderTower;
  const mp = P(f.x, f.y, f.z);
  drawThunderHop(ctx, mp, [mp[0] + 4, mp[1] - 70], fx.boltSeed, Math.max(0, 1 - fx.boltAge / T));
  fx.boltPoints.forEach(([x, y], i) => {
    const local = fx.boltAge - i * FX_THUNDER.delay;
    if (local < 0) return;
    const u = Math.max(0, 1 - local / T);
    const to = P(x, y, liftAt(x, y) + FX_HIT_Z);
    if (i === 0) {
      drawSkyStrike(ctx, to, fx.boltSeed, u, f.reducedMotion);
    } else {
      const [px, py] = fx.boltPoints[i - 1];
      drawThunderHop(ctx, P(px, py, liftAt(px, py) + FX_HIT_Z), to, fx.boltSeed + i * 5, u);
    }
  });
}

/** The soul beam: a violet band with a red heart, running from the pupil to the target. */
function drawSoulBeam(ctx, fx) {
  const f = fx.frame;
  const u = fx.beam / FX_OBELISK_BEAM_SECONDS;
  const mp = P(f.x, f.y, f.z);
  const end = fx.beamEnd;
  const t = P(end[0], end[1], liftAt(end[0], end[1]) + FX_HIT_Z);
  const len = Math.sqrt((t[0] - mp[0]) ** 2 + (t[1] - mp[1]) ** 2) || 1;
  const nx = -(t[1] - mp[1]) / len;
  const ny = (t[0] - mp[0]) / len;
  const wob = (s) => (f.reducedMotion ? 0 : Math.sin(f.t * 30 + s * 9) * 2.4 * Math.sin(s * Math.PI));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, col] of [[11 * u + 3, INK], [7 * u + 1.4, '#b784ff'], [3.4 * u + 0.6, '#ff6a8a'], [1.3 * u + 0.3, '#fff1f4']]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const s = i / 12;
      const x = mp[0] + (t[0] - mp[0]) * s + nx * wob(s);
      const y = mp[1] + (t[1] - mp[1]) * s + ny * wob(s);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  glow(ctx, t[0], t[1], 26, '#b784ff', 0.7 * u);
}

/**
 * The scope of the siege mortar: a red line from its lens to where it is aiming, over the last moments of
 * the reload, with a mark on the ground that tightens as the shell gets ready.
 */
function drawScope(ctx, fx, tower) {
  if (!tower.aim) return;
  const f = fx.frame;
  const q = fx.sight;
  const [sx, sy, sz] = localWorld(tower, fx, ...siegeSight());
  const a = P(sx, sy, sz);
  const b = P(tower.aim.x, tower.aim.y, liftAt(tower.aim.x, tower.aim.y));
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.55 + 0.45 * (f.reducedMotion ? 1 : Math.abs(Math.sin(f.t * 22)));
  for (const [w, col] of [[4.2, INK], [1.9, '#ff4a4a'], [0.7, '#ffd0c0']]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const ring = 5 + (1 - q) * 22;
  ell(ctx, b[0], b[1], ring, ring * 0.5, 'rgba(255,74,74,.12)', '#ff4a4a', 1.6);
  ell(ctx, b[0], b[1], 3 + q * 2, (3 + q * 2) * 0.5, '#ff4a4a', INK, 1);
}

/** A flame shape: a teardrop with a bright inside, base at (x, y). */
function flameShape(ctx, x, y, s, outer, inner) {
  for (const [k, col] of [[1, outer], [0.55, inner]]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - 5 * s * k, y - 4 * s * k, x - 2 * s * k, y - 9 * s * k, x, y - 14 * s * k);
    ctx.bezierCurveTo(x + 3 * s * k, y - 9 * s * k, x + 5 * s * k, y - 4 * s * k, x, y);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    if (k === 1) {
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
  }
}

const flicker = (f, i, tower) => (f.reducedMotion ? 1 : 0.85 + Math.sin(f.t * 15 + i * 2.1 + tower.x) * 0.15);

/** The four flames at the foot of the obelisk: the two behind the shaft before it, the two in front after it. */
function drawObeliskFlames(ctx, tower, fx, phase) {
  const f = fx.frame;
  SPECIAL_FIRE.obeliskFeet.forEach(([lx, ly], i) => {
    const [wx, wy, wz] = localWorld(tower, fx, lx, ly, SPECIAL_FIRE.obeliskFootZ);
    const behind = wx + wy < tower.x + HALF + tower.y + HALF - 1e-6;
    if ((phase === 'back') !== behind) return;
    const [sx, sy] = P(wx, wy, wz);
    flameShape(ctx, sx, sy, 0.75 * flicker(f, i, tower), '#ff8a2a', '#ffd23f');
  });
}

/** The lights at the muzzle: flashes, glows, the lens, the pilot light, the idle arcs. */
function drawAtMuzzle(ctx, fx, tower) {
  const f = fx.frame;
  const model = weaponOf(tower);
  const doctrine = model.kind;
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
      const flick = f.reducedMotion ? 1 : 0.8 + Math.sin(f.t * 20) * 0.2;
      ell(ctx, mp[0], mp[1], 2.6 * flick, 3.4 * flick, '#6fb7ff', INK, 1);
    } else {
      glow(ctx, mp[0], mp[1], 14, '#ff8a2a', 0.5 * fx.jet);
      // The bright nozzle the balls leave from.
      ell(ctx, mp[0], mp[1], 4.2, 3.4, '#fff3c4', INK, 1.2);
      ell(ctx, mp[0], mp[1], 2.4, 2, '#ffffff', null);
    }
  } else if (doctrine === 'mortar' && fx.flash > 0) {
    const u = fx.flash / FX_FLASH_SECONDS.mortar;
    glow(ctx, mp[0], mp[1], 20, '#ffd23f', 0.5 * u * damp);
    flare(ctx, f, f.dir, 0.42 * (0.6 + 0.4 * u) * shrink, 0.11, '#ff8a2a', '#ffe38a');
    // Back blast behind the pod.
    const back = 0.45 * model.scale;
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
    idleArc(ctx, f, mp, fx.bolt > 0, damp, 20);
  } else if (doctrine === 'psi') {
    const [ax, ay] = P(tower.x + HALF, tower.y + HALF, f.lift + model.mount + 28 * model.scale + (f.bob ?? 0));
    glow(ctx, ax, ay, 30, '#b784ff', tower.firing ? 0.32 : 0.2);
  } else if (doctrine === 'purgeShrine') {
    // The artefact glows gold, the stronger the more the aura on the ground is up.
    const pulse = f.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(f.t * 4);
    glow(ctx, mp[0], mp[1], 17 + pulse * 3, '#ffb13b', (0.3 + 0.25 * pulse) * (0.4 + 0.6 * fx.aura));
  } else if (doctrine === 'stormBattery') {
    // One flash on each barrel that has fired lately, in the colour of its tracer.
    for (let k = 0; k < fx.flashK.length; k++) {
      if (fx.flashK[k] <= 0) continue;
      const mk = muzzleWorld(tower, f.shown, f.theta, { ...f.pose, tube: k }, f.push);
      const u = fx.flashK[k] / FX_FLASH_SECONDS.stormBattery;
      const pk = P(mk.x, mk.y, mk.z);
      glow(ctx, pk[0], pk[1], 11, '#7fd8ff', 0.55 * u * damp);
      flare(ctx, mk, mk.dir, 0.3 * (0.6 + 0.4 * u) * shrink, 0.08, '#7fd8ff', '#e8fbff');
    }
  } else if (doctrine === 'emberCauldron') {
    // Flames in the opening of the cauldron, and a glow at the tip of each electrode.
    const [fx0, fy0, fz0] = localWorld(tower, fx, ...SPECIAL_FIRE.cauldron);
    const base = P(fx0, fy0, fz0);
    const charged = fx.bolt > 0 ? 1.25 : 1;
    glow(ctx, base[0], base[1] - 8, 26, '#ff8a2a', 0.4 * charged);
    [[-4.2, 0.62, 0], [3.6, 0.8, 1], [0, 1.05, 2], [6.4, 0.5, 3]].forEach(([dx, s, i]) => {
      flameShape(ctx, base[0] + dx * f.scale, base[1] + 1 - Math.abs(dx) * 0.15, s * flicker(f, i, tower) * charged, i % 2 ? '#ffb13b' : '#ff8a2a', '#fff3c0');
    });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const [ex, ey, ez] = localWorld(tower, fx, Math.cos(a) * 0.225, Math.sin(a) * 0.225, 31.5);
      const p = P(ex, ey, ez);
      glow(ctx, p[0], p[1], fx.bolt > 0 && i === 0 ? 11 : 6, i === 0 ? '#ffb02e' : '#5fd4ff', fx.bolt > 0 ? 0.7 * damp : 0.4);
    }
  } else if (doctrine === 'siegeMortar') {
    if (fx.flash > 0) {
      const u = fx.flash / FX_FLASH_SECONDS.siegeMortar;
      glow(ctx, mp[0], mp[1], 28, '#ffd23f', 0.6 * u * damp);
      flare(ctx, f, f.dir, 0.62 * (0.6 + 0.4 * u) * shrink, 0.17, '#ff8a2a', '#ffe38a');
    }
    if (fx.sight > 0) {
      const [sx, sy, sz] = localWorld(tower, fx, ...siegeSight());
      const lens = P(sx, sy, sz);
      glow(ctx, lens[0], lens[1], 7, '#ff4a4a', 0.7);
    }
  } else if (doctrine === 'thunderTower') {
    idleArc(ctx, f, mp, fx.bolt > 0, damp, 24);
  } else if (doctrine === 'soulfireObelisk') {
    const ch = fx.charge;
    const idle = 0.18 + (f.reducedMotion ? 0 : 0.06 * Math.sin(f.t * 5));
    glow(ctx, mp[0], mp[1], 15 + ch * 18, '#b784ff', fx.beam > 0 ? 0.7 : ch > 0 ? 0.35 + ch * 0.4 : idle);
    if (ch > 0) {
      glow(ctx, mp[0], mp[1], 6 + ch * 8, '#ff3a1a', 0.4 + ch * 0.5);
      // Violet motes converge on the pupil while the eye charges.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + (f.reducedMotion ? 0 : f.t * 7);
        const r = (1 - ch) * 22 + 3;
        ell(ctx, mp[0] + Math.cos(a) * r, mp[1] + Math.sin(a) * r * 0.7, 1.3, 1.3, '#d5b6ff', null);
      }
    }
  }
}

/** Glow of a coil or a ball in blue, and while it is quiet a small arc now and then from the tip. */
function idleArc(ctx, f, mp, bolting, damp, big) {
  glow(ctx, mp[0], mp[1], bolting ? big : big * 0.6, '#5fd4ff', bolting ? 0.7 * damp : 0.3 + (f.reducedMotion ? 0 : 0.1 * Math.sin(f.t * 9)));
  if (!bolting && !f.reducedMotion) {
    const k = Math.floor(f.t * 7);
    const r = Math.sin(k * 91.7) * 1000;
    if (r - Math.floor(r) < 0.6) {
      const a = (Math.sin(k * 12.3) * 1000) % TAU;
      bolt(ctx, mp, [mp[0] + Math.cos(a) * 12, mp[1] + Math.sin(a) * 9 - 3], k, 5, '#bff2ff', 1.4);
    }
  }
}

/**
 * The level of the gold aura on the ground around the shrine, 0 to 1: it stays at FX_AURA_IDLE while the
 * shrine has nothing in reach and rises while it works. Read by effects.js, which draws the ring.
 */
export function auraLevel(tower) {
  return states.get(tower)?.aura ?? FX_AURA_IDLE;
}

/** One barrel of the storm battery fires: flash, case from the back of the housing, smoke, tracer. */
function shootStorm(tower, fx, o, mw, events, aim) {
  const model = weaponOf(tower);
  const lift = mw.lift;
  const k = o.tube;
  fx.flashK[k] = FX_FLASH_SECONDS.stormBattery;
  fx.flash = FX_FLASH_SECONDS.stormBattery;
  // A case leaves the back of the housing, against the line of the barrels, and falls.
  const Fs = turnFrame(o.shown, model.mount, model.scale);
  const [cx, cy] = Fs.world(SPECIAL_CASING_PORT[0], SPECIAL_CASING_PORT[1] + (k % 2 ? -0.02 : 0.02));
  const dir = norm2(mw.dir);
  queue(fx, {
    kind: 'wcasing',
    x: tower.x + HALF + cx,
    y: tower.y + HALF + cy,
    z: lift + model.mount + SPECIAL_CASING_PORT[2] * model.scale,
    vx: -dir[0] * rand(0.9, 1.6) - dir[1] * rand(-0.4, 0.4),
    vy: -dir[1] * rand(0.9, 1.6) + dir[0] * rand(-0.4, 0.4),
    vz: rand(70, 150),
    rot: rand(0, TAU),
    vrot: rand(-18, 18),
    life: 1.1,
    floor: lift,
  });
  if (Math.random() < (o.reducedMotion ? 0.1 : 0.2)) smokeSpec(fx, lift, mw.x, mw.y, mw.z, mw.dir[0] * 0.4, mw.dir[1] * 0.4, 16, 2.5, 7, 0.5);
  // The tracer flies to one of the targets the volley hit, in turn.
  const hits = events.filter((e) => e.type === 'shot');
  const target = hits.length ? [hits[k % hits.length].tx, hits[k % hits.length].ty] : aim;
  // One light at the muzzle and one at the lead target, each kept as a single light however fast it fires.
  const lead = hits.length ? [hits[0].tx, hits[0].ty] : aim;
  kickLight(fx, 'stormBattery', mw.x, mw.y, null, 'muzzle', 0.8 + 0.2 * Math.random());
  kickLight(fx, 'stormBattery', lead[0], lead[1], 'hit', 'hit');
  const tx = target[0] + rand(-0.06, 0.06);
  const ty = target[1] + rand(-0.06, 0.06);
  const d = Math.sqrt((tx - mw.x) ** 2 + (ty - mw.y) ** 2);
  queue(fx, {
    kind: 'wtracer',
    x0: mw.x,
    y0: mw.y,
    z0: mw.z,
    x1: tx,
    y1: ty,
    z1: liftAt(tx, ty) + FX_HIT_Z,
    life: Math.max(0.05, d / FX_STORM_TRACER_SPEED),
    floor: lift,
    colour: '#7fd8ff',
    core: '#e8fbff',
  });
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
    ctx.strokeStyle = p.colour ?? '#ffe38a';
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
    for (const [w, col] of [[4, INK], [2.2, p.colour ?? '#ffd23f'], [1, p.core ?? '#fff3b0']]) {
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

// ---------- the shell of the siege mortar ----------

/**
 * Position of the shell of the siege mortar: [x, y, z]. A heavy shell flies a high arc, as the study draws
 * it: straight over the ground from the muzzle to the end point of the shell of the simulation, and
 * FX_SHELL.lift px plus FX_SHELL.perCell px for every cell of the way over the straight line in height. The
 * flight time and the end point are those of the simulation.
 */
export function shellPosition(launch, shell, u = Math.min(1, shell.t / shell.flight)) {
  const x1 = shell.to.x;
  const y1 = shell.to.y;
  const d = Math.sqrt((x1 - launch.x) ** 2 + (y1 - launch.y) ** 2);
  const arc = FX_SHELL.lift + d * FX_SHELL.perCell;
  const z1 = liftAt(x1, y1) + FX_SHELL.endZ;
  return [launch.x + (x1 - launch.x) * u, launch.y + (y1 - launch.y) * u, launch.z + (z1 - launch.z) * u + arc * 4 * u * (1 - u)];
}

/** The shell in flight: a dark ball with a gold band, and its shadow on the ground. */
export function drawShell(ctx, rec, shell) {
  const pos = shellPosition(rec.launch, shell);
  const g = P(pos[0], pos[1], liftAt(pos[0], pos[1]));
  ell(ctx, g[0], g[1], 7, 3.4, 'rgba(10,6,4,.3)', null);
  const s = P(pos[0], pos[1], pos[2]);
  ell(ctx, s[0], s[1], 5.4, 5.4, '#3a3630', INK, 1.8);
  ell(ctx, s[0] - 1.6, s[1] - 1.6, 1.6, 1.6, '#8a857a', null);
  ell(ctx, s[0], s[1], 5.4, 1.6, null, '#e0b83e', 1.2);
}
