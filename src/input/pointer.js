// DOM adapter: forwards Pointer Events and wheel input from the canvas to the
// gesture recognizer. Coordinates are CSS pixels relative to the canvas.

import { POINTER, CAMERA } from '../data/settings.js';
import { createGestureRecognizer } from './gestures.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('./gestures.js').Callbacks & {
 *   onHover?: (x: number | null, y: number | null) => void,
 * }} callbacks
 */
export function attachPointerInput(canvas, callbacks) {
  const gestures = createGestureRecognizer(POINTER, callbacks);

  const sample = (ev) => {
    const rect = canvas.getBoundingClientRect();
    return {
      pointerId: ev.pointerId,
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
      button: ev.button,
      pointerType: ev.pointerType || 'mouse',
    };
  };

  canvas.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    try {
      canvas.setPointerCapture(ev.pointerId);
    } catch {
      // Capture can fail for synthetic events; tracking still works without it.
    }
    gestures.down(sample(ev));
  });

  canvas.addEventListener('pointermove', (ev) => {
    const s = sample(ev);
    gestures.move(s);
    if (s.pointerType === 'mouse') {
      if (gestures.dragging) callbacks.onHover?.(null, null);
      else if (ev.buttons === 0) callbacks.onHover?.(s.x, s.y);
    }
  });

  canvas.addEventListener('pointerup', (ev) => gestures.up(sample(ev)));
  canvas.addEventListener('pointercancel', (ev) => gestures.cancel(sample(ev)));
  canvas.addEventListener('pointerleave', (ev) => {
    if (ev.pointerType === 'mouse') callbacks.onHover?.(null, null);
  });

  canvas.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      // Pixel deltas: a classic wheel notch is ~100 px. Line deltas are ~33 px each.
      const pixels = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaMode === 2 ? ev.deltaY * 400 : ev.deltaY;
      // Trackpad pinch arrives as a ctrl+wheel with small deltas; make it more responsive.
      const perPixel = Math.log(CAMERA.wheelZoomStep) / (ev.ctrlKey ? 12 : 100);
      const factor = Math.exp(-pixels * perPixel);
      callbacks.onZoom?.(factor, ev.clientX - rect.left, ev.clientY - rect.top);
    },
    { passive: false },
  );

  return gestures;
}
