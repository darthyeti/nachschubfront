// The phone layout (M10 E2) in a real browser: three sizes, portrait and landscape,
// touch emulation (isMobile, hasTouch). Per size and orientation:
//   - the menu is reachable and works, folded bar or not, and closes again
//   - the symbol sheet and the recipes open as sheets from the right edge
//   - settings carry "Linkshänder", and it swaps the sides in landscape
//   - nothing visible sticks out of the picture, no sideways scrolling
//   - every hit area is at least 44 x 44 CSS pixels
//   - on the capsule choice the largest free rectangle of the board is over 40 percent
//   - M10 E3: the folded status bar is remembered, pause is reachable during the capsule
//     choice, the title and end screens stay whole pages
//   - M10 E3: the tutorial on a phone, all 14 steps at 390 x 844 (portrait and landscape),
//     the first 6 at the other sizes, what is lit, what is locked, skip, repeat
// Fails on any assertion or console error.
//
// Usage: npm run test:phone [-- --browser webkit] [--shots <dir>] [--size 390x844]
//   --shots writes JPEG stills (planning, capsule choice, tutorial steps) into <dir>

import * as playwright from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { startServer, watchProblems, browserName, launchBrowser, startMatch } from './tools/server.mjs';
import { openTutorial, walkTutorial, checkRepeatAndSkip, readStep, frames as tutorialFrames } from './tools/tutorial-run.mjs';

const SEED = 'BASTION';
const ALL_SIZES = [
  ['390x844', 390, 844],
  ['360x780', 360, 780],
  ['430x932', 430, 932],
];
const sizeAt = process.argv.indexOf('--size');
const SIZES = sizeAt > 0 ? ALL_SIZES.filter(([label]) => label === process.argv[sizeAt + 1]) : ALL_SIZES;
const MIN_FREE = 40;

const shotsAt = process.argv.indexOf('--shots');
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null;
if (SHOTS) await mkdir(SHOTS, { recursive: true });

const server = await startServer();
const engine = browserName();
const browser = await launchBrowser(playwright, engine);
console.log(`engine: ${engine}`);
const problems = [];

const frames = (page, n = 4) =>
  page.evaluate((count) => new Promise((resolve) => {
    let left = count;
    const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }), n);

/** Runs inside the page: hit areas, overflow and the free share of the board. */
function audit() {
  const W = innerWidth;
  const H = innerHeight;
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden]');
  };
  const name = (e) =>
    (typeof e.className === 'string' && e.className ? e.className.split(' ')[0] : e.tagName.toLowerCase()) +
    (e.getAttribute('aria-label') ? `(${e.getAttribute('aria-label')})` : '');
  const small = [];
  const outside = [];
  for (const e of document.querySelectorAll('button, input, select, [role=button]')) {
    if (!visible(e)) continue;
    // A scrolling panel keeps its far end out of sight by design; only the part in view counts.
    const r = e.getBoundingClientRect();
    const scroller = e.closest('.menu-panel, .codex-panel, .help-body, .selection, .info');
    const clipped = scroller && (r.bottom > scroller.getBoundingClientRect().bottom || r.top < scroller.getBoundingClientRect().top);
    if ((r.width < 43.5 || r.height < 43.5) && !(clipped && r.height < 43.5)) small.push(`${name(e)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (!clipped && (r.right > W + 1 || r.left < -1 || r.bottom > H + 1 || r.top < -1)) outside.push(name(e));
  }
  for (const e of document.querySelectorAll('.plate, .menu-panel, .codex-panel, .help-sheet, .selection, .info, .command-rail, .hud-bar, .hud-top')) {
    if (!visible(e) || e.closest('.menu[data-menu=main]')) continue;
    const r = e.getBoundingClientRect();
    if (r.right > W + 1 || r.left < -1 || r.bottom > H + 1 || r.top < -1) outside.push(name(e));
  }
  const scrollsSideways = document.documentElement.scrollWidth > W + 1 || document.body.scrollWidth > W + 1;

  // Free share of the board: the largest rectangle no HUD element covers.
  const sel = '.plate, .interactive, .selection, .info, .command-rail, .hud-bar, .hud-top, .hud-fold';
  const rects = [];
  for (const e of document.querySelectorAll(`#hud :is(${sel})`)) {
    if (!visible(e) || e.classList.contains('menu')) continue;
    if (e.classList.contains('hud-top') && getComputedStyle(e).backgroundImage === 'none') continue;
    const r = e.getBoundingClientRect();
    rects.push([Math.max(0, r.left), Math.max(0, r.top), Math.min(W, r.right), Math.min(H, r.bottom)]);
  }
  const step = 2;
  const cols = Math.ceil(W / step);
  const rows = Math.ceil(H / step);
  const grid = new Uint8Array(cols * rows);
  for (const [x0, y0, x1, y1] of rects) {
    for (let y = Math.floor(y0 / step); y < Math.ceil(y1 / step); y++) {
      for (let x = Math.floor(x0 / step); x < Math.ceil(x1 / step); x++) grid[y * cols + x] = 1;
    }
  }
  const heights = new Array(cols).fill(0);
  let best = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) heights[x] = grid[y * cols + x] ? 0 : heights[x] + 1;
    const stack = [];
    for (let x = 0; x <= cols; x++) {
      const h = x === cols ? 0 : heights[x];
      let start = x;
      while (stack.length && stack[stack.length - 1][1] >= h) {
        const [sx, sh] = stack.pop();
        best = Math.max(best, sh * (x - sx));
        start = sx;
      }
      stack.push([start, h]);
    }
  }
  return {
    small: [...new Set(small)],
    outside: [...new Set(outside)],
    scrollsSideways,
    freePct: Math.round((best * step * step * 1000) / (W * H)) / 10,
  };
}

