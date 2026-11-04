// Study A-37 (issue 71): weapon effects, today next to the proposal.
//
// Till's wishes of 04.11.2026: the size of shots, beams, bolts and rockets against the emplacement
// (the laser is too wide and too long), a sound of its own for the rocket launcher, parallel tracers
// for the storm battery, a fire aura at the muzzle, finer bolts with an electric aura for the tesla and
// the thunder tower, and the siege mortar as a launcher with two big rockets and no visible laser.
//
// "Heute" is the game itself: the emplacement and its fire are drawn by drawTowerSprite and the
// functions of src/render/towerFx.js (reach, rockets, the shell, the particles), fed by the small
// simulation of this study the way the game feeds them (reload counter, `aim`, `noteTowerEvent`,
// shells with `t`, `flight`, `to`). "Neu" draws the same emplacement from the same model with the new
// effects of waffeneffekte-modell.js; the siege mortar is the new model there. Weapons the study does
// not change (flame, psi, shrine) are drawn by the game on both sides.
//
// The study's simulation reads its numbers from src/data (fire rate, range, splash, flight time): a
// shot every 1/fire seconds while a target is in range, one shell per shot. It is not the game's
// simulation and does nothing the game would not do. The explosions are the study's own and the same
// on both sides.
//
// Fixed step of 1/60 s; Math.random is seeded on every restart (only on this page), so the stills are
// reproducible (`window.__waffen`). Nothing here touches src/.

import { iso } from '../../src/render/iso.js';
import { ell, cellPath } from '../../src/render/draw.js';
import { C } from '../../src/render/palette.js';
import { DOCTRINES, DOCTRINE_COLORS } from '../../src/data/doctrines.js';
import { SPECIALS } from '../../src/data/specials.js';
import { SOUNDS } from '../../src/data/audio.js';
import { playSound } from '../../src/audio/synth.js';
import { MAX_DPR } from '../../src/data/settings.js';
import {
  TURRET_TURN_SPEED,
  SPECIAL_TURN_SPEED,
  SPECIAL_RECOIL_DECAY,
  SPECIAL_BAR_DECAY,
  SPECIAL_FIRE,
  SPECIAL_CASING_PORT,
  TURRET_CASING_PORT,
  TURRET_SCALE,
  FX_FLASH_SECONDS,
  FX_HIT_Z,
  FX_SPECIAL_BOLT_SECONDS,
  FX_BOLT_SECONDS,
  FX_OBELISK_BEAM_SECONDS,
  FX_OBELISK_CHARGE_SECONDS,
  FX_LASER_CHARGE_SECONDS,
  FX_SIGHT_SECONDS,
  FX_ROCKET,
  FX_TRACER_SPEED,
  FX_STORM_TRACER_SPEED,
} from '../../src/data/art.js';
import { createSpriteCache, drawSprite, drawSpriteShadow } from '../../src/render/sprites/rasterizer.js';
import { allTowerDefs, drawTowerSprite, drawSpecialRing, towerSet, towerPictureBox } from '../../src/render/towerSprites.js';
import {
  noteTowerEvent,
  drainFxQueue,
  stepWorldParticle,
  drawWorldParticle,
  launchOf,
  rocketTrail,
  rocketPosition,
  drawRocket,
  drawShell,
  drawTowerReach,
} from '../../src/render/towerFx.js';
import { weaponModel, weaponBox } from '../../src/render/weapons.js';
import { turnFrame, renderSolids, faceList, SOLID_K as K } from '../../src/render/model.js';
import { SPECIAL_MOUNT_Z, specialScale, buildSpecial, specialRestPose } from '../../src/render/specials.js';
import {
  NEU,
  RT,
  rtPose,
  rtMuzzle,
  rtSeeker,
  buildRocketTower,
  glow,
  fireAura,
  drawLaserThin,
  drawSoulThin,
  drawBoltFine,
  drawTracerFixed,
  drawRocketBody,
  drawReticle,
  drawImpactZone,
} from './waffeneffekte-modell.js';

const INK = C.ink;
const TAU = Math.PI * 2;
const STEP = 1 / 60;
const LOOP = 8;
const HALF = 0.5;
const P = (x, y, z = 0) => iso(x, y, z);

// ======================================================================================
// The rocket sound (point 2), in the format of src/data/audio.js
// ======================================================================================

/**
 * Proposal for src/data/audio.js. `rocket` replaces the recipe `launch` (the event `launch` comes from
 * the mortar doctrine and the siege mortar alike); `rocketHeavy` is the same in a deeper voice for the
 * siege launcher, if Till wants the two told apart (that needs the sound table to know which emplacement
 * fired, see the open questions).
 */
export const ROCKET_SOUNDS = {
  rocket: {
    layers: [
      // Ignition: a short dry crack.
      { kind: 'noise', seconds: 0.05, attack: 0.001, gain: 0.42, filter: ['highpass', 2600, 0.8] },
      // Thump of the tube as the rocket leaves.
      { kind: 'tone', wave: 'sine', from: 150, to: 62, seconds: 0.12, attack: 0.002, gain: 0.34, sweep: 'exp' },
      // The motor: a hissing roar that swells for a moment and dies away with distance.
      { kind: 'noise', seconds: 0.62, attack: 0.04, gain: 0.36, filter: ['bandpass', 1500, 0.6] },
      // The whine of the motor rising as the rocket gains speed.
      { kind: 'tone', wave: 'sawtooth', from: 260, to: 720, seconds: 0.5, attack: 0.05, gain: 0.06, sweep: 'exp', filter: ['lowpass', 2200, 0.7] },
    ],
    throttle: 0.09,
  },
  rocketHeavy: {
    layers: [
      { kind: 'noise', seconds: 0.07, attack: 0.001, gain: 0.45, filter: ['highpass', 1900, 0.8] },
      { kind: 'tone', wave: 'sine', from: 110, to: 40, seconds: 0.22, attack: 0.002, gain: 0.5, sweep: 'exp' },
      { kind: 'noise', seconds: 0.95, attack: 0.06, gain: 0.42, filter: ['bandpass', 900, 0.55] },
      { kind: 'tone', wave: 'sawtooth', from: 170, to: 430, seconds: 0.8, attack: 0.08, gain: 0.07, sweep: 'exp', filter: ['lowpass', 1500, 0.7] },
    ],
    throttle: 0.2,
  },
};

// ======================================================================================
// The twelve weapons
// ======================================================================================

const WEAPONS = [
  { kind: 'autocannon', label: 'Autokanone', R: 2.6, change: 'Leuchtspur dünner und mit fester Länge, Feueraura an der Mündung.' },
  { kind: 'flame', label: 'Flamme', R: 1.5, same: true, change: 'Keine Änderung: der Strahl passt zur Düse (Maßstab siehe Tabelle).' },
  { kind: 'mortar', label: 'Raketenwerfer', R: 3.4, change: 'Arbeitstitel „Raketenwerfer“ (heute Mörser). Rakete im Flug so dick wie im Rohr, Feueraura, eigener Raketenton.' },
  { kind: 'tesla', label: 'Tesla', R: 2.4, change: 'Blitz filigran (dünner, mehr Zacken, zwei Haarfäden), darum eine halbtransparente elektrische Aura.' },
  { kind: 'laser', label: 'Laser', R: 2.8, change: 'Strahl schmaler als die Linse, hell nur bis knapp hinter das Ziel, dann dünn und blass bis zum Ende der Reichweite (der Strahl der Simulation durchschlägt die Linie).' },
  { kind: 'psi', label: 'Psi', R: 2.0, same: true, change: 'Keine Änderung: Aura-Waffe ohne Schuss, also auch keine Feueraura.' },
  { kind: 'purgeShrine', label: 'Reinigungsschrein', R: 1.8, same: true, change: 'Keine Änderung: Aura am Boden, kein Schuss.' },
  { kind: 'stormBattery', label: 'Sturmbatterie', R: 2.6, change: 'Die vier Leuchtspuren fliegen parallel entlang der Läufe; getroffene Nebenziele zeigen nur Funken.' },
  { kind: 'emberCauldron', label: 'Glutkessel', R: 2.4, change: 'Feuerblitze im Stil der neuen Blitze (dünn, Glutaura), Feueraura an der Elektrode. Nicht ausdrücklich gewünscht, Frage an Till.' },
  { kind: 'siegeMortar', label: 'Belagerungsmörser', R: 3.6, change: 'Arbeitstitel „Raketenturm“. Zwei große Raketen, abwechselnd je Schuss; Zielsucher am Ziel statt Laserlinie; Einschlagzone während des Flugs.' },
  { kind: 'thunderTower', label: 'Gewitterturm', R: 2.4, change: 'Kettenblitz filigran mit elektrischer Aura je Sprung.' },
  { kind: 'soulfireObelisk', label: 'Seelenfeuer-Obelisk', R: 3.0, change: 'Seelenstrahl etwa halb so breit, Feueraura an der Pupille.' },
];
const SPECIAL_KINDS = new Set(Object.keys(SPECIALS));
const isSpecial = (kind) => SPECIAL_KINDS.has(kind);
const defOf = (kind) => (isSpecial(kind) ? SPECIALS[kind] : DOCTRINES[kind]);
const weaponByKind = Object.fromEntries(WEAPONS.map((w) => [w.kind, w]));

