// Study: rework of the six special emplacements (task A-21).
//
// New: the special base (the capsule style bunker, tall, on four steel legs, gold edges, three
// ingredient lamps) and the six special weapons as turnable models that face the target by any
// angle (spezialstellungen-rework-modell.js, built on stellungen-rework-modell.js). The effects
// leave at the muzzle of each weapon, in the direction of the shot: tracer and cases of the storm
// battery, bolts from the electrode of the cauldron, scope laser and shell of the siege mortar,
// chain lightning from the ball of the thunder tower, soul beam from the pupil of the obelisk.
// The shrine is an aura on the ground around its artefact.
//
// "Heute" draws the same scene with the game's own function (drawTowerSprite), which mirrors a
// top towards the target instead of turning it. "Mit Standard" puts a standard emplacement of
// the leading doctrine (rank 3, from the standard study) next to each special, to read the
// difference in height and colour.
//
// Two ways to draw a weapon: "Drehbar" builds it every frame; "Hybrid 16" draws a resting weapon
// from one of sixteen pre-rendered stages and builds only what moves: a weapon that is turning
// or shooting, and the floating parts (ring and ball, eye) of a resting one, as a layer on top.
//
// Everything animated runs on a fixed-step simulation of this study (`simStep`), so the stills
// are reproducible (`window.__spezial`). Nothing here touches src/; the study only reads it.

import { iso, mapBounds, isoInverse } from '../../src/render/iso.js';
import { poly, ell, cellPath } from '../../src/render/draw.js';
import { C } from '../../src/render/palette.js';
import { createRng } from '../../src/core/random.js';
import { CAMERA } from '../../src/data/settings.js';
import { DOCTRINE_COLORS } from '../../src/data/doctrines.js';
import { RECIPES } from '../../src/data/recipes.js';
import { SPECIALS as SPECIAL_DEFS } from '../../src/data/specials.js';
import { createCanvasView } from '../../src/render/canvas.js';
import { createCamera, clampCamera, panBy, zoomAt, applyCamera, screenToWorld } from '../../src/render/camera.js';
import { createGroundLayer } from '../../src/render/ground.js';
import {
  biomeOf,
  FOUNDATION_ALPHA,
  FOUNDATION_INSET,
  FOUNDATION_LINE,
  FOUNDATION_RIM,
  FOUNDATION_RIM_ALPHA,
} from '../../src/render/biomes.js';
import { LIGHT, addShadowPath, convexHull, rectCorners, SHADOW_COLOR, footStrip } from '../../src/render/shadows.js';
import { createSpriteCache } from '../../src/render/sprites/rasterizer.js';
import { allTowerDefs, drawTowerSprite, drawSpecialRing } from '../../src/render/towerSprites.js';
import { ENEMY_SPRITE_DEFS, createEnemySpriteRenderer } from '../../src/render/enemySprites.js';
import { attachPointerInput } from '../../src/input/pointer.js';
import { installPageGuards } from '../../src/input/guards.js';
import {
  buildWeapon,
  restPose as stdRest,
  drawBunker as drawStdBunker,
  MOUNT_Z,
  BUNKER_HALF,
  WEAPON_SCALE as SC_STD,
} from './stellungen-rework-modell.js';
import {
  makeFrame,
  renderModel,
  K,
  KINDS,
  buildSpecial,
  drawSpecialBase,
  restPose,
  scaleOf,
  siegeSight,
  MUZZLE_S,
  STORM_BARRELS,
  STORM_CASING_PORT,
  KESSEL_FIRE,
  OBELISK_FLAMES,
  OBELISK_FLAME_Z,
  HAS_FLOAT,
  LIVE_ALWAYS,
  SPECIAL_MOUNT_Z,
  SPECIAL_HALF,
} from './spezialstellungen-rework-modell.js';

const INK = C.ink;
const TAU = Math.PI * 2;
const SIZE = 14;

// ---------- the six specials ----------

const SPECS = [
  { id: 'purgeShrine', kind: 'purge', lead: 'flame', std: 'flame', label: 'Reinigungsschrein', short: 'Schrein' },
  { id: 'stormBattery', kind: 'storm', lead: 'autocannon', std: 'autocannon', label: 'Sturmbatterie', short: 'Sturmbatterie' },
  { id: 'emberCauldron', kind: 'kessel', lead: 'flame', std: 'flame', label: 'Glutkessel', short: 'Glutkessel' },
  { id: 'siegeMortar', kind: 'siege', lead: 'mortar', std: 'mortar', label: 'Belagerungsmörser', short: 'Belagerungsmörser' },
  { id: 'thunderTower', kind: 'thunder', lead: 'tesla', std: 'tesla', label: 'Gewitterturm', short: 'Gewitterturm' },
  { id: 'soulfireObelisk', kind: 'obelisk', lead: 'psi', std: 'psi', label: 'Seelenfeuer-Obelisk', short: 'Seelenfeuer-Obelisk' },
];
const pipsOf = (sp) => RECIPES.find((r) => r.id === sp.id).ingredients.map((d) => DOCTRINE_COLORS[d]);

// ---------- constants of the study ----------

/** Turn speed in radians per second (the study's guess; heavier is slower). */
const TURN = { purge: 1.3, storm: 3.6, kessel: 2.2, siege: 1.5, thunder: 3, obelisk: 2.2, std: 3.2 };
/** A weapon fires once it points within this many radians of the target. */
const ALIGN = 0.14;
const LAP_SECONDS = 22;
const ORBIT = { eine: 3.2, drei: 4.4, ring: 5.8, paare: 5.2 };
/** Where a shot lands on the target, px above the ground. */
const HIT_Z = 12;
const GRAVITY = 620;
const MAX_PARTICLES = 520;
const FLASH_SECONDS = 0.07;
const RECOIL_DECAY = 7;
const TRACER_SPEED = 18;
const STORM = SPECIAL_DEFS.stormBattery;
const KESSEL = SPECIAL_DEFS.emberCauldron;
const SIEGE = SPECIAL_DEFS.siegeMortar;
const THUNDER = SPECIAL_DEFS.thunderTower;
const OBELISK = SPECIAL_DEFS.soulfireObelisk;
const PURGE = SPECIAL_DEFS.purgeShrine;
/** Splash radius of the standard mortar (the size the explosion art is authored for). */
const SPLASH_REF = 1.2;
const KESSEL_BOLT = 0.32;
const THUNDER_BOLT = 0.34;
const OBELISK_CHARGE = 0.4;
const OBELISK_BEAM = 0.26;
const BURN_SECONDS = 3;
const JUMP_EVERY = KESSEL.spread.everySeconds;
const LABEL_STD = 'Standard';

const rng = createRng('spezialstellungen-rework');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- state ----------

const state = {
  view: 'neu', // neu | heute
  layout: 'ring', // eine | drei | ring | paare
  weapon: 'alle', // alle | a special id
  fire: true,
  orbit: true,
  mode: 'hybrid', // live | hybrid
  silhouette: false,
  biome: 'ash',
  paused: false,
};

const BIOME_SEEDS = {};
for (let i = 0; Object.keys(BIOME_SEEDS).length < 3 && i < 200; i++) BIOME_SEEDS[biomeOf(`SPEZIAL${i}`)] ??= `SPEZIAL${i}`;
const BIOMES = ['ash', 'rust', 'toxic'];
const BIOME_LABEL = { ash: 'Asche', rust: 'Rost', toxic: 'Gift' };

const RING = [[4, 9], [7, 10], [10, 9], [10, 5], [7, 4], [4, 5]];
const wrapPi = (a) => ((a + Math.PI * 3) % TAU) - Math.PI;
const norm2 = (d) => {
  const l = Math.hypot(d[0], d[1]) || 1;
  return [d[0] / l, d[1] / l];
};

let towers = [];
let groupCentre = [7, 7];
/** The target the weapons turn to (draggable) and two that follow it, for chains and spreading fire. */
const target = { x: 0, y: 0, vx: 0, vy: 0, phi: 0, R: 3.2, dx: 1, dy: 0 };
const enemies = [0, 1, 2].map((i) => ({ id: i + 1, type: 'warrior', x: 0, y: 0, dx: 1, dy: 0, d: 9, flash: 0, flying: false, burn: 0 }));
const particles = [];
let clock = 0;

function plan() {
  const specs = state.weapon === 'alle' ? SPECS : [SPECS.find((s) => s.id === state.weapon)];
  const out = [];
  if (state.layout === 'paare') {
    const cells = specs.length === 1 ? [[6, 6]] : specs.map((_, i) => [3 + (i % 3) * 4, 5 + Math.floor(i / 3) * 4]);
    specs.forEach((sp, i) => {
      out.push({ sp, cx: cells[i][0], cy: cells[i][1], isStd: false });
      out.push({ sp, cx: cells[i][0] + 1, cy: cells[i][1], isStd: true });
    });
  } else if (state.layout === 'ring') {
    RING.forEach(([cx, cy], i) => out.push({ sp: specs[i % specs.length], cx, cy, isStd: false }));
  } else if (state.layout === 'drei') {
    [[4, 8], [6, 6], [8, 4]].forEach(([cx, cy]) => out.push({ sp: specs[0], cx, cy, isStd: false }));
  } else {
    out.push({ sp: specs[0], cx: 6, cy: 6, isStd: false });
  }
  return out;
}

