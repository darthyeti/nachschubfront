// Serves the repository on a fixed port, the way GitHub Pages does, for looking
// at the game in a browser. The Playwright scripts use server.mjs, which picks
// a free port of its own; this one is for a human (or Claude) to open.
//
// Usage: node tests/tools/serve.mjs [port]

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { ROOT } from './server.mjs';

const PORT = Number(process.argv[2]) || 8000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = normalize(path === '/' ? 'index.html' : path.slice(1)).replace(/^(\.\.[/\\])+/, '');
  if (relative.split(sep)[0] === '..') {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(join(ROOT, relative));
    res.writeHead(200, {
      'Content-Type': TYPES[extname(relative)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${PORT}/`));
