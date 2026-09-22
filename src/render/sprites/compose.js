// Pure sprite logic without DOM access: sprite definitions (SVG text + bounds),
// raster level choice and enemy facing. Unit-tested in node.

import { ENEMY_SPRITES } from './enemies.js';
import { TOWER_SPRITES } from './towers.js';
import {
  SPRITE_SCALE,
  TOWER_BASE_TOP,
  ALL_ENEMY_SYMBOLS,
  ENEMY_EXTRA_SCALE,
  DOCTRINE_SYMBOLS,
  OWN_SANDBAGS,
  RANK_COUNT,
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

/**
 * Parts of a tower sprite, back to front.
 * @param {string} doctrine  Key of DOCTRINE_SYMBOLS.
 * @param {number} rank  1 (recruit) to 5 (legend).
 */
export function towerParts(doctrine, rank) {
  const body = DOCTRINE_SYMBOLS[doctrine];
  if (!body) throw new Error(`Unknown doctrine: ${doctrine}`);
  if (!(rank >= 1 && rank <= RANK_COUNT)) throw new Error(`Invalid rank: ${rank}`);
  const ring = rank >= 2 && !OWN_SANDBAGS.has(doctrine);
  return ['base', ...(ring ? ['sb-back'] : []), body, ...(ring ? ['sb-front'] : [])];
}

/**
 * A sprite definition: everything the rasterizer needs, plus placement data.
 * The SVG origin sits on the entity's ground position, lifted by `anchorZ` world pixels.
 * @typedef {{key: string, bbox: number[], unitScale: number, anchorZ: number, svg: (pixelScale: number) => string}} SpriteDef
 */

export function enemySprite(type) {
  const id = ALL_ENEMY_SYMBOLS[type];
  if (!id) throw new Error(`Unknown enemy type: ${type}`);
  const { bbox } = ENEMY_SPRITES.symbols[id];
  return {
    key: `enemy:${type}`,
    bbox,
    // Bosses share the symbol of a normal enemy but are drawn larger, so the
    // scale is part of the key via the type.
    unitScale: SPRITE_SCALE.enemy * (ENEMY_EXTRA_SCALE[type] ?? 1),
    anchorZ: 0,
    svg: (pixelScale) => svgDocument(ENEMY_SPRITES, `<use href="#${id}"/>`, bbox, pixelScale),
  };
}

export function towerSprite(doctrine, rank) {
  const parts = towerParts(doctrine, rank);
  const bbox = union(parts.map((id) => TOWER_SPRITES.symbols[id].bbox));
  const body = parts.map((id) => `<use href="#${id}"/>`).join('') + chevronMarkup(rank);
  return {
    key: `tower:${doctrine}:${rank}`,
    bbox,
    unitScale: SPRITE_SCALE.tower,
    // The symbol origin is the centre of the base's top face, TOWER_BASE_TOP units above ground.
    anchorZ: TOWER_BASE_TOP * SPRITE_SCALE.tower,
    svg: (pixelScale) => svgDocument(TOWER_SPRITES, body, bbox, pixelScale),
  };
}

export const ENEMY_TYPES = Object.keys(ALL_ENEMY_SYMBOLS);
export const DOCTRINES = Object.keys(DOCTRINE_SYMBOLS);
