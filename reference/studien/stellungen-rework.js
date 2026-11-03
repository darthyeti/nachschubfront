// Study: rework of the emplacements (task A-19).
//
// New: a bunker in the style of the new capsule (a sprite, lit with the light of C2) and
// weapons as turnable models that face the target by any angle (stellungen-rework-modell.js),
// with the muzzle fire, sparks, smoke, casings, beam, bolt and jet leaving at the end of the
// barrel, in the direction of the shot. The mortar has a variant, the rocket launcher.
//
// "Heute" draws the same scene with the game's own function (drawTowerSprite), which mirrors
// a top towards the target instead of turning it.
//
// Three ways to draw a weapon: "Drehbar" builds it every frame; "Hybrid 16" draws a resting
// weapon from one of sixteen pre-rendered stages and builds only the ones that move or shoot;
// "Nur 16 Stufen" draws every weapon from a stage. This makes cost and look comparable.
//
// Everything animated runs on a fixed-step simulation of this study (`simStep`), so the
// stills are reproducible (`window.__rework`). Nothing here touches src/; the study only reads it.

import { iso, mapBounds, isoInverse } from '../../src/render/iso.js';
import { poly, ell, cellPath } from '../../src/render/draw.js';
import { C } from '../../src/render/palette.js';
import { createRng } from '../../src/core/random.js';
import { CAMERA } from '../../src/data/settings.js';
import { DOCTRINE_IDS, DOCTRINE_COLORS, DOCTRINES } from '../../src/data/doctrines.js';
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
import { allTowerDefs, drawTowerSprite } from '../../src/render/towerSprites.js';
import { ENEMY_SPRITE_DEFS, createEnemySpriteRenderer } from '../../src/render/enemySprites.js';
import { attachPointerInput } from '../../src/input/pointer.js';
import { installPageGuards } from '../../src/input/guards.js';
import { makeFrame, buildWeapon, renderModel, restPose, drawBunker, MUZZLE, MOUNT_Z, BUNKER_HALF, CASING_PORT, K, ROCKET_ORDER, WEAPON_SCALE as SC } from './stellungen-rework-modell.js';

const INK = C.ink;
const TAU = Math.PI * 2;
const SIZE = 14;

// ---------- constants of the study ----------

/** Turn speed of each weapon in radians per second (the study's guess; heavier is slower). */
const TURN = { autocannon: 5.5, flame: 4, mortar: 2.4, rocket: 2.6, tesla: 5, laser: 4.2, psi: 3.2 };
/** A weapon fires once it points within this many radians of the target. */
const ALIGN = 0.14;
/** Seconds the target needs for one lap, and the lap's distance from the middle of the group (cells). */
const LAP_SECONDS = 22;
const ORBIT = { eine: 3.2, drei: 4.4, alle: 5.8, viele: 6 };
/** Where a shot lands on the target, px above the ground. */
const HIT_Z = 12;
const GRAVITY = 620;
const MAX_PARTICLES = 420;
const FLASH_SECONDS = 0.075;
const RECOIL_DECAY = 7;
const JET_LENGTH = 1.9;
const TRACER_SPEED = 16;
const SHELL_SECONDS = DOCTRINES.mortar.flightSeconds;
const ROCKET_SECONDS = 0.8;
const SPLASH = DOCTRINES.mortar.splashRadius;
/** Rocket salvo: seconds between two rockets, seconds of reload after the sixth. */
const SALVO_GAP = 0.3;
const SALVO_RELOAD = 2.4;
const LASER_CHARGE = 0.4;
const LASER_BEAM = 0.22;
const TESLA_BOLT = 0.3;
const PSI_PULSE_EVERY = 1.1;
const PSI_PULSE_SECONDS = 0.8;
/** The study's own pace for the psi: one pulse every 1.1 s. */
const LABELS = { autocannon: 'Autokanone', flame: 'Flamme', mortar: 'Mörser', rocket: 'Raketenwerfer', tesla: 'Tesla', laser: 'Laser', psi: 'Psi' };

const rng = createRng('stellungen-rework');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- state ----------

const state = {
  view: 'neu', // neu | heute
  layout: 'drei', // eine | drei | alle
  doctrine: 'autocannon',
  rank: 3,
  rocket: false,
  fire: true,
  orbit: true,
  mode: 'hybrid', // live | hybrid | stages
  silhouette: false,
  biome: 'ash',
  paused: false,
};

const BIOME_SEEDS = {};
for (let i = 0; Object.keys(BIOME_SEEDS).length < 3 && i < 200; i++) BIOME_SEEDS[biomeOf(`REWORK${i}`)] ??= `REWORK${i}`;
const BIOMES = ['ash', 'rust', 'toxic'];
const BIOME_LABEL = { ash: 'Asche', rust: 'Rost', toxic: 'Gift' };

const LAYOUTS = {
  eine: [[6, 6]],
  // Thirty emplacements for the cost of many weapons at once.
  viele: Array.from({ length: 30 }, (_, i) => [2 + (i % 6) * 2, 2 + Math.floor(i / 6) * 2]),
  drei: [[4, 8], [6, 6], [8, 4]],
  // A ring around the middle of the map: from there every direction is aimed at once.
  alle: [[4, 9], [7, 10], [10, 9], [10, 5], [7, 4], [4, 5]],
};

const kindOf = (doctrine) => (doctrine === 'mortar' && state.rocket ? 'rocket' : doctrine);
const wrapPi = (a) => ((a + Math.PI * 3) % TAU) - Math.PI;

let towers = [];
let groupCentre = [7, 7];
const target = { x: 0, y: 0, vx: 0, vy: 0, phi: 0, R: 3.2, dx: 1, dy: 0, flash: 0 };
const enemy = { id: 1, type: 'warrior', x: 0, y: 0, dx: 1, dy: 0, d: 9, flash: 0, flying: false };
const particles = [];
let clock = 0;

