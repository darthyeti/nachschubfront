// Plays a whole match with a simple player and prints one line per wave.
// A measuring tool for balancing (M3/M6), not a test.
//
//   node tests/tools/playmatch.mjs [seed] [--supply N] [--protocol <datei.json>]
//
// With --protocol the match is written out as a recorded protocol, the same
// format the game exports. That is what `npm run replay` reads, so the replay
// and the tools around it can be worked on before the first match played by
// hand arrives. A bot is not a measurement — this player places its zones by a
// rule — but it is a real match, and the replay cannot tell the difference.

import { createGameState } from '../../src/core/state.js';
import { requestSalvo, chooseSelection } from '../../src/sim/actions.js';
import { toggleZone } from '../../src/sim/zones.js';
import { buySupply } from '../../src/sim/economy.js';
import { zoneLimit } from '../../src/sim/zones.js';
import { selectionOptions } from '../../src/sim/selection.js';
import { stepSimulation } from '../../src/sim/step.js';
import { totalWaves } from '../../src/sim/waves.js';
import { SIM_STEP } from '../../src/data/settings.js';
import { STRINGS } from '../../src/data/strings.js';
import { WAVES } from '../../src/data/waves.js';
import { startLog } from '../../src/sim/record.js';
import { RULESET_VERSION } from '../../src/data/rules.js';
import { exportProtocol } from '../../src/storage/protocol.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const seed = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'BASTION';
const supplyArg = process.argv.indexOf('--supply');
const supply = supplyArg > 0 ? Number(process.argv[supplyArg + 1]) : 1;

const protocolArg = process.argv.indexOf('--protocol');
const protocolFile = protocolArg > 0 ? process.argv[protocolArg + 1] : null;

const state = createGameState(seed);
state.supplyLevel = supply;
startLog(state, RULESET_VERSION, 1);

function run(until, maxSeconds = 300) {
  const steps = Math.round(maxSeconds / SIM_STEP);
  for (let i = 0; i < steps; i++) {
    stepSimulation(state, SIM_STEP);
    if (until()) return true;
  }
  return false;
}

/**
 * What the player would take, best first: a recipe, else the largest merge,
 * else a kept capsule. Every capsule is offered as a fallback, because a choice
 * can be refused for a reason this bot does not look at — building on a heap of
 * rubble costs the demolition, and the bot spends everything on supply levels.
 * Before M6 that threw and ended the run on some seeds.
 */
function choices() {
  const options = selectionOptions(state);
  const wanted = [];
  for (const recipe of options.recipes) {
    wanted.push({ type: 'recipe', recipeId: recipe.recipeId, anchor: recipe.anchors[0] });
  }
  for (const merge of [...options.merges].sort((a, b) => b.size - a.size)) {
    wanted.push({ type: 'merge', size: merge.size, anchor: merge.anchors[0] });
  }
  for (const keep of options.keep) wanted.push({ type: 'keep', anchor: keep.anchors[0] });
  return wanted;
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
    if (state.zones.length >= zoneLimit(state)) return;
    for (const off of offsets) {
      const cell = { x: route.cells[i].x + off.x, y: route.cells[i].y + off.y };
      if (toggleZone(state, cell).ok) break;
    }
  }
}

console.log(`Seed ${seed}, supply level ${supply}`);
for (let round = 0; round < totalWaves(); round++) {
  // Spend everything on the supply level, the only thing worth saving for.
  while (buySupply(state).ok);
  markZones();
  if (!requestSalvo(state)) break;
  run(() => state.phase === 'selection', 60);
  let result = { ok: false, reason: 'nothing on offer' };
  for (const choice of choices()) {
    result = chooseSelection(state, choice);
    if (result.ok) break;
  }
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
      `Stellungen ${String(towers).padStart(2)} · Nachschub ${state.supplyLevel} · ` +
      `Requisition ${String(state.requisition).padStart(4)} · KP ${state.commandPoints}`,
  );
  if (state.phase === 'defeat' || state.phase === 'victory') break;
  run(() => state.phase === 'planning', 10);
}
console.log(`Ende in Phase ${state.phase} bei Welle ${state.wave}, Leben ${state.lives}`);

if (protocolFile) {
  mkdirSync(dirname(protocolFile), { recursive: true });
  writeFileSync(protocolFile, `${JSON.stringify(exportProtocol(state.log), null, 2)}\n`);
  console.log(`Protokoll: ${protocolFile} (${state.log.actions.length} Aktionen, ${state.log.waves.length} Wellen)`);
}
