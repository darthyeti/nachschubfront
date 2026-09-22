// Loading overlay shown while sprites are rasterized at start.

import { STRINGS } from '../data/strings.js';

export function createLoadingScreen(root) {
  const overlay = document.createElement('div');
  overlay.className = 'loading';
  overlay.setAttribute('role', 'status');
  const label = document.createElement('p');
  label.textContent = STRINGS.loading.title;
  const bar = document.createElement('div');
  bar.className = 'loading-bar';
  const fill = document.createElement('div');
  bar.append(fill);
  overlay.append(label, bar);
  root.append(overlay);

  return {
    progress(done, total) {
      fill.style.width = `${Math.round((done / Math.max(1, total)) * 100)}%`;
    },
    close() {
      overlay.classList.add('done');
      setTimeout(() => overlay.remove(), 300);
    },
  };
}
