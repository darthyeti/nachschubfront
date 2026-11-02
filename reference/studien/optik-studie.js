// Optics study (issue A-02): the same map drawn "as today" with the real game modules and
// "new" with drawing code that lives only in this file. Four building blocks can be switched
// on and off one by one: light and shadow, colour separation, block terrain, diorama frame.
//
// Nothing under src/ is changed. The figures (emplacements, enemies, bastion, beacons, rift)
// are the game's own drawing functions in both views; what is new is the ground, the light,
// the colours, the frame and the shadows underneath the figures.
//
// Biomes: in the game the biome changes per match with the seed, never within one map. The
// buttons here only exist so that all three can be compared on the same map.
//
// The terrain comes from the seed alone and does not follow the route: the player changes the
// route every round. Enemies follow the height of the ground, a ramp marks where the route
// crosses a step, and the trampled trail along the route grows with every passing enemy.
//
// Open /reference/studien/optik-studie.html over HTTP (also works on GitHub Pages).

import { createRng, seedFromString } from '../../src/core/random.js';
import { generateMap } from '../../src/sim/mapgen.js';
import { MAP } from '../../src/data/map.js';
import { computeRoute, groundPolyline, positionAt, checkPlacement, nearestDistanceOn } from '../../src/sim/route.js';
import { isBlocked, setBlocked } from '../../src/sim/grid.js';
import { PODS } from '../../src/data/pods.js';
import { CAMERA } from '../../src/data/settings.js';
import { DOCTRINE_COLORS, DOCTRINE_IDS } from '../../src/data/doctrines.js';
import { ALL_ENEMIES } from '../../src/data/enemies.js';
import { createCanvasView } from '../../src/render/canvas.js';
import { createCamera, fitCamera, clampCamera, panBy, zoomAt, applyCamera, worldToScreen } from '../../src/render/camera.js';
import { iso, mapBounds } from '../../src/render/iso.js';
import { poly, ell, cellPath } from '../../src/render/draw.js';
import { C } from '../../src/render/palette.js';
import { createBackdropLayer, parallaxOffset } from '../../src/render/backdrop.js';
import { createGroundLayer } from '../../src/render/ground.js';
import {
  drawObstacleCell,
  drawRift,
  drawRiftGlow,
  drawBastion,
  drawBastionGlow,
  drawBeacon,
  drawBeaconLabel,
} from '../../src/render/objects.js';
import { POD_SPRITE_DEFS, createPodRenderer, drawPodTarget, drawPodHologram } from '../../src/render/pods.js';
import { createSpriteCache } from '../../src/render/sprites/rasterizer.js';
import { allTowerDefs, drawTowerSprite, drawSpecialRing } from '../../src/render/towerSprites.js';
import { ENEMY_SPRITE_DEFS, createEnemySpriteRenderer } from '../../src/render/enemySprites.js';
import { attachPointerInput } from '../../src/input/pointer.js';

// =====================================================================================
// Numbers to play with. Everything Till may want to change while judging is up here.
// =====================================================================================

/** Height of one terrain level in world pixels (levels 0, 1, 2). A crater sits one level lower. */
const STEP = 12;
/** Value-noise lattice spacing in cells: bigger gives bigger plateaus. */
const NOISE_CELLS = 4;
/** The stretched noise is cut at these two values into level 0, 1 and 2. */
const LEVEL_CUTS = [0.4, 0.64];
/** Light from the top left behind: a body of height h (px) throws its shadow this many cells in +x, +y per 32 px. */
const LIGHT = { x: 0.55, y: 0.25 };
/** Block shadows on the ground (colour of ink, no outline). */
const SHADOW_COLOR = 'rgba(10,6,4,.38)';
/** Silhouette shadows of emplacements and enemies: opacity and the squash of their height on the ground. */
const SPRITE_SHADOW_ALPHA = 0.35;
const SPRITE_SHADOW_SQUASH = 0.45;
/** Dark gradient along the foot of every block: opacity at the edge and width in px. */
const FOOT_SHADE_ALPHA = 0.3;
const FOOT_SHADE_WIDTH = 4;
/** Thin bright edge on the upper left rim of a top face: opacity and width in px. */
const EDGE_LIGHT_ALPHA = 0.3;
const EDGE_LIGHT_WIDTH = 1.5;
/** Depth of the earth slab (as today) and the steel base plate under it. */
const SLAB_DEPTH = 30;
const PLATE_THICK = 14;
/** How far the base plate reaches past the slab, in cells. */
const PLATE_OVERHANG = 0.8;
/** Foundation plate under an emplacement: opacity of the doctrine colour and inset from the cell edge. */
const FOUNDATION_ALPHA = 0.35;
const FOUNDATION_INSET = 0.06;
/** Raising of the lightness of a top face per level (RGB steps), so higher ground reads lighter. */
const LEVEL_LIGHTEN = 9;
/** The backdrop's horizon as a fraction of the layer height: 0.26 in the game, lower here. */
const HORIZON_NEW = 0.4;
/** How much darker the backdrop becomes (black veil over the sky) and how strong the vignette is. */
const BACKDROP_DARKEN = 0.32;
const VIGNETTE_NEW = 0.82;
const VIGNETTE_TODAY = 0.62;
/** Trampled trail: width of the three layers in cells, their opacity factors (times the wear). */
const TRAIL_WIDTHS = [0.55, 0.42, 0.28];
const TRAIL_ALPHAS = [0.7, 0.7, 0.7];
/** Raggedness of the trail edges as a fraction of the layer width, and spacing of its samples in cells. */
const TRAIL_RAG = 0.3;
const TRAIL_SAMPLE = 0.5;
/** Wear gained per passing enemy and lost per second on sections that are no longer walked. */
const WEAR_PER_PASS = 0.04;
const WEAR_FADE_PER_SECOND = 0.02;
/** Wear every section starts with (the slider overrides it). */
const WEAR_START = 0.7;
/** Ramp where the route crosses a step: width and run (in cells) on the lower field. */
const RAMP_WIDTH = 0.6;
const RAMP_RUN = 0.65;
/** Enemies blend from one field height to the next over this fraction of a cell on each side of the border. */
const ENEMY_BLEND = 0.25;
/** Terrain is rebuilt for a changed trail at most this often (ms). */
const TRAIL_REBUILD_MS = 350;
/** Supply pod demo: seconds of one drop loop. */
const POD_LOOP_SECONDS = 8;
/** Walking speed of the demo enemies in cells per second. */
const ENEMY_SPEED = 1.1;

// =====================================================================================
// Palettes. Same keys everywhere. `path` null means "no extra colour for the route".
// =====================================================================================

const PALETTES = {
  ash: {
    ground: ['#645e55', '#69635a', '#5f5a51'],
    path: '#ad8d63',
    pathEdge: '#6e5638',
    cliff: ['#7a776f', '#57544c', '#3c3a35'],
    stone: ['#7a776f', '#57544c', '#3c3a35'],
    decor: '#3a3733',
    slab: ['#46403a', '#2c2824'],
    pit: '#2c2926',
  },
  rust: {
    ground: ['#73594d', '#785d50', '#6c5348'],
    path: '#b5875a',
    pathEdge: '#744a2a',
    cliff: ['#8f6d5b', '#654a3e', '#41312b'],
    stone: ['#8d6c5c', '#63483d', '#41302a'],
    decor: '#8b3f1c',
    slab: ['#523a2c', '#33241a'],
    pit: '#33211a',
  },
  toxic: {
    ground: ['#5e685a', '#646e5f', '#586254'],
    path: '#b3a866',
    pathEdge: '#645f3a',
    cliff: ['#7a8274', '#566050', '#394035'],
    stone: ['#767d6d', '#525a4c', '#373d32'],
    decor: '#78b933',
    slab: ['#3e4639', '#272d24'],
    pit: '#252c22',
  },
  // What the game draws today, for "colour separation" switched off.
  today: {
    ground: ['#5f4e3e', '#65533f', '#5a4a3b', '#6a5743', '#61503f'],
    path: '#44362a',
    pathEdge: '#2f251c',
    cliff: ['#8d7f6b', '#4a3a2d', '#302419'],
    stone: C.stone.slice(),
    decor: '#4f7a24',
    slab: ['#4a3a2d', '#302419'],
    pit: '#1c1511',
  },
};
const BIOMES = [
  ['ash', 'Asche'],
  ['rust', 'Rost'],
  ['toxic', 'Gift'],
];

/** Original values of the shared palette entries the study recolours while drawing "new". */
const ORIGINAL = {
  stone: C.stone.slice(),
  brick: C.brick.slice(),
  conc: [C.concL, C.conc, C.concD],
};
const BASTION_BRICK = ['#b3342a', '#852519', '#561610'];

/**
 * The game's object functions read their colours from the shared palette object C. The study
 * patches those entries for the "new" pass and puts them back for the "today" pass. In the game
 * the drawing functions would take a palette parameter instead (M8).
 */
