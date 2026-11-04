// The unlock effect (M10 E1, docs/ART.md "Freischalt-Effekt"): when the command
// points or a command turn up, their symbol does not just appear. A flash, a
// shock ring that swells out of it, and a glow that fades slowly. All of it is
// made of translucent shapes in the DOM, no filters, no canvas. The look and the
// reduced-motion variant live in style.css (.burst); this only builds and
// removes the layer.

import { el } from './controls.js';

/** How long the layer stays, a little over the longest animation (the glow). */
export const BURST_MS = 1900;

/**
 * Lets `node` go off. The node needs `position: relative`. Calling it again
 * while one is running starts a second one over it, which only reads as one
 * bigger bang.
 *
 * @param {HTMLElement} node
 * @returns {() => void} removes the layer early
 */
export function burst(node) {
  const layer = el('span', 'burst');
  layer.setAttribute('aria-hidden', 'true');
  layer.append(
    el('span', 'burst-glow'),
    el('span', 'burst-ring'),
    el('span', 'burst-ring burst-ring-late'),
    el('span', 'burst-flash'),
  );
  node.append(layer);
  const timer = setTimeout(() => layer.remove(), BURST_MS);
  return () => {
    clearTimeout(timer);
    layer.remove();
  };
}
