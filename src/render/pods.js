// Landing zones and supply pods. Since 0.10.5 the capsule is draft B of the capsule
// study (docs/ART.md, "Nachschubkapsel"): slender, with a brake tower on the roof and
// landing lugs on the heat shield. Closed it is one sprite; once the bolts blow it is the
// heat shield, a core with the roof, and four wall segments that fall outwards one after
// another.
// Everything that carries the doctrine's colour (the glow in the core, the light column,
// the hologram) stays code, as does everything that moves: the heat veil and tail in the
// fall, the brake flames, the lamps. The dust, smoke and fire of the landing are in
// effects.js.

import { iso } from './iso.js';
import { poly, ell, shadow, comicText } from './draw.js';
import { C } from './palette.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { STRINGS } from '../data/strings.js';
import { PODS } from '../data/pods.js';
import { PLANNING_PHASES } from '../core/phases.js';
import { IMPACT_SECONDS, sinceImpact } from '../sim/pods.js';
import { podSpriteSet } from './sprites/compose.js';
import { SPRITE_SCALE, POD_ANCHORS, POD_PETALS, POD_OPEN_SCALE } from './sprites/manifest.js';
import { drawSprite, drawSpriteShadow, drawSpriteTurned } from './sprites/rasterizer.js';
import {
  FALL_HEIGHT,
  HEAT_SECONDS,
  brakePower,
  isOpening,
  petalOpen,
  podHeight,
  shellFade,
} from './podTiming.js';

export { isOpening, petalOpen, shellFade };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Scale of the closed capsule and of the opened one, in world pixels per SVG unit. */
const K = SPRITE_SCALE.pod;
const O = K * POD_OPEN_SCALE;
/** The study draws at 0.95; the veil and flames are sized in its units. */
const Q = K / 0.95;

/** Opacity of the re-entry glow laid over the cold sprite at full heat. */
const HEAT_ALPHA = 0.5;
/** Seconds the selection takes to lift the segments of the chosen capsule. */
const FOCUS_EASE = 7;
/** How far the chosen capsule's segments lift, in SVG units, and how much they grow. */
const FOCUS_LIFT = 6;
const FOCUS_GROW = 0.05;

/** Marker of a planned landing zone: dashed ring with its number. */
export function drawZoneMarker(ctx, zone, index, t, reducedMotion) {
  const [x, y] = iso(zone.x + 0.5, zone.y + 0.5);
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = reducedMotion ? 0 : -t * 12;
  ell(ctx, x, y, 26, 13, 'rgba(242,193,78,.15)', C.gold, 2.5);
  ctx.setLineDash([]);
  comicText(ctx, String(index + 1), x, y + 7, 22, C.gold);
}

/**
 * Which cleared cells still carry a mark: none once the wave runs, and none a
 * capsule has come down on (docs/ART.md). Pure, so the rule is testable.
 * @param {string} phase
 * @param {{x: number, y: number, landed: boolean}[]} pods
 * @param {{x: number, y: number}[]} cells
 */
export function keepClearedCells(phase, pods, cells) {
  if (!cells.length) return cells;
  if (!PLANNING_PHASES.has(phase)) return [];
  const landed = pods.filter((pod) => pod.landed);
  if (!landed.length) return cells;
  return cells.filter((c) => !landed.some((pod) => pod.x === c.x && pod.y === c.y));
}

/**
 * A cell the player has just cleared in demolish mode (docs/ART.md): the same
 * dashed ring as a landing zone, only fainter and without a number, so the
 * freed ground can be found again when the next salvo is called.
 */
