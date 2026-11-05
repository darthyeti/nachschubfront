// Frame times of a recorded match, played on in the real game in the browser (issue 93).
//
// The match is entered through the test entry (sim/testentry.js) just before `--from`, and from there the
// browser goes on with the player's own actions out of the protocol, step by step, through the game's own
// loop and renderer. So the waves on screen are the waves that were played, at 1x, 2x or 3x, and two
// versions of the game can be measured on the very same picture. At the end the wave lines are checked
// against the protocol; a run that drifted is said to have drifted.
//
// Per frame it records the interval to the frame before, the JS time of the frame callback split into
// simulation and `renderScene`, and what was on screen: enemies, emplacements, shells by kind, and the
// effect counts (particles, decals, ground lights, burning patches) where the version has them.
//
// Nothing of the game is changed on disk. The server of this tool hands the browser three small hooks in
// src/main.js and src/sim/replay.js (timing around the step and the scene, a handle on the state, and the
// two replay helpers exported); a version where a hook does not fit is refused, not measured.
//
// Usage:
//   node tests/tools/replay-perf.mjs <protocol.json> [--root <checkout>] [--from 18] [--to 22]
//     [--speeds 1,2,3] [--size 1920x1080] [--dpr 1] [--zoom fit|max] [--off lights,burn,balls]
//     [--profile] [--out <result.json>] [--browser chromium|webkit]
//
// `--root` serves another checkout (a git worktree of another version). `--off` empties effect tables
// in the running page (FX_LIGHT.max, FX_BURN.total, FX_BALLS.max) to see what one effect costs on the same
// picture. `--profile` takes a CPU profile of the measured stretch (Chromium only) and prints the functions
// with the most time, inclusive and self.
//
// With software rendering (a container without GPU) the absolute frame times say little about a real
// machine; the counts, the JS times relative to each other and the differences between versions do.

import * as playwright from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { ROOT, launchBrowser } from './server.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);
const protocolPath = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!protocolPath) {
  console.error('Usage: node tests/tools/replay-perf.mjs <protocol.json> [--root dir] [--from 18] [--to 22] [--speeds 1,2,3]');
  process.exit(2);
}
const root = resolve(opt('root', ROOT)) + sep;
const from = Number(opt('from', 18));
const to = Number(opt('to', 22));
const speeds = opt('speeds', '1,2,3').split(',').map(Number);
const [width, height] = opt('size', '1920x1080').split('x').map(Number);
const dpr = Number(opt('dpr', 1));
const zoomMode = opt('zoom', 'fit');
const off = (opt('off', '') || '').split(',').filter(Boolean);
const profile = flag('profile');
/** Counts the canvas calls of every frame (slows the frame down a little, so a run of its own). */
const countCalls = flag('count');
const outPath = opt('out', null);
const engine = opt('browser', 'chromium');

const file = JSON.parse(await readFile(protocolPath, 'utf8'));
const protocol = file.match ?? file;

// ---------- Server with the hooks ----------

const PATCHES = {
  '/src/main.js': [
    [
      'stepper.advance(dt, state.speed, (stepDt) => stepSimulation(state, stepDt));',
      'stepper.advance(dt, state.speed, (stepDt) => { window.__perf.beforeStep(state); const __t = performance.now(); stepSimulation(state, stepDt); window.__perf.sim += performance.now() - __t; window.__perf.steps += 1; });',
    ],
    [
      'renderScene(ctx, view, camera, state, ui, ground, now / 1000);',
      '{ const __t = performance.now(); renderScene(ctx, view, camera, state, ui, ground, now / 1000); window.__perf.render += performance.now() - __t; }',
    ],
    ['  requestAnimationFrame(frame);\n}', '  window.__perf.endFrame(workStart, performance.now());\n  requestAnimationFrame(frame);\n}'],
  ],
  '/src/sim/replay.js': [],
};
const APPEND = {
  '/src/main.js': '\nwindow.__perf.state = () => state;\nwindow.__perf.effects = () => ui.effects;\n',
  '/src/sim/replay.js': '\nexport { when as __when, apply as __apply };\n',
};

