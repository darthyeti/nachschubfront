// How a bot plays (M6, part 1, step 3).
//
// A strategy differs from another only in the two decisions that shape a match:
// where the landing zones go, and which capsule is kept. Everything else — the
// supply level, clearing rubble, the commands at a boss — is the same for all of
// them and lives in bot-player.mjs, because the order asks for it that way.
//
// Why several of them at all: the bot that existed before M6 placed its zones by
// one fixed rule and lost on seed BASTION in wave 9, while Till got to wave 35
// on his own. One rule is not a player. Three rules that each play a recognisable
// way bracket what a person does, and the calibration (npm run calibrate) says
// which of them comes closest to him.
//
// None of them is a measurement on its own. An uncalibrated bot gives a
// direction, nothing more.

import { routeWith } from '../../src/sim/route.js';
import { canMarkZone } from '../../src/sim/zones.js';
import { RECIPES } from '../../src/data/recipes.js';
import { KOTH_STRATEGIES } from './koth-strategies.mjs';

/**
 * Cells worth considering for a landing zone: the free ground beside the route,
 * plus one step further out.
 *
 * The restriction is what makes the maze builder usable at all. Searching every
 * free cell of the map means an A* per candidate, about 0.15 ms each, which
 * comes to roughly an hour for 200 seeds; the ring around the route brings that
 * down to some twelve minutes and loses nothing worth having — a zone far from
 * the route lengthens nothing.
 */
/**
 * Cells worth weighing up for a landing zone: the free ground immediately beside
 * the route.
 *
 * Only a neighbour of the path can push the path aside, so the ring of one is
 * the whole honest set — and it turned out to be the better one as well: with
 * two rings the maze builder reached wave 28, with one it reaches 30, and the
 * run is shorter too.
 *
 * There is no cap on how many are weighed up, and that was tried: capping at
 * 140 of them cut the maze builder from 28 waves to 10. Losing the single best
 * cell of a salvo compounds — a shorter route kills fewer enemies, which pays
 * for fewer emplacements — so the greedy needs the whole ring. The price is
 * about 25 seconds for one late match of this strategy, because every candidate
 * costs a path search and the maze it builds is enormous. `npm run bots` forks
 * worker processes for that reason.
 */
