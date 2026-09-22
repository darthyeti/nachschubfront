// Towers on the map: plain records plus the systems that work on them.

import { setBlocked } from './grid.js';
import { DOCTRINES } from '../data/doctrines.js';
import { SPECIALS } from '../data/specials.js';
import { rankStats } from '../data/ranks.js';

/**
 * Adds a tower and blocks its cell.
 * @param {{x: number, y: number, doctrine: string, rank?: number|null, special?: string|null}} spec
 *   `special` is a recipe id; special towers have no rank.
 */
export function addTower(state, { x, y, doctrine, rank = null, special = null }) {
  const tower = {
    id: state.nextTowerId++,
    x,
    y,
    doctrine,
    rank,
    special,
    /** Seconds until the next shot. */
    cooldown: 0,
    /** World point the weapon last aimed at, for the render side. */
    aim: null,
    /** Damage dealt in the running wave (wave statistics). */
    damage: 0,
  };
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

/**
 * Combat values of a tower: the doctrine values scaled by its rank, or the
 * values of the special tower (data/specials.js). Specials have no rank; they
 * keep the doctrine of their first ingredient, which decides the damage matrix
 * and the guide colour.
 */
export function towerStats(tower) {
  const def = tower.special ? SPECIALS[tower.special] : DOCTRINES[tower.doctrine];
  if (!def) throw new Error(`Unknown tower: ${tower.special ?? tower.doctrine}`);
  const rank = tower.special ? { damage: 1, range: 1 } : rankStats(tower.rank ?? 1);
  return {
    def,
    doctrine: def.doctrine ?? tower.doctrine,
    behaviour: def.behaviour ?? tower.doctrine,
    fire: def.fire,
    damage: def.damage * rank.damage,
    range: def.range * rank.range,
    minRange: def.minRange ?? 0,
    splashRadius: def.splashRadius ?? 0,
    burnStacks: def.burnStacks ?? false,
  };
}

/** Centre of the tower's cell, in world units. */
export function towerCentre(tower) {
  return { x: tower.x + 0.5, y: tower.y + 0.5 };
}
