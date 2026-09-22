// Rubble: the obstacle left by unused pods and by towers consumed for a recipe.

import { setBlocked } from './grid.js';

/** Purely visual variation, derived from the cell so it never needs randomness. */
export function rubbleVariant(x, y) {
  return (x * 7 + y * 13) % 4;
}

/** Adds rubble on a cell and blocks it. */
export function addRubble(state, { x, y }) {
  const obstacle = { kind: 'rubble', cells: [{ x, y }], variant: rubbleVariant(x, y) };
  state.map.obstacles.push(obstacle);
  setBlocked(state.map.grid, x, y, true);
  return obstacle;
}
