// Study A-37, second round (issue 81): the new pieces Till asked for on 05.11.2026 (file E-40).
//
// - Ground light: the fire of the special emplacements lights the ground round them (a gradient on the
//   ground plane, a weaker one over the figures), for the storm battery and as an option for all six.
// - Fire: two new looks for the flame jet ("Strom", a burning stream that falls onto the target with
//   upright tongues; "Ballen", rolling fireballs in the same arc)
//   and patches that burn on the ground for a moment after the jet has passed (drawing only).
// - Lightning told apart by shape, colour and rhythm: tesla a cold angular double strike, ember
//   cauldron fine sinuous glowing threads that crawl to the target, thunder tower a strike from the sky
//   with a pressure ring, a ground light and a short brightening of the picture.
// - Rocket launcher: three small rockets per hit in quick succession; the values stay.
// - Siege launcher ("Raketenturm"): bigger rocket, heavy smoke, back blast, a big impact.
// - Purge shrine: a flow of mist poured out of the artefact that runs out to the rim of the aura (2.8).
//
// Everything is drawn in world px on the camera transform, in the style of the stiltest: ink under
// colour under a light core, glow only from half-transparent shapes and gradients, no shadowBlur, no
// filters. The only composite mode is the optional "addiert" of the ground light. Every size and time is a number in R2, so the study can print it.
// Nothing here is game code; src/ stays as it is.

import { ell } from '../../src/render/draw.js';
import { C } from '../../src/render/palette.js';
import { glow } from './waffeneffekte-modell.js';

const INK = C.ink;
const TAU = Math.PI * 2;
/** Screen px of one cell of radius on the ground, across (the ellipse is half as high). */
export const CELL_RX = 32 * Math.SQRT2;

// ======================================================================================
// The second round in numbers
// ======================================================================================

export const R2 = {
  /**
   * Ground light by emplacement: radius in cells, colour, peak alpha on the ground, seconds to fade
   * after the last kick; `over` is the share drawn again over the figures. `idle` is a light that stays.
   */
  light: {
    stormBattery: { r: 2.2, colour: '#9fdcff', a: 0.55, fade: 0.18, hit: { r: 0.8, a: 0.22, fade: 0.1 } },
    emberCauldron: { r: 2.4, colour: '#ff8a2a', a: 0.32, fade: 0.35, idle: { r: 1.4, a: 0.1 }, hit: { r: 0.9, a: 0.26, fade: 0.5 } },
    siegeMortar: { r: 2.6, colour: '#ffb02e', a: 0.38, fade: 0.4, hit: { r: 2.6, a: 0.5, fade: 0.6 } },
    thunderTower: { r: 3.0, colour: '#cfd8ff', a: 0.45, fade: 0.3, idle: { r: 1.2, a: 0.07 }, hit: { r: 1.3, a: 0.35, fade: 0.3 } },
    soulfireObelisk: { r: 2.2, colour: '#b784ff', a: 0.3, fade: 0.3, hit: { r: 1.0, a: 0.28, fade: 0.3 } },
    purgeShrine: { r: 2.8, colour: '#ffd36a', a: 0.16, fade: 0.5, idle: { r: 2.8, a: 0.06 } },
    over: 0.35,
    /** Ground lights a page may hold at once; the oldest goes first. */
    max: 24,
  },
  /**
   * Flame jet, look "Strom": a ribbon from `width[0]` to `width[1]` px (half widths) in a flat arc onto
   * the target (`arc` px above the straight line), `tongues` upright flames travelling outwards at `travel`
   * lengths per second, scale `tongue[0]` to `tongue[1]`, and `splash` big ones (`tongue[2]`) where it lands.
   */
  stream: { spine: 12, width: [2.4, 7], arc: 10, tongues: 8, travel: 1.6, tongue: [0.5, 1.1, 1.6], splash: 4 },
  /** Flame jet, look "Ballen": rolling fireballs in the same arc, emitted at `rate` per second, `life` s each. */
  balls: { rate: 26, life: 0.42, r: [3, 13], arc: 10, max: 16, lick: 0.5 },
  /** Ground afterburn: patches near the tip of the jet; `every` seconds a new one, `life` each, at most `max`. */
  burn: { every: 0.12, life: 1.4, max: 6, flames: 3, scorch: 9, glow: 14 },
  /** Tesla: cold angular double strike. */
  tesla: { ink: 2.6, colour: 1.4, core: 0.6, steps: 7, jitter: 13, on: [0, 0.05], gap: [0.05, 0.08], colours: ['#bff2ff', '#5fd4ff'] },
  /** Ember cauldron: three fine sinuous threads per target that crawl there over `crawl` s. */
  ember: { strands: 3, ink: 1.5, colour: 0.9, core: 0.4, wave: 5, crawl: 0.08, colours: ['#ff5a1f', '#ffb13b', '#fff0b0'] },
  /** Thunder tower: a strike from `sky` px above, a cascade of `delay` s per jump, pressure ring, flash. */
  thunder: {
    sky: 240, ink: 5.5, colour: 3.2, core: 1.4, aura: [{ width: 20, alpha: 0.14 }, { width: 9, alpha: 0.26 }],
    hop: { ink: 3, colour: 1.7, core: 0.7 }, delay: 0.035,
    ring: { first: 1.6, other: 1.0, seconds: 0.3, width: 3 },
    flash: { alpha: 0.16, seconds: 0.12, reduced: 0.05 },
    colours: ['#ece8ff', '#8f9cff'],
  },
  /** Rocket launcher: three rockets per hit, `gap` s apart, landing round the shell's point within `spread` cells. */
  salvo: { count: 3, gap: 0.06, spread: 0.2, boom: 0.55 },
  /** Siege launcher: the heavier rocket in flight and the impact. */
  bigRocket: { ink: 8, body: 5, tail: 17, warhead: 3.8, flame: [9, 5], fin: 4.5, trail: 0.02, smoke: [5, 18], smokeLife: 1.5 },
  bigBoom: { flash: 0.08, ring: 0.36, lobes: 5, debris: 8, dust: 12, scorch: 2.5, brighten: 0.1 },
  /** Purge shrine: waves of mist poured out of the artefact, running to the rim of the aura. */
  mist: { waves: 4, period: 3.2, lobes: 20, band: 0.5, lumpy: 0.12, pour: 3, rim: [2.5, 2.9] },
};

