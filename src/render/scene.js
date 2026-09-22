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
  drawTowerPlaceholder,
} from './objects.js';
import { createEnemySpriteRenderer } from './enemySprites.js';
import { drawTowerSprite } from './towerSprites.js';
import { drawZoneMarker, drawPod, drawPodTarget, drawPodHologram, drawPodHighlight } from './pods.js';

const KIND_OBSTACLE = 0;
const KIND_RIFT = 1;
const KIND_BEACON = 2;
const KIND_BASTION = 3;
const KIND_TOWER = 4;
const KIND_POD = 5;
const KIND_ENEMY = 6;

/** Phases that show the route preview and the planned landing zones. */
const PLANNING_PHASES = new Set(['planning', 'salvo', 'selection']);

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

function drawBackdrop(ctx, view) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const h = view.height * view.dpr;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#110c0a');
  g.addColorStop(0.45, '#2b1a13');
  g.addColorStop(1, '#1a120e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.width * view.dpr, h);
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
 * @param {ReturnType<import('./sprites/rasterizer.js').createSpriteCache>} sprites
 */
export function createSceneRenderer(sprites) {
  const drawVignette = createVignette();
  const drawEnemySprite = createEnemySpriteRenderer(sprites);
  const items = [];

  /**
   * @param {object} ui  Render-side state: hover cell, flashes, reduced motion, art mode.
   * @param {object} ground  Ground layer from createGroundLayer().
   */
  return function renderScene(ctx, view, cam, state, ui, ground, t) {
    const { map } = state;
    drawBackdrop(ctx, view);
    ground.draw(ctx, cam, view, map.size, state.seed, t * 1000);

    applyCamera(ctx, cam, view);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    drawRiftGlow(ctx, map.rift, t);
    drawBastionGlow(ctx, map.bastion, t);

    if (PLANNING_PHASES.has(state.phase) && state.route) drawRoutePreview(ctx, state.route, t, ui.reducedMotion);

    if (state.phase === 'planning') {
      state.zones.forEach((zone, i) => drawZoneMarker(ctx, zone, i, t, ui.reducedMotion));
    }
    for (const pod of state.pods) drawPodTarget(ctx, pod, t);
    if (state.phase === 'selection') {
      for (const index of ui.podHighlights ?? []) {
        const pod = state.pods[index];
        if (pod) drawPodHighlight(ctx, pod, { selected: index === ui.podSelected, t, reducedMotion: ui.reducedMotion });
      }
    }

    if (ui.hoverCell) drawCellMarker(ctx, ui.hoverCell, 'rgba(242,193,78,.12)', 'rgba(242,193,78,.8)', 2);
    for (const f of ui.flashes) {
      const a = Math.max(0, f.life / f.max);
      const col = f.ok ? `rgba(156,207,74,${a})` : `rgba(255,58,42,${a})`;
      const fill = f.ok ? `rgba(156,207,74,${a * 0.25})` : `rgba(255,58,42,${a * 0.3})`;
      drawCellMarker(ctx, f.cell, fill, col, 3);
    }

    // Depth-sorted objects: key is x + y of the object's front.
    items.length = 0;
    for (const o of map.obstacles) {
      for (let i = 0; i < o.cells.length; i++) items.push([o.cells[i].x + o.cells[i].y + 1, KIND_OBSTACLE, o, i]);
    }
    for (const tower of state.towers) items.push([tower.x + tower.y + 1, KIND_TOWER, tower, 0]);
    for (const pod of state.pods) items.push([pod.x + pod.y + 1, KIND_POD, pod, 0]);
    items.push([map.rift.x + map.rift.y + 1, KIND_RIFT, map.rift, 0]);
    items.push([map.bastion.x + map.bastion.y + 1, KIND_BASTION, map.bastion, 0]);
    map.beacons.forEach((b, i) => items.push([b.x + b.y + 1, KIND_BEACON, b, i]));
    for (const e of state.enemies) items.push([e.x + e.y, KIND_ENEMY, e, 0]);
    items.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    for (const [, kind, o, i] of items) {
      if (kind === KIND_OBSTACLE) drawObstacleCell(ctx, o, i);
      else if (kind === KIND_RIFT) drawRift(ctx, o, t);
      else if (kind === KIND_BASTION) drawBastion(ctx, o, t);
      else if (kind === KIND_BEACON) drawBeacon(ctx, o, t);
      else if (kind === KIND_POD) drawPod(ctx, o, t);
      else if (kind === KIND_TOWER) {
        if (ui.art !== 'sprites' || !drawTowerSprite(ctx, sprites, o, cam.zoom, view.dpr, t)) {
          drawTowerPlaceholder(ctx, o);
        }
      } else if (ui.art !== 'sprites' || !drawEnemySprite(ctx, o, t, cam.zoom, view.dpr)) drawEnemy(ctx, o, t);
    }

    for (const pod of state.pods) drawPodHologram(ctx, pod, t);
    map.beacons.forEach((b, i) => drawBeaconLabel(ctx, b, i + 1));

    for (const f of ui.flashes) {
      if (!f.label) continue;
      const [x, y] = iso(f.cell.x + 0.5, f.cell.y + 0.5, 40 + (1 - f.life / f.max) * 20);
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
      comicText(ctx, f.label, x, y, 18, f.ok ? C.toxicL : '#ff6a4a');
      ctx.globalAlpha = 1;
    }

    drawVignette(ctx, view);
  };
}
