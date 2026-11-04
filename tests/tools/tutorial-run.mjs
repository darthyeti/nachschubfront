// Walks the tutorial (M10 E3) in a real browser, step by step, the way a finger would.
// Shared by tests/input.mjs (the tablet) and tests/phone.mjs (the phone sizes).
//
// The page is opened with ?debug&tutorial: the debug hooks give the state to check
// against, `&tutorial` lets the walk start (with ?debug it stays away otherwise, so
// the other browser checks are not held up by it). The debug panel is hidden, it
// would sit on the board and on the buttons.
//
// Per step it checks: the lit element is at least 44 x 44, the card is inside the
// picture and clear of the lit element, its buttons are at least 44 x 44, and a tap
// outside the lit element does nothing. Then it taps the lit element and follows
// the game on to the next step.

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { startMatch } from './server.mjs';

export const TOTAL = 14;

export const frames = (page, n = 3) =>
  page.evaluate(
    (count) =>
      new Promise((resolve) => {
        let left = count;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );

/** Opens the match on the tutorial map, with the tutorial on. */
export async function openTutorial(page, url, { seed = 'BASTION' } = {}) {
  await page.goto(`${url}?seed=${seed}&debug&tutorial`, { waitUntil: 'networkidle' });
  await startMatch(page);
  await page.addStyleTag({ content: '.debug-panel, .hud-debug { display: none !important }' });
  await frames(page, 5);
}

const game = (page) => page.evaluate(() => window.__nachschub.state());

/** What the tutorial layer shows right now, or null while it is hidden. */
export function readStep(page) {
  return page.evaluate(() => {
    const layer = document.querySelector('.tutorial');
    if (!layer || layer.hidden) return null;
    const box = (e) => {
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const m = /(\d+) von (\d+)/.exec(layer.querySelector('.tutorial-meta b')?.textContent ?? '');
    return {
      n: m ? Number(m[1]) : 0,
      total: m ? Number(m[2]) : 0,
      text: layer.querySelector('.tutorial-text')?.textContent ?? '',
      need: layer.querySelector('.tutorial-need')?.textContent ?? '',
      hole: box(layer.querySelector('.tutorial-hole')),
      card: box(layer.querySelector('.tutorial-card')),
      next: box(layer.querySelector('.tutorial-next')),
      skip: box(layer.querySelector('.tutorial-skip')),
      W: innerWidth,
      H: innerHeight,
    };
  });
}

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const centre = (b) => [b.x + (b.w ?? b.width) / 2, b.y + (b.h ?? b.height) / 2];

/** Which step numbers lie in which of the two rounds, for the sentences below. */
const STEP = { spot: 3, salvo: 4, card: 5, keep: 6, tempo: 7, req: 8, buy: 9, spot2: 10, salvo2: 11, pick: 12, act: 13, end: 14 };

/**
 * Plays the tutorial from step 1.
 *
 * @param {import('playwright').Page} page
 * @param {object} options
 * @param {(x: number, y: number) => Promise<void>} options.tap  a finger tap at page coordinates
 * @param {string} options.label  for the messages
 * @param {number} [options.stopAfter]  step number to leave off at: returns once this step is on screen
 * @param {{dir: string, prefix: string, steps: number[]}} [options.shots]  JPEG stills of these steps
 * @returns {Promise<number[]>}  the step numbers seen, in order
 */
export async function walkTutorial(page, { tap, label, stopAfter = Infinity, shots = null }) {
  const seen = [];
  let granted = false;
  const deadline = Date.now() + 360_000;
  const outsideTapDone = new Set();

  async function outsideTap(step, selector, proves) {
    if (outsideTapDone.has(step.n)) return;
    outsideTapDone.add(step.n);
    const target = await page.locator(selector).first().boundingBox();
    if (!target) return;
    const [x, y] = centre(target);
    // Not inside the lit element: the layer takes this tap.
    if (step.hole && x >= step.hole.x && x <= step.hole.x + step.hole.w && y >= step.hole.y && y <= step.hole.y + step.hole.h) return;
    await tap(x, y);
    await page.waitForTimeout(250);
    assert.equal((await readStep(page))?.n, step.n, `${label}: step ${step.n} stays after a tap beside the lit element`);
    await proves();
  }

  while (Date.now() < deadline) {
    const step = await readStep(page);
    if (!step) {
      const s = await game(page);
      // Wave 1 has just begun and the tempo step is about to come up: give it its frame.
      if (s.phase === 'wave' && !seen.includes(STEP.tempo)) {
        await page.waitForTimeout(120);
        continue;
      }
      if (s.phase === 'wave') await page.keyboard.press('3');
      // The first wave may leave too little requisition for supply; the buy step is part of this walk.
      if (s.phase === 'planning' && s.wave === 1 && !granted) {
        granted = true;
        await page.evaluate(() => window.__nachschub.debug.grant({ requisition: 100 }));
      }
      if (s.phase === 'defeat') assert.fail(`${label}: the match was lost on the way`);
      if (seen.at(-1) === TOTAL) return seen;
      await page.waitForTimeout(250);
      continue;
    }

    if (seen.at(-1) !== step.n) {
      seen.push(step.n);
      assert.equal(step.total, TOTAL, `${label}: ${TOTAL} steps`);
      assert.equal(step.n, seen.length, `${label}: the steps come in order, saw ${seen}`);
      // The card stays in the picture and does not sit on what it points at.
      const { card, hole, W, H } = step;
      assert.ok(card.x >= -0.5 && card.y >= -0.5 && card.x + card.w <= W + 0.5 && card.y + card.h <= H + 0.5, `${label} step ${step.n}: card inside the picture ${JSON.stringify(card)}`);
      if (hole) assert.ok(!overlaps(card, hole), `${label} step ${step.n}: the card covers the lit element`);
      for (const [name, b] of [['skip', step.skip], ['next', step.next]]) {
        if (b) assert.ok(b.w >= 43.5 && b.h >= 43.5, `${label} step ${step.n}: ${name} is ${Math.round(b.w)} x ${Math.round(b.h)}`);
      }
      if (step.need) {
        assert.ok(hole, `${label} step ${step.n}: a step that waits for a tap lights something`);
        assert.ok(hole.w >= 43.5 && hole.h >= 43.5, `${label} step ${step.n}: lit element ${Math.round(hole.w)} x ${Math.round(hole.h)}`);
      }
      if (shots?.steps.includes(step.n)) {
        await frames(page, 3);
        await page.screenshot({ path: join(shots.dir, `${shots.prefix}-schritt${String(step.n).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 82 });
      }
      if (step.n >= stopAfter) return seen;
    }

    if (!step.need) {
      // A step with a button: Weiter, and on the last one the closing button.
      assert.ok(step.next, `${label} step ${step.n}: has its own button`);
      await tap(...centre(step.next));
      await page.waitForTimeout(300);
      if (step.n === TOTAL) {
        await frames(page, 3);
        assert.equal(await readStep(page), null, `${label}: the walk is over after the last button`);
        return seen;
      }
      continue;
    }

    // Beside the lit element nothing happens.
    if (step.n === STEP.spot) {
      await outsideTap(step, '.plate-button[aria-label="Menü"]', async () => {
        assert.equal(await page.locator('.menu[data-menu="pause"]').isHidden(), true, `${label}: the menu did not open`);
        assert.equal((await game(page)).zones.length, 0, `${label}: no field was marked`);
      });
    } else if (step.n === STEP.salvo) {
      await outsideTap(step, '.rune-group .rune', async () => {
        const s = await game(page);
        assert.equal(s.supplyLevel, 1, `${label}: supply was not bought`);
        assert.equal(s.phase, 'planning');
      });
    } else if (step.n === STEP.card) {
      await outsideTap(step, '.selection-recipes', async () => {
        assert.equal(await page.locator('.codex').isHidden(), true, `${label}: the recipes did not open`);
      });
    }

    const before = await game(page);
    const [x, y] = centre(step.hole);
    await tap(x, y);
    await page.waitForTimeout(350);

    if (step.n === STEP.spot || step.n === STEP.spot2) {
      assert.equal((await game(page)).zones.length, 1, `${label} step ${step.n}: the lit field is marked`);
    } else if (step.n === STEP.buy) {
      assert.equal((await game(page)).supplyLevel, before.supplyLevel + 1, `${label}: supply was bought`);
    } else if (step.n === STEP.keep || step.n === STEP.act) {
      await page.waitForFunction(() => window.__nachschub.state().phase === 'wave', null, { timeout: 10000 });
      assert.equal((await game(page)).towers.length, step.n === STEP.keep ? 1 : 2, `${label}: the emplacement stands`);
    } else if (step.n === STEP.tempo) {
      assert.ok((await game(page)).speed >= 2, `${label}: the wave runs faster`);
    }
    if (step.n === STEP.salvo || step.n === STEP.salvo2) {
      await page.waitForFunction(() => window.__nachschub.state().phase === 'selection', null, { timeout: 90000 });
    }
  }
  assert.fail(`${label}: the walk did not end in time, saw ${seen}`);
}

const storedPrefs = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('nachschubfront:prefs') ?? '{}'));

/**
 * After a walk to the end: the walk is remembered, "Einweisung wiederholen" in the settings
 * brings it back for the next match, and "Überspringen" ends it and is remembered too.
 *
 * @param {object} options
 * @param {(x: number, y: number) => Promise<void>} options.tap
 * @param {string} options.url  the game's address
 * @param {string} options.label
 */
export async function checkRepeatAndSkip(page, { tap, url, label }) {
  assert.equal((await storedPrefs(page)).tutorialSeen, true, `${label}: the finished walk is remembered`);

  const tapLocator = async (locator) => {
    // To the middle: scrolled to the top edge the button would sit under the sticky head of a phone sheet.
    await locator.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await page.waitForTimeout(100);
    await tap(...centre(await locator.boundingBox()));
  };
  await tapLocator(page.locator('.plate-button[aria-label="Menü"]'));
  await page.waitForSelector('.menu[data-menu="pause"]:not([hidden])');
  await tapLocator(page.locator('.menu[data-menu="pause"]').getByRole('button', { name: 'Einstellungen' }));
  await page.waitForSelector('.menu[data-menu="settings"]:not([hidden])');
  const again = page.getByRole('button', { name: 'Einweisung wiederholen' });
  assert.equal(await again.isEnabled(), true, `${label}: repeating is offered once it has been seen`);
  await tapLocator(again);
  assert.equal((await storedPrefs(page)).tutorialSeen, false, `${label}: repeating clears the marker through the storage layer`);
  assert.equal(await again.isEnabled(), false, `${label}: and the button waits until it has been seen again`);

  // The next match starts it from the first step.
  await page.reload({ waitUntil: 'networkidle' });
  await startMatch(page);
  await page.addStyleTag({ content: '.debug-panel, .hud-debug { display: none !important }' });
  await page.waitForFunction(() => document.querySelector('.tutorial:not([hidden]) .tutorial-meta'), null, { timeout: 5000 });
  assert.equal((await readStep(page)).n, 1, `${label}: the repeat starts at step 1`);

  // Skipping works from any step and ends it for good.
  const seen = await walkTutorial(page, { tap, label, stopAfter: 3 });
  assert.deepEqual(seen, [1, 2, 3]);
  const at = await readStep(page);
  await tap(...centre(at.skip));
  await frames(page, 3);
  assert.equal(await readStep(page), null, `${label}: skipping closes the walk`);
  assert.equal((await storedPrefs(page)).tutorialSeen, true, `${label}: skipping is remembered`);
  // The game under it is untouched and playable: the field of step 3 is still unmarked.
  assert.equal((await game(page)).zones.length, 0, `${label}: skipping marks nothing`);

  // Seen once, it stays away across a reload.
  await page.reload({ waitUntil: 'networkidle' });
  await startMatch(page);
  await page.waitForTimeout(1200);
  assert.equal(await readStep(page), null, `${label}: it does not come back after it was skipped`);
}
