// Performance check: 200 sprite enemies (debug stress test) at start zoom and max zoom,
// desktop and tablet. Measures frame intervals and verifies that no SVG is rasterized
// while the game runs (the rasterizer counter must not move in the steady state).
//
// Frame-time limits are only enforced on a hardware GPU; with software rendering
// (e.g. CI without GPU) the numbers are reported but not judged.
//
// Usage: npm run test:perf [-- --browser webkit]
// WebKit timings are reported only: headless WebKit is not representative of Safari's GPU path.

import * as playwright from 'playwright';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { ROOT, startServer, watchProblems, browserName, launchBrowser } from './tools/server.mjs';

const OUT = join(ROOT, 'tests', 'output');
const SAMPLE_FRAMES = 240;
/** 60 fps budget with some slack for timer jitter. */
const MEDIAN_LIMIT_MS = 17.5;
const P95_LIMIT_MS = 25;

await mkdir(OUT, { recursive: true });
const server = await startServer();
const engine = browserName();
const browser = await launchBrowser(playwright, engine);
const problems = [];
const report = [];

const sampleFrames = (page, n) =>
  page.evaluate(
    (count) =>
      new Promise((resolve) => {
        const gaps = [];
        let last = performance.now();
        const tick = (t) => {
          gaps.push(t - last);
          last = t;
          if (gaps.length < count) requestAnimationFrame(tick);
          else resolve(gaps);
        };
        requestAnimationFrame(tick);
      }),
    n,
  );

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

try {
  for (const [label, options] of [
    ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
    ['tablet', { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }],
  ]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    watchProblems(page, label, problems);
    await page.goto(`${server.url}?seed=BASTION&debug`, { waitUntil: 'networkidle' });
    await page.waitForSelector('body[data-ready]');
    const renderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
    });
    const hardware = engine === 'chromium' && !/SwiftShader|llvmpipe|software/i.test(renderer);

    await page.getByRole('button', { name: 'Belastungstest' }).click();
    assert.equal((await page.evaluate(() => window.__nachschub.state())).enemies, 200);

    for (const zoomLabel of ['start', 'max']) {
      if (zoomLabel === 'max') {
        // Zoom with the + key: mobile WebKit does not support mouse wheel events.
        for (let i = 0; i < 12; i++) await page.keyboard.press('+');
      }
      // Let new raster levels finish, then the counter must stay put.
      await page.waitForTimeout(1500);
      const before = (await page.evaluate(() => window.__nachschub.sprites())).rasterized;
      const gaps = (await sampleFrames(page, SAMPLE_FRAMES)).slice(10).sort((a, b) => a - b);
      const after = (await page.evaluate(() => window.__nachschub.sprites())).rasterized;
      const median = percentile(gaps, 0.5);
      const p95 = percentile(gaps, 0.95);
      const zoom = (await page.evaluate(() => window.__nachschub.camera())).zoom;
      const work = (await page.evaluate(() => window.__nachschub.ui())).frameMs ?? NaN;

      report.push(
        `${label.padEnd(8)} zoom ${zoom.toFixed(2).padStart(4)}: median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms` +
          `, JS per frame ${work.toFixed(1)} ms` +
          `, rasterized during run: ${after - before}${hardware ? '' : ' (timings not judged)'}`,
      );
      assert.equal(after - before, 0, `${label}/${zoomLabel}: SVG rasterized while running`);
      if (hardware) {
        assert.ok(median <= MEDIAN_LIMIT_MS, `${label}/${zoomLabel}: median ${median.toFixed(1)} ms`);
        assert.ok(p95 <= P95_LIMIT_MS, `${label}/${zoomLabel}: p95 ${p95.toFixed(1)} ms`);
      }
      await page.screenshot({ path: join(OUT, `perf-${label}-${zoomLabel}.png`) });
    }
    report.push(`${label.padEnd(8)} ${engine}, renderer: ${renderer}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
  console.log(report.join('\n'));
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('\nPerformance check passed.');
