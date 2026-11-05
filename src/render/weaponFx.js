// Drawing of the weapon effects of step 1 (issue 86): ground light, the ball flame with its afterburn, and
// the three kinds of lightning (tesla, ember cauldron, thunder tower) with the pressure ring.
//
// Pure drawing in screen px on the camera transform, in the style of the style test: ink under colour under
// a light core, glow only from half-transparent shapes and gradients, no shadowBlur, no filter, no composite
// mode. Shapes and colours are those of reference/studien/waffeneffekte-runde2.js (round 2 of the study);
// every size and time is a number in src/data/art.js. Nothing here knows the simulation: the callers
// (towerFx.js for the emplacements, effects.js for what lives on the ground) read the state and say when.

import { ell } from './draw.js';
import { C } from './palette.js';
import { FX_LIGHT, FX_BALLS, FX_BURN, FX_TESLA, FX_EMBER, FX_THUNDER, FX_BIG_ROCKET, FX_BIG_BOOM, FX_MIST } from '../data/art.js';

const INK = C.ink;
const TAU = Math.PI * 2;
/** Screen px of one cell of radius on the ground, across (the ellipse is half as high). */
export const CELL_RX = 32 * Math.SQRT2;

/** Soft round glow without shadowBlur (CLAUDE.md): a radial gradient. */
export function glow(ctx, x, y, radius, colour, alpha) {
  const g = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
  g.addColorStop(0, `${colour}${Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0')}`);
  g.addColorStop(1, `${colour}00`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

/**
 * Whether a disc of `r` px round the world-px point (x, y) can show on the canvas at all, under the
 * transform the context has now. A light or a ring far off the screen is not worth a gradient; where the
 * context cannot say (a test double) everything counts as visible.
 */
export function onCanvas(ctx, x, y, r) {
  const m = ctx.getTransform?.();
  if (!m || typeof m.a !== 'number') return true;
  const sx = m.a * x + m.c * y + m.e;
  const sy = m.b * x + m.d * y + m.f;
  const reach = r * Math.max(Math.abs(m.a), Math.abs(m.b), Math.abs(m.c), Math.abs(m.d)) + 4;
  return sx + reach > 0 && sx - reach < ctx.canvas.width && sy + reach > 0 && sy - reach < ctx.canvas.height;
}

const hash = (n) => {
  const r = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return r - Math.floor(r);
};

// ======================================================================================
// Ground light
// ======================================================================================

/**
 * A light on the ground: an ellipse on the ground plane (2 : 1) filled with a radial gradient, bright in the
 * middle and fading to nothing at `r` cells. One gradient and one fill; the colour is laid over the ground
 * with the normal mixing.
 */
export function groundLight(ctx, x, y, r, colour, alpha) {
  if (alpha <= 0.004 || r <= 0) return;
  const R = r * CELL_RX;
  const a = (k) => Math.round(Math.max(0, Math.min(1, alpha * k)) * 255).toString(16).padStart(2, '0');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.5);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, `${colour}${a(1)}`);
  g.addColorStop(0.35, `${colour}${a(0.55)}`);
  g.addColorStop(1, `${colour}00`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Alpha of a kicked light at its level: it falls off quickly at first, like a flash. */
export const lightAlpha = (l) => l.a * l.level * l.level;

/**
 * The light of a kind at a place: the spec to kick, or null when that kind has none. `which` picks the
 * `hit` or `idle` variant of the table.
 */
export function lightSpec(kind, which = null) {
  const L = FX_LIGHT[kind];
  if (!L) return null;
  const spec = which ? L[which] : L;
  if (!spec) return null;
  return { r: spec.r, colour: L.colour, a: spec.a, fade: spec.fade ?? L.fade };
}

// ======================================================================================
// Fire
// ======================================================================================

/** A teardrop flame standing at (x, y), height 14 s px; one or two fills and one stroke. */
export function flameTongue(ctx, x, y, s, outer, inner, lean = 0) {
  for (const [k, col] of [[1, outer], [0.55, inner]]) {
    if (!col) continue;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - 5 * s * k, y - 4 * s * k, x - 2 * s * k + lean * 0.5, y - 9 * s * k, x + lean, y - 14 * s * k);
    ctx.bezierCurveTo(x + 3 * s * k + lean * 0.5, y - 9 * s * k, x + 5 * s * k, y - 4 * s * k, x, y);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    if (k === 1) {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
  }
}

/** Colour ramp of a fireball by age: white hot, yellow, orange, red, dark red. */
const BALL_RAMP = ['#fff3c4', '#ffe38a', '#ffd23f', '#ffb02e', '#ff8a2a', '#e5601f', '#b8431a', '#7a2e14'];

/** Radius of a fireball at age `u` (0 to 1): it swells as it rolls. */
export const ballRadius = (u) => FX_BALLS.r[0] + (FX_BALLS.r[1] - FX_BALLS.r[0]) * Math.pow(u, 0.7);

/**
 * One fireball: a cloud of three overlapping round lobes with one ink outline (the ink of all three first,
 * then their colour over it) and a light spot; while it still burns, a tongue stands on it, because fire
 * burns upwards. `u` is its age, 0 to 1.
 */
export function drawFireball(ctx, x, y, r, u, spin) {
  const col = BALL_RAMP[Math.min(BALL_RAMP.length - 1, Math.floor(u * BALL_RAMP.length))];
  const lobes = [
    [0, 0, 1],
    [Math.cos(spin) * 0.55, Math.sin(spin) * 0.4 - 0.15, 0.72],
    [Math.cos(spin + 2.4) * 0.6, Math.sin(spin + 2.4) * 0.4 - 0.1, 0.62],
  ];
  ctx.beginPath();
  for (const [dx, dy, k] of lobes) {
    ctx.moveTo(x + dx * r + k * r, y + dy * r);
    ctx.arc(x + dx * r, y + dy * r, k * r, 0, TAU);
  }
  ctx.globalAlpha = u > 0.8 ? (1 - u) / 0.2 : 1;
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.fill();
  if (u < 0.6) ell(ctx, x - r * 0.25, y - r * 0.3, r * 0.42, r * 0.32, BALL_RAMP[Math.max(0, Math.floor(u * BALL_RAMP.length) - 2)], null);
  if (u > 0.15 && u < 0.75) flameTongue(ctx, x + Math.cos(spin) * r * 0.2, y - r * 0.55, FX_BALLS.lick * (r / 10), '#ffb13b', '#ffe38a', Math.sin(spin) * 2);
  ctx.globalAlpha = 1;
}

/**
 * A patch of ground that burns on for a moment where the jet has been: a scorch, a warm glow and a few small
 * flames that sink as it dies; at the end only two embers. `u` is its age, 0 to 1. With `flames` false (far
 * out, small on the screen) only the soot and the glow are drawn.
 */
export function drawBurnPatch(ctx, x, y, u, t, seed, reduced, flames = true) {
  const B = FX_BURN;
  const fade = 1 - u;
  ell(ctx, x, y, B.scorch * (0.7 + 0.3 * Math.min(1, u * 6)), B.scorch * 0.45, `rgba(20,12,8,${(0.4 * Math.min(1, fade * 2)).toFixed(3)})`, null);
  glow(ctx, x, y - 3, B.glow, '#ff8a2a', 0.38 * fade);
  if (!flames) return;
  const live = Math.max(0, 1 - u / 0.72);
  for (let i = 0; i < B.flames; i++) {
    const dx = (i - (B.flames - 1) / 2) * 5 + Math.sin(seed * 7 + i) * 2;
    const fl = reduced ? 1 : 0.8 + 0.2 * Math.sin(t * 17 + i * 2.2 + seed);
    const s = (0.4 + 0.25 * ((seed * 3 + i * 0.6) % 1)) * live * fl;
    if (s > 0.05) flameTongue(ctx, x + dx, y + Math.abs(dx) * 0.2, s, i % 2 ? '#ffb13b' : '#ff8a2a', '#fff3c0', reduced ? 0 : Math.sin(t * 5 + i) * 1.5);
  }
  if (live <= 0) {
    for (let i = 0; i < 2; i++) ell(ctx, x + (i ? 3 : -3), y - 1, 1.3, 1, '#ff8a2a', null);
  }
}

// ======================================================================================
// Lightning, three ways
// ======================================================================================

function strokes(ctx, pts, list) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, col, alpha = 1] of list) {
    if (w <= 0 || alpha <= 0) continue;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** A true zigzag: the kinks change side every step, so the bolt looks angular and electric. */
export function zigzag(a, b, seed, jitter, steps) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const pts = [a];
  for (let i = 1; i < steps; i++) {
    const u = i / steps + ((hash(seed + i * 3.3) - 0.5) * 0.4) / steps;
    const side = i % 2 ? 1 : -1;
    const off = side * jitter * (0.45 + 0.55 * hash(seed * 1.7 + i)) * Math.sin(Math.PI * Math.min(1, u * 1.15));
    pts.push([a[0] + dx * u + nx * off, a[1] + dy * u + ny * off]);
  }
  pts.push(b);
  return pts;
}

