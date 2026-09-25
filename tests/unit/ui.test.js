// The parts of the interface that can be checked without a browser: the three
// states of a rune disc, read off a real command status so the HUD and the
// simulation cannot drift apart; the order of the command rail; and what the
// seed field accepts (docs/ART.md, "HUD" and "Menüs außerhalb der Partie").

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGameState } from '../../src/core/state.js';
import { commandStatus } from '../../src/sim/commands.js';
import { commandFace } from '../../src/ui/runeButton.js';
import { COMMANDS, commandById } from '../../src/data/commands.js';
import { railOrder } from '../../src/ui/commands.js';
import { validateSeed, randomSeed } from '../../src/core/seed.js';
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

test('the rail runs top to bottom in the order the commands unlock', () => {
  const order = railOrder();
  assert.equal(order.length, COMMANDS.length, 'every command has a place');
  for (let i = 1; i < order.length; i++) {
    assert.ok(
      order[i].fromWave >= order[i - 1].fromWave,
      `${order[i].id} (wave ${order[i].fromWave}) sits below ${order[i - 1].id} (wave ${order[i - 1].fromWave})`,
    );
  }
  assert.equal(order[0].id, 'orbitalStrike', 'the first one the player ever gets is on top');
});

test('commands unlocking in the same wave keep the order of the table', () => {
  const same = COMMANDS.filter((c) => c.fromWave === 30).map((c) => c.id);
  const inRail = railOrder().filter((c) => c.fromWave === 30).map((c) => c.id);
  assert.deepEqual(inRail, same);
});

// ---------- Seed entry (docs/ART.md, "Menüs außerhalb der Partie") ----------

test('the seed field takes what a player can reasonably type', () => {
  assert.deepEqual(validateSeed('kol-7284-xt'), { ok: true, seed: 'KOL7284XT' });
  assert.deepEqual(validateSeed('  bastion '), { ok: true, seed: 'BASTION' });
  assert.deepEqual(validateSeed('A B 1 2'), { ok: true, seed: 'AB12' });
});

test('the seed field says what is wrong instead of taking it anyway', () => {
  assert.deepEqual(validateSeed(''), { ok: false, reason: 'empty' });
  assert.deepEqual(validateSeed('   '), { ok: false, reason: 'empty' });
  assert.deepEqual(validateSeed(null), { ok: false, reason: 'empty' });
  assert.equal(validateSeed('A'.repeat(25)).reason, 'long');
  const bad = validateSeed('hallo welt!');
  assert.equal(bad.reason, 'chars');
  assert.equal(bad.chars, '!', 'it names only what it refused');
});

test('a seed the game hands out passes its own check', () => {
  for (let i = 0; i < 50; i++) {
    const seed = randomSeed();
    assert.deepEqual(validateSeed(seed), { ok: true, seed });
  }
});
