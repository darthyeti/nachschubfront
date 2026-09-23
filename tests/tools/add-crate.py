#!/usr/bin/env python3
"""Lifts the ammunition crate out of the mortar artwork into its own symbol (M4 step 3).

The autocannon and the mortar bring their own sandbag ring, so the veteran rank
has no ring to add (decision M1b). They get a crate instead: `crate` sits on the
right front of the base like the mortar's own one, `crate-l` is the mirrored copy
for the mortar, whose right side is taken.

Usage: python3 tests/tools/add-crate.py
"""

import re
import sys
from pathlib import Path
from importlib import import_module

sys.path.insert(0, str(Path(__file__).resolve().parent))
split_towers = import_module('split-towers')

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / 'reference' / 'konzept' / 'stellungen'

# The wooden box inside t-mortar-front (the shells next to it stay with the mortar).
CRATE = [6, 7, 8]

POINTS = re.compile(r'points="([^"]+)"')


def mirror(raw):
    """Same box on the other side of the base."""

    def flip(m):
        pairs = []
        for pair in m.group(1).split():
            x, y = pair.split(',')
            pairs.append(f'{-float(x)},{y}')
        return 'points="' + ' '.join(pairs) + '"'

    return POINTS.sub(flip, raw)


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
if 'id="crate"' in defs:
    raise SystemExit('the crate symbols are already there')

groups = split_towers.top_level_groups(defs)
elements = split_towers.pick(split_towers.split_elements(groups['t-mortar-front'][1]), CRATE)
box = ''.join(elements)
new_defs = defs + f'<g id="crate">{box}</g>' + f'<g id="crate-l">{mirror(box)}</g>'

for path, (text, (start, end), _) in sources.items():
    path.write_text(text[:start] + new_defs + text[end:])
print(f'crate and crate-l added from {len(elements)} elements, {len(files)} files rewritten')
