// Towers: a bunker sprite with a turned weapon on its roof.
//
// The bunker (or, for a recipe emplacement, the special base) is a sprite from the concept art. The
// weapon is a turnable model (turrets.js for the six doctrines, specials.js for the six recipes, both
// reached through weapons.js) that faces its target: it turns at a speed of the drawing, stands on one
// of 16 cached stages while it is not turning and is drawn from its model only in between
// (turretCache.js, M9 D2 and D4). Recoil, rotating barrels, floating parts and the fire at the barrel
// are layers over the stage (towerFx.js).

import { iso } from './iso.js';
import { ell } from './draw.js';
import { C } from './palette.js';
import { drawSprite, drawSpriteShadow } from './sprites/rasterizer.js';
import { towerSpriteSet, specialSpriteSet, DOCTRINES, SPECIALS } from './sprites/compose.js';
import { RANK_COUNT } from './sprites/manifest.js';
import { TURRET_ALIGN, TURRET_REST_ANGLE, SPECIAL_BAR_DECAY, SPECIAL_RECOIL_DECAY, FX_SIGHT_SECONDS } from '../data/art.js';
import { updateTurretFx, drawTurretFx } from './towerFx.js';
import { turnFrame, renderSolids } from './model.js';
import { autocannonBores } from './turrets.js';
import { siegeLoadAt } from './specials.js';
import { weaponOf, weaponBox, weaponMuzzle } from './weapons.js';
import { stageEntry, stageIndex, STAGE_STEP, drawStage, drawStageShadow } from './turretCache.js';

const sets = new Map();
/**
 * Render-side movement of each weapon, including the direction the drawing of a turned weapon
 * faces. It is not part of the game state, is never saved or recorded, and is forgotten with the
 * tower it belongs to.
 */
const motion = new WeakMap();

/**
 * What drawing the emplacements has cost so far (ms and calls), and how many of the turned weapons
 * came from a stage and how many from the model. The browser checks read it to tell the drawing time
 * of the emplacements from the rest of the frame.
 */
export const towerDraw = { ms: 0, calls: 0, staged: 0, live: 0 };

/** True for the towers whose weapon is a turned model: every emplacement, standard or recipe. */
export const isTurreted = (tower) => weaponOf(tower) !== null;

/** Sprite set of an emplacement: doctrine and rank, or a recipe emplacement. */
export function towerSet(tower) {
  const key = tower.special ?? `${tower.doctrine}:${tower.rank}`;
  let set = sets.get(key);
  if (!set) {
    set = tower.special ? specialSpriteSet(tower.special) : towerSpriteSet(tower.doctrine, tower.rank);
    sets.set(key, set);
  }
  return set;
}

/**
 * Where an emplacement's effect starts on screen (docs/ART.md, "Wirkungsanker").
 * The simulation always works from the middle of the cell; this is only what the
 * drawing hangs off, so a chain leaves the coil and not a point in mid-air.
 * It is the muzzle of the model of the weapon, in the direction the weapon is drawn facing now.
 *
 * @returns {number[]} screen point in the same space as iso()
 */
export function towerAnchor(tower) {
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
  const model = weaponOf(tower);
  const m = motion.get(tower);
  const off = weaponMuzzle(model.kind, m?.shown ?? TURRET_REST_ANGLE, { ...model.restPose('#fff', 3), tube: m?.tube ?? 0 });
  return [sx + off[0], sy + off[1]];
}

/**
 * The box of an emplacement's picture as `[x0, y0, x1, y1]` in world pixels, relative to the middle
 * of its field on the ground: socket and top together. The weapon of a recipe emplacement counts with
 * the area it covers whichever way it faces; the top of a standard one is the sprite of its doctrine.
 */
