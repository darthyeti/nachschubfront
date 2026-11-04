// Inventory of the running game on phone viewports (A-23, Issue #36).
// Shoots title, planning, pod choice, wave, tower info, help and pause menu at
// three phone sizes in portrait and landscape, and measures what is left of the
// board and which hit areas are under 44 px. Writes heute-*.jpg and bestand.json
// into reference/konzept/handy.
//
// Usage: node tests/tools/handy-bestand.mjs [--out <dir>]

import * as playwright from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, startServer, watchProblems, launchBrowser, startMatch } from './server.mjs';

const outArg = process.argv.indexOf('--out');
const OUT = outArg > 0 ? process.argv[outArg + 1] : join(ROOT, 'reference', 'konzept', 'handy');
const SEED = 'BASTION';
const SIZES = [
  ['390x844', 390, 844],
  ['360x780', 360, 780],
  ['430x932', 430, 932],
];

await mkdir(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser(playwright, 'chromium');
const problems = [];
const report = [];

/** Runs inside the page: free share of the view, overlaps, hit areas under 44 px. */
function measure() {
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
  const sel = ['.plate', '.interactive', '.selection', '.info', '.hud-banner.show', '.command-rail', '.hud-bar', '.hud-top'].map((s) => `#hud ${s}`).join(', ');
  const nodes = [...document.querySelectorAll(sel)].filter(visible);
  const rects = [];
  const named = [];
  for (const e of nodes) {
    if (e.classList.contains('menu')) continue;
    const r = e.getBoundingClientRect();
    if (r.width >= W * 0.98 && r.height >= H * 0.9) continue;
    rects.push([Math.max(0, r.left), Math.max(0, r.top), Math.min(W, r.right), Math.min(H, r.bottom)]);
    named.push({ e, r });
  }
  const menuOpen = [...document.querySelectorAll('.menu')].some(visible);
  const step = 2;
  const cols = Math.ceil(W / step);
  const rows = Math.ceil(H / step);
  const grid = new Uint8Array(cols * rows);
  for (const [x0, y0, x1, y1] of rects) {
    for (let y = Math.floor(y0 / step); y < Math.ceil(y1 / step); y++) {
      for (let x = Math.floor(x0 / step); x < Math.ceil(x1 / step); x++) grid[y * cols + x] = 1;
    }
  }
  let covered = 0;
  for (const v of grid) covered += v;
  let freeRows = 0;
  for (let y = 0; y < rows; y++) {
    let any = false;
    for (let x = Math.floor(cols * 0.25); x < Math.floor(cols * 0.75); x++) {
      if (grid[y * cols + x]) { any = true; break; }
    }
    if (!any) freeRows++;
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
  const overlaps = [];
  for (let i = 0; i < named.length; i++) {
    for (let j = i + 1; j < named.length; j++) {
      const a = named[i];
      const b = named[j];
      if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 2 && h > 2) overlaps.push(`${name(a.e)} x ${name(b.e)} (${Math.round(w)}x${Math.round(h)})`);
    }
  }
  const small = [];
  const off = [];
  for (const e of document.querySelectorAll('#hud button, #hud input, #hud select, #hud [role=button]')) {
    if (!visible(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) small.push(`${name(e)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (r.right > W + 1 || r.left < -1 || r.bottom > H + 1 || r.top < -1) off.push(name(e));
  }
  let panel = null;
  for (const m of document.querySelectorAll('.menu-panel')) {
    if (!visible(m)) continue;
    const r = m.getBoundingClientRect();
    panel = { w: Math.round(r.width), h: Math.round(r.height), scrolls: m.scrollHeight > m.clientHeight + 1 || r.bottom > H + 1 || r.top < -1 };
  }
  const total = W * H;
  const share = (px) => Math.round((px * 1000) / total) / 10;
  return {
    W, H, menuOpen,
    freePct: share(total - covered * step * step),
    freeBandPx: freeRows * step,
    biggestFreePct: share(best * step * step),
    overlaps: [...new Set(overlaps)],
    small: [...new Set(small)],
    offscreen: [...new Set(off)],
    panel,
  };
}

const frames = (page, n = 4) =>
  page.evaluate((c) => new Promise((res) => {
    let left = c;
    const tick = () => (--left <= 0 ? res() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }), n);

async function longPress(context, page, x, y) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0, radiusX: 4, radiusY: 4, force: 1 }] });
  await page.waitForTimeout(900);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function openPage(width, height, query) {
  const context = await browser.newContext({
    viewport: { width, height },
    screen: { width, height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  watchProblems(page, `${width}x${height}`, problems);
  await page.goto(`${server.url}${query}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('body[data-ready]');
  return { context, page };
}

try {
  for (const [label, w0, h0] of SIZES) {
    for (const orient of ['hoch', 'quer']) {
      const [w, h] = orient === 'hoch' ? [w0, h0] : [h0, w0];
      const tag = `${label}-${orient}`;
      const shots = {};
      const shoot = async (state, page) => {
        await frames(page);
        await page.screenshot({ path: join(OUT, `heute-${tag}-${state}.jpg`), type: 'jpeg', quality: 82 });
        shots[state] = await page.evaluate(measure);
      };

      // The bare board, no HUD: the placeholder of the study (only at the largest size).
      const board = async (state, page) => {
        if (label !== '430x932') return;
        const hide = await page.addStyleTag({ content: '#hud, .menu { visibility: hidden !important; }' });
        await frames(page);
        await page.screenshot({ path: join(OUT, `spielfeld-${orient}-${state}.jpg`), type: 'jpeg', quality: 72 });
        await hide.evaluate((n) => n.remove());
      };

      // Pass 1 with the debug hook: where does the first tower stand on this screen?
      let towerAt;
      {
        const { context, page } = await openPage(w, h, `?seed=${SEED}&debug`);
        await startMatch(page);
        await frames(page, 5);
        // The debug panel sits over the salvo button on a low screen; press it from the page.
        await page.evaluate(() => document.querySelector('.salvo').click());
        await page.waitForFunction(() => window.__nachschub.state().phase === 'selection', null, { timeout: 90000 });
        await page.getByRole('button', { name: 'Behalten' }).click();
        await page.waitForFunction(() => window.__nachschub.state().phase === 'wave', null, { timeout: 10000 });
        towerAt = await page.evaluate(() => {
          const t = window.__nachschub.state().towers[0];
          return window.__nachschub.screenOfCell(t.x, t.y);
        });
        await context.close();
      }

      const { context, page } = await openPage(w, h, `?seed=${SEED}`);
      await page.waitForTimeout(400);
      await shoot('titel', page);
      await startMatch(page);
      // Park the emulated mouse on the menu button: a finger leaves no mouse behind, and a mouse
      // over the board would show cells and undo the long press when the camera moves.
      const parked = await page.locator('.plate-button[aria-label="Menü"]').boundingBox();
      await page.mouse.move(parked.x + parked.width / 2, parked.y + parked.height / 2);
      await frames(page, 8);
      await shoot('planung', page);
      await board('planung', page);
      await page.getByRole('button', { name: 'Salve anfordern' }).click();
      await page.waitForSelector('.selection:not([hidden])', { timeout: 90000 });
      await page.waitForTimeout(600);
      await shoot('kapselwahl', page);
      await page.getByRole('button', { name: 'Behalten' }).click();
      await page.waitForTimeout(5000);
      await shoot('welle', page);
      await board('welle', page);
      // The clicks above moved the emulated mouse over the board; park it again.
      await page.mouse.move(parked.x + parked.width / 2, parked.y + parked.height / 2);
      // The debug bar of pass 1 can shift the view a little; try a few spots around the tower.
      for (const [dx, dy] of [[0, 0], [0, -24], [0, 24], [-24, 0], [24, 0], [0, -48], [0, -72]]) {
        await longPress(context, page, towerAt[0] + dx, towerAt[1] + dy);
        await page.waitForTimeout(300);
        if (await page.locator('.info').isVisible()) break;
      }
      await shoot('stellung', page);
      await page.evaluate(() => document.querySelector('.info button')?.click());
      // The "?" is gone on the phone layout (M10 E2); the menu has the same door.
      const helpButton = page.getByRole('button', { name: 'Symbole erklären' });
      if (await helpButton.isVisible()) {
        await helpButton.click();
      } else {
        await page.evaluate(() => document.querySelector('.plate-button[aria-label="Menü"]').click());
        await page.waitForSelector('.menu[data-menu="pause"]:not([hidden])');
        await page.locator('.menu[data-menu="pause"]').getByRole('button', { name: 'Symbole erklären' }).click();
      }
      await page.waitForTimeout(300);
      await shoot('hilfe', page);
      await page.getByRole('button', { name: 'Symbole schließen' }).click({ timeout: 1000 }).catch(() => {});
      await page.evaluate(() => {
        document.querySelector('.help-layer .sheet-close')?.click();
        document.querySelector('.menu[data-menu="pause"]:not([hidden]) .sheet-close')?.click();
      });
      await page.waitForTimeout(200);
      await page.evaluate(() => document.querySelector('.plate-button[aria-label="Menü"]').click());
      await page.waitForSelector('.menu[data-menu="pause"]:not([hidden])');
      await page.waitForTimeout(300);
      await shoot('pause', page);
      await context.close();
      report.push({ tag, shots });
      console.log(`${tag} ok`);
    }
  }
} finally {
  await browser.close();
  server.close();
}

await writeFile(join(OUT, 'bestand.json'), JSON.stringify(report, null, 1));
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