// Where the two emplacements stand: today on the left, the proposal on the right.
const SITES = { heute: [4, 8], neu: [8, 4] };

// ======================================================================================
// State
// ======================================================================================

const ui = {
  weapon: 'laser',
  view: 'beide', // beide | heute | neu
  speed: 1,
  paused: false,
  zoom: 1,
  reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  sound: 'aus', // aus | heute | neu
  table: false,
};

let scene = null;
let clock = 0;
let acc = 0;

// A seeded Math.random for this page, so a restart repeats the same sparks and smoke.
let seed = 1;
function reseed(s) {
  seed = s >>> 0;
}
Math.random = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rand = (a, b) => a + Math.random() * (b - a);

/** A tower record as the game knows it, plus the study's own fields. */
function makeTower(side, kind, id) {
  const [x, y] = SITES[side];
  const special = isSpecial(kind);
  const def = defOf(kind);
  const tower = {
    id,
    x,
    y,
    doctrine: special ? def.doctrine : kind,
    rank: 3,
    special: special ? kind : undefined,
    aim: null,
    cooldown: 0,
    firing: false,
    flash: 0,
  };
  return {
    side,
    kind,
    tower,
    def,
    fire: def.fire,
    range: def.range,
    // The proposal's drawing state (unused on the today side).
    n: {
      theta: Math.PI / 4,
      recoil: 0,
      spin: 0,
      gyro: 0.6,
      tube: 0,
      next: 0,
      bar: [0, 0, 0, 0],
      flash: 0,
      flashK: [0, 0, 0, 0],
      aura: 0,
      auraAt: null,
      beam: 0,
      beamEnd: null,
      beamHit: null,
      bolt: 0,
      boltPoints: null,
      boltSeed: 0,
      load: [1, 1],
      empty: -1,
    },
  };
}

function newScene(kind) {
  reseed(71);
  clock = 0;
  acc = 0;
  return {
    kind,
    towers: { heute: makeTower('heute', kind, 1), neu: makeTower('neu', kind, 2) },
    targets: { heute: [], neu: [] },
    shells: [],
    particles: [],
    booms: [],
  };
}

// ======================================================================================
// The study's simulation
// ======================================================================================

/** Path of the target group of one side at time t: a sweep over the quarter in front of the emplacement. */
function groupAt(side, t, R) {
  const [x, y] = SITES[side];
  const out = [];
  for (let i = 0; i < 4; i++) {
    const phi = Math.PI / 4 + 0.72 * Math.sin((TAU * t) / LOOP) - i * 0.2;
    const r = R + (i % 2 ? 0.25 : 0) - i * 0.05;
    out.push({ x: x + HALF + Math.cos(phi) * r, y: y + HALF + Math.sin(phi) * r, i });
  }
  return out;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function simStep(dt) {
  clock += dt;
  const w = weaponByKind[scene.kind];
  for (const side of ['heute', 'neu']) {
    curSide = side;
    const rec = scene.towers[side];
    const tw = rec.tower;
    const centre = { x: tw.x + HALF, y: tw.y + HALF };
    scene.targets[side] = groupAt(side, clock, w.R);
    const inRange = scene.targets[side].filter((e) => {
      const d = dist(e, centre);
      return d <= rec.range && d >= (rec.def.minRange ?? 0);
    });
    const lead = inRange[0] ?? null;
    tw.aim = lead ? { x: lead.x, y: lead.y } : tw.aim;
    if (rec.fire === 'stream' || rec.fire === 'aura') {
      tw.firing = Boolean(lead);
    } else {
      tw.cooldown = Math.max(0, tw.cooldown - dt);
      if (tw.cooldown <= 0 && lead) {
        tw.cooldown += 1 / rec.fire;
        shoot(rec, inRange, lead, centre);
      }
    }
    if (side === 'neu') stepNeu(rec, dt);
  }
  for (let i = scene.shells.length - 1; i >= 0; i--) {
    const s = scene.shells[i];
    s.t += dt;
    if (s.t >= s.flight) {
      curSide = s.owner.side;
      boom(s.to.x, s.to.y, s.splash);
      scene.shells.splice(i, 1);
    }
  }
  for (let i = scene.booms.length - 1; i >= 0; i--) {
    scene.booms[i].life -= dt;
    if (scene.booms[i].life <= 0) scene.booms.splice(i, 1);
  }
}

/** A shot of the study's simulation: what the game's simulation reports, for both sides. */
function shoot(rec, inRange, lead, centre) {
  const tw = rec.tower;
  const kind = rec.kind;
  const def = rec.def;
  const events = [];
  const ux = (lead.x - centre.x) / (dist(lead, centre) || 1);
  const uy = (lead.y - centre.y) / (dist(lead, centre) || 1);
  if (kind === 'laser') {
    events.push({ type: 'beam', tx: centre.x + ux * rec.range, ty: centre.y + uy * rec.range });
  } else if (def.behaviour === 'chain' || kind === 'tesla') {
    const points = [centre, lead];
    let cur = lead;
    const left = inRange.slice(1);
    const jump = def.chain?.jumpRange ?? DOCTRINES.tesla.chain?.jumpRange ?? 1.6;
    while (left.length) {
      left.sort((a, b) => dist(a, cur) - dist(b, cur));
      if (dist(left[0], cur) > jump) break;
      cur = left.shift();
      points.push(cur);
    }
    events.push({ type: 'chain', points: points.map((p) => ({ x: p.x, y: p.y })) });
  } else if (def.behaviour === 'multi') {
    for (const e of inRange.slice(0, def.multiTargets)) events.push({ type: 'shot', tx: e.x, ty: e.y });
  } else if (def.behaviour === 'soulfire') {
    events.push({ type: 'soulfire', tx: lead.x, ty: lead.y });
  } else if (kind === 'mortar' || def.behaviour === 'mortar') {
    // A shell with flight time, aimed where the target will be (lead), as the game does.
    const flight = def.flightSeconds;
    const ahead = groupAt(rec.side, clock + flight, weaponByKind[kind].R)[0];
    const shell = { owner: rec, t: 0, flight, to: { x: ahead.x, y: ahead.y }, splash: def.splashRadius };
    scene.shells.push(shell);
    rec.lastShell = shell;
    events.push({ type: 'launch', tx: lead.x, ty: lead.y });
  } else {
    events.push({ type: 'shot', tx: lead.x, ty: lead.y });
  }
  if (rec.side === 'heute') for (const e of events) noteTowerEvent(tw, e);
  rec.lastEvents = events;
  if (rec.side === 'neu') shootNeu(rec, events, lead);
  sound(rec, events);
}

function boom(x, y, splash) {
  scene.booms.push({ x, y, r: splash, life: 0.55, max: 0.55, side: curSide });
  for (let i = 0; i < 5; i++) {
    addParticle({
      kind: 'wsmoke', x: x + rand(-0.3, 0.3) * splash, y: y + rand(-0.3, 0.3) * splash, z: 4, vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3),
      vz: rand(14, 30), r0: 6, r1: 10 + splash * 6, tone: 1, life: rand(0.9, 1.4), floor: 0,
    });
  }
}

/** The side whose particles are being made; a particle is only drawn while its side is shown. */
let curSide = 'heute';

function addParticle(spec) {
  if (scene.particles.length >= 520) return;
  scene.particles.push({ ...spec, world: true, max: spec.life, side: curSide });
}

// ======================================================================================
// The proposal: motion and fire of the emplacement on the right
// ======================================================================================

const turnSpeedOf = (kind) => (isSpecial(kind) ? SPECIAL_TURN_SPEED[kind] : TURRET_TURN_SPEED[kind]);
const wrapPi = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

function stepNeu(rec, dt) {
  const n = rec.n;
  const tw = rec.tower;
  if (tw.aim) {
    const want = Math.atan2(tw.aim.y - (tw.y + HALF), tw.aim.x - (tw.x + HALF));
    const d = wrapPi(want - n.theta);
    const s = turnSpeedOf(rec.kind) * dt;
    n.theta = wrapPi(n.theta + Math.max(-s, Math.min(s, d)));
  }
  n.recoil = Math.max(0, n.recoil - dt * SPECIAL_RECOIL_DECAY);
  for (let k = 0; k < 4; k++) {
    n.bar[k] = Math.max(0, n.bar[k] - dt * SPECIAL_BAR_DECAY);
    n.flashK[k] = Math.max(0, n.flashK[k] - dt);
  }
  if (rec.kind === 'autocannon' && (n.recoil > 0 || tw.firing)) n.spin += dt * 26;
  if (!ui.reduced) n.gyro += dt * (n.recoil > 0 ? 3.4 : 1.2);
  n.flash = Math.max(0, n.flash - dt);
  n.aura = Math.max(0, n.aura - dt);
  n.beam = Math.max(0, n.beam - dt);
  n.bolt = Math.max(0, n.bolt - dt);
  if (n.bolt > 0 && !ui.reduced) n.boltSeed = Math.floor(clock * 28);
  // The empty tube of the siege launcher is loaded again over the reload.
  if (rec.kind === 'siegeMortar' && n.empty >= 0) {
    const reload = 1 / rec.fire;
    const prog = 1 - tw.cooldown / reload;
    const u = Math.max(0, Math.min(1, (prog - RT.loadFrom) / (RT.loadTo - RT.loadFrom)));
    n.load[n.empty] = u;
    if (u >= 1) n.empty = -1;
  }
}

