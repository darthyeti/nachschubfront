// Info panel (GDD section 13): what stands on a cell. Opened by a long press on
// touch and by the mouse pointer on the desktop, so nothing is hover-only.

import { STRINGS } from '../data/strings.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { towerStats, towerAt } from '../sim/towers.js';
import { podAt } from '../sim/pods.js';
import { isBlocked } from '../sim/grid.js';

const T = STRINGS.info;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const round = (n, digits = 1) => Number(n.toFixed(digits));

function targetText(targets) {
  if (targets.includes('ground') && targets.includes('air')) return T.groundAndAir;
  return targets.includes('air') ? T.air : T.ground;
}

/** Damage per second a tower puts out, however it delivers it. */
export function damagePerSecond(stats) {
  return typeof stats.fire === 'number' ? stats.damage * stats.fire : stats.damage;
}

function describeTower(tower) {
  const stats = towerStats(tower);
  const name = tower.special
    ? STRINGS.recipes[tower.special].name
    : `${STRINGS.doctrines[tower.doctrine]} · ${STRINGS.ranks[tower.rank]}`;
  return {
    kind: 'tower',
    title: name,
    colour: DOCTRINE_COLORS[tower.doctrine],
    subtitle: tower.special ? T.special : T.tower,
    lines: [
      [T.damagePerSecond, String(round(damagePerSecond(stats)))],
      [T.range, T.cells(round(stats.range))],
      [T.targets, targetText(stats.def.targets)],
      [T.waveDamage, String(Math.round(tower.damage))],
    ],
  };
}

function statusText(enemy, time) {
  const parts = [];
  if (enemy.burn) parts.push(T.burning);
  if (time < enemy.slowUntil && enemy.slow > 0) parts.push(T.slowed);
  if (time < enemy.stunUntil) parts.push(T.frozen);
  return parts.join(', ');
}

function describeEnemy(enemy, time) {
  const lines = [
    [T.health, `${Math.ceil(enemy.health)} / ${Math.round(enemy.maxHealth)}`],
    [T.armor, STRINGS.armor[enemy.armor]],
    [T.speed, T.cellsPerSecond(round(enemy.speed, 2))],
    [T.reward, String(enemy.reward)],
  ];
  if (enemy.maxShield > 0) {
    lines.splice(1, 0, [T.shield, `${Math.ceil(enemy.shield)} / ${Math.round(enemy.maxShield)}`]);
  }
  const status = statusText(enemy, time);
  if (status) lines.push([T.status, status]);
  return {
    kind: 'enemy',
    title: STRINGS.enemies[enemy.type],
    subtitle: enemy.boss ? T.boss : T.enemy,
    lines,
  };
}

/** The enemy standing on a cell, or null. Enemies walk between cells. */
export function enemyOn(state, cell) {
  let best = null;
  let bestDist = 0.75 * 0.75;
  for (const e of state.enemies) {
    const dx = e.x - (cell.x + 0.5);
    const dy = e.y - (cell.y + 0.5);
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestDist) {
      best = e;
      bestDist = d2;
    }
  }
  return best;
}

function terrainName(state, cell) {
  const { map } = state;
  if (map.rift.x === cell.x && map.rift.y === cell.y) return T.terrainNames.rift;
  if (map.bastion.x === cell.x && map.bastion.y === cell.y) return T.terrainNames.bastion;
  if (map.beacons.some((b) => b.x === cell.x && b.y === cell.y)) return T.terrainNames.beacon;
  const obstacle = map.obstacles.find((o) => o.cells.some((c) => c.x === cell.x && c.y === cell.y));
  if (obstacle) return T.terrainNames[obstacle.kind] ?? T.terrainNames.rubble;
  return T.terrainNames.free;
}

/**
 * What to show for a cell: enemy first, then tower, pod, then the ground.
 * Pure, so the whole thing can be checked without a browser.
 */
export function describeCell(state, cell) {
  if (!cell || cell.x < 0 || cell.y < 0 || cell.x >= state.map.size || cell.y >= state.map.size) return null;
  const enemy = enemyOn(state, cell);
  if (enemy) return describeEnemy(enemy, state.time);
  const tower = towerAt(state, cell);
  if (tower) return describeTower(tower);
  const pod = podAt(state, cell);
  if (pod) {
    return {
      kind: 'pod',
      title: `${STRINGS.doctrines[pod.doctrine]} · ${STRINGS.ranks[pod.rank]}`,
      colour: DOCTRINE_COLORS[pod.doctrine],
      subtitle: T.terrainNames.pod,
      lines: [],
    };
  }
  return {
    kind: 'terrain',
    title: terrainName(state, cell),
    subtitle: T.terrain,
    lines: [[`${cell.x} / ${cell.y}`, isBlocked(state.map.grid, cell.x, cell.y) ? T.blocked : T.walkable]],
  };
}

/**
 * @param {HTMLElement} root
 * @param {{onClose: () => void}} callbacks
 */
export function createInfoPanel(root, { onClose }) {
  const panel = el('aside', 'info interactive');
  panel.hidden = true;
  panel.setAttribute('aria-label', T.title);
  const head = el('div', 'info-head');
  const title = el('span', 'info-title');
  const subtitle = el('span', 'info-subtitle');
  const close = el('button', 'info-close alt', T.close);
  close.type = 'button';
  close.setAttribute('aria-label', T.close);
  close.addEventListener('click', () => {
    onClose();
    close.blur();
  });
  head.append(title, subtitle);
  const list = el('dl', 'info-list');
  panel.append(head, list, close);
  root.append(panel);

  let key = '';

  return {
    update(state, ui) {
      const info = ui.inspect ? describeCell(state, ui.inspect) : null;
      const next = info ? JSON.stringify(info) : '';
      if (next === key) return;
      key = next;
      panel.hidden = !info;
      if (!info) return;
      title.textContent = info.title;
      title.style.color = info.colour ?? '';
      subtitle.textContent = info.subtitle;
      list.replaceChildren();
      for (const [label, value] of info.lines) {
        list.append(el('dt', null, label), el('dd', null, value));
      }
    },
  };
}
