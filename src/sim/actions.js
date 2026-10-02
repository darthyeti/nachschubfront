// Player (and debug) actions that change the simulation state.
// Called from input handlers between simulation steps.

import { GAME_SPEEDS } from '../data/settings.js';
import { setPhase } from '../core/phases.js';
import { currentRoute, checkPlacement } from './route.js';
import { setBlocked } from './grid.js';
import { beginWave, totalWaves } from './waves.js';
import { fillZones, dropInvalidZones, clearZones } from './zones.js';
import { createPods, salvoRng } from './pods.js';
import { applySelection, forfeitSalvo, salvoBuildable, upgradeKind } from './selection.js';
import { MAX_RANK } from '../data/ranks.js';
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
    // Which emplacement was improved. Tower ids are handed out in build order,
    // so they mean the same thing in a replay as they did in the match.
    ...(choice.towerId !== undefined ? { towerId: choice.towerId } : {}),
  });
  setPhase(state, 'wave');
  beginWave(state);
  return result;
}

/**
 * True while no capsule of the salvo can be built on and the only thing left is
 * to give the salvo up. The one state in which the player is offered that.
 */
export function canForfeit(state) {
  return state.phase === 'selection' && state.pods.length > 0 && !salvoBuildable(state);
}

/**
 * Gives the salvo up and starts the wave all the same, so a round in which
 * nothing could be built is not a round the game stops in.
 * @param {{force?: boolean}} [options]  See `forfeitSalvo`; only the replay uses it.
 * @returns {{ok: true, rubble: number} | {ok: false, reason: string}}
 */
export function giveUpSalvo(state, options) {
  const result = forfeitSalvo(state, options);
  if (!result.ok) return result;
  record(state, 'forfeit');
  setPhase(state, 'wave');
  beginWave(state);
  return result;
}

/**
 * Whether an emplacement can go up a rank instead of a salvo (M7b, B5): only in
 * planning, only with no landing zone marked, never past Legende, never a
 * special emplacement (it has no rank), and only for what the mode charges.
 * @returns {{ok: true, cost: number, tower: object}
 *   | {ok: false, reason: 'phase' | 'zones' | 'tower' | 'special' | 'max' | 'off' | 'funds'}}
 */
export function canUpgradeTower(state, towerId) {
  if (!canRequestSalvo(state)) return { ok: false, reason: 'phase' };
  if (state.zones.length > 0) return { ok: false, reason: 'zones' };
  const tower = state.towers.find((t) => t.id === towerId);
  if (!tower) return { ok: false, reason: 'tower' };
  if (tower.special) return { ok: false, reason: 'special' };
  if (tower.rank >= MAX_RANK) return { ok: false, reason: 'max' };
  const cost = upgradeKind(state).planningCost(state, tower);
  if (cost === null || cost === undefined) return { ok: false, reason: 'off' };
  if (state.requisition < cost) return { ok: false, reason: 'funds' };
  return { ok: true, cost, tower };
}

/**
 * The round's action instead of a salvo: one emplacement goes up a rank. No
 * salvo, no capsule, no new rubble, and the wave starts at once (B5).
 * @returns {{ok: true, tower: object, cost: number} | {ok: false, reason: string}}
 */
export function upgradeTower(state, towerId) {
  const check = canUpgradeTower(state, towerId);
  if (!check.ok) return check;
  const { tower, cost } = check;
  state.requisition -= cost;
  tower.rank += 1;
  record(state, 'upgrade', { towerId });
  state.events.push({ type: 'towerUpgraded', tower, cost });
  setPhase(state, 'wave');
  beginWave(state);
  return { ok: true, tower, cost };
}

/**
 * Starts the wave with nothing built and nothing raised. Only the replay uses
 * it: a recorded upgrade that new numbers make impossible still started a wave,
 * and leaving that out would stall the replay in planning.
 */
export function passRound(state) {
  if (!canRequestSalvo(state)) return false;
  clearZones(state);
  setPhase(state, 'wave');
  beginWave(state);
  return true;
}

export function setSpeed(state, speed) {
  if (!GAME_SPEEDS.includes(speed)) return false;
  state.speed = speed;
  return true;
}

function refreshRoute(state) {
  state.route = currentRoute(state);
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
  // A heap dropped on a marked free cell turns that marker into one on rubble,
  // which the purse may not cover.
  dropInvalidZones(state);
  return { ok: true, action: 'added' };
}