function applyObjectColours(pal) {
  if (pal) {
    for (let i = 0; i < 3; i++) {
      C.stone[i] = pal.stone[i];
      C.brick[i] = BASTION_BRICK[i];
    }
    [C.concL, C.conc, C.concD] = pal.stone;
  } else {
    for (let i = 0; i < 3; i++) {
      C.stone[i] = ORIGINAL.stone[i];
      C.brick[i] = ORIGINAL.brick[i];
    }
    [C.concL, C.conc, C.concD] = ORIGINAL.conc;
  }
}

// =====================================================================================
// Small helpers
// =====================================================================================

const INK = C.ink;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Adds `d` to every channel, clamped. */
function shade(hex, d) {
  const [r, g, b] = rgb(hex).map((v) => Math.max(0, Math.min(255, v + d)));
  return `rgb(${r},${g},${b})`;
}
function rgba(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
const smooth = (t) => t * t * (3 - 2 * t);

/** Convex hull (monotone chain), counter-clockwise, so several hulls fill as a union. */
function hull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Shadow of a box standing on a rectangle (cell units) with its top `delta` px above the receiving plane. */
function shadowHull(r, delta) {
  const k = delta / 32;
  const sx = LIGHT.x * k;
  const sy = LIGHT.y * k;
  const corners = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]];
  return hull([...corners, ...corners.map(([x, y]) => [x + sx, y + sy])]);
}

/** Draws without the game's own ellipse shadows (`shadow()` in draw.js), everything else untouched. */
const noShadowProxies = new WeakMap();
function noShadow(ctx) {
  let proxy = noShadowProxies.get(ctx);
  if (proxy) return proxy;
  const bound = new Map();
  proxy = new Proxy(ctx, {
    get(target, key) {
      if (key === 'fill') {
        let fn = bound.get(key);
        if (!fn) {
          fn = (...args) => {
            const style = target.fillStyle;
            if (typeof style === 'string' && style.startsWith('rgba(10, 6, 4,')) return;
            target.fill(...args);
          };
          bound.set(key, fn);
        }
        return fn;
      }
      const value = target[key];
      if (typeof value !== 'function') return value;
      let fn = bound.get(key);
      if (!fn) {
        fn = value.bind(target);
        bound.set(key, fn);
      }
      return fn;
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  noShadowProxies.set(ctx, proxy);
  return proxy;
}

// =====================================================================================
// Scene: map, route, emplacements, enemies (identical in both views)
// =====================================================================================

const SIZE = MAP.size;
const DEFAULT_SEED = 'BASTION';

// Emplacements: doctrine and rank mixed, plus one recipe emplacement at the end.
const TOWER_LIST = [
  ['flame', 3], ['autocannon', 1], ['laser', 5], ['mortar', 2], ['psi', 4], ['tesla', 2],
  ['autocannon', 4], ['mortar', 1], ['flame', 1], ['tesla', 5], ['laser', 2], ['psi', 1],
  ['autocannon', null, 'stormBattery'],
];
const ENEMY_LIST = ['swarmer', 'swarmer', 'warrior', 'breaker', 'swarmer', 'warrior', 'carrionflyer', 'breaker'];
const RUIN_HEIGHTS = [34, 44, 52, 40]; // as in objects.js
const WALL_HEIGHTS = [18, 26, 22, 30];

const NEIGHBOURS_4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const NEIGHBOURS_4_ALT = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const NEIGHBOURS_DIAG = [[1, 1], [-1, 1], [1, -1], [-1, -1]];

const POD_LIST = [['laser', 3], ['flame', 2], ['psi', 4], ['mortar', 1]];
/** Pod 0..2 stand still in these stages (seconds after impact), pod 3 plays the drop in a loop. */
const POD_STAGES = [0, PODS.openDelaySeconds + PODS.openSeconds * 0.45, PODS.openDelaySeconds + PODS.openSeconds + 3];
const IMPACT = PODS.warnSeconds + PODS.fallSeconds;

function setRoute(scene) {
  scene.route = computeRoute(scene.map);
  scene.line = groundPolyline(scene.route);
  scene.routeSet = new Uint8Array(SIZE * SIZE);
  for (const c of scene.route.cells) scene.routeSet[c.y * SIZE + c.x] = 1;
  scene.version = (scene.version ?? 0) + 1;
}

function buildScene(seed) {
  const map = generateMap(createRng(seed).fork('map'), MAP);
  const scene = { seed, map, towers: [], pods: [], enemies: [], detour: null, version: 0 };
  setRoute(scene);
  const { route, line, routeSet } = scene;

  // Emplacements and pods: one per evenly spaced route index, on a free cell next to the route.
  const taken = new Set();
  const anchorCells = new Set([map.rift, map.bastion, ...map.beacons].map((p) => `${p.x},${p.y}`));
  const free = (x, y) =>
    x >= 0 && y >= 0 && x < SIZE && y < SIZE &&
    !isBlocked(map.grid, x, y) && !map.protected[y * SIZE + x] && !routeSet[y * SIZE + x] &&
    !taken.has(`${x},${y}`) && !anchorCells.has(`${x},${y}`);
  const apart = (x, y, gap) => ![...taken].some((key) => {
    const [tx, ty] = key.split(',').map(Number);
    return Math.max(Math.abs(tx - x), Math.abs(ty - y)) <= gap;
  });
  const place = (k, n, phase, gap = 0) => {
    const base = Math.floor(((k + phase) * route.cells.length) / n);
    for (let shift = 0; shift < route.cells.length; shift++) {
      const c = route.cells[(base + shift) % route.cells.length];
      const order = k % 2 ? NEIGHBOURS_4_ALT : NEIGHBOURS_4;
      for (const [dx, dy] of [...order, ...NEIGHBOURS_DIAG]) {
        if (free(c.x + dx, c.y + dy) && apart(c.x + dx, c.y + dy, gap)) {
          taken.add(`${c.x + dx},${c.y + dy}`);
          return { x: c.x + dx, y: c.y + dy };
        }
      }
    }
    return null;
  };
  TOWER_LIST.forEach(([doctrine, rank, special], k) => {
    const spot = place(k, TOWER_LIST.length, 0.5);
    if (spot) scene.towers.push({ ...spot, doctrine, rank, special, flash: 0 });
  });
  POD_LIST.forEach(([doctrine, rank], k) => {
    const spot = place(k, 22, 13 + k, 1);
    if (!spot) return;
    const loop = k === POD_LIST.length - 1;
    scene.pods.push({ index: k, ...spot, doctrine, rank, loop, landed: true, t: IMPACT + (loop ? 0 : POD_STAGES[k]) });
  });
  // Emplacements and pods block their cells, so a new route walks around them.
  for (const o of [...scene.towers, ...scene.pods]) setBlocked(map.grid, o.x, o.y, true);

  scene.enemies = ENEMY_LIST.map((type, i) => ({
    id: i + 1,
    type,
    flying: ALL_ENEMIES[type].flying,
    x: 0, y: 0, dx: 1, dy: 0, d: 9, flash: 0,
    offset: (i * line.length) / ENEMY_LIST.length,
    lastSample: -1,
  }));
  return scene;
}

/** Toggles a heap of rubble on a route cell in the middle of the way (and re-routes). */
function toggleDetour() {
  const { map } = scene;
  if (scene.detour) {
    const { x, y } = scene.detour.cells[0];
    setBlocked(map.grid, x, y, false);
    map.obstacles.splice(map.obstacles.indexOf(scene.detour), 1);
    scene.detour = null;
  } else {
    const cells = scene.route.cells;
    const mid = Math.floor(cells.length / 2);
    let pick = null;
    for (let k = 0; k < cells.length && !pick; k++) {
      for (const idx of [mid + k, mid - k]) {
        const c = cells[idx];
        if (c && idx > 2 && idx < cells.length - 3 && checkPlacement(map, [c]).ok) {
          pick = c;
          break;
        }
      }
    }
    if (!pick) return;
    scene.detour = { kind: 'rubble', cells: [{ x: pick.x, y: pick.y }], variant: 1 };
    map.obstacles.push(scene.detour);
    setBlocked(map.grid, pick.x, pick.y, true);
  }
  // Enemies keep their place: they are bound to the new line where they stand.
  const before = scene.enemies.map((e) => ({ x: e.x, y: e.y }));
  setRoute(scene);
  scene.enemies.forEach((e, i) => {
    const d = nearestDistanceOn(scene.line, before[i].x, before[i].y);
    e.offset = (((d - simT * ENEMY_SPEED) % scene.line.length) + scene.line.length) % scene.line.length;
    e.lastSample = -1;
  });
  trail.addStrand(scene.line);
}

// =====================================================================================
// Terrain: height field and occluders
// =====================================================================================

/** A few puddles of the biome's decor, from the seed and the original map only. */
function pickPuddles(scene, craters, rng) {
  const puddles = new Set();
  const decorRng = rng.fork('decor');
  for (let tries = 0, want = Math.round(SIZE / 5); puddles.size < want && tries < 200; tries++) {
    const x = decorRng.int(0, SIZE - 1);
    const y = decorRng.int(0, SIZE - 1);
    const i = y * SIZE + x;
    if (craters[i] || scene.map.protected[i] || isBlocked(scene.map.grid, x, y)) continue;
    puddles.add(i);
  }
  return puddles;
}

function buildHeights(scene, blocks) {
  const { map } = scene;
  const rng = createRng(`optik:${scene.seed}`);
  const level = new Int8Array(SIZE * SIZE);
  const craters = new Uint8Array(SIZE * SIZE);
  for (const o of map.obstacles) if (o.kind === 'crater') for (const c of o.cells) craters[c.y * SIZE + c.x] = 1;
  if (!blocks) return { level, craters, rng, puddles: pickPuddles(scene, craters, rng) };

  // Value noise on a lattice of NOISE_CELLS cells, bilinear with a smoothed fade, stretched
  // to 0..1 and cut into three levels.
  const L = Math.ceil(SIZE / NOISE_CELLS) + 2;
  const lattice = Array.from({ length: L * L }, () => rng.next());
  const raw = new Float32Array(SIZE * SIZE);
  let lo = Infinity;
  let hi = -Infinity;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const fx = (x + 0.5) / NOISE_CELLS;
      const fy = (y + 0.5) / NOISE_CELLS;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = smooth(fx - ix);
      const ty = smooth(fy - iy);
      const a = lattice[iy * L + ix];
      const b = lattice[iy * L + ix + 1];
      const c = lattice[(iy + 1) * L + ix];
      const d = lattice[(iy + 1) * L + ix + 1];
      const v = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
      raw[y * SIZE + x] = v;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  for (let i = 0; i < raw.length; i++) {
    const v = (raw[i] - lo) / (hi - lo || 1);
    level[i] = v < LEVEL_CUTS[0] ? 0 : v < LEVEL_CUTS[1] ? 1 : 2;
  }
  // Majority filter: takes out single cells, and a second rule takes out strips one cell wide
  // (both neighbours on one axis differ), so plateaus come out as blocks and not as steps.
  const at = (x, y, fallback) => (x < 0 || y < 0 || x >= SIZE || y >= SIZE ? fallback : level[y * SIZE + x]);
  for (let pass = 0; pass < 3; pass++) {
    const next = level.slice();
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const here = level[y * SIZE + x];
        const votes = [0, 0, 0];
        let same = 0;
        for (const [dx, dy] of NEIGHBOURS_4) {
          const v = at(x + dx, y + dy, here);
          votes[v] += 1;
          if (v === here) same += 1;
        }
        if (same <= 1) {
          next[y * SIZE + x] = votes.indexOf(Math.max(...votes));
          continue;
        }
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const a = at(x - dx, y - dy, here);
          const b = at(x + dx, y + dy, here);
          if (a !== here && b !== here) next[y * SIZE + x] = Math.min(a, b);
        }
      }
    }
    level.set(next);
  }
  // Craters are set one level lower instead of being painted.
  for (let i = 0; i < level.length; i++) if (craters[i]) level[i] -= 1;
  return { level, craters, rng, puddles: pickPuddles(scene, craters, rng) };
}

