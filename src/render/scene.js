// Draws a frame from the game state. Reads state, never writes it.

import { iso } from './iso.js';
import { applyCamera } from './camera.js';
import { cellPath, comicText } from './draw.js';
import { C } from './palette.js';
import {
  drawObstacleCell,
  drawRift,
  drawRiftGlow,
  drawBastion,
  drawBastionGlow,
  drawBeacon,
  drawBeaconLabel,
  drawEnemy,
  drawEnemyBar,
  drawTowerPlaceholder,
} from './objects.js';
import { createEnemySpriteRenderer, ENEMY_TOP } from './enemySprites.js';
import { createBackdropLayer } from './backdrop.js';
import { createAtmosphere } from './atmosphere.js';
import { drawTowerSprite, drawSpecialRing } from './towerSprites.js';
import {
  createPodRenderer,
  drawZoneMarker,
  drawClearedMarker,
  drawPodTarget,
  drawPodHologram,
  drawPodHighlight,
} from './pods.js';
import { previewRoute } from '../sim/zones.js';
import { towerAt, towerStats } from '../sim/towers.js';
import { demolishTarget, nextBulwarkCost } from '../sim/economy.js';
import { PLANNING_PHASES } from '../core/phases.js';
import { towerById } from '../sim/towers.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';

const KIND_OBSTACLE = 0;
const KIND_RIFT = 1;
const KIND_BEACON = 2;
const KIND_BASTION = 3;
const KIND_TOWER = 4;
const KIND_POD = 5;
const KIND_ENEMY = 6;

/**
 * Margin around the viewport in world pixels when deciding what to draw. Objects
 * are sorted by their ground point, but their artwork reaches far above it (a
 * laser mast) and a little below (its shadow).
 */
const CULL_ABOVE = 260;
const CULL_BELOW = 60;
const CULL_SIDE = 90;

/** Visible area in world pixels, widened so nothing pops in at the edges. */
function visibleArea(cam, view) {
  const halfW = view.width / 2 / cam.zoom;
  const halfH = view.height / 2 / cam.zoom;
  return {
    x0: cam.x - halfW - CULL_SIDE,
    x1: cam.x + halfW + CULL_SIDE,
    y0: cam.y - halfH - CULL_BELOW,
    y1: cam.y + halfH + CULL_ABOVE,
  };
}