/** Model, frame and pose of the weapon on the right as it stands now. */
function neuWeapon(rec) {
  const n = rec.n;
  const kind = rec.kind;
  const bob = !ui.reduced && kind !== 'stormBattery' && kind !== 'emberCauldron' && kind !== 'siegeMortar' && isSpecial(kind) ? Math.sin(clock * 2 + rec.tower.x) * 2 : 0;
  if (kind === 'siegeMortar') {
    const scale = specialScale('siegeMortar');
    const F = turnFrame(n.theta, SPECIAL_MOUNT_Z, scale);
    const pose = { ...rtPose(DOCTRINE_COLORS.mortar), load: n.load, recoil: n.recoil, tube: n.next, seek: siegeAim(rec) };
    return { F, pose, mount: SPECIAL_MOUNT_Z, scale, muzzle: (p) => rtMuzzle(p), ahead: 0, bob: 0 };
  }
  const model = weaponModel(kind);
  const F = turnFrame(n.theta, model.mount, model.scale);
  const pose = { ...model.restPose(model.accent, 3), recoil: n.recoil, spin: n.spin, bob, tube: n.tube, gyro: n.gyro, bar: n.bar, glow: 0 };
  return { F, pose, mount: model.mount, scale: model.scale, muzzle: model.muzzle, ahead: model.ahead, bob, model };
}

/** The muzzle of the weapon on the right in the world (x, y cells, z px) and the direction of the shot. */
function neuMuzzle(rec, poseOver = {}) {
  const w = neuWeapon(rec);
  const pose = { ...w.pose, ...poseOver };
  const m = w.muzzle(pose);
  const d = m.dir;
  const at = [m.at[0] + d[0] * w.ahead, m.at[1] + d[1] * w.ahead, m.at[2] + d[2] * w.ahead * K];
  const [px, py] = w.F.world(at[0], at[1]);
  const tw = rec.tower;
  return { x: tw.x + HALF + px, y: tw.y + HALF + py, z: w.mount + at[2] * w.scale, dir: w.F.wn(d[0], d[1], d[2]) };
}

/** A local point of the weapon on the right in the world. */
function neuLocal(rec, lx, ly, z) {
  const w = neuWeapon(rec);
  const [px, py] = w.F.world(lx, ly);
  return [rec.tower.x + HALF + px, rec.tower.y + HALF + py, w.mount + z * w.scale];
}

/** How far the siege launcher has its target, 0 to 1, over the last FX_SIGHT_SECONDS of the reload. */
function siegeAim(rec) {
  const tw = rec.tower;
  if (!tw.aim || tw.cooldown <= 0 || tw.cooldown >= FX_SIGHT_SECONDS) return 0;
  return 1 - tw.cooldown / FX_SIGHT_SECONDS;
}

const norm2 = (d) => {
  const l = Math.hypot(d[0], d[1]) || 1;
  return [d[0] / l, d[1] / l];
};

function sparks(x, y, z, count, speed, colour = null) {
  if (ui.reduced) return;
  for (let i = 0; i < count; i++) {
    const a = rand(0, TAU);
    const s = rand(0.3, 1) * speed;
    addParticle({ kind: 'wspark', x, y, z, vx: Math.cos(a) * s * 0.02, vy: Math.sin(a) * s * 0.02, vz: rand(0.1, 1) * speed, life: 0.28 * rand(0.6, 1.1), floor: 0, colour });
  }
}

function casing(x, y, z, vx, vy) {
  addParticle({ kind: 'wcasing', x, y, z, vx, vy, vz: rand(80, 160), rot: rand(0, TAU), vrot: rand(-18, 18), life: 1.1, floor: 0 });
}

/** A shot of the weapon on the right: timers, particles and shells of the proposal. */
function shootNeu(rec, events, lead) {
  const n = rec.n;
  const kind = rec.kind;
  const tw = rec.tower;
  n.recoil = 1;
  n.tube = n.next;
  const tubes = kind === 'mortar' ? 6 : kind === 'stormBattery' ? 4 : kind === 'siegeMortar' ? 2 : 1;
  n.next = (n.next + 1) % tubes;
  const pose = { tube: n.tube, recoil: 0 };
  const mw = neuMuzzle(rec, kind === 'siegeMortar' ? { tube: n.tube, recoil: 0 } : pose);
  n.auraAt = mw;
  n.aura = NEU.aura[kind]?.s ?? 0;
  const hitZ = FX_HIT_Z;
  if (kind === 'autocannon') {
    n.flash = FX_FLASH_SECONDS.autocannon;
    const F = turnFrame(n.theta, MOUNT(rec), SCALE(rec));
    const [cx, cy] = F.world(TURRET_CASING_PORT[0], TURRET_CASING_PORT[1]);
    casing(tw.x + HALF + cx, tw.y + HALF + cy, MOUNT(rec) + TURRET_CASING_PORT[2] * SCALE(rec), F.s[0] * rand(0.9, 1.5), F.s[1] * rand(0.9, 1.5));
    const d = Math.hypot(lead.x - mw.x, lead.y - mw.y);
    addParticle({ kind: 'ntracer', x0: mw.x, y0: mw.y, z0: mw.z, x1: lead.x, y1: lead.y, z1: hitZ, life: Math.max(0.05, d / FX_TRACER_SPEED), floor: 0, colour: '#ffd23f', core: '#fff3b0' });
  } else if (kind === 'laser') {
    n.beam = NEU.laser.seconds;
    n.beamEnd = [events[0].tx, events[0].ty];
    n.beamHit = [lead.x, lead.y];
    sparks(lead.x, lead.y, hitZ, 4, 150);
  } else if (kind === 'tesla' || kind === 'thunderTower' || kind === 'emberCauldron') {
    n.flash = FX_FLASH_SECONDS[kind] ?? 0.075;
    n.bolt = kind === 'tesla' ? FX_BOLT_SECONDS : FX_SPECIAL_BOLT_SECONDS[kind];
    n.boltSeed = Math.floor(clock * 30);
    if (kind === 'emberCauldron') n.boltPoints = events.map((e) => [e.tx, e.ty]);
    else n.boltPoints = events[0].points.slice(1).map((p) => [p.x, p.y]);
    const colour = kind === 'emberCauldron' ? '#ff8a2a' : '#bff2ff';
    for (const [hx, hy] of n.boltPoints.slice(0, 3)) sparks(hx, hy, hitZ, 5, 160, colour);
  } else if (kind === 'mortar') {
    n.flash = FX_FLASH_SECONDS.mortar;
    rec.lastShell.launch = { x: mw.x, y: mw.y, z: mw.z, dir: mw.dir, lift: 0 };
    rec.lastShell.trail = 0;
    const back = [-mw.dir[0], -mw.dir[1], -mw.dir[2]];
    for (let i = 0; i < (ui.reduced ? 2 : 5); i++) {
      const r = 0.46 * SCALE(rec) + i * 0.04;
      addParticle({ kind: 'wsmoke', x: mw.x + back[0] * r, y: mw.y + back[1] * r, z: mw.z + back[2] * 0.46 * SCALE(rec) * K, vx: back[0] * 0.45 + rand(-0.12, 0.12), vy: back[1] * 0.45 + rand(-0.12, 0.12), vz: rand(-5, 25), r0: 3, r1: 12, tone: 0.5, life: rand(0.7, 1.1), floor: 0 });
    }
    sparks(mw.x, mw.y, mw.z, 4, 140);
  } else if (kind === 'stormBattery') {
    const k = n.tube;
    n.bar[k] = 1;
    n.flashK[k] = FX_FLASH_SECONDS.stormBattery;
    const F = turnFrame(n.theta, MOUNT(rec), SCALE(rec));
    const [cx, cy] = F.world(SPECIAL_CASING_PORT[0], SPECIAL_CASING_PORT[1] + (k % 2 ? -0.02 : 0.02));
    const dir = norm2(mw.dir);
    casing(tw.x + HALF + cx, tw.y + HALF + cy, MOUNT(rec) + SPECIAL_CASING_PORT[2] * SCALE(rec), -dir[0] * rand(0.9, 1.6) - dir[1] * rand(-0.4, 0.4), -dir[1] * rand(0.9, 1.6) + dir[0] * rand(-0.4, 0.4));
    // Parallel: the tracer leaves its barrel along the line of the barrels and runs as far as the lead target
    // lies along that line, so the four stay side by side. The other targets of the volley show sparks.
    const along = (lead.x - mw.x) * dir[0] + (lead.y - mw.y) * dir[1];
    const reach = Math.max(0.6, along);
    addParticle({
      kind: 'ntracer', x0: mw.x, y0: mw.y, z0: mw.z, x1: mw.x + dir[0] * reach, y1: mw.y + dir[1] * reach, z1: hitZ + (mw.z - SCALE(rec) * 12 - MOUNT(rec)),
      life: Math.max(0.05, reach / FX_STORM_TRACER_SPEED), floor: 0, colour: '#7fd8ff', core: '#e8fbff',
    });
    const hits = events.filter((e) => e.type === 'shot');
    if (hits.length && Math.random() < 0.35) {
      const h = hits[Math.floor(Math.random() * hits.length)];
      sparks(h.tx, h.ty, hitZ, 2, 120, '#7fd8ff');
    }
  } else if (kind === 'siegeMortar') {
    n.flash = FX_FLASH_SECONDS.siegeMortar;
    n.load[n.tube] = 0;
    n.empty = n.tube;
    rec.lastShell.launch = { x: mw.x, y: mw.y, z: mw.z, dir: mw.dir, lift: 0 };
    rec.lastShell.trail = 0;
    rec.lastShell.big = true;
    const back = [-mw.dir[0], -mw.dir[1]];
    for (let i = 0; i < (ui.reduced ? 3 : 7); i++) {
      const r = 0.5 * SCALE(rec) + i * 0.05;
      addParticle({ kind: 'wsmoke', x: mw.x + back[0] * r, y: mw.y + back[1] * r, z: mw.z - 6 - i * 2, vx: back[0] * 0.5 + rand(-0.15, 0.15), vy: back[1] * 0.5 + rand(-0.15, 0.15), vz: rand(-5, 25), r0: 4, r1: 16, tone: 0.5, life: rand(0.9, 1.4), floor: 0 });
    }
    sparks(mw.x, mw.y, mw.z, 6, 150, '#ffb02e');
  } else if (kind === 'soulfireObelisk') {
    n.beam = FX_OBELISK_BEAM_SECONDS;
    n.beamEnd = [lead.x, lead.y];
    sparks(lead.x, lead.y, hitZ, 10, 200, '#b784ff');
  }
}

