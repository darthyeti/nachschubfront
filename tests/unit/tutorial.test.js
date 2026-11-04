// The tutorial (M10 E3): the sequence of its steps, the flow that moves through
// them, the field it lights up, the placing of its card, and the one promise that
// matters for the rest of the game: it only reads. A match played with it looking
// over the shoulder plays back from its protocol exactly like one without.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../../src/core/state.js';
import { stepSimulation } from '../../src/sim/step.js';
import { requestSalvo, chooseSelection } from '../../src/sim/actions.js';
import { toggleZone } from '../../src/sim/zones.js';
import { buySupply } from '../../src/sim/economy.js';
import { selectionOptions } from '../../src/sim/selection.js';
import { setLives } from '../../src/sim/debug.js';
import { startLog } from '../../src/sim/record.js';
import { replayMatch } from '../../src/sim/replay.js';
import { RULESET_VERSION } from '../../src/data/rules.js';
import { SIM_STEP } from '../../src/data/settings.js';
import { STRINGS } from '../../src/data/strings.js';
import {
  STEPS,
  STAGE_DONE,
  createFlow,
  stageOf,
  readFacts,
  findMerge,
  pickSpot,
  placeCard,
  stepText,
  stepNeed,
} from '../../src/ui/tutorial.js';

const IDS = ['welcome', 'route', 'spot', 'salvo', 'card', 'keep', 'tempo', 'req', 'buy', 'spot2', 'salvo2', 'pick', 'act', 'end'];

/** Facts as the game would give them; only what a test names differs from the quiet default. */
const facts = (over = {}) => ({
  phase: 'planning',
  wave: 0,
  zones: 0,
  towers: 0,
  supply: 1,
  speed: 1,
  canBuy: false,
  merge: null,
  ...over,
});

// ---------------------------------------------------------------- The table

test('the steps run in the order of the study, with the purchase of round 2 added', () => {
  assert.deepEqual(STEPS.map((s) => s.id), IDS);
  assert.equal(STEPS.length, 14, 'the study had 13, the purchase makes 14');
  assert.deepEqual(STEPS.map((s) => s.round), [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2]);
});

test('the stages only ever grow along the steps', () => {
  for (let i = 1; i < STEPS.length; i++) assert.ok(STEPS[i].stage >= STEPS[i - 1].stage, STEPS[i].id);
  assert.ok(STEPS.at(-1).stage < STAGE_DONE);
});

test('every step has its words, short, in German, without a long dash', () => {
  for (const step of STEPS) {
    const t = STRINGS.tutorial.steps[step.id];
    assert.ok(t, `${step.id} has texts`);
    for (const merge of [null, { anchor: 1, doctrine: 'laser', actionIndex: 1 }]) {
      const text = stepText(step, facts({ merge }));
      assert.ok(typeof text === 'string' && text.length > 8 && text.length < 160, `${step.id}: ${text}`);
      assert.ok(!/[—–]/.test(text), `${step.id}: no dash`);
      const need = stepNeed(step, facts({ merge }));
      // A step with a condition tells what to do; one without has a button instead.
      if (step.done) assert.ok(need.length > 3, `${step.id} says what to do`);
      else assert.equal(need, '', `${step.id} has a button`);
    }
  }
  for (const word of [STRINGS.tutorial.skip, STRINGS.tutorial.next, STRINGS.tutorial.last, STRINGS.settings.tutorialReset]) {
    assert.ok(word.length > 2 && !/[—–]/.test(word));
  }
});

test('the two wordings of the capsule steps name the pair when there is one', () => {
  const pick = STEPS.find((s) => s.id === 'pick');
  const merge = { anchor: 3, doctrine: 'laser', actionIndex: 1 };
  assert.match(stepText(pick, facts({ merge })), /Laser/);
  assert.deepEqual(pick.target(facts({ merge })), { id: 'card', index: 3 });
  assert.deepEqual(pick.target(facts()), { id: 'cards' });
  const act = STEPS.find((s) => s.id === 'act');
  assert.deepEqual(act.target(facts({ merge })), { id: 'action', index: 1 });
  assert.deepEqual(act.target(facts()), { id: 'action', index: 0 }, 'without a pair it is the first button, keep');
});

// ---------------------------------------------------------------- Stages