function createVignette() {
  const canvas = document.createElement('canvas');
  let key = '';
  return function draw(ctx, view) {
    const k = `${view.width}x${view.height}@${view.dpr}`;
    if (k !== key) {
      key = k;
      canvas.width = Math.round(view.width * view.dpr);
      canvas.height = Math.round(view.height * view.dpr);
      const v = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const g = v.createRadialGradient(w / 2, h * 0.52, Math.min(w, h) * 0.3, w / 2, h * 0.52, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,.62)');
      v.fillStyle = g;
      v.fillRect(0, 0, w, h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(canvas, 0, 0);
  };
}

/**
 * Recipe preview (docs/ART.md): while the player holds a recipe, the map goes
 * dark and only the emplacements the recipe would eat keep their colour, each
 * in a pulsing gold ring. Drawn after the depth-sorted pass, so the veil covers
 * everything already on the canvas and the doomed ones are put back on top.
 *
 * The emplacements are redrawn with dt 0: their weapons have already been moved
 * on this frame, and moving them twice would work off the recoil too fast.
 */
function drawRecipePreview(ctx, state, ui, cam, view, t, sprites) {
  const doomed = ui.recipePreview.map((id) => towerById(state, id)).filter(Boolean);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(17,12,10,.45)';
  ctx.fillRect(0, 0, view.width * view.dpr, view.height * view.dpr);
  applyCamera(ctx, cam, view);
  const pulse = ui.reducedMotion ? 0.8 : 0.6 + Math.sin(t * 5) * 0.3;
  for (const tower of doomed) {
    drawCellMarker(ctx, tower, `rgba(242,193,78,${pulse * 0.3})`, `rgba(242,193,78,${pulse})`, 3);
    if (ui.art !== 'sprites' || !drawTowerSprite(ctx, sprites, tower, cam.zoom, view.dpr, t, 0, ui.reducedMotion)) {
      drawTowerPlaceholder(ctx, tower);
    }
  }
}

/** Dashed, slowly marching route line with ink underlay. */
function drawRoutePreview(ctx, route, t, reducedMotion) {
  const pts = route.cells.map(({ x, y }) => iso(x + 0.5, y + 0.5));
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  trace();
  ctx.strokeStyle = 'rgba(26,20,16,.55)';
  ctx.lineWidth = 6;
  ctx.stroke();
  trace();
  ctx.setLineDash([10, 9]);
  ctx.lineDashOffset = reducedMotion ? 0 : -t * 22;
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawCellMarker(ctx, cell, fill, stroke, lineWidth = 2.5) {
  cellPath(ctx, cell.x, cell.y, 0.04);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/**
 * Everything the demolish mode could clear (GDD section 13). Rubble is marked in
 * gold, a position of the player's own in red: tearing one down is the
 * expensive, irreversible move. What the player cannot afford stays dim, and the
 * cell waiting for its confirming tap pulses.
 * @returns {{cell: object, cost: number, kind: string, affordable: boolean, armed: boolean}[]}
 *   The same cells again, so the prices can be written after the sprites.
 */
function drawDemolishOverlay(ctx, state, armed, t, reducedMotion) {
  const cells = [
    ...state.map.obstacles.filter((o) => o.kind === 'rubble' || o.kind === 'bulwark').map((o) => o.cells[0]),
    ...state.towers.map(({ x, y }) => ({ x, y })),
  ];
  const pulse = reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(t * 6);
  const marked = [];
  for (const cell of cells) {
    const target = demolishTarget(state, cell);
    if (!target) continue;
    const affordable = state.requisition >= target.cost;
    const isArmed = Boolean(armed && armed.x === cell.x && armed.y === cell.y);
    const rgb = target.kind === 'tower' ? '255,58,42' : '242,193,78';
    const alpha = (affordable ? 1 : 0.35) * (isArmed ? pulse : 1);
    drawCellMarker(
      ctx,
      cell,
      `rgba(${rgb},${(isArmed ? 0.34 : 0.16) * alpha})`,
      `rgba(${rgb},${(isArmed ? 1 : 0.8) * alpha})`,
      isArmed ? 4 : 2.5,
    );
    marked.push({ cell, cost: target.cost, kind: target.kind, affordable, armed: isArmed });
  }
  return marked;
}

/**
 * Every heap of rubble the bulwark mode could build on, with the one price the
 * mode has. Same marks as the demolish overlay, because the two modes are never
 * open at the same time and the button says which one is.
 */
function drawBulwarkOverlay(ctx, state, armed, t, reducedMotion) {
  const cost = nextBulwarkCost(state);
  const affordable = state.requisition >= cost;
  const pulse = reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(t * 6);
  const marked = [];
  for (const obstacle of state.map.obstacles) {
    if (obstacle.kind !== 'rubble') continue;
    const cell = obstacle.cells[0];
    const isArmed = Boolean(armed && armed.x === cell.x && armed.y === cell.y);
    const alpha = (affordable ? 1 : 0.35) * (isArmed ? pulse : 1);
    drawCellMarker(
      ctx,
      cell,
      `rgba(156,207,74,${(isArmed ? 0.34 : 0.16) * alpha})`,
      `rgba(156,207,74,${(isArmed ? 1 : 0.8) * alpha})`,
      isArmed ? 4 : 2.5,
    );
    marked.push({ cell, cost, kind: 'bulwark', affordable, armed: isArmed });
  }
  return marked;
}

/**
 * The prices, written after the sprites so a heap of rubble cannot hide its own
 * price tag. They sit inside the cell rather than floating above it: cells tile
 * the ground without overlapping, so two neighbouring prices never collide the
 * way two labels on stalks would. The question itself goes to the banner.
 */
function drawDemolishPrices(ctx, marked) {
  for (const { cell, cost, affordable, armed } of marked) {
    const [x, y] = iso(cell.x + 0.5, cell.y + 0.5);
    comicText(ctx, String(cost), x, y + 5, armed ? 19 : 15, affordable ? C.gold : 'rgba(232,220,192,.4)');
  }
}

/**
 * @param {ReturnType<import('./sprites/rasterizer.js').createSpriteCache>} sprites
 */
export function createSceneRenderer(sprites) {
  const drawVignette = createVignette();
  const backdrop = createBackdropLayer();
  const atmosphere = createAtmosphere();
  const drawEnemySprite = createEnemySpriteRenderer(sprites);
  const drawPod = createPodRenderer(sprites);
  const items = [];
  /** Render-side time of the last frame, for the ash drift. */
  let lastT = null;

  /**
   * @param {object} ui  Render-side state: hover cell, flashes, reduced motion, art mode.
   * @param {object} ground  Ground layer from createGroundLayer().
   */
  return function renderScene(ctx, view, cam, state, ui, ground, t) {
    const { map } = state;
    const dt = lastT === null ? 0 : Math.min(0.05, Math.max(0, t - lastT));
    lastT = t;
    atmosphere.update(dt, view, ui.reducedMotion);

    // An explosion shakes the whole picture: the camera stays where it is, only
    // this frame is drawn from a nudged one.
    const [shakeX, shakeY] = ui.effects?.shakeOffset(ui.reducedMotion) ?? [0, 0];
    const shaken =
      shakeX || shakeY ? { x: cam.x - shakeX / cam.zoom, y: cam.y - shakeY / cam.zoom, zoom: cam.zoom } : cam;

    backdrop.draw(ctx, view, shaken, state.seed, shakeX, shakeY);
    ground.draw(ctx, shaken, view, map.size, state.seed, t * 1000);

    applyCamera(ctx, shaken, view);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    drawRiftGlow(ctx, map.rift, t);
    drawBastionGlow(ctx, map.bastion, t);

    // While zones are marked the preview shows the route they will force.
    const route = previewRoute(state);
    if (PLANNING_PHASES.has(state.phase) && route) drawRoutePreview(ctx, route, t, ui.reducedMotion);

    // The demolish mode takes the map over: no zones are marked while it runs.
    let demolishable = null;
    if (state.phase === 'planning') {
      if (ui.demolishMode) {
        demolishable = drawDemolishOverlay(ctx, state, ui.demolishArmed, t, ui.reducedMotion);
      } else if (ui.bulwarkMode) {
        demolishable = drawBulwarkOverlay(ctx, state, ui.bulwarkArmed, t, ui.reducedMotion);
      } else {
        state.zones.forEach((zone, i) => drawZoneMarker(ctx, zone, i, t, ui.reducedMotion));
      }
    }
    // Cells cleared in demolish mode keep a faint ring until a capsule takes
    // them or the wave starts (docs/ART.md).
    if (PLANNING_PHASES.has(state.phase)) {
      for (const cell of ui.clearedCells) drawClearedMarker(ctx, cell, t, ui.reducedMotion);
    }
    for (const pod of state.pods) drawPodTarget(ctx, pod, t);

    // Scorch marks, auras and flame cones lie on the ground, under the units.
    ui.effects?.drawGround(ctx, state, t, ui.reducedMotion);

    // The gold ring of a recipe emplacement belongs here and not to the figure:
    // it lies flat on the ground and must never end up on a neighbour's socket
    // (docs/ART.md). After the scorch marks, so a burnt cell does not hide it.
    if (ui.art === 'sprites') {
      for (const tower of state.towers) if (tower.special) drawSpecialRing(ctx, tower);
    }

    // What the player is looking at shows how far it reaches.
    if (ui.inspect) {
      const tower = towerAt(state, ui.inspect);
      if (tower) {
        const stats = towerStats(tower);
        ui.effects?.drawRange(ctx, tower.x + 0.5, tower.y + 0.5, stats.range, DOCTRINE_COLORS[stats.doctrine]);
      }
    }
    // During the selection, the pod in focus shows the reach it would have.
    if (state.phase === 'selection') {
      const pod = state.pods[ui.podSelected];
      if (pod) {
        const stats = towerStats({ doctrine: pod.doctrine, rank: pod.rank });
        ui.effects?.drawRange(ctx, pod.x + 0.5, pod.y + 0.5, stats.range, DOCTRINE_COLORS[pod.doctrine]);
      }
    }

    if (ui.hoverCell) drawCellMarker(ctx, ui.hoverCell, 'rgba(242,193,78,.12)', 'rgba(242,193,78,.8)', 2);
    // While a command is aimed, the cell under the pointer shows its reach.
    if (ui.commandTarget && ui.hoverCell && ui.commandRadius) {
      ui.effects?.drawAiming(ctx, ui.hoverCell, ui.commandRadius);
    }
    // A line command shows its strip once the start is set.
    if (ui.commandLine) {
      // On touch the armed end holds the strip still until it is confirmed; with
      // a mouse it follows the pointer.
      const end = ui.commandLineTo ?? ui.hoverCell;
      if (ui.commandLineFrom && end) {
        ui.effects?.drawLineAiming(ctx, ui.commandLineFrom, end, ui.commandLine.halfWidth, t);
      } else if (ui.hoverCell) {
        ui.effects?.drawAiming(ctx, ui.hoverCell, ui.commandLine.halfWidth);
      }
    }
    for (const f of ui.flashes) {
      const a = Math.max(0, f.life / f.max);
      const col = f.ok ? `rgba(156,207,74,${a})` : `rgba(255,58,42,${a})`;
      const fill = f.ok ? `rgba(156,207,74,${a * 0.25})` : `rgba(255,58,42,${a * 0.3})`;
      drawCellMarker(ctx, f.cell, fill, col, 3);
    }

    // Depth-sorted objects: key is x + y of the object's front. Anything whose
    // ground point lies well outside the viewport is skipped; with 200 enemies at
    // full zoom that is most of them.
    const area = visibleArea(shaken, view);
    const onScreen = (gx, gy) => {
      const [px, py] = iso(gx, gy);
      return px >= area.x0 && px <= area.x1 && py >= area.y0 && py <= area.y1;
    };
    items.length = 0;
    for (const o of map.obstacles) {
      for (let i = 0; i < o.cells.length; i++) {
        const c = o.cells[i];
        if (onScreen(c.x + 0.5, c.y + 0.5)) items.push([c.x + c.y + 1, KIND_OBSTACLE, o, i]);
      }
    }
    for (const tower of state.towers) {
      if (onScreen(tower.x + 0.5, tower.y + 0.5)) items.push([tower.x + tower.y + 1, KIND_TOWER, tower, 0]);
    }
    for (const pod of state.pods) items.push([pod.x + pod.y + 1, KIND_POD, pod, 0]);
    items.push([map.rift.x + map.rift.y + 1, KIND_RIFT, map.rift, 0]);
    items.push([map.bastion.x + map.bastion.y + 1, KIND_BASTION, map.bastion, 0]);
    map.beacons.forEach((b, i) => items.push([b.x + b.y + 1, KIND_BEACON, b, i]));
    for (const e of state.enemies) if (onScreen(e.x, e.y)) items.push([e.x + e.y, KIND_ENEMY, e, 0]);
    items.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    // One view object for all enemies, instead of one per creature per frame.
    const enemyView = { zoom: cam.zoom, dpr: view.dpr, reducedMotion: ui.reducedMotion, simTime: state.time, dt };

    for (const [, kind, o, i] of items) {
      if (kind === KIND_OBSTACLE) drawObstacleCell(ctx, o, i);
      else if (kind === KIND_RIFT) drawRift(ctx, o, t);
      else if (kind === KIND_BASTION) drawBastion(ctx, o, t);
      else if (kind === KIND_BEACON) drawBeacon(ctx, o, t);
      else if (kind === KIND_POD) drawPod(ctx, o, t, enemyView);
      else if (kind === KIND_TOWER) {
        if (ui.art !== 'sprites' || !drawTowerSprite(ctx, sprites, o, cam.zoom, view.dpr, t, dt, ui.reducedMotion)) {
          drawTowerPlaceholder(ctx, o);
        }
      } else {
        if (ui.art !== 'sprites' || !drawEnemySprite(ctx, o, t, enemyView)) drawEnemy(ctx, o, t);
        drawEnemyBar(ctx, o, ENEMY_TOP[o.type] ?? 20);
      }
    }

    // What a recipe would swallow, once everything else is on the canvas.
    if (ui.recipePreview?.length) drawRecipePreview(ctx, state, ui, shaken, view, t, sprites);

    // Rings go on top of the opened hatches, otherwise the pod hides them.
    if (state.phase === 'selection') {
      for (const index of ui.podHighlights ?? []) {
        const pod = state.pods[index];
        if (pod) drawPodHighlight(ctx, pod, { selected: index === ui.podSelected, t, reducedMotion: ui.reducedMotion });
      }
    }
    for (const pod of state.pods) drawPodHologram(ctx, pod, t);
    map.beacons.forEach((b, i) => drawBeaconLabel(ctx, b, i + 1));

    // Shots, shells, particles and damage numbers go on top of the units.
    ui.effects?.drawAbove(ctx, state, t, ui.reducedMotion);

    if (demolishable) drawDemolishPrices(ctx, demolishable);

    for (const f of ui.flashes) {
      if (!f.label) continue;
      const [x, y] = iso(f.cell.x + 0.5, f.cell.y + 0.5, 40 + (1 - f.life / f.max) * 20);
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
      comicText(ctx, f.label, x, y, 18, f.ok ? C.toxicL : '#ff6a4a');
      ctx.globalAlpha = 1;
    }

    atmosphere.draw(ctx, view, t, ui.reducedMotion);
    drawVignette(ctx, view);
    ui.effects?.drawFlash(ctx, view, ui.reducedMotion);
  };
}
