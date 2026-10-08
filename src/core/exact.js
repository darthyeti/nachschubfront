// Arithmetic that comes out the same to the last bit in every engine.
//
// JavaScript fixes + - * / and Math.sqrt to the bit (IEEE 754), but leaves
// Math.hypot, Math.sin, Math.cos, ** and their kin to the engine. A match
// played on an iPad runs in WebKit and is replayed in node: with those in the
// simulation the two drifted by a hit here and there (7EJY6Y, 08.10.2026,
// overkill in wave 8). The simulation uses these instead.

/** Length of the vector (dx, dy). */
export function length(dx, dy) {
  return Math.sqrt(dx * dx + dy * dy);
}
