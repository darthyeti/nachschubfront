// Study for issue 75: the Koloss as a swarm beast. Page logic: scene, the walk with its turns on the
// spot, the swathe through rubble, switches. The models are in koloss-schwarm-modell.js; today's
// Koloss is drawn by the game's own src/render/koloss.js, unchanged.
//
// Optical randomness only (dust, chunks); nothing here is a rule of the game.

import { iso } from '../../src/render/iso.js';
import { C } from '../../src/render/palette.js';
import { castShadow } from '../../src/render/shadows.js';
import { drawKoloss } from './koloss-schwarm-heute.js';
import { PALETTES } from '../../src/render/biomes.js';
import { drawKitCell, kitVariant } from '../../src/render/rubbleKit.js';
import { createSpriteCache, drawSprite } from '../../src/render/sprites/rasterizer.js';
import { enemySprite } from '../../src/render/sprites/compose.js';
import { allTowerDefs, drawTowerSprite } from '../../src/render/towerSprites.js';
import { KOLOSS, KOLOSS_RUN } from '../../src/data/enemies.js';
import { CAMERA, MAX_DPR } from '../../src/data/settings.js';
import { DESIGNS, drawDesign, footprint } from './koloss-schwarm-modell.js';

const canvas = document.getElementById('game');
let ctx = canvas.getContext('2d');
const PAL = PALETTES.ash;
const MAP_W = 14;
const MAP_H = 11;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const MODELS = ['heute', 'walze', 'stelze', 'brut'];
const LABEL = { heute: 'Heute: Koloss', walze: 'A Grabwalze', stelze: 'B Stelzwächter', brut: 'C Brutberg' };
const SHORT = { heute: 'Heute', walze: 'A', stelze: 'B', brut: 'C' };
const NOTES = {
  heute: 'Heute: gepanzerte Kriegsmaschine auf Ketten (src/render/koloss.js, unverändert). Dreht im Spiel nicht sichtbar, sondern springt in die neue Richtung und steht 0,6 s.',
  walze: 'A Grabwalze: langer, flacher Segmentkriecher mit Pflugschädel aus Knochen, Stachelreihe auf dem Rücken, fünf Beinpaare im Wellengang. Beim Drehen führt der Schädel, der Schwanz zieht nach.',
  stelze: 'B Stelzwächter: Leib hoch auf sechs langen Beinen, Knie über dem Rücken, zwei Sicheln rechen den Boden vor ihm frei. Dreibeingang.',
  brut: 'C Brutberg: breiter, flacher Krabbenleib, auf dem Rücken die Brut in drei glimmenden Schloten, vorne zwei Scheren als Pflug. Vier Beinpaare.',
};

const S = {
  view: 'fahrt',
  model: 'walze',
  dir: 'auto',
  zoom: 1,
  speed: 2,
  silhouette: false,
  hits: true,
  pause: false,
};

// ---------- The walk: the rules of GDD section 9 as far as the picture needs them ----------

/** Corner points of the loop, cell centres; the first leg runs through the swathe. */
const LOOP = [[1.5, 3.5], [11.5, 3.5], [11.5, 8.5], [2.5, 8.5], [2.5, 3.5]];
/** The swathe: five cells on the first leg (GDD: 5 long, exactly 1 wide). */
const SWATHE = [5, 6, 7, 8, 9].map((x) => ({ x, y: 3 }));
/** Rubble beside the lane that stays where it is: the neighbours are not touched. */
const BESIDE = [[5, 2], [7, 2], [8, 2], [6, 4], [8, 4], [9, 4], [4, 4], [10, 2]];

const walker = {
  leg: 0,
  x: LOOP[0][0],
  y: LOOP[0][1],
  theta: 0,
  from: 0,
  turn: 1,
  hold: 0,
  gait: 0,
  moving: false,
  breach: 0,
  flash: 0,
  nextHit: 1,
  shownDir: 0,
};

let rubble = [];
let chunks = [];
let dust = [];
let shake = 0;

