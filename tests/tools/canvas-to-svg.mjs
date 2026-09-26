// Records Canvas 2D drawing as SVG.
//
// The studies in reference/studien/ hold the binding shapes of the bunker, the
// weapon tops and the special emplacements, but they hold them as drawing code.
// docs/ART.md keeps the rule that figures are SVG files in reference/konzept/,
// rasterized once at startup, so the code has to become drawings. This is the
// bridge: it runs in the browser, stands in for the study's 2D context, and
// writes every fill and stroke out as an SVG path.
//
// It is deliberately narrow. Only what the studies actually call is supported
// (see the survey in the M7 notes): paths, ellipses, arcs, rectangles, the
// three curve commands, transforms, alpha, dashes. Anything else throws rather
// than quietly dropping a shape.
//
// Used by study-to-svg.mjs. The function is stringified into the page, so it
// must not close over anything outside itself.

/**
 * Installs a recorder over a 2D context and returns a handle to collect from.
 * Own properties shadow the prototype's, so the study's own `ctx` is recorded
 * without the study knowing.
 */
export function installRecorder(ctx) {
  const shapes = [];
  const KAPPA = 0.5522847498307936;

  // Current transform, as [a, b, c, d, e, f], and the stack `save` pushes.
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const state = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineJoin: 'miter',
    lineCap: 'butt',
    globalAlpha: 1,
    lineDash: [],
    /** Path everything is clipped to right now, in device space, or null. */
    clip: null,
  };

  const point = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const round = (v) => Math.round(v * 100) / 100;

  /** The path being built, already in device space. */
  let path = [];
  let cursor = [0, 0];
  let start = [0, 0];

  const moveTo = (x, y) => {
    const p = point(x, y);
    path.push(`M${round(p[0])} ${round(p[1])}`);
    cursor = p;
    start = p;
  };
  const lineTo = (x, y) => {
    const p = point(x, y);
    if (path.length === 0) path.push(`M${round(p[0])} ${round(p[1])}`);
    else path.push(`L${round(p[0])} ${round(p[1])}`);
    cursor = p;
  };
  const curveTo = (c1x, c1y, c2x, c2y, x, y) => {
    const a = point(c1x, c1y);
    const b = point(c2x, c2y);
    const p = point(x, y);
    path.push(`C${round(a[0])} ${round(a[1])} ${round(b[0])} ${round(b[1])} ${round(p[0])} ${round(p[1])}`);
    cursor = p;
  };

  /**
   * An elliptical arc as up to four cubic segments. Canvas arcs live in user
   * space and the transform may squash them, so they are flattened here and the
   * control points carried through the matrix like any other point.
   */
  const arcTo = (cx, cy, rx, ry, rotation, from, to, counter) => {
    let a0 = from;
    let a1 = to;
    if (counter) {
      while (a1 > a0) a1 -= Math.PI * 2;
    } else {
      while (a1 < a0) a1 += Math.PI * 2;
    }
    const sweep = a1 - a0;
    const steps = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const at = (angle) => {
      const x = Math.cos(angle) * rx;
      const y = Math.sin(angle) * ry;
      return [cx + x * cos - y * sin, cy + x * sin + y * cos];
    };
    const slope = (angle) => {
      const x = -Math.sin(angle) * rx;
      const y = Math.cos(angle) * ry;
      return [x * cos - y * sin, x * sin + y * cos];
    };
    const first = at(a0);
    if (path.length === 0) moveTo(first[0], first[1]);
    else lineTo(first[0], first[1]);
    for (let i = 0; i < steps; i++) {
      const s = a0 + (sweep * i) / steps;
      const e = a0 + (sweep * (i + 1)) / steps;
      const h = ((e - s) / (Math.PI / 2)) * KAPPA;
      const p0 = at(s);
      const p1 = at(e);
      const d0 = slope(s);
      const d1 = slope(e);
      curveTo(p0[0] + d0[0] * h, p0[1] + d0[1] * h, p1[0] - d1[0] * h, p1[1] - d1[1] * h, p1[0], p1[1]);
    }
  };

  /** One finished shape, in the style that was current when it was painted. */
  const emit = (d, kind) => {
    if (!d) return;
    const shape = { d, alpha: state.globalAlpha };
    if (state.clip) shape.clip = state.clip;
    if (kind === 'fill') shape.fill = String(state.fillStyle);
    else {
      shape.stroke = String(state.strokeStyle);
      shape.width = state.lineWidth;
      shape.join = state.lineJoin;
      shape.cap = state.lineCap;
      if (state.lineDash.length) shape.dash = state.lineDash.join(' ');
    }
    shapes.push(shape);
  };

  const define = (name, value) => Object.defineProperty(ctx, name, { value, configurable: true, writable: true });
  for (const name of ['fillStyle', 'strokeStyle', 'lineWidth', 'lineJoin', 'lineCap', 'globalAlpha']) {
    Object.defineProperty(ctx, name, {
      configurable: true,
      get: () => state[name],
      set: (v) => {
        state[name] = v;
      },
    });
  }

  define('save', () => {
    stack.push({ m: [...m], state: { ...state, lineDash: [...state.lineDash] } });
  });
  define('restore', () => {
    const top = stack.pop();
    if (!top) return;
    m = top.m;
    Object.assign(state, top.state);
  });
  define('translate', (x, y) => {
    m = [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  });
  define('scale', (x, y) => {
    m = [m[0] * x, m[1] * x, m[2] * y, m[3] * y, m[4], m[5]];
  });
  define('rotate', (a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    m = [m[0] * c + m[2] * s, m[1] * c + m[3] * s, m[0] * -s + m[2] * c, m[1] * -s + m[3] * c, m[4], m[5]];
  });
  define('transform', (a, b, c, d, e, f) => {
    m = [
      m[0] * a + m[2] * b,
      m[1] * a + m[3] * b,
      m[0] * c + m[2] * d,
      m[1] * c + m[3] * d,
      m[0] * e + m[2] * f + m[4],
      m[1] * e + m[3] * f + m[5],
    ];
  });
  define('setTransform', (a, b, c, d, e, f) => {
    m = [a, b, c, d, e, f];
  });
  define('resetTransform', () => {
    m = [1, 0, 0, 1, 0, 0];
  });

  define('beginPath', () => {
    path = [];
  });
  define('closePath', () => {
    if (path.length) {
      path.push('Z');
      cursor = start;
    }
  });
  define('moveTo', moveTo);
  define('lineTo', lineTo);
  define('bezierCurveTo', curveTo);
  define('quadraticCurveTo', (cx, cy, x, y) => {
    // Canvas quadratics, raised to cubics so one path syntax covers everything.
    const p0 = cursor;
    const c = point(cx, cy);
    const p = point(x, y);
    const c1 = [p0[0] + (2 / 3) * (c[0] - p0[0]), p0[1] + (2 / 3) * (c[1] - p0[1])];
    const c2 = [p[0] + (2 / 3) * (c[0] - p[0]), p[1] + (2 / 3) * (c[1] - p[1])];
    path.push(`C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p[0])} ${round(p[1])}`);
    cursor = p;
  });
  define('ellipse', (cx, cy, rx, ry, rotation, from, to, counter = false) =>
    arcTo(cx, cy, rx, ry, rotation, from, to, counter),
  );
  define('arc', (cx, cy, r, from, to, counter = false) => arcTo(cx, cy, r, r, 0, from, to, counter));
  define('rect', (x, y, w, h) => {
    moveTo(x, y);
    lineTo(x + w, y);
    lineTo(x + w, y + h);
    lineTo(x, y + h);
    path.push('Z');
  });
  define('roundRect', (x, y, w, h, radii = 0) => {
    const r = Math.min(Array.isArray(radii) ? radii[0] : radii, Math.abs(w) / 2, Math.abs(h) / 2);
    const k = r * KAPPA;
    moveTo(x + r, y);
    lineTo(x + w - r, y);
    curveTo(x + w - r + k, y, x + w, y + r - k, x + w, y + r);
    lineTo(x + w, y + h - r);
    curveTo(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h);
    lineTo(x + r, y + h);
    curveTo(x + r - k, y + h, x, y + h - r + k, x, y + h - r);
    lineTo(x, y + r);
    curveTo(x, y + r - k, x + r - k, y, x + r, y);
    path.push('Z');
  });

  define('fill', () => emit(path.join(''), 'fill'));
  define('stroke', () => emit(path.join(''), 'stroke'));
  define('fillRect', (x, y, w, h) => {
    const keep = path;
    path = [];
    ctx.rect(x, y, w, h);
    emit(path.join(''), 'fill');
    path = keep;
  });
  define('strokeRect', (x, y, w, h) => {
    const keep = path;
    path = [];
    ctx.rect(x, y, w, h);
    emit(path.join(''), 'stroke');
    path = keep;
  });
  define('setLineDash', (list) => {
    state.lineDash = [...list];
  });
  define('getLineDash', () => [...state.lineDash]);
  // The storm battery shades its housing through a clip. save/restore carry it
  // like any other bit of state, so nesting comes out right.
  define('clip', () => {
    state.clip = path.join('');
  });
  // Text never appears inside a figure, only around the studies' own
  // presentation. Dropping it silently would hide a shape, so it says so.
  define('fillText', () => {
    throw new Error('fillText() is not recorded: labels are not part of a figure');
  });
  define('strokeText', () => {
    throw new Error('strokeText() is not recorded');
  });
  define('drawImage', () => {
    throw new Error('drawImage() is not recorded');
  });
  define('createRadialGradient', () => {
    throw new Error('gradients are not recorded: figures use flat fills (docs/ART.md)');
  });
  define('createLinearGradient', () => {
    throw new Error('gradients are not recorded: figures use flat fills (docs/ART.md)');
  });

  return {
    /** Everything drawn since the last take, and clears the buffer. */
    take() {
      const out = shapes.splice(0, shapes.length);
      m = [1, 0, 0, 1, 0, 0];
      stack.length = 0;
      path = [];
      return out;
    },
  };
}
