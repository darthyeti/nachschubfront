// Ash falling and embers rising over the whole picture (reference/stiltest.html).
//
// Screen space, not world space: this is weather in front of the lens, so it does
// not move with the camera. Purely optical, therefore Math.random is fine here.
// With prefers-reduced-motion the flakes stand still instead of drifting.

/** One flake per this many CSS pixels of viewport, within the caps below. */
const ASH_DENSITY = 11_000;
const EMBER_DENSITY = 52_000;
const ASH_CAP = [30, 120];
const EMBER_CAP = [6, 26];

function count(area, density, [min, max]) {
  return Math.max(min, Math.min(max, Math.round(area / density)));
}

export function createAtmosphere() {
  /** @type {{x: number, y: number, r: number, vx: number, vy: number, ph: number}[]} */
  let ash = [];
  /** @type {{x: number, y: number, vy: number, ph: number}[]} */
  let embers = [];
  let width = 0;
  let height = 0;

  function fill(view) {
    width = view.width;
    height = view.height;
    const area = width * height;
    ash = [];
    embers = [];
    for (let i = 0; i < count(area, ASH_DENSITY, ASH_CAP); i++) {
      ash.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.8 + Math.random() * 1.8,
        vx: 6 + Math.random() * 10,
        vy: 12 + Math.random() * 22,
        ph: Math.random() * 6,
      });
    }
    for (let i = 0; i < count(area, EMBER_DENSITY, EMBER_CAP); i++) {
      embers.push({ x: Math.random() * width, y: Math.random() * height, vy: -(15 + Math.random() * 30), ph: Math.random() * 6 });
    }
  }

  return {
    update(dt, view, reducedMotion) {
      if (view.width !== width || view.height !== height) fill(view);
      if (reducedMotion) return;
      for (const a of ash) {
        a.y += a.vy * dt;
        a.x += a.vx * dt;
        if (a.y > height + 5) {
          a.y = -5;
          a.x = Math.random() * width;
        }
        if (a.x > width + 5) a.x = -5;
      }
      for (const e of embers) {
        e.y += e.vy * dt;
        if (e.y < -5) {
          e.y = height + 5;
          e.x = Math.random() * width;
        }
      }
    },

    /** Drawn over the scene, under the vignette. */
    draw(ctx, view, t, reducedMotion) {
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      const twinkle = reducedMotion ? 0 : 1;
      for (const a of ash) {
        ctx.fillStyle = `rgba(205,195,180,${0.35 + Math.sin(t * 2 + a.ph) * 0.15 * twinkle})`;
        ctx.fillRect(a.x, a.y, a.r, a.r);
      }
      for (const e of embers) {
        const green = 130 + Math.round((Math.sin(t * 9 + e.ph) * twinkle + 1) * 40);
        const drift = reducedMotion ? 0 : Math.sin(t * 2 + e.ph) * 6;
        ctx.fillStyle = `rgba(255,${green},50,${0.5 + Math.sin(t * 7 + e.ph) * 0.3 * twinkle})`;
        ctx.fillRect(e.x + drift, e.y, 2, 2);
      }
    },
  };
}