function buildTowers() {
  towers = plan().map(({ sp, cx, cy, isStd }) => ({
    sp,
    isStd,
    lead: sp.lead,
    kind: isStd ? sp.std : sp.kind,
    cx,
    cy,
    x: cx + 0.5,
    y: cy + 0.5,
    theta: Math.atan2(target.y - (cy + 0.5), target.x - (cx + 0.5)),
    cd: rng.range(0, 0.6),
    recoil: 0,
    bar: [0, 0, 0, 0],
    flashK: [0, 0, 0, 0],
    tube: 0,
    gyro: rng.range(0, 3),
    flashT: 0,
    charge: 0,
    aiming: 0,
    bolt: 0,
    boltSeed: 0,
    beam: 0,
    aura: 0,
    jumpCd: 0,
    firing: false,
    cooldown: 0,
    aligned: false,
    lead2: null,
    busy: false,
    shadowParts: null,
  }));
  const mean = (f) => towers.reduce((s, t) => s + f(t), 0) / towers.length;
  groupCentre = [mean((t) => t.x), mean((t) => t.y)];
  target.R = ORBIT[state.layout];
  for (const e of enemies) e.burn = 0;
}

function resetTarget() {
  target.phi = -0.9;
  placeTarget(0);
}

function placeTarget(dt) {
  const x = groupCentre[0] + Math.cos(target.phi) * target.R;
  const y = groupCentre[1] + Math.sin(target.phi) * target.R;
  if (dt > 0) {
    target.vx = (x - target.x) / dt;
    target.vy = (y - target.y) / dt;
  }
  setTarget(x, y);
}

function setTarget(x, y) {
  const mx = x - target.x;
  const my = y - target.y;
  if (mx * mx + my * my > 1e-6) {
    const l = Math.sqrt(mx * mx + my * my);
    target.dx = mx / l;
    target.dy = my / l;
  }
  target.x = x;
  target.y = y;
  placeFollowers();
}

/** The two followers walk behind the target on its heading. */
function placeFollowers() {
  enemies.forEach((e, i) => {
    e.x = Math.max(0.6, Math.min(SIZE - 0.6, target.x - target.dx * 0.85 * i));
    e.y = Math.max(0.6, Math.min(SIZE - 0.6, target.y - target.dy * 0.85 * i));
    e.dx = target.dx;
    e.dy = target.dy;
  });
}

// ---------- the muzzle of a tower, in the world ----------

const STAGES = 16;
const STEP = TAU / STAGES;

const scaleFor = (tw) => (tw.isStd ? SC_STD : scaleOf(tw.kind));
const mountFor = (tw) => (tw.isStd ? MOUNT_Z : SPECIAL_MOUNT_Z);
const accentOf = (tw) => DOCTRINE_COLORS[tw.lead];

function isBusy(tw) {
  return (
    !tw.aligned ||
    tw.firing ||
    tw.recoil > 0.01 ||
    tw.flashT > 0 ||
    tw.charge > 0 ||
    tw.aiming > 0 ||
    tw.beam > 0 ||
    tw.bolt > 0 ||
    tw.bar.some((r) => r > 0.01)
  );
}

/** True when the base of this weapon is drawn from a stage this frame. */
function useStage(tw) {
  if (state.mode !== 'hybrid' || tw.busy) return false;
  return tw.isStd || !LIVE_ALWAYS[tw.kind];
}

function shownTheta(tw) {
  return useStage(tw) ? Math.round(tw.theta / STEP) * STEP : tw.theta;
}

function poseOf(tw) {
  const p = restPose(accentOf(tw));
  p.recoil = tw.recoil;
  p.bar = tw.bar;
  p.tube = tw.tube;
  p.gyro = tw.gyro;
  p.glow = tw.charge > 0.5 || tw.beam > 0 ? 1 : 0;
  p.bob = reduceMotion ? 0 : Math.sin(clock * 2 + tw.x) * 2;
  return p;
}

/**
 * Muzzle and direction of the shot in world coordinates: x, y in cells, z in px.
 * The position follows the weapon as it is shown, the direction follows the aim.
 */
function muzzleWorld(tw, tube = tw.tube) {
  const pose = poseOf(tw);
  pose.tube = tube;
  const m = MUZZLE_S[tw.kind](pose);
  const Fs = makeFrame(shownTheta(tw), mountFor(tw), scaleFor(tw));
  const Fa = makeFrame(tw.theta, mountFor(tw), scaleFor(tw));
  const [px, py] = Fs.world(m.at[0], m.at[1]);
  const dw = Fa.wn(m.dir[0], m.dir[1], m.dir[2]);
  return { x: tw.x + px, y: tw.y + py, z: mountFor(tw) + m.at[2] * scaleFor(tw), dir: dw };
}

/** A local point of the weapon in the world: x, y in cells, z in px. */
function localWorld(tw, lx, ly, z) {
  const Fs = makeFrame(shownTheta(tw), mountFor(tw), scaleFor(tw));
  const [px, py] = Fs.world(lx, ly);
  return [tw.x + px, tw.y + py, mountFor(tw) + z * scaleFor(tw)];
}

// ---------- particles ----------

function emit(p) {
  if (particles.length < MAX_PARTICLES) particles.push({ age: 0, vx: 0, vy: 0, vz: 0, ...p });
}

function smoke(x, y, z, vx, vy, vz, r0, r1, life, tone = 0) {
  emit({ kind: 'smoke', x, y, z, vx, vy, vz, r0, r1, life, tone });
}

function sparkBurst(x, y, z, count, speed, life = 0.28, colour = '#ffe38a') {
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, TAU);
    const s = rng.range(0.3, 1) * speed;
    emit({ kind: 'spark', x, y, z, vx: Math.cos(a) * s * 0.02, vy: Math.sin(a) * s * 0.02, vz: rng.range(0.1, 1) * speed, life: life * rng.range(0.6, 1.1), colour });
  }
}

function hit(i) {
  enemies[i].flash = 0.08;
}

function boom(x, y, radius) {
  emit({ kind: 'boom', x, y, radius, life: 0.85 });
  const k = radius / SPLASH_REF;
  for (let i = 0; i < 9; i++) smoke(x + rng.range(-0.4, 0.4) * k, y + rng.range(-0.4, 0.4) * k, rng.range(2, 8), rng.range(-0.1, 0.1), rng.range(-0.1, 0.1), rng.range(20, 55), 6 * k, 18 * k, rng.range(1, 1.7), 1);
  sparkBurst(x, y, 8, 18, 260, 0.55);
  hit(0);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      if (p.kind === 'shell') boom(p.x1, p.y1, SIEGE.splashRadius);
      if (p.kind === 'tracer') {
        sparkBurst(p.x1, p.y1, p.z1, 3, 130, 0.18, p.colour);
        hit(p.target ?? 0);
      }
      particles.splice(i, 1);
      continue;
    }
    if (p.kind === 'casing' || p.kind === 'spark') {
      p.vz -= GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.z < 0) {
        p.z = 0;
        p.vz = p.kind === 'casing' && Math.abs(p.vz) > 60 ? -p.vz * 0.3 : 0;
        p.vx *= 0.4;
        p.vy *= 0.4;
      }
    } else if (p.kind === 'smoke' || p.kind === 'mote') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.vz *= p.kind === 'mote' ? 1 : 0.97;
    } else if (p.kind === 'shell') {
      p.trail = (p.trail ?? 0) - dt;
      if (p.trail <= 0) {
        p.trail = 0.04;
        const pos = flightPos(p);
        smoke(pos[0], pos[1], pos[2], 0, 0, 8, 3, 9, 0.9);
      }
    }
  }
}

function flightPos(p) {
  const u = p.age / p.life;
  return [p.x0 + (p.x1 - p.x0) * u, p.y0 + (p.y1 - p.y0) * u, p.z0 + (p.z1 - p.z0) * u + p.arc * 4 * u * (1 - u)];
}

// ---------- simulation of the study ----------

function predicted(seconds) {
  return [target.x + target.vx * seconds, target.y + target.vy * seconds];
}

function simStep(dt) {
  clock += dt;
  for (const e of enemies) {
    e.flash = Math.max(0, e.flash - dt);
    e.burn = Math.max(0, e.burn - dt);
  }
  if (state.orbit) {
    target.phi += (TAU / LAP_SECONDS) * dt;
    placeTarget(dt);
  } else {
    target.vx = 0;
    target.vy = 0;
  }
  for (const tw of towers) updateTower(tw, dt);
  updateParticles(dt);
}

