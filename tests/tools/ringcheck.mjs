// Renders tests/ringcheck.html: recipe emplacements on touching cells, so the
// gold ground ring can be judged against its neighbours' sockets
// (docs/ART.md, "Goldener Bodenring").
//
// Usage: npm run ringcheck [-- <out.png> <zoom>]

import * as playwright from 'playwright';
import { startServer, launchBrowser } from './server.mjs';
const server = await startServer();
const browser = await launchBrowser(playwright, 'chromium');
const ctx = await browser.newContext({ viewport: { width: 900, height: 520 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`${server.url}tests/ringcheck.html?zoom=${process.argv[3] ?? 1.6}`);
await page.waitForSelector('body[data-ready]', { timeout: 20000 });
await page.waitForTimeout(600);
const out = process.argv[2] ?? new URL('../output/ringcheck.png', import.meta.url).pathname;
await page.screenshot({ path: out });
console.log(out);
await browser.close();
server.close();
