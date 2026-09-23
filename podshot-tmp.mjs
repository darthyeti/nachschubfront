import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:8126/?seed=BASTION&debug');
await p.waitForFunction(() => window.__nachschub, null, { timeout: 30000 });
await p.getByRole('button', { name: /Feldzug beginnen/ }).click();
await p.waitForTimeout(400);
// Mark a few zones near the rift so the pods land in view, then request the salvo.
await p.evaluate(() => {
  const g = window.__nachschub.state();
  window.__nachschub.debug.grant({ requisition: 500 });
});
await p.getByRole('button', { name: 'Salve anfordern' }).click();
const shots = [{ ms: 750, name: 'kapsel-fall' }, { ms: 430, name: 'kapsel-zu' },
               { ms: 330, name: 'kapsel-oeffnet' }, { ms: 500, name: 'kapsel-offen' }];
for (const s of shots) {
  await p.waitForTimeout(s.ms);
  await p.screenshot({ path: `tests/output/${s.name}.png` });
}
console.log('phase', (await p.evaluate(() => window.__nachschub.state().phase)));
console.log('errors:', errors.length ? errors : 'none');
await b.close();