/** Boxes that cast shadows: rectangles in cell units with their top above the cell's ground. */
function buildOccluders(scene) {
  const { map } = scene;
  const occ = Array.from({ length: SIZE * SIZE }, () => []);
  const add = (cx, cy, x0, y0, x1, y1, top) => occ[cy * SIZE + cx].push({ x0: cx + x0, y0: cy + y0, x1: cx + x1, y1: cy + y1, top });
  for (const o of map.obstacles) {
    o.cells.forEach(({ x, y }, i) => {
      if (o.kind === 'ruin') {
        const h = RUIN_HEIGHTS[o.variant % RUIN_HEIGHTS.length];
        add(x, y, 0.05, 0.05, 0.95, 0.95, 12);
        add(x, y, 0.22, 0.22, 0.78, 0.78, 12 + h + 10);
      } else if (o.kind === 'wall') {
        const h = WALL_HEIGHTS[(o.variant + i) % WALL_HEIGHTS.length] + 4;
        const horizontal = o.cells.length > 1 && o.cells[1].y === o.cells[0].y;
        if (horizontal) add(x, y, 0, 0.32, 1, 0.68, h);
        else add(x, y, 0.32, 0, 0.68, 1, h);
      }
    });
  }
  for (const o of map.obstacles) if (o.kind === 'rubble') add(o.cells[0].x, o.cells[0].y, 0.18, 0.2, 0.82, 0.8, 14);
  add(map.bastion.x, map.bastion.y, 0.08, 0.08, 0.92, 0.92, 36);
  for (const b of map.beacons) {
    add(b.x, b.y, 0.2, 0.2, 0.8, 0.8, 8);
    add(b.x, b.y, 0.32, 0.32, 0.68, 0.68, 38);
  }
  return occ;
}

// =====================================================================================
// Terrain painting into an offscreen canvas
// =====================================================================================

const P = (x, y, z = 0) => iso(x, y, z);
const diamond = (x, y, z) => [P(x, y, z), P(x + 1, y, z), P(x + 1, y + 1, z), P(x, y + 1, z)];

/** One wall of a block: an `axis` 'x' face (right in the picture) or 'y' face (left), with layer lines and stones. */
function wall(g, axis, x, y, zTop, zBot, fill, lineColour, stoneColour, lineZs, rng) {
  const at = (u, z) => (axis === 'x' ? P(x + 1, y + u, z) : P(x + u, y + 1, z));
  poly(g, [at(0, zTop), at(1, zTop), at(1, zBot), at(0, zBot)], fill, INK, 2.5);
  g.strokeStyle = lineColour;
  g.lineWidth = 1.8;
  for (const z of lineZs) {
    g.beginPath();
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      const wobble = Math.sin((x * 7 + y * 3 + u * 9 + z) * 1.7) * 1.1;
      const p = at(u, z + wobble);
      if (i) g.lineTo(p[0], p[1]);
      else g.moveTo(p[0], p[1]);
    }
    g.stroke();
  }
  const stones = rng.chance(0.6) ? 1 + (rng.chance(0.4) ? 1 : 0) : 0;
  for (let i = 0; i < stones; i++) {
    const p = at(0.15 + rng.next() * 0.7, zBot + (zTop - zBot) * (0.25 + rng.next() * 0.5));
    ell(g, p[0], p[1], 2 + rng.next() * 2.5, 1.5 + rng.next() * 1.5, stoneColour, null);
  }
}

/** Gradient strip of the foot shade: along the edge a to b (cell units, at height z), pushed outwards by (ox, oy) cells. */
function footStrip(g, ax, ay, bx, by, ox, oy, z) {
  const w = FOOT_SHADE_WIDTH / 28.6;
  const p1 = P(ax, ay, z);
  const p2 = P(bx, by, z);
  const p3 = P(bx + ox * w, by + oy * w, z);
  const p4 = P(ax + ox * w, ay + oy * w, z);
  const m = P((ax + bx) / 2, (ay + by) / 2, z);
  const e = P((ax + bx) / 2 + ox * w, (ay + by) / 2 + oy * w, z);
  const grad = g.createLinearGradient(m[0], m[1], e[0], e[1]);
  grad.addColorStop(0, `rgba(10,6,4,${FOOT_SHADE_ALPHA})`);
  grad.addColorStop(1, 'rgba(10,6,4,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(p1[0], p1[1]);
  g.lineTo(p2[0], p2[1]);
  g.lineTo(p3[0], p3[1]);
  g.lineTo(p4[0], p4[1]);
  g.closePath();
  g.fill();
}

/** Table shadow, base plate with rivets and rust band (the diorama frame). */
function paintFrame(g) {
  const N = SIZE;
  const ov = PLATE_OVERHANG;
  const zt = -SLAB_DEPTH;
  const zb = zt - PLATE_THICK;
  // Soft shadow on the table: a radial gradient squeezed into the iso ellipse.
  const [cx, cy] = iso(N / 2, N / 2, zb);
  g.save();
  g.translate(cx, cy + 6);
  g.scale(1, 0.5);
  const R = (N + ov * 2) * 32 * 0.62 * Math.SQRT2;
  const sh = g.createRadialGradient(0, 0, R * 0.35, 0, 0, R * 1.12);
  sh.addColorStop(0, 'rgba(0,0,0,.7)');
  sh.addColorStop(0.65, 'rgba(0,0,0,.5)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh;
  g.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4);
  g.restore();

  const lo = -ov;
  const hiE = N + ov;
  const left = [P(lo, hiE, zt), P(hiE, hiE, zt), P(hiE, hiE, zb), P(lo, hiE, zb)];
  const right = [P(hiE, hiE, zt), P(hiE, lo, zt), P(hiE, lo, zb), P(hiE, hiE, zb)];
  poly(g, left, '#34373c', INK, 3);
  poly(g, right, '#222428', INK, 3);
  poly(g, [P(lo, lo, zt), P(hiE, lo, zt), P(hiE, hiE, zt), P(lo, hiE, zt)], '#4d5055', INK, 3);
  // Rust band with a ragged upper edge, on both faces.
  const band = (axis) => {
    const at = (u, z) => (axis === 'y' ? P(lo + u * (hiE - lo), hiE, z) : P(hiE, hiE - u * (hiE - lo), z));
    const z0 = zt - 9.5;
    const z1 = zt - 13;
    g.beginPath();
    const a = at(0, z1);
    g.moveTo(a[0], a[1]);
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const jag = (Math.sin(i * 2.3) + Math.sin(i * 0.9 + 1)) * 0.9;
      const p = at(u, z0 + jag);
      g.lineTo(p[0], p[1]);
    }
    const b = at(1, z1);
    g.lineTo(b[0], b[1]);
    g.closePath();
    g.fillStyle = axis === 'y' ? '#7a3c1e' : '#5a2c16';
    g.fill();
  };
  band('y');
  band('x');
  // Four rivets, one at each end of the two visible faces.
  const rivet = (p) => {
    ell(g, p[0], p[1], 3, 2.6, '#6a6d72', INK, 1.5);
    ell(g, p[0] - 0.8, p[1] - 0.8, 1, 0.9, '#a3a6aa', null);
  };
  const zr = zt - 5;
  rivet(P(lo + 0.35, hiE, zr));
  rivet(P(hiE - 0.35, hiE, zr));
  rivet(P(hiE, hiE - 0.35, zr));
  rivet(P(hiE, lo + 0.35, zr));
}

