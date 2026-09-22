// Player (and debug) actions that change the simulation state.
// Called from input handlers between simulation steps.

import { GAME_SPEEDS } from '../data/settings.js';
import { setPhase } from '../core/phases.js';
import { computeRoute, checkPlacement } from './route.js';
import { setBlocked } from './grid.js';
import { totalWaves } from './waves.js';

export function canStartWave(state) {
  return state.phase === 'planning' && state.wave < totalWaves() && state.route !== null;
}

/** Requests the next wave. Salvo and selection pass through until M2. */
export function startWave(state) {
  if (!canStartWave(state)) return false;
  setPhase(state, 'salvo');
  return true;
}

export function setSpeed(state, speed) {
  if (!GAME_SPEEDS.includes(speed)) return false;
  state.speed = speed;
  return true;
}

function refreshRoute(state) {
  state.route = computeRoute(state.map);
  state.mapVersion += 1;
}

function obstacleAt(map, cell) {
  return map.obstacles.findIndex((o) => o.cells.some((c) => c.x === cell.x && c.y === cell.y));
}

/**
 * Debug tool: removes the obstacle on a cell, or places rubble if the route stays open.
 * Only during planning, because the maze never changes during a wave.
 * @returns {{ok: boolean, action?: 'added' | 'removed', reason?: string}}
 */
export function toggleObstacle(state, cell) {
  if (state.phase !== 'planning') return { ok: false, reason: 'phase' };
  const { map } = state;
  const index = obstacleAt(map, cell);
  if (index >= 0) {
    for (const c of map.obstacles[index].cells) setBlocked(map.grid, c.x, c.y, false);
    map.obstacles.splice(index, 1);
    refreshRoute(state);
    return { ok: true, action: 'removed' };
  }
  const check = checkPlacement(map, [cell]);
  if (!check.ok) return check;
  setBlocked(map.grid, cell.x, cell.y, true);
  map.obstacles.push({ kind: 'rubble', cells: [{ x: cell.x, y: cell.y }], variant: (cell.x * 7 + cell.y * 13) % 4 });
  refreshRoute(state);
  return { ok: true, action: 'added' };
}
