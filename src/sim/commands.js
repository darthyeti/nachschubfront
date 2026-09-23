// Special commands (GDD section 11). They cost command points, unlock with the
// wave number, cool down over whole waves and never block a cell.

import { COMMANDS, commandById } from '../data/commands.js';
import { MAX_RANK } from '../data/ranks.js';
import { enemiesAround } from './targeting.js';
import { damageEnemy } from './damage.js';
import { applyStun } from './effects.js';
import { inBounds } from './grid.js';

/**
 * The wave a command is measured against: during planning that is the wave the
 * salvo is preparing, otherwise the wave that is running.
 */
export function currentWave(state) {
  return state.phase === 'planning' ? state.wave + 1 : state.wave;
}

/** Wave the command can be used again, or 0 if it has not been used yet. */
export function readyWave(state, command) {
  const used = state.commandUses[command.id];
  return used ? used + command.cooldownWaves : 0;
}

/**
 * Everything the HUD needs about one command.
 * @returns {{command: object, unlocked: boolean, ready: boolean, wavesLeft: number,
 *   affordable: boolean, usable: boolean}}
 */
export function commandStatus(state, id) {
  const command = commandById(id);
  if (!command) throw new Error(`Unknown command: ${id}`);
  const wave = currentWave(state);
  const unlocked = wave >= command.fromWave;
  const wavesLeft = Math.max(0, readyWave(state, command) - wave);
  const affordable = state.commandPoints >= command.cost;
  const rightPhase = state.phase === command.phase && !state.stress;
  return {
    command,
    unlocked,
    ready: wavesLeft === 0,
    wavesLeft,
    affordable,
    usable: unlocked && wavesLeft === 0 && affordable && rightPhase,
  };
}

/**
 * @returns {{ok: true} | {ok: false, reason: 'phase' | 'locked' | 'cooldown' | 'points' | 'outside'}}
 */
export function canUseCommand(state, id, cell = null) {
  const status = commandStatus(state, id);
  const { command } = status;
  if (state.phase !== command.phase || state.stress) return { ok: false, reason: 'phase' };
  if (!status.unlocked) return { ok: false, reason: 'locked' };
  if (!status.ready) return { ok: false, reason: 'cooldown' };
  if (!status.affordable) return { ok: false, reason: 'points' };
  if (command.target === 'cell' && (!cell || !inBounds(state.map.grid, cell.x, cell.y))) {
    return { ok: false, reason: 'outside' };
  }
  return { ok: true };
}

/** Freezes everything around a point; bosses shake it off sooner. */
function stasis(state, command, point) {
  for (const e of enemiesAround(state, point, command.radius)) {
    applyStun(state, e, e.boss ? command.bossSeconds : command.seconds);
  }
  state.events.push({ type: 'stasis', x: point.x, y: point.y, radius: command.radius, seconds: command.seconds });
}

/**
 * Resolves an orbital strike once its warning has run out. The damage is a
 * share of maximum health and goes around the damage matrix: this is artillery,
 * not a doctrine, and armour does not help against it.
 */
function strike(state, hit) {
  for (const e of enemiesAround(state, hit, hit.radius)) {
    const share = e.boss ? hit.bossDamageFraction : hit.damageFraction;
    const amount = e.maxHealth * share;
    e.shield = 0;
    e.health -= amount;
    e.flash = 0.12;
    if (e.health <= 0) e.dead = true;
  }
  // `source` lets the render side stage an orbital strike differently from a shell.
  state.events.push({ type: 'explosion', source: 'orbitalStrike', x: hit.x, y: hit.y, radius: hit.radius, doctrine: 'mortar' });
}

/**
 * Uses a command. Targeted commands take the cell the player aimed at.
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function useCommand(state, id, cell = null) {
  const check = canUseCommand(state, id, cell);
  if (!check.ok) return check;
  const command = commandById(id);
  const point = cell ? { x: cell.x + 0.5, y: cell.y + 0.5 } : null;

  if (id === 'orbitalStrike') {
    state.pendingStrikes.push({
      x: point.x,
      y: point.y,
      radius: command.radius,
      damageFraction: command.damageFraction,
      bossDamageFraction: command.bossDamageFraction,
      t: 0,
      warnSeconds: command.warnSeconds,
    });
  } else if (id === 'stasisField') {
    stasis(state, command, point);
  } else if (id === 'prioritySupply') {
    state.supplyBonus += command.rankBonus;
  } else if (id === 'holyBanner') {
    state.banners.push({ x: point.x, y: point.y, radius: command.radius, bonus: command.damageBonus });
  }

  state.commandPoints -= command.cost;
  state.commandUses[id] = currentWave(state);
  state.events.push({ type: 'command', id, x: point?.x ?? null, y: point?.y ?? null });
  return { ok: true };
}

/** Counts down the orbital strikes and lets the ones that are due go off. */
export function updateCommands(state, dt) {
  let write = 0;
  for (let read = 0; read < state.pendingStrikes.length; read++) {
    const hit = state.pendingStrikes[read];
    hit.t += dt;
    if (hit.t >= hit.warnSeconds) {
      strike(state, hit);
      continue;
    }
    state.pendingStrikes[write++] = hit;
  }
  state.pendingStrikes.length = write;
}

/** Extra damage from holy banners standing near a tower (1 without any). */
export function bannerBonus(state, tower) {
  if (state.banners.length === 0) return 1;
  let bonus = 0;
  for (const banner of state.banners) {
    const dx = tower.x + 0.5 - banner.x;
    const dy = tower.y + 0.5 - banner.y;
    if (dx * dx + dy * dy <= banner.radius * banner.radius) bonus = Math.max(bonus, banner.bonus);
  }
  return 1 + bonus;
}

/**
 * Ranks the next salvo gets for free (Priorisierter Nachschub). Reading it
 * clears it, so it is spent on exactly one salvo.
 */
export function takeSupplyBonus(state) {
  const bonus = Math.min(state.supplyBonus, MAX_RANK - 1);
  state.supplyBonus = 0;
  return bonus;
}

export { COMMANDS };
