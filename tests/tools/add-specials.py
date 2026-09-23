#!/usr/bin/env python3
"""Draws the six recipe emplacements (GDD section 8) into the concept library.

Each one needs a silhouette of its own that cannot be mistaken for the six
doctrines, even at the smallest zoom (docs/ART.md). They are built from the same
shapes as the hand-drawn sheets: isometric blocks, ink outlines, three shading
steps, and they stand on the shared base.

The symbols are appended to the shared <defs> of every file in
reference/konzept/stellungen/, and one sheet per emplacement is written so the
figure can be looked at on its own. Run tests/tools/import-sprites.py afterwards.

Usage: python3 tests/tools/add-specials.py
"""

import re
import sys
from pathlib import Path
from importlib import import_module

sys.path.insert(0, str(Path(__file__).resolve().parent))
d = import_module('draw')
split = import_module('split-towers')

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / 'reference' / 'konzept' / 'stellungen'


def purge_shrine():
    """Purge shrine (flame, psi, mortar): a wide brazier bowl on a stepped pedestal."""
    body = d.box(0, -8, 26, 14, d.CONCRETE)
    body += d.stripes(0, -8 + 13, 26, 5)
    body += d.box(0, -26, 15, 12, d.CONCRETE)
    # Four corner pillars carrying the bowl.
    for x, y in ((-15, -26), (15, -26), (0, -33), (0, -19)):
        body += d.box(x, y - 8, 4, 12, d.STEEL, 'k15')
    # The bowl: a heavy rim with a dark inside.
    body += d.ellipse(0, -44, 28, 13, '#5e5445', 'k3')
    body += d.ellipse(0, -46, 24, 10, '#2a211b', 'k2')
    body += d.path('M-28,-44 A28,13 0 0 0 28,-44', 'none', 'k3')
    # Nozzle nubs around the rim, so it reads as a burner even unlit.
    for x, y in ((-24, -49), (-13, -53), (0, -55), (13, -53), (24, -49)):
        body += d.poly([(x - 3, y), (x + 3, y), (x + 2, y - 7), (x - 2, y - 7)], '#77726b', 'k15')
    body += d.circle(-20, -18, 3, d.GOLD, 'k1')
    body += d.circle(20, -18, 3, d.GOLD, 'k1')
    return body


def storm_battery():
    """Storm battery (autocannon, laser, tesla): three barrels fanned out on a drum."""
    body = d.box(0, -6, 28, 12, d.IRON)
    body += d.stripes(0, -6 + 13, 28, 5)
    body += d.box(0, -22, 13, 16, d.STEEL)
    body += d.cylinder(0, -30, 13, 10, d.STEEL)
    # Ammunition drums behind the mount.
    body += d.cylinder(20, -20, 7, 12, d.BRICK, 'k15')
    return body


def storm_gun():
    """The fanned barrels; they turn with the target."""
    gun = ''
    # Three barrels from the mount, spread like a hand of cards.
    for dy, length in ((-14, 46), (0, 50), (12, 44)):
        gun += d.bar(-4, -30, -4 - length, -30 + dy, 6, d.STEEL)
    gun += d.ellipse(-4, -30, 8, 11, '#48443f', 'k2')
    gun += d.circle(-4, -30, 3, '#2e2b28', 'k1')
    return gun


def ember_cauldron():
    """Ember cauldron (flame, tesla, autocannon): a squat kettle on three legs."""
    body = ''
    # Legs first, they carry the kettle.
    for x0, x1 in ((-20, -26), (0, 0), (20, 26)):
        body += d.line(x0, -18, x1, 2, 7, d.INK)
        body += d.line(x0, -18, x1, 2, 3.5, '#48443f')
    body += d.path('M-30,-34 A30,20 0 0 0 30,-34 Z', '#5e3826', 'k3')
    body += d.path('M-30,-34 A30,20 0 0 0 30,-34', 'none', 'k3')
    body += d.ellipse(0, -34, 30, 12, '#834f36', 'k3')
    body += d.ellipse(0, -35, 24, 9, '#2a211b', 'k2')
    # Rivet band and hooks for the chains.
    for x in (-24, -12, 0, 12, 24):
        body += d.circle(x, -28, 2, '#a2684a', 'k1')
    body += d.path('M-30,-36 C-40,-44 -38,-54 -28,-56', 'none', 'k2')
    body += d.path('M30,-36 C40,-44 38,-54 28,-56', 'none', 'k2')
    body += d.bar(-28, -56, 28, -56, 4, d.STEEL)
    return body


def siege_mortar():
    """Siege mortar (mortar, laser, autocannon): a huge tube on a braced carriage."""
    body = d.box(0, -4, 30, 10, d.CONCRETE)
    body += d.stripes(0, -4 + 15, 30, 5)
    # Carriage: a trapezoid block with two wheels.
    body += d.poly([(-20, -14), (20, -14), (26, 4), (-26, 4)], '#5e5445', 'k3')
    body += d.poly([(-20, -14), (20, -14), (18, -9), (-18, -9)], '#8a7d6a', 'k2')
    body += d.ellipse(-22, 0, 9, 9, '#48443f', 'k2')
    body += d.ellipse(22, 0, 9, 9, '#48443f', 'k2')
    body += d.circle(-22, 0, 3, '#a8a195', 'k15')
    body += d.circle(22, 0, 3, '#a8a195', 'k15')
    return body