function buildTowers() {
  const cells = LAYOUTS[state.layout];
  const doctrines = state.layout === 'alle' ? DOCTRINE_IDS : state.layout === 'viele' ? cells.map((_, i) => DOCTRINE_IDS[i % 6]) : cells.map(() => state.doctrine);
  towers = cells.map(([cx, cy], i) => {
    const doctrine = doctrines[i];
    return {
      cx,
      cy,
      x: cx + 0.5,
      y: cy + 0.5,
      doctrine,
      kind: kindOf(doctrine),
      theta: Math.atan2(target.y - (cy + 0.5), target.x - (cx + 0.5)),
      cd: rng.range(0, 0.6),
      recoil: 0,
      spin: 0,
      spinV: 0,
      flashT: 0,
      charge: 0,
      beam: 0,
      bolt: 0,
      boltSeed: 0,
      jet: 0,
      pulses: [],
      pulseCd: rng.range(0, 1),
      salvo: { idx: 0, loaded: [true, true, true, true, true, true], tube: 0 },
      lastTube: 0,
      gyro: 0.6,
      firing: false,
      cooldown: 0,
      aligned: false,
      lead: null,
      hit: null,
      model: null,
      stats: { builds: 0 },
    };
  });
  const mean = (f) => towers.reduce((s, t) => s + f(t), 0) / towers.length;
  groupCentre = [mean((t) => t.x), mean((t) => t.y)];
  target.R = ORBIT[state.layout];
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
}

// ---------- the muzzle of a tower, in the world ----------

/** Number of pre-rendered directions of the hybrid and of the pure stage mode. */
const STAGES = 16;
const STEP = TAU / STAGES;

/**
 * A weapon is "busy" while anything about it moves or shoots: then it is built and drawn
 * every frame. A resting weapon (hybrid) is a pre-rendered stage.
 */
function isBusy(tw) {
  return (
    !tw.aligned ||
    tw.firing ||
    tw.recoil > 0.01 ||
    tw.flashT > 0 ||
    tw.charge > 0 ||
    tw.beam > 0 ||
    tw.bolt > 0 ||
    tw.jet > 0.03 ||
    tw.pulses.length > 0 ||
    tw.salvo.loaded.some((l) => !l)
  );
}

/** True when this weapon is drawn from a stage this frame. */
function useStage(tw) {
  return state.mode === 'stages' || (state.mode === 'hybrid' && !tw.busy);
}

/** Angle the weapon is drawn at: the turned one, or the nearest of the sixteen stages. */
function shownTheta(tw) {
  return useStage(tw) ? Math.round(tw.theta / STEP) * STEP : tw.theta;
}

function poseOf(tw, live = true) {
  const p = restPose(DOCTRINE_COLORS[tw.doctrine], state.rank);
  if (!live) return p;
  p.recoil = tw.recoil;
  p.spin = tw.spin;
  p.gyro = tw.gyro;
  p.bob = reduceMotion ? 0 : Math.sin(clock * 2 + tw.x) * 2;
  p.loaded = tw.salvo.loaded;
  p.tube = tw.kind === 'rocket' ? tw.lastTube : 0;
  return p;
}

/**
 * Muzzle and direction of the shot in world coordinates: x, y in cells, z in px.
 * The position follows the weapon as it is shown, the direction follows the aim.
 */
function muzzleWorld(tw, tube = tw.lastTube) {
  const pose = poseOf(tw);
  pose.tube = tube;
  const m = MUZZLE[tw.kind](pose);
  const Fs = makeFrame(shownTheta(tw), MOUNT_Z, SC);
  const Fa = makeFrame(tw.theta, MOUNT_Z, SC);
  const [px, py] = Fs.world(m.at[0], m.at[1]);
  const dw = Fa.wn(m.dir[0], m.dir[1], m.dir[2]);
  return { x: tw.x + px, y: tw.y + py, z: MOUNT_Z + m.at[2] * SC, dir: dw };
}

// ---------- particles ----------

function emit(p) {
  if (particles.length < MAX_PARTICLES) particles.push({ age: 0, vx: 0, vy: 0, vz: 0, ...p });
}

function smoke(x, y, z, vx, vy, vz, r0, r1, life, tone = 0) {
  emit({ kind: 'smoke', x, y, z, vx, vy, vz, r0, r1, life, tone });
}

function sparkBurst(x, y, z, count, speed, life = 0.28) {
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, TAU);
    const s = rng.range(0.3, 1) * speed;
    emit({ kind: 'spark', x, y, z, vx: Math.cos(a) * s * 0.02, vy: Math.sin(a) * s * 0.02, vz: rng.range(0.1, 1) * speed, life: life * rng.range(0.6, 1.1) });
  }
}

function hitTarget() {
  enemy.flash = 0.08;
}

function boom(x, y, radius) {
  emit({ kind: 'boom', x, y, radius, life: 0.7 });
  for (let i = 0; i < 7; i++) smoke(x + rng.range(-0.25, 0.25), y + rng.range(-0.25, 0.25), rng.range(2, 8), rng.range(-0.1, 0.1), rng.range(-0.1, 0.1), rng.range(20, 50), 5, 17, rng.range(0.9, 1.5), 1);
  sparkBurst(x, y, 8, 12, 230, 0.5);
  hitTarget();
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      if (p.kind === 'shell') boom(p.x1, p.y1, SPLASH);
      if (p.kind === 'rocket') boom(p.P2[0], p.P2[1], SPLASH * 0.8);
      if (p.kind === 'tracer') {
        sparkBurst(p.x1, p.y1, p.z1, 4, 150, 0.2);
        hitTarget();
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
    } else if (p.kind === 'smoke') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.vz *= 0.97;
    } else if (p.kind === 'shell' || p.kind === 'rocket') {
      p.trail = (p.trail ?? 0) - dt;
      if (p.trail <= 0) {
        p.trail = p.kind === 'shell' ? 0.05 : 0.025;
        const pos = flightPos(p);
        smoke(pos[0], pos[1], pos[2], 0, 0, 8, p.kind === 'shell' ? 2 : 3, p.kind === 'shell' ? 6 : 9, 0.8);
      }
    }
  }
}

