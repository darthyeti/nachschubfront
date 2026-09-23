// Landing zones and supply pods. The capsule itself comes from the concept art
// since M4c (docs/ART.md, "Nachschubkapsel"): closed it is one sprite, open it is
// a core with four wall segments that grow out of it one after another.
// Everything that carries the doctrine's colour — the glow in the core, the
// light column, the hologram — stays code, as does the fall trail and the flame.

import { iso } from './iso.js';
import { poly, ell, shadow, comicText } from './draw.js';
import { C } from './palette.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { STRINGS } from '../data/strings.js';
import { PODS } from '../data/pods.js';
import { IMPACT_SECONDS, sinceImpact } from '../sim/pods.js';
import { podSpriteSet } from './sprites/compose.js';
import { drawSprite, drawSpriteTurned } from './sprites/rasterizer.js';

/** Height the pod starts from, in screen pixels. */
const FALL_HEIGHT = 900;
/** How long the shell glows from re-entry after the impact. */
const HEAT_SECONDS = 2.5;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Height above the ground while falling. */
function podHeight(pod) {
  const u = clamp01((pod.t - PODS.warnSeconds) / PODS.fallSeconds);
  return FALL_HEIGHT * (1 - u) * (1 - 0.55 * u);
}

// The four segments blow open one after the other; together they take
// PODS.openSeconds. The order is kept from M4: opposite corners first.
const PETAL_STAGGER = PODS.openSeconds * 0.22;
const PETAL_SECONDS = PODS.openSeconds * 0.34;

/**
 * How far the segment in that opening position has swung out, 0 to 1.
 * @param {number} since  Seconds since the pod hit the ground.
 */
export function petalOpen(since, order) {
  const u = clamp01((since - PODS.openDelaySeconds - order * PETAL_STAGGER) / PETAL_SECONDS);
  return u * u;
}

/** True once the bolts have blown and the shell is no longer one piece. */
export function isOpening(pod) {
  return sinceImpact(pod) >= PODS.openDelaySeconds;
}

