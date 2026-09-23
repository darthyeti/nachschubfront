// Turns sprite definitions (SVG text) into offscreen canvases, once per raster level.
// Drawing in the frame loop only ever uses drawImage on these canvases.

import { pickLevel, RASTER_LEVELS } from './compose.js';

/** Tint for the pre-rendered hit-flash variant. */
const FLASH_TINT = 'rgba(255, 246, 228, 0.65)';
/** Rasterizations running at the same time. */
const MAX_PARALLEL = 4;

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

export function createSpriteCache() {
  /** id -> { canvas, flash, level, dpr } */
  const ready = new Map();
  /** id -> Promise */
  const pending = new Map();
  const queue = [];
  let running = 0;
  const stats = { rasterized: 0, failed: 0 };

  const idOf = (def, level, dpr) => `${def.key}@${level}x${dpr}`;

  async function rasterize(def, level, dpr) {
    const pixelScale = def.unitScale * level * dpr;
    const [, , w, h] = def.bbox;
    const width = Math.max(1, Math.ceil(w * pixelScale));
    const height = Math.max(1, Math.ceil(h * pixelScale));
    const url = URL.createObjectURL(new Blob([def.svg(pixelScale)], { type: 'image/svg+xml' }));
    try {
      // Wait for the load event rather than img.decode(): Safari has rejected decode()
      // for SVG images in some versions, while load works everywhere.
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('SVG image failed to load'));
        image.src = url;
      });
      const canvas = makeCanvas(width, height);
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const flash = makeCanvas(width, height);
      const f = flash.getContext('2d');
      f.drawImage(canvas, 0, 0);
      f.globalCompositeOperation = 'source-atop';
      f.fillStyle = FLASH_TINT;
      f.fillRect(0, 0, width, height);
      stats.rasterized += 1;
      return { canvas, flash, level, dpr };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function pump() {
    while (running < MAX_PARALLEL && queue.length) {
      const job = queue.shift();
      running += 1;
      rasterize(job.def, job.level, job.dpr)
        .then((entry) => {
          ready.set(job.id, entry);
          job.resolve(entry);
        })
        .catch((err) => {
          stats.failed += 1;
          console.error(`Sprite ${job.id} failed to rasterize`, err);
          job.resolve(null);
        })
        .finally(() => {
          pending.delete(job.id);
          running -= 1;
          pump();
        });
    }
  }

  /** Queues a rasterization unless it exists or is under way. Resolves to the entry. */
  function request(def, level, dpr) {
    const id = idOf(def, level, dpr);
    if (ready.has(id)) return Promise.resolve(ready.get(id));
    if (pending.has(id)) return pending.get(id);
    const promise = new Promise((resolve) => queue.push({ id, def, level, dpr, resolve }));
    pending.set(id, promise);
    pump();
    return promise;
  }

  /** Any already rasterized level of this sprite, preferring the sharpest. */
  function fallback(def, dpr) {
    for (let i = RASTER_LEVELS.length - 1; i >= 0; i--) {
      const entry = ready.get(idOf(def, RASTER_LEVELS[i], dpr));
      if (entry) return entry;
    }
    for (const [id, entry] of ready) if (id.startsWith(`${def.key}@`)) return entry;
    return null;
  }

  return {
    stats,

    /**
     * The entry to draw at this zoom. If the ideal level is missing it is queued and
     * the best existing level is returned meanwhile (scaled), so no frame goes empty.
     */
    get(def, zoom, dpr) {
      const level = pickLevel(zoom);
      const entry = ready.get(idOf(def, level, dpr));
      if (entry) return entry;
      request(def, level, dpr);
      return fallback(def, dpr);
    },

    /** Rasterizes all definitions at the level for this zoom. */
    async preload(defs, zoom, dpr, onProgress) {
      const level = pickLevel(zoom);
      let done = 0;
      await Promise.all(
        defs.map((def) =>
          request(def, level, dpr).then(() => {
            done += 1;
            onProgress?.(done, defs.length);
          }),
        ),
      );
    },
  };
}

/** World position of the sprite's SVG origin for an entity standing on (wx, wy). */
export function spriteOrigin(def, wx, wy) {
  return [wx, wy - def.anchorZ];
}

/**
 * Draws a sprite with its anchor on world position (wx, wy); the context must carry
 * the camera transform (world pixels).
 */
export function drawSprite(ctx, def, entry, wx, wy, { flip = false, flash = false } = {}) {
  const s = def.unitScale;
  const [bx, by, bw, bh] = def.bbox;
  const image = flash ? entry.flash : entry.canvas;
  const y = wy - def.anchorZ + by * s;
  if (flip) {
    ctx.scale(-1, 1);
    ctx.drawImage(image, -wx + bx * s, y, bw * s, bh * s);
    ctx.scale(-1, 1);
  } else {
    ctx.drawImage(image, wx + bx * s, y, bw * s, bh * s);
  }
}

/**
 * Draws a sprite that turns around a pivot, e.g. the weapon of an emplacement.
 * The pivot and the offset are SVG units in the sprite's own frame; the offset
 * (recoil, wobble) is applied after the rotation, so it follows the barrel.
 *
 * @param {number[]} pivot  [x, y] in SVG units.
 * @param {number} angle  Rotation in radians on top of the pose in the artwork.
 * @param {{flip?: boolean, offset?: number[], flash?: boolean}} options
 */
export function drawSpriteTurned(ctx, def, entry, wx, wy, pivot, angle, { flip = false, offset, flash = false } = {}) {
  const s = def.unitScale;
  const [bx, by, bw, bh] = def.bbox;
  const [ox, oy] = spriteOrigin(def, wx, wy);
  ctx.save();
  ctx.translate(ox + pivot[0] * s, oy + pivot[1] * s);
  if (flip) ctx.scale(-1, 1);
  ctx.rotate(angle);
  if (offset) ctx.translate(offset[0] * s, offset[1] * s);
  ctx.drawImage(flash ? entry.flash : entry.canvas, (bx - pivot[0]) * s, (by - pivot[1]) * s, bw * s, bh * s);
  ctx.restore();
}
