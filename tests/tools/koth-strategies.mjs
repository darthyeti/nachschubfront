// How a bot plays King of the Hill (M7b, B7).
//
// The four heuristics of the study (reference/studien/king-of-the-hill.html,
// pickZone and botChoose), rebuilt on the real simulation: zones and choices
// only, the rest — supply, clearing rubble, commands, and here the upgrade
// rhythm — is bot-player.mjs, the same for everyone.
//
// - ring: everything close around the ban zone, so every emplacement covers
//   all four arms. What the ban zone is there to break.
// - arm: lengthen the arm that attacks next, and only that one.
// - mix: three zones for the ring, the rest for the coming arm.
// - balance: zones on the coming arm, capsules where the weakest arm is.
//
// Like every bot these are heuristics, a lower bound and not a player. Their
// numbers are a direction (docs/PROGRESS.md, M6 decision 7).

import { createRng } from '../../src/core/random.js';
import { canMarkZone } from '../../src/sim/zones.js';
import { computeRoute } from '../../src/sim/route.js';
import { distanceField } from '../../src/sim/pathfinding.js';
import { setBlocked, isBlocked } from '../../src/sim/grid.js';
import { towerStats } from '../../src/sim/towers.js';
import { DOCTRINES } from '../../src/data/doctrines.js';

/** Zones a strategy weighs up per pick; the study draws ten at random. */
const SAMPLE = 10;
/** Outer radius of the ring around the centre, at least three past the ban zone. */
const RING_RADIUS = 6.5;

const centreDistance = (map, c) => Math.hypot(c.x + 0.5 - map.size / 2, c.y + 0.5 - map.size / 2);

/** Route length of every rift if `cells` were blocked too, from one field. */
function armLengths(map, cells) {
  const before = cells.map(({ x, y }) => isBlocked(map.grid, x, y));
  for (const { x, y } of cells) setBlocked(map.grid, x, y, true);
  try {
    const field = distanceField(map.grid, map.bastionCells);
    return map.rifts.map((rift) => Math.min(...rift.gates.map(({ x, y }) => field[y * map.size + x])));
  } finally {
    cells.forEach(({ x, y }, i) => setBlocked(map.grid, x, y, before[i]));
  }
}

/** Every cell a zone may go on now, as the simulation itself judges it. */
function markable(state, cells) {
  return cells.filter((c) => canMarkZone(state, c).ok);
}

function allCells(map) {
  const out = [];
  for (let y = 0; y < map.size; y++) for (let x = 0; x < map.size; x++) out.push({ x, y });
  return out;
}

