// Isometric projection as in the style test:
//   screenX = (x - y) * 32, screenY = (x + y) * 16 - z   (world pixels, before camera)

export const TILE_HALF_W = 32;
export const TILE_HALF_H = 16;

/** Grid/world coordinates (cells, height in pixels) to world pixels. */
export function iso(x, y, z = 0) {
  return [(x - y) * TILE_HALF_W, (x + y) * TILE_HALF_H - z];
}

/** World pixels (at z = 0) back to fractional grid coordinates. */
export function isoInverse(px, py) {
  const a = px / TILE_HALF_W;
  const b = py / TILE_HALF_H;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Depth of the earth slab under the map, in pixels. */
export const SLAB_DEPTH = 30;
/** The steel base plate under the slab (diorama frame): thickness in pixels, overhang in cells. */
export const PLATE_THICK = 14;
export const PLATE_OVERHANG = 0.8;
/** Air kept below the plate for the soft table shadow, in pixels. */
const TABLE_SHADOW_AIR = 100;

/**
 * World-pixel bounding box of an n x n map including the base plate and its table shadow, with room
 * for objects above. Sideways the plate reaches `PLATE_OVERHANG` cells further on both axes.
 */
export function mapBounds(size, { above = 114, below = SLAB_DEPTH + PLATE_THICK + TABLE_SHADOW_AIR, side = 12 } = {}) {
  const reach = (size + PLATE_OVERHANG * 2) * TILE_HALF_W + side;
  return {
    x0: -reach,
    x1: reach,
    y0: -above,
    y1: (size + PLATE_OVERHANG) * TILE_HALF_H * 2 + below,
  };
}
