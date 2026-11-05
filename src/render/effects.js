// Everything the fighting throws off: muzzle flashes, beams, chains, shells,
// explosions, particles, scorch marks and damage numbers.
//
// The simulation reports what happened (state.events) and keeps the shells in
// state.projectiles; this layer turns that into pictures and forgets it again.
// Nothing here is read back by the simulation, and all of it is capped so a
// busy wave cannot drag the frame rate down.

import { iso } from './iso.js';
import { cellLift, liftAt, activeTerrain } from './terrain.js';
import { clipToGround } from './groundClip.js';
import { ell, poly, comicText, shadow } from './draw.js';
import { C } from './palette.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { STRINGS } from '../data/strings.js';
import { PODS } from '../data/pods.js';
import { towerStats, towerById } from '../sim/towers.js';
import { towerAnchor, isTurreted } from './towerSprites.js';
import {
  noteTowerEvent,
  drainFxQueue,
  stepWorldParticle,
  drawWorldParticle,
  launchOf,
  bigRocketTrail,
  drawBigRocket,
  salvoRockets,
  salvoProgress,
  salvoPuff,
  drawSalvoRocket,
  artefactScreen,
  drawTowerReach,
  auraLevel,
  drainFxExtra,
  setBallRoom,
  ballsAlive,
} from './towerFx.js';
import { weaponKind } from './weapons.js';
import {
  groundLight,
  lightAlpha,
  lightSpec,
  drawBurnPatch,
  drawPressureRing,
  drawBigImpact,
  drawCrater,
  drawMistFlow,
  onCanvas,
  CELL_RX,
} from './weaponFx.js';
import {
  FX_MAX_PARTICLES,
  FX_LIGHT,
  FX_BURN,
  FX_THUNDER,
  FX_SALVO,
  FX_BIG_BOOM,
  FX_MIST,
  KOLOSS_DEBRIS_SIDE_SPEED,
} from '../data/art.js';
import { drawGunship } from './gunship.js';
import { sinceImpact } from '../sim/pods.js';
import { SPRITE_SCALE, POD_ANCHORS, POD_PETALS, POD_PETAL_ORDER, POD_OPEN_SCALE } from './sprites/manifest.js';
import { SMOKE_SECONDS, petalLands } from './podTiming.js';

/** Upper bounds (CLAUDE.md: particles and decals need a ceiling). */
const MAX_PARTICLES = 520;
/** Of those, how many may be puffs of dust, smoke and steam (a salvo of six leaves about 200). */
const MAX_PUFFS = 240;
const MAX_DECALS = 60;
const MAX_NUMBERS = 36;

/** Seconds a muzzle flash, a beam or a chain stays on screen. */
const FLASH_SECONDS = 0.07;
const BEAM_SECONDS = 0.12;

/** Damage is collected per enemy and shown as one number every so often. */
const NUMBER_INTERVAL = 0.32;

/** Screen shake in CSS pixels; a pod impact is the loudest thing on the field. */
const MAX_SHAKE = 16;
const SHAKE = { explosion: 2.5, podImpact: 13, bossKill: 6, leak: 4, airstrike: 7 };
/** White flash over the picture, 0 to 1. Damped with prefers-reduced-motion. */
const FLASH = { podImpact: 0.45, bossKill: 0.2, airstrike: 0.28 };
const REDUCED_FLASH = 0.25;

const SPARK = { fire: '#ffb13b', smoke: '#6b625a', goo: C.toxic, spark: '#ffe07a', warp: C.warpL };

/** Upper bound for shockwave rings and the comic words over them. */
const MAX_RINGS = 16;
const MAX_WORDS = 4;

/**
 * Pod staging after the impact (seconds after touchdown), from the capsule study. Only
 * the drawing: the simulation knows when the pod lands and nothing else.
 */
const POD = {
  /** Explosive bolts blow off before the segments move. */
  bolts: PODS.openDelaySeconds * 0.6,
  /** The core vents what is left of the heat out of the roof: this many puffs, this far apart. */
  steamFrom: PODS.openDelaySeconds + 0.05,
  steamStep: 0.15,
  steamPuffs: 6,
  /** Size of the opened capsule, in world pixels per SVG unit, and how far a segment reaches. */
  openScale: SPRITE_SCALE.pod * POD_OPEN_SCALE,
  /** Height of the roof of the opened capsule above the ground, in px. */
  roof: POD_ANCHORS.top * SPRITE_SCALE.pod * POD_OPEN_SCALE,
  /** Height of the seams of the shell, where the bolts blow. */
  seam: 42 * SPRITE_SCALE.pod,
  /** How far an opened segment reaches from the centre, in SVG units (the study's petal reach). */
  petalReach: 60.57,
  /** How far out a segment throws its dust when it lies down, as a share of its reach. */
  slamReach: 0.9,
  /** Particles of the landing, by kind; the second number is for prefers-reduced-motion. */
  fire: [7, 4],
  skirt: [10, 5],
  billows: [6, 3],
  chunks: [9, 4],
  sparks: [6, 3],
};

/** The study's three smoke palettes, dark to light, as 16 steps each: a puff clears up as it ages. */
const PUFF_STEPS = 16;
function hexMix(a, b, u) {
  const p = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const c = (i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * u);
  return `rgb(${c(0)},${c(1)},${c(2)})`;
}
function rampOf(stops) {
  const out = [];
  for (let k = 0; k < PUFF_STEPS; k++) {
    const x = (k / (PUFF_STEPS - 1)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(x));
    out.push(hexMix(stops[i], stops[i + 1], x - i));
  }
  return out;
}
const PUFF_COLORS = {
  soot: rampOf(['#2b221d', '#5d544c', '#a39988', '#d3cabb']),
  dust: rampOf(['#6e5a42', '#9b8466', '#c4b08a', '#e0d4b6']),
  steam: rampOf(['#bdb6aa', '#d8d3c9', '#e9e4dc', '#f2efe8']),
};
const CHUNK_COLORS = ['#4b3a2c', '#5e4a38', '#3a2e24'];
const TAU = Math.PI * 2;
const between = (a, b) => a + Math.random() * (b - a);

/** The screen direction across a way driven along (dx, dy), as a unit vector. */
function sidewaysOnScreen(dx, dy) {
  const [ax, ay] = iso(0, 0);
  const [bx, by] = iso(-dy, dx);
  const len = Math.hypot(bx - ax, by - ay) || 1;
  return [(bx - ax) / len, (by - ay) / len];
}

/**
 * World point to the pixel space the camera transform works in. `z` is the height above the
 * ground; the ground itself is the terrain under the point (terrain.js), so every effect
 * lies on its field.
 */
function project(x, y, z = 0) {
  return iso(x, y, z + liftAt(x, y));
}

/** A point on the plane of its own field: marks lying on the ground do not follow the blended height of a step. */
function onPlane(x, y) {
  return iso(x, y, cellLift(x, y));
}

/**
 * Draws a mark that lies on the ground of the field around (x, y) and reaches `reach` fields from it:
 * it stays on the fields of its own level and behind the higher blocks in front (`clipToGround`), so
 * it never hangs over a cliff or climbs a slope. `box`, the box of the mark in world px where the caller
 * knows it, leaves out the blocks that cannot cut it.
 */
function onGround(ctx, x, y, reach, draw, box = null) {
  ctx.save();
  clipToGround(ctx, activeTerrain(), Math.floor(x), Math.floor(y), reach, 0, true, true, box);
  draw();
  ctx.restore();
}

/** A screen point of an emplacement (an anchor, a spark) raised onto the height of its field. */
function onField(tower, [x, y]) {
  return [x, y - cellLift(tower.x, tower.y)];
}

