// Checks the study "Handy und Bedienung" in Chromium and writes its stills (A-23, Issue #36).
// Fails on console errors, failed requests, or a hit area under 44 px in the draft.
// Writes neu-*.png into reference/konzept/handy. Only neu-vergleich-hoch, neu-vergleich-quer
// and neu-ikonen are kept in the repository; the others are for looking at locally.
//
// Usage: node tests/tools/handy-studie.mjs [--no-shots]

import * as playwright from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, startServer, watchProblems, launchBrowser } from './server.mjs';

const OUT = join(ROOT, 'reference', 'konzept', 'handy');
const SHOTS = !process.argv.includes('--no-shots');
const SIZES = ['390x844', '360x780', '430x932'];
const SCREENS = ['titel', 'planung', 'kapselwahl', 'welle', 'stellung', 'pause', 'hilfe'];

await mkdir(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser(playwright, 'chromium');
const problems = [];
const rows = [];

const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, deviceScaleFactor: 2 });
const page = await context.newPage();
watchProblems(page, 'studie', problems);
await page.goto(`${server.url}reference/studien/handy-bedienung.html?scale=1`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => window.__studie);

const phone = page.locator('#phone');
const settle = async () => {
  await page.waitForFunction(() => document.getElementById('heuteImg').complete);
  await page.waitForTimeout(120);
};
const view = (size, orient) => page.evaluate(([s, o]) => window.__studie.setView(s, o), [size, orient]);
const go = (screen) => page.evaluate((s) => window.__studie.setScreen(s), screen);
const read = () => page.evaluate(() => window.__studie.measure());
const overflow = () =>
  page.evaluate(() => {
    // Anything of the draft that sticks out of the frame (except sheets sliding in and the bare board).
    const p = document.getElementById('phone').getBoundingClientRect();
    return [...document.querySelectorAll('#phone .chip, #phone .menu-btn, #phone .tool, #phone .tempo, #phone .salvo, #phone .card, #phone .btn')]
      .filter((e) => !e.closest('[hidden]'))
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.left < p.left - 0.5 || r.right > p.right + 0.5 || r.top < p.top - 0.5 || r.bottom > p.bottom + 0.5);
      })
      .map((e) => (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 30));
  });

for (const size of SIZES) {
  for (const orient of ['hoch', 'quer']) {
    await view(size, orient);
    for (const screen of SCREENS) {
      await go(screen);
      await settle();
      const m = await read();
      const out = await overflow();
      rows.push({ size, orient, screen, free: m.free, small: m.small, out });
      if (m.small > 0) problems.push(`${size} ${orient} ${screen}: ${m.small} hit area(s) under 44 px`);
      if (out.length) problems.push(`${size} ${orient} ${screen}: outside the frame: ${out.join(', ')}`);
      if (SHOTS) await phone.screenshot({ path: join(OUT, `neu-${size}-${orient}-${screen}.png`) });
    }
  }
}

// Collapsed bars and the thumb zone, at the middle size.
await view('390x844', 'hoch');
await go('planung');
await page.evaluate(() => { window.__studie.state.topClosed = true; window.__studie.state.dockClosed = true; });
await page.evaluate(() => window.__studie.setScreen('planung'));
await settle();
rows.push({ size: '390x844', orient: 'hoch', screen: 'planung-eingeklappt', ...(await read()) });
if (SHOTS) await phone.screenshot({ path: join(OUT, 'neu-390x844-hoch-eingeklappt.png') });
await view('390x844', 'quer');
await settle();
rows.push({ size: '390x844', orient: 'quer', screen: 'planung-eingeklappt', ...(await read()) });
if (SHOTS) await phone.screenshot({ path: join(OUT, 'neu-390x844-quer-eingeklappt.png') });
await page.evaluate(() => { window.__studie.state.topClosed = false; window.__studie.state.dockClosed = false; window.__studie.state.thumb = true; window.__studie.state.safe = true; });
await view('390x844', 'hoch');
await settle();
if (SHOTS) await phone.screenshot({ path: join(OUT, 'neu-390x844-hoch-daumen-aussparung.png') });
await view('390x844', 'quer');
await settle();
if (SHOTS) await phone.screenshot({ path: join(OUT, 'neu-390x844-quer-daumen-aussparung.png') });
await page.evaluate(() => { window.__studie.state.thumb = false; window.__studie.state.safe = false; });

// The tutorial: walk through all steps by doing what each one asks, and shoot a few.
for (const orient of ['hoch', 'quer']) {
  await view('390x844', orient);
  await page.evaluate(() => document.getElementById('tutStart').click());
  await settle();
  const total = await page.evaluate(() => 13);
  for (let i = 0; i < total; i++) {
    const step = await page.evaluate(() => window.__studie.state.tut);
    if (step !== i) problems.push(`tutorial ${orient}: expected step ${i}, found ${step}`);
    await settle();
    if (SHOTS && [0, 2, 4, 6, 10, 12].includes(i)) await phone.screenshot({ path: join(OUT, `neu-tutorial-${orient}-${String(i + 1).padStart(2, '0')}.png`) });
    // Do what the step asks, through the real controls of the frame.
    const target = await page.evaluate((n) => {
      const need = ['next', 'next', 'spot', 'salvo', 'card', 'keep', 'tempo', 'next', 'spot', 'salvo', 'card', 'merge', 'next'][n];
      return need;
    }, i);
    if (target === 'next') await page.locator('.coach .btn.gold').click();
    else if (target === 'spot') await page.locator('.spot.glow').click();
    else if (target === 'salvo') await page.locator('.salvo').click();
    else if (target === 'card') await page.locator('.card').nth(i === 4 ? 0 : 1).click();
    else if (target === 'keep') await page.locator('[data-act="keep"]').click();
    else if (target === 'tempo') await page.locator('.tempo').click();
    else if (target === 'merge') await page.locator('[data-act="merge"]').click();
    await page.waitForTimeout(160);
  }
  const done = await page.evaluate(() => window.__studie.state.tut);
  if (done !== null) problems.push(`tutorial ${orient}: still at step ${done} after the last one`);
}

// A tap outside the highlighted element must not get through the dimmed layer.
await view('390x844', 'hoch');
await page.evaluate(() => document.getElementById('tutStart').click());
await page.evaluate(() => window.__studie.tutGoto(3));
await settle();
const blocked = await page.evaluate(() => {
  const before = window.__studie.state.screen;
  const b = document.querySelector('.tool');
  const r = b.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { before, hit: hit?.className ?? '', blocked: hit?.classList.contains('block') ?? false };
});
if (!blocked.blocked) problems.push(`tutorial: a tool button is reachable while another element is highlighted (${blocked.hit})`);
await page.evaluate(() => document.getElementById('tutStop').click());

// The full page: study, icons, tutorial, inventory.
if (SHOTS) {
  await view('390x844', 'hoch');
  await go('kapselwahl');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('#stage').screenshot({ path: join(OUT, 'neu-vergleich-hoch.png') });
  await view('390x844', 'quer');
  await go('kapselwahl');
  await page.locator('#stage').screenshot({ path: join(OUT, 'neu-vergleich-quer.png') });
  await page.addStyleTag({ content: '.bar { position: static !important; }' });
  await page.locator('#iconRows').locator('xpath=ancestor::table').screenshot({ path: join(OUT, 'neu-ikonen.png') });
}

console.log(JSON.stringify(rows.map((r) => `${r.size} ${r.orient} ${r.screen}: frei ${r.free} %`), null, 1));
await browser.close();
server.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Study ok: no console errors, no hit area under 44 px.');