/**
 * The low pieces of the rubble kit (slab, low wall, stump: kit variants 7, 4, 6), so the beast stays
 * visible behind them; the tall ruins would hide it in this small scene.
 */
function lowVariant(x, y) {
  for (let v = 0; v < 400; v++) if ([7, 4, 6].includes(kitVariant(x, y, v))) return v;
  return 0;
}

function resetLap() {
  rubble = [
    ...SWATHE.map((c) => ({ ...c, swathe: true, crushed: false, variant: lowVariant(c.x, c.y) })),
    ...BESIDE.map(([x, y]) => ({ x, y, swathe: false, crushed: false, variant: lowVariant(x, y) })),
  ];
  chunks = [];
}
resetLap();

const headingOf = (a, b) => Math.atan2(Math.sign(b[1] - a[1]), Math.sign(b[0] - a[0]));

function stepWalker(dt) {
  const w = walker;
  w.breach = Math.max(0, w.breach - dt * 1.5);
  if (w.hold > 0) {
    // Turning on the spot: a quarter turn in KOLOSS_RUN.turnSeconds; the legs keep stepping.
    w.hold -= dt;
    w.turn = Math.min(1, 1 - w.hold / KOLOSS_RUN.turnSeconds);
    w.gait += dt / 0.9;
    w.moving = true;
    if (w.hold <= 0) w.turn = 1;
    return;
  }
  const a = LOOP[w.leg];
  const b = LOOP[(w.leg + 1) % LOOP.length];
  const dx = Math.sign(b[0] - a[0]);
  const dy = Math.sign(b[1] - a[1]);
  const step = KOLOSS.speed * dt;
  const left = Math.abs(b[0] - w.x) + Math.abs(b[1] - w.y);
  const go = Math.min(step, left);
  w.x += dx * go;
  w.y += dy * go;
  w.gait += go / 0.55;
  w.moving = go > 0;
  // The front of the beast reaches a cell of the swathe: it breaks, the rubble goes to the sides.
  const fx = Math.floor(w.x + dx * 1.75);
  const fy = Math.floor(w.y + dy * 1.75);
  for (const r of rubble) {
    if (r.swathe && !r.crushed && r.x === fx && r.y === fy) crush(r, dx, dy);
  }
  if (left - go <= 1e-9) {
    w.leg = (w.leg + 1) % LOOP.length;
    if (w.leg === 0) {
      w.x = LOOP[0][0];
      w.y = LOOP[0][1];
      resetLap();
    }
    const c = LOOP[(w.leg + 1) % LOOP.length];
    const next = headingOf(LOOP[w.leg], c);
    if (Math.abs(next - w.theta) > 1e-6) {
      w.from = w.theta;
      w.theta = next;
      w.turn = 0;
      w.hold = KOLOSS_RUN.turnSeconds;
    }
  }
}

function crush(r, dx, dy) {
  r.crushed = true;
  walker.breach = 1;
  if (!reducedMotion) shake = 0.25;
  const sx = -dy;
  const sy = dx;
  const stone = PAL.stone;
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    const push = 1.1 + Math.random() * 1.1;
    chunks.push({
      x: r.x + 0.3 + Math.random() * 0.4,
      y: r.y + 0.3 + Math.random() * 0.4,
      z: 4 + Math.random() * 10,
      vx: sx * side * push + dx * (0.2 + Math.random() * 0.4),
      vy: sy * side * push + dy * (0.2 + Math.random() * 0.4),
      vz: 30 + Math.random() * 60,
      s: 0.07 + Math.random() * 0.09,
      h: 3 + Math.random() * 6,
      c: stone[i % 3],
    });
  }
  for (let i = 0; i < 9; i++) {
    dust.push({ x: r.x + 0.5, y: r.y + 0.5, vx: sx * (Math.random() - 0.5) * 1.6, vy: sy * (Math.random() - 0.5) * 1.6, r: 6, life: 1 + Math.random() * 0.6, age: 0 });
  }
}