function updateTower(tw, dt) {
  const kind = tw.kind;
  const slow = kind === 'siege';
  const aim = slow ? predicted(SIEGE.flightSeconds) : [target.x, target.y];
  tw.lead2 = aim;
  const want = Math.atan2(aim[1] - tw.y, aim[0] - tw.x);
  const delta = wrapPi(want - tw.theta);
  const step = (tw.isStd ? TURN.std : TURN[kind]) * dt;
  tw.theta += Math.max(-step, Math.min(step, delta));
  tw.aligned = Math.abs(wrapPi(want - tw.theta)) < ALIGN;
  tw.gyro += dt * (tw.firing ? 3.4 : 1.2);
  tw.firing = false;
  if (tw.isStd) {
    tw.busy = !tw.aligned;
    return;
  }

  tw.recoil = Math.max(0, tw.recoil - dt * RECOIL_DECAY);
  tw.flashT = Math.max(0, tw.flashT - dt);
  tw.cd = Math.max(0, tw.cd - dt);
  for (let k = 0; k < 4; k++) {
    tw.bar[k] = Math.max(0, tw.bar[k] - dt * 14);
    tw.flashK[k] = Math.max(0, tw.flashK[k] - dt);
  }
  const go = state.fire && tw.aligned;

  if (kind === 'purge') {
    tw.aura += ((state.fire ? 1 : 0.35) - tw.aura) * Math.min(1, dt * 3);
    tw.firing = state.fire;
    tw.tick = (tw.tick ?? 0) - dt;
    if (state.fire && tw.tick <= 0) {
      tw.tick = 0.5;
      enemies.forEach((e, i) => {
        if (Math.hypot(e.x - tw.x, e.y - tw.y) <= PURGE.range) {
          sparkBurst(e.x, e.y, 8, 3, 110, 0.5, '#ffd23f');
          hit(i);
        }
      });
    }
  } else if (kind === 'storm') {
    if (go) {
      tw.firing = true;
      if (tw.cd <= 0) {
        tw.cd += 1 / STORM.fire;
        shootStorm(tw);
      }
    }
  } else if (kind === 'kessel') {
    if (go && tw.cd <= 0) {
      tw.cd += 1 / KESSEL.fire;
      tw.bolt = KESSEL_BOLT;
      tw.flashT = FLASH_SECONDS * 2;
      tw.boltSeed = Math.floor(clock * 30);
      const m = muzzleWorld(tw);
      sparkBurst(m.x, m.y, m.z, 4, 120, 0.25, '#ff8a2a');
      enemies.forEach((e, i) => {
        e.burn = BURN_SECONDS;
        hit(i);
        sparkBurst(e.x, e.y, HIT_Z, 5, 150, 0.3, '#ff8a2a');
      });
    }
    tw.bolt = Math.max(0, tw.bolt - dt);
    tw.firing = tw.bolt > 0;
    // The fire jumps from a burning enemy to the next, as a short ember arc.
    tw.jumpCd -= dt;
    if (state.fire && tw.jumpCd <= 0 && enemies[0].burn > 0) {
      tw.jumpCd = JUMP_EVERY;
      const i = Math.floor(rng.range(0, 2));
      emit({ kind: 'arc', i, j: i + 1, life: 0.24, seed: Math.floor(rng.range(0, 99)) });
    }
  } else if (kind === 'siege') {
    if (tw.aiming === 0 && go && tw.cd <= 0) {
      tw.cd += 1 / SIEGE.fire;
      tw.aiming = 0.0001;
    }
    if (tw.aiming > 0) {
      tw.firing = true;
      tw.aiming += dt / SIEGE.aimSeconds;
      if (tw.aiming >= 1) {
        tw.aiming = 0;
        shootSiege(tw);
      }
    }
  } else if (kind === 'thunder') {
    if (go && tw.cd <= 0) {
      tw.cd += 1 / THUNDER.fire;
      tw.bolt = THUNDER_BOLT;
      tw.flashT = FLASH_SECONDS;
      tw.boltSeed = Math.floor(clock * 30);
      enemies.forEach((e, i) => {
        hit(i);
        sparkBurst(e.x, e.y, HIT_Z, 5, 160, 0.3, '#bff2ff');
      });
    }
    tw.bolt = Math.max(0, tw.bolt - dt);
    tw.firing = tw.bolt > 0;
    tw.boltSeed = tw.bolt > 0 ? Math.floor(clock * 28) : tw.boltSeed;
  } else if (kind === 'obelisk') {
    if (tw.charge === 0 && tw.beam === 0 && go && tw.cd <= 0) {
      tw.cd += 1 / OBELISK.fire;
      tw.charge = 0.0001;
    }
    if (tw.charge > 0) {
      tw.charge += dt / OBELISK_CHARGE;
      tw.firing = true;
      if (tw.charge >= 1) {
        tw.charge = 0;
        tw.beam = OBELISK_BEAM;
        tw.recoil = 0.4;
        hit(0);
        sparkBurst(target.x, target.y, HIT_Z, 14, 200, 0.5, '#b784ff');
      }
    }
    tw.beam = Math.max(0, tw.beam - dt);
    if (tw.beam > 0) tw.firing = true;
  }
  tw.cooldown = tw.cd;
  tw.busy = isBusy(tw);
}

function shootStorm(tw) {
  const k = tw.tube;
  tw.tube = (k + 1) % 4;
  const m = muzzleWorld(tw, k);
  tw.bar[k] = 1;
  tw.flashK[k] = FLASH_SECONDS;
  tw.flashT = FLASH_SECONDS;
  // A case leaves the back of the housing, against the line of the barrels, and falls.
  const [cx, cy, cz] = localWorld(tw, STORM_CASING_PORT[0], STORM_CASING_PORT[1] + (k % 2 ? -0.02 : 0.02), STORM_CASING_PORT[2]);
  const dir = norm2(m.dir);
  emit({
    kind: 'casing',
    x: cx,
    y: cy,
    z: cz,
    vx: -dir[0] * rng.range(0.9, 1.6) + -dir[1] * rng.range(-0.4, 0.4),
    vy: -dir[1] * rng.range(0.9, 1.6) + dir[0] * rng.range(-0.4, 0.4),
    vz: rng.range(70, 150),
    rot: rng.range(0, TAU),
    vrot: rng.range(-18, 18),
    life: 1.5,
  });
  if (rng.chance(0.2)) smoke(m.x, m.y, m.z, m.dir[0] * 0.4, m.dir[1] * 0.4, 16, 2.5, 7, 0.5);
  // The tracer flies from the muzzle to one of the three leading enemies, in turn.
  const e = enemies[k % 3];
  const d = Math.hypot(e.x - m.x, e.y - m.y);
  emit({ kind: 'tracer', x0: m.x, y0: m.y, z0: m.z, x1: e.x + rng.range(-0.06, 0.06), y1: e.y + rng.range(-0.06, 0.06), z1: HIT_Z, life: Math.max(0.05, d / TRACER_SPEED), colour: '#7fd8ff', core: '#e8fbff', target: k % 3 });
}

function shootSiege(tw) {
  const m = muzzleWorld(tw);
  tw.recoil = 1;
  tw.flashT = FLASH_SECONDS * 2.2;
  const [lx, ly] = tw.lead2;
  const d = Math.hypot(lx - m.x, ly - m.y);
  emit({ kind: 'shell', x0: m.x, y0: m.y, z0: m.z, x1: lx, y1: ly, z1: 0, arc: 90 + d * 22, life: SIEGE.flightSeconds });
  // A pillar of smoke up the tube and a puff behind the weapon.
  for (let i = 0; i < 8; i++) {
    smoke(m.x + m.dir[0] * i * 0.03, m.y + m.dir[1] * i * 0.03, m.z + i * 4, m.dir[0] * 0.25 + rng.range(-0.12, 0.12), m.dir[1] * 0.25 + rng.range(-0.12, 0.12), 60 + i * 12, 5, 19, 1.3 + i * 0.1);
  }
  sparkBurst(m.x, m.y, m.z, 8, 140, 0.3, '#ffb02e');
}

// ---------- caches: the bases, the sixteen stages ----------

const baseCache = new Map();
const stageCache = new Map();
const stats = { bakes: 0 };

/** The scale steps of the sprites: 0.5, 1, 2 times the pixel ratio (docs/ART.md). */
function stepOf(zoom) {
  return zoom <= 0.7 ? 0.5 : zoom <= 1.4 ? 1 : 2;
}

/** The special base, or the standard bunker of a companion (rank 3). */
function baseSprite(tw, step, dpr) {
  const accent = accentOf(tw);
  const key = `${tw.isStd ? 's' : tw.sp.id}|${accent}|${step}|${dpr}`;
  let s = baseCache.get(key);
  if (!s) {
    const std = tw.isStd;
    const w = std ? 84 : 96;
    const h = std ? 84 : 92;
    const ox = w / 2;
    const oy = std ? 62 : 68;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * step * dpr);
    canvas.height = Math.ceil(h * step * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(step * dpr, 0, 0, step * dpr, ox * step * dpr, oy * step * dpr);
    if (std) drawStdBunker(g, 3, accent);
    else drawSpecialBase(g, accent, pipsOf(tw.sp));
    s = { canvas, w, h, ox, oy };
    baseCache.set(key, s);
    stats.bakes += 1;
  }
  return s;
}

/** Size of the canvas of one stage, and where the ground point of the tower sits on it. */
const STAGE_BOX = {
  std: { w: 100, h: 100, ox: 50, oy: 74 },
  default: { w: 110, h: 130, ox: 55, oy: 96 },
  siege: { w: 120, h: 160, ox: 60, oy: 126 },
  thunder: { w: 100, h: 150, ox: 50, oy: 116 },
  obelisk: { w: 100, h: 190, ox: 50, oy: 156 },
};

/** One of the sixteen stages of a weapon, drawn at rest at the angle k * 22.5 degrees. */
function stageOf(tw, k, step, dpr) {
  const kind = tw.kind;
  const accent = accentOf(tw);
  const key = `${tw.isStd ? 's' : 'x'}|${kind}|${accent}|${k}|${step}|${dpr}`;
  let s = stageCache.get(key);
  if (!s) {
    const { w, h, ox, oy } = tw.isStd ? STAGE_BOX.std : (STAGE_BOX[kind] ?? STAGE_BOX.default);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * step * dpr);
    canvas.height = Math.ceil(h * step * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(step * dpr, 0, 0, step * dpr, ox * step * dpr, oy * step * dpr);
    const F = makeFrame(k * STEP, mountFor(tw), scaleFor(tw));
    const built = tw.isStd ? buildWeapon(kind, F, stdRest(accent, 3)) : buildSpecial(kind, F, restPose(accent), HAS_FLOAT[kind] ? 'base' : 'all');
    renderModel(g, built.parts);
    s = { canvas, w, h, ox, oy, F };
    stageCache.set(key, s);
    stats.bakes += 1;
  }
  return s;
}

