// Camera: pan and zoom over the iso world. Pure math except applyCamera().
// A camera { x, y, zoom } shows world pixel (x, y) at the centre of the viewport.

import { isoInverse } from './iso.js';

export function createCamera() {
  return { x: 0, y: 0, zoom: 1 };
}

export function worldToScreen(cam, view, wx, wy) {
  return [(wx - cam.x) * cam.zoom + view.width / 2, (wy - cam.y) * cam.zoom + view.height / 2];
}

export function screenToWorld(cam, view, sx, sy) {
  return [(sx - view.width / 2) / cam.zoom + cam.x, (sy - view.height / 2) / cam.zoom + cam.y];
}

/** Screen point (CSS pixels) to the grid cell under it at ground level. */
export function screenToCell(cam, view, sx, sy) {
  const [wx, wy] = screenToWorld(cam, view, sx, sy);
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
