// End-to-end input checks in a real browser (Playwright, Chromium).
// Tablet: touch swipe, tap, pinch via CDP touch events. Desktop: wheel, right drag,
// click, H key. Also plays a wave at 3x. Fails on any assertion or console error.
//
// Usage: npm run test:input

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, startServer, watchProblems } from './tools/server.mjs';

const OUT = join(ROOT, 'tests', 'output');
const SEED = 'BASTION';

await mkdir(OUT, { recursive: true });
const server = await startServer();
const browser = await chromium.launch();
const problems = [];
const results = [];

async function check(name, fn) {
  await fn();
  results.push(name);
  console.log(`  ✔ ${name}`);
}

const game = (page) => page.evaluate(() => window.__nachschub.state());
const camera = (page) => page.evaluate(() => window.__nachschub.camera());
const screenOf = (page, cell) => page.evaluate(([x, y]) => window.__nachschub.screenOfCell(x, y), [cell.x, cell.y]);
const frames = (page, n = 3) =>
  page.evaluate((count) => new Promise((resolve) => {
    let left = count;
    const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }), n);

async function openGame(options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  watchProblems(page, options.hasTouch ? 'tablet' : 'desktop', problems);
  await page.goto(`${server.url}?seed=${SEED}&debug`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__nachschub);
  await frames(page, 5);
  return { context, page };
}

/** Finds a route cell near the middle of the route that may be blocked. */
async function blockableRouteCell(page) {
  return page.evaluate(() => {
    const cells = window.__nachschub.state().routeCells;
    const mid = Math.floor(cells.length / 2);
    const order = cells.map((c, i) => [Math.abs(i - mid), c]).sort((a, b) => a[0] - b[0]);
    return order.map(([, c]) => c).find((c) => window.__nachschub.canPlace(c.x, c.y));
  });
}

