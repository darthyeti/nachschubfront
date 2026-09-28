// Plays many seeds with one strategy and says how far they got (M6, part 1,
// step 3).
//
//   npm run bots                                  20 seeds, every strategy
//   npm run bots -- --seeds 200 --strategy maze    the order's own example
//   npm run bots -- --seeds 50 --csv balancing/runden/bots-1.csv
//   npm run bots -- --seeds 20 --protocols balancing/protokolle/bot
//
// The output is the survival rate per wave, the lives left at the end and the
// waves that cost lives — over all seeds, so a single lucky map cannot pass for
// balance.
//
// **An uncalibrated bot is not a measurement.** `npm run calibrate` puts these
// strategies next to a match Till played and says which of them is anywhere near
// him; until one is, these numbers are a direction and no more. That is the
// standing decision of 23.09.2026, narrowed rather than dropped: a bot that
// places its zones by a rule measures something other than a person.
//
// The maze builder costs about 25 seconds for a late match — every candidate
// zone costs a path search, and the maze it builds is enormous — so the seeds
// are spread over worker processes.

import { fork } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRng } from '../../src/core/random.js';
import { SEED_ALPHABET } from '../../src/core/seed.js';
import { STRATEGIES, strategyById } from './bot-strategies.mjs';
import { playBotMatch } from './bot-player.mjs';
import { exportProtocol } from '../../src/storage/protocol.js';
import { totalWaves } from '../../src/sim/waves.js';

const HERE = fileURLToPath(import.meta.url);

