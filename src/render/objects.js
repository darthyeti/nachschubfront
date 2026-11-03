// Placeholder art for map objects and enemies, in the style-test look
// (ink outlines, three shading steps). `t` is real time in seconds, for animation only.

import { iso } from './iso.js';
import { STEP, activeTerrain, cellLevel } from './terrain.js';
import { poly, box, ell, shadow, comicText } from './draw.js';
import { rectCorners } from './shadows.js';
import { C } from './palette.js';
import { paletteOf, shade } from './biomes.js';
import { lateralOffset } from './enemySprites.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { BOSSES } from '../data/enemies.js';
import { drawKitCell, kitShadow } from './rubbleKit.js';
import { drawKitCellCached } from './rubbleCache.js';
import { RANK_COUNT } from './sprites/manifest.js';

const ASH = paletteOf('ash');
/** Bulwark: half side of its block in cells and its height in px. */
const BULWARK_HALF = 0.46;
const BULWARK_HEIGHT = 26;
/** Blocks that stand in the light: foot shade and bright edge (shadows.js). */
const LIT = { lit: true };

// ---------- Obstacles ----------

/**
 * Bulwark (docs/ART.md, "Bollwerk"), in the study's final form: a stone block
 * with two support struts and a yellow warning band, replacing the heap of
 * rubble it is built on. It has to be told from rubble at a glance, because
 * only the bulwark stops a Koloss. No guide colour, no rank; it belongs to no
 * doctrine.
 */
function drawBulwark(ctx, x, y, pal) {
  const hw = BULWARK_HALF;
  const cx = x + 0.5;
  const cy = y + 0.5;
  const h = BULWARK_HEIGHT;
  box(ctx, cx - hw, cy - hw, 2 * hw, 2 * hw, h, 0, [pal.stone[0], pal.stone[1], pal.stone[2]], 2.6, LIT);
  // Two struts up the front face.
  ctx.strokeStyle = shade(pal.stone[2], -16);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const u of [0.25, 0.75]) {
    const a = iso(cx - hw + u * 2 * hw, cy + hw, 4);
    const c = iso(cx - hw + u * 2 * hw, cy + hw, h - 2);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.stroke();
  }
  // The yellow warning band across the front.
  poly(
    ctx,
    [
      iso(cx - hw, cy + hw, h * 0.45),
      iso(cx + hw, cy + hw, h * 0.45),
      iso(cx + hw, cy + hw, h * 0.62),
      iso(cx - hw, cy + hw, h * 0.62),
    ],
    '#e8b93a',
    C.ink,
    1.4,
  );
}

/**
 * What an obstacle cell throws on the ground: bodies as rectangles in cell coordinates with
 * their own height in px, for `castShadows`. A crater has no body and no shadow. The ground
 * pass of the scene draws these before any figure, so a shadow never lies on a neighbour.
 * @returns {{footprint: number[][], height: number}[]}
 */
export function obstacleShadow(obstacle, index) {
  const { x, y } = obstacle.cells[index];
  const rect = (x0, y0, x1, y1, height) => ({ footprint: rectCorners(x + x0, y + y0, x + x1, y + y1), height });
  switch (obstacle.kind) {
    case 'bulwark':
      return [rect(0.5 - BULWARK_HALF, 0.5 - BULWARK_HALF, 0.5 + BULWARK_HALF, 0.5 + BULWARK_HALF, BULWARK_HEIGHT)];
    default:
      return kitShadow(obstacle, index);
  }
}

/** The bastion's shadow; `size` as in `drawBastion`. */
export function bastionShadow(p, size = 1) {
  const lift = 1 + (size - 1) * 0.45;
  const s = size;
  return [{ footprint: rectCorners(p.x + 0.08 * s, p.y + 0.08 * s, p.x + 0.92 * s, p.y + 0.92 * s), height: 30 * lift }];
}

/** The beacon's shadow: the low plinth and the tall mast. */
export function beaconShadow(p) {
  return [
    { footprint: rectCorners(p.x + 0.2, p.y + 0.2, p.x + 0.8, p.y + 0.8), height: 8 },
    { footprint: rectCorners(p.x + 0.32, p.y + 0.32, p.x + 0.68, p.y + 0.68), height: 38 },
  ];
}