export function towerPictureBox(tower) {
  const set = towerSet(tower);
  let half = 0;
  let top = 0;
  let bottom = 0;
  for (const def of [set.back, set.gun, set.front]) {
    if (!def) continue;
    const s = def.unitScale;
    const [bx, by, bw, bh] = def.bbox;
    half = Math.max(half, Math.abs(bx * s), Math.abs((bx + bw) * s));
    top = Math.min(top, by * s - def.anchorZ);
    bottom = Math.max(bottom, (by + bh) * s - def.anchorZ);
  }
  if (tower.special) {
    const [x0, y0, x1, y1] = weaponBox(tower.special);
    half = Math.max(half, Math.abs(x0), Math.abs(x1));
    top = Math.min(top, y0);
    bottom = Math.max(bottom, y1);
  }
  return [-half, top, half, bottom];
}

/** Every distinct tower sprite, e.g. for preloading the gallery (layers are shared). */
export function allTowerDefs() {
  const byKey = new Map();
  // The weapons are models, not sprites: only the bunkers and the special bases are rastered.
  for (const doctrine of DOCTRINES) {
    for (let rank = 1; rank <= RANK_COUNT; rank++) {
      const set = towerSet({ doctrine, rank });
      byKey.set(set.back.key, set.back);
    }
  }
  for (const special of SPECIALS) {
    const set = towerSet({ special });
    byKey.set(set.back.key, set.back);
  }
  return [...byKey.values()];
}

