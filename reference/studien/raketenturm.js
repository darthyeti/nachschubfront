// Study issue 96: the siege mortar as a rocket tower (Raketenturm), three drafts of the model.
//
// Four emplacements side by side on the ground: on the left today's siege mortar, drawn by the game itself
// (drawTowerSprite and src/render/towerFx.js: model, scope line, flash, back blast), next to it the drafts
// A, B and C from raketenturm-modell.js on the same special base. All four aim and fire on the rule of the
// game (aim 0.8 s, reload 3.2 s, flight 1.2 s, one shell, lead), and all four use the real effect of issue 90
// from src/render: the heavy rocket on its arc with its smoke (drawBigRocket, bigRocketTrail), the impact
// (drawBigImpact, drawPressureRing, drawCrater, groundLight with the lights of FX_LIGHT) and the particles
// of the world (stepWorldParticle, drawWorldParticle). What the drafts need around their own model (the
// scope line from their lens, the muzzle flash, the back blast) follows the game's code in towerFx.js,
// which does not export it; it is copied here with the same numbers.
//
// Views: the scene; every model in eight directions; the reload in steps; silhouettes at zoom 0.5 next to
// the rocket launcher (standard emplacement, three rockets per hit); the parts with their anchor points.
// The numbers (size of a stage, faces, fills) are in the table "Zahlen". Stills and the concept SVGs come
// from tests/tools/raketenturm-stills.mjs over `window.__rt`. Nothing here touches src/.

import { iso } from '../../src/render/iso.js';
import { ell, cellPath } from '../../src/render/draw.js';
import { C as PAL } from '../../src/render/palette.js';
import { DOCTRINE_COLORS } from '../../src/data/doctrines.js';
import { SPECIALS } from '../../src/data/specials.js';
import { MAX_DPR } from '../../src/data/settings.js';
import {
  SPECIAL_TURN_SPEED,
  SPECIAL_RECOIL_DECAY,
  FX_FLASH_SECONDS,
  FX_SIGHT_SECONDS,
  FX_BIG_BLAST,
  FX_BIG_BOOM,
} from '../../src/data/art.js';
import { createSpriteCache, drawSprite, drawSpriteShadow } from '../../src/render/sprites/rasterizer.js';
import { allTowerDefs, drawTowerSprite, drawSpecialRing, towerSet } from '../../src/render/towerSprites.js';
import {
  noteTowerEvent,
  drainFxQueue,
  stepWorldParticle,
  drawWorldParticle,
  launchOf,
  bigRocketTrail,
  drawBigRocket,
  drawTowerReach,
} from '../../src/render/towerFx.js';
import {
  CELL_RX,
  glow,
  groundLight,
  lightSpec,
  lightAlpha,
  drawPressureRing,
  drawBigImpact,
  drawCrater,
} from '../../src/render/weaponFx.js';
import { weaponModel } from '../../src/render/weapons.js';
import { turnFrame, renderSolids, faceList, SOLID_K as K } from '../../src/render/model.js';
import { SPECIAL_MOUNT_Z, specialScale, buildSpecial, specialRestPose } from '../../src/render/specials.js';
import { DRAFTS, draftById, buildDraft, anchors, rtRestPose, loadAt, PARTS, PART_NAMES, LOAD } from './raketenturm-modell.js';

const INK = PAL.ink;
const TAU = Math.PI * 2;
const STEP = 1 / 60;
const LOOP = 8;
const HALF = 0.5;
const P = (x, y, z = 0) => iso(x, y, z);
const DEF = SPECIALS.siegeMortar;
const RELOAD = 1 / DEF.fire;
const ACC = DOCTRINE_COLORS.mortar;
const SCALE = specialScale('siegeMortar');

/** The four emplacements: today on the left, then the drafts, all on one screen row. */
const SIDES = ['heute', 'A', 'B', 'C'];
const SITES = { heute: [1, 13], A: [5, 9], B: [9, 5], C: [13, 1] };
const LABEL = { heute: 'HEUTE', A: 'A DOPPELROHR', B: 'B STARTSCHIENEN', C: 'C LADEARME' };
const R_TARGET = 3.4;

const ui = { view: 'szene', zoom: 1, paused: false, speed: 1, reduced: false, table: false };

// ======================================================================================
// The study's simulation: the rule of the game, nothing else
// ======================================================================================

let scene = null;
let clock = 0;
let acc = 0;
let nextShell = 1;

/** Optical randomness (dust, debris), reproducible so a still is the same every run. */
let seed = 1;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const rand = (a, b) => a + rnd() * (b - a);

function makeRec(side, id) {
  const [x, y] = SITES[side];
  return {
    side,
    tower: { id, x, y, doctrine: 'mortar', rank: 3, special: 'siegeMortar', aim: null, cooldown: 1.2, firing: false, flash: 0 },
    // Drawing state of a draft (unused on the today side).
    n: { theta: Math.PI / 4, kick: [0, 0], load: [1, 1], empty: -1, next: 0, flash: 0, flashTube: 0 },
  };
}

function newScene() {
  seed = 96;
  clock = 0;
  acc = 0;
  return {
    recs: Object.fromEntries(SIDES.map((s, i) => [s, makeRec(s, i + 1)])),
    targets: Object.fromEntries(SIDES.map((s) => [s, []])),
    shells: [],
    flights: new Map(),
    particles: [],
    lights: [],
    impacts: [],
    rings: [],
    craters: [],
    brighten: { a: 0, life: 0, max: 1, last: -9 },
  };
}

/** The target group of one side at time t: a sweep over the quarter in front of the emplacement. */
function groupAt(side, t) {
  const [x, y] = SITES[side];
  const out = [];
  for (let i = 0; i < 4; i++) {
    const phi = Math.PI / 4 + 0.5 * Math.sin((TAU * t) / LOOP) - i * 0.16;
    const r = R_TARGET + (i % 2 ? 0.25 : 0) - i * 0.05;
    out.push({ x: x + HALF + Math.cos(phi) * r, y: y + HALF + Math.sin(phi) * r });
  }
  return out;
}

const wrapPi = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