/**
 * Tesla: a cold, angular double strike. Shown from 0 to `gap[0]` s, dark until `gap[1]` s, then a second
 * strike in a new shape that fades. Narrow cyan aura, one fork. `age` is seconds since the shot, `u` falls 1
 * to 0. With reduced motion there is no dark gap (nothing flickers). Returns false while it is dark.
 */
export function drawTeslaArc(ctx, a, b, seed, age, u, reduced, withFork = true) {
  const T = FX_TESLA;
  if (!reduced && age >= T.gap[0] && age < T.gap[1]) return false;
  const second = age >= T.gap[1];
  const s = seed + (second ? 17 : 0);
  const len = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
  const steps = Math.max(3, Math.min(T.steps, Math.round(len / 12)));
  const pts = zigzag(a, b, s, Math.min(T.jitter, len * 0.2), steps);
  const k = second ? 0.5 + 0.5 * u : 1;
  strokes(ctx, pts, [[7, T.colours[1], 0.18 * k], [T.ink + T.colour * k, INK], [T.colour * k, T.colours[0]], [T.core, '#ffffff']]);
  if (withFork) {
    const i = Math.max(1, Math.floor(pts.length * 0.55));
    const p = pts[i];
    const end = [p[0] + (hash(s) - 0.3) * 18, p[1] - 6 - hash(s + 1) * 10];
    strokes(ctx, zigzag(p, end, s + 5, 4, 3), [[2.6 * k, INK], [1 * k, T.colours[0]]]);
  }
  glow(ctx, b[0], b[1], 11, T.colours[1], 0.55 * k);
  return true;
}

