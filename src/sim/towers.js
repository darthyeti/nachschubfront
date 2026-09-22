// Towers on the map. Plain records plus the systems that work on them;
// their combat behaviour follows in M3.

import { setBlocked } from './grid.js';

/**
 * Adds a tower and blocks its cell.
 * @param {{x: number, y: number, doctrine: string, rank?: number|null, special?: string|null}} spec
 *   `special` is a recipe id; special towers have no rank.
 */
export function addTower(state, { x, y, doctrine, rank = null, special = null }) {
  const tower = { id: state.nextTowerId++, x, y, doctrine, rank, special };
  state.towers.push(tower);
  setBlocked(state.map.grid, x, y, true);
  return tower;
}

export function towerAt(state, cell) {
  return state.towers.find((t) => t.x === cell.x && t.y === cell.y) ?? null;
}

export function towerById(state, id) {
  return state.towers.find((t) => t.id === id) ?? null;
}

/**
 * Removes a tower from the list. The cell stays blocked: callers turn it into
 * rubble, which keeps the maze the player built intact.
 */
export function removeTower(state, id) {
  const index = state.towers.findIndex((t) => t.id === id);
  return index >= 0 ? state.towers.splice(index, 1)[0] : null;
}
