// Stills of recorded matches that come out the same pixel for pixel on every run (issue 95), so two
// versions of the renderer can be compared on the very same picture.
//
// The match is entered through the test entry before a wave and played on with the player's own actions
// out of the protocol, as replay-perf.mjs does. The game loop is held: every frame is driven from here with
// a fixed 1/60 s, `performance.now` follows that clock and `Math.random` is seeded, so the effects, the
// caches that build a few stages per frame and the picture are the same on every run. Until shortly before
// the still only the simulation and the effects run (no picture); the last `--warm` frames are drawn.
//
// Nothing of the game is changed on disk; the server hands the browser small hooks in src/main.js.
//
// Usage:
//   node tests/tools/render-stills.mjs <out-dir> [--root <checkout>] [--size 1920x1080] [--dpr 1] [--only name,...]
//   node tests/tools/render-stills.mjs --compare <dir-a> <dir-b> [--diff <out-dir>]
//
// `--compare` counts the pixels that differ between the stills of the same name and writes a picture of
// the differences (red where a channel differs by more than 2, grey elsewhere) when `--diff` is given.

import * as playwright from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { ROOT, launchBrowser } from './server.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

/**
 * The scenes. `wave`: entered before it; `seconds`: how far into the wave the still is taken (null: in the
 * planning before it, the map without enemies). `zoom`: null keeps the fitted camera; a number centres the
 * camera at that zoom on the cell with the most steps of terrain around obstacles and emplacements. `speed`:
 * the game speed during the wave (marks on the ground age in real time, so at 3x more of them lie at once).
 */
const SCENES = [
  { name: 'kcgrpa-w22-planung', protocol: 'balancing/protokolle/nachschubfront-2026-11-05-KCGRPA-welle22.json', wave: 22, seconds: null, zoom: null },
  { name: 'kcgrpa-w22-welle', protocol: 'balancing/protokolle/nachschubfront-2026-11-05-KCGRPA-welle22.json', wave: 22, seconds: 24, zoom: null },
  { name: 'f7szgz-w30-planung', protocol: 'balancing/protokolle/nachschubfront-2026-11-04-F7SZGZ-welle38.json', wave: 30, seconds: null, zoom: null },
  { name: 'f7szgz-w30-welle', protocol: 'balancing/protokolle/nachschubfront-2026-11-04-F7SZGZ-welle38.json', wave: 30, seconds: 30, zoom: null },
  { name: 'f7szgz-w30-bloecke', protocol: 'balancing/protokolle/nachschubfront-2026-11-04-F7SZGZ-welle38.json', wave: 30, seconds: 30, zoom: 2 },
  { name: 'kcgrpa-w20-welle', protocol: 'balancing/protokolle/nachschubfront-2026-11-05-KCGRPA-welle22.json', wave: 20, seconds: 22, zoom: null },
  { name: 'f7szgz-w31-welle', protocol: 'balancing/protokolle/nachschubfront-2026-11-04-F7SZGZ-welle38.json', wave: 31, seconds: 20, zoom: 1.4 },
  { name: 'kcgrpa-w22-3x', protocol: 'balancing/protokolle/nachschubfront-2026-11-05-KCGRPA-welle22.json', wave: 22, seconds: 12, zoom: null, speed: 3 },
  { name: 'kcgrpa-w20-3x', protocol: 'balancing/protokolle/nachschubfront-2026-11-05-KCGRPA-welle22.json', wave: 20, seconds: 10, zoom: null, speed: 3 },
  { name: 'kcgrpa-w22-bloecke', protocol: 'balancing/protokolle/nachschubfront-2026-11-05-KCGRPA-welle22.json', wave: 22, seconds: 24, zoom: 2 },
];

if (args[0] === '--compare') {
  await compare(args[1], args[2], opt('diff', null));
  process.exit(0);
}

const outDir = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!outDir) {
  console.error('Usage: node tests/tools/render-stills.mjs <out-dir> [--root dir] | --compare <a> <b> [--diff dir]');
  process.exit(2);
}
const root = resolve(opt('root', ROOT)) + sep;
const [width, height] = opt('size', '1920x1080').split('x').map(Number);
const dpr = Number(opt('dpr', 1));
const warm = Number(opt('warm', 30));
const only = opt('only', null)?.split(',') ?? null;

// ---------- Server with the hooks ----------