// ---------- drawing ----------

const canvas = document.getElementById('game');
const mainCtx = canvas.getContext('2d', { alpha: false });
let ctx = mainCtx;
const layer = document.createElement('canvas');
const layerCtx = layer.getContext('2d');
installPageGuards(canvas);

const camera = createCamera();
const limits = { ...CAMERA, minZoom: 0.3, maxZoom: 3, minCellPx: 0 };
const bounds = mapBounds(SIZE);
const cache = createSpriteCache();
const ground = createGroundLayer();
const drawEnemy = createEnemySpriteRenderer(cache);
const view = createCanvasView(canvas, () => clampCamera(camera, bounds, limits));
const perf = { draw: 0, towers: 0, frames: 0, sumDraw: 0, sumTowers: 0, acc: 0 };

function drawFoundation(c, tw) {
  const colour = accentOf(tw);
  cellPath(c, tw.cx, tw.cy, FOUNDATION_INSET);
  c.globalAlpha = FOUNDATION_ALPHA;
  c.fillStyle = colour;
  c.fill();
  c.save();
  c.clip();
  c.globalAlpha = FOUNDATION_RIM_ALPHA;
  c.strokeStyle = colour;
  c.lineWidth = 2 * (FOUNDATION_LINE / 2 + FOUNDATION_RIM);
  c.stroke();
  c.restore();
  c.globalAlpha = 1;
  c.lineWidth = FOUNDATION_LINE;
  c.strokeStyle = INK;
  c.stroke();
}

/** Ground shadow of base and weapon in one fill, so nothing is darkened twice. */
function drawShadow(c, tw, samples) {
  const half = tw.isStd ? BUNKER_HALF : SPECIAL_HALF;
  c.beginPath();
  addShadowPath(c, rectCorners(tw.x - half, tw.y - half, tw.x + half, tw.y + half), mountFor(tw));
  if (samples) {
    const F = samples.F;
    const pts = samples.map(([lx, ly, z]) => {
      const [wx, wy] = F.world(lx, ly);
      const h = mountFor(tw) + z * F.scale;
      return [tw.x + wx + (LIGHT.x * h) / 32, tw.y + wy + (LIGHT.y * h) / 32];
    });
    const hull = convexHull(pts);
    hull.forEach(([x, y], i) => {
      const [sx, sy] = iso(x, y);
      if (i) c.lineTo(sx, sy);
      else c.moveTo(sx, sy);
    });
    c.closePath();
  }
  c.fillStyle = SHADOW_COLOR;
  c.fill();
  footStrip(c, tw.x + half, tw.y - half, tw.x + half, tw.y + half, 1, 0);
  footStrip(c, tw.x - half, tw.y + half, tw.x + half, tw.y + half, 0, 1);
}

const shadowSamples = new Map();
function weaponSamples(tw) {
  const key = `${tw.isStd ? 's' : 'x'}|${tw.kind}`;
  let rest = shadowSamples.get(key);
  if (!rest) {
    const F0 = makeFrame(0, 0, scaleFor(tw));
    rest = tw.isStd ? buildWeapon(tw.kind, F0, stdRest('#fff', 3)).samples : buildSpecial(tw.kind, F0, restPose('#fff'), 'all').samples;
    shadowSamples.set(key, rest);
  }
  const out = rest.slice();
  out.F = makeFrame(shownTheta(tw), 0, scaleFor(tw));
  return out;
}

/** Draws one weapon model at its tower, plus the fire that belongs to it. */
function drawWeapon(c, tw) {
  const kind = tw.kind;
  const [ox, oy] = iso(tw.x, tw.y);
  if (tw.isStd) {
    c.save();
    c.translate(ox, oy);
    if (useStage(tw)) {
      const s = stageOf(tw, ((Math.round(tw.theta / STEP) % STAGES) + STAGES) % STAGES, stepOf(camera.zoom), view.dpr);
      c.drawImage(s.canvas, -s.ox, -s.oy, s.w, s.h);
    } else {
      renderModel(c, buildWeapon(kind, makeFrame(tw.theta, MOUNT_Z, SC_STD), stdRest(accentOf(tw), 3)).parts);
    }
    c.restore();
    return;
  }
  const mw = muzzleWorld(tw);
  const front = mw.dir[0] + mw.dir[1] >= 0;
  if (!state.silhouette) {
    if (!front) drawFx(c, tw, mw, 'back');
    if (kind === 'obelisk') drawObeliskFlames(c, tw, 'back');
  }
  c.save();
  c.translate(ox, oy);
  const mount = mountFor(tw);
  if (useStage(tw)) {
    const k = ((Math.round(tw.theta / STEP) % STAGES) + STAGES) % STAGES;
    const s = stageOf(tw, k, stepOf(camera.zoom), view.dpr);
    c.drawImage(s.canvas, -s.ox, -s.oy, s.w, s.h);
    // What floats stays alive on top of the resting stage.
    if (HAS_FLOAT[kind]) renderModel(c, buildSpecial(kind, makeFrame(shownTheta(tw), mount, scaleFor(tw)), poseOf(tw), 'float').parts);
  } else {
    renderModel(c, buildSpecial(kind, makeFrame(tw.theta, mount, scaleFor(tw)), poseOf(tw), 'all').parts);
  }
  c.restore();
  if (!state.silhouette) {
    if (kind === 'obelisk') drawObeliskFlames(c, tw, 'front');
    drawFx(c, tw, mw, 'front');
  }
}

/** True-unit 3D point (x, y in cells, z in px) to the world pixel. */
const P = (x, y, z) => iso(x, y, z);

/** A flat kite of light from the muzzle along `dir`: one of the cross fans of a muzzle flash. */
function kite(c, m, dir, side, len, wid, fill) {
  const at = (a, b) => P(m.x + dir[0] * a + side[0] * b, m.y + dir[1] * a + side[1] * b, m.z + (dir[2] * a + side[2] * b) * K);
  poly(c, [at(-0.01, 0), at(len * 0.32, wid), at(len, 0), at(len * 0.32, -wid)], fill, INK, 1.3);
}

function fanBasis(dir) {
  const h = Math.hypot(dir[0], dir[1]) || 1;
  const s1 = [-dir[1] / h, dir[0] / h, 0];
  const s2 = [dir[1] * s1[2] - dir[2] * s1[1], dir[2] * s1[0] - dir[0] * s1[2], dir[0] * s1[1] - dir[1] * s1[0]];
  return [s1, s2];
}

function flare(c, m, dir, len, wid, outer, inner) {
  const [s1, s2] = fanBasis(dir);
  for (const s of [s1, s2]) kite(c, m, dir, s, len, wid, outer);
  for (const s of [s1, s2]) kite(c, m, dir, s, len * 0.62, wid * 0.55, inner);
}

function glow(c, x, y, r, colour, alpha) {
  const g = c.createRadialGradient(x, y, r * 0.1, x, y, r);
  g.addColorStop(0, `${colour}${Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0')}`);
  g.addColorStop(1, `${colour}00`);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}

/** A jagged line with ink outline and two glows: lightning of the coil, bolts of the cauldron. */
function bolt(c, a, b, seed, jitter, colour, width, core = '#ffffff') {
  const steps = 7;
  const pts = [a];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i < steps; i++) {
    const u = i / steps;
    const r = Math.sin((seed + 1) * 12.9898 + i * 78.233) * 43758.5453;
    const off = (r - Math.floor(r) - 0.5) * jitter;
    pts.push([a[0] + dx * u + nx * off, a[1] + dy * u + ny * off]);
  }
  pts.push(b);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  for (const [w, col] of [[width + 3.6, INK], [width, colour], [width * 0.4, core]]) {
    c.strokeStyle = col;
    c.lineWidth = w;
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.stroke();
  }
}

/** A flame shape of the old study: a teardrop with a bright inside, base at (x, y). */
function flameShape(c, x, y, s, outer, inner) {
  for (const [k, col] of [[1, outer], [0.55, inner]]) {
    c.beginPath();
    c.moveTo(x, y);
    c.bezierCurveTo(x - 5 * s * k, y - 4 * s * k, x - 2 * s * k, y - 9 * s * k, x, y - 14 * s * k);
    c.bezierCurveTo(x + 3 * s * k, y - 9 * s * k, x + 5 * s * k, y - 4 * s * k, x, y);
    c.closePath();
    c.fillStyle = col;
    c.fill();
    if (k === 1) {
      c.lineWidth = 1.3;
      c.strokeStyle = INK;
      c.stroke();
    }
  }
}

function flick(i, tw) {
  return reduceMotion ? 1 : 0.85 + Math.sin(clock * 15 + i * 2.1 + tw.x) * 0.15;
}

