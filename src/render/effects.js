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
import { towerStats } from '../sim/towers.js';

/** Upper bounds (CLAUDE.md: particles and decals need a ceiling). */
const MAX_PARTICLES = 420;
const MAX_DECALS = 60;
const MAX_NUMBERS = 36;

/** Seconds a muzzle flash, a beam or a chain stays on screen. */
const FLASH_SECONDS = 0.07;
const BEAM_SECONDS = 0.12;

/** Damage is collected per enemy and shown as one number every so often. */
const NUMBER_INTERVAL = 0.32;

const SPARK = { fire: '#ffb13b', smoke: '#6b625a', goo: C.toxic, spark: '#ffe07a', warp: C.warpL };

/** World point to the pixel space the camera transform works in. */
function project(x, y, z = 0) {
  return iso(x, y, z);
}

export function createEffects() {
  const particles = [];
  const decals = [];
  const numbers = [];
  /** Short-lived shots: muzzle flashes, beams, chains. */
  const shots = [];
  /** Damage bookkeeping per enemy, for the floating numbers. */
  const tally = new WeakMap();

  function addParticle(p) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push(p);
  }

  function burst(x, y, z, kind, count, { speed = 60, size = 3, grow = 0, life = 0.5, gravity = 120 } = {}) {
    const [sx, sy] = project(x, y, z);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      addParticle({
        kind,
        x: sx,
        y: sy,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v * 0.5 - v * 0.35,
        gravity,
        size: size * (0.7 + Math.random() * 0.6),
        grow,
        life: life * (0.7 + Math.random() * 0.6),
        max: life,
      });
    }
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

  /** Takes one simulation event. Unknown events are ignored on purpose. */
  function handle(event, reducedMotion) {
    const colour = DOCTRINE_COLORS[event.doctrine] ?? C.gold;
    if (event.type === 'shot') {
      shots.push({ kind: 'shot', x: event.x, y: event.y, tx: event.tx, ty: event.ty, colour, life: FLASH_SECONDS });
      if (!reducedMotion) burst(event.x, event.y, 26, 'spark', 2, { speed: 40, size: 2, life: 0.25 });
    } else if (event.type === 'beam') {
      shots.push({ kind: 'beam', x: event.x, y: event.y, tx: event.tx, ty: event.ty, colour, life: BEAM_SECONDS });
    } else if (event.type === 'chain') {
      shots.push({ kind: 'chain', points: event.points, colour, life: BEAM_SECONDS });
    } else if (event.type === 'launch') {
      shots.push({ kind: 'shot', x: event.x, y: event.y, tx: event.tx, ty: event.ty, colour, life: FLASH_SECONDS });
      burst(event.x, event.y, 22, 'smoke', reducedMotion ? 2 : 5, { speed: 26, size: 4, grow: 6, life: 0.7, gravity: -10 });
    } else if (event.type === 'explosion') {
      shots.push({ kind: 'blast', x: event.x, y: event.y, radius: event.radius, colour, life: 0.3 });
      burst(event.x, event.y, 6, 'fire', reducedMotion ? 6 : 14, { speed: 90, size: 5, grow: 4, life: 0.5 });
      burst(event.x, event.y, 6, 'smoke', reducedMotion ? 3 : 7, { speed: 50, size: 6, grow: 9, life: 1.1, gravity: -20 });
      addDecal({ kind: 'scorch', x: event.x, y: event.y, radius: event.radius, life: 12, max: 12 });
    } else if (event.type === 'kill') {
      burst(event.x, event.y, 10, 'goo', reducedMotion ? 3 : 7, { speed: 70, size: 3.5, life: 0.6 });
      addDecal({ kind: 'goo', x: event.x, y: event.y, radius: 0.35, life: 9, max: 9 });
    } else if (event.type === 'leak') {
      burst(event.x, event.y, 12, 'warp', 8, { speed: 60, size: 4, grow: 3, life: 0.6, gravity: -30 });
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

  function update(dt, state, reducedMotion) {
    for (const event of state.events) handle(event, reducedMotion);
    collectDamage(state, dt);

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
      } else {
        ell(ctx, x, y, d.radius * 26, d.radius * 13, C.toxicD, 'rgba(26,20,16,.6)', 1);
      }
    }
    ctx.globalAlpha = 1;

    // Orbital strikes counting down, and the banners standing this wave.
    for (const hit of state.pendingStrikes) {
      const u = Math.min(1, hit.t / hit.warnSeconds);
      drawTargetRing(ctx, hit.x, hit.y, hit.radius, '#ff6a4a', reducedMotion ? 0.7 : 0.45 + u * 0.5, 1 - u * 0.25);
      const [x, y] = project(hit.x, hit.y, 0);
      comicText(ctx, String(Math.ceil(hit.warnSeconds - hit.t)), x, y - 8, 22, '#ff9a6a');
    }
    for (const banner of state.banners) {
      drawTargetRing(ctx, banner.x, banner.y, banner.radius, C.gold, 0.5, 1);
    }

    for (const tower of state.towers) {
      if (!tower.firing || !tower.aim) continue;
      // The behaviour, not the doctrine: a purge shrine is a flame tower with a ring.
      const stats = towerStats(tower);
      if (stats.behaviour === 'aura' || stats.behaviour === 'psi') drawAura(ctx, tower, stats, t, reducedMotion);
      else if (stats.behaviour === 'cone' || stats.behaviour === 'flame') drawCone(ctx, tower, t, reducedMotion);
    }
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
    }

    for (const p of particles) {
      const u = p.life / p.max;
      const r = p.size + (1 - u) * p.grow;
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
        const a0 = project(s.points[i - 1].x, s.points[i - 1].y, i === 1 ? 26 : 12);
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
    drawAbove,
    clear() {
      particles.length = 0;
      decals.length = 0;
      numbers.length = 0;
      shots.length = 0;
    },
    /** For the debug display. */
    counts() {
      return { particles: particles.length, decals: decals.length };
    },
  };
}