/** A point on a sinuous thread from a to b: a wave of `waves` periods that closes at both ends. */
function threadAt(a, b, s, amp, waves, phase) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const off = Math.sin(s * TAU * waves + phase) * amp * Math.sin(Math.PI * s);
  // Fire bolts sag a little, like a hot wire.
  const sag = Math.sin(Math.PI * s) * len * 0.06;
  return [a[0] + dx * s + (-dy / len) * off, a[1] + dy * s + (dx / len) * off + sag];
}

/**
 * Ember cauldron: three fine sinuous threads per target, braided round each other, red to gold. They crawl
 * from the electrode to the target over `crawl` s with a bright head, then burn out from the start and leave
 * an ember glow at the target. No angles, no wide aura: it is fire, not electricity. `age` is seconds since
 * the shot, `u` falls 1 to 0, `t` is the drawing clock.
 */
export function drawEmberThreads(ctx, a, b, seed, age, u, t, reduced) {
  const E = FX_EMBER;
  const reach = Math.min(1, age / E.crawl);
  const gone = Math.max(0, 1 - u * 1.25); // share burnt out from the start
  const n = 18;
  for (let k = 0; k < E.strands; k++) {
    const phase = (k / E.strands) * TAU + seed + (reduced ? 0 : t * 9);
    const amp = E.wave * (0.6 + 0.4 * hash(seed + k)) * (k === 0 ? 0.5 : 1);
    if (reach <= gone) continue;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const s = gone + (reach - gone) * (i / n);
      pts.push(threadAt(a, b, s, amp, 1.6 + k * 0.4, phase));
    }
    const w = k === 0 ? 1 : 0.7;
    strokes(ctx, pts, [[(E.ink + E.colour) * w, INK, 0.85], [E.colour * w * 1.2, E.colours[k === 0 ? 1 : 0]], [E.core * w, E.colours[2], k === 0 ? 1 : 0]]);
    if (reach < 1 && k === 0) ell(ctx, pts[n][0], pts[n][1], 2.2, 2.2, E.colours[2], null);
  }
  glow(ctx, a[0], a[1], 9, '#ff8a2a', 0.5 * u);
  if (reach >= 1) glow(ctx, b[0], b[1], 12, '#ff5a1f', 0.6 * Math.min(1, u * 1.5));
}

