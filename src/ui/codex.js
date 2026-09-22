// Recipe reference (GDD section 8): an overlay listing every special tower with
// its ingredients, minimum rank and effect.

import { STRINGS } from '../data/strings.js';
import { recipeList } from './selection.js';

const T = STRINGS.codex;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * @param {HTMLElement} root
 * @param {{onToggle?: (open: boolean) => void}} [callbacks]
 */
export function createCodex(root, { onToggle } = {}) {
  const overlay = el('div', 'codex interactive');
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', T.title);

  const panel = el('div', 'codex-panel');
  const head = el('div', 'codex-head');
  head.append(el('h2', 'codex-title', T.title));
  const close = el('button', 'alt', T.close);
  close.type = 'button';
  head.append(close);

  const list = el('div', 'codex-list');
  for (const recipe of recipeList()) {
    const card = el('div', 'codex-card');
    const title = el('div', 'codex-name', recipe.name);
    const rank = el('span', 'codex-rank', T.minRank(recipe.minRank));
    title.append(rank);
    const ingredients = el('div', 'codex-ingredients');
    for (const part of recipe.ingredients) {
      const chip = el('span', 'codex-chip', part.name);
      chip.style.setProperty('--doctrine', part.color);
      ingredients.append(chip);
    }
    card.append(title, ingredients, el('p', 'codex-effect', recipe.effect));
    list.append(card);
  }

  panel.append(head, el('p', 'codex-intro', T.intro), list);
  overlay.append(panel);
  root.append(overlay);

  const api = {
    get open() {
      return !overlay.hidden;
    },
    setOpen(open) {
      if (overlay.hidden === !open) return;
      overlay.hidden = !open;
      onToggle?.(open);
      if (open) close.focus();
    },
    toggle() {
      api.setOpen(overlay.hidden);
    },
  };

  close.addEventListener('click', () => api.setOpen(false));
  // A tap beside the panel closes it, like the other overlays on a tablet.
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) api.setOpen(false);
  });
  return api;
}
