#!/usr/bin/env python3
"""Draws the five bosses (GDD section 9) into the concept library.

Until now each boss borrowed the figure of a related creature and was simply
drawn larger. They get their own silhouettes here, with the cues docs/ART.md
asks for: brood body and ring of legs, towering plate armour with a ram shield,
several shield bubbles and warp rifts, double wings with an ovipositor, and a
horned prince whose armour changes.

Like the brood, every boss faces left, stands with its feet on y = 0 (flyers
hover above it), and is split into far limbs, body and near limbs so the legs
walk and the wings beat (M4 step 2).

Usage: python3 tests/tools/add-bosses.py
"""

import re
import sys
from pathlib import Path
from importlib import import_module

sys.path.insert(0, str(Path(__file__).resolve().parent))
d = import_module('draw')
split = import_module('split-towers')

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / 'reference' / 'konzept' / 'gegner'


def leg(hip, knee, foot, width, colour):
    """A limb like the hand-drawn ones: ink line, colour line, joint dot."""
    pts = f'{d.n(hip[0])},{d.n(hip[1])} {d.n(knee[0])},{d.n(knee[1])} {d.n(foot[0])},{d.n(foot[1])}'
    return (
        f'<polyline points="{pts}" fill="none" stroke="{d.INK}" stroke-width="{d.n(width)}" '
        'stroke-linejoin="round" stroke-linecap="round"></polyline>'
        f'<polyline points="{pts}" fill="none" stroke="{colour}" stroke-width="{d.n(width * 0.55)}" '
        'stroke-linejoin="round" stroke-linecap="round"></polyline>'
        f'<circle cx="{d.n(knee[0])}" cy="{d.n(knee[1])}" r="{d.n(width * 0.25)}" fill="{d.BONE}" stroke="none"></circle>'
    )


def mandibles(x, y, size=1.0):
    """The jaws every creature of the brood carries."""
    s = size
    return (
        d.path(f'M{d.n(x)},{d.n(y)} Q{d.n(x - 11 * s)},{d.n(y - 1 * s)} {d.n(x - 9 * s)},{d.n(y + 8 * s)}',
               'none', 'k2', f' stroke="{d.INK}" stroke-width="{d.n(4.5 * s)}"')
        + d.path(f'M{d.n(x)},{d.n(y)} Q{d.n(x - 11 * s)},{d.n(y - 1 * s)} {d.n(x - 9 * s)},{d.n(y + 8 * s)}',
                 'none', 'k2', f' stroke="{d.BONE}" stroke-width="{d.n(2.2 * s)}"')
        + d.path(f'M{d.n(x)},{d.n(y + 4 * s)} Q{d.n(x - 8 * s)},{d.n(y + 6 * s)} {d.n(x - 5 * s)},{d.n(y + 12 * s)}',
                 'none', 'k2', f' stroke="{d.INK}" stroke-width="{d.n(4 * s)}"')
        + d.path(f'M{d.n(x)},{d.n(y + 4 * s)} Q{d.n(x - 8 * s)},{d.n(y + 6 * s)} {d.n(x - 5 * s)},{d.n(y + 12 * s)}',
                 'none', 'k2', f' stroke="{d.BONE}" stroke-width="{d.n(1.8 * s)}"')
    )


def eyes(x, y, count=3, colour=d.EYE):
    out = ''
    for i in range(count):
        out += (
            f'<circle cx="{d.n(x + i * 3.2)}" cy="{d.n(y + (0 if i % 2 else -1.6))}" r="1.4" '
            f'fill="{colour}" stroke="{d.INK}" stroke-width="0.6"></circle>'
        )
    return out


