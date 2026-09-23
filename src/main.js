// Entry point: wires state, fixed-step simulation, rendering, input and HUD together.

import { SIM_STEP, MAX_STEPS_PER_FRAME, MAX_FRAME_TIME, CAMERA } from './data/settings.js';
import { STRINGS } from './data/strings.js';
import { MIN_SUPPLY_LEVEL, MAX_SUPPLY_LEVEL } from './data/supply.js';
import { createFixedStepper } from './core/loop.js';
import { createGameState } from './core/state.js';
import { randomSeed, normalizeSeed } from './core/seed.js';
import { stepSimulation } from './sim/step.js';
import { requestSalvo, canRequestSalvo, chooseSelection, setSpeed, toggleObstacle } from './sim/actions.js';
import { toggleZone } from './sim/zones.js';
import { buySupply, demolish } from './sim/economy.js';
import { useCommand, canUseCommand } from './sim/commands.js';
import { commandById } from './data/commands.js';
import { podAt } from './sim/pods.js';
import { checkPlacement } from './sim/route.js';
import { totalWaves } from './sim/waves.js';
import { createCanvasView } from './render/canvas.js';
import { createCamera, fitCamera, clampCamera, panBy, zoomAt, screenToCell, worldToScreen } from './render/camera.js';
import { mapBounds, iso } from './render/iso.js';
import { createGroundLayer } from './render/ground.js';
import { createSceneRenderer } from './render/scene.js';
import { createEffects } from './render/effects.js';
import { installPageGuards } from './input/guards.js';
import { attachPointerInput } from './input/pointer.js';
import { attachKeyboard } from './input/keyboard.js';
import { createHud } from './ui/hud.js';
import { createSelectionPanel } from './ui/selection.js';
import { createCodex } from './ui/codex.js';
import { createCommandBar } from './ui/commands.js';
import { createInfoPanel } from './ui/info.js';
import { createDebugPanel } from './ui/debug.js';
import { createMenus } from './ui/menu.js';
import { createPrefs, wantsReducedMotion } from './core/prefs.js';
import { storage } from './storage/index.js';
import { createLoadingScreen } from './ui/loading.js';
import { createSpriteCache } from './render/sprites/rasterizer.js';
import { ENEMY_SPRITE_DEFS } from './render/enemySprites.js';
import { startStress, stopStress, setLives, setWave, grant, forcePod, toggleInvulnerable } from './sim/debug.js';
import { score } from './sim/score.js';

const FLASH_SECONDS = 0.9;
const STRESS_ENEMIES = 200;
const BANNER_SECONDS = 2.2;

const params = new URLSearchParams(location.search);
const debug = params.has('debug');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

document.title = STRINGS.documentTitle;
canvas.setAttribute('aria-label', STRINGS.canvasLabel);
installPageGuards(canvas);
// Canvas text uses Bangers; make sure it is loaded before the first labels are drawn.
document.fonts?.load('24px Bangers').catch(() => {});

/** Debug: start at a higher supply level so merges and recipes can be tried out. */
const startSupply = Math.min(MAX_SUPPLY_LEVEL, Math.max(MIN_SUPPLY_LEVEL, Number(params.get('supply')) || MIN_SUPPLY_LEVEL));

let state = createGameState(normalizeSeed(params.get('seed')) ?? randomSeed());
state.supplyLevel = startSupply;
/** Speed to restore when unpausing with Space. */
let lastSpeed = 1;

const stepper = createFixedStepper({ step: SIM_STEP, maxSteps: MAX_STEPS_PER_FRAME, maxFrameTime: MAX_FRAME_TIME });
const camera = createCamera();
let bounds = mapBounds(state.map.size);
const ground = createGroundLayer();
const sprites = createSpriteCache();
const renderScene = createSceneRenderer(sprites);