// ======================================================================================
// Ground light
// ======================================================================================

/**
 * A light on the ground: an ellipse on the ground plane filled with a radial gradient, bright in the
 * middle and fading to nothing at `r` cells. One fill.
 */
export function groundLight(ctx, x, y, r, colour, alpha, add = false) {
  if (alpha <= 0.004 || r <= 0) return;
  const R = r * CELL_RX;
  const a = (k) => Math.round(Math.max(0, Math.min(1, alpha * k)) * 255).toString(16).padStart(2, '0');
  ctx.save();
  // "Addiert": the light is added to what is there (globalCompositeOperation 'lighter'), so dark ground
  // turns bright and coloured instead of being veiled. A choice for Till (see the README).
  if (add) ctx.globalCompositeOperation = 'lighter';
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

/** A store of ground lights: kicked by a shot, fading by themselves. */
export function createLights() {
  const list = [];
  return {
    list,
    /** A light of `r` cells at world (x, y) that fades from `a` over `fade` s. */
    kick(x, y, r, colour, a, fade, key = null) {
      if (key) {
        const same = list.find((l) => l.key === key);
        if (same) {
          Object.assign(same, { x, y, r, colour, a, fade, level: 1 });
          return;
        }
      }
      if (list.length >= R2.light.max) list.shift();
      list.push({ key, x, y, r, colour, a, fade, level: 1 });
    },
    step(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const l = list[i];
        l.level -= dt / l.fade;
        if (l.level <= 0) list.splice(i, 1);
      }
    },
    clear() {
      list.length = 0;
    },
  };
}

/** Alpha of a light at its level: it falls off quickly at first, like a flash. */
export const lightAlpha = (l) => l.a * l.level * l.level;

// ======================================================================================
// Fire
// ======================================================================================

/** A teardrop flame standing at (x, y), height 14 s px, as in towerFx.js; one or two fills, one stroke. */
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
 * Look "Strom": the jet as a stream of burning fuel. A narrow ribbon leaves the nozzle and falls in a flat
 * arc onto the target (on the ground, not in the air above it); fire burns upwards, so along the ribbon
 * flame tongues stand up and travel outwards, growing; where the stream lands it splashes into a cluster
 * of big tongues. The tongues are the stiltest's teardrop flames, ink, colour and a light inside.
 * @param {(s: number) => number[]} spineAt  screen point of the stream at s from 0 (nozzle) to 1 (end)
 * @param {number} t  study time, s
 */
