// Pure sprite logic without DOM access: sprite definitions (SVG text + bounds),
// raster level choice and enemy facing. Unit-tested in node.

import { seedFromString } from '../../core/random.js';
import { ENEMY_SPRITES } from './enemies.js';
import { TOWER_SPRITES } from './towers.js';
import { POD_SPRITES } from './pods.js';
import {
  SPRITE_SCALE,
  TOWER_BASE_TOP,
  ALL_ENEMY_SYMBOLS,
  ENEMY_EXTRA_SCALE,
  DOCTRINE_SYMBOLS,
  SPECIAL_SYMBOLS,
  ENEMY_LIMBS,
  OWN_SANDBAGS,
  SHARED_SANDBAGS,
  VETERAN_CRATE,
  PLATE_SPOT,
  TOWER_WEAPONS,
  RANK_COUNT,
  POD_PETALS,
  POD_PETAL_ORDER,
  POD_OPEN_SCALE,
} from './manifest.js';

/** Raster levels relative to camera zoom (times devicePixelRatio). 2.5 is the max zoom. */
export const RASTER_LEVELS = [0.5, 1, 2, 2.5];

/** Smallest level that is at least as sharp as the current zoom; the largest level beyond that. */
export function pickLevel(zoom, levels = RASTER_LEVELS) {
  for (const level of levels) if (level >= zoom * 0.98) return level;
  return levels[levels.length - 1];
}

/**
 * Enemies are drawn facing left and mirrored when moving right on screen.
 * The dead zone keeps near-vertical movement from flickering between both sides.
 * @param {boolean} flipped  Current state.
 * @param {number} dx  Heading in grid x.
 * @param {number} dy  Heading in grid y.
 */
export function nextFlip(flipped, dx, dy, deadZone = 0.2) {
  const screenDx = dx - dy; // iso: screen x grows with x and shrinks with y
  if (screenDx > deadZone) return true;
  if (screenDx < -deadZone) return false;
  return flipped;
}

function union(boxes) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y, w, h] of boxes) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + w);
    y1 = Math.max(y1, y + h);
  }
  return [x0, y0, x1 - x0, y1 - y0];
}

function svgDocument(library, body, bbox, pixelScale) {
  const [x, y, w, h] = bbox;
  const pw = Math.max(1, Math.ceil(w * pixelScale));
  const ph = Math.max(1, Math.ceil(h * pixelScale));
  // Explicit pixel size: browsers (notably Safari) rasterize SVG images at their intrinsic
  // size, so it must match the target resolution to stay sharp.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${pw}" height="${ph}">` +
    `<style>${library.style}</style><defs>${library.defs}</defs>${body}</svg>`
  );
}

