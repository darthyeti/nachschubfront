// Puts the bots next to a match somebody played by hand (M6, part 1, step 3).
//
//   npm run calibrate
//   npm run calibrate -- balancing/protokolle/nachschubfront-2026-09-28-8425CM-welle35.json
//
// Without arguments it takes every protocol in balancing/protokolle/ that is a
// measurement — no debug levers in it — and for each one plays every strategy on
// the same seed.
//
// Why this tool exists at all: the numbers a bot produces are worth only as much
// as the resemblance between the bot and a player. A bot places its zones by a
// rule, and that is a different thing from a person laying out a maze — that is
// the standing decision of 23.09.2026, and this is the answer to it that did not
// exist then. Until a strategy sits in the same range as the person on the same
// map, its survival curves are a direction and not a measurement.
//
// The closeness is one number so the strategies can be ordered, and it is spelt
// out below so nobody has to trust it: the distance in waves reached, the
// average distance in route length, and the average distance in lives, each
// divided by a scale that makes a full miss about 1.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseProtocol } from '../../src/storage/protocol.js';
import { isMeasurable } from '../../src/sim/record.js';
import { reference } from './reference.mjs';
import { RULESET_VERSION } from '../../src/data/rules.js';
import { STRATEGIES } from './bot-strategies.mjs';
import { playBotMatch } from './bot-player.mjs';

const FOLDER = 'balancing/protokolle';

const skipped = [];
const given = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const files = given.length > 0 ? given : listProtocols();

if (files.length === 0) {
  console.error(`Keine Protokolle in ${FOLDER}/. Eine Partie spielen und über „Partie exportieren" ablegen.`);
  process.exit(1);
}

for (const file of files) {
  const parsed = parseProtocol(readFileSync(file, 'utf8'));
  if (!parsed.ok) {
    console.log(`${file}: kein Protokoll (${parsed.error}) — übersprungen.`);
    continue;
  }
  const human = parsed.match;
  if (!isMeasurable(human)) {
    console.log(`${file}: Debug-Hebel benutzt (${human.tainted.join(', ')}) — keine Messung, übersprungen.`);
    continue;
  }

  // The human's own match, replayed, so both sides come from the same place and
  // a protocol from an older build is read the same way it is read everywhere —
  // but only while the replay still produces that match. If it does not, ranking
  // bots against it would be ranking them against a match nobody played, which
  // is worse than having no reference at all (reference.mjs).
  const check = reference(human, parsed.app);
  if (!check.ok) {
    console.log(`\n# ${file}`);
    console.log(`Übersprungen. ${check.why}`);
    skipped.push(file);
    continue;
  }
  const played = check.played;
  const target = summarise(played.waves);
  console.log(`\n# ${file}`);
  console.log(
    `Seed ${human.seed} · Version ${parsed.app ?? 'unbekannt'} · Regelversion ${human.ruleset}` +
      `${human.ruleset === RULESET_VERSION ? '' : ` (heute ${RULESET_VERSION}, spielt sich aber noch nach)`} · ` +
      `von Hand: ${target.waves} Wellen, ` +
      `${target.lives} Leben am Ende, Route ${target.route.toFixed(1)} im Mittel, ` +
      `Stellungen ${target.ranks.join('/')}+${target.specials}`,
  );
  const rated = human.waves.filter((w) => w.rating);
  if (rated.length > 0) {
    const counts = { easy: 0, fine: 0, hard: 0 };
    for (const w of rated) counts[w.rating] = (counts[w.rating] ?? 0) + 1;
    console.log(
      `Sein Urteil: ${counts.easy}x zu leicht, ${counts.fine}x passt, ${counts.hard}x zu schwer ` +
        `(${rated.length} von ${human.waves.length} Wellen bewertet)`,
    );
  }
  console.log('');

  const header = ['Strategie', 'Wellen', 'Leben', 'Route', 'Stellungen', 'ΔWellen', 'ΔRoute', 'ΔLeben', 'Abstand'];
  const widths = [12, 6, 5, 6, 12, 7, 7, 7, 7];
  console.log(header.map((h, i) => h.padStart(widths[i])).join(' '));
  console.log('-'.repeat(widths.reduce((a, b) => a + b + 1, -1)));

  const scored = [];
  for (const strategy of STRATEGIES) {
    const run = playBotMatch({ seed: human.seed, strategy: strategy.id });
    const bot = summarise(run.waves);
    const distance = closeness(played.waves, run.waves);
    scored.push({ strategy, bot, distance });
    const cells = [
      strategy.id,
      bot.waves,
      bot.lives,
      bot.route.toFixed(1),
      `${bot.ranks.join('/')}+${bot.specials}`,
      distance.waves,
      distance.route.toFixed(1),
      distance.lives.toFixed(1),
      distance.total.toFixed(2),
    ];
    console.log(cells.map((c, i) => String(c).padStart(widths[i])).join(' '));
  }

  const best = [...scored].sort((a, b) => a.distance.total - b.distance.total)[0];
  console.log('');
  console.log(
    `Am nächsten: ${best.strategy.title} (${best.strategy.id}), Abstand ${best.distance.total.toFixed(2)}.`,
  );
  console.log(verdict(best, target));
}

