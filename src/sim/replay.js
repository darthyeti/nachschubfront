// Playing a recorded match again (M6, part 1, step 2).
//
// A protocol holds the seed and every action the player took, each with the
// simulation step it landed on. Playing it back means stepping the simulation
// and applying each action when its step comes round again. Because the
// simulation is deterministic — no Math.random, no wall clock, the map and the
// capsules drawn from the seed alone — the same protocol and the same data give
// the same match down to the lives after every wave.
//
// That is what makes it a measuring instrument: change a number in src/data/ and
// play the same protocol again, and the difference in the result is the
// difference the number made, not the difference between two matches.
//
// **An action that has become impossible is skipped, not fatal.** Under new
// prices a demolition may be unaffordable, and a cell the player cleared then
// stays blocked; the replay notes it and carries on, because a run that stopped
// at the first difference would measure nothing.
//
// No DOM, no canvas, no files: node runs it in the balancing tools, and the
// browser runs it to set up a test entry at wave 10, 20, 30 or 35 (step 4).

import { createGameState } from '../core/state.js';
import { stepSimulation } from './step.js';
import { SIM_STEP } from '../data/settings.js';
import { MIN_SUPPLY_LEVEL } from '../data/supply.js';
import { requestSalvo, chooseSelection, toggleObstacle, giveUpSalvo } from './actions.js';
import { toggleZone, zoneIndexAt } from './zones.js';
import { buySupply, demolish, buildBulwark } from './economy.js';
import { useCommand } from './commands.js';
import { setLives, setWave, grant, forcePod, toggleInvulnerable } from './debug.js';
import { startLog } from './record.js';
import { RULESET_VERSION } from '../data/rules.js';

/** Steps a replay may take before it is called stuck, about 100 minutes. */
const MAX_STEPS = 360_000;

/**
 * The phases in the order they come round for one value of `state.wave`. The
 * counter goes up when a wave starts, so the wave itself and its evaluation
 * carry the same number as the planning that follows them:
 *
 *   ... wave 5 · evaluation · planning · salvo · selection · [wave 6] ...
 *
 * Reading the order this way is what lets the replay tell "not yet" from "too
 * late" for the phase an action belongs to.
 */
const PHASE_ORDER = ['wave', 'evaluation', 'planning', 'salvo', 'selection'];

/** Whether the replay is before, at, or past the moment an action belongs to. */
function when(state, action) {
  if (action.w !== undefined && state.wave !== action.w) {
    return state.wave > action.w ? 'past' : 'before';
  }
  if (!action.p || state.phase === action.p) {
    // Inside a wave the second matters: a command early in the wave is a
    // different decision from the same command late in it. The planning phases
    // wait for the player, so there is nothing to wait for here.
    if (action.p === 'wave' && action.pt !== undefined && state.phaseTime < action.pt) return 'before';
    return 'now';
  }
  const here = PHASE_ORDER.indexOf(state.phase);
  const there = PHASE_ORDER.indexOf(action.p);
  if (here < 0 || there < 0) return 'past';
  return here > there ? 'past' : 'before';
}

/**
 * Plays a protocol back.
 *
 * @param {object} protocol  A recorded match (sim/record.js).
 * @param {object} [options]
 * @param {number} [options.untilWave]  Stop once this wave has been fought, for
 *   the test entry of step 4. Default: play the whole protocol.
 * @param {(line: object) => void} [options.onWave]  Called with every wave line
 *   as it is finished, so a tool can print while it runs.
 * @returns {{
 *   state: object, waves: object[], skipped: object[], applied: number,
 *   stopped: string, steps: number,
 * }}
 */