# ---------------------------------------------------------------- brood mother
def brood_mother():
    """Bloated brood body, a ring of legs, brood sacs glowing through the skin."""
    back = leg((-6, -34), (-26, -48), (-34, 0), 8, d.CHITIN[1])
    back += leg((6, -32), (16, -50), (22, 0), 8, d.CHITIN[1])
    back += leg((18, -30), (40, -44), (48, 0), 8, d.CHITIN[1])

    body = d.ellipse(14, -46, 42, 34, '#8fbf3a', 'k3')
    # Darker blotches and the brood shining through.
    body += d.path('M-4,-58 Q6,-74 20,-64 Q8,-52 -2,-52 Z', '#5f8a2a', 'k1', ' opacity=".55"')
    body += d.path('M24,-34 Q36,-46 46,-34 Q34,-26 26,-28 Z', '#5f8a2a', 'k1', ' opacity=".55"')
    for cx, cy, r in ((-2, -40, 5), (18, -70, 6), (36, -52, 5), (8, -28, 4), (30, -74, 4)):
        body += d.circle(cx, cy, r, '#c8ec7a', 'k1')
    # Chitin ribs across the sac.
    body += d.path('M-14,-62 Q14,-82 42,-60', 'none', 'k15', f' stroke="{d.BONE}" stroke-width="2.4"')
    body += d.path('M-18,-44 Q12,-60 46,-42', 'none', 'k15', f' stroke="{d.BONE}" stroke-width="2.4"')
    # Head and thorax on the left.
    body += d.ellipse(-22, -44, 14, 12, d.CHITIN[1], 'k3')
    body += d.poly([(-28, -52), (-48, -48), (-54, -36), (-30, -32)], d.CHITIN[0], 'k3')
    body += eyes(-46, -44)
    body += mandibles(-50, -38, 1.2)
    body += d.path('M-30,-54 Q-24,-64 -14,-62', 'none', 'k15', f' stroke="{d.BONE}" stroke-width="2"')

    front = leg((-10, -30), (-34, -40), (-44, 0), 8, d.CHITIN[0])
    front += leg((4, -26), (2, -44), (-2, 0), 8, d.CHITIN[0])
    front += leg((20, -26), (44, -36), (52, 0), 8, d.CHITIN[0])
    return back, body, front


# ------------------------------------------------------------ colossus breaker
def colossus_breaker():
    """A wall of plate on four legs, with a ram shield pushed out in front."""
    back = leg((14, -30), (32, -44), (40, 0), 10, d.CHITIN[1])
    back += leg((-18, -30), (-30, -44), (-38, 0), 10, d.CHITIN[1])

    body = d.path('M-40,-30 Q-40,-92 12,-100 Q58,-96 62,-36 Q54,-22 -34,-22 Z', d.PLATE[1], 'k3')
    body += d.path('M-34,-24 Q10,-15 60,-28 Q12,-28 -34,-32 Z', d.FLESH, 'k15')
    # Plate bands with bone ridges.
    for y0, y1 in ((-52, -56), (-38, -42), (-66, -70)):
        body += d.path(f'M-34,{y0} Q10,{y0 - 30} 58,{y1 + 4}', 'none', 'k3')
        body += d.path(f'M-32,{y0 - 3} Q10,{y0 - 33} 56,{y1 + 1}', 'none', 'k15',
                       f' stroke="{d.BONE}" stroke-width="2.6"')
    for x, y in ((-18, -82), (0, -94), (18, -96), (36, -88), (50, -74)):
        body += d.poly([(x, y), (x + 8, y + 2), (x + 1, y - 15)], d.BONE, 'k15')
    # Head, low between the shoulders.
    body += d.poly([(-34, -50), (-58, -44), (-66, -28), (-38, -24)], d.PLATE[0], 'k3')
    body += eyes(-58, -38)
    body += mandibles(-62, -32, 1.3)
    # Ram shield: the thing that makes the silhouette. A broad curved plate with
    # a boss in the middle and spikes along its edge.
    body += d.path('M-44,-70 Q-86,-58 -88,-14 Q-84,4 -58,0 Q-40,-18 -40,-40 Z', d.PLATE[0], 'k3')
    body += d.path('M-48,-62 Q-80,-50 -80,-14', 'none', 'k2', f' stroke="{d.BONE}" stroke-width="3"')
    body += d.path('M-44,-48 Q-74,-38 -74,-8', 'none', 'k15', f' stroke="{d.PLATE[2]}" stroke-width="2.4"')
    body += d.ellipse(-64, -34, 11, 13, d.BONE, 'k2')
    body += d.circle(-64, -34, 4, d.PLATE[2], 'k15')
    for x, y in ((-86, -50), (-90, -28), (-84, -6)):
        body += d.poly([(x, y), (x + 4, y + 7), (x - 14, y + 2)], d.BONE, 'k15')

    front = leg((22, -26), (46, -36), (54, 0), 10, d.CHITIN[0])
    front += leg((-10, -26), (-18, -38), (-24, 0), 10, d.CHITIN[0])
    return back, body, front


