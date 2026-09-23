// Diorama behind the map: sky, burning horizon and two rows of ruined spires,
// as in reference/stiltest.html.
//
// The layer is built once per viewport size into an offscreen canvas and only
// shifted afterwards, with a slight parallax against the camera so the map
// reads as a slab standing in a landscape instead of a picture on a wall.

import { createRng } from '../core/random.js';
import { worldToScreen } from './camera.js';

/** Extra width and height built around the viewport so a shift never shows an edge. */
const PAD_X = 260;
const PAD_Y = 150;
/** Fraction of the map's screen offset the backdrop follows. */
const PARALLAX_X = 0.14;
const PARALLAX_Y = 0.07;
/**
 * Horizon of the far row as a fraction of the layer height. High enough that the
 * skyline stands above the map slab in the start view instead of behind it.
 */
const HORIZON = 0.26;
/** The near row stands this much further down the layer. */
const NEAR_DROP = 0.09;
/** Largest backing store in pixels (iPad Safari caps canvas memory). */
const MAX_PIXELS = 8_000_000;

/** Shift of the layer against the camera, limited to the padding around the viewport. */
export function parallaxOffset(delta, factor, pad) {
  return Math.max(-pad, Math.min(pad, delta * factor));
}

/** One ruined spire with two lower annexes; `lit` adds a few burning windows. */
function spire(g, x, base, w, h, colour, lit, rng) {
  g.fillStyle = colour;
  g.beginPath();
  g.moveTo(x, base);
  g.lineTo(x, base - h * 0.62);
  g.lineTo(x + w * 0.5, base - h);
  g.lineTo(x + w, base - h * 0.62);
  g.lineTo(x + w, base);
  g.closePath();
  g.fill();
  g.fillRect(x - w * 0.18, base - h * 0.5, w * 0.18, h * 0.5);
  g.beginPath();
  g.moveTo(x - w * 0.18, base - h * 0.5);
  g.lineTo(x - w * 0.09, base - h * 0.66);
  g.lineTo(x, base - h * 0.5);
  g.fill();
  g.fillRect(x + w, base - h * 0.42, w * 0.2, h * 0.42);
  g.beginPath();
  g.moveTo(x + w, base - h * 0.42);
  g.lineTo(x + w * 1.1, base - h * 0.56);
  g.lineTo(x + w * 1.2, base - h * 0.42);
  g.fill();
  if (!lit) return;
  g.fillStyle = 'rgba(255,140,60,.55)';
  for (let i = 0; i < 3; i++) {
    if (rng.chance(0.5)) g.fillRect(x + w * (0.3 + rng.next() * 0.35), base - h * (0.2 + rng.next() * 0.35), 2.5, 5);
  }
}

function buildLayer(g, w, h, rng) {
  const horizon = h * HORIZON;

  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0d0907');
  sky.addColorStop(Math.min(0.95, horizon / h), '#382017');
  sky.addColorStop(1, '#1a120e');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  // Fires beyond the horizon, brightest behind the middle of the map.
  const glow = g.createRadialGradient(w / 2, horizon, 20, w / 2, horizon, Math.max(w, h) * 0.45);
  glow.addColorStop(0, 'rgba(255,125,45,.32)');
  glow.addColorStop(0.4, 'rgba(170,55,22,.14)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);

  // Far row: flat silhouettes, no lights.
  for (let x = -40; x < w + 40; ) {
    const sw = 18 + rng.next() * 30;
    // Taller than the near row so the far skyline still peeks over it.
    spire(g, x, horizon, sw, 90 + rng.next() * 150, '#4a2d1e', false, rng);
    x += sw * 0.9 + rng.next() * 50;
  }
  const haze = g.createLinearGradient(0, horizon - 150, 0, horizon + 14);
  haze.addColorStop(0, 'rgba(140,62,32,0)');
  haze.addColorStop(1, 'rgba(140,62,32,.5)');
  g.fillStyle = haze;
  g.fillRect(0, horizon - 150, w, 164);

  // Near row: darker, taller, with burning windows.
  const nearBase = horizon + h * NEAR_DROP;
  for (let x = -60; x < w + 60; ) {
    const sw = 30 + rng.next() * 50;
    spire(g, x, nearBase, sw, 60 + rng.next() * 150, '#170f0c', true, rng);
    x += sw * 1.1 + rng.next() * 70;
  }
  const dusk = g.createLinearGradient(0, nearBase - 90, 0, h);
  dusk.addColorStop(0, 'rgba(60,30,20,0)');
  dusk.addColorStop(0.45, 'rgba(40,22,16,.7)');
  dusk.addColorStop(1, 'rgba(24,14,10,.92)');
  g.fillStyle = dusk;
  g.fillRect(0, nearBase - 90, w, h - nearBase + 90);
}

export function createBackdropLayer() {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  let key = '';
  /** CSS pixels of the layer, padding included. */
  let width = 0;
  let height = 0;
  /** Backing pixels per CSS pixel of the layer. */
  let scale = 1;

  function build(view, seed) {
    width = view.width + PAD_X * 2;
    height = view.height + PAD_Y * 2;
    scale = Math.min(view.dpr, Math.sqrt(MAX_PIXELS / (width * height)));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    g.setTransform(scale, 0, 0, scale, 0, 0);
    buildLayer(g, width, height, createRng(`backdrop:${seed}`));
  }

  return {
    /**
     * Draws the cached layer, offset by the parallax and the screen shake.
     * @param {number} shakeX  Shake in CSS pixels; the backdrop takes half of it.
     * @param {number} shakeY
     */
    draw(ctx, view, cam, seed, shakeX = 0, shakeY = 0) {
      const k = `${view.width}x${view.height}@${view.dpr}:${seed}`;
      if (k !== key) {
        key = k;
        build(view, seed);
      }
      // World origin (0, 0) is the top corner of the map; how far it sits from the
      // middle of the screen tells us how much the backdrop should follow.
      const [ax, ay] = worldToScreen(cam, view, 0, 0);
      const dx = parallaxOffset(ax - view.width / 2, PARALLAX_X, PAD_X);
      const dy = parallaxOffset(ay - view.height / 2, PARALLAX_Y, PAD_Y);
      // Only the piece under the viewport is copied; the padding exists so that
      // piece never runs past the edge of the layer.
      const sx = (PAD_X - dx - shakeX * 0.5) * scale;
      const sy = (PAD_Y - dy - shakeY * 0.5) * scale;
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(canvas, sx, sy, view.width * scale, view.height * scale, 0, 0, view.width, view.height);
    },
  };
}