export function drawClearedMarker(ctx, cell, t, reducedMotion) {
  const [x, y] = iso(cell.x + 0.5, cell.y + 0.5);
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = reducedMotion ? 0 : -t * 12;
  ctx.globalAlpha = 0.45;
  ell(ctx, x, y, 26, 13, 'rgba(242,193,78,.08)', C.gold, 2);
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

/** Target marker under a pod that is still on its way. */
export function drawPodTarget(ctx, pod, t) {
  if (pod.landed) return;
  const [x, y] = iso(pod.x + 0.5, pod.y + 0.5);
  const u = clamp01(pod.t / IMPACT_SECONDS);
  const pulse = 0.5 + 0.5 * Math.sin(t * 16);
  ell(ctx, x, y, 32, 16, `rgba(255,40,20,${0.12 + pulse * 0.14})`, '#ff3a2a', 2.5);
  const r = 6 + 40 * (1 - u);
  ell(ctx, x, y, r, r * 0.5, null, 'rgba(255,220,180,.9)', 2);
  ctx.strokeStyle = '#ff3a2a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x + 10, y);
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x, y + 5);
  ctx.stroke();
}

/** The capsule's sprites; the same for every pod, so they are built once. */
const SET = podSpriteSet();

/** Every pod sprite, for preloading before the first salvo. */
export const POD_SPRITE_DEFS = [SET.shell, SET.base, SET.core, ...SET.petals.map((p) => p.sprite)];

/**
 * The brake nozzles on the roof tower, with the way each flame leaves its mouth:
 * mostly down and a little outwards, along the direction its segment falls in
 * (the study's bell function).
 */
const NOZZLES = POD_ANCHORS.nozzles.map(([x, y], i) => {
  const a = POD_PETALS[i].angle;
  const dx = Math.cos(a) * 0.3;
  const dy = Math.sin(a) * 0.15 + 1;
  const len = Math.sqrt(dx * dx + dy * dy);
  return { x: x * K, y: y * K, dx: dx / len, dy: dy / len, a };
});

/** Width of a nozzle's mouth, in px (3.4 units in the study). */
const NOZZLE_WIDTH = 3.4 * Q;

/** Longest brake flame, in px. */
const FLAME_LENGTH = 120 * Q;