export function replayMatch(protocol, { untilWave = Infinity, onWave = null } = {}) {
  const state = createGameState(protocol.seed);
  state.supplyLevel = protocol.supplyStart ?? MIN_SUPPLY_LEVEL;
  // The replay records itself, so the wave lines come out of the same function
  // that wrote the protocol in the first place — one definition of what a wave
  // line is, for both sides of the comparison.
  startLog(state, protocol.ruleset ?? RULESET_VERSION, protocol.id ?? 0);

  // Sorted by the step they landed on; a stable sort keeps the recorded order
  // of two actions that happened between the same two steps.
  const actions = withPhaseTimes([...(protocol.actions ?? [])].sort((a, b) => a.t - b.t));
  const skipped = [];
  let next = 0;
  let applied = 0;
  let steps = 0;
  let seen = 0;
  let stopped = 'end of protocol';

  while (steps < MAX_STEPS) {
    // Everything whose moment has come. The queue keeps the recorded order, so
    // the head is always the next decision; an action whose round is already
    // over is dropped with a reason instead of firing in the wrong one.
    for (;;) {
      if (next >= actions.length) break;
      const action = actions[next];
      const moment = when(state, action);
      if (moment === 'before') break;
      next += 1;
      if (moment === 'past') {
        skipped.push({ ...action, why: `${action.p} of round ${action.w} was over` });
        continue;
      }
      const result = apply(state, action);
      if (result === true) applied += 1;
      else skipped.push({ ...action, why: result });
    }

    if (state.phase === 'defeat' || state.phase === 'victory') {
      stopped = state.phase;
      break;
    }
    if (next >= actions.length && state.phase === 'planning') {
      // Nothing left to do and nobody to do it: the protocol is played out.
      stopped = 'end of protocol';
      break;
    }
    // The planning phase waits for the player and never moves on by itself, so
    // an action waiting there for a later round is waiting for something only
    // it could have brought about. Dropped with a reason rather than left to
    // run into the step limit.
    if (state.phase === 'planning' && next < actions.length && actions[next].w > state.wave) {
      const action = actions[next++];
      skipped.push({ ...action, why: `round ${action.w} was never reached (still in round ${state.wave})` });
      continue;
    }

    stepSimulation(state, SIM_STEP);
    steps += 1;

    // A wave line appears the moment the wave ends (core/phases.js records it).
    if (state.log.waves.length > seen) {
      for (; seen < state.log.waves.length; seen++) onWave?.(state.log.waves[seen]);
      if (state.wave >= untilWave) {
        stopped = `wave ${untilWave}`;
        break;
      }
    }
  }
  if (steps >= MAX_STEPS) stopped = 'step limit';

  return { state, waves: state.log.waves, skipped, applied, stopped, steps };
}

/**
 * Fills in the seconds into the wave for protocols recorded before that was
 * written down (build 0.9.0, the first one handed out).
 *
 * It can be reconstructed exactly: a wave begins at the moment the capsule is
 * chosen, because that choice is what starts it (sim/actions.js). So the step of
 * the `select` of the round before is the step the wave started on, and the
 * difference is the time into it. Without this, every command of such a protocol
 * fires at the first instant of its wave — which is not what the player did.
 */
function withPhaseTimes(actions) {
  if (actions.every((a) => a.pt !== undefined)) return actions;
  const waveStart = new Map();
  for (const action of actions) {
    if (action.a === 'select') waveStart.set(action.w + 1, action.t);
  }
  return actions.map((action) => {
    if (action.pt !== undefined || action.p !== 'wave') return action;
    const start = waveStart.get(action.w);
    return { ...action, pt: start === undefined ? 0 : Math.max(0, (action.t - start) * SIM_STEP) };
  });
}

/**
 * Repeats one recorded action.
 * @returns {true|string} true, or why it could not be repeated.
 */