/**
 * Draws one cell of an obstacle; multi-cell walls are depth-sorted per cell. With `raster`
 * ({zoom, dpr}) the kit cells come from the cache of `rubbleCache.js`, otherwise they are drawn.
 */
export function drawObstacleCell(ctx, obstacle, index, palette = ASH, raster = null) {
  const { x, y } = obstacle.cells[index];
  if (obstacle.kind === 'bulwark') drawBulwark(ctx, x, y, palette);
  else if (raster) drawKitCellCached(ctx, obstacle, index, palette, raster.zoom, raster.dpr);
  else drawKitCell(ctx, obstacle, index, palette);
}

// ---------- Towers ----------

/**
 * Placeholder tower for the art switch and for the moment before a sprite is
 * rasterized: concrete base with a barrel in the doctrine's guide colour.
 */
export function drawTowerPlaceholder(ctx, tower) {
  const [sx, sy] = iso(tower.x + 0.5, tower.y + 0.5);
  const color = DOCTRINE_COLORS[tower.doctrine];
  shadow(ctx, sx + 6, sy + 4, 32, 14, 0.28);
  box(ctx, tower.x + 0.06, tower.y + 0.06, 0.88, 0.88, 16, 0, [C.concL, C.conc, C.concD]);
  box(ctx, tower.x + 0.3, tower.y + 0.3, 0.4, 0.4, 26, 16, [C.steelL, C.steel, C.steelD], 2);
  ell(ctx, sx, sy - 44, 9, 6, color, C.ink, 2);
  const rank = tower.special ? RANK_COUNT : tower.rank;
  comicText(ctx, tower.special ? '★' : String(rank), sx, sy - 54, 16, tower.special ? C.gold : C.bone);
}

// ---------- Rift, beacons, bastion ----------

export function drawRiftGlow(ctx, p, t) {
  const [x, y] = iso(p.x + 0.5, p.y + 0.5);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.5);
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 80);
  g.addColorStop(0, `rgba(200,80,255,${0.42 + Math.sin(t * 3) * 0.05})`);
  g.addColorStop(1, 'rgba(200,80,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-82, -82, 164, 164);
  ctx.restore();
}

export function drawRift(ctx, p, t) {
  drawRiftMouth(ctx, p.x + 0.5, p.y + 0.5, t);
}

/**
 * A rift's mouth at a world point. `still` drops the pulse and the swirl, for a
 * rift that is not attacking and for prefers-reduced-motion (M7b, B8).
 */
export function drawRiftMouth(ctx, wx, wy, t, { scale = 1, still = false } = {}) {
  const [x, y] = iso(wx, wy);
  const pulse = (still ? 1 : 1 + Math.sin(t * 3) * 0.06) * scale;
  ell(ctx, x, y, 28 * pulse, 14 * pulse, C.warpD, C.ink, 2.5);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = i % 2 ? C.warp : C.warpL;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const start = (still ? 0 : t * (1.6 + i * 0.7)) + i * 2;
    ctx.ellipse(x, y, (23 - i * 6) * pulse, (11.5 - i * 3) * pulse, 0, start, start + Math.PI * 1.2);
    ctx.stroke();
  }
}

/**
 * The glow over a rift of a map with several (M7b): `p` is the middle of its
 * gates in world units. The attacking rift glows and pulses, the others only
 * smoulder.
 */
export function drawRiftGlowAt(ctx, wx, wy, t, { active = true, still = false } = {}) {
  const [x, y] = iso(wx, wy);
  const strength = active ? 0.42 + (still ? 0 : Math.sin(t * 3) * 0.05) : 0.14;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.5);
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, active ? 96 : 64);
  g.addColorStop(0, `rgba(200,80,255,${strength})`);
  g.addColorStop(1, 'rgba(200,80,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-98, -98, 196, 196);
  ctx.restore();
}

/**
 * The name of a rift beyond the map edge, along that edge, so it never sits on
 * the route that leads inwards from it (B8). With `detail` a second, smaller
 * line under it (the route length during planning).
 */
export function drawRiftLabel(ctx, wx, wy, angle, name, { active = false, detail = null } = {}) {
  const [x, y] = iso(wx, wy);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = active ? 1 : 0.6;
  comicText(ctx, name, 0, 0, active ? 26 : 20, active ? C.warpL : C.bone);
  if (detail) comicText(ctx, detail, 0, 22, 17, C.gold);
  ctx.restore();
}