/** The old ground shadow of the game, for when the frame is switched off. */
function paintOldShadow(g) {
  const [, cy] = iso(SIZE, SIZE);
  g.save();
  g.translate(0, cy + 18);
  g.scale(1, 0.12);
  const sh = g.createRadialGradient(0, 0, 50, 0, 0, SIZE * 30);
  sh.addColorStop(0, 'rgba(0,0,0,.6)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh;
  g.fillRect(-SIZE * 40, -SIZE * 40, SIZE * 80, SIZE * 80);
  g.restore();
}

// ---------- Trampled trail ----------
// The trail follows groundPolyline(route): three slightly shifted ribbons with ragged edges, no
// ink outline. Every section (a sample every TRAIL_SAMPLE cells) reads its wear from a field of
// half-cell fields, so the wear stays where the ground was walked when the route changes, and
// the old trail remains as a pale scar while it fades. The ribbons are painted in cell order
// into the terrain cache (clipped to the cell's top face), so higher blocks in front of the
// trail cover it correctly; the cache is rebuilt when the quantised wear changes.

const FIELD = 2;
const FIELD_W = SIZE * FIELD;
const trail = {
  field: new Float32Array(FIELD_W * FIELD_W).fill(WEAR_START),
  strands: [],
  current: new Uint8Array(FIELD_W * FIELD_W),
  cells: new Map(),
  fieldIndex(x, y) {
    const fx = Math.max(0, Math.min(FIELD_W - 1, Math.floor(x * FIELD)));
    const fy = Math.max(0, Math.min(FIELD_W - 1, Math.floor(y * FIELD)));
    return fy * FIELD_W + fx;
  },
  reset(line) {
    this.field.fill(WEAR_START);
    this.strands = [];
    this.addStrand(line);
  },
  addStrand(line) {
    const rng = createRng(`optik:trail:${scene.seed}:${this.strands.length}`);
    const pts = [];
    const out = { x: 0, y: 0, dx: 1, dy: 0 };
    for (let d = 0; d < line.length + TRAIL_SAMPLE * 0.5; d += TRAIL_SAMPLE) {
      positionAt(line, Math.min(d, line.length), out);
      pts.push({ x: out.x, y: out.y });
    }
    const samples = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const len = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      const layers = TRAIL_WIDTHS.map((w) => {
        const shift = (rng.next() - 0.5) * 0.06;
        const l = (w / 2) * (1 + TRAIL_RAG * (rng.next() * 2 - 1));
        const r = (w / 2) * (1 + TRAIL_RAG * (rng.next() * 2 - 1));
        return [p.x + nx * (shift + l), p.y + ny * (shift + l), p.x - nx * (r - shift), p.y - ny * (r - shift)];
      });
      return { fi: this.fieldIndex(p.x, p.y), layers };
    });
    const strand = { samples };
    this.strands.push(strand);
    this.current.fill(0);
    for (const sm of samples) this.current[sm.fi] = 1;
    // Which cells each ribbon segment touches.
    this.cells.clear();
    for (const st of this.strands) {
      for (let i = 0; i + 1 < st.samples.length; i++) {
        for (let l = 0; l < TRAIL_WIDTHS.length; l++) {
          const quad = [...st.samples[i].layers[l].slice(0, 2), ...st.samples[i + 1].layers[l].slice(0, 2),
            ...st.samples[i + 1].layers[l].slice(2), ...st.samples[i].layers[l].slice(2)];
          const touched = new Set();
          for (let k = 0; k < 8; k += 2) {
            const cx = Math.max(0, Math.min(SIZE - 1, Math.floor(quad[k])));
            const cy = Math.max(0, Math.min(SIZE - 1, Math.floor(quad[k + 1])));
            touched.add(cy * SIZE + cx);
          }
          for (const c of touched) {
            if (!this.cells.has(c)) this.cells.set(c, []);
            this.cells.get(c).push({ st, i, l, quad, current: st === strand });
          }
        }
      }
    }
  },
  /** Wear of a ribbon segment, or 0 where an old strand lies on ground that is walked again. */
  wearOf(seg) {
    const fi = seg.st.samples[seg.i].fi;
    if (seg.st !== this.strands[this.strands.length - 1] && this.current[fi]) return 0;
    return this.field[fi];
  },
  setAll(v) {
    this.field.fill(v);
  },
  pass(sampleIndex) {
    const st = this.strands[this.strands.length - 1];
    const sm = st.samples[Math.min(st.samples.length - 1, sampleIndex)];
    this.field[sm.fi] = Math.min(1, this.field[sm.fi] + WEAR_PER_PASS);
  },
  fade(dt) {
    for (let i = 0; i < this.field.length; i++) {
      if (!this.current[i] && this.field[i] > 0) this.field[i] = Math.max(0, this.field[i] - WEAR_FADE_PER_SECOND * dt);
    }
  },
  /** A number that changes when the quantised wear of any drawn segment changes. */
  signature() {
    let h = this.strands.length;
    const last = this.strands[this.strands.length - 1];
    for (const st of this.strands) {
      for (const sm of st.samples) {
        const q = st !== last && this.current[sm.fi] ? 0 : Math.round(this.field[sm.fi] * 10);
        h = (h * 31 + q) | 0;
      }
    }
    return h;
  },
};

function paintTrailInCell(g, cellIndex, hz, pal) {
  const segs = trail.cells.get(cellIndex);
  if (!segs) return;
  const x = cellIndex % SIZE;
  const y = Math.floor(cellIndex / SIZE);
  const groups = new Map();
  for (const seg of segs) {
    const q = Math.round(trail.wearOf(seg) * 10);
    if (q <= 0) continue;
    const key = q * 4 + seg.l;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(seg.quad);
  }
  if (!groups.size) return;
  g.save();
  g.beginPath();
  diamond(x, y, hz).forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.closePath();
  g.clip();
  const lift = (hz / STEP) * LEVEL_LIGHTEN;
  const colour = shade(pal.path, lift);
  const [r, gr, b] = colour.match(/\d+/g).map(Number);
  for (const [key, quads] of groups) {
    const q = Math.floor(key / 4);
    const l = key % 4;
    g.beginPath();
    for (const quad of quads) {
      for (let k = 0; k < 8; k += 2) {
        const p = P(quad[k], quad[k + 1], hz);
        if (k) g.lineTo(p[0], p[1]);
        else g.moveTo(p[0], p[1]);
      }
      g.closePath();
    }
    g.fillStyle = `rgba(${r},${gr},${b},${(q / 10) * TRAIL_ALPHAS[l]})`;
    g.fill();
  }
  g.restore();
}

/** Ramps: where consecutive route cells differ in level, an earth wedge on the lower field against the step. */
function rampsFor(scene, H) {
  const out = new Map();
  const cells = scene.route.cells;
  for (let k = 0; k + 1 < cells.length; k++) {
    const a = cells[k];
    const b = cells[k + 1];
    const la = H.level[a.y * SIZE + a.x];
    const lb = H.level[b.y * SIZE + b.x];
    if (la === lb) continue;
    const low = la < lb ? a : b;
    const high = la < lb ? b : a;
    const lowLevel = Math.min(la, lb);
    let dx = high.x - low.x;
    let dy = high.y - low.y;
    if (dx !== 0 && dy !== 0) {
      // Diagonal step: the ramp goes up the axis neighbour that really is higher.
      const hx = H.level[low.y * SIZE + low.x + dx];
      const hy = H.level[(low.y + dy) * SIZE + low.x];
      if (hx > lowLevel) dy = 0;
      else if (hy > lowLevel) dx = 0;
      else continue;
    }
    const nx = low.x + dx;
    const ny = low.y + dy;
    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
    const i = low.y * SIZE + low.x;
    if (!out.has(i)) out.set(i, []);
    out.get(i).push({ dx, dy, hi: H.level[ny * SIZE + nx] * STEP });
  }
  return out;
}

