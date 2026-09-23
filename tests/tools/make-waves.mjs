// Generates the 50-wave table in src/data/waves.js from the rules of GDD
// section 9 ("Wellenaufbau" and "Einstieg"). Run with `npm run waves`.
//
// The table is written out in full instead of being computed at runtime, so it
// stays readable and can be tuned wave by wave in M6. Hand edits are lost on
// the next run: change the rules here, not the output.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../../src/data/waves.js', import.meta.url));

const WAVE_COUNT = 50;
/** Health grows by 12 % per wave. */
const HEALTH_GROWTH = 1.12;
/** Enemies per wave: 12 plus half the wave number, swarmers twice as many. */
const BASE_COUNT = 12;
const COUNT_PER_WAVE = 0.5;
const SWARMER_FACTOR = 2;

/** The five-wave cycle; every tenth wave is replaced by a boss. */
const CYCLE = ['horde', 'armour', 'air', 'warp', 'mixed'];

/** Seconds between two enemies of the same group. */
const INTERVAL = {
  swarmer: 0.4,
  warrior: 0.8,
  breaker: 1.5,
  warpseer: 1.1,
  carrionflyer: 0.8,
  burster: 1.1,
  healer: 1.6,
};

/**
 * First wave an enemy type can appear in (GDD section 9, "Einstieg"). Armour
 * and air arrive later than their slot in the cycle, so the opening waves stay
 * mild while the base route is still short.
 */
const UNLOCK = {
  swarmer: 1,
  warrior: 1,
  breaker: 4,
  carrionflyer: 6,
  warpseer: 4,
  burster: 7,
  healer: 9,
};

/** The first waves carry 30 percent fewer enemies (GDD section 9, "Einstieg"). */
const EARLY_WAVES = 5;
const EARLY_FACTOR = 0.7;

/** Boss waves: the boss plus its escort, as shares of the normal wave count. */
const BOSS_WAVES = {
  10: { boss: 'broodmother', escort: [['swarmer', 1.0], ['warrior', 0.4]] },
  20: { boss: 'colossusbreaker', escort: [['breaker', 0.35], ['warrior', 0.5]] },
  30: { boss: 'warpherald', escort: [['warpseer', 0.5], ['healer', 0.2]] },
  40: { boss: 'swarmqueen', escort: [['carrionflyer', 0.8], ['warrior', 0.4]] },
  50: { boss: 'daemonprince', escort: [['breaker', 0.3], ['warpseer', 0.3], ['carrionflyer', 0.4]] },
};

const waveCount = (wave) => Math.round(BASE_COUNT + COUNT_PER_WAVE * wave);
const share = (wave, type, fraction) => {
  if (wave < UNLOCK[type]) return 0;
  const base =
    waveCount(wave) *
    (type === 'swarmer' ? SWARMER_FACTOR : 1) *
    (wave <= EARLY_WAVES ? EARLY_FACTOR : 1);
  return Math.max(1, Math.round(base * fraction));
};

/** Enemy mix of a normal wave, as [type, share of the wave count] pairs. */
function composition(kind, wave) {
  if (kind === 'horde') return [['swarmer', 1.0], ['warrior', 0.3]];
  if (kind === 'armour') return [['breaker', 0.4], ['warrior', 0.5], ['burster', 0.25]];
  if (kind === 'air') return [['carrionflyer', 1.0], ['warrior', 0.4]];
  if (kind === 'warp') return [['warpseer', 0.6], ['warrior', 0.4], ['healer', 0.15]];
  return [
    ['warrior', 0.4],
    ['swarmer', 0.4],
    ['breaker', 0.2],
    ['carrionflyer', 0.25],
    ['warpseer', 0.2],
    ['burster', 0.15],
    ['healer', 0.1],
  ];
}

/**
 * The composition of a wave with the types it may not field yet taken out. Their
 * share goes to the remaining types in proportion, so a wave never ends up as a
 * handful of stragglers just because its lead enemy is still locked.
 */
function unlocked(kind, wave) {
  const all = composition(kind, wave);
  const open = all.filter(([type]) => wave >= UNLOCK[type]);
  const missing = all.reduce((sum, [type, f]) => (wave < UNLOCK[type] ? sum + f : sum), 0);
  if (missing === 0 || open.length === 0) return open;
  const openShare = open.reduce((sum, [, f]) => sum + f, 0);
  const factor = (openShare + missing) / openShare;
  return open.map(([type, f]) => [type, f * factor]);
}

/**
 * What the wave is called. A cycle slot whose lead enemy is still locked would
 * otherwise promise something it cannot field: an "air" wave without a single
 * flyer. Such a wave is what is left of it, a horde of warriors and swarmers.
 */
const LEAD = { horde: 'swarmer', armour: 'breaker', air: 'carrionflyer', warp: 'warpseer' };
function label(kind, wave) {
  return LEAD[kind] && wave < UNLOCK[LEAD[kind]] ? 'horde' : kind;
}

function buildWave(wave) {
  const scale = Number((HEALTH_GROWTH ** (wave - 1)).toFixed(4));
  const bossWave = BOSS_WAVES[wave];
  const groups = [];
  if (bossWave) {
    groups.push({ type: bossWave.boss, count: 1, interval: 0, delay: 0 });
    for (const [type, fraction] of bossWave.escort) {
      const count = share(wave, type, fraction);
      if (count > 0) groups.push({ type, count, interval: INTERVAL[type], delay: 3 + groups.length });
    }
    return { kind: 'boss', scale, groups };
  }
  const kind = CYCLE[(wave - 1) % CYCLE.length];
  for (const [type, fraction] of unlocked(kind, wave)) {
    const count = share(wave, type, fraction);
    if (count > 0) groups.push({ type, count, interval: INTERVAL[type], delay: groups.length * 2 });
  }
  return { kind: label(kind, wave), scale, groups };
}

const waves = [];
for (let wave = 1; wave <= WAVE_COUNT; wave++) waves.push(buildWave(wave));

const lines = waves.map((w, i) => {
  const groups = w.groups
    .map((g) => `    { type: '${g.type}', count: ${g.count}, interval: ${g.interval}, delay: ${g.delay} },`)
    .join('\n');
  const total = w.groups.reduce((sum, g) => sum + g.count, 0);
  return `  // Wave ${i + 1} · ${w.kind} · ${total} enemies\n  { kind: '${w.kind}', scale: ${w.scale}, groups: [\n${groups}\n  ] },`;
});

const header = `// The complete wave list (GDD section 9, "Wellenaufbau" and "Einstieg").
//
// Generated by tests/tools/make-waves.mjs (\`npm run waves\`): five-wave cycle
// horde, armour, air, warp, mixed, every tenth wave a boss with escort. The
// first ${EARLY_WAVES} waves carry ${Math.round((1 - EARLY_FACTOR) * 100)} percent fewer enemies, and a cycle slot whose
// lead enemy is not unlocked yet is called what is left of it.
// \`scale\` multiplies the health and shield of every enemy of that wave
// (${HEALTH_GROWTH} to the power of wave minus one). Each group spawns \`count\`
// enemies of \`type\`, \`interval\` seconds apart, starting \`delay\` seconds after
// the wave begins. Edits here are overwritten on the next run of the tool.

export const WAVES = [
${lines.join('\n')}
];

/** Health factor of a wave; 1 for anything outside the table. */
export function waveScale(wave) {
  return WAVES[wave - 1]?.scale ?? 1;
}
`;

writeFileSync(OUT, header);
console.log(`${waves.length} waves written to src/data/waves.js`);
