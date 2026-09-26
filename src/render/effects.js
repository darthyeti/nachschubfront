// Everything the fighting throws off: muzzle flashes, beams, chains, shells,
// explosions, particles, scorch marks and damage numbers.
//
// The simulation reports what happened (state.events) and keeps the shells in
// state.projectiles; this layer turns that into pictures and forgets it again.
// Nothing here is read back by the simulation, and all of it is capped so a
// busy wave cannot drag the frame rate down.

import { iso } from './iso.js';
import { ell, poly, comicText, shadow } from './draw.js';
import { C } from './palette.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { STRINGS } from '../data/strings.js';
import { PODS } from '../data/pods.js';
import { towerStats, towerById } from '../sim/towers.js';
import { towerAnchor, towerSparks } from './towerSprites.js';
import { sinceImpact } from '../sim/pods.js';

/** Upper bounds (CLAUDE.md: particles and decals need a ceiling). */
const MAX_PARTICLES = 420;
const MAX_DECALS = 60;
const MAX_NUMBERS = 36;

/** Seconds a muzzle flash, a beam or a chain stays on screen. */
const FLASH_SECONDS = 0.07;
const BEAM_SECONDS = 0.12;

/** Damage is collected per enemy and shown as one number every so often. */
const NUMBER_INTERVAL = 0.32;

/** Screen shake in CSS pixels; a pod impact is the loudest thing on the field. */
const MAX_SHAKE = 16;
const SHAKE = { explosion: 2.5, podImpact: 13, bossKill: 6, leak: 4, airstrike: 7 };
/** White flash over the picture, 0 to 1. Damped with prefers-reduced-motion. */
const FLASH = { podImpact: 0.45, bossKill: 0.2, airstrike: 0.28 };
const REDUCED_FLASH = 0.25;

const SPARK = { fire: '#ffb13b', smoke: '#6b625a', goo: C.toxic, spark: '#ffe07a', warp: C.warpL };

/** Upper bound for shockwave rings and the comic words over them. */
const MAX_RINGS = 10;
const MAX_WORDS = 4;

/** Pod staging after the impact (seconds after touchdown), from the style test. */
const POD = {
  /** Explosive bolts blow off before the hatches move. */
  bolts: PODS.openDelaySeconds * 0.6,
  /** Pressure vents from both sides while the shell cools. */
  steamFrom: 0.3,
  steamTo: 2.6,
};

/** World point to the pixel space the camera transform works in. */
function project(x, y, z = 0) {
  return iso(x, y, z);
}

/** The four hatches, in the order they come down (style test). */
const HATCH_DIRS = [
  [0.7, 0.7],
  [-0.7, 0.7],
  [-0.7, -0.7],
  [0.7, -0.7],
];

/** Where the pressure vents sit on the shell, in screen pixels. */
function ventPoint(pod, side) {
  const [x, y] = project(pod.x + 0.5, pod.y + 0.5, 40);
  return { x: x + side * 18, y: y - Math.random() * 30 };
}