/** Position of a shell or rocket at its age: [x, y, z]. */
function flightPos(p) {
  const u = p.age / p.life;
  if (p.kind === 'shell') {
    return [p.x0 + (p.x1 - p.x0) * u, p.y0 + (p.y1 - p.y0) * u, p.z0 + (p.z1 - p.z0) * u + p.arc * 4 * u * (1 - u)];
  }
  const a = (1 - u) * (1 - u);
  const b = 2 * (1 - u) * u;
  const c = u * u;
  return [0, 1, 2].map((i) => a * p.P0[i] + b * p.P1[i] + c * p.P2[i]);
}

// ---------- simulation of the study ----------

/** Where the target will be when a slow shot lands. */
function predicted(seconds) {
  return [target.x + target.vx * seconds, target.y + target.vy * seconds];
}

function simStep(dt) {
  clock += dt;
  enemy.flash = Math.max(0, enemy.flash - dt);
  if (state.orbit) {
    target.phi += (TAU / LAP_SECONDS) * dt;
    placeTarget(dt);
  } else {
    target.vx = 0;
    target.vy = 0;
  }
  enemy.x = target.x;
  enemy.y = target.y;
  enemy.dx = target.dx;
  enemy.dy = target.dy;
  enemy.flash = Math.max(enemy.flash, 0);

  for (const tw of towers) updateTower(tw, dt);
  updateParticles(dt);
}

function updateTower(tw, dt) {
  const kind = tw.kind;
  const slow = kind === 'mortar' || kind === 'rocket';
  const aim = slow ? predicted(kind === 'mortar' ? SHELL_SECONDS : ROCKET_SECONDS) : [target.x, target.y];
  tw.lead = aim;
  const want = Math.atan2(aim[1] - tw.y, aim[0] - tw.x);
  const delta = wrapPi(want - tw.theta);
  const step = TURN[kind] * dt;
  tw.theta += Math.max(-step, Math.min(step, delta));
  tw.aligned = Math.abs(wrapPi(want - tw.theta)) < ALIGN;

  tw.recoil = Math.max(0, tw.recoil - dt * RECOIL_DECAY);
  tw.flashT = Math.max(0, tw.flashT - dt);
  tw.cd = Math.max(0, tw.cd - dt);
  const go = state.fire && tw.aligned;
  tw.firing = false;

  if (kind === 'autocannon') {
    tw.spinV += ((go ? 34 : 0) - tw.spinV) * Math.min(1, dt * 7);
    tw.spin += tw.spinV * dt;
    if (go) {
      tw.firing = true;
      if (tw.cd <= 0) {
        tw.cd += 1 / DOCTRINES.autocannon.fire;
        shootAutocannon(tw);
      }
    }
  } else if (kind === 'flame') {
    tw.firing = go;
    tw.jet += ((go ? 1 : 0) - tw.jet) * Math.min(1, dt * 8);
    if (tw.jet > 0.5 && rng.chance(dt * 22)) {
      const m = muzzleWorld(tw);
      const d = JET_LENGTH * tw.jet;
      const dir = norm2(m.dir);
      smoke(m.x + dir[0] * d, m.y + dir[1] * d, m.z + 12, dir[0] * 0.3, dir[1] * 0.3, 40, 6, 16, 1.1, 2);
    }
  } else if (kind === 'laser') {
    if (go && tw.cd <= 0 && tw.charge === 0) {
      tw.cd += 1 / DOCTRINES.laser.fire;
      tw.charge = 0.0001;
    }
    if (tw.charge > 0) {
      tw.charge += dt / LASER_CHARGE;
      tw.firing = true;
      if (tw.charge >= 1) {
        tw.charge = 0;
        tw.beam = LASER_BEAM;
        tw.recoil = 0.5;
        hitTarget();
      }
    }
    tw.beam = Math.max(0, tw.beam - dt);
  } else if (kind === 'tesla') {
    if (go && tw.cd <= 0) {
      tw.cd += 1 / DOCTRINES.tesla.fire;
      tw.bolt = TESLA_BOLT;
      tw.flashT = FLASH_SECONDS;
      hitTarget();
      sparkBurst(target.x, target.y, HIT_Z, 6, 180, 0.3);
    }
    tw.bolt = Math.max(0, tw.bolt - dt);
    tw.firing = tw.bolt > 0;
    tw.boltSeed = Math.floor(clock * 28);
  } else if (kind === 'psi') {
    tw.gyro += dt * (state.fire ? 3.4 : 1.2);
    tw.pulseCd -= dt;
    tw.firing = state.fire;
    if (state.fire && tw.pulseCd <= 0) {
      tw.pulseCd += PSI_PULSE_EVERY;
      tw.pulses.push({ age: 0 });
    }
    for (const p of tw.pulses) p.age += dt;
    tw.pulses = tw.pulses.filter((p) => p.age < PSI_PULSE_SECONDS);
  } else if (kind === 'mortar') {
    if (go && tw.cd <= 0) {
      tw.cd += 1 / DOCTRINES.mortar.fire;
      shootMortar(tw);
    }
  } else if (kind === 'rocket') {
    const s = tw.salvo;
    if (go && tw.cd <= 0) {
      if (s.idx === 0) s.loaded.fill(true);
      const tube = ROCKET_ORDER[s.idx];
      s.loaded[tube] = false;
      tw.lastTube = tube;
      shootRocket(tw, tube);
      s.idx += 1;
      tw.cd += SALVO_GAP;
      if (s.idx >= 6) {
        s.idx = 0;
        tw.cd += SALVO_RELOAD;
      }
    }
  }
  // What the game's own tower sprite reads: a reload counter that jumps up on a shot.
  tw.cooldown = tw.cd;
  if (kind === 'flame') tw.cooldown = 0;
  tw.busy = isBusy(tw);
}

const norm2 = (d) => {
  const l = Math.hypot(d[0], d[1]) || 1;
  return [d[0] / l, d[1] / l];
};

