// DOM HUD above the canvas.

import { STRINGS } from '../data/strings.js';

export function createHud(root, { debug }) {
  const title = document.createElement('div');
  title.className = 'hud-title';
  const heading = document.createElement('h1');
  heading.textContent = STRINGS.gameTitle;
  const stage = document.createElement('p');
  stage.textContent = STRINGS.buildStage;
  title.append(heading, stage);
  root.append(title);

  let debugEl = null;
  if (debug) {
    debugEl = document.createElement('div');
    debugEl.className = 'hud-debug';
    root.append(debugEl);
  }

  return {
    /** @param {{fps: number, tick: number, view: {width: number, height: number, dpr: number}}} info */
    updateDebug({ fps, tick, view }) {
      if (!debugEl) return;
      const t = STRINGS.debug;
      debugEl.textContent =
        `${fps} ${t.fps} · ${t.steps} ${tick} · ` +
        `${t.canvas} ${view.width}×${view.height} @${view.dpr}x`;
    },
  };
}
