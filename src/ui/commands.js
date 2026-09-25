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

const T = STRINGS.commandBar;

/**
 * Top to bottom, the order the player meets them in. Two commands that unlock
 * in the same wave keep the order of the data table.
 */
export function railOrder(commands = COMMANDS) {
  return commands.map((c, i) => [c, i]).sort((a, b) =>
    a[0].fromWave - b[0].fromWave || a[1] - b[1]).map(([c]) => c);
}

/** The line under a command's name: what stands between the player and using it. */
export function commandNote(status) {
  if (!status.unlocked) return T.fromWave(status.command.fromWave);
  if (!status.ready) return T.cooldown(status.wavesLeft);
  return T.cost(status.command.cost);
}

/**
 * @param {HTMLElement} root  the HUD layer; the rail places itself at the edge
 * @param {{onPick: (id: string) => void}} callbacks
 */
export function createCommandBar(root, { onPick }) {
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
      side: 'left',
      onClick: () => onPick(command.id),
    });
    disc.el.classList.add('interactive');
    panel.append(disc.el);
    return { command, disc };
  });

  root.append(panel);

  const cache = new Map();
  const set = (key, value, apply) => {
    if (cache.get(key) === value) return;
    cache.set(key, value);
    apply(value);
  };

  return {
    /** @param {object} ui  Render-side state; `commandTarget` is the command being aimed. */
    update(state, ui) {
      // Before the first unlock the rail would only be a row of padlocks.
      const anyUnlocked = currentWave(state) >= railOrder()[0].fromWave;
      const show = anyUnlocked && (state.phase === 'planning' || state.phase === 'wave');
      set('show', show, (v) => {
        panel.hidden = !v;
        if (!v) for (const { disc } of discs) disc.hideBubble();
      });
      if (!show) return;
      for (const { command, disc } of discs) {
        const face = commandFace(commandStatus(state, command.id));
        face.on = ui.commandTarget === command.id;
        disc.update(face);
      }
    },
  };
}