export function createEffects() {
  const particles = [];
  const decals = [];
  const numbers = [];
  /** Short-lived shots: muzzle flashes, beams, chains. */
  const shots = [];
  /** Expanding shockwave rings on the ground. */
  const rings = [];
  /** Comic words over the loudest moments. */
  const words = [];
  /** Stasis fields holding their area still. */
  const fields = [];
  /** What each pod has already thrown off; forgotten with the pod. */
  const staged = new WeakMap();
  /** Damage bookkeeping per enemy, for the floating numbers. */
  const tally = new WeakMap();
  /** Camera shake and white flash, both fed by events and decaying on their own. */
  let shake = 0;
  let flash = 0;

  // Weapon effects of step 1 (issue 86), handed over by the emplacements (towerFx.js `drainFxExtra`):
  // the ground lights (at most FX_LIGHT.max, kicked ones and idle ones together), the patches of the
  // afterburn (at most FX_BURN.total, FX_BURN.max of one emplacement), the pressure rings of the thunder
  // tower and the brightening of the whole picture.
  /** Lights a shot kicked; each fades by itself. */
  const lights = [];
  const patches = [];
  const pressure = [];
  const brighten = { a: 0, life: 0, max: 0, colour: '236,232,255' };
  /** Real seconds since the effects began and when the picture last brightened, for the one-a-second rule. */
  let clock = 0;
  let lastBrighten = -Infinity;
  /** Fireballs alive, as of the last update; they share the ceiling of the muzzles. */
  let balls = 0;
  /**
   * The shells of the mortars in flight (rocket launchers and siege mortars) and where they fall. The simulation
   * says only `explosion` with the doctrine, so what landed is read from the shell that was in flight.
   */
  const mortarShells = new Map();
  /** The rockets of the launchers' salvos, from the first sight of a shell until the last has landed. */
  const salvos = [];
  /** The big impacts of the siege mortar (fireball) and the craters they leave. */
  const impacts = [];
  const craters = [];

  function kickLight(x, y, spec, key = null, k = 1) {
    const light = { key, x, y, r: spec.r, colour: spec.colour, a: spec.a * k, fade: spec.fade, level: 1 };
    if (key) {
      const same = lights.find((l) => l.key === key);
      if (same) {
        Object.assign(same, light);
        return;
      }
    }
    if (lights.length >= FX_LIGHT.max) lights.shift();
    lights.push(light);
  }

  function addPatch(owner, p) {
    const mine = patches.filter((q) => q.owner === owner);
    if (mine.length >= FX_BURN.max) patches.splice(patches.indexOf(mine[0]), 1);
    if (patches.length >= FX_BURN.total) patches.shift();
    patches.push({ owner, x: p.x, y: p.y, age: 0, max: p.max, seed: p.seed });
  }

  /** Takes over what an emplacement asked of the ground layer this frame. */
  function takeExtra(tower, extra, reducedMotion) {
    for (const l of extra.lights) {
      kickLight(l.x, l.y, l, l.key ? `${tower.id}:${l.key}` : null);
    }
    for (const r of extra.rings) {
      if (pressure.length >= FX_THUNDER.ring.max) pressure.shift();
      pressure.push({ ...r, reduced: reducedMotion });
    }
    for (const p of extra.patches) addPatch(tower.id, p);
    // The picture brightens at most once a second, however many thunder towers there are; with reduced
    // motion it is at most a faint one.
    if (extra.brighten) tryBrighten(extra.brighten, FX_THUNDER.flash.seconds, reducedMotion, FX_THUNDER.flash.reduced, '236,232,255');
  }

  /** The picture brightens at most once a second, however many things ask; at most a faint one with reduced motion. */
  function tryBrighten(alpha, seconds, reducedMotion, reducedAlpha, colour) {
    if (clock - lastBrighten < FX_THUNDER.flash.every) return;
    lastBrighten = clock;
    Object.assign(brighten, { a: reducedMotion ? Math.min(alpha, reducedAlpha) : alpha, life: seconds, max: seconds, colour });
  }

  /** The big impact of a siege mortar: fireball, ring, crater, dust, smoke columns, debris, ground light, a flash. */
  function bigImpact(x, y, radius, reducedMotion) {
    const B = FX_BIG_BOOM;
    impacts.push({ x, y, r: radius, age: 0, max: B.life, seed: Math.floor(x * 31 + y * 17) });
    if (pressure.length >= FX_THUNDER.ring.max) pressure.shift();
    pressure.push({ x, y, r: radius, age: 0, max: B.ring, colour: '#ffb13b', width: 3.2, reduced: reducedMotion });
    craters.push({ x, y, r: radius, age: 0, max: B.crater });
    if (craters.length > 8) craters.shift();
    const lift = liftAt(x, y);
    const dust = reducedMotion ? B.dust >> 1 : B.dust;
    for (let i = 0; i < dust; i++) {
      const a = (i / dust) * Math.PI * 2 + Math.random() * 0.4;
      const v = B.dustSpeed[0] + Math.random() * (B.dustSpeed[1] - B.dustSpeed[0]);
      addWorldParticle({ kind: 'wsmoke', x, y, z: lift + 3, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 10, r0: 6, r1: 16, tone: 0, life: B.dustLife, floor: lift });
    }
    for (let i = 0; i < B.columns; i++) {
      const a = (i / B.columns) * Math.PI * 2 + 0.7;
      addWorldParticle({
        kind: 'wsmoke', x: x + Math.cos(a) * radius * 0.25, y: y + Math.sin(a) * radius * 0.25, z: lift + 4, vx: 0, vy: 0,
        vz: 50 + Math.random() * 40, r0: 6, r1: 22, tone: 1.6, life: B.columnLife, floor: lift,
      });
    }
    if (!reducedMotion) {
      for (let i = 0; i < B.debris; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = B.dustSpeed[0] + Math.random() * (B.dustSpeed[1] - B.dustSpeed[0]);
        addWorldParticle({
          kind: 'wdebris', x, y, z: lift + 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 140 + Math.random() * 120, size: 1.8 + Math.random() * 1.4,
          rot: Math.random() * 6, vrot: -9 + Math.random() * 18, life: B.debrisLife, floor: lift,
        });
      }
    }
    tryBrighten(B.brighten.alpha, B.brighten.seconds, reducedMotion, B.brighten.reduced, B.brighten.colour);
  }

  /** One rocket of a salvo explodes: a small blast of FX_SALVO.boom of the splash radius. */
  function salvoBoom(x, y, radius, reducedMotion) {
    shots.push({ kind: 'blast', x, y, radius: radius * FX_SALVO.boom, colour: DOCTRINE_COLORS.mortar, life: 0.3 });
    burst(x, y, 6, 'fire', reducedMotion ? 2 : FX_SALVO.fire, { speed: 70, size: 4, grow: 3, life: 0.4 });
    burst(x, y, 6, 'smoke', reducedMotion ? 1 : FX_SALVO.smoke, { speed: 40, size: 5, grow: 7, life: 0.9, gravity: -20 });
  }

  /**
   * Reads the shells of the mortars. A shell seen the first time starts its record (and, for a rocket launcher,
   * its salvo); one that is gone has landed, and a siege mortar's shell lights the ground and makes its impact.
   */
  function watchShells(state, reducedMotion) {
    const live = new Set();
    for (const shell of state.projectiles) {
      const tower = towerById(state, shell.towerId);
      if (!tower || !isTurreted(tower)) continue;
      live.add(shell);
      let known = mortarShells.get(shell);
      if (!known) {
        known = { siege: Boolean(tower.special) && weaponKind(tower) === 'siegeMortar', x: shell.to.x, y: shell.to.y, radius: shell.radius, exploded: false, salvo: false };
        mortarShells.set(shell, known);
      }
      // The drawing ties a shell to its launch, which can be a frame after the shell was first seen here.
      const rec = known.salvo ? null : launchOf(shell, tower, false);
      if (!known.siege && rec) {
        known.salvo = true;
        // At most FX_SALVO.maxInFlight rockets of one emplacement are drawn at once.
        const inFlight = salvos.reduce((n, v) => (v.towerId === tower.id ? n + v.rockets.filter((r) => !r.landed).length : n), 0);
        const rockets = salvoRockets(rec.launch, shell, FX_SALVO.maxInFlight - inFlight).map((r) => ({ ...r, landed: false, puff: 0 }));
        salvos.push({ towerId: tower.id, shell, flight: shell.flight, radius: shell.radius, T: shell.t, gone: 0, rockets });
      }
    }
    for (const [shell, at] of mortarShells) {
      if (live.has(shell)) continue;
      mortarShells.delete(shell);
      if (!at.siege) continue;
      kickLight(at.x, at.y, lightSpec('siegeMortar', 'hit'));
      bigImpact(at.x, at.y, at.radius, reducedMotion);
    }
  }

  /** Flies the rockets of the salvos: smoke behind them, a small blast where each lands. */
  function stepSalvos(state, dt, reducedMotion) {
    const live = new Set(state.projectiles);
    for (let i = salvos.length - 1; i >= 0; i--) {
      const v = salvos[i];
      // The shell's own clock while it flies; after it has landed (the last rockets are still on their way) the drawing's.
      if (live.has(v.shell)) v.T = v.shell.t;
      else v.T = v.flight + (v.gone += dt);
      let left = 0;
      for (const r of v.rockets) {
        if (r.landed) continue;
        const u = salvoProgress(r, v.T);
        if (u < 0) {
          left += 1;
          continue;
        }
        if (u >= 1) {
          r.landed = true;
          salvoBoom(r.to.x, r.to.y, v.radius, reducedMotion);
          continue;
        }
        left += 1;
        r.puff -= dt;
        if (r.puff <= 0) {
          r.puff = FX_SALVO.trail;
          addWorldParticle(salvoPuff(r, u));
        }
      }
      if (!left) salvos.splice(i, 1);
    }
  }

  function jolt(amount, flashLevel = 0) {
    shake = Math.min(MAX_SHAKE, shake + amount);
    flash = Math.max(flash, flashLevel);
  }

  /** Puffs alive, kept by hand so the ceiling needs no pass over the list. */
  let puffs = 0;

  /** Particles at the muzzles (cases, sparks, smoke, tracers): a ceiling of their own inside the one above. */
  let muzzleParticles = 0;

  /** A particle in the world that an emplacement or a rocket threw off (towerFx.js). */
  function addWorldParticle(spec) {
    if (muzzleParticles + balls >= FX_MAX_PARTICLES) return;
    const before = particles.length;
    addParticle({ ...spec, world: true, max: spec.life });
    if (particles.length > before) muzzleParticles += 1;
  }

  function addParticle(p) {
    if (particles.length >= MAX_PARTICLES) return;
    if (p.kind === 'puff') {
      if (puffs >= MAX_PUFFS) return;
      puffs += 1;
    }
    particles.push(p);
  }

  /**
   * A puff of dust, smoke or steam. It spreads, thins out and clears up (the palette runs
   * from dark to light) and is gone after `life` seconds, never more than SMOKE_SECONDS.
   * @param {{angle: number, speed: number, rise?: number, life: number, size: number, grow: number,
   *   drag: number, alpha: number, wind?: number, from?: number, delay?: number}} o  `angle` is the way it
   *   travels over the ground, `from` how far out it starts, `delay` how long it waits before it shows.
   */
  function addPuff(pal, sx, sy, o) {
    const delay = o.delay ?? 0;
    const life = Math.min(o.life, SMOKE_SECONDS - delay);
    const from = o.from ?? 0;
    addParticle({
      kind: 'puff',
      pal,
      delay,
      x: sx + Math.cos(o.angle) * from,
      y: sy + Math.sin(o.angle) * from * 0.5,
      vx: Math.cos(o.angle) * o.speed,
      vy: Math.sin(o.angle) * o.speed * 0.5 - (o.rise ?? 0),
      drag: o.drag,
      wind: o.wind ?? 0,
      gravity: 0,
      size: o.size,
      grow: o.grow,
      alpha: o.alpha,
      life,
      max: life,
    });
  }

  /** A chunk of the ground or of the shell: it flies, lands, bounces and lies. */
  function addChunk(sx, sy, o) {
    addParticle({
      kind: 'chunk',
      gx: sx,
      gy: sy,
      z: o.z,
      vgx: Math.cos(o.angle) * o.speed,
      vgy: Math.sin(o.angle) * o.speed * 0.5,
      vz: o.vz,
      g: 900,
      size: o.size,
      col: o.col,
      rot: Math.random() * TAU,
      spin: (Math.random() - 0.5) * 18,
      x: sx,
      y: sy,
      gravity: 0,
      life: o.life,
      max: o.life,
    });
  }

  function burst(x, y, z, kind, count, options = {}) {
    const [sx, sy] = project(x, y, z);
    burstAt(sx, sy, kind, count, options);
  }

  /** The same, but from a point that is already in screen space (an anchor). */
  function burstAt(sx, sy, kind, count, { speed = 60, size = 3, grow = 0, life = 0.5, gravity = 120, sideways = null } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      // `sideways`: a screen direction; the piece goes out along it, to one side or the other.
      const push = sideways ? (i % 2 ? 1 : -1) * v : 0;
      // One drawn lifetime, not two: a particle that lived longer than `life`
      // used to grow past its own size and end up with a negative radius.
      const span = life * (0.7 + Math.random() * 0.6);
      addParticle({
        kind,
        x: sx,
        y: sy,
        vx: sideways ? sideways[0] * push : Math.cos(a) * v,
        vy: sideways ? sideways[1] * push - v * 0.35 : Math.sin(a) * v * 0.5 - v * 0.35,
        gravity,
        size: size * (0.7 + Math.random() * 0.6),
        grow,
        life: span,
        max: span,
      });
    }
  }

  function addRing(x, y, { radius = 3, life = 0.5, colour = '#ffe6b4', width = 4, wash = false } = {}) {
    if (rings.length >= MAX_RINGS) rings.shift();
    // `wash`: a ring that runs out fast and thins as it goes, with a pale wash inside it.
    rings.push({ x, y, radius, life, max: life, colour, width, wash });
  }

  function addWord(x, y, text, size = 34) {
    if (words.length >= MAX_WORDS) words.shift();
    const [sx, sy] = project(x, y, 90);
    words.push({ x: sx, y: sy, text, size, life: 0.9, max: 0.9 });
  }

  function addDecal(decal) {
    if (decals.length >= MAX_DECALS) decals.shift();
    decals.push(decal);
  }

  function addNumber(x, y, amount, colour) {
    if (numbers.length >= MAX_NUMBERS) numbers.shift();
    const [sx, sy] = project(x, y, 26);
    numbers.push({ x: sx + (Math.random() - 0.5) * 10, y: sy, amount, colour, life: 0.75, max: 0.75 });
  }

  /**
   * Where a shot, beam or soul-strike leaves the figure on screen: the muzzle
   * of the top, not the middle of the cell. The tops sit up on the roof and
   * their barrels point off to the side, so the middle of the cell is visibly
   * wrong (the effect appeared to start inside the housing).
   */
  function muzzleOrigin(state, event) {
    const tower = towerById(state, event.towerId);
    return tower ? onField(tower, towerAnchor(tower)) : null;
  }

  /** Takes one simulation event. Unknown events are ignored on purpose. */
  /** The record of the mortar shell an `explosion` event belongs to, found by its end point; null if none. */
  function shellOf(event) {
    for (const rec of mortarShells.values()) {
      if (!rec.exploded && rec.x === event.x && rec.y === event.y) return rec;
    }
    return null;
  }

  function handle(event, state, reducedMotion) {
    const colour = DOCTRINE_COLORS[event.doctrine] ?? C.gold;
    // The turned weapons draw their own fire at the barrel (towerFx.js), those of the recipe emplacements
    // too; the simulation only tells it where the shot went. What is left below is for an emplacement that
    // is gone by the time its event is read.
    if (event.type === 'shot' || event.type === 'beam' || event.type === 'chain' || event.type === 'launch' || event.type === 'soulfire') {
      const tower = towerById(state, event.towerId);
      if (tower && isTurreted(tower)) {
        noteTowerEvent(tower, event);
        return;
      }
    }
    if (event.type === 'shot') {
      // The storm battery fires blue tracer, not the brass of the doctrine it
      // is built from (docs/ART.md, "Spezialstellungen").
      const shade = event.tracer ?? colour;
      const origin = muzzleOrigin(state, event);
      shots.push({ kind: 'shot', x: event.x, y: event.y, tx: event.tx, ty: event.ty, origin, colour: shade, life: FLASH_SECONDS });
    } else if (event.type === 'beam') {
      shots.push({ kind: 'beam', x: event.x, y: event.y, tx: event.tx, ty: event.ty, origin: muzzleOrigin(state, event), colour, life: BEAM_SECONDS });
    } else if (event.type === 'emberJump') {
      // A short ember arc from the one that is alight to the one catching fire.
      shots.push({
        kind: 'chain',
        points: [event.from, event.to],
        origin: null,
        colour: '#ff8a2a',
        life: BEAM_SECONDS * 1.6,
      });
      if (!reducedMotion) burst(event.to.x, event.to.y, 10, 'fire', 4, { speed: 35, size: 3, life: 0.35, gravity: -30 });
    } else if (event.type === 'soulfire') {
      // The obelisk's judgement: one beam out of the eye at its tip to the one
      // thing it is passing judgement on (docs/ART.md).
      shots.push({ kind: 'beam', x: event.x, y: event.y, tx: event.tx, ty: event.ty, origin: muzzleOrigin(state, event), colour, life: BEAM_SECONDS * 2 });
      if (!reducedMotion) burst(event.tx, event.ty, 14, 'warp', 10, { speed: 60, size: 3, life: 0.5, gravity: -40 });
    } else if (event.type === 'chain') {
      shots.push({
        kind: 'chain',
        points: event.points,
        origin: null,
        colour,
        life: BEAM_SECONDS,
      });
    } else if (event.type === 'launch') {
      shots.push({ kind: 'shot', x: event.x, y: event.y, tx: event.tx, ty: event.ty, colour, life: FLASH_SECONDS });
      burst(event.x, event.y, 22, 'smoke', reducedMotion ? 2 : 5, { speed: 26, size: 4, grow: 6, life: 0.7, gravity: -10 });
    } else if (event.type === 'explosion' && !event.source && shellOf(event)) {
      // A shell of a mortar we have been watching: the rocket launcher's salvo makes its own small blasts (the
      // middle rocket lands now), the siege mortar its big impact (watchShells). What stays is the scorch, and
      // for the launcher the jolt; the big impact does not shake the picture.
      const known = shellOf(event);
      known.exploded = true;
      addDecal({ kind: 'scorch', x: event.x, y: event.y, radius: event.radius, life: 12, max: 12 });
      if (!known.siege) jolt(SHAKE.explosion * event.radius);
    } else if (event.type === 'explosion') {
      shots.push({ kind: 'blast', x: event.x, y: event.y, radius: event.radius, colour, life: 0.3 });
      if (event.source === 'orbitalStrike') {
        // A lance from orbit: a column of light, a wide ring and a white flash.
        shots.push({ kind: 'lance', x: event.x, y: event.y, radius: event.radius, life: 0.5 });
        addRing(event.x, event.y, { radius: event.radius * 2.4, life: 0.7, colour: '#fff3c4', width: 6 });
        addWord(event.x, event.y, STRINGS.effects.orbitalStrike, 34);
        jolt(MAX_SHAKE, 0.6);
        burst(event.x, event.y, 0, 'dust', reducedMotion ? 8 : 22, {
          speed: 170, size: 7, grow: 22, life: 1.3, gravity: -6,
        });
      }
      burst(event.x, event.y, 6, 'fire', reducedMotion ? 6 : 14, { speed: 90, size: 5, grow: 4, life: 0.5 });
      burst(event.x, event.y, 6, 'smoke', reducedMotion ? 3 : 7, { speed: 50, size: 6, grow: 9, life: 1.1, gravity: -20 });
      addDecal({ kind: 'scorch', x: event.x, y: event.y, radius: event.radius, life: 12, max: 12 });
      jolt(SHAKE.explosion * event.radius);
    } else if (event.type === 'kill') {
      burst(event.x, event.y, 10, 'goo', reducedMotion ? 3 : 7, { speed: 70, size: 3.5, life: 0.6 });
      addDecal({ kind: 'goo', x: event.x, y: event.y, radius: 0.35, life: 9, max: 9 });
      if (event.boss) jolt(SHAKE.bossKill, FLASH.bossKill);
    } else if (event.type === 'leak') {
      burst(event.x, event.y, 12, 'warp', 8, { speed: 60, size: 4, grow: 3, life: 0.6, gravity: -30 });
      jolt(SHAKE.leak);
    } else if (event.type === 'podImpact') {
      podImpact(event, reducedMotion);
    } else if (event.type === 'stasis') {
      fields.push({ x: event.x, y: event.y, radius: event.radius, life: event.seconds, max: event.seconds });
    } else if (event.type === 'kolossBreach') {
      // The ram goes through: dust and debris cell by cell along the swathe, and
      // a shout, because this is the moment the maze the player built gives way.
      // The plough pushes the rubble to both sides of the swathe, across the way it drives.
      const cells = event.cells;
      const along = cells.length > 1 ? [Math.sign(cells[1].x - cells[0].x), Math.sign(cells[1].y - cells[0].y)] : null;
      const sideways = along ? sidewaysOnScreen(along[0], along[1]) : null;
      for (const c of cells) {
        burst(c.x + 0.5, c.y + 0.5, 0, 'dust', reducedMotion ? 6 : 16, {
          speed: 140, size: 8, grow: 18, life: 1.2, gravity: -6, sideways,
        });
        burst(c.x + 0.5, c.y + 0.5, 8, 'debris', reducedMotion ? 4 : 12, {
          speed: KOLOSS_DEBRIS_SIDE_SPEED, size: 3.5, life: 1, gravity: 420, sideways,
        });
      }
      addRing(event.x, event.y, { radius: 3.4, life: 0.7, width: 6 });
      jolt(SHAKE.podImpact, FLASH.podImpact);
      addWord(event.x, event.y, STRINGS.effects.kolossBreach, 40);
    } else if (event.type === 'kolossArrived') {
      jolt(SHAKE.bossKill, FLASH.bossKill);
      addRing(event.x, event.y, { radius: 2.6, life: 0.8, colour: '#ff6a4a', width: 5 });
    } else if (event.type === 'airstrikeRun') {
      // The run is announced; the bombs arrive one by one as their own events.
      addWord((event.from.x + event.to.x) / 2, (event.from.y + event.to.y) / 2, STRINGS.effects.airstrike, 34);
    } else if (event.type === 'airstrikeBomb') {
      burst(event.x, event.y, 6, 'fire', reducedMotion ? 3 : 10, { speed: 90, size: 6, grow: 12, life: 0.4 });
      burst(event.x, event.y, 0, 'dust', reducedMotion ? 4 : 10, { speed: 110, size: 6, grow: 15, life: 1.1, gravity: -6 });
      addRing(event.x, event.y, { radius: event.radius, life: 0.45, width: 4 });
      addDecal({ kind: 'scorch', x: event.x, y: event.y, radius: event.radius * 0.7, life: 14, max: 14 });
      jolt(SHAKE.airstrike, FLASH.airstrike);
    } else if (event.type === 'command' && event.id === 'prioritySupply') {
      // No target on the map: the order goes out from the bastion.
      const { x, y } = state.map.bastion;
      // The middle of the bastion, whichever size it is (M7b: 2 x 2).
      const half = state.map.bastionCells ? Math.sqrt(state.map.bastionCells.length) / 2 : 0.5;
      burst(x + half, y + half, 30, 'spark', reducedMotion ? 6 : 18, { speed: 90, size: 2.5, life: 0.8, gravity: -120 });
      addRing(x + half, y + half, { radius: 2.2, life: 0.7, colour: C.gold, width: 4 });
    }
  }

  /**
   * Floating damage numbers: the render side watches the health of every enemy
   * instead of the simulation reporting each hit, which would flood the events.
   */
  function collectDamage(state, dt) {
    for (const e of state.enemies) {
      const total = e.health + e.shield;
      let entry = tally.get(e);
      if (!entry) {
        entry = { last: total, pending: 0, time: 0 };
        tally.set(e, entry);
        continue;
      }
      if (total < entry.last) entry.pending += entry.last - total;
      entry.last = total;
      entry.time += dt;
      if (entry.pending > 0 && entry.time >= NUMBER_INTERVAL) {
        addNumber(e.x, e.y, Math.round(entry.pending), e.shield > 0 ? C.warpL : C.bone);
        entry.pending = 0;
        entry.time = 0;
      }
    }
  }

  /**
   * The landing (docs/ART.md, "Nachschubkapsel"): a white-hot flash and a fireball behind the
   * capsule, two shock rings on the ground, a skirt of dust, billows of smoke, earth and
   * chunks, sparks, a burn mark with cracks, the shout. Dust and smoke are gone after
   * SMOKE_SECONDS.
   */
  function podImpact(event, reducedMotion) {
    const cx = event.x + 0.5;
    const cy = event.y + 0.5;
    const [sx, sy] = project(cx, cy);
    const pick = (counts) => (reducedMotion ? counts[1] : counts[0]);
    jolt(SHAKE.podImpact, FLASH.podImpact);

    addParticle({ kind: 'glare', x: sx, y: sy, vx: 0, vy: 0, gravity: 0, size: 44, grow: 0, life: 0.14, max: 0.14 });
    burstAt(sx, sy - 8, 'blaze', pick(POD.fire), { speed: 70, size: 14, grow: 14, life: 0.3, gravity: 0 });
    for (let i = 0, n = pick(POD.skirt); i < n; i++) {
      addPuff('dust', sx, sy - 3, {
        angle: (i / n) * TAU + between(-0.15, 0.15), speed: between(170, 260), rise: between(8, 28), from: 10,
        life: between(1.3, 1.9), size: 6, grow: between(18, 26), drag: 2.4, alpha: 0.62,
      });
    }
    for (let i = 0, n = pick(POD.billows); i < n; i++) {
      addPuff('soot', sx, sy - 6, {
        angle: between(0, TAU), speed: between(10, 60), rise: between(95, 160), from: between(12, 26), delay: between(0.08, 0.4),
        life: between(2.6, 3.1), size: 12, grow: between(20, 32), drag: 1, alpha: 0.55, wind: 16,
      });
    }
    for (let i = 0, n = pick(POD.chunks); i < n; i++) {
      addChunk(sx, sy, {
        angle: between(0, TAU), speed: between(40, 190), z: 6, vz: between(260, 470),
        size: between(2.5, 6.5), col: i % 5 === 0 ? C.steelL : CHUNK_COLORS[i % 3], life: between(1.9, 2.5),
      });
    }
    burstAt(sx, sy - 10, 'spark', pick(POD.sparks), { speed: 220, size: 2, life: 0.4, gravity: 600 });

    addRing(cx, cy, { radius: 4.1, life: 0.55, width: 9, colour: '#fff0d4', wash: true });
    addRing(cx, cy, { radius: 2.84, life: 0.75, width: 5, colour: '#ffae60', wash: true });
    // The burn mark: a scorched patch with cracks that glow while the ground cools.
    const cracks = [];
    for (let i = 0; i < 9; i++) {
      cracks.push({
        a: (i / 9) * TAU + between(-0.2, 0.2), len: between(14, 34), kink: between(-0.35, 0.35), branch: between(0.45, 0.7),
      });
    }
    addDecal({ kind: 'crater', x: cx, y: cy, radius: 0.9, life: 30, max: 30, cracks });
    // Only the first pod of a salvo shouts; five words at once are noise.
    if (event.index === 0) addWord(cx, cy, STRINGS.effects.podImpact, 38);
  }

  /**
   * What a pod throws off after it has landed: the explosive bolts, dust and chunks when
   * each segment lies down, and steam out of the roof while the core cools.
   */
  function stagePods(state, dt, reducedMotion) {
    for (const pod of state.pods) {
      if (!pod.landed) continue;
      const since = sinceImpact(pod);
      let mark = staged.get(pod);
      if (!mark) {
        mark = { bolts: false, slams: 0, steam: 0 };
        staged.set(pod, mark);
      }
      const [sx, sy] = project(pod.x + 0.5, pod.y + 0.5);
      if (!mark.bolts && since >= POD.bolts) {
        mark.bolts = true;
        jolt(3);
        const [bx, by] = project(pod.x + 0.5, pod.y + 0.5, POD.seam);
        burstAt(bx, by, 'bolt', reducedMotion ? 3 : 5, { speed: 150, size: 3, life: 1, gravity: 520 });
        burstAt(bx, by, 'spark', reducedMotion ? 3 : 6, { speed: 180, size: 2, life: 0.3, gravity: 300 });
        // A puff of steam at every seam.
        for (let i = 0, n = reducedMotion ? 2 : 4; i < n; i++) {
          addPuff('steam', bx, by, {
            angle: POD_PETALS[i].angle, speed: 30, life: 0.9, size: 3, grow: 10, drag: 2, alpha: 0.8,
          });
        }
      }
      // One burst of dust per segment, as it comes down: in the order they open, on the side they fall.
      while (mark.slams < 4 && since >= petalLands(mark.slams)) {
        const petal = POD_PETALS.find((p) => p.id === POD_PETAL_ORDER[mark.slams]);
        mark.slams += 1;
        jolt(2);
        const reach = POD.petalReach * POD.openScale * POD.slamReach;
        const px = sx + Math.cos(petal.angle) * reach;
        const py = sy + Math.sin(petal.angle) * reach * 0.5;
        for (let i = 0, n = reducedMotion ? 2 : 3; i < n; i++) {
          addPuff('dust', px, py, {
            angle: petal.angle + between(-0.5, 0.5), speed: between(50, 120), rise: between(6, 20),
            life: between(0.9, 1.4), size: 5, grow: between(11, 19), drag: 2.2, alpha: 0.8,
          });
        }
        if (!reducedMotion) {
          for (let i = 0; i < 2; i++) {
            addChunk(px, py, {
              angle: petal.angle + between(-0.6, 0.6), speed: between(40, 100), z: 3, vz: between(120, 220),
              size: between(2, 4), col: CHUNK_COLORS[i], life: between(0.9, 1.3),
            });
          }
        }
      }
      if (reducedMotion) continue;
      while (mark.steam < POD.steamPuffs && since >= POD.steamFrom + mark.steam * POD.steamStep) {
        mark.steam += 1;
        const [vx, vy] = project(pod.x + 0.5, pod.y + 0.5, POD.roof);
        addPuff('steam', vx, vy, {
          angle: between(0, TAU), speed: between(2, 10), rise: between(24, 40),
          life: between(1.2, 1.6), size: 4, grow: between(10, 13), drag: 1, alpha: 0.6, wind: 12,
        });
      }
    }
  }

  /**
   * Takes over what the muzzles queued during the last drawing, and lets the rockets in flight leave
   * their smoke. The rocket follows the shell of the simulation; this only draws a trail behind it.
   */
  function takeOverMuzzleFire(state, dt, reducedMotion) {
    // The fireballs of the flames count against the ceiling of the muzzles: they are alive over the
    // emplacements, so they are counted before the queued particles are let in, and what is left once those
    // are in is the room the flames may throw new ones into until the next update.
    balls = ballsAlive(state.towers);
    for (const tower of state.towers) {
      const queued = drainFxQueue(tower);
      if (queued) for (const spec of queued) addWorldParticle(spec);
      const extra = drainFxExtra(tower);
      if (extra) takeExtra(tower, extra, reducedMotion);
    }
    setBallRoom(Math.max(0, FX_MAX_PARTICLES - muzzleParticles - balls));
    watchShells(state, reducedMotion);
    stepSalvos(state, dt, reducedMotion);
    for (const shell of state.projectiles) {
      const tower = towerById(state, shell.towerId);
      // The rockets of the launcher smoke by salvo (stepSalvos); the heavy rocket of the siege mortar smokes thick.
      if (!tower || !isTurreted(tower) || !tower.special) continue;
      const rec = launchOf(shell, tower, false);
      if (rec) for (const spec of bigRocketTrail(rec, shell, dt)) addWorldParticle(spec);
    }
  }

  /** A chunk on the ground plane: it rises and falls, bounces a little and slides to rest. */
  function moveChunk(p, dt) {
    p.gx += p.vgx * dt;
    p.gy += p.vgy * dt;
    if (p.z > 0 || p.vz > 0) {
      p.z += p.vz * dt;
      p.vz -= p.g * dt;
      p.rot += p.spin * dt;
    }
    if (p.z <= 0) {
      p.z = 0;
      if (p.vz < -60) {
        p.vz = -p.vz * 0.32;
        p.vgx *= 0.5;
        p.vgy *= 0.5;
      } else {
        p.vz = 0;
        const f = Math.exp(-6 * dt);
        p.vgx *= f;
        p.vgy *= f;
      }
    }
    p.x = p.gx;
    p.y = p.gy - p.z;
  }

  function update(dt, state, reducedMotion) {
    for (const event of state.events) handle(event, state, reducedMotion);
    collectDamage(state, dt);
    stagePods(state, dt, reducedMotion);
    clock += dt;
    takeOverMuzzleFire(state, dt, reducedMotion);

    // Fast decay: the jolt should be over before the next shot lands.
    shake = Math.max(0, shake * Math.pow(0.02, dt) - dt * 2);
    flash = Math.max(0, flash - dt * 3.2);

    for (let i = shots.length - 1; i >= 0; i--) {
      shots[i].life -= dt;
      if (shots[i].life <= 0) shots.splice(i, 1);
    }
    for (let i = lights.length - 1; i >= 0; i--) {
      lights[i].level -= dt / lights[i].fade;
      if (lights[i].level <= 0) lights.splice(i, 1);
    }
    for (const list of [patches, pressure, impacts, craters]) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].age += dt;
        if (list[i].age >= list[i].max) list.splice(i, 1);
      }
    }
    if (brighten.life > 0) brighten.life = Math.max(0, brighten.life - dt);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        if (p.kind === 'puff') puffs -= 1;
        if (p.world) muzzleParticles -= 1;
        particles.splice(i, 1);
        continue;
      }
      if (p.world) {
        stepWorldParticle(p, dt);
        continue;
      }
      if (p.kind === 'chunk') {
        moveChunk(p, dt);
        continue;
      }
      if (p.drag) {
        const f = Math.exp(-p.drag * dt);
        p.vx *= f;
        p.vy *= f;
      }
      p.x += (p.vx + (p.wind ?? 0)) * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
    }
    for (let i = decals.length - 1; i >= 0; i--) {
      decals[i].life -= dt;
      if (decals[i].life <= 0) decals.splice(i, 1);
    }
    for (let i = numbers.length - 1; i >= 0; i--) {
      const n = numbers[i];
      n.life -= dt;
      if (n.life <= 0) numbers.splice(i, 1);
      else n.y -= 26 * dt;
    }
    for (const list of [rings, words, fields]) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].life -= dt;
        if (list[i].life <= 0) list.splice(i, 1);
      }
    }
  }

  // ---------- Drawing ----------

  /**
   * The lights that stay while an emplacement stands: the fire of the cauldron, the ball of the thunder
   * tower, the shrine (brighter the more its aura is up). They fill what the kicked lights leave of the
   * FX_LIGHT.max.
   */
  function idleLights(state, t, reducedMotion) {
    const out = [];
    for (const tower of state.towers) {
      if (lights.length + out.length >= FX_LIGHT.max) break;
      const kind = weaponKind(tower);
      const L = FX_LIGHT[kind];
      if (!L?.idle) continue;
      const flick = reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 13 + tower.x);
      const a = (L.idle.a + (kind === 'purgeShrine' ? L.a * auraLevel(tower) : 0)) * flick;
      out.push({ x: tower.x + 0.5, y: tower.y + 0.5, r: L.idle.r, colour: L.colour, a });
    }
    return out;
  }

  /** A light on the ground of its field, kept on its own level like the other marks lying there. */
  function drawLight(ctx, l, alpha) {
    const [x, y] = onPlane(l.x, l.y);
    if (!onCanvas(ctx, x, y, l.r * CELL_RX)) return;
    const R = l.r * CELL_RX;
    onGround(ctx, l.x, l.y, Math.ceil(l.r) + 1, () => groundLight(ctx, x, y, l.r, l.colour, alpha), [x - R, y - R / 2, x + R, y + R / 2]);
  }

  /** The ground side of the weapon effects: lights, burning patches, pressure rings. */
  function drawWeaponGround(ctx, state, t, reducedMotion, zoom) {
    for (const l of idleLights(state, t, reducedMotion)) drawLight(ctx, l, l.a);
    for (const l of lights) drawLight(ctx, l, lightAlpha(l));
    for (const p of patches) {
      const [x, y] = onPlane(p.x, p.y);
      if (!onCanvas(ctx, x, y, FX_BURN.glow)) continue;
      onGround(ctx, p.x, p.y, 1, () => drawBurnPatch(ctx, x, y, p.age / p.max, t, p.seed, reducedMotion, zoom >= FX_BURN.flameZoom));
    }
    for (const c of craters) {
      const [x, y] = onPlane(c.x, c.y);
      if (!onCanvas(ctx, x, y, c.r * CELL_RX)) continue;
      onGround(ctx, c.x, c.y, Math.ceil(c.r) + 1, () => drawCrater(ctx, x, y, c.r, c.age / c.max));
    }
    for (const r of pressure) {
      if (r.age < 0) continue;
      const [x, y] = onPlane(r.x, r.y);
      if (!onCanvas(ctx, x, y, r.r * CELL_RX)) continue;
      onGround(ctx, r.x, r.y, Math.ceil(r.r) + 1, () => drawPressureRing(ctx, x, y, r.r, r.age / r.max, r.colour, r.width, reducedMotion));
    }
  }

  /** Scorch marks, goo and the ground side of auras and cones. */
  function drawGround(ctx, state, t, reducedMotion, zoom = 1) {
    for (const d of decals) {
      const a = Math.min(1, d.life / 2);
      const [x, y] = onPlane(d.x, d.y);
      // The burn mark reaches two fields, a scorch as far as its radius, goo one.
      const reach = d.kind === 'crater' ? 2 : d.kind === 'scorch' ? Math.ceil(d.radius) + 1 : 1;
      ctx.globalAlpha = a;
      // A scorch is a square of its gradient squashed to half the height; the other marks do not say their box.
      const r = d.radius * 32;
      const box = d.kind === 'scorch' ? [x - r, y - r / 2, x + r, y + r / 2] : null;
      onGround(ctx, d.x, d.y, reach, () => {
        if (d.kind === 'scorch') {
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(1, 0.5);
          const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
          g.addColorStop(0, 'rgba(18,12,9,.8)');
          g.addColorStop(1, 'rgba(18,12,9,0)');
          ctx.fillStyle = g;
          ctx.fillRect(-r, -r, r * 2, r * 2);
          ctx.restore();
        } else if (d.kind === 'crater') {
          drawBurnMark(ctx, d, x, y);
        } else {
          ell(ctx, x, y, d.radius * 26, d.radius * 13, C.toxicD, 'rgba(26,20,16,.6)', 1);
        }
      }, box);
    }
    ctx.globalAlpha = 1;

    // Shockwaves run out over the ground.
    for (const ring of rings) {
      const u = 1 - ring.life / ring.max;
      const [x, y] = onPlane(ring.x, ring.y);
      const spread = ring.wash ? 1 - (1 - u) * (1 - u) : u;
      const rx = (0.3 + spread) * ring.radius * 32;
      ctx.globalAlpha = (1 - u) * 0.9;
      const half = ring.width / 2 + 1;
      const box = [x - rx - half, y - rx / 2 - half, x + rx + half, y + rx / 2 + half];
      onGround(ctx, ring.x, ring.y, Math.ceil(ring.radius) + 1, () => {
        ctx.strokeStyle = ring.colour;
        ctx.lineWidth = ring.width * (1 - u * 0.6);
        ctx.beginPath();
        ctx.ellipse(x, y, rx, rx * 0.5, 0, 0, Math.PI * 2);
        if (ring.wash) {
          ctx.fillStyle = `rgba(255,236,200,${0.1 * (1 - u)})`;
          ctx.fill();
        }
        ctx.stroke();
      }, box);
    }
    ctx.globalAlpha = 1;

    // Stasis: a lattice of ice over everything inside the field.
    for (const field of fields) drawStasis(ctx, field, t, reducedMotion);

    // Orbital strikes counting down, airstrikes warning, and the banners
    // standing this wave.
    for (const hit of state.pendingStrikes) {
      if (hit.kind === 'airstrike') {
        if (hit.t < hit.warnSeconds) drawAirstrikeWarning(ctx, hit, t);
        continue;
      }
      const u = Math.min(1, hit.t / hit.warnSeconds);
      drawTargetRing(ctx, hit.x, hit.y, hit.radius, '#ff6a4a', reducedMotion ? 0.7 : 0.45 + u * 0.5, 1 - u * 0.25);
      const [x, y] = project(hit.x, hit.y, 0);
      comicText(ctx, String(Math.ceil(hit.warnSeconds - hit.t)), x, y - 8, 22, '#ff9a6a');
    }
    for (const banner of state.banners) {
      drawTargetRing(ctx, banner.x, banner.y, banner.radius, C.gold, 0.5, 1);
      drawHolyBanner(ctx, banner, t, reducedMotion);
    }

    for (const tower of state.towers) {
      const stats = towerStats(tower);
      // The psi emplacement's ring is up whether it is working or not: it is
      // part of the figure, not of its fire (docs/ART.md, "Aufsätze").
      if (stats.behaviour === 'psi') {
        drawStandingAura(ctx, tower, stats, t, reducedMotion);
        continue;
      }
      // The behaviour, not the doctrine: a purge shrine is a flame tower with a ring. Its gold aura stands on
      // the ground all the time and rises while it works (docs/ART.md, "Spezialstellungen"). The flame jets
      // of the weapons are drawn at their nozzle (towerFx.js).
      if (stats.behaviour === 'aura') drawAura(ctx, tower, stats, t, reducedMotion);
    }
    drawWeaponGround(ctx, state, t, reducedMotion, zoom);
    drawBlaze(ctx);
  }

  /**
   * The run before the gunship comes in: a yellow dashed line along the axis it
   * will fly, and a mark on every cell a bomb is going to fall on, so there is
   * time to see what is about to happen (GDD section 11).
   */
  function drawAirstrikeWarning(ctx, hit, t) {
    const a = project(hit.from.x, hit.from.y);
    const b = project(hit.to.x, hit.to.y);
    ctx.save();
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = -t * 30;
    ctx.strokeStyle = '#ffb13b';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.restore();
    for (const drop of hit.drops) {
      const [x, y] = project(drop.x, drop.y);
      ell(ctx, x, y, 10, 5, null, '#ffb13b', 2);
    }
  }

  /** The holy banner standing in the middle of its field for the rest of the wave. */
  function drawHolyBanner(ctx, banner, t, reducedMotion) {
    const [x, y] = project(banner.x, banner.y);
    const top = y - 78;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, top);
    ctx.stroke();
    ctx.strokeStyle = C.steelL;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    const wave = reducedMotion ? 0 : Math.sin(t * 2.5) * 5;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.quadraticCurveTo(x - 18, top - wave, x - 34, top + wave * 0.6);
    ctx.lineTo(x - 34, top + 32 + wave * 0.6);
    ctx.quadraticCurveTo(x - 18, top + 26 - wave, x, top + 24);
    ctx.closePath();
    ctx.fillStyle = C.gold;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    // A skull on the cloth, like the banners on the ruins.
    ell(ctx, x - 17, top + 12, 5, 5.5, C.bone, C.ink, 1.4);
    ell(ctx, x - 19, top + 11, 1.4, 1.4, C.ink, null);
    ell(ctx, x - 15, top + 11, 1.4, 1.4, C.ink, null);
    ell(ctx, x, top, 3, 3, C.gold, C.ink, 1.5);
  }

  /** A stasis field: a cold disc with a crystal lattice, fading as it runs out. */
  function drawStasis(ctx, field, t, reducedMotion) {
    const [x, y] = onPlane(field.x, field.y);
    const r = field.radius * 32;
    const fade = Math.min(1, field.life / 0.6);
    ctx.save();
    clipToGround(ctx, activeTerrain(), Math.floor(field.x), Math.floor(field.y), Math.ceil(field.radius) + 1);
    ctx.translate(x, y);
    ctx.scale(1, 0.5);
    ctx.globalAlpha = fade * 0.55;
    const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    g.addColorStop(0, 'rgba(190,235,255,.5)');
    g.addColorStop(1, 'rgba(120,190,230,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = fade * 0.9;
    ctx.strokeStyle = '#bff2ff';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Six ice shards standing in the ring, turning very slowly. Each gets an
    // ink underlay, so it reads as a crystal in the comic style and not as a
    // plain cyan line (docs/ART.md, Kommando-Durchsicht).
    ctx.rotate(reducedMotion ? 0 : t * 0.4);
    ctx.lineCap = 'round';
    for (const [width, stroke] of [[4.5, C.ink], [2.5, 'rgba(223,246,255,.9)']]) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25);
        ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Flat ring on the ground: aiming, orbital strikes, banners. */
  function drawTargetRing(ctx, x, y, radius, colour, alpha, scale = 1) {
    const [sx, sy] = project(x, y);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 0.5);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 32 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /**
   * The psi emplacement's standing ring: a dashed circle the size of its reach,
   * up for as long as the building is (docs/ART.md). Fainter than the shrine's,
   * because it is there all the time.
   */
  function drawStandingAura(ctx, tower, stats, t, reducedMotion) {
    const [x, y] = project(tower.x + 0.5, tower.y + 0.5);
    const colour = DOCTRINE_COLORS[stats.doctrine] ?? C.warpL;
    const r = stats.range * 32;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.5);
    ctx.globalAlpha = tower.firing ? 0.16 : 0.08;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = reducedMotion ? 0 : -t * 14;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /**
   * The aura of the purge shrine on the ground (since 0.11.21, issue 90): a flow of mist. It falls out of the
   * artefact, runs in waves to the rim of the reach and lies there as a bank; a thin gold line marks the reach.
   * The level (`auraLevel`) says how bright: dim while the shrine has nothing in reach, full while it works.
   * The enemies inside are gilded where they stand. The twelve runes are gone.
   */
  function drawAura(ctx, tower, stats, t, reducedMotion) {
    const level = auraLevel(tower);
    const cx = tower.x + 0.5;
    const cy = tower.y + 0.5;
    const R = stats.range;
    const [ox, oy] = project(cx, cy);
    if (!onCanvas(ctx, ox, oy, (R + 0.5) * CELL_RX)) return;
    const pour = artefactScreen(tower) ?? [ox, oy - FX_MIST.pourHeight];
    drawMistFlow(ctx, project, cx, cy, R, pour, level, t, reducedMotion);
  }

  /**
   * The burn mark of a landing: a scorched patch that grows in over a moment, a dark pit with its rim,
   * and cracks that glow while the ground cools.
   */
  function drawBurnMark(ctx, d, x, y) {
    const age = d.max - d.life;
    const grow = Math.min(1, age / 0.16);
    const k = grow * grow * (3 - 2 * grow);
    for (const [r, a] of [[64, 0.16], [48, 0.2], [32, 0.24]]) {
      ell(ctx, x, y, r * k, r * k * 0.5, `rgba(14,10,8,${a})`, null);
    }
    const pit = d.radius * 32 * 0.62 * k;
    ell(ctx, x, y, pit, pit * 0.5, '#2a211b', C.ink, 2);
    ctx.beginPath();
    ctx.ellipse(x, y, pit, pit * 0.5, 0, 0.25, Math.PI - 0.25);
    ctx.strokeStyle = '#7d6852';
    ctx.lineWidth = 2;
    ctx.stroke();
    const cool = Math.max(0, 1 - age / SMOKE_SECONDS);
    ctx.lineCap = 'round';
    for (const c of d.cracks ?? []) {
      const len = c.len * k;
      const p0x = x + Math.cos(c.a) * 24;
      const p0y = y + Math.sin(c.a) * 12;
      const p1x = x + Math.cos(c.a + c.kink) * len * c.branch + Math.cos(c.a) * 12;
      const p1y = y + (Math.sin(c.a + c.kink) * len * c.branch + Math.sin(c.a) * 12) * 0.5;
      const p2x = x + Math.cos(c.a) * (24 + len);
      const p2y = y + Math.sin(c.a) * (24 + len) * 0.5;
      ctx.beginPath();
      ctx.moveTo(p0x, p0y);
      ctx.lineTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      if (cool > 0.02) {
        const keep = ctx.globalAlpha;
        ctx.globalAlpha = keep * cool * 0.7;
        ctx.strokeStyle = '#ff8a2a';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = keep;
      }
    }
  }

  /**
   * Fireball and flash of a landing. They are drawn in the ground pass, behind the figures, so
   * the capsule steps out of the fire early instead of being hidden by it.
   */
  function drawBlaze(ctx) {
    for (const p of particles) {
      if (p.kind !== 'blaze' && p.kind !== 'glare') continue;
      const u = p.life / p.max;
      if (p.kind === 'glare') {
        ctx.globalAlpha = u * 0.7;
        ell(ctx, p.x, p.y, p.size * 1.7, p.size * 0.85, 'rgba(255,214,140,.55)', null);
        ell(ctx, p.x, p.y, p.size, p.size * 0.5, '#fff4cc', null);
        continue;
      }
      const r = Math.max(0.5, p.size + (1 - u) * p.grow);
      const col = u > 0.72 ? '#fff3b0' : u > 0.45 ? '#ffb13b' : u > 0.22 ? '#e2531f' : '#5a3a2e';
      ctx.globalAlpha = u > 0.22 ? 0.95 : u * 4.3;
      ell(ctx, p.x, p.y, r, r * 0.9, col, null);
    }
    ctx.globalAlpha = 1;
  }

  /** Shells, flashes, beams, particles and numbers, on top of everything. */
  function drawAbove(ctx, state, t, reducedMotion) {
    // The gunship flies over everything else while its run lasts.
    for (const hit of state.pendingStrikes) {
      if (hit.kind === 'airstrike' && hit.t >= hit.warnSeconds) drawGunship(ctx, hit, t, reducedMotion);
    }
    for (const shell of state.projectiles) {
      // The rockets of the launcher leave the pod and fall on the point of the shell of the simulation.
      const owner = towerById(state, shell.towerId);
      if (owner && isTurreted(owner)) {
        // Nothing for the one frame before the drawing has seen the shot leave.
        const rec = launchOf(shell, owner);
        if (rec && owner.special) drawBigRocket(ctx, rec, shell, DOCTRINE_COLORS.mortar, t);
        continue;
      }
      const u = Math.min(1, shell.t / shell.flight);
      const height = 4 * 70 * u * (1 - u);
      const [gx, gy] = project(shell.x, shell.y);
      shadow(ctx, gx, gy, 5, 2.5, 0.25);
      const [x, y] = project(shell.x, shell.y, height);
      ell(ctx, x, y, 4.5, 4.5, C.steelD, C.ink, 2);
      ell(ctx, x - 1, y - 1, 1.6, 1.6, C.steelL, null);
    }

    // The rockets of the salvos fly on after their shell has landed, so they are drawn from their own list.
    for (const v of salvos) {
      for (const r of v.rockets) {
        const u = r.landed ? -1 : salvoProgress(r, v.T);
        if (u >= 0 && u < 1) drawSalvoRocket(ctx, r, u);
      }
    }
    for (const im of impacts) {
      const [x, y] = project(im.x, im.y);
      if (onCanvas(ctx, x, y, im.r * CELL_RX)) drawBigImpact(ctx, x, y, im.r, im.age, im.seed, reducedMotion);
    }

    // Beams, bolts, jets and pulses that run towards the camera (the others are behind their weapon).
    for (const tower of state.towers) {
      if (isTurreted(tower)) drawTowerReach(ctx, tower, t);
    }

    // The same lights again, weaker and a little higher, so the emplacement and its targets are lit too.
    for (const l of lights) {
      const [x, y] = project(l.x, l.y);
      if (!onCanvas(ctx, x, y, l.r * CELL_RX)) continue;
      groundLight(ctx, x, y - FX_LIGHT.over.lift, l.r * FX_LIGHT.over.shrink, l.colour, lightAlpha(l) * FX_LIGHT.over.share);
    }

    for (const s of shots) {
      const a = Math.max(0, s.life / (s.kind === 'shot' ? FLASH_SECONDS : BEAM_SECONDS));
      if (s.kind === 'shot') drawMuzzle(ctx, s, a);
      else if (s.kind === 'beam') drawBeam(ctx, s, a);
      else if (s.kind === 'chain') drawChain(ctx, s, a, reducedMotion);
      else if (s.kind === 'blast') drawBlast(ctx, s);
      else if (s.kind === 'lance') drawLance(ctx, s);
    }

    for (const p of particles) {
      const u = p.life / p.max;
      if (p.kind === 'blaze' || p.kind === 'glare') continue;
      if (p.world) {
        drawWorldParticle(ctx, p, 1 - u);
        continue;
      }
      if (p.kind === 'puff') {
        if (!(p.delay > 0)) drawPuff(ctx, p, u);
        continue;
      }
      if (p.kind === 'chunk') {
        drawChunk(ctx, p, u);
        continue;
      }
      const r = Math.max(0.5, p.size + (1 - u) * p.grow);
      if (p.kind === 'fire') {
        const col = u > 0.72 ? '#fff3b0' : u > 0.45 ? '#ffb13b' : u > 0.22 ? '#e2531f' : '#5a3a2e';
        ctx.globalAlpha = u > 0.22 ? 1 : u * 3.5;
        ell(ctx, p.x, p.y, r, r, col, null);
      } else if (p.kind === 'smoke') {
        ctx.globalAlpha = u * 0.65;
        ell(ctx, p.x, p.y, r, r, SPARK.smoke, 'rgba(26,20,16,.5)', 1.2);
      } else if (p.kind === 'spark') {
        ctx.globalAlpha = u;
        ctx.strokeStyle = SPARK.spark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.kind === 'warp') {
        ctx.globalAlpha = u;
        ell(ctx, p.x, p.y, r, r, SPARK.warp, null);
      } else if (p.kind === 'dust') {
        ctx.globalAlpha = u * 0.7;
        ell(ctx, p.x, p.y, r, r * 0.7, '#9b8568', 'rgba(26,20,16,.35)', 1.2);
      } else if (p.kind === 'steam') {
        ctx.globalAlpha = u * 0.8;
        ell(ctx, p.x, p.y, r, r, '#e9e4da', 'rgba(26,20,16,.3)', 1.2);
      } else if (p.kind === 'debris') {
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.ink;
        ctx.fillRect(p.x - r / 2 - 1, p.y - r / 2 - 1, r + 2, r + 2);
        ctx.fillStyle = '#6a5a48';
        ctx.fillRect(p.x - r / 2, p.y - r / 2, r, r);
      } else if (p.kind === 'bolt') {
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.ink;
        ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
        ctx.fillStyle = C.steelL;
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      } else {
        ctx.globalAlpha = 1;
        ell(ctx, p.x, p.y, r, r, SPARK.goo, C.ink, 1.2);
      }
    }
    ctx.globalAlpha = 1;

    for (const n of numbers) {
      const a = Math.min(1, (n.life / n.max) * 2.2);
      ctx.globalAlpha = a;
      comicText(ctx, String(n.amount), n.x, n.y, 17, n.colour);
      ctx.globalAlpha = 1;
    }

    for (const w of words) {
      const u = 1 - w.life / w.max;
      ctx.globalAlpha = Math.min(1, w.life * 4);
      comicText(ctx, w.text, w.x, w.y - u * 26, Math.round(w.size * (0.7 + u * 0.4)), '#ffd23f');
      ctx.globalAlpha = 1;
    }
  }

  /** A puff of dust, smoke or steam: it grows quickly and slows, clears up and thins out. */
  function drawPuff(ctx, p, u) {
    const e = 1 - u;
    const r = p.size + p.grow * (1 - u * u);
    const ry = r * (p.pal === 'dust' ? 0.72 : 0.9);
    const alpha = p.alpha * Math.pow(u, 1.4) * Math.min(1, (e * p.max) / 0.08);
    if (alpha < 0.01) return;
    const ramp = PUFF_COLORS[p.pal];
    const step = Math.pow(e, 0.75) * (PUFF_STEPS - 1);
    ctx.globalAlpha = alpha;
    ell(ctx, p.x, p.y, r, ry, ramp[Math.round(step)], 'rgba(26,20,16,.32)', 1.3);
    ctx.globalAlpha = alpha * 0.55;
    ell(ctx, p.x - r * 0.28, p.y - ry * 0.32, r * 0.55, ry * 0.5, ramp[Math.min(PUFF_STEPS - 1, Math.round(step) + 4)], null);
    ctx.globalAlpha = 1;
  }

  /** A chunk: a small ragged stone with its shadow on the ground while it is in the air. */
  function drawChunk(ctx, p, u) {
    const fade = u < 0.2 ? u / 0.2 : 1;
    ctx.globalAlpha = fade;
    const pts = [];
    for (let k = 0; k < 5; k++) {
      const a = p.rot + (k / 5) * TAU;
      const rr = p.size * (k % 2 ? 0.75 : 1.1);
      pts.push([p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * 0.8]);
    }
    if (p.z > 0.5) shadow(ctx, p.gx, p.gy, p.size * 0.8, p.size * 0.4, 0.25 * fade);
    poly(ctx, pts, p.col, C.ink, 1.6);
    ctx.globalAlpha = 1;
  }

  function drawMuzzle(ctx, s, a) {
    const from = s.origin ?? project(s.x, s.y, 26);
    const to = project(s.tx, s.ty, 10);
    ctx.globalAlpha = a;
    ctx.strokeStyle = s.colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
    ell(ctx, from[0], from[1], 7 * a + 3, 7 * a + 3, '#ffd23f', C.ink, 2);
    ell(ctx, from[0], from[1], 3.5 * a + 1.5, 3.5 * a + 1.5, '#fff6c9', null);
    ctx.globalAlpha = 1;
  }

  function drawBeam(ctx, s, a) {
    const from = s.origin ?? project(s.x, s.y, 26);
    const to = project(s.tx, s.ty, 12);
    ctx.globalAlpha = a;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(26,20,16,.5)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
    ctx.strokeStyle = s.colour;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = '#fff6e0';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawChain(ctx, s, a, reducedMotion) {
    ctx.globalAlpha = a;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [width, colour] of [
      [7, 'rgba(26,20,16,.45)'],
      [3.5, s.colour],
      [1.4, '#ffffff'],
    ]) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 1; i < s.points.length; i++) {
        // The first leg starts at the figure's own anchor when it has one.
        const a0 = i === 1 && s.origin
          ? s.origin
          : project(s.points[i - 1].x, s.points[i - 1].y, i === 1 ? 26 : 12);
        const a1 = project(s.points[i].x, s.points[i].y, 12);
        ctx.moveTo(a0[0], a0[1]);
        // A couple of kinks make it read as lightning instead of a wire.
        const steps = reducedMotion ? 1 : 3;
        for (let k = 1; k <= steps; k++) {
          const u = k / steps;
          const jitter = k === steps ? 0 : (Math.random() - 0.5) * 9;
          ctx.lineTo(a0[0] + (a1[0] - a0[0]) * u + jitter, a0[1] + (a1[1] - a0[1]) * u + jitter * 0.5);
        }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** The column of light an orbital strike comes down in. */
  function drawLance(ctx, s) {
    const u = 1 - s.life / 0.5;
    const [x, y] = project(s.x, s.y);
    const width = s.radius * 26 * (1 - u * 0.7);
    const g = ctx.createLinearGradient(x, y - 700, x, y);
    g.addColorStop(0, 'rgba(255,240,200,0)');
    g.addColorStop(0.5, `rgba(255,240,200,${0.5 * (1 - u)})`);
    g.addColorStop(1, `rgba(255,255,240,${0.85 * (1 - u)})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - width, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width * 0.35, y - 700);
    ctx.lineTo(x - width * 0.35, y - 700);
    ctx.closePath();
    ctx.fill();
  }

  function drawBlast(ctx, s) {
    const [x, y] = project(s.x, s.y, 4);
    const u = 1 - s.life / 0.3;
    const r = s.radius * 32 * (0.4 + u * 0.9);
    ctx.globalAlpha = 1 - u;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.5);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  return {
    update,
    drawGround,
    /** Radius ring under the pointer while a command is being aimed. */
    drawAiming(ctx, cell, radius) {
      drawTargetRing(ctx, cell.x + 0.5, cell.y + 0.5, radius, C.gold, 0.8);
    },

    /**
     * The strip an airstrike would cover: the run from the start the player set
     * to the cell under the pointer, drawn on the ground. Before the start is
     * set, only the ring under the pointer shows.
     */
    drawLineAiming(ctx, from, to, halfWidth, t) {
      const a = project(from.x + 0.5, from.y + 0.5);
      const b = project(to.x + 0.5, to.y + 0.5);
      // The strip is a corridor on the ground, so its edges are offset in world
      // space and projected, not offset on screen: a screen offset would be the
      // wrong width depending on the direction.
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * halfWidth;
      const ny = (dx / len) * halfWidth;
      const corners = [
        project(from.x + 0.5 + nx, from.y + 0.5 + ny),
        project(to.x + 0.5 + nx, to.y + 0.5 + ny),
        project(to.x + 0.5 - nx, to.y + 0.5 - ny),
        project(from.x + 0.5 - nx, from.y + 0.5 - ny),
      ];
      ctx.beginPath();
      ctx.moveTo(corners[0][0], corners[0][1]);
      for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i][0], corners[i][1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(242,193,78,.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(242,193,78,.85)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([9, 7]);
      ctx.lineDashOffset = -t * 18;
      ctx.stroke();
      ctx.setLineDash([]);

      // The run itself, so the direction of the attack is unmistakable.
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.strokeStyle = 'rgba(255,210,63,.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawTargetRing(ctx, from.x + 0.5, from.y + 0.5, 0.5, C.gold, 0.7);
    },

    /**
     * How far an emplacement reaches. Shown for whatever the player is looking
     * at, so a tower that cannot touch the route is obvious at a glance.
     */
    drawRange(ctx, x, y, radius, colour) {
      const [sx, sy] = project(x, y);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(1, 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 32, 0, Math.PI * 2);
      ctx.fillStyle = `${colour}14`;
      ctx.fill();
      ctx.strokeStyle = colour;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.75;
      ctx.setLineDash([10, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.globalAlpha = 1;
    },
    drawAbove,
    /**
     * Offset in CSS pixels for the whole picture. Nothing shakes with
     * prefers-reduced-motion (CLAUDE.md).
     * @returns {[number, number]}
     */
    shakeOffset(reducedMotion) {
      if (reducedMotion || shake < 0.3) return [0, 0];
      return [(Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake];
    },

    /** White flash over everything, drawn last. Damped with prefers-reduced-motion. */
    drawFlash(ctx, view, reducedMotion) {
      if (brighten.life > 0) {
        // The thunder tower's strike: a cool brightening of the whole picture, at most once a second.
        const u = brighten.life / brighten.max;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(${brighten.colour},${(brighten.a * u * u).toFixed(3)})`;
        ctx.fillRect(0, 0, view.width * view.dpr, view.height * view.dpr);
      }
      if (flash <= 0) return;
      const a = reducedMotion ? flash * REDUCED_FLASH : flash;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255,240,210,${a})`;
      ctx.fillRect(0, 0, view.width * view.dpr, view.height * view.dpr);
    },

    clear() {
      particles.length = 0;
      puffs = 0;
      muzzleParticles = 0;
      decals.length = 0;
      numbers.length = 0;
      shots.length = 0;
      rings.length = 0;
      words.length = 0;
      fields.length = 0;
      shake = 0;
      flash = 0;
      lights.length = 0;
      patches.length = 0;
      pressure.length = 0;
      mortarShells.clear();
      salvos.length = 0;
      impacts.length = 0;
      craters.length = 0;
      Object.assign(brighten, { a: 0, life: 0, max: 0, colour: '236,232,255' });
      lastBrighten = -Infinity;
      balls = 0;
    },
    /** For the debug display. */
    counts() {
      return { particles: particles.length, decals: decals.length, muzzle: muzzleParticles, balls, lights: lights.length, patches: patches.length, salvos: salvos.length, impacts: impacts.length, craters: craters.length };
    },
  };
}
