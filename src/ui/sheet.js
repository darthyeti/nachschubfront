// The head of a sheet on the phone (M10 E2): a handle in the middle and a close
// cross at the end, both at least 44 x 44. Every sheet has one, and style.css
// shows it only in the phone layout; elsewhere the old windows keep their own
// close buttons.

import { STRINGS } from '../data/strings.js';
import { el } from './controls.js';
import { icon } from './icons.js';

/**
 * @param {() => void} onClose
 * @param {string} [label]  accessible name of both buttons
 */
export function sheetHead(onClose, label = STRINGS.hud.sheetClose) {
  const head = el('div', 'sheet-head');
  const grab = el('button', 'sheet-grab');
  grab.type = 'button';
  grab.setAttribute('aria-label', label);
  grab.append(el('span', 'sheet-grab-bar'));
  const close = el('button', 'sheet-close');
  close.type = 'button';
  close.setAttribute('aria-label', label);
  close.append(icon('close', 'sheet-close-icon'));
  for (const b of [grab, close]) {
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      b.blur();
      onClose();
    });
  }
  head.append(grab, close);
  return head;
}
