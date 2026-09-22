// Landing zones and supply pods, drawn after reference/stiltest.html.
// M2 shows warning, fall, impact, opening and hologram; the full staging with
// brake thrusters, bolts and hatches follows in M4.

import { iso } from './iso.js';
import { poly, ell, shadow, comicText } from './draw.js';
import { C } from './palette.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { STRINGS } from '../data/strings.js';
import { PODS } from '../data/pods.js';
import { IMPACT_SECONDS, sinceImpact } from '../sim/pods.js';

/** Pod size relative to the style test's drawing units. */
const SCALE = 1.45;
/** Height the pod starts from, in screen pixels. */
const FALL_HEIGHT = 900;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Height above the ground while falling. */
function podHeight(pod) {
  const u = clamp01((pod.t - PODS.warnSeconds) / PODS.fallSeconds);
  return FALL_HEIGHT * (1 - u) * (1 - 0.55 * u);
}

const DIRS = [
  [32, 16],
  [-32, 16],
  [-32, -16],
  [32, -16],
].map(([x, y]) => {
  const l = Math.hypot(x, y);
  return [x / l, y / l];
});
const PERP = [DIRS[1], DIRS[0], DIRS[1], DIRS[0]];

/** One of the four hatch petals, `open` from 0 (closed) to 1. */
function petal(ctx, i, open, color) {
  const [dx, dy] = DIRS[i];
  const [px, py] = PERP[i];
  const r0 = 10;
  const len = 31;
  const hx = dx * r0;
  const hy = dy * r0 * 0.9;
  const tx = dx * (r0 + len * open);
  const ty = dy * (r0 + len * open) * 0.9 - (1 - open) * 50;
  const shape = [
    [hx + px * 9, hy + py * 9],
    [hx - px * 9, hy - py * 9],
    [tx - px * 12.5, ty - py * 12.5],
    [tx + px * 12.5, ty + py * 12.5],
  ];
  const fill = open > 0.55 ? '#a39c90' : i === 0 ? '#56514c' : i === 1 ? '#7a746c' : '#4a4642';
  poly(ctx, shape, fill, C.ink, 2);
  ctx.strokeStyle = open > 0.55 ? color : C.blood;
  ctx.lineWidth = open > 0.55 ? 2.5 : 3;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
}

/** The steel body with hazard band, rivets and blinking light. */
function podCore(ctx, pod, heat, t) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-12, -46);
    ctx.lineTo(-12, 0);
    ctx.ellipse(0, 0, 12, 6, 0, Math.PI, 0, true);
    ctx.lineTo(12, -46);
    ctx.lineTo(5, -64);
    ctx.lineTo(-5, -64);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = C.steel;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = C.steelD;
  ctx.fillRect(3, -70, 12, 80);
  ctx.fillStyle = C.steelL;
  ctx.fillRect(-12, -70, 4, 80);
  ctx.strokeStyle = 'rgba(26,20,16,.75)';
  ctx.lineWidth = 1.3;
  for (const y of [-10, -20, -41]) {
    ctx.beginPath();
    ctx.ellipse(0, y, 12, 6, 0, 0, Math.PI);
    ctx.stroke();
  }
  ctx.fillStyle = C.blood;
  ctx.beginPath();
  ctx.moveTo(-13, -34);
  ctx.ellipse(0, -34, 13, 6.5, 0, Math.PI, 0, true);
  ctx.lineTo(13, -28);
  ctx.ellipse(0, -28, 13, 6.5, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8b93a';
  for (let i = 0; i < 5; i++) ctx.fillRect(-10 + i * 5, -46, 2.5, 4);
  if (heat > 0) {
    ctx.fillStyle = `rgba(255,110,30,${heat * 0.6})`;
    ctx.fillRect(-14, -70, 28, 80);
  }
  ctx.restore();
  path();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  for (const x of [-8, -3, 2, 7]) ell(ctx, x, -31 + Math.abs(x) * 0.12, 1.1, 1.1, C.ink, null);
  ell(ctx, 0, -19, 3.5, 3.5, C.bone, C.ink, 1);
  const on = Math.sin(t * 11 + pod.x) > 0;
  ell(ctx, 0, -65, 3, 1.8, on ? '#ff3a2a' : '#5a1a14', C.ink, 1);
}

/** How far the hatch petal `i` has opened. */
function petalOpen(pod) {
  const since = sinceImpact(pod);
  return (i) => {
    const order = [3, 0, 2, 1].indexOf(i);
    const u = clamp01((since - PODS.openDelaySeconds - order * 0.13) / 0.22);
    return u * u;
  };
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
export function drawPod(ctx, pod, t) {
  if (pod.t < PODS.warnSeconds) return;
  const [sx, sy] = iso(pod.x + 0.5, pod.y + 0.5);
  const z = pod.landed ? 0 : podHeight(pod);
  const since = sinceImpact(pod);
  const heat = pod.landed ? Math.max(0, 1 - since / 3) : 1;
  const color = DOCTRINE_COLORS[pod.doctrine];
  const k = 1 - Math.min(1, z / FALL_HEIGHT);
  shadow(ctx, sx, sy + 2, (12 + 14 * k) * SCALE, (5 + 6 * k) * SCALE, 0.45 * k + 0.05);

  const by = sy - z;
  if (!pod.landed) {
    const trail = ctx.createLinearGradient(sx, by - 380, sx, by - 50);
    trail.addColorStop(0, 'rgba(255,140,50,0)');
    trail.addColorStop(1, 'rgba(255,190,110,.85)');
    ctx.strokeStyle = trail;
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(sx, by - 380);
    ctx.lineTo(sx, by - 50);
    ctx.stroke();
    if (z < 280) {
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
  }

  ctx.save();
  ctx.translate(sx, by);
  ctx.scale(SCALE, SCALE);
  const open = petalOpen(pod);
  for (const i of [2, 3]) petal(ctx, i, open(i), color);
  const glow = clamp01((since - 1.3) / 0.6);
  if (glow > 0) {
    ctx.globalAlpha = glow * 0.55;
    ell(ctx, 0, 0, 22, 11, color, null);
    ctx.globalAlpha = 1;
  }
  podCore(ctx, pod, heat, t);
  for (const i of [0, 1]) petal(ctx, i, open(i), color);
  ctx.restore();
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
