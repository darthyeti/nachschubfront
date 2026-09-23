// Spending and earning (GDD section 10). Requisition comes from kills and from
// clearing waves, command points from bosses and from waves without a single
// breakthrough.

import { ECONOMY, waveBonus, rubbleCost, towerCost } from '../data/economy.js';
import { supplyCost, MAX_SUPPLY_LEVEL } from '../data/supply.js';
import { setBlocked } from './grid.js';
import { computeRoute, routeExists } from './route.js';
import { towerAt, removeTower } from './towers.js';

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

/** Cost of the next demolition of rubble; every one in a match makes them dearer. */
export function nextRubbleCost(state) {
  return rubbleCost(state.demolished);
}

/** Cost of tearing down one of your own positions: three times that. */
export function nextTowerCost(state) {
  return towerCost(state.demolished);
}

function rubbleIndexAt(map, cell) {
  return map.obstacles.findIndex(
    (o) => o.kind === 'rubble' && o.cells.some((c) => c.x === cell.x && c.y === cell.y),
  );
}

/**
 * What the demolish mode would clear on that cell, if anything. Pre-placed
 * ruins, craters and walls are part of the terrain and stay.
 * @returns {{kind: 'rubble', index: number, cost: number}
 *   | {kind: 'tower', tower: object, cost: number} | null}
 */
export function demolishTarget(state, cell) {
  if (!cell) return null;
  const tower = towerAt(state, cell);
  if (tower) return { kind: 'tower', tower, cost: nextTowerCost(state) };
  const index = rubbleIndexAt(state.map, cell);
  return index >= 0 ? { kind: 'rubble', index, cost: nextRubbleCost(state) } : null;
}

/** Price of clearing that cell, or null if there is nothing to clear. */
export function demolishCost(state, cell) {
  return demolishTarget(state, cell)?.cost ?? null;
}

/**
 * @returns {{ok: true, cost: number, kind: 'rubble' | 'tower'}
 *   | {ok: false, reason: 'phase' | 'target' | 'funds' | 'blocks'}}
 */
export function canDemolish(state, cell) {
  if (state.phase !== 'planning' || state.stress) return { ok: false, reason: 'phase' };
  const target = demolishTarget(state, cell);
  if (!target) return { ok: false, reason: 'target' };
  if (state.requisition < target.cost) return { ok: false, reason: 'funds' };
  // The GDD asks for the route to be checked before every demolition. Freeing a
  // cell can only ever open it, so this is a guard rail, not a hurdle the player
  // will meet; it is here so a later change cannot slip past it unnoticed.
  if (!routeExists(state.map)) return { ok: false, reason: 'blocks' };
  return { ok: true, cost: target.cost, kind: target.kind };
}

/**
 * Clears a heap of rubble or tears down one of the player's own positions
 * (GDD section 10). A position gives nothing back, and either way the next
 * demolition costs more.
 */
export function demolish(state, cell) {
  const check = canDemolish(state, cell);
  if (!check.ok) return check;
  const target = demolishTarget(state, cell);
  if (target.kind === 'tower') {
    removeTower(state, target.tower.id);
    setBlocked(state.map.grid, cell.x, cell.y, false);
  } else {
    const [obstacle] = state.map.obstacles.splice(target.index, 1);
    for (const c of obstacle.cells) setBlocked(state.map.grid, c.x, c.y, false);
  }
  state.requisition -= check.cost;
  state.demolished += 1;
  state.route = computeRoute(state.map);
  state.mapVersion += 1;
  state.events.push({ type: 'demolish', x: cell.x, y: cell.y, cost: check.cost, kind: target.kind });
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