const PATCHES = {
  '/src/main.js': [
    ['function frame(now) {', 'function frame(now) {\n  if (window.__still.hold && !window.__still.manual) return;'],
    [
      'stepper.advance(dt, state.speed, (stepDt) => stepSimulation(state, stepDt));',
      'stepper.advance(dt, state.speed, (stepDt) => { window.__still.beforeStep(state); stepSimulation(state, stepDt); });',
    ],
    [
      'renderScene(ctx, view, camera, state, ui, ground, now / 1000);',
      'if (!window.__still.skipRender) renderScene(ctx, view, camera, state, ui, ground, now / 1000);',
    ],
    ['  requestAnimationFrame(frame);\n}', '  if (!window.__still.hold) requestAnimationFrame(frame);\n}'],
  ],
  '/src/sim/replay.js': [],
  // The ash is filled at its first frame with however many random numbers the page has drawn by then, which
  // the loading decides, not the game: left out of the stills. It is the last layer but two and no change here
  // reaches it.
  '/src/render/scene.js': [['atmosphere.draw(ctx, view, t, ui.reducedMotion);', '']],
};
const APPEND = {
  '/src/main.js':
    '\nwindow.__still.state = () => state;\nwindow.__still.frame = (n) => frame(n);\n' +
    'window.__still.sync = (n) => { last = n; stepper.reset(); };\n' +
    'window.__still.preload = (defs) => sprites.preload([...ENEMY_SPRITE_DEFS, ...POD_SPRITE_DEFS, ...defs], camera.zoom, view.dpr);\n' +
    'window.__still.camera = camera;\nwindow.__still.ui = ui;\nwindow.__still.canvas = canvas;\n',
  '/src/sim/replay.js': '\nexport { when as __when, apply as __apply };\n',
  '/src/render/scene.js': '',
};
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
let hookError = null;
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let fileOnDisk = normalize(join(root, path));
  if (!fileOnDisk.startsWith(root) || fileOnDisk.split(sep).includes('node_modules')) return res.writeHead(404).end();
  if (path.endsWith('/')) fileOnDisk = join(fileOnDisk, 'index.html');
  try {
    let body = await readFile(fileOnDisk);
    if (path === '/sw.js') return res.writeHead(404).end();
    if (Object.hasOwn(PATCHES, path)) {
      let text = body.toString('utf8');
      for (const [from, into] of PATCHES[path]) {
        if (!text.includes(from)) throw new Error(`hook does not fit in ${path}: ${from.slice(0, 60)}`);
        text = text.replace(from, into);
      }
      body = text + APPEND[path];
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(fileOnDisk)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch (error) {
    if (String(error.message).startsWith('hook')) hookError = error.message;
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/`;

async function still(browser, scene) {
  const file = JSON.parse(await readFile(join(ROOT, scene.protocol), 'utf8'));
  const protocol = file.match ?? file;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
  await page.addInitScript(() => {
    // A clock that only moves when a frame is driven from here, and a seeded Math.random.
    const realNow = performance.now.bind(performance);
    const clock = { now: null };
    performance.now = () => (clock.now === null ? realNow() : clock.now);
    let s = 0x9e3779b9;
    const seeded = () => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const realRandom = Math.random;
    // Seeded from the start: the ash and the backdrop draw their random numbers when they are made.
    Math.random = seeded;
    window.__still = {
      hold: false,
      manual: false,
      skipRender: false,
      beforeStep() {},
      clock,
      seed(n) {
        s = n;
        Math.random = seeded;
      },
      unseed() {
        Math.random = realRandom;
      },
    };
  });
  if (args.includes('--trace')) await page.addInitScript(() => (window.__still.trace = true));
  await page.goto(`${url}?seed=${protocol.seed}&debug`, { waitUntil: 'networkidle' });
  if (hookError) throw new Error(hookError);
  await page.waitForSelector('body[data-ready]', { timeout: 120000 });
  // The loop is held from here on: a frame of the real loop would move the match by real time.
  const entry = await page.evaluate(([p, wave]) => {
    window.__still.hold = true;
    return window.__nachschub.testEntry(p, wave);
  }, [protocol, scene.wave]);
  if (!entry.ok) throw new Error(`test entry refused: ${entry.reason}`);
  const result = await page.evaluate(
    async ({ actions, wave, seconds, zoom, warm, speed }) => {
      const S = window.__still;
      const { __when, __apply } = await import('/src/sim/replay.js');
      const { iso } = await import('/src/render/iso.js');
      const state = S.state();
      const pending = actions.filter((a) => a.w > wave - 1 || (a.w === wave - 1 && a.p !== 'wave')).sort((a, b) => a.t - b.t);
      let next = 0;
      S.beforeStep = (st) => {
        while (next < pending.length) {
          const moment = __when(st, pending[next]);
          if (moment === 'before') break;
          if (moment !== 'past') __apply(st, pending[next]);
          next += 1;
        }
      };
      // Nothing on screen that the version or the moment decides: no banner, no pointer, the camera.
      S.ui.banner = null;
      S.ui.hoverCell = null;
      S.ui.inspect = null;
      if (zoom) {
        const heights = window.__nachschub.heights();
        const n = Math.round(Math.sqrt(heights.length));
        const at = (x, y) => (x < 0 || y < 0 || x >= n || y >= n ? 0 : heights[y * n + x]);
        const things = [...state.towers.map((t) => [t.x, t.y]), ...state.map.obstacles.flatMap((o) => o.cells.map((c) => [c.x, c.y]))];
        let best = null;
        for (const [cx, cy] of things) {
          let score = 0;
          for (const [x, y] of things) {
            if (Math.abs(x - cx) > 4 || Math.abs(y - cy) > 4) continue;
            for (let dy = 0; dy <= 2; dy++) for (let dx = 0; dx <= 2; dx++) if (at(x + dx, y + dy) > at(x, y)) score += 1;
          }
          if (!best || score > best.score) best = { score, cx, cy };
        }
        const [wx, wy] = iso(best.cx + 0.5, best.cy + 0.5, at(best.cx, best.cy) * 12);
        S.ui.autoFit = false;
        S.camera.zoom = zoom;
        S.camera.x = wx;
        S.camera.y = wy;
      }
      state.speed = 1;
      const DT = 1000 / 60;
      let t = 100000;
      S.clock.now = t;
      S.sync(t);
      S.seed(12345);
      const drive = (draw) => {
        S.skipRender = !draw;
        t += DT;
        S.clock.now = t;
        S.manual = true;
        S.frame(t);
        S.manual = false;
      };
      // Sprites are rastered off the frame (promises): one frame asks for them, then the page gets time.
      const { allTowerDefs } = await import('/src/render/towerSprites.js');
      const raster = async () => {
        // Every figure at the zoom of the still, so no frame draws one that is still on its way.
        await S.preload(allTowerDefs());
        drive(true);
        await new Promise((ok) => setTimeout(ok, 2000));
      };
      let frames = 0;
      if (seconds === null) {
        await raster();
        for (let i = 0; i < warm; i++) drive(true);
      } else {
        // Into the wave, then `seconds` of it; the last `warm` frames with the picture.
        const waveStart = () => state.phase === 'wave' && state.wave === wave;
        // The planning can last long (F7SZGZ waits 17 minutes before wave 30): at 3x up to the wave.
        state.speed = 3;
        while (!waveStart() && frames < 60 * 1200) {
          drive(false);
          frames += 1;
        }
        state.speed = speed;
        const total = Math.round(seconds * 60);
        for (let i = 0; i < total; i++) {
          if (i === total - warm - 1) await raster();
          else drive(i >= total - warm);
        }
      }
      const data = S.canvas.toDataURL('image/png');
      // With --trace: one more frame with every clip, save and radial gradient counted by the function
      // that asked for it (after the still, so the picture is not touched).
      let trace = null;
      if (S.trace) {
        trace = {};
        const proto = CanvasRenderingContext2D.prototype;
        const originals = {};
        for (const name of ['clip', 'save', 'createRadialGradient', 'drawImage', 'fill', 'stroke']) {
          originals[name] = proto[name];
          proto[name] = function (...a) {
            if (this === S.canvas.getContext('2d')) {
              const lines = new Error().stack.split('\n').slice(2);
              const fn = (lines.find((l) => !/groundClip|at onGround|at drawBehindTerrain|<anonymous>|at Array\.forEach/.test(l) && /src\//.test(l)) ?? lines[0])
                .trim()
                .replace(/^at /, '')
                .replace(/\(?https?:\/\/[^/]+\//, '')
                .replace(/:\d+\)?$/, '');
              const key = `${name} ${fn}`;
              trace[key] = (trace[key] ?? 0) + 1;
              trace[`${name} *`] = (trace[`${name} *`] ?? 0) + 1;
            }
            return originals[name].apply(this, a);
          };
        }
        drive(true);
        for (const name in originals) proto[name] = originals[name];
      }
      S.unseed();
      return {
        trace,
        data,
        phase: state.phase,
        wave: state.wave,
        enemies: state.enemies.length,
        towers: state.towers.length,
        obstacles: state.map.obstacles.length,
        counts: S.ui.effects?.counts?.() ?? null,
        camera: { ...S.camera },
      };
    },
    { actions: protocol.actions, wave: scene.wave, seconds: scene.seconds, zoom: scene.zoom, warm, speed: scene.speed ?? 1 },
  );
  await context.close();
  const png = Buffer.from(result.data.split(',')[1], 'base64');
  await writeFile(join(outDir, `${scene.name}.png`), png);
  delete result.data;
  return { ...result, problems };
}

async function compare(a, b, diffDir) {
  const browser = await launchBrowser(playwright, 'chromium');
  const page = await browser.newPage();
  if (diffDir) await mkdir(diffDir, { recursive: true });
  const names = (await readdir(a)).filter((f) => f.endsWith('.png')).sort();
  let failed = false;
  for (const name of names) {
    let other;
    try {
      other = await readFile(join(b, name));
    } catch {
      console.log(`${name}: fehlt in ${b}`);
      failed = true;
      continue;
    }
    const one = await readFile(join(a, name));
    const out = await page.evaluate(
      async ([x, y, wantDiff]) => {
        const load = (src) =>
          new Promise((ok, fail) => {
            const img = new Image();
            img.onload = () => ok(img);
            img.onerror = fail;
            img.src = src;
          });
        const [ia, ib] = await Promise.all([load(x), load(y)]);
        if (ia.width !== ib.width || ia.height !== ib.height) return { size: true };
        const px = (img) => {
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const g = c.getContext('2d');
          g.drawImage(img, 0, 0);
          return g.getImageData(0, 0, c.width, c.height);
        };
        const da = px(ia);
        const db = px(ib);
        const c = document.createElement('canvas');
        c.width = ia.width;
        c.height = ia.height;
        const g = c.getContext('2d');
        const out = g.createImageData(c.width, c.height);
        let any = 0;
        let big = 0;
        let maxDelta = 0;
        let box = null;
        for (let i = 0; i < da.data.length; i += 4) {
          let d = 0;
          for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(da.data[i + k] - db.data[i + k]));
          const grey = (da.data[i] + da.data[i + 1] + da.data[i + 2]) / 12 + 140;
          out.data[i] = d > 2 ? 255 : grey;
          out.data[i + 1] = d > 2 ? 0 : grey;
          out.data[i + 2] = d > 2 ? 0 : grey;
          out.data[i + 3] = 255;
          if (d > 0) any += 1;
          if (d > 2) {
            big += 1;
            const p = i / 4;
            const x0 = p % c.width;
            const y0 = Math.floor(p / c.width);
            box = box ? [Math.min(box[0], x0), Math.min(box[1], y0), Math.max(box[2], x0), Math.max(box[3], y0)] : [x0, y0, x0, y0];
          }
          maxDelta = Math.max(maxDelta, d);
        }
        g.putImageData(out, 0, 0);
        return { any, big, maxDelta, box, total: da.data.length / 4, diff: wantDiff && big ? c.toDataURL('image/png') : null };
      },
      [`data:image/png;base64,${one.toString('base64')}`, `data:image/png;base64,${other.toString('base64')}`, Boolean(diffDir)],
    );
    if (out.size) {
      console.log(`${name}: andere Größe`);
      failed = true;
      continue;
    }
    if (out.any) failed = true;
    console.log(
      `${name}: ${out.any} Pixel anders (${((out.any / out.total) * 100).toFixed(3)} %), davon ${out.big} um mehr als 2, größte Abweichung ${out.maxDelta}` +
        (out.box ? `, Bereich ${out.box.join(',')}` : ''),
    );
    if (out.diff) await writeFile(join(diffDir, name), Buffer.from(out.diff.split(',')[1], 'base64'));
  }
  await browser.close();
  if (failed) process.exitCode = 1;
}

await mkdir(outDir, { recursive: true });
const browser = await launchBrowser(playwright, 'chromium');
try {
  for (const scene of SCENES) {
    if (only && !only.includes(scene.name)) continue;
    const r = await still(browser, scene);
    console.log(
      `${scene.name}: Welle ${r.wave} ${r.phase}, ${r.enemies} Gegner, ${r.towers} Stellungen, ${r.obstacles} Hindernisse, Kamera ${r.camera.x.toFixed(2)},${r.camera.y.toFixed(2)} Zoom ${r.camera.zoom.toFixed(2)}` +
        (r.counts ? `, Aufkleber ${r.counts.decals}, Lichter ${r.counts.lights}, Teilchen ${r.counts.particles}` : '') +
        (r.problems.length ? ` · Konsole: ${r.problems.slice(0, 3).join(' | ')}` : ''),
    );
    if (r.trace) {
      for (const [k, v] of Object.entries(r.trace).sort((a, b) => a[0].split(' ')[0].localeCompare(b[0].split(' ')[0]) || b[1] - a[1])) {
        if (v >= 3 || k.endsWith('*')) console.log(`  ${String(v).padStart(5)}  ${k}`);
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
