// Draws a frame from the game state. Reads state, never writes it.

import { iso } from './iso.js';
import { applyCamera } from './camera.js';
import { cellPath, comicText, ell, poly } from './draw.js';
import { C } from './palette.js';
import {
  drawObstacleCell,
  drawRift,
  drawRiftGlow,
  drawRiftMouth,
  drawRiftGlowAt,
  drawRiftLabel,
  drawBanZone,
  drawBastion,
  bastionShadow,
  beaconShadow,
  obstacleShadow,
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
import { warmKit } from './rubbleCache.js';
import {
  biomeOf,
  paletteOf,
  FOUNDATION_ALPHA,
  FOUNDATION_INSET,
  FOUNDATION_LINE,
  FOUNDATION_RIM,
  FOUNDATION_RIM_ALPHA,
} from './biomes.js';
import { createTrail } from './trail.js';
import { castShadows } from './shadows.js';
import { occludersOf, occludersOfAll, cellsKey, fadeStep } from './occlusion.js';
import { REVEAL, OBSTACLE_SEE_THROUGH } from '../data/art.js';
import { STEP, heightField, setActiveTerrain, cellLift, liftAt } from './terrain.js';
import { snapToAxis } from '../sim/commands.js';
import { drawKoloss, kolossDepth, isKolossEnemy } from './koloss.js';
import { laneStart } from '../sim/koloss.js';
import { drawTowerSprite, drawSpecialRing, towerAnchor, towerPictureBox } from './towerSprites.js';
import { clipToGround } from './groundClip.js';
import { coverHulls, coverHullsOfSquare, plateBounds, coveringObstacles, shadowPlan } from './cover.js';
import {
  createPodRenderer,
  drawZoneFill,
  drawZoneFrame,
  drawClearedMarker,
  drawPodTarget,
  drawPodHologram,
  drawPodFrame,
} from './pods.js';
import { previewRoute } from '../sim/zones.js';
import { flyerPolyline } from '../sim/route.js';
import { waveFlies } from '../sim/waves.js';
import { towerAt, towerStats } from '../sim/towers.js';
import { demolishTarget, nextBulwarkCost } from '../sim/economy.js';
import { PLANNING_PHASES } from '../core/phases.js';
import { canUpgradeTower } from '../sim/actions.js';
import { towerById } from '../sim/towers.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { STRINGS } from '../data/strings.js';

const KIND_OBSTACLE = 0;
const KIND_RIFT = 1;
const KIND_BEACON = 2;
const KIND_BASTION = 3;
const KIND_TOWER = 4;
const KIND_POD = 5;
const KIND_ENEMY = 6;
// A frame on the ground of one field, drawn after everything standing on that field (docs/ART.md).
const KIND_MARKER = 7;

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

/** Opacity of the vignette at the corners (docs/ART.md, frame). */
const VIGNETTE_STRENGTH = 0.82;

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
      g.addColorStop(1, `rgba(0,0,0,${VIGNETTE_STRENGTH})`);
      v.fillStyle = g;
      v.fillRect(0, 0, w, h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(canvas, 0, 0);
  };
}

/** How far the veil over the untouched map takes it back (docs/ART.md). */
const PREVIEW_VEIL = 0.62;
/** Size of the arrow over a doomed emplacement, in world pixels. */
const DOOM_ARROW = { width: 26, height: 22, stem: 16, lift: 34, bob: 5 };
/** Spacing in cells of the points the line of the flyers is built from, so it can follow the terrain. */
const FLYER_LINE_SAMPLE = 0.5;

/**
 * The arrow hanging over an emplacement a recipe would eat: a fat chevron
 * pointing down at it, bobbing. Drawn in world pixels rather than scaled with
 * the figure, so it stays readable at the smallest zoom — on the map alone the
 * gold ring around a distant bunker is easy to miss (feedback from the iPad).
 *
 * It hangs off `towerAnchor`, the point the weapon effects come from, so it sits
 * right over a tall laser mast and over a flat bunker without a case for each.
 *
 * The shape is exported on its own so a test can read it without a canvas.
 * @param {number[]} anchor  Screen point of the emplacement, from `towerAnchor`.
 */
export function doomArrowPoints([ax, ay], t, reducedMotion = false) {
  const { width: w, height: h, stem, lift, bob: swing } = DOOM_ARROW;
  const bob = reducedMotion ? 0 : Math.sin(t * 3.4) * swing;
  // y grows downwards, so the arrow hangs above the anchor at a negative offset
  // and its tip is its lowest point.
  const tip = ay - lift + bob;
  return [
    [ax, tip],
    [ax + w / 2, tip - h],
    [ax + w / 6, tip - h],
    [ax + w / 6, tip - h - stem],
    [ax - w / 6, tip - h - stem],
    [ax - w / 6, tip - h],
    [ax - w / 2, tip - h],
  ];
}

function drawDoomArrow(ctx, tower, t, reducedMotion) {
  const [ax, ay] = towerAnchor(tower);
  poly(ctx, doomArrowPoints([ax, ay - cellLift(tower.x, tower.y)], t, reducedMotion), C.gold, C.ink, 2.5);
}

/**
 * Recipe preview (docs/ART.md): while a recipe is being looked at, the map goes
 * dark and only the emplacements the recipe would eat keep their colour, each in
 * a pulsing gold ring with an arrow over it. Drawn after the depth-sorted pass,
 * so the veil covers everything already on the canvas and the doomed ones are
 * put back on top; the arrows come last and are never covered.
 *
 * The emplacements are redrawn with dt 0: their weapons have already been moved
 * on this frame, and moving them twice would work off the recoil too fast.
 */
