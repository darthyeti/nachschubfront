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
// Usage: npm run studies   (then npm run sprites)

import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, startServer } from './server.mjs';
import { installRecorder } from './canvas-to-svg.mjs';

/** The shared style block, taken verbatim from the hand-drawn sheets. */
const STYLE = await (async () => {
  const text = await readFile(join(ROOT, 'reference/konzept/stellungen/sockel.svg'), 'utf8');
  const match = text.match(/<style>([\s\S]*?)<\/style>/);
  if (!match) throw new Error('no <style> in sockel.svg to share');
  return match[1];
})();

/**
 * What to export. `call` runs inside the page with the recorder installed and
 * draws one figure at the origin; whatever it paints becomes one symbol.
 */
const FIGURES = [
  // The bunker, one symbol per rank: the ranks build on each other, so each one
  // is the whole emplacement rather than an overlay to stack.
  ...[1, 2, 3, 4, 5].map((rank) => ({
    id: `bunker-${rank}`,
    sheet: 'bunker',
    call: `drawBunker(0, 0, ${rank})`,
  })),
  { id: 'specialbase', sheet: 'bunker', call: 'drawSpecial(0, 0)' },

  // The six standard tops, drawn in their own local space and scaled the way
  // the study places them on the roof, so the sprite is ready to sit there.
  ...[
    ['auto', 'top-auto'],
    ['fire', 'top-fire'],
    ['mortar', 'top-mortar'],
    ['tesla', 'top-tesla'],
    ['laser', 'top-laser'],
    ['psi', 'top-psi'],
  ].map(([type, id]) => ({ id, sheet: 'tops', call: `drawTop('${type}')` })),

  // And the six special weapons on the higher base.
  ...[
    ['purge', 'stop-purgeShrine'],
    ['storm', 'stop-stormBattery'],
    ['kessel', 'stop-emberCauldron'],
    ['siege', 'stop-siegeMortar'],
    ['storm_tower', 'stop-thunderTower'],
    ['obelisk', 'stop-soulfireObelisk'],
  ].map(([type, id]) => ({ id, sheet: 'tops', call: `drawTop('${type}')` })),
];

/** Sheets to write, and which symbols each one shows. */
const SHEETS = {
  bunker: 'reference/konzept/stellungen/bunker.svg',
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

for (const [sheet, path] of Object.entries(SHEETS)) {
  const figures = collected[sheet];
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
  const uses = figures.map((f, i) => `<use href="#${f.id}" x="${i * 140}" y="0"/>`).join('\n  ');
  const body = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-90} ${-160} ${figures.length * 140 + 40} 260">
  <title>Erzeugt aus reference/studien/stellungen-simulation.html - nicht von Hand ändern, npm run studies</title>
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

await browser.close();
await server.close();
