// Ink-outlined drawing helpers from the style test. All take the context first.

import { iso } from './iso.js';
import { C } from './palette.js';

export function poly(ctx, points, fill, stroke = C.ink, lineWidth = 2.5) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

/** Iso box at grid position (x, y) with footprint w x d cells, height h and base z (pixels). */
export function box(ctx, x, y, w, d, h, z, [top, left, right], lineWidth = 2.5) {
  const A = iso(x, y, z + h);
  const B = iso(x + w, y, z + h);
  const Cc = iso(x + w, y + d, z + h);
  const D = iso(x, y + d, z + h);
  const b1 = iso(x + w, y, z);
  const b2 = iso(x + w, y + d, z);
  const b3 = iso(x, y + d, z);
  poly(ctx, [b3, b2, Cc, D], left, C.ink, lineWidth);
  poly(ctx, [b2, b1, B, Cc], right, C.ink, lineWidth);
  if (top) poly(ctx, [A, B, Cc, D], top, C.ink, lineWidth);
}

export function ell(ctx, x, y, rx, ry, fill, stroke, lineWidth = 2) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function shadow(ctx, x, y, rx, ry, alpha = 0.3) {
  ell(ctx, x, y, rx, ry, `rgba(10,6,4,${alpha})`);
}

/** Diamond outline of one grid cell. */
export function cellPath(ctx, x, y, inset = 0) {
  const a = iso(x + inset, y + inset);
  const b = iso(x + 1 - inset, y + inset);
  const c = iso(x + 1 - inset, y + 1 - inset);
  const d = iso(x + inset, y + 1 - inset);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.lineTo(d[0], d[1]);
  ctx.closePath();
}

/** Comic text with ink outline (Bangers). */
export function comicText(ctx, text, x, y, size, fill) {
  ctx.font = `${size}px Bangers, Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.2);
  ctx.strokeStyle = C.ink;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