/** The four flames at the foot of the obelisk: the two behind the shaft before it, the two in front after it. */
function drawObeliskFlames(c, tw, phase) {
  OBELISK_FLAMES.forEach(([lx, ly], i) => {
    const [wx, wy, wz] = localWorld(tw, lx, ly, OBELISK_FLAME_Z);
    const behind = wx + wy < tw.x + tw.y - 1e-6;
    if ((phase === 'back') !== behind) return;
    const [sx, sy] = P(wx, wy, wz);
    const f = flick(i, tw);
    flameShape(c, sx, sy, 0.75 * f, '#ff8a2a', '#ffd23f');
  });
}

/** Fire, beam, bolt and rings of one weapon. `phase`: behind the weapon or in front of it. */
function drawFx(c, tw, m, phase) {
  const kind = tw.kind;
  const accent = accentOf(tw);
  const dir = m.dir;
  const mp = P(m.x, m.y, m.z);
  const behind = phase === 'back';
  const front = dir[0] + dir[1] >= 0;
  // Flares and glows sit at the muzzle and are always in front; beams and bolts reach out and
  // go behind the weapon when they run away from the camera. What leaves from the top of a
  // weapon (ball, eye, artefact) is above everything and is drawn in front.
  const topCentred = kind === 'thunder' || kind === 'obelisk' || kind === 'purge';
  const reach = topCentred ? !behind : (!front && behind) || (front && !behind);

  if (kind === 'purge') {
    if (!behind) {
      const pulse = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(clock * 4);
      glow(c, mp[0], mp[1], 17 + pulse * 3, '#ffb13b', (0.3 + 0.25 * pulse) * (0.4 + 0.6 * tw.aura));
    }
  } else if (kind === 'storm') {
    if (!behind) {
      for (let k = 0; k < 4; k++) {
        if (tw.flashK[k] <= 0) continue;
        const mk = muzzleWorld(tw, k);
        const u = tw.flashK[k] / FLASH_SECONDS;
        const pk = P(mk.x, mk.y, mk.z);
        glow(c, pk[0], pk[1], 11, '#7fd8ff', 0.55 * u);
        flare(c, mk, mk.dir, 0.3 * (0.6 + 0.4 * u), 0.08, '#7fd8ff', '#e8fbff');
      }
    }
  } else if (kind === 'kessel') {
    if (!behind) {
      // Flames in the opening of the cauldron, and a blue glow at the tip of each electrode.
      const [fx, fy, fz] = localWorld(tw, KESSEL_FIRE[0], KESSEL_FIRE[1], KESSEL_FIRE[2]);
      const base = P(fx, fy, fz);
      const charged = tw.bolt > 0 ? 1.25 : 1;
      glow(c, base[0], base[1] - 8, 26, '#ff8a2a', 0.4 * charged);
      [[-4.2, 0.62, 0], [3.6, 0.8, 1], [0, 1.05, 2], [6.4, 0.5, 3]].forEach(([dx, s, i]) => {
        flameShape(c, base[0] + dx * (scaleFor(tw) / 1.0), base[1] + 1 - Math.abs(dx) * 0.15, s * flick(i, tw) * charged, i % 2 ? '#ffb13b' : '#ff8a2a', '#fff3c0');
      });
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const [ex, ey, ez] = localWorld(tw, Math.cos(a) * 0.225, Math.sin(a) * 0.225, 31.5);
        const p = P(ex, ey, ez);
        glow(c, p[0], p[1], tw.bolt > 0 && i === 0 ? 11 : 6, i === 0 ? '#ffb02e' : '#5fd4ff', tw.bolt > 0 ? 0.7 : 0.4);
      }
    }
    if (reach && tw.bolt > 0) {
      const u = tw.bolt / KESSEL_BOLT;
      enemies.forEach((e, i) => {
        const t = P(e.x, e.y, HIT_Z);
        bolt(c, mp, t, tw.boltSeed + i * 5, 20 * (0.5 + u * 0.5), '#ff8a2a', 2.6 * (0.6 + u * 0.4), '#fff3c0');
        glow(c, t[0], t[1], 18, '#ff8a2a', 0.55 * u);
      });
    }
  } else if (kind === 'siege') {
    const u = tw.flashT / (FLASH_SECONDS * 2.2);
    if (!behind && tw.flashT > 0) {
      glow(c, mp[0], mp[1], 28, '#ffd23f', 0.6 * u);
      flare(c, m, dir, 0.62 * (0.6 + 0.4 * u), 0.17, '#ff8a2a', '#ffe38a');
    }
    if (tw.aiming > 0) {
      // The scope throws a red line at the target while it aims; the dot on the ground grows.
      const [sx, sy, sz] = localWorld(tw, ...siegeSight());
      const toFront = target.x + target.y >= tw.x + tw.y;
      if ((toFront && !behind) || (!toFront && behind)) {
        const a = P(sx, sy, sz);
        const b = P(tw.lead2[0], tw.lead2[1], 0);
        const q = Math.min(1, tw.aiming);
        c.lineCap = 'round';
        c.globalAlpha = 0.55 + 0.45 * (reduceMotion ? 1 : Math.abs(Math.sin(clock * 22)));
        for (const [w, col] of [[4.2, INK], [1.9, '#ff4a4a'], [0.7, '#ffd0c0']]) {
          c.strokeStyle = col;
          c.lineWidth = w;
          c.beginPath();
          c.moveTo(a[0], a[1]);
          c.lineTo(b[0], b[1]);
          c.stroke();
        }
        c.globalAlpha = 1;
        ell(c, b[0], b[1], 5 + q * 22, (5 + q * 22) * 0.5, 'rgba(255,74,74,.12)', '#ff4a4a', 1.6);
        ell(c, b[0], b[1], 3 + q * 2, (3 + q * 2) * 0.5, '#ff4a4a', INK, 1);
      }
      if (!behind) {
        const lens = P(sx, sy, sz);
        glow(c, lens[0], lens[1], 7, '#ff4a4a', 0.7);
      }
    }
  } else if (kind === 'thunder') {
    if (!behind) {
      glow(c, mp[0], mp[1], tw.bolt > 0 ? 24 : 13, '#5fd4ff', tw.bolt > 0 ? 0.75 : 0.3 + 0.1 * Math.sin(clock * 9));
      if (tw.bolt <= 0 && !reduceMotion) {
        // Idle: a small arc now and then from the ball.
        const k = Math.floor(clock * 7);
        const r = Math.sin(k * 91.7) * 1000;
        if (r - Math.floor(r) < 0.6) {
          const a = (Math.sin(k * 12.3) * 1000) % TAU;
          bolt(c, mp, [mp[0] + Math.cos(a) * 12, mp[1] + Math.sin(a) * 9 - 3], k, 5, '#bff2ff', 1.4);
        }
      }
    }
    if (reach && tw.bolt > 0) {
      // The chain: from the ball to the first, from each to the next. Each hop is its own bolt.
      const u = tw.bolt / THUNDER_BOLT;
      let from = mp;
      enemies.forEach((e, i) => {
        const t = P(e.x, e.y, HIT_Z);
        bolt(c, from, t, tw.boltSeed + i * 7, 22 * (0.5 + u * 0.5), '#bff2ff', 2.8 * (0.6 + u * 0.4));
        glow(c, t[0], t[1], 20, '#5fd4ff', 0.6 * u);
        from = t;
      });
    }
  } else if (kind === 'obelisk') {
    if (!behind) {
      const ch = tw.charge;
      const idle = 0.18 + (reduceMotion ? 0 : 0.06 * Math.sin(clock * 5));
      glow(c, mp[0], mp[1], 15 + ch * 18, '#b784ff', tw.beam > 0 ? 0.7 : ch > 0 ? 0.35 + ch * 0.4 : idle);
      if (ch > 0) {
        glow(c, mp[0], mp[1], 6 + ch * 8, '#ff3a1a', 0.4 + ch * 0.5);
        // Violet motes converge on the pupil while the eye charges.
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + clock * 7;
          const r = (1 - ch) * 22 + 3;
          ell(c, mp[0] + Math.cos(a) * r, mp[1] + Math.sin(a) * r * 0.7, 1.3, 1.3, '#d5b6ff', null);
        }
      }
    }
    if (reach && tw.beam > 0) {
      const u = tw.beam / OBELISK_BEAM;
      const t = P(target.x, target.y, HIT_Z);
      // The soul beam: a violet band with a red heart, running from the pupil through the target.
      const len = Math.hypot(t[0] - mp[0], t[1] - mp[1]) || 1;
      const nx = -(t[1] - mp[1]) / len;
      const ny = (t[0] - mp[0]) / len;
      const wob = (s) => (reduceMotion ? 0 : Math.sin(clock * 30 + s * 9) * 2.4 * Math.sin(s * Math.PI));
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (const [w, col] of [[11 * u + 3, INK], [7 * u + 1.4, '#b784ff'], [3.4 * u + 0.6, '#ff6a8a'], [1.3 * u + 0.3, '#fff1f4']]) {
        c.strokeStyle = col;
        c.lineWidth = w;
        c.beginPath();
        for (let i = 0; i <= 12; i++) {
          const s = i / 12;
          const x = mp[0] + (t[0] - mp[0]) * s + nx * wob(s);
          const y = mp[1] + (t[1] - mp[1]) * s + ny * wob(s);
          if (i) c.lineTo(x, y);
          else c.moveTo(x, y);
        }
        c.stroke();
      }
      glow(c, t[0], t[1], 26, '#b784ff', 0.7 * u);
    }
  }
}