/**
 * Thunder tower, a strike from above: from a point `sky` px above the target, a thick white-violet bolt with
 * two branches comes down, under it a wide violet aura; a glow up in the sky where it starts. `u` falls 1 to 0.
 */
export function drawSkyStrike(ctx, b, seed, u, reduced) {
  const H = FX_THUNDER;
  const top = [b[0] + (hash(seed) - 0.5) * 50, b[1] - H.sky];
  const pts = zigzag(top, b, seed, 16, 10);
  const k = 0.55 + 0.45 * u;
  const auraK = reduced ? 0.6 : 1;
  strokes(ctx, pts, H.aura.map((s) => [s.width * k, H.colours[1], s.alpha * u * auraK]));
  for (let j = 0; j < 2; j++) {
    const p = pts[2 + j * 3];
    const end = [p[0] + (j ? 1 : -1) * (18 + hash(seed + j) * 16), p[1] + 22 + hash(seed + j + 4) * 18];
    strokes(ctx, zigzag(p, end, seed + j * 9, 6, 4), [[3.2 * k, INK], [1.4 * k, H.colours[0]]]);
  }
  strokes(ctx, pts, [[H.ink * k + H.colour * k, INK], [H.colour * k, H.colours[0]], [H.core, '#ffffff']]);
  glow(ctx, top[0], top[1], 34, H.colours[1], 0.5 * u);
  glow(ctx, b[0], b[1], 24, H.colours[0], 0.7 * u);
}

/** Thunder tower, a hop of the chain between two targets: a medium angular bolt in the same violet white. */
export function drawThunderHop(ctx, a, b, seed, u) {
  const H = FX_THUNDER;
  const len = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
  const pts = zigzag(a, b, seed, Math.min(12, len * 0.2), Math.max(3, Math.min(8, Math.round(len / 10))));
  const k = 0.55 + 0.45 * u;
  strokes(ctx, pts, [[10 * k, H.colours[1], 0.2 * u], [H.hop.ink * k + H.hop.colour * k, INK], [H.hop.colour * k, H.colours[0]], [H.hop.core, '#ffffff']]);
  glow(ctx, b[0], b[1], 15, H.colours[1], 0.6 * u);
}

/**
 * A pressure ring on the ground: an ellipse that runs out to `r` cells over its life, ink under colour.
 * `u` is its age, 0 to 1. With reduced motion it does not grow and is half as bright.
 */
export function drawPressureRing(ctx, x, y, r, u, colour, width, reduced) {
  const grow = reduced ? 1 : 1 - (1 - u) * (1 - u);
  const R = r * CELL_RX * (0.15 + 0.85 * grow);
  const alpha = (1 - u) * (reduced ? 0.5 : 1);
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ell(ctx, x, y, R, R * 0.5, null, INK, width + 2);
  ell(ctx, x, y, R, R * 0.5, null, colour, width);
  ctx.globalAlpha = alpha * 0.25;
  ell(ctx, x, y, R * 0.92, R * 0.46, colour, null);
  ctx.globalAlpha = 1;
}

// ======================================================================================
// Rockets of the siege mortar (step 2)
// ======================================================================================

