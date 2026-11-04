// Camera: pan and zoom over the iso world. Pure math except applyCamera().
// A camera { x, y, zoom } shows world pixel (x, y) at the centre of the viewport.

import { isoInverse } from './iso.js';
import { STEP, MAX_LEVEL, fieldSize } from './terrain.js';

export function createCamera() {
  return { x: 0, y: 0, zoom: 1 };
}

export function worldToScreen(cam, view, wx, wy) {
  return [(wx - cam.x) * cam.zoom + view.width / 2, (wy - cam.y) * cam.zoom + view.height / 2];
}

export function screenToWorld(cam, view, sx, sy) {
  return [(sx - view.width / 2) / cam.zoom + cam.x, (sy - view.height / 2) / cam.zoom + cam.y];
}

/**
 * Screen point (CSS pixels) to the grid cell under it. Without `heights` the ground is flat.
 * With the height field (one level 0 to 2 per cell, see terrain.js) the levels are tried from the
 * top down: the first cell whose top face contains the point at its own height and whose level
 * is that level is the one hit. Otherwise a tap on a high field would land on the field behind it.
 * @param {Uint8Array} [heights]
 */
export function screenToCell(cam, view, sx, sy, heights) {
  const [wx, wy] = screenToWorld(cam, view, sx, sy);
  if (heights) {
    const size = fieldSize(heights);
    for (let level = MAX_LEVEL; level > 0; level--) {
      const g = isoInverse(wx, wy + level * STEP);
      const x = Math.floor(g.x);
      const y = Math.floor(g.y);
      if (x >= 0 && y >= 0 && x < size && y < size && heights[y * size + x] === level) return { x, y };
    }
  }
  const g = isoInverse(wx, wy);
  return { x: Math.floor(g.x), y: Math.floor(g.y) };
}

/** Keeps the camera centre inside the map bounds, so the map can never leave the screen. */
export function clampCamera(cam, bounds, limits) {
  cam.zoom = Math.min(limits.maxZoom, Math.max(limits.minZoom, cam.zoom));
  cam.x = Math.min(bounds.x1, Math.max(bounds.x0, cam.x));
  cam.y = Math.min(bounds.y1, Math.max(bounds.y0, cam.y));
  return cam;
}

/** Moves the camera by a screen-space delta (CSS pixels), e.g. from a drag. */
export function panBy(cam, dx, dy) {
  cam.x -= dx / cam.zoom;
  cam.y -= dy / cam.zoom;
}

/** Zooms by `factor` while keeping the world point under screen point (sx, sy) fixed. */
export function zoomAt(cam, view, factor, sx, sy, limits) {
  const [wx, wy] = screenToWorld(cam, view, sx, sy);
  cam.zoom = Math.min(limits.maxZoom, Math.max(limits.minZoom, cam.zoom * factor));
  cam.x = wx - (sx - view.width / 2) / cam.zoom;
  cam.y = wy - (sy - view.height / 2) / cam.zoom;
}

/**
 * Start view: the whole map fits inside the free area between HUD bars,
 * but a cell is never narrower than `minCellPx` (GDD section 13).
 * @param {{top: number, bottom: number, side: number}} insets  CSS pixels kept free.
 */
export function fitCamera(cam, view, bounds, insets, limits) {
  const freeW = Math.max(1, view.width - insets.side * 2);
  const freeH = Math.max(1, view.height - insets.top - insets.bottom);
  const fit = Math.min(freeW / (bounds.x1 - bounds.x0), freeH / (bounds.y1 - bounds.y0));
  const minForCells = limits.minCellPx / 64;
  cam.zoom = Math.min(limits.maxZoom, Math.max(limits.minZoom, fit, minForCells));
  const centreX = (bounds.x0 + bounds.x1) / 2;
  const centreY = (bounds.y0 + bounds.y1) / 2;
  // Shift so the map centre lands in the middle of the free area, not the whole screen.
  const freeCentreY = insets.top + freeH / 2;
  cam.x = centreX;
  cam.y = centreY - (freeCentreY - view.height / 2) / cam.zoom;
  return cam;
}

/** Sets the context transform for drawing in world pixels. */
export function applyCamera(ctx, cam, view) {
  const s = cam.zoom * view.dpr;
  ctx.setTransform(s, 0, 0, s, (view.width / 2 - cam.x * cam.zoom) * view.dpr, (view.height / 2 - cam.y * cam.zoom) * view.dpr);
}

/**
 * A sheet on the phone covers `right` pixels at the right edge and `bottom` at the
 * bottom (M10 E2). The camera follows the centre of what is left: what was in the
 * middle of the screen stays in the middle of the free part. Called with the
 * change of the cover, so opening and closing cancel out. Presentation only.
 * @param {{right: number, bottom: number}} delta  change of the cover in CSS pixels
 */
export function shiftForCover(cam, delta) {
  cam.x += delta.right / 2 / cam.zoom;
  cam.y += delta.bottom / 2 / cam.zoom;
}

/**
 * Brings a world rectangle into the free part of the screen: centred, and zoomed
 * out (never in) until it fits with `margin` pixels to spare. The zoom floor holds.
 * @param {{x0: number, y0: number, x1: number, y1: number}} rect  world pixels
 * @param {{left: number, top: number, right: number, bottom: number}} free  CSS pixels
 */
export function focusRect(cam, view, rect, free, limits, margin = 24) {
  const freeW = Math.max(1, free.right - free.left - margin * 2);
  const freeH = Math.max(1, free.bottom - free.top - margin * 2);
  const w = Math.max(1, rect.x1 - rect.x0);
  const h = Math.max(1, rect.y1 - rect.y0);
  cam.zoom = Math.max(limits.minZoom, Math.min(cam.zoom, freeW / w, freeH / h));
  const fx = (free.left + free.right) / 2;
  const fy = (free.top + free.bottom) / 2;
  cam.x = (rect.x0 + rect.x1) / 2 - (fx - view.width / 2) / cam.zoom;
  cam.y = (rect.y0 + rect.y1) / 2 - (fy - view.height / 2) / cam.zoom;
  return cam;
}
