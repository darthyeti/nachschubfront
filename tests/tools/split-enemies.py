#!/usr/bin/env python3
"""One-off surgery on the concept art of the brood (M4 step 2).

Splits every creature into the parts the game animates (docs/ART.md: static parts
from the SVG, movement in code):

    e-<name>-back    limbs behind the body (legs, far wings)
    e-<name>-body    everything that does not move on its own
    e-<name>-front   limbs in front of the body (legs, near wings)

The e-<name> wrapper stays: it is what the concept sheets show, and the game
still draws it as one piece at the smallest zoom levels.

Also prints the pivot of each limb group (the average of the hips), which goes
into src/render/sprites/manifest.js.

Usage: python3 tests/tools/split-enemies.py
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from importlib import import_module

split_towers = import_module('split-towers')
split_elements = split_towers.split_elements
top_level_groups = split_towers.top_level_groups

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / 'reference' / 'konzept' / 'gegner'

# Child indices per creature, inclusive ranges. The warp seer is left whole:
# it hovers, and its arms sit between the tentacles and the body.
PLAN = {
    'e-swarm': {'back': [(0, 8)], 'body': [(9, 25)], 'front': [(26, 34)]},
    'e-mutant': {'back': [(0, 5)], 'body': [(6, 30)], 'front': [(31, 36)]},
    'e-brute': {'back': [(0, 5)], 'body': [(6, 27)], 'front': [(28, 33)]},
    'e-burst': {'back': [(0, 8)], 'body': [(9, 28)], 'front': [(29, 37)]},
    # The healer's ground aura (0) stays with the body, in front of the far legs.
    'e-heal': {'back': [(1, 6)], 'body': [0, (7, 24)], 'front': [(25, 30)]},
    # The flyer's wings: far pair with the veins, near pair on top.
    'e-flyer': {'back': [(0, 2)], 'body': [(3, 25)], 'front': [(26, 27)]},
}

POINTS = re.compile(r'points="([-\d.]+),([-\d.]+)')


def pivot_of(elements):
    """Average of the first point of every polyline: where the limbs meet the body."""
    starts = []
    for raw in elements:
        m = POINTS.search(raw)
        if m and raw.startswith('<polyline'):
            starts.append((float(m.group(1)), float(m.group(2))))
    if not starts:
        return None
    # Each limb is drawn twice (ink and fill), so identical points collapse.
    unique = sorted(set(starts))
    x = sum(p[0] for p in unique) / len(unique)
    y = sum(p[1] for p in unique) / len(unique)
    return (round(x, 1), round(y, 1))


files = sorted(FOLDER.glob('*.svg'))
sources = {}
for path in files:
    text = path.read_text()
    m = re.search(r'<defs>(.*?)</defs>', text, re.S)
    sources[path] = (text, m.span(1), m.group(1))

defs_texts = {d for (_, _, d) in sources.values()}
if len(defs_texts) != 1:
    raise SystemExit('the concept files no longer share one symbol library')
defs = defs_texts.pop()

groups = top_level_groups(defs)
children = {gid: split_elements(inner) for gid, (_, inner) in groups.items()}

kept = [raw for gid, (raw, _) in groups.items() if gid not in PLAN]
new_groups = []
for name, plan in PLAN.items():
    src = children[name]
    total = 0
    uses = []
    for part in ('back', 'body', 'front'):
        elements = split_towers.pick(src, plan[part])
        total += len(elements)
        new_groups.append(f'<g id="{name}-{part}">{"".join(elements)}</g>')
        uses.append(f'<use href="#{name}-{part}"></use>')
        if part != 'body':
            print(f'{name}-{part}: {len(elements)} elements, pivot {pivot_of(elements)}')
    if total != len(src):
        raise SystemExit(f'{name}: {len(src) - total} children unaccounted for')
    new_groups.append(f'<g id="{name}">{"".join(uses)}</g>')

new_defs = ''.join(kept + new_groups)
for path, (text, (start, end), _) in sources.items():
    path.write_text(text[:start] + new_defs + text[end:])
print(f'{len(files)} files rewritten, defs {len(defs)} -> {len(new_defs)} characters')
