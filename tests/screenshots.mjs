// Takes desktop and tablet screenshots of the game and fails on console errors,
// page errors or failed requests. Serves the repository itself, like GitHub Pages.
//
// Usage: npm run screenshots [-- --query "debug"]

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, startServer, watchProblems } from './tools/server.mjs';

const OUT = join(ROOT, 'tests', 'output');

const VIEWPORTS = [
  {
    name: 'desktop',
    options: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  },
  {
    name: 'tablet',
    options: {
      viewport: { width: 1180, height: 820 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    },
  },
];

const queryArg = process.argv.indexOf('--query');
const query = queryArg > 0 ? `?${process.argv[queryArg + 1]}` : '';

await mkdir(OUT, { recursive: true });
const server = await startServer();
const base = server.url;
const browser = await chromium.launch();
const problems = [];

try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext(vp.options);
    const page = await context.newPage();
    watchProblems(page, vp.name, problems);

    await page.goto(base + query, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('body[data-ready]');
    // Let a few frames run so the loop and HUD have settled.
    await page.waitForTimeout(700);

    const canvas = await page.evaluate(() => {
      const c = document.getElementById('game');
      return { width: c.width, height: c.height, cssWidth: c.clientWidth, dpr: devicePixelRatio };
    });
    const file = join(OUT, `${vp.name}.png`);
    await page.screenshot({ path: file });
    console.log(
      `${vp.name}: ${file} (canvas ${canvas.width}x${canvas.height}, css ${canvas.cssWidth}px, dpr ${canvas.dpr})`,
    );
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('No console errors.');