function drawParticle(c, p) {
  const u = p.age / p.life;
  if (p.kind === 'smoke') {
    const [x, y] = P(p.x, p.y, p.z);
    const r = p.r0 + (p.r1 - p.r0) * Math.sqrt(u);
    const base = p.tone >= 2 ? 40 : p.tone >= 1 ? 74 : 118;
    c.globalAlpha = Math.max(0, 0.62 * (1 - u));
    ell(c, x, y, r, r * 0.86, `rgb(${base + 22},${base + 16},${base + 10})`, null);
    c.globalAlpha = 1;
  } else if (p.kind === 'spark') {
    const a = P(p.x, p.y, p.z);
    const b = P(p.x - p.vx * 0.03, p.y - p.vy * 0.03, p.z - p.vz * 0.03);
    c.globalAlpha = 1 - u * 0.7;
    c.strokeStyle = p.colour ?? '#ffe38a';
    c.lineWidth = 1.8;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.stroke();
    c.globalAlpha = 1;
  } else if (p.kind === 'casing') {
    const [x, y] = P(p.x, p.y, p.z);
    c.globalAlpha = u > 0.8 ? (1 - u) / 0.2 : 1;
    c.save();
    c.translate(x, y);
    c.rotate(p.rot + p.vrot * p.age);
    c.fillStyle = '#e8c872';
    c.strokeStyle = INK;
    c.lineWidth = 0.9;
    c.beginPath();
    c.rect(-1.7, -1, 3.4, 2);
    c.fill();
    c.stroke();
    c.restore();
    c.globalAlpha = 1;
  } else if (p.kind === 'tracer') {
    const a = P(p.x0 + (p.x1 - p.x0) * u, p.y0 + (p.y1 - p.y0) * u, p.z0 + (p.z1 - p.z0) * u);
    const t = Math.max(0, u - 0.3);
    const b = P(p.x0 + (p.x1 - p.x0) * t, p.y0 + (p.y1 - p.y0) * t, p.z0 + (p.z1 - p.z0) * t);
    c.lineCap = 'round';
    for (const [w, col] of [[4, INK], [2.2, p.colour], [1, p.core]]) {
      c.strokeStyle = col;
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.stroke();
    }
  } else if (p.kind === 'shell') {
    const pos = flightPos(p);
    const g = P(pos[0], pos[1], 0);
    ell(c, g[0], g[1], 7, 3.4, 'rgba(10,6,4,.3)', null);
    const s = P(pos[0], pos[1], pos[2]);
    ell(c, s[0], s[1], 5.4, 5.4, '#3a3630', INK, 1.8);
    ell(c, s[0] - 1.6, s[1] - 1.6, 1.6, 1.6, '#8a857a', null);
    ell(c, s[0], s[1], 5.4, 1.6, null, '#e0b83e', 1.2);
  } else if (p.kind === 'arc') {
    const a = enemies[p.i];
    const b = enemies[p.j];
    const pa = P(a.x, a.y, 14);
    const pb = P(b.x, b.y, 14);
    c.globalAlpha = 1 - u * 0.6;
    bolt(c, pa, pb, p.seed + Math.floor(clock * 20), 9, '#ff8a2a', 2.2, '#ffe38a');
    c.globalAlpha = 1;
  } else if (p.kind === 'boom') {
    const k = p.radius / SPLASH_REF;
    const R = p.radius * (0.35 + 0.65 * Math.min(1, u * 3));
    // Scorch and shock ring on the ground.
    c.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * TAU;
      const q = P(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, 0);
      if (i) c.lineTo(q[0], q[1]);
      else c.moveTo(q[0], q[1]);
    }
    c.fillStyle = `rgba(40,24,14,${0.4 * (1 - u)})`;
    c.fill();
    c.globalAlpha = Math.max(0, 1 - u * 1.3);
    c.lineWidth = 2.6;
    c.strokeStyle = '#ffd23f';
    c.stroke();
    c.globalAlpha = 1;
    // The fireball: four blobs that rise and cool.
    const rise = Math.min(1, u * 2);
    const cols = ['#fff3c4', '#ffd23f', '#ff8a2a', '#b8431a'];
    for (let i = 3; i >= 0; i--) {
      const r = (10 + i * 6) * (0.5 + 0.9 * Math.min(1, u * 2.6)) * k * 0.8 * (1 - u * 0.5);
      const s = P(p.x, p.y, 6 + i * 3 * k * 0.6 + rise * 20 * k * 0.7);
      c.globalAlpha = Math.max(0, 1 - u * 1.25);
      ell(c, s[0] + (i - 1.5) * 3 * k * 0.6, s[1], r, r * 0.85, cols[i], INK, 1.5);
    }
    c.globalAlpha = 1;
  }
}

function drawLabel(c, tw) {
  const [x, y] = iso(tw.x, tw.y);
  c.font = '700 17px "Barlow Condensed", "Arial Narrow", sans-serif';
  c.textAlign = 'center';
  c.lineJoin = 'round';
  c.lineWidth = 4;
  c.strokeStyle = INK;
  const text = tw.isStd ? LABEL_STD : tw.sp.label;
  c.strokeText(text, x, y + 31);
  c.fillStyle = tw.isStd ? '#b5a385' : '#eadfc4';
  c.fillText(text, x, y + 31);
}

function timed(fn) {
  const t0 = performance.now();
  fn();
  perf.towers += performance.now() - t0;
}

function objects(dt, t) {
  const items = [];
  for (const tw of towers) {
    items.push({
      key: tw.x + tw.y,
      draw: () =>
        timed(() => {
          if (state.view === 'heute') {
            if (tw.isStd) {
              drawTowerSprite(ctx, cache, { x: tw.cx, y: tw.cy, doctrine: tw.lead, rank: 3, aim: { x: target.x, y: target.y }, firing: false, cooldown: 0, flash: 0 }, camera.zoom, view.dpr, t, dt, reduceMotion);
            } else {
              drawTowerSprite(ctx, cache, { x: tw.cx, y: tw.cy, doctrine: tw.lead, special: tw.sp.id, aim: { x: target.x, y: target.y }, firing: tw.firing, cooldown: tw.cooldown, flash: 0 }, camera.zoom, view.dpr, t, dt, reduceMotion);
            }
          } else {
            const s = baseSprite(tw, stepOf(camera.zoom), view.dpr);
            const [ox, oy] = iso(tw.x, tw.y);
            ctx.drawImage(s.canvas, ox - s.ox, oy - s.oy, s.w, s.h);
            drawWeapon(ctx, tw);
          }
        }),
    });
  }
  enemies.forEach((e, i) => {
    items.push({
      key: e.x + e.y,
      draw: () => {
        // Under the flames of the cauldron and the gold of the shrine the enemy shows what happens to it.
        drawEnemy(ctx, e, t, { zoom: camera.zoom, dpr: view.dpr, reducedMotion: reduceMotion, simTime: 0, dt });
        if (state.view === 'neu' && !state.silhouette && e.burn > 0) {
          const [x, y] = P(e.x, e.y, 3);
          const f = flick(i, { x: e.x });
          flameShape(ctx, x - 5, y, 0.7 * f * Math.min(1, e.burn), '#ff8a2a', '#ffd23f');
          flameShape(ctx, x + 5, y + 1, 0.55 * f * Math.min(1, e.burn), '#ffb13b', '#fff3c0');
        }
      },
    });
  });
  return items.sort((a, b) => a.key - b.key);
}

// ---------- the frame ----------

let lastNow = null;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = lastNow === null ? 0 : Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  if (!state.paused && dt > 0) {
    // Fixed steps of 1/60 s, as the game does.
    let left = dt;
    while (left > 1e-6) {
      const s = Math.min(1 / 60, left);
      simStep(s);
      left -= s;
    }
  }
  const t0 = performance.now();
  perf.towers = 0;
  render(now, dt);
  const cost = performance.now() - t0;
  perf.frames += 1;
  perf.sumDraw += cost;
  perf.sumTowers += perf.towers;
  if (perf.frames >= 30) {
    perf.draw = perf.sumDraw / perf.frames;
    perf.acc = perf.sumTowers / perf.frames;
    perf.frames = 0;
    perf.sumDraw = 0;
    perf.sumTowers = 0;
    const el = document.getElementById('perf');
    if (el) el.textContent = `Zeichnen ${perf.draw.toFixed(2)} ms, davon Stellungen ${perf.acc.toFixed(2)} ms`;
  }
}

