// Shared DOM helpers for the HUD. Everything here is about behaviour, not
// looks: making an element, a button that survives a touch on WebKit, and the
// long press that explains a control without hiding it behind hover.

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(label, className, onClick) {
  const b = el('button', className, label);
  b.type = 'button';
  b.classList.add('interactive');
  b.addEventListener('click', (ev) => {
    if (b.dataset.heldOpen === '1') {
      // The long press already answered; swallow the click that follows it.
      delete b.dataset.heldOpen;
      return;
    }
    onClick(ev);
    // Give focus back, so Space keeps toggling pause instead of re-pressing this button.
    // (Not preventDefault on pointerdown: WebKit then drops the click after a touch.)
    b.blur();
  });
  return b;
}

/** Seconds a finger has to rest on a button before it counts as a long press. */
export const LONG_PRESS_MS = 450;

/**
 * Explains a control on hover and on a long press. Nothing may be reachable by
 * hover alone (GDD section 13), so the finger gets the same text.
 *
 * `show` is called when the explanation is wanted, `hide` when it should go
 * again; a caller that has no hiding of its own may leave `hide` out.
 */
export function explain(b, { show, hide = () => {} }) {
  let timer = null;
  const cancel = () => {
    clearTimeout(timer);
    timer = null;
  };
  b.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse') return;
    timer = setTimeout(() => {
      timer = null;
      // Tells the click handler that the press was answered with the
      // explanation and must not also fire the action.
      b.dataset.heldOpen = '1';
      show();
    }, LONG_PRESS_MS);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    b.addEventListener(type, cancel);
  }
  b.addEventListener('pointerenter', (ev) => {
    if (ev.pointerType === 'mouse') show();
  });
  b.addEventListener('pointerleave', (ev) => {
    if (ev.pointerType === 'mouse') hide();
  });
  return cancel;
}
