#!/usr/bin/env python3
"""One-off correction of the rank badges from update 4 (M4d step 3).

Every badge is a hexagonal plaque with four star slots, of which the rank's
number are lit. The four slots sit at x -27, -13.5, 0 and 13.5, so the row is
both wider than the plaque and pushed to the left: at legend rank the outer
star hangs out over the hexagon's edge.

This tucks the row in without redrawing it — the four stars are wrapped in one
transform that shrinks them and centres the row on the plaque. The hexagon,
the colours and which stars are lit stay exactly as drawn.

Approved on 24.09.2026 as part of the M4d plan.

Usage: python3 tests/tools/fit-badges.py
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# The badge library is carried by both folders; both are corrected.
FOLDERS = [ROOT / 'reference' / 'konzept' / 'ui', ROOT / 'reference' / 'konzept' / 'spezialstellungen']

# Shrink the row to fit between the hexagon's flanks (inner half width about 22
# SVG units), then slide it right so that it is centred on the plaque.
TRANSFORM = 'translate(5.3,0) scale(0.78)'

BADGE = re.compile(r'(<g id="badge-\d"><g>)(.*?)(</g></g>)', re.S)
POLYGON = re.compile(r'<polygon\b.*?</polygon>', re.S)


def fit(match):
    head, body, tail = match.groups()
    parts = POLYGON.findall(body)
    if len(parts) != 5:
        raise SystemExit(f'expected a hexagon and four stars, found {len(parts)}')
    plaque, *stars = parts
    return f'{head}{plaque}<g transform="{TRANSFORM}">{"".join(stars)}</g>{tail}'


def main():
    touched = 0
    for folder in FOLDERS:
        for path in sorted(folder.glob('*.svg')):
            text = path.read_text()
            if TRANSFORM in text:
                raise SystemExit(f'{path.name} already carries the correction')
            fixed, count = BADGE.subn(fit, text)
            if count != 5:
                raise SystemExit(f'{path.name}: found {count} badges, expected 5')
            path.write_text(fixed)
            touched += 1
    print(f'{touched} sheets corrected, star rows scaled and centred with {TRANSFORM}')


if __name__ == '__main__':
    main()
