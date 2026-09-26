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
import { towerSpriteSet, specialSpriteSet, nextFlip, DOCTRINES, SPECIALS } from './sprites/compose.js';
import { RANK_COUNT } from './sprites/manifest.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { drawWeaponGlow, drawWeaponSpark } from './towerFx.js';

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
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
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
  const set = towerSet(tower);
  const back = cache.get(set.back, zoom, dpr);
  if (!back) return false;
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
  shadow(ctx, sx + 6, sy + 4, 34, 15, 0.28);

  const weapon = set.weapon;
  const scale = set.back.unitScale;
  const m = updateMotion(tower, set, dt);
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

  const gun = set.gun && cache.get(set.gun, zoom, dpr);
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
