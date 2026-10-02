// King of the Hill with the study's four bots over many seeds (M7b, B7).
//
//   npm run koth-bots                                   20 seeds, the mode's values
//   npm run koth-bots -- --seeds 50 --ban 4,3,0 --hp 0.1,0.02 --every 0,4
//
// Prints, per setting and strategy, the median wave reached and the range. The
// settings are tried in memory only; nothing in src/data changes. A bot is a
// heuristic and a lower bound, not a player (docs/PROGRESS.md, M6 decision 7).

import { createRng } from '../../src/core/random.js';
import { SEED_ALPHABET } from '../../src/core/seed.js';
import { MODES } from '../../src/data/modes.js';
import { playBotMatch } from './bot-player.mjs';
import { KOTH_STRATEGIES } from './koth-strategies.mjs';

function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}
const list = (text) => text.split(',').map(Number);

const koth = MODES.koth;
const seedCount = Number(option('seeds', 20));
const bans = list(option('ban', String(koth.map.banRadius)));
const hps = list(option('hp', String(koth.balance.enemyHpFactor)));
const everies = list(option('every', '0'));

const rng = createRng('koth-bots');
const seeds = Array.from({ length: seedCount }, () =>
  Array.from({ length: 6 }, () => SEED_ALPHABET[rng.int(0, SEED_ALPHABET.length - 1)]).join(''),
);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const original = { map: koth.map, balance: koth.balance };
try {
  for (const ban of bans) {
    for (const hp of hps) {
      for (const every of everies) {
        koth.map = { ...original.map, banRadius: ban };
        koth.balance = { ...original.balance, enemyHpFactor: hp };
        const cells = [];
        for (const { id } of KOTH_STRATEGIES) {
          const reached = seeds.map(
            (seed) => playBotMatch({ seed, strategy: id, config: { mode: 'koth' }, upgradeEvery: every }).waves.length,
          );
          cells.push(`${id} ${median(reached)} (${Math.min(...reached)}–${Math.max(...reached)})`);
        }
        console.log(`Sperrradius ${ban} · LP-Faktor ${hp} · Aufwertung alle ${every || '–'}: ${cells.join(' | ')}`);
      }
    }
  }
} finally {
  koth.map = original.map;
  koth.balance = original.balance;
}
