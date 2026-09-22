// Grid helpers shared by map generation, pathfinding and gameplay.
// A grid stores walkability in a flat Uint8Array: 1 = blocked, 0 = free.

export function createGrid(size) {
  return { size, blocked: new Uint8Array(size * size) };
}

export function inBounds(grid, x, y) {
  return x >= 0 && y >= 0 && x < grid.size && y < grid.size;
}

export function isBlocked(grid, x, y) {
  return !inBounds(grid, x, y) || grid.blocked[y * grid.size + x] === 1;
}

export function setBlocked(grid, x, y, value) {
  grid.blocked[y * grid.size + x] = value ? 1 : 0;
}