function shootAutocannon(tw) {
  const m = muzzleWorld(tw);
  tw.recoil = 1;
  tw.flashT = FLASH_SECONDS;
  const side = makeFrame(tw.theta, 0, SC).s;
  // A case leaves the ejection port on the side of the housing and falls.
  const Fs = makeFrame(shownTheta(tw), MOUNT_Z, SC);
  const [px, py] = Fs.world(CASING_PORT[0], CASING_PORT[1]);
  emit({
    kind: 'casing',
    x: tw.x + px,
    y: tw.y + py,
    z: MOUNT_Z + CASING_PORT[2] * SC,
    vx: side[0] * rng.range(0.9, 1.5),
    vy: side[1] * rng.range(0.9, 1.5),
    vz: rng.range(90, 170),
    rot: rng.range(0, TAU),
    vrot: rng.range(-18, 18),
    life: 1.8,
  });
  if (rng.chance(0.35)) smoke(m.x, m.y, m.z, m.dir[0] * 0.4, m.dir[1] * 0.4, 16, 2.5, 7, 0.55);
  // The tracer flies from the muzzle to the target.
  const d = Math.hypot(target.x - m.x, target.y - m.y);
  emit({ kind: 'tracer', x0: m.x, y0: m.y, z0: m.z, x1: target.x, y1: target.y, z1: HIT_Z, life: Math.max(0.05, d / TRACER_SPEED) });
}

function shootMortar(tw) {
  const m = muzzleWorld(tw);
  tw.recoil = 1;
  tw.flashT = FLASH_SECONDS * 1.6;
  const [lx, ly] = tw.lead;
  const d = Math.hypot(lx - m.x, ly - m.y);
  emit({ kind: 'shell', x0: m.x, y0: m.y, z0: m.z, x1: lx, y1: ly, z1: 0, arc: 70 + d * 20, life: SHELL_SECONDS });
  // A pillar of smoke up the tube and a puff behind the weapon.
  for (let i = 0; i < 6; i++) {
    smoke(m.x + m.dir[0] * i * 0.03, m.y + m.dir[1] * i * 0.03, m.z + i * 4, m.dir[0] * 0.25 + rng.range(-0.12, 0.12), m.dir[1] * 0.25 + rng.range(-0.12, 0.12), 60 + i * 12, 4, 15, 1.2 + i * 0.1);
  }
  sparkBurst(m.x, m.y, m.z, 5, 120, 0.25);
}

function shootRocket(tw, tube) {
  const m = muzzleWorld(tw, tube);
  tw.recoil = 0;
  tw.flashT = FLASH_SECONDS * 2;
  const [lx, ly] = tw.lead;
  const d = Math.hypot(lx - m.x, ly - m.y);
  const reach = d * 0.42;
  const P0 = [m.x, m.y, m.z];
  const P1 = [m.x + m.dir[0] * reach, m.y + m.dir[1] * reach, m.z + m.dir[2] * reach * K + 28];
  emit({ kind: 'rocket', P0, P1, P2: [lx, ly, HIT_Z], life: ROCKET_SECONDS, tube });
  // The back blast leaves behind the pod, against the line of the tube.
  const back = [-m.dir[0], -m.dir[1], -m.dir[2]];
  for (let i = 0; i < 5; i++) {
    smoke(m.x + back[0] * (0.46 * SC + i * 0.04), m.y + back[1] * (0.46 * SC + i * 0.04), m.z + back[2] * 0.46 * SC * K, back[0] * 0.45 + rng.range(-0.12, 0.12), back[1] * 0.45 + rng.range(-0.12, 0.12), rng.range(-5, 25), 3, 12, rng.range(0.7, 1.1), 0.5);
  }
  sparkBurst(m.x, m.y, m.z, 4, 140, 0.25);
}

// ---------- caches: the bunker, the sixteen stages ----------

const bunkerCache = new Map();
const stageCache = new Map();
const stats = { bakes: 0 };

/** The scale steps of the sprites: 0.5, 1, 2 times the pixel ratio (docs/ART.md). */
function stepOf(zoom) {
  return zoom <= 0.7 ? 0.5 : zoom <= 1.4 ? 1 : 2;
}

function bunkerSprite(rank, accent, step, dpr) {
  const key = `${rank}|${accent}|${step}|${dpr}`;
  let s = bunkerCache.get(key);
  if (!s) {
    const w = 84;
    const h = 84;
    const ox = 42;
    const oy = 62;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * step * dpr);
    canvas.height = Math.ceil(h * step * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(step * dpr, 0, 0, step * dpr, ox * step * dpr, oy * step * dpr);
    drawBunker(g, rank, accent);
    s = { canvas, w, h, ox, oy };
    bunkerCache.set(key, s);
    stats.bakes += 1;
  }
  return s;
}

