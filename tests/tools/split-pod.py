#!/usr/bin/env python3
"""One-off surgery on the concept art of the supply pod (M4c step 1).

Both files in reference/konzept/kapsel/ carry the same symbol library in <defs>.
The closed capsule stays one piece; the opened one is split into the parts the
game animates (docs/ART.md, "Nachschubkapsel"):

    pod-shell       the whole closed capsule
    pod-core        the inner frame that stays standing once it is open
    pod-petal-bl    the four wall segments in their open position, named by the
    pod-petal-br    direction they fall in: back-left, back-right,
    pod-petal-fr    front-right, front-left
    pod-petal-fl

Dropped, because they carry the doctrine colour and are drawn in code: the
ground shadow, the glow around the core and the light column to the hologram.
The same rule the emplacements follow since M4 (flame jets, lightning, glows).

The pod-b and pod-open wrappers stay, so the concept sheets still render.
pod-a and pod-c are the two discarded designs and are left untouched.

Also prints each segment's hinge, the midpoint of the edge it shares with the
core, which goes into src/render/sprites/manifest.js.

Usage: python3 tests/tools/split-pod.py
"""

import re
import sys
from pathlib import Path
from importlib import import_module

sys.path.insert(0, str(Path(__file__).resolve().parent))
split_towers = import_module('split-towers')
split_elements = split_towers.split_elements
top_level_groups = split_towers.top_level_groups
pick = split_towers.pick

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / 'reference' / 'konzept' / 'kapsel'

# Which child indices of the original group become which part.
PLAN = {
    'pod-shell': {'source': 'pod-b', 'take': [(1, 20)], 'drop': [0]},
    'pod-petal-bl': {'source': 'pod-open', 'take': [(1, 3)]},
    'pod-petal-br': {'source': 'pod-open', 'take': [(4, 6)]},
    'pod-core': {'source': 'pod-open', 'take': [(8, 10), 18]},
    'pod-petal-fr': {'source': 'pod-open', 'take': [(12, 14)]},
    'pod-petal-fl': {'source': 'pod-open', 'take': [(15, 17)]},
}

# Ground shadow, the glow around the core and the light column: code draws these.
OPEN_DROP = [0, 7, 11]

# Back to front, the order pod-open itself is drawn in.
WRAPPER = {
    'pod-b': ['pod-shell'],
    'pod-open': ['pod-petal-bl', 'pod-petal-br', 'pod-core', 'pod-petal-fr', 'pod-petal-fl'],
}

NUMBER = re.compile(r'-?\d+(?:\.\d+)?')


def hinge(markup):
    """Midpoint of the polygon edge closest to the origin: where the segment folds."""
    points_attr = re.search(r'points="([^"]+)"', markup)
    if not points_attr:
        return None
    values = [float(v) for v in NUMBER.findall(points_attr.group(1))]
    points = list(zip(values[0::2], values[1::2]))
    # The two corners nearest the core are the ones the segment turns around.
    near = sorted(points, key=lambda p: p[0] ** 2 + p[1] ** 2)[:2]
    return (round((near[0][0] + near[1][0]) / 2, 1), round((near[0][1] + near[1][1]) / 2, 1))


def main():
    files = sorted(FOLDER.glob('*.svg'))
    if not files:
        raise SystemExit(f'no SVGs in {FOLDER}')

    sources = {}
    for path in files:
        text = path.read_text()
        m = re.search(r'<defs>(.*?)</defs>', text, re.S)
        if not m:
            raise SystemExit(f'{path.name}: no <defs>')
        sources[path] = (text, m.span(1), m.group(1))

    defs_texts = {d for (_, _, d) in sources.values()}
    if len(defs_texts) != 1:
        raise SystemExit('the concept files no longer share one symbol library')
    defs = defs_texts.pop()

    groups = top_level_groups(defs)
    for gid in ('pod-b', 'pod-open'):
        if gid not in groups:
            raise SystemExit(f'#{gid} is gone; has the sheet already been split?')
    children = {gid: split_elements(inner) for gid, (_, inner) in groups.items()}

    # Everything that is not one of the two chosen designs stays as it is.
    kept = [raw for gid, (raw, _) in groups.items() if gid not in WRAPPER]

    new_groups = []
    report = []
    used = {gid: [] for gid in WRAPPER}
    for name, plan in PLAN.items():
        src = children[plan['source']]
        elements = pick(src, plan['take'])
        new_groups.append(f'<g id="{name}">{"".join(elements)}</g>')
        used[plan['source']].extend(elements)
        used[plan['source']].extend(pick(src, plan.get('drop', [])))
        spot = hinge(elements[0]) if name.startswith('pod-petal-') else None
        report.append(f'{name}: {len(elements)} elements' + (f', hinge {spot[0]}, {spot[1]}' if spot else ''))

    used['pod-open'].extend(pick(children['pod-open'], OPEN_DROP))
    for gid, taken in used.items():
        if len(taken) != len(children[gid]):
            raise SystemExit(f'{gid}: {len(children[gid]) - len(taken)} children unaccounted for')

    for gid, parts in WRAPPER.items():
        uses = ''.join(f'<use href="#{p}"></use>' for p in parts)
        new_groups.append(f'<g id="{gid}">{uses}</g>')

    new_defs = ''.join(kept + new_groups)
    for path, (text, (start, end), _) in sources.items():
        path.write_text(text[:start] + new_defs + text[end:])

    print('\n'.join(report))
    print(f'{len(files)} files rewritten, defs {len(defs)} -> {len(new_defs)} characters')


if __name__ == '__main__':
    main()
