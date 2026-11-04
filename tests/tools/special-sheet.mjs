// Contact sheet of the six recipe emplacements in 16 directions, drawn by the game's own code
// (tests/specialsheet.html). Look at the result for faces that show through; nothing here judges it.
//
// Usage: node tests/tools/special-sheet.mjs [zoom] [out.png] [--dpr 1]

import * as playwright from 'playwright';
import { startServer, launchBrowser } from './server.mjs';

const zoom = Number(process.argv[2] ?? 1);
const out = process.argv[3] ?? 'tests/output/special-sheet.png';
const dprIndex = process.argv.indexOf('--dpr');
const dpr = dprIndex > 0 ? Number(process.argv[dprIndex + 1]) : 1;

const server = await startServer();
const browser = await launchBrowser(playwright, 'chromium');
const width = Math.round(96 * zoom) * 16;
const height = Math.round(176 * zoom) * 6;
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
const page = await context.newPage();
page.on('pageerror', (e) => console.error('page error', e.message));
page.on('console', (msg) => msg.type() === 'error' && console.error('console', msg.text()));
await page.goto(`${server.url}tests/specialsheet.html?zoom=${zoom}`, { waitUntil: 'networkidle' });
await page.waitForSelector('body[data-ready]', { timeout: 60000 });
await page.screenshot({ path: out, clip: { x: 0, y: 0, width, height } });
await browser.close();
server.close();
console.log(`${width} x ${height} at ${dpr}x: ${out}`);
