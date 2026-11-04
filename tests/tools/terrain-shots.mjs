// Screenshots of emplacements on uneven ground inside the running game (issue 44): towers on a
// rim and in a hollow, behind a ruin and beside capsule rubble, with a worn trail with several
// bends. Looking at the result is the check; nothing here judges it.
//
// The trail needs a wave to walk it, so one wave runs first (bastion invulnerable, 3x) and the
// scene is built in its evaluation phase, when the gold route line of the planning is gone.
//
// Usage: node tests/tools/terrain-shots.mjs <out.png> --seed AIAIAI --zoom 1.4 --centre '[11,4]'
//          --towers '{"towers":[[x,y,doctrine,rank]],"rubble":[[x,y]]}' [--no-wave] [--dpr 2]
//          [--clip '{"x":0,"y":0,"width":800,"height":500}']

import * as playwright from 'playwright';
import { startServer, launchBrowser, startMatch } from './server.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const out = process.argv[2] ?? 'tests/output/terrain.png';
const seed = arg('seed', 'AIAIAI');
const zoomTarget = Number(arg('zoom', '1.4'));
const wantWave = !process.argv.includes('--no-wave');
const clip = arg('clip', null) ? JSON.parse(arg('clip', null)) : undefined;
const scene = JSON.parse(arg('towers', '{"towers":[],"rubble":[]}'));
const centre = JSON.parse(arg('centre', 'null'));

const server = await startServer();
const browser = await launchBrowser(playwright, 'chromium');
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: Number(arg('dpr', '1')),
});
const page = await context.newPage();
page.on('pageerror', (e) => console.error('page error', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('console', m.text()));
await page.goto(`${server.url}?seed=${seed}&debug`, { waitUntil: 'networkidle' });
await startMatch(page);
await page.waitForTimeout(300);

// Zoom with the +/- keys, then centre on a cell with the arrow keys.
for (let i = 0; i < 40; i++) {
  const { zoom } = await page.evaluate(() => window.__nachschub.camera());
  if (Math.abs(zoom - zoomTarget) / zoomTarget < 0.08) break;
  await page.keyboard.press(zoom > zoomTarget ? '-' : '+');
  await page.waitForTimeout(30);
}
if (centre) {
  for (let i = 0; i < 80; i++) {
    const [sx, sy] = await page.evaluate(([x, y]) => window.__nachschub.screenOfCell(x, y), centre);
    const dx = sx - 720;
    const dy = sy - 450;
    if (Math.abs(dx) < 25 && Math.abs(dy) < 25) break;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const key = horizontal ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : dy > 0 ? 'ArrowDown' : 'ArrowUp';
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.min(250, Math.max(30, Math.abs(horizontal ? dx : dy) / 4)));
    await page.keyboard.up(key);
    await page.waitForTimeout(30);
  }
}

if (wantWave) {
  await page.getByRole('button', { name: 'Unverwundbar' }).click();
  await page.getByRole('button', { name: '3x' }).click();
  // One landing zone next to the end of the route, so the capsule's emplacement does not kill
  // the wave at the rift and the enemies walk the whole route.
  const zone = await page.evaluate(() => {
    const api = window.__nachschub;
    for (const c of [...api.state().routeCells].reverse()) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (api.canPlace(c.x + dx, c.y + dy)) return api.screenOfCell(c.x + dx, c.y + dy);
      }
    }
    return null;
  });
  await page.mouse.click(zone[0], zone[1]);
  await page.getByRole('button', { name: 'Salve anfordern' }).click();
  await page.waitForFunction(() => window.__nachschub.state().phase === 'selection', null, { timeout: 30000 });
  const actions = await page.$$('.selection-actions button');
  await actions[actions.length - 1].click();
  await page.waitForFunction(() => window.__nachschub.state().phase === 'wave', null, { timeout: 10000 });
  // Slow down once the wave is nearly over, so the evaluation (2 s of game time) lasts long enough.
  await page.waitForFunction(
    () => {
      const s = window.__nachschub.state();
      return s.phase === 'wave' && s.enemies <= 2 && s.waveStats.killed + s.waveStats.leaked > 3;
    },
    null,
    { timeout: 240000, polling: 20 },
  );
  await page.getByRole('button', { name: '1x' }).click();
  await page.waitForFunction(() => window.__nachschub.state().phase === 'evaluation', null, { timeout: 120000, polling: 20 });
}

const placed = await page.evaluate(({ towers, rubble }) => {
  const api = window.__nachschub;
  const done = [];
  for (const [x, y, doctrine, rank] of towers) {
    if (!api.canPlace(x, y)) {
      done.push([x, y, 'blocked']);
      continue;
    }
    api.debug.placeTower({ x, y, doctrine, rank });
    done.push([x, y, 'ok']);
  }
  for (const [x, y] of rubble) api.debug.placeRubble({ x, y });
  return done;
}, scene);
console.log(JSON.stringify(placed));
const click = JSON.parse(arg('click', 'null'));
if (click) {
  // A tap on a cell: pins it as the field the player is looking at (the see-through of issue 35).
  const [sx, sy] = await page.evaluate(([x, y]) => window.__nachschub.screenOfCell(x, y), click);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(400);
}
await page.addStyleTag({ content: 'body > *:not(canvas) { visibility: hidden !important; }' });
if (!click) await page.mouse.move(5, 5);
await page.waitForTimeout(wantWave ? 250 : 2500);
await page.screenshot({ path: out, clip });
console.log('wrote', out);
await browser.close();
server.close();
