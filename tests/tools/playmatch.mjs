// Plays a whole match with a simple player and prints one line per wave.
// A measuring tool for balancing (M3/M6), not a test.
//
//   node tests/tools/playmatch.mjs [seed] [--supply N]

import { createGameState } from '../../src/core/state.js';
import { requestSalvo, chooseSelection } from '../../src/sim/actions.js';
import { toggleZone } from '../../src/sim/zones.js';
import { PODS } from '../../src/data/pods.js';
import { selectionOptions } from '../../src/sim/selection.js';
import { stepSimulation } from '../../src/sim/step.js';
import { totalWaves } from '../../src/sim/waves.js';
import { SIM_STEP } from '../../src/data/settings.js';
import { STRINGS } from '../../src/data/strings.js';
import { WAVES } from '../../src/data/waves.js';

const seed = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'BASTION';
const supplyArg = process.argv.indexOf('--supply');
const supply = supplyArg > 0 ? Number(process.argv[supplyArg + 1]) : 1;

const state = createGameState(seed);
state.supplyLevel = supply;

function run(until, maxSeconds = 300) {
  const steps = Math.round(maxSeconds / SIM_STEP);
  for (let i = 0; i < steps; i++) {
    stepSimulation(state, SIM_STEP);
    if (until()) return true;
  }
  return false;
}

/** Takes a recipe if one is offered, else the largest merge, else keeps a pod. */
function choose() {
  const options = selectionOptions(state);
  const recipe = options.recipes[0];
  if (recipe) return { type: 'recipe', recipeId: recipe.recipeId, anchor: recipe.anchors[0] };
  const merge = [...options.merges].sort((a, b) => b.size - a.size)[0];
  if (merge) return { type: 'merge', size: merge.size, anchor: merge.anchors[0] };
  return { type: 'keep', anchor: 0 };
}

/**
 * Marks landing zones the way a player would: next to the route, starting in
 * the middle of it, so the new tower can actually reach the enemies.
 */
function markZones() {
  const route = state.route;
  if (!route) return;
  const order = [...route.cells.keys()].sort(
    (a, b) => Math.abs(a - route.cells.length / 2) - Math.abs(b - route.cells.length / 2),
  );
  const offsets = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  for (const i of order) {
    if (state.zones.length >= PODS.perSalvo) return;
    for (const off of offsets) {
      const cell = { x: route.cells[i].x + off.x, y: route.cells[i].y + off.y };
      if (toggleZone(state, cell).ok) break;
    }
  }
}

console.log(`Seed ${seed}, supply level ${supply}`);
for (let round = 0; round < totalWaves(); round++) {
  markZones();
  if (!requestSalvo(state)) break;
  run(() => state.phase === 'selection', 60);
  const result = chooseSelection(state, choose());
  if (!result.ok) throw new Error(`selection refused: ${result.reason}`);
  const wave = state.wave;
  const def = WAVES[wave - 1];
  run(() => state.phase !== 'wave', 600);
  const { spawned, killed, leaked } = state.waveStats;
  const towers = state.towers.length;
  console.log(
    `Welle ${String(wave).padStart(2)} ${STRINGS.waveKinds[def.kind].padEnd(8)} ` +
      `Gegner ${String(spawned).padStart(3)} · tot ${String(killed).padStart(3)} · ` +
      `durch ${String(leaked).padStart(3)} · Leben ${String(state.lives).padStart(3)} · ` +
      `Stellungen ${String(towers).padStart(2)} · Requisition ${state.requisition}`,
  );
  if (state.phase === 'defeat' || state.phase === 'victory') break;
  run(() => state.phase === 'planning', 10);
}
console.log(`Ende in Phase ${state.phase} bei Welle ${state.wave}, Leben ${state.lives}`);
