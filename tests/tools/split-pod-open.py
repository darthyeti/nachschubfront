#!/usr/bin/env python3
"""One-off surgery on the opened supply pod of update 4 (M4d step 4).

M4c split the opened capsule into a core and four segments. Update 4 redraws
that state: the roof with the brake nozzles now stays on the standing core and
only the lower part of each segment folds outwards (docs/ART.md, "Geöffnet").
The new sheet is an export from before the M4c split, so it carries the whole
library in one piece again and `npm run sprites` refuses the folder.

This rebuilds the parts the game animates from the new design (`open-b`):

    pod-core        the standing core, now with the roof and its nozzles
    pod-petal-bl    the four folded-down segments, named by the direction they
    pod-petal-br    fall in: back-left, back-right, front-right, front-left
    pod-petal-fr
    pod-petal-fl

Dropped, because they carry the doctrine colour and are drawn in code: the
ground shadow, the glow around the core and the light column to the hologram.

The closed capsule is untouched. `open-a` and `open-c` are the two discarded
designs and are kept next to `pod-a` and `pod-c`; the `pod-open` wrapper is
rebuilt from the parts, so the concept sheet still renders on its own.

Also prints each segment's hinge for src/render/sprites/manifest.js.

Usage: python3 tests/tools/split-pod-open.py
"""

import re
import sys
from pathlib import Path
from importlib import import_module

sys.path.insert(0, str(Path(__file__).resolve().parent))
split_towers = import_module('split-towers')
split_pod = import_module('split-pod')
split_elements = split_towers.split_elements
top_level_groups = split_towers.top_level_groups
pick = split_towers.pick
NUMBER = split_pod.NUMBER

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / 'reference' / 'konzept' / 'kapsel'

# The sheet that still carries the split library from M4c, and the new design.
SPLIT_SOURCE = 'kapsel-geschlossen.svg'
UPDATE_SOURCE = 'kapsel-geoeffnet.svg'
DESIGN = 'open-b'

# Which children of open-b become which part. The light pool at the foot is
# drawn last, over the segments, so it closes the core's list.
PLAN = {
    'pod-petal-bl': [(1, 3)],
    'pod-petal-br': [(4, 6)],
    'pod-core': [(8, 15), 23],
    'pod-petal-fr': [(17, 19)],
    'pod-petal-fl': [(20, 22)],
}

# Ground shadow, the glow around the core and the light column: code draws these.
DROP = [0, 7, 16]

# Back to front, the order open-b itself is drawn in.
WRAPPER = ['pod-petal-bl', 'pod-petal-br', 'pod-core', 'pod-petal-fr', 'pod-petal-fl']


def hinge(markup):
    """Midpoint of the polygon edge nearest the origin: where the segment folds.

    M4c took the midpoint between the two corners nearest the origin, which
    happened to name the same edge on the old, larger segments. The segments of
    update 4 are smaller, and there the two nearest corners are the ends of the
    short edge beside the fold, so the edge itself is measured here.
    """
    points_attr = re.search(r'points="([^"]+)"', markup)
    if not points_attr:
        return None
    values = [float(v) for v in NUMBER.findall(points_attr.group(1))]
    points = list(zip(values[0::2], values[1::2]))
    edges = zip(points, points[1:] + points[:1])
    mids = [((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) for a, b in edges]
    near = min(mids, key=lambda m: m[0] ** 2 + m[1] ** 2)
    return (round(near[0], 1), round(near[1], 1))


def read_defs(path):
    text = path.read_text()
    m = re.search(r'<defs>(.*?)</defs>', text, re.S)
    if not m:
        raise SystemExit(f'{path.name}: no <defs>')
    return text, m.span(1), m.group(1)


def main():
    files = sorted(FOLDER.glob('*.svg'))
    _, _, split_defs = read_defs(FOLDER / SPLIT_SOURCE)
    _, _, update_defs = read_defs(FOLDER / UPDATE_SOURCE)

    old = top_level_groups(split_defs)
    new = top_level_groups(update_defs)
    for gid in ('pod-shell', 'pod-core', 'pod-open'):
        if gid not in old:
            raise SystemExit(f'{SPLIT_SOURCE} is missing #{gid} — is it still the split sheet?')
    if DESIGN not in new:
        raise SystemExit(f'{UPDATE_SOURCE} is missing #{DESIGN} — has this tool already run?')

    children = split_elements(new[DESIGN][1])
    parts = {}
    used = []
    report = []
    for name, take in PLAN.items():
        elements = pick(children, take)
        parts[name] = f'<g id="{name}">{"".join(elements)}</g>'
        used.extend(elements)
        spot = hinge(elements[0]) if name.startswith('pod-petal-') else None
        report.append(f'{name}: {len(elements)} elements' + (f', hinge {spot[0]}, {spot[1]}' if spot else ''))
    used.extend(pick(children, DROP))
    if len(used) != len(children):
        raise SystemExit(f'{DESIGN}: {len(children) - len(used)} children unaccounted for')

    uses = ''.join(f'<use href="#{p}"></use>' for p in WRAPPER)
    parts['pod-open'] = f'<g id="pod-open">{uses}</g>'

    # The library keeps the order of the split sheet; the two discarded designs
    # of the new sheet go in at the end, next to pod-a and pod-c.
    merged = [parts.pop(gid, raw) for gid, (raw, _) in old.items()]
    if parts:
        raise SystemExit(f'nothing to replace for {", ".join(parts)}')
    merged.extend(new[gid][0] for gid in ('open-a', 'open-c') if gid in new)
    new_defs = ''.join(merged)

    shown = {UPDATE_SOURCE: 'pod-open'}
    for path in files:
        text, (start, end), _ = read_defs(path)
        text = text[:start] + new_defs + text[end:]
        wanted = shown.get(path.name)
        if wanted:
            text = re.sub(r'(</defs>.*?<use href=")#[^"]+("/>\s*</svg>)', rf'\g<1>#{wanted}\g<2>', text, flags=re.S)
        path.write_text(text)

    print('\n'.join(report))
    print(f'{len(files)} files rewritten, defs {len(split_defs)} -> {len(new_defs)} characters')


if __name__ == '__main__':
    main()