/** Diagonal hatching for the ban zone, one tile, made once. */
let hatchTile = null;
function hatchPattern(ctx) {
  if (!hatchTile) {
    hatchTile = document.createElement('canvas');
    hatchTile.width = 16;
    hatchTile.height = 16;
    const g = hatchTile.getContext('2d');
    g.strokeStyle = 'rgba(255,90,60,0.38)';
    g.lineWidth = 3;
    g.beginPath();
    for (const o of [-16, 0, 16]) {
      g.moveTo(o, 16);
      g.lineTo(o + 16, 0);
    }
    g.stroke();
  }
  return ctx.createPattern(hatchTile, 'repeat');
}

/**
 * The ban zone's area and outline as paths in iso space, one pair per terrain level so that each
 * field's part lies on its own height. Built once per map and terrain.
 */
const banPaths = new WeakMap();
function banZonePaths(map) {
  const field = activeTerrain();
  const cached = banPaths.get(map.banned);
  if (cached && cached.field === field) return cached.levels;
  const levels = [0, 1, 2].map(() => ({ area: new Path2D(), edge: new Path2D() }));
  const { size, banned } = map;
  const inside = (x, y) => x >= 0 && y >= 0 && x < size && y < size && banned[y * size + x] === 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inside(x, y)) continue;
      const { area, edge } = levels[cellLevel(x, y)];
      const line = (ax, ay, bx, by) => {
        const a = iso(ax, ay);
        const b = iso(bx, by);
        edge.moveTo(a[0], a[1]);
        edge.lineTo(b[0], b[1]);
      };
      const corners = [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)];
      area.moveTo(corners[0][0], corners[0][1]);
      for (let i = 1; i < 4; i++) area.lineTo(corners[i][0], corners[i][1]);
      area.closePath();
      if (!inside(x, y - 1)) line(x, y, x + 1, y);
      if (!inside(x + 1, y)) line(x + 1, y, x + 1, y + 1);
      if (!inside(x, y + 1)) line(x, y + 1, x + 1, y + 1);
      if (!inside(x - 1, y)) line(x, y, x, y + 1);
    }
  }
  banPaths.set(map.banned, { field, levels });
  return levels;
}

/**
 * The ban zone around the centre (M7b, B4): hatched ground with a rim, so it
 * reads as "nothing goes here" without hiding the floor.
 */
export function drawBanZone(ctx, map) {
  if (!map.banned) return;
  const levels = banZonePaths(map);
  ctx.save();
  levels.forEach(({ area, edge }, level) => {
    ctx.save();
    ctx.translate(0, -level * STEP);
    ctx.fillStyle = 'rgba(40,10,6,0.22)';
    ctx.fill(area);
    ctx.fillStyle = hatchPattern(ctx);
    ctx.fill(area);
    ctx.strokeStyle = 'rgba(255,110,70,0.75)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.stroke(edge);
    ctx.restore();
  });
  ctx.restore();
}

export function drawBastionGlow(ctx, p, t, size = 1) {
  const [x, y] = iso(p.x + size / 2, p.y + size / 2);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.5);
  const reach = 70 * size;
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, reach);
  g.addColorStop(0, `rgba(255,70,30,${0.3 + Math.sin(t * 4) * 0.06})`);
  g.addColorStop(1, 'rgba(255,70,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-reach - 2, -reach - 2, reach * 2 + 4, reach * 2 + 4);
  ctx.restore();
}

/**
 * The bastion. `size` is its footprint in cells: 1 on the standard map, 2 in
 * King of the Hill, where it stands in the middle and has to read from every
 * side (B8). Drawn the same, only larger and a little taller.
 */