function simStep(dt) {
  clock += dt;
  for (const side of SIDES) {
    const rec = scene.recs[side];
    const tw = rec.tower;
    const centre = { x: tw.x + HALF, y: tw.y + HALF };
    scene.targets[side] = groupAt(side, clock);
    const lead = scene.targets[side].find((e) => {
      const d = Math.hypot(e.x - centre.x, e.y - centre.y);
      return d <= DEF.range && d >= DEF.minRange;
    });
    tw.aim = lead ? { x: lead.x, y: lead.y } : tw.aim;
    tw.cooldown = Math.max(0, tw.cooldown - dt);
    if (tw.cooldown <= 0 && lead) {
      tw.cooldown += RELOAD;
      // A shell with flight time, aimed where the target will be (lead), as the game does.
      const ahead = groupAt(side, clock + DEF.flightSeconds)[0];
      const shell = { id: nextShell++, owner: rec, t: 0, flight: DEF.flightSeconds, to: { x: ahead.x, y: ahead.y }, radius: DEF.splashRadius };
      scene.shells.push(shell);
      if (side === 'heute') noteTowerEvent(tw, { type: 'launch', tx: lead.x, ty: lead.y });
      else shootDraft(rec, shell);
    }
    if (side !== 'heute') stepDraft(rec, dt);
  }
  for (let i = scene.shells.length - 1; i >= 0; i--) {
    const s = scene.shells[i];
    s.t += dt;
    const fl = scene.flights.get(s) ?? (s.owner.side === 'heute' ? claimToday(s) : null);
    if (fl) for (const spec of bigRocketTrail(fl, s, dt)) addParticle(spec);
    if (s.t >= s.flight) {
      bigImpact(s.to.x, s.to.y, s.radius);
      scene.shells.splice(i, 1);
    }
  }
  stepEffects(dt);
}

/** The flight of today's shell: the launch the game's own drawing has noted for the tower. */
function claimToday(shell) {
  const fl = launchOf(shell, shell.owner.tower);
  if (fl) scene.flights.set(shell, fl);
  return fl;
}

/** Turning, recoil, flash and the reload of the drafts. */
function stepDraft(rec, dt) {
  const n = rec.n;
  const tw = rec.tower;
  if (tw.aim) {
    const want = Math.atan2(tw.aim.y - (tw.y + HALF), tw.aim.x - (tw.x + HALF));
    const d = wrapPi(want - n.theta);
    const s = SPECIAL_TURN_SPEED.siegeMortar * dt;
    n.theta = wrapPi(n.theta + Math.max(-s, Math.min(s, d)));
  }
  for (let k = 0; k < 2; k++) n.kick[k] = Math.max(0, n.kick[k] - dt * SPECIAL_RECOIL_DECAY);
  n.flash = Math.max(0, n.flash - dt);
  if (n.empty >= 0) {
    const u = loadAt(1 - tw.cooldown / RELOAD);
    n.load[n.empty] = u;
    if (u >= 1) n.empty = -1;
  }
}

/** How far the weapon has its target, 0 to 1, over the last FX_SIGHT_SECONDS of the reload (towerFx.js, chargeOf). */
function seekOf(tw) {
  if (!tw.aim || tw.cooldown <= 0 || tw.cooldown >= FX_SIGHT_SECONDS) return 0;
  return 1 - tw.cooldown / FX_SIGHT_SECONDS;
}

/** Model, frame and pose of a draft as it stands now. */
function draftPose(rec) {
  const n = rec.n;
  return { ...rtRestPose(ACC), load: n.load.slice(), kick: n.kick.slice(), seek: seekOf(rec.tower), tube: n.next };
}

/** A local point of a draft in the world: x, y in cells, z in px. */
function toWorld(rec, local, theta = rec.n.theta) {
  const F = turnFrame(theta, SPECIAL_MOUNT_Z, SCALE);
  const [px, py] = F.world(local[0], local[1]);
  return [rec.tower.x + HALF + px, rec.tower.y + HALF + py, SPECIAL_MOUNT_Z + local[2] * SCALE];
}

/** A shot of a draft: what towerFx.js does for the siege mortar, from the draft's own muzzle and nozzle. */
function shootDraft(rec, shell) {
  const n = rec.n;
  const d = draftById[rec.side];
  const k = n.next;
  const F = turnFrame(n.theta, SPECIAL_MOUNT_Z, SCALE);
  const m = d.muzzle(k);
  const [x, y, z] = toWorld(rec, m.at);
  const dir = F.wn(m.dir[0], m.dir[1], m.dir[2]);
  const launch = { x, y, z, dir, lift: 0 };
  scene.flights.set(shell, { launch, trail: 0 });
  n.kick[k] = 1;
  n.load[k] = 0;
  n.empty = k;
  n.next = 1 - k;
  n.flash = FX_FLASH_SECONDS.siegeMortar;
  n.flashTube = k;
  kickLight(x, y, lightSpec('siegeMortar'));
  // The back blast throws dust along the ground, mostly behind the weapon (towerFx.js, FX_BIG_BLAST).
  const B = FX_BIG_BLAST;
  const tw = rec.tower;
  const nd = ui.reduced ? B.reducedDust : B.dust;
  for (let i = 0; i < nd; i++) {
    const a = Math.atan2(-dir[1], -dir[0]) + rand(-1.5, 1.5);
    const sp = rand(B.dustSpeed[0], B.dustSpeed[1]);
    addParticle({
      kind: 'wsmoke', x: tw.x + HALF + Math.cos(a) * 0.15, y: tw.y + HALF + Math.sin(a) * 0.15, z: 3,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(4, 14), r0: B.dustSize[0], r1: rand(B.dustSize[1] * 0.7, B.dustSize[1]),
      tone: 0, life: B.dustLife * rand(0.8, 1.1), floor: 0,
    });
  }
  // A pillar of smoke along the rocket's way out, and a puff at its nozzle.
  const np = ui.reduced ? 3 : 8;
  for (let i = 0; i < np; i++) {
    addParticle({
      kind: 'wsmoke', x: x + dir[0] * i * 0.03, y: y + dir[1] * i * 0.03, z: z + i * 4,
      vx: dir[0] * 0.25 + rand(-0.12, 0.12), vy: dir[1] * 0.25 + rand(-0.12, 0.12), vz: 60 + i * 12, r0: 5, r1: 19, tone: 0, life: 1.3 + i * 0.1, floor: 0,
    });
  }
  const [bx, by, bz] = toWorld(rec, d.nozzle(k));
  for (let i = 0; i < (ui.reduced ? 2 : 4); i++) {
    addParticle({ kind: 'wsmoke', x: bx, y: by, z: bz, vx: -dir[0] * rand(0.4, 0.9), vy: -dir[1] * rand(0.4, 0.9), vz: rand(-10, 10), r0: 6, r1: 16, tone: 0, life: 0.9, floor: 0 });
  }
}