const MOUNT = (rec) => neuWeapon(rec).mount;
const SCALE = (rec) => neuWeapon(rec).scale;

// ======================================================================================
// Drawing
// ======================================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const cache = createSpriteCache();
const view = { w: 1, h: 1, dpr: 1 };

function resize() {
  view.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  view.w = canvas.clientWidth;
  view.h = canvas.clientHeight;
  canvas.width = Math.round(view.w * view.dpr);
  canvas.height = Math.round(view.h * view.dpr);
}
window.addEventListener('resize', resize);
resize();

function cameraCentre() {
  const [hx, hy] = SITES.heute;
  const [nx, ny] = SITES.neu;
  const centre = ui.view === 'heute' ? [hx + 1.6, hy + 1.6] : ui.view === 'neu' ? [nx + 1.6, ny + 1.6] : [(hx + nx) / 2 + 1.4, (hy + ny) / 2 + 1.4];
  return P(centre[0], centre[1], 30);
}

function drawGround() {
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      cellPath(ctx, x, y);
      ctx.fillStyle = (x + y) % 2 ? '#3a322a' : '#342c25';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  for (const side of shownSides()) {
    const [x, y] = SITES[side];
    cellPath(ctx, x, y);
    ctx.fillStyle = 'rgba(232,200,114,.08)';
    ctx.fill();
  }
}

function shownSides() {
  return ui.view === 'beide' ? ['heute', 'neu'] : [ui.view];
}

/** A dummy target: a beetle shape on the ground, facing the way it walks. */
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
  ctx.font = '18px Bangers, Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.fillStyle = side === 'heute' ? '#eadfc4' : '#e8c872';
  const text = side === 'heute' ? 'HEUTE' : 'NEU';
  ctx.strokeText(text, sx, sy + 18);
  ctx.fillText(text, sx, sy + 18);
}

/** The emplacement on the left, all by the game's own functions. */
function drawHeute(rec, dt) {
  const tw = rec.tower;
  curSide = rec.side;
  if (tw.special) drawSpecialRing(ctx, tw);
  drawTowerSprite(ctx, cache, tw, ui.zoom, view.dpr, clock, dt, ui.reduced);
  const queued = drainFxQueue(tw);
  if (queued) for (const spec of queued) addParticle(spec);
}

/** The base under the weapon on the right: the same sprite the game draws. */
function drawBase(tw) {
  const set = towerSet(tw);
  const back = cache.get(set.back, ui.zoom, view.dpr);
  if (!back) return;
  const [sx, sy] = P(tw.x + HALF, tw.y + HALF);
  drawSpriteShadow(ctx, set.back, back, sx, sy);
  drawSprite(ctx, set.back, back, sx, sy);
}

/** The emplacement on the right: the base, the weapon from its model, the new fire. */
function drawNeu(rec) {
  const tw = rec.tower;
  const w = weaponByKind[rec.kind];
  if (w.same) {
    // Unchanged: the game's own drawing.
    drawHeute(rec, rec.dtFrame ?? 0);
    return;
  }
  if (tw.special) drawSpecialRing(ctx, tw);
  drawBase(tw);
  const n = rec.n;
  const wpn = neuWeapon(rec);
  const mw = neuMuzzle(rec);
  const floats = rec.kind === 'thunderTower' || rec.kind === 'soulfireObelisk';
  rec.front = floats || mw.dir[0] + mw.dir[1] >= 0;
  rec.mw = mw;
  if (rec.kind === 'soulfireObelisk') obeliskFlames(rec, 'back');
  if (!rec.front) drawReachNeu(rec);
  const [sx, sy] = P(tw.x + HALF, tw.y + HALF);
  ctx.save();
  ctx.translate(sx, sy);
  if (rec.kind === 'siegeMortar') {
    renderSolids(ctx, buildRocketTower(wpn.F, wpn.pose).parts);
  } else {
    if (rec.kind === 'soulfireObelisk') wpn.pose.glow = n.beam > 0 || chargeNeu(rec, FX_OBELISK_CHARGE_SECONDS) > 0.5 ? 1 : 0;
    renderSolids(ctx, wpn.model.build(wpn.F, wpn.pose, 'all').parts);
  }
  ctx.restore();
  if (rec.kind === 'soulfireObelisk') obeliskFlames(rec, 'front');
  drawAtMuzzleNeu(rec, mw);
}

function chargeNeu(rec, seconds) {
  const tw = rec.tower;
  if (!tw.aim || tw.cooldown <= 0 || tw.cooldown >= seconds) return 0;
  return 1 - tw.cooldown / seconds;
}

/** The muzzle flash of today's weapons (towerFx.js), copied: two crossed kites of light. */
function flare(m, dir, len, wid, outer, inner) {
  const h = Math.hypot(dir[0], dir[1]) || 1;
  const s1 = [-dir[1] / h, dir[0] / h, 0];
  const s2 = [dir[1] * s1[2] - dir[2] * s1[1], dir[2] * s1[0] - dir[0] * s1[2], dir[0] * s1[1] - dir[1] * s1[0]];
  const kite = (side, l, wd, fill) => {
    const at = (a, b) => P(m.x + dir[0] * a + side[0] * b, m.y + dir[1] * a + side[1] * b, m.z + (dir[2] * a + side[2] * b) * K);
    const pts = [at(-0.01, 0), at(l * 0.32, wd), at(l, 0), at(l * 0.32, -wd)];
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  };
  for (const s of [s1, s2]) kite(s, len, wid, outer);
  for (const s of [s1, s2]) kite(s, len * 0.62, wid * 0.55, inner);
}