function render(now, dt) {
  const t = now / 1000;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = C.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ground.draw(ctx, camera, view, SIZE, BIOME_SEEDS[state.biome], now);
  applyCamera(ctx, camera, view);

  // Ground level: foundations, the gold ring of a special, the aura of the shrine, the shadows.
  for (const tw of towers) drawFoundation(ctx, tw);
  for (const tw of towers) {
    if (!tw.isStd) drawSpecialRing(ctx, { x: tw.cx, y: tw.cy });
  }
  if (state.view === 'neu') {
    for (const tw of towers) {
      if (tw.kind === 'purge' && !tw.isStd) drawAura(ctx, tw);
    }
  }
  if (state.view === 'neu' && !state.silhouette) {
    for (const tw of towers) drawShadow(ctx, tw, weaponSamples(tw));
  }

  const items = objects(dt, t);
  if (state.silhouette) {
    if (layer.width !== canvas.width || layer.height !== canvas.height) {
      layer.width = canvas.width;
      layer.height = canvas.height;
    }
    layerCtx.setTransform(1, 0, 0, 1, 0, 0);
    layerCtx.globalCompositeOperation = 'source-over';
    layerCtx.clearRect(0, 0, layer.width, layer.height);
    ctx = layerCtx;
    applyCamera(ctx, camera, view);
    for (const item of items) item.draw();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, layer.width, layer.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx = mainCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    applyCamera(ctx, camera, view);
  } else {
    for (const item of items) item.draw();
    if (state.view === 'neu') for (const p of particles) drawParticle(ctx, p);
    if (state.layout !== 'eine') for (const tw of towers) drawLabel(ctx, tw);
  }
  // The target's ring, so it is clear what can be dragged.
  const [tx, ty] = iso(target.x, target.y);
  if (!state.silhouette) {
    ctx.beginPath();
    ctx.ellipse(tx, ty + 1, 17, 8.5, 0, 0, TAU);
    ctx.strokeStyle = 'rgba(194,58,42,.75)';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** The golden aura of a shrine, in the size of its range: dashed ring, soft fill, runes that turn. Enemies in it are gilded. */
function drawAura(c, tw) {
  const R = PURGE.range * (reduceMotion ? 1 : 0.985 + 0.015 * Math.sin(clock * 4));
  const ring = (r, steps = 48) => {
    c.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * TAU;
      const p = iso(tw.x + Math.cos(a) * r, tw.y + Math.sin(a) * r);
      if (i) c.lineTo(p[0], p[1]);
      else c.moveTo(p[0], p[1]);
    }
  };
  ring(R);
  c.fillStyle = `rgba(255,190,70,${0.08 + 0.1 * tw.aura})`;
  c.fill();
  c.setLineDash([9, 7]);
  c.lineWidth = 2.2;
  c.strokeStyle = `rgba(255,214,110,${0.35 + 0.4 * tw.aura})`;
  c.stroke();
  c.setLineDash([]);
  // Twelve runes on a smaller ring, turning slowly, each a small gold diamond.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + (reduceMotion ? 0 : clock * 0.25);
    const [x, y] = iso(tw.x + Math.cos(a) * R * 0.82, tw.y + Math.sin(a) * R * 0.82);
    c.globalAlpha = (0.35 + 0.4 * tw.aura) * (reduceMotion ? 1 : 0.7 + 0.3 * Math.sin(clock * 3 + i));
    poly(c, [[x, y - 4], [x + 3.2, y], [x, y + 4], [x - 3.2, y]], '#ffd23f', INK, 1);
    c.globalAlpha = 1;
  }
  // Enemies inside are gilded: a gold ring and glow at their feet.
  for (const e of enemies) {
    if (Math.hypot(e.x - tw.x, e.y - tw.y) > PURGE.range) continue;
    const [ex, ey] = iso(e.x, e.y);
    glow(c, ex, ey - 6, 22, '#ffd23f', 0.55 * tw.aura);
    c.beginPath();
    c.ellipse(ex, ey + 1, 15, 7.5, 0, 0, TAU);
    c.strokeStyle = 'rgba(255,214,110,.9)';
    c.lineWidth = 2;
    c.stroke();
  }
}

// ---------- HUD ----------

const $ = (id) => document.getElementById(id);
const NOTES = {
  neu: 'Neu: Spezialbasis als Sprite, Waffe als drehbares Modell. Das Ziel (Ring) lässt sich ziehen.',
  heute: 'Heute: die Spielfunktion drawTowerSprite, Aufsätze gespiegelt statt gedreht, ohne die Schüsse dieser Studie.',
};

function refresh() {
  for (const v of ['neu', 'heute']) $(`v-${v}`).classList.toggle('on', state.view === v);
  for (const l of ['eine', 'drei', 'ring', 'paare']) $(`l-${l}`).classList.toggle('on', state.layout === l);
  $('w-alle').classList.toggle('on', state.weapon === 'alle');
  for (const sp of SPECS) $(`w-${sp.id}`).classList.toggle('on', state.weapon === sp.id);
  $('fire').classList.toggle('on', state.fire);
  $('orbit').classList.toggle('on', state.orbit);
  for (const m of ['live', 'hybrid']) $(`mode-${m}`).classList.toggle('on', state.mode === m);
  $('silhouette').classList.toggle('on', state.silhouette);
  $('biome').textContent = `Boden: ${BIOME_LABEL[state.biome]}`;
  $('pause').classList.toggle('on', state.paused);
  $('pause').textContent = state.paused ? 'Weiter' : 'Pause';
  $('note').textContent = `${NOTES[state.view]} Ziehen am Boden verschiebt, Mausrad zoomt.`;
}

function rebuild() {
  buildTowers();
  particles.length = 0;
  refresh();
}

for (const v of ['neu', 'heute']) {
  $(`v-${v}`).addEventListener('click', () => {
    state.view = v;
    refresh();
  });
}
for (const l of ['eine', 'drei', 'ring', 'paare']) {
  $(`l-${l}`).addEventListener('click', () => {
    state.layout = l;
    // One weapon or three need a weapon to be chosen; with "Alle" the first one is taken.
    if ((l === 'eine' || l === 'drei') && state.weapon === 'alle') state.weapon = SPECS[0].id;
    rebuild();
    fitAll();
  });
}
const weapons = $('weapons');
for (const [id, label] of [['alle', 'Alle sechs'], ...SPECS.map((s) => [s.id, s.short])]) {
  const b = document.createElement('button');
  b.id = `w-${id}`;
  b.type = 'button';
  if (id !== 'alle') {
    b.className = 'dot';
    b.style.setProperty('--dot', DOCTRINE_COLORS[SPECS.find((s) => s.id === id).lead]);
  }
  b.textContent = label;
  b.addEventListener('click', () => {
    state.weapon = id;
    if (id === 'alle' && (state.layout === 'eine' || state.layout === 'drei')) state.layout = 'ring';
    if (id !== 'alle' && state.layout === 'ring') state.layout = 'eine';
    rebuild();
    fitAll();
  });
  weapons.append(b);
}
const toggle = (id, key, after) =>
  $(id).addEventListener('click', () => {
    state[key] = !state[key];
    after?.();
    refresh();
  });
toggle('fire', 'fire');
toggle('silhouette', 'silhouette');
toggle('pause', 'paused');
$('orbit').addEventListener('click', () => {
  state.orbit = !state.orbit;
  if (state.orbit) {
    target.R = Math.max(1.5, Math.hypot(target.x - groupCentre[0], target.y - groupCentre[1]));
    target.phi = Math.atan2(target.y - groupCentre[1], target.x - groupCentre[0]);
  }
  refresh();
});
for (const m of ['live', 'hybrid']) {
  $(`mode-${m}`).addEventListener('click', () => {
    state.mode = m;
    refresh();
  });
}
$('biome').addEventListener('click', () => {
  state.biome = BIOMES[(BIOMES.indexOf(state.biome) + 1) % BIOMES.length];
  refresh();
});

function fitCameraTo(zoom) {
  const [wx, wy] = iso(groupCentre[0], groupCentre[1]);
  camera.zoom = zoom;
  camera.x = wx;
  camera.y = wy - 40 / zoom;
  clampCamera(camera, bounds, limits);
}
function fitAll() {
  const R = target.R + 1.6;
  const halfW = R * 45 + 40;
  const halfH = R * 23 + 120;
  fitCameraTo(Math.max(0.5, Math.min(2.5, Math.min(view.width / (2 * halfW), (view.height - 230) / (2 * halfH)))));
}
for (const [id, z] of [['zoom-05', 0.5], ['zoom-1', 1], ['zoom-2', 2]]) $(id).addEventListener('click', () => fitCameraTo(z));
$('fit').addEventListener('click', fitAll);

// ---------- input: drag the target, or pan the map ----------

let dragging = null;
canvas.addEventListener('pointerdown', (ev) => {
  const rect = canvas.getBoundingClientRect();
  const sx = ev.clientX - rect.left;
  const sy = ev.clientY - rect.top;
  const [wx, wy] = screenToWorld(camera, view, sx, sy);
  const [ex, ey] = iso(target.x, target.y, 10);
  if (Math.hypot(wx - ex, wy - ey) * camera.zoom < 44) {
    dragging = ev.pointerId;
    state.orbit = false;
    refresh();
    canvas.setPointerCapture(ev.pointerId);
    ev.stopImmediatePropagation();
    ev.preventDefault();
  }
});
canvas.addEventListener('pointermove', (ev) => {
  if (dragging !== ev.pointerId) return;
  const rect = canvas.getBoundingClientRect();
  const [wx, wy] = screenToWorld(camera, view, ev.clientX - rect.left, ev.clientY - rect.top);
  const g = isoInverse(wx, wy + 10);
  const x = Math.max(0.6, Math.min(SIZE - 0.6, g.x));
  const y = Math.max(0.6, Math.min(SIZE - 0.6, g.y));
  const dt = 1 / 60;
  target.vx = (x - target.x) / dt;
  target.vy = (y - target.y) / dt;
  setTarget(x, y);
  ev.stopImmediatePropagation();
});
for (const type of ['pointerup', 'pointercancel']) {
  canvas.addEventListener(type, (ev) => {
    if (dragging === ev.pointerId) {
      dragging = null;
      target.vx = 0;
      target.vy = 0;
      ev.stopImmediatePropagation();
    }
  });
}
attachPointerInput(canvas, {
  onPan(dx, dy) {
    panBy(camera, dx, dy);
    clampCamera(camera, bounds, limits);
  },
  onZoom(f, x, y) {
    zoomAt(camera, view, f, x, y, limits);
    clampCamera(camera, bounds, limits);
  },
});

