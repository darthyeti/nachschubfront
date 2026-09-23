#!/usr/bin/env python3
"""Small drawing helpers for the concept art generators (M4 step 4).

The concept SVGs are already projected: x runs across the screen, y downwards,
and an isometric diamond is twice as wide as it is high. Everything here emits
the same markup style as the hand-drawn sheets: flat colour plus an ink outline
through the shared classes k3 / k2 / k15 / k1.
"""

# Palette from docs/ART.md and reference/stiltest.html.
INK = '#1a1410'
STEEL = ('#a8a195', '#77726b', '#48443f')
CONCRETE = ('#b3a58d', '#8a7d6a', '#5e5445')
IRON = ('#6a655e', '#4a4640', '#2e2b28')
BRICK = ('#a2684a', '#834f36', '#5e3826')
BONE = '#d8c9a8'
GOLD = '#f2c14e'
CHITIN = ('#7a6048', '#5f4a38', '#3e3026')
PLATE = ('#6e4630', '#553626', '#3a241a')
FLESH = '#8a2e26'
TOXIC = ('#c8ec7a', '#8fbf3a', '#5f8a2a')
WARP = ('#c9a8ff', '#9a6ae0', '#5a3c78')
EYE = '#e0a030'


def n(v):
    """Numbers short and stable in the output."""
    return f'{round(v, 1):g}'


def poly(points, fill, cls='k3', extra=''):
    pts = ' '.join(f'{n(x)},{n(y)}' for x, y in points)
    return f'<polygon class="{cls}" points="{pts}" fill="{fill}"{extra}></polygon>'


def path(d, fill='none', cls='k2', extra=''):
    return f'<path class="{cls}" d="{d}" fill="{fill}"{extra}></path>'


def line(x0, y0, x1, y1, width, colour, cap='round'):
    return (
        f'<line x1="{n(x0)}" y1="{n(y0)}" x2="{n(x1)}" y2="{n(y1)}" '
        f'stroke="{colour}" stroke-width="{n(width)}" stroke-linecap="{cap}"></line>'
    )


def bar(x0, y0, x1, y1, width, colours):
    """A thick ink-outlined bar with a highlight, like the barrels in the art."""
    light, mid, _dark = colours
    return (
        line(x0, y0, x1, y1, width + 4, INK)
        + line(x0, y0, x1, y1, width, mid)
        + line(x0, y0 - width * 0.25, x1, y1 - width * 0.25, max(1.2, width * 0.28), light)
    )


def ellipse(cx, cy, rx, ry, fill, cls='k2', extra=''):
    return (
        f'<ellipse class="{cls}" cx="{n(cx)}" cy="{n(cy)}" rx="{n(rx)}" ry="{n(ry)}" '
        f'fill="{fill}"{extra}></ellipse>'
    )


def circle(cx, cy, r, fill, cls='k2', extra=''):
    return f'<circle class="{cls}" cx="{n(cx)}" cy="{n(cy)}" r="{n(r)}" fill="{fill}"{extra}></circle>'


def box(cx, cy, w, h, colours, cls='k3'):
    """Isometric box: (cx, cy) is the centre of the top face, w its half-width,
    h the height down to the ground. The top diamond is twice as wide as high."""
    light, mid, dark = colours
    half = w / 2
    top = poly([(cx, cy - half), (cx + w, cy), (cx, cy + half), (cx - w, cy)], light, cls)
    left = poly([(cx - w, cy), (cx, cy + half), (cx, cy + half + h), (cx - w, cy + h)], mid, cls)
    right = poly([(cx, cy + half), (cx + w, cy), (cx + w, cy + h), (cx, cy + half + h)], dark, cls)
    return top + left + right


def cylinder(cx, cy, r, h, colours, cls='k2'):
    """Upright cylinder with an elliptical lid; (cx, cy) is the centre of the lid."""
    light, mid, dark = colours
    body = path(
        f'M{n(cx - r)},{n(cy)} L{n(cx - r)},{n(cy + h)} '
        f'A{n(r)},{n(r / 2)} 0 0 0 {n(cx + r)},{n(cy + h)} L{n(cx + r)},{n(cy)} Z',
        mid,
        cls,
    )
    shade = path(
        f'M{n(cx + r * 0.3)},{n(cy)} L{n(cx + r * 0.3)},{n(cy + h)} '
        f'A{n(r)},{n(r / 2)} 0 0 0 {n(cx + r)},{n(cy + h)} L{n(cx + r)},{n(cy)} Z',
        dark,
        'k1',
    )
    return body + shade + ellipse(cx, cy, r, r / 2, light, cls)


def stripes(cx, cy, w, h):
    """Hazard band on the front of a base, using the shared pattern."""
    return poly(
        [(cx - w, cy), (cx, cy + w / 2), (cx, cy + w / 2 + h), (cx - w, cy + h)],
        'url(#haz)',
        'k1',
    )


def group(gid, body):
    return f'<g id="{gid}">{body}</g>'