test('the stage follows phase and wave', () => {
  const at = (phase, wave) => stageOf(facts({ phase, wave }));
  assert.equal(at('planning', 0), 0);
  assert.equal(at('salvo', 0), 0, 'the capsules coming down still belong to the planning');
  assert.equal(at('selection', 0), 1);
  assert.equal(at('wave', 1), 2);
  assert.equal(at('planning', 1), 3);
  assert.equal(at('selection', 1), 4);
  assert.equal(at('wave', 2), 5);
  assert.equal(at('planning', 2), 6);
  assert.equal(at('selection', 2), STAGE_DONE, 'a third round is not the tutorial\'s any more');
  assert.equal(at('defeat', 1), STAGE_DONE);
  assert.equal(at('victory', 9), STAGE_DONE);
});

// ---------------------------------------------------------------- The flow

/** What the player does at each point of a clean walk, as the facts the game would then show. */
function walk(flow, { canBuy = true, merge = { anchor: 1, doctrine: 'laser', actionIndex: 1 } } = {}) {
  const seen = [];
  const at = (f, taps = []) => {
    const shown = flow.update(f, taps);
    if (shown && seen.at(-1) !== shown.step.id) seen.push(shown.step.id);
    return shown;
  };
  // Round 1
  assert.equal(at(facts()).step.id, 'welcome');
  assert.ok(flow.next());
  assert.equal(at(facts()).step.id, 'route');
  assert.ok(flow.next());
  assert.equal(at(facts()).step.id, 'spot');
  assert.equal(at(facts({ zones: 1 })).step.id, 'salvo');
  assert.equal(at(facts({ zones: 6, phase: 'salvo' })), null, 'nothing to show while the capsules come down');
  assert.equal(at(facts({ zones: 6, phase: 'selection' })).step.id, 'card');
  assert.equal(at(facts({ zones: 6, phase: 'selection' }), ['card']).step.id, 'keep');
  assert.equal(at(facts({ phase: 'wave', wave: 1, towers: 1 })).step.id, 'tempo');
  assert.equal(at(facts({ phase: 'wave', wave: 1, towers: 1, speed: 2 })), null, 'no step while the wave runs on');
  // Round 2
  const round2 = facts({ wave: 1, towers: 1, canBuy });
  assert.equal(at(round2).step.id, 'req');
  assert.ok(flow.next());
  if (canBuy) {
    assert.equal(at(round2).step.id, 'buy');
    assert.equal(at({ ...round2, supply: 2 }).step.id, 'spot2');
  } else {
    assert.equal(at(round2).step.id, 'spot2', 'without the price the purchase is left out');
  }
  assert.equal(at({ ...round2, supply: 2, zones: 1 }).step.id, 'salvo2');
  const pick = facts({ wave: 1, towers: 1, phase: 'selection', merge });
  assert.equal(at(pick).step.id, 'pick');
  assert.equal(at(pick, ['card']).step.id, 'act');
  assert.equal(at(facts({ wave: 2, towers: 2, phase: 'wave' })), null, 'the last word waits until the wave is over');
  const over = facts({ wave: 2, towers: 2 });
  assert.equal(at(over).step.id, 'end');
  assert.ok(flow.next());
  assert.equal(flow.finished, true);
  return seen;
}

test('a clean walk goes through every step once, in order', () => {
  assert.deepEqual(walk(createFlow()), IDS);
});

test('without the price for supply the purchase is skipped, and nothing else changes', () => {
  assert.deepEqual(walk(createFlow(), { canBuy: false }), IDS.filter((id) => id !== 'buy'));
});

test('without a pair of capsules the round 2 steps keep to a plain choice', () => {
  const flow = createFlow();
  const seen = walk(flow, { merge: null });
  assert.deepEqual(seen, IDS, 'the same steps, the words and targets differ');
});

test('a step with a condition does not take the Weiter button, one without does not take a condition', () => {
  const flow = createFlow();
  flow.update(facts());
  flow.next();
  flow.update(facts());
  flow.next();
  assert.equal(flow.update(facts()).step.id, 'spot');
  assert.equal(flow.next(), false, 'the field has to be tapped');
  assert.equal(flow.step.id, 'spot');
});

test('nothing is shown before a step may be: the capsule steps wait for the capsule choice', () => {
  const flow = createFlow();
  assert.equal(flow.update(facts({ phase: 'selection', zones: 6 }))?.step.id, 'card', 'the earlier steps are outrun');
  const late = createFlow();
  assert.equal(late.update(facts({ phase: 'wave', wave: 1 }))?.step.id, 'tempo');
});

