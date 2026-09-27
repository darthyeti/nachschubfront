// Player (and debug) actions that change the simulation state.
// Called from input handlers between simulation steps.

import { GAME_SPEEDS } from '../data/settings.js';
import { setPhase } from '../core/phases.js';
import { computeRoute, checkPlacement } from './route.js';
import { setBlocked } from './grid.js';
import { beginWave, totalWaves } from './waves.js';
import { fillZones } from './zones.js';
import { createPods, salvoRng } from './pods.js';
import { applySelection } from './selection.js';
import { addRubble } from './rubble.js';
import { record, taint } from './record.js';

export function canRequestSalvo(state) {
  return state.phase === 'planning' && state.wave < totalWaves() && state.route !== null && !state.stress;
}

/**
 * Requests the salvo of the coming round (GDD section 3): zones the player left
 * open are filled at random, then the pods start falling.
 */
export function requestSalvo(state) {
  if (!canRequestSalvo(state)) return false;
  fillZones(state, salvoRng(state).fork('zones'));
  if (state.zones.length === 0) return false;
  // The whole zone list goes into the log, not just "salvo requested". The
  // filling is seeded per wave and therefore repeatable on its own, but which
  // cells it may pick depends on the state of the map — and that depends on
  // demolition prices, a value M6 is going to change.
  record(state, 'salvo', { zones: state.zones.map(({ x, y }) => ({ x, y })) });
  createPods(state);
  setPhase(state, 'salvo');
  return true;
}

/**
 * Applies the player's choice and starts the wave (GDD section 3: selection is
 * followed by the wave).
 * @returns {{ok: true, tower: object} | {ok: false, reason: string}}
 */
export function chooseSelection(state, choice) {
  const result = applySelection(state, choice);
  if (!result.ok) return result;
  record(state, 'select', {
    type: choice.type,
    anchor: choice.anchor,
    ...(choice.recipeId ? { recipeId: choice.recipeId } : {}),
    ...(choice.size ? { size: choice.size } : {}),
  });
  setPhase(state, 'wave');
  beginWave(state);
  return result;
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
  if (state.phase !== 'planning' || state.stress) return { ok: false, reason: 'phase' };
  const { map } = state;
  // A debug lever: it moves rubble around without paying for it, so the match
  // is no longer a measurement. Recorded all the same, so the replay can follow.
  taint(state, 'obstacle');
  const index = obstacleAt(map, cell);
  if (index >= 0) {
    for (const c of map.obstacles[index].cells) setBlocked(map.grid, c.x, c.y, false);
    map.obstacles.splice(index, 1);
    refreshRoute(state);
    record(state, 'obstacle', { x: cell.x, y: cell.y, on: false });
    return { ok: true, action: 'removed' };
  }
  const check = checkPlacement(map, [cell]);
  if (!check.ok) return check;
  addRubble(state, cell);
  refreshRoute(state);
  record(state, 'obstacle', { x: cell.x, y: cell.y, on: true });
  return { ok: true, action: 'added' };
}
