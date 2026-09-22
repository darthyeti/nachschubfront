// Draws a frame from the game state. Reads state, never writes it.

const BACKGROUND = '#110c0a';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{width: number, height: number, dpr: number}} view
 */
export function renderScene(ctx, view) {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, view.width, view.height);

  // Vignette as in the style test (gradient, no shadowBlur).
  const cx = view.width / 2;
  const cy = view.height / 2;
  const radius = Math.hypot(cx, cy);
  const vignette = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius);
  vignette.addColorStop(0, 'rgba(60, 40, 28, 0.35)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, view.width, view.height);
}