// ---------- contact sheets (for the stills) ----------

/** Draws one special (or a standard emplacement) at rest at `theta` onto g, ground point at the origin. */
function drawTile(g, sp, theta, std = false) {
  const accent = DOCTRINE_COLORS[sp.lead];
  if (std) {
    drawStdBunker(g, 3, accent);
    renderModel(g, buildWeapon(sp.std, makeFrame(theta, MOUNT_Z, SC_STD), stdRest(accent, 3)).parts);
  } else {
    drawSpecialBase(g, accent, pipsOf(sp));
    const F = makeFrame(theta, SPECIAL_MOUNT_Z, scaleOf(sp.kind));
    renderModel(g, buildSpecial(sp.kind, F, restPose(accent), 'all').parts);
  }
}

/** Sixteen directions of all six specials, drawn from the models (not from stages): the contact sheet. */
function sheet16(scale = 1, only = null) {
  const W = Math.round(108 * scale);
  const H = Math.round(200 * scale);
  const rows = only ? [SPECS.find((s) => s.id === only)] : SPECS;
  const out = document.createElement('canvas');
  out.width = W * STAGES;
  out.height = H * rows.length;
  const g = out.getContext('2d');
  g.fillStyle = '#665d52';
  g.fillRect(0, 0, out.width, out.height);
  rows.forEach((sp, r) => {
    for (let k = 0; k < STAGES; k++) {
      g.save();
      g.strokeStyle = 'rgba(0,0,0,.25)';
      g.strokeRect(k * W + 0.5, r * H + 0.5, W - 1, H - 1);
      g.beginPath();
      g.rect(k * W, r * H, W, H);
      g.clip();
      g.translate(k * W + W / 2, r * H + H - 44 * scale);
      g.scale(scale, scale);
      drawTile(g, sp, k * STEP);
      g.restore();
    }
  });
  return out.toDataURL('image/png');
}

/** Silhouettes of the six specials from four sides and, for comparison, the standard emplacement: the sheet at zoom 0.5. */
function silhouetteSheet() {
  const dirs = [['zur Kamera', Math.PI / 4], ['von der Kamera weg', (5 * Math.PI) / 4], ['nach links', (3 * Math.PI) / 4], ['nach rechts', -Math.PI / 4]];
  const W = 120;
  const H = 190;
  const HEAD = 44;
  const LABEL = 190;
  const out = document.createElement('canvas');
  out.width = LABEL + W * (dirs.length + 1);
  out.height = HEAD + H * SPECS.length;
  const g = out.getContext('2d');
  g.fillStyle = '#9a9384';
  g.fillRect(0, 0, out.width, out.height);
  g.fillStyle = '#1c1410';
  g.font = '700 17px "Barlow Condensed", Arial, sans-serif';
  g.textAlign = 'center';
  [...dirs.map((d) => d[0]), 'Standard Rang 3'].forEach((t, i) => g.fillText(t, LABEL + W * i + W / 2, 28));
  const tmp = document.createElement('canvas');
  tmp.width = W;
  tmp.height = H;
  const tg = tmp.getContext('2d');
  SPECS.forEach((sp, r) => {
    g.textAlign = 'left';
    g.fillText(sp.label, 12, HEAD + r * H + H / 2);
    for (let i = 0; i <= dirs.length; i++) {
      tg.setTransform(1, 0, 0, 1, 0, 0);
      tg.clearRect(0, 0, W, H);
      tg.setTransform(1, 0, 0, 1, W / 2, H - 44);
      const std = i === dirs.length;
      drawTile(tg, sp, std ? (3 * Math.PI) / 4 : dirs[i][1], std);
      tg.setTransform(1, 0, 0, 1, 0, 0);
      tg.globalCompositeOperation = 'source-in';
      tg.fillStyle = '#000';
      tg.fillRect(0, 0, W, H);
      tg.globalCompositeOperation = 'source-over';
      g.drawImage(tmp, LABEL + W * i, HEAD + r * H);
    }
  });
  return out.toDataURL('image/png');
}

// ---------- start ----------

resetTarget();
buildTowers();
resetTarget();
for (const tw of towers) tw.theta = Math.atan2(target.y - tw.y, target.x - tw.x);
refresh();
fitAll();
cache.preload([...allTowerDefs(), ...ENEMY_SPRITE_DEFS], camera.zoom, view.dpr).then(() => {
  document.body.dataset.ready = '1';
});

/** Hooks for the screenshot script and the measurements. */
window.__spezial = {
  set(opts = {}) {
    const layoutChanged = 'layout' in opts || 'weapon' in opts;
    Object.assign(state, opts);
    if (layoutChanged) rebuild();
    if ('orbit' in opts && opts.orbit === false) {
      target.vx = 0;
      target.vy = 0;
    }
    refresh();
  },
  placeTarget(x, y) {
    state.orbit = false;
    target.vx = 0;
    target.vy = 0;
    setTarget(x, y);
    refresh();
  },
  /** Runs the simulation in fixed steps, e.g. 1.2 seconds. */
  step(seconds) {
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) simStep(1 / 60);
  },
  /** Turns every tower to its target at once (a still does not wait for the turn). */
  snap() {
    for (const tw of towers) tw.theta = Math.atan2((tw.lead2 ?? [target.x, target.y])[1] - tw.y, (tw.lead2 ?? [target.x, target.y])[0] - tw.x);
  },
  zoom: fitCameraTo,
  fit: fitAll,
  /** Sets the reload counter per kind (seconds), so a still can have every weapon fire at one moment. */
  cds(map) {
    for (const tw of towers) tw.cd = map[tw.kind] ?? 0;
  },
  look(x, y, zoom, lift = 40) {
    const [wx, wy] = iso(x, y);
    camera.zoom = zoom;
    camera.x = wx;
    camera.y = wy - lift / zoom;
    clampCamera(camera, bounds, limits);
  },
  hud(on) {
    for (const el of document.querySelectorAll('.bar, .hud')) el.style.display = on ? '' : 'none';
  },
  towers: () => towers,
  state: () => ({ ...state }),
  target: () => ({ x: target.x, y: target.y }),
  particles: () => particles,
  kinds: KINDS,
  stats: () => ({ ...stats, stages: stageCache.size, live: towers.filter((t) => !useStage(t)).length, bases: baseCache.size }),
  /** Muzzle of each tower in the world, to check it sits at the end of the barrel. */
  muzzles: () => towers.filter((t) => !t.isStd).map((tw) => ({ kind: tw.kind, theta: tw.theta, ...muzzleWorld(tw) })),
  sheet16,
  silhouetteSheet,
  /**
   * Height of every special above its ground point at rest, new (the highest over all sixteen
   * directions) and today (the game's own sprite), in px at zoom 1: the top row of pixels that
   * is not transparent. "standard" is the standard emplacement of rank 3 with an autocannon.
   */
  heights() {
    const W = 300;
    const H = 420;
    const OX = 150;
    const OY = 330;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    const topOf = () => {
      const d = g.getImageData(0, 0, W, H).data;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 60) return OY - y;
      return 0;
    };
    const out = {};
    for (const sp of [...SPECS, { id: 'standard', isStandard: true }]) {
      let best = 0;
      for (let k = 0; k < STAGES; k++) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, W, H);
        g.setTransform(1, 0, 0, 1, OX, OY);
        if (sp.isStandard) drawTile(g, SPECS[1], k * STEP, true);
        else drawTile(g, sp, k * STEP);
        g.setTransform(1, 0, 0, 1, 0, 0);
        best = Math.max(best, topOf());
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      g.setTransform(1, 0, 0, 1, OX, OY - 16);
      const tower = sp.isStandard
        ? { x: 0, y: 0, doctrine: 'autocannon', rank: 3, aim: { x: 5, y: 3 }, firing: false, cooldown: 0, flash: 0 }
        : { x: 0, y: 0, doctrine: sp.lead, special: sp.id, aim: { x: 5, y: 3 }, firing: false, cooldown: 0, flash: 0 };
      drawTowerSprite(g, cache, tower, camera.zoom, view.dpr, 0, 0, true);
      g.setTransform(1, 0, 0, 1, 0, 0);
      out[sp.id] = { neu: best, heute: topOf() };
    }
    return out;
  },
  /**
   * Draw time per frame: `frames` frames of the running scene (one simulation step, one render),
   * after a warm-up. Returns the mean of the whole frame and of the emplacements alone, in ms.
   */
  bench(frames = 120, warm = 40) {
    let now = 100000;
    const run = (n, measure) => {
      let sumAll = 0;
      let sumTowers = 0;
      for (let i = 0; i < n; i++) {
        simStep(1 / 60);
        now += 1000 / 60;
        perf.towers = 0;
        const t0 = performance.now();
        render(now, 1 / 60);
        const cost = performance.now() - t0;
        if (measure) {
          sumAll += cost;
          sumTowers += perf.towers;
        }
      }
      return [sumAll / n, sumTowers / n];
    };
    run(warm, false);
    const [all, towersMs] = run(frames, true);
    return { frame: all, towers: towersMs, busy: towers.filter((t) => t.busy && !t.isStd).length, live: towers.filter((t) => !useStage(t)).length };
  },
};
requestAnimationFrame(frame);