export function drawBastion(ctx, p, t, size = 1) {
  const { x, y } = p;
  const s = size;
  const lift = 1 + (s - 1) * 0.45;
  box(ctx, x + 0.08 * s, y + 0.08 * s, 0.84 * s, 0.84 * s, 30 * lift, 0, C.brick, 2.5, LIT);
  // Battlements.
  for (const [dx, dy] of [[0.08, 0.08], [0.64, 0.08], [0.08, 0.64], [0.64, 0.64]]) {
    box(ctx, x + dx * s, y + dy * s, 0.28 * s, 0.28 * s, 10 * lift, 30 * lift, C.brick, 2, LIT);
  }
  // Glowing gate on the two visible faces.
  const flicker = 0.75 + Math.sin(t * 7) * 0.1;
  const fx = (v) => x + v * s;
  const fy = (v) => y + v * s;
  poly(ctx, [iso(fx(0.35), fy(0.92), 0), iso(fx(0.65), fy(0.92), 0), iso(fx(0.65), fy(0.92), 16 * lift), iso(fx(0.5), fy(0.92), 22 * lift), iso(fx(0.35), fy(0.92), 16 * lift)], `rgba(255,110,40,${flicker})`, C.ink, 2);
  poly(ctx, [iso(fx(0.92), fy(0.35), 0), iso(fx(0.92), fy(0.65), 0), iso(fx(0.92), fy(0.65), 16 * lift), iso(fx(0.92), fy(0.5), 22 * lift), iso(fx(0.92), fy(0.35), 16 * lift)], `rgba(255,110,40,${flicker * 0.8})`, C.ink, 2);
  // Banner pole with a skull emblem.
  const [bx, by] = iso(fx(0.5), fy(0.5), 40 * lift);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx, by - 26);
  ctx.stroke();
  poly(ctx, [[bx, by - 26], [bx + 18, by - 22], [bx + 14, by - 15], [bx + 18, by - 8], [bx, by - 12]], C.blood, C.ink, 2);
  ell(ctx, bx + 8, by - 17, 3, 3, C.bone, C.ink, 1.2);
}