function drawRecipePreview(ctx, state, ui, cam, view, t, sprites) {
  const doomed = ui.recipePreview.map((id) => towerById(state, id)).filter(Boolean);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = `rgba(17,12,10,${PREVIEW_VEIL})`;
  ctx.fillRect(0, 0, view.width * view.dpr, view.height * view.dpr);
  applyCamera(ctx, cam, view);
  const pulse = ui.reducedMotion ? 0.8 : 0.6 + Math.sin(t * 5) * 0.3;
  for (const tower of doomed) {
    drawCellMarker(ctx, tower, `rgba(242,193,78,${pulse * 0.45})`, `rgba(242,193,78,${pulse})`, 3);
    const lift = cellLift(tower.x, tower.y);
    ctx.translate(0, -lift);
    if (ui.art !== 'sprites' || !drawTowerSprite(ctx, sprites, tower, cam.zoom, view.dpr, t, 0, ui.reducedMotion)) {
      drawTowerPlaceholder(ctx, tower);
    }
    ctx.translate(0, lift);
  }
  for (const tower of doomed) drawDoomArrow(ctx, tower, t, ui.reducedMotion);
}

/** Dashed, slowly marching route line with ink underlay. */
function drawRoutePreview(ctx, route, t, reducedMotion) {
  // Every point on the height of its own field, so the line climbs a step with the route.
  const pts = route.cells.map(({ x, y }) => iso(x + 0.5, y + 0.5, cellLift(x, y)));
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

/**
 * The line the flyers of the coming wave take: straight over the maze, which is
 * why it has to be shown. Pale and dotted, so it never reads as the route the
 * ground troops walk; an arrowhead at the bastion says which way (balancing
 * round 5: three of seven matches of new players ended in a flyer wave with
 * the anti-air standing beside the maze, not under this line).
 */
function drawFlyerLine(ctx, line, t, reducedMotion) {
  // Dense, every point on the ground height under it: the line follows the terrain.
  const pts = [];
  const ends = line.points.map(({ x, y }) => iso(x, y));
  for (let i = 0; i + 1 < line.points.length; i++) {
    const a = line.points[i];
    const b = line.points[i + 1];
    const len = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
    const steps = Math.max(1, Math.ceil(len / FLYER_LINE_SAMPLE));
    for (let k = 0; k < steps; k++) {
      const x = a.x + ((b.x - a.x) * k) / steps;
      const y = a.y + ((b.y - a.y) * k) / steps;
      pts.push(iso(x, y, liftAt(x, y)));
    }
  }
  const end = line.points[line.points.length - 1];
  const endLift = liftAt(end.x, end.y);
  pts.push(iso(end.x, end.y, endLift));
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  trace();
  ctx.strokeStyle = 'rgba(26,20,16,.45)';
  ctx.lineWidth = 5;
  ctx.stroke();
  trace();
  ctx.setLineDash([2, 9]);
  ctx.lineDashOffset = reducedMotion ? 0 : -t * 30;
  ctx.strokeStyle = C.bone;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead on the last leg, a little short of the bastion.
  const [ax, ay] = ends[ends.length - 2];
  const [bx, by] = ends[ends.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const tipX = bx - ux * 34;
  const tipY = by - uy * 34 - endLift;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - ux * 14 - uy * 8, tipY - uy * 14 + ux * 8);
  ctx.lineTo(tipX - ux * 14 + uy * 8, tipY - uy * 14 - ux * 8);
  ctx.closePath();
  ctx.fillStyle = C.bone;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
}

function drawCellFill(ctx, cell, fill) {
  const lift = cellLift(cell.x, cell.y);
  ctx.translate(0, -lift);
  cellPath(ctx, cell.x, cell.y, 0.04);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.translate(0, lift);
}

/** The outline of a field, at the height of the field (the caller does not lift). */
function strokeCell(ctx, cell, stroke, lineWidth) {
  cellPath(ctx, cell.x, cell.y, 0.04);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawCellMarker(ctx, cell, fill, stroke, lineWidth = 2.5) {
  if (fill) drawCellFill(ctx, cell, fill);
  const lift = cellLift(cell.x, cell.y);
  ctx.translate(0, -lift);
  strokeCell(ctx, cell, stroke, lineWidth);
  ctx.translate(0, lift);
}

/**
 * A marker whose fill lies on the ground and whose frame is drawn later, in the depth-sorted
 * pass, so a heap of rubble or a wall on the same field cannot hide it (docs/ART.md).
 * @param {{x: number, y: number, draw: Function}[]} frames  Collects the frames still to draw.
 */
function deferCellMarker(ctx, frames, cell, fill, stroke, lineWidth = 2.5) {
  if (fill) drawCellFill(ctx, cell, fill);
  frames.push({ x: cell.x, y: cell.y, draw: () => strokeCell(ctx, cell, stroke, lineWidth) });
}

/**
 * The spot the Koloss is driving at: a ring of warning stripes that tightens
 * once it is on the field. Deliberately unlike a landing zone — one is an offer,
 * this is a threat.
 */
function drawKolossTarget(ctx, map, run, t, reducedMotion) {
  const { lane, target, swathe } = run;
  const pulse = reducedMotion ? 0.7 : 0.5 + 0.5 * Math.abs(Math.sin(t * 8));
  const RED = '#ff3a1a';

  // The dashed drive line, from where it enters at the map edge to the end of
  // the swathe (docs/ART.md, "Zielankündigung"). Without a lane it is walled in
  // and only the target itself is marked.
  if (lane) {
    const start = laneStart(map, lane.index, lane);
    const a = iso(start.x + 0.5 + lane.dx * 1.4, start.y + 0.5 + lane.dy * 1.4, liftAt(start.x + 0.5, start.y + 0.5));
    const last = swathe.length ? swathe[swathe.length - 1] : target;
    const b = iso(last.x + 0.5, last.y + 0.5, cellLift(last.x, last.y));
    ctx.save();
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = reducedMotion ? 0 : -t * 30;
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = RED;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;

    // The swathe cells pulsing red.
    ctx.fillStyle = RED;
    for (const c of swathe) {
      ctx.globalAlpha = 0.18 + 0.14 * pulse;
      const lift = cellLift(c.x, c.y);
      ctx.translate(0, -lift);
      cellPath(ctx, c.x, c.y, 0.04);
      ctx.fill();
      ctx.translate(0, lift);
    }
    ctx.globalAlpha = 1;
  }

  // The target ring: a hard ellipse that breathes, a soft inner one, and four
  // segments turning around it.
  const [cx, cy] = iso(target.x + 0.5, target.y + 0.5, cellLift(target.x, target.y));
  ctx.globalAlpha = 0.9;
  ell(ctx, cx, cy, 34 + pulse * 6, 17 + pulse * 3, null, RED, 3.4);
  ell(ctx, cx, cy, 22, 11, null, '#ffb0a0', 2);
  ctx.strokeStyle = RED;
  ctx.lineWidth = 4;
  for (let q = 0; q < 4; q++) {
    const a = (reducedMotion ? 0 : t * 2) + (q * Math.PI) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 44, 22, 0, a, a + 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}


/**
 * Everything the demolish mode could clear (GDD section 13). Rubble is marked in
 * gold, a position of the player's own in red: tearing one down is the
 * expensive, irreversible move. What the player cannot afford stays dim, and the
 * cell waiting for its confirming tap pulses.
 * @returns {{cell: object, cost: number, kind: string, affordable: boolean, armed: boolean}[]}
 *   The same cells again, so the prices can be written after the sprites.
 */
function drawDemolishOverlay(ctx, frames, state, armed, t, reducedMotion) {
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
    deferCellMarker(
      ctx,
      frames,
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
function drawBulwarkOverlay(ctx, frames, state, armed, t, reducedMotion) {
  const cost = nextBulwarkCost(state);
  const affordable = state.requisition >= cost;
  const pulse = reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(t * 6);
  const marked = [];
  for (const obstacle of state.map.obstacles) {
    if (obstacle.kind !== 'rubble') continue;
    const cell = obstacle.cells[0];
    const isArmed = Boolean(armed && armed.x === cell.x && armed.y === cell.y);
    const alpha = (affordable ? 1 : 0.35) * (isArmed ? pulse : 1);
    deferCellMarker(
      ctx,
      frames,
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
 * King of the Hill's upgrade mode (M7b, B5): every emplacement that could go up
 * a rank instead of the salvo, with its price; the armed one pulses.
 */
function drawUpgradeOverlay(ctx, frames, state, armed, t, reducedMotion) {
  const pulse = reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(t * 6);
  const marked = [];
  for (const tower of state.towers) {
    const check = canUpgradeTower(state, tower.id);
    if (!check.ok && check.reason !== 'funds') continue;
    const affordable = check.ok;
    const isArmed = armed === tower.id;
    const alpha = (affordable ? 1 : 0.35) * (isArmed ? pulse : 1);
    deferCellMarker(
      ctx,
      frames,
      tower,
      `rgba(232,200,114,${(isArmed ? 0.34 : 0.16) * alpha})`,
      `rgba(232,200,114,${(isArmed ? 1 : 0.8) * alpha})`,
      isArmed ? 4 : 2.5,
    );
    marked.push({ cell: { x: tower.x, y: tower.y }, cost: check.cost, kind: 'upgrade', affordable, armed: isArmed });
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
    const [x, y] = iso(cell.x + 0.5, cell.y + 0.5, cellLift(cell.x, cell.y));
    comicText(ctx, String(cost), x, y + 5, armed ? 19 : 15, affordable ? C.gold : 'rgba(232,220,192,.4)');
  }
}

/**
 * @param {ReturnType<import('./sprites/rasterizer.js').createSpriteCache>} sprites
 */
/** Footprint of the bastion in cells: 1 on the standard map, 2 in King of the Hill. */
function bastionSize(map) {
  return map.bastionCells ? Math.round(Math.sqrt(map.bastionCells.length)) : 1;
}

/**
 * Where each rift of a map with several sits and where its name goes (M7b, B8):
 * the middle of its gates, a point beyond the map edge outwards from there, and
 * the angle of that edge on screen. Built once per map.
 */
const riftLayouts = new WeakMap();
function riftLayout(map) {
  let layout = riftLayouts.get(map.rifts);
  if (layout) return layout;
  const mid = map.size / 2;
  layout = map.rifts.map((rift) => {
    const x = rift.gates.reduce((sum, g) => sum + g.x + 0.5, 0) / rift.gates.length;
    const y = rift.gates.reduce((sum, g) => sum + g.y + 0.5, 0) / rift.gates.length;
    const dx = x - mid;
    const dy = y - mid;
    const len = Math.hypot(dx, dy) || 1;
    // A rift on the top or bottom edge lies along x, on screen (32, 16); one on
    // the left or right edge along y, (-32, 16), read left to right.
    const alongX = rift.gates.every((g) => g.y === rift.gates[0].y);
    return { x, y, labelX: x + (dx / len) * 1.7, labelY: y + (dy / len) * 1.7, angle: Math.atan2(alongX ? 16 : -16, 32) };
  });
  riftLayouts.set(map.rifts, layout);
  return layout;
}

/** Route length as the player reads it: one decimal, German comma. */
function cells(length) {
  return STRINGS.hud.riftLength(length.toFixed(1).replace('.', ','));
}

/** A path in iso space, for a clip or a fill, moved down by `applied` px (the lift of its level). */
function polygonPath(path, points, applied = 0) {
  points.forEach(([px, py], k) => (k ? path.lineTo(px, py + applied) : path.moveTo(px, py + applied)));
  path.closePath();
}

/** Corners of the diamond of a field, for the clip of a shadow. */
function cellDiamond(x, y) {
  return [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)];
}

/**
 * Shadows of obstacles, bastion and beacons on the ground, before any depth-sorted figure. A shadow
 * lies on the plane of the field its body stands on, so one fill per level. Where a body stands
 * near a step the shadow is clipped to the fields of its own level (it would hang over a cliff or
 * climb the slope of the higher neighbour) and cut by the pictures of the higher blocks in front
 * that hide the ground there (`shadowPlan`). The plan and the clip paths are built when the
 * obstacles or the terrain change, never per frame.
 */
function createShadowLayer() {
  const watch = createWatcher();
  let layers = null;
  return function draw(ctx, state, map, field) {
    const list = watch.list;
    list.length = 0;
    for (const o of map.obstacles) list.push(o.kind, o.cells.length, o.cells[0]?.x, o.cells[0]?.y, o.variant);
    list.push(map.bastion.x, map.bastion.y, bastionSize(map), map.beacons.length);
    for (const b of map.beacons) list.push(b.x, b.y);
    if (watch.changed(field)) {
      const entries = [];
      for (const o of map.obstacles) {
        for (let i = 0; i < o.cells.length; i++) {
          entries.push({ x: o.cells[i].x, y: o.cells[i].y, bodies: obstacleShadow(o, i) });
        }
      }
      const size = bastionSize(map);
      entries.push({ x: map.bastion.x, y: map.bastion.y, size, bodies: bastionShadow(map.bastion, size) });
      for (const b of map.beacons) entries.push({ x: b.x, y: b.y, bodies: beaconShadow(b) });
      layers = shadowPlan(field, entries).map((plan, level) => {
        const applied = level * STEP;
        const ground = new Path2D();
        for (const c of plan.ground) polygonPath(ground, cellDiamond(c.x, c.y));
        const cuts = plan.cuts.map((hull) => {
          const path = new Path2D();
          path.rect(-100000, -100000, 200000, 200000);
          polygonPath(path, hull, applied);
          return path;
        });
        return { plain: plan.plain, edge: plan.edge, ground, cuts };
      });
    }
    layers.forEach(({ plain, edge, ground, cuts }, level) => {
      ctx.translate(0, -level * STEP);
      castShadows(ctx, plain);
      if (edge.length) {
        ctx.save();
        ctx.clip(ground);
        for (const cut of cuts) ctx.clip(cut, 'evenodd');
        castShadows(ctx, edge);
        ctx.restore();
      }
      ctx.translate(0, level * STEP);
    });
  };
}

/**
 * Tells whether a flat list of numbers (and one object) is the same as at the last call, without
 * building a string. Fill `list`, then ask `changed`.
 */
function createWatcher() {
  let last = [];
  let list = [];
  let known = null;
  return {
    get list() {
      return list;
    },
    changed(object) {
      let same = object === known && list.length === last.length;
      for (let i = 0; same && i < list.length; i++) same = list[i] === last[i];
      if (same) return false;
      [last, list] = [list, last];
      known = object;
      return true;
    },
  };
}

/**
 * The plate an emplacement stands on: a rectangle just outside its cell in the guide colour of its
 * doctrine, so an emplacement never melts into the ground. Lies under the gold ring. At an edge
 * where the level changes it stops at the edge (`plateBounds`): it would hang over a cliff or climb
 * the wall of the higher field.
 */
function drawFoundation(ctx, tower, field, opacity = 1) {
  const lift = cellLift(tower.x, tower.y);
  ctx.translate(0, -lift);
  const color = DOCTRINE_COLORS[tower.doctrine];
  const b = plateBounds(field, tower.x, tower.y, FOUNDATION_INSET);
  ctx.beginPath();
  [iso(b.x0, b.y0), iso(b.x1, b.y0), iso(b.x1, b.y1), iso(b.x0, b.y1)].forEach(([px, py], k) =>
    k ? ctx.lineTo(px, py) : ctx.moveTo(px, py),
  );
  ctx.closePath();
  ctx.globalAlpha = opacity * FOUNDATION_ALPHA;
  ctx.fillStyle = color;
  ctx.fill();
  // The rim: a stroke centred on the outline, clipped to the inside, wide enough to leave
  // FOUNDATION_RIM px of colour beside the outline.
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = opacity * FOUNDATION_RIM_ALPHA;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * (FOUNDATION_LINE / 2 + FOUNDATION_RIM);
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = opacity;
  ctx.lineWidth = FOUNDATION_LINE;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.translate(0, lift);
}

/** The area round a field that is cut out, in world pixels: sideways, above its middle and below it. */
const COVER_REACH = { x: 160, up: 300, down: 80 };

/**
 * Draws a figure that stands on a field behind the terrain in front of it. Blocks of terrain that
 * are higher than the field and nearer to the camera cover part of it (`cover`, from `coverHulls`;
 * (mx, my) is the middle of the field on screen):
 * `draw` is called once with the pictures of those blocks cut out of the canvas, so the figure stands
 * behind the block and neither climbs the slope nor ends up over its edge. While the field is being
 * looked at (the see-through of issue 35) `fade` is above 0 and `draw` is called once more for each
 * block, clipped to it and at that opacity; `again` is true then (and `fade` is passed on), so a
 * caller can leave out what must only happen once (the movement of a weapon).
 * @param {number} applied  How far the context is translated up at the call: 0 in the ground pass,
 *   the lift of the field inside the depth-sorted loop.
 */
function drawBehindTerrain(ctx, { hulls }, mx, my, applied, fade, draw) {
  if (!hulls.length) {
    draw(false);
    return;
  }
  const trace = (hull) => {
    hull.forEach(([px, py], k) => (k ? ctx.lineTo(px, py + applied) : ctx.moveTo(px, py + applied)));
    ctx.closePath();
  };
  ctx.save();
  for (const hull of hulls) {
    ctx.beginPath();
    ctx.rect(mx - COVER_REACH.x, my - COVER_REACH.up, 2 * COVER_REACH.x, COVER_REACH.up + COVER_REACH.down);
    trace(hull);
    ctx.clip('evenodd');
  }
  draw(false);
  ctx.restore();
  if (fade <= 0) return;
  for (const hull of hulls) {
    ctx.save();
    ctx.beginPath();
    trace(hull);
    ctx.clip();
    ctx.globalAlpha *= fade;
    draw(true, fade);
    ctx.restore();
  }
}

/** How much of a field's see-through is in force: the strongest layer that holds every block covering it. */
function coverFade(layers, cells) {
  let best = 0;
  for (const l of layers) {
    if (l.f <= best) continue;
    if (cells.every((c) => l.cells.some((k) => k.x === c.x && k.y === c.y))) best = l.f;
  }
  return best;
}

/** The boxes of one cell of an obstacle in cell coordinates, from its shadow bodies. */
function obstacleBodies(obstacle, index) {
  return obstacleShadow(obstacle, index).map(({ footprint, height }) => ({
    x0: footprint[0][0],
    y0: footprint[0][1],
    x1: footprint[2][0],
    y1: footprint[2][1],
    h: height,
  }));
}

/**
 * The obstacles drawn see-through. Found again only when the emplacements or the obstacles change,
 * never per frame: the ruins, walls and heaps of the kit that stand in front of an emplacement and
 * cover it (`coveringObstacles`).
 */
function createCoverTracker() {
  let last = [];
  let scratch = [];
  let known = null;
  let set = new Set();
  return function update(state, heights) {
    // A flat list of what decides the result, compared with the last one: no strings built per frame.
    scratch.length = 0;
    for (const t of state.towers) scratch.push(t.x, t.y, t.rank, t.doctrine, t.special ?? '');
    scratch.push(-1);
    for (const o of state.map.obstacles) scratch.push(o.kind, o.cells.length, o.cells[0]?.x, o.cells[0]?.y, o.variant);
    let same = heights === known && scratch.length === last.length;
    for (let i = 0; same && i < scratch.length; i++) same = scratch[i] === last[i];
    if (same) return set;
    [last, scratch] = [scratch, last];
    known = heights;
    const entries = state.map.obstacles
      .filter((o) => o.kind !== 'bulwark' && o.kind !== 'crater')
      .map((o) => ({ ob: o, cells: o.cells, bodies: (i) => obstacleBodies(o, i) }));
    const towers = state.towers.map((t) => ({ x: t.x, y: t.y, box: towerPictureBox(t) }));
    set = new Set([...coveringObstacles(heights, towers, entries)].map((e) => e.ob));
    return set;
  };
}

/**
 * The fields the player is looking at: the one under the pointer or pinned by a tap, and the
 * target of every capsule that is still coming or being chosen. Each with the colour of its outline.
 */
function lookedAtFields(state, ui, size) {
  const out = [];
  const seen = new Set();
  const add = (cell, color) => {
    if (!cell || cell.x < 0 || cell.y < 0 || cell.x >= size || cell.y >= size) return;
    const key = cell.y * size + cell.x;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x: cell.x, y: cell.y, color });
  };
  // The pointer and the pinned info panel only count while planning: once a wave runs (or a
  // capsule was taken) nothing is being placed or chosen. A tap leaves `hoverCell` standing; on a
  // field with an emplacement that is not a choice, so only `inspect` counts there.
  if (PLANNING_PHASES.has(state.phase)) {
    const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
    for (const cell of [ui.inspect, ui.hoverCell]) {
      const tower = cell ? towerAt(state, cell) : null;
      if (tower && !same(cell, ui.inspect)) continue;
      add(cell, tower ? DOCTRINE_COLORS[towerStats(tower).doctrine] : C.gold);
    }
  }
  const selecting = state.phase === 'selection';
  state.pods.forEach((pod, index) => {
    if (pod.landed && !(selecting && index === ui.podSelected)) return;
    add(pod, selecting && pod.doctrine ? DOCTRINE_COLORS[pod.doctrine] : '#ff3a2a');
  });
  return out;
}

/**
 * Moves the reveal layers (see ground.js, `drawReveal`) one frame on and returns the strongest
 * fade among the layers that are being kept: the opacity of the outlines.
 */
function updateReveal(layers, field, looked, dt, reducedMotion) {
  const cells = occludersOfAll(field, looked);
  const key = cellsKey(cells);
  let current = null;
  if (cells.length) {
    current = layers.find((l) => l.key === key);
    if (!current) {
      current = { key, cells, f: 0, active: true };
      layers.push(current);
    }
  }
  let strongest = 0;
  for (const l of layers) {
    l.active = l === current;
    l.f = fadeStep(l.f, l.active ? 1 : 0, dt, reducedMotion);
    if (l.active) strongest = l.f;
  }
  for (let i = layers.length - 1; i >= 0; i--) if (!layers[i].active && layers[i].f <= 0) layers.splice(i, 1);
  while (layers.length > REVEAL.maxLayers) layers.shift();
  return strongest;
}

/** Ink line under a colour line round the top face of every looked-at field that is covered. */
function drawRevealOutlines(ctx, field, looked, fade) {
  ctx.save();
  ctx.globalAlpha = fade;
  for (const f of looked) {
    if (!occludersOf(field, f.x, f.y).length) continue;
    const lift = cellLift(f.x, f.y);
    ctx.translate(0, -lift);
    cellPath(ctx, f.x, f.y, 0.04);
    ctx.globalAlpha = fade * REVEAL.outlineFillAlpha;
    ctx.fillStyle = f.color;
    ctx.fill();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = REVEAL.outlineInk;
    ctx.stroke();
    ctx.strokeStyle = f.color;
    ctx.lineWidth = REVEAL.outlineColor;
    ctx.stroke();
    ctx.translate(0, lift);
  }
  ctx.restore();
}

export function createSceneRenderer(sprites) {
  const drawVignette = createVignette();
  const backdrop = createBackdropLayer();
  const atmosphere = createAtmosphere();
  const drawEnemySprite = createEnemySpriteRenderer(sprites);
  const drawPod = createPodRenderer(sprites);
  const items = [];
  /** Marker frames of the frame, see KIND_MARKER. */
  const frames = [];
  /** Render-side time of the last frame, for the ash drift. */
  let lastT = null;
  /** Blocks of terrain shown see-through: one layer per set of covering fields, fading in or out. */
  let revealLayers = [];

  /**
   * @param {object} ui  Render-side state: hover cell, flashes, reduced motion, art mode.
   * @param {object} ground  Ground layer from createGroundLayer().
   */
  const trail = createTrail();
  const seeThroughOf = createCoverTracker();
  const drawShadows = createShadowLayer();

  return function renderScene(ctx, view, cam, state, ui, ground, t) {
    const { map } = state;
    const dt = lastT === null ? 0 : Math.min(0.05, Math.max(0, t - lastT));
    lastT = t;
    atmosphere.update(dt, view, ui.reducedMotion);
    const palette = paletteOf(biomeOf(state.seed));
    // The height of the ground is presentation only: the field comes from the seed, never from
    // the player's obstacles, and everything below reads it through `cellLift` / `liftAt`.
    const field = heightField(map, state.seed);
    setActiveTerrain(field);
    trail.update(state, dt);

    // An explosion shakes the whole picture: the camera stays where it is, only
    // this frame is drawn from a nudged one.
    const [shakeX, shakeY] = ui.effects?.shakeOffset(ui.reducedMotion) ?? [0, 0];
    const shaken =
      shakeX || shakeY ? { x: cam.x - shakeX / cam.zoom, y: cam.y - shakeY / cam.zoom, zoom: cam.zoom } : cam;

    backdrop.draw(ctx, view, shaken, state.seed, shakeX, shakeY);
    ground.draw(ctx, shaken, view, map.size, state.seed, t * 1000, field);
    const looked = lookedAtFields(state, ui, map.size);
    const revealFade = updateReveal(revealLayers, field, looked, dt, ui.reducedMotion);
    for (const layer of revealLayers) ground.drawReveal?.(ctx, shaken, view, layer.cells, layer.f);

    applyCamera(ctx, shaken, view);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // What the enemies have trampled, on the ground under everything else.
    trail.draw(ctx, palette, ui.art, state.seed, field);

    // The cast shadows of all blocks, in one fill so overlaps do not darken twice. They lie on
    // the ground under every figure, so a shadow never ends up on a neighbour (docs/ART.md).
    drawShadows(ctx, state, map, field);

    if (map.rifts) {
      riftLayout(map).forEach((r, i) => {
        const active = i === state.riftIndex;
        const lift = cellLift(r.x, r.y);
        ctx.translate(0, -lift);
        drawRiftGlowAt(ctx, r.x, r.y, t, { active, still: ui.reducedMotion });
        ctx.translate(0, lift);
      });
    } else {
      const lift = cellLift(map.rift.x, map.rift.y);
      ctx.translate(0, -lift);
      drawRiftGlow(ctx, map.rift, t);
      ctx.translate(0, lift);
    }
    {
      const lift = cellLift(map.bastion.x, map.bastion.y);
      ctx.translate(0, -lift);
      drawBastionGlow(ctx, map.bastion, t, bastionSize(map));
      ctx.translate(0, lift);
    }
    // The ban zone lies on the ground, under the route and the markers (M7b, B4).
    drawBanZone(ctx, map);

    // While zones are marked the preview shows the route they will force.
    const route = previewRoute(state);
    if (PLANNING_PHASES.has(state.phase) && route) drawRoutePreview(ctx, route, t, ui.reducedMotion);
    // Before a wave with flyers, the line they take over it.
    if (PLANNING_PHASES.has(state.phase) && waveFlies(state.wave + 1)) {
      drawFlyerLine(ctx, flyerPolyline(state.map, state.riftIndex ?? 0), t, ui.reducedMotion);
    }

    // Frames of the markers: filled on the ground here, outlined later among the sorted objects.
    frames.length = 0;
    // The demolish mode takes the map over: no zones are marked while it runs.
    let demolishable = null;
    if (state.phase === 'planning') {
      if (ui.demolishMode) {
        demolishable = drawDemolishOverlay(ctx, frames, state, ui.demolishArmed, t, ui.reducedMotion);
      } else if (ui.bulwarkMode) {
        demolishable = drawBulwarkOverlay(ctx, frames, state, ui.bulwarkArmed, t, ui.reducedMotion);
      } else if (ui.upgradeMode) {
        demolishable = drawUpgradeOverlay(ctx, frames, state, ui.upgradeArmed, t, ui.reducedMotion);
      } else {
        state.zones.forEach((zone, i) => {
          const lift = cellLift(zone.x, zone.y);
          ctx.translate(0, -lift);
          drawZoneFill(ctx, zone);
          ctx.translate(0, lift);
          frames.push({ x: zone.x, y: zone.y, draw: () => drawZoneFrame(ctx, zone, i, t, ui.reducedMotion) });
        });
      }
    }
    // Where the Koloss is aimed (GDD section 9). Drawn during planning and while
    // it is on the field, so the player can see what it is driving at.
    if (state.koloss?.target && state.koloss.stage !== 'warning' && !state.koloss.breached) {
      drawKolossTarget(ctx, state.map, state.koloss, t, ui.reducedMotion);
    }
    // Cells cleared in demolish mode keep a faint ring until a capsule takes
    // them or the wave starts (docs/ART.md).
    if (PLANNING_PHASES.has(state.phase)) {
      for (const cell of ui.clearedCells) {
        const lift = cellLift(cell.x, cell.y);
        ctx.translate(0, -lift);
        drawClearedMarker(ctx, cell, t, ui.reducedMotion);
        ctx.translate(0, lift);
      }
    }
    for (const pod of state.pods) {
      const lift = cellLift(pod.x, pod.y);
      ctx.translate(0, -lift);
      drawPodTarget(ctx, pod, t);
      ctx.translate(0, lift);
    }

    // Scorch marks, auras and flame cones lie on the ground, under the units.
    ui.effects?.drawGround(ctx, state, t, ui.reducedMotion, cam.zoom);

    // The gold ring of a recipe emplacement belongs here and not to the figure:
    // it lies flat on the ground and must never end up on a neighbour's socket
    // (docs/ART.md). After the scorch marks, so a burnt cell does not hide it.
    if (ui.art === 'sprites') {
      // Terrain in front of an emplacement cuts its plate and ring as it cuts the figure.
      const behind = (tower, draw) => {
        const cover = coverHulls(field, tower.x, tower.y);
        const [mx, my] = iso(tower.x + 0.5, tower.y + 0.5);
        drawBehindTerrain(ctx, cover, mx, my, 0, coverFade(revealLayers, cover.cells), draw);
      };
      for (const tower of state.towers) behind(tower, (again, fade) => drawFoundation(ctx, tower, field, again ? fade : 1));
      for (const tower of state.towers) {
        if (!tower.special) continue;
        behind(tower, () => {
          const lift = cellLift(tower.x, tower.y);
          ctx.translate(0, -lift);
          drawSpecialRing(ctx, tower);
          ctx.translate(0, lift);
        });
      }
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

    if (ui.hoverCell) deferCellMarker(ctx, frames, ui.hoverCell, 'rgba(242,193,78,.12)', 'rgba(242,193,78,.8)', 2);
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
        // The gunship flies an axis, so the preview shows the line that will
        // actually be flown, not the one the pointer draws (GDD section 11).
        const snapped = snapToAxis(ui.commandLineFrom, end);
        ui.effects?.drawLineAiming(ctx, ui.commandLineFrom, snapped, ui.commandLine.halfWidth, t);
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
    warmKit(map.obstacles, palette, view.dpr, cam.zoom);
    const obstacleRaster = { zoom: cam.zoom, dpr: view.dpr };
    const seeThrough = seeThroughOf(state, field);
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
    for (const f of frames) items.push([f.x + f.y + 1, KIND_MARKER, f, 0]);
    for (const pod of state.pods) items.push([pod.x + pod.y + 1, KIND_POD, pod, 0]);
    if (map.rifts) {
      // Every gate is a mouth of its own; the attacking rift's pulse (B8).
      map.rifts.forEach((rift, i) => {
        const active = i === state.riftIndex ? 1 : 2;
        for (const gate of rift.gates) items.push([gate.x + gate.y + 1, KIND_RIFT, gate, active]);
      });
    } else {
      items.push([map.rift.x + map.rift.y + 1, KIND_RIFT, map.rift, 0]);
    }
    const size = bastionSize(map);
    items.push([map.bastion.x + map.bastion.y + 2 * size - 1, KIND_BASTION, map.bastion, size]);
    map.beacons.forEach((b, i) => items.push([b.x + b.y + 1, KIND_BEACON, b, i]));
    for (const e of state.enemies) {
      if (!onScreen(e.x, e.y)) continue;
      // The Koloss covers more than one cell, so it sorts by its own depth
      // (docs/ART.md, "Koloss").
      items.push([isKolossEnemy(e) ? kolossDepth(e) : e.x + e.y, KIND_ENEMY, e, 0]);
    }
    items.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    // One view object for all enemies, instead of one per creature per frame.
    const enemyView = {
      zoom: cam.zoom,
      dpr: view.dpr,
      reducedMotion: ui.reducedMotion,
      simTime: state.time,
      dt,
      // The capsule the player has picked lifts its segments (docs/ART.md, "Nachschubkapsel").
      selectedPod: state.phase === 'selection' ? state.pods[ui.podSelected] : null,
    };

    for (const [, kind, o, i] of items) {
      // Everything stands on its field: the drawing is raised by the height of the ground under
      // it. A ground enemy follows the blended height of its position, a flyer keeps its flight
      // height over level 0.
      let lift;
      if (kind === KIND_OBSTACLE) lift = cellLift(o.cells[i].x, o.cells[i].y);
      else if (kind === KIND_MARKER) lift = cellLift(o.x, o.y);
      else if (kind === KIND_ENEMY) lift = o.flying ? 0 : liftAt(o.x, o.y);
      else lift = cellLift(o.x, o.y);
      ctx.translate(0, -lift);
      drawItem(kind, o, i, lift);
      ctx.translate(0, lift);
    }

    function drawItem(kind, o, i, lift) {
      if (kind === KIND_MARKER) {
        o.draw();
        return;
      }
      if (kind === KIND_OBSTACLE) {
        // Terrain in front of the field cuts the obstacle out as it cuts an emplacement; while the
        // field is looked at the cut part comes back at the opacity of the reveal.
        const cell = o.cells[i];
        const cover = coverHulls(field, cell.x, cell.y);
        const [mx, my] = iso(cell.x + 0.5, cell.y + 0.5);
        // An obstacle in front of an emplacement that it covers stays see-through for good.
        const seen = seeThrough.has(o) ? OBSTACLE_SEE_THROUGH.alpha : 1;
        ctx.globalAlpha = seen;
        // Capsule remains and craters lie flat: what they spread over a lower neighbour or up the slope of a
        // higher one is clipped away (the parts that stand keep their height, `sweep`).
        const flat = o.kind === 'rubble' || o.kind === 'crater';
        drawBehindTerrain(ctx, cover, mx, my, lift, coverFade(revealLayers, cover.cells), () => {
          if (!flat) {
            drawObstacleCell(ctx, o, i, palette, obstacleRaster);
            return;
          }
          ctx.save();
          clipToGround(ctx, field, cell.x, cell.y, 1, o.kind === 'rubble' ? 20 : 24, false, false);
          drawObstacleCell(ctx, o, i, palette, obstacleRaster);
          ctx.restore();
        });
        ctx.globalAlpha = 1;
      }
      else if (kind === KIND_RIFT) {
        // i: 0 the single rift of the standard map, 1 the attacking one, 2 a quiet one.
        if (i === 0) drawRift(ctx, o, t);
        else drawRiftMouth(ctx, o.x + 0.5, o.y + 0.5, t, { scale: 0.8, still: i === 2 || ui.reducedMotion });
      } else if (kind === KIND_BASTION) {
        const cover = coverHullsOfSquare(field, o.x, o.y, i);
        const [mx, my] = iso(o.x + i / 2, o.y + i / 2);
        drawBehindTerrain(ctx, cover, mx, my, lift, coverFade(revealLayers, cover.cells), () => drawBastion(ctx, o, t, i));
      } else if (kind === KIND_BEACON) {
        const cover = coverHulls(field, o.x, o.y);
        const [mx, my] = iso(o.x + 0.5, o.y + 0.5);
        drawBehindTerrain(ctx, cover, mx, my, lift, coverFade(revealLayers, cover.cells), () => drawBeacon(ctx, o, t));
      }
      else if (kind === KIND_POD) drawPod(ctx, o, t, enemyView);
      else if (kind === KIND_TOWER) {
        // Terrain in front of its field cuts it; the second pass (see-through) must not move the weapon twice.
        const cover = coverHulls(field, o.x, o.y);
        const [mx, my] = iso(o.x + 0.5, o.y + 0.5);
        drawBehindTerrain(ctx, cover, mx, my, lift, coverFade(revealLayers, cover.cells), (again) => {
          if (ui.art !== 'sprites' || !drawTowerSprite(ctx, sprites, o, cam.zoom, view.dpr, t, again ? 0 : dt, ui.reducedMotion)) {
            drawTowerPlaceholder(ctx, o);
          }
        });
      } else if (isKolossEnemy(o) && ui.art === 'sprites') {
        // A model, not a sprite: it has to read on all four axes, and it draws
        // its own health bar with the airstrike mark on it.
        drawKoloss(ctx, o, { t, dt, reducedMotion: ui.reducedMotion, simTime: state.time });
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
        if (!pod) continue;
        const lift = cellLift(pod.x, pod.y);
        ctx.translate(0, -lift);
        drawPodFrame(ctx, pod, { selected: index === ui.podSelected, t, reducedMotion: ui.reducedMotion });
        ctx.translate(0, lift);
      }
    }
    for (const pod of state.pods) {
      const lift = cellLift(pod.x, pod.y);
      ctx.translate(0, -lift);
      drawPodHologram(ctx, pod, t, enemyView);
      ctx.translate(0, lift);
    }
    map.beacons.forEach((b, i) => {
      const lift = cellLift(b.x, b.y);
      ctx.translate(0, -lift);
      drawBeaconLabel(ctx, b, i + 1);
      ctx.translate(0, lift);
    });
    if (map.rifts) {
      riftLayout(map).forEach((r, i) => {
        const active = i === state.riftIndex;
        // During planning the attacking rift says how long its way is (B8).
        const detail = active && PLANNING_PHASES.has(state.phase) && route ? cells(route.length) : null;
        const lift = liftAt(r.x, r.y);
        ctx.translate(0, -lift);
        drawRiftLabel(ctx, r.labelX, r.labelY, r.angle, STRINGS.rifts[map.rifts[i].id], { active, detail });
        ctx.translate(0, lift);
      });
    }

    // Shots, shells, particles and damage numbers go on top of the units.
    ui.effects?.drawAbove(ctx, state, t, ui.reducedMotion);

    if (demolishable) drawDemolishPrices(ctx, demolishable);

    for (const f of ui.flashes) {
      if (!f.label) continue;
      const [x, y] = iso(f.cell.x + 0.5, f.cell.y + 0.5, cellLift(f.cell.x, f.cell.y) + 40 + (1 - f.life / f.max) * 20);
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
      comicText(ctx, f.label, x, y, 18, f.ok ? C.toxicL : '#ff6a4a');
      ctx.globalAlpha = 1;
    }

    // The field the player looks at keeps an outline over everything while blocks cover it.
    if (revealFade > 0) drawRevealOutlines(ctx, field, looked, revealFade);

    atmosphere.draw(ctx, view, t, ui.reducedMotion);
    drawVignette(ctx, view);
    ui.effects?.drawFlash(ctx, view, ui.reducedMotion);
  };
}
