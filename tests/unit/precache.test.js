// The service worker's file list. A stale list means the game keeps starting
// from an old cache, so this test is the thing that makes updates arrive.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ROOT, collectPrecache, precacheHash } from '../tools/precache-list.mjs';
import { buildWorker } from '../tools/make-precache.mjs';
import { APP_VERSION } from '../../src/data/version.js';

const worker = await readFile(join(ROOT, 'sw.js'), 'utf8');

test('sw.js matches the files in the repository', async () => {
  const { next, current } = await buildWorker();
  assert.equal(current, next, 'sw.js is out of date — run: npm run precache');
});

test('the list holds everything the game loads and nothing it does not', async () => {
  const files = await collectPrecache();
  assert.ok(files.includes('./index.html'));
  assert.ok(files.includes('./manifest.webmanifest'));
  assert.ok(files.includes('./src/main.js'));
  assert.ok(files.includes('./src/ui/style.css'));
  assert.ok(files.some((f) => f.endsWith('.woff2')), 'the fonts have to work offline too');
  assert.ok(files.some((f) => f.startsWith('./assets/icons/')), 'the icons belong to the installed app');

  for (const file of files) {
    assert.ok(file.startsWith('./'), `${file} is not relative to the page`);
    assert.ok(!file.includes('/tests/'), `${file} is a development file`);
    assert.ok(!file.includes('/docs/') && !file.includes('/reference/'), `${file} is not served`);
    assert.ok(!file.includes('node_modules'), `${file} would break the no-dependency rule`);
  }
});

test('every module main.js reaches is in the list', async () => {
  // Walks the real import graph, so a module added without being listed fails
  // here rather than the first time somebody plays offline.
  const files = new Set(await collectPrecache());
  const seen = new Set();
  const queue = ['./src/main.js'];
  while (queue.length > 0) {
    const path = queue.pop();
    if (seen.has(path)) continue;
    seen.add(path);
    assert.ok(files.has(path), `${path} is missing from the precache list`);
    const source = await readFile(join(ROOT, path.slice(2)), 'utf8');
    for (const match of source.matchAll(/^\s*(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/gm)) {
      const target = match[1];
      if (!target.startsWith('.')) continue;
      const dir = path.slice(2).split('/').slice(0, -1).join('/');
      queue.push(`./${new URL(target, `file:///${dir}/`).pathname.slice(1)}`);
    }
  }
  assert.ok(seen.size > 40, `only ${seen.size} modules were walked`);
});

test('the cache name carries the version and a hash of the contents', async () => {
  const files = await collectPrecache();
  const hash = await precacheHash(files);
  assert.match(worker, new RegExp(`const VERSION = '${APP_VERSION.replace(/\./g, '\\.')}';`));
  assert.match(worker, new RegExp(`const BUILD = '${hash}';`));
  assert.match(hash, /^[0-9a-f]{12}$/);
  assert.match(worker, /const CACHE = `nachschubfront-\$\{VERSION\}-\$\{BUILD\}`;/);
});

test('the build hash follows both the names and the contents', async (t) => {
  const files = await collectPrecache();
  const full = await precacheHash(files);
  assert.notEqual(full, await precacheHash(files.slice(0, -1)), 'a dropped file changes the hash');

  // Contents, on a throwaway tree: the same file name with one byte changed has
  // to give a different cache name, or an update would be served from the old cache.
  const dir = await mkdtemp(join(tmpdir(), 'precache-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'a.js'), 'export const x = 1;');
  const one = await precacheHash(['./a.js'], dir);
  await writeFile(join(dir, 'a.js'), 'export const x = 2;');
  assert.notEqual(one, await precacheHash(['./a.js'], dir));
});

test('the worker waits instead of reloading a running match', () => {
  // skipWaiting is called in exactly one place, and that place is the message
  // handler the page uses once the player has said yes.
  const calls = worker.match(/self\.skipWaiting\(\)/g) ?? [];
  assert.equal(calls.length, 1, 'skipWaiting belongs in one handler only');
  const install = worker.slice(worker.indexOf("addEventListener('install'"), worker.indexOf("addEventListener('activate'"));
  assert.ok(!install.includes('self.skipWaiting()'), 'install must not take over a running page');
  assert.match(worker, /event\.data\.type === 'skipWaiting'/, 'the page asks for the update');
  assert.match(worker, /caches\.delete\(name\)/, 'old caches go on activate');
});
