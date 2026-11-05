// Stills of the weapon effects study (reference/studien/waffeneffekte.html, task A-37, issues 71 and 81):
// every weapon today next to the proposal of round 1 at the moment of a shot, the siege launcher as a
// sequence, the scale table; then round 2 (r2-*.png) and the cost of round 1 and round 2 per picture
// (kosten.json). Fails on any error in the page.
//
// Usage: node tests/tools/waffeneffekte-stills.mjs [out-dir]

import * as playwright from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
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
  await page.evaluate(([k, f, a, z]) => window.__waffen.seekShot(k, f, a, { zoom: z, view: 'beide', table: false, round: 1 }), [kind, from, after, zoom]);
  await page.screenshot({ path: `${out}/${kind}.png`, clip: CLIP });
}

// Close-ups at 2x of what Till asked about: laser, tesla, storm battery.
await page.evaluate(() => window.__waffen.preload(2));
for (const [kind, after] of [['laser', 0.03], ['tesla', 0.03], ['stormBattery', 0.03], ['thunderTower', 0.03]]) {
  for (const side of ['heute', 'neu']) {
    await page.evaluate(([k, a, v]) => window.__waffen.seekShot(k, 2, a, { zoom: 2, view: v, table: false, round: 1 }), [kind, after, side]);
    await page.screenshot({ path: `${out}/${kind}-2x-${side}.png`, clip: CLIP2 });
  }
}

// The siege launcher in sequence: aiming, launch, flight, impact, reloading.
for (const [name, after, from] of [['1-zielen', 2.75, 2], ['2-abschuss', 0.03, 2], ['3-flug', 0.6, 2], ['4-einschlag', 1.25, 2], ['5-nachladen', 1.9, 2]]) {
  await page.evaluate(([a, f]) => window.__waffen.seekShot('siegeMortar', f, a, { zoom: 2, view: 'neu', table: false, round: 1 }), [after, from]);
  await page.screenshot({ path: `${out}/raketenturm-${name}.png`, clip: CLIP2 });
}

// The siege weapon in eight directions, today and new.
await page.evaluate(() => window.__waffen.modelSheet(2));
await page.screenshot({ path: `${out}/raketenturm-modell.png`, clip: { x: 0, y: 0, width: 1180, height: 700 } });

// The scale table, at full length.
await page.setViewportSize({ width: 1180, height: 1180 });
await page.addStyleTag({ content: '#table{max-height:none !important;left:12px;right:auto}' });
await page.evaluate(() => window.__waffen.seekShot('laser', 2, 0.03, { zoom: 1, view: 'beide', table: true, round: 1 }));
await page.screenshot({ path: `${out}/massstab.png` });
await page.setViewportSize({ width: 1180, height: 820 });
await page.evaluate(() => window.__waffen.seekShot('laser', 2, 0.03, { table: false }));