/** Render-side UI state; never read by the simulation. */
const ui = {
  hoverCell: null,
  /** Last cell the pointer was over or tapped, for the H key. */
  cursorCell: null,
  flashes: [],
  banner: null,
  obstacleMode: false,
  /** Taps clear rubble instead of marking zones while this is on. */
  demolishMode: false,
  /** Id of the command being aimed; the next tap on the map fires it. */
  commandTarget: null,
  /** Cell the info panel describes; set by a long press or the mouse pointer. */
  inspect: null,
  /** Set from the player's settings and the system preference; see applyMotion(). */
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  /** 'sprites' (concept art) or 'placeholder' (M1 shapes); debug switch. */
  art: params.get('art') === 'placeholder' ? 'placeholder' : 'sprites',
  /** True until the player moves the camera; then resizes keep their view. */
  autoFit: true,
  /** Muzzle flashes, beams, shells, particles and damage numbers. */
  effects: createEffects(),
  /** Pod indices highlighted during the selection, and the pod the player picked. */
  podHighlights: [],
  podSelected: 0,
};

const view = createCanvasView(canvas, (v) => {
  if (ui.autoFit) fitCamera(camera, v, bounds, CAMERA.insets, CAMERA);
  else clampCamera(camera, bounds, CAMERA);
});

// ---------- Actions ----------

function cellAt(x, y) {
  const cell = screenToCell(camera, view, x, y);
  const { size } = state.map;
  return cell.x >= 0 && cell.y >= 0 && cell.x < size && cell.y < size ? cell : null;
}

function flash(cell, ok, label) {
  ui.flashes.push({ cell, ok, label, life: FLASH_SECONDS, max: FLASH_SECONDS });
}

function showBanner(text, detail = '') {
  ui.banner = { text, detail, life: BANNER_SECONDS };
}

function applyObstacle(cell) {
  if (!cell) return;
  const result = toggleObstacle(state, cell);
  const t = STRINGS.placement;
  if (result.ok) flash(cell, true, result.action === 'added' ? t.added : t.removed);
  else if (t[result.reason]) flash(cell, false, t[result.reason]);
}

function newGame(seed = null) {
  state = createGameState(normalizeSeed(seed) ?? randomSeed());
  state.supplyLevel = startSupply;
  bounds = mapBounds(state.map.size);
  stepper.reset();
  ui.flashes.length = 0;
  ui.effects.clear();
  ui.banner = null;
  const url = new URL(location.href);
  url.searchParams.set('seed', state.seed);
  history.replaceState(null, '', url);
}

/** Marks or clears a landing zone and shows why a cell was refused. */
function applyZone(cell) {
  if (!cell) return;
  const result = toggleZone(state, cell);
  const t = STRINGS.placement;
  if (result.ok) flash(cell, true, result.action === 'added' ? t.zoneAdded : t.zoneRemoved);
  else if (t[result.reason]) flash(cell, false, t[result.reason]);
}

/** Clears a heap of rubble for requisition (GDD section 10). */
function applyDemolish(cell) {
  if (!cell) return;
  const result = demolish(state, cell);
  const t = STRINGS.placement;
  if (result.ok) flash(cell, true, t.demolished);
  else if (t[result.reason]) flash(cell, false, t[result.reason]);
}

/** Fires the command being aimed at the tapped cell. */
function applyCommand(cell) {
  const id = ui.commandTarget;
  ui.commandTarget = null;
  if (!cell) return;
  const result = useCommand(state, id, cell);
  const name = STRINGS.commands[id].name;
  if (result.ok) {
    flash(cell, true, name);
    showBanner(STRINGS.commandBar.used(name));
  } else if (STRINGS.placement[result.reason]) {
    flash(cell, false, STRINGS.placement[result.reason]);
  }
}

/** A command from the bar: aim it, or fire it straight away if it has no target. */
function pickCommand(id) {
  if (ui.commandTarget === id) {
    ui.commandTarget = null;
    return;
  }
  const check = canUseCommand(state, id, { x: 0, y: 0 });
  if (!check.ok && check.reason !== 'outside') {
    if (STRINGS.placement[check.reason]) showBanner(STRINGS.placement[check.reason]);
    return;
  }
  if (commandById(id).target === 'none') {
    const result = useCommand(state, id);
    if (result.ok) showBanner(STRINGS.commandBar.used(STRINGS.commands[id].name));
    return;
  }
  ui.commandTarget = id;
  showBanner(STRINGS.commandBar.aimHint(STRINGS.commands[id].name));
}

