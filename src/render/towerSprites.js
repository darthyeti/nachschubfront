// Towers drawn from concept-art sprites in three layers: everything behind the
// weapon, the weapon itself and what covers it from the front.
//
// The weapon is a sprite of its own and is turned towards the target in code
// (docs/ART.md: static parts from the SVG, movement in code). Recoil, barrel
// wobble and the glows that used to be painted into the artwork live here too.

import { iso } from './iso.js';
import { shadow, ell } from './draw.js';
import { C } from './palette.js';
import { drawSprite, drawSpriteTurned, spriteOrigin } from './sprites/rasterizer.js';
import { towerSpriteSet, specialSpriteSet, DOCTRINES, SPECIALS } from './sprites/compose.js';
import { RANK_COUNT } from './sprites/manifest.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { drawWeaponGlow, drawWeaponSpark, drawRankMarks } from './towerFx.js';

const sets = new Map();
/** Render-side movement of each weapon; forgotten with the tower it belongs to. */
const motion = new WeakMap();

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
  const weapon = set.weapon;
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
  if (!weapon) return [sx, sy];
  const scale = set.back.unitScale;
  const [ox, oy] = spriteOrigin(set.back, sx, sy);
  if (weapon.muzzle !== undefined && weapon.rest !== undefined) {
    // The tube swings, so the mouth is wherever it points right now.
    const m = motion.get(tower);
    const angle = m ? (m.flip ? Math.PI - (weapon.rest + m.angle) : weapon.rest + m.angle) : weapon.rest;
    const pivot = [ox + weapon.pivot[0] * scale, oy + weapon.pivot[1] * scale];
    return [pivot[0] + Math.cos(angle) * weapon.muzzle * scale, pivot[1] + Math.sin(angle) * weapon.muzzle * scale];
  }
  const anchor = weapon.anchor ?? weapon.pivot;
  if (!anchor) return [sx, sy];
  return [ox + anchor[0] * scale, oy + anchor[1] * scale];
}

/**
 * The several points an effect can leave from, e.g. the cauldron's four
 * electrodes. Empty when the emplacement has only the one anchor.
 */
export function towerSparks(tower) {
  const set = towerSet(tower);
  const sparks = set.weapon?.sparks;
  if (!sparks) return [];
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
  const scale = set.back.unitScale;
  const [ox, oy] = spriteOrigin(set.back, sx, sy);
  return sparks.map(([ax, ay]) => [ox + ax * scale, oy + ay * scale]);
}

