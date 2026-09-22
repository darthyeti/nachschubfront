// Entry point: wires state, fixed-step simulation, rendering, input and HUD together.

import { SIM_STEP, MAX_STEPS_PER_FRAME, MAX_FRAME_TIME, CAMERA } from './data/settings.js';
import { STRINGS } from './data/strings.js';
import { createFixedStepper } from './core/loop.js';
import { createGameState } from './core/state.js';
import { randomSeed, normalizeSeed } from './core/seed.js';
import { stepSimulation } from './sim/step.js';
import { createCanvasView } from './render/canvas.js';
import { createCamera, fitCamera, clampCamera } from './render/camera.js';
import { mapBounds } from './render/iso.js';
import { createGroundLayer } from './render/ground.js';
import { createSceneRenderer } from './render/scene.js';
import { installPageGuards } from './input/guards.js';
import { createHud } from './ui/hud.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

document.title = STRINGS.documentTitle;
canvas.setAttribute('aria-label', STRINGS.canvasLabel);
installPageGuards(canvas);

const state = createGameState(normalizeSeed(params.get('seed')) ?? randomSeed());
const hud = createHud(document.getElementById('hud'), { debug: params.has('debug') });
const stepper = createFixedStepper({
  step: SIM_STEP,
  maxSteps: MAX_STEPS_PER_FRAME,
  maxFrameTime: MAX_FRAME_TIME,
});

const camera = createCamera();
const bounds = mapBounds(state.map.size);
const ground = createGroundLayer();
const renderScene = createSceneRenderer();
const ui = {
  hoverCell: null,
  flashes: [],
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  /** True until the player moves the camera; then resizes keep their view. */
  autoFit: true,
};

const view = createCanvasView(canvas, (v) => {
  if (ui.autoFit) fitCamera(camera, v, bounds, CAMERA.insets, CAMERA);
  else clampCamera(camera, bounds, CAMERA);
});

let last = performance.now();
let fpsFrames = 0;
let fpsTime = 0;

function frame(now) {
  const dt = (now - last) / 1000;
  last = now;

  stepper.advance(dt, state.speed, (stepDt) => stepSimulation(state, stepDt));
  renderScene(ctx, view, camera, state, ui, ground, now / 1000);

  fpsFrames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    hud.updateDebug({ fps: Math.round(fpsFrames / fpsTime), tick: state.tick, view });
    fpsFrames = 0;
    fpsTime = 0;
  }
  requestAnimationFrame(frame);
}

// Returning from a background tab must not dump the whole pause into one frame.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    last = performance.now();
    stepper.reset();
  }
});

requestAnimationFrame(frame);