try {
  // ---------- Tablet with touch ----------
  console.log('tablet (1180 x 820, touch)');
  {
    const { context, page } = await openGame({
      viewport: { width: 1180, height: 820 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    });
    const cdp = await context.newCDPSession(page);
    const touch = (type, points) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map(([x, y], id) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })),
      });

    await check('start view: cells at least 40 px wide', async () => {
      const cam = await camera(page);
      assert.ok(cam.zoom * 64 >= 40, `cell ${cam.zoom * 64} px`);
    });

    await page.getByRole('button', { name: 'Hindernis-Modus' }).tap();
    const before = await game(page);

    await check('one-finger swipe pans without selecting or placing', async () => {
      const cam0 = await camera(page);
      await touch('touchStart', [[600, 420]]);
      for (let i = 1; i <= 10; i++) await touch('touchMove', [[600 - i * 12, 420 + i * 5]]);
      await touch('touchEnd', []);
      await frames(page);
      const cam1 = await camera(page);
      const after = await game(page);
      assert.ok(Math.abs(cam1.x - cam0.x) > 50, `camera x ${cam0.x} -> ${cam1.x}`);
      assert.equal(after.obstacles, before.obstacles, 'swipe must not place an obstacle');
      assert.equal(after.hover, null, 'swipe must not select a cell');
    });

    await check('tap on a route cell places an obstacle and reroutes', async () => {
      const cell = await blockableRouteCell(page);
      const [x, y] = await screenOf(page, cell);
      await page.touchscreen.tap(x, y);
      await frames(page);
      const s = await game(page);
      assert.deepEqual(s.hover, { x: cell.x, y: cell.y }, 'tap hits the intended cell');
      assert.equal(s.obstacles, before.obstacles + 1);
      assert.ok(!s.routeCells.some((c) => c.x === cell.x && c.y === cell.y), 'route avoids the new obstacle');
      assert.ok(s.route >= before.route, `route ${before.route} -> ${s.route}`);
      await page.touchscreen.tap(x, y);
      await frames(page);
      assert.equal((await game(page)).obstacles, before.obstacles, 'second tap removes it');
    });

    await check('tap on the protected rift is refused', async () => {
      const s = await game(page);
      const [x, y] = await screenOf(page, s.rift);
      await page.touchscreen.tap(x, y);
      await frames(page);
      assert.equal((await game(page)).obstacles, before.obstacles);
    });

    await check('two-finger pinch zooms in and out', async () => {
      const z0 = (await camera(page)).zoom;
      await touch('touchStart', [[540, 420], [640, 420]]);
      for (let i = 1; i <= 8; i++) await touch('touchMove', [[540 - i * 12, 420], [640 + i * 12, 420]]);
      await touch('touchEnd', []);
      await frames(page);
      const z1 = (await camera(page)).zoom;
      assert.ok(z1 > z0 * 1.5, `zoom ${z0} -> ${z1}`);
      await touch('touchStart', [[440, 420], [740, 420]]);
      for (let i = 1; i <= 8; i++) await touch('touchMove', [[440 + i * 15, 420], [740 - i * 15, 420]]);
      await touch('touchEnd', []);
      await frames(page);
      const z2 = (await camera(page)).zoom;
      assert.ok(z2 < z1, `zoom ${z1} -> ${z2}`);
      assert.equal((await game(page)).obstacles, before.obstacles, 'pinch must not place anything');
    });

    await check('buttons are at least 44 x 44 CSS px', async () => {
      const sizes = await page.$$eval('#hud button:not([hidden])', (bs) =>
        bs.map((b) => [b.textContent, b.getBoundingClientRect().width, b.getBoundingClientRect().height]),
      );
      for (const [label, w, h] of sizes) assert.ok(w >= 44 && h >= 44, `${label}: ${w} x ${h}`);
    });

    await check('wave at 3x runs, enemies break through, back to planning', async () => {
      await page.getByRole('button', { name: '3x' }).tap();
      await page.getByRole('button', { name: 'Welle starten' }).tap();
      await page.waitForFunction(() => window.__nachschub.state().enemies >= 6, null, { timeout: 15000 });
      const mid = await game(page);
      assert.equal(mid.phase, 'wave');
      assert.equal(mid.speed, 3);
      await page.screenshot({ path: join(OUT, 'tablet-wave.png') });
      await page.waitForFunction(() => window.__nachschub.state().phase === 'planning', null, { timeout: 90000 });
      const end = await game(page);
      assert.equal(end.wave, 1);
      assert.ok(end.lives < 20, `lives ${end.lives}`);
    });

    await check('defeat shows a banner and "Neue Partie" starts a fresh match', async () => {
      // Without towers the second wave overruns the bastion.
      await page.getByRole('button', { name: 'Welle starten' }).tap();
      await page.waitForFunction(() => window.__nachschub.state().phase === 'defeat', null, { timeout: 90000 });
      const banner = await page.locator('.hud-banner').textContent();
      assert.match(banner, /Bastion ist gefallen/);
      assert.ok(await page.getByRole('button', { name: 'Welle starten' }).isHidden());
      await page.getByRole('button', { name: 'Neue Partie' }).tap();
      await frames(page);
      const s = await game(page);
      assert.equal(s.phase, 'planning');
      assert.equal(s.wave, 0);
      assert.equal(s.lives, 20);
      assert.ok(!page.url().includes(`seed=${SEED}`), 'new match gets a new seed');
      assert.equal(await page.locator('.hud-banner').textContent(), '');
    });

    await context.close();
  }

  // ---------- Desktop with mouse and keyboard ----------
  console.log('desktop (1440 x 900, mouse)');
  {
    const { context, page } = await openGame({ viewport: { width: 1440, height: 900 } });
    const before = await game(page);

    await check('mouse wheel zooms around the pointer', async () => {
      const z0 = (await camera(page)).zoom;
      await page.mouse.move(700, 450);
      await page.mouse.wheel(0, -300);
      await frames(page);
      const z1 = (await camera(page)).zoom;
      assert.ok(z1 > z0, `zoom ${z0} -> ${z1}`);
    });

    await check('right-button drag pans without selecting', async () => {
      const cam0 = await camera(page);
      await page.mouse.move(700, 450);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(600, 400, { steps: 6 });
      await page.mouse.up({ button: 'right' });
      await frames(page);
      const cam1 = await camera(page);
      assert.ok(Math.abs(cam1.x - cam0.x) > 20, `camera x ${cam0.x} -> ${cam1.x}`);
      assert.equal((await game(page)).obstacles, before.obstacles);
    });

    await check('hover highlights the cell, H toggles an obstacle there', async () => {
      const cell = await blockableRouteCell(page);
      const [x, y] = await screenOf(page, cell);
      await page.mouse.move(x, y);
      await frames(page);
      assert.deepEqual((await game(page)).hover, { x: cell.x, y: cell.y });
      await page.keyboard.press('h');
      await frames(page);
      assert.equal((await game(page)).obstacles, before.obstacles + 1);
      await page.keyboard.press('h');
      await frames(page);
      assert.equal((await game(page)).obstacles, before.obstacles);
    });

    await check('arrow keys pan the camera', async () => {
      const cam0 = await camera(page);
      await page.keyboard.down('ArrowLeft');
      await page.waitForTimeout(250);
      await page.keyboard.up('ArrowLeft');
      const cam1 = await camera(page);
      assert.ok(cam1.x < cam0.x, `camera x ${cam0.x} -> ${cam1.x}`);
    });

    await check('space toggles pause', async () => {
      await page.keyboard.press(' ');
      await frames(page);
      assert.equal((await game(page)).speed, 0);
      await page.keyboard.press(' ');
      await frames(page);
      assert.equal((await game(page)).speed, 1);
    });

    await page.screenshot({ path: join(OUT, 'desktop-input.png') });
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`\n${results.length} input checks passed, no console errors.`);
