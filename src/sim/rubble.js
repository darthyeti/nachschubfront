// Rubble: the obstacle left by unused pods and by towers consumed for a recipe.

import { setBlocked } from './grid.js';

/** Purely visual variation, derived from the cell so it never needs randomness. */
export function rubbleVariant(x, y) {
  return (x * 7 + y * 13) % 4;
}

/**
 * Index of the heap of rubble on a cell in map.obstacles, or -1. Pre-placed
 * ruins, craters and walls are terrain, not rubble, and never match.
 */
export function rubbleIndexAt(map, cell) {
  return map.obstacles.findIndex(
    (o) => o.kind === 'rubble' && o.cells.some((c) => c.x === cell.x && c.y === cell.y),
  );
}

/** True if that cell carries a heap of rubble a capsule could be built on. */
export function isRubble(map, cell) {
  return rubbleIndexAt(map, cell) >= 0;
}

/** Removes the heap of rubble on a cell and frees it. Returns false if there was none. */
export function clearRubble(state, cell) {
  const index = rubbleIndexAt(state.map, cell);
  if (index < 0) return false;
  const [obstacle] = state.map.obstacles.splice(index, 1);
  for (const c of obstacle.cells) setBlocked(state.map.grid, c.x, c.y, false);
  return true;
}

/** Adds rubble on a cell and blocks it. */
export function addRubble(state, { x, y }) {
  const obstacle = { kind: 'rubble', cells: [{ x, y }], variant: rubbleVariant(x, y) };
  state.map.obstacles.push(obstacle);
  setBlocked(state.map.grid, x, y, true);
  return obstacle;
}
