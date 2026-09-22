// Renders the placeholder app icons with Canvas 2D in headless Chromium.
// Run once with `npm run icons`; the PNGs are committed.

import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../../assets/icons/', import.meta.url));

const ICONS = [
  { file: 'icon-192.png', size: 192, safe: 1 },
  { file: 'icon-512.png', size: 512, safe: 1 },
  // Maskable icons get cropped to a circle or squircle; keep content in the inner 80 %.
  { file: 'icon-maskable-192.png', size: 192, safe: 0.8 },
  { file: 'icon-maskable-512.png', size: 512, safe: 0.8 },
  { file: 'apple-touch-icon.png', size: 180, safe: 0.9 },
];

// Drawn in a 100 x 100 unit space. Palette and ink outlines from the style test.
function drawIcon({ size, safe }) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');

  const bg = c.createRadialGradient(size / 2, size * 0.42, size * 0.05, size / 2, size / 2, size * 0.75);
  bg.addColorStop(0, '#4a2a1c');
  bg.addColorStop(1, '#110c0a');
  c.fillStyle = bg;
  c.fillRect(0, 0, size, size);

  const s = (size * safe) / 100;
  c.translate(size / 2 - 50 * s, size / 2 - 50 * s);
  c.scale(s, s);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const ink = '#1a1410';

  // Braking thrust below the pod.
  const flame = c.createLinearGradient(0, 62, 0, 96);
  flame.addColorStop(0, 'rgba(255,250,210,1)');
  flame.addColorStop(0.4, 'rgba(255,170,60,0.95)');
  flame.addColorStop(1, 'rgba(255,90,30,0)');
  c.fillStyle = flame;
  c.beginPath();
  c.moveTo(38, 64);
  c.lineTo(50, 97);
  c.lineTo(62, 64);
  c.closePath();
  c.fill();

  // Pod body with three shading steps.
  const body = [[34, 22], [66, 22], [72, 60], [60, 70], [40, 70], [28, 60]];
  const poly = (pts, fill) => {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) c.lineTo(x, y);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  };
  poly(body, '#a4502a');
  poly([[50, 22], [66, 22], [72, 60], [60, 70], [50, 70]], '#6e3219');
  poly([[34, 22], [42, 22], [38, 60], [40, 70], [34, 66], [28, 60]], '#c9713f');
  c.lineWidth = 4;
  c.strokeStyle = ink;
  poly(body, 'rgba(0,0,0,0)');
  c.stroke();

  // Nose cone.
  poly([[34, 22], [50, 8], [66, 22]], '#b3a58d');
  c.stroke();

  // Hazard band and skull-white rank chevron.
  c.fillStyle = '#e8dcc0';
  c.beginPath();
  c.moveTo(40, 38);
  c.lineTo(50, 46);
  c.lineTo(60, 38);
  c.lineTo(60, 45);
  c.lineTo(50, 53);
  c.lineTo(40, 45);
  c.closePath();
  c.fill();
  c.lineWidth = 2.5;
  c.stroke();

  return cv.toDataURL('image/png');
}

const browser = await chromium.launch();
const page = await browser.newPage();
for (const icon of ICONS) {
  const dataUrl = await page.evaluate(drawIcon, icon);
  await writeFile(OUT + icon.file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`wrote assets/icons/${icon.file}`);
}
await browser.close();
