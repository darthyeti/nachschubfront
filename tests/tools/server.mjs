// Minimal static server for Playwright scripts. Serves the repository like GitHub Pages.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

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

/** Starts the server on a free port. Resolves to { url, close }. */
export async function startServer() {
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
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() };
}

/** Collects console errors, page errors and failed requests of a page. */
export function watchProblems(page, label, problems) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`[${label}] console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`[${label}] page error: ${err.message}`));
  page.on('requestfailed', (req) => problems.push(`[${label}] request failed: ${req.url()}`));
  page.on('response', (res) => {
    if (res.status() >= 400) problems.push(`[${label}] HTTP ${res.status()}: ${res.url()}`);
  });
}

/**
 * Browser engine from `--browser <name>` or PW_BROWSER: chromium (default) or webkit.
 * WebKit is Safari's engine and the closest automated stand-in for the iPad.
 */
export function browserName() {
  const i = process.argv.indexOf('--browser');
  const name = (i > 0 ? process.argv[i + 1] : process.env.PW_BROWSER) || 'chromium';
  if (!['chromium', 'webkit'].includes(name)) throw new Error(`Unsupported browser: ${name}`);
  return name;
}

/** Launches the chosen engine; Chromium gets the flags that enable the real GPU. */
export async function launchBrowser(playwright, name = browserName()) {
  if (name === 'chromium') {
    return playwright.chromium.launch({
      args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
    });
  }
  return playwright.webkit.launch();
}