test('a step the player has outrun drops out instead of hanging (a key called the salvo)', () => {
  const flow = createFlow();
  assert.equal(flow.update(facts())?.step.id, 'welcome');
  // Enter on the keyboard: the salvo is called behind the dimmed screen and the choice is made.
  const shown = flow.update(facts({ phase: 'selection', zones: 6 }));
  assert.equal(shown?.step.id, 'card');
  assert.equal(flow.update(facts({ phase: 'wave', wave: 1, towers: 1 }))?.step.id, 'tempo');
  assert.equal(flow.update(facts({ wave: 1, towers: 1 }))?.step.id, 'req');
});

test('a third round, a defeat or a victory ends the walk', () => {
  for (const over of [facts({ wave: 3 }), facts({ phase: 'defeat', wave: 1 }), facts({ phase: 'victory', wave: 50 })]) {
    const flow = createFlow();
    flow.update(facts());
    assert.equal(flow.update(over), null);
    assert.equal(flow.finished, true);
  }
});

test('skipping ends the walk at any step', () => {
  for (let at = 0; at < 5; at++) {
    const flow = createFlow();
    for (let i = 0; i < at; i++) {
      flow.update(facts());
      flow.next();
    }
    flow.skip();
    assert.equal(flow.finished, true);
    assert.equal(flow.step, null);
    assert.equal(flow.update(facts()), null, 'and it stays over');
  }
});

test('a step already true when it comes up is not shown', () => {
  const flow = createFlow();
  const f = facts({ phase: 'wave', wave: 1, speed: 3 });
  assert.equal(flow.update(f), null, 'the wave already runs at 3x, nobody needs telling');
  assert.equal(flow.index, STEPS.findIndex((s) => s.id === 'req'), 'it went on to the next step');
});

// ---------------------------------------------------------------- Reading a real match

const SEED = 'NACHSPIEL';

function runUntil(state, until, maxSeconds = 600, onStep = null) {
  const steps = Math.round(maxSeconds / SIM_STEP);
  for (let i = 0; i < steps; i++) {
    stepSimulation(state, SIM_STEP);
    onStep?.(state);
    if (until(state)) return true;
  }
  return false;
}

test('the field it lights is a free cell of the route that makes the way longer', () => {
  const state = createGameState(SEED);
  const spot = pickSpot(state, { fraction: 0.5 });
  assert.ok(spot, 'a field was found');
  const before = state.route.length;
  assert.equal(toggleZone(state, spot).ok, true, 'it can be marked');
  assert.ok(state.zonePreview.length > before, `the route grows: ${before} to ${state.zonePreview.length}`);
});

test('the field respects what the screen can reach', () => {
  const state = createGameState(SEED);
  const first = pickSpot(state);
  const other = pickSpot(state, { usable: (c) => c.x !== first.x || c.y !== first.y });
  assert.ok(other);
  assert.notDeepEqual(other, first);
  assert.equal(pickSpot(state, { usable: () => false }), null, 'nothing reachable, nothing to light');
});

test('looking changes nothing: facts, merge and spot leave the state exactly as it was', () => {
  const state = createGameState(SEED);
  const snapshot = () => JSON.stringify(state);
  const before = snapshot();
  readFacts(state);
  pickSpot(state);
  assert.equal(snapshot(), before, 'planning');
  toggleZone(state, pickSpot(state));
  assert.ok(requestSalvo(state));
  assert.ok(runUntil(state, (s) => s.phase === 'selection', 60));
  const mid = snapshot();
  const merge = findMerge(state);
  readFacts(state, merge);
  assert.equal(snapshot(), mid, 'capsule choice');
  if (merge) {
    const options = selectionOptions(state);
    assert.ok(options.merges.some((m) => m.anchors.includes(merge.anchor)), 'the pair is in the salvo');
    assert.ok(Number.isInteger(merge.actionIndex) && merge.actionIndex >= 1, 'after the keep button');
  }
});

/**
 * One match, played by the same decisions every time. With a `watch`, the tutorial
 * looks at the state after every simulation step and after every decision.
 */
function play({ watch = null } = {}) {
  const state = createGameState(SEED);
  startLog(state, RULESET_VERSION, 1);
  const look = () => watch?.(state);
  for (let round = 0; round < 3; round++) {
    look();
    while (buySupply(state).ok);
    const spot = pickSpot(state, { fraction: round === 0 ? 0.5 : 0.35 });
    if (spot) toggleZone(state, spot);
    look();
    if (!requestSalvo(state)) break;
    assert.ok(runUntil(state, (s) => s.phase === 'selection', 60, look));
    const options = selectionOptions(state);
    const keep = options.keep[options.keep.length - 1];
    assert.ok(chooseSelection(state, { type: 'keep', anchor: keep.anchors[0] }).ok);
    setLives(state, 200);
    assert.ok(runUntil(state, (s) => s.phase !== 'wave', 600, look));
    if (state.phase === 'defeat' || state.phase === 'victory') break;
    runUntil(state, (s) => s.phase === 'planning', 10, look);
  }
  return state;
}

