// Pure sprite logic without DOM access: sprite definitions (SVG text + bounds),
// raster level choice and enemy facing. Unit-tested in node.

import { ENEMY_SPRITES } from './enemies.js';
import { TOWER_SPRITES } from './towers.js';
import { POD_SPRITES } from './pods.js';
import {
  SPRITE_SCALE,
  BUNKER_ROOF,
  SPECIAL_ROOF,
  ALL_ENEMY_SYMBOLS,
  ENEMY_EXTRA_SCALE,
  DOCTRINE_SYMBOLS,
  SPECIAL_SYMBOLS,
  ENEMY_LIMBS,
  TOWER_TOPS,
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

/**
 * The parts an emplacement is drawn from, back to front. Since v5 that is the
 * bunker for its rank and the top of its doctrine on the roof — the ranks are
 * cumulative and the whole ladder is drawn into each bunker symbol, so nothing
 * has to be stacked here any more (docs/ART.md, "Ränge").
 * @param {string} doctrine  Key of DOCTRINE_SYMBOLS.
 * @param {number} rank  1 (recruit) to 5 (legend).
 * @returns {{base: string, top: string}}
 */
export function towerLayers(doctrine, rank) {
  const top = DOCTRINE_SYMBOLS[doctrine];
  if (!top) throw new Error(`Unknown doctrine: ${doctrine}`);
  if (!(rank >= 1 && rank <= RANK_COUNT)) throw new Error(`Invalid rank: ${rank}`);
  return { base: `bunker-${rank}`, top };
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
function towerPart(id, anchorZ) {
  const entry = TOWER_SPRITES.symbols[id];
  if (!entry) throw new Error(`Unknown emplacement symbol: ${id}`);
  return {
    key: `tower:${id}`,
    bbox: entry.bbox,
    unitScale: SPRITE_SCALE.tower,
    // A bunker's own origin is on the ground; a top's origin is the roof plate
    // it stands on, so it is lifted by the height of that roof.
    anchorZ: anchorZ * SPRITE_SCALE.tower,
    svg: (pixelScale) => svgDocument(TOWER_SPRITES, `<use href="#${id}"/>`, entry.bbox, pixelScale),
  };
}

/**
 * Every sprite an emplacement is drawn from, plus how its weapon moves.
 * @returns {{back: object, gun: object|null, front: object|null, weapon: object|null}}
 */
export function towerSpriteSet(doctrine, rank) {
  const { base, top } = towerLayers(doctrine, rank);
  return {
    back: towerPart(base, 0),
    gun: towerPart(top, BUNKER_ROOF),
    front: null,
    weapon: TOWER_TOPS[doctrine] ?? null,
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
  return {
    back: towerPart('specialbase', 0),
    gun: towerPart(symbol, SPECIAL_ROOF),
    front: null,
    weapon: TOWER_TOPS[id] ?? null,
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
