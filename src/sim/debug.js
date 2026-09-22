// Debug-only simulation tools. Never used by normal play.

import { ENEMIES } from '../data/enemies.js';
import { WAVES } from '../data/waves.js';
import { DOCTRINE_IDS } from '../data/doctrines.js';
import { RECIPES } from '../data/recipes.js';
import { MAX_RANK } from '../data/ranks.js';
import { groundPolyline, flyerPolyline, positionAt, computeRoute } from './route.js';
import { isBlocked, setBlocked } from './grid.js';
import { spawnEnemy } from './enemies.js';
import { addTower, removeTower } from './towers.js';

/**
 * Sets the bastion's lives. Debug only: the visible panel and the browser tests
 * use it to reach a defeat without playing a whole match.
 */
export function setLives(state, lives) {
  state.lives = Math.max(0, Math.round(lives));
  return state.lives;
}

/**
 * Jumps to a wave: the next salvo prepares it. Only while planning, because the
 * running wave would otherwise lose its spawn list.
 * @returns {boolean} Whether the jump happened.
 */
export function setWave(state, wave) {
  if (state.phase !== 'planning' || state.stress) return false;
  const total = WAVES.length;
  state.wave = Math.max(0, Math.min(total - 1, Math.round(wave) - 1));
  return true;
}

/** Adds requisition and command points out of thin air. */
export function grant(state, { requisition = 0, commandPoints = 0 }) {
  state.requisition = Math.max(0, state.requisition + requisition);
  state.commandPoints = Math.max(0, state.commandPoints + commandPoints);
}

/**
 * Forces the contents of every pod in the coming salvoes, or clears the setting
 * with null. The seeded draw still happens, so nothing else shifts.
 */
export function forcePod(state, content) {
  state.forcedPod = content;
}

/** Breakthroughs still count, but the bastion stops losing lives. */
export function toggleInvulnerable(state) {
  state.invulnerable = !state.invulnerable;
  return state.invulnerable;
}

/** Towers to scatter over the map during the stress test (a long match has about this many). */
const STRESS_TOWERS = 40;

/** Fills the map with towers of every doctrine and rank, spread over free cells. */
function addStressTowers(state) {
  const { map } = state;
  const doctrines = DOCTRINE_IDS;
  state.stressTowers = [];
  let placed = 0;
  // Fixed stride over the grid, so the load is the same on every run.
  for (let i = 0; placed < STRESS_TOWERS && i < map.size * map.size; i += 7) {
    const x = i % map.size;
    const y = Math.floor(i / map.size);
    if (map.protected[y * map.size + x] || isBlocked(map.grid, x, y)) continue;
    const special = placed % 9 === 0 ? RECIPES[placed % RECIPES.length].id : null;
    const tower = addTower(state, {
      x,
      y,
      doctrine: doctrines[placed % doctrines.length],
      rank: special ? null : (placed % MAX_RANK) + 1,
      special,
    });
    state.stressTowers.push(tower.id);
    placed++;
  }
}

/**
 * Stress test: `count` mixed enemies loop along the current route forever without
 * costing lives, so rendering can be measured. Towers are added as well, because
 * they are part of the load in a real match. Only during planning.
 */
export function startStress(state, count) {
  if (state.phase !== 'planning' || !state.route || state.stress) return false;
  state.stress = true;
  state.waveRoutes = { ground: groundPolyline(state.route), flyer: flyerPolyline(state.map) };
  addStressTowers(state);
  const types = Object.keys(ENEMIES);
  for (let i = 0; i < count; i++) {
    const e = spawnEnemy(state, types[i % types.length]);
    const line = e.flying ? state.waveRoutes.flyer : state.waveRoutes.ground;
    // Spread evenly along the route, starting past the fade-in at the rift.
    e.d = 0.5 + ((i + 0.5) / count) * (line.length - 1);
    positionAt(line, e.d, e);
  }
  return true;
}

export function stopStress(state) {
  if (!state.stress) return;
  state.stress = false;
  state.enemies.length = 0;
  state.waveRoutes = null;
  // Only the towers this test added; towers the player built stay.
  for (const id of state.stressTowers ?? []) {
    const tower = removeTower(state, id);
    if (tower) setBlocked(state.map.grid, tower.x, tower.y, false);
  }
  state.stressTowers = [];
  state.route = computeRoute(state.map);
  state.mapVersion += 1;
}

/**
 * Moves stress-test enemies and wraps them back to the rift at the end. The
 * towers fight them for real (that is what the measurement is about), so the
 * enemies are patched up every step and the treadmill never empties.
 */
export function updateStress(state, dt) {
  const { ground, flyer } = state.waveRoutes;
  for (const e of state.enemies) {
    const line = e.flying ? flyer : ground;
    e.d += e.speed * dt;
    if (e.d >= line.length) e.d = 0.5;
    positionAt(line, e.d, e);
    e.health = e.maxHealth;
    e.shield = e.maxShield;
    e.dead = false;
  }
}