/** Flame of one brake nozzle: three layers, flickering. */
function drawFlame(ctx, nozzle, length, t) {
  if (length < 4) return;
  const flicker = 0.88 + 0.12 * Math.sin(t * 52 + nozzle.a * 3.1) + 0.06 * Math.sin(t * 91 + nozzle.a);
  const L = length * flicker;
  const { x, y, dx, dy } = nozzle;
  const nx = -dy;
  const ny = dx;
  const layer = (w0, w1, color) => {
    ctx.beginPath();
    ctx.moveTo(x + nx * w0, y + ny * w0);
    ctx.quadraticCurveTo(x + dx * L * 0.55 + nx * w1, y + dy * L * 0.55 + ny * w1, x + dx * L, y + dy * L);
    ctx.quadraticCurveTo(x + dx * L * 0.55 - nx * w1, y + dy * L * 0.55 - ny * w1, x - nx * w0, y - ny * w0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  layer(NOZZLE_WIDTH * 1.5, NOZZLE_WIDTH * 2.4, 'rgba(255,110,40,.45)');
  layer(NOZZLE_WIDTH * 1.1, NOZZLE_WIDTH * 1.5, 'rgba(255,184,76,.85)');
  layer(NOZZLE_WIDTH * 0.6, NOZZLE_WIDTH * 0.7, 'rgba(255,248,214,.95)');
}

/**
 * Re-entry: the veil of hot air round the capsule and the tail behind it, translucent
 * and without a hard edge. The origin is the foot of the capsule.
 */
function drawVeil(ctx, z, t) {
  const top = POD_ANCHORS.top * K;
  const tail = Math.min(520, 150 + (FALL_HEIGHT - z) * 0.6, z + 400);
  const wob = Math.sin(t * 40) * 1.5;
  const layer = (w, color, len) => {
    ctx.beginPath();
    ctx.moveTo(-w, -top * 0.4);
    ctx.quadraticCurveTo(-w * 0.9, -top - len * 0.4, wob, -top - len);
    ctx.quadraticCurveTo(w * 0.9, -top - len * 0.4, w, -top * 0.4);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  layer(34 * Q, 'rgba(255,92,30,.16)', tail);
  layer(24 * Q, 'rgba(255,150,60,.26)', tail * 0.8);
  layer(14 * Q, 'rgba(255,214,130,.4)', tail * 0.55);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(255,230,170,.8)';
  ctx.globalAlpha = 0.5;
  for (let k = 0; k < 6; k++) {
    const xx = (k - 2.5) * 9 * Q + Math.sin(t * 17 + k) * 2;
    ctx.beginPath();
    ctx.moveTo(xx, -top - (20 + k * 6) * Q);
    ctx.lineTo(xx * 1.1, -top - tail * (0.5 + 0.08 * ((k * 5) % 4)));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const [rx, ry, a] of [[44, 56, 0.1], [36, 46, 0.14], [28, 36, 0.18]]) {
    ell(ctx, 0, -top * 0.45, rx * Q, ry * Q, `rgba(255,150,70,${a})`, null);
  }
  // The hot bow below the shield.
  ell(ctx, 0, 4 * Q, 40 * Q, 20 * Q, 'rgba(255,190,100,.28)', null);
  ell(ctx, 0, 3 * Q, 26 * Q, 13 * Q, 'rgba(255,236,170,.45)', null);
}

/**
 * The hologram shrank with the capsule in v3 (docs/ART.md). Same fifth, so the
 * plate keeps its relation to the capsule underneath it.
 */
const HOLO_SCALE = 0.8;

/** How high the plate floats above its capsule before the stagger. */
const HOLO_BASE = 150 * HOLO_SCALE;

/**
 * Extra height, so two capsules on touching cells do not write their labels
 * into one another. Derived from the cell, not from the salvo, so it is the
 * same every time and needs no state: the step is 2 across and 3 down, which
 * puts all four neighbours of a cell on different levels.
 */
export function hologramLift(x, y) {
  return (((x * 2 + y * 3) % 4) + 4) % 4;
}

/** Opacity of the hologram, 0 until it fades in. */
function hologramAlpha(pod) {
  return clamp01((sinceImpact(pod) - PODS.hologramDelaySeconds) / PODS.hologramSeconds);
}

/** Height of the plate over the foot of its capsule, in px (bobbing included). */
function plateY(pod, sy, t) {
  return sy - HOLO_BASE - hologramLift(pod.x, pod.y) * 18 + Math.sin(t * 2.2 + pod.x) * 4;
}

/** Rising sparks in the light column of the chosen capsule. */
const COLUMN_SPARKS = 7;

/**
 * The light column from the opened capsule up to its hologram. It is drawn with the
 * capsule, behind it, so it does not tint the figure (docs/ART.md); the chosen capsule
 * gets a layered, stronger column with rising sparks.
 */
function drawBeam(ctx, pod, sx, sy, t, focus, reducedMotion) {
  const alpha = hologramAlpha(pod);
  if (alpha <= 0) return;
  const s = HOLO_SCALE;
  const y = plateY(pod, sy, t);
  const color = DOCTRINE_COLORS[pod.doctrine];
  ctx.globalAlpha = alpha * 0.18;
  poly(ctx, [[sx - 16 * s, sy - 20], [sx + 16 * s, sy - 20], [sx + 30 * s, y], [sx - 30 * s, y]], color, null);
  if (focus > 0.01) {
    const top = sy - 100;
    for (const [w0, w1, a] of [[22, 34, 0.12], [15, 24, 0.16], [8, 14, 0.2]]) {
      ctx.globalAlpha = alpha * a * focus;
      poly(ctx, [[sx - w0, sy - 30], [sx + w0, sy - 30], [sx + w1, top], [sx - w1, top]], color, null);
    }
    ctx.fillStyle = color;
    for (let k = 0; k < COLUMN_SPARKS; k++) {
      const u = reducedMotion ? k / COLUMN_SPARKS : (t * 0.6 + k / COLUMN_SPARKS) % 1;
      ctx.globalAlpha = alpha * (1 - u) * 0.9 * focus;
      ctx.fillRect(sx + Math.sin(k * 5.1) * 14 - 1.5, sy - 34 - u * 70, 3, 3);
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * The pod itself: fall trail, brake flames, shell and the segments opening.
 * @param {ReturnType<import('./sprites/rasterizer.js').createSpriteCache>} cache
 */
export function createPodRenderer(cache) {
  /** Eased selection of every pod: how far its segments are lifted, 0 to 1. */
  const focusOf = new WeakMap();

  function focusFor(pod, t, view) {
    if (view.focus !== undefined) return view.focus;
    const target = view.selectedPod === pod ? 1 : 0;
    let entry = focusOf.get(pod);
    if (!entry) {
      entry = { value: target, t };
      focusOf.set(pod, entry);
    }
    const dt = Math.min(0.1, Math.max(0, t - entry.t));
    entry.t = t;
    entry.value += (target - entry.value) * Math.min(1, dt * FOCUS_EASE);
    if (Math.abs(target - entry.value) < 0.003) entry.value = target;
    return entry.value;
  }

  /**
   * @param {{zoom: number, dpr: number, heat?: number, focus?: number, selectedPod?: object,
   *   reducedMotion?: boolean}} view  `heat` overrides the re-entry glow, which the sprite
   *   gallery needs: a capsule is only ever closed while it is still hot, so there is no
   *   moment in time that shows the cold shell. `focus` overrides the eased selection,
   *   `selectedPod` is the pod the player has picked.
   * @returns {boolean} False when nothing is rasterized yet, so a caller can fall back.
   */
  function drawPod(ctx, pod, t, view) {
    if (pod.t < PODS.warnSeconds) return true;
    const { zoom, dpr } = view;
    const [sx, sy] = iso(pod.x + 0.5, pod.y + 0.5);
    const z = pod.landed ? 0 : podHeight(pod);
    const since = sinceImpact(pod);
    const heat = view.heat ?? (pod.landed ? Math.max(0, 1 - since / HEAT_SECONDS) : 1);
    const color = DOCTRINE_COLORS[pod.doctrine];
    const focus = pod.landed ? focusFor(pod, t, view) : 0;
    const k = 1 - Math.min(1, z / FALL_HEIGHT);
    // While it falls its shadow is an ellipse on the ground that grows as it comes down; once
    // it stands, the silhouette of shell or core takes over (below).
    if (!pod.landed) shadow(ctx, sx, sy + 2, 18 + 15 * k, 7 + 7 * k, 0.45 * k + 0.05);

    const by = sy - z;
    if (pod.landed) drawBeam(ctx, pod, sx, sy, t, focus, view.reducedMotion);
    if (!pod.landed) {
      ctx.save();
      ctx.translate(sx, by);
      drawVeil(ctx, z, t);
      ctx.restore();
    }
    if (heat > 0.05) {
      // The shield glows round its rim.
      ctx.globalAlpha = heat * 0.5;
      const r = POD_ANCHORS.shieldRadius * (isOpening(pod) ? O : K);
      ell(ctx, sx, by - 2, r, r * 0.5, null, '#ffb15a', 3);
      ctx.globalAlpha = 1;
    }

    // Re-entry heat: the rasterizer keeps a bright variant of every sprite, and
    // it is laid over the cold one with the heat as its opacity. Switching
    // between the two would turn the capsule white and then grey again in one
    // step; this way it cools down.
    const glowOver = (def, entry, alpha = 1) => {
      if (heat <= 0.02) return;
      ctx.globalAlpha = heat * HEAT_ALPHA * alpha;
      drawSprite(ctx, def, entry, 0, 0, { flash: true });
      ctx.globalAlpha = 1;
    };
    const lamps = (scale) => {
      if (Math.floor(t * 2) % 2 === 0) return;
      for (const [lx, ly] of POD_ANCHORS.lamps) ell(ctx, lx * scale, ly * scale, (1.7 * scale) / 0.95, (1.7 * scale) / 0.95, '#ffb14a', null);
    };

    if (!isOpening(pod)) {
      const entry = cache.get(SET.shell, zoom, dpr);
      if (!entry) return false;
      if (pod.landed) drawSpriteShadow(ctx, SET.shell, entry, sx, sy);
      ctx.save();
      ctx.translate(sx, by);
      drawSprite(ctx, SET.shell, entry, 0, 0);
      glowOver(SET.shell, entry);
      lamps(K);
      // The brake nozzles: lit in the last stretch of the fall, a moment past the touchdown.
      const power = brakePower(pod);
      if (power > 0.01) {
        for (const nozzle of NOZZLES) drawFlame(ctx, nozzle, Math.min(FLAME_LENGTH * power, z + 8 - nozzle.y), t);
      }
      ctx.restore();
      return true;
    }

    const core = cache.get(SET.core, zoom, dpr);
    const base = cache.get(SET.base, zoom, dpr);
    if (!core || !base) return false;
    if (pod.landed) {
      drawSpriteShadow(ctx, SET.core, core, sx, sy);
      drawSpriteShadow(ctx, SET.base, base, sx, sy);
    }
    ctx.save();
    ctx.translate(sx, by);
    // The opened parts start at the size of the closed capsule and settle on their own,
    // smaller scale while the shell comes apart.
    const burst = 1 - shellFade(since);
    const settle = K / O + (1 - K / O) * burst;
    ctx.scale(settle, settle);

    // The shell comes apart rather than disappearing between two frames; it is drawn at
    // its own scale, so it is undone here.
    const fade = shellFade(since);
    if (fade > 0) {
      const shell = cache.get(SET.shell, zoom, dpr);
      if (shell) {
        ctx.save();
        ctx.scale(1 / settle, 1 / settle);
        ctx.globalAlpha = fade;
        drawSprite(ctx, SET.shell, shell, 0, 0);
        ctx.globalAlpha = 1;
        glowOver(SET.shell, shell, fade);
        ctx.restore();
      }
    }

    drawSprite(ctx, SET.base, base, 0, 0);
    glowOver(SET.base, base, 1 - fade);
    const petal = (p) => {
      const entry = cache.get(p.sprite, zoom, dpr);
      const u = petalOpen(since, p.order);
      // A segment below a sliver of its length is still inside the shell.
      if (!entry || u < 0.04) return;
      const lift = u > 0.99 ? focus : 0;
      drawSpriteTurned(ctx, p.sprite, entry, 0, 0, p.hinge, 0, {
        scale: u * (1 + FOCUS_GROW * lift),
        offset: lift ? [0, -FOCUS_LIFT * lift] : undefined,
      });
    };

    for (const p of SET.petals) if (p.layer === 'back') petal(p);
    // The core lights up in the doctrine's colour once the segments are down.
    const glow = clamp01((since - PODS.openDelaySeconds - PODS.openSeconds * 0.6) / 0.4);
    if (glow > 0) {
      // It lights the ground between the plates ...
      for (const [r, a] of [[60, 0.1], [46, 0.14], [32, 0.2]]) {
        ctx.globalAlpha = glow * a * (1 + focus * 0.6);
        ell(ctx, 0, 0, r * O / 0.8, r * O * 0.5 / 0.8, color, null);
      }
      ctx.globalAlpha = 1;
    }
    drawSprite(ctx, SET.core, core, 0, 0);
    glowOver(SET.core, core, 1 - fade);
    if (focus > 0.01) {
      // ... and burns brighter in the chosen capsule.
      ctx.globalAlpha = focus * 0.28 * glow;
      drawSprite(ctx, SET.core, core, 0, 0, { flash: true });
      ctx.globalAlpha = 1;
    }
    if (glow > 0.01) {
      // Rings of light round the core, the doctrine's colour over the dark groove of the sprite.
      const rc = POD_ANCHORS.coreRadius * O + 0.4;
      ctx.lineCap = 'butt';
      for (const ring of POD_ANCHORS.rings) {
        ctx.beginPath();
        ctx.ellipse(0, -ring * O, rc, rc * 0.5, 0, 0, Math.PI, false);
        ctx.strokeStyle = color;
        ctx.globalAlpha = clamp01(glow * (0.7 + focus * 0.3));
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = glow * (0.3 + focus * 0.4);
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // The core's own halo.
      const cy = -17 * O;
      for (const [r, a] of [[12, 0.1], [7, 0.14], [3, 0.2]]) {
        ctx.globalAlpha = glow * a * (1 + focus * 0.8);
        const rr = rc + r * O;
        ell(ctx, 0, cy, rr, rr * 1.5, color, null);
      }
      ctx.globalAlpha = glow * (0.5 + focus * 0.35);
      ell(ctx, 0, -POD_ANCHORS.coreTop * O + 1, rc + 1, (rc + 1) * 0.5, color, null);
      ctx.globalAlpha = 1;
    }
    for (const p of SET.petals) if (p.layer === 'front') petal(p);
    lamps(O);
    ctx.restore();
    return true;
  }

  return drawPod;
}

/** Hologram above an opened pod: doctrine colour, rank chevrons and label. The column is drawn with the capsule. */
export function drawPodHologram(ctx, pod, t) {
  if (!pod.landed) return;
  const alpha = hologramAlpha(pod);
  if (alpha <= 0) return;
  const [sx, sy] = iso(pod.x + 0.5, pod.y + 0.5);
  const s = HOLO_SCALE;
  const y = plateY(pod, sy, t);
  const color = DOCTRINE_COLORS[pod.doctrine];

  ctx.globalAlpha = alpha * 0.3;
  ell(ctx, sx, y, 30 * s, 30 * s, color, null);
  ctx.globalAlpha = alpha;

  const hex = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    hex.push([sx + Math.cos(a) * 18 * s, y + Math.sin(a) * 18 * s]);
  }
  poly(ctx, hex, 'rgba(26,20,16,.88)', C.ink, 6 * s);
  poly(ctx, hex, null, color, 2.5 * s);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2 * s;
  for (let i = 0; i < pod.rank; i++) {
    const yy = y + (8 - i * 4.4) * s;
    ctx.beginPath();
    ctx.moveTo(sx - 8 * s, yy - 3 * s);
    ctx.lineTo(sx, yy);
    ctx.lineTo(sx + 8 * s, yy - 3 * s);
    ctx.stroke();
  }
  comicText(ctx, `${STRINGS.doctrines[pod.doctrine]} ${STRINGS.ranks[pod.rank]}`, sx, y + 40 * s, 17 * s, C.bone);
  ctx.globalAlpha = 1;
}

/**
 * Frame on the cell during the selection (docs/ART.md): brackets in the corners of the
 * diamond for the chosen capsule, a dashed rim for the others. It is an overlay on the
 * field, drawn after the figures, so the opened segments do not hide it.
 */
export function drawPodFrame(ctx, pod, { selected, t, reducedMotion }) {
  const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 5);
  const inset = selected ? 0.04 - pulse * 0.02 : 0.1;
  const corners = [
    iso(pod.x + inset, pod.y + inset),
    iso(pod.x + 1 - inset, pod.y + inset),
    iso(pod.x + 1 - inset, pod.y + 1 - inset),
    iso(pod.x + inset, pod.y + 1 - inset),
  ];
  if (!selected) {
    ctx.setLineDash([5, 6]);
    ctx.lineDashOffset = reducedMotion ? 0 : -t * 14;
    poly(ctx, corners, null, 'rgba(242,193,78,.5)', 2);
    ctx.setLineDash([]);
    return;
  }
  poly(ctx, corners, `rgba(242,193,78,${0.1 + pulse * 0.08})`, null);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [lineWidth, stroke] of [[7, C.ink], [3.4, C.gold]]) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    for (let i = 0; i < 4; i++) {
      const p = corners[i];
      const a = corners[(i + 1) % 4];
      const b = corners[(i + 3) % 4];
      ctx.beginPath();
      ctx.moveTo(p[0] + (a[0] - p[0]) * 0.44, p[1] + (a[1] - p[1]) * 0.44);
      ctx.lineTo(p[0], p[1]);
      ctx.lineTo(p[0] + (b[0] - p[0]) * 0.44, p[1] + (b[1] - p[1]) * 0.44);
      ctx.stroke();
    }
  }
}