/** During the selection a tap on a pod picks it; the panel then offers the actions. */
function applyPodTap(cell) {
  if (!cell) return;
  const pod = podAt(state, cell);
  if (pod) ui.podSelected = pod.index;
}

/** Applies a choice from the selection panel and starts the wave. */
function applyChoice(choice) {
  const result = chooseSelection(state, choice);
  if (!result.ok) return;
  const { tower } = result;
  const name = tower.special
    ? STRINGS.recipes[tower.special].name
    : STRINGS.selection.tower(STRINGS.doctrines[tower.doctrine], STRINGS.ranks[tower.rank]);
  flash(tower, true, name);
  showBanner(STRINGS.selection.built(name));
}

function onCellTap(cell) {
  if (ui.commandTarget) applyCommand(cell);
  else if (ui.obstacleMode) applyObstacle(cell);
  else if (ui.demolishMode && state.phase === 'planning') applyDemolish(cell);
  else if (state.phase === 'planning') applyZone(cell);
  else if (state.phase === 'selection') applyPodTap(cell);
}

function onAction(action) {
  if (action.startsWith('speed')) {
    const speed = Number(action.slice(5));
    if (speed > 0) lastSpeed = speed;
    setSpeed(state, speed);
  } else if (action === 'pause') {
    setSpeed(state, state.speed === 0 ? lastSpeed : 0);
  } else if (action === 'requestSalvo') {
    requestSalvo(state);
  } else if (action === 'newGame') {
    newGame();
  } else if (action === 'toggleArt') {
    ui.art = ui.art === 'sprites' ? 'placeholder' : 'sprites';
  } else if (action === 'stress') {
    if (state.stress) stopStress(state);
    else startStress(state, STRESS_ENEMIES);
  } else if (action === 'buySupply') {
    const result = buySupply(state);
    if (!result.ok && STRINGS.placement[result.reason] && ui.cursorCell) {
      flash(ui.cursorCell, false, STRINGS.placement[result.reason]);
    }
  } else if (action === 'demolishMode') {
    ui.demolishMode = !ui.demolishMode;
    if (ui.demolishMode) ui.obstacleMode = false;
  } else if (action === 'codex') {
    codex.toggle();
  } else if (action === 'menu') {
    menus.togglePause();
  } else if (action === 'escape') {
    // Escape works from the inside out: aiming, then the codex, then the menu.
    if (ui.commandTarget) ui.commandTarget = null;
    else if (codex.open) codex.setOpen(false);
    else menus.togglePause();
  } else if (action === 'supplyLevel') {
    // Debug only until requisition arrives in M3, so merges and recipes are testable.
    if (debug) state.supplyLevel = (state.supplyLevel % MAX_SUPPLY_LEVEL) + 1;
  } else if (action === 'obstacleMode') {
    ui.obstacleMode = !ui.obstacleMode;
  } else if (action === 'toggleObstacle') {
    applyObstacle(ui.cursorCell);
  } else if (action === 'zoomIn' || action === 'zoomOut') {
    const f = action === 'zoomIn' ? CAMERA.wheelZoomStep : 1 / CAMERA.wheelZoomStep;
    zoomAt(camera, view, f, view.width / 2, view.height / 2, CAMERA);
    clampCamera(camera, bounds, CAMERA);
    ui.autoFit = false;
  }
}

const codex = createCodex(document.body);
const hud = createHud(document.getElementById('hud'), { debug, onAction });
const commandBar = createCommandBar(hud.bottom, { onPick: pickCommand });
const debugPanel = debug
  ? createDebugPanel(document.getElementById('hud'), {
      onAction: (action, value) => {
        if (action === 'setWave') setWave(state, value.wave);
        else if (action === 'grant') grant(state, value);
        else if (action === 'forcePod') forcePod(state, value);
        else if (action === 'invulnerable') toggleInvulnerable(state);
      },
    })
  : null;
