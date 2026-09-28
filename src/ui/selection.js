// Selection panel (GDD section 3): the five pods of a salvo and what can be done
// with the one the player picked. Lives above the bottom bar, within thumb reach.

import { STRINGS } from '../data/strings.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { RECIPES } from '../data/recipes.js';
import { selectionOptions, anchorCost, canAffordAnchor, salvoBuildable } from '../sim/selection.js';
import { rankMarks } from './badges.js';

const T = STRINGS.selection;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const recipeName = (id) => STRINGS.recipes[id].name;

/**
 * What a press on an action button does: build at once, or arm the recipe and
 * wait for a second press.
 *
 * A recipe that eats standing emplacements needs two taps on a touch screen, the
 * rule the demolition already follows (GDD section 13). The first tap puts the
 * preview up and leaves it up, so the marked emplacements can be looked at with
 * no finger on the glass; the second one builds. Holding the button used to do
 * both at once — it showed the preview and bought the recipe on release.
 *
 * Only recipes with something to show need it. "Behalten" and "Verschmelzen"
 * have nothing to look at, and a tablet player should not pay an extra tap in
 * every one of fifty rounds. A mouse press, and a press from the keyboard, build
 * straight away.
 *
 * @param {object|null} armed  The choice waiting for its second press, if any.
 * @param {object} choice  The choice that was just pressed.
 * @returns {{do: 'build'} | {do: 'arm', towerIds: number[]}}
 */
export function pressAction(armed, choice, { pointerType = 'mouse', towerIds = [] } = {}) {
  const needsConfirm = pointerType !== 'mouse' && towerIds.length > 0;
  if (needsConfirm && !sameChoice(armed, choice)) return { do: 'arm', towerIds };
  return { do: 'build' };
}

/** Whether two choices mean the same action on the same capsule. */
export function sameChoice(a, b) {
  return (
    Boolean(a) &&
    Boolean(b) &&
    a.type === b.type &&
    a.anchor === b.anchor &&
    a.size === b.size &&
    a.recipeId === b.recipeId
  );
}

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
      // What touching this button previews on the map (docs/ART.md).
      towerIds: option.towerIds,
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
 * @param {object} callbacks
 * @param {(index: number) => void} callbacks.onSelect
 * @param {(choice: object) => void} callbacks.onChoose
 * @param {(towerIds: number[]) => void} callbacks.onPreview  Emplacements a recipe would eat.
 * @param {() => void} [callbacks.onForfeit]  Give the salvo up; offered only when
 *   not one of its capsules can be paid for.
 */
export function createSelectionPanel(root, { onSelect, onChoose, onPreview, onForfeit }) {
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
  /**
   * How the last press came in. A click event's own `pointerType` is empty when
   * the keyboard triggered it and is not reported alike by every engine, so the
   * pointerdown before it is what the panel goes by. Nothing means keyboard,
   * which counts as a mouse: a press on a focused button is deliberate already.
   */
  let lastPointerType = '';

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
      // Name first, strokes beside it: the strokes qualify the word, they do
      // not replace it (docs/ART.md).
      rankRow.append(el('span', null, STRINGS.ranks[pod.rank]));
      rankRow.insertAdjacentHTML('beforeend', rankMarks(pod.rank, pod.doctrine));
      card.append(head, rankRow);
      // A zone may sit on rubble since v3. The heap is only torn down and paid
      // for if this is the capsule that gets built (GDD section 3).
      const cost = anchorCost(state, pod.index);
      if (cost > 0) {
        card.append(el('span', 'selection-cost', T.onRubble(cost)));
        card.classList.toggle('unaffordable', state.requisition < cost);
      }
      if (badge) card.append(el('span', 'selection-badge', badge));
      card.addEventListener('click', () => {
        onSelect(pod.index);
        card.blur();
      });
      cards.append(card);
    }
    return options;
  }

  function renderActions(state, options, selected, armed) {
    // The buttons are about to be replaced; whatever they were previewing goes,
    // unless one of the new ones is the armed recipe and puts it back up.
    if (!armed) onPreview?.([]);
    actions.replaceChildren();
    // Standing on rubble the player cannot clear makes every action on this
    // capsule impossible; the others stay open.
    const cost = anchorCost(state, selected);
    const affordable = canAffordAnchor(state, selected);
    for (const action of actionsFor(options, selected)) {
      const button = el('button', 'primary');
      button.type = 'button';
      button.disabled = !affordable;
      // A recipe that eats standing emplacements takes two taps on a touch
      // screen: the first one shows what it would eat, the second one builds.
      // Armed is that in-between state (see `onChoose` in main.js).
      const isArmed = Boolean(armed) && sameChoice(armed, action.choice);
      button.classList.toggle('armed', isArmed);
      button.setAttribute('aria-pressed', String(isArmed));
      button.append(el('span', null, action.label));
      const note = isArmed ? T.confirm : action.note;
      if (note) button.append(el('span', 'selection-note', note));
      button.addEventListener('pointerdown', (event) => {
        lastPointerType = event.pointerType ?? '';
      });
      button.addEventListener('click', () => {
        button.blur();
        onChoose(action.choice, { pointerType: lastPointerType || 'mouse', towerIds: action.towerIds ?? [] });
        lastPointerType = '';
      });
      // With a mouse the preview follows the pointer over the button, and only
      // that one (decision M4d). On a touch screen it is put up by the first tap
      // and stays there, so the map can be looked at with no finger on the
      // glass — holding the button used to show it and buy it on release.
      if (action.towerIds?.length) {
        button.addEventListener('pointerenter', (event) => {
          if ((event.pointerType ?? 'mouse') === 'mouse') onPreview?.(action.towerIds);
        });
        for (const type of ['pointerleave', 'pointercancel']) {
          button.addEventListener(type, (event) => {
            if ((event.pointerType ?? 'mouse') === 'mouse' && !isArmed) onPreview?.([]);
          });
        }
      }
      if (isArmed) onPreview?.(action.towerIds ?? []);
      actions.append(button);
    }
    if (!affordable) actions.append(el('p', 'selection-warning', T.noFunds(cost - state.requisition)));
    // Not one capsule of the salvo can be paid for: the round would have nowhere
    // left to go, so it can be given up instead (GDD section 3).
    if (!salvoBuildable(state)) {
      const give = el('button', 'selection-forfeit');
      give.type = 'button';
      give.append(el('span', null, T.forfeit), el('span', 'selection-note', T.forfeitNote));
      give.addEventListener('click', () => {
        give.blur();
        onForfeit?.();
      });
      actions.append(el('p', 'selection-warning', T.allOnRubble), give);
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
      // Requisition is part of the key: whether a capsule on rubble can be
      // afforded decides what the panel shows. So is the armed recipe, because
      // the button it belongs to is drawn differently while it waits.
      const armed = ui.recipeArmed ?? null;
      const next = `${state.wave}:${state.pods.map((p) => `${p.doctrine}${p.rank}`).join()}:${selected}:${state.towers.length}:${state.requisition}:${armed ? JSON.stringify(armed) : ''}`;
      if (next === key) return;
      key = next;
      renderActions(state, renderCards(state, selected), selected, armed);
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
