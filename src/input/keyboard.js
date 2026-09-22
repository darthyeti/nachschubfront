// Keyboard input: held arrow keys pan continuously, other keys trigger actions.

const PAN_KEYS = {
  ArrowLeft: [1, 0],
  ArrowRight: [-1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

/**
 * @param {{
 *   onAction: (action: string) => void,
 * }} callbacks  Actions: 'pause', 'speed1', 'speed2', 'speed3', 'zoomIn', 'zoomOut', 'toggleObstacle', 'startWave'.
 */
export function attachKeyboard(callbacks) {
  const held = new Set();

  window.addEventListener('keydown', (ev) => {
    if (ev.target instanceof HTMLElement && ev.target.closest('input, textarea, select')) return;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key in PAN_KEYS) {
      held.add(ev.key);
      ev.preventDefault();
      return;
    }
    if (ev.repeat) return;
    const action = {
      ' ': 'pause',
      1: 'speed1',
      2: 'speed2',
      3: 'speed3',
      '+': 'zoomIn',
      '=': 'zoomIn',
      '-': 'zoomOut',
      h: 'toggleObstacle',
      H: 'toggleObstacle',
      Enter: 'startWave',
    }[ev.key];
    if (action) {
      ev.preventDefault();
      callbacks.onAction(action);
    }
  });
  window.addEventListener('keyup', (ev) => held.delete(ev.key));
  window.addEventListener('blur', () => held.clear());

  return {
    /** Direction of held arrow keys as a screen-space pan vector (unnormalised). */
    panDirection() {
      let dx = 0;
      let dy = 0;
      for (const key of held) {
        dx += PAN_KEYS[key][0];
        dy += PAN_KEYS[key][1];
      }
      return [dx, dy];
    },
  };
}
