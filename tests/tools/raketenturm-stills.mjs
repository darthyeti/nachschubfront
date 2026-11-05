// Stills and concept SVGs of the rocket tower study (reference/studien/raketenturm.html, issue 96).
//
// Stills: the scene (today and drafts A, B, C side by side) at aiming, launch, flight, impact and reload,
// and the sheets of the study (directions, reload, silhouettes at zoom 0.5, parts with anchors, large).
// Concept SVGs: one sheet per draft, one symbol per part (base, carriage, launcher, left and right rocket),
// recorded from the model in one direction with canvas-to-svg.mjs, plus the parts that change while
// reloading, and the anchor points as a group of their own (data-anker, local coordinates in data-lokal).
// The numbers of the table "Zahlen" go to zahlen.json. Fails on any error in the page.
//
// Usage: node tests/tools/raketenturm-stills.mjs [out-dir]

import * as playwright from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startServer, launchBrowser } from './server.mjs';
import { installRecorder } from './canvas-to-svg.mjs';

const out = process.argv[2] ?? 'reference/konzept/raketenturm';
mkdirSync(out, { recursive: true });

const server = await startServer();
const browser = await launchBrowser(playwright, 'chromium');
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
page.on('console', (msg) => msg.type() === 'error' && errors.push(`console: ${msg.text()}`));
await page.goto(`${server.url}reference/studien/raketenturm.html`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__rt?.ready, null, { timeout: 60000 });
await page.addStyleTag({ content: '.bar{display:none !important}' });

// ---------- the scene ----------
const first = await page.evaluate(() => window.__rt.firstShot());
const SCENE = [
  ['1-zielen', first - 0.3],
  ['2-abschuss', first + 0.05],
  ['3-flug', first + 0.75],
  ['4-einschlag', first + 1.3],
  ['5-nachladen', first + 1.75],
];
const CLIP = { x: 60, y: 150, width: 1060, height: 420 };
for (const [name, t] of SCENE) {
  await page.evaluate((tt) => window.__rt.seek(tt, { zoom: 1 }), t);
  await page.screenshot({ path: `${out}/szene-${name}.png`, clip: CLIP });
}

// ---------- the sheets ----------
await page.evaluate(() => window.__rt.preload(2));
for (const [view, zoom] of [['richtungen', 2], ['nachladen', 2], ['teile', 2], ['gross', 2], ['silhouette', 1]]) {
  await page.evaluate(([v, z]) => window.__rt.show(v, { zoom: z }), [view, zoom]);
  await page.screenshot({ path: `${out}/${view}.png` });
}

// ---------- numbers ----------
const numbers = await page.evaluate(() => window.__rt.numbers());
writeFileSync(`${out}/zahlen.json`, `${JSON.stringify(numbers, null, 2)}\n`);

// ---------- concept SVGs ----------
await page.addScriptTag({
  content: `
    window.__installRecorder = ${installRecorder.toString()};
    window.__record = (id, part, theta, pose) => {
      const c = document.createElement('canvas').getContext('2d');
      const rec = window.__installRecorder(c);
      window.__rt.drawPart(c, id, part, theta, pose);
      return rec.take();
    };
  `,
});

const THETA = -0.55;
const PARTS = ['sockel', 'gehaeuse', 'werfer', 'rakete0', 'rakete1'];
const NAMES = { sockel: 'Sockel (Drehkranz)', gehaeuse: 'Gehäuse (Lafette)', werfer: 'Werfer (schwenkbar)', rakete0: 'Rakete links', rakete1: 'Rakete rechts' };
const STYLE = '.anker{stroke:#1a1410;stroke-width:0.8px}';

const attr = (name, value) => (value === undefined || value === null ? '' : ` ${name}="${value}"`);
function pathOf(shape) {
  const parts = [`<path d="${shape.d}"`];
  parts.push(attr('fill', shape.fill ?? 'none'));
  if (shape.stroke) {
    parts.push(attr('stroke', shape.stroke));
    parts.push(attr('stroke-width', Math.round(shape.width * 100) / 100));
    parts.push(attr('stroke-linejoin', shape.join === 'miter' ? null : shape.join));
    parts.push(attr('stroke-linecap', shape.cap === 'butt' ? null : shape.cap));
  }
  if (shape.alpha < 1) parts.push(attr('opacity', Math.round(shape.alpha * 1000) / 1000));
  parts.push('/>');
  return parts.join('');
}