test('a match with the tutorial looking on plays exactly like one without, and replays from its protocol', () => {
  const plain = play();

  const flow = createFlow();
  const shown = [];
  let cache = null;
  const tutorial = play({
    watch(state) {
      if (state.phase === 'selection') cache ??= findMerge(state);
      else cache = null;
      const f = readFacts(state, cache);
      const now = flow.update(f, []);
      // The player would press Weiter on the steps that have no condition of their own.
      if (now && !now.step.done) flow.next();
      if (now && shown.at(-1) !== now.step.id) shown.push(now.step.id);
    },
  });

  assert.ok(shown.length >= 8, `the tutorial followed the match: ${shown.join(', ')}`);
  for (const id of ['welcome', 'route', 'card', 'tempo', 'req', 'pick', 'end']) assert.ok(shown.includes(id), `${id} was shown: ${shown}`);
  assert.equal(flow.finished, true, 'and walked it to the end');

  assert.equal(JSON.stringify(tutorial.log), JSON.stringify(plain.log), 'the same protocol, action for action');
  assert.equal(tutorial.lives, plain.lives);
  assert.equal(tutorial.kills, plain.kills);
  assert.equal(tutorial.requisition, plain.requisition);
  assert.equal(tutorial.time, plain.time);
  assert.equal(JSON.stringify(tutorial.towers), JSON.stringify(plain.towers));

  const run = replayMatch(tutorial.log);
  assert.equal(run.skipped.length, 0, `nothing was skipped: ${JSON.stringify(run.skipped)}`);
  assert.deepEqual(run.waves, tutorial.log.waves, 'the replay gives the wave line the match gave');
});

// ---------------------------------------------------------------- The card

const VIEW = { w: 390, h: 844 };
const CARD = { w: 300, h: 150 };
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const rect = (p) => ({ x: p.x, y: p.y, w: CARD.w, h: CARD.h });
const inside = (r, view = VIEW) => r.x >= 0 && r.y >= 0 && r.x + r.w <= view.w && r.y + r.h <= view.h;

test('the card stays inside the picture and clear of what is lit, wherever that is', () => {
  const views = [VIEW, { w: 844, h: 390 }, { w: 1180, h: 820 }];
  for (const view of views) {
    for (const fx of [0.05, 0.3, 0.5, 0.8, 0.95]) {
      for (const fy of [0.08, 0.3, 0.5, 0.75, 0.95]) {
        const hole = { x: view.w * fx - 25, y: view.h * fy - 22, w: 50, h: 44 };
        const hole2 = { ...hole, x: Math.min(Math.max(hole.x, 0), view.w - 50), y: Math.min(Math.max(hole.y, 0), view.h - 44) };
        const at = placeCard(hole2, null, CARD, view);
        assert.ok(inside(rect(at), view), `inside: ${JSON.stringify([view, hole2, at])}`);
        assert.ok(!overlaps(rect(at), hole2), `clear of the lit element: ${JSON.stringify([view, hole2, at])}`);
      }
    }
  }
});

test('the card keeps off the whole sheet when the lit button is part of one', () => {
  const view = { w: 844, h: 390 };
  const sheet = { x: 524, y: 0, w: 320, h: 390 };
  const hole = { x: 531, y: 213, w: 308, h: 50 };
  const at = placeCard(hole, sheet, CARD, view);
  assert.ok(!overlaps(rect(at), sheet), 'beside the sheet, not on it');
  const tall = { w: 390, h: 844 };
  const sheet2 = { x: 0, y: 611, w: 390, h: 233 };
  const at2 = placeCard({ x: 7, y: 689, w: 376, h: 50 }, sheet2, CARD, tall);
  assert.ok(!overlaps(rect(at2), sheet2), 'above the sheet');
  assert.ok(inside(rect(at2), tall));
});

test('without anything lit the card sits in the upper middle', () => {
  const at = placeCard(null, null, CARD, VIEW);
  assert.ok(inside(rect(at)));
  assert.ok(at.y < VIEW.h / 2);
});

test('the safe margins are kept', () => {
  const at = placeCard({ x: 100, y: 400, w: 50, h: 44 }, null, CARD, VIEW, { top: 60, bottom: 40, side: 20 });
  assert.ok(at.y >= 60 && at.y + CARD.h <= VIEW.h - 40 && at.x >= 20 && at.x + CARD.w <= VIEW.w - 20);
});
