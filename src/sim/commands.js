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
  if (command.target === 'line') {
    const line = cell;
    const ends = [line?.from, line?.to];
    if (!line || ends.some((p) => !p || !inBounds(state.map.grid, p.x, p.y))) {
      return { ok: false, reason: 'outside' };
    }
  }
  return { ok: true };
}

/**
 * Ranks the Priorisierter Nachschub lifts the next salvo by: one, and two from
 * the supply level in the table on (v3). A late salvo is short and every pod in
 * it matters, so the command has to grow with it.
 */
export function supplyRankBonus(state, command = commandById('prioritySupply')) {
  return state.supplyLevel >= command.doubleFromSupplyLevel ? command.rankBonusHigh : command.rankBonus;
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
 * Pulls the end of a line onto one of the four grid axes: the end is dragged
 * onto the row or the column of the start, whichever is nearer (GDD section 11).
 * The gunship flies an axis, so the line the player draws has to be one.
 */
export function snapToAxis(from, to) {
  return Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
    ? { x: to.x, y: from.y }
    : { x: from.x, y: to.y };
}

/**
 * Where the bombs of a run fall: spread evenly along the line, alternating
 * slightly either side of it (GDD section 11, and the study).
 */
export function bombRun(from, to, command) {
  const count = command.bombs;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  // Across the line, for the alternating offset.
  const ax = -dy / length;
  const ay = dx / length;
  const drops = [];
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0.5 : i / (count - 1);
    const off = (i % 2 ? 1 : -1) * command.bombSpread;
    drops.push({
      x: from.x + dx * u + ax * off,
      y: from.y + dy * u + ay * off,
      /** Share of the run at which this one goes off. */
      at: u,
      done: false,
    });
  }
  return drops;
}

/**
 * One bomb of a run. Like the orbital strike it works on a share of maximum
 * health and goes around the damage matrix; the one armour that matters is
 * plate, which the gunship is loaded for.
 *
 * The share is the budget for the whole run: each bomb takes its part of it and
 * never more than what is left, so a boss or a Koloss loses at most its capped
 * share per use, however many bombs happen to land on it (GDD section 9).
 */
function dropBomb(state, hit, drop) {
  drop.done = true;
  for (const e of enemiesAround(state, drop, hit.blastRadius)) {
    const share = e.boss
      ? hit.bossDamageFraction
      : Math.min(1, hit.damageFraction * (e.armor === 'plate' ? hit.plateFactor : 1));
    const budget = e.maxHealth * share;
    const already = hit.dealt.get(e.id) ?? 0;
    const amount = Math.min(budget * hit.bombShare, budget - already);
    if (amount <= 0) continue;
    hit.dealt.set(e.id, already + amount);
    e.shield = 0;
    e.health -= amount;
    e.flash = 0.12;
    if (e.health <= 0) e.dead = true;
  }
  state.events.push({ type: 'airstrikeBomb', x: drop.x, y: drop.y, radius: hit.blastRadius });
}

/** Counts a run of bombs down and drops the ones that are due. */
function updateAirstrike(state, hit, dt) {
  if (hit.t < hit.warnSeconds) return false;
  const u = (hit.t - hit.warnSeconds) / hit.runSeconds;
  for (const drop of hit.drops) {
    if (!drop.done && u >= drop.at) dropBomb(state, hit, drop);
  }
  return u >= 1;
}

/**
 * Clamps a line to the command's longest allowed run, keeping its direction.
 * A player dragging across half the map gets the first `maxLength` cells of it
 * rather than a refusal.
 */
export function clampLine(from, to, maxLength) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len <= maxLength || len === 0) return { x: to.x, y: to.y };
  return { x: from.x + (dx / len) * maxLength, y: from.y + (dy / len) * maxLength };
}

/**
 * Uses a command. Targeted commands take the cell the player aimed at; the
 * airstrike takes `{ from, to }` in cell coordinates instead.
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function useCommand(state, id, cell = null) {
  const check = canUseCommand(state, id, cell);
  if (!check.ok) return check;
  const command = commandById(id);
  // A line target carries { from, to }; a cell target is one point.
  const point =
    command.target === 'line'
      ? { x: cell.from.x + 0.5, y: cell.from.y + 0.5 }
      : cell
        ? { x: cell.x + 0.5, y: cell.y + 0.5 }
        : null;

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
    state.supplyBonus += supplyRankBonus(state, command);
  } else if (id === 'holyBanner') {
    state.banners.push({ x: point.x, y: point.y, radius: command.radius, bonus: command.damageBonus });
  } else if (id === 'airstrike') {
    const from = { x: cell.from.x + 0.5, y: cell.from.y + 0.5 };
    const axis = snapToAxis(from, { x: cell.to.x + 0.5, y: cell.to.y + 0.5 });
    const to = clampLine(from, axis, command.maxLength);
    const hit = {
      kind: 'airstrike',
      from,
      to,
      halfWidth: command.halfWidth,
      blastRadius: command.blastRadius,
      bombShare: command.bombShare,
      damageFraction: command.damageFraction,
      plateFactor: command.plateFactor,
      bossDamageFraction: command.bossDamageFraction,
      t: 0,
      warnSeconds: command.warnSeconds,
      runSeconds: command.runSeconds,
      drops: bombRun(from, to, command),
      /** Share of its maximum health each enemy has lost to this run so far. */
      dealt: new Map(),
    };
    state.pendingStrikes.push(hit);
    state.events.push({ type: 'airstrikeRun', from: { ...from }, to: { ...to }, warnSeconds: command.warnSeconds, runSeconds: command.runSeconds });
  }

  state.commandPoints -= command.cost;
  state.commandUses[id] = currentWave(state);
  state.events.push({ type: 'command', id, x: point?.x ?? null, y: point?.y ?? null });
  return { ok: true };
}

/**
 * Counts the pending strikes down. An orbital strike goes off at the end of its
 * warning; an airstrike runs on, dropping its bombs along the line, and is only
 * over when the gunship has flown the whole run.
 */
export function updateCommands(state, dt) {
  let write = 0;
  for (let read = 0; read < state.pendingStrikes.length; read++) {
    const hit = state.pendingStrikes[read];
    hit.t += dt;
    if (hit.kind === 'airstrike') {
      if (updateAirstrike(state, hit, dt)) continue;
    } else if (hit.t >= hit.warnSeconds) {
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