export function drawFlameStream(ctx, spineAt, t, jet, reduced, seed = 0) {
  const T = R2.stream;
  const n = T.spine;
  const spine = [];
  for (let i = 0; i <= n; i++) spine.push(spineAt(i / n));
  // The ribbon: a tapered band along the spine, ink under orange under yellow.
  const ribbon = (k, colour, ink) => {
    const left = [];
    const right = [];
    for (let i = 0; i <= n; i++) {
      const a = spine[Math.max(0, i - 1)];
      const b = spine[Math.min(n, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / l;
      const ny = (b[0] - a[0]) / l;
      const s = i / n;
      const w = (T.width[0] + (T.width[1] - T.width[0]) * s) * k * (reduced ? 1 : 1 + 0.12 * Math.sin(t * 30 + i * 1.7 + seed));
      left.push([spine[i][0] + nx * w, spine[i][1] + ny * w]);
      right.push([spine[i][0] - nx * w, spine[i][1] - ny * w]);
    }
    smoothClosed(ctx, [...left, ...right.reverse()]);
    ctx.fillStyle = colour;
    ctx.fill();
    if (ink) {
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = INK;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  };
  ribbon(1, '#ff8a2a', true);
  ribbon(0.55, '#ffd23f', false);
  ribbon(0.22, '#fff3c4', false);
  // Tongues that stand up along the stream and travel outwards with it.
  const tongues = [];
  for (let j = 0; j < T.tongues; j++) {
    const s = reduced ? (j + 0.5) / T.tongues : ((j / T.tongues + t * T.travel + seed * 0.13) % 1);
    if (s < 0.12) continue;
    const [x, y] = spineAt(s);
    const grow = Math.sin(Math.PI * Math.min(1, s * 1.05)) * 0.4 + s * 0.6;
    const fl = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 21 + j * 2.3);
    tongues.push([y, () => flameTongue(ctx, x, y + 2, (T.tongue[0] + (T.tongue[1] - T.tongue[0]) * grow) * fl * jet, j % 2 ? '#ff8a2a' : '#ffb13b', '#ffe38a', reduced ? 0 : Math.sin(t * 7 + j) * 2)]);
  }
  // The splash where the stream lands: a cluster of big tongues round the end.
  const end = spine[n];
  for (let j = 0; j < T.splash; j++) {
    const dx = (j - (T.splash - 1) / 2) * 7;
    const dy = (j % 2 ? -2 : 2);
    const fl = reduced ? 1 : 0.8 + 0.2 * Math.sin(t * 17 + j * 1.9 + seed);
    const sc = (j === Math.floor(T.splash / 2) ? T.tongue[2] : T.tongue[1] * 1.05) * fl * jet;
    tongues.push([end[1] + dy, () => flameTongue(ctx, end[0] + dx, end[1] + dy, sc, j % 2 ? '#ff8a2a' : '#ffb13b', '#fff3c0', reduced ? 0 : Math.sin(t * 6 + j) * 3)]);
  }
  glow(ctx, end[0], end[1] - 8, 22, '#ff8a2a', 0.45 * jet);
  tongues.sort((a, b) => a[0] - b[0]);
  for (const [, draw] of tongues) draw();
}

/** Colour ramp of a fireball by age: white hot, yellow, orange, red, dark red. */
const BALL_RAMP = ['#fff3c4', '#ffe38a', '#ffd23f', '#ffb02e', '#ff8a2a', '#e5601f', '#b8431a', '#7a2e14'];

/**
 * Look "Ballen": one fireball, a cloud of three overlapping round lobes with one ink outline (the ink of all
 * three first, then their colour over it) and a light spot. `u` is its age, 0 to 1.
 */
export function drawFireball(ctx, x, y, r, u, spin) {
  const col = BALL_RAMP[Math.min(BALL_RAMP.length - 1, Math.floor(u * BALL_RAMP.length))];
  const lobes = [[0, 0, 1], [Math.cos(spin) * 0.55, Math.sin(spin) * 0.4 - 0.15, 0.72], [Math.cos(spin + 2.4) * 0.6, Math.sin(spin + 2.4) * 0.4 - 0.1, 0.62]];
  const path = () => {
    ctx.beginPath();
    for (const [dx, dy, k] of lobes) {
      ctx.moveTo(x + dx * r + k * r, y + dy * r);
      ctx.arc(x + dx * r, y + dy * r, k * r, 0, TAU);
    }
  };
  ctx.globalAlpha = u > 0.8 ? (1 - u) / 0.2 : 1;
  path();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.fill();
  if (u < 0.6) ell(ctx, x - r * 0.25, y - r * 0.3, r * 0.42, r * 0.32, BALL_RAMP[Math.max(0, Math.floor(u * BALL_RAMP.length) - 2)], null);
  // Fire burns upwards: a tongue stands on the ball while it is still burning.
  if (u > 0.15 && u < 0.75) flameTongue(ctx, x + Math.cos(spin) * r * 0.2, y - r * 0.55, R2.balls.lick * (r / 10), '#ffb13b', '#ffe38a', Math.sin(spin) * 2);
  ctx.globalAlpha = 1;
}

/**
 * A patch of ground that burns on for a moment where the jet has been: a scorch, a warm glow and a few
 * small flames that sink as it dies; at the end only two embers. `u` is its age, 0 to 1.
 */
export function drawBurnPatch(ctx, x, y, u, t, seed, reduced) {
  const B = R2.burn;
  const fade = 1 - u;
  ell(ctx, x, y, B.scorch * (0.7 + 0.3 * Math.min(1, u * 6)), B.scorch * 0.45, `rgba(20,12,8,${0.4 * Math.min(1, fade * 2)})`, null);
  glow(ctx, x, y - 3, B.glow, '#ff8a2a', 0.38 * fade);
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

const hash = (n) => {
  const r = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return r - Math.floor(r);
};

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
function zigzag(a, b, seed, jitter, steps) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const pts = [a];
  for (let i = 1; i < steps; i++) {
    const u = i / steps + (hash(seed + i * 3.3) - 0.5) * 0.4 / steps;
    const side = i % 2 ? 1 : -1;
    const off = side * jitter * (0.45 + 0.55 * hash(seed * 1.7 + i)) * Math.sin(Math.PI * Math.min(1, u * 1.15));
    pts.push([a[0] + dx * u + nx * off, a[1] + dy * u + ny * off]);
  }
  pts.push(b);
  return pts;
}

/**
 * Tesla: a cold, angular double strike. Shown 0 to 0.05 s, dark 0.05 to 0.08 s, then a second strike in
 * a new shape that fades. Narrow cyan aura, one fork. `age` is seconds since the shot, `u` falls 1 to 0.
 */
export function drawTeslaArc(ctx, a, b, seed, age, u, reduced, withFork = true) {
  const T = R2.tesla;
  if (!reduced && age >= T.gap[0] && age < T.gap[1]) return false;
  const second = age >= T.gap[1];
  const s = seed + (second ? 17 : 0);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
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
  const len = Math.hypot(dx, dy) || 1;
  const off = Math.sin(s * Math.PI * 2 * waves + phase) * amp * Math.sin(Math.PI * s);
  // Fire bolts sag a little, like a hot wire.
  const sag = Math.sin(Math.PI * s) * len * 0.06;
  return [a[0] + dx * s + (-dy / len) * off, a[1] + dy * s + (dx / len) * off + sag];
}

/**
 * Ember cauldron: three fine sinuous threads per target, braided round each other, red to gold. They crawl
 * from the electrode to the target over `crawl` s with a bright head, then burn out from the start and
 * leave an ember glow at the target. No angles, no wide aura: it is fire, not electricity.
 */
export function drawEmberThreads(ctx, a, b, seed, age, u, t, reduced) {
  const E = R2.ember;
  const reach = Math.min(1, age / E.crawl);
  const gone = Math.max(0, 1 - u * 1.25); // share burnt out from the start
  const n = 18;
  for (let k = 0; k < E.strands; k++) {
    const phase = (k / E.strands) * TAU + seed + (reduced ? 0 : t * 9);
    const amp = E.wave * (0.6 + 0.4 * hash(seed + k)) * (k === 0 ? 0.5 : 1);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const s = gone + (reach - gone) * (i / n);
      pts.push(threadAt(a, b, s, amp, 1.6 + k * 0.4, phase));
    }
    if (reach <= gone) continue;
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
  const H = R2.thunder;
  const top = [b[0] + (hash(seed) - 0.5) * 50, b[1] - H.sky];
  const pts = zigzag(top, b, seed, 16, 10);
  const k = 0.55 + 0.45 * u;
  const auraK = reduced ? 0.6 : 1;
  strokes(ctx, pts, H.aura.map((s) => [s.width * k, H.colours[1], s.alpha * u * auraK]));
  for (let j = 0; j < 2; j++) {
    const i = 2 + j * 3;
    const p = pts[i];
    const end = [p[0] + (j ? 1 : -1) * (18 + hash(seed + j) * 16), p[1] + 22 + hash(seed + j + 4) * 18];
    strokes(ctx, zigzag(p, end, seed + j * 9, 6, 4), [[3.2 * k, INK], [1.4 * k, H.colours[0]]]);
  }
  strokes(ctx, pts, [[H.ink * k + H.colour * k, INK], [H.colour * k, H.colours[0]], [H.core, '#ffffff']]);
  glow(ctx, top[0], top[1], 34, H.colours[1], 0.5 * u);
  glow(ctx, b[0], b[1], 24, H.colours[0], 0.7 * u);
}

/** Thunder tower, a hop of the chain between two targets: a medium angular bolt in the same violet white. */
export function drawThunderHop(ctx, a, b, seed, u) {
  const H = R2.thunder;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const pts = zigzag(a, b, seed, Math.min(12, len * 0.2), Math.max(3, Math.min(8, Math.round(len / 10))));
  const k = 0.55 + 0.45 * u;
  strokes(ctx, pts, [[10 * k, H.colours[1], 0.2 * u], [H.hop.ink * k + H.hop.colour * k, INK], [H.hop.colour * k, H.colours[0]], [H.hop.core, '#ffffff']]);
  glow(ctx, b[0], b[1], 15, H.colours[1], 0.6 * u);
}

/** A pressure ring on the ground: an ellipse that runs out to `r` cells over its life, ink under colour. */
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
// Rockets
// ======================================================================================

/** The heavier rocket of the siege launcher: like drawRocketBody, with a long exhaust flame and bigger fins. */
export function drawHeavyRocket(ctx, x, y, ux, uy, accent, flick = 1) {
  const S = R2.bigRocket;
  const tail = [x - ux * S.tail, y - uy * S.tail];
  const nx = -uy;
  const ny = ux;
  glow(ctx, tail[0] - ux * 6, tail[1] - uy * 6, S.flame[0] * 3.2, '#ffb02e', 0.5);
  // A long exhaust flame: an ink kite, orange, then white.
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
  // Band in the guide colour behind the warhead.
  const band = [x - ux * S.tail * 0.42, y - uy * S.tail * 0.42];
  strokes(ctx, [[band[0] - ux * 1.2, band[1] - uy * 1.2], [band[0] + ux * 1.2, band[1] + uy * 1.2]], [[S.body, accent]]);
  ell(ctx, x, y, S.warhead, S.warhead, accent, INK, 1.3);
  ell(ctx, x - 1, y - 1, S.warhead * 0.4, S.warhead * 0.4, '#ffe3a0', null);
}

/**
 * The big impact of the siege launcher on screen at the ground point (x, y): a white flash, a fireball of
 * several lobes that rises and darkens, a ring that runs out to the true splash radius. `age` in s; `r` in
 * cells. Particles (dust, debris, smoke) and the scorch mark are the caller's.
 */
export function drawBigImpact(ctx, x, y, r, age, seed, reduced) {
  const B = R2.bigBoom;
  const life = 0.7;
  if (age > life) return;
  const u = age / life;
  if (age < B.flash) glow(ctx, x, y - 10, r * CELL_RX * 0.7, '#fff6d8', 0.85 * (1 - age / B.flash) * (reduced ? 0.5 : 1));
  if (age < B.ring) drawPressureRing(ctx, x, y, r, age / B.ring, '#ffb13b', 3.2, reduced);
  const lobes = B.lobes;
  const R = r * 32 * 0.42 * (0.55 + 0.45 * Math.sqrt(u));
  const ramp = ['#fff3b0', '#ffd23f', '#ffb13b', '#ff8a2a', '#e2531f', '#7a2e14', '#3a2a22'];
  const col = ramp[Math.min(ramp.length - 1, Math.floor(u * ramp.length))];
  const lift = u * 26;
  ctx.globalAlpha = Math.max(0, 1 - Math.max(0, u - 0.6) / 0.4);
  const at = (i) => {
    const a = (i / lobes) * TAU + seed;
    return [x + Math.cos(a) * R * 0.55, y - R * 0.55 - lift + Math.sin(a) * R * 0.3, R * (0.5 + 0.18 * hash(seed + i))];
  };
  ctx.beginPath();
  for (let i = 0; i < lobes; i++) {
    const [lx, ly, lr] = at(i);
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

/** A crater mark of the big impact: dark patch, pit, a rim, fading over its life (u 0 to 1). */
export function drawCrater(ctx, x, y, r, u) {
  const k = Math.min(1, u * 8);
  const fade = 1 - u;
  ell(ctx, x, y, r * CELL_RX * 0.55 * k, r * CELL_RX * 0.27 * k, `rgba(14,10,8,${0.35 * fade})`, null);
  ell(ctx, x, y, 14 * k, 7 * k, `rgba(42,33,27,${0.9 * fade})`, `rgba(0,0,0,${0.8 * fade})`, 1.6);
  glow(ctx, x, y, 12, '#ff8a2a', 0.35 * Math.max(0, 1 - u * 3));
}

// ======================================================================================
// Mist of the purge shrine
// ======================================================================================

/**
 * The flow of mist of the purge shrine. Out of the artefact a pour of mist falls to the foot of the shrine,
 * and from there waves of mist run out over the ground to the rim of the aura (`R` cells), slowing and
 * thinning; at the rim the mist lies as a bank. `project(x, y)` gives the screen point of a world point on
 * the ground, `pour` the screen point of the artefact. `level` is the aura level (dim while idle).
 */
export function drawMistFlow(ctx, project, cx, cy, R, pour, level, t, reduced) {
  const M = R2.mist;
  const [ox, oy] = project(cx, cy);
  // Work on the ground plane: screen points relative to the centre, height doubled, so a circle of the
  // world is a circle here and a radial gradient follows it.
  const flat = ([x, y]) => [x - ox, (y - oy) * 2];
  const ring = (r, lumpy, phase) => {
    const pts = [];
    for (let i = 0; i < M.lobes; i++) {
      const a = (i / M.lobes) * TAU;
      const bump = 1 + lumpy * Math.sin(i * 2.4 + phase) * (i % 2 ? 1 : 0.5);
      pts.push(flat(project(cx + Math.cos(a) * r * bump, cy + Math.sin(a) * r * bump)));
    }
    return pts;
  };
  const px = CELL_RX;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(1, 0.5);
  /** A soft ring of mist between r0 and r1 cells, densest at `peak` (0 to 1 across it). */
  const band = (r0, r1, peak, alpha, lumpy, phase, colour = '255,243,220') => {
    if (alpha <= 0.005) return;
    const g = ctx.createRadialGradient(0, 0, Math.max(0, r0 * px), 0, 0, r1 * px * (1 + lumpy));
    g.addColorStop(0, `rgba(${colour},0)`);
    g.addColorStop(peak, `rgba(${colour},${alpha.toFixed(3)})`);
    g.addColorStop(1, `rgba(${colour},0)`);
    smoothClosed(ctx, ring(r1 * (1 + lumpy), lumpy, phase));
    ctx.fillStyle = g;
    ctx.fill();
  };
  // A thin veil over the whole aura, so its reach stays readable.
  band(0, R, 0.85, 0.08 + 0.1 * level, 0.02, t * 0.7);
  // The waves, outermost first; each is soft on both sides and thins as it runs out.
  const waves = [];
  for (let k = 0; k < M.waves; k++) waves.push(reduced ? k / M.waves + 0.12 : ((t / M.period + k / M.waves) % 1));
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
  // A faint line at the reach, so the player still sees where the aura ends.
  ctx.globalAlpha = 0.25 + 0.3 * level;
  ell(ctx, ox, oy, R * px, R * px * 0.5, null, '#ffd66e', 1.2);
  ctx.globalAlpha = 1;
  // The pour: mist falling from the artefact to the foot, and a pool there.
  for (let i = 0; i < M.pour; i++) {
    const f = reduced ? (i + 0.5) / M.pour : ((t * 1.4 + i / M.pour) % 1);
    const qx = pour[0] + (ox - pour[0]) * f + (reduced ? 0 : Math.sin(t * 3 + i * 2) * 2);
    const qy = pour[1] + (oy - pour[1]) * f;
    const rr = 3 + f * 7;
    ctx.globalAlpha = (0.25 + 0.35 * level) * Math.sin(Math.PI * f);
    ell(ctx, qx, qy, rr, rr * 0.8, '#fff3d8', null);
  }
  glow(ctx, ox, oy, 22, '#fff1cf', 0.35 + 0.3 * level);
  ctx.globalAlpha = 1;
}
