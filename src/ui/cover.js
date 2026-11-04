// How much of the screen a sheet covers on the phone (M10 E2), so the camera can
// make room: capsules and target fields must not end up under it. Reads the DOM,
// writes nothing, and never touches the simulation.

import { isPhone } from './phone.js';
import { iso } from '../render/iso.js';

/** The sheets that carry the map: the capsule choice and the emplacement info. */
const SHEETS = '.selection, .info';

/**
 * @returns {{right: number, bottom: number, top: number}}  CSS pixels covered at the
 *   right edge and at the bottom, and the height of the status bar at the top.
 *   Landscape sheets come from the right, portrait ones from below.
 */
export function measureCover(doc = document) {
  const none = { right: 0, bottom: 0, top: 0 };
  if (!isPhone()) return none;
  const bar = doc.querySelector('.hud-top')?.getBoundingClientRect();
  const out = { right: 0, bottom: 0, top: bar ? Math.max(0, Math.round(bar.bottom)) : 0 };
  const sideways = innerWidth > innerHeight;
  for (const sheet of doc.querySelectorAll(SHEETS)) {
    if (sheet.hidden) continue;
    const r = sheet.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (sideways) out.right = Math.max(out.right, Math.round(innerWidth - r.left));
    else out.bottom = Math.max(out.bottom, Math.round(innerHeight - r.top));
  }
  return out;
}

/**
 * World rectangle around the capsules of a salvo, with room above for the beam
 * and below for the ground.
 * @param {{x: number, y: number}[]} pods
 * @param {(x: number, y: number) => number} heightAt  terrain height of a cell in pixels
 */
export function podsRect(pods, heightAt) {
  if (!pods.length) return null;
  const rect = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const pod of pods) {
    const z = heightAt(pod.x, pod.y);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const [wx, wy] = iso(pod.x + dx, pod.y + dy, z);
      rect.x0 = Math.min(rect.x0, wx);
      rect.x1 = Math.max(rect.x1, wx);
      rect.y0 = Math.min(rect.y0, wy);
      rect.y1 = Math.max(rect.y1, wy);
    }
  }
  rect.y0 -= 70;
  return rect;
}
