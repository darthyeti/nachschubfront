// Checks the promise the milestone makes: after one visit the game starts
// without a network. Loads the page, lets the service worker install, pulls the
// plug and reloads.
//
// Usage: npm run test:offline [-- --browser webkit]

import * as playwright from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, startServer, watchProblems, browserName, launchBrowser, startMatch } from './tools/server.mjs';
import { collectPrecache } from './tools/precache-list.mjs';

const OUT = join(ROOT, 'tests', 'output');
const SEED = 'BASTION';

await mkdir(OUT, { recursive: true });
const server = await startServer();
const engine = browserName();
const browser = await launchBrowser(playwright, engine);
console.log(`engine: ${engine}`);
const problems = [];
const results = [];

async function check(name, fn) {
  await fn();
  results.push(name);
  console.log(`  ✔ ${name}`);
}

const context = await browser.newContext({
  viewport: { width: 1180, height: 820 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();
watchProblems(page, 'offline', problems);

const WORKER = join(ROOT, 'sw.js');
const original = await readFile(WORKER, 'utf8');
/** Stands in for the next build's content hash. */
const FAKE_BUILD = 'ffffffffffff';

try {
  await check('the service worker takes charge on the first visit', async () => {
    await page.goto(`${server.url}?seed=${SEED}&debug`, { waitUntil: 'networkidle' });
    await page.waitForSelector('body[data-ready]');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30000 });
    const name = await page.evaluate(async () => (await caches.keys())[0]);
    assert.match(name, /^nachschubfront-\d+\.\d+\.\d+-[0-9a-f]{12}$/, `cache name was ${name}`);
  });

  await check('the cache holds every file the game is made of', async () => {
    const expected = await collectPrecache();
    const cached = await page.evaluate(async () => {
      const cache = await caches.open((await caches.keys())[0]);
      return (await cache.keys()).map((r) => new URL(r.url).pathname);
    });
    const missing = expected.filter((file) => !cached.includes(`/${file.slice(2)}`));
    assert.deepEqual(missing, [], 'files the worker did not precache');
  });

  await check('a new build announces itself and only takes over when asked', async () => {
    // A second build, faked by giving the worker a different cache name. The
    // sources stay untouched; sw.js is put back in the finally below.
    await writeFile(WORKER, original.replace(/const BUILD = '[0-9a-f]+';/, `const BUILD = '${FAKE_BUILD}';`));
    const before = await page.evaluate(async () => (await caches.keys())[0]);

    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    const notice = page.locator('.menu[data-menu="main"] .menu-notice', { hasText: 'Neue Version bereit' });
    await notice.waitFor({ state: 'visible', timeout: 30000 });
    assert.equal(
      await page.evaluate(async () => (await caches.keys())[0]),
      before,
      'the running page is still served by the old build',
    );

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }),
      notice.getByRole('button', { name: 'Neu laden' }).click(),
    ]);
    await page.waitForSelector('body[data-ready]');
    await page.waitForFunction((want) => caches.keys().then((k) => k.length === 1 && k[0].endsWith(want)), FAKE_BUILD, {
      timeout: 30000,
    });
    assert.ok(await page.locator('.menu-notice').first().isHidden(), 'the notice is gone after the reload');
  });

  await check('the game starts offline, with the sprites and the map it had', async () => {
    // The real thing rather than the browser's offline switch: the server is
    // shut down and its open connections dropped. Nothing can answer but the
    // cache, in every engine.
    server.unplug();
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('body[data-ready]', { timeout: 30000 });
    await startMatch(page);
    const state = await page.evaluate(() => window.__nachschub.state());
    assert.equal(state.phase, 'planning');
    assert.ok(state.route > 0, 'the map was generated');
    const sprites = await page.evaluate(() => window.__nachschub.sprites());
    assert.equal(sprites.failed, 0, 'every sprite rasterized from the cached modules');
    await page.screenshot({ path: join(OUT, 'offline.png') });
  });

  await check('a deep link with a seed still resolves offline', async () => {
    // The query is not a cache entry of its own; the worker answers every
    // navigation with the one page.
    await page.goto(`${server.url}?seed=OFFLINE`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-ready]', { timeout: 30000 });
    // The field lives on the seed screen now; the deep link fills it just the same.
    await page.getByRole('button', { name: 'Seed eingeben' }).click();
    assert.equal(await page.inputValue('.menu-seed-input'), 'OFFLINE');
  });

  await check('the fonts come from the cache, not from a fallback face', async () => {
    const loaded = await page.evaluate(() =>
      [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
    );
    assert.ok(loaded.length > 0, 'no web font survived going offline');
  });
} finally {
  await writeFile(WORKER, original);
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`\n${results.length} offline checks passed, no console errors.`);
