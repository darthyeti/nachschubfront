// Towers: a bunker sprite with a weapon on its roof.
//
// The bunker is a sprite from the concept art. The weapon of a doctrine tower is a turnable model
// (turrets.js) that faces its target: it turns at a speed of the drawing, stands on one of 16
// cached stages while it is not turning and is drawn from its model only in between
// (turretCache.js, M9 D2). The weapons of the recipe emplacements are still sprites of their own,
// mirrored towards the target (docs/ART.md: static parts from the SVG, movement in code). Recoil,
// barrel wobble and the glows that used to be painted into the artwork live here too.

import { iso } from './iso.js';
import { cellLift, liftAt } from './terrain.js';
import { ell } from './draw.js';
import { C } from './palette.js';
import { drawSprite, drawSpriteShadow, drawSpriteTurned, spriteOrigin } from './sprites/rasterizer.js';
import { towerSpriteSet, specialSpriteSet, nextFlip, DOCTRINES, SPECIALS } from './sprites/compose.js';
import { RANK_COUNT } from './sprites/manifest.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { TURRET_TURN_SPEED, TURRET_ALIGN, TURRET_REST_ANGLE, TURRET_RECOIL, TURRET_ROCKET } from '../data/art.js';
import { drawWeaponGlow, drawWeaponSpark, updateTurretFx, drawTurretFx } from './towerFx.js';
import { turnFrame, renderSolids } from './model.js';
import { buildTurret, muzzleOffset, autocannonBores, restPose, MOUNT_Z, TURRET_SCALE, TURRET_DOCTRINES } from './turrets.js';
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

/** True for the towers whose weapon is a turned model: every standard emplacement. */
export const isTurreted = (tower) => !tower.special && TURRET_DOCTRINES.includes(tower.doctrine);

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
 *
 * A weapon that aims has no fixed anchor: its muzzle is the point, and it moves,
 * so the live angle is used. Everything else falls back to the middle of the
 * cell, which is what the effects used before M5c.
 *
 * @returns {number[]} screen point in the same space as iso()
 */
export function towerAnchor(tower) {
  const set = towerSet(tower);
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
  if (isTurreted(tower)) {
    // The muzzle of the model, in the direction it is drawn facing now.
    const m = motion.get(tower);
    const off = muzzleOffset(tower.doctrine, m?.shown ?? TURRET_REST_ANGLE, { ...restPose('#fff'), tube: m?.tube ?? 0 });
    return [sx + off[0], sy + off[1]];
  }
  if (!set.weapon?.tip) return [sx, sy];
  return topPoint(tower, set, set.weapon.tip);
}

/**
 * A point of the weapon top on screen. Tops are mirrored towards the target
 * rather than turned (docs/ART.md), so a point on the left of the figure ends
 * up on its right when the emplacement is shooting the other way.
 */
function topPoint(tower, set, [px, py]) {
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
  const scale = set.gun.unitScale;
  const [ox, oy] = spriteOrigin(set.gun, sx, sy);
  const flip = motion.get(tower)?.flip ? -1 : 1;
  return [ox + px * scale * flip, oy + py * scale];
}

/**
 * The several points an effect can leave from, e.g. the cauldron's four
 * electrodes. Empty when the emplacement has only the one anchor.
 */
export function towerSparks(tower) {
  const set = towerSet(tower);
  const sparks = set.weapon?.sparks;
  if (!sparks) return [];
  return sparks.map((point) => topPoint(tower, set, point));
}