# ----------------------------------------------------------------- warp herald
def warp_herald():
    """Hovers in a nest of shield bubbles, torn open by warp rifts."""
    body = ''
    # Three bubbles at different sizes, the outer ones dashed.
    for rx, ry, cy, op in ((48, 46, -62, '.1'), (36, 35, -70, '.14'), (24, 25, -78, '.18')):
        body += (
            f'<ellipse cx="0" cy="{d.n(cy)}" rx="{d.n(rx)}" ry="{d.n(ry)}" fill="{d.WARP[1]}" '
            f'opacity="{op}" stroke="none"></ellipse>'
            f'<ellipse cx="0" cy="{d.n(cy)}" rx="{d.n(rx)}" ry="{d.n(ry)}" fill="none" stroke="{d.WARP[0]}" '
            'stroke-width="2" stroke-dasharray="8 5"></ellipse>'
        )
    # Warp rifts: jagged violet tears.
    for pts in (
        [(-50, -94), (-42, -86), (-52, -78), (-44, -68)],
        [(48, -56), (40, -48), (50, -42), (42, -32)],
        [(-12, -114), (-4, -106), (-14, -100)],
    ):
        line = ' '.join(f'{d.n(x)},{d.n(y)}' for x, y in pts)
        body += (
            f'<polyline points="{line}" fill="none" stroke="{d.INK}" stroke-width="6" stroke-linejoin="round"></polyline>'
            f'<polyline points="{line}" fill="none" stroke="{d.WARP[0]}" stroke-width="2.6" stroke-linejoin="round"></polyline>'
        )
    # Tentacles instead of legs; the herald never touches the ground.
    for x0, x1, x2 in ((-10, -16, -8), (0, 6, -2), (10, 18, 12)):
        body += d.path(f'M{d.n(x0)},{d.n(-56)} Q{d.n(x1)},{d.n(-40)} {d.n(x2)},{d.n(-22)}', 'none', 'k2',
                       f' stroke="{d.INK}" stroke-width="5"')
        body += d.path(f'M{d.n(x0)},{d.n(-56)} Q{d.n(x1)},{d.n(-40)} {d.n(x2)},{d.n(-22)}', 'none', 'k2',
                       f' stroke="{d.CHITIN[1]}" stroke-width="2.4"')
        body += f'<circle cx="{d.n(x2)}" cy="-22" r="2.4" fill="{d.WARP[1]}" stroke="none"></circle>'
    # Robed body and crowned head.
    # A heavy robe hanging over the tentacles.
    body += d.path('M-16,-84 Q-22,-46 -12,-32 Q0,-26 14,-32 Q22,-48 16,-84 Z', d.WARP[2], 'k3')
    body += d.path('M-8,-76 Q-12,-50 -6,-36', 'none', 'k15', f' stroke="{d.WARP[1]}" stroke-width="2.4"')
    body += d.path('M8,-76 Q12,-50 6,-36', 'none', 'k15', f' stroke="{d.WARP[1]}" stroke-width="2.4"')
    body += d.ellipse(0, -84, 16, 11, d.CHITIN[2], 'k3')
    body += d.ellipse(2, -100, 24, 19, d.WARP[2], 'k3')
    body += d.path('M-16,-106 Q-4,-114 6,-104 Q14,-96 24,-102', 'none', 'k2',
                   f' stroke="{d.WARP[0]}" stroke-width="2.4"')
    body += d.poly([(-18, -110), (2, -124), (24, -110), (2, -117)], d.BONE, 'k15')
    for x, y in ((-14, -116), (2, -126), (16, -118)):
        body += d.poly([(x, y), (x + 5, y + 3), (x + 1, y - 11)], d.BONE, 'k15')
    body += d.poly([(-16, -90), (-32, -88), (-30, -78), (-14, -80)], d.CHITIN[1], 'k2')
    body += d.circle(-24, -86, 3.4, '#d9c2ff', 'k1')
    body += d.circle(-17, -84, 2.4, '#d9c2ff', 'k1')
    return '', body, ''