/** The heavy rocket of the siege mortar: a thick body, a long exhaust flame and big fins. (x, y) is the nose, (ux, uy) the way it flies. */
export function drawHeavyRocket(ctx, x, y, ux, uy, accent, flick = 1) {
  const S = FX_BIG_ROCKET;
  const tail = [x - ux * S.tail, y - uy * S.tail];
  const nx = -uy;
  const ny = ux;
  glow(ctx, tail[0] - ux * 6, tail[1] - uy * 6, S.flame[0] * 3.2, '#ffb02e', 0.5);
  // A long exhaust flame: an ink kite in orange, then a white one inside.
  for (const [len, wid, col, ink] of [[S.flame[0] * 2.6 * flick, S.flame[1], '#ff8a2a', true], [S.flame[0] * 1.5 * flick, S.flame[1] * 0.55, '#fff3c4', false]]) {
    ctx.beginPath();
    ctx.moveTo(tail[0] + nx * wid, tail[1] + ny * wid);
    ctx.quadraticCurveTo(tail[0] - ux * len * 0.4 + nx * wid, tail[1] - uy * len * 0.4 + ny * wid, tail[0] - ux * len, tail[1] - uy * len);
    ctx.quadraticCurveTo(tail[0] - ux * len * 0.4 - nx * wid, tail[1] - uy * len * 0.4 - ny * wid, tail[0] - nx * wid, tail[1] - ny * wid);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    if (ink) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#717884';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(tail[0] + ux * 5, tail[1] + uy * 5);
    ctx.lineTo(tail[0] + nx * S.fin * sd - ux * 2, tail[1] + ny * S.fin * sd - uy * 2);
    ctx.lineTo(tail[0] + ux * 0.5, tail[1] + uy * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  strokes(ctx, [tail, [x - ux * 2, y - uy * 2]], [[S.ink, INK], [S.body, '#a6adb8'], [S.body * 0.35, '#d3d8de']]);
  // A band in the colour of the doctrine behind the warhead.
  const band = [x - ux * S.tail * 0.42, y - uy * S.tail * 0.42];
  strokes(ctx, [[band[0] - ux * 1.2, band[1] - uy * 1.2], [band[0] + ux * 1.2, band[1] + uy * 1.2]], [[S.body, accent]]);
  ell(ctx, x, y, S.warhead, S.warhead, accent, INK, 1.3);
  ell(ctx, x - 1, y - 1, S.warhead * 0.4, S.warhead * 0.4, '#ffe3a0', null);
}

/**
 * The fire of the big impact on the ground point (x, y) (screen px): a white flash and a fireball of several
 * lobes that rises and darkens. `r` is the splash radius in cells, `age` seconds. The pressure ring is the
 * ground layer's (it lies under the figures); dust, smoke and debris are particles of the caller.
 */
export function drawBigImpact(ctx, x, y, r, age, seed, reduced) {
  const B = FX_BIG_BOOM;
  if (age > B.life) return;
  const u = age / B.life;
  if (age < B.flash) glow(ctx, x, y - 10, r * CELL_RX * 0.7, '#fff6d8', 0.85 * (1 - age / B.flash) * (reduced ? 0.5 : 1));
  const R = r * 32 * 0.42 * (0.55 + 0.45 * Math.sqrt(u));
  const ramp = ['#fff3b0', '#ffd23f', '#ffb13b', '#ff8a2a', '#e2531f', '#7a2e14', '#3a2a22'];
  const col = ramp[Math.min(ramp.length - 1, Math.floor(u * ramp.length))];
  const lift = u * 26;
  ctx.globalAlpha = Math.max(0, 1 - Math.max(0, u - 0.6) / 0.4);
  ctx.beginPath();
  for (let i = 0; i < B.lobes; i++) {
    const a = (i / B.lobes) * TAU + seed;
    const lr = R * (0.5 + 0.18 * hash(seed + i));
    const lx = x + Math.cos(a) * R * 0.55;
    const ly = y - R * 0.55 - lift + Math.sin(a) * R * 0.3;
    ctx.moveTo(lx + lr, ly);
    ctx.arc(lx, ly, lr, 0, TAU);
  }
  ctx.moveTo(x + R * 0.7, y - R * 0.6 - lift);
  ctx.arc(x, y - R * 0.6 - lift, R * 0.7, 0, TAU);
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.fill();
  if (u < 0.5) ell(ctx, x - R * 0.15, y - R * 0.75 - lift, R * 0.4, R * 0.3, ramp[0], null);
  ctx.globalAlpha = 1;
}

/** The crater of the big impact: a dark patch, a pit with a rim, a last glow; fades over its life (u 0 to 1). */
export function drawCrater(ctx, x, y, r, u) {
  const k = Math.min(1, u * 8);
  const fade = 1 - u;
  ell(ctx, x, y, r * CELL_RX * 0.55 * k, r * CELL_RX * 0.27 * k, `rgba(14,10,8,${(0.35 * fade).toFixed(3)})`, null);
  ell(ctx, x, y, 14 * k, 7 * k, `rgba(42,33,27,${(0.9 * fade).toFixed(3)})`, `rgba(0,0,0,${(0.8 * fade).toFixed(3)})`, 1.6);
  glow(ctx, x, y, 12, '#ff8a2a', 0.35 * Math.max(0, 1 - u * 3));
}

// ======================================================================================
// Mist of the purge shrine (step 2)
// ======================================================================================

/** A smooth closed path through screen points (quadratic curves through the midpoints). */
function smoothClosed(ctx, pts) {
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  ctx.beginPath();
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const m = mid(p, pts[(i + 1) % n]);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
}

/**
 * The flow of mist of the purge shrine. A pour of mist falls from the artefact to the foot, and from there
 * waves run out over the ground to the rim of the aura (`R` cells), slowing and thinning; at the rim the mist
 * lies as a bank. Gradients only, no ink. `project(x, y)` is the screen point of a ground point, `pour` the
 * screen point of the artefact, `level` the aura level (dim while idle). A thin gold line marks the reach.
 * With reduced motion the waves stand still.
 */
export function drawMistFlow(ctx, project, cx, cy, R, pour, level, t, reduced) {
  const M = FX_MIST;
  const [ox, oy] = project(cx, cy);
  // Work on the ground plane: points relative to the centre, height doubled, so a circle of the world is a
  // circle here and a radial gradient follows it.
  const ring = (r, lumpy, phase) => {
    const pts = [];
    for (let i = 0; i < M.lobes; i++) {
      const a = (i / M.lobes) * TAU;
      const bump = 1 + lumpy * Math.sin(i * 2.4 + phase) * (i % 2 ? 1 : 0.5);
      const [x, y] = project(cx + Math.cos(a) * r * bump, cy + Math.sin(a) * r * bump);
      pts.push([x - ox, (y - oy) * 2]);
    }
    return pts;
  };
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(1, 0.5);
  const band = (r0, r1, peak, alpha, lumpy, phase) => {
    if (alpha <= 0.005) return;
    const g = ctx.createRadialGradient(0, 0, Math.max(0, r0 * CELL_RX), 0, 0, r1 * CELL_RX * (1 + lumpy));
    g.addColorStop(0, 'rgba(255,243,220,0)');
    g.addColorStop(peak, `rgba(255,243,220,${alpha.toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,243,220,0)');
    smoothClosed(ctx, ring(r1 * (1 + lumpy), lumpy, phase));
    ctx.fillStyle = g;
    ctx.fill();
  };
  // A thin veil over the whole aura, so its reach stays readable.
  band(0, R, 0.85, 0.08 + 0.1 * level, 0.02, t * 0.7);
  // The waves, outermost first; each is soft on both sides and thins as it runs out.
  const waves = [];
  for (let k = 0; k < M.waves; k++) waves.push(reduced ? k / M.waves + 0.12 : (t / M.period + k / M.waves) % 1);
  waves.sort((a, b) => b - a);
  for (const phi of waves) {
    const ease = 1 - Math.pow(1 - phi, 1.7);
    const r = 0.45 + (M.rim[0] - 0.45) * ease;
    const w = M.band * (1.2 - 0.5 * phi);
    const alpha = Math.min(1, phi / 0.12) * (1 - phi * 0.75) * (0.22 + 0.3 * level);
    band(Math.max(0, r - w), r, 0.7, alpha, M.lumpy * (0.4 + phi), t * 1.3 + phi * 6);
  }
  // The bank at the rim, where the mist comes to rest.
  band(M.rim[0] - 0.4, M.rim[1], 0.62, 0.24 + 0.24 * level, 0.05, t * 0.9);
  ctx.restore();
  ctx.globalAlpha = 0.25 + 0.3 * level;
  ell(ctx, ox, oy, R * CELL_RX, R * CELL_RX * 0.5, null, '#ffd66e', 1.2);
  // The pour: mist falling from the artefact to the foot, and a pool there.
  for (let i = 0; i < M.pour; i++) {
    const f = reduced ? (i + 0.5) / M.pour : (t * 1.4 + i / M.pour) % 1;
    const qx = pour[0] + (ox - pour[0]) * f + (reduced ? 0 : Math.sin(t * 3 + i * 2) * 2);
    const qy = pour[1] + (oy - pour[1]) * f;
    const rr = 3 + f * 7;
    ctx.globalAlpha = (0.25 + 0.35 * level) * Math.sin(Math.PI * f);
    ell(ctx, qx, qy, rr, rr * 0.8, '#fff3d8', null);
  }
  ctx.globalAlpha = 1;
  glow(ctx, ox, oy, 22, '#fff1cf', 0.35 + 0.3 * level);
}