export function createEffects() {
  const particles = [];
  const decals = [];
  const numbers = [];
  /** Short-lived shots: muzzle flashes, beams, chains. */
  const shots = [];
  /** Expanding shockwave rings on the ground. */
  const rings = [];
  /** Comic words over the loudest moments. */
  const words = [];
  /** Stasis fields holding their area still. */
  const fields = [];
  /** What each pod has already thrown off; forgotten with the pod. */
  const staged = new WeakMap();
  /** Damage bookkeeping per enemy, for the floating numbers. */
  const tally = new WeakMap();
  /** Camera shake and white flash, both fed by events and decaying on their own. */
  let shake = 0;
  let flash = 0;

  function jolt(amount, flashLevel = 0) {
    shake = Math.min(MAX_SHAKE, shake + amount);
    flash = Math.max(flash, flashLevel);
  }

  function addParticle(p) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push(p);
  }

  function burst(x, y, z, kind, count, options = {}) {
    const [sx, sy] = project(x, y, z);
    burstAt(sx, sy, kind, count, options);
  }

  /** The same, but from a point that is already in screen space (an anchor). */
  function burstAt(sx, sy, kind, count, { speed = 60, size = 3, grow = 0, life = 0.5, gravity = 120 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      // One drawn lifetime, not two: a particle that lived longer than `life`
      // used to grow past its own size and end up with a negative radius.
      const span = life * (0.7 + Math.random() * 0.6);
      addParticle({
        kind,
        x: sx,
        y: sy,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v * 0.5 - v * 0.35,
        gravity,
        size: size * (0.7 + Math.random() * 0.6),
        grow,
        life: span,
        max: span,
      });
    }
  }

  function addRing(x, y, { radius = 3, life = 0.5, colour = '#ffe6b4', width = 4 } = {}) {
    if (rings.length >= MAX_RINGS) rings.shift();
    rings.push({ x, y, radius, life, max: life, colour, width });
  }

  function addWord(x, y, text, size = 34) {
    if (words.length >= MAX_WORDS) words.shift();
    const [sx, sy] = project(x, y, 90);
    words.push({ x: sx, y: sy, text, size, life: 0.9, max: 0.9 });
  }

  function addDecal(decal) {
    if (decals.length >= MAX_DECALS) decals.shift();
    decals.push(decal);
  }

  function addNumber(x, y, amount, colour) {
    if (numbers.length >= MAX_NUMBERS) numbers.shift();
    const [sx, sy] = project(x, y, 26);
    numbers.push({ x: sx + (Math.random() - 0.5) * 10, y: sy, amount, colour, life: 0.75, max: 0.75 });
  }

  /**
   * Where a chain of lightning leaves the emplacement. The cauldron has four
   * electrodes and uses the one nearest the first target; everything else has
   * the one anchor (docs/ART.md, "Wirkungsanker").
   */
  function chainOrigin(state, event) {
    const tower = towerById(state, event.towerId);
    if (!tower) return null;
    const sparks = towerSparks(tower);
    if (!sparks.length) return towerAnchor(tower);
    const first = event.points[1];
    if (!first) return sparks[0];
    const [tx, ty] = project(first.x, first.y, 12);
    let best = sparks[0];
    let bestDist = Infinity;
    for (const spark of sparks) {
      const d = (spark[0] - tx) ** 2 + (spark[1] - ty) ** 2;
      if (d < bestDist) {
        best = spark;
        bestDist = d;
      }
    }
    return best;
  }

  /** The muzzle a shell leaves from, when the emplacement has a tube worth the name. */
  function launchPoint(state, event) {
    const tower = towerById(state, event.towerId);
    return tower?.special === 'siegeMortar' ? towerAnchor(tower) : null;
  }

  /** Takes one simulation event. Unknown events are ignored on purpose. */
  function handle(event, state, reducedMotion) {
    const colour = DOCTRINE_COLORS[event.doctrine] ?? C.gold;
    if (event.type === 'shot') {
      // The storm battery fires blue tracer, not the brass of the doctrine it
      // is built from (docs/ART.md, "Spezialstellungen").
      const shade = event.tracer ?? colour;
      shots.push({ kind: 'shot', x: event.x, y: event.y, tx: event.tx, ty: event.ty, colour: shade, life: FLASH_SECONDS });
      if (!reducedMotion) burst(event.x, event.y, 26, 'spark', 2, { speed: 40, size: 2, life: 0.25 });
    } else if (event.type === 'beam') {
      shots.push({ kind: 'beam', x: event.x, y: event.y, tx: event.tx, ty: event.ty, colour, life: BEAM_SECONDS });
    } else if (event.type === 'emberJump') {
      // A short ember arc from the one that is alight to the one catching fire.
      shots.push({
        kind: 'chain',
        points: [event.from, event.to],
        origin: null,
        colour: '#ff8a2a',
        life: BEAM_SECONDS * 1.6,
      });
      if (!reducedMotion) burst(event.to.x, event.to.y, 10, 'fire', 4, { speed: 35, size: 3, life: 0.35, gravity: -30 });
    } else if (event.type === 'soulfire') {
      // The obelisk's judgement: one beam out of the eye at its tip to the one
      // thing it is passing judgement on (docs/ART.md).
      shots.push({ kind: 'beam', x: event.x, y: event.y, tx: event.tx, ty: event.ty, colour, life: BEAM_SECONDS * 2 });
      if (!reducedMotion) burst(event.tx, event.ty, 14, 'warp', 10, { speed: 60, size: 3, life: 0.5, gravity: -40 });
    } else if (event.type === 'chain') {
      // The simulation starts the chain in the middle of the cell; the drawing
      // starts it where the figure says it does — the coil on the mast, or the
      // electrode of the cauldron nearest the first target (docs/ART.md).
      shots.push({
        kind: 'chain',
        points: event.points,
        origin: chainOrigin(state, event),
        colour,
        life: BEAM_SECONDS,
      });
    } else if (event.type === 'launch') {
      shots.push({ kind: 'shot', x: event.x, y: event.y, tx: event.tx, ty: event.ty, colour, life: FLASH_SECONDS });
      // The siege mortar's tube reaches well past its cell, so its smoke leaves
      // the muzzle rather than the middle of the emplacement.
      const from = launchPoint(state, event);
      if (from) burstAt(from[0], from[1], 'smoke', reducedMotion ? 2 : 5, { speed: 26, size: 4, grow: 6, life: 0.7, gravity: -10 });
      else burst(event.x, event.y, 22, 'smoke', reducedMotion ? 2 : 5, { speed: 26, size: 4, grow: 6, life: 0.7, gravity: -10 });
    } else if (event.type === 'explosion') {
      shots.push({ kind: 'blast', x: event.x, y: event.y, radius: event.radius, colour, life: 0.3 });
      if (event.source === 'orbitalStrike') {
        // A lance from orbit: a column of light, a wide ring and a white flash.
        shots.push({ kind: 'lance', x: event.x, y: event.y, radius: event.radius, life: 0.5 });
        addRing(event.x, event.y, { radius: event.radius * 2.4, life: 0.7, colour: '#fff3c4', width: 6 });
        addWord(event.x, event.y, STRINGS.effects.orbitalStrike, 34);
        jolt(MAX_SHAKE, 0.6);
        burst(event.x, event.y, 0, 'dust', reducedMotion ? 8 : 22, {
          speed: 170, size: 7, grow: 22, life: 1.3, gravity: -6,
        });
      }
      burst(event.x, event.y, 6, 'fire', reducedMotion ? 6 : 14, { speed: 90, size: 5, grow: 4, life: 0.5 });
      burst(event.x, event.y, 6, 'smoke', reducedMotion ? 3 : 7, { speed: 50, size: 6, grow: 9, life: 1.1, gravity: -20 });
      addDecal({ kind: 'scorch', x: event.x, y: event.y, radius: event.radius, life: 12, max: 12 });
      jolt(SHAKE.explosion * event.radius);
    } else if (event.type === 'kill') {
      burst(event.x, event.y, 10, 'goo', reducedMotion ? 3 : 7, { speed: 70, size: 3.5, life: 0.6 });
      addDecal({ kind: 'goo', x: event.x, y: event.y, radius: 0.35, life: 9, max: 9 });
      if (event.boss) jolt(SHAKE.bossKill, FLASH.bossKill);
    } else if (event.type === 'leak') {
      burst(event.x, event.y, 12, 'warp', 8, { speed: 60, size: 4, grow: 3, life: 0.6, gravity: -30 });
      jolt(SHAKE.leak);
    } else if (event.type === 'podImpact') {
      jolt(SHAKE.podImpact, FLASH.podImpact);
      // The pod hits like a shell: dust ring, debris, fire, a crater and a shout.
      burst(event.x + 0.5, event.y + 0.5, 0, 'dust', reducedMotion ? 10 : 26, {
        speed: 150, size: 7, grow: 20, life: 1.4, gravity: -6,
      });
      burst(event.x + 0.5, event.y + 0.5, 10, 'debris', reducedMotion ? 6 : 16, {
        speed: 120, size: 3, life: 0.9, gravity: 420,
      });
      burst(event.x + 0.5, event.y + 0.5, 6, 'fire', reducedMotion ? 5 : 12, {
        speed: 70, size: 6, grow: 10, life: 0.35,
      });
      addRing(event.x + 0.5, event.y + 0.5, { radius: 4.6, life: 0.6, width: 5 });
      addDecal({ kind: 'crater', x: event.x + 0.5, y: event.y + 0.5, radius: 0.9, life: 30, max: 30 });
      // Only the first pod of a salvo shouts; five words at once are noise.
      if (event.index === 0) addWord(event.x + 0.5, event.y + 0.5, STRINGS.effects.podImpact, 38);
    } else if (event.type === 'stasis') {
      fields.push({ x: event.x, y: event.y, radius: event.radius, life: event.seconds, max: event.seconds });
    } else if (event.type === 'kolossBreach') {
      // The ram goes through: dust and debris cell by cell along the swathe, and
      // a shout, because this is the moment the maze the player built gives way.
      for (const c of event.cells) {
        burst(c.x + 0.5, c.y + 0.5, 0, 'dust', reducedMotion ? 6 : 16, {
          speed: 140, size: 8, grow: 18, life: 1.2, gravity: -6,
        });
        burst(c.x + 0.5, c.y + 0.5, 8, 'debris', reducedMotion ? 4 : 12, {
          speed: 130, size: 3.5, life: 1, gravity: 420,
        });
      }
      addRing(event.x, event.y, { radius: 3.4, life: 0.7, width: 6 });
      jolt(SHAKE.podImpact, FLASH.podImpact);
      addWord(event.x, event.y, STRINGS.effects.kolossBreach, 40);
    } else if (event.type === 'kolossArrived') {
      jolt(SHAKE.bossKill, FLASH.bossKill);
      addRing(event.x, event.y, { radius: 2.6, life: 0.8, colour: '#ff6a4a', width: 5 });
    } else if (event.type === 'airstrikeRun') {
      // The run is announced; the bombs arrive one by one as their own events.
      addWord((event.from.x + event.to.x) / 2, (event.from.y + event.to.y) / 2, STRINGS.effects.airstrike, 34);
    } else if (event.type === 'airstrikeBomb') {
      burst(event.x, event.y, 6, 'fire', reducedMotion ? 3 : 10, { speed: 90, size: 6, grow: 12, life: 0.4 });
      burst(event.x, event.y, 0, 'dust', reducedMotion ? 4 : 10, { speed: 110, size: 6, grow: 15, life: 1.1, gravity: -6 });
      addRing(event.x, event.y, { radius: event.radius, life: 0.45, width: 4 });
      addDecal({ kind: 'scorch', x: event.x, y: event.y, radius: event.radius * 0.7, life: 14, max: 14 });
      jolt(SHAKE.airstrike, FLASH.airstrike);
    } else if (event.type === 'command' && event.id === 'prioritySupply') {
      // No target on the map: the order goes out from the bastion.
      const { x, y } = state.map.bastion;
      burst(x + 0.5, y + 0.5, 30, 'spark', reducedMotion ? 6 : 18, { speed: 90, size: 2.5, life: 0.8, gravity: -120 });
      addRing(x + 0.5, y + 0.5, { radius: 2.2, life: 0.7, colour: C.gold, width: 4 });
    }
  }

  /**
   * Floating damage numbers: the render side watches the health of every enemy
   * instead of the simulation reporting each hit, which would flood the events.
   */
  function collectDamage(state, dt) {
    for (const e of state.enemies) {
      const total = e.health + e.shield;
      let entry = tally.get(e);
      if (!entry) {
        entry = { last: total, pending: 0, time: 0 };
        tally.set(e, entry);
        continue;
      }
      if (total < entry.last) entry.pending += entry.last - total;
      entry.last = total;
      entry.time += dt;
      if (entry.pending > 0 && entry.time >= NUMBER_INTERVAL) {
        addNumber(e.x, e.y, Math.round(entry.pending), e.shield > 0 ? C.warpL : C.bone);
        entry.pending = 0;
        entry.time = 0;
      }
    }
  }

  /**
   * What a pod throws off after it has landed: explosive bolts, dust when each
   * hatch slams down, and steam from the cooling shell.
   */
  function stagePods(state, dt, reducedMotion) {
    for (const pod of state.pods) {
      if (!pod.landed) continue;
      const since = sinceImpact(pod);
      let mark = staged.get(pod);
      if (!mark) {
        mark = { bolts: false, slams: 0 };
        staged.set(pod, mark);
      }
      if (!mark.bolts && since >= POD.bolts) {
        mark.bolts = true;
        jolt(3);
        burst(pod.x + 0.5, pod.y + 0.5, 50, 'bolt', reducedMotion ? 3 : 7, {
          speed: 150, size: 3, life: 1, gravity: 520,
        });
        burst(pod.x + 0.5, pod.y + 0.5, 50, 'spark', reducedMotion ? 3 : 8, {
          speed: 180, size: 2, life: 0.3, gravity: 300,
        });
      }
      // One puff of dust per hatch, as it comes down.
      const open = PODS.openDelaySeconds + PODS.openSeconds;
      while (mark.slams < 4 && since >= PODS.openDelaySeconds + ((mark.slams + 1) / 4) * PODS.openSeconds) {
        const [dx, dy] = HATCH_DIRS[mark.slams];
        mark.slams += 1;
        jolt(2);
        burst(pod.x + 0.5 + dx * 0.6, pod.y + 0.5 + dy * 0.6, 0, 'dust', reducedMotion ? 2 : 6, {
          speed: 60, size: 4, grow: 10, life: 0.7, gravity: -4,
        });
      }
      if (reducedMotion) continue;
      if (since > open + POD.steamFrom && since < open + POD.steamTo && Math.random() < dt * 14) {
        const side = Math.random() < 0.5 ? -1 : 1;
        addParticle({
          kind: 'steam',
          ...ventPoint(pod, side),
          vx: side * (70 + Math.random() * 60),
          vy: -12 - Math.random() * 20,
          gravity: -14,
          size: 4,
          grow: 16,
          life: 0.9,
          max: 0.9,
        });
      }
    }
  }

  function update(dt, state, reducedMotion) {
    for (const event of state.events) handle(event, state, reducedMotion);
    collectDamage(state, dt);
    stagePods(state, dt, reducedMotion);

    // Fast decay: the jolt should be over before the next shot lands.
    shake = Math.max(0, shake * Math.pow(0.02, dt) - dt * 2);
    flash = Math.max(0, flash - dt * 3.2);

    for (let i = shots.length - 1; i >= 0; i--) {
      shots[i].life -= dt;
      if (shots[i].life <= 0) shots.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
    }
    for (let i = decals.length - 1; i >= 0; i--) {
      decals[i].life -= dt;
      if (decals[i].life <= 0) decals.splice(i, 1);
    }
    for (let i = numbers.length - 1; i >= 0; i--) {
      const n = numbers[i];
      n.life -= dt;
      if (n.life <= 0) numbers.splice(i, 1);
      else n.y -= 26 * dt;
    }
    for (const list of [rings, words, fields]) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].life -= dt;
        if (list[i].life <= 0) list.splice(i, 1);
      }
    }
  }

  // ---------- Drawing ----------

  /** Scorch marks, goo and the ground side of auras and cones. */
  function drawGround(ctx, state, t, reducedMotion) {
    for (const d of decals) {
      const a = Math.min(1, d.life / 2);
      const [x, y] = project(d.x, d.y);
      ctx.globalAlpha = a;
      if (d.kind === 'scorch') {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, 0.5);
        const r = d.radius * 32;
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
        g.addColorStop(0, 'rgba(18,12,9,.8)');
        g.addColorStop(1, 'rgba(18,12,9,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.restore();
      } else if (d.kind === 'crater') {
        const r = d.radius * 32;
        ell(ctx, x, y, r, r * 0.5, '#2a211b', C.ink, 2);
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.5, 0, 0.25, Math.PI - 0.25);
        ctx.strokeStyle = '#7d6852';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ell(ctx, x, y, d.radius * 26, d.radius * 13, C.toxicD, 'rgba(26,20,16,.6)', 1);
      }
    }
    ctx.globalAlpha = 1;

    // Shockwaves run out over the ground.
    for (const ring of rings) {
      const u = 1 - ring.life / ring.max;
      const [x, y] = project(ring.x, ring.y);
      ctx.globalAlpha = (1 - u) * 0.9;
      ctx.strokeStyle = ring.colour;
      ctx.lineWidth = ring.width * (1 - u * 0.6);
      ctx.beginPath();
      ctx.ellipse(x, y, (0.3 + u) * ring.radius * 32, (0.3 + u) * ring.radius * 16, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Stasis: a lattice of ice over everything inside the field.
    for (const field of fields) drawStasis(ctx, field, t, reducedMotion);

    // Orbital strikes counting down, airstrikes warning, and the banners
    // standing this wave.
    for (const hit of state.pendingStrikes) {
      if (hit.kind === 'airstrike') {
        if (hit.t < hit.warnSeconds) drawAirstrikeWarning(ctx, hit, t);
        continue;
      }
      const u = Math.min(1, hit.t / hit.warnSeconds);
      drawTargetRing(ctx, hit.x, hit.y, hit.radius, '#ff6a4a', reducedMotion ? 0.7 : 0.45 + u * 0.5, 1 - u * 0.25);
      const [x, y] = project(hit.x, hit.y, 0);
      comicText(ctx, String(Math.ceil(hit.warnSeconds - hit.t)), x, y - 8, 22, '#ff9a6a');
    }
    for (const banner of state.banners) {
      drawTargetRing(ctx, banner.x, banner.y, banner.radius, C.gold, 0.5, 1);
      drawHolyBanner(ctx, banner, t, reducedMotion);
    }

    for (const tower of state.towers) {
      const stats = towerStats(tower);
      // The psi emplacement's ring is up whether it is working or not: it is
      // part of the figure, not of its fire (docs/ART.md, "Aufsätze").
      if (stats.behaviour === 'psi') {
        drawStandingAura(ctx, tower, stats, t, reducedMotion);
        continue;
      }
      if (!tower.firing || !tower.aim) continue;
      // The behaviour, not the doctrine: a purge shrine is a flame tower with a ring.
      if (stats.behaviour === 'aura') drawAura(ctx, tower, stats, t, reducedMotion);
      else if (stats.behaviour === 'cone' || stats.behaviour === 'flame') drawCone(ctx, tower, t, reducedMotion);
    }
  }

  /**
   * The run before the gunship comes in: a yellow dashed line along the axis it
   * will fly, and a mark on every cell a bomb is going to fall on, so there is
   * time to see what is about to happen (GDD section 11).
   */
  function drawAirstrikeWarning(ctx, hit, t) {
    const a = project(hit.from.x, hit.from.y);
    const b = project(hit.to.x, hit.to.y);
    ctx.save();
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = -t * 30;
    ctx.strokeStyle = '#ffb13b';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.restore();
    for (const drop of hit.drops) {
      const [x, y] = project(drop.x, drop.y);
      ell(ctx, x, y, 10, 5, null, '#ffb13b', 2);
    }
  }

  /** The holy banner standing in the middle of its field for the rest of the wave. */
  function drawHolyBanner(ctx, banner, t, reducedMotion) {
    const [x, y] = project(banner.x, banner.y);
    const top = y - 78;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, top);
    ctx.stroke();
    ctx.strokeStyle = C.steelL;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    const wave = reducedMotion ? 0 : Math.sin(t * 2.5) * 5;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.quadraticCurveTo(x - 18, top - wave, x - 34, top + wave * 0.6);
    ctx.lineTo(x - 34, top + 32 + wave * 0.6);
    ctx.quadraticCurveTo(x - 18, top + 26 - wave, x, top + 24);
    ctx.closePath();
    ctx.fillStyle = C.gold;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    // A skull on the cloth, like the banners on the ruins.
    ell(ctx, x - 17, top + 12, 5, 5.5, C.bone, C.ink, 1.4);
    ell(ctx, x - 19, top + 11, 1.4, 1.4, C.ink, null);
    ell(ctx, x - 15, top + 11, 1.4, 1.4, C.ink, null);
    ell(ctx, x, top, 3, 3, C.gold, C.ink, 1.5);
  }

  /** A stasis field: a cold disc with a crystal lattice, fading as it runs out. */
  function drawStasis(ctx, field, t, reducedMotion) {
    const [x, y] = project(field.x, field.y);
    const r = field.radius * 32;
    const fade = Math.min(1, field.life / 0.6);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.5);
    ctx.globalAlpha = fade * 0.55;
    const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    g.addColorStop(0, 'rgba(190,235,255,.5)');
    g.addColorStop(1, 'rgba(120,190,230,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = fade * 0.9;
    ctx.strokeStyle = '#bff2ff';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Six shards standing in the ring, turning very slowly.
    ctx.rotate(reducedMotion ? 0 : t * 0.4);
    ctx.strokeStyle = 'rgba(223,246,255,.85)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25);
      ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Flat ring on the ground: aiming, orbital strikes, banners. */
  function drawTargetRing(ctx, x, y, radius, colour, alpha, scale = 1) {
    const [sx, sy] = project(x, y);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 0.5);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 32 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /**
   * The psi emplacement's standing ring: a dashed circle the size of its reach,
   * up for as long as the building is (docs/ART.md). Fainter than the shrine's,
   * because it is there all the time.
   */
  function drawStandingAura(ctx, tower, stats, t, reducedMotion) {
    const [x, y] = project(tower.x + 0.5, tower.y + 0.5);
    const colour = DOCTRINE_COLORS[stats.doctrine] ?? C.warpL;
    const r = stats.range * 32;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.5);
    ctx.globalAlpha = tower.firing ? 0.16 : 0.08;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = reducedMotion ? 0 : -t * 14;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Ring on the ground in the guide colour of the tower's doctrine. */
  function drawAura(ctx, tower, stats, t, reducedMotion) {
    const [x, y] = project(tower.x + 0.5, tower.y + 0.5);
    const pulse = reducedMotion ? 1 : 1 + Math.sin(t * 4) * 0.04;
    const r = stats.range * 32 * pulse;
    const colour = DOCTRINE_COLORS[stats.doctrine] ?? C.warpL;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, r * 0.25, 0, 0, r);
    g.addColorStop(0, `${colour}00`);
    g.addColorStop(0.75, `${colour}1f`);
    g.addColorStop(1, `${colour}47`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `${colour}88`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  function drawCone(ctx, tower, t, reducedMotion) {
    const from = project(tower.x + 0.5, tower.y + 0.5, 20);
    const to = project(tower.aim.x, tower.aim.y, 6);
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const flicker = reducedMotion ? 1 : 0.85 + Math.sin(t * 24) * 0.15;
    const reach = length * flicker;
    const half = reach * 0.42;
    const tip = [from[0] + ux * reach, from[1] + uy * reach];
    const side = [-uy * half, ux * half];
    const left = [tip[0] + side[0], tip[1] + side[1]];
    const right = [tip[0] - side[0], tip[1] - side[1]];
    ctx.globalAlpha = 0.75;
    poly(ctx, [from, left, right], 'rgba(226,83,31,.55)', null);
    poly(
      ctx,
      [from, [tip[0] + side[0] * 0.5, tip[1] + side[1] * 0.5], [tip[0] - side[0] * 0.5, tip[1] - side[1] * 0.5]],
      'rgba(255,177,59,.8)',
      null,
    );
    ctx.globalAlpha = 1;
    ell(ctx, from[0], from[1], 5 * flicker, 5 * flicker, '#fff3b0', null);
  }

  /** Shells, flashes, beams, particles and numbers, on top of everything. */
  function drawAbove(ctx, state, t, reducedMotion) {
    for (const shell of state.projectiles) {
      const u = Math.min(1, shell.t / shell.flight);
      const height = 4 * 70 * u * (1 - u);
      const [gx, gy] = project(shell.x, shell.y);
      shadow(ctx, gx, gy, 5, 2.5, 0.25);
      const [x, y] = project(shell.x, shell.y, height);
      ell(ctx, x, y, 4.5, 4.5, C.steelD, C.ink, 2);
      ell(ctx, x - 1, y - 1, 1.6, 1.6, C.steelL, null);
    }

    for (const s of shots) {
      const a = Math.max(0, s.life / (s.kind === 'shot' ? FLASH_SECONDS : BEAM_SECONDS));
      if (s.kind === 'shot') drawMuzzle(ctx, s, a);
      else if (s.kind === 'beam') drawBeam(ctx, s, a);
      else if (s.kind === 'chain') drawChain(ctx, s, a, reducedMotion);
      else if (s.kind === 'blast') drawBlast(ctx, s);
      else if (s.kind === 'lance') drawLance(ctx, s);
    }

    for (const p of particles) {
      const u = p.life / p.max;
      const r = Math.max(0.5, p.size + (1 - u) * p.grow);
      if (p.kind === 'fire') {
        const col = u > 0.72 ? '#fff3b0' : u > 0.45 ? '#ffb13b' : u > 0.22 ? '#e2531f' : '#5a3a2e';
        ctx.globalAlpha = u > 0.22 ? 1 : u * 3.5;
        ell(ctx, p.x, p.y, r, r, col, null);
      } else if (p.kind === 'smoke') {
        ctx.globalAlpha = u * 0.65;
        ell(ctx, p.x, p.y, r, r, SPARK.smoke, 'rgba(26,20,16,.5)', 1.2);
      } else if (p.kind === 'spark') {
        ctx.globalAlpha = u;
        ctx.strokeStyle = SPARK.spark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.kind === 'warp') {
        ctx.globalAlpha = u;
        ell(ctx, p.x, p.y, r, r, SPARK.warp, null);
      } else if (p.kind === 'dust') {
        ctx.globalAlpha = u * 0.7;
        ell(ctx, p.x, p.y, r, r * 0.7, '#9b8568', 'rgba(26,20,16,.35)', 1.2);
      } else if (p.kind === 'steam') {
        ctx.globalAlpha = u * 0.8;
        ell(ctx, p.x, p.y, r, r, '#e9e4da', 'rgba(26,20,16,.3)', 1.2);
      } else if (p.kind === 'debris') {
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.ink;
        ctx.fillRect(p.x - r / 2 - 1, p.y - r / 2 - 1, r + 2, r + 2);
        ctx.fillStyle = '#6a5a48';
        ctx.fillRect(p.x - r / 2, p.y - r / 2, r, r);
      } else if (p.kind === 'bolt') {
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.ink;
        ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
        ctx.fillStyle = C.steelL;
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      } else {
        ctx.globalAlpha = 1;
        ell(ctx, p.x, p.y, r, r, SPARK.goo, C.ink, 1.2);
      }
    }
    ctx.globalAlpha = 1;

    for (const n of numbers) {
      const a = Math.min(1, (n.life / n.max) * 2.2);
      ctx.globalAlpha = a;
      comicText(ctx, String(n.amount), n.x, n.y, 17, n.colour);
      ctx.globalAlpha = 1;
    }

    for (const w of words) {
      const u = 1 - w.life / w.max;
      ctx.globalAlpha = Math.min(1, w.life * 4);
      comicText(ctx, w.text, w.x, w.y - u * 26, Math.round(w.size * (0.7 + u * 0.4)), '#ffd23f');
      ctx.globalAlpha = 1;
    }
  }

  function drawMuzzle(ctx, s, a) {
    const from = project(s.x, s.y, 26);
    const to = project(s.tx, s.ty, 10);
    ctx.globalAlpha = a;
    ctx.strokeStyle = s.colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
    ell(ctx, from[0], from[1], 7 * a + 3, 7 * a + 3, '#ffd23f', C.ink, 2);
    ell(ctx, from[0], from[1], 3.5 * a + 1.5, 3.5 * a + 1.5, '#fff6c9', null);
    ctx.globalAlpha = 1;
  }

  function drawBeam(ctx, s, a) {
    const from = project(s.x, s.y, 26);
    const to = project(s.tx, s.ty, 12);
    ctx.globalAlpha = a;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(26,20,16,.5)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
    ctx.strokeStyle = s.colour;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = '#fff6e0';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawChain(ctx, s, a, reducedMotion) {
    ctx.globalAlpha = a;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [width, colour] of [
      [7, 'rgba(26,20,16,.45)'],
      [3.5, s.colour],
      [1.4, '#ffffff'],
    ]) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 1; i < s.points.length; i++) {
        // The first leg starts at the figure's own anchor when it has one.
        const a0 = i === 1 && s.origin
          ? s.origin
          : project(s.points[i - 1].x, s.points[i - 1].y, i === 1 ? 26 : 12);
        const a1 = project(s.points[i].x, s.points[i].y, 12);
        ctx.moveTo(a0[0], a0[1]);
        // A couple of kinks make it read as lightning instead of a wire.
        const steps = reducedMotion ? 1 : 3;
        for (let k = 1; k <= steps; k++) {
          const u = k / steps;
          const jitter = k === steps ? 0 : (Math.random() - 0.5) * 9;
          ctx.lineTo(a0[0] + (a1[0] - a0[0]) * u + jitter, a0[1] + (a1[1] - a0[1]) * u + jitter * 0.5);
        }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** The column of light an orbital strike comes down in. */
  function drawLance(ctx, s) {
    const u = 1 - s.life / 0.5;
    const [x, y] = project(s.x, s.y);
    const width = s.radius * 26 * (1 - u * 0.7);
    const g = ctx.createLinearGradient(x, y - 700, x, y);
    g.addColorStop(0, 'rgba(255,240,200,0)');
    g.addColorStop(0.5, `rgba(255,240,200,${0.5 * (1 - u)})`);
    g.addColorStop(1, `rgba(255,255,240,${0.85 * (1 - u)})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - width, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width * 0.35, y - 700);
    ctx.lineTo(x - width * 0.35, y - 700);
    ctx.closePath();
    ctx.fill();
  }

  function drawBlast(ctx, s) {
    const [x, y] = project(s.x, s.y, 4);
    const u = 1 - s.life / 0.3;
    const r = s.radius * 32 * (0.4 + u * 0.9);
    ctx.globalAlpha = 1 - u;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.5);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  return {
    update,
    drawGround,
    /** Radius ring under the pointer while a command is being aimed. */
    drawAiming(ctx, cell, radius) {
      drawTargetRing(ctx, cell.x + 0.5, cell.y + 0.5, radius, C.gold, 0.8);
    },

    /**
     * The strip an airstrike would cover: the run from the start the player set
     * to the cell under the pointer, drawn on the ground. Before the start is
     * set, only the ring under the pointer shows.
     */
    drawLineAiming(ctx, from, to, halfWidth, t) {
      const a = project(from.x + 0.5, from.y + 0.5);
      const b = project(to.x + 0.5, to.y + 0.5);
      // The strip is a corridor on the ground, so its edges are offset in world
      // space and projected, not offset on screen: a screen offset would be the
      // wrong width depending on the direction.
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * halfWidth;
      const ny = (dx / len) * halfWidth;
      const corners = [
        project(from.x + 0.5 + nx, from.y + 0.5 + ny),
        project(to.x + 0.5 + nx, to.y + 0.5 + ny),
        project(to.x + 0.5 - nx, to.y + 0.5 - ny),
        project(from.x + 0.5 - nx, from.y + 0.5 - ny),
      ];
      ctx.beginPath();
      ctx.moveTo(corners[0][0], corners[0][1]);
      for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i][0], corners[i][1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(242,193,78,.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(242,193,78,.85)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([9, 7]);
      ctx.lineDashOffset = -t * 18;
      ctx.stroke();
      ctx.setLineDash([]);

      // The run itself, so the direction of the attack is unmistakable.
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.strokeStyle = 'rgba(255,210,63,.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawTargetRing(ctx, from.x + 0.5, from.y + 0.5, 0.5, C.gold, 0.7);
    },

    /**
     * How far an emplacement reaches. Shown for whatever the player is looking
     * at, so a tower that cannot touch the route is obvious at a glance.
     */
    drawRange(ctx, x, y, radius, colour) {
      const [sx, sy] = project(x, y);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(1, 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 32, 0, Math.PI * 2);
      ctx.fillStyle = `${colour}14`;
      ctx.fill();
      ctx.strokeStyle = colour;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.75;
      ctx.setLineDash([10, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.globalAlpha = 1;
    },
    drawAbove,
    /**
     * Offset in CSS pixels for the whole picture. Nothing shakes with
     * prefers-reduced-motion (CLAUDE.md).
     * @returns {[number, number]}
     */
    shakeOffset(reducedMotion) {
      if (reducedMotion || shake < 0.3) return [0, 0];
      return [(Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake];
    },

    /** White flash over everything, drawn last. Damped with prefers-reduced-motion. */
    drawFlash(ctx, view, reducedMotion) {
      if (flash <= 0) return;
      const a = reducedMotion ? flash * REDUCED_FLASH : flash;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255,240,210,${a})`;
      ctx.fillRect(0, 0, view.width * view.dpr, view.height * view.dpr);
    },

    clear() {
      particles.length = 0;
      decals.length = 0;
      numbers.length = 0;
      shots.length = 0;
      rings.length = 0;
      words.length = 0;
      fields.length = 0;
      shake = 0;
      flash = 0;
    },
    /** For the debug display. */
    counts() {
      return { particles: particles.length, decals: decals.length };
    },
  };
}
