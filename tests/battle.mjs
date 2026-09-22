// Plays a real match in the browser: marks landing zones next to the route,
// requests salvo after salvo at 3x and screenshots the thick of the fighting.
// Fails on any console error, so a long match is checked end to end.
//
// Usage: npm run test:battle [-- --waves 12] [--browser webkit] [--speed 3]

import * as playwright from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, startServer, watchProblems, browserName, launchBrowser } from './tools/server.mjs';

const OUT = join(ROOT, 'tests', 'output');
const SEED = 'BASTION';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const WAVES = arg('waves', 12);
const SPEED = arg('speed', 3);
/** Screenshot when this wave is running and busy. */
const SHOT_WAVE = arg('shot', 10);

await mkdir(OUT, { recursive: true });
const server = await startServer();
const engine = browserName();
const browser = await launchBrowser(playwright, engine);
const problems = [];

const state = (page) => page.evaluate(() => window.__nachschub.state());

const context = await browser.newContext({
  viewport: { width: 1180, height: 820 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();
watchProblems(page, 'battle', problems);

try {
  await page.goto(`${server.url}?seed=${SEED}&debug`, { waitUntil: 'networkidle' });
  await page.waitForSelector('body[data-ready]');
  await page.getByRole('button', { name: `${SPEED}x` }).tap();

  /** Marks up to five zones next to the route, starting in its middle. */
  async function markZones() {
    const cells = await page.evaluate(() => {
      const s = window.__nachschub.state();
      const order = [...s.routeCells.keys()].sort(
        (a, b) => Math.abs(a - s.routeCells.length / 2) - Math.abs(b - s.routeCells.length / 2),
      );
      const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const picked = [];
      const taken = new Set();
      for (const i of order) {
        if (picked.length >= 5) break;
        for (const [dx, dy] of offsets) {
          const x = s.routeCells[i].x + dx;
          const y = s.routeCells[i].y + dy;
          const key = `${x},${y}`;
          if (taken.has(key) || !window.__nachschub.canPlace(x, y)) continue;
          taken.add(key);
          picked.push(window.__nachschub.screenOfCell(x, y));
          break;
        }
      }
      return picked;
    });
    for (const [x, y] of cells) {
      if (x < 0 || y < 0 || x > 1180 || y > 700) continue;
      await page.touchscreen.tap(x, y);
    }
  }

  let shot = false;
  for (let round = 1; round <= WAVES; round++) {
    await markZones();
    await page.getByRole('button', { name: 'Salve anfordern' }).tap();
    await page.waitForFunction(() => window.__nachschub.state().phase === 'selection', null, { timeout: 30000 });
    // Take the richest option the panel offers: the last button is the strongest.
    const actions = await page.$$('.selection-actions button');
    await actions[actions.length - 1].click();
    await page.waitForFunction(() => window.__nachschub.state().phase === 'wave', null, { timeout: 10000 });

    if (!shot && round >= SHOT_WAVE) {
      await page.waitForFunction(() => window.__nachschub.state().enemies >= 12, null, { timeout: 60000 });
      await page.screenshot({ path: join(OUT, 'tablet-battle.png') });
      shot = true;
    }
    await page.waitForFunction(
      () => ['planning', 'defeat', 'victory'].includes(window.__nachschub.state().phase),
      null,
      { timeout: 180000 },
    );
    const s = await state(page);
    console.log(
      `Welle ${String(s.wave).padStart(2)} · tot ${String(s.waveStats.killed).padStart(3)} · ` +
        `durch ${String(s.waveStats.leaked).padStart(2)} · Leben ${String(s.lives).padStart(2)} · ` +
        `Stellungen ${String(s.towers.length).padStart(2)} · Requisition ${s.requisition}`,
    );
    if (s.phase !== 'planning') break;
  }

  const s = await state(page);
  assert.ok(s.wave >= WAVES, `only reached wave ${s.wave} of ${WAVES} (phase ${s.phase})`);
  assert.ok(shot, 'no battle screenshot taken');
  console.log(`${engine}: ${WAVES} waves played at ${SPEED}x, lives ${s.lives}.`);
} finally {
  await context.close();
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('No console errors.');
