// Turns the drawing code of reference/studien/stellungen-simulation.html into
// the concept SVGs the game imports (docs/ART.md, "Technische Umsetzung").
//
// The study is the binding shape of the bunker, its five ranks, the six weapon
// tops, the special base and the six special weapons. The game reads figures as
// SVG, so the study is run once against a recording context (canvas-to-svg.mjs)
// and every fill and stroke is written out as a path.
//
// The result is a normal concept sheet: one shared <style>, a <defs> library of
// <g> symbols, and a <use> per sheet. `npm run sprites` takes it from there,
// exactly as it does for the hand-drawn sheets.
//
// The capsule (draft B of reference/studien/kapsel-studie.html) is exported the same way.
//
// Usage: npm run studies   (then npm run sprites)

import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, startServer } from './server.mjs';
import { installRecorder } from './canvas-to-svg.mjs';
import { DOCTRINE_IDS, DOCTRINE_COLORS } from '../../src/data/doctrines.js';
import { RECIPES } from '../../src/data/recipes.js';

/**
 * The shared style block. Every sheet in a source folder has to carry the same
 * one (import-sprites.mjs), and since the hand-drawn emplacement sheets are
 * gone this is where it lives. The classes are the ink weights of the style
 * test; the exported paths carry their own widths and do not use them.
 */
const STYLE =
  '.k3{stroke:#1a1410;stroke-width:3px;stroke-linejoin:round;stroke-linecap:round}' +
  '.k2{stroke:#1a1410;stroke-width:2.2px;stroke-linejoin:round;stroke-linecap:round}' +
  '.k15{stroke:#1a1410;stroke-width:1.6px;stroke-linejoin:round;stroke-linecap:round}' +
  '.k1{stroke:#1a1410;stroke-width:1.1px;stroke-linejoin:round}';

/**
 * What to export. `call` runs inside the page with the recorder installed and
 * draws one figure at the origin; whatever it paints becomes one symbol.
 */
const FIGURES = [
  // The standard bunker (since 0.11.0) and the special base (since 0.11.10) are no longer drawn here:
  // they come from the rework studies (below). The six special tops of this study are gone with 0.11.10.
  // The six standard tops, drawn in their own local space and scaled the way the study places them on
  // the roof, so the sprite is ready to sit there (no longer read by the game since 0.11.2).
  ...[
    ['auto', 'top-auto'],
    ['fire', 'top-fire'],
    ['mortar', 'top-mortar'],
    ['tesla', 'top-tesla'],
    ['laser', 'top-laser'],
    ['psi', 'top-psi'],
  ].map(([type, id]) => ({ id, sheet: 'tops', call: `drawTop('${type}')` })),
];

/** Sheets to write, and which symbols each one shows. */
const SHEETS = {
  tops: 'reference/konzept/stellungen/aufsaetze.svg',
};

const attr = (name, value) => (value === undefined || value === null ? '' : ` ${name}="${value}"`);

/** One recorded shape as an SVG path element. */
function pathOf(shape, clips) {
  const parts = [`<path d="${shape.d}"`];
  if (shape.clip) parts.push(attr('clip-path', `url(#${clips.get(shape.clip)})`));
  parts.push(attr('fill', shape.fill ?? 'none'));
  if (shape.stroke) {
    parts.push(attr('stroke', shape.stroke));
    parts.push(attr('stroke-width', Math.round(shape.width * 100) / 100));
    parts.push(attr('stroke-linejoin', shape.join === 'miter' ? null : shape.join));
    parts.push(attr('stroke-linecap', shape.cap === 'butt' ? null : shape.cap));
    parts.push(attr('stroke-dasharray', shape.dash));
  }
  if (shape.alpha < 1) parts.push(attr('opacity', Math.round(shape.alpha * 1000) / 1000));
  parts.push('/>');
  return parts.join('');
}

const server = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => {
  throw e;
});

await page.goto(`${server.url}reference/studien/stellungen-simulation.html`, { waitUntil: 'networkidle' });

// The study wraps itself in an IIFE, so none of its names are reachable from
// outside — not from page.evaluate, which runs in a world of its own, and not
// from a script beside it either. Its code is therefore read from the file,
// unwrapped, and run a second time on the same page, which leaves the study
// itself untouched and hands the export everything it draws with.
const STUDY = await (async () => {
  const text = await readFile(join(ROOT, 'reference/studien/stellungen-simulation.html'), 'utf8');
  const script = text.match(/<script>([\s\S]*?)<\/script>/);
  if (!script) throw new Error('no <script> in the study');
  const body = script[1].trim();
  const open = body.indexOf('(()=>{');
  if (open !== 0 || !body.endsWith('})();')) throw new Error('the study is no longer one plain IIFE');
  return body.slice('(()=>{'.length, -'})();'.length);
})();