def siege_gun():
    """The oversized tube; it leans towards its target."""
    gun = d.bar(2, -12, -24, -84, 22, d.STEEL)
    gun += d.ellipse(-24, -84, 12, 7, '#1a1410', 'k2')
    gun += d.ellipse(-24, -84, 8, 4.5, '#2e2b28', 'k1')
    # Two reinforcing rings along the tube.
    gun += d.line(-4, -30, 6, -26, 26, '#48443f', 'butt')
    gun += d.line(-14, -58, -4, -54, 24, '#48443f', 'butt')
    return gun


def thunder_tower():
    """Thunder tower (tesla, psi, laser): a lattice pylon with a crown of rods."""
    body = d.box(0, -6, 24, 12, d.IRON)
    body += d.stripes(0, -6 + 11, 24, 5)
    # Four legs meeting under the crown, with cross braces.
    legs = ((-18, -8, -7, -92), (18, -8, 7, -92), (0, 1, 0, -92), (0, -17, 0, -92))
    for x0, y0, x1, y1 in legs:
        body += d.line(x0, y0, x1, y1, 7, d.INK)
        body += d.line(x0, y0, x1, y1, 3.5, '#4a4640')
    for y, w in ((-30, 14), (-54, 10), (-76, 7)):
        body += d.line(-w - 2, y, w + 2, y - 4, 5, d.INK)
        body += d.line(-w - 2, y, w + 2, y - 4, 2.2, '#6a655e')
        body += d.line(-w - 2, y - 4, w + 2, y, 5, d.INK)
        body += d.line(-w - 2, y - 4, w + 2, y, 2.2, '#6a655e')
    # Crown: a ring with rods and a copper heart.
    body += d.ellipse(0, -96, 22, 9, '#4a4640', 'k3')
    for x, y in ((-20, -98), (-11, -103), (0, -105), (11, -103), (20, -98)):
        body += d.line(x, y, x, y - 16, 5, d.INK)
        body += d.line(x, y, x, y - 16, 2.4, '#a8a195')
        body += d.circle(x, y - 18, 2.6, '#bff2ff', 'k1')
    body += d.ellipse(0, -100, 11, 8, '#c9713f', 'k2')
    body += d.circle(0, -104, 5, '#3fa8d8', 'k2')
    return body


def soulfire_obelisk():
    """Soulfire obelisk (psi, flame, tesla): a tapering monolith with a burning skull."""
    body = d.box(0, -8, 22, 14, d.CONCRETE)
    body += d.stripes(0, -8 + 11, 22, 5)
    # Two faces of the shaft, tapering towards the top.
    body += d.poly([(-14, -22), (0, -15), (0, -118), (-5, -122)], '#6a5d4e', 'k3')
    body += d.poly([(0, -15), (14, -22), (5, -122), (0, -118)], '#4b4238', 'k3')
    body += d.poly([(0, -122), (5, -122), (0, -136), (-5, -122)], '#8d7f6b', 'k2')
    # Carved bands.
    for y in (-40, -62, -84):
        body += d.line(-12, y, 12, y - 5, 3, '#2a211b', 'butt')
    # Skull in a niche, the mark of the doctrine.
    body += d.poly([(-8, -96), (8, -96), (8, -108), (0, -113), (-8, -108)], '#2a211b', 'k2')
    body += d.ellipse(0, -104, 5, 5.5, d.BONE, 'k15')
    body += d.circle(-2, -105, 1.4, d.INK, 'k1')
    body += d.circle(2, -105, 1.4, d.INK, 'k1')
    # Warp shards floating beside the shaft.
    body += d.poly([(-22, -70), (-17, -64), (-22, -56), (-27, -64)], '#9a6ae0', 'k15')
    body += d.poly([(22, -88), (26, -83), (22, -76), (18, -83)], '#c9a8ff', 'k15')
    return body


SPECIALS = {
    't-purge': (purge_shrine(), None),
    't-storm': (storm_battery(), storm_gun()),
    't-ember': (ember_cauldron(), None),
    't-siege': (siege_mortar(), siege_gun()),
    't-thunder': (thunder_tower(), None),
    't-obelisk': (soulfire_obelisk(), None),
}

# One sheet per emplacement, like the hand-drawn ones.
SHEETS = {
    't-purge': 'reinigungsschrein.svg',
    't-storm': 'sturmbatterie.svg',
    't-ember': 'glutkessel.svg',
    't-siege': 'belagerungsmoerser.svg',
    't-thunder': 'gewitterturm.svg',
    't-obelisk': 'seelenfeuer-obelisk.svg',
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
    mine = set([f'{gid}-{part}' for gid in SPECIALS for part in ('back', 'gun')] + list(SPECIALS))
    defs = ''.join(raw for gid, (raw, _) in groups.items() if gid not in mine)

    new_groups = []
    for gid, (back, gun) in SPECIALS.items():
        new_groups.append(d.group(f'{gid}-back', back))
        uses = f'<use href="#base"></use><use href="#{gid}-back"></use>'
        if gun:
            new_groups.append(d.group(f'{gid}-gun', gun))
            uses += f'<use href="#{gid}-gun"></use>'
        new_groups.append(d.group(gid, uses))
    new_defs = defs + ''.join(new_groups)

    for path, (text, (start, end), _) in sources.items():
        path.write_text(text[:start] + new_defs + text[end:])

    # A sheet per emplacement: same document, a different figure on show.
    sample = next(iter(sources.values()))[0]
    head = sample[: sample.index('<defs>')]
    for gid, name in SHEETS.items():
        (FOLDER / name).write_text(f'{head}<defs>{new_defs}</defs><use href="#{gid}"></use></svg>')

    print(f'{len(SPECIALS)} emplacements added, {len(files)} files updated, {len(SHEETS)} sheets written')


if __name__ == '__main__':
    main()