/** Every distinct tower sprite, e.g. for preloading the gallery (layers are shared). */
export function allTowerDefs() {
  const byKey = new Map();
  const add = (set) => {
    for (const def of [set.back, set.gun, set.front]) if (def) byKey.set(def.key, def);
  };
  // The weapons of the doctrines are models, not sprites: only the bunkers are rastered.
  for (const doctrine of DOCTRINES) {
    for (let rank = 1; rank <= RANK_COUNT; rank++) {
      const set = towerSet({ doctrine, rank });
      byKey.set(set.back.key, set.back);
    }
  }
  for (const special of SPECIALS) add(towerSet({ special }));
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

/** Unit vector on screen from the emplacement towards what it shoots at. */
function fireDirection(tower, ox, oy) {
  if (!tower.aim) return [0, 1];
  // The target may stand higher or lower than the emplacement; the figure is drawn on its own field.
  const [ax, ay] = iso(tower.aim.x, tower.aim.y, 10 + liftAt(tower.aim.x, tower.aim.y) - cellLift(tower.x, tower.y));
  const len = Math.hypot(ax - ox, ay - oy) || 1;
  return [(ax - ox) / len, (ay - oy) / len];
}

/**
 * Keeps the top facing the target and works off the recoil.
 *
 * Nothing here is read by the simulation; a shot is recognised by the reload
 * counter jumping back up. Since v5 no top turns: they are drawn facing left
 * and mirrored when the target is on the other side, like an enemy is
 * (docs/ART.md). What still moves is the recoil and the wobble of a barrel
 * cluster while it fires.
 */
function updateMotion(tower, set, dt) {
  let m = motion.get(tower);
  if (!m) {
    m = { flip: false, recoil: 0, spin: 0, cooldown: tower.cooldown };
    motion.set(tower, m);
  }
  const weapon = set.weapon;
  if (!weapon) return m;

  if (tower.cooldown > m.cooldown + 1e-6) m.recoil = 1;
  m.cooldown = tower.cooldown;
  m.recoil = Math.max(0, m.recoil - dt * 7);
  if (weapon.spin && (m.recoil > 0 || tower.firing)) m.spin += dt * 26;

  if (tower.aim) {
    // Screen x grows with the cell's x and shrinks with its y, so the side the
    // target is on follows from the difference of the two, with a dead zone so
    // a target straight ahead does not make the figure flicker.
    const dx = tower.aim.x - (tower.x + 0.5);
    const dy = tower.aim.y - (tower.y + 0.5);
    m.flip = nextFlip(m.flip, dx, dy);
  }
  return m;
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
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
  if (isTurreted(tower)) return drawTurretTower(ctx, cache, set, back, tower, zoom, dpr, t, dt, reducedMotion);

  const weapon = set.weapon;
  const scale = set.back.unitScale;
  const m = updateMotion(tower, set, dt);
  // The silhouette of the socket and of the top, in the pose the top stands in at rest.
  drawSpriteShadow(ctx, set.back, back, sx, sy);
  const gunEntry = set.gun && cache.get(set.gun, zoom, dpr);
  if (gunEntry) drawSpriteShadow(ctx, set.gun, gunEntry, sx, sy, { flip: m.flip });
  const flash = (tower.flash ?? 0) > 0;
  drawSprite(ctx, set.back, back, sx, sy, { flash });

  // The roof plate the top stands on, and the point its effect leaves from.
  const [ox, oy] = spriteOrigin(set.gun ?? set.back, sx, sy);
  const muzzle = weapon?.tip ? topPoint(tower, set, weapon.tip) : [ox, oy];
  const view = {
    doctrine: tower.doctrine,
    origin: [ox, oy],
    pivot: [ox, oy],
    muzzle,
    ports: null,
    glow: weapon?.glow ?? null,
    // Where the effect starts on the figure; the idle sparks use it too, so the
    // thunder tower crackles at its coil and not around the core above it.
    anchor: muzzle,
    sparks: weapon?.sparks ? towerSparks(tower) : null,
    sight: Boolean(weapon?.sight),
    casings: Boolean(weapon?.casings),
    fire: fireDirection(tower, ox, oy),
    shot: m.recoil,
    scale,
    t,
    reducedMotion,
  };
  drawWeaponGlow(ctx, tower, view);

  const gun = gunEntry;
  if (gun) {
    if (weapon?.float) {
      // The psi rings and the shrine's artefact hover instead of sitting still.
      const bob = reducedMotion ? 0 : Math.sin(t * 2 + tower.x) * 2;
      drawSpriteTurned(ctx, set.gun, gun, sx, sy - bob * scale, [0, 0], 0, { flip: m.flip, flash });
    } else {
      // Recoil pushes the top back along the line it fires on, the wobble of a
      // barrel cluster runs across it.
      const push = (weapon?.recoil ?? 0) * m.recoil;
      const wobble = weapon?.spin && (m.recoil > 0 || tower.firing) ? Math.sin(m.spin) * weapon.spin : 0;
      const offset = [push, wobble];
      drawSpriteTurned(ctx, set.gun, gun, sx, sy, [0, 0], 0, { flip: m.flip, offset, flash });
    }
  }

  drawWeaponSpark(ctx, tower, view);
  return true;
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
 * The drawing turns at TURRET_TURN_SPEED towards the point the tower last aimed at (`tower.aim`,
 * set by the simulation, never changed here); without a target it keeps the direction it had.
 * A shot is recognised, as ever, by the reload counter jumping back up. Nothing here is read by the
 * simulation.
 */
function updateTurret(tower, dt) {
  let m = motion.get(tower);
  if (!m) {
    m = {
      theta: TURRET_REST_ANGLE,
      shown: TURRET_REST_ANGLE,
      aligned: true,
      recoil: 0,
      spin: 0,
      // The tube of the rocket launcher that fired last, and the one that fires next: the six
      // tubes go off one after the other in the order of TURRET_ROCKET.mouths.
      tube: 0,
      next: 0,
      shot: false,
      cooldown: tower.cooldown,
    };
    motion.set(tower, m);
  }
  m.shot = tower.cooldown > m.cooldown + 1e-6;
  if (m.shot) {
    m.recoil = 1;
    m.tube = m.next;
    m.next = (m.next + 1) % TURRET_ROCKET.mouths.length;
  }
  m.cooldown = tower.cooldown;
  m.recoil = Math.max(0, m.recoil - dt * 7);
  if (tower.doctrine === 'autocannon' && (m.recoil > 0 || tower.firing)) m.spin += dt * 26;

  let want = m.theta;
  if (tower.aim) want = Math.atan2(tower.aim.y - (tower.y + 0.5), tower.aim.x - (tower.x + 0.5));
  // A long frame (a hidden tab) must not make the weapon whip round.
  const step = (TURRET_TURN_SPEED[tower.doctrine] ?? 4) * Math.min(dt, 0.1);
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
 * A standard emplacement: the bunker, and on its roof the weapon facing its target.
 *
 * A weapon that points at its target (or has none) stands on its cached stage, the nearest of 16
 * directions. One that is still turning is drawn from its model every frame. Firing alone changes
 * neither: the recoil shifts the stage along the barrel, the bores of the autocannon turn over it,
 * the muzzle light and the glows are layers on top.
 */
function drawTurretTower(ctx, cache, set, back, tower, zoom, dpr, t, dt, reducedMotion) {
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
  const doctrine = tower.doctrine;
  const m = updateTurret(tower, dt);
  const flash = (tower.flash ?? 0) > 0;
  const psi = doctrine === 'psi';

  // The stages the weapon is nearest to; they carry the shadow even while it is drawn live.
  const k = stageIndex(m.theta);
  const layers = psi ? ['base', 'float'] : ['all'];
  const entries = layers.map((layer) => stageEntry(doctrine, tower.rank, layer, k, zoom, dpr));
  const staged = m.aligned && entries.every(Boolean);
  m.shown = staged ? k * STAGE_STEP : m.theta;
  m.staged = staged;
  const bob = psi && !reducedMotion ? Math.sin(t * 2 + tower.x) * 2 : 0;
  const shift = staged ? recoilShift(m.shown, TURRET_RECOIL[doctrine] * m.recoil) : [0, 0];

  drawSpriteShadow(ctx, set.back, back, sx, sy);
  for (const entry of entries) if (entry) drawStageShadow(ctx, entry, sx, sy);
  drawSprite(ctx, set.back, back, sx, sy, { flash });

  const pose = { ...restPose(DOCTRINE_COLORS[doctrine], tower.rank), recoil: staged ? 0 : m.recoil, spin: m.spin, bob, tube: m.tube };
  const F = turnFrame(m.shown, MOUNT_Z, TURRET_SCALE);

  // The fire at the barrel (towerFx.js): its muzzle is the one of the model. What reaches away from the
  // camera is drawn behind the weapon, the lights at the muzzle over it. All of it is a layer on top of
  // the stage: firing never makes the stage be drawn again.
  updateTurretFx(tower, {
    dt,
    shot: m.shot,
    tube: m.tube,
    shown: m.shown,
    theta: m.theta,
    push: staged ? TURRET_RECOIL[doctrine] * m.recoil : 0,
    recoil: staged ? 0 : m.recoil,
    bob,
    t,
    reducedMotion,
  });
  drawTurretFx(ctx, tower, 'behind');

  towerDraw[staged ? 'staged' : 'live'] += 1;
  if (staged) {
    entries.forEach((entry, i) => {
      // The hovering rings of the psi weapon bob over a pedestal that stands still.
      const lift = layers[i] === 'float' ? [0, -bob] : null;
      drawStage(ctx, entry, sx, sy, { shift: lift ? [shift[0] + lift[0], shift[1] + lift[1]] : shift, flash });
    });
  } else {
    ctx.save();
    ctx.translate(sx, sy);
    renderSolids(ctx, buildTurret(doctrine, F, pose).parts);
    ctx.restore();
  }

  if (doctrine === 'autocannon') drawBores(ctx, autocannonBores(m.shown, m.spin, staged ? 0 : m.recoil), sx + shift[0], sy + shift[1]);
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