// Said once, at the end: how much ground the whole run stands on. Before, this
// line was printed under every protocol, where it could only ever count the
// protocols read so far.
const usable = files.length - skipped.length;
console.log('');
console.log(
  `Grundlage: ${usable} von ${files.length} ${files.length === 1 ? 'Protokoll' : 'Protokollen'}. ` +
    (usable < 3
      ? 'Zu wenige, um eine Strategie daran festzuziehen — was hier passt, kann auf diese eine Partie zugeschnitten sein.'
      : 'Eine Strategie, die über alle Protokolle nahe liegt, taugt als Richtwert.'),
);

if (skipped.length > 0) {
  console.log('');
  console.log(
    `${skipped.length} ${skipped.length === 1 ? 'Protokoll' : 'Protokolle'} nicht verwendet, weil das ` +
      'Nachspielen die Partie nicht mehr ergibt:',
  );
  for (const file of skipped) console.log(`  ${file}`);
}

/**
 * The plan asks for a bot "in the same order of magnitude" as the player, which
 * is a looser thing than playing like them, so both are said separately: the
 * order of magnitude is the acceptance criterion, the resemblance is the goal.
 */
function verdict(best, target) {
  const share = best.bot.waves / Math.max(1, target.waves);
  const sameOrder = share >= 0.7 && share <= 1.3;
  if (best.distance.total <= 0.35) {
    return 'Das spielt wie er: mit dieser Strategie sind Bot-Läufe als Richtwert brauchbar.';
  }
  if (sameOrder) {
    return (
      `Das ist dieselbe Größenordnung (${best.bot.waves} gegen ${target.waves} Wellen, ` +
      `${Math.round(share * 100)} %) — das Abnahmekriterium ist damit erfüllt. Wie er spielt die Strategie aber nicht; ` +
      'für einzelne Wellen sind ihre Zahlen kein Maß.'
    );
  }
  return 'Das ist keine Eichung: keine Strategie kommt an ihn heran. Bot-Zahlen bleiben reine Richtwerte.';
}

function listProtocols() {
  try {
    return readdirSync(FOLDER)
      .filter((name) => name.endsWith('.json'))
      .map((name) => join(FOLDER, name));
  } catch {
    return [];
  }
}

/** The few numbers a match is compared on. */
function summarise(waves) {
  const last = waves[waves.length - 1] ?? null;
  const ranks = [0, 0, 0, 0, 0];
  for (const line of waves) {
    for (let i = 0; i < ranks.length; i++) ranks[i] = Math.max(ranks[i], line.byRank?.[i] ?? 0);
  }
  return {
    waves: waves.length,
    lives: last?.lives ?? 0,
    route: waves.reduce((sum, w) => sum + w.route, 0) / Math.max(1, waves.length),
    ranks,
    specials: Math.max(0, ...waves.map((w) => w.specials ?? 0)),
  };
}

/**
 * How far a bot match is from a human one.
 *
 * The comparison runs over the **human's whole match**, not over the waves both
 * of them reached. That was the first version, and it flattered a bot that died
 * early: on a 50-wave match `recipes` reached wave 10 and came out "closest",
 * because the nine waves it did play had a short route and full lives, and the
 * forty it missed were not counted at all. A bot that is not there is maximally
 * unlike him, so a wave it never reached counts as a full miss.
 *
 * The scales make one whole unit a full miss: the wave distance against the
 * human's own length, forty cells of route, ten lives. The three are added and
 * divided by three, so a total near zero means "plays like him" and a total near
 * one means "nothing like him".
 */
function closeness(human, bot) {
  let route = 0;
  let lives = 0;
  for (let i = 0; i < human.length; i++) {
    const his = human[i];
    const its = bot[i];
    // Beyond the bot's end: the whole of his route and his lives are the gap.
    route += its ? Math.abs(his.route - its.route) : his.route;
    lives += its ? Math.abs(his.lives - its.lives) : his.lives;
  }
  const n = Math.max(1, human.length);
  route /= n;
  lives /= n;
  const waves = Math.abs(human.length - bot.length);
  const total = (Math.min(1, waves / n) + Math.min(1, route / 40) + Math.min(1, lives / 10)) / 3;
  return { waves, route, lives, total };
}