async function openPage(width, height, { tutorial = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    screen: { width, height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  // The first match of a device starts the tutorial (M10 E3); the checks below are about the
  // layout and would find it in their way, so they play as a device that has seen it. The
  // tutorial's own checks open a bare device.
  if (!tutorial) {
    await context.addInitScript(() => {
      try {
        if (!localStorage.getItem('nachschubfront:prefs')) {
          localStorage.setItem('nachschubfront:prefs', JSON.stringify({ tutorialSeen: true }));
        }
      } catch {
        // No storage, no marker: the checks do not need one.
      }
    });
  }
  const page = await context.newPage();
  watchProblems(page, `${width}x${height}`, problems);
  if (!tutorial) {
    await page.goto(`${server.url}?seed=${SEED}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('body[data-ready]');
  }
  return { context, page };
}

const tap = async (page, locator) => {
  const box = await locator.boundingBox();
  assert.ok(box, 'the target has a box');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
};

function expectClean(report, label) {
  assert.deepEqual(report.small, [], `${label}: hit areas under 44 px`);
  assert.deepEqual(report.outside, [], `${label}: outside the picture`);
  assert.equal(report.scrollsSideways, false, `${label}: scrolls sideways`);
}

const results = [];
const storedPrefs = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('nachschubfront:prefs') ?? '{}'));
const check = async (name, fn) => {
  await fn();
  results.push(name);
  console.log(`  ok  ${name}`);
};

try {
  for (const [label, w0, h0] of SIZES) {
    for (const orient of ['hoch', 'quer']) {
      const [w, h] = orient === 'hoch' ? [w0, h0] : [h0, w0];
      const tag = `${label} ${orient}`;
      const sideways = orient === 'quer';
      console.log(tag);
      const { context, page } = await openPage(w, h);
      const shot = async (state) => {
        if (!SHOTS) return;
        await frames(page);
        await page.screenshot({ path: join(SHOTS, `e2-${label}-${orient}-${state}.jpg`), type: 'jpeg', quality: 82 });
      };

      await check(`${tag}: the title screen fits`, async () => {
        await page.waitForTimeout(300);
        expectClean(await page.evaluate(audit), 'title');
        assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true, 'touch is emulated');
      });

      await startMatch(page);
      // The click that started the match leaves the emulated mouse where it was; a finger leaves
      // nothing. Park it on the menu button, where it neither explains a disc nor shows a cell.
      const parked = await page.locator('.plate-button[aria-label="Menü"]').boundingBox();
      await page.mouse.move(parked.x + parked.width / 2, parked.y + parked.height / 2);
      await frames(page, 8);

      await check(`${tag}: the planning view is in order, four values and the menu`, async () => {
        const report = await page.evaluate(audit);
        expectClean(report, 'planning');
        const plates = await page.locator('#hud .hud-top .plate:visible').count();
        assert.ok(plates >= 4 && plates <= 6, `${plates} plates in the bar`);
        await shot('planung');
      });

      await check(`${tag}: the menu opens by touch, also with the bar folded, and closes`, async () => {
        const menu = page.locator('.plate-button[aria-label="Menü"]');
        for (const folded of [false, true]) {
          if (folded) await tap(page, page.locator('.hud-fold'));
          await frames(page);
          assert.equal(await page.locator('.hud-top').evaluate((n) => n.classList.contains('folded')), folded);
          assert.equal(await menu.isVisible(), true, 'the menu button stays');
          const box = await menu.boundingBox();
          assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= w && box.y + box.height <= h, 'menu button inside the picture');
          await tap(page, menu);
          await page.waitForSelector('.menu[data-menu="pause"]:not([hidden])');
          await frames(page);
          expectClean(await page.evaluate(audit), `pause menu (folded ${folded})`);
          const panel = await page.locator('.menu[data-menu="pause"] .menu-panel').boundingBox();
          if (sideways) assert.ok(Math.abs(panel.x + panel.width - w) <= 1, 'the sheet comes from the right edge');
          else assert.ok(Math.abs(panel.y + panel.height - h) <= 1, 'the sheet comes from the bottom edge');
          if (!folded) await shot('menue');
          await tap(page, page.locator('.menu[data-menu="pause"] .sheet-close'));
          await page.waitForSelector('.menu[data-menu="pause"]', { state: 'hidden' });
        }
        // Leave it unfolded again.
        await tap(page, page.locator('.hud-fold'));
        await frames(page);
        assert.equal(await page.locator('.hud-top').evaluate((n) => n.classList.contains('folded')), false);
      });

      await check(`${tag}: symbol sheet and recipes open as sheets`, async () => {
        const menu = page.locator('.plate-button[aria-label="Menü"]');
        for (const [button, panelSel] of [['Symbole erklären', '.help-sheet'], ['Rezepte', '.codex-panel']]) {
          await tap(page, menu);
          await page.waitForSelector('.menu[data-menu="pause"]:not([hidden])');
          await tap(page, page.locator('.menu[data-menu="pause"]').getByRole('button', { name: button, exact: true }));
          await page.waitForSelector(panelSel);
          await frames(page);
          expectClean(await page.evaluate(audit), button);
          const box = await page.locator(panelSel).boundingBox();
          if (sideways) assert.ok(Math.abs(box.x + box.width - w) <= 1, `${button}: from the right`);
          else assert.ok(Math.abs(box.y + box.height - h) <= 1, `${button}: from below`);
          await tap(page, page.locator(`${panelSel.replace('-sheet', '-layer').replace('-panel', '')} .sheet-close`).first());
          await page.waitForSelector(panelSel, { state: 'hidden' });
          // The pause menu is still up behind the codex or the symbol sheet.
          if (await page.locator('.menu[data-menu="pause"]').isVisible()) {
            await tap(page, page.locator('.menu[data-menu="pause"] .sheet-close'));
            await page.waitForSelector('.menu[data-menu="pause"]', { state: 'hidden' });
          }
        }
      });

      await check(`${tag}: Linkshänder is in the settings and swaps the sides`, async () => {
        await tap(page, page.locator('.plate-button[aria-label="Menü"]'));
        await tap(page, page.locator('.menu[data-menu="pause"]').getByRole('button', { name: 'Einstellungen' }));
        await page.waitForSelector('.menu[data-menu="settings"]:not([hidden])');
        const hand = page.locator('.menu[data-menu="settings"] [data-hand="left"]');
        await hand.scrollIntoViewIfNeeded();
        expectClean(await page.evaluate(audit), 'settings');
        assert.equal(await page.evaluate(() => document.documentElement.dataset.hand), 'right');
        await tap(page, hand);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.hand), 'left');
        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('nachschubfront:prefs')).leftHanded);
        assert.equal(stored, true, 'kept through the storage layer');
        await tap(page, page.locator('.menu[data-menu="settings"] .sheet-close'));
        await page.waitForSelector('.menu[data-menu="pause"]:not([hidden])');
        await tap(page, page.locator('.menu[data-menu="pause"] .sheet-close'));
        await page.waitForSelector('.menu[data-menu="pause"]', { state: 'hidden' });
        await frames(page);
        const salvo = await page.locator('.salvo').boundingBox();
        const tools = await page.locator('.rune-group').boundingBox();
        if (sideways) {
          assert.ok(salvo.x < tools.x, 'salvo on the left, tools on the right');
          await shot('linkshaender');
        } else {
          assert.ok(salvo.x > tools.x, 'portrait is not mirrored');
        }
        expectClean(await page.evaluate(audit), 'left-handed planning');
        // Back to the default for the rest.
        await tap(page, page.locator('.plate-button[aria-label="Menü"]'));
        await tap(page, page.locator('.menu[data-menu="pause"]').getByRole('button', { name: 'Einstellungen' }));
        await page.waitForSelector('.menu[data-menu="settings"]:not([hidden])');
        const rightHand = page.locator('.menu[data-menu="settings"] [data-hand="right"]');
        await rightHand.scrollIntoViewIfNeeded();
        await tap(page, rightHand);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.hand), 'right');
        await tap(page, page.locator('.menu[data-menu="settings"] .sheet-close'));
        await page.waitForSelector('.menu[data-menu="pause"]:not([hidden])');
        await tap(page, page.locator('.menu[data-menu="pause"] .sheet-close'));
        await page.waitForSelector('.menu[data-menu="pause"]', { state: 'hidden' });
        await frames(page);
        const salvo2 = await page.locator('.salvo').boundingBox();
        const tools2 = await page.locator('.rune-group').boundingBox();
        assert.ok(salvo2.x > tools2.x, 'right-handed again');
      });

      if (engine === 'chromium') {
        await check(`${tag}: a long press opens the info as a sheet, and its cross closes it`, async () => {
          const cdp = await context.newCDPSession(page);
          const at = { x: Math.round(w * 0.3), y: Math.round(h * 0.45), id: 0, radiusX: 4, radiusY: 4, force: 1 };
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
          await page.waitForTimeout(900);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await page.waitForSelector('.info:not([hidden])');
          await page.waitForTimeout(300);
          expectClean(await page.evaluate(audit), 'info sheet');
          const box = await page.locator('.info').boundingBox();
          if (sideways) assert.ok(Math.abs(box.x + box.width - w) <= 1, 'info from the right');
          else assert.ok(Math.abs(box.y + box.height - h) <= 1, 'info from below');
          await tap(page, page.locator('.info .sheet-close'));
          await page.waitForSelector('.info', { state: 'hidden' });
        });
      }

      await check(`${tag}: the capsule choice leaves the board over ${MIN_FREE} percent free`, async () => {
        await frames(page, 4);
        await page.getByRole('button', { name: 'Salve anfordern' }).click();
        await page.waitForSelector('.selection:not([hidden])', { timeout: 90000 });
        await page.waitForTimeout(500);
        await frames(page, 6);
        const report = await page.evaluate(audit);
        expectClean(report, 'capsule choice');
        assert.ok(report.freePct > MIN_FREE, `free rectangle ${report.freePct} percent`);
        console.log(`      free rectangle ${report.freePct} percent`);
        const box = await page.locator('.selection').boundingBox();
        if (sideways) assert.ok(Math.abs(box.x + box.width - w) <= 1, 'sheet at the right edge');
        else assert.ok(Math.abs(box.y + box.height - h) <= 1, 'sheet at the bottom edge');
        await shot('kapselwahl');
        await page.getByRole('button', { name: 'Behalten' }).click();
        await page.waitForSelector('.selection', { state: 'hidden' });
        await frames(page, 4);
        expectClean(await page.evaluate(audit), 'after the capsule choice');
      });

      const prefsNow = () => page.evaluate(() => JSON.parse(localStorage.getItem('nachschubfront:prefs') ?? '{}'));
      const reloadToTitle = async () => {
        await page.reload({ waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForSelector('body[data-ready]');
      };
      const isFolded = () => page.locator('.hud-top').evaluate((n) => n.classList.contains('folded'));

      await check(`${tag}: the folded status bar is remembered, and so is the open one`, async () => {
        await tap(page, page.locator('.hud-fold'));
        await frames(page);
        assert.equal(await isFolded(), true);
        assert.equal((await prefsNow()).statusFolded, true, 'kept through the storage layer');
        await reloadToTitle();
        await startMatch(page);
        await frames(page, 6);
        assert.equal(await isFolded(), true, 'still folded after a reload');
        expectClean(await page.evaluate(audit), 'folded after a reload');
        await tap(page, page.locator('.hud-fold'));
        await frames(page);
        assert.equal((await prefsNow()).statusFolded, false);
        await reloadToTitle();
        await startMatch(page);
        await frames(page, 6);
        assert.equal(await isFolded(), false, 'open again after a reload');
      });

      await check(`${tag}: pause is reachable during the capsule choice`, async () => {
        await page.getByRole('button', { name: 'Salve anfordern' }).click();
        await page.waitForSelector('.selection:not([hidden])', { timeout: 90000 });
        await page.waitForTimeout(400);
        await frames(page, 6);
        const pause = page.locator('.selection-pause');
        const box = await pause.boundingBox();
        assert.ok(box, 'the pause button is on screen');
        assert.ok(box.width >= 43.5 && box.height >= 43.5, `${box.width} x ${box.height}`);
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= w && box.y + box.height <= h, 'inside the picture');
        assert.equal(await pause.getAttribute('aria-pressed'), 'false');
        await tap(page, pause);
        await frames(page, 3);
        assert.equal(await pause.getAttribute('aria-pressed'), 'true', 'the game stands still');
        expectClean(await page.evaluate(audit), 'paused during the capsule choice');
        await shot('pause-kapselwahl');
        await tap(page, pause);
        await frames(page, 3);
        assert.equal(await pause.getAttribute('aria-pressed'), 'false', 'and runs on again');
        await page.getByRole('button', { name: 'Behalten' }).click();
        await page.waitForSelector('.selection', { state: 'hidden' });
      });

      await check(`${tag}: the title and end screens stay whole pages, not sheets`, async () => {
        await reloadToTitle();
        const title = page.locator('.menu[data-menu="main"]');
        await title.waitFor({ state: 'visible' });
        const box = await title.boundingBox();
        assert.ok(box.x <= 0.5 && box.y <= 0.5 && box.width >= w - 1 && box.height >= h - 1, `the title covers the picture: ${JSON.stringify(box)}`);
        assert.equal(await title.locator('.sheet-head').count(), 0, 'no sheet head on the title');
        assert.equal(await page.locator('.menu[data-menu="end"] .sheet-head').count(), 0, 'and none on the end screen');
        expectClean(await page.evaluate(audit), 'title');
        await shot('titel');
      });

      await context.close();
    }

    // ----- The tutorial (M10 E3) -----
    // A bare device, so the first match starts it. The first size and orientation play every
    // step; the others go as far as the capsule choice, where the sheets decide the layout.
    for (const orient of ['hoch', 'quer']) {
      const [w, h] = orient === 'hoch' ? [w0, h0] : [h0, w0];
      const tag = `${label} ${orient}`;
      const full = label === '390x844';
      console.log(`tutorial ${tag}`);
      const { context, page } = await openPage(w, h, { tutorial: true });
      const tapAt = (x, y) => page.touchscreen.tap(x, y);
      await openTutorial(page, server.url);
      if (SHOTS) await mkdir(SHOTS, { recursive: true });
      await check(`${tag}: a fresh device starts the tutorial with its first match`, async () => {
        await page.waitForFunction(() => document.querySelector('.tutorial:not([hidden]) .tutorial-meta'), null, { timeout: 5000 });
        assert.equal((await readStep(page)).n, 1);
        assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true, 'touch is emulated');
      });
      await check(`${tag}: ${full ? 'all fourteen steps go through' : 'the steps up to the capsule choice go through'}, and skipping ends it`, async () => {
        const shots = SHOTS ? { dir: SHOTS, prefix: `e3-${label}-${orient}`, steps: full ? (orient === 'hoch' ? [1, 3, 6, 9, 13] : [3, 6, 12]) : [] } : null;
        const seen = await walkTutorial(page, { tap: tapAt, label: tag, stopAfter: full ? Infinity : 6, shots });
        if (full) {
          assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
          assert.equal((await storedPrefs(page)).tutorialSeen, true, 'remembered after the last step');
        } else {
          assert.deepEqual(seen, [1, 2, 3, 4, 5, 6]);
          const at = await readStep(page);
          await tapAt(at.skip.x + at.skip.w / 2, at.skip.y + at.skip.h / 2);
          await tutorialFrames(page, 3);
          assert.equal(await readStep(page), null, 'skipped');
          assert.equal((await storedPrefs(page)).tutorialSeen, true, 'and remembered');
        }
      });
      if (full) {
        await check(`${tag}: repeating from the settings and skipping both go through the storage layer`, async () => {
          await checkRepeatAndSkip(page, { tap: tapAt, url: server.url, label: tag });
        });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`\n${results.length} checks passed`);