async function patched(path, body) {
  let text = body.toString('utf8');
  for (const [from, into] of PATCHES[path]) {
    if (!text.includes(from)) throw new Error(`hook does not fit in ${path}: ${from.slice(0, 60)}`);
    text = text.replace(from, into);
  }
  return text + APPEND[path];
}

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
    // No service worker: every version is served fresh from its own checkout.
    if (path === '/sw.js') return res.writeHead(404).end();
    if (Object.hasOwn(PATCHES, path)) body = await patched(path, body);
    res.writeHead(200, { 'Content-Type': TYPES[extname(fileOnDisk)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch (error) {
    if (String(error.message).startsWith('hook')) hookError = error.message;
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/`;
const version = (await readFile(join(root, 'src/data/version.js'), 'utf8')).match(/['"](\d+\.\d+\.\d+)['"]/)?.[1] ?? '?';

// ---------- One run ----------

const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : NaN);
const median = (xs) => percentile([...xs].sort((a, b) => a - b), 0.5);

async function run(browser, speed) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
  await page.addInitScript((count) => {
    window.__perf = { beforeStep() {}, endFrame() {}, sim: 0, render: 0, steps: 0, calls: null };
    if (!count) return;
    const calls = {};
    window.__perf.calls = calls;
    const proto = CanvasRenderingContext2D.prototype;
    for (const name of ['fill', 'stroke', 'drawImage', 'createRadialGradient', 'createLinearGradient', 'clip', 'save', 'fillRect', 'arc', 'ellipse']) {
      const original = proto[name];
      calls[name] = 0;
      proto[name] = function (...a) {
        calls[name] += 1;
        return original.apply(this, a);
      };
    }
  }, countCalls);
  await page.goto(`${url}?seed=${protocol.seed}&debug`, { waitUntil: 'networkidle' });
  if (hookError) throw new Error(hookError);
  await page.waitForSelector('body[data-ready]', { timeout: 120000 });

  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });

  const entry = await page.evaluate(([p, wave]) => window.__nachschub.testEntry(p, wave), [protocol, from]);
  if (!entry.ok) throw new Error(`test entry refused: ${entry.reason}`);

  if (zoomMode === 'max') for (let i = 0; i < 12; i++) await page.keyboard.press('+');

  // From here on the protocol's own actions drive the match, in the game's own steps.
  const ready = await page.evaluate(
    async ({ actions, before, off }) => {
      const { __when, __apply } = await import('/src/sim/replay.js');
      const art = await import('/src/data/art.js');
      if (off.includes('lights') && art.FX_LIGHT) art.FX_LIGHT.max = 0;
      if (off.includes('burn') && art.FX_BURN) art.FX_BURN.total = 0;
      if (off.includes('balls') && art.FX_BALLS) art.FX_BALLS.max = 0;
      const pending = actions
        .filter((a) => a.w > before || (a.w === before && a.p !== 'wave'))
        .sort((a, b) => a.t - b.t);
      const skipped = [];
      let next = 0;
      const perf = window.__perf;
      perf.beforeStep = (state) => {
        while (next < pending.length) {
          const action = pending[next];
          const moment = __when(state, action);
          if (moment === 'before') break;
          next += 1;
          if (moment === 'past') {
            skipped.push(`${action.a} w${action.w} ${action.p}: past`);
            continue;
          }
          const result = __apply(state, action);
          if (result !== true) skipped.push(`${action.a} w${action.w} ${action.p}: ${result}`);
        }
      };
      perf.frames = [];
      perf.skipped = skipped;
      perf.left = () => pending.length - next;
      let last = null;
      perf.endFrame = (start, end) => {
        const state = perf.state();
        const counts = perf.effects()?.counts?.() ?? {};
        const shells = {};
        for (const p of state.projectiles) {
          const k = p.kind ?? p.type ?? 'shell';
          shells[k] = (shells[k] ?? 0) + 1;
        }
        perf.frames.push({
          gap: last === null ? 0 : start - last,
          work: end - start,
          sim: perf.sim,
          render: perf.render,
          steps: perf.steps,
          wave: state.wave,
          phase: state.phase,
          enemies: state.enemies.length,
          towers: state.towers.length,
          shells,
          ...counts,
          ...(perf.calls ? { calls: { ...perf.calls } } : {}),
          // Every second or so: what the page holds, to see whether something grows over the match.
          ...(perf.frames.length % 60 === 0
            ? { heap: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null, nodes: document.getElementsByTagName('*').length }
            : {}),
        });
        if (perf.calls) for (const k in perf.calls) perf.calls[k] = 0;
        last = start;
        perf.sim = 0;
        perf.render = 0;
        perf.steps = 0;
      };
      return { pending: pending.length };
    },
    { actions: protocol.actions, before: from - 1, off },
  );

  let client = null;
  if (profile && engine === 'chromium') {
    client = await context.newCDPSession(page);
    await client.send('Profiler.enable');
    await client.send('Profiler.setSamplingInterval', { interval: 500 });
    await client.send('Profiler.start');
  }
  await page.evaluate((s) => {
    window.__perf.state().speed = s;
  }, speed);

  // Until wave `to` is over (its line is written) or the protocol has nothing more to do.
  const started = Date.now();
  let status;
  for (;;) {
    await page.waitForTimeout(2000);
    status = await page.evaluate(() => {
      const s = window.__perf.state();
      return { waves: s.log?.waves?.length ?? 0, phase: s.phase, left: window.__perf.left(), speed: s.speed, wave: s.wave };
    });
    if (status.waves >= to || status.phase === 'defeat' || status.phase === 'victory') break;
    if (status.left === 0 && status.phase === 'planning') break;
    if (status.speed === 0) {
      // Something paused the match (an intro, a menu): put the speed back.
      await page.evaluate((s) => {
        window.__perf.state().speed = s;
      }, speed);
    }
    if (Date.now() - started > 60 * 60 * 1000) throw new Error('run took longer than an hour');
  }
  const seconds = (Date.now() - started) / 1000;

  let hot = null;
  if (client) {
    const { profile: cpu } = await client.send('Profiler.stop');
    hot = hotFunctions(cpu);
  }

  const result = await page.evaluate(() => ({
    frames: window.__perf.frames,
    skipped: window.__perf.skipped,
    waves: window.__perf.state().log.waves.map(({ w, lives, killed, leaked, requisition }) => ({ w, lives, killed, leaked, requisition })),
  }));
  await context.close();

  const drift = [];
  for (const line of result.waves.filter((l) => l.w >= from && l.w <= to)) {
    const want = protocol.waves.find((l) => l.w === line.w);
    if (!want) continue;
    for (const k of ['lives', 'killed', 'leaked', 'requisition']) {
      if (want[k] !== line[k]) drift.push(`wave ${line.w} ${k}: ${line[k]} instead of ${want[k]}`);
    }
  }
  return { speed, renderer, seconds, frames: result.frames, skipped: result.skipped, drift, problems, hot, entry: entry.about };
}

/** Inclusive and self time per function of a CPU profile, in ms. */
function hotFunctions(cpu) {
  const byId = new Map(cpu.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of cpu.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const name = (n) => {
    const f = n.callFrame;
    const file = f.url ? f.url.replace(/^.*?\/src\//, 'src/') : '';
    return `${f.functionName || '(anonymous)'} ${file}${file ? `:${f.lineNumber + 1}` : ''}`;
  };
  const self = new Map();
  const incl = new Map();
  const dts = cpu.timeDeltas;
  let total = 0;
  cpu.samples.forEach((id, i) => {
    const dt = (dts[i + 1] ?? dts[i] ?? 0) / 1000;
    total += dt;
    const n = byId.get(id);
    self.set(name(n), (self.get(name(n)) ?? 0) + dt);
    const seen = new Set();
    for (let k = id; k !== undefined; k = parent.get(k)) {
      const key = name(byId.get(k));
      if (seen.has(key)) continue;
      seen.add(key);
      incl.set(key, (incl.get(key) ?? 0) + dt);
    }
  });
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ fn: k, ms: Math.round(v), share: v / total }));
  return { totalMs: Math.round(total), inclusive: top(incl, 45), self: top(self, 25) };
}

// ---------- Report ----------

function summarize(frames) {
  const rows = [];
  const groups = new Map();
  for (const f of frames.slice(5)) {
    const key = `${f.wave} ${f.phase === 'wave' ? 'Welle' : 'Pause'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  for (const [key, fs] of groups) {
    const gaps = fs.map((f) => f.gap).sort((a, b) => a - b);
    const max = (k) => Math.max(...fs.map((f) => f[k] ?? 0));
    const shellMax = Math.max(...fs.map((f) => Object.values(f.shells).reduce((a, b) => a + b, 0)));
    const rockets = Math.max(...fs.map((f) => Object.entries(f.shells).filter(([k]) => /rocket|mortar|shell|siege/i.test(k)).reduce((a, [, v]) => a + v, 0)));
    rows.push({
      key,
      frames: fs.length,
      gapMedian: percentile(gaps, 0.5),
      gapP95: percentile(gaps, 0.95),
      gapP99: percentile(gaps, 0.99),
      over33: fs.filter((f) => f.gap > 33.4).length / fs.length,
      work: median(fs.map((f) => f.work)),
      sim: median(fs.map((f) => f.sim)),
      render: median(fs.map((f) => f.render)),
      renderP95: percentile(fs.map((f) => f.render).sort((a, b) => a - b), 0.95),
      enemies: max('enemies'),
      towers: max('towers'),
      shells: shellMax,
      rockets,
      particles: max('particles'),
      decals: max('decals'),
      lights: max('lights'),
      patches: max('patches'),
      balls: max('balls'),
      heap: Math.max(...fs.map((f) => f.heap ?? 0)),
      nodes: Math.max(...fs.map((f) => f.nodes ?? 0)),
      calls: fs[0].calls ? Object.fromEntries(Object.keys(fs[0].calls).map((k) => [k, median(fs.map((f) => f.calls[k]))])) : null,
    });
  }
  return rows;
}

const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '–');

const browser = await launchBrowser(playwright, engine);
const results = [];
try {
  for (const speed of speeds) {
    const r = await run(browser, speed);
    r.rows = summarize(r.frames);
    results.push(r);
    console.log(`\n${version} · ${speed}x · ${width}x${height} @${dpr} · zoom ${zoomMode}${off.length ? ` · aus: ${off.join(',')}` : ''} · ${r.renderer} · ${fmt(r.seconds, 0)} s`);
    console.log('Welle         Bilder  Abst.Med  p95   p99  >33ms  JS   Sim  Szene  Sz.p95 | Gegn Stell Gesch Rak Teil Dek Licht Brand Bälle  Heap DOM');
    for (const w of r.rows) {
      console.log(
        `${w.key.padEnd(12)} ${String(w.frames).padStart(6)}  ${fmt(w.gapMedian).padStart(6)} ${fmt(w.gapP95).padStart(5)} ${fmt(w.gapP99).padStart(5)} ${fmt(w.over33 * 100, 0).padStart(4)}% ` +
          `${fmt(w.work).padStart(5)} ${fmt(w.sim).padStart(4)} ${fmt(w.render).padStart(5)} ${fmt(w.renderP95).padStart(6)} | ` +
          `${String(w.enemies).padStart(4)} ${String(w.towers).padStart(5)} ${String(w.shells).padStart(5)} ${String(w.rockets).padStart(3)} ${String(w.particles).padStart(4)} ${String(w.decals).padStart(3)} ${String(w.lights).padStart(5)} ${String(w.patches).padStart(5)} ${String(w.balls).padStart(5)} ${fmt(w.heap, 0).padStart(5)} ${String(w.nodes).padStart(4)}`,
      );
    }
    for (const w of r.rows) {
      if (w.calls) console.log(`  ${w.key.padEnd(12)} Aufrufe je Bild (Median): ${Object.entries(w.calls).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    }
    const all = r.frames.filter((f) => f.phase === 'wave');
    console.log(
      `Alle Wellenbilder: Abstand Median ${fmt(median(all.map((f) => f.gap)))} ms, JS ${fmt(median(all.map((f) => f.work)))} ms (Sim ${fmt(median(all.map((f) => f.sim)))}, Szene ${fmt(median(all.map((f) => f.render)))})`,
    );
    console.log(r.drift.length ? `ABWEICHUNG vom Protokoll: ${r.drift.join('; ')}` : `Wellen ${from} bis ${to} wie im Protokoll.`);
    if (r.skipped.length) console.log(`Übersprungen: ${r.skipped.join('; ')}`);
    if (r.problems.length) console.log(`Konsole: ${r.problems.slice(0, 5).join(' | ')}`);
    if (r.hot) {
      console.log(`CPU-Profil (${r.hot.totalMs} ms), inklusiv:`);
      for (const h of r.hot.inclusive) console.log(`  ${fmt(h.share * 100).padStart(5)} %  ${h.fn}`);
      console.log('selbst:');
      for (const h of r.hot.self) console.log(`  ${fmt(h.share * 100).padStart(5)} %  ${h.fn}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (outPath) {
  await writeFile(
    outPath,
    JSON.stringify({ version, root, from, to, size: [width, height], dpr, zoom: zoomMode, off, results: results.map(({ frames, ...r }) => r) }, null, 1),
  );
}