const ANCHOR_COLOURS = { drehpunkt: '#ffffff', kipppunkt: '#5fd4ff', muendung0: '#ff8a2a', muendung1: '#ff8a2a', duese0: '#b784ff', duese1: '#b784ff', visier: '#ff4a4a', lader0: '#9ccf4a', lader1: '#9ccf4a' };
const drafts = await page.evaluate(() => window.__rt.drafts);
for (const d of drafts) {
  const symbols = [];
  for (const part of PARTS) {
    const shapes = await page.evaluate(([id, p, t]) => window.__record(id, p, t, {}), [d.id, part, THETA]);
    if (shapes.some((s) => s.clip)) throw new Error(`${d.id} ${part}: clip paths are not expected`);
    symbols.push({ id: `rt-${d.id}-${part}`, title: NAMES[part], shapes });
  }
  // What changes while the left rocket is loaded, half way: the rocket (A, B) and, in C, the launcher.
  for (const part of ['werfer', 'rakete0']) {
    const shapes = await page.evaluate(([id, p, t]) => window.__record(id, p, t, { load: [0.5, 1] }), [d.id, part, THETA]);
    symbols.push({ id: `rt-${d.id}-${part}-laden`, title: `${NAMES[part]}, halb geladen`, shapes });
  }
  const anchors = await page.evaluate(([id, t]) => window.__rt.anchorPoints(id, t, { seek: 1 }), [d.id, THETA]);
  const anchorGroup = Object.entries(anchors)
    .map(([name, a]) => `<circle class="anker" data-anker="${name}" data-lokal="${a.local.join(' ')}" cx="${a.screen[0]}" cy="${a.screen[1]}" r="1.6" fill="${ANCHOR_COLOURS[name]}"/>`)
    .join('');
  const defs = symbols.map((s) => `<g id="${s.id}"><title>${s.title}</title>${s.shapes.map(pathOf).join('')}</g>`).join('\n    ');
  // The sheet: the whole model (all parts at their place, with the anchors), then each part on its own.
  const whole = PARTS.map((p) => `<use href="#rt-${d.id}-${p}"/>`).join('');
  const uses = [
    `<g transform="translate(0 0)">${whole}<g id="rt-${d.id}-anker">${anchorGroup}</g></g>`,
    ...symbols.map((s, i) => `<use href="#${s.id}" x="${(i + 1) * 110}" y="0"/>`),
  ].join('\n  ');
  const body = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -120 ${(symbols.length + 1) * 110 + 20} 150">
  <title>Raketenturm, Entwurf ${d.id} (${d.name}): Teile mit Ankerpunkten. Erzeugt aus reference/studien/raketenturm-modell.js, node tests/tools/raketenturm-stills.mjs</title>
  <desc>${d.note} Ein Blick (Richtung ${THETA} rad), Weltpixel bei Zoom 1, Ursprung im Drehpunkt auf der Dachplatte der Spezialbasis (Höhe der Basis eingerechnet). Im Spiel wäre das Modell wie alle Waffen ein drehbares Modell aus Körpern (docs/ART.md, „Drehbare Modelle“); das SVG ist der Bogen dazu. data-lokal: lx ly (Felder) und z (px über der Dachplatte, vor der Skalierung).</desc>
  <style>${STYLE}</style>
  <defs>
    ${defs}
  </defs>
  ${uses}
</svg>
`;
  writeFileSync(`${out}/entwurf-${d.id}.svg`, body);
  console.log(`${out}/entwurf-${d.id}.svg: ${symbols.length} Teile, ${symbols.reduce((n, s) => n + s.shapes.length, 0)} Pfade`);
}

console.log(JSON.stringify(numbers));
await browser.close();
await server.close?.();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
process.exit(0);