# --------------------------------------------------------------- swarm queen
def swarm_queen():
    """Two pairs of wings, a long body and the ovipositor behind it."""

    def wing(x0, y0, tip, ctrl, alpha):
        return d.path(
            f'M{d.n(x0)},{d.n(y0)} Q{d.n(ctrl[0])},{d.n(ctrl[1])} {d.n(tip[0])},{d.n(tip[1])} '
            f'Q{d.n((x0 + tip[0]) / 2)},{d.n((y0 + tip[1]) / 2 + 14)} {d.n(x0)},{d.n(y0 + 8)} Z',
            f'rgba(216,201,168,{alpha})',
            'k15',
        )

    back = wing(4, -84, (74, -116), (44, -126), '.32')
    back += wing(-2, -82, (-64, -122), (-34, -128), '.32')
    back += wing(4, -74, (62, -60), (40, -78), '.28')
    back += d.path('M8,-84 L58,-112 M10,-80 L44,-96 M-4,-84 L-50,-116 M-4,-78 L-36,-100', 'none', 'k1',
                   f' stroke="{d.INK}" stroke-width="1.5"')

    body = ''
    # Legs dangling under the body.
    for hip, knee, foot in (((-6, -72), (-14, -60), (-8, -48)), ((4, -72), (10, -58), (4, -44)),
                            ((12, -70), (22, -58), (18, -46))):
        body += leg(hip, knee, foot, 6, d.CHITIN[1])
    # Segmented abdomen ending in the ovipositor.
    for i, (cx, cy, r) in enumerate(((16, -68, 9), (26, -60, 8), (36, -52, 7), (46, -44, 6), (54, -38, 5))):
        body += d.circle(cx, cy, r, d.CHITIN[1] if i % 2 else d.CHITIN[0], 'k2')
    body += d.path('M58,-36 Q76,-26 84,-6', 'none', 'k2', f' stroke="{d.INK}" stroke-width="7"')
    body += d.path('M58,-36 Q76,-26 84,-6', 'none', 'k2', f' stroke="{d.BONE}" stroke-width="3.4"')
    body += d.poly([(84, -6), (92, 6), (80, -2)], d.BONE, 'k15')
    body += d.path('M10,-74 Q18,-78 26,-72', 'none', 'k15', f' stroke="{d.BONE}" stroke-width="1.8"')
    # Thorax, head and crown.
    body += d.ellipse(0, -78, 12, 11, d.CHITIN[2], 'k3')
    body += d.poly([(-8, -86), (-26, -86), (-32, -74), (-8, -72)], d.CHITIN[1], 'k3')
    body += d.ellipse(-20, -82, 4.5, 3.2, d.EYE, 'k1')
    body += mandibles(-28, -78, 1.1)
    body += d.poly([(-16, -90), (-8, -88), (-14, -104)], d.BONE, 'k15')
    body += d.poly([(-4, -88), (4, -86), (-1, -102)], d.BONE, 'k15')

    front = wing(2, -78, (66, -96), (40, -108), '.5')
    front += wing(-4, -76, (-56, -102), (-30, -112), '.5')
    return back, body, front


# ----------------------------------------------------------------- demon prince
def demon_prince():
    """Tall, horned, two blades; his armour is the part that changes."""
    back = leg((6, -48), (22, -62), (28, 0), 9, d.CHITIN[1])
    back += leg((-8, -48), (-20, -64), (-26, 0), 9, d.CHITIN[1])
    back += d.path('M4,-70 Q40,-92 56,-56', 'none', 'k2', f' stroke="{d.INK}" stroke-width="6"')
    back += d.path('M4,-70 Q40,-92 56,-56', 'none', 'k2', f' stroke="{d.BONE}" stroke-width="2.6"')

    # Cloak behind the shoulders, so the figure reads wide at the top.
    body = d.path('M-10,-102 Q44,-94 56,-16 Q24,-30 8,-36 Q-6,-56 -12,-70 Z', d.CHITIN[2], 'k3')
    body += d.path('M0,-96 Q36,-84 46,-24', 'none', 'k15', f' stroke="{d.FLESH}" stroke-width="2.4"')
    body += d.path('M-6,-88 Q24,-76 34,-30', 'none', 'k1', f' stroke="{d.CHITIN[1]}" stroke-width="2"')
    # Torso in plate, with flesh showing between the plates.
    body += d.path('M-14,-50 Q-20,-88 -2,-102 Q20,-96 18,-60 Q10,-44 -14,-50 Z', d.PLATE[1], 'k3')
    body += d.path('M-10,-58 Q-2,-76 6,-60 Q0,-50 -10,-58 Z', d.FLESH, 'k1')
    for y in (-64, -78, -90):
        body += d.path(f'M-14,{y} Q0,{y - 8} 16,{y - 2}', 'none', 'k15', f' stroke="{d.BONE}" stroke-width="2.2"')
    # Shoulder guards with spikes.
    for sx, sy, flip in ((-16, -96, -1), (14, -92, 1)):
        body += d.ellipse(sx, sy, 12, 8, d.PLATE[0], 'k3')
        body += d.poly([(sx - 4 * flip, sy - 4), (sx + 4 * flip, sy - 2), (sx - 2 * flip, sy - 16)], d.BONE, 'k15')
    # Head: horns make the prince.
    body += d.ellipse(-10, -110, 11, 10, d.CHITIN[1], 'k3')
    body += d.poly([(-18, -116), (-10, -114), (-26, -136)], d.BONE, 'k15')
    body += d.poly([(-2, -116), (6, -114), (2, -138)], d.BONE, 'k15')
    body += d.poly([(-14, -120), (-8, -119), (-14, -130)], d.BONE, 'k15')
    body += d.circle(-15, -110, 2.6, '#ff6a4a', 'k1')
    body += d.circle(-9, -109, 2.2, '#ff6a4a', 'k1')
    body += mandibles(-20, -106, 1.0)
    return back, body, ''