/** Marker of a planned landing zone: dashed ring with its number. */
export function drawZoneMarker(ctx, zone, index, t, reducedMotion) {
  const [x, y] = iso(zone.x + 0.5, zone.y + 0.5);
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = reducedMotion ? 0 : -t * 12;
  ell(ctx, x, y, 26, 13, 'rgba(242,193,78,.15)', C.gold, 2.5);
  ctx.setLineDash([]);
  comicText(ctx, String(index + 1), x, y + 7, 22, C.gold);
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

/** The pod itself: fall trail, thruster, shell and hatches. */
/** The capsule's sprites; the same for every pod, so they are built once. */
const SET = podSpriteSet();

/** Every pod sprite, for preloading before the first salvo. */
export const POD_SPRITE_DEFS = [SET.shell, SET.core, ...SET.petals.map((p) => p.sprite)];

/** Fall trail and brake flame, both code since the style test. */
function drawDescent(ctx, sx, by, z) {
  const trail = ctx.createLinearGradient(sx, by - 380, sx, by - 50);
  trail.addColorStop(0, 'rgba(255,140,50,0)');
  trail.addColorStop(1, 'rgba(255,190,110,.85)');
  ctx.strokeStyle = trail;
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.moveTo(sx, by - 380);
  ctx.lineTo(sx, by - 50);
  ctx.stroke();
  if (z >= 280) return;
  const len = Math.min(z + 8, 110);
  const flame = ctx.createLinearGradient(sx, by, sx, by + len);
  flame.addColorStop(0, 'rgba(255,250,210,1)');
  flame.addColorStop(0.35, 'rgba(255,170,60,.9)');
  flame.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(sx - 15, by + 2);
  ctx.lineTo(sx + 15, by + 2);
  ctx.lineTo(sx + 5, by + len);
  ctx.lineTo(sx - 5, by + len);
  ctx.closePath();
  ctx.fill();
}

/**
 * The pod itself: fall trail, thruster, shell and the segments opening.
 * @param {ReturnType<import('./sprites/rasterizer.js').createSpriteCache>} cache
 */
export function createPodRenderer(cache) {
  /**
   * @param {{zoom: number, dpr: number}} view
   * @returns {boolean} False when nothing is rasterized yet, so a caller can fall back.
   */
  function drawPod(ctx, pod, t, view) {
    if (pod.t < PODS.warnSeconds) return true;
    const { zoom, dpr } = view;
    const [sx, sy] = iso(pod.x + 0.5, pod.y + 0.5);
    const z = pod.landed ? 0 : podHeight(pod);
    const since = sinceImpact(pod);
    const heat = pod.landed ? Math.max(0, 1 - since / HEAT_SECONDS) : 1;
    const color = DOCTRINE_COLORS[pod.doctrine];
    const k = 1 - Math.min(1, z / FALL_HEIGHT);
    // Grown to the heat shield: 66 world pixels across once it is down.
    shadow(ctx, sx, sy + 2, 18 + 15 * k, 7 + 7 * k, 0.45 * k + 0.05);

    const by = sy - z;
    if (!pod.landed) drawDescent(ctx, sx, by, z);

    // Re-entry heat: the rasterizer keeps a bright variant of every sprite, and
    // it is laid over the cold one with the heat as its opacity. Switching
    // between the two would turn the capsule white and then grey again in one
    // step; this way it cools down.
    const glowOver = (def, entry) => {
      if (heat <= 0.02) return;
      ctx.globalAlpha = heat * 0.85;
      drawSprite(ctx, def, entry, sx, by, { flash: true });
      ctx.globalAlpha = 1;
    };

    if (!isOpening(pod)) {
      const entry = cache.get(SET.shell, zoom, dpr);
      if (!entry) return false;
      drawSprite(ctx, SET.shell, entry, sx, by);
      glowOver(SET.shell, entry);
      return true;
    }

    const core = cache.get(SET.core, zoom, dpr);
    if (!core) return false;
    const petal = (p) => {
      const entry = cache.get(p.sprite, zoom, dpr);
      const u = petalOpen(since, p.order);
      // A segment below a sliver of its length is still inside the shell.
      if (!entry || u < 0.04) return;
      drawSpriteTurned(ctx, p.sprite, entry, sx, by, p.hinge, 0, { scale: u });
    };

    for (const p of SET.petals) if (p.layer === 'back') petal(p);
    // The core lights up in the doctrine's colour once the segments are down.
    const glow = clamp01((since - PODS.openDelaySeconds - PODS.openSeconds * 0.6) / 0.4);
    if (glow > 0) {
      ctx.globalAlpha = glow * 0.55;
      ell(ctx, sx, by, 26, 13, color, null);
      ctx.globalAlpha = 1;
    }
    drawSprite(ctx, SET.core, core, sx, by);
    glowOver(SET.core, core);
    for (const p of SET.petals) if (p.layer === 'front') petal(p);
    return true;
  }

  return drawPod;
}

/** Hologram above an opened pod: doctrine colour, rank chevrons and label. */
export function drawPodHologram(ctx, pod, t) {
  if (!pod.landed) return;
  const since = sinceImpact(pod);
  const alpha = clamp01((since - PODS.hologramDelaySeconds) / PODS.hologramSeconds);
  if (alpha <= 0) return;
  const [sx, sy] = iso(pod.x + 0.5, pod.y + 0.5);
  const y = sy - 150 + Math.sin(t * 2.2 + pod.x) * 4;
  const color = DOCTRINE_COLORS[pod.doctrine];

  ctx.globalAlpha = alpha * 0.18;
  poly(ctx, [[sx - 16, sy - 20], [sx + 16, sy - 20], [sx + 30, y], [sx - 30, y]], color, null);
  ctx.globalAlpha = alpha * 0.3;
  ell(ctx, sx, y, 30, 30, color, null);
  ctx.globalAlpha = alpha;

  const hex = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    hex.push([sx + Math.cos(a) * 18, y + Math.sin(a) * 18]);
  }
  poly(ctx, hex, 'rgba(26,20,16,.88)', C.ink, 6);
  poly(ctx, hex, null, color, 2.5);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  for (let i = 0; i < pod.rank; i++) {
    const yy = y + 8 - i * 4.4;
    ctx.beginPath();
    ctx.moveTo(sx - 8, yy - 3);
    ctx.lineTo(sx, yy);
    ctx.lineTo(sx + 8, yy - 3);
    ctx.stroke();
  }
  comicText(ctx, `${STRINGS.doctrines[pod.doctrine]} ${STRINGS.ranks[pod.rank]}`, sx, y + 40, 17, C.bone);
  ctx.globalAlpha = 1;
}

/**
 * Ring around a pod during the selection. It is wider than the opened hatches,
 * so the pick stays visible on the map, not only on the card.
 */
export function drawPodHighlight(ctx, pod, { selected, t, reducedMotion }) {
  const [x, y] = iso(pod.x + 0.5, pod.y + 0.5);
  ctx.setLineDash(selected ? [] : [8, 7]);
  ctx.lineDashOffset = reducedMotion ? 0 : -t * 14;
  ell(ctx, x, y, 48, 24, null, selected ? C.gold : 'rgba(242,193,78,.55)', selected ? 4 : 2.5);
  ctx.setLineDash([]);
  if (selected) ell(ctx, x, y, 55, 27.5, null, 'rgba(242,193,78,.3)', 2);
}
