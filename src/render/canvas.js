// Keeps the canvas backing store in sync with its CSS size and the device pixel ratio.

import { MAX_DPR } from '../data/settings.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {(view: {width: number, height: number, dpr: number}) => void} onResize
 */
export function createCanvasView(canvas, onResize) {
  const view = { width: 0, height: 0, dpr: 1 };

  function update() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (width === view.width && height === view.height && dpr === view.dpr) return;

    view.width = width;
    view.height = height;
    view.dpr = dpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    onResize(view);
  }

  // ResizeObserver catches layout changes; the window events catch rotation and
  // DPR changes (moving the window to another screen, browser zoom).
  new ResizeObserver(update).observe(canvas);
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  window.visualViewport?.addEventListener('resize', update);
  update();

  return view;
}
