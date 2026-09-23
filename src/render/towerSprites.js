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
import { towerSpriteSet, DOCTRINES } from './sprites/compose.js';
import { RANK_COUNT } from './sprites/manifest.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { drawWeaponGlow, drawWeaponSpark, drawRankMarks } from './towerFx.js';

const sets = new Map();
/** Render-side movement of each weapon; forgotten with the tower it belongs to. */
const motion = new WeakMap();

/** Sprite set for a doctrine and rank (cached, cheap to call per frame). */
export function towerSet(doctrine, rank) {
  const key = `${doctrine}:${rank}`;
  let set = sets.get(key);
  if (!set) {
    set = towerSpriteSet(doctrine, rank);
    sets.set(key, set);
  }
  return set;
}

/** Every distinct tower sprite, e.g. for preloading the gallery (layers are shared). */
export function allTowerDefs() {
  const byKey = new Map();
  for (const doctrine of DOCTRINES) {
    for (let rank = 1; rank <= RANK_COUNT; rank++) {
      const set = towerSet(doctrine, rank);
      for (const def of [set.back, set.gun, set.front]) if (def) byKey.set(def.key, def);
    }
  }
  return [...byKey.values()];
}

/** Rank whose sprite a tower uses; special towers borrow the legend artwork. */
export function spriteRank(tower) {
  return tower.special ? RANK_COUNT : tower.rank;
}

/** Shortest way from angle a to angle b, in [-PI, PI]. */
export function angleDelta(a, b) {
  return ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

/**
 * Placeholder look for special towers until they get their own concept art
 * (M4): a glowing ring and halo in the leading ingredient's guide colour.
 */
function specialHalo(ctx, sx, sy, color, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 2);
  ell(ctx, sx, sy, 30, 15, `rgba(242,193,78,.16)`, C.gold, 2.5);
  ctx.save();
  ctx.globalAlpha = 0.25 + pulse * 0.15;
  ell(ctx, sx, sy - 54, 26, 26, color, null);
  ctx.globalAlpha = 0.5;
  ell(ctx, sx, sy - 54, 26, 26, null, color, 2);
  ctx.restore();
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
  // Only weapons with a pose in the artwork can be aimed.
  if (!weapon || weapon.rest === undefined) return m;

  if (tower.cooldown > m.cooldown + 1e-6) m.recoil = 1;
  m.cooldown = tower.cooldown;
  m.recoil = Math.max(0, m.recoil - dt * 7);
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
  const set = towerSet(tower.doctrine, spriteRank(tower));
  const back = cache.get(set.back, zoom, dpr);
  if (!back) return false;
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
  shadow(ctx, sx + 6, sy + 4, 34, 15, 0.28);
  if (tower.special) specialHalo(ctx, sx, sy, DOCTRINE_COLORS[tower.doctrine], t);

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
  const view = { doctrine: tower.doctrine, pivot, muzzle, scale, t, reducedMotion };
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
