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