function candidates(state, route) {
  const seen = new Set();
  const out = [];
  for (const step of route.cells) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const cell = { x: step.x + dx, y: step.y + dy };
        const key = `${cell.x},${cell.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (canMarkZone(state, cell).ok) out.push(cell);
      }
    }
  }
  return out;
}

/** Route cells within `radius` of a point: how much path a tower there covers. */
function coverage(route, cell, radius = 3) {
  let count = 0;
  for (const step of route.cells) {
    if (Math.hypot(step.x - cell.x, step.y - cell.y) <= radius) count += 1;
  }
  return count;
}

/**
 * Length of the route before anything was built on the map. Cached per map
 * object, because it is asked for on every salvo and never changes.
 */
const baseRoutes = new WeakMap();
function baseRoute(state) {
  const known = baseRoutes.get(state.map);
  if (known !== undefined) return known;
  // Every heap of rubble and every emplacement is part of what the player did,
  // so the measure is the route the map had with its terrain alone. Taken from
  // the current route the first time a match asks, which is the first salvo,
  // when nothing has been built yet.
  const length = state.route?.length ?? 40;
  baseRoutes.set(state.map, length);
  return length;
}

/** The pods of the salvo, richest first: legend before recruit. */
function byRank(state) {
  return state.pods.map((pod, index) => ({ index, pod })).sort((a, b) => b.pod.rank - a.pod.rank);
}

/** Doctrines any recipe asks for, so a bot can tell an ingredient from a filler. */
const INGREDIENTS = new Set(RECIPES.flatMap((recipe) => recipe.ingredients));

export const STRATEGIES = [
  {
    id: 'maze',
    title: 'Labyrinth-Bauer',
    about: 'Setzt jede Zone dorthin, wo sie die Route am meisten verlängert, und behält die Stellung mit der größten Wegabdeckung.',

    /**
     * Greedy, one zone at a time: each is placed where it lengthens the route
     * most, given the ones already placed. Greedy rather than exhaustive
     * because six zones out of a hundred candidates is far too big a field to
     * search, and a person does not search it either — they add a wall, look at
     * the new path, and add the next.
     */
    zones(state, limit) {
      const picked = [];
      for (let i = 0; i < limit; i++) {
        const route = routeWith(state.map, picked);
        if (!route) break;
        let best = null;
        let bestLength = route.length;
        for (const cell of candidates(state, route)) {
          if (picked.some((p) => p.x === cell.x && p.y === cell.y)) continue;
          const next = routeWith(state.map, [...picked, cell]);
          if (next && next.length > bestLength) {
            bestLength = next.length;
            best = cell;
          }
        }
        // Nothing lengthens it any more: fill the rest beside the route, so the
        // salvo is not left short and the capsules stay where they are useful.
        picked.push(best ?? candidates(state, route)[0] ?? null);
        if (picked[picked.length - 1] === null) {
          picked.pop();
          break;
        }
      }
      return picked;
    },

    choose(state, options) {
      const route = state.zonePreview ?? state.route;
      const ranked = state.pods
        .map((pod, index) => ({ index, cover: route ? coverage(route, pod) : 0 }))
        .sort((a, b) => b.cover - a.cover);
      return [
        ...options.recipes.map((r) => ({ type: 'recipe', recipeId: r.recipeId, anchor: r.anchors[0] })),
        ...ranked.map(({ index }) => ({ type: 'keep', anchor: index })),
      ];
    },
  },

  {
    id: 'firepower',
    title: 'Feuerkraft',
    about: 'Hält eine kompakte Todeszone an der Stelle, wo die Route am dichtesten an sich selbst vorbeiläuft, und behält die stärkste Kapsel.',

    /**
     * One dense cluster instead of a long wall. The spot is the route cell that
     * has the most other route cells around it — where the path already doubles
     * back on itself, so one emplacement covers several passes of it.
     */
    zones(state, limit) {
      const route = state.route;
      if (!route) return [];
      let centre = route.cells[Math.floor(route.cells.length / 2)];
      let best = -1;
      for (const step of route.cells) {
        const here = coverage(route, step, 3);
        if (here > best) {
          best = here;
          centre = step;
        }
      }
      const near = candidates(state, route).sort(
        (a, b) =>
          Math.hypot(a.x - centre.x, a.y - centre.y) - Math.hypot(b.x - centre.x, b.y - centre.y),
      );
      const picked = [];
      for (const cell of near) {
        if (picked.length >= limit) break;
        // Checked against the whole set, so the cluster can never close the way.
        if (routeWith(state.map, [...picked, cell])) picked.push(cell);
      }
      return picked;
    },

    choose(state, options) {
      const merges = [...options.merges].sort((a, b) => b.resultRank - a.resultRank || b.size - a.size);
      return [
        ...options.recipes.map((r) => ({ type: 'recipe', recipeId: r.recipeId, anchor: r.anchors[0] })),
        ...merges.map((m) => ({ type: 'merge', size: m.size, anchor: m.anchors[0] })),
        ...byRank(state).map(({ index }) => ({ type: 'keep', anchor: index })),
      ];
    },
  },

  {
    id: 'recipes',
    title: 'Rezept-Jäger',
    about: 'Sammelt Zutaten und erfüllt ein Rezept, sobald es geht; verschmilzt nur, wenn kein Rezept in Reichweite ist.',

    /**
     * The zones are not what this one is about, so it keeps them simple: beside
     * the route, spread out, which is what a player does while thinking about
     * something else.
     */
    zones(state, limit) {
      const route = state.route;
      if (!route) return [];
      const middle = route.cells.length / 2;
      const order = [...route.cells.keys()].sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle));
      const picked = [];
      for (const i of order) {
        if (picked.length >= limit) break;
        for (const off of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
          const cell = { x: route.cells[i].x + off.x, y: route.cells[i].y + off.y };
          if (picked.some((p) => p.x === cell.x && p.y === cell.y)) continue;
          if (!canMarkZone(state, cell).ok) continue;
          if (picked.some((p) => Math.abs(p.x - cell.x) + Math.abs(p.y - cell.y) < 2)) continue;
          if (routeWith(state.map, [...picked, cell])) {
            picked.push(cell);
            break;
          }
        }
      }
      return picked;
    },

    /**
     * A recipe first, always. Failing that, a capsule of a doctrine that some
     * recipe asks for and that is not standing yet — merging is left alone
     * unless nothing else is on offer, because a merge eats two ingredients to
     * make one emplacement.
     */
    choose(state, options) {
      const standing = new Set(state.towers.map((t) => t.doctrine));
      const wanted = state.pods
        .map((pod, index) => ({ index, pod }))
        .sort((a, b) => score(b) - score(a));

      function score({ pod }) {
        let value = pod.rank;
        if (INGREDIENTS.has(pod.doctrine)) value += 10;
        if (!standing.has(pod.doctrine)) value += 20;
        return value;
      }

      return [
        ...options.recipes.map((r) => ({ type: 'recipe', recipeId: r.recipeId, anchor: r.anchors[0] })),
        ...wanted.map(({ index }) => ({ type: 'keep', anchor: index })),
        ...[...options.merges]
          .sort((a, b) => b.size - a.size)
          .map((m) => ({ type: 'merge', size: m.size, anchor: m.anchors[0] })),
      ];
    },
  },

  {
    id: 'refine',
    title: 'Veredler',
    about: 'Verlängert die Route nur bis zu einem Maß und steckt danach alles ins Verschmelzen: hohe Ränge statt vieler Bauwerke.',

    /**
     * Shaped by what Till's first protocol shows rather than by an idea: he ends
     * at a route of 108 cells where the maze builder reaches 580, and his
     * emplacements are 0 recruits, 6 veterans, 4 elite, 8 heroes and 6 legends —
     * a merging ladder, not a collection. So this one lengthens the route to
     * about twice the open map's route and then stops bothering, and it merges
     * in preference to taking a recipe.
     *
     * The target is a multiple of the route the empty map has, not a fixed
     * number of cells, because a map whose rift and bastion are near each other
     * starts far shorter than one where they are far apart.
     */
    zones(state, limit) {
      const route = state.route;
      if (!route) return [];
      const target = baseRoute(state) * 2.2;
      const picked = [];
      for (let i = 0; i < limit; i++) {
        const here = routeWith(state.map, picked);
        if (!here) break;
        const options = candidates(state, here);
        if (options.length === 0) break;
        if (here.length >= target) {
          // Long enough. What is left goes where it covers the most path, which
          // is what a player does once the maze is in place.
          const best = options.sort((a, b) => coverage(here, b) - coverage(here, a));
          const cell = best.find((c) => !picked.some((p) => p.x === c.x && p.y === c.y) && routeWith(state.map, [...picked, c]));
          if (!cell) break;
          picked.push(cell);
          continue;
        }
        let best = null;
        let bestLength = here.length;
        for (const cell of options) {
          if (picked.some((p) => p.x === cell.x && p.y === cell.y)) continue;
          const next = routeWith(state.map, [...picked, cell]);
          if (next && next.length > bestLength) {
            bestLength = next.length;
            best = cell;
          }
        }
        if (!best) {
          const cell = options.find((c) => !picked.some((p) => p.x === c.x && p.y === c.y));
          if (!cell) break;
          picked.push(cell);
          continue;
        }
        picked.push(best);
      }
      return picked;
    },

    choose(state, options) {
      const merges = [...options.merges].sort((a, b) => b.resultRank - a.resultRank || b.size - a.size);
      return [
        ...merges.map((m) => ({ type: 'merge', size: m.size, anchor: m.anchors[0] })),
        ...options.recipes.map((r) => ({ type: 'recipe', recipeId: r.recipeId, anchor: r.anchors[0] })),
        ...byRank(state).map(({ index }) => ({ type: 'keep', anchor: index })),
      ];
    },
  },

  {
    id: 'simple',
    title: 'Einfach',
    about: 'Der Bot von vor M6: Zonen neben die Route von der Mitte aus, Rezept wenn möglich, sonst die größte Verschmelzung. Bleibt als Vergleichsmaß.',

    zones(state, limit) {
      const route = state.route;
      if (!route) return [];
      const middle = route.cells.length / 2;
      const order = [...route.cells.keys()].sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle));
      const picked = [];
      for (const i of order) {
        if (picked.length >= limit) break;
        for (const off of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
          const cell = { x: route.cells[i].x + off.x, y: route.cells[i].y + off.y };
          if (picked.some((p) => p.x === cell.x && p.y === cell.y)) continue;
          if (canMarkZone(state, cell).ok && routeWith(state.map, [...picked, cell])) {
            picked.push(cell);
            break;
          }
        }
      }
      return picked;
    },

    choose(state, options) {
      const merges = [...options.merges].sort((a, b) => b.size - a.size);
      return [
        ...options.recipes.map((r) => ({ type: 'recipe', recipeId: r.recipeId, anchor: r.anchors[0] })),
        ...merges.map((m) => ({ type: 'merge', size: m.size, anchor: m.anchors[0] })),
        ...state.pods.map((_, index) => ({ type: 'keep', anchor: index })),
      ];
    },
  },
];

export function strategyById(id) {
  // King of the Hill brings strategies of its own (M7b, tests/tools/koth-strategies.mjs).
  const all = [...STRATEGIES, ...KOTH_STRATEGIES];
  const found = all.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown strategy "${id}" (known: ${all.map((s) => s.id).join(', ')})`);
  return found;
}