/** One of the sixteen stages of a weapon, drawn at rest at the angle k * 22.5 degrees. */
function stageOf(kind, accent, rank, k, step, dpr) {
  const key = `${kind}|${accent}|${rank}|${k}|${step}|${dpr}`;
  let s = stageCache.get(key);
  if (!s) {
    const w = 100;
    const h = 100;
    const ox = 50;
    const oy = 74;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * step * dpr);
    canvas.height = Math.ceil(h * step * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(step * dpr, 0, 0, step * dpr, ox * step * dpr, oy * step * dpr);
    const F = makeFrame(k * STEP, MOUNT_Z, SC);
    const built = buildWeapon(kind, F, restPose(accent, rank));
    renderModel(g, built.parts);
    s = { canvas, w, h, ox, oy, samples: built.samples, F };
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
const perf = { draw: 0, models: 0, frames: 0, sumDraw: 0, sumModels: 0, shown: '' };

function drawFoundation(c, tw) {
  const colour = DOCTRINE_COLORS[tw.doctrine];
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

/** Ground shadow of bunker and weapon in one fill, so nothing is darkened twice. */
function drawShadow(c, tw, samples) {
  c.beginPath();
  addShadowPath(c, rectCorners(tw.x - BUNKER_HALF, tw.y - BUNKER_HALF, tw.x + BUNKER_HALF, tw.y + BUNKER_HALF), MOUNT_Z);
  if (samples) {
    const pts = samples.map(([lx, ly, z]) => {
      const F = samples.F;
      const [wx, wy] = F.world(lx, ly);
      const h = MOUNT_Z + z * F.scale;
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
  // Dark foot on the ground along both near sides, as for every block (docs/ART.md).
  footStrip(c, tw.x + BUNKER_HALF, tw.y - BUNKER_HALF, tw.x + BUNKER_HALF, tw.y + BUNKER_HALF, 1, 0);
  footStrip(c, tw.x - BUNKER_HALF, tw.y + BUNKER_HALF, tw.x + BUNKER_HALF, tw.y + BUNKER_HALF, 0, 1);
}

function weaponSamples(tw, kind) {
  if (useStage(tw)) {
    const k = ((Math.round(tw.theta / STEP) % STAGES) + STAGES) % STAGES;
    const s = stageOf(kind, DOCTRINE_COLORS[tw.doctrine], state.rank, k, stepOf(camera.zoom), view.dpr);
    const out = s.samples.slice();
    out.F = s.F;
    return out;
  }
  // The live model: samples of the pose at rest are as good for a shadow and cost nothing per frame.
  const F = makeFrame(tw.theta, 0, SC);
  if (!tw.shadowParts || tw.shadowKind !== kind) {
    tw.shadowKind = kind;
    tw.shadowParts = buildWeapon(kind, makeFrame(0, 0, SC), restPose('#fff', 3)).samples;
  }
  const out = tw.shadowParts.slice();
  out.F = F;
  return out;
}

/** Draws one weapon model at its tower, plus the fire that belongs to it. */
function drawWeapon(c, tw) {
  const t0 = performance.now();
  const kind = tw.kind;
  const accent = DOCTRINE_COLORS[tw.doctrine];
  const [ox, oy] = iso(tw.x, tw.y);
  const mw = muzzleWorld(tw);
  const front = mw.dir[0] + mw.dir[1] >= 0;
  if (!front && !state.silhouette) drawFx(c, tw, mw, 'back');
  c.save();
  c.translate(ox, oy);
  if (useStage(tw)) {
    const k = ((Math.round(tw.theta / STEP) % STAGES) + STAGES) % STAGES;
    const s = stageOf(kind, accent, state.rank, k, stepOf(camera.zoom), view.dpr);
    const F = s.F;
    // The recoil pushes the whole stage back along the line of the barrel.
    const push = tw.recoil * (kind === 'rocket' ? 0 : 5);
    const [bx, by] = F.W(-push * 0.02, 0, MOUNT_Z);
    const [ax, ay] = F.W(0, 0, MOUNT_Z);
    c.drawImage(s.canvas, bx - ax - s.ox, by - ay - s.oy, s.w, s.h);
  } else {
    const F = makeFrame(tw.theta, MOUNT_Z, SC);
    const built = buildWeapon(kind, F, poseOf(tw));
    tw.model = built;
    renderModel(c, built.parts);
  }
  c.restore();
  if (!state.silhouette) drawFx(c, tw, mw, 'front');
  perf.models += performance.now() - t0;
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
  // s2 = dir x s1
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
  g.addColorStop(0, `${colour}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`);
  g.addColorStop(1, `${colour}00`);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}

/** A jagged line with ink outline and two glows, for the lightning of the coil. */
function bolt(c, a, b, seed, jitter, colour, width) {
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
  for (const [w, col] of [[width + 3.6, INK], [width, colour], [width * 0.4, '#ffffff']]) {
    c.strokeStyle = col;
    c.lineWidth = w;
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.stroke();
  }
}

/** Fire, beam, bolt and rings of one weapon. `phase`: behind the weapon or in front of it. */
function drawFx(c, tw, m, phase) {
  const kind = tw.kind;
  const accent = DOCTRINE_COLORS[tw.doctrine];
  const dir = m.dir;
  const mp = P(m.x, m.y, m.z);
  const pos = { x: m.x, y: m.y, z: m.z };
  const behind = phase === 'back';
  const front = dir[0] + dir[1] >= 0;
  // Flares and glows sit at the muzzle and are always in front; jets, beams, bolts and
  // rings reach out and go behind the weapon when they run away from the camera.
  const reach = (!front && behind) || (front && !behind);

  if (kind === 'autocannon' && !behind && tw.flashT > 0) {
    const u = tw.flashT / FLASH_SECONDS;
    glow(c, mp[0], mp[1], 16, '#ffd23f', 0.5 * u);
    flare(c, pos, dir, 0.42 * (0.6 + 0.4 * u), 0.1, '#ffd23f', '#fff3b0');
  } else if (kind === 'flame') {
    if (reach) drawJet(c, tw, m);
    if (!behind) {
      if (tw.jet < 0.1) {
        const f = reduceMotion ? 1 : 0.8 + Math.sin(clock * 20) * 0.2;
        ell(c, mp[0], mp[1], 2.6 * f, 3.4 * f, '#6fb7ff', INK, 1);
      } else {
        glow(c, mp[0], mp[1], 14, '#ff8a2a', 0.5 * tw.jet);
      }
    }
  } else if (kind === 'mortar' && !behind && tw.flashT > 0) {
    const u = tw.flashT / (FLASH_SECONDS * 1.6);
    glow(c, mp[0], mp[1], 22, '#ffd23f', 0.5 * u);
    flare(c, pos, dir, 0.5 * (0.6 + 0.4 * u), 0.14, '#ff8a2a', '#ffe38a');
  } else if (kind === 'rocket' && !behind && tw.flashT > 0) {
    const u = tw.flashT / (FLASH_SECONDS * 2);
    glow(c, mp[0], mp[1], 20, '#ffd23f', 0.5 * u);
    flare(c, pos, dir, 0.42 * (0.6 + 0.4 * u), 0.11, '#ff8a2a', '#ffe38a');
    // Back blast behind the pod.
    const rear = { x: m.x - dir[0] * 0.45 * SC, y: m.y - dir[1] * 0.45 * SC, z: m.z - dir[2] * 0.45 * SC * K };
    flare(c, rear, [-dir[0], -dir[1], -dir[2]], 0.42 * u, 0.12, '#d89a56', '#fff0c0');
  } else if (kind === 'laser') {
    if (!behind) {
      const charge = tw.charge;
      const idle = 0.25 + 0.1 * Math.sin(clock * 6);
      glow(c, mp[0], mp[1], 10 + charge * 22, accent, charge > 0 ? 0.35 + charge * 0.5 : idle);
      if (charge > 0) {
        ell(c, mp[0], mp[1], 2 + charge * 3.2, 2 + charge * 3.2, '#fff1e4', INK, 1);
        // Sparks converge on the lens while it charges.
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + clock * 9;
          const r = (1 - charge) * 15 + 3;
          ell(c, mp[0] + Math.cos(a) * r, mp[1] + Math.sin(a) * r * 0.7, 1.1, 1.1, '#ffd0c0', null);
        }
      }
    }
    if (reach && tw.beam > 0) {
      const u = tw.beam / LASER_BEAM;
      const dh = norm2(dir);
      const far = [target.x + dh[0] * 1.2, target.y + dh[1] * 1.2];
      const a = mp;
      // The beam runs from the muzzle through the target, along the aim.
      const to = [m.x + dh[0] * Math.hypot(far[0] - m.x, far[1] - m.y), m.y + dh[1] * Math.hypot(far[0] - m.x, far[1] - m.y)];
      const b = P(to[0], to[1], HIT_Z);
      c.lineCap = 'round';
      for (const [w, col] of [[10 * u + 2, INK], [6.5 * u + 1, accent], [2.6 * u + 0.5, '#fff1e4']]) {
        c.strokeStyle = col;
        c.lineWidth = w;
        c.beginPath();
        c.moveTo(a[0], a[1]);
        c.lineTo(b[0], b[1]);
        c.stroke();
      }
      const t = P(target.x, target.y, HIT_Z);
      glow(c, t[0], t[1], 22, accent, 0.6 * u);
    }
  } else if (kind === 'tesla') {
    if (!behind) {
      glow(c, mp[0], mp[1], tw.bolt > 0 ? 20 : 12, '#5fd4ff', tw.bolt > 0 ? 0.7 : 0.3 + 0.1 * Math.sin(clock * 9));
      if (tw.bolt <= 0 && !reduceMotion) {
        // Idle: a small arc now and then from the tip.
        const k = Math.floor(clock * 7);
        const r = Math.sin(k * 91.7) * 1000;
        if (r - Math.floor(r) < 0.6) {
          const a = (Math.sin(k * 12.3) * 1000) % TAU;
          bolt(c, mp, [mp[0] + Math.cos(a) * 12, mp[1] + Math.sin(a) * 9 - 3], k, 5, '#bff2ff', 1.4);
        }
      }
    }
    if (reach && tw.bolt > 0) {
      const u = tw.bolt / TESLA_BOLT;
      const t = P(target.x, target.y, HIT_Z);
      bolt(c, mp, t, tw.boltSeed, 24 * (0.5 + u * 0.5), '#bff2ff', 2.6 * (0.6 + u * 0.4));
      // A fork a little before the target.
      const fork = [mp[0] + (t[0] - mp[0]) * 0.55, mp[1] + (t[1] - mp[1]) * 0.55];
      bolt(c, fork, [fork[0] + 16, fork[1] - 12], tw.boltSeed + 3, 8, '#bff2ff', 1.6);
      glow(c, t[0], t[1], 20, '#5fd4ff', 0.6 * u);
    }
  } else if (kind === 'psi') {
    if (!behind) {
      const [ax, ay] = P(tw.x, tw.y, MOUNT_Z + 28 * SC);
      glow(c, ax, ay, 30, '#b784ff', tw.firing ? 0.32 : 0.2);
    }
    if (reach) {
      const dh = norm2(dir);
      const s1 = [-dh[1], dh[0]];
      for (const pulse of tw.pulses) {
        const u = pulse.age / PSI_PULSE_SECONDS;
        const dist = 0.1 + u * 2.4;
        const r = 0.18 + u * 0.7;
        c.beginPath();
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * TAU;
          const p = P(m.x + dh[0] * dist + s1[0] * Math.cos(a) * r, m.y + dh[1] * dist + s1[1] * Math.cos(a) * r, m.z + Math.sin(a) * r * K);
          if (i) c.lineTo(p[0], p[1]);
          else c.moveTo(p[0], p[1]);
        }
        c.globalAlpha = Math.max(0, 1 - u) * 0.95;
        for (const [w, col] of [[4.4, INK], [2.2, '#d5b6ff']]) {
          c.strokeStyle = col;
          c.lineWidth = w;
          c.stroke();
        }
        c.globalAlpha = 1;
      }
    }
  }
}

/** The flame jet: blobs from the nozzle along the aim, white hot at the nozzle, dark at the tip. */
function drawJet(c, tw, m) {
  if (tw.jet < 0.05) return;
  const dh = norm2(m.dir);
  const len = JET_LENGTH * tw.jet;
  const n = 13;
  const origin = P(m.x, m.y, m.z);
  const tipPoint = P(m.x + dh[0] * len, m.y + dh[1] * len, m.z + 10);
  const ang = Math.atan2(tipPoint[1] - origin[1], tipPoint[0] - origin[0]);
  const colours = ['#fff3c4', '#ffe38a', '#ffd23f', '#ffb02e', '#ff8a2a', '#e5601f', '#b8431a'];
  for (let i = n - 1; i >= 0; i--) {
    const u = i / (n - 1);
    const wob = reduceMotion ? 0 : Math.sin(clock * 24 + i * 1.7 + tw.x);
    const dist = u * len;
    const p = P(m.x + dh[0] * dist, m.y + dh[1] * dist, m.z + u * u * 14 + wob * 1.6);
    const r = (3 + u * 15) * (0.88 + wob * 0.1);
    const col = colours[Math.min(colours.length - 1, Math.floor(u * colours.length))];
    c.save();
    c.translate(p[0], p[1] + wob * 1.2);
    c.rotate(ang);
    ell(c, 0, 0, r * 1.25, r * 0.85, col, INK, 1.3);
    c.restore();
  }
  // The white core shows at the nozzle only.
  ell(c, origin[0], origin[1], 3.4, 2.8, '#ffffff', null);
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
    c.strokeStyle = '#ffe38a';
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
    const t = Math.max(0, u - 0.28);
    const b = P(p.x0 + (p.x1 - p.x0) * t, p.y0 + (p.y1 - p.y0) * t, p.z0 + (p.z1 - p.z0) * t);
    c.lineCap = 'round';
    for (const [w, col] of [[4, INK], [2.2, '#ffd23f'], [1, '#fff3b0']]) {
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
    ell(c, g[0], g[1], 5, 2.6, 'rgba(10,6,4,.3)', null);
    const s = P(pos[0], pos[1], pos[2]);
    ell(c, s[0], s[1], 3.8, 3.8, '#3a3630', INK, 1.6);
    ell(c, s[0] - 1.2, s[1] - 1.2, 1.2, 1.2, '#8a857a', null);
  } else if (p.kind === 'rocket') {
    const pos = flightPos(p);
    const before = flightPos({ ...p, age: Math.max(0, p.age - 0.04) });
    const a = P(pos[0], pos[1], pos[2]);
    const b = P(before[0], before[1], before[2]);
    const l = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
    const ux = (a[0] - b[0]) / l;
    const uy = (a[1] - b[1]) / l;
    const tail = [a[0] - ux * 10, a[1] - uy * 10];
    // Exhaust flame, then the body, then the warhead.
    ell(c, tail[0] - ux * 3, tail[1] - uy * 3, 4.5, 3, '#ffb02e', INK, 1.1);
    ell(c, tail[0] - ux * 1.5, tail[1] - uy * 1.5, 2.4, 1.8, '#fff3c4', null);
    c.lineCap = 'round';
    for (const [w, col] of [[6.4, INK], [3.6, '#a6adb8']]) {
      c.strokeStyle = col;
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(tail[0], tail[1]);
      c.lineTo(a[0] - ux * 2, a[1] - uy * 2);
      c.stroke();
    }
    ell(c, a[0], a[1], 2.8, 2.8, DOCTRINE_COLORS.mortar, INK, 1.3);
  } else if (p.kind === 'boom') {
    const R = p.radius * (0.35 + 0.65 * Math.min(1, u * 3));
    const g = P(p.x, p.y, 0);
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
    c.lineWidth = 2.2;
    c.strokeStyle = '#ffd23f';
    c.stroke();
    c.globalAlpha = 1;
    // The fireball: four blobs that rise and cool.
    const rise = Math.min(1, u * 2);
    const cols = ['#fff3c4', '#ffd23f', '#ff8a2a', '#b8431a'];
    for (let i = 3; i >= 0; i--) {
      const r = (10 + i * 6) * (0.5 + 0.9 * Math.min(1, u * 2.6)) * (p.radius / SPLASH) * (1 - u * 0.5);
      const s = P(p.x, p.y, 6 + i * 3 + rise * 20);
      c.globalAlpha = Math.max(0, 1 - u * 1.25);
      ell(c, s[0] + (i - 1.5) * 3, s[1], r, r * 0.85, cols[i], INK, 1.5);
    }
    c.globalAlpha = 1;
    void g;
  }
}

function drawLabel(c, tw) {
  const [x, y] = iso(tw.x, tw.y);
  c.font = '700 17px "Barlow Condensed", "Arial Narrow", sans-serif';
  c.textAlign = 'center';
  c.lineJoin = 'round';
  c.lineWidth = 4;
  c.strokeStyle = INK;
  c.strokeText(LABELS[tw.kind], x, y + 31);
  c.fillStyle = '#eadfc4';
  c.fillText(LABELS[tw.kind], x, y + 31);
}

function objects(dt, t) {
  const items = [];
  for (const tw of towers) {
    items.push({
      key: tw.x + tw.y,
      draw: () => {
        if (state.view === 'heute') {
          drawTowerSprite(
            ctx,
            cache,
            { x: tw.cx, y: tw.cy, doctrine: tw.doctrine, rank: state.rank, aim: { x: target.x, y: target.y }, firing: tw.firing, cooldown: tw.cooldown, flash: 0 },
            camera.zoom,
            view.dpr,
            t,
            dt,
            reduceMotion,
          );
        } else {
          const s = bunkerSprite(state.rank, DOCTRINE_COLORS[tw.doctrine], stepOf(camera.zoom), view.dpr);
          const [ox, oy] = iso(tw.x, tw.y);
          ctx.drawImage(s.canvas, ox - s.ox, oy - s.oy, s.w, s.h);
          drawWeapon(ctx, tw);
        }
      },
    });
  }
  items.push({
    key: enemy.x + enemy.y,
    draw: () => drawEnemy(ctx, enemy, t, { zoom: camera.zoom, dpr: view.dpr, reducedMotion: reduceMotion, simTime: 0, dt }),
  });
  return items.sort((a, b) => a.key - b.key);
}

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
  perf.models = 0;
  render(now, dt);
  const cost = performance.now() - t0;
  perf.frames += 1;
  perf.sumDraw += cost;
  perf.sumModels += perf.models;
  if (perf.frames >= 30) {
    perf.draw = perf.sumDraw / perf.frames;
    perf.models = perf.sumModels / perf.frames;
    perf.frames = 0;
    perf.sumDraw = 0;
    perf.sumModels = 0;
    const el = document.getElementById('perf');
    if (el) el.textContent = `Zeichnen ${perf.draw.toFixed(2)} ms, davon Aufsätze ${perf.models.toFixed(2)} ms`;
  }
}

function render(now, dt) {
  const t = now / 1000;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = C.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ground.draw(ctx, camera, view, SIZE, BIOME_SEEDS[state.biome], now);
  applyCamera(ctx, camera, view);

  // Ground level: foundations, the aura of the psi, the shadows of the new light.
  for (const tw of towers) drawFoundation(ctx, tw);
  for (const tw of towers) {
    if (tw.kind === 'psi') drawAura(ctx, tw);
  }
  if (state.view === 'neu' && !state.silhouette) {
    for (const tw of towers) drawShadow(ctx, tw, weaponSamples(tw, tw.kind));
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
    if (state.layout === 'alle' || state.layout === 'drei') for (const tw of towers) drawLabel(ctx, tw);
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

/** The dashed violet aura of a psi emplacement, in the size of its range. */
function drawAura(c, tw) {
  const R = DOCTRINES.psi.range;
  c.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * TAU;
    const p = iso(tw.x + Math.cos(a) * R, tw.y + Math.sin(a) * R);
    if (i) c.lineTo(p[0], p[1]);
    else c.moveTo(p[0], p[1]);
  }
  c.fillStyle = 'rgba(183,132,255,.07)';
  c.fill();
  c.setLineDash([9, 7]);
  c.lineWidth = 2;
  c.strokeStyle = 'rgba(183,132,255,.55)';
  c.stroke();
  c.setLineDash([]);
}

// ---------- HUD ----------

const $ = (id) => document.getElementById(id);
const NOTES = {
  neu: 'Neu: Bunker als Sprite, Aufsatz als drehbares Modell. Das Ziel (Ring) lässt sich ziehen.',
  heute: 'Heute: die Spielfunktion drawTowerSprite, Aufsätze gespiegelt statt gedreht, ohne die Schüsse dieser Studie.',
};

function refresh() {
  for (const v of ['neu', 'heute']) $(`v-${v}`).classList.toggle('on', state.view === v);
  for (const l of ['eine', 'drei', 'alle', 'viele']) $(`l-${l}`).classList.toggle('on', state.layout === l);
  for (const id of DOCTRINE_IDS) {
    const b = $(`d-${id}`);
    b.classList.toggle('on', state.doctrine === id && state.layout !== 'alle' && state.layout !== 'viele');
    b.disabled = state.layout === 'alle' || state.layout === 'viele';
  }
  for (let r = 1; r <= 5; r++) $(`r-${r}`).classList.toggle('on', state.rank === r);
  $('m-mortar').classList.toggle('on', !state.rocket);
  $('m-rocket').classList.toggle('on', state.rocket);
  $('fire').classList.toggle('on', state.fire);
  $('orbit').classList.toggle('on', state.orbit);
  for (const m of ['live', 'hybrid', 'stages']) $(`mode-${m}`).classList.toggle('on', state.mode === m);
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
for (const l of ['eine', 'drei', 'alle', 'viele']) {
  $(`l-${l}`).addEventListener('click', () => {
    state.layout = l;
    rebuild();
    fitAll();
  });
}
for (const id of DOCTRINE_IDS) {
  const b = document.createElement('button');
  b.id = `d-${id}`;
  b.type = 'button';
  b.className = 'dot';
  b.style.setProperty('--dot', DOCTRINE_COLORS[id]);
  b.textContent = { autocannon: 'Autokanone', flame: 'Flamme', mortar: 'Mörser', psi: 'Psi', tesla: 'Tesla', laser: 'Laser' }[id];
  b.addEventListener('click', () => {
    state.doctrine = id;
    if (state.layout === 'alle' || state.layout === 'viele') state.layout = 'drei';
    rebuild();
  });
  $('doctrines').append(b);
}
for (let r = 1; r <= 5; r++) {
  $(`r-${r}`).addEventListener('click', () => {
    state.rank = r;
    refresh();
  });
}
for (const [id, rocket] of [['m-mortar', false], ['m-rocket', true]]) {
  $(id).addEventListener('click', () => {
    state.rocket = rocket;
    rebuild();
  });
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
for (const m of ['live', 'hybrid', 'stages']) {
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
  camera.y = wy - 30 / zoom;
  clampCamera(camera, bounds, limits);
}
function fitAll() {
  const R = target.R + 1.6;
  const halfW = R * 45 + 40;
  const halfH = R * 23 + 90;
  fitCameraTo(Math.max(0.5, Math.min(2.5, Math.min(view.width / (2 * halfW), (view.height - 170) / (2 * halfH)))));
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

/** Hooks for the screenshot script. */
window.__rework = {
  set(opts = {}) {
    const layoutChanged = 'layout' in opts || 'doctrine' in opts || 'rocket' in opts;
    Object.assign(state, opts);
    if (layoutChanged) rebuild();
    if ('orbit' in opts && opts.orbit === false) {
      target.vx = 0;
      target.vy = 0;
    }
    refresh();
  },
  /** Puts the target at a cell position and stops its lap. */
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
    for (const tw of towers) tw.theta = Math.atan2((tw.lead ?? [target.x, target.y])[1] - tw.y, (tw.lead ?? [target.x, target.y])[0] - tw.x);
  },
  zoom: fitCameraTo,
  fit: fitAll,
  /** Sets the reload counter per kind (seconds), so a still can have every weapon fire at one moment. */
  cds(map) {
    for (const tw of towers) {
      tw.cd = map[tw.kind] ?? 0;
      tw.pulseCd = map[tw.kind] ?? 0;
    }
  },
  /** Centres the camera on a point in cells, at a zoom. */
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
  stats: () => ({ ...stats, stages: stageCache.size, live: towers.filter((t) => !useStage(t)).length, bunkers: bunkerCache.size, perf: { draw: perf.draw, models: perf.models } }),
  /** Muzzle of each tower on screen and in the model, to check it sits at the end of the barrel. */
  muzzles: () => towers.map((tw) => ({ kind: tw.kind, theta: tw.theta, ...muzzleWorld(tw) })),
};
requestAnimationFrame(frame);
