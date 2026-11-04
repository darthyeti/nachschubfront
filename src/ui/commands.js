// The command rail (GDD section 11, docs/ART.md "Rechte Kommandoleiste"): the
// special commands as rune discs down the right edge, in the order they unlock.
// No text on them — a long press or the mouse opens the bubble.
//
// It shows itself only once the first command is within reach; before that it
// would be a column of padlocks.

import { STRINGS } from '../data/strings.js';
import { COMMANDS } from '../data/commands.js';
import { commandStatus, currentWave } from '../sim/commands.js';
import { el } from './controls.js';
import { createRuneButton, commandFace } from './runeButton.js';
import { commandCalls } from './nudges.js';
import { STRINGS as S } from '../data/strings.js';

const T = STRINGS.commandBar;

/**
 * Top to bottom, the order the player meets them in. Two commands that unlock
 * in the same wave keep the order of the data table.
 */
export function railOrder(commands = COMMANDS) {
  return commands.map((c, i) => [c, i]).sort((a, b) =>
    a[0].fromWave - b[0].fromWave || a[1] - b[1]).map(([c]) => c);
}

/**
 * Whether the rail is on screen: once the first command is within reach, in the
 * planning and in the wave. Before that it would only be a column of padlocks.
 */
export function railVisible(state) {
  const anyUnlocked = currentWave(state) >= railOrder()[0].fromWave;
  return anyUnlocked && (state.phase === 'planning' || state.phase === 'wave');
}

/**
 * Whether the command points are on the status bar: from the wave the first
 * command unlocks in, or as soon as there are points to show. Before that the
 * plate would count something there is nothing to spend on; its appearance is
 * the unlock effect's moment (ui/burst.js).
 */
export function pointsVisible(state) {
  return state.commandPoints > 0 || currentWave(state) >= railOrder()[0].fromWave;
}

/**
 * The commands that have just unlocked, from what was unlocked at the last look.
 * Read off the state, not off an event of the simulation: the wave reached
 * `fromWave`. The first look only sets the baseline, so a match that is loaded
 * at wave 20 does not go off like a bomb.
 *
 * @param {Map<string, boolean>} seen  id to unlocked, updated in place
 * @param {(id: string) => boolean} unlocked
 * @returns {string[]}
 */
export function newlyUnlocked(seen, unlocked, commands = COMMANDS) {
  const fresh = [];
  for (const { id } of commands) {
    const now = unlocked(id);
    if (seen.size > 0 && seen.get(id) === false && now) fresh.push(id);
    seen.set(id, now);
  }
  return fresh;
}

/** The line under a command's name: what stands between the player and using it. */
export function commandNote(status) {
  if (!status.unlocked) return T.fromWave(status.command.fromWave);
  if (!status.ready) return T.cooldown(status.wavesLeft);
  return T.cost(status.command.cost);
}

/**
 * @param {HTMLElement} root  the HUD layer; the rail places itself at the edge
 * @param {{onPick: (id: string) => void, onUnlock?: () => void}} callbacks
 *        `onUnlock` is for the sound that goes with the bang
 */
export function createCommandBar(root, { onPick, onUnlock = () => {} }) {
  const panel = el('div', 'command-rail');
  panel.hidden = true;
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', T.title);

  const discs = railOrder().map((command) => {
    const texts = STRINGS.commands[command.id];
    const disc = createRuneButton({
      iconName: command.id,
      label: texts.name,
      hint: texts.effect,
      caption: S.iconLabels[command.id],
      side: 'left',
      onClick: () => onPick(command.id),
    });
    disc.el.classList.add('interactive');
    panel.append(disc.el);
    return { command, disc };
  });

  root.append(panel);

  const seen = new Map();
  /** Unlocked while the rail was not on screen; they go off once it is. */
  const waiting = new Set();
  const cache = new Map();
  const set = (key, value, apply) => {
    if (cache.get(key) === value) return;
    cache.set(key, value);
    apply(value);
  };

  return {
    /** @param {object} ui  Render-side state; `commandTarget` is the command being aimed. */
    update(state, ui) {
      for (const id of newlyUnlocked(seen, (c) => commandStatus(state, c).unlocked)) waiting.add(id);
      const show = railVisible(state);
      set('show', show, (v) => {
        panel.hidden = !v;
        if (!v) for (const { disc } of discs) disc.hideBubble();
      });
      if (!show) return;
      let fired = false;
      for (const { command, disc } of discs) {
        if (waiting.delete(command.id)) {
          disc.celebrate();
          fired = true;
        }
        const status = commandStatus(state, command.id);
        const face = commandFace(status);
        face.on = ui.commandTarget === command.id;
        face.calling = !face.on && commandCalls(state, status);
        disc.update(face);
      }
      // One sound for the lot: commands that unlock in the same wave go off together.
      if (fired) onUnlock();
    },
  };
}
