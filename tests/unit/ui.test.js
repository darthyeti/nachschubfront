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
import { railOrder, pointsVisible, newlyUnlocked } from '../../src/ui/commands.js';
import { sheetSections, commandMeta } from '../../src/ui/help.js';
import { STRINGS } from '../../src/data/strings.js';
import { validateSeed, randomSeed } from '../../src/core/seed.js';
import { ICONS } from '../../src/ui/icons.js';
import { doomArrowPoints } from '../../src/render/scene.js';
import { RATED_WAVES, isRatedWave } from '../../src/data/rules.js';
import { WAVES } from '../../src/data/waves.js';

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

// ---------- The arrow over an emplacement a recipe would eat ----------
//
// On the map alone the gold ring around a distant bunker is easy to miss
// (feedback from the iPad), so every doomed emplacement gets an arrow over it.
// The shape is checked here because a canvas cannot be.

test('the arrow hangs above the emplacement and points down at it', () => {
  const anchor = [400, 300];
  const points = doomArrowPoints(anchor, 0, true);
  const ys = points.map(([, y]) => y);
  const tip = points[0];
  assert.equal(tip[0], anchor[0], 'the tip is over the middle of the figure');
  assert.equal(Math.max(...ys), tip[1], 'and is the lowest point, so the arrow points down');
  for (const [, y] of points) {
    assert.ok(y < anchor[1], `every point is above the anchor (${y} vs ${anchor[1]})`);
  }
  // Symmetric about the figure: the widest point left and right are mirrored.
  const xs = points.map(([x]) => x);
  assert.equal(Math.max(...xs) - anchor[0], anchor[0] - Math.min(...xs));
});

test('the arrow bobs, and stands still when motion is not wanted', () => {
  const anchor = [0, 0];
  const at = (t, reduced) => doomArrowPoints(anchor, t, reduced)[0][1];
  assert.notEqual(at(0.3, false), at(0.9, false), 'it moves over time');
  assert.equal(at(0.3, true), at(0.9, true), 'prefers-reduced-motion holds it still');
  // However far it swings, it never drops onto the figure.
  for (let t = 0; t < 6; t += 0.05) assert.ok(at(t, false) < anchor[1]);
});

// ---------- The symbol sheet ----------

test('every row of the symbol sheet has a symbol that exists and words to go with it', () => {
  const sections = sheetSections();
  assert.equal(sections.length, 4);
  for (const section of sections) {
    assert.ok(section.title && section.rows.length > 0, section.title);
    for (const row of section.rows) {
      assert.ok(ICONS[row.icon], `${row.icon} has a drawing`);
      assert.ok(row.name && row.text, `${row.icon} has name and text`);
    }
  }
});

test('the sheet lists every command, in the order of the rail, with its numbers', () => {
  const rows = sheetSections().find((s) => s.rows.some((r) => r.meta)).rows;
  assert.deepEqual(rows.map((r) => r.icon), railOrder().map((c) => c.id));
});

test('every symbol of the new set is in the game and has a caption for under its disc', () => {
  for (const name of Object.keys(STRINGS.iconLabels)) assert.ok(ICONS[name], `${name} has no drawing`);
  for (const name of ['wave', 'lives', 'requisition', 'points', 'route', 'supply', 'demolish', 'bulwark',
    'upgrade', 'salvo', 'codex', 'menu', 'help', 'tempo-0', 'tempo-1', 'tempo-2', 'tempo-3', 'orbitalStrike',
    'stasisField', 'prioritySupply', 'holyBanner', 'airstrike', 'lock', 'close']) {
    assert.ok(ICONS[name], `${name} is missing`);
    assert.ok(STRINGS.iconLabels[name], `${name} has no label`);
  }
});

test('a command bubble takes its numbers from the command data', () => {
  for (const command of COMMANDS) {
    const meta = commandMeta(command);
    assert.ok(meta.includes(`${command.cost} KP`), meta);
    assert.ok(meta.includes(`ab Welle ${command.fromWave}`), meta);
    assert.ok(meta.includes(String(command.cooldownWaves)), meta);
  }
});

test('the rating line asks at ten waves, not at fifty', () => {
  // Asking after every wave stopped working: in the match of 01.10.2026 all 49
  // answers were "passt", covering reserves from -9 % to 967 %. The sample is
  // the fix, so what it covers is worth pinning down.
  assert.equal(RATED_WAVES.length, 10);
  assert.ok(RATED_WAVES.every((w) => Number.isInteger(w) && w >= 1 && w <= WAVES.length));
  assert.deepEqual([...RATED_WAVES].sort((a, b) => a - b), RATED_WAVES, 'in wave order');
  assert.equal(new Set(RATED_WAVES).size, RATED_WAVES.length, 'no wave twice');

  // It has to reach every stretch the tuning tells apart, or a round cannot say
  // which of them is wrong: the opening, the middle band, and the late game.
  assert.ok(RATED_WAVES.includes(1), 'the one genuinely tight wave');
  assert.ok(RATED_WAVES.some((w) => w >= 8 && w <= 19), 'the stretch round 3 lifted');
  assert.ok(RATED_WAVES.some((w) => w >= 20 && w <= 30), 'the end of the band');
  assert.ok(RATED_WAVES.some((w) => w >= 35), 'the late game');

  assert.ok(isRatedWave(RATED_WAVES[0]));
  assert.ok(!isRatedWave(2), 'and it really does skip the rest');
});

// ---------- The unlock effect ----------

test('the command points show from the wave of the first command, or with points in hand', () => {
  const first = railOrder()[0].fromWave;
  const at = (wave, phase, commandPoints = 0) => pointsVisible({ wave, phase, commandPoints });
  assert.equal(at(1, 'planning'), false);
  assert.equal(at(first - 2, 'planning'), false);
  // In planning the wave counted is the one being prepared.
  assert.equal(at(first - 1, 'planning'), true);
  assert.equal(at(first, 'wave'), true);
  assert.equal(at(3, 'planning', 2), true, 'points earned stay on the bar');
});

test('a command goes off when the state says it unlocked, not on the first look', () => {
  const seen = new Map();
  const unlockedAt = (wave) => (id) => wave >= COMMANDS.find((c) => c.id === id).fromWave;
  assert.deepEqual(newlyUnlocked(seen, unlockedAt(20)), [], 'a match loaded far on is only the baseline');
  const fresh = new Map();
  assert.deepEqual(newlyUnlocked(fresh, unlockedAt(1)), []);
  assert.deepEqual(newlyUnlocked(fresh, unlockedAt(14)), []);
  const ids = (wave) => COMMANDS.filter((c) => c.fromWave === wave).map((c) => c.id);
  assert.deepEqual(newlyUnlocked(fresh, unlockedAt(15)), ids(15));
  assert.deepEqual(newlyUnlocked(fresh, unlockedAt(15)), [], 'once');
  assert.deepEqual(newlyUnlocked(fresh, unlockedAt(30)).sort(), COMMANDS.filter((c) => c.fromWave > 15).map((c) => c.id).sort());
});
