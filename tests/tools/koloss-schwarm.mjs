// Checks the study "Koloss als Schwarmbestie" (A-39, issue #75) in a browser and writes its stills.
// Fails on console errors and failed requests. Writes the PNGs into reference/konzept/koloss-schwarm
// at deviceScaleFactor 2 and prints the numbers for the README: picture size per direction, fills
// and faces per frame, time per draw.
//
// Usage: node tests/tools/koloss-schwarm.mjs [--no-shots] [--browser webkit]

import * as playwright from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, startServer, watchProblems, launchBrowser } from './server.mjs';

const OUT = join(ROOT, 'reference', 'konzept', 'koloss-schwarm');
const SHOTS = !process.argv.includes('--no-shots');
const MODELS = ['heute', 'walze', 'stelze', 'brut'];

await mkdir(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser(playwright);
const problems = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
const page = await context.newPage();
watchProblems(page, 'studie', problems);
await page.goto(`${server.url}reference/studien/koloss-schwarm.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => window.__study && window.__study.ready());
// The switches stay usable in the study; in the stills they would cover the ground.
await page.addStyleTag({ content: '.bar{display:none}' });

const set = (o) => page.evaluate((s) => window.__study.set(s), o);
const shot = async (name, o, prepare) => {
  await set({ pause: true, silhouette: false, dir: 'auto', hits: false, ...o });
  await page.evaluate(() => {
    window.__study.walker.flash = 0;
  });
  if (prepare) await page.evaluate(prepare);
  await page.waitForTimeout(250);
  if (SHOTS) await page.screenshot({ path: join(OUT, `${name}.png`) });
};

// Comparison: all four facing +x, the scale row in front; the four directions; silhouettes.
await shot('vergleich', { view: 'compare', dir: '0', zoom: 1.6 });
await shot('vergleich-plus-y', { view: 'compare', dir: '1', zoom: 1.6 });
await shot('vergleich-minus-x', { view: 'compare', dir: '2', zoom: 1.6 });
await shot('vergleich-minus-y', { view: 'compare', dir: '3', zoom: 1.6 });
await shot('silhouette-zoom-1', { view: 'compare', dir: '0', zoom: 1, silhouette: true });
await shot('silhouette-zoom-0-4', { view: 'compare', dir: '1', zoom: 0.4, silhouette: true });
await shot('zoom-0-4', { view: 'compare', dir: '1', zoom: 0.4 });
await shot('treffer', { view: 'compare', dir: '0', zoom: 1.6 }, () => {
  window.__study.walker.flash = 0.1;
});

// Each model on the walk: breaking through the swathe, after it (rubble at the sides), mid-turn.
for (const model of MODELS) {
  await shot(`${model}-schneise`, { view: 'fahrt', model, zoom: 2 }, () => {
    window.__study.placeAt(3.4);
    window.__study.advance(1.8);
  });
  await shot(`${model}-nach-schneise`, { view: 'fahrt', model, zoom: 1.3 }, () => {
    window.__study.placeAt(3.4);
    window.__study.advance(26);
  });
  await shot(`${model}-drehung`, { view: 'fahrt', model, zoom: 2 }, () => {
    window.__study.placeAt(11.1);
    // 0.4 cells at the Koloss's speed, then half of the quarter turn.
    window.__study.advance(0.4 / 0.35 + 0.3);
  });
}

// Numbers.
const sizes = await page.evaluate((ids) => Object.fromEntries(ids.map((id) => [id, [0, 1, 2, 3].map((d) => window.__study.measure(id, d))])), MODELS);
const bench = {};
for (const id of MODELS) bench[id] = await page.evaluate((m) => window.__study.bench(m, 600), id);
await set({ view: 'compare', dir: 'auto', pause: false, zoom: 1, silhouette: false });
await page.waitForTimeout(600);
const perf = await page.evaluate(() => JSON.parse(JSON.stringify(window.__study.perf)));

console.log('Bildmaße bei Zoom 1 (Weltpixel, je Richtung +x, +y, -x, -y: Höhe über dem Fußpunkt, Breite):');
for (const id of MODELS) {
  console.log(`  ${id.padEnd(7)} ${sizes[id].map((s) => `${s.top}/${s.width}`).join('  ')}`);
}
console.log('Je Bild:');
for (const id of MODELS) {
  const p = perf[id];
  console.log(`  ${id.padEnd(7)} Füllungen ${p.fills}, Konturen ${p.strokes}, Flächen ${p.faces || '-'}, Glieder ${p.code || '-'}, Körper gebaut ${p.built || '-'} Flächen, ${bench[id].toFixed(3)} ms je Zeichnung`);
}

await browser.close();
await server.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(SHOTS ? `Standbilder in ${OUT}` : 'Keine Standbilder geschrieben (--no-shots).');