/** Shortest way from angle a to angle b, in [-PI, PI]. */
export function angleDelta(a, b) {
  return ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

/**
 * A recipe emplacement stands in a golden ring on the ground.
 *
 * Drawn by the caller in the ground pass, never together with the emplacement
 * itself: the ellipse reaches past the diagonals of its own ground diamond, so
 * inside the depth-sorted loop it landed on the sockets of the two neighbours
 * already on the canvas (docs/ART.md, "Goldener Bodenring").
 */
export function drawSpecialRing(ctx, tower) {
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
  ell(ctx, sx, sy, 30, 15, 'rgba(242,193,78,.16)', C.gold, 2.5);
}

/**
 * Draws a tower record { x, y, doctrine, rank, special?, flash? } on its cell.
 * @param {number} dt  Real seconds since the last frame, for the weapon movement.
 * @returns {boolean} false if the sprite is not rasterized yet.
 */
export function drawTowerSprite(ctx, cache, tower, zoom, dpr, t = 0, dt = 0, reducedMotion = false) {
  const start = performance.now();
  const drawn = drawTower(ctx, cache, tower, zoom, dpr, t, dt, reducedMotion);
  towerDraw.ms += performance.now() - start;
  towerDraw.calls += 1;
  return drawn;
}

function drawTower(ctx, cache, tower, zoom, dpr, t, dt, reducedMotion) {
  const set = towerSet(tower);
  const back = cache.get(set.back, zoom, dpr);
  if (!back) return false;
  return drawTurretTower(ctx, cache, set, back, tower, zoom, dpr, t, dt, reducedMotion);
}

/**
 * How a turned weapon is drawn right now: the direction it has turned to, the direction it is shown
 * in (a stage while it stands, the live angle while it turns) and whether it comes from a stage.
 * Null before its first frame. For the browser checks and the tests.
 */
export function turretView(tower) {
  const m = motion.get(tower);
  return m && 'staged' in m ? { theta: m.theta, shown: m.shown, aligned: m.aligned, staged: m.staged } : null;
}

/**
 * Keeps the direction a turned weapon is drawn in, and what moves on it.
 *
 * The drawing turns at the turn speed of its weapon (art.js) towards the point the tower last aimed at
 * (`tower.aim`, set by the simulation, never changed here); without a target it keeps the direction it had.
 * A shot is recognised, as ever, by the reload counter jumping back up. Nothing here is read by the
 * simulation.
 */
function updateTurret(tower, model, dt, reducedMotion) {
  let m = motion.get(tower);
  if (!m) {
    m = {
      theta: TURRET_REST_ANGLE,
      shown: TURRET_REST_ANGLE,
      aligned: true,
      recoil: 0,
      spin: 0,
      gyro: 0.6,
      // The tube or barrel that fired last, and the one that fires next: the six tubes of the rocket
      // launcher and the four barrels of the storm battery go off one after the other.
      tube: 0,
      next: 0,
      // Recoil of each of the four barrels of the storm battery.
      bar: [0, 0, 0, 0],
      shot: false,
      cooldown: tower.cooldown,
      // The rocket tower: the reload time of the last shot, the load of each rocket (1 ready) and whether
      // the scope is aiming. Read from the reload counter like the shot, never reported by the simulation.
      reload: 0,
      load: [1, 1],
      seek: 0,
    };
    motion.set(tower, m);
  }
  m.shot = tower.cooldown > m.cooldown + 1e-6;
  if (m.shot) {
    m.recoil = 1;
    m.tube = m.next;
    m.next = (m.next + 1) % model.tubes;
    if (model.kind === 'stormBattery') m.bar[m.tube] = 1;
    m.reload = tower.cooldown;
  }
  if (model.kind === 'siegeMortar') {
    // The rocket that left is empty and is loaded over the reload; the other waits ready. A tower seen
    // for the first time has both.
    m.seek = tower.aim && tower.cooldown > 0 && tower.cooldown < FX_SIGHT_SECONDS ? 1 : 0;
    const prog = m.reload > 0 ? 1 - tower.cooldown / m.reload : 1;
    m.load = model.tubes ? Array.from({ length: model.tubes }, (_, k) => (k === m.tube && m.reload > 0 ? siegeLoadAt(prog) : 1)) : m.load;
  }
  m.cooldown = tower.cooldown;
  m.recoil = Math.max(0, m.recoil - dt * SPECIAL_RECOIL_DECAY);
  for (let k = 0; k < m.bar.length; k++) m.bar[k] = Math.max(0, m.bar[k] - dt * SPECIAL_BAR_DECAY);
  if (model.kind === 'autocannon' && (m.recoil > 0 || tower.firing)) m.spin += dt * 26;
  // The rings and the sparks round a floating part turn faster while it works.
  if (!reducedMotion) m.gyro += dt * (m.recoil > 0 || tower.firing ? 3.4 : 1.2);

  let want = m.theta;
  if (tower.aim) want = Math.atan2(tower.aim.y - (tower.y + 0.5), tower.aim.x - (tower.x + 0.5));
  // A long frame (a hidden tab) must not make the weapon whip round.
  const step = (model.turnSpeed ?? 4) * Math.min(dt, 0.1);
  m.theta += Math.max(-step, Math.min(step, angleDelta(m.theta, want)));
  if (m.theta > Math.PI) m.theta -= Math.PI * 2;
  else if (m.theta < -Math.PI) m.theta += Math.PI * 2;
  m.aligned = Math.abs(angleDelta(m.theta, want)) < TURRET_ALIGN;
  return m;
}

/** Screen offset of a push of `cells` back along the barrel of a weapon facing `theta`. */
function recoilShift(theta, cells) {
  const x = -cells * Math.cos(theta);
  const y = -cells * Math.sin(theta);
  return [(x - y) * 32, (x + y) * 16];
}

/**
 * An emplacement: the bunker or special base, and on its roof the weapon facing its target.
 *
 * A weapon that points at its target (or has none) stands on its cached stage, the nearest of 16
 * directions. One that is still turning is drawn from its model every frame, as is the shrine, whose
 * artefact hovers between the pillars, and the storm battery and the siege mortar while their barrels
 * slide back. Firing alone changes none of it: the recoil of a standard weapon shifts the stage along the
 * barrel, the bores of the autocannon turn over it, the floating parts of the thunder tower and the obelisk
 * are a layer of their own over it, the muzzle light and the glows are layers on top.
 */
function drawTurretTower(ctx, cache, set, back, tower, zoom, dpr, t, dt, reducedMotion) {
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
  const model = weaponOf(tower);
  const kind = model.kind;
  const m = updateTurret(tower, model, dt, reducedMotion);
  const flash = (tower.flash ?? 0) > 0;
  const rank = tower.special ? 0 : tower.rank;

  // The stages the weapon is nearest to; they carry the shadow even while it is drawn live.
  const k = stageIndex(m.theta);
  // The rocket tower rests as one stage; while a rocket is loaded or the scope aims it takes the stage
  // without them and draws them live over it.
  const resting = model.settled && m.seek === 0 && m.load.every((u) => u >= 1);
  const layers = resting ? model.settled : model.staged;
  const liveLayers = resting ? [] : model.live;
  const entries = layers.map((layer) => stageEntry(kind, rank, layer, k, zoom, dpr));
  const recoiling = model.recoilLive && (m.recoil > 0.01 || m.bar.some((b) => b > 0.01));
  const staged = m.aligned && !model.always && !recoiling && entries.every(Boolean);
  m.shown = staged ? k * STAGE_STEP : m.theta;
  m.staged = staged;
  const bob = model.bobs && !reducedMotion ? Math.sin(t * 2 + tower.x) * 2 : 0;
  const push = staged ? model.recoil * m.recoil : 0;
  const shift = recoilShift(m.shown, push);

  drawSpriteShadow(ctx, set.back, back, sx, sy);
  for (const entry of entries) if (entry) drawStageShadow(ctx, entry, sx, sy);
  drawSprite(ctx, set.back, back, sx, sy, { flash });

  const pose = {
    ...model.restPose(model.accent, rank),
    recoil: staged ? 0 : m.recoil,
    spin: m.spin,
    bob,
    tube: m.tube,
    gyro: m.gyro,
    bar: m.bar,
    load: m.load,
    seek: m.seek,
  };

  // The fire at the barrel (towerFx.js): its muzzle is the one of the model. What reaches away from the
  // camera is drawn behind the weapon, the lights at the muzzle over it. All of it is a layer on top of
  // the stage: firing never makes the stage be drawn again.
  const fx = updateTurretFx(tower, {
    dt,
    shot: m.shot,
    tube: m.tube,
    shown: m.shown,
    theta: m.theta,
    push,
    recoil: pose.recoil,
    bar: m.bar,
    bob,
    t,
    reducedMotion,
  });
  // The eye of the obelisk lights up while it charges and fires.
  pose.glow = fx.glow;
  drawTurretFx(ctx, tower, 'behind');

  const F = turnFrame(m.shown, model.mount, model.scale);
  towerDraw[staged ? 'staged' : 'live'] += 1;
  if (staged) {
    entries.forEach((entry, i) => {
      // The hovering rings of the psi weapon bob over a pedestal that stands still.
      const lift = layers[i] === 'float' ? [0, -bob] : null;
      drawStage(ctx, entry, sx, sy, { shift: lift ? [shift[0] + lift[0], shift[1] + lift[1]] : shift, flash });
    });
    // The floating parts that are drawn live over the stage: ring and ball, eye.
    for (const layer of liveLayers) {
      ctx.save();
      ctx.translate(sx, sy);
      renderSolids(ctx, model.build(F, pose, layer).parts);
      ctx.restore();
    }
  } else {
    ctx.save();
    ctx.translate(sx, sy);
    renderSolids(ctx, model.build(F, pose, 'all').parts);
    ctx.restore();
  }

  if (kind === 'autocannon') drawBores(ctx, autocannonBores(m.shown, m.spin, staged ? 0 : m.recoil), sx + shift[0], sy + shift[1]);
  drawTurretFx(ctx, tower, 'front');
  return true;
}

/** The six bores at the muzzle end of the autocannon, turning with the barrel cluster. */
function drawBores(ctx, { points, facing }, ox, oy) {
  if (!facing) return;
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  for (const [px, py] of points) {
    ctx.moveTo(ox + px + 1, oy + py);
    ctx.arc(ox + px, oy + py, 1, 0, Math.PI * 2);
  }
  ctx.fill();
}
