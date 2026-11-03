// Light and shadow (docs/ART.md, "Gelände, Licht und Biome"): one light for everything.
// A body of height h pixels throws its shadow LIGHT * h / 32 cells towards +x/+y, which is
// down and to the right on the screen. The numbers are the starting points of
// reference/studien/optik-studie.js. Presentation only, nothing here touches the simulation.

import { iso } from './iso.js';

/** Cells of shadow per 32 px of height, along +x and +y. */
export const LIGHT = { x: 0.55, y: 0.25 };
/** Block shadows on the ground: colour of ink, no outline. */
export const SHADOW_COLOR = 'rgba(10,6,4,.38)';
/** Silhouette shadows of figures: opacity, and how much of its height a figure's shadow keeps on the ground. */
export const SPRITE_SHADOW_ALPHA = 0.35;
export const SPRITE_SHADOW_SQUASH = 0.45;
/** Dark gradient on the ground along the foot of a block: peak opacity and width in px. */
export const FOOT_SHADE_ALPHA = 0.3;
export const FOOT_SHADE_WIDTH = 4;
/** Bright line on the upper left edges of a top face: opacity and width in px. */
export const EDGE_LIGHT_ALPHA = 0.3;
export const EDGE_LIGHT_WIDTH = 1.5;
/** Cells per screen pixel along an edge of a block, to turn FOOT_SHADE_WIDTH into cells. */
export const PX_PER_CELL = 28.6;

/** Shear of the silhouette shadow: the screen shift of a point per pixel of height. */
export const SPRITE_SHADOW_SHEAR = LIGHT.x - LIGHT.y;

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Convex hull (monotone chain) of points in any plane. Counter-clockwise, no repeated end point. */
export function convexHull(points) {
  const p = points.map((q) => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** The four corners of a rectangle in cell coordinates. */
export function rectCorners(x0, y0, x1, y1) {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

/**
 * Outline of a shadow in cell coordinates: the hull of the footprint and of the same footprint
 * shifted by the light for a top `height` px above it. `lift` raises the whole body off the
 * ground (a flying model); the shadow of the base is then the footprint shifted by `lift` alone.
 * @param {number[][]} footprint  Corner points [x, y] in cells.
 */
export function shadowOutline(footprint, height, lift = 0) {
  const base = lift > 0 ? footprint.map(([x, y]) => [x + (LIGHT.x * lift) / 32, y + (LIGHT.y * lift) / 32]) : footprint;
  const k = (height + lift) / 32;
  const top = footprint.map(([x, y]) => [x + LIGHT.x * k, y + LIGHT.y * k]);
  return convexHull([...base, ...top]);
}

/** Adds the outline as a closed subpath, projected onto the ground. */
export function addShadowPath(ctx, footprint, height, lift = 0) {
  const hull = shadowOutline(footprint, height, lift);
  for (let i = 0; i < hull.length; i++) {
    const [px, py] = iso(hull[i][0], hull[i][1]);
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

/**
 * Fills the shadow of one body. Several bodies of one object go through `castShadows`
 * so that overlapping parts do not darken each other twice.
 * @param {number[][]} footprint  Corner points [x, y] in cells (a rectangle or a diamond).
 */
export function castShadow(ctx, footprint, height, color = SHADOW_COLOR) {
  castShadows(ctx, [{ footprint, height }], color);
}

/** One fill for many bodies: `[{footprint, height, lift?}]`. */
export function castShadows(ctx, bodies, color = SHADOW_COLOR) {
  if (!bodies.length) return;
  ctx.beginPath();
  for (const b of bodies) addShadowPath(ctx, b.footprint, b.height, b.lift ?? 0);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * The dark gradient on the ground along an edge of a block: from (ax, ay) to (bx, by) in cells,
 * pushed outwards by (ox, oy) (a unit step along +x or +y) at ground height `z`.
 */
export function footStrip(ctx, ax, ay, bx, by, ox, oy, z = 0) {
  const w = FOOT_SHADE_WIDTH / PX_PER_CELL;
  const p1 = iso(ax, ay, z);
  const p2 = iso(bx, by, z);
  const p3 = iso(bx + ox * w, by + oy * w, z);
  const p4 = iso(ax + ox * w, ay + oy * w, z);
  const m = iso((ax + bx) / 2, (ay + by) / 2, z);
  const e = iso((ax + bx) / 2 + ox * w, (ay + by) / 2 + oy * w, z);
  const grad = ctx.createLinearGradient(m[0], m[1], e[0], e[1]);
  grad.addColorStop(0, `rgba(10,6,4,${FOOT_SHADE_ALPHA})`);
  grad.addColorStop(1, 'rgba(10,6,4,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.lineTo(p3[0], p3[1]);
  ctx.lineTo(p4[0], p4[1]);
  ctx.closePath();
  ctx.fill();
}
