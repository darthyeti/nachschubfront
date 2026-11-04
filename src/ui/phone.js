// The phone layout (M10 E2): a touch screen that is narrow or low. The same
// condition is in style.css as one media block; keep the two in step.
//
// A tablet (1180 x 820) and a desktop match neither half, so they keep the
// layout they have.

export const PHONE_QUERY = '(pointer: coarse) and (max-width: 600px), (pointer: coarse) and (max-height: 500px)';

/** True on a phone: narrow or low, and touched with a finger. */
export function isPhone() {
  return typeof matchMedia === 'function' && matchMedia(PHONE_QUERY).matches;
}

/** True when the phone is held wide, i.e. the sheets come from the side. */
export function isPhoneLandscape() {
  return isPhone() && innerWidth > innerHeight;
}