function apply(state, action) {
  switch (action.a) {
    case 'zone': {
      // The recorded action says which way it went, so a marker that is already
      // where it should be is not toggled away again.
      const marked = zoneIndexAt(state, action) >= 0;
      if (marked === action.on) return 'the marker was already in that state';
      const result = toggleZone(state, { x: action.x, y: action.y });
      return result.ok ? true : `zone refused: ${result.reason}`;
    }
    case 'salvo': {
      // The player's own markers are set first, then the recorded fill is used
      // for the rest. The fill is seeded per wave, but which cells it may pick
      // depends on the state of the map — and prices change that.
      for (const cell of action.zones ?? []) {
        if (zoneIndexAt(state, cell) < 0) toggleZone(state, cell);
      }
      const missing = (action.zones ?? []).filter((c) => zoneIndexAt(state, c) < 0);
      const ok = requestSalvo(state);
      if (!ok) return 'the salvo was refused';
      return missing.length === 0 ? true : `salvo ran with ${missing.length} zone(s) short`;
    }
    case 'select': {
      const result = chooseSelection(state, {
        type: action.type,
        anchor: action.anchor,
        recipeId: action.recipeId,
        size: action.size,
        towerId: action.towerId,
      });
      if (result.ok) return true;
      // This is the one action that cannot simply be skipped: it is what starts
      // the wave, so leaving it out would keep the replay in the selection phase
      // until the step limit and lose the rest of the protocol. Under changed
      // numbers the recorded choice really can become impossible — a capsule on
      // a heap the purse no longer covers, a recipe whose minimum rank moved.
      // So the round is carried on as close to the decision as it still can be:
      // keep the capsule the player picked, else keep whichever one is payable,
      // else give the salvo up.
      const fallbacks = [
        action.anchor,
        ...state.pods.map((_, index) => index).filter((index) => index !== action.anchor),
      ];
      for (const anchor of fallbacks) {
        if (chooseSelection(state, { type: 'keep', anchor }).ok) {
          return `selection refused (${result.reason}), capsule ${anchor + 1} was kept instead`;
        }
      }
      if (giveUpSalvo(state, { force: true }).ok) {
        return `selection refused (${result.reason}), the salvo was given up`;
      }
      return `selection refused: ${result.reason}`;
    }
    case 'forfeit': {
      // Forced: the player gave this salvo up, and under changed numbers one of
      // its capsules may have become affordable again. Repeating the decision is
      // closer to the match than building something nobody chose.
      const result = giveUpSalvo(state, { force: true });
      return result.ok ? true : `the salvo could not be given up: ${result.reason}`;
    }
    case 'supply': {
      const result = buySupply(state);
      return result.ok ? true : `supply refused: ${result.reason}`;
    }
    case 'demolish': {
      const result = demolish(state, { x: action.x, y: action.y });
      return result.ok ? true : `demolition refused: ${result.reason}`;
    }
    case 'bulwark': {
      const result = buildBulwark(state, { x: action.x, y: action.y });
      return result.ok ? true : `bulwark refused: ${result.reason}`;
    }
    case 'command': {
      const target = action.from ? { from: action.from, to: action.to } : (action.cell ?? null);
      const result = useCommand(state, action.id, target);
      return result.ok ? true : `command refused: ${result.reason}`;
    }
    case 'obstacle': {
      const result = toggleObstacle(state, { x: action.x, y: action.y });
      return result.ok ? true : `obstacle refused: ${result.reason}`;
    }
    // The debug levers. They are in the protocol so a match played with them
    // replays as the match it was; `tainted` says it is no measurement.
    case 'lives':
      setLives(state, action.lives);
      return true;
    case 'jump':
      return setWave(state, action.wave + 1) ? true : 'the wave jump was refused';
    case 'grant':
      grant(state, { requisition: action.requisition ?? 0, commandPoints: action.commandPoints ?? 0 });
      return true;
    case 'forcePod':
      forcePod(state, action.content ?? null);
      return true;
    case 'invulnerable': {
      // Recorded as the state it switched to, so repeating it twice cannot
      // leave the bastion the wrong way round.
      if (state.invulnerable !== action.on) toggleInvulnerable(state);
      return true;
    }
    default:
      return `unknown action "${action.a}"`;
  }
}

/**
 * Puts a replayed match next to the one that was recorded. With the same data
 * every line has to agree; with changed data the differences are the point.
 * @returns {{wave: number, field: string, was: number, now: number}[]}
 */
export function compareWaves(recorded, replayed, fields = ['lives', 'spawned', 'killed', 'leaked']) {
  const out = [];
  const byWave = new Map(replayed.map((w) => [w.w, w]));
  for (const was of recorded) {
    const now = byWave.get(was.w);
    if (!now) {
      out.push({ wave: was.w, field: 'wave', was: was.w, now: null });
      continue;
    }
    for (const field of fields) {
      if (was[field] !== undefined && was[field] !== now[field]) {
        out.push({ wave: was.w, field, was: was[field], now: now[field] });
      }
    }
  }
  for (const now of replayed) {
    if (!recorded.some((w) => w.w === now.w)) out.push({ wave: now.w, field: 'wave', was: null, now: now.w });
  }
  return out;
}
