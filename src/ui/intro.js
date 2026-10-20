// A screen-wide note the first time something new turns up (M6, round 5).
//
// Three new players went through seven matches without using a single command,
// though the rail stood on the right the whole time. So the moment it first
// appears, the game stops and says what it is, in a panel like the menus with
// one button to close it. Once per device: it is seen in prefs, and the
// settings can turn it back on.

import { el, button } from './controls.js';
import { icon } from './icons.js';

/**
 * @param {HTMLElement} root
 * @returns {{open: boolean, show: (note: {title: string, lines: string[], ok: string, iconName?: string},
 *   onClose: () => void) => void}}
 */
export function createIntro(root) {
  const layer = el('div', 'menu intro');
  layer.dataset.menu = 'intro';
  layer.hidden = true;
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  const panel = el('div', 'menu-panel intro-panel');
  layer.append(panel);
  root.append(layer);

  let onDone = null;

  function close() {
    layer.hidden = true;
    const done = onDone;
    onDone = null;
    done?.();
  }

  return {
    get open() {
      return !layer.hidden;
    },

    show({ title, lines, ok, iconName }, onClose) {
      panel.replaceChildren();
      if (iconName) panel.append(icon(iconName, 'intro-icon'));
      const heading = el('h2', 'menu-title', title);
      heading.id = 'intro-title';
      layer.setAttribute('aria-labelledby', heading.id);
      panel.append(heading);
      for (const line of lines) panel.append(el('p', 'intro-text', line));
      const actions = el('div', 'menu-actions');
      const okButton = button(ok, 'primary menu-primary', close);
      actions.append(okButton);
      panel.append(actions);
      onDone = onClose;
      layer.hidden = false;
      okButton.focus();
    },
  };
}
