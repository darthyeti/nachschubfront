// Plays a whole match with one of the strategies (M6, part 1, step 3).
//
// Everything a bot does that is not a strategy lives here, because the order
// asks for all of them to do it the same way: buy the supply level, clear
// rubble, raise bulwarks, and spend the commands on bosses and the Koloss. What
// differs between them is only where the zones go and which capsule is kept
// (bot-strategies.mjs).
//
// It records itself, so a bot match comes out as a protocol like any other and
// can be replayed, compared and read with the same tools as a match somebody
// played by hand. A bot is not a measurement — it places its zones by a rule —
// but it is a real match and nothing downstream needs to know the difference.

import { createGameState } from '../../src/core/state.js';
import { stepSimulation } from '../../src/sim/step.js';
import { SIM_STEP } from '../../src/data/settings.js';
import { requestSalvo, chooseSelection, giveUpSalvo } from '../../src/sim/actions.js';
import { toggleZone } from '../../src/sim/zones.js';
import { zoneLimit } from '../../src/sim/zones.js';
import { selectionOptions } from '../../src/sim/selection.js';
import { buySupply, canBuySupply, demolish, canDemolish, buildBulwark, canBuildBulwark, nextRubbleCost } from '../../src/sim/economy.js';
import { useCommand, canUseCommand } from '../../src/sim/commands.js';
import { COMMANDS } from '../../src/data/commands.js';
import { routeWith } from '../../src/sim/route.js';
import { isRubble } from '../../src/sim/rubble.js';
import { startLog } from '../../src/sim/record.js';
import { totalWaves } from '../../src/sim/waves.js';
import { RULESET_VERSION } from '../../src/data/rules.js';
import { strategyById } from './bot-strategies.mjs';

/** Wave a bot starts saving bulwarks for; the Koloss comes in 35 (GDD section 9). */
const BULWARK_FROM_WAVE = 30;

/**
 * Plays one match.
 *
 * @param {object} options
 * @param {string} options.seed
 * @param {string} [options.strategy]  Strategy id, default 'maze'.
 * @param {number} [options.supply]  Supply level to start on, for the debug case.
 * @param {(line: object) => void} [options.onWave]
 * @param {{mode?: string, difficulty?: string}} [options.config]  Run configuration (M7a).
 * @returns {{log: object, state: object, waves: object[], stopped: string}}
 */
export function playBotMatch({ seed, strategy = 'maze', supply = 1, onWave = null, config = undefined } = {}) {
  const how = strategyById(strategy);
  const state = createGameState(seed, config);
  state.supplyLevel = supply;
  startLog(state, RULESET_VERSION, 1);

  let seen = 0;
  let stopped = 'played out';

  for (let round = 0; round < totalWaves(); round++) {
    spend(state);
    mark(state, how);
    if (!requestSalvo(state)) {
      stopped = 'no salvo';
      break;
    }
    if (!run(state, (s) => s.phase === 'selection', 90)) {
      stopped = 'salvo did not land';
      break;
    }
    if (!pick(state, how)) {
      stopped = 'no choice was accepted';
      break;
    }

    // Through the wave, with the commands the bot is allowed to spend.
    run(state, (s) => s.phase !== 'wave', 900, () => fight(state));
    for (; seen < state.log.waves.length; seen++) onWave?.(state.log.waves[seen]);
    if (state.phase === 'defeat' || state.phase === 'victory') {
      stopped = state.phase;
      break;
    }
    run(state, (s) => s.phase === 'planning', 10);
  }

  return { log: state.log, state, waves: state.log.waves, stopped };
}

/** Steps until `until`, calling `each` on every step. */
function run(state, until, maxSeconds, each = null) {
  const steps = Math.round(maxSeconds / SIM_STEP);
  for (let i = 0; i < steps; i++) {
    stepSimulation(state, SIM_STEP);
    each?.();
    if (until(state)) return true;
  }
  return false;
}

/**
 * The purse, in planning. A supply level is the best thing to own, but not at
 * the price of not being able to build: the reserve is one demolition, because
 * a capsule that lands on rubble has to be paid for before it becomes a tower.
 * The bot before M6 spent everything and then could not take its own choice.
 */