function paintRamp(g, x, y, hz, r, pal) {
  const ex = x + 0.5 + r.dx * 0.5;
  const ey = y + 0.5 + r.dy * 0.5;
  const lx = -r.dy * (RAMP_WIDTH / 2);
  const ly = r.dx * (RAMP_WIDTH / 2);
  const ix = ex - r.dx * RAMP_RUN;
  const iy = ey - r.dy * RAMP_RUN;
  const A = P(ex + lx, ey + ly, r.hi);
  const B = P(ex - lx, ey - ly, r.hi);
  const Cc = P(ix - lx, iy - ly, hz);
  const D = P(ix + lx, iy + ly, hz);
  g.beginPath();
  g.moveTo(A[0], A[1]);
  g.lineTo(B[0], B[1]);
  g.lineTo(Cc[0], Cc[1]);
  g.lineTo(D[0], D[1]);
  g.closePath();
  g.fillStyle = shade(pal.path, ((hz + r.hi) / 2 / STEP) * LEVEL_LIGHTEN - 8);
  g.fill();
  // Ink only on the two sides, none along the top where the ramp meets the step.
  g.strokeStyle = rgba(pal.pathEdge, 0.8);
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(A[0], A[1]);
  g.lineTo(D[0], D[1]);
  g.moveTo(B[0], B[1]);
  g.lineTo(Cc[0], Cc[1]);
  g.stroke();
}

/** Everything static of the "new" ground: shadow or frame, slab, terrain blocks, decor, cast shadows. */
function paintTerrain(g, scene, H, occ, pal, opt) {
  const N = SIZE;
  const rng = H.rng.fork('paint');
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const lvl = (x, y) => H.level[y * N + x];
  const ramps = rampsFor(scene, H);
  const z = (x, y) => lvl(x, y) * STEP;

  if (opt.frame) paintFrame(g);
  else paintOldShadow(g);

  // The slab throws its own shadow on the plate.
  if (opt.frame && opt.light) {
    const pts = shadowHull({ x0: 0, y0: 0, x1: N, y1: N }, SLAB_DEPTH).map(([x, y]) => P(x, y, -SLAB_DEPTH));
    g.fillStyle = SHADOW_COLOR;
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
    g.fill();
  }

  // Anchor tints: the cells around rift, bastion and beacons.
  const tint = new Array(N * N).fill(null);
  if (opt.colors) {
    const mark = (p, col) => {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = p.x + dx;
          const y = p.y + dy;
          if (x >= 0 && y >= 0 && x < N && y < N) tint[y * N + x] = col;
        }
      }
    };
    for (const b of scene.map.beacons) mark(b, 'rgba(255,170,60,.16)');
    mark(scene.map.rift, 'rgba(150,60,215,.34)');
    mark(scene.map.bastion, 'rgba(225,70,35,.3)');
  }

  const puddles = H.puddles;

  for (let s = 0; s <= 2 * N - 2; s++) {
    for (let x = Math.max(0, s - N + 1); x <= Math.min(N - 1, s); x++) {
      const y = s - x;
      const i = y * N + x;
      const L = H.level[i];
      const hz = L * STEP;
      const isPit = opt.blocks && H.craters[i] === 1;

      // ---- top face
      let top;
      if (isPit) top = pal.pit;
      else top = shade(rng.pick(pal.ground), L * LEVEL_LIGHTEN);
      poly(g, diamond(x, y, hz), top, 'rgba(26,20,16,.25)', 1);
      if (isPit) {
        const inner = [P(x + 0.5, y + 0.12, hz), P(x + 0.88, y + 0.5, hz), P(x + 0.5, y + 0.88, hz), P(x + 0.12, y + 0.5, hz)];
        poly(g, inner, shade(pal.pit, -16), INK, 1.4);
      }
      if (tint[i]) poly(g, diamond(x, y, hz), tint[i], null);

      // The trampled trail lies on the ground, under every shadow.
      paintTrailInCell(g, i, hz, pal);

      // ---- pebbles, cracks, puddles
      if (!isPit && rng.chance(0.4)) {
        for (let k = 0; k < 3; k++) {
          const p = P(x + 0.2 + rng.next() * 0.6, y + 0.2 + rng.next() * 0.6, hz);
          ell(g, p[0], p[1], 1.5 + rng.next() * 1.8, 1 + rng.next(), shade(top.startsWith('#') ? top : pal.ground[0], -22), null);
        }
      }
      if (!isPit && rng.chance(0.2)) {
        g.strokeStyle = 'rgba(26,20,16,.35)';
        g.lineWidth = 1.3;
        g.beginPath();
        let p = P(x + 0.2 + rng.next() * 0.6, y + 0.2 + rng.next() * 0.6, hz);
        g.moveTo(p[0], p[1]);
        for (let k = 0; k < 3; k++) {
          p = [p[0] + (rng.next() - 0.5) * 14, p[1] + (rng.next() - 0.5) * 7];
          g.lineTo(p[0], p[1]);
        }
        g.stroke();
      }
      if (puddles.has(i)) {
        const p = P(x + 0.5, y + 0.5, hz);
        ell(g, p[0], p[1], 20, 9, pal.decor, INK, 2);
        ell(g, p[0] - 4, p[1] - 2, 9, 3.5, shade(pal.decor, 38), null);
        ell(g, p[0] + 7, p[1] + 2, 2.5, 1.5, shade(pal.decor, 80), null);
      }

      // ---- walls: towards the lower neighbours and at the rim of the slab
      const cliffL = pal.cliff[1];
      const cliffR = pal.cliff[2];
      const layerZs = (hTop, hBot) => [hTop - (hTop - hBot) / 3, hTop - ((hTop - hBot) * 2) / 3];
      const lineOf = (c) => shade(c, -16);
      const stoneOf = (face) => shade(face, 16);
      if (y === N - 1) {
        if (hz > 0) wall(g, 'y', x, y, hz, 0, cliffL, lineOf(cliffL), stoneOf(cliffL), layerZs(hz, 0), rng);
        wall(g, 'y', x, y, Math.min(hz, 0), -SLAB_DEPTH, pal.slab[0], shade(pal.slab[0], -12), shade(pal.slab[0], 22), [-11, -21], rng);
      } else if (lvl(x, y + 1) < L) {
        const hn = z(x, y + 1);
        wall(g, 'y', x, y, hz, hn, cliffL, lineOf(cliffL), stoneOf(cliffL), layerZs(hz, hn), rng);
      }
      if (x === N - 1) {
        if (hz > 0) wall(g, 'x', x, y, hz, 0, cliffR, lineOf(cliffR), stoneOf(cliffR), layerZs(hz, 0), rng);
        wall(g, 'x', x, y, Math.min(hz, 0), -SLAB_DEPTH, pal.slab[1], shade(pal.slab[1], -10), shade(pal.slab[1], 20), [-11, -21], rng);
      } else if (lvl(x + 1, y) < L) {
        const hn = z(x + 1, y);
        wall(g, 'x', x, y, hz, hn, cliffR, lineOf(cliffR), stoneOf(cliffR), layerZs(hz, hn), rng);
      }

      for (const r of ramps.get(i) ?? []) paintRamp(g, x, y, hz, r, pal);

      if (!opt.light) continue;

      // ---- light: cast shadows and foot shade landing on this top face, bright rim
      const polys = [];
      g.save();
      g.beginPath();
      diamond(x, y, hz).forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.closePath();
      g.clip();
      for (const [dx, dy] of [[-1, 0], [0, -1], [-1, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0) continue;
        const hn = z(nx, ny);
        if (hn > hz) polys.push(shadowHull({ x0: nx, y0: ny, x1: nx + 1, y1: ny + 1 }, hn - hz));
        if (hn > hz && dx === -1 && dy === 0) footStrip(g, x, y, x, y + 1, 1, 0, hz);
        if (hn > hz && dx === 0 && dy === -1) footStrip(g, x, y, x + 1, y, 0, 1, hz);
      }
      for (let oy = Math.max(0, y - 2); oy <= y; oy++) {
        for (let ox = Math.max(0, x - 2); ox <= x; ox++) {
          for (const b of occ[oy * N + ox]) {
            const delta = z(ox, oy) + b.top - hz;
            if (delta > 0) polys.push(shadowHull(b, delta));
          }
        }
      }
      for (const b of occ[i]) {
        footStrip(g, b.x1, b.y0, b.x1, b.y1, 1, 0, hz);
        footStrip(g, b.x0, b.y1, b.x1, b.y1, 0, 1, hz);
      }
      if (polys.length) {
        g.fillStyle = SHADOW_COLOR;
        g.beginPath();
        for (const pl of polys) {
          pl.forEach(([px, py], k) => {
            const q = P(px, py, hz);
            if (k) g.lineTo(q[0], q[1]);
            else g.moveTo(q[0], q[1]);
          });
          g.closePath();
        }
        g.fill();
      }
      g.restore();
      // Bright rim on the upper left edge, where the neighbour behind is lower (or the map ends).
      if (x === 0 || lvl(x - 1, y) < L) {
        const a = P(x, y, hz);
        const b = P(x, y + 1, hz);
        g.strokeStyle = `rgba(232,220,192,${EDGE_LIGHT_ALPHA})`;
        g.lineWidth = EDGE_LIGHT_WIDTH;
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
      }
    }
  }
}

/** Bounds of the cached terrain image in world pixels. */
function terrainBounds() {
  const ov = PLATE_OVERHANG;
  return {
    x0: -(SIZE + ov * 2) * 32 - 14,
    x1: (SIZE + ov * 2) * 32 + 14,
    y0: -44,
    y1: (SIZE + ov) * 32 + SLAB_DEPTH + PLATE_THICK + 120,
  };
}