// ---------- Round 2 (issue 81) ----------
const R2 = { round: 2, table: false, reduced: false, light: 'sturm', flame: 'strom', burn: true, blend: 'addiert' };
// [file, weapon, 'shot' (after the first shot from 2 s, seconds after it) or 'time' (study time), seconds, options]
const R2_STILLS = [
  ['r2-licht-sturmbatterie', 'stormBattery', 'shot', 0.03, { view: 'beide', zoom: 1 }],
  ['r2-licht-sturmbatterie-normal', 'stormBattery', 'shot', 0.03, { view: 'neu', zoom: 1, blend: 'normal' }],
  ['r2-licht-sturmbatterie-aus', 'stormBattery', 'shot', 0.03, { view: 'neu', zoom: 1, light: 'aus' }],
  ['r2-licht-glutkessel', 'emberCauldron', 'shot', 0.06, { view: 'neu', zoom: 1, light: 'alle' }],
  ['r2-licht-raketenturm', 'siegeMortar', 'shot', 1.25, { view: 'neu', zoom: 1, light: 'alle' }],
  ['r2-licht-gewitterturm', 'thunderTower', 'shot', 0.1, { view: 'neu', zoom: 1, light: 'alle' }],
  ['r2-licht-obelisk', 'soulfireObelisk', 'shot', 0.05, { view: 'neu', zoom: 1, light: 'alle' }],
  ['r2-licht-schrein', 'purgeShrine', 'time', 3, { view: 'neu', zoom: 1, light: 'alle' }],
  ['r2-flamme-strom', 'flame', 'time', 3, { view: 'beide', zoom: 1 }],
  ['r2-flamme-ballen', 'flame', 'time', 3, { view: 'beide', zoom: 1, flame: 'ballen' }],
  ['r2-flamme-strom-2x', 'flame', 'time', 4.6, { view: 'neu', zoom: 2 }],
  ['r2-flamme-ballen-2x', 'flame', 'time', 4.6, { view: 'neu', zoom: 2, flame: 'ballen' }],
  ['r2-tesla-1-erster-schlag', 'tesla', 'shot', 0.01, { view: 'neu', zoom: 2 }],
  ['r2-tesla-2-zweiter-schlag', 'tesla', 'shot', 0.12, { view: 'neu', zoom: 2 }],
  ['r2-glutkessel-1-kriechen', 'emberCauldron', 'shot', 0.04, { view: 'neu', zoom: 2 }],
  ['r2-glutkessel-2-voll', 'emberCauldron', 'shot', 0.12, { view: 'neu', zoom: 2 }],
  ['r2-gewitterturm-1-einschlag', 'thunderTower', 'shot', 0.03, { view: 'neu', zoom: 1 }],
  ['r2-gewitterturm-2-kaskade', 'thunderTower', 'shot', 0.12, { view: 'neu', zoom: 1 }],
  ['r2-gewitterturm-3-nachklang', 'thunderTower', 'shot', 0.3, { view: 'neu', zoom: 1 }],
  ['r2-gewitterturm-weniger-bewegung', 'thunderTower', 'shot', 0.03, { view: 'neu', zoom: 1, reduced: true }],
  ['r2-blitze-heute', 'tesla', 'shot', 0.03, { view: 'heute', zoom: 2 }],
  ['r2-raketenwerfer-1-abschuss', 'mortar', 'shot', 0.1, { view: 'neu', zoom: 2 }],
  ['r2-raketenwerfer-2-flug', 'mortar', 'shot', 0.7, { view: 'neu', zoom: 1 }],
  ['r2-raketenwerfer-3-einschlag', 'mortar', 'shot', 0.97, { view: 'neu', zoom: 1 }],
  ['r2-raketenturm-1-abschuss', 'siegeMortar', 'shot', 0.05, { view: 'neu', zoom: 1 }],
  ['r2-raketenturm-2-flug', 'siegeMortar', 'shot', 0.7, { view: 'neu', zoom: 1 }],
  ['r2-raketenturm-3-einschlag', 'siegeMortar', 'shot', 1.25, { view: 'neu', zoom: 1 }],
  ['r2-raketenturm-4-krater', 'siegeMortar', 'shot', 1.9, { view: 'neu', zoom: 1 }],
  ['r2-schrein', 'purgeShrine', 'time', 3, { view: 'beide', zoom: 1 }],
  ['r2-schrein-2x', 'purgeShrine', 'time', 4, { view: 'neu', zoom: 2 }],
];
for (const zoom of [1, 2]) await page.evaluate((z) => window.__waffen.preload(z), zoom);
for (const [file, kind, mode, t, opts] of R2_STILLS) {
  const o = { ...R2, ...opts };
  if (mode === 'shot') await page.evaluate(([k, a, op]) => window.__waffen.seekShot(k, 2, a, op), [kind, t, o]);
  else await page.evaluate(([k, a, op]) => window.__waffen.seek(k, a, op), [kind, t, o]);
  await page.screenshot({ path: `${out}/${file}.png`, clip: o.zoom === 2 || o.view === 'neu' ? CLIP2 : CLIP });
}

// Cost per picture of the right side, round 1 against round 2 (the ground and the base are in both).
const COST = [
  ['autocannon', {}], ['flame', { flame: 'strom' }], ['flame', { flame: 'strom', burn: false }], ['flame', { flame: 'ballen' }],
  ['mortar', {}], ['tesla', {}], ['laser', {}], ['psi', {}], ['purgeShrine', {}], ['stormBattery', { light: 'aus' }],
  ['stormBattery', { light: 'sturm' }], ['emberCauldron', { light: 'aus' }], ['emberCauldron', { light: 'alle' }],
  ['siegeMortar', { light: 'aus' }], ['siegeMortar', { light: 'alle' }], ['thunderTower', { light: 'aus' }],
  ['thunderTower', { light: 'alle' }], ['soulfireObelisk', { light: 'alle' }], ['purgeShrine', { light: 'alle' }],
];
const cost = [];
for (const [kind, opts] of COST) {
  const r1 = await page.evaluate(([k]) => window.__waffen.measure(k, { round: 1, zoom: 1, reduced: false }), [kind]);
  const r2 = await page.evaluate(([k, op]) => window.__waffen.measure(k, op), [kind, { ...R2, zoom: 1, ...opts }]);
  cost.push({ kind, opts, r1, r2 });
}
writeFileSync(`${out}/kosten.json`, `${JSON.stringify(cost, null, 1)}\n`);

await browser.close();
server.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`stills in ${out}`);
