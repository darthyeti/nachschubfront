// Changing balancing values for one run, without touching src/data/ (M6).
//
// This is what `npm run replay -- --data changes.json` uses: the same recorded
// match is played again with different numbers, and the two results are put
// side by side. The values are merged into the imported data objects before the
// run, so every reader sees them — the simulation reads the tables live.
//
// **It changes numbers in rows, never the shape of a table.** Several values are
// computed once at import and would not notice a new row: MAX_SALVO_SIZE from
// SALVO_SIZES, MAX_SUPPLY_LEVEL and SUPPLY_WEIGHT_COUNT from SUPPLY_LEVELS,
// MAX_RANK and RANK_COLORS from RANKS, IMPACT_SECONDS from the capsule times,
// and the id lists of the doctrines, enemies, recipes and commands. An override
// that added a ninth supply level would leave all of those behind and quietly
// compute nonsense, so adding, removing or retyping is refused and named
// instead. Growing a table is a real code change, not a run of this tool.
//
// The wave rules are reachable as well (`waves`), because the biggest lever in
// the game lives there: the enemy count and the 1.12 health growth per wave.
// Touching them rebuilds src/data/waves.js in memory for the run.
//
// An override file looks like the data it changes, nested as deeply:
//
//   {
//     "enemies": { "warrior": { "health": 90 } },
//     "waves": { "healthGrowth": 1.08 },
//     "ranks": { "4": { "damage": 24 } },
//     "supply": { "7": { "cost": 400 } }
//   }
//
// Tables that are arrays — ranks, supply, salvo, commands — are addressed by
// **index from zero**, so supply level 8 is `"7"` and the legend rank is `"4"`.
// The refusals are German because the tools that print them are.

import { DOCTRINES } from '../../src/data/doctrines.js';
import { DAMAGE_MATRIX, WARP_SHIELD } from '../../src/data/combat.js';
import { ENEMIES, BOSSES, KOLOSS, KOLOSS_RUN } from '../../src/data/enemies.js';
import { SPECIALS } from '../../src/data/specials.js';
import { RANKS } from '../../src/data/ranks.js';
import { ECONOMY } from '../../src/data/economy.js';
import { RULES } from '../../src/data/rules.js';
import { SUPPLY_LEVELS } from '../../src/data/supply.js';
import { SALVO_SIZES, PODS } from '../../src/data/pods.js';
import { COMMANDS } from '../../src/data/commands.js';
import { WAVES } from '../../src/data/waves.js';
import { WAVE_RULES, buildWaves } from './wave-rules.mjs';

/** What an override file may address, by the name it uses for it. */
export const TARGETS = {
  doctrines: DOCTRINES,
  matrix: DAMAGE_MATRIX,
  warpShield: WARP_SHIELD,
  enemies: ENEMIES,
  bosses: BOSSES,
  koloss: KOLOSS,
  kolossRun: KOLOSS_RUN,
  specials: SPECIALS,
  ranks: RANKS,
  economy: ECONOMY,
  rules: RULES,
  supply: SUPPLY_LEVELS,
  salvo: SALVO_SIZES,
  pods: PODS,
  commands: COMMANDS,
  waves: WAVE_RULES,
};

/**
 * Applies an override and hands back what it did and what it refused, plus the
 * way to put everything back.
 *
 * @param {object} override  `{ target: { path: value } }`, nested as deeply as
 *   the data is: `{ enemies: { warrior: { health: 90 } } }`. Arrays are indexed
 *   by number: `{ ranks: { 4: { damage: 24 } } }`.
 * @returns {{applied: string[], refused: {path: string, why: string}[], undo: Function}}
 */
export function applyOverride(override) {
  const applied = [];
  const refused = [];
  const restores = [];

  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    return { applied, refused: [{ path: '', why: 'keine Änderungsliste' }], undo: () => {} };
  }

  for (const [name, changes] of Object.entries(override)) {
    const target = TARGETS[name];
    if (!target) {
      refused.push({ path: name, why: `unbekannte Tabelle (bekannt: ${Object.keys(TARGETS).join(', ')})` });
      continue;
    }
    merge(target, changes, name, { applied, refused, restores });
  }

  // Touching the wave rules means the generated table has to be rebuilt, or the
  // run would use the old one. Rebuilt in place, because the table is imported
  // as a const array everywhere.
  const rebuildWaves = applied.some((path) => path.startsWith('waves.'));
  if (rebuildWaves) {
    const before = WAVES.slice();
    const next = buildWaves(WAVE_RULES);
    WAVES.length = 0;
    WAVES.push(...next);
    restores.push(() => {
      WAVES.length = 0;
      WAVES.push(...before);
    });
    applied.push('waves (table rebuilt)');
  }

  return {
    applied,
    refused,
    undo() {
      // Backwards, so a value changed twice ends up where it started.
      for (let i = restores.length - 1; i >= 0; i--) restores[i]();
    },
  };
}

function merge(target, changes, path, out) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    out.refused.push({ path, why: 'hier wird ein Objekt mit Änderungen erwartet' });
    return;
  }
  for (const [key, value] of Object.entries(changes)) {
    const here = `${path}.${key}`;
    const index = Array.isArray(target) ? Number(key) : key;
    if (Array.isArray(target) && !Number.isInteger(index)) {
      out.refused.push({ path: here, why: 'diese Tabelle ist eine Liste und wird über den Index angesprochen' });
      continue;
    }
    if (!(index in target)) {
      out.refused.push({
        path: here,
        why: Array.isArray(target)
          ? `Index ${index} liegt außerhalb der Liste (0 bis ${target.length - 1}); dieses Werkzeug ändert Werte, es fügt keine hinzu`
          : 'diesen Wert gibt es nicht; dieses Werkzeug ändert Werte, es fügt keine hinzu',
      });
      continue;
    }
    const before = target[index];
    if (isPlainObject(value)) {
      if (before === null || typeof before !== 'object') {
        out.refused.push({ path: here, why: `kann nicht in einen Wert vom Typ ${typeof before} hineingehen` });
        continue;
      }
      merge(before, value, here, out);
      continue;
    }
    const problem = mismatch(before, value);
    if (problem) {
      out.refused.push({ path: here, why: problem });
      continue;
    }
    target[index] = value;
    out.restores.push(() => {
      target[index] = before;
    });
    out.applied.push(here);
  }
}

/** Why a new value cannot replace the old one, or null when it can. */
function mismatch(before, value) {
  if (Array.isArray(before)) {
    if (!Array.isArray(value)) return `hier wird eine Liste mit ${before.length} Werten erwartet`;
    if (value.length !== before.length) {
      return `eine Liste behält ihre Länge (${before.length}, bekommen ${value.length})`;
    }
    return value.every((v, i) => mismatch(before[i], v) === null)
      ? null
      : 'die Liste enthält einen Wert der falschen Art';
  }
  if (before === null || before === undefined) return null;
  if (typeof before !== typeof value) return `erwartet ${typeof before}, bekommen ${typeof value}`;
  if (typeof value === 'number' && !Number.isFinite(value)) return 'keine endliche Zahl';
  return null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