// ---------- effects of the impact, as effects.js keeps them ----------

function addParticle(spec) {
  if (scene.particles.length >= 400) return;
  scene.particles.push({ ...spec, age: 0, max: spec.life });
}

function kickLight(x, y, spec) {
  if (!spec) return;
  scene.lights.push({ x, y, r: spec.r, colour: spec.colour, a: spec.a, fade: spec.fade, level: 1 });
  if (scene.lights.length > 24) scene.lights.shift();
}

/** The big impact of a siege mortar, as effects.js makes it (bigImpact): fireball, ring, crater, dust, smoke, debris, light. */
function bigImpact(x, y, radius) {
  const B = FX_BIG_BOOM;
  scene.impacts.push({ x, y, r: radius, age: 0, max: B.life, seed: Math.floor(x * 31 + y * 17) });
  scene.rings.push({ x, y, r: radius, age: 0, max: B.ring });
  scene.craters.push({ x, y, r: radius, age: 0, max: B.crater });
  const dust = ui.reduced ? B.dust >> 1 : B.dust;
  for (let i = 0; i < dust; i++) {
    const a = (i / dust) * TAU + rnd() * 0.4;
    const v = rand(B.dustSpeed[0], B.dustSpeed[1]);
    addParticle({ kind: 'wsmoke', x, y, z: 3, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 10, r0: 6, r1: 16, tone: 0, life: B.dustLife, floor: 0 });
  }
  for (let i = 0; i < B.columns; i++) {
    const a = (i / B.columns) * TAU + 0.7;
    addParticle({ kind: 'wsmoke', x: x + Math.cos(a) * radius * 0.25, y: y + Math.sin(a) * radius * 0.25, z: 4, vx: 0, vy: 0, vz: rand(50, 90), r0: 6, r1: 22, tone: 1.6, life: B.columnLife, floor: 0 });
  }
  if (!ui.reduced) {
    for (let i = 0; i < B.debris; i++) {
      const a = rnd() * TAU;
      const v = rand(B.dustSpeed[0], B.dustSpeed[1]);
      addParticle({ kind: 'wdebris', x, y, z: 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(140, 260), size: rand(1.8, 3.2), rot: rnd() * 6, vrot: rand(-9, 9), life: B.debrisLife, floor: 0 });
    }
  }
  kickLight(x, y, lightSpec('siegeMortar', 'hit'));
  // The picture brightens at most once a second (effects.js, tryBrighten).
  const br = scene.brighten;
  if (clock - br.last >= 1) {
    br.last = clock;
    Object.assign(br, { a: ui.reduced ? Math.min(B.brighten.alpha, B.brighten.reduced) : B.brighten.alpha, life: B.brighten.seconds, max: B.brighten.seconds });
  }
}

function stepEffects(dt) {
  for (const list of [scene.impacts, scene.rings, scene.craters]) {
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].age += dt;
      if (list[i].age >= list[i].max) list.splice(i, 1);
    }
  }
  for (let i = scene.lights.length - 1; i >= 0; i--) {
    scene.lights[i].level -= dt / scene.lights[i].fade;
    if (scene.lights[i].level <= 0) scene.lights.splice(i, 1);
  }
  for (let i = scene.particles.length - 1; i >= 0; i--) {
    const p = scene.particles[i];
    p.age += dt;
    if (p.age >= p.max) scene.particles.splice(i, 1);
    else stepWorldParticle(p, dt);
  }
  scene.brighten.life = Math.max(0, scene.brighten.life - dt);
}

// ======================================================================================
// Drawing
// ======================================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
/** Cost of a picture: fill and stroke calls and gradients on this page's context. */
const cost = { fills: 0, gradients: 0, last: { fills: 0, gradients: 0 } };
for (const name of ['fill', 'stroke', 'fillRect', 'fillText', 'strokeText']) {
  const f = ctx[name].bind(ctx);
  ctx[name] = (...a) => {
    cost.fills++;
    return f(...a);
  };
}
for (const name of ['createRadialGradient', 'createLinearGradient']) {
  const f = ctx[name].bind(ctx);
  ctx[name] = (...a) => {
    cost.gradients++;
    return f(...a);
  };
}

const cache = createSpriteCache();
const view = { w: 1, h: 1, dpr: 1 };

function resize() {
  view.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  view.w = canvas.clientWidth;
  view.h = canvas.clientHeight;
  canvas.width = Math.round(view.w * view.dpr);
  canvas.height = Math.round(view.h * view.dpr);
}
window.addEventListener('resize', () => {
  resize();
  if (ui.paused || ui.view !== 'szene') render(0);
});
resize();

function drawGround() {
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      cellPath(ctx, x, y);
      ctx.fillStyle = (x + y) % 2 ? '#3a322a' : '#342c25';
      ctx.fill();
    }
  }
}

/** A dummy target: a beetle shape on the ground. */
function drawTarget(e) {
  const [x, y] = P(e.x, e.y);
  ell(ctx, x, y + 1, 10, 4.5, 'rgba(10,6,4,.35)', null);
  ell(ctx, x, y - 7, 9, 6.5, '#5a4652', INK, 1.6);
  ell(ctx, x - 2, y - 9.5, 4, 2.2, '#7a6472', null);
  ell(ctx, x - 9, y - 8, 4, 3.6, '#3a2d36', INK, 1.4);
}