function flameShape(x, y, s, outer, inner) {
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

const flicker = (i, tw) => (ui.reduced ? 1 : 0.85 + Math.sin(clock * 15 + i * 2.1 + tw.x) * 0.15);

function obeliskFlames(rec, phase) {
  const tw = rec.tower;
  SPECIAL_FIRE.obeliskFeet.forEach(([lx, ly], i) => {
    const [wx, wy, wz] = neuLocal(rec, lx, ly, SPECIAL_FIRE.obeliskFootZ);
    const behind = wx + wy < tw.x + HALF + tw.y + HALF - 1e-6;
    if ((phase === 'back') !== behind) return;
    const [sx, sy] = P(wx, wy, wz);
    flameShape(sx, sy, 0.75 * flicker(i, tw), '#ff8a2a', '#ffd23f');
  });
}

/** The lights at the muzzle of the weapon on the right, with the new fire aura on every shot. */
function drawAtMuzzleNeu(rec, mw) {
  const n = rec.n;
  const kind = rec.kind;
  const tw = rec.tower;
  const mp = P(mw.x, mw.y, mw.z);
  const damp = ui.reduced ? 0.5 : 1;
  const shrink = ui.reduced ? 0.7 : 1;
  const accent = DOCTRINE_COLORS[tw.doctrine];
  if (kind === 'autocannon' && n.flash > 0) {
    const u = n.flash / FX_FLASH_SECONDS.autocannon;
    flare(mw, mw.dir, 0.36 * (0.6 + 0.4 * u) * shrink, 0.08, '#ffd23f', '#fff3b0');
  } else if (kind === 'mortar' && n.flash > 0) {
    const u = n.flash / FX_FLASH_SECONDS.mortar;
    const at = n.auraAt;
    flare(at, at.dir, 0.36 * (0.6 + 0.4 * u) * shrink, 0.09, '#ff8a2a', '#ffe38a');
    const back = 0.45 * SCALE(rec);
    const rear = { x: at.x - at.dir[0] * back, y: at.y - at.dir[1] * back, z: at.z - at.dir[2] * back * K };
    flare(rear, [-at.dir[0], -at.dir[1], -at.dir[2]], 0.36 * u * shrink, 0.1, '#d89a56', '#fff0c0');
  } else if (kind === 'laser') {
    const charge = chargeNeu(rec, FX_LASER_CHARGE_SECONDS);
    const idle = ui.reduced ? 0.3 : 0.25 + 0.1 * Math.sin(clock * 6);
    glow(ctx, mp[0], mp[1], 8 + charge * 14, accent, charge > 0 ? 0.35 + charge * 0.5 : idle);
    if (charge > 0) {
      ell(ctx, mp[0], mp[1], 1.6 + charge * 2.2, 1.6 + charge * 2.2, '#fff1e4', INK, 1);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + (ui.reduced ? 0 : clock * 9);
        const r = (1 - charge) * 13 + 3;
        ell(ctx, mp[0] + Math.cos(a) * r, mp[1] + Math.sin(a) * r * 0.7, 1, 1, '#ffd0c0', null);
      }
    }
  } else if (kind === 'tesla' || kind === 'thunderTower') {
    const bolting = n.bolt > 0;
    const big = kind === 'tesla' ? 20 : 24;
    glow(ctx, mp[0], mp[1], bolting ? big : big * 0.6, '#5fd4ff', bolting ? 0.55 * damp : 0.28 + (ui.reduced ? 0 : 0.08 * Math.sin(clock * 9)));
    if (!bolting && !ui.reduced) {
      const k = Math.floor(clock * 7);
      const r = Math.sin(k * 91.7) * 1000;
      if (r - Math.floor(r) < 0.6) {
        const a = (Math.sin(k * 12.3) * 1000) % TAU;
        drawBoltFine(ctx, mp, [mp[0] + Math.cos(a) * 12, mp[1] + Math.sin(a) * 9 - 3], k, 0.6, '#bff2ff', '#5fd4ff');
      }
    }
  } else if (kind === 'stormBattery') {
    for (let k = 0; k < 4; k++) {
      if (n.flashK[k] <= 0) continue;
      const mk = neuMuzzle(rec, { tube: k });
      const u = n.flashK[k] / FX_FLASH_SECONDS.stormBattery;
      flare(mk, mk.dir, 0.26 * (0.6 + 0.4 * u) * shrink, 0.07, '#7fd8ff', '#e8fbff');
    }
  } else if (kind === 'emberCauldron') {
    const [fx0, fy0, fz0] = neuLocal(rec, ...SPECIAL_FIRE.cauldron);
    const base = P(fx0, fy0, fz0);
    const charged = n.bolt > 0 ? 1.25 : 1;
    glow(ctx, base[0], base[1] - 8, 26, '#ff8a2a', 0.4 * charged);
    const scale = SCALE(rec);
    [[-4.2, 0.62, 0], [3.6, 0.8, 1], [0, 1.05, 2], [6.4, 0.5, 3]].forEach(([dx, s, i]) => {
      flameShape(base[0] + dx * scale, base[1] + 1 - Math.abs(dx) * 0.15, s * flicker(i, tw) * charged, i % 2 ? '#ffb13b' : '#ff8a2a', '#fff3c0');
    });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const [ex, ey, ez] = neuLocal(rec, Math.cos(a) * 0.225, Math.sin(a) * 0.225, 31.5);
      const p = P(ex, ey, ez);
      glow(ctx, p[0], p[1], n.bolt > 0 && i === 0 ? 11 : 6, i === 0 ? '#ffb02e' : '#5fd4ff', n.bolt > 0 ? 0.7 * damp : 0.4);
    }
  } else if (kind === 'siegeMortar') {
    if (n.flash > 0) {
      const u = n.flash / FX_FLASH_SECONDS.siegeMortar;
      const at = n.auraAt;
      flare(at, at.dir, 0.5 * (0.6 + 0.4 * u) * shrink, 0.13, '#ff8a2a', '#ffe38a');
      // Back blast out of the open breech.
      const back = 0.62 * SCALE(rec);
      const rear = { x: at.x - at.dir[0] * back, y: at.y - at.dir[1] * back, z: at.z - at.dir[2] * back * K };
      flare(rear, [-at.dir[0], -at.dir[1], -at.dir[2]], 0.5 * u * shrink, 0.14, '#d89a56', '#fff0c0');
    }
    const q = siegeAim(rec);
    if (q > 0) {
      const [lx, ly, lz] = rtSeeker({ recoil: n.recoil });
      const [wx, wy, wz] = neuLocal(rec, lx, ly, lz);
      const lens = P(wx, wy, wz);
      glow(ctx, lens[0], lens[1], 5 + 4 * q, '#ff4a4a', 0.5 + 0.4 * q);
    }
  } else if (kind === 'soulfireObelisk') {
    const ch = chargeNeu(rec, FX_OBELISK_CHARGE_SECONDS);
    const idle = 0.18 + (ui.reduced ? 0 : 0.06 * Math.sin(clock * 5));
    glow(ctx, mp[0], mp[1], 15 + ch * 18, '#b784ff', n.beam > 0 ? 0.7 : ch > 0 ? 0.35 + ch * 0.4 : idle);
    if (ch > 0) {
      glow(ctx, mp[0], mp[1], 6 + ch * 8, '#ff3a1a', 0.4 + ch * 0.5);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + (ui.reduced ? 0 : clock * 7);
        const r = (1 - ch) * 22 + 3;
        ell(ctx, mp[0] + Math.cos(a) * r, mp[1] + Math.sin(a) * r * 0.7, 1.3, 1.3, '#d5b6ff', null);
      }
    }
  }
  // The fire aura of the last shot (point 4).
  const spec = NEU.aura[kind];
  if (spec && n.aura > 0 && n.auraAt) {
    const at = kind === 'stormBattery' || kind === 'siegeMortar' || kind === 'mortar' ? n.auraAt : mw;
    const ap = P(at.x, at.y, at.z);
    const colour = kind === 'stormBattery' ? '#7fd8ff' : kind === 'emberCauldron' ? '#ff8a2a' : kind === 'thunderTower' ? '#5fd4ff' : kind === 'mortar' || kind === 'siegeMortar' ? '#ffb02e' : accent;
    fireAura(ctx, ap[0], ap[1], colour, n.aura / spec.s, spec.r, ui.reduced);
  }
}

/** The fire that reaches out of the weapon on the right: beam, bolts, soul beam. */
function drawReachNeu(rec) {
  const n = rec.n;
  const kind = rec.kind;
  const mw = rec.mw;
  const mp = P(mw.x, mw.y, mw.z);
  if (kind === 'laser' && n.beam > 0) {
    const hit = P(n.beamHit[0], n.beamHit[1], FX_HIT_Z);
    const end = P(n.beamEnd[0], n.beamEnd[1], FX_HIT_Z);
    drawLaserThin(ctx, mp, hit, end, n.beam / NEU.laser.seconds, DOCTRINE_COLORS.laser);
  } else if ((kind === 'tesla' || kind === 'thunderTower') && n.bolt > 0) {
    const u = n.bolt / (kind === 'tesla' ? FX_BOLT_SECONDS : FX_SPECIAL_BOLT_SECONDS.thunderTower);
    let from = mp;
    n.boltPoints.forEach(([x, y], i) => {
      const to = P(x, y, FX_HIT_Z);
      drawBoltFine(ctx, from, to, n.boltSeed + i * 7, u, '#bff2ff', '#5fd4ff', '#ffffff', ui.reduced);
      if (i === 0 && kind === 'tesla') {
        const fork = [mp[0] + (to[0] - mp[0]) * 0.55, mp[1] + (to[1] - mp[1]) * 0.55];
        drawBoltFine(ctx, fork, [fork[0] + 14, fork[1] - 10], n.boltSeed + 3, u * 0.7, '#bff2ff', '#5fd4ff', '#ffffff', ui.reduced);
      }
      from = to;
    });
  } else if (kind === 'emberCauldron' && n.bolt > 0) {
    const u = n.bolt / FX_SPECIAL_BOLT_SECONDS.emberCauldron;
    n.boltPoints.forEach(([x, y], i) => {
      drawBoltFine(ctx, mp, P(x, y, FX_HIT_Z), n.boltSeed + i * 5, u, '#ff8a2a', '#ff8a2a', '#fff3c0', ui.reduced);
    });
  } else if (kind === 'soulfireObelisk' && n.beam > 0) {
    drawSoulThin(ctx, mp, P(n.beamEnd[0], n.beamEnd[1], FX_HIT_Z), n.beam / FX_OBELISK_BEAM_SECONDS, clock, ui.reduced);
  }
}

/** Position of the big rocket: a high curve that leaves along the tubes and falls on the end point of the shell. */
function bigRocketPosition(launch, shell, u) {
  const P0 = [launch.x, launch.y, launch.z];
  const P2 = [shell.to.x, shell.to.y, 4];
  const d = Math.hypot(P2[0] - P0[0], P2[1] - P0[1]);
  const reach = d * 0.45;
  const P1 = [P0[0] + launch.dir[0] * reach, P0[1] + launch.dir[1] * reach, P0[2] + launch.dir[2] * reach * K + 40 + d * 10];
  const a = (1 - u) * (1 - u);
  const b = 2 * (1 - u) * u;
  const c = u * u;
  return [0, 1, 2].map((i) => a * P0[i] + b * P1[i] + c * P2[i]);
}

