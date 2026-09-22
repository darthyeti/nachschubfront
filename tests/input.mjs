// End-to-end input checks in a real browser (Playwright, Chromium).
// Tablet: touch swipe, tap, pinch via CDP touch events. Desktop: wheel, right drag,
// click, H and G keys. Also plays a wave at 3x and checks the sprite gallery.
// Fails on any assertion or console error.
//
// Usage: npm run test:input [-- --browser webkit]

import * as playwright from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, startServer, watchProblems, browserName, launchBrowser } from './tools/server.mjs';

const OUT = join(ROOT, 'tests', 'output');
const SEED = 'BASTION';

await mkdir(OUT, { recursive: true });
const server = await startServer();
const engine = browserName();
const browser = await launchBrowser(playwright, engine);
console.log(`engine: ${engine}`);
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
  await page.waitForSelector('body[data-ready]');
  await frames(page, 5);
  return { context, page };
}

/**
 * Multi-touch input. Chromium: native touch events via CDP. WebKit has no CDP, so
 * touch-type PointerEvents are dispatched on the canvas (what the game listens to).
 * Same call shape for both: touch('touchStart' | 'touchMove' | 'touchEnd', [[x, y], ...]).
 */
async function touchDriver(context, page) {
  if (engine === 'chromium') {
    const cdp = await context.newCDPSession(page);
    return (type, points) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map(([x, y], id) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })),
      });
  }
  let active = [];
  return (type, points) =>
    page.evaluate(
      ([kind, pts, prev]) => {
        const canvas = document.getElementById('game');
        const fire = (name, id, [x, y]) =>
          canvas.dispatchEvent(
            new PointerEvent(name, {
              pointerId: 100 + id,
              pointerType: 'touch',
              isPrimary: id === 0,
              clientX: x,
              clientY: y,
              button: 0,
              buttons: name === 'pointerup' ? 0 : 1,
              bubbles: true,
              cancelable: true,
            }),
          );
        if (kind === 'touchEnd') prev.forEach((p, id) => fire('pointerup', id, p));
        else pts.forEach((p, id) => fire(kind === 'touchStart' && !prev[id] ? 'pointerdown' : 'pointermove', id, p));
      },
      [type, points, active],
    ).then(() => {
      active = type === 'touchEnd' ? [] : points;
    });
}

/**
 * Requests a salvo, waits for the pods to land and keeps the pod `anchor`.
 * @param {(x: number, y: number) => Promise<void>} tapAt  Tap or click driver.
 */
async function playRound(page, tapAt, anchor = 0) {
  await page.getByRole('button', { name: 'Salve anfordern' }).click();
  await page.waitForFunction(() => window.__nachschub.state().phase === 'selection', null, { timeout: 60000 });
  const pod = (await game(page)).pods[anchor];
  const [x, y] = await screenOf(page, pod);
  await tapAt(x, y);
  await page.waitForFunction(() => window.__nachschub.state().phase === 'wave', null, { timeout: 10000 });
  return pod;
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
    const touch = await touchDriver(context, page);

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

    await page.getByRole('button', { name: 'Hindernis-Modus' }).tap();

    await check('tap marks a landing zone, tapping again clears it', async () => {
      const cell = await blockableRouteCell(page);
      const [x, y] = await screenOf(page, cell);
      await page.touchscreen.tap(x, y);
      await frames(page);
      let s = await game(page);
      assert.deepEqual(s.zones, [{ x: cell.x, y: cell.y }]);
      assert.equal(s.obstacles, before.obstacles, 'a zone is a marker, not an obstacle');
      assert.ok(
        s.routeCells.some((c) => c.x === cell.x && c.y === cell.y),
        'the route still runs through the marked cell',
      );
      await page.touchscreen.tap(x, y);
      await frames(page);
      s = await game(page);
      assert.deepEqual(s.zones, []);
    });

    await check('a zone on a protected cell is refused', async () => {
      // Route-cutting zones are covered by the unit tests; here the rift ring.
      const [x, y] = await screenOf(page, (await game(page)).rift);
      await page.touchscreen.tap(x, y);
      await frames(page);
      assert.deepEqual((await game(page)).zones, []);
    });

    await check('wave at 3x runs, enemies break through, back to planning', async () => {
      await page.getByRole('button', { name: '3x' }).tap();
      await playRound(page, (x, y) => page.touchscreen.tap(x, y));
      const s = await game(page);
      assert.equal(s.towers.length, 1, 'the kept pod became a tower');
      assert.equal(s.obstacles, before.obstacles + 4, 'the other four pods became rubble');
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
      // The towers do not shoot yet, so the second wave overruns the bastion.
      await playRound(page, (x, y) => page.touchscreen.tap(x, y));
      await page.waitForFunction(() => window.__nachschub.state().phase === 'defeat', null, { timeout: 90000 });
      const banner = await page.locator('.hud-banner').textContent();
      assert.match(banner, /Bastion ist gefallen/);
      assert.ok(await page.getByRole('button', { name: 'Salve anfordern' }).isHidden());
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

    await check('after clicking a HUD button, Space still toggles pause', async () => {
      await page.getByRole('button', { name: '2x' }).click();
      assert.equal((await game(page)).speed, 2);
      await page.keyboard.press(' ');
      await frames(page);
      assert.equal((await game(page)).speed, 0, 'Space must pause, not re-press the focused button');
      await page.keyboard.press(' ');
      await frames(page);
      assert.equal((await game(page)).speed, 2);
    });

    await check('G switches between sprites and placeholder art', async () => {
      assert.equal((await page.evaluate(() => window.__nachschub.ui())).art, 'sprites');
      await page.keyboard.press('g');
      assert.equal((await page.evaluate(() => window.__nachschub.ui())).art, 'placeholder');
      await page.keyboard.press('g');
      assert.equal((await page.evaluate(() => window.__nachschub.ui())).art, 'sprites');
    });

    await page.screenshot({ path: join(OUT, 'desktop-input.png') });
    await context.close();
  }

  // ---------- Sprite gallery ----------
  console.log('sprite gallery (tablet)');
  {
    const context = await browser.newContext({
      viewport: { width: 1180, height: 820 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    watchProblems(page, 'gallery', problems);
    await page.goto(`${server.url}tests/sprites.html`, { waitUntil: 'networkidle' });

    await check('gallery rasterizes all 30 towers and 7 enemies without failures', async () => {
      await page.waitForSelector('body[data-ready]', { timeout: 20000 });
      const stats = await page.evaluate(() => window.__gallery.stats());
      assert.equal(stats.failed, 0);
      assert.ok(stats.rasterized >= 37, `rasterized ${stats.rasterized}`);
    });

    await check('gallery zoom presets reach every raster level', async () => {
      for (const z of ['0.5', '1', '2', '2.5']) {
        await page.getByRole('button', { name: `Zoom ${z}`, exact: true }).tap();
        await frames(page, 3);
        const cam = await page.evaluate(() => window.__gallery.camera());
        assert.ok(Math.abs(cam.zoom - Number(z)) < 1e-6, `zoom ${cam.zoom}`);
      }
      await page.waitForTimeout(800);
      assert.equal((await page.evaluate(() => window.__gallery.stats())).failed, 0);
    });

    await page.screenshot({ path: join(OUT, 'gallery.png') });
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
