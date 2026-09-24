// Imports the concept SVGs from reference/konzept/ into ES modules under src/render/sprites/.
// Each concept file carries the full symbol library in <defs> and shows one symbol via <use>;
// the libraries are merged (identical ids must have identical markup), and every symbol's
// bounding box is measured in a real browser so the runtime can rasterize tight sprites.
//
// Usage: npm run sprites

import { chromium } from 'playwright';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './server.mjs';

const SOURCES = [
  { dirs: ['reference/konzept/gegner'], out: 'src/render/sprites/enemies.js', name: 'ENEMY_SPRITES' },
  {
    // The recipe vehicles share the emplacement library (same socket, same
    // hazard pattern), so they go into the same module.
    dirs: ['reference/konzept/stellungen', 'reference/konzept/spezialstellungen'],
    out: 'src/render/sprites/towers.js',
    name: 'TOWER_SPRITES',
    // The rank badges ride along in the vehicle sheets but belong to the UI,
    // and the two bare chassis are reference for the four recipes still to come.
    drop: ['badge-0', 'badge-1', 'badge-2', 'badge-3', 'badge-4', 'v-tank2', 'v-artillery2'],
  },
  {
    dirs: ['reference/konzept/kapsel'],
    out: 'src/render/sprites/pods.js',
    name: 'POD_SPRITES',
    // pod-a, pod-c, open-a and open-c are the designs the sheets discarded
    // (docs/ART.md); pod-b and pod-open are only wrappers around the parts the
    // game draws.
    drop: ['pod-a', 'pod-c', 'open-a', 'open-c', 'pod-b', 'pod-open'],
  },
  {
    // Rank badges for the selection panel (docs/ART.md). They are drawn in the
    // DOM at a fixed size, not on the map, so they get a module of their own.
    dirs: ['reference/konzept/ui'],
    out: 'src/render/sprites/badges.js',
    name: 'BADGE_SPRITES',
    drop: ['v-tank2', 'v-artillery2', 'v-sturmbatterie', 'v-obelisk', 'haz'],
  },
];

/** Extra room around getBBox() (which ignores stroke width), in SVG units. */
const PAD = 5;

// Runs in the browser: parses the files, merges <defs>, measures each symbol.
function analyse({ files, drop }) {
  const parser = new DOMParser();
  const style = new Set();
  const defs = new Map(); // id -> outerHTML
  const shown = {}; // file -> ids used at top level
  for (const { name, text } of files) {
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error(`${name}: ${err.textContent}`);
    const svg = doc.documentElement;
    for (const s of svg.querySelectorAll(':scope > style')) style.add(s.textContent);
    for (const child of svg.querySelectorAll(':scope > defs > *')) {
      const id = child.getAttribute('id');
      if (!id) continue;
      const html = child.outerHTML;
      if (defs.has(id) && defs.get(id) !== html) throw new Error(`${name}: symbol #${id} differs from another file`);
      defs.set(id, html);
    }
    shown[name] = [...svg.querySelectorAll(':scope > use')].map((u) => u.getAttribute('href').slice(1));
  }
  if (style.size !== 1) throw new Error(`expected one shared <style>, found ${style.size}`);

  // Unused helpers from the concept sheets (silhouette filter) are dropped, and
  // with them whatever the source declares it does not need.
  defs.delete('sil');
  for (const id of drop) defs.delete(id);
  const defsText = [...defs.values()].join('');
  const [styleText] = style;

  // Measure every group symbol.
  const NS = 'http://www.w3.org/2000/svg';
  const host = document.createElementNS(NS, 'svg');
  host.setAttribute('width', '2000');
  host.setAttribute('height', '2000');
  host.innerHTML = `<style>${styleText}</style><defs>${defsText}</defs>`;
  document.body.append(host);
  const boxes = {};
  for (const [id, html] of defs) {
    if (!html.startsWith('<g')) continue;
    const use = document.createElementNS(NS, 'use');
    use.setAttribute('href', `#${id}`);
    host.append(use);
    const b = use.getBBox();
    boxes[id] = [b.x, b.y, b.width, b.height];
    use.remove();
  }
  return { style: styleText, defs: defsText, boxes, shown };
}

const round = (v) => Math.round(v * 10) / 10;

const browser = await chromium.launch();
const page = await browser.newPage();
try {
  for (const source of SOURCES) {
    // A file is named by its folder when a source reads more than one, because
    // the same figure can have a sheet in two of them.
    const listed = await Promise.all(
      source.dirs.map(async (dir) => {
        const names = (await readdir(join(ROOT, dir))).filter((f) => f.endsWith('.svg')).sort();
        return names.map((file) => ({ dir, file, name: source.dirs.length > 1 ? `${dir.split('/').pop()}/${file}` : file }));
      }),
    );
    const entries = listed.flat();
    const names = entries.map((e) => e.name);
    const files = await Promise.all(
      entries.map(async ({ dir, file, name }) => ({ name, text: await readFile(join(ROOT, dir, file), 'utf8') })),
    );
    const { style, defs, boxes, shown } = await page.evaluate(analyse, {
      files,
      drop: source.drop ?? [],
    });

    const symbols = {};
    for (const [id, [x, y, w, h]] of Object.entries(boxes)) {
      symbols[id] = { bbox: [round(x - PAD), round(y - PAD), round(w + PAD * 2), round(h + PAD * 2)] };
    }
    const byFile = Object.fromEntries(names.map((n) => [n.replace(/\.svg$/, ''), shown[n]]));
    const where = source.dirs.join(', ');

    const body =
      `// Generated by tests/tools/import-sprites.mjs from ${where}. Do not edit by hand;\n` +
      `// change the SVGs and run \`npm run sprites\` instead.\n\n` +
      `export const ${source.name} = {\n` +
      `  /** Shared stroke classes. */\n` +
      `  style: ${JSON.stringify(style)},\n` +
      `  /** Symbol library (groups and patterns), referenced via <use href="#id">. */\n` +
      `  defs: ${JSON.stringify(defs)},\n` +
      `  /** Measured bounds per symbol in SVG units: [x, y, width, height], stroke padding included. */\n` +
      `  symbols: ${JSON.stringify(symbols, null, 2).replace(/\n/g, '\n  ')},\n` +
      `  /** Which symbols each concept file shows, by file name. */\n` +
      `  files: ${JSON.stringify(byFile, null, 2).replace(/\n/g, '\n  ')},\n` +
      `};\n`;
    await writeFile(join(ROOT, source.out), body);
    console.log(`${source.out}: ${Object.keys(symbols).length} symbols, ${(body.length / 1024).toFixed(1)} KB`);
    for (const [id, s] of Object.entries(symbols)) console.log(`  ${id.padEnd(10)} ${s.bbox.join(', ')}`);
  }
} finally {
  await browser.close();
}
