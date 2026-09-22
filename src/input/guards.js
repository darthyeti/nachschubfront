// Suppresses browser gestures that fight with the game on touch devices.

export function installPageGuards(canvas) {
  // Long press must not open a context menu (it will show info in the game).
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // Safari ignores touch-action for pinch on the page; block its proprietary gesture events.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  }
}
