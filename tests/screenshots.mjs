// Takes desktop and tablet screenshots of the game and fails on console errors,
// page errors or failed requests. Serves the repository itself, like GitHub Pages.
//
// Usage: npm run screenshots [-- --query "debug"]

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'tests', 'output');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

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

function startServer() {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    if (path.endsWith('/')) file = join(file, 'index.html');
    if (file.split(sep).includes('node_modules')) {
      // The game must never load from node_modules.
      res.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const queryArg = process.argv.indexOf('--query');
const query = queryArg > 0 ? `?${process.argv[queryArg + 1]}` : '';

await mkdir(OUT, { recursive: true });
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const problems = [];

try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext(vp.options);
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`[${vp.name}] console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`[${vp.name}] page error: ${err.message}`));
    page.on('requestfailed', (req) => problems.push(`[${vp.name}] request failed: ${req.url()}`));
    page.on('response', (res) => {
      if (res.status() >= 400) problems.push(`[${vp.name}] HTTP ${res.status()}: ${res.url()}`);
    });

    await page.goto(base + query, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
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
