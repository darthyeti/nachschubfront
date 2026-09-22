// Debug panel (M3): jump to a wave, top up requisition, force the pod contents,
// make the bastion invulnerable, and watch the wave statistics. Only built when
// the page is opened with ?debug, and never shown to a player.

import { STRINGS } from '../data/strings.js';
import { DOCTRINE_IDS } from '../data/doctrines.js';
import { MAX_RANK } from '../data/ranks.js';
import { WAVES } from '../data/waves.js';
import { towerStats } from '../sim/towers.js';

const T = STRINGS.debugPanel;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, onClick) {
  const b = el('button', 'alt', label);
  b.type = 'button';
  b.addEventListener('click', () => {
    onClick();
    b.blur();
  });
  return b;
}

/** The towers that did the most damage this wave, with their share. */
export function topTowers(state, count = 3) {
  const total = state.towers.reduce((sum, t) => sum + t.damage, 0);
  return [...state.towers]
    .filter((t) => t.damage > 0)
    .sort((a, b) => b.damage - a.damage || a.id - b.id)
    .slice(0, count)
    .map((tower) => ({
      tower,
      name: tower.special
        ? STRINGS.recipes[tower.special].name
        : `${STRINGS.doctrines[tower.doctrine]} ${tower.rank}`,
      damage: Math.round(tower.damage),
      share: total > 0 ? tower.damage / total : 0,
    }));
}

/**
 * @param {HTMLElement} root
 * @param {{onAction: (action: string, value?: object) => void}} callbacks
 */
export function createDebugPanel(root, { onAction }) {
  const panel = el('aside', 'debug-panel interactive');
  panel.setAttribute('aria-label', T.title);

  const waveRow = el('div', 'debug-row');
  const waveInput = el('input', 'debug-input');
  waveInput.type = 'number';
  waveInput.min = '1';
  waveInput.max = String(WAVES.length);
  waveInput.value = '1';
  waveRow.append(el('span', 'debug-label', T.wave), waveInput, button(T.jump, () => {
    onAction('setWave', { wave: Number(waveInput.value) });
  }));

  const moneyRow = el('div', 'debug-row');
  moneyRow.append(
    el('span', 'debug-label', T.grant),
    button(T.requisition, () => onAction('grant', { requisition: 500 })),
    button(T.commandPoints, () => onAction('grant', { commandPoints: 5 })),
  );

  const podRow = el('div', 'debug-row');
  const doctrineSelect = el('select', 'debug-input');
  doctrineSelect.append(new Option(T.podFree, ''));
  for (const id of DOCTRINE_IDS) doctrineSelect.append(new Option(STRINGS.doctrines[id], id));
  const rankSelect = el('select', 'debug-input');
  for (let rank = 1; rank <= MAX_RANK; rank++) rankSelect.append(new Option(STRINGS.ranks[rank], String(rank)));
  const applyPod = () => {
    const doctrine = doctrineSelect.value;
    onAction('forcePod', doctrine ? { doctrine, rank: Number(rankSelect.value) } : null);
  };
  doctrineSelect.addEventListener('change', applyPod);
  rankSelect.addEventListener('change', applyPod);
  podRow.append(el('span', 'debug-label', T.pod), doctrineSelect, rankSelect);

  const toggleRow = el('div', 'debug-row');
  const invulnerable = button(T.invulnerable, () => onAction('invulnerable'));
  toggleRow.append(invulnerable);

  const stats = el('div', 'debug-stats');

  panel.append(waveRow, moneyRow, podRow, toggleRow, stats);
  root.append(panel);

  let key = '';

  return {
    update(state) {
      invulnerable.classList.toggle('on', state.invulnerable);
      const { spawned, killed, leaked } = state.waveStats;
      const towers = topTowers(state);
      const next = `${state.wave}|${spawned}|${killed}|${leaked}|${towers.map((t) => `${t.tower.id}:${t.damage}`)}`;
      if (next === key) return;
      key = next;
      stats.replaceChildren(
        el('div', 'debug-stats-line', T.waveStats(state.wave, spawned, killed, leaked)),
        ...towers.map((t) => el('div', 'debug-stats-line', T.towerDamage(t.name, t.damage, Math.round(t.share * 100)))),
      );
    },
  };
}