/**
 * The shells in flight. Today's side as the game does it, before the particles; the proposal's rockets
 * after them (`late`), so their own smoke trail does not cover them.
 */
function drawShells(dt, late = false) {
  for (const s of scene.shells) {
    if ((s.owner.side === 'neu') !== late) continue;
    const rec = s.owner;
    curSide = rec.side;
    if (rec.side === 'heute') {
      if (!shownSides().includes('heute')) continue;
      const launch = launchOf(s, rec.tower);
      if (!launch) continue;
      if (rec.tower.special) drawShell(ctx, launch, s);
      else {
        drawRocket(ctx, launch, s);
        for (const spec of rocketTrail(launch, s, dt)) addParticle(spec);
      }
      continue;
    }
    if (!shownSides().includes('neu') || !s.launch) continue;
    const u = Math.min(1, s.t / s.flight);
    const pos = s.big ? bigRocketPosition(s.launch, s, u) : rocketPosition(s.launch, s, u);
    const before = s.big ? bigRocketPosition(s.launch, s, Math.max(0, u - 0.03)) : rocketPosition(s.launch, s, Math.max(0, u - 0.04 / s.flight));
    const a = P(pos[0], pos[1], pos[2]);
    const b = P(before[0], before[1], before[2]);
    const l = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
    const flick = ui.reduced ? 1 : 0.85 + 0.15 * Math.sin(clock * 40);
    if (s.big) {
      const g = P(s.to.x, s.to.y);
      drawImpactZone(ctx, g[0], g[1], s.splash * 32 * Math.SQRT2, u);
      ell(ctx, P(pos[0], pos[1])[0], P(pos[0], pos[1])[1], 6, 2.8, 'rgba(10,6,4,.28)', null);
    }
    drawRocketBody(ctx, a[0], a[1], (a[0] - b[0]) / l, (a[1] - b[1]) / l, s.big ? NEU.bigRocket : NEU.rocket, DOCTRINE_COLORS.mortar, flick);
    s.trail = (s.trail ?? 0) - dt;
    let guard = 3;
    while (s.trail <= 0 && guard-- > 0) {
      s.trail += s.big ? 0.03 : FX_ROCKET.trail;
      addParticle({ kind: 'wsmoke', x: before[0], y: before[1], z: before[2], vx: 0, vy: 0, vz: 8, r0: s.big ? 4 : 2.5, r1: s.big ? 12 : 8, tone: 0, life: s.big ? 1.1 : 0.8, floor: 0 });
    }
    if (s.trail < 0) s.trail = 0;
  }
}

function drawBooms() {
  for (const b of scene.booms) {
    if (!shownSides().includes(b.side)) continue;
    const u = 1 - b.life / b.max;
    const [x, y] = P(b.x, b.y);
    const R = b.r * 32 * 0.7;
    ctx.globalAlpha = Math.max(0, 1 - u);
    ell(ctx, x, y, R * (0.3 + 0.7 * Math.sqrt(u)), R * (0.3 + 0.7 * Math.sqrt(u)) * 0.5, null, '#ffb13b', 2.4);
    const r = R * 0.45 * (0.5 + 0.5 * u);
    const col = u < 0.25 ? '#fff3b0' : u < 0.5 ? '#ffb13b' : '#e2531f';
    ell(ctx, x, y - r * 0.6, r, r * 0.85, col, INK, 1.6);
    ctx.globalAlpha = 1;
  }
}

function drawParticles() {
  const sides = shownSides();
  for (const p of scene.particles) {
    if (!sides.includes(p.side)) continue;
    const u = 1 - p.life / p.max;
    if (p.kind === 'ntracer') {
      const a = P(p.x0, p.y0, p.z0);
      const b = P(p.x1, p.y1, p.z1);
      drawTracerFixed(ctx, a, b, u, p.colour, p.core);
    } else {
      drawWorldParticle(ctx, p, u);
    }
  }
}

function stepParticles(dt) {
  for (let i = scene.particles.length - 1; i >= 0; i--) {
    const p = scene.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.particles.splice(i, 1);
      continue;
    }
    if (p.kind !== 'ntracer') stepWorldParticle(p, dt);
  }
}

function render(dt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1c1410';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const [cx, cy] = cameraCentre();
  const s = ui.zoom * view.dpr;
  ctx.setTransform(s, 0, 0, s, canvas.width / 2 - cx * s, canvas.height / 2 - cy * s);
  drawGround();
  // Entities by depth: the emplacements and their targets.
  const items = [];
  for (const side of shownSides()) {
    const rec = scene.towers[side];
    items.push({ key: rec.tower.x + rec.tower.y + 1, draw: () => (side === 'heute' ? drawHeute(rec, dt) : ((rec.dtFrame = dt), drawNeu(rec))), side });
    for (const e of scene.targets[side]) items.push({ key: e.x + e.y, draw: () => drawTarget(e), side });
  }
  items.sort((a, b) => a.key - b.key);
  for (const it of items) it.draw();
  // Above everything: shells, reach that runs towards the camera, particles, explosions, the reticle.
  for (const side of shownSides()) {
    const rec = scene.towers[side];
    if (side === 'heute' || weaponByKind[rec.kind].same) drawTowerReach(ctx, rec.tower, clock);
    else if (rec.front) drawReachNeu(rec);
  }
  drawShells(dt);
  drawParticles();
  drawShells(dt, true);
  drawBooms();
  const rn = scene.towers.neu;
  if (shownSides().includes('neu') && rn.kind === 'siegeMortar') {
    const q = siegeAim(rn);
    if (q > 0 && rn.tower.aim) {
      const [x, y] = P(rn.tower.aim.x, rn.tower.aim.y);
      drawReticle(ctx, x, y - 4, q, clock, ui.reduced);
    }
  }
  for (const side of shownSides()) drawLabel(side);
}

// ======================================================================================
// Sound
// ======================================================================================

let audio = null;
const lastPlayed = new Map();
function audioOut() {
  if (!audio) {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const master = actx.createGain();
    master.gain.value = 0.55;
    master.connect(actx.destination);
    audio = { actx, master };
  }
  if (audio.actx.state === 'suspended') audio.actx.resume();
  return audio;
}

function play(name, sound) {
  const a = audioOut();
  const now = a.actx.currentTime;
  const last = lastPlayed.get(name) ?? -1;
  if (sound.throttle && now - last < sound.throttle) return;
  lastPlayed.set(name, now);
  playSound(a.actx, a.master, sound);
}

/** The sound of a shot in the loop, from the side that is switched on. */
function sound(rec, events) {
  if (ui.sound === 'aus' || ui.sound !== rec.side || !audio || ui.paused) return;
  const type = events[0]?.type;
  if (type === 'launch') {
    if (rec.side === 'neu') play(rec.kind === 'siegeMortar' ? 'rocketHeavy' : 'rocket', ROCKET_SOUNDS[rec.kind === 'siegeMortar' ? 'rocketHeavy' : 'rocket']);
    else play('launch', SOUNDS.launch);
  } else if (type && SOUNDS[type]) {
    play(type, SOUNDS[type]);
  }
}

// ======================================================================================
// Scale and cost (points 1 and the performance estimate)
// ======================================================================================

/** Today's sizes, read from src/render/towerFx.js (the numbers are literals there). */
const HEUTE = {
  laser: { ink: 12, colour: 7.5, core: 3.1, src: 'drawBeam: 10u+2, 6,5u+1, 2,6u+0,5' },
  soul: { ink: 14, colour: 8.4, core: 1.6, src: 'drawSoulBeam: 11u+3, 7u+1,4, 3,4u+0,6, 1,3u+0,3' },
  tesla: { ink: 6.2, colour: 2.6, core: 1, jitter: 24, src: 'drawBolt/bolt: Breite 2,6, Tusche +3,6, Zacken 24' },
  thunder: { ink: 6.4, colour: 2.8, core: 1.1, jitter: 22, src: 'drawChain: Breite 2,8, Zacken 22' },
  ember: { ink: 6.2, colour: 2.6, core: 1, jitter: 20, src: 'drawEmberBolts: Breite 2,6, Zacken 20' },
  tracer: { ink: 4, colour: 2.2, core: 1, share: 0.28, src: 'wtracer: 4, 2,2, 1; 28 % der Strecke' },
  rocket: { ink: 6.4, body: 3.6, tail: 10, warhead: 5.6, src: 'drawRocket: 6,4/3,6, Schweif 10, Kopf r 2,8' },
  shell: { ball: 10.8, src: 'drawShell: Kugel r 5,4' },
  scope: { ink: 4.2, colour: 1.9, core: 0.7, src: 'drawScope: 4,2, 1,9, 0,7' },
};

/** Pixels on screen at zoom 1 for one cell, along a cell axis, towards the camera, across the screen. */
const PX_AXIS = Math.hypot(32, 16);
const PX_TOWARDS = 32 / Math.SQRT2;
const PX_ACROSS = 64 / Math.SQRT2;

const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '–');

