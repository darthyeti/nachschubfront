// Screenshots of every doctrine at every rank inside the running game (M9 D1):
// the emplacements are put on free cells with the debug door and the canvas is
// shot at one zoom. Look at the result; nothing here judges it.
//
// Usage: node tests/tools/rank-sheet.mjs <zoom> <out.png> [--dpr 1]
//   zoom  a camera zoom, or "min" for the smallest the game allows

import * as playwright from 'playwright';
import { startServer, launchBrowser, startMatch } from './server.mjs';

const zoomArg = process.argv[2] ?? '1';
const out = process.argv[3] ?? 'tests/output/rank-sheet.png';
const dprIndex = process.argv.indexOf('--dpr');
const dpr = dprIndex > 0 ? Number(process.argv[dprIndex + 1]) : 1;

const server = await startServer();
const browser = await launchBrowser(playwright, 'chromium');
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
const page = await context.newPage();
page.on('pageerror', (e) => console.error('page error', e.message));
await page.goto(`${server.url}?seed=BASTION&debug`, { waitUntil: 'networkidle' });
await startMatch(page);
await page.waitForTimeout(500);

const DOCTRINES = ['autocannon', 'flame', 'mortar', 'tesla', 'laser', 'psi'];
const placed = await page.evaluate((doctrines) => {
  const api = window.__nachschub;
  const size = Math.round(Math.sqrt(api.heights().length));
  const free = (x, y) => api.canPlace(x, y);
  // Ranks run to the right on the screen, doctrines down it: cell (ox + r + 3i, oy - r + 3i).
  const at = (ox, oy, i, r) => [ox + r + 3 * i, oy - r + 3 * i];
  for (let ox = 0; ox < size; ox++) {
    for (let oy = 0; oy < size; oy++) {
      let ok = true;
      for (let i = 0; i < 6 && ok; i++) {
        for (let r = 0; r < 5 && ok; r++) {
          const [x, y] = at(ox, oy, i, r);
          ok = x >= 0 && y >= 0 && x < size && y < size;
        }
      }
      if (!ok) continue;
      for (let i = 0; i < 6; i++) {
        for (let r = 0; r < 5; r++) {
          const [x, y] = at(ox, oy, i, r);
          api.debug.placeTower({ x, y, doctrine: doctrines[i], rank: r + 1 });
        }
      }
      return { ox, oy, size };
    }
  }
  return null;
}, DOCTRINES);
if (!placed) throw new Error('no free block found');
console.log('block', placed);

// Zoom: the +/- keys step by a fixed factor; walk to the wanted level.
const target = zoomArg === 'min' ? 0 : Number(zoomArg);
for (let i = 0; i < 40; i++) {
  const { zoom } = await page.evaluate(() => window.__nachschub.camera());
  if (target === 0 ? zoom <= 0.4001 : Math.abs(zoom - target) / target < 0.08) break;
  await page.keyboard.press(target === 0 || zoom > target ? '-' : '+');
  await page.waitForTimeout(30);
}
// Centre on the block: pan with the arrow keys until its middle is near the middle of the screen.
const [mx, my] = [placed.ox + 2 + 7, placed.oy - 2 + 7];
for (let i = 0; i < 60; i++) {
  const [sx, sy] = await page.evaluate(([x, y]) => window.__nachschub.screenOfCell(x, y), [mx, my]);
  const dx = sx - 720;
  const dy = sy - 450;
  if (Math.abs(dx) < 30 && Math.abs(dy) < 30) break;
  const horizontal = Math.abs(dx) > Math.abs(dy);
  const key = horizontal ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : dy > 0 ? 'ArrowDown' : 'ArrowUp';
  await page.keyboard.down(key);
  await page.waitForTimeout(Math.min(250, Math.max(30, Math.abs(horizontal ? dx : dy) / 4)));
  await page.keyboard.up(key);
  await page.waitForTimeout(30);
}
// Only the field: the bars and the debug panel would cover the rows.
await page.addStyleTag({ content: 'body > *:not(canvas) { visibility: hidden !important; }' });
await page.waitForTimeout(2500);
console.log('zoom', (await page.evaluate(() => window.__nachschub.camera())).zoom);
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1440, height: 900 } });
await browser.close();
server.close();