def demon_prince_front():
    """The near arm with its blade, drawn over the body."""
    front = leg((10, -44), (30, -54), (36, 0), 9, d.CHITIN[0])
    front += leg((-4, -44), (-10, -58), (-14, 0), 9, d.CHITIN[0])
    front += d.path('M2,-88 Q-22,-76 -32,-54', 'none', 'k2', f' stroke="{d.INK}" stroke-width="9"')
    front += d.path('M2,-88 Q-22,-76 -32,-54', 'none', 'k2', f' stroke="{d.CHITIN[0]}" stroke-width="4.5"')
    # Blade: a guard, then a long curved edge.
    front += d.poly([(-38, -60), (-26, -56), (-28, -48), (-40, -52)], d.PLATE[1], 'k2')
    front += d.path('M-34,-56 Q-52,-44 -66,-16 Q-56,-26 -34,-46 Z', d.BONE, 'k2')
    front += d.path('M-36,-52 Q-52,-40 -62,-20', 'none', 'k1', f' stroke="{d.CHITIN[2]}" stroke-width="1.8"')
    return front


def lift(parts, dy):
    """Moves a whole figure up; flyers have to hover clear of their shadow."""
    return tuple(f'<g transform="translate(0,{d.n(dy)})">{p}</g>' if p else p for p in parts)


BOSSES = {
    'e-brood': brood_mother(),
    'e-colossus': colossus_breaker(),
    'e-herald': warp_herald(),
    # The queen flies: her whole figure sits above the ground line.
    'e-queen': lift(swarm_queen(), -22),
    'e-prince': (demon_prince()[0], demon_prince()[1], demon_prince_front()),
}

SHEETS = {
    'e-brood': 'brutmutter.svg',
    'e-colossus': 'kolossbrecher.svg',
    'e-herald': 'warp-herold.svg',
    'e-queen': 'schwarmkoenigin.svg',
    'e-prince': 'daemonenprinz.svg',
}


def main():
    files = sorted(FOLDER.glob('*.svg'))
    sources = {}
    for path in files:
        text = path.read_text()
        m = re.search(r'<defs>(.*?)</defs>', text, re.S)
        sources[path] = (text, m.span(1), m.group(1))

    defs_texts = {t for (_, _, t) in sources.values()}
    if len(defs_texts) != 1:
        raise SystemExit('the concept files no longer share one symbol library')
    defs = defs_texts.pop()
    # Running again replaces what was drawn last time instead of piling up.
    groups = split.top_level_groups(defs)
    mine = set([f'{gid}-{part}' for gid in BOSSES for part in ('back', 'body', 'front')] + list(BOSSES))
    defs = ''.join(raw for gid, (raw, _) in groups.items() if gid not in mine)

    new_groups = []
    for gid, (back, body, front) in BOSSES.items():
        uses = ''
        for part, markup in (('back', back), ('body', body), ('front', front)):
            # The herald hovers and has no limb groups; empty parts are skipped.
            if not markup:
                continue
            new_groups.append(d.group(f'{gid}-{part}', markup))
            uses += f'<use href="#{gid}-{part}"></use>'
        new_groups.append(d.group(gid, uses))
    new_defs = defs + ''.join(new_groups)

    for path, (text, (start, end), _) in sources.items():
        path.write_text(text[:start] + new_defs + text[end:])

    sample = next(iter(sources.values()))[0]
    head = sample[: sample.index('<defs>')]
    for gid, name in SHEETS.items():
        (FOLDER / name).write_text(f'{head}<defs>{new_defs}</defs><use href="#{gid}"></use></svg>')
    print(f'{len(BOSSES)} bosses added, {len(files)} files updated, {len(SHEETS)} sheets written')


if __name__ == '__main__':
    main()