// ---------- worker ----------
// One match per message, so a long strategy does not block the others and a
// crash takes one seed with it rather than the whole run.
if (process.env.NACHSCHUB_BOT_WORKER) {
  process.on('message', ({ seed, strategy, protocols }) => {
    try {
      const run = playBotMatch({ seed, strategy });
      const last = run.waves[run.waves.length - 1] ?? null;
      process.send({
        seed,
        strategy,
        waves: run.waves.length,
        lives: last?.lives ?? 0,
        route: last?.route ?? 0,
        towers: last?.towers ?? 0,
        stopped: run.stopped,
        bleeding: run.waves.filter((w) => w.leaked > 0).map((w) => w.w),
        damage: run.waves.reduce((sum, w) => sum + w.damage, 0),
        overkill: run.waves.reduce((sum, w) => sum + w.overkill, 0),
        commandDamage: run.waves.reduce((sum, w) => sum + w.commandDamage, 0),
        requisition: last?.requisition ?? 0,
        commandPoints: last?.commandPoints ?? 0,
        protocol: protocols ? exportProtocol(run.log) : null,
      });
    } catch (error) {
      process.send({ seed, strategy, error: String(error?.message ?? error) });
    }
  });
} else {
  await main();
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name, fallback = null) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const count = Number(option('seeds', 20));
  const only = option('strategy');
  const csvFile = option('csv');
  const protocolPrefix = option('protocols');
  const workers = Math.max(1, Number(option('workers', Math.min(8, availableParallelism()))));
  const strategies = only ? [strategyById(only)] : STRATEGIES;
  const seeds = makeSeeds(count);

  console.log(
    `${seeds.length} Seeds · ${strategies.length} ${strategies.length === 1 ? 'Strategie' : 'Strategien'} · ` +
      `${workers} Prozesse · ${totalWaves()} Wellen je Partie`,
  );
  console.log('Bot-Zahlen ohne Eichung sind Richtwerte, keine Messung (npm run calibrate).');
  console.log('');

  const rows = [];
  for (const strategy of strategies) {
    const started = Date.now();
    const results = await runAll(seeds, strategy.id, workers, Boolean(protocolPrefix));
    const failed = results.filter((r) => r.error);
    const ok = results.filter((r) => !r.error).sort((a, b) => a.seed.localeCompare(b.seed));

    console.log(`## ${strategy.title} (${strategy.id})`);
    console.log(`   ${strategy.about}`);
    report(ok, seeds.length);
    if (failed.length > 0) {
      console.log(`   ${failed.length} Seeds abgebrochen: ${failed.map((f) => `${f.seed} (${f.error})`).join(', ')}`);
    }
    console.log(`   ${((Date.now() - started) / 1000).toFixed(1)} s`);
    console.log('');

    for (const r of ok) rows.push({ strategy: strategy.id, ...r });
    if (protocolPrefix) {
      for (const r of ok) {
        if (!r.protocol) continue;
        const path = `${protocolPrefix}-${strategy.id}-${r.seed}.json`;
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${JSON.stringify(r.protocol, null, 2)}\n`);
      }
      console.log(`   Protokolle: ${protocolPrefix}-${strategy.id}-*.json`);
    }
  }

  if (csvFile) {
    const names = ['strategy', 'seed', 'waves', 'lives', 'route', 'towers', 'damage', 'overkill', 'commandDamage', 'requisition', 'commandPoints', 'stopped', 'bleeding'];
    const csv = [names.join(',')];
    for (const row of rows) {
      csv.push(names.map((n) => (n === 'bleeding' ? row.bleeding.join(' ') : row[n])).join(','));
    }
    mkdirSync(dirname(csvFile), { recursive: true });
    writeFileSync(csvFile, `${csv.join('\n')}\n`);
    console.log(`CSV: ${csvFile}`);
  }
}

/** Seeds the same way the game hands them out, from one fixed stream. */
function makeSeeds(count) {
  const rng = createRng('M6-BOTS');
  const seeds = [];
  while (seeds.length < count) {
    let seed = '';
    for (let i = 0; i < 6; i++) seed += SEED_ALPHABET[Math.floor(rng.next() * SEED_ALPHABET.length)];
    if (!seeds.includes(seed)) seeds.push(seed);
  }
  return seeds;
}

/** Spreads the seeds over worker processes and collects what comes back. */
function runAll(seeds, strategy, workers, protocols) {
  return new Promise((resolve) => {
    const results = [];
    const queue = [...seeds];
    const children = [];
    let running = 0;

    const hand = (child) => {
      const seed = queue.shift();
      if (seed === undefined) {
        child.disconnect();
        return;
      }
      running += 1;
      child.send({ seed, strategy, protocols });
    };

    for (let i = 0; i < Math.min(workers, seeds.length); i++) {
      const child = fork(HERE, [], { env: { ...process.env, NACHSCHUB_BOT_WORKER: '1' }, silent: false });
      children.push(child);
      child.on('message', (result) => {
        results.push(result);
        running -= 1;
        // Only where it can be overwritten; in a pipe a carriage return is a
        // character like any other and the line would pile up.
        if (process.stdout.isTTY) process.stdout.write(`\r   ${results.length}/${seeds.length} Partien`);
        if (queue.length > 0) hand(child);
        else {
          child.disconnect();
          if (running === 0 && results.length === seeds.length) {
            if (process.stdout.isTTY) process.stdout.write('\r                           \r');
            resolve(results);
          }
        }
      });
      hand(child);
    }
  });
}

/** What the run says, over all seeds. */
function report(results, total) {
  if (results.length === 0) {
    console.log('   nichts gelaufen');
    return;
  }
  const waves = results.map((r) => r.waves).sort((a, b) => a - b);
  const median = waves[Math.floor(waves.length / 2)];
  const mean = waves.reduce((a, b) => a + b, 0) / waves.length;
  console.log(
    `   Wellen: Median ${median}, Mittel ${mean.toFixed(1)}, von ${waves[0]} bis ${waves[waves.length - 1]}` +
      ` · Siege ${results.filter((r) => r.stopped === 'victory').length}/${total}`,
  );

  // Where the survival curve falls away: the share of matches still alive.
  const marks = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
  const alive = marks
    .map((w) => `W${w} ${Math.round((results.filter((r) => r.waves >= w).length / results.length) * 100)}%`)
    .join(' · ');
  console.log(`   Überlebensquote: ${alive}`);

  const bleeding = new Map();
  for (const r of results) for (const w of r.bleeding) bleeding.set(w, (bleeding.get(w) ?? 0) + 1);
  const worst = [...bleeding.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log(
    `   Wellen mit Durchbrüchen: ${worst.map(([w, n]) => `W${w} (${n}x)`).join(' · ') || 'keine'}`,
  );

  const damage = results.reduce((sum, r) => sum + r.damage, 0);
  const overkill = results.reduce((sum, r) => sum + r.overkill, 0);
  console.log(
    `   Route am Ende: Mittel ${(results.reduce((s, r) => s + r.route, 0) / results.length).toFixed(1)}` +
      ` · Verschwendeter Schaden: ${Math.round((overkill / Math.max(1, damage)) * 100)} % des angekommenen` +
      ` · Requisition übrig: Mittel ${Math.round(results.reduce((s, r) => s + r.requisition, 0) / results.length)}`,
  );
}
