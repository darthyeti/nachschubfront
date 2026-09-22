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

/** World-pixel bounding box of an n x n map, with room for side walls below and objects above. */
export function mapBounds(size, { above = 90, below = 110, side = 8 } = {}) {
  return {
    x0: -size * TILE_HALF_W - side,
    x1: size * TILE_HALF_W + side,
    y0: -above,
    y1: size * TILE_HALF_H * 2 + below,
  };
}