function stepFx(dt) {
  for (const c of chunks) {
    if (c.z <= 0 && c.vz <= 0) continue;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.vz -= 320 * dt;
    c.z = Math.max(0, c.z + c.vz * dt);
    if (c.z === 0) {
      // Comes to rest where it lands, a cell or so beside the lane.
      c.vz = 0;
      c.vx = 0;
      c.vy = 0;
    }
  }
  for (const d of dust) {
    d.age += dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.r += dt * 18;
  }
  dust = dust.filter((d) => d.age < d.life);
  shake = Math.max(0, shake - dt);
}

// ---------- Sprites for scale: bunker, swarmer, warrior, the wave-20 boss ----------

const cache = createSpriteCache();
const REF_ENEMIES = ['swarmer', 'warrior', 'colossusbreaker'];
const REF_DEFS = REF_ENEMIES.map((type) => enemySprite(type));
const BUNKER = { doctrine: 'autocannon', rank: 3, x: 0, y: 0, aim: null, cooldown: 0 };
let spritesReady = false;
const dprNow = () => Math.min(MAX_DPR, window.devicePixelRatio || 1);
Promise.all([cache.preload(REF_DEFS, S.zoom, dprNow()), cache.preload(allTowerDefs().filter((d) => d.key.includes('autocannon')), S.zoom, dprNow())]).then(() => {
  spritesReady = true;
});

// ---------- Drawing ----------

/** Fill calls of the last model frame, per model: the measure that compares today with the designs. */
const perf = {};
function countFills(fn) {
  const fill = ctx.fill;
  const stroke = ctx.stroke;
  let fills = 0;
  let strokes = 0;
  ctx.fill = function (...a) {
    fills++;
    return fill.apply(this, a);
  };
  ctx.stroke = function (...a) {
    strokes++;
    return stroke.apply(this, a);
  };
  const t0 = performance.now();
  let out;
  try {
    out = fn();
  } finally {
    ctx.fill = fill;
    ctx.stroke = stroke;
  }
  return { fills, strokes, ms: performance.now() - t0, out };
}

/** Today's Koloss as the game draws it: an enemy record and drawKoloss. */
function drawToday(x, y, dir, t, dt, flash) {
  const e = { koloss: true, x, y, dx: Math.round(Math.cos(dir)), dy: Math.round(Math.sin(dir)), health: 6200, maxHealth: KOLOSS.health, flash: flash ? 0.1 : 0 };
  drawKoloss(ctx, e, { t, dt, reducedMotion });
}

/** A design at world cell (x, y), with its shadow. */
function drawNew(id, x, y, pose) {
  castShadow(ctx, footprint(id, x, y, pose.turn >= 1 ? pose.theta : pose.from), DESIGNS[id].shadowHeight);
  const [px, py] = iso(x, y);
  ctx.save();
  ctx.translate(px, py);
  const stats = {};
  drawDesign(ctx, id, pose, stats);
  ctx.restore();
  return stats;
}

/** Draws one model of any kind and records what it cost. */
function drawModel(id, x, y, pose, t, dt) {
  const r = countFills(() => (id === 'heute' ? drawToday(x, y, pose.theta, t, dt, pose.flash) : drawNew(id, x, y, pose)));
  const p = (perf[id] ??= { fills: 0, strokes: 0, faces: 0, code: 0, built: 0, ms: 0, n: 0 });
  p.fills = r.fills;
  p.strokes = r.strokes;
  if (r.out) Object.assign(p, { faces: r.out.faces, code: r.out.code, built: r.out.built });
  p.ms = p.n ? p.ms * 0.95 + r.ms * 0.05 : r.ms;
  p.n++;
}

function drawGround() {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const pts = [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)];
      ctx.beginPath();
      ctx.moveTo(...pts[0]);
      for (const p of pts.slice(1)) ctx.lineTo(...p);
      ctx.closePath();
      ctx.fillStyle = PAL.ground[(x * 7 + y * 3) % 3];
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(26,20,16,.35)';
      ctx.stroke();
    }
  }
}