/** Every distinct tower sprite, e.g. for preloading the gallery (layers are shared). */
export function allTowerDefs() {
  const byKey = new Map();
  const add = (set) => {
    for (const def of [set.back, set.gun, set.front]) if (def) byKey.set(def.key, def);
  };
  for (const doctrine of DOCTRINES) {
    for (let rank = 1; rank <= RANK_COUNT; rank++) add(towerSet({ doctrine, rank }));
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
  const [ax, ay] = iso(tower.aim.x, tower.aim.y, 10);
  const len = Math.hypot(ax - ox, ay - oy) || 1;
  return [(ax - ox) / len, (ay - oy) / len];
}

/**
 * Turns the weapon towards the target and works off the recoil.
 * Nothing here is read by the simulation; a shot is recognised by the reload
 * counter jumping back up.
 */
function updateMotion(tower, set, dt, pivotScreen) {
  let m = motion.get(tower);
  if (!m) {
    m = { angle: 0, flip: false, recoil: 0, spin: 0, cooldown: tower.cooldown };
    motion.set(tower, m);
  }
  const weapon = set.weapon;
  if (!weapon) return m;

  // A shot is recognised by the reload counter jumping back up; the bunkers
  // have no barrel to push back, but their ports flash on the same beat.
  if (tower.cooldown > m.cooldown + 1e-6) m.recoil = 1;
  m.cooldown = tower.cooldown;
  m.recoil = Math.max(0, m.recoil - dt * 7);

  // Only weapons with a pose in the artwork can be aimed.
  if (weapon.rest === undefined) return m;
  if (weapon.spin && (m.recoil > 0 || tower.firing)) m.spin += dt * 26;

  if (tower.aim) {
    const [ax, ay] = iso(tower.aim.x, tower.aim.y, 10);
    const screen = Math.atan2(ay - pivotScreen[1], ax - pivotScreen[0]);
    // The artwork points left, so a target on the right side is drawn mirrored.
    const cos = Math.cos(screen);
    if (cos > 0.1) m.flip = true;
    else if (cos < -0.1) m.flip = false;
    const aimed = m.flip ? Math.PI - screen : screen;
    const wanted = angleDelta(0, aimed - weapon.rest) * (weapon.track ?? 1);
    m.angle += angleDelta(m.angle, wanted) * Math.min(1, dt * (weapon.turn ?? 8));
  }
  return m;
}

/**
 * Draws a tower record { x, y, doctrine, rank, special?, flash? } on its cell.
 * @param {number} dt  Real seconds since the last frame, for the weapon movement.
 * @returns {boolean} false if the sprite is not rasterized yet.
 */
export function drawTowerSprite(ctx, cache, tower, zoom, dpr, t = 0, dt = 0, reducedMotion = false) {
  const set = towerSet(tower);
  const back = cache.get(set.back, zoom, dpr);
  if (!back) return false;
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
  shadow(ctx, sx + 6, sy + 4, 34, 15, 0.28);

  const weapon = set.weapon;
  const scale = set.back.unitScale;
  const [ox, oy] = spriteOrigin(set.back, sx, sy);
  const pivot = weapon ? [ox + weapon.pivot[0] * scale, oy + weapon.pivot[1] * scale] : [sx, sy];
  const m = updateMotion(tower, set, dt, pivot);

  const flash = (tower.flash ?? 0) > 0;
  drawSprite(ctx, set.back, back, sx, sy, { flash });

  // Where the weapon points on screen right now, for flames, glows and arcs.
  const rest = weapon?.rest ?? 0;
  const facing = m.flip ? Math.PI - (rest + m.angle) : rest + m.angle;
  const muzzle = weapon?.muzzle
    ? [pivot[0] + Math.cos(facing) * weapon.muzzle * scale, pivot[1] + Math.sin(facing) * weapon.muzzle * scale]
    : pivot;
  // A recipe emplacement keeps the doctrine of its first ingredient for colour
  // and glow, but its weapon data is its own.
  // The bunkers fire out of their ports instead of a muzzle, leaning
  // towards the target because nothing about them turns (docs/ART.md).
  const ports = weapon?.ports
    ? weapon.ports.map(([ex, ey]) => [ox + ex * scale, oy + ey * scale])
    : null;
  const view = {
    doctrine: tower.doctrine,
    origin: [ox, oy],
    pivot,
    muzzle,
    ports,
    glow: weapon?.glow ?? null,
    // Where the effect starts on the figure; the idle sparks use it too, so the
    // thunder tower crackles at its coil and not around the core above it.
    anchor: weapon?.anchor ? [ox + weapon.anchor[0] * scale, oy + weapon.anchor[1] * scale] : null,
    sparks: weapon?.sparks ? weapon.sparks.map(([ax, ay]) => [ox + ax * scale, oy + ay * scale]) : null,
    sight: Boolean(weapon?.sight),
    casings: Boolean(weapon?.casings),
    fire: fireDirection(tower, ox, oy),
    shot: m.recoil,
    scale,
    t,
    reducedMotion,
  };
  // Banner and halo stand behind the weapon, so the figure covers the pole.
  drawRankMarks(ctx, {
    rank: set.rank,
    colour: DOCTRINE_COLORS[tower.doctrine] ?? C.gold,
    origin: [ox, oy],
    scale,
    t,
    reducedMotion,
  });
  drawWeaponGlow(ctx, tower, view);

  const gun = set.gun && cache.get(set.gun, zoom, dpr);
  if (gun) {
    if (weapon.float) {
      // The psi crystal hovers instead of aiming.
      const bob = reducedMotion ? 0 : Math.sin(t * 2 + tower.x) * 3;
      drawSprite(ctx, set.gun, gun, sx, sy - bob * scale, { flash });
    } else {
      // Recoil pushes along the barrel, the wobble of a barrel cluster across it.
      const push = -(weapon.recoil ?? 0) * m.recoil;
      const wobble = weapon.spin && (m.recoil > 0 || tower.firing) ? Math.sin(m.spin) * weapon.spin : 0;
      const [ax, ay] = [Math.cos(weapon.rest), Math.sin(weapon.rest)];
      const offset = [ax * push - ay * wobble, ay * push + ax * wobble];
      drawSpriteTurned(ctx, set.gun, gun, sx, sy, weapon.pivot, m.angle, { flip: m.flip, offset, flash });
    }
  }

  const front = set.front && cache.get(set.front, zoom, dpr);
  if (front) drawSprite(ctx, set.front, front, sx, sy, { flash });

  drawWeaponSpark(ctx, tower, view);
  return true;
}