const infoPanel = createInfoPanel(document.getElementById('hud'), {
  onClose: () => {
    ui.inspect = null;
  },
});
// The selection panel places itself: over the bar on a narrow screen, at the
// side on a wide one. Inside the bottom column it could not reach the edge,
// because a transformed ancestor is what `position: fixed` measures against.
const selectionPanel = createSelectionPanel(document.getElementById('hud'), {
  onSelect: (index) => {
    ui.podSelected = index;
  },
  onChoose: applyChoice,
});

attachPointerInput(canvas, {
  onTap(x, y) {
    const cell = cellAt(x, y);
    ui.cursorCell = cell;
    ui.hoverCell = cell;
    onCellTap(cell);
  },
  onPan(dx, dy) {
    panBy(camera, dx, dy);
    clampCamera(camera, bounds, CAMERA);
    ui.autoFit = false;
  },
  onZoom(factor, x, y) {
    zoomAt(camera, view, factor, x, y, CAMERA);
    clampCamera(camera, bounds, CAMERA);
    ui.autoFit = false;
  },
  onGestureStart() {
    ui.hoverCell = null;
  },
  onHover(x, y) {
    const cell = x === null ? null : cellAt(x, y);
    ui.hoverCell = cell;
    if (cell) ui.cursorCell = cell;
    // Mouse: the info panel follows the pointer (GDD section 13).
    ui.inspect = cell;
  },
  /** Touch: a long press pins the info panel to that cell. */
  onLongPress(x, y, pointerType) {
    const cell = cellAt(x, y);
    ui.inspect = cell;
    if (pointerType !== 'mouse' && cell) ui.cursorCell = cell;
  },
});

// ---------- Settings and the screens around the game ----------

const prefs = createPrefs(storage);
const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');

function applyMotion() {
  ui.reducedMotion = wantsReducedMotion(prefs.values, systemMotion.matches);
}
prefs.onChange(applyMotion);
systemMotion.addEventListener('change', applyMotion);
prefs.load().then(applyMotion);

/** Speed to go back to once every screen is closed again. */
let speedBeforeMenu = 1;

const menus = createMenus(document.body, {
  prefs,
  canStore: storage.persistent,
  onToggle(open) {
    if (open) {
      if (state.speed > 0) speedBeforeMenu = state.speed;
      setSpeed(state, 0);
    }
  },
  onResume() {
    setSpeed(state, speedBeforeMenu);
  },
  onStart(seed) {
    // The title screen shows the seed of the map already generated behind it, so
    // starting with that seed just plays it instead of rolling a new one.
    if (!seed || seed !== state.seed) newGame(seed);
    lastSpeed = speedBeforeMenu > 0 ? speedBeforeMenu : 1;
    setSpeed(state, lastSpeed);
  },
});

const keyboard = attachKeyboard({ onAction });

// ---------- Events from the simulation ----------

function drainEvents() {
  for (const ev of state.events) {
    if (ev.type === 'phase' && ev.phase === 'salvo') ui.podSelected = 0;
    else if (ev.type === 'waveCleared') showBanner(STRINGS.banners.waveCleared(ev.wave, ev.leaked));
    else if (ev.type === 'phase' && (ev.phase === 'defeat' || ev.phase === 'victory')) {
      showEndScreen(ev.phase === 'victory');
    }
  }
  state.events.length = 0;
}

/** The result of a finished match, with the score from GDD section 12. */
function showEndScreen(victory) {
  const t = STRINGS.score;
  menus.showEnd({
    victory,
    wave: state.wave,
    seed: state.seed,
    lines: [
      [t.wave, state.wave],
      [t.kills, state.kills],
      [t.lives, state.lives],
      [t.total, score(state)],
    ],
  });
}

// ---------- Frame loop ----------

let last = performance.now();
let fpsFrames = 0;
let fpsTime = 0;
/** Summed JS time of the frame callbacks since the last debug update (ms). */
let workTime = 0;