function spend(state) {
  while (canBuySupply(state).ok && state.requisition - canBuySupply(state).cost >= nextRubbleCost(state)) {
    if (!buySupply(state).ok) break;
  }

  // From here on the purse only grows (Till's match: 1830 requisition lying
  // idle by wave 33), so the surplus goes into the two things there are to buy.
  const surplus = state.requisition - 4 * nextRubbleCost(state);
  if (surplus <= 0) return;

  if (state.wave + 1 >= BULWARK_FROM_WAVE) {
    // A bulwark is what stops the Koloss ramming through the maze, and it is
    // the sink the GDD names for a late purse.
    for (const heap of rubbleCells(state)) {
      if (state.requisition - 4 * nextRubbleCost(state) <= 0) break;
      if (canBuildBulwark(state, heap).ok) buildBulwark(state, heap);
    }
    return;
  }

  // Clearing a heap can only make the route shorter or leave it as it is — a
  // cleared cell is one fewer obstacle. The order asks for "clear rubble when
  // it lengthens the path", which cannot happen; the nearest thing that does is
  // to clear a heap that the maze does not rest on, which frees good ground for
  // a later capsule without costing a single cell of route. Noted as a
  // deviation in docs/PROGRESS.md.
  const before = state.route?.length ?? 0;
  for (const heap of rubbleCells(state)) {
    if (state.requisition - 4 * nextRubbleCost(state) <= 0) break;
    if (!canDemolish(state, heap).ok) continue;
    const after = routeWith(state.map, [])?.length ?? 0;
    if (after < before) continue;
    const without = routeLengthWithout(state, heap);
    if (without !== null && without >= before) demolish(state, heap);
  }
}

/** Route length if that heap were gone, without changing the map for good. */
function routeLengthWithout(state, cell) {
  const index = state.map.obstacles.findIndex(
    (o) => o.kind === 'rubble' && o.cells.some((c) => c.x === cell.x && c.y === cell.y),
  );
  if (index < 0) return null;
  const obstacle = state.map.obstacles[index];
  const grid = state.map.grid;
  const before = obstacle.cells.map(({ x, y }) => grid.blocked[y * grid.size + x]);
  for (const { x, y } of obstacle.cells) grid.blocked[y * grid.size + x] = 0;
  try {
    return routeWith(state.map, [])?.length ?? null;
  } finally {
    obstacle.cells.forEach(({ x, y }, i) => {
      grid.blocked[y * grid.size + x] = before[i];
    });
  }
}

function rubbleCells(state) {
  return state.map.obstacles
    .filter((o) => o.kind === 'rubble')
    .map((o) => ({ x: o.cells[0].x, y: o.cells[0].y }))
    .filter((cell) => isRubble(state.map, cell));
}

/** Marks the zones the strategy asks for, as far as they are accepted. */
function mark(state, how) {
  const limit = zoneLimit(state);
  for (const cell of how.zones(state, limit) ?? []) {
    if (state.zones.length >= limit) break;
    if (cell) toggleZone(state, cell);
  }
}

/** Takes the first choice the simulation accepts. */
function pick(state, how) {
  const options = selectionOptions(state);
  for (const choice of how.choose(state, options) ?? []) {
    if (chooseSelection(state, choice).ok) return true;
  }
  // Last resort: any capsule at all, so a refused preference never ends the run.
  for (let i = 0; i < state.pods.length; i++) {
    if (chooseSelection(state, { type: 'keep', anchor: i }).ok) return true;
  }
  // And if even that fails, the whole salvo came down on rubble the purse cannot
  // clear. The player is offered the same way out, so the bot takes it rather
  // than ending a run of fifty waves in round nine.
  return giveUpSalvo(state).ok;
}

/**
 * The commands, in the wave. Spent on the boss and the Koloss and on nothing
 * else: that is what the GDD keeps them for, and a bot that threw them at a
 * horde would say nothing about whether they are enough for the thing they are
 * meant for.
 */
function fight(state) {
  const target = state.enemies.find((e) => e.koloss) ?? state.enemies.find((e) => e.boss);
  if (!target) return;
  const cell = { x: Math.floor(target.x), y: Math.floor(target.y) };

  for (const command of COMMANDS) {
    if (command.phase !== 'wave') continue;
    const aim =
      command.target === 'line'
        ? { from: cell, to: { x: cell.x + Math.round(target.dx * 6), y: cell.y + Math.round(target.dy * 6) } }
        : command.target === 'cell'
          ? cell
          : null;
    if (!canUseCommand(state, command.id, aim).ok) continue;
    useCommand(state, command.id, aim);
  }
}