const MAX_PIXELS = 12_000_000;
const SETTLE_MS = 160;

/** Offscreen cache of the static terrain; rebuilt on seed, switch, biome and (settled) zoom changes. */
function createTerrainLayer() {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  let built = null;
  let lastZoom = null;
  let lastZoomChange = 0;
  const bounds = terrainBounds();

  function build(key, zoom, dpr, make) {
    const w = bounds.x1 - bounds.x0;
    const h = bounds.y1 - bounds.y0;
    const scale = Math.min(zoom * dpr, Math.sqrt(MAX_PIXELS / (w * h)));
    canvas.width = Math.ceil(w * scale);
    canvas.height = Math.ceil(h * scale);
    g.setTransform(scale, 0, 0, scale, -bounds.x0 * scale, -bounds.y0 * scale);
    g.clearRect(bounds.x0, bounds.y0, w, h);
    make(g);
    built = { key, zoom, dpr };
  }

  return {
    draw(ctx, cam, view, key, nowMs, make) {
      if (cam.zoom !== lastZoom) {
        lastZoom = cam.zoom;
        lastZoomChange = nowMs;
      }
      const stale = !built || built.key !== key || built.dpr !== view.dpr;
      const zoomOff = built && Math.abs(built.zoom - cam.zoom) / cam.zoom > 0.02;
      if (stale || (zoomOff && nowMs - lastZoomChange > SETTLE_MS)) build(key, cam.zoom, view.dpr, make);
      const [dx, dy] = worldToScreen(cam, view, bounds.x0, bounds.y0);
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(canvas, dx, dy, (bounds.x1 - bounds.x0) * cam.zoom, (bounds.y1 - bounds.y0) * cam.zoom);
    },
  };
}

// =====================================================================================
// Backdrop for the diorama frame: the game's sky and skyline, lower horizon, darker, plus a table.
// (Copy of src/render/backdrop.js with a parameterised horizon; src/ stays untouched.)
// =====================================================================================

const PAD_X = 260;
const PAD_Y = 150;
const NEAR_DROP = 0.09;

function spire(g, x, base, w, h, colour, lit, rng) {
  g.fillStyle = colour;
  g.beginPath();
  g.moveTo(x, base);
  g.lineTo(x, base - h * 0.62);
  g.lineTo(x + w * 0.5, base - h);
  g.lineTo(x + w, base - h * 0.62);
  g.lineTo(x + w, base);
  g.closePath();
  g.fill();
  g.fillRect(x - w * 0.18, base - h * 0.5, w * 0.18, h * 0.5);
  g.beginPath();
  g.moveTo(x - w * 0.18, base - h * 0.5);
  g.lineTo(x - w * 0.09, base - h * 0.66);
  g.lineTo(x, base - h * 0.5);
  g.fill();
  g.fillRect(x + w, base - h * 0.42, w * 0.2, h * 0.42);
  g.beginPath();
  g.moveTo(x + w, base - h * 0.42);
  g.lineTo(x + w * 1.1, base - h * 0.56);
  g.lineTo(x + w * 1.2, base - h * 0.42);
  g.fill();
  if (!lit) return;
  g.fillStyle = 'rgba(255,140,60,.55)';
  for (let i = 0; i < 3; i++) {
    if (rng.chance(0.5)) g.fillRect(x + w * (0.3 + rng.next() * 0.35), base - h * (0.2 + rng.next() * 0.35), 2.5, 5);
  }
}

function buildBackdrop(g, w, h, rng) {
  const horizon = h * HORIZON_NEW;
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0d0907');
  sky.addColorStop(Math.min(0.95, horizon / h), '#382017');
  sky.addColorStop(1, '#1a120e');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w / 2, horizon, 20, w / 2, horizon, Math.max(w, h) * 0.45);
  glow.addColorStop(0, 'rgba(255,125,45,.32)');
  glow.addColorStop(0.4, 'rgba(170,55,22,.14)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  for (let x = -40; x < w + 40; ) {
    const sw = 18 + rng.next() * 30;
    spire(g, x, horizon, sw, 90 + rng.next() * 150, '#4a2d1e', false, rng);
    x += sw * 0.9 + rng.next() * 50;
  }
  const haze = g.createLinearGradient(0, horizon - 150, 0, horizon + 14);
  haze.addColorStop(0, 'rgba(140,62,32,0)');
  haze.addColorStop(1, 'rgba(140,62,32,.5)');
  g.fillStyle = haze;
  g.fillRect(0, horizon - 150, w, 164);
  const nearBase = horizon + h * NEAR_DROP;
  for (let x = -60; x < w + 60; ) {
    const sw = 30 + rng.next() * 50;
    spire(g, x, nearBase, sw, 60 + rng.next() * 150, '#170f0c', true, rng);
    x += sw * 1.1 + rng.next() * 70;
  }
  // The table the model stands on: dark wood below the skyline, with a lit far edge.
  const tableY = nearBase + h * 0.02;
  const table = g.createLinearGradient(0, tableY, 0, h);
  table.addColorStop(0, '#2a1b13');
  table.addColorStop(0.35, '#1d130d');
  table.addColorStop(1, '#0c0705');
  g.fillStyle = table;
  g.fillRect(0, tableY, w, h - tableY);
  g.fillStyle = 'rgba(120,70,38,.35)';
  g.fillRect(0, tableY, w, 2);
  g.strokeStyle = 'rgba(0,0,0,.28)';
  g.lineWidth = 1.5;
  for (let k = 1; k < 9; k++) {
    const y = tableY + (h - tableY) * Math.pow(k / 9, 1.6);
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  // Everything darker: the model is the brightest thing in the room.
  g.fillStyle = `rgba(6,3,2,${BACKDROP_DARKEN})`;
  g.fillRect(0, 0, w, h);
}

function createNewBackdrop() {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  let key = '';
  let width = 0;
  let height = 0;
  let scale = 1;
  return {
    draw(ctx, view, cam, seed) {
      const k = `${view.width}x${view.height}@${view.dpr}:${seed}`;
      if (k !== key) {
        key = k;
        width = view.width + PAD_X * 2;
        height = view.height + PAD_Y * 2;
        scale = Math.min(view.dpr, Math.sqrt(8_000_000 / (width * height)));
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        g.setTransform(scale, 0, 0, scale, 0, 0);
        buildBackdrop(g, width, height, createRng(`backdrop:${seed}`));
      }
      const [ax, ay] = worldToScreen(cam, view, 0, 0);
      const dx = parallaxOffset(ax - view.width / 2, 0.14, PAD_X);
      const dy = parallaxOffset(ay - view.height / 2, 0.07, PAD_Y);
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(canvas, (PAD_X - dx) * scale, (PAD_Y - dy) * scale, view.width * scale, view.height * scale, 0, 0, view.width, view.height);
    },
  };
}

/** Same vignette as createVignette in scene.js, with a strength parameter. */
function createVignette(strength) {
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
      g.addColorStop(1, `rgba(0,0,0,${strength})`);
      v.fillStyle = g;
      v.fillRect(0, 0, w, h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(canvas, 0, 0);
  };
}

// =====================================================================================
// State, HUD
// =====================================================================================

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
const camera = createCamera();
const bounds = mapBounds(SIZE);
const cache = createSpriteCache();
const drawEnemy = createEnemySpriteRenderer(cache);
const drawPod = createPodRenderer(cache);

/** 'today' | 'new'; `compare` splits the screen. */
const ui = {
  view: 'new',
  compare: false,
  light: true,
  colors: true,
  blocks: true,
  frame: true,
  biome: 'ash',
  paused: false,
  wear: 50,
  split: 0.5,
};
let scene = null;
let heights = null;
let occluders = null;
let simT = 0;
let podClock = 0;

const view = createCanvasView(canvas, (v) => {
  fitCamera(camera, v, bounds, { top: 100, bottom: 96, side: 16 }, { ...CAMERA, minCellPx: 0 });
  if (!ui.splitPx) ui.splitPx = v.width / 2;
});

function biomeOfSeed(seed) {
  return BIOMES[seedFromString(seed) % 3][0];
}

let trailApplied = 0;
let trailAppliedAt = 0;
let wearInput = null;

function setSeed(seed) {
  scene = buildScene(seed);
  trail.reset(scene.line);
  trailApplied = trail.signature();
  ui.wear = Math.round(WEAR_START * 100);
  if (wearInput) {
    wearInput.value = String(ui.wear);
    document.getElementById('wearOut').textContent = `${ui.wear} %`;
  }
  ui.biome = biomeOfSeed(seed);
  heights = null; // rebuilt per block switch below
  refreshButtons();
  window.__optik.seed = seed;
}

const bar = document.getElementById('bar');
const buttons = {};
function addButton(id, label, onClick, group) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  bar.append(b);
  buttons[id] = b;
  b.dataset.group = group || '';
  return b;
}
const sep = () => {
  const s = document.createElement('span');
  s.className = 'sep';
  bar.append(s);
};
const label = (text) => {
  const s = document.createElement('span');
  s.className = 'lab';
  s.textContent = text;
  bar.append(s);
};

