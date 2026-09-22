// Spending and earning (GDD section 10). Requisition comes from kills and from
// clearing waves, command points from bosses and from waves without a single
// breakthrough.

import { ECONOMY, waveBonus, rubbleCost } from '../data/economy.js';
import { supplyCost, MAX_SUPPLY_LEVEL } from '../data/supply.js';
import { setBlocked } from './grid.js';
import { computeRoute } from './route.js';

/** Cost of the next supply level, or null at the top. */
export function nextSupplyCost(state) {
  return supplyCost(state.supplyLevel);
}

/**
 * @returns {{ok: true, cost: number} | {ok: false, reason: 'phase' | 'max' | 'funds'}}
 */
export function canBuySupply(state) {
  if (state.phase !== 'planning' || state.stress) return { ok: false, reason: 'phase' };
  if (state.supplyLevel >= MAX_SUPPLY_LEVEL) return { ok: false, reason: 'max' };
  const cost = nextSupplyCost(state);
  if (state.requisition < cost) return { ok: false, reason: 'funds' };
  return { ok: true, cost };
}

/** Raises the supply level by one (GDD section 7). */
export function buySupply(state) {
  const check = canBuySupply(state);
  if (!check.ok) return check;
  state.requisition -= check.cost;
  state.supplyLevel += 1;
  state.events.push({ type: 'supply', level: state.supplyLevel, cost: check.cost });
  return check;
}

/** Cost of the next demolition; every one in a match makes the next dearer. */
export function nextRubbleCost(state) {
  return rubbleCost(state.demolished);
}

function rubbleIndexAt(map, cell) {
  return map.obstacles.findIndex(
    (o) => o.kind === 'rubble' && o.cells.some((c) => c.x === cell.x && c.y === cell.y),
  );
}

/**
 * @returns {{ok: true, cost: number} | {ok: false, reason: 'phase' | 'rubble' | 'funds'}}
 */
export function canDemolish(state, cell) {
  if (state.phase !== 'planning' || state.stress) return { ok: false, reason: 'phase' };
  if (!cell || rubbleIndexAt(state.map, cell) < 0) return { ok: false, reason: 'rubble' };
  const cost = nextRubbleCost(state);
  if (state.requisition < cost) return { ok: false, reason: 'funds' };
  return { ok: true, cost };
}

/**
 * Clears a heap of rubble. Opening a cell can never close the route, so there
 * is nothing to check beyond the price.
 */
export function demolish(state, cell) {
  const check = canDemolish(state, cell);
  if (!check.ok) return check;
  const index = rubbleIndexAt(state.map, cell);
  const [obstacle] = state.map.obstacles.splice(index, 1);
  for (const c of obstacle.cells) setBlocked(state.map.grid, c.x, c.y, false);
  state.requisition -= check.cost;
  state.demolished += 1;
  state.route = computeRoute(state.map);
  state.mapVersion += 1;
  state.events.push({ type: 'demolish', x: cell.x, y: cell.y, cost: check.cost });
  return check;
}

/**
 * Pays for a cleared wave: the wave bonus, a command point for a clean defence
 * and three for every boss that fell.
 */
export function settleWave(state) {
  const bonus = waveBonus(state.wave);
  state.requisition += bonus;
  let points = state.waveStats.bossKills * ECONOMY.pointsPerBoss;
  if (state.waveStats.leaked === 0) points += ECONOMY.pointsPerCleanWave;
  state.commandPoints += points;
  state.events.push({ type: 'payout', wave: state.wave, requisition: bonus, commandPoints: points });
  return { requisition: bonus, commandPoints: points };
}
