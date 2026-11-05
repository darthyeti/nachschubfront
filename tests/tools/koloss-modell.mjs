// Checks the Koloss model of the game (src/render/koloss.js) in a browser on the stand-in page
// tests/koloss.html: no console errors, four directions, a turn on the spot, a hit, the silhouette
// at the smallest zoom, and what a frame costs. Stills go to tests/output/.
//
// Usage: node tests/tools/koloss-modell.mjs [--browser webkit]

import * as playwright from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, startServer, watchProblems, browserName, launchBrowser } from './server.mjs';

const OUT = join(ROOT, 'tests', 'output');
await mkdir(OUT, { recursive: true });
const server = await startServer();
const engine = browserName();
const browser = await launchBrowser(playwright, engine);
const problems = [];
const context = await browser.newContext({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });
const page = await context.newPage();
watchProblems(page, 'koloss', problems);
await page.goto(`${server.url}tests/koloss.html`, { waitUntil: 'networkidle' });
const suffix = engine === 'chromium' ? '' : `-${engine}`;
const shot = async (name) => page.screenshot({ path: join(OUT, `koloss-${name}${suffix}.png`) });
const set = (o) => page.evaluate((s) => window.__koloss.set(s), o);

for (const [name, dx, dy] of [['plus-x', 1, 0], ['plus-y', 0, 1], ['minus-x', -1, 0], ['minus-y', 0, -1]]) {
  await set({ dx, dy, simTime: 100, zoom: 1.6, flash: 0, silhouette: false });
  await shot(name);
}
// A turn on the spot: +x to +y, three moments of the 0.6 s.
await set({ dx: 1, dy: 0, simTime: 200, zoom: 1.6 });
await set({ dx: 0, dy: 1 });
for (const [i, dt] of [0.15, 0.15, 0.2].entries()) {
  await page.evaluate((d) => window.__koloss.step(d), dt);
  await shot(`turn-${i + 1}`);
}
await set({ dx: 1, dy: 0, simTime: 300, flash: 0.1, zoom: 1.6 });
await shot('hit');
await set({ dx: 0, dy: 1, simTime: 400, flash: 0, zoom: 0.4, silhouette: true });
await shot('silhouette-0-4');
const sizes = [];
for (let d = 0; d < 4; d++) sizes.push(await page.evaluate((i) => window.__koloss.measure(i), d));
const bench = await page.evaluate(() => window.__koloss.bench(600));
console.log('picture size per direction (width x height px):', sizes.map((s) => `${s.width}x${s.height} (top ${s.top})`).join(', '));
for (const [k, v] of Object.entries(bench.counts)) console.log(k.padEnd(8), JSON.stringify(v));
console.log(`draw time: ${bench.ms.toFixed(2)} ms per frame (${engine}, no GPU in a container: read as a ratio)`);

await browser.close();
server.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('No console errors.');
