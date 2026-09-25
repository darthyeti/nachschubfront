// The three states of a rune disc (docs/ART.md, "Runenscheiben-Knopf"), read
// off a real command status so the HUD and the simulation cannot drift apart.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGameState } from '../../src/core/state.js';
import { commandStatus } from '../../src/sim/commands.js';
import { commandFace } from '../../src/ui/runeButton.js';
import { COMMANDS, commandById } from '../../src/data/commands.js';
import { ICONS } from '../../src/ui/icons.js';

/** The orbital strike is a wave-phase command, so that is where it is usable. */
function atWave(wave, phase = 'wave') {
  const state = createGameState('RUNE');
  state.wave = wave;
  state.phase = phase;
  state.commandPoints = 99;
  return state;
}

test('a command before its wave shows a lock and the wave it arrives in', () => {
  const state = atWave(1);
  const face = commandFace(commandStatus(state, 'orbitalStrike'));
  assert.equal(face.state, 'locked');
  assert.equal(face.badge, String(commandById('orbitalStrike').fromWave));
  assert.equal(face.enabled, false);
});

test('an unlocked command shows its price and can be pressed', () => {
  const state = atWave(15);
  const face = commandFace(commandStatus(state, 'orbitalStrike'));
  assert.equal(face.state, 'ready');
  assert.equal(face.note, String(commandById('orbitalStrike').cost));
  assert.equal(face.enabled, true);
  assert.equal(face.badge, undefined);
});

test('an empty purse greys the disc out but leaves it ready', () => {
  const state = atWave(15);
  state.commandPoints = 0;
  const face = commandFace(commandStatus(state, 'orbitalStrike'));
  assert.equal(face.state, 'ready');
  assert.equal(face.enabled, false);
});

test('a used command counts its waves down and shrinks its wedge', () => {
  const command = commandById('orbitalStrike');
  const state = atWave(15);
  state.commandUses[command.id] = 15;
  const first = commandFace(commandStatus(state, 'orbitalStrike'));
  assert.equal(first.state, 'cooldown');
  assert.equal(first.waves, command.cooldownWaves);
  assert.equal(first.fraction, 1);

  state.wave = 15 + command.cooldownWaves - 1;
  const later = commandFace(commandStatus(state, 'orbitalStrike'));
  assert.equal(later.waves, 1);
  assert.ok(later.fraction < first.fraction, 'the wedge shrinks as the wait runs out');
  assert.ok(later.fraction > 0);
});

test('every command has a symbol of its own', () => {
  const seen = new Set();
  for (const command of COMMANDS) {
    assert.ok(ICONS[command.id], `no symbol for ${command.id}`);
    assert.equal(seen.has(ICONS[command.id]), false, `${command.id} reuses another symbol`);
    seen.add(ICONS[command.id]);
  }
});
