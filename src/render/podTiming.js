// Timing of the capsule as it is drawn: the fall profile, the segments opening,
// the glow cooling, the smoke. Pure functions of the pod's clock, shared by the
// capsule (pods.js) and the effects (effects.js), so the dust of a segment is
// thrown at the moment the segment hits the ground.
//
// Nothing here is simulation: the simulation only knows when the pod lands
// (src/data/pods.js), and what happens around that moment is a drawing. The
// numbers below are the study's (reference/studien/kapsel-studie.js, draft B),
// fitted to the simulation's times.

import { PODS } from '../data/pods.js';
import { IMPACT_SECONDS, sinceImpact } from '../sim/pods.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Height the pod starts from, in screen pixels. */
export const FALL_HEIGHT = 900;
/** Share of the fall that is free flight; the rest is the brake. */
const FREE_SHARE = 0.72;
/** Speed at touchdown, in px/s. */
const TOUCHDOWN_SPEED = 300;

const FALL = (() => {
  const total = PODS.fallSeconds;
  const brake = (1 - FREE_SHARE) * total;
  // Free flight at constant speed v0, then a constant braking down to the touchdown speed:
  // height = v0 * free + brake * (v0 + vTouch) / 2, solved for v0.
  const v0 = (FALL_HEIGHT - (brake * TOUCHDOWN_SPEED) / 2) / (FREE_SHARE * total + brake / 2);
  return { total, free: FREE_SHARE * total, brake, v0, accel: (v0 - TOUCHDOWN_SPEED) / brake };
})();

/** Seconds into the fall (after the warning) at which the brake nozzles light. */
export const BRAKE_START = FALL.free;
/** How long the nozzles keep burning after touchdown. */
export const BRAKE_AFTER = 0.14;

/** Height above the ground while falling, in px: constant speed, then the brake. */
export function podHeight(pod) {
  const tt = pod.t - PODS.warnSeconds;
  if (tt <= 0) return FALL_HEIGHT;
  if (tt >= FALL.total) return 0;
  if (tt < FALL.free) return FALL_HEIGHT - FALL.v0 * tt;
  const s = tt - FALL.free;
  const z = FALL_HEIGHT - FALL.v0 * FALL.free - FALL.v0 * s + 0.5 * FALL.accel * s * s;
  return z < 0 ? 0 : z;
}

/** How strongly the brake nozzles burn, 0 to 1: they light fast, burn to the touchdown and die within BRAKE_AFTER. */
export function brakePower(pod) {
  const tt = pod.t - PODS.warnSeconds;
  const lit = clamp01((tt - FALL.free) / 0.06);
  const since = sinceImpact(pod);
  return since > 0 ? lit * clamp01(1 - since / BRAKE_AFTER) : lit;
}

// The four segments blow open one after the other; together they take
// PODS.openSeconds. The order is the study's: a segment, then the opposite one.
export const PETAL_STAGGER = PODS.openSeconds * 0.22;
export const PETAL_SECONDS = PODS.openSeconds * 0.34;

/**
 * How far the segment in that opening position has swung out, 0 to 1.
 * @param {number} since  Seconds since the pod hit the ground.
 */
export function petalOpen(since, order) {
  const u = clamp01((since - PODS.openDelaySeconds - order * PETAL_STAGGER) / PETAL_SECONDS);
  return u * u;
}

/** Seconds after the impact at which the segment in that opening position lies on the ground. */
export function petalLands(order) {
  return PODS.openDelaySeconds + order * PETAL_STAGGER + PETAL_SECONDS;
}

/** True once the bolts have blown and the shell is no longer one piece. */
export function isOpening(pod) {
  return sinceImpact(pod) >= PODS.openDelaySeconds;
}

/** How long the burst open takes to hide the shell. */
const BURST_SECONDS = PODS.openSeconds * 0.35;

/**
 * How solid the closed shell still is while the capsule bursts open, 1 to 0.
 * The shell and the standing core are two different drawings; without this the
 * wide shell would vanish in one frame and leave the narrow core behind. Fading
 * it out over the first segments reads as the walls coming apart.
 */
export function shellFade(since) {
  return 1 - clamp01((since - PODS.openDelaySeconds) / BURST_SECONDS);
}

/** Seconds the shell glows from re-entry after the impact. */
export const HEAT_SECONDS = 2.8;

/**
 * Seconds until smoke and dust of a landing are gone. Every puff of the landing
 * lives at most this long, counted from the impact (the effects keep to it, a unit
 * test holds them to it).
 */
export const SMOKE_SECONDS = 3.5;

export { IMPACT_SECONDS };
