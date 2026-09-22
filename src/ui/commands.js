// Command bar (GDD section 11): the four special commands with their price,
// their unlock wave and their cooldown. Sits above the bottom bar, in thumb
// reach, and only shows itself once the first command is within reach.

import { STRINGS } from '../data/strings.js';
import { COMMANDS } from '../data/commands.js';
import { commandStatus, currentWave } from '../sim/commands.js';

const T = STRINGS.commandBar;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The line under a command's name: what stands between the player and using it. */
export function commandNote(status) {
  if (!status.unlocked) return T.fromWave(status.command.fromWave);
  if (!status.ready) return T.cooldown(status.wavesLeft);
  if (!status.affordable) return T.cost(status.command.cost);
  return T.cost(status.command.cost);
}

/**
 * @param {HTMLElement} root
 * @param {{onPick: (id: string) => void}} callbacks
 */
export function createCommandBar(root, { onPick }) {
  const panel = el('div', 'commands interactive');
  panel.hidden = true;
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', T.title);

  const buttons = COMMANDS.map((command) => {
    const button = el('button', 'command alt');
    button.type = 'button';
    const name = el('span', 'command-name', STRINGS.commands[command.id].name);
    const note = el('span', 'command-note');
    button.append(name, note);
    button.title = STRINGS.commands[command.id].effect;
    button.addEventListener('click', () => {
      onPick(command.id);
      button.blur();
    });
    panel.append(button);
    return { command, button, note };
  });

  root.prepend(panel);

  const cache = new Map();
  const set = (key, value, apply) => {
    if (cache.get(key) === value) return;
    cache.set(key, value);
    apply(value);
  };

  return {
    /** @param {object} ui  Render-side state; `commandTarget` is the command being aimed. */
    update(state, ui) {
      // Before the first unlock the bar would only be four grey boxes.
      const anyUnlocked = currentWave(state) >= COMMANDS[0].fromWave;
      const show = anyUnlocked && (state.phase === 'planning' || state.phase === 'wave');
      set('show', show, (v) => (panel.hidden = !v));
      if (!show) return;
      for (const { command, button, note } of buttons) {
        const status = commandStatus(state, command.id);
        set(`${command.id}:note`, commandNote(status), (v) => (note.textContent = v));
        set(`${command.id}:usable`, status.usable, (v) => (button.disabled = !v));
        set(`${command.id}:aim`, ui.commandTarget === command.id, (v) => button.classList.toggle('on', v));
      }
    },
  };
}
