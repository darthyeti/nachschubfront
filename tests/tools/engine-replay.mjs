// Plays protocols back inside a browser engine instead of node (M6).
//
//   npm run replay:engine -- <protokoll.json> ... [--browser webkit]
//
// A match recorded on an iPad ran in WebKit. JavaScript leaves the last bit of
// Math.sin, Math.hypot and their kin to the engine, so the same match can come
// out a hit different in node or Chromium — it did, until the simulation kept
// to arithmetic that is exact everywhere (src/core/exact.js). This checks that
// a protocol replays in a given engine, field by field.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import playwright from 'playwright';
import { startServer, launchBrowser, browserName } from './server.mjs';
import { FIELDS } from './reference.mjs';

const files = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--browser');
if (files.length === 0) {
  console.error('Usage: npm run replay:engine -- <protokoll.json> ... [--browser webkit]');
  process.exit(1);
}

const server = await startServer();
const browser = await launchBrowser(playwright);
const page = await browser.newPage();
// Any page of the origin will do; the style test starts no game of its own.
await page.goto(`${server.url}reference/stiltest.html`);
let failed = 0;
for (const file of files) {
  const protocol = JSON.parse(readFileSync(resolve(file), 'utf8'));
  const diff = await page.evaluate(
    async ({ protocol, fields }) => {
      const { parseProtocol } = await import('/src/storage/protocol.js');
      const { replayMatch, compareWaves } = await import('/src/sim/replay.js');
      const { match } = parseProtocol(protocol);
      return compareWaves(match.waves, replayMatch(match).waves, fields);
    },
    { protocol, fields: FIELDS },
  );
  if (diff.length > 0) failed += 1;
  const name = file.split('/').pop();
  console.log(`${browserName()}: ${name} — ${diff.length === 0 ? 'gleich' : `${diff.length} Unterschiede, zuerst Welle ${diff[0].wave} ${diff[0].field}: ${diff[0].was} → ${diff[0].now}`}`);
}
await browser.close();
server.close();
process.exit(failed > 0 ? 1 : 0);