/** Rank chevrons on the base's left front face (ART.md): count = rank, gold at the top rank. */
export function chevronMarkup(rank) {
  const gold = rank >= RANK_COUNT;
  const fill = gold ? '#f2c14e' : '#e8dcc0';
  // Local frame of the left face: x runs along the top edge (slope 0.5), y points down.
  // The hazard stripe occupies y 8-13, so the chevrons sit in the band above it.
  let marks = '';
  for (let i = 0; i < rank; i++) {
    const x = 5 + i * 7.6;
    const points = `${x},6.6 ${x + 3.2},2.6 ${x + 6.4},6.6`;
    marks +=
      `<polyline points="${points}" fill="none" stroke="#1a1410" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<polyline points="${points}" fill="none" stroke="${fill}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return `<g transform="matrix(1 0.5 0 1 -44 0)">${marks}</g>`;
}

/** Rank at which each detail from docs/ART.md appears. */
export const RANK_DETAIL = { ring: 2, crate: 2, plates: 3, banner: 4, gold: 5 };

/**
 * Elite armour plates on the weapon: a plate across the barrel, a third of the
 * way to the muzzle, so it reads on every doctrine without its own artwork.
 * Doctrines whose weapon does not aim get it at a fixed spot on the housing.
 */
export function plateMarkup(doctrine) {
  const weapon = TOWER_WEAPONS[doctrine];
  const spot = PLATE_SPOT[doctrine];
  const [cx, cy, ax, ay, size] = spot
    ? [spot[0], spot[1], 1, 0, 13]
    : [
        weapon.pivot[0] + Math.cos(weapon.rest) * weapon.muzzle * 0.32,
        weapon.pivot[1] + Math.sin(weapon.rest) * weapon.muzzle * 0.32,
        Math.cos(weapon.rest),
        Math.sin(weapon.rest),
        weapon.muzzle * 0.17,
      ];
  // Across the axis, a little longer than wide.
  const px = -ay * size;
  const py = ax * size;
  const lx = ax * size * 0.42;
  const ly = ay * size * 0.42;
  const corner = (sx, sy) => `${(cx + px * sx + lx * sy).toFixed(1)},${(cy + py * sx + ly * sy).toFixed(1)}`;
  const points = `${corner(1, 1)} ${corner(1, -1)} ${corner(-1, -1)} ${corner(-1, 1)}`;
  const edge = `${corner(1, -1)} ${corner(-1, -1)}`;
  return (
    `<polygon class="k2" points="${points}" fill="#6a655e"/>` +
    `<polyline points="${edge}" fill="none" stroke="#a8a195" stroke-width="2" stroke-linecap="round"/>`
  );
}

/** Legend rank: gold edging along the top face of the base. */
export function goldEdgeMarkup() {
  return (
    '<polygon points="0,-22 44,0 0,22 -44,0" fill="none" stroke="#f2c14e" stroke-width="2.4" ' +
    'stroke-linejoin="round" opacity="0.9"/>' +
    '<polyline points="-44,0 0,22 44,0" fill="none" stroke="#fff0b8" stroke-width="1.2" stroke-linejoin="round"/>'
  );
}

/**
 * The three layers of an emplacement, back to front: everything behind the weapon,
 * the weapon itself (turned in code, may be missing) and what covers it from the front.
 * @param {string} doctrine  Key of DOCTRINE_SYMBOLS.
 * @param {number} rank  1 (recruit) to 5 (legend).
 * @returns {{back: string[], gun: string[]|null, front: string[]|null}}
 */
export function towerLayers(doctrine, rank) {
  const body = DOCTRINE_SYMBOLS[doctrine];
  if (!body) throw new Error(`Unknown doctrine: ${doctrine}`);
  if (!(rank >= 1 && rank <= RANK_COUNT)) throw new Error(`Invalid rank: ${rank}`);
  // Sandbags: from veteran on, or always where the concept art expects them.
  const ring = SHARED_SANDBAGS.has(doctrine) || (rank >= RANK_DETAIL.ring && !OWN_SANDBAGS.has(doctrine));
  const has = (id) => Boolean(TOWER_SPRITES.symbols[id]);
  // Veteran: a sandbag ring, or a crate where the ring is already part of the artwork.
  const crate = rank >= RANK_DETAIL.crate ? VETERAN_CRATE[doctrine] : null;
  const front = [
    ...(ring ? ['sb-front'] : []),
    ...(has(`${body}-front`) ? [`${body}-front`] : []),
    ...(crate ? [crate] : []),
  ];
  return {
    back: ['base', ...(ring ? ['sb-back'] : []), `${body}-back`],
    gun: has(`${body}-gun`) ? [`${body}-gun`] : null,
    front: front.length ? front : null,
  };
}

/**
 * A sprite definition: everything the rasterizer needs, plus placement data.
 * The SVG origin sits on the entity's ground position, lifted by `anchorZ` world pixels.
 * @typedef {{key: string, bbox: number[], unitScale: number, anchorZ: number, svg: (pixelScale: number) => string}} SpriteDef
 */

/** One symbol of the brood as a sprite definition, in the size the type is drawn at. */
function enemyPart(type, symbol, key) {
  const entry = ENEMY_SPRITES.symbols[symbol];
  if (!entry) throw new Error(`Unknown enemy symbol: ${symbol}`);
  return {
    key,
    bbox: entry.bbox,
    // Bosses share the symbol of a normal enemy but are drawn larger, so the
    // scale is part of the key via the type.
    unitScale: SPRITE_SCALE.enemy * (ENEMY_EXTRA_SCALE[type] ?? 1),
    anchorZ: 0,
    svg: (pixelScale) => svgDocument(ENEMY_SPRITES, `<use href="#${symbol}"/>`, entry.bbox, pixelScale),
  };
}

/** The whole creature in one piece: concept sheets, gallery, and creatures without limbs. */
export function enemySprite(type) {
  const id = ALL_ENEMY_SYMBOLS[type];
  if (!id) throw new Error(`Unknown enemy type: ${type}`);
  return enemyPart(type, id, `enemy:${type}`);
}

/**
 * How a creature is drawn: either in one piece, or as far limbs, body and near
 * limbs with the movement data for the limbs.
 * @returns {{whole?: object, back?: object, body?: object, front?: object, limbs: object|null}}
 */
export function enemySpriteSet(type) {
  const id = ALL_ENEMY_SYMBOLS[type];
  if (!id) throw new Error(`Unknown enemy type: ${type}`);
  const limbs = ENEMY_LIMBS[id] ?? null;
  if (!limbs) return { whole: enemySprite(type), limbs: null };
  return {
    back: enemyPart(type, `${id}-back`, `enemy:${type}:back`),
    body: enemyPart(type, `${id}-body`, `enemy:${type}:body`),
    front: enemyPart(type, `${id}-front`, `enemy:${type}:front`),
    limbs,
  };
}

/**
 * One layer of an emplacement as a sprite definition. The key is made from the
 * parts, so layers that are the same at several ranks share one raster.
 */
function towerPart(ids, extra = '') {
  const bbox = union(ids.map((id) => TOWER_SPRITES.symbols[id].bbox));
  const body = ids.map((id) => `<use href="#${id}"/>`).join('') + extra;
  return {
    key: `tower:${ids.join('+')}${extra ? `+${seedFromString(extra).toString(36)}` : ''}`,
    bbox,
    unitScale: SPRITE_SCALE.tower,
    // The symbol origin is the centre of the base's top face, TOWER_BASE_TOP units above ground.
    anchorZ: TOWER_BASE_TOP * SPRITE_SCALE.tower,
    svg: (pixelScale) => svgDocument(TOWER_SPRITES, body, bbox, pixelScale),
  };
}

/**
 * Every sprite an emplacement is drawn from, plus how its weapon moves.
 * @returns {{back: object, gun: object|null, front: object|null, weapon: object|null}}
 */
export function towerSpriteSet(doctrine, rank) {
  const layers = towerLayers(doctrine, rank);
  const plates = rank >= RANK_DETAIL.plates ? plateMarkup(doctrine) : '';
  const onGun = Boolean(layers.gun) && !PLATE_SPOT[doctrine];
  const backExtra = chevronMarkup(rank) + (rank >= RANK_DETAIL.gold ? goldEdgeMarkup() : '') + (onGun ? '' : plates);
  return {
    // The rank chevrons and the legend's gold edging belong to the base.
    back: towerPart(layers.back, backExtra),
    gun: layers.gun ? towerPart(layers.gun, onGun ? plates : '') : null,
    front: layers.front ? towerPart(layers.front) : null,
    weapon: TOWER_WEAPONS[doctrine] ?? null,
    rank,
  };
}

/**
 * A recipe emplacement. It has no rank, so it carries no chevrons; the gold
 * edging marks it as the top of the tree.
 */
export function specialSpriteSet(id) {
  const symbol = SPECIAL_SYMBOLS[id];
  if (!symbol) throw new Error(`Unknown special tower: ${id}`);
  const hasGun = Boolean(TOWER_SPRITES.symbols[`${symbol}-gun`]);
  return {
    back: towerPart(['base', `${symbol}-back`], goldEdgeMarkup()),
    gun: hasGun ? towerPart([`${symbol}-gun`]) : null,
    front: null,
    weapon: TOWER_WEAPONS[id] ?? null,
    rank: 0,
  };
}

/**
 * One part of the supply pod. The SVG origin sits where the capsule meets the
 * ground, so it needs no lift; the scale is part of the key, because the opened
 * pod is drawn smaller than the closed one.
 */
function podPart(id, unitScale, tag) {
  const entry = POD_SPRITES.symbols[id];
  if (!entry) throw new Error(`Unknown pod symbol: ${id}`);
  return {
    key: `pod:${id}${tag ? `:${tag}` : ''}`,
    bbox: entry.bbox,
    unitScale,
    anchorZ: 0,
    svg: (pixelScale) => svgDocument(POD_SPRITES, `<use href="#${id}"/>`, entry.bbox, pixelScale),
  };
}

/**
 * Every sprite a supply pod is drawn from: the closed shell in one piece, and
 * for the opened capsule the core plus its four segments in opening order.
 * The glow, the light column and the hologram stay in code; they carry the
 * doctrine's colour (docs/ART.md).
 * @returns {{shell: object, core: object, petals: object[]}}
 */
export function podSpriteSet() {
  const open = SPRITE_SCALE.pod * POD_OPEN_SCALE;
  const byId = new Map(POD_PETALS.map((p) => [p.id, p]));
  return {
    shell: podPart('pod-shell', SPRITE_SCALE.pod),
    core: podPart('pod-core', open, 'open'),
    petals: POD_PETAL_ORDER.map((id, order) => {
      const petal = byId.get(id);
      if (!petal) throw new Error(`Pod opening order names an unknown segment: ${id}`);
      return { ...petal, order, sprite: podPart(id, open, 'open') };
    }),
  };
}

export const SPECIALS = Object.keys(SPECIAL_SYMBOLS);

export const ENEMY_TYPES = Object.keys(ALL_ENEMY_SYMBOLS);
export const DOCTRINES = Object.keys(DOCTRINE_SYMBOLS);