addButton('today', 'Heute', () => { ui.view = 'today'; ui.compare = false; refreshButtons(); });
addButton('new', 'Neu', () => { ui.view = 'new'; ui.compare = false; refreshButtons(); });
addButton('compare', 'Vergleich', () => { ui.compare = !ui.compare; refreshButtons(); });
sep();
label('Bausteine');
addButton('light', 'Licht', () => toggle('light'));
addButton('colors', 'Farbe', () => toggle('colors'));
addButton('blocks', 'Gelände', () => toggle('blocks'));
addButton('frame', 'Rahmen', () => toggle('frame'));
sep();
for (const [id, name] of BIOMES) {
  addButton(id, name, () => { ui.biome = id; ui.colors = true; refreshButtons(); });
}
sep();
addButton('detour', 'Weg umleiten', () => { toggleDetour(); trailAppliedAt = -1e9; refreshButtons(); });
addButton('pause', 'Pause', () => { ui.paused = !ui.paused; refreshButtons(); });

function toggle(key) {
  ui[key] = !ui[key];
  // Switching a block while only "today" is shown would show nothing; go to "new".
  if (ui.view === 'today' && !ui.compare) ui.view = 'new';
  refreshButtons();
}

const splitEl = document.getElementById('split');
const tagL = document.getElementById('tagL');
const tagR = document.getElementById('tagR');

function refreshButtons() {
  const compare = ui.compare;
  buttons.today.classList.toggle('on', !compare && ui.view === 'today');
  buttons.new.classList.toggle('on', !compare && ui.view === 'new');
  buttons.compare.classList.toggle('on', compare);
  for (const k of ['light', 'colors', 'blocks', 'frame', 'pause']) buttons[k].classList.toggle('on', k === 'pause' ? ui.paused : ui[k]);
  buttons.detour.classList.toggle('on', Boolean(scene?.detour));
  for (const [id] of BIOMES) buttons[id].classList.toggle('on', ui.biome === id);
  splitEl.hidden = !compare;
  tagL.hidden = !compare;
  tagR.hidden = !compare;
  positionSplit();
}

function positionSplit() {
  const x = ui.splitPx ?? 0;
  splitEl.style.left = `${x}px`;
  tagL.style.right = `${Math.max(0, window.innerWidth - x + 14)}px`;
  tagR.style.left = `${x + 14}px`;
  splitEl.setAttribute('aria-valuenow', String(Math.round((x / Math.max(1, view.width)) * 100)));
}

// Divider drag (Pointer Events; the handle is 44 px wide).
let dragging = false;
splitEl.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  dragging = true;
  try {
    splitEl.setPointerCapture(ev.pointerId);
  } catch {
    // capture can fail for synthetic events; dragging still works
  }
});
splitEl.addEventListener('pointermove', (ev) => {
  if (!dragging) return;
  ui.splitPx = Math.max(22, Math.min(view.width - 22, ev.clientX));
  positionSplit();
});
const endDrag = () => { dragging = false; };
splitEl.addEventListener('pointerup', endDrag);
splitEl.addEventListener('pointercancel', endDrag);
splitEl.tabIndex = 0;
splitEl.addEventListener('keydown', (ev) => {
  if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
  ui.splitPx = Math.max(22, Math.min(view.width - 22, ui.splitPx + (ev.key === 'ArrowLeft' ? -40 : 40)));
  positionSplit();
});
window.addEventListener('resize', positionSplit);

const seedInput = document.getElementById('seed');
const stats = document.getElementById('stats');
wearInput = document.getElementById('wear');
const wearOut = document.getElementById('wearOut');
wearInput.addEventListener('input', () => {
  ui.wear = Number(wearInput.value);
  wearOut.textContent = `${ui.wear} %`;
  trail.setAll(ui.wear / 100);
  trailAppliedAt = -1e9;
});
seedInput.addEventListener('change', () => setSeed(seedInput.value.trim().toUpperCase() || DEFAULT_SEED));
seedInput.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') seedInput.blur();
});
document.getElementById('dice').addEventListener('click', () => {
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 7; i++) s += letters[Math.floor(Math.random() * letters.length)]; // UI only, not part of the picture
  seedInput.value = s;
  setSeed(s);
});

attachPointerInput(canvas, {
  onPan(dx, dy) {
    panBy(camera, dx, dy);
    clampCamera(camera, bounds, CAMERA);
  },
  onZoom(f, x, y) {
    zoomAt(camera, view, f, x, y, CAMERA);
    clampCamera(camera, bounds, CAMERA);
  },
});
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

// =====================================================================================
// Drawing: today
// =====================================================================================

const backdropToday = createBackdropLayer();
const groundToday = createGroundLayer();
const vignetteToday = createVignette(VIGNETTE_TODAY);

const KIND = { obstacle: 0, rift: 1, beacon: 2, bastion: 3, tower: 4, pod: 5, enemy: 6 };

/** Depth-sorted list of everything that stands on the map, same keys as scene.js. */
function collectItems(skipCraters) {
  const { map, towers, enemies } = scene;
  const items = [];
  for (const o of map.obstacles) {
    if (skipCraters && o.kind === 'crater') continue;
    o.cells.forEach((c, i) => items.push([c.x + c.y + 1, KIND.obstacle, o, i]));
  }
  for (const t of towers) items.push([t.x + t.y + 1, KIND.tower, t, 0]);
  for (const p of scene.pods) items.push([p.x + p.y + 1, KIND.pod, p, 0]);
  items.push([map.rift.x + map.rift.y + 1, KIND.rift, map.rift, 0]);
  items.push([map.bastion.x + map.bastion.y + 1, KIND.bastion, map.bastion, 1]);
  map.beacons.forEach((b, i) => items.push([b.x + b.y + 1, KIND.beacon, b, i]));
  for (const e of enemies) items.push([e.x + e.y, KIND.enemy, e, 0]);
  items.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return items;
}

function enemyView(dt) {
  return { zoom: camera.zoom, dpr: view.dpr, reducedMotion: reduceMotion, simTime: 0, dt };
}

function drawFigure(c, kind, o, i, t, dt) {
  if (kind === KIND.obstacle) drawObstacleCell(c, o, i);
  else if (kind === KIND.rift) drawRift(c, o, t);
  else if (kind === KIND.bastion) drawBastion(c, o, t, i);
  else if (kind === KIND.beacon) drawBeacon(c, o, t);
  else if (kind === KIND.tower) drawTowerSprite(c, cache, o, camera.zoom, view.dpr, t, dt, reduceMotion);
  else if (kind === KIND.pod) drawPod(c, o, t, { zoom: camera.zoom, dpr: view.dpr, heat: o.loop ? undefined : 0 });
  else drawEnemy(c, o, t, enemyView(dt));
}

function drawToday(t, now, dt) {
  const { map, towers } = scene;
  applyObjectColours(null);
  backdropToday.draw(ctx, view, camera, scene.seed);
  groundToday.draw(ctx, camera, view, SIZE, scene.seed, now);
  applyCamera(ctx, camera, view);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  drawRiftGlow(ctx, map.rift, t);
  drawBastionGlow(ctx, map.bastion, t, 1);
  for (const tw of towers) if (tw.special) drawSpecialRing(ctx, tw);
  for (const p of scene.pods) drawPodTarget(ctx, p, t);
  for (const [, kind, o, i] of collectItems(false)) drawFigure(ctx, kind, o, i, t, dt);
  map.beacons.forEach((b, i) => drawBeaconLabel(ctx, b, i + 1));
  for (const p of scene.pods) drawPodHologram(ctx, p, t);
  vignetteToday(ctx, view);
}

// =====================================================================================
// Drawing: new
// =====================================================================================

const backdropNew = createNewBackdrop();
const terrain = createTerrainLayer();
const vignetteNew = createVignette(VIGNETTE_NEW);

// Silhouette shadows: draw the figure on a helper canvas, fill it black with source-in, then
// lay it on the ground sheared and squashed. This runs per frame and per figure, fine for a
// study. The game would rasterise a third variant next to `canvas` and `flash` in the sprite
// cache (a black silhouette per sprite) and draw that sheared, without the helper canvas.
const AUX = { w: 260, h: 300, footX: 130, footY: 250 };
const aux = document.createElement('canvas');
const auxCtx = aux.getContext('2d');
let auxScale = 0;
function silhouetteShadow(c, sx, sy, lift, drawFn) {
  const sc = Math.min(camera.zoom * view.dpr, 1.5);
  if (sc !== auxScale) {
    auxScale = sc;
    aux.width = Math.ceil(AUX.w * sc);
    aux.height = Math.ceil(AUX.h * sc);
  }
  auxCtx.setTransform(1, 0, 0, 1, 0, 0);
  auxCtx.globalCompositeOperation = 'source-over';
  auxCtx.clearRect(0, 0, aux.width, aux.height);
  auxCtx.setTransform(sc, 0, 0, sc, (AUX.footX - sx) * sc, (AUX.footY - sy) * sc);
  auxCtx.lineJoin = 'round';
  auxCtx.lineCap = 'round';
  drawFn(noShadow(auxCtx));
  auxCtx.setTransform(1, 0, 0, 1, 0, 0);
  auxCtx.globalCompositeOperation = 'source-in';
  auxCtx.fillStyle = '#000';
  auxCtx.fillRect(0, 0, aux.width, aux.height);
  auxCtx.globalCompositeOperation = 'source-over';

  const shear = LIGHT.x - LIGHT.y;
  c.save();
  c.translate(0, -lift);
  c.transform(1, 0, -shear, -SPRITE_SHADOW_SQUASH, shear * sy, (1 + SPRITE_SHADOW_SQUASH) * sy);
  c.globalAlpha = SPRITE_SHADOW_ALPHA;
  c.drawImage(aux, sx - AUX.footX, sy - AUX.footY, AUX.w, AUX.h);
  c.restore();
}