function scaleRows() {
  const bunker = towerPictureBox({ x: 0, y: 0, doctrine: 'laser', rank: 3 });
  const special = towerPictureBox({ x: 0, y: 0, doctrine: 'mortar', rank: 3, special: 'siegeMortar' });
  const bunkerW = bunker[2] - bunker[0];
  const specialW = special[2] - special[0];
  // Round bodies show SOLID_K px per cell of radius in the iso view.
  const lensD = 2 * 0.105 * TURRET_SCALE * K;
  const noseD = 2 * 0.04 * TURRET_SCALE * K;
  const podTubeD = 2 * 0.056 * TURRET_SCALE * K;
  const siegeTubeD = 2 * 0.078 * specialScale('siegeMortar') * K;
  const rtTubeD = 2 * RT.tubeR * specialScale('siegeMortar') * K;
  const rtNoseD = 2 * RT.noseR * specialScale('siegeMortar') * K;
  const laserRange = DOCTRINES.laser.range;
  const typical = 2.8;
  const rows = [
    ['Feld (Raute)', '64 breit', '', '64 breit', '', 'Bezug'],
    ['Standardbunker (Bild)', `${fmt(bunkerW)} breit`, '', `${fmt(bunkerW)} breit`, '', '1'],
    ['Spezialbasis (Bild)', `${fmt(specialW)} breit`, '', `${fmt(specialW)} breit`, '', '1'],
    ['Laserwaffe, Linse', `${fmt(lensD)} Ø`, '', `${fmt(lensD)} Ø`, '', `${fmt(lensD / bunkerW, 2)}`],
    ['Laserstrahl', `${fmt(HEUTE.laser.ink)} / ${fmt(HEUTE.laser.colour)} / ${fmt(HEUTE.laser.core)}`, `${fmt(laserRange * PX_AXIS, 0)} (volle Reichweite ${fmt(laserRange)} Felder; ${fmt(laserRange * PX_TOWARDS, 0)} bis ${fmt(laserRange * PX_ACROSS, 0)} je Richtung)`, `${fmt(NEU.laser.ink)} / ${fmt(NEU.laser.colour)} / ${fmt(NEU.laser.core)}; Rest ${fmt(NEU.laser.rest.width)} bei ${Math.round(NEU.laser.rest.alpha * 100)} %`, `hell ${fmt((typical + NEU.laser.past) * PX_AXIS, 0)} (Ziel in ${fmt(typical)} Feldern + ${fmt(NEU.laser.past, 2)}), Rest blass`, `${fmt(HEUTE.laser.ink / bunkerW, 2)} → ${fmt(NEU.laser.ink / bunkerW, 2)}`],
    ['Seelenstrahl (Obelisk)', `${fmt(HEUTE.soul.ink)} / ${fmt(HEUTE.soul.colour)} / ${fmt(HEUTE.soul.core)}`, 'bis zum Ziel', `${fmt(NEU.soul.ink + 1)} / ${fmt(NEU.soul.violet)} / ${fmt(NEU.soul.core)}`, 'bis zum Ziel', `${fmt(HEUTE.soul.ink / specialW, 2)} → ${fmt((NEU.soul.ink + 1) / specialW, 2)}`],
    ['Tesla-Blitz', `${fmt(HEUTE.tesla.ink)} / ${fmt(HEUTE.tesla.colour)} / ${fmt(HEUTE.tesla.core)}, Zacken ±${fmt(HEUTE.tesla.jitter / 2)}`, 'bis zum Ziel', `${fmt(NEU.bolt.ink + NEU.bolt.colour)} / ${fmt(NEU.bolt.colour)} / ${fmt(NEU.bolt.core)}, Zacken ±${fmt(NEU.bolt.jitter * 0.67)}; Aura ${fmt(NEU.bolt.aura[0].width)} und ${fmt(NEU.bolt.aura[1].width)} halbtransparent`, 'bis zum Ziel', `${fmt(HEUTE.tesla.ink / bunkerW, 2)} → ${fmt((NEU.bolt.ink + NEU.bolt.colour) / bunkerW, 2)}`],
    ['Gewitterturm, je Sprung', `${fmt(HEUTE.thunder.ink)} / ${fmt(HEUTE.thunder.colour)} / ${fmt(HEUTE.thunder.core)}`, 'Sprung bis 1,8 Felder', 'wie Tesla neu', 'Sprung bis 1,8 Felder', `${fmt(HEUTE.thunder.ink / specialW, 2)} → ${fmt((NEU.bolt.ink + NEU.bolt.colour) / specialW, 2)}`],
    ['Glutkessel-Blitz', `${fmt(HEUTE.ember.ink)} / ${fmt(HEUTE.ember.colour)} / ${fmt(HEUTE.ember.core)}`, 'bis zum Ziel', 'wie Tesla neu, in Glut', 'bis zum Ziel', `${fmt(HEUTE.ember.ink / specialW, 2)} → ${fmt((NEU.bolt.ink + NEU.bolt.colour) / specialW, 2)}`],
    ['Leuchtspur (Autokanone, Sturmbatterie)', `${fmt(HEUTE.tracer.ink)} / ${fmt(HEUTE.tracer.colour)} / ${fmt(HEUTE.tracer.core)}`, `28 % der Strecke (bei ${fmt(typical)} Feldern ${fmt(typical * PX_AXIS * HEUTE.tracer.share, 0)})`, `${fmt(NEU.tracer.ink)} / ${fmt(NEU.tracer.colour)} / ${fmt(NEU.tracer.core)}`, `fest ${fmt(NEU.tracer.length * 32, 0)} (${fmt(NEU.tracer.length)} Felder)`, `${fmt(HEUTE.tracer.ink / bunkerW, 2)} → ${fmt(NEU.tracer.ink / bunkerW, 2)}`],
    ['Rakete im Rohr (Raketenwerfer)', `Nase ${fmt(noseD)} Ø, Rohr ${fmt(podTubeD)} Ø`, '', 'unverändert', '', ''],
    ['Rakete im Flug (Raketenwerfer)', `${fmt(HEUTE.rocket.ink)} dick (Stahl ${fmt(HEUTE.rocket.body)}), Kopf ${fmt(HEUTE.rocket.warhead)} Ø`, `${fmt(HEUTE.rocket.tail + 6)} mit Flamme`, `${fmt(NEU.rocket.ink)} dick (Stahl ${fmt(NEU.rocket.body)}), Kopf ${fmt(NEU.rocket.warhead * 2)} Ø`, `${fmt(NEU.rocket.tail + 5)} mit Flamme`, `${fmt(HEUTE.rocket.ink / podTubeD, 2)} → ${fmt(NEU.rocket.ink / podTubeD, 2)} des Rohrs`],
    ['Belagerungsmörser, Geschoss', `Granate ${fmt(HEUTE.shell.ball)} Ø, Rohr ${fmt(siegeTubeD)} Ø`, 'hoher Bogen', `Rakete ${fmt(NEU.bigRocket.ink)} dick, Kopf ${fmt(NEU.bigRocket.warhead * 2)} Ø; Rohr ${fmt(rtTubeD)} Ø, Nase ${fmt(rtNoseD)} Ø`, `${fmt(NEU.bigRocket.tail + 9)} mit Flamme, Bogen`, `${fmt(HEUTE.shell.ball / siegeTubeD, 2)} → ${fmt(NEU.bigRocket.ink / rtTubeD, 2)} des Rohrs`],
    ['Belagerungsmörser, Zielen', `Laserlinie ${fmt(HEUTE.scope.ink)} / ${fmt(HEUTE.scope.colour)} / ${fmt(HEUTE.scope.core)}`, `bis zum Ziel (${fmt(3.6 * PX_AXIS, 0)} bei 3,6 Feldern)`, `Zielsucher am Ziel, Radius ${fmt(NEU.reticle.from, 0)} → ${fmt(NEU.reticle.to, 0)}`, 'keine Linie', ''],
    ['Feueraura (neu)', '–', '', `Radius ${Object.values(NEU.aura).map((a) => a.r).join(', ')} (Autokanone … Obelisk)`, `${fmt(Math.min(...Object.values(NEU.aura).map((a) => a.s)), 2)} bis ${fmt(Math.max(...Object.values(NEU.aura).map((a) => a.s)), 2)} s`, ''],
  ];
  return { rows, bunkerW, specialW };
}

/** Faces of the siege weapon today and of the new launcher, as built from the model (stage cost). */
function faceCounts() {
  const F = turnFrame(Math.PI / 4, SPECIAL_MOUNT_Z, specialScale('siegeMortar'));
  const today = faceList(buildSpecial('siegeMortar', F, specialRestPose(DOCTRINE_COLORS.mortar), 'all').parts).length;
  const neu = faceList(buildRocketTower(F, rtPose(DOCTRINE_COLORS.mortar)).parts).length;
  const box = weaponBox('siegeMortar');
  return { today, neu, height: -box[1] };
}