export function drawBeacon(ctx, p, t) {
  const { x, y } = p;
  box(ctx, x + 0.2, y + 0.2, 0.6, 0.6, 8, 0, ['#80735f', '#5f5446', '#433a31'], 2, LIT);
  box(ctx, x + 0.32, y + 0.32, 0.36, 0.36, 30, 8, C.stone, 2, LIT);
  // Fire bowl and flame.
  const [fx, fy] = iso(x + 0.5, y + 0.5, 38);
  ell(ctx, fx, fy, 13, 6.5, C.steelD, C.ink, 2);
  const flick = Math.sin(t * 11 + x * 3) * 2.5;
  const flame = (scale, col) => {
    ctx.beginPath();
    ctx.moveTo(fx - 9 * scale, fy);
    ctx.quadraticCurveTo(fx - 8 * scale, fy - 14 * scale, fx + flick * scale, fy - 24 * scale);
    ctx.quadraticCurveTo(fx + 8 * scale, fy - 12 * scale, fx + 9 * scale, fy);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  };
  flame(1, '#ff7a2a');
  flame(0.6, '#ffd23f');
  ctx.beginPath();
  ctx.moveTo(fx - 9, fy);
  ctx.quadraticCurveTo(fx - 8, fy - 14, fx + flick, fy - 24);
  ctx.quadraticCurveTo(fx + 8, fy - 12, fx + 9, fy);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Beacon number, drawn after all objects so it is never hidden. */
export function drawBeaconLabel(ctx, p, number) {
  const [x, y] = iso(p.x + 0.5, p.y + 0.5, 70);
  comicText(ctx, String(number), x, y, 24, C.gold);
}

// ---------- Enemies (placeholder shapes, kept for the art debug switch) ----------

const ENEMY_STYLE = {
  swarmer: { r: 6, body: C.bloodL, dark: C.blood },
  warrior: { r: 9, body: C.toxic, dark: C.toxicD },
  breaker: { r: 13, body: C.steelL, dark: C.steelD },
  warpseer: { r: 9, body: '#8a6ccf', dark: '#4f3a86' },
  carrionflyer: { r: 8, body: '#8a6a5a', dark: '#4e3a30' },
  burster: { r: 11, body: '#b9c24a', dark: '#6f7a24' },
  healer: { r: 9, body: C.bone, dark: C.boneD },
};

/** Bosses borrow the shape of a related enemy here too, twice the size. */
const BOSS_STYLE = Object.fromEntries(
  Object.entries(BOSSES).map(([id, boss]) => [
    id,
    { ...ENEMY_STYLE[boss.sprite], r: ENEMY_STYLE[boss.sprite].r * boss.scale },
  ]),
);

export function drawEnemy(ctx, e, t) {
  const style = ENEMY_STYLE[e.type] ?? BOSS_STYLE[e.type] ?? ENEMY_STYLE.warrior;
  const off = lateralOffset(e);
  const [sx, sy] = iso(e.x - e.dy * off, e.y + e.dx * off);
  const bob = Math.abs(Math.sin(t * 9 + e.id)) * 2;
  // Fade in while emerging from the rift.
  const alpha = Math.min(1, e.d / 0.5);
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;

  if (e.flying) {
    const z = 30 + Math.sin(t * 3 + e.id) * 3;
    shadow(ctx, sx, sy, style.r * 1.4, style.r * 0.6, 0.28);
    const y = sy - z;
    const flap = Math.sin(t * 14 + e.id) * 6;
    poly(ctx, [[sx - 2, y], [sx - style.r * 2.2, y - 6 - flap], [sx - style.r * 1.2, y + 3]], style.dark, C.ink, 1.8);
    poly(ctx, [[sx + 2, y], [sx + style.r * 2.2, y - 6 - flap], [sx + style.r * 1.2, y + 3]], style.dark, C.ink, 1.8);
    ell(ctx, sx, y, style.r, style.r * 0.75, style.body, C.ink, 2);
    ell(ctx, sx + 3, y - 2, 1.6, 1.6, C.gold, null);
    ctx.globalAlpha = 1;
    return;
  }

  shadow(ctx, sx, sy + 1, style.r * 1.3, style.r * 0.55, 0.3);
  const y = sy - style.r - bob;
  // Heading in screen space decides which way the face looks.
  const facing = (e.dx - e.dy) >= 0 ? 1 : -1;
  ell(ctx, sx, y, style.r, style.r * 0.95, style.body, C.ink, 2.2);
  ctx.beginPath();
  ctx.ellipse(sx, y, style.r, style.r * 0.95, 0, 0.3, Math.PI - 0.3);
  ctx.strokeStyle = style.dark;
  ctx.lineWidth = style.r * 0.35;
  ctx.stroke();
  ell(ctx, sx + facing * style.r * 0.45, y - style.r * 0.2, style.r * 0.22, style.r * 0.22, C.gold, C.ink, 1.2);
  if (e.type === 'breaker') {
    box(ctx, e.x - e.dy * off - 0.12, e.y + e.dx * off - 0.12, 0.24, 0.24, 6, style.r * 1.6 + bob, [C.steelL, C.steel, C.steelD], 1.6);
  }
  ctx.globalAlpha = 1;
}

/**
 * Health (and warp shield) above a wounded enemy. Bosses always show theirs.
 * Drawn right after the enemy, so nearer ones cover it like everything else.
 */
export function drawEnemyBar(ctx, e, top) {
  const hurt = e.health < e.maxHealth || e.shield < e.maxShield;
  if (!hurt && !e.boss) return;
  const off = lateralOffset(e);
  const [sx, sy] = iso(e.x - e.dy * off, e.y + e.dx * off);
  const alpha = Math.min(1, e.d / 0.5);
  if (alpha <= 0) return;
  const width = e.boss ? 44 : 24;
  const height = e.boss ? 6 : 4;
  const y = sy - top - (e.flying ? 34 : 8);
  const x = sx - width / 2;
  ctx.globalAlpha = alpha;
  poly(
    ctx,
    [[x, y], [x + width, y], [x + width, y + height], [x, y + height]],
    'rgba(26,20,16,.75)',
    C.ink,
    1.6,
  );
  const health = Math.max(0, Math.min(1, e.health / e.maxHealth));
  if (health > 0) {
    const w = width * health;
    poly(ctx, [[x, y], [x + w, y], [x + w, y + height], [x, y + height]], health > 0.35 ? C.toxic : C.bloodL, null);
  }
  if (e.maxShield > 0 && e.shield > 0) {
    const w = width * Math.min(1, e.shield / e.maxShield);
    const sy2 = y - height - 1;
    poly(ctx, [[x, sy2], [x + width, sy2], [x + width, sy2 + height], [x, sy2 + height]], 'rgba(26,20,16,.75)', C.ink, 1.4);
    poly(ctx, [[x, sy2], [x + w, sy2], [x + w, sy2 + height], [x, sy2 + height]], C.warp, null);
  }
  ctx.globalAlpha = 1;
}