// The copy has to draw somewhere of its own: both copies ask for the context of
// the canvas they find, and one object cannot be recorded for one of them and
// left alone for the other. So the study keeps its canvas and the copy gets a
// fresh one under the name it looks for.
await page.evaluate(() => {
  document.getElementById('c').id = 'c-study';
  const fresh = document.createElement('canvas');
  fresh.id = 'c';
  fresh.style.display = 'none';
  document.body.append(fresh);
});

await page.addScriptTag({
  content: `
    ${STUDY}
    // The copy brings the study's animation loop with it. Nothing here wants a
    // running scene, only its drawing functions, so the loop is shut off before
    // the recorder goes in.
    draw = () => {};
    frame = () => {};
    const installRecorder = ${installRecorder.toString()};
    // The study animates; the export has to be the same every run, so time
    // stops and everything that moves sits at rest.
    paused = true;
    T = 0;
    const NEUTRAL = { fire: 0, recoil: 0, charge: 0, beam: 0, aimT: 0, orbit: 0, flip: 1, shot: 0, cd: 1, target: null, aim: null };
    /** One weapon top at the origin, at the scale the study puts it on a roof. */
    function drawTop(type) {
      const w = W_[type];
      const scale = (w.special ? WSP : WS) * (w.sc || 1);
      ctx.save();
      ctx.scale(scale, scale);
      w.draw(NEUTRAL);
      ctx.restore();
    }
    window.__export = (call) => {
      const recorder = installRecorder(ctx);
      try {
        eval(call);
      } finally {
        var shapes = recorder.take();
      }
      return shapes;
    };
  `,
});

const collected = {};
for (const figure of FIGURES) {
  const shapes = await page.evaluate((call) => window.__export(call), figure.call);
  if (shapes.length === 0) throw new Error(`${figure.id}: nothing was drawn`);
  (collected[figure.sheet] ??= []).push({ id: figure.id, shapes });
  console.log(`  ${figure.id}: ${shapes.length} shapes`);
}

// The muzzles the study names for each weapon (`tip`), in the same scaled space
// as the exported symbol. They belong in src/render/sprites/manifest.js as the
// Wirkungsanker, so they are printed here for transfer rather than guessed.
const tips = await page.evaluate(() =>
  Object.fromEntries(
    Object.entries(W_).map(([type, w]) => {
      const scale = (w.special ? WSP : WS) * (w.sc || 1);
      return [type, w.tip ? [Math.round(w.tip[0] * scale * 100) / 100, Math.round(w.tip[1] * scale * 100) / 100] : null];
    }),
  ),
);
console.log('Wirkungsanker (Studie, skaliert):', JSON.stringify(tips));

/**
 * Writes one concept sheet: a shared <style>, the clip paths and one <g> per
 * figure in <defs>, and a <use> each so the sheet can be looked at.
 */
async function writeSheet(path, figures, source, columns = figures.length) {
  // Clip regions become their own defs, one per distinct outline and named
  // after the figure that uses it, so two sheets never collide on an id.
  const clips = new Map();
  const clipDefs = [];
  for (const f of figures) {
    for (const shape of f.shapes) {
      if (!shape.clip || clips.has(shape.clip)) continue;
      const id = `clip-${f.id}-${clips.size}`;
      clips.set(shape.clip, id);
      clipDefs.push(`<clipPath id="${id}"><path d="${shape.clip}"/></clipPath>`);
    }
  }
  const defs = [
    ...clipDefs,
    ...figures.map((f) => `<g id="${f.id}">${f.shapes.map((s) => pathOf(s, clips)).join('')}</g>`),
  ].join('\n    ');
  // The sheet shows its symbols side by side, which is only for looking at it
  // in a browser; the importer measures each symbol on its own.
  const rows = Math.ceil(figures.length / columns);
  const uses = figures.map((f, i) => `<use href="#${f.id}" x="${(i % columns) * 140}" y="${Math.floor(i / columns) * 160}"/>`).join('\n  ');
  const body = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-90} ${-160} ${columns * 140 + 40} ${rows * 160 + 100}">
  <title>Erzeugt aus ${source} - nicht von Hand ändern, npm run studies</title>
  <style>${STYLE}</style>
  <defs>
    ${defs}
  </defs>
  ${uses}