function drawLabel(side) {
  const [x, y] = SITES[side];
  const [sx, sy] = P(x + 1.05, y + 1.05);
  ctx.font = '17px Bangers, Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.fillStyle = side === 'heute' ? '#eadfc4' : '#e8c872';
  ctx.strokeText(LABEL[side], sx, sy + 16);
  ctx.fillText(LABEL[side], sx, sy + 16);
}

/** The special base, the same sprite the game draws. */
function drawBase(tw, zoom = ui.zoom) {
  const set = towerSet(tw);
  const back = cache.get(set.back, zoom, view.dpr);
  if (!back) return;
  const [sx, sy] = P(tw.x + HALF, tw.y + HALF);
  drawSpriteShadow(ctx, set.back, back, sx, sy);
  drawSprite(ctx, set.back, back, sx, sy);
}

/** Today's emplacement, all by the game's own functions; what it queues for the world goes to our particles. */
function drawToday(rec, dt) {
  const tw = rec.tower;
  drawSpecialRing(ctx, tw);
  drawTowerSprite(ctx, cache, tw, ui.zoom, view.dpr, clock, dt, ui.reduced);
  const queued = drainFxQueue(tw);
  if (queued) for (const spec of queued) addParticle(spec);
}

/** A kite of flame from m (screen) along the screen direction (ux, uy): the muzzle flash of the drafts. */
function kite(m, ux, uy, len, wid, colour) {
  const nx = -uy;
  const ny = ux;
  ctx.beginPath();
  ctx.moveTo(m[0] + nx * wid, m[1] + ny * wid);
  ctx.quadraticCurveTo(m[0] + ux * len * 0.5 + nx * wid, m[1] + uy * len * 0.5 + ny * wid, m[0] + ux * len, m[1] + uy * len);
  ctx.quadraticCurveTo(m[0] + ux * len * 0.5 - nx * wid, m[1] + uy * len * 0.5 - ny * wid, m[0] - nx * wid, m[1] - ny * wid);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

/** Screen point and screen direction of a local point and direction of a draft. */
function screenOf(rec, local, dirLocal = null) {
  const w = toWorld(rec, local);
  const s = P(w[0], w[1], w[2]);
  if (!dirLocal) return { s };
  const F = turnFrame(rec.n.theta, SPECIAL_MOUNT_Z, SCALE);
  const d = F.wn(dirLocal[0], dirLocal[1], dirLocal[2]);
  const e = P(w[0] + d[0] * 0.3, w[1] + d[1] * 0.3, w[2] + d[2] * 0.3 * K);
  const l = Math.hypot(e[0] - s[0], e[1] - s[1]) || 1;
  return { s, u: [(e[0] - s[0]) / l, (e[1] - s[1]) / l] };
}

/** A draft on the special base: the model, the flash at the muzzle that fired, the back blast, the lens. */
function drawDraft(rec) {
  const tw = rec.tower;
  const d = draftById[rec.side];
  const n = rec.n;
  drawSpecialRing(ctx, tw);
  drawBase(tw);
  const pose = draftPose(rec);
  const F = turnFrame(n.theta, SPECIAL_MOUNT_Z, SCALE);
  const [sx, sy] = P(tw.x + HALF, tw.y + HALF);
  ctx.save();
  ctx.translate(sx, sy);
  renderSolids(ctx, buildDraft(rec.side, F, pose).parts);
  ctx.restore();
  const damp = ui.reduced ? 0.5 : 1;
  const shrink = ui.reduced ? 0.7 : 1;
  if (n.flash > 0) {
    const u = n.flash / FX_FLASH_SECONDS.siegeMortar;
    const m = d.muzzle(n.flashTube);
    const a = screenOf(rec, m.at, m.dir);
    glow(ctx, a.s[0], a.s[1], 28, '#ffd23f', 0.6 * u * damp);
    kite(a.s, a.u[0], a.u[1], 26 * (0.6 + 0.4 * u) * shrink, 6, '#ff8a2a');
    kite(a.s, a.u[0], a.u[1], 16 * (0.6 + 0.4 * u) * shrink, 3.3, '#ffe38a');
    // The back blast out of the nozzle: the rocket leaves, its exhaust hits the deflector or the crate.
    const b = screenOf(rec, d.nozzle(n.flashTube), m.dir);
    glow(ctx, b.s[0], b.s[1], 22, '#ffb02e', 0.5 * u * damp);
    kite(b.s, -b.u[0], -b.u[1], 22 * u * shrink, 6, '#d89a56');
    kite(b.s, -b.u[0], -b.u[1], 13 * u * shrink, 3.3, '#fff0c0');
  }
  if (pose.seek > 0) {
    const lens = screenOf(rec, d.sight(pose)).s;
    glow(ctx, lens[0], lens[1], 7, '#ff4a4a', 0.7);
  }
}

/**
 * The scope of a draft: a red line from its lens to where it aims, over the last 0.8 s of the reload, with a
 * mark on the ground that tightens (towerFx.js, drawScope; same look, from the draft's lens).
 */
function drawScopeLine(rec) {
  const tw = rec.tower;
  const q = seekOf(tw);
  if (q <= 0) return;
  const d = draftById[rec.side];
  const a = screenOf(rec, d.sight(draftPose(rec))).s;
  const b = P(tw.aim.x, tw.aim.y);
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.55 + 0.45 * (ui.reduced ? 1 : Math.abs(Math.sin(clock * 22)));
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

function cameraCentre() {
  return P(8.6, 8.6, 30);
}

function renderScene(dt) {
  const [cx, cy] = cameraCentre();
  const s = ui.zoom * view.dpr;
  ctx.setTransform(s, 0, 0, s, canvas.width / 2 - cx * s, canvas.height / 2 - cy * s);
  drawGround();
  // The ground layer: craters, pressure rings, lights (under the figures).
  for (const c of scene.craters) {
    const [x, y] = P(c.x, c.y);
    drawCrater(ctx, x, y, c.r, c.age / c.max);
  }
  for (const r of scene.rings) {
    const [x, y] = P(r.x, r.y);
    drawPressureRing(ctx, x, y, r.r, r.age / r.max, '#ffb13b', 3.2, ui.reduced);
  }
  for (const l of scene.lights) {
    const [x, y] = P(l.x, l.y);
    groundLight(ctx, x, y, l.r, l.colour, lightAlpha(l));
  }
  const items = [];
  for (const side of SIDES) {
    const rec = scene.recs[side];
    items.push({ key: rec.tower.x + rec.tower.y + 1, draw: () => (side === 'heute' ? drawToday(rec, dt) : drawDraft(rec)) });
    for (const e of scene.targets[side]) items.push({ key: e.x + e.y, draw: () => drawTarget(e) });
  }
  items.sort((a, b) => a.key - b.key);
  for (const it of items) it.draw();
  // Above: the scope lines, the rockets, particles, the fire of the impacts, the light over the figures.
  drawTowerReach(ctx, scene.recs.heute.tower, clock);
  for (const side of SIDES) if (side !== 'heute') drawScopeLine(scene.recs[side]);
  for (const s2 of scene.shells) {
    const fl = scene.flights.get(s2);
    if (fl) drawBigRocket(ctx, fl, s2, ACC, clock);
  }
  for (const p of scene.particles) drawWorldParticle(ctx, p, p.age / p.max);
  for (const im of scene.impacts) {
    const [x, y] = P(im.x, im.y);
    drawBigImpact(ctx, x, y, im.r, im.age, im.seed, ui.reduced);
  }
  for (const l of scene.lights) {
    const [x, y] = P(l.x, l.y);
    groundLight(ctx, x, y - 10, l.r * 0.8, l.colour, lightAlpha(l) * 0.35);
  }
  for (const side of SIDES) drawLabel(side);
  const br = scene.brighten;
  if (br.life > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(${FX_BIG_BOOM.brighten.colour},${(br.a * (br.life / br.max)).toFixed(3)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// ---------- the sheets: directions, reload, silhouettes, parts ----------

/** Today's weapon or a draft at the origin in direction theta: the bodies (the base is drawn by the caller). */
function weaponParts(kind, theta, pose = {}, part = 'all') {
  const F = turnFrame(theta, SPECIAL_MOUNT_Z, SCALE);
  if (kind === 'heute') return buildSpecial('siegeMortar', F, { ...specialRestPose(ACC), ...pose }, 'all').parts;
  return buildDraft(kind, F, { ...rtRestPose(ACC), ...pose }, part).parts;
}

/** The rocket launcher (standard emplacement, rank 3) at the origin in direction theta. */
function launcherParts(theta) {
  const m = weaponModel('mortar');
  const F = turnFrame(theta, m.mount, m.scale);
  return m.build(F, { ...m.restPose(m.accent, 3) }, 'all').parts;
}

function drawBaseAt(tw, x, y, zoom) {
  const set = towerSet(tw);
  const back = cache.get(set.back, zoom, view.dpr);
  if (!back) return;
  drawSprite(ctx, set.back, back, x, y);
}

function sheetText(text, x, y, size = 20, colour = '#e8c872', align = 'left') {
  ctx.font = `${size}px Bangers, Impact, sans-serif`;
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

const ROW_KINDS = ['heute', 'A', 'B', 'C'];
const ROW_NAMES = { heute: 'Heute', A: 'A Doppelrohr', B: 'B Startschienen', C: 'C Ladearme' };
const SPECIAL_TW = { x: 0, y: 0, doctrine: 'mortar', rank: 3, special: 'siegeMortar' };
const LAUNCHER_TW = { x: 0, y: 0, doctrine: 'mortar', rank: 3 };

/** Every model in eight directions; drafts every other direction with the left rocket half loaded. */
function renderDirections() {
  const zoom = ui.zoom;
  const s = zoom * view.dpr;
  const colW = (view.w - 40) / 8;
  const rowH = (view.h - 110) / 4;
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 8; i++) {
      const theta = (i * Math.PI) / 4;
      const gx = 40 + colW * (i + 0.5);
      const gy = 90 + rowH * (r + 0.82);
      ctx.setTransform(s, 0, 0, s, gx * view.dpr, gy * view.dpr);
      ell(ctx, 0, 0, 34, 17, 'rgba(232,200,114,.08)', null);
      drawBaseAt(SPECIAL_TW, 0, 0, zoom);
      const kind = ROW_KINDS[r];
      const pose = kind === 'heute' ? {} : { load: [i % 2 ? 0.55 : 1, 1], seek: i % 2 ? 0 : 1 };
      renderSolids(ctx, weaponParts(kind, theta, pose));
    }
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    sheetText(ROW_NAMES[ROW_KINDS[r]], 14, 90 + rowH * r + 22);
  }
}

/** The reload in steps: just after the shot, four steps of the load, ready, aiming. */
const RELOAD_STEPS = [
  ['Schuss', { load: [0, 1], kick: [1, 0] }],
  ['25 %', { load: [loadAt(0.25), 1] }],
  ['35 %', { load: [loadAt(0.35), 1] }],
  ['45 %', { load: [loadAt(0.45), 1] }],
  ['55 %', { load: [loadAt(0.55), 1] }],
  ['70 %: bereit', { load: [1, 1] }],
  ['Zielen 0,8 s', { load: [1, 1], seek: 1 }],
];

function renderReload() {
  const zoom = ui.zoom;
  const s = zoom * view.dpr;
  const colW = (view.w - 20) / RELOAD_STEPS.length;
  const rowH = (view.h - 120) / 3;
  const theta = (3 * Math.PI) / 4 - 0.35;
  for (let r = 0; r < 3; r++) {
    const kind = DRAFTS[r].id;
    for (let i = 0; i < RELOAD_STEPS.length; i++) {
      const gx = 20 + colW * (i + 0.5);
      const gy = 110 + rowH * (r + 0.85);
      ctx.setTransform(s, 0, 0, s, gx * view.dpr, gy * view.dpr);
      ell(ctx, 0, 0, 34, 17, 'rgba(232,200,114,.08)', null);
      drawBaseAt(SPECIAL_TW, 0, 0, zoom);
      renderSolids(ctx, weaponParts(kind, theta, RELOAD_STEPS[i][1]));
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      if (r === 0) sheetText(RELOAD_STEPS[i][0], gx, 100, 16, '#eadfc4', 'center');
    }
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    sheetText(ROW_NAMES[kind], 14, 110 + rowH * r + 24);
  }
}

/** A figure drawn into a scratch canvas, then filled black: its silhouette, at the zoom of the sheet. */
const scratch = document.createElement('canvas');
const sctx = scratch.getContext('2d');
function silhouette(draw, x, y, zoom) {
  const W = 200;
  const H = 220;
  const d = view.dpr * zoom;
  scratch.width = Math.ceil(W * d);
  scratch.height = Math.ceil(H * d);
  sctx.setTransform(d, 0, 0, d, (W / 2) * d, (H - 40) * d);
  draw(sctx);
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = '#000';
  sctx.fillRect(0, 0, scratch.width, scratch.height);
  sctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(scratch, Math.round((x - (W / 2) * zoom) * view.dpr), Math.round((y - (H - 40) * zoom) * view.dpr));
}

const SIL_DIRS = [
  ['zur Kamera', Math.PI / 4],
  ['von der Kamera weg', (5 * Math.PI) / 4],
  ['nach links', (3 * Math.PI) / 4],
  ['nach rechts', -Math.PI / 4],
];

function renderSilhouettes() {
  const zoom = 0.5;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#9a9283';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const x0 = 210;
  const colW = Math.min(150, (view.w - x0 - 20) / 5);
  const rowH = Math.min(120, (view.h - 210) / 4);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.font = '700 17px "Barlow Condensed", Arial, sans-serif';
  ctx.fillStyle = '#1a1410';
  ctx.textAlign = 'center';
  for (let i = 0; i < SIL_DIRS.length; i++) ctx.fillText(SIL_DIRS[i][0], x0 + colW * (i + 0.5), 110);
  ctx.fillText('Raketenwerfer Rang 3', x0 + colW * 4.5, 110);
  for (let r = 0; r < 4; r++) {
    const kind = ROW_KINDS[r];
    const y = 120 + rowH * (r + 0.85);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.font = '18px "Barlow Condensed", Arial, sans-serif';
    ctx.fillStyle = '#1a1410';
    ctx.textAlign = 'left';
    ctx.fillText(ROW_NAMES[kind], 20, y - 20);
    for (let i = 0; i < SIL_DIRS.length; i++) {
      const theta = SIL_DIRS[i][1];
      silhouette((c) => {
        const set = towerSet(SPECIAL_TW);
        const back = cache.get(set.back, zoom, view.dpr);
        if (back) drawSprite(c, set.back, back, 0, 0);
        renderSolids(c, weaponParts(kind, theta));
      }, x0 + colW * (i + 0.5), y, zoom);
    }
    // The rocket launcher, the weapon the rocket tower must not be mistaken for, on its standard bunker.
    silhouette((c) => {
      const set = towerSet(LAUNCHER_TW);
      const back = cache.get(set.back, zoom, view.dpr);
      if (back) drawSprite(c, set.back, back, 0, 0);
      renderSolids(c, launcherParts([Math.PI / 4, (5 * Math.PI) / 4, (3 * Math.PI) / 4, -Math.PI / 4][r]));
    }, x0 + colW * 4.5, y, zoom);
  }
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.font = '15px "Barlow Condensed", Arial, sans-serif';
  ctx.fillStyle = '#1a1410';
  ctx.textAlign = 'left';
  ctx.fillText('Zoom 0,5 (kleinste Stufe), Spezialbasis wie im Spiel. Rechts der Raketenwerfer in je einer der vier Richtungen.', 20, 120 + rowH * 4.5);
}

/** The parts of each draft apart, with the anchor points of the model. */
const ANCHOR_COLOURS = { drehpunkt: '#ffffff', kipppunkt: '#5fd4ff', muendung0: '#ff8a2a', muendung1: '#ff8a2a', duese0: '#b784ff', duese1: '#b784ff', visier: '#ff4a4a', lader0: '#9ccf4a', lader1: '#9ccf4a' };
const ANCHOR_NAMES = { drehpunkt: 'Drehpunkt', kipppunkt: 'Kipppunkt', muendung0: 'Mündung', duese0: 'Düse', visier: 'Visier', lader0: 'Lader' };

function renderParts() {
  const zoom = ui.zoom;
  const s = zoom * view.dpr;
  const cols = PARTS.length + 1;
  const colW = (view.w - 20) / cols;
  const rowH = (view.h - 150) / 3;
  const theta = Math.PI / 2 + 0.25;
  for (let r = 0; r < 3; r++) {
    const kind = DRAFTS[r].id;
    const gy = 110 + rowH * (r + 0.85);
    // The whole model with its anchors, then each part on its own.
    for (let i = 0; i < cols; i++) {
      const gx = 20 + colW * (i + 0.5);
      ctx.setTransform(s, 0, 0, s, gx * view.dpr, gy * view.dpr);
      ell(ctx, 0, 0, 30, 15, 'rgba(232,200,114,.08)', null);
      if (i === 0) {
        drawBaseAt(SPECIAL_TW, 0, 0, zoom);
        renderSolids(ctx, weaponParts(kind, theta));
        const pose = { ...rtRestPose(ACC), seek: 1 };
        const F = turnFrame(theta, SPECIAL_MOUNT_Z, SCALE);
        for (const [name, at] of Object.entries(anchors(kind, pose))) {
          const [x, y] = F.W(at[0], at[1], at[2]);
          ell(ctx, x, y, 2.6, 2.6, ANCHOR_COLOURS[name], INK, 1.1);
        }
      } else {
        renderSolids(ctx, weaponParts(kind, theta, {}, PARTS[i - 1]));
      }
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      if (r === 0) sheetText(i === 0 ? 'Ganz, mit Ankern' : PART_NAMES[PARTS[i - 1]], gx, 100, 15, '#eadfc4', 'center');
    }
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    sheetText(ROW_NAMES[kind], 14, 110 + rowH * r + 24);
  }
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  let x = 14;
  const y = view.h - 24;
  ctx.font = '15px "Barlow Condensed", Arial, sans-serif';
  for (const [key, name] of Object.entries(ANCHOR_NAMES)) {
    ell(ctx, x + 6, y - 5, 5, 5, ANCHOR_COLOURS[key], INK, 1.2);
    ctx.fillStyle = '#eadfc4';
    ctx.textAlign = 'left';
    ctx.fillText(name, x + 16, y);
    x += ctx.measureText(name).width + 36;
  }
}

/** The four models large, two directions each: for looking closely. */
function renderBig() {
  const zoom = ui.zoom * 2;
  const s = zoom * view.dpr;
  const colW = (view.w - 20) / 4;
  const rowH = (view.h - 120) / 2;
  const dirs = [Math.PI / 2 + 0.35, -0.3];
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 4; i++) {
      const kind = ROW_KINDS[i];
      const gx = 20 + colW * (i + 0.5);
      const gy = 110 + rowH * (r + 0.95);
      ctx.setTransform(s, 0, 0, s, gx * view.dpr, gy * view.dpr);
      const pose = kind === 'heute' ? {} : { seek: r === 0 ? 1 : 0, load: [1, r === 1 ? 0.5 : 1] };
      ctx.translate(0, SPECIAL_MOUNT_Z - 6);
      renderSolids(ctx, weaponParts(kind, dirs[r], pose));
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      if (r === 0) sheetText(ROW_NAMES[kind], gx, 100, 18, '#eadfc4', 'center');
    }
  }
}

function render(dt) {
  cost.last = { fills: cost.fills, gradients: cost.gradients };
  cost.fills = 0;
  cost.gradients = 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1c1410';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (ui.view === 'szene') renderScene(dt);
  else if (ui.view === 'richtungen') renderDirections();
  else if (ui.view === 'nachladen') renderReload();
  else if (ui.view === 'silhouette') renderSilhouettes();
  else if (ui.view === 'teile') renderParts();
  else if (ui.view === 'gross') renderBig();
}

// ======================================================================================
// Numbers
// ======================================================================================

/**
 * Size and cost of each model, over 16 directions: the box the weapon covers on screen at zoom 1 (world px;
 * a stage at devicePixelRatio 2 is twice as wide and high), its top above the ground, the faces drawn and the
 * fill and stroke calls of one live drawing. Today's model is measured the same way.
 */
function measureModels() {
  const rows = [];
  const probe = document.createElement('canvas').getContext('2d');
  let calls = 0;
  for (const name of ['fill', 'stroke']) {
    const f = probe[name].bind(probe);
    probe[name] = (...a) => {
      calls++;
      return f(...a);
    };
  }
  for (const kind of ['heute', ...DRAFTS.map((d) => d.id)]) {
    let w = 0;
    let h = 0;
    let top = 0;
    let faces = 0;
    let fills = 0;
    for (let i = 0; i < 16; i++) {
      const theta = (i * TAU) / 16;
      const F = turnFrame(theta, SPECIAL_MOUNT_Z, SCALE);
      const built = kind === 'heute' ? buildSpecial('siegeMortar', F, specialRestPose(ACC), 'all') : buildDraft(kind, F, rtRestPose(ACC));
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const q of built.samples) {
        const [x, y] = F.W(q[0], q[1], q[2]);
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
        top = Math.max(top, SPECIAL_MOUNT_Z + q[2] * SCALE);
      }
      w = Math.max(w, x1 - x0);
      h = Math.max(h, y1 - y0);
      faces += faceList(built.parts).length;
      calls = 0;
      renderSolids(probe, built.parts);
      fills += calls;
    }
    const bodies = (kind === 'heute' ? buildSpecial('siegeMortar', turnFrame(0, SPECIAL_MOUNT_Z, SCALE), specialRestPose(ACC), 'all') : buildDraft(kind, turnFrame(0, SPECIAL_MOUNT_Z, SCALE), rtRestPose(ACC))).parts.length;
    const wPx = Math.ceil(w + 4);
    const hPx = Math.ceil(h + 4);
    rows.push({
      kind,
      bodies,
      w: wPx,
      h: hPx,
      top: Math.round(top * 10) / 10,
      faces: Math.round(faces / 16),
      fills: Math.round(fills / 16),
      // One stage at devicePixelRatio 2 and zoom 1, RGBA, plus its half-size shadow.
      kb: Math.round((wPx * 2 * hPx * 2 * 4 * 1.25) / 1024),
    });
  }
  return rows;
}

function buildTable() {
  const el = document.getElementById('table');
  const rows = measureModels();
  const today = rows[0];
  const pct = (v, b) => `${v >= b ? '+' : ''}${Math.round(((v - b) / b) * 100)} %`;
  const tr = (r) => `<tr><td>${r.kind === 'heute' ? 'Heute' : ROW_NAMES[r.kind]}</td><td>${r.bodies}</td><td>${r.faces}</td><td>${r.fills}</td><td>${r.w} x ${r.h}</td><td>${r.kb} KB</td><td>${r.top} px${r.kind === 'heute' ? '' : ` (${pct(r.top, today.top)})`}</td></tr>`;
  el.innerHTML = `<h2>Zahlen</h2>
<table><tr><th>Modell</th><th>Körper</th><th>Flächen je Bild</th><th>fill/stroke je Bild</th><th>Bildgröße bei Zoom 1 (Welt-px)</th><th>eine Stufe, dpr 2</th><th>Spitze über Boden</th></tr>
${rows.map(tr).join('')}</table>
<p>Mittel über 16 Richtungen, ruhend, beide Raketen geladen. Ruhend kommt die Waffe im Spiel aus dem Stufen-Cache (eine
<code>drawImage</code>), live gezeichnet wird sie nur zwischen zwei Stufen oder während sich etwas bewegt.
Regel der Studie: Nachladen ${Math.round(LOAD.from * 100)} bis ${Math.round(LOAD.to * 100)} % der ${RELOAD.toFixed(1)} s,
also fertig vor den letzten ${FX_SIGHT_SECONDS} s (Zielen).</p>`;
  return rows;
}

// ======================================================================================
// Loop and controls
// ======================================================================================

function frame(now) {
  const dt = Math.min(0.1, (now - (frame.last ?? now)) / 1000);
  frame.last = now;
  if (!ui.paused && ui.view === 'szene') {
    acc += dt * ui.speed;
    let n = 0;
    while (acc >= STEP && n++ < 8) {
      simStep(STEP);
      acc -= STEP;
    }
    render(dt * ui.speed);
  } else if (ui.view === 'szene') {
    render(0);
  }
  document.getElementById('clock').textContent = `${clock.toFixed(1)} s`;
  document.getElementById('cost').textContent = `${cost.last.fills} Striche, ${cost.last.gradients} Verläufe`;
  requestAnimationFrame(frame);
}

const NOTES = {
  szene: 'Links das heutige Modell aus dem Spiel, daneben die Entwürfe A, B und C. Alle zielen 0,8 s, feuern eine schwere Rakete (Effekt des Spiels aus #91) und laden 3,2 s nach.',
  richtungen: 'Acht Richtungen. Bei den Entwürfen jede zweite Richtung mit halb geladener linker Rakete, die anderen zielend (Linse rot).',
  nachladen: 'Eine Rakete ist abgefeuert und kommt zurück, die zweite wartet geladen. Prozent der Nachladezeit von 3,2 s.',
  silhouette: 'Schattenriss auf der kleinsten Zoomstufe 0,5 neben dem Raketenwerfer.',
  gross: 'Die vier Modelle groß, ohne Sockel der Basis: oben zielend, unten mit halb geladener rechter Rakete.',
  teile: 'Die Teile jedes Entwurfs einzeln, links das ganze Modell mit den Ankerpunkten.',
};

function refresh() {
  for (const v of ['szene', 'richtungen', 'nachladen', 'silhouette', 'teile', 'gross']) document.getElementById(`v-${v}`).classList.toggle('on', ui.view === v);
  for (const [id, z] of [['z-05', 0.5], ['z-1', 1], ['z-2', 2]]) document.getElementById(id).classList.toggle('on', ui.zoom === z);
  document.getElementById('pause').classList.toggle('on', ui.paused);
  document.getElementById('reduced').classList.toggle('on', ui.reduced);
  document.getElementById('zahlen').classList.toggle('on', ui.table);
  document.getElementById('table').hidden = !ui.table;
  document.getElementById('note').textContent = NOTES[ui.view];
  if (ui.view !== 'szene' || ui.paused) render(0);
}

async function setZoom(z) {
  ui.zoom = z;
  await cache.preload(allTowerDefs(), z, view.dpr);
  await cache.preload(allTowerDefs(), 0.5, view.dpr);
  refresh();
}

function buildUi() {
  for (const v of ['szene', 'richtungen', 'nachladen', 'silhouette', 'teile', 'gross']) {
    document.getElementById(`v-${v}`).addEventListener('click', () => {
      ui.view = v;
      refresh();
    });
  }
  document.getElementById('z-05').addEventListener('click', () => setZoom(0.5));
  document.getElementById('z-1').addEventListener('click', () => setZoom(1));
  document.getElementById('z-2').addEventListener('click', () => setZoom(2));
  document.getElementById('pause').addEventListener('click', () => {
    ui.paused = !ui.paused;
    refresh();
  });
  document.getElementById('step').addEventListener('click', () => {
    ui.paused = true;
    simStep(STEP);
    refresh();
  });
  document.getElementById('restart').addEventListener('click', () => {
    scene = newScene();
    refresh();
  });
  document.getElementById('reduced').addEventListener('click', () => {
    ui.reduced = !ui.reduced;
    refresh();
  });
  document.getElementById('zahlen').addEventListener('click', () => {
    ui.table = !ui.table;
    refresh();
  });
  const speed = document.getElementById('speed');
  speed.addEventListener('input', () => {
    ui.speed = Number(speed.value);
    document.getElementById('speed-out').textContent = `${Math.round(ui.speed * 100)} %`;
  });
}

// ======================================================================================
// Hooks for the stills tool
// ======================================================================================

window.__rt = {
  ready: false,
  /** Shows the scene at study time t, re-run from the start in fixed steps; then holds still. */
  seek(t, opts = {}) {
    Object.assign(ui, opts, { view: 'szene', paused: true });
    scene = newScene();
    refresh();
    const n = Math.round(t / STEP);
    for (let i = 0; i < n; i++) {
      simStep(STEP);
      render(STEP);
    }
    render(0);
    return clock;
  },
  /** Time of the first shot of the scene (all four fire together). */
  firstShot: () => 1.2,
  show(v, opts = {}) {
    Object.assign(ui, opts, { view: v, paused: true });
    refresh();
    render(0);
  },
  preload: (zoom) => Promise.all([cache.preload(allTowerDefs(), zoom, view.dpr), cache.preload(allTowerDefs(), 0.5, view.dpr)]),
  numbers: () => measureModels(),
  /** Recording hook for the concept SVGs: draws draft `id`, part `part` at the origin facing `theta` into `c`. */
  drawPart(c, id, part, theta, pose = {}) {
    const F = turnFrame(theta, SPECIAL_MOUNT_Z, SCALE);
    renderSolids(c, buildDraft(id, F, { ...rtRestPose(ACC), ...pose }, part).parts);
  },
  /** The anchor points of draft `id` on screen at the origin facing `theta` (world px), and local. */
  anchorPoints(id, theta, pose = {}) {
    const F = turnFrame(theta, SPECIAL_MOUNT_Z, SCALE);
    const p = { ...rtRestPose(ACC), ...pose };
    return Object.fromEntries(Object.entries(anchors(id, p)).map(([k, at]) => [k, { screen: F.W(at[0], at[1], at[2]).map((v) => Math.round(v * 100) / 100), local: at.map((v) => Math.round(v * 1000) / 1000) }]));
  },
  drafts: DRAFTS.map((d) => ({ id: d.id, name: d.name, note: d.note })),
};

buildUi();
scene = newScene();
buildTable();
refresh();
Promise.all([cache.preload(allTowerDefs(), ui.zoom, view.dpr), cache.preload(allTowerDefs(), 0.5, view.dpr)]).then(() => {
  window.__rt.ready = true;
  requestAnimationFrame(frame);
});
