// Gesture recognizer over plain pointer samples. No DOM access, so it runs in node tests.
//
// One pointer:  press -> tap (released before moving past the threshold)
//                     -> pan (moved past the threshold; left mouse, touch, pen)
//                     -> long press (held without moving; suppresses the tap)
// Right/middle mouse button: pans immediately, never taps.
// Two touch pointers: pinch zoom around their midpoint plus pan with the midpoint.

/**
 * @typedef {{pointerId: number, x: number, y: number, button?: number, pointerType?: string}} Sample
 * @typedef {object} Callbacks
 * @property {(x: number, y: number, pointerType: string) => void} [onTap]
 * @property {(x: number, y: number, pointerType: string) => void} [onLongPress]
 * @property {(dx: number, dy: number) => void} [onPan]
 * @property {(factor: number, x: number, y: number) => void} [onZoom]
 * @property {() => void} [onGestureStart]  Any drag, pan or pinch began (e.g. to hide hover).
 */

/**
 * @param {{dragThreshold: number, longPressMs: number}} options
 * @param {Callbacks} callbacks
 * @param {{set: (fn: () => void, ms: number) => any, clear: (handle: any) => void}} [timer]
 */
export function createGestureRecognizer(options, callbacks, timer = defaultTimer) {
  const pointers = new Map();
  /** 'idle' | 'pending' | 'pan' | 'pinch' | 'held' | 'done' */
  let mode = 'idle';
  let longPressHandle = null;
  let pinch = null;

  const emit = (name, ...args) => callbacks[name]?.(...args);

  function cancelLongPress() {
    if (longPressHandle !== null) {
      timer.clear(longPressHandle);
      longPressHandle = null;
    }
  }

  function pinchState() {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(b.x - a.x, b.y - a.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  function down(s) {
    const pointerType = s.pointerType ?? 'mouse';
    const button = s.button ?? 0;
    pointers.set(s.pointerId, { x: s.x, y: s.y, startX: s.x, startY: s.y, pointerType, button });

    if (pointers.size === 1) {
      cancelLongPress();
      if (pointerType === 'mouse' && button !== 0) {
        mode = 'pan';
        emit('onGestureStart');
        return;
      }
      mode = 'pending';
      longPressHandle = timer.set(() => {
        longPressHandle = null;
        if (mode !== 'pending') return;
        mode = 'held';
        const p = pointers.get(s.pointerId);
        if (p) emit('onLongPress', p.x, p.y, p.pointerType);
      }, options.longPressMs);
    } else if (pointers.size === 2 && [...pointers.values()].every((p) => p.pointerType !== 'mouse')) {
      cancelLongPress();
      if (mode === 'pending' || mode === 'held') emit('onGestureStart');
      mode = 'pinch';
      pinch = pinchState();
    } else {
      // Third finger or mixed input: ignore further taps from this gesture.
      cancelLongPress();
      if (mode === 'pending') mode = 'done';
    }
  }

  function move(s) {
    const p = pointers.get(s.pointerId);
    if (!p) return;
    const dx = s.x - p.x;
    const dy = s.y - p.y;
    p.x = s.x;
    p.y = s.y;

    if (mode === 'pending') {
      if (Math.hypot(p.x - p.startX, p.y - p.startY) >= options.dragThreshold) {
        cancelLongPress();
        mode = 'pan';
        emit('onGestureStart');
        // Include the distance covered below the threshold so the map sticks to the finger.
        emit('onPan', p.x - p.startX, p.y - p.startY);
      }
    } else if (mode === 'pan') {
      if (dx || dy) emit('onPan', dx, dy);
    } else if (mode === 'pinch' && pointers.size >= 2) {
      const next = pinchState();
      if (next.dist !== pinch.dist) emit('onZoom', next.dist / pinch.dist, next.mx, next.my);
      if (next.mx !== pinch.mx || next.my !== pinch.my) emit('onPan', next.mx - pinch.mx, next.my - pinch.my);
      pinch = next;
    }
  }

  function up(s, cancelled = false) {
    const p = pointers.get(s.pointerId);
    if (!p) return;
    pointers.delete(s.pointerId);
    cancelLongPress();

    if (pointers.size === 0) {
      if (mode === 'pending' && !cancelled) emit('onTap', p.x, p.y, p.pointerType);
      mode = 'idle';
      pinch = null;
    } else if (mode === 'pinch' && pointers.size === 1) {
      // Lifting one finger of a pinch continues as a pan with the other, never as a tap.
      mode = 'pan';
      pinch = null;
    }
  }

  return {
    down,
    move,
    up: (s) => up(s, false),
    cancel: (s) => up(s, true),
    /** True while a pan or pinch is in progress. */
    get dragging() {
      return mode === 'pan' || mode === 'pinch';
    },
    get activePointers() {
      return pointers.size;
    },
  };
}

const defaultTimer = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle),
};