function frame(now) {
  const workStart = performance.now();
  const dt = (now - last) / 1000;
  last = now;
  const realDt = Math.min(dt, MAX_FRAME_TIME);

  const [kx, ky] = keyboard.panDirection();
  if (kx || ky) {
    panBy(camera, kx * CAMERA.keyPanSpeed * realDt, ky * CAMERA.keyPanSpeed * realDt);
    clampCamera(camera, bounds, CAMERA);
    ui.autoFit = false;
  }

  stepper.advance(dt, state.speed, (stepDt) => stepSimulation(state, stepDt));
  // The effects read the events before they are drained.
  ui.effects.update(realDt, state, ui.reducedMotion);
  drainEvents();

  for (const f of ui.flashes) f.life -= realDt;
  ui.flashes = ui.flashes.filter((f) => f.life > 0);
  if (ui.banner) {
    // End-of-game banners stay until a new game starts.
    const over = state.phase === 'defeat' || state.phase === 'victory';
    if (!over) ui.banner.life -= realDt;
    if (ui.banner.life <= 0) ui.banner = null;
  }

  ui.podHighlights = state.phase === 'selection' ? state.pods.map((p) => p.index) : [];
  ui.commandRadius = ui.commandTarget ? commandById(ui.commandTarget).radius : 0;

  renderScene(ctx, view, camera, state, ui, ground, now / 1000);
  hud.update(state, ui, { totalWaves: totalWaves(), canStart: canRequestSalvo(state) });
  commandBar.update(state, ui);
  infoPanel.update(state, ui);
  debugPanel?.update(state);
  selectionPanel.update(state, ui);

  fpsFrames++;
  fpsTime += dt;
  workTime += performance.now() - workStart;
  if (fpsTime >= 0.5) {
    const frameMs = workTime / fpsFrames;
    ui.frameMs = frameMs;
    hud.updateDebug({ fps: Math.round(fpsFrames / fpsTime), frameMs, enemies: state.enemies.length, view });
    fpsFrames = 0;
    fpsTime = 0;
    workTime = 0;
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

// Test hook for the Playwright input checks (read-only snapshot).
if (debug) {
  window.__nachschub = {
    camera: () => ({ ...camera }),
    cellAt: (x, y) => cellAt(x, y),
    canPlace: (x, y) => checkPlacement(state.map, [{ x, y }]).ok,
    screenOfCell: (cx, cy) => worldToScreen(camera, view, ...iso(cx + 0.5, cy + 0.5)),
    state: () => ({
      phase: state.phase,
      wave: state.wave,
      lives: state.lives,
      obstacles: state.map.obstacles.length,
      route: state.route?.length ?? null,
      hover: ui.hoverCell,
      enemies: state.enemies.length,
      speed: state.speed,
      routeCells: state.route?.cells ?? [],
      previewCells: state.zonePreview?.cells ?? null,
      rift: state.map.rift,
      stress: state.stress,
      zones: state.zones.map(({ x, y }) => ({ x, y })),
      pods: state.pods.map(({ index, x, y, doctrine, rank, landed }) => ({ index, x, y, doctrine, rank, landed })),
      towers: state.towers.map(({ id, x, y, doctrine, rank, special }) => ({ id, x, y, doctrine, rank, special })),
      supplyLevel: state.supplyLevel,
      requisition: state.requisition,
      commandPoints: state.commandPoints,
      demolished: state.demolished,
      waveStats: { ...state.waveStats },
      projectiles: state.projectiles.length,
    }),
    /** Debug actions; the visible debug panel uses the same simulation calls. */
    debug: {
      setLives: (n) => setLives(state, n),
      grant: (value) => grant(state, value),
      setWave: (n) => setWave(state, n),
    },
    sprites: () => ({ ...sprites.stats }),
    ui: () => ({
      art: ui.art,
      frameMs: ui.frameMs,
      obstacleMode: ui.obstacleMode,
      demolishMode: ui.demolishMode,
      commandTarget: ui.commandTarget,
      podSelected: ui.podSelected,
    }),
  };
}

// The match waits behind the title screen until the player starts it.
setSpeed(state, 0);
menus.setSeed(state.seed);
menus.show('main');

// Rasterize the enemy sprites for the start zoom before the first wave can begin.
const loading = createLoadingScreen(document.body);
sprites
  .preload(ENEMY_SPRITE_DEFS, camera.zoom, view.dpr, (done, total) => loading.progress(done, total))
  .finally(() => {
    loading.close();
    document.body.dataset.ready = 'true';
  });

requestAnimationFrame(frame);