/** The free cells on the coming arm's lanes, outside the ban zone and a step past it. */
function armCells(state) {
  const { map } = state;
  const route = computeRoute(map, state.riftIndex);
  const seen = new Set();
  const out = [];
  for (const lane of route?.lanes ?? []) {
    for (const c of lane.cells) {
      const key = `${c.x},${c.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (centreDistance(map, c) >= Math.max(4.8, (state.mode.map.banRadius ?? 4) + 1)) out.push(c);
    }
  }
  return out;
}

/** One zone by one of the two rules, from a sample of the candidates. */
function pickZone(state, rule, rng) {
  const { map } = state;
  const ringRadius = Math.max(RING_RADIUS, (state.mode.map.banRadius ?? 4) + 3);
  let cands =
    rule === 'ring'
      ? markable(state, allCells(map).filter((c) => centreDistance(map, c) <= ringRadius))
      : markable(state, armCells(state));
  if (cands.length === 0) cands = markable(state, allCells(map));
  if (cands.length === 0) return null;
  const sample = rng.shuffle(cands).slice(0, SAMPLE);
  let best = null;
  let bestScore = -Infinity;
  for (const c of sample) {
    const lengths = armLengths(map, [...state.zones, c]);
    const score =
      (rule === 'ring' ? lengths.reduce((a, b) => a + b, 0) : lengths[state.riftIndex]) + rng.next() * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function zonesFor(ruleOf) {
  return (state, limit) => {
    const rng = createRng(state.seed).fork('koth-bot').fork(state.wave);
    const out = [];
    for (let i = 0; i < limit; i++) {
      const c = pickZone(state, ruleOf(i), rng);
      if (!c) break;
      // Marked one by one, so each pick sees the ones before it; bot-player
      // marks them again, which finds them already set and leaves them.
      out.push(c);
      state.zones.push(c);
    }
    state.zones.length -= out.length;
    return out;
  };
}

/**
 * The capsule to keep, by the study's scores: a doctrine the player has few of,
 * air defence while it is short, and then per strategy how many arms (or which)
 * the emplacement would cover.
 */
function chooseFor(strategy) {
  return (state, options) => {
    const { map } = state;
    const routes = map.rifts.map((_, i) => (computeRoute(map, i)?.lanes ?? []).flatMap((lane) => lane.cells));
    const count = {};
    let air = 0;
    const armPower = map.rifts.map(() => 0);
    for (const t of state.towers) {
      if (t.special) continue;
      count[t.doctrine] = (count[t.doctrine] ?? 0) + 1;
      if (DOCTRINES[t.doctrine].targets.includes('air')) air += 1;
      const stats = towerStats(t);
      routes.forEach((cells, a) => {
        if (cells.some((c) => Math.hypot(c.x - t.x, c.y - t.y) <= stats.range)) armPower[a] += stats.damage;
      });
    }
    const score = (pod) => {
      const stats = towerStats({ doctrine: pod.doctrine, rank: pod.rank });
      const reach = routes.map((cells) => {
        let best = Infinity;
        for (const c of cells) {
          const d = Math.hypot(c.x - pod.x, c.y - pod.y);
          if (d < best && d >= stats.minRange) best = d;
        }
        return best;
      });
      const covers = reach.map((d) => d <= stats.range);
      const coverAll = covers.filter(Boolean).length;
      const next = covers[state.riftIndex] ? 8 : 0;
      let s = Math.max(0, 3 - (count[pod.doctrine] ?? 0)) * 6 + pod.rank * 3;
      if (DOCTRINES[pod.doctrine].targets.includes('air') && air < 2 + Math.floor(state.wave / 8)) s += 4;
      if (strategy === 'ring') s += coverAll * 4 + next;
      else if (strategy === 'arm') s += next - Math.min(reach[state.riftIndex], 12) * 0.5;
      else if (strategy === 'balance') {
        covers.forEach((on, a) => {
          if (on) s += 10 / (1 + armPower[a] / 30);
        });
        s += next;
      } else s += coverAll * 2 + next;
      return s;
    };
    const keeps = state.pods
      .map((pod, index) => ({ index, s: score(pod) }))
      .sort((a, b) => b.s - a.s)
      .map(({ index }) => ({ type: 'keep', anchor: index }));
    return [
      ...options.recipes.map((r) => ({ type: 'recipe', recipeId: r.recipeId, anchor: r.anchors[0] })),
      ...[...options.merges].sort((a, b) => b.size - a.size).map((m) => ({ type: 'merge', size: m.size, anchor: m.anchors[0] })),
      ...keeps,
    ];
  };
}

export const KOTH_STRATEGIES = [
  {
    id: 'ring',
    title: 'Ring',
    about: 'Alles dicht um die Sperrzone, jede Stellung deckt möglichst alle vier Arme.',
    zones: zonesFor(() => 'ring'),
    choose: chooseFor('ring'),
  },
  {
    id: 'arm',
    title: 'Arm',
    about: 'Verlängert nur den Arm, der als Nächstes angreift.',
    zones: zonesFor(() => 'arm'),
    choose: chooseFor('arm'),
  },
  {
    id: 'mix',
    title: 'Mischung',
    about: 'Drei Zonen für den Ring, der Rest für den kommenden Arm.',
    zones: zonesFor((i) => (i < 3 ? 'ring' : 'arm')),
    choose: chooseFor('mix'),
  },
  {
    id: 'balance',
    title: 'Ausgewogen',
    about: 'Zonen am kommenden Arm, Kapseln dort, wo der schwächste Arm ist.',
    zones: zonesFor(() => 'arm'),
    choose: chooseFor('balance'),
  },
];
