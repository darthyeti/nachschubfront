// Selection panel (GDD section 3): the five pods of a salvo and what can be done
// with the one the player picked. Lives above the bottom bar, within thumb reach.

import { STRINGS } from '../data/strings.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { RECIPES } from '../data/recipes.js';
import { selectionOptions } from '../sim/selection.js';
import { badgeMarkup } from './badges.js';

const T = STRINGS.selection;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const recipeName = (id) => STRINGS.recipes[id].name;

/** Actions offered for the pod the player picked, in a fixed order. */
export function actionsFor(options, anchor) {
  const actions = [];
  if (options.keep.some((o) => o.anchors[0] === anchor)) {
    actions.push({ label: T.keep, choice: { type: 'keep', anchor } });
  }
  for (const option of options.merges) {
    if (!option.anchors.includes(anchor)) continue;
    actions.push({
      label: T.merge(option.size, STRINGS.ranks[option.resultRank]),
      choice: { type: 'merge', size: option.size, anchor },
    });
  }
  for (const option of options.recipes) {
    if (!option.anchors.includes(anchor)) continue;
    actions.push({
      label: T.recipe(recipeName(option.recipeId)),
      note: option.towerIds.length > 0 ? T.consumes(option.towerIds.length) : '',
      choice: { type: 'recipe', recipeId: option.recipeId, anchor },
    });
  }
  return actions;
}

/** Short badge on a pod card that hints at more than just keeping. */
export function badgeFor(options, index) {
  const merge = options.merges.filter((o) => o.anchors.includes(index)).sort((a, b) => b.size - a.size)[0];
  if (options.recipes.some((o) => o.anchors.includes(index))) return T.recipeBadge;
  return merge ? T.mergeBadge(merge.size) : '';
}

/**
 * @param {HTMLElement} root
 * @param {{onSelect: (index: number) => void, onChoose: (choice: object) => void}} callbacks
 */
export function createSelectionPanel(root, { onSelect, onChoose }) {
  const panel = el('div', 'selection interactive');
  panel.hidden = true;
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', T.title);
  const cards = el('div', 'selection-cards');
  const actions = el('div', 'selection-actions');
  const hint = el('p', 'selection-hint', T.hint);
  panel.append(cards, actions, hint);
  root.prepend(panel);

  /** Rebuilt whenever the salvo or the pick changes; cheap enough at five pods. */
  let key = '';

  function renderCards(state, selected) {
    cards.replaceChildren();
    const options = selectionOptions(state);
    for (const pod of state.pods) {
      const card = el('button', 'selection-card');
      card.type = 'button';
      card.style.setProperty('--doctrine', DOCTRINE_COLORS[pod.doctrine]);
      card.classList.toggle('on', pod.index === selected);
      card.setAttribute('aria-pressed', String(pod.index === selected));
      const badge = badgeFor(options, pod.index);
      const head = el('span', 'selection-head');
      head.append(
        el('span', 'selection-num', String(pod.index + 1)),
        el('span', 'selection-name', STRINGS.doctrines[pod.doctrine]),
      );
      const rankRow = el('span', 'selection-rank');
      const mark = el('span', 'selection-rank-badge');
      mark.innerHTML = badgeMarkup(pod.rank, pod.doctrine);
      rankRow.append(mark, el('span', null, STRINGS.ranks[pod.rank]));
      card.append(head, rankRow);
      if (badge) card.append(el('span', 'selection-badge', badge));
      card.addEventListener('click', () => {
        onSelect(pod.index);
        card.blur();
      });
      cards.append(card);
    }
    return options;
  }

  function renderActions(options, selected) {
    actions.replaceChildren();
    for (const action of actionsFor(options, selected)) {
      const button = el('button', 'primary');
      button.type = 'button';
      button.append(el('span', null, action.label));
      if (action.note) button.append(el('span', 'selection-note', action.note));
      button.addEventListener('click', () => {
        button.blur();
        onChoose(action.choice);
      });
      actions.append(button);
    }
  }

  return {
    /** Shows the panel during the selection phase and keeps it in sync. */
    update(state, ui) {
      const open = state.phase === 'selection' && state.pods.length > 0;
      panel.hidden = !open;
      if (!open) {
        key = '';
        return;
      }
      const selected = ui.podSelected ?? 0;
      const next = `${state.wave}:${state.pods.map((p) => `${p.doctrine}${p.rank}`).join()}:${selected}:${state.towers.length}`;
      if (next === key) return;
      key = next;
      renderActions(renderCards(state, selected), selected);
    },
  };
}

/** All recipes for the codex, with their ingredient names. */
export function recipeList() {
  return RECIPES.map((recipe) => ({
    id: recipe.id,
    name: recipeName(recipe.id),
    effect: STRINGS.recipes[recipe.id].effect,
    minRank: STRINGS.ranks[recipe.minRank],
    ingredients: recipe.ingredients.map((id) => ({ name: STRINGS.doctrines[id], color: DOCTRINE_COLORS[id] })),
  }));
}