</svg>
`;
  await writeFile(join(ROOT, path), body);
  console.log(`${path}: ${figures.length} symbols`);
}

for (const [sheet, path] of Object.entries(SHEETS)) {
  await writeSheet(path, collected[sheet], 'reference/studien/stellungen-simulation.html');
}

// ---------- The standard bunker ----------
// The bunker of reference/studien/stellungen-rework.html (M9, D1): one symbol per
// doctrine and rank, because the doctrine colour is part of the drawing (rim,
// chevrons, plates, roof platform, lamp) and a figure has no colour parameter.
// The weapons stay as they were until D2.
const bunkerPage = await browser.newPage();
bunkerPage.on('pageerror', (e) => {
  throw e;
});
await bunkerPage.goto(`${server.url}tests/ringcheck.html`);
await bunkerPage.addScriptTag({ content: `window.__installRecorder = ${installRecorder.toString()};` });
const bunkerFigures = [];
for (const doctrine of DOCTRINE_IDS) {
  for (let rank = 1; rank <= 5; rank++) {
    const shapes = await bunkerPage.evaluate(
      async ([colour, r]) => {
        const { drawBunker } = await import('/reference/studien/stellungen-rework-modell.js');
        const ctx = document.createElement('canvas').getContext('2d');
        const recorder = window.__installRecorder(ctx);
        drawBunker(ctx, r, colour, { flat: true });
        return recorder.take();
      },
      [DOCTRINE_COLORS[doctrine], rank],
    );
    if (shapes.length === 0) throw new Error(`bunker ${doctrine} ${rank}: nothing was drawn`);
    bunkerFigures.push({ id: `bunker-${doctrine}-${rank}`, shapes });
  }
}
console.log(`  bunker: ${bunkerFigures.length} symbols, ${bunkerFigures.reduce((n, f) => n + f.shapes.length, 0)} shapes`);
await writeSheet('reference/konzept/stellungen/bunker-raenge.svg', bunkerFigures, 'reference/studien/stellungen-rework-modell.js (drawBunker)', 5);

// ---------- The special base ----------
// The base of reference/studien/spezialstellungen-rework.html (M9, D4): one symbol per recipe, because
// the guide colour (rim, plates, lamp) and the three lamps in the colours of the ingredients are part of
// the drawing. The six weapons are turned models (src/render/specials.js), not exported.
const specialFigures = [];
for (const recipe of RECIPES) {
  const shapes = await bunkerPage.evaluate(
    async ([lead, pips]) => {
      const { drawSpecialBase } = await import('/reference/studien/spezialstellungen-rework-modell.js');
      const ctx = document.createElement('canvas').getContext('2d');
      const recorder = window.__installRecorder(ctx);
      drawSpecialBase(ctx, lead, pips, { flat: true });
      return recorder.take();
    },
    [DOCTRINE_COLORS[recipe.ingredients[0]], recipe.ingredients.map((d) => DOCTRINE_COLORS[d])],
  );
  if (shapes.length === 0) throw new Error(`special base ${recipe.id}: nothing was drawn`);
  specialFigures.push({ id: `specialbase-${recipe.id}`, shapes });
}
console.log(`  special base: ${specialFigures.length} symbols, ${specialFigures.reduce((n, f) => n + f.shapes.length, 0)} shapes`);
await writeSheet('reference/konzept/stellungen/spezialbasis.svg', specialFigures, 'reference/studien/spezialstellungen-rework-modell.js (drawSpecialBase)', 6);

// ---------- The supply capsule ----------
// Draft B of reference/studien/kapsel-studie.html (docs/ART.md, "Nachschubkapsel").
// The study exposes its parts through window.__kapselExport; each is drawn once
// on a recording context. The doctrine colour is not part of them (it is code in
// the game), and neither is anything that moves.
const capsule = await browser.newPage();
capsule.on('pageerror', (e) => {
  throw e;
});
await capsule.goto(`${server.url}reference/studien/kapsel-studie.html`);
await capsule.waitForSelector('body[data-ready]');
await capsule.addScriptTag({ content: `window.__installRecorder = ${installRecorder.toString()};` });
const capsuleFigures = [];
const capsulePart = async (id, part, index) => {
  const shapes = await capsule.evaluate(
    ([name, i]) => {
      const ctx = document.createElement('canvas').getContext('2d');
      const recorder = window.__installRecorder(ctx);
      window.__kapselExport.draw(ctx, name, i);
      return recorder.take();
    },
    [part, index],
  );
  if (shapes.length === 0) throw new Error(`${id}: nothing was drawn`);
  capsuleFigures.push({ id, shapes });
  console.log(`  ${id}: ${shapes.length} shapes`);
};
await capsulePart('pod-shell', 'shell');
await capsulePart('pod-base', 'base');
await capsulePart('pod-core', 'core');
for (let i = 0; i < 4; i++) await capsulePart(`pod-petal-${i}`, 'petal', i);
await writeSheet('reference/konzept/kapsel/kapsel.svg', capsuleFigures, 'reference/studien/kapsel-studie.html (Entwurf B)');
// Hinges, nozzles and lamps for src/render/sprites/manifest.js and pods.js, in the same units.
console.log('Anker der Kapsel (Studie, mal S):', JSON.stringify(await capsule.evaluate(() => window.__kapselExport.geometry())));

await browser.close();
await server.close();
