#!/usr/bin/env python3
"""Draws the Koloss (GDD section 9, docs/ART.md) into the concept library.

The one figure on the field that is built rather than bred: a wide, angular war
machine on two tracks, with the ram that tears the swathe carried openly at the
front. It has to read as a rolling fortress next to the brood even as a
silhouette, so it is broad where the bosses are tall, and straight where they
are organic.

Like every creature it faces left, stands on y = 0, and is split into far track,
hull and near track so the tracks can grind in code (M4 step 2).

Usage: python3 tests/tools/add-koloss.py
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

GID = 'e-koloss'
SHEET = 'koloss.svg'

# Rust over iron: the machine is old and has been driven hard.
HULL = ('#7b6a57', '#5b4d3e', '#3a3128')
RUST = ('#9a5a34', '#7a4426', '#522d19')
TRACK = ('#4e4a44', '#38352f', '#22201d')


def track(y, h, shade):
    """One caterpillar track: a long slab with road wheels and a drive sprocket."""
    top, mid, dark = shade
    out = d.poly([(-56, y), (44, y), (44, y + h), (-56, y + h)], mid, 'k3')
    # Lit upper edge, so the track reads as a body and not as a bar.
    out += d.poly([(-56, y), (44, y), (44, y + 4), (-56, y + 4)], top, 'k15')
    for i in range(6):
        cx = -46 + i * 17
        out += d.circle(cx, y + h * 0.6, 5.2, dark, 'k15')
        out += d.circle(cx, y + h * 0.6, 1.8, d.INK, 'k1')
    # Drive sprocket at the rear, larger than the road wheels.
    out += d.circle(40, y + h * 0.5, 8, dark, 'k2')
    out += d.circle(40, y + h * 0.5, 3, d.INK, 'k1')
    return out


def ram():
    """The plough at the front: what tears the swathe, carried openly."""
    out = d.poly([(-42, -30), (-78, -12), (-78, -2), (-42, 0)], RUST[1], 'k3')
    out += d.poly([(-42, -30), (-78, -12), (-66, -12), (-42, -21)], RUST[0], 'k3')
    # Teeth along the leading edge.
    for i in range(3):
        y = -12 + i * 3.5
        out += d.poly([(-78, y), (-88, y + 1.8), (-78, y + 3.5)], RUST[0], 'k15')
    # Bracing back to the glacis.
    out += d.line(-46, -24, -34, -34, 5, d.INK)
    out += d.line(-46, -2, -34, -8, 5, d.INK)
    return out


def hull():
    """Body, bolted-on plates and the squat turret."""
    # Slab-sided hull with a sloped glacis towards the ram.
    out = d.poly([(-44, -30), (-34, -54), (34, -58), (46, -30), (46, -8), (-44, -8)], HULL[1], 'k3')
    out += d.poly([(-34, -54), (34, -58), (36, -50), (-32, -46)], HULL[0], 'k3')
    # Riveted band along the flank.
    for i in range(10):
        out += d.circle(-36 + i * 9, -16, 1.7, d.BONE, 'k1')
    # Armour plates bolted on at an angle (docs/ART.md).
    out += d.poly([(-26, -50), (-4, -54), (-2, -34), (-24, -30)], HULL[0], 'k2')
    out += d.poly([(2, -54), (26, -55), (28, -34), (4, -34)], HULL[2], 'k2')
    # Turret: low and wide, with a stubby barrel pointing the way it drives.
    out += d.poly([(-14, -58), (24, -60), (28, -76), (-10, -78)], HULL[1], 'k3')
    out += d.poly([(-14, -58), (24, -60), (26, -66), (-12, -64)], HULL[0], 'k15')
    out += d.bar(-12, -70, -44, -66, 7, d.IRON)
    out += d.circle(6, -70, 5, d.EYE, 'k2')
    out += d.circle(6, -70, 2, d.INK, 'k1')
    # Exhaust stacks at the back; the smoke itself is code.
    for x in (32, 41):
        out += d.cylinder(x, -76, 3.6, 16, d.IRON)
    return out


def koloss():
    """back (far track), body (hull and ram), front (near track)."""
    back = track(-26, 14, (TRACK[0], TRACK[1], TRACK[2]))
    body = ram() + hull()
    front = track(-16, 16, ('#5c5850', TRACK[0], TRACK[1]))
    return back, body, front


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
    mine = {GID} | {f'{GID}-{part}' for part in ('back', 'body', 'front')}
    defs = ''.join(raw for gid, (raw, _) in groups.items() if gid not in mine)

    back, body, front = koloss()
    new_groups = []
    uses = ''
    for part, markup in (('back', back), ('body', body), ('front', front)):
        new_groups.append(d.group(f'{GID}-{part}', markup))
        uses += f'<use href="#{GID}-{part}"></use>'
    new_groups.append(d.group(GID, uses))
    new_defs = defs + ''.join(new_groups)

    for path, (text, (start, end), _) in sources.items():
        path.write_text(text[:start] + new_defs + text[end:])

    sample = next(iter(sources.values()))[0]
    head = sample[: sample.index('<defs>')]
    (FOLDER / SHEET).write_text(f'{head}<defs>{new_defs}</defs><use href="#{GID}"></use></svg>')
    print(f'Koloss drawn, {len(files)} files updated, sheet {SHEET} written')


if __name__ == '__main__':
    main()