function levelAt(cx, cy) {
  return heights.level[Math.max(0, Math.min(SIZE - 1, cy)) * SIZE + Math.max(0, Math.min(SIZE - 1, cx))] * STEP;
}

/** Height of the field under a world point. */
function liftAt(x, y) {
  if (!ui.blocks || !heights) return 0;
  return levelAt(Math.floor(x), Math.floor(y));
}

/**
 * Height for something that walks: the field height, blended linearly into the neighbour's over
 * ENEMY_BLEND of a cell on each side of the border (a step of 12 px is taken like a kerb).
 */
function liftSmooth(x, y) {
  if (!ui.blocks || !heights) return 0;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const fx = x - cx;
  const fy = y - cy;
  const weight = (f) => (f < ENEMY_BLEND ? 0.5 * (1 - f / ENEMY_BLEND) : f > 1 - ENEMY_BLEND ? 0.5 * (1 - (1 - f) / ENEMY_BLEND) : 0);
  const h0 = levelAt(cx, cy);
  return h0 + weight(fx) * (levelAt(fx < 0.5 ? cx - 1 : cx + 1, cy) - h0) + weight(fy) * (levelAt(cx, fy < 0.5 ? cy - 1 : cy + 1) - h0);
}

function drawFoundation(c, tw) {
  cellPath(c, tw.x, tw.y, FOUNDATION_INSET);
  c.fillStyle = rgba(DOCTRINE_COLORS[tw.doctrine], FOUNDATION_ALPHA);
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = INK;
  c.stroke();
}

function drawNew(t, now, dt) {
  const { map, towers } = scene;
  const pal = ui.colors ? PALETTES[ui.biome] : PALETTES.today;
  applyObjectColours(ui.colors ? pal : null);

  if (ui.frame) backdropNew.draw(ctx, view, camera, scene.seed);
  else backdropToday.draw(ctx, view, camera, scene.seed);

  heights = buildHeightsCached();
  if (now - trailAppliedAt > TRAIL_REBUILD_MS) {
    trailApplied = trail.signature();
    trailAppliedAt = now;
  }
  const key = `${scene.seed}|${ui.biome}|${+ui.light}${+ui.colors}${+ui.blocks}${+ui.frame}|${scene.version}|${trailApplied}`;
  terrain.draw(ctx, camera, view, key, now, (g) => {
    paintTerrain(g, scene, heights, occluders, pal, ui);
  });

  applyCamera(ctx, camera, view);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const fctx = ui.light ? noShadow(ctx) : ctx;

  // Ground pass: glows, foundations, rings, then the silhouette shadows, all before any figure.
  const zone = liftAt(map.rift.x, map.rift.y);
  ctx.save();
  ctx.translate(0, -zone);
  drawRiftGlow(ctx, map.rift, t);
  drawBastionGlow(ctx, map.bastion, t, 1);
  if (ui.colors) drawBastionGlow(ctx, map.bastion, t, 1.2);
  ctx.restore();
  for (const p of scene.pods) {
    ctx.save();
    ctx.translate(0, -liftAt(p.x, p.y));
    drawPodTarget(ctx, p, t);
    ctx.restore();
  }
  for (const tw of towers) {
    const lift = liftAt(tw.x, tw.y);
    ctx.save();
    ctx.translate(0, -lift);
    if (ui.colors) drawFoundation(ctx, tw);
    if (tw.special) drawSpecialRing(ctx, tw);
    ctx.restore();
  }
  if (ui.light) {
    for (const tw of towers) {
      const [sx, sy] = iso(tw.x + 0.5, tw.y + 0.5);
      silhouetteShadow(ctx, sx, sy, liftAt(tw.x, tw.y), (c) => drawTowerSprite(c, cache, tw, camera.zoom, view.dpr, t, 0, reduceMotion));
    }
    for (const p of scene.pods) {
      if (!p.landed) continue;
      const [sx, sy] = iso(p.x + 0.5, p.y + 0.5);
      silhouetteShadow(ctx, sx, sy, liftAt(p.x, p.y), (c) => drawPod(c, p, t, { zoom: camera.zoom, dpr: view.dpr, heat: 0 }));
    }
    for (const e of scene.enemies) {
      const [sx, sy] = iso(e.x, e.y);
      silhouetteShadow(ctx, sx, sy, liftSmooth(e.x, e.y), (c) => drawEnemy(c, e, t, enemyView(0)));
    }
  }

  // Depth-sorted figures, each lifted onto the height of its cell.
  const skipCraters = ui.blocks;
  for (const [, kind, o, i] of collectItems(skipCraters)) {
    const cell = kind === KIND.obstacle ? o.cells[i] : o;
    ctx.save();
    ctx.translate(0, -(kind === KIND.enemy ? liftSmooth(o.x, o.y) : liftAt(cell.x, cell.y)));
    drawFigure(fctx, kind, o, i, t, dt);
    ctx.restore();
  }
  map.beacons.forEach((b, i) => {
    ctx.save();
    ctx.translate(0, -liftAt(b.x, b.y));
    drawBeaconLabel(ctx, b, i + 1);
    ctx.restore();
  });
  for (const p of scene.pods) {
    ctx.save();
    ctx.translate(0, -liftAt(p.x, p.y));
    drawPodHologram(ctx, p, t);
    ctx.restore();
  }
  vignetteNew(ctx, view);
}

let heightsKey = '';
let occludersKey = '';
let heightsCache = null;
function buildHeightsCached() {
  const key = `${scene.seed}|${+ui.blocks}`;
  if (key !== heightsKey) {
    heightsKey = key;
    heightsCache = buildHeights(scene, ui.blocks);
  }
  const occKey = `${scene.seed}|${scene.version}`;
  if (occKey !== occludersKey) {
    occludersKey = occKey;
    occluders = buildOccluders(scene);
  }
  return heightsCache;
}

// =====================================================================================
// Frame
// =====================================================================================

let lastNow = null;
function frame(now) {
  const dt = lastNow === null ? 0 : Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  const running = !ui.paused && !reduceMotion;
  if (running) {
    simT += dt;
    podClock += dt;
    trail.fade(dt);
  }
  // Enemies walk the route in a loop at a fixed speed; each new section they enter wears the trail.
  const { line, enemies } = scene;
  for (const e of enemies) {
    const d = (e.offset + simT * ENEMY_SPEED) % line.length;
    positionAt(line, d, e);
    const idx = Math.floor(d / TRAIL_SAMPLE);
    if (idx !== e.lastSample) {
      if (e.lastSample >= 0 && running) trail.pass(idx);
      e.lastSample = idx;
    }
  }
  // The looping pod replays the drop; with reduced motion it stands open.
  for (const p of scene.pods) {
    if (!p.loop) continue;
    p.t = reduceMotion ? IMPACT + POD_STAGES[2] : podClock % POD_LOOP_SECONDS;
    p.landed = p.t >= IMPACT;
  }
  const t = now / 1000;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#110c0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (ui.compare) {
    const x = ui.splitPx * view.dpr;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, x, canvas.height);
    ctx.clip();
    drawToday(t, now, dt);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, 0, canvas.width - x, canvas.height);
    ctx.clip();
    drawNew(t, now, 0);
    ctx.restore();
  } else if (ui.view === 'today') {
    drawToday(t, now, dt);
  } else {
    drawNew(t, now, dt);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  stats.textContent = `Seed ${scene.seed} · Zoom ${camera.zoom.toFixed(2)}`;
  requestAnimationFrame(frame);
}

// Debug handle for the screenshot script.
window.__optik = {
  seed: DEFAULT_SEED,
  ui,
  camera: () => ({ ...camera }),
  levels: () => (heights ? Array.from(heights.level) : null),
  trail,
  scene: () => scene,
  toggleDetour: () => { toggleDetour(); trailAppliedAt = -1e9; refreshButtons(); },
  focus: (x, y, zoom) => {
    const [wx, wy] = iso(x, y);
    camera.x = wx;
    camera.y = wy;
    camera.zoom = zoom;
  },
  setPodClock: (v) => { podClock = v; },
  towers: () => scene.towers.map((t) => ({ ...t })),
  setSeed: (s) => { seedInput.value = s; setSeed(s); },
};

setSeed(DEFAULT_SEED);
refreshButtons();
cache.preload([...allTowerDefs(), ...ENEMY_SPRITE_DEFS, ...POD_SPRITE_DEFS], camera.zoom, view.dpr).then(() => {
  document.body.dataset.ready = 'true';
});
requestAnimationFrame(frame);
