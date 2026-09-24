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
import { ROOT, startServer, watchProblems, browserName, launchBrowser, startMatch } from './tools/server.mjs';

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
  await startMatch(page);
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
  await page.getByRole('button', { name: 'Behalten' }).click();
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
    /** The pods of the first salvo; later checks count rubble against them. */
    let pods = [];

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
      // Only what is on screen: panels that are closed (commands, selection,
      // info) have no size. The debug panel is a development tool, not a player
      // surface, so the thumb-size rule does not apply to it.
      const sizes = await page.$$eval('#hud button:not([hidden])', (bs) =>
        bs
          .filter((b) => b.offsetParent !== null && !b.closest('.debug-panel'))
          .map((b) => [b.textContent, b.getBoundingClientRect().width, b.getBoundingClientRect().height]),
      );
      for (const [label, w, h] of sizes) assert.ok(w >= 44 && h >= 44, `${label}: ${w} x ${h}`);
    });

    await check('the recipe codex lists all six recipes and closes again', async () => {
      await page.getByRole('button', { name: 'Rezepte' }).tap();
      await frames(page);
      assert.ok(await page.locator('.codex').isVisible());
      assert.equal((await page.$$('.codex-card')).length, 6);
      assert.match(await page.locator('.codex-card').first().textContent(), /Reinigungsschrein/);
      await page.screenshot({ path: join(OUT, 'tablet-codex.png') });
      await page.getByRole('button', { name: 'Schließen' }).tap();
      await frames(page);
      assert.ok(await page.locator('.codex').isHidden());
      assert.equal((await game(page)).obstacles, before.obstacles, 'the codex does not touch the map');
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
        'the cell is only blocked when the pod lands',
      );
      assert.ok(s.previewCells, 'the preview follows the marker');
      assert.ok(
        !s.previewCells.some((c) => c.x === cell.x && c.y === cell.y),
        'the preview already walks around the zone',
      );
      // Wave 1 gets six pods (GDD section 3); the counter names the salvo size.
      const shown = await page.locator('.hud-info .chip').first().textContent();
      assert.match(shown, /Zonen 1\/6/);

      await page.touchscreen.tap(x, y);
      await frames(page);
      s = await game(page);
      assert.deepEqual(s.zones, []);
      assert.equal(s.previewCells, null, 'preview cleared with the marker');
    });

    await check('a long press opens the info panel, the close button shuts it', async () => {
      const [x, y] = await screenOf(page, (await game(page)).rift);
      await touch('touchStart', [[x, y]]);
      await page.waitForSelector('.info:not([hidden])', { timeout: 5000 });
      await touch('touchEnd', []);
      await frames(page);
      assert.match(await page.locator('.info-title').textContent(), /Riss/);
      assert.deepEqual((await game(page)).zones, [], 'a long press marks nothing');
      await page.getByRole('button', { name: 'Schließen' }).tap();
      await frames(page);
      assert.ok(await page.locator('.info').isHidden());
    });

    await check('a zone on a protected cell is refused', async () => {
      // Route-cutting zones are covered by the unit tests; here the rift ring.
      const [x, y] = await screenOf(page, (await game(page)).rift);
      await page.touchscreen.tap(x, y);
      await frames(page);
      assert.deepEqual((await game(page)).zones, []);
    });

    await check('the selection panel lists the whole salvo, a tap on the map picks one', async () => {
      await page.getByRole('button', { name: 'Salve anfordern' }).click();
      await page.waitForFunction(() => window.__nachschub.state().phase === 'selection', null, { timeout: 60000 });
      const cards = await page.$$('.selection-card');
      assert.equal(cards.length, (await game(page)).pods.length, 'one card per pod');
      assert.equal((await page.evaluate(() => window.__nachschub.ui())).podSelected, 0, 'first pod preselected');

      // Pick a pod other than the preselected one that the panel does not cover;
      // on the map only the free area is tappable, the cards reach every pod.
      const panel = await page.evaluate(() => {
        const r = document.querySelector('.selection').getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      });
      pods = (await game(page)).pods;
      const spots = await Promise.all(pods.map((p) => screenOf(page, p)));
      const clear = ([x, y]) => x < panel.left - 10 || x > panel.right + 10 || y < panel.top - 10 || y > panel.bottom + 10;
      // Highest on screen first, so the match plays out the same way as before
      // the panel moved to the side.
      const index = spots
        .map(([x, y], i) => [y, i, [x, y]])
        .filter(([, i, spot]) => i > 0 && clear(spot))
        .sort((a, b) => a[0] - b[0])[0]?.[1];
      assert.ok(index > 0, `no pod beside the panel: ${JSON.stringify(spots)} vs ${JSON.stringify(panel)}`);
      const [px, py] = spots[index];
      const pod = pods[index];
      await page.touchscreen.tap(px, py);
      await frames(page);
      assert.equal((await page.evaluate(() => window.__nachschub.ui())).podSelected, index, 'tapping the pod picks it');
      // The panel rebuilds its cards on every change, so query them again.
      assert.equal(await page.$$eval('.selection-card', (cs) => cs.findIndex((c) => c.getAttribute('aria-pressed') === 'true')), index);
      await page.screenshot({ path: join(OUT, 'tablet-selection.png') });

      await page.getByRole('button', { name: 'Behalten' }).click();
      await page.waitForFunction(() => window.__nachschub.state().phase === 'wave', null, { timeout: 10000 });
      const s = await game(page);
      assert.equal(s.towers.length, 1, 'the picked pod became a tower');
      assert.deepEqual({ x: s.towers[0].x, y: s.towers[0].y }, { x: pod.x, y: pod.y }, 'on the picked pod cell');
      assert.equal(s.obstacles, before.obstacles + pods.length - 1, 'every other pod became rubble');
      await frames(page);
      assert.ok(await page.locator('.selection').isHidden(), 'the panel closes with the choice');
      // Wave 1 sends its enemies against a single tower that lands wherever the
      // salvo puts it and often cannot even reach the route: the bastion falls
      // (noted in docs/PROGRESS.md as a balancing question for M6). The checks
      // that follow need a living match, so the bastion is propped up here and
      // knocked down again for the defeat check.
      await page.evaluate(() => window.__nachschub.debug.setLives(200));
      // At 1x a whole wave takes its time; this waits in real seconds.
      await page.waitForFunction(() => window.__nachschub.state().phase === 'planning', null, { timeout: 180000 });
    });

    await check('second salvo at 3x, the wave runs and the towers kill', async () => {
      await page.getByRole('button', { name: '3x' }).tap();
      await playRound(page, (x, y) => page.touchscreen.tap(x, y));
      const s = await game(page);
      assert.equal(s.wave, 2);
      assert.equal(s.towers.length, 2, 'every salvo leaves exactly one tower');
      // Two salvos of six pods: two towers and everything else rubble.
      assert.equal(s.obstacles, before.obstacles + 2 * (pods.length - 1), 'the rest is rubble');
      await page.waitForFunction(() => window.__nachschub.state().enemies >= 6, null, { timeout: 15000 });
      const mid = await game(page);
      assert.equal(mid.phase, 'wave');
      assert.equal(mid.speed, 3);
      await page.screenshot({ path: join(OUT, 'tablet-wave.png') });
      // The towers defend now: something has to die before the wave is over.
      await page.waitForFunction(() => window.__nachschub.state().waveStats.killed > 0, null, { timeout: 30000 });
    });

    await check('defeat ends on the result screen, which starts a fresh match', async () => {
      // Two towers hold the wave off for a long time, so the defeat is forced.
      await page.evaluate(() => window.__nachschub.debug.setLives(1));
      await page.waitForFunction(() => window.__nachschub.state().phase === 'defeat', null, { timeout: 120000 });
      const end = page.locator('.menu[data-menu="end"]');
      await end.waitFor({ state: 'visible' });
      assert.match(await end.locator('.menu-title').textContent(), /Bastion ist gefallen/);
      // The result carries the score of the lost match (GDD section 12).
      assert.match(await end.locator('.menu-score').textContent(), /Punkte/);
      // Every screen pauses the match.
      assert.equal((await game(page)).speed, 0);
      await end.getByRole('button', { name: 'Neue Partie' }).tap();
      await frames(page);
      const s = await game(page);
      assert.equal(s.phase, 'planning');
      assert.equal(s.wave, 0);
      assert.equal(s.lives, 20);
      assert.ok(s.speed > 0, 'and the new match is running');
      assert.ok(!page.url().includes(`seed=${SEED}`), 'new match gets a new seed');
      assert.equal(await page.locator('.hud-banner').textContent(), '');
    });

    await check('escape opens the pause screen and resumes from it', async () => {
      const pause = page.locator('.menu[data-menu="pause"]');
      await page.keyboard.press('Escape');
      await pause.waitFor({ state: 'visible' });
      assert.equal((await game(page)).speed, 0, 'the match stops while the screen is up');
      await pause.getByRole('button', { name: 'Weiter' }).tap();
      await pause.waitFor({ state: 'hidden' });
      assert.ok((await game(page)).speed > 0, 'and runs again afterwards');
    });

    await check('the settings keep what the player picks', async () => {
      await page.keyboard.press('Escape');
      await page.locator('.menu[data-menu="pause"]').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Einstellungen' }).tap();
      const settings = page.locator('.menu[data-menu="settings"]');
      await settings.waitFor({ state: 'visible' });
      await settings.getByRole('button', { name: 'Reduziert' }).tap();
      assert.equal(
        await page.evaluate(() => JSON.parse(localStorage.getItem('nachschubfront:prefs')).motion),
        'reduced',
      );
      // Back to full, so the rest of the run is unaffected.
      await settings.getByRole('button', { name: 'Voll' }).tap();
      await settings.getByRole('button', { name: 'Zurück' }).tap();
      await page.locator('.menu[data-menu="pause"]').getByRole('button', { name: 'Weiter' }).tap();
      await page.locator('.menu[data-menu="pause"]').waitFor({ state: 'hidden' });
    });

    await check('the supply button names its level, price and the chances it buys', async () => {
      const supply = page.getByRole('button', { name: /Nachschubstufe/ });
      const label = await supply.locator('.supply-label').textContent();
      const level = (await game(page)).supplyLevel;
      assert.match(label, new RegExp(`Nachschubstufe ${level} auf ${level + 1}`), label);

      // One bar per rank, filled to that rank's chance at the level being bought.
      const bars = await supply.locator('.supply-bar-fill').evaluateAll((els) =>
        els.map((e) => e.style.height));
      assert.equal(bars.length, 5, 'one bar per rank');
      assert.deepEqual(bars, ['80%', '20%', '0%', '0%', '0%'], 'the chances of level 2');

      // The explanation must not be hover-only: a long press puts it in the banner.
      // The events go straight to the button, because the shared touch driver
      // aims at the canvas and this is a HUD button.
      const afterTap = await game(page);
      await supply.evaluate((b) => {
        const opts = { pointerType: 'touch', pointerId: 1, isPrimary: true, bubbles: true, cancelable: true };
        b.dispatchEvent(new PointerEvent('pointerdown', opts));
      });
      await page.waitForTimeout(700);
      await supply.evaluate((b) => {
        const opts = { pointerType: 'touch', pointerId: 1, isPrimary: true, bubbles: true, cancelable: true };
        b.dispatchEvent(new PointerEvent('pointerup', opts));
        b.click();
      });
      await frames(page);
      const banner = await page.locator('.hud-banner').textContent();
      assert.match(banner, /nur für künftige Kapseln/, banner);
      assert.match(banner, /Rekrut 80 %/, banner);
      assert.equal((await game(page)).supplyLevel, afterTap.supplyLevel, 'a long press buys nothing');
    });

    await check('demolish mode clears several cells in a row, each after a confirming tap', async () => {
      // Debug rubble stands in for the heaps a salvo leaves behind.
      await page.getByRole('button', { name: 'Hindernis-Modus' }).tap();
      const cells = [];
      for (let i = 0; i < 2; i++) {
        const cell = await blockableRouteCell(page);
        const [x, y] = await screenOf(page, cell);
        await page.touchscreen.tap(x, y);
        await frames(page);
        cells.push([x, y]);
      }
      const withRubble = await game(page);
      await page.getByRole('button', { name: 'Hindernis-Modus' }).tap();

      await page.evaluate(() => window.__nachschub.debug.grant({ requisition: 500 }));
      await frames(page);
      const demolish = page.getByRole('button', { name: /Abreißen/ });
      await demolish.tap();
      await frames(page);
      assert.equal((await page.evaluate(() => window.__nachschub.ui())).demolishMode, true);

      // On touch the first tap only arms the cell; nothing has been torn down yet.
      await page.touchscreen.tap(...cells[0]);
      await frames(page);
      assert.ok((await page.evaluate(() => window.__nachschub.ui())).demolishArmed, 'cell armed');
      assert.equal((await game(page)).obstacles, withRubble.obstacles, 'still standing');
      // Let the placement flashes fade, so the picture shows the mode alone.
      await frames(page, 70);
      await page.screenshot({ path: join(OUT, 'tablet-demolish.png') });

      await page.touchscreen.tap(...cells[0]);
      await frames(page);
      const once = await game(page);
      assert.equal(once.obstacles, withRubble.obstacles - 1, 'the heap is gone');
      assert.ok(once.requisition < 500, 'and it was paid for');
      assert.equal(once.demolished, 1);
      assert.equal((await page.evaluate(() => window.__nachschub.ui())).demolishArmed, null);

      // The mode stays on, so the next cell goes the same way without a detour.
      await page.touchscreen.tap(...cells[1]);
      await page.touchscreen.tap(...cells[1]);
      await frames(page);
      const twice = await game(page);
      assert.equal(twice.obstacles, withRubble.obstacles - 2, 'and so is the second');
      assert.equal(twice.demolished, 2);
      assert.ok(twice.requisition < once.requisition - 15, 'the second one cost more');

      await demolish.tap();
      await frames(page);
      assert.equal((await page.evaluate(() => window.__nachschub.ui())).demolishMode, false);
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

    await check('sound starts after the first interaction', async () => {
      const audio = await page.evaluate(() => window.__nachschub.audio());
      assert.equal(audio.ready, true, 'the context is running');
      assert.equal(audio.muted, false);
    });

    await check('every sound recipe actually makes a sound', async () => {
      // Rendered offline, so the check works on a machine without speakers.
      const peaks = await page.evaluate(async () => {
        const { playSound } = await import('/src/audio/synth.js');
        const { SOUNDS } = await import('/src/data/audio.js');
        const out = {};
        for (const [name, sound] of Object.entries(SOUNDS)) {
          const ctx = new OfflineAudioContext(1, 44100 * 3, 44100);
          playSound(ctx, ctx.destination, sound, { at: 0 });
          const data = (await ctx.startRendering()).getChannelData(0);
          let peak = 0;
          for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
          out[name] = peak;
        }
        return out;
      });
      for (const [name, peak] of Object.entries(peaks)) {
        assert.ok(peak > 0.005, `${name} is silent (peak ${peak})`);
        assert.ok(peak < 2, `${name} clips (peak ${peak})`);
      }
      assert.ok(Object.keys(peaks).length >= 15, 'all sounds were rendered');
    });

    await page.screenshot({ path: join(OUT, 'desktop-input.png') });
    await context.close();
  }

  // ---------- The two bugs from play test 2 ----------
  console.log('reported bugs (tablet, touch)');
  {
    const { context, page } = await openGame({
      viewport: { width: 1180, height: 820 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    });
    const demolish = page.getByRole('button', { name: /^Abreißen/ });

    await check('the demolish mode can be left with an empty purse', async () => {
      await page.evaluate(() => window.__nachschub.debug.grant({ requisition: 500 }));
      await demolish.tap();
      assert.equal((await page.evaluate(() => window.__nachschub.ui())).demolishMode, true);

      // Spend everything while the mode is open: the button used to grey out and
      // there was no way back into normal planning.
      await page.evaluate(() => window.__nachschub.debug.grant({ requisition: -1e6 }));
      await page.waitForFunction(() => window.__nachschub.state().requisition === 0);
      assert.ok(!(await demolish.isDisabled()), 'the way out stays reachable');
      await demolish.tap();
      assert.equal((await page.evaluate(() => window.__nachschub.ui())).demolishMode, false);

      // And it is disabled again as an entrance, because nothing can be paid for.
      await frames(page, 3);
      assert.ok(await demolish.isDisabled(), 'entering without funds stays refused');
    });

    await check('escape leaves the demolish mode before it opens the menu', async () => {
      await page.evaluate(() => window.__nachschub.debug.grant({ requisition: 500 }));
      await demolish.tap();
      await page.keyboard.press('Escape');
      assert.equal((await page.evaluate(() => window.__nachschub.ui())).demolishMode, false);
      assert.ok(await page.locator('.menu[data-menu="pause"]').isHidden(), 'the menu stays shut');
      await page.keyboard.press('Escape');
      await page.waitForSelector('.menu[data-menu="pause"]:not([hidden])');
      await page.keyboard.press('Escape');
    });

    await check('starting a salvo drops the demolish mode', async () => {
      await demolish.tap();
      await page.getByRole('button', { name: 'Salve anfordern' }).click();
      await page.waitForFunction(() => window.__nachschub.state().phase !== 'planning', null, { timeout: 60000 });
      // The phase change and the frame that reads it are two different moments.
      await frames(page, 3);
      assert.equal((await page.evaluate(() => window.__nachschub.ui())).demolishMode, false);
    });

    await context.close();
  }

  // ---------- Capsules on rubble ----------
  console.log('capsules on rubble (tablet, touch)');
  {
    const { context, page } = await openGame({
      viewport: { width: 1180, height: 820 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    });
    const touch = await touchDriver(context, page);
    const tapCell = async (cell) => {
      const [x, y] = await screenOf(page, cell);
      await touch('touchStart', [[x, y]]);
      await touch('touchEnd', []);
      await frames(page, 2);
    };
    /** A free cell near the middle of the route, turned into rubble by the debug mode. */
    const makeRubble = async () => {
      const cell = await blockableRouteCell(page);
      await page.getByRole('button', { name: 'Hindernis-Modus' }).tap();
      await tapCell(cell);
      await page.getByRole('button', { name: 'Hindernis-Modus' }).tap();
      const rubble = await page.evaluate(([x, y]) => window.__nachschub.isRubble(x, y), [cell.x, cell.y]);
      assert.ok(rubble, `no rubble on ${cell.x},${cell.y}`);
      return cell;
    };
    let rubbleCell = null;

    await check('a landing zone may be marked on a heap of rubble', async () => {
      const cell = await makeRubble();
      const routeBefore = (await game(page)).route;
      await tapCell(cell);
      const state = await game(page);
      assert.ok(
        state.zones.some((z) => z.x === cell.x && z.y === cell.y),
        'the zone was accepted',
      );
      assert.equal(state.route, routeBefore, 'the route cannot change: the cell was blocked already');
      rubbleCell = cell;
    });

    await check('the card names the demolition, and building pays it once', async () => {
      await page.evaluate(() => window.__nachschub.debug.grant({ requisition: 500 }));
      await page.getByRole('button', { name: 'Salve anfordern' }).click();
      await page.waitForFunction(() => window.__nachschub.state().phase === 'selection', null, { timeout: 60000 });

      const cell = rubbleCell;
      const index = (await game(page)).pods.findIndex((p) => p.x === cell.x && p.y === cell.y);
      assert.ok(index >= 0, 'a pod came down on the rubble');
      const card = page.locator('.selection-card').nth(index);
      assert.match(await card.textContent(), /Trümmer · Abriss \d+ R/);

      await card.tap();
      const before = (await game(page)).requisition;
      await page.getByRole('button', { name: 'Behalten' }).click();
      await page.waitForFunction(() => window.__nachschub.state().phase === 'wave', null, { timeout: 10000 });
      const after = await game(page);
      assert.ok(after.requisition < before, 'the demolition was billed');
      assert.equal(after.demolished, 1);
      assert.ok(
        after.towers.some((t) => t.x === cell.x && t.y === cell.y),
        'the emplacement stands where the rubble was',
      );
    });

    await context.close();
  }

  // ---------- Records, export and import ----------
  // Tablet with touch: export and import have to be usable with a finger, and
  // the paste box is the fallback for exactly that device.
  console.log('records, export and import (tablet, touch)');
  {
    const { context, page } = await openGame({
      viewport: { width: 1180, height: 820 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    });
    // The records screen hangs off the main menu and the end screen, so the way
    // in from a running match is pause, main menu, list.
    const openRecords = async () => {
      await page.keyboard.press('Escape');
      await page.waitForSelector('.menu[data-menu="pause"]:not([hidden])');
      await page.getByRole('button', { name: 'Hauptmenü' }).tap();
      await page.waitForSelector('.menu[data-menu="main"]:not([hidden])');
      await page.getByRole('button', { name: 'Bestenliste' }).tap();
      await page.waitForSelector('.menu[data-menu="records"]:not([hidden])');
    };
    const rows = () => page.$$eval('.records-table tbody tr', (list) => list.map((r) => r.textContent));
    const statOf = (label) =>
      page.evaluate((want) => {
        const dl = document.querySelector('.menu[data-menu="records"] .menu-score');
        const terms = [...dl.querySelectorAll('dt')];
        const i = terms.findIndex((t) => t.textContent === want);
        return i === -1 ? null : dl.querySelectorAll('dd')[i].textContent;
      }, label);

    await check('an empty profile says so instead of showing a table', async () => {
      await openRecords();
      assert.ok(await page.locator('.records-table').isHidden(), 'no table without a single match');
      assert.equal(await statOf('Partien'), '0');
      assert.equal(await statOf('Liebste Doktrin'), '—');
      assert.ok(await page.getByRole('button', { name: 'Exportieren' }).isDisabled(), 'nothing to export yet');
      await page.getByRole('button', { name: 'Zurück' }).tap();
      await page.waitForSelector('.menu[data-menu="main"]:not([hidden])');
      await page.getByRole('button', { name: 'Feldzug beginnen' }).tap();
      await page.waitForSelector('.menu[data-menu="main"]', { state: 'hidden' });
    });

    await check('a lost match lands in the list, in the statistics and in storage', async () => {
      await playRound(page, (x, y) => page.mouse.click(x, y));
      // Losing on purpose: defeat is only checked while a wave runs.
      await page.evaluate(() => window.__nachschub.debug.setLives(0));
      await page.waitForSelector('.menu[data-menu="end"]:not([hidden])');
      assert.match(await page.locator('.menu-record').textContent(), /Neuer Bestwert/);

      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('nachschubfront:profile')));
      assert.equal(stored.stats.matches, 1, 'the match is on disk, not only on screen');
      assert.equal(stored.stats.victories, 0);
      assert.ok(stored.best['2']?.length === 1, 'filed under the current ruleset version');
      assert.equal(stored.best['2'][0].seed, SEED);

      await page.getByRole('button', { name: 'Bestenliste' }).tap();
      await page.waitForSelector('.menu[data-menu="records"]:not([hidden])');
      const list = await rows();
      assert.equal(list.length, 1);
      assert.ok(list[0].includes(SEED), `row was ${list[0]}`);
      assert.equal(await statOf('Partien'), '1');
      assert.notEqual(await statOf('Liebste Doktrin'), '—', 'the tower built during the round counts');
      await page.screenshot({ path: join(OUT, 'records-list.png') });
    });

    await check('a tap on a seed carries it to the main menu', async () => {
      await page.locator('.records-seed').first().tap();
      await page.waitForSelector('.menu[data-menu="main"]:not([hidden])');
      assert.equal(await page.inputValue('.menu-seed-input'), SEED);
    });

    await check('every control on the records screen is at least 44 px tall', async () => {
      await page.getByRole('button', { name: 'Bestenliste' }).first().tap();
      await page.waitForSelector('.menu[data-menu="records"]:not([hidden])');
      const small = await page.$$eval('.menu[data-menu="records"] button, .menu[data-menu="records"] textarea', (nodes) =>
        nodes
          .filter((n) => n.offsetParent !== null)
          .map((n) => [n.textContent.trim() || n.tagName, n.getBoundingClientRect()])
          .filter(([, r]) => r.height < 44)
          .map(([name, r]) => `${name}: ${Math.round(r.height)} px`),
      );
      assert.deepEqual(small, [], 'targets below 44 px');
    });

    await check('a foreign or broken file is refused with a reason and changes nothing', async () => {
      const before = await page.evaluate(() => localStorage.getItem('nachschubfront:profile'));
      for (const [text, expected] of [
        ['{kaputt', 'keine lesbare JSON'],
        ['{"magic":"anderes-spiel"}', 'nicht aus Nachschubfront'],
        ['{"magic":"nachschubfront.profile","version":99}', 'neueren Version'],
      ]) {
        await page.fill('.records-paste', text);
        await page.getByRole('button', { name: 'Prüfen' }).tap();
        const status = await page.locator('.records-status').textContent();
        assert.ok(status.includes(expected), `"${text}" said "${status}"`);
        assert.equal(await page.getAttribute('.records-status', 'data-kind'), 'error');
        assert.ok(await page.locator('.records-confirm').isHidden(), 'nothing is offered for replacement');
      }
      assert.equal(await page.evaluate(() => localStorage.getItem('nachschubfront:profile')), before);
    });

    await check('a good file asks before it replaces, and only then replaces', async () => {
      const file = JSON.stringify({
        magic: 'nachschubfront.profile',
        version: 1,
        best: { 2: [{ seed: 'IMPORT', wave: 44, kills: 900, lives: 3, score: 45500, victory: false, date: 1, runs: 2 }] },
        stats: { matches: 7, victories: 1, kills: 900, bestWave: 44, seconds: 3700, doctrines: { tesla: 12 } },
      });
      await page.fill('.records-paste', file);
      await page.getByRole('button', { name: 'Prüfen' }).tap();
      await page.waitForSelector('.records-confirm:not([hidden])');
      const compare = await page.locator('.records-confirm .menu-score').textContent();
      assert.ok(compare.includes('Auf diesem Gerät'), 'both sides are shown before the swap');
      assert.ok(compare.includes('7 Partien'), `compare said "${compare}"`);

      // Cancelling leaves everything as it was.
      await page.getByRole('button', { name: 'Abbrechen' }).tap();
      assert.equal(await statOf('Partien'), '1');

      await page.getByRole('button', { name: 'Prüfen' }).tap();
      await page.waitForSelector('.records-confirm:not([hidden])');
      await page.getByRole('button', { name: 'Ersetzen', exact: true }).tap();
      assert.equal(await statOf('Partien'), '7');
      assert.equal(await statOf('Weiteste Welle'), '44');
      assert.equal(await statOf('Spielzeit'), '1 h 1 min');
      assert.equal(await statOf('Liebste Doktrin'), 'Tesla');
      const list = await rows();
      assert.equal(list.length, 1, 'the old record is gone, not merged');
      assert.ok(list[0].includes('IMPORT'));
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('nachschubfront:profile')));
      assert.equal(stored.stats.matches, 7, 'the replacement reached storage');
    });

    await check('export hands out a JSON file that the import takes back', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Exportieren' }).tap(),
      ]);
      assert.match(download.suggestedFilename(), /^nachschubfront-profil-\d{4}-\d{2}-\d{2}\.json$/);
      const stream = await download.createReadStream();
      const text = await new Promise((resolve, reject) => {
        let out = '';
        stream.on('data', (chunk) => (out += chunk));
        stream.on('end', () => resolve(out));
        stream.on('error', reject);
      });
      const parsed = JSON.parse(text);
      assert.equal(parsed.magic, 'nachschubfront.profile');
      assert.equal(parsed.stats.matches, 7);
      assert.ok(!('prefs' in parsed) && !('master' in parsed), 'the settings stay on the device');

      // Straight back in: the same file has to be accepted.
      await page.fill('.records-paste', text);
      await page.getByRole('button', { name: 'Prüfen' }).tap();
      await page.waitForSelector('.records-confirm:not([hidden])');
      await page.getByRole('button', { name: 'Abbrechen' }).tap();
    });

    await check('clearing asks first and then empties the record', async () => {
      await page.getByRole('button', { name: 'Alles löschen' }).tap();
      await page.waitForSelector('.records-confirm:not([hidden])');
      assert.equal(await statOf('Partien'), '7', 'still there while the question stands');
      await page.locator('.records-confirm').getByRole('button', { name: 'Alles löschen' }).tap();
      assert.equal(await statOf('Partien'), '0');
      assert.ok(await page.locator('.records-table').isHidden());
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('nachschubfront:profile')));
      assert.deepEqual(stored.best, {});
    });

    await page.screenshot({ path: join(OUT, 'records-tablet.png') });
    await context.close();
  }

  // ---------- Records with a mouse ----------
  // The same screen on a desktop: the milestone asks for export and import to
  // work with a pointer as well as a finger.
  console.log('records with a mouse (1440 x 900)');
  {
    const { context, page } = await openGame({ viewport: { width: 1440, height: 900 } });

    await check('export and import work the same way with a mouse', async () => {
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Hauptmenü' }).click();
      await page.getByRole('button', { name: 'Bestenliste' }).click();
      await page.waitForSelector('.menu[data-menu="records"]:not([hidden])');

      const file = JSON.stringify({
        magic: 'nachschubfront.profile',
        version: 1,
        best: { 2: [{ seed: 'MAUS', wave: 9, kills: 12, lives: 4, score: 9812, date: 1, runs: 1 }] },
        stats: { matches: 2, victories: 0, kills: 12, bestWave: 9, seconds: 90, doctrines: { laser: 1 } },
      });
      await page.fill('.records-paste', file);
      await page.getByRole('button', { name: 'Prüfen' }).click();
      await page.waitForSelector('.records-confirm:not([hidden])');
      await page.getByRole('button', { name: 'Ersetzen', exact: true }).click();
      assert.ok((await page.textContent('.records-table tbody')).includes('MAUS'));

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Exportieren' }).click(),
      ]);
      assert.match(download.suggestedFilename(), /\.json$/);
      await page.screenshot({ path: join(OUT, 'records-desktop.png') });
    });

    await context.close();
  }

  // ---------- Install hint on an iPad ----------
  // Safari has no install prompt, so the title screen has to spell the two taps
  // out. Faked with the user agent; nothing else about the device matters here.
  console.log('install hint (iPad user agent)');
  {
    const context = await browser.newContext({
      viewport: { width: 1180, height: 820 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
      userAgent:
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();
    watchProblems(page, 'install', problems);
    await page.goto(`${server.url}?seed=${SEED}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('body[data-ready]');

    const hint = page.locator('.menu[data-menu="main"] .menu-install');

    await check('the title screen explains how to add the game to the home screen', async () => {
      await hint.waitFor({ state: 'visible' });
      const text = await hint.textContent();
      assert.ok(text.includes('Teilen'), `hint said "${text}"`);
      assert.ok(text.includes('Home-Bildschirm'));
      assert.ok(
        await hint.getByRole('button', { name: 'Auf den Home-Bildschirm' }).isHidden(),
        'Safari cannot be asked to install, so the button stays away',
      );
      await page.screenshot({ path: join(OUT, 'install-hint.png') });
    });

    await check('waving the hint away keeps it away, across a reload', async () => {
      await hint.getByRole('button', { name: 'Nicht mehr zeigen' }).tap();
      assert.ok(await hint.isHidden());
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForSelector('body[data-ready]');
      await page.waitForTimeout(200);
      assert.ok(await hint.isHidden(), 'the choice is remembered on this device');
      const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('nachschubfront:prefs')));
      assert.equal(prefs.installHintDismissed, true);
      assert.ok(!('best' in prefs), 'settings and record stay two documents');
    });

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

    await check('gallery rasterizes towers, enemies and the capsule without failures', async () => {
      await page.waitForSelector('body[data-ready]', { timeout: 20000 });
      const stats = await page.evaluate(() => window.__gallery.stats());
      assert.equal(stats.failed, 0);
      assert.ok(stats.rasterized >= 37, `rasterized ${stats.rasterized}`);
    });

    await check('the capsule stands in the gallery from closed to fully open', async () => {
      const pods = await page.evaluate(() => window.__gallery.pods());
      assert.equal(pods.length, 5, 'one capsule per stage of the drop');
      // Each stage is further along than the one before it, so the row reads
      // left to right as the opening sequence.
      for (let i = 1; i < pods.length; i++) assert.ok(pods[i].t > pods[i - 1].t, `stage ${i}`);
      assert.equal((await page.evaluate(() => window.__gallery.stats())).failed, 0, 'no capsule part failed');
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