function drawSwatheMarks(t) {
  const pulse = reducedMotion ? 0.5 : 0.45 + 0.35 * Math.abs(Math.sin(t * 3));
  for (const r of rubble) {
    if (!r.swathe || r.crushed) continue;
    const pts = [iso(r.x + 0.06, r.y + 0.06), iso(r.x + 0.94, r.y + 0.06), iso(r.x + 0.94, r.y + 0.94), iso(r.x + 0.06, r.y + 0.94)];
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (const p of pts.slice(1)) ctx.lineTo(...p);
    ctx.closePath();
    ctx.fillStyle = `rgba(224,42,26,${pulse * 0.35})`;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(255,58,26,${pulse})`;
    ctx.stroke();
  }
}

function drawChunk(c) {
  const [x0, y0] = [c.x - c.s, c.y - c.s];
  const [x1, y1] = [c.x + c.s, c.y + c.s];
  const top = [iso(x0, y0, c.z + c.h), iso(x1, y0, c.z + c.h), iso(x1, y1, c.z + c.h), iso(x0, y1, c.z + c.h)];
  const left = [iso(x0, y1, c.z), iso(x1, y1, c.z), iso(x1, y1, c.z + c.h), iso(x0, y1, c.z + c.h)];
  const right = [iso(x1, y0, c.z), iso(x1, y1, c.z), iso(x1, y1, c.z + c.h), iso(x1, y0, c.z + c.h)];
  for (const [pts, k] of [[left, 0.8], [right, 0.62], [top, 1]]) {
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (const p of pts.slice(1)) ctx.lineTo(...p);
    ctx.closePath();
    ctx.fillStyle = k === 1 ? c.c : shadeHex(c.c, k);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  }
}

function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`;
}

function drawDust() {
  for (const d of dust) {
    const [x, y] = iso(d.x, d.y, 10 + d.age * 18);
    ctx.globalAlpha = 0.5 * (1 - d.age / d.life);
    ctx.fillStyle = '#b3a58d';
    ctx.beginPath();
    ctx.ellipse(x, y, d.r, d.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** The pose of a model: from the walk, or standing in a fixed direction. */
function poseNow(t) {
  const w = walker;
  if (S.dir !== 'auto') {
    const theta = (Number(S.dir) * Math.PI) / 2;
    return { theta, from: theta, turn: 1, gait: w.gait, moving: S.view === 'fahrt' ? w.moving : false, breach: 0, t, flash: w.flash > 0, still: reducedMotion };
  }
  return { theta: w.theta, from: w.from, turn: w.turn, gait: w.gait, moving: w.moving, breach: w.breach, t, flash: w.flash > 0, still: reducedMotion };
}

/** In the comparison the models turn in place, a quarter every few seconds, all together. */
const cmp = { theta: 0, from: 0, turn: 1, wait: 2.5, gait: 0 };
function stepCompare(dt) {
  if (cmp.turn < 1) {
    cmp.turn = Math.min(1, cmp.turn + dt / KOLOSS_RUN.turnSeconds);
    cmp.gait += dt / 0.9;
    return;
  }
  cmp.wait -= dt;
  if (cmp.wait <= 0) {
    cmp.from = cmp.theta;
    cmp.theta = cmp.theta + Math.PI / 2;
    if (cmp.theta > Math.PI * 1.9) {
      cmp.theta -= Math.PI * 2;
      cmp.from -= Math.PI * 2;
    }
    cmp.turn = 0;
    cmp.wait = 2.5;
  }
}

function comparePose(t) {
  if (S.dir !== 'auto') {
    const theta = (Number(S.dir) * Math.PI) / 2;
    return { theta, from: theta, turn: 1, gait: 0, moving: false, breach: 0, t, flash: walker.flash > 0, still: reducedMotion };
  }
  return { theta: cmp.theta, from: cmp.from, turn: cmp.turn, gait: cmp.gait, moving: cmp.turn < 1, breach: 0, t, flash: walker.flash > 0, still: reducedMotion };
}

/** The game's Koloss only knows four directions and snaps; the study shows it that way. */
const todayTheta = (pose) => (pose.turn >= 1 ? pose.theta : pose.from);

const COMPARE_AT = MODELS.map((id, i) => ({ id, x: 6 + (i - 1.5) * 3.3, y: 4 - (i - 1.5) * 3.3 }));

function drawScene(t, dt) {
  const items = [];
  if (S.view === 'fahrt') {
    for (const r of rubble) {
      if (r.crushed) continue;
      items.push({ d: r.x + r.y + 1, draw: () => drawKitCell(ctx, { kind: 'ruin', cells: [{ x: r.x, y: r.y }], variant: r.variant }, 0, PAL) });
    }
    for (const c of chunks) items.push({ d: c.x + c.y, draw: () => drawChunk(c) });
    const pose = poseNow(t);
    const id = S.model;
    const p = id === 'heute' ? { ...pose, theta: todayTheta(pose) } : pose;
    items.push({ d: walker.x + walker.y + 0.4, draw: () => drawModel(id, walker.x, walker.y, p, t, dt) });
  } else {
    const pose = comparePose(t);
    for (const at of COMPARE_AT) {
      const p = at.id === 'heute' ? { ...pose, theta: todayTheta(pose) } : pose;
      items.push({ d: at.x + at.y + 0.4, draw: () => drawModel(at.id, at.x, at.y, p, t, dt) });
    }
    // For scale, in a row in front: a bunker with its weapon, swarmer, warrior, the wave-20 boss.
    if (spritesReady) {
      const row = [{ kind: 'bunker' }, ...REF_ENEMIES.map((type, i) => ({ kind: 'enemy', def: REF_DEFS[i] }))];
      row.forEach((r, i) => {
        const x = 9.2 + (i - 1.5) * 1.7;
        const y = 7.2 - (i - 1.5) * 1.7;
        items.push({
          d: x + y,
          draw: () => {
            if (r.kind === 'bunker') {
              drawTowerSprite(ctx, cache, { ...BUNKER, x: x - 0.5, y: y - 0.5 }, S.zoom, dprNow(), t, dt, reducedMotion);
            } else {
              const entry = cache.get(r.def, S.zoom, dprNow());
              const [px, py] = iso(x, y);
              if (entry) drawSprite(ctx, r.def, entry, px, py, { flip: true, flash: walker.flash > 0 });
            }
          },
        });
      });
    }
  }
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
  if (S.view === 'fahrt') drawDust();
}

/** World pixels under the camera centre. */
function cameraCentre() {
  if (S.view === 'compare') return iso(6.6, 4.6, 40);
  if (S.zoom < 1) return iso(MAP_W / 2, MAP_H / 2, 0);
  return iso(walker.x, walker.y, 40);
}

let offscreen = null;
function frame(t, dt) {
  const dpr = dprNow();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // A light paper behind the silhouettes, so a shape against the sky reads as well as one on the ground.
  ctx.fillStyle = S.silhouette ? '#d9c9a6' : '#1c1410';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const [cx, cy] = cameraCentre();
  const z = S.zoom * dpr;
  const sh = shake > 0 ? Math.sin(t * 90) * 3 * shake * 4 : 0;
  ctx.setTransform(z, 0, 0, z, canvas.width / 2 - cx * z + sh, canvas.height * 0.52 - cy * z);
  drawGround();
  if (S.view === 'fahrt') drawSwatheMarks(t);
  if (S.silhouette) {
    // Everything standing on the ground in ink: what the eye reads at a glance.
    if (!offscreen || offscreen.width !== canvas.width || offscreen.height !== canvas.height) {
      offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
    }
    const o = offscreen.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.clearRect(0, 0, offscreen.width, offscreen.height);
    o.setTransform(z, 0, 0, z, canvas.width / 2 - cx * z + sh, canvas.height * 0.52 - cy * z);
    swapCtx(o, () => drawScene(t, dt));
    // Solid parts become ink, translucent ones (cast shadows, glow, dust) drop out: a hard
    // threshold, so the silhouette is what the eye would read, not the shadow under it.
    const img = o.getImageData(0, 0, offscreen.width, offscreen.height);
    const px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      const solid = px[i + 3] > 150;
      px[i] = 26;
      px[i + 1] = 20;
      px[i + 2] = 16;
      px[i + 3] = solid ? 255 : 0;
    }
    o.putImageData(img, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(offscreen, 0, 0);
  } else {
    drawScene(t, dt);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (S.view === 'compare') drawCompareLabels(cx, cy, z);
}

/** Draws with another context in place of the main one (the module-level `ctx` is shared). */
function swapCtx(other, fn) {
  const saved = ctx;
  ctx = other;
  try {
    fn();
  } finally {
    ctx = saved;
  }
}

function drawCompareLabels(cx, cy, z) {
  ctx.font = `700 ${Math.round(15 * dprNow())}px "Barlow Condensed", Arial, sans-serif`;
  ctx.textAlign = 'center';
  for (const at of COMPARE_AT) {
    const [px, py] = iso(at.x, at.y);
    const x = canvas.width / 2 + (px - cx) * z;
    const y = canvas.height * 0.52 + (py - cy) * z + 72 * z;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    const text = S.zoom < 0.8 ? SHORT[at.id] : LABEL[at.id];
    ctx.strokeText(text, x, y);
    ctx.fillStyle = '#eadfc4';
    ctx.fillText(text, x, y);
  }
}

// ---------- Loop and switches ----------

let last = performance.now();
let simT = 0;
function loop(now) {
  const real = Math.min(0.05, (now - last) / 1000);
  last = now;
  const dt = S.pause ? 0 : real * S.speed;
  simT += dt;
  if (!S.pause) {
    stepWalker(dt);
    stepCompare(dt);
    stepFx(dt);
    walker.flash = Math.max(0, walker.flash - dt);
    if (S.hits) {
      walker.nextHit -= dt;
      if (walker.nextHit <= 0) {
        walker.flash = 0.12;
        walker.nextHit = 1.4;
      }
    }
  }
  render(simT, dt);
  requestAnimationFrame(loop);
}

function render(t, dt) {
  frame(t, dt);
  updateHud();
}

function updateHud() {
  const id = S.view === 'compare' ? null : S.model;
  document.getElementById('note').textContent = id ? NOTES[id] : 'Vergleich: alle vier in derselben Richtung, vorne Bunker mit Autokanone, Schwärmer, Krieger und der Kolossbrecher (Boss der Welle 20).';
  const rows = MODELS.filter((m) => perf[m]).map((m) => {
    const p = perf[m];
    const faces = m === 'heute' ? '' : ` · ${p.faces} Flächen + ${p.code} Glieder`;
    return `${LABEL[m]}: ${p.fills} Füllungen${faces} · ${p.ms.toFixed(2)} ms`;
  });
  document.getElementById('perf').textContent = rows.join('   |   ');
}

function bind(id, fn) {
  document.getElementById(id).addEventListener('click', () => {
    fn();
    syncButtons();
  });
}

function syncButtons() {
  for (const m of MODELS) document.getElementById(`m-${m}`).classList.toggle('on', S.view === 'fahrt' && S.model === m);
  document.getElementById('v-compare').classList.toggle('on', S.view === 'compare');
  for (const d of ['auto', '0', '1', '2', '3']) document.getElementById(`d-${d}`).classList.toggle('on', S.dir === d);
  for (const z of ['0.4', '1', '2.5']) document.getElementById(`z-${z}`).classList.toggle('on', String(S.zoom) === z);
  for (const s of ['1', '2', '3', '8']) document.getElementById(`s-${s}`).classList.toggle('on', String(S.speed) === s);
  document.getElementById('sil').classList.toggle('on', S.silhouette);
  document.getElementById('hits').classList.toggle('on', S.hits);
  document.getElementById('pause').classList.toggle('on', S.pause);
}

for (const m of MODELS) bind(`m-${m}`, () => Object.assign(S, { view: 'fahrt', model: m }));
bind('v-compare', () => (S.view = 'compare'));
for (const d of ['auto', '0', '1', '2', '3']) bind(`d-${d}`, () => (S.dir = d));
for (const z of ['0.4', '1', '2.5']) bind(`z-${z}`, () => (S.zoom = Number(z)));
for (const s of ['1', '2', '3', '8']) bind(`s-${s}`, () => (S.speed = Number(s)));
bind('sil', () => (S.silhouette = !S.silhouette));
bind('hits', () => (S.hits = !S.hits));
bind('pause', () => (S.pause = !S.pause));
syncButtons();
requestAnimationFrame(loop);

/** For the screenshot script: set the study to a state, run it forward, read the numbers. */
window.__study = {
  S,
  walker,
  perf,
  set(o) {
    Object.assign(S, o);
    syncButtons();
  },
  /** Runs the walk forward by `seconds` of game time without drawing every step. */
  advance(seconds) {
    const step = 1 / 60;
    for (let s = 0; s < seconds; s += step) {
      stepWalker(step);
      stepCompare(step);
      stepFx(step);
    }
  },
  /** Places the walker on the first leg at x, facing +x. */
  placeAt(x) {
    resetLap();
    Object.assign(walker, { leg: 0, x, y: LOOP[0][1], theta: 0, from: 0, turn: 1, hold: 0 });
  },
  ready: () => spritesReady,
  /**
   * The picture of one model alone, facing `dir` (0..3), at zoom 1: the box of its opaque pixels
   * relative to its ground point, in world px. The cast shadow is translucent and does not count,
   * nor does today's health bar.
   */
  measure(id, dir) {
    const c = document.createElement('canvas');
    c.width = 700;
    c.height = 600;
    const o = c.getContext('2d');
    o.translate(350, 420);
    const theta = (dir * Math.PI) / 2;
    const pose = { theta, from: theta, turn: 1, gait: 0.25, moving: false, breach: 0, t: 0, flash: false, still: true };
    swapCtx(o, () => {
      if (id === 'heute') drawKoloss(o, { koloss: true, dead: true, x: 0, y: 0, dx: Math.round(Math.cos(theta)), dy: Math.round(Math.sin(theta)), health: 1, maxHealth: 1, flash: 0 }, { t: 0, dt: 0, reducedMotion: true });
      else drawNew(id, 0, 0, pose);
    });
    const data = o.getImageData(0, 0, c.width, c.height).data;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (data[(y * c.width + x) * 4 + 3] > 200) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
    }
    return { left: x0 - 350, right: x1 - 350, top: 420 - y0, bottom: 420 - y1, width: x1 - x0, height: y1 - y0 };
  },
  /** Average time of `n` draws of one model, and its fills, for the performance table. */
  bench(id, n = 400) {
    const c = document.createElement('canvas');
    c.width = 700;
    c.height = 600;
    const o = c.getContext('2d');
    o.translate(350, 420);
    const t0 = performance.now();
    swapCtx(o, () => {
      for (let i = 0; i < n; i++) {
        const theta = 0.3 + i * 0.001;
        const pose = { theta, from: theta, turn: 1, gait: i * 0.05, moving: true, breach: 0, t: i * 0.016, flash: false, still: false };
        if (id === 'heute') drawKoloss(o, { koloss: true, x: 0, y: 0, dx: 1, dy: 0, health: 1, maxHealth: 1, flash: 0 }, { t: i * 0.016, dt: 0.016, reducedMotion: false });
        else drawNew(id, 0, 0, pose);
      }
    });
    return (performance.now() - t0) / n;
  },
  CAMERA,
};