function buildTable() {
  const { rows } = scaleRows();
  const fc = faceCounts();
  const head = '<tr><th>Effekt</th><th>heute Breite (Tusche / Farbe / Kern)</th><th>heute Länge</th><th>neu Breite</th><th>neu Länge</th><th>Breite zur Stellung</th></tr>';
  const body = rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<th>${c}</th>`)).join('')}</tr>`).join('');
  document.getElementById('table').innerHTML = `
    <h2>Maßstab bei Zoom 1 (Weltpixel)</h2>
    <p>Längen entlang einer Feldachse (${fmt(PX_AXIS)} px je Feld); zur Kamera hin ${fmt(PX_TOWARDS)}, quer ${fmt(PX_ACROSS)} px je Feld.</p>
    <table>${head}${body}</table>
    <h2>Kosten</h2>
    <p>Belagerungsmörser als Modell: heute ${fc.today} Flächen, neu ${fc.neu} Flächen (vor dem Teilen langer Flächen). Ruhend kommt er wie heute aus dem Stufen-Cache; neu sind die zwei Raketen eine eigene, live gezeichnete Ebene, solange ein Rohr nachlädt (wie Ring und Kugel des Gewitterturms).</p>
    <p>Effekte je Schuss (stroke und fill): Feueraura +2 je Schuss; Laser 4 → 6; Tesla je Sprung 4 (erster 7) → 8; Gewitterturm mit 8 Sprüngen 35 → 64; Leuchtspur 3 → 3; Rakete im Flug 5 → 6; Zielen des Belagerungsmörsers 6 → 9 (vier Klammern), dazu Einschlagzone 2. Alles Ebenen über der Stufe, kein Stufen-Cache betroffen außer dem neuen Modell des Belagerungsmörsers.</p>`;
}

// ======================================================================================
// Interface
// ======================================================================================

const $ = (id) => document.getElementById(id);

function setWeapon(kind) {
  sheetHold = false;
  ui.weapon = kind;
  scene = newScene(kind);
  refresh();
}

function refresh() {
  for (const w of WEAPONS) $(`w-${w.kind}`)?.classList.toggle('on', w.kind === ui.weapon);
  for (const v of ['beide', 'heute', 'neu']) $(`v-${v}`).classList.toggle('on', ui.view === v);
  for (const z of [0.5, 1, 2]) $(`z-${String(z).replace('.', '')}`).classList.toggle('on', ui.zoom === z);
  for (const s of ['aus', 'heute', 'neu']) $(`s-${s}`).classList.toggle('on', ui.sound === s);
  $('pause').textContent = ui.paused ? 'Weiter' : 'Pause';
  $('reduced').classList.toggle('on', ui.reduced);
  $('scale').classList.toggle('on', ui.table);
  $('table').hidden = !ui.table;
  const w = weaponByKind[ui.weapon];
  $('note').textContent = `${w.label}: ${w.change}`;
}

function buildUi() {
  const row = $('weapons');
  WEAPONS.forEach((w, i) => {
    if (i === 6) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      row.append(sep);
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.id = `w-${w.kind}`;
    b.textContent = w.label;
    b.className = 'dot';
    b.style.setProperty('--dot', DOCTRINE_COLORS[isSpecial(w.kind) ? SPECIALS[w.kind].doctrine : w.kind]);
    b.addEventListener('click', () => setWeapon(w.kind));
    row.append(b);
  });
  for (const v of ['beide', 'heute', 'neu']) $(`v-${v}`).addEventListener('click', () => ((ui.view = v), refresh()));
  for (const z of [0.5, 1, 2]) {
    $(`z-${String(z).replace('.', '')}`).addEventListener('click', async () => {
      ui.zoom = z;
      refresh();
      await cache.preload(allTowerDefs(), ui.zoom, view.dpr);
    });
  }
  for (const s of ['aus', 'heute', 'neu']) {
    $(`s-${s}`).addEventListener('click', () => {
      ui.sound = s;
      if (s !== 'aus') audioOut();
      refresh();
    });
  }
  $('pause').addEventListener('click', () => ((ui.paused = !ui.paused), refresh()));
  $('step').addEventListener('click', () => {
    ui.paused = true;
    simStep(STEP);
    stepParticles(STEP);
    render(STEP);
    refresh();
  });
  $('restart').addEventListener('click', () => setWeapon(ui.weapon));
  $('speed').addEventListener('input', (e) => {
    ui.speed = Number(e.target.value);
    $('speed-out').textContent = `${Math.round(ui.speed * 100)} %`;
  });
  $('reduced').addEventListener('click', () => ((ui.reduced = !ui.reduced), refresh()));
  $('scale').addEventListener('click', () => ((ui.table = !ui.table), refresh()));
  $('snd-heute').addEventListener('click', () => play('launch', SOUNDS.launch));
  $('snd-neu').addEventListener('click', () => play('rocket', ROCKET_SOUNDS.rocket));
  $('snd-schwer').addEventListener('click', () => play('rocketHeavy', ROCKET_SOUNDS.rocketHeavy));
}

// ======================================================================================
// Loop
// ======================================================================================

let last = performance.now();
/** True while the contact sheet is on the canvas: the loop leaves it alone until the next weapon is picked. */
let sheetHold = false;
function frame(now) {
  const real = Math.min(0.1, (now - last) / 1000);
  last = now;
  let dt = 0;
  if (!ui.paused) {
    acc += real * ui.speed;
    while (acc >= STEP) {
      acc -= STEP;
      simStep(STEP);
      dt += STEP;
      if (clock >= LOOP * 2) {
        scene = newScene(ui.weapon);
        dt = 0;
        break;
      }
    }
    stepParticles(dt);
  }
  if (!sheetHold) render(dt);
  $('clock').textContent = `${fmt(clock, 2)} s`;
  requestAnimationFrame(frame);
}

/** Hooks for the stills (tests/tools are not touched; the study's own Playwright script uses these). */
window.__waffen = {
  ready: false,
  /** Shows weapon `kind` at study time `t`, re-run from the start in fixed steps; then holds still. */
  seek(kind, t, opts = {}) {
    Object.assign(ui, opts);
    ui.paused = true;
    scene = newScene(kind);
    ui.weapon = kind;
    refresh();
    const n = Math.round(t / STEP);
    for (let i = 0; i < n; i++) {
      simStep(STEP);
      stepParticles(STEP);
      render(STEP);
    }
    render(0);
    return clock;
  },
  /**
   * Runs weapon `kind` from the start until the emplacement on the right has fired after `from` seconds,
   * then `after` seconds more, and holds still: a still of a shot, whatever the fire rate.
   */
  seekShot(kind, from, after, opts = {}) {
    Object.assign(ui, opts);
    ui.paused = true;
    scene = newScene(kind);
    ui.weapon = kind;
    refresh();
    let shotAt = -1;
    for (let i = 0; i < LOOP * 2 * 60; i++) {
      const before = scene.towers.neu.tower.cooldown;
      simStep(STEP);
      stepParticles(STEP);
      render(STEP);
      if (shotAt < 0 && clock >= from && scene.towers.neu.tower.cooldown > before + 1e-6) shotAt = clock;
      if (shotAt >= 0 && clock >= shotAt + after - 1e-9) break;
    }
    render(0);
    return clock;
  },
  /**
   * A contact sheet of the siege weapon in eight directions: today's model on top, the new launcher below
   * (one rocket loaded, one half way, seeker lit), on the special base, at `zoom`.
   */
  modelSheet(zoom = 2) {
    ui.paused = true;
    sheetHold = true;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1c1410';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const s = zoom * view.dpr;
    const colW = canvas.width / s / 8;
    const tw = { x: 0, y: 0, doctrine: 'mortar', rank: 3, special: 'siegeMortar' };
    const set = towerSet(tw);
    const back = cache.get(set.back, zoom, view.dpr);
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 8; i++) {
        const theta = (i * Math.PI) / 4;
        const gx = colW * (i + 0.5);
        const gy = 150 + row * 170;
        ctx.setTransform(s, 0, 0, s, gx * s, gy * s);
        ell(ctx, 0, 0, 34, 17, 'rgba(232,200,114,.08)', null);
        if (back) drawSprite(ctx, set.back, back, 0, 0);
        const F = turnFrame(theta, SPECIAL_MOUNT_Z, specialScale('siegeMortar'));
        if (row === 0) renderSolids(ctx, buildSpecial('siegeMortar', F, specialRestPose(DOCTRINE_COLORS.mortar), 'all').parts);
        else renderSolids(ctx, buildRocketTower(F, { ...rtPose(DOCTRINE_COLORS.mortar), load: [1, i % 2 ? 0.5 : 1], seek: 1 }).parts);
      }
    }
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.font = '20px Bangers, Impact, sans-serif';
    ctx.fillStyle = '#e8c872';
    ctx.textAlign = 'left';
    ctx.fillText('HEUTE: Belagerungsmörser', 16, 40);
    ctx.fillText('NEU: Raketenturm (Arbeitstitel), jede zweite Richtung mit halb geladenem Rohr', 16, 40 + 170 * zoom);
  },
  /** Seconds until the next shot of the weapon of `side`, for picking the moment of a still. */
  cooldown: (side = 'neu') => scene.towers[side].tower.cooldown,
  preload: (zoom) => cache.preload(allTowerDefs(), zoom, view.dpr),
  scaleRows: () => scaleRows(),
  faceCounts: () => faceCounts(),
  sounds: ROCKET_SOUNDS,
};

buildUi();
buildTable();
setWeapon(ui.weapon);
cache.preload(allTowerDefs(), ui.zoom, view.dpr).then(() => {
  window.__waffen.ready = true;
  requestAnimationFrame(frame);
});
