// Biomes (docs/ART.md, "Gelände, Licht und Biome"): one palette per match, chosen from the
// seed and never changed within a map. Pure presentation; nothing here touches a game stream.
// The values are the starting points of reference/studien/optik-studie.js.

import { seedFromString } from '../core/random.js';

/** Fixed order: the index is `seedFromString(String(seed)) % 3`. Never reorder. */
export const BIOME_IDS = ['ash', 'rust', 'toxic'];

export const PALETTES = {
  ash: {
    ground: ['#645e55', '#69635a', '#5f5a51'],
    path: '#ad8d63',
    pathEdge: '#6e5638',
    cliff: ['#7a776f', '#57544c', '#3c3a35'],
    stone: ['#7a776f', '#57544c', '#3c3a35'],
    decor: '#3a3733',
    slab: ['#46403a', '#2c2824'],
    pit: '#2c2926',
  },
  rust: {
    ground: ['#73594d', '#785d50', '#6c5348'],
    path: '#b5875a',
    pathEdge: '#744a2a',
    cliff: ['#8f6d5b', '#654a3e', '#41312b'],
    stone: ['#8d6c5c', '#63483d', '#41302a'],
    decor: '#8b3f1c',
    slab: ['#523a2c', '#33241a'],
    pit: '#33211a',
  },
  toxic: {
    ground: ['#5e685a', '#646e5f', '#586254'],
    path: '#b3a866',
    pathEdge: '#645f3a',
    cliff: ['#7a8274', '#566050', '#394035'],
    stone: ['#767d6d', '#525a4c', '#373d32'],
    decor: '#78b933',
    slab: ['#3e4639', '#272d24'],
    pit: '#252c22',
  },
};

/**
 * Foundation plate under an emplacement: opacity of the doctrine colour, inset from the cell
 * edge (negative: the diamond reaches a little past the cell, so it shows beside the socket),
 * outline width and the rim of the doctrine colour inside the outline (width, opacity).
 */
export const FOUNDATION_ALPHA = 0.45;
export const FOUNDATION_INSET = -0.1;
export const FOUNDATION_LINE = 2.5;
export const FOUNDATION_RIM = 3;
export const FOUNDATION_RIM_ALPHA = 0.8;

/** Biome id of a match. */
export function biomeOf(seed) {
  return BIOME_IDS[seedFromString(String(seed)) % BIOME_IDS.length];
}

export function paletteOf(biome) {
  return PALETTES[biome] ?? PALETTES.ash;
}

/** Lightens (or darkens, negative) a #rrggbb colour by `amount` RGB steps. */
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, v + amount));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}
