// Stills of the weapon effects study (reference/studien/waffeneffekte.html, task A-37, issue 71):
// every weapon today next to the proposal at the moment of a shot, the siege launcher as a sequence,
// and the scale table. Fails on any error in the page.
//
// Usage: node tests/tools/waffeneffekte-stills.mjs [out-dir]

import * as playwright from 'playwright';
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser } from './server.mjs';

const out = process.argv[2] ?? 'reference/konzept/waffeneffekte';
mkdirSync(out, { recursive: true });

const server = await startServer();
const browser = await launchBrowser(playwright, 'chromium');
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
page.on('console', (msg) => msg.type() === 'error' && errors.push(`console: ${msg.text()}`));
await page.goto(`${server.url}reference/studien/waffeneffekte.html`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__waffen?.ready, null, { timeout: 60000 });
// The bar and the heading cover the scene in a still; hide them, the caption is the file name.
await page.addStyleTag({ content: '.bar{display:none !important} .hud p{display:none}' });

// The part of the page the scene is in (CSS px); the rest is empty ground.
const CLIP = { x: 230, y: 230, width: 720, height: 360 };
const CLIP2 = { x: 190, y: 110, width: 800, height: 600 };

// [weapon, after the first shot from this time, seconds after the shot, zoom]
const SHOTS = [
  ['autocannon', 2, 0.05, 1],
  ['flame', 2, 0.4, 1],
  ['mortar', 2.5, 0.35, 1],
  ['tesla', 2, 0.03, 1],
  ['laser', 2, 0.03, 1],
  ['psi', 2, 0.5, 1],
  ['purgeShrine', 2, 0.5, 1],
  ['stormBattery', 2, 0.03, 1],
  ['emberCauldron', 2, 0.03, 1],
  ['siegeMortar', 2, 0.45, 1],
  ['thunderTower', 2, 0.03, 1],
  ['soulfireObelisk', 2, 0.05, 1],
];
for (const [kind, from, after, zoom] of SHOTS) {
  await page.evaluate((z) => window.__waffen.preload(z), zoom);
  await page.evaluate(([k, f, a, z]) => window.__waffen.seekShot(k, f, a, { zoom: z, view: 'beide', table: false }), [kind, from, after, zoom]);
  await page.screenshot({ path: `${out}/${kind}.png`, clip: CLIP });
}

// Close-ups at 2x of what Till asked about: laser, tesla, storm battery.
await page.evaluate(() => window.__waffen.preload(2));
for (const [kind, after] of [['laser', 0.03], ['tesla', 0.03], ['stormBattery', 0.03], ['thunderTower', 0.03]]) {
  for (const side of ['heute', 'neu']) {
    await page.evaluate(([k, a, v]) => window.__waffen.seekShot(k, 2, a, { zoom: 2, view: v, table: false }), [kind, after, side]);
    await page.screenshot({ path: `${out}/${kind}-2x-${side}.png`, clip: CLIP2 });
  }
}

// The siege launcher in sequence: aiming, launch, flight, impact, reloading.
for (const [name, after, from] of [['1-zielen', 2.75, 2], ['2-abschuss', 0.03, 2], ['3-flug', 0.6, 2], ['4-einschlag', 1.25, 2], ['5-nachladen', 1.9, 2]]) {
  await page.evaluate(([a, f]) => window.__waffen.seekShot('siegeMortar', f, a, { zoom: 2, view: 'neu', table: false }), [after, from]);
  await page.screenshot({ path: `${out}/raketenturm-${name}.png`, clip: CLIP2 });
}

// The siege weapon in eight directions, today and new.
await page.evaluate(() => window.__waffen.modelSheet(2));
await page.screenshot({ path: `${out}/raketenturm-modell.png`, clip: { x: 0, y: 0, width: 1180, height: 700 } });

// The scale table, at full length.
await page.setViewportSize({ width: 1180, height: 1180 });
await page.addStyleTag({ content: '#table{max-height:none !important;left:12px;right:auto}' });
await page.evaluate(() => window.__waffen.seekShot('laser', 2, 0.03, { zoom: 1, view: 'beide', table: true }));
await page.screenshot({ path: `${out}/massstab.png` });

await browser.close();
server.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`stills in ${out}`);
