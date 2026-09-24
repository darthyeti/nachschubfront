#!/usr/bin/env python3
"""One-off surgery on the recipe emplacements of update 4 (M4d step 2).

The two finished recipe emplacements arrive as whole figures in
reference/konzept/spezialstellungen/. This cuts them into the parts the game
draws and gives them the ids the game already uses, so nothing but the artwork
changes (docs/ART.md, "Spezialstellungen"):

    t-storm-back     the flak vehicle: tracks, hull, turret, four barrels, boxes
    t-obelisk-back   the runed shaft on its block
    t-obelisk-gun    the psi eye, which hovers above it

Dropped, because they are effects the code draws: the cast shadow, the four
muzzle flashes and the flying casings of the battery, the flames at the foot of
the obelisk, its glow, its lightning and its ring.

Both figures are drawn standing on the ground in the sketch, while every
emplacement in the game stands on the shared socket. Each is therefore lifted
by the height of its own cast shadow, so its feet land on the socket's top face.

The old placeholder figures from M4 (`t-storm*`, `t-obelisk*`) leave the
library in reference/konzept/stellungen/, and their two sheets go with them;
the four recipes that are still placeholders keep theirs. `base` is copied into
the new folder's library so its sheets render with the socket like the others.

Usage: python3 tests/tools/split-vehicles.py
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
VEHICLES = ROOT / 'reference' / 'konzept' / 'spezialstellungen'
TOWERS = ROOT / 'reference' / 'konzept' / 'stellungen'

# Which children of each figure become which part, and how far the figure is
# lifted so that it stands on the socket instead of on open ground.
PLAN = {
    'v-sturmbatterie': {
        'lift': 16,
        'parts': {'t-storm-back': [(1, 59)]},
        'drop': [0, (60, 77)],
        'wrapper': 't-storm',
    },
    'v-obelisk': {
        'lift': 6,
        # 1-4 is the sketch's own wide plinth; the shared socket replaces it.
        'parts': {'t-obelisk-back': [(5, 7), (12, 30)], 't-obelisk-gun': [(39, 43)]},
        'drop': [0, (1, 4), (8, 11), (31, 38), 44],
        'wrapper': 't-obelisk',
    },
}

# What the old placeholders leave behind in the emplacement library.
RETIRED = ['t-storm', 't-storm-back', 't-storm-gun', 't-obelisk', 't-obelisk-back']
RETIRED_SHEETS = ['sturmbatterie.svg', 'seelenfeuer-obelisk.svg']


def read_defs(path):
    text = path.read_text()
    m = re.search(r'<defs>(.*?)</defs>', text, re.S)
    if not m:
        raise SystemExit(f'{path.name}: no <defs>')
    return text, m.span(1), m.group(1)


def write_defs(path, defs, shows=None):
    text, (start, end), _ = read_defs(path)
    text = text[:start] + defs + text[end:]
    if shows:
        text = re.sub(r'(</defs>).*?(</svg>)', rf'\g<1>{shows}\g<2>', text, flags=re.S)
    path.write_text(text)


def main():
    _, _, tower_defs = read_defs(TOWERS / 'moerser.svg')
    tower_groups = top_level_groups(tower_defs)
    if 'base' not in tower_groups:
        raise SystemExit('the emplacement library has no #base to share')
    missing = [gid for gid in RETIRED if gid not in tower_groups]
    if missing:
        raise SystemExit(f'the placeholders are already gone ({", ".join(missing)})')

    files = sorted(VEHICLES.glob('*.svg'))
    _, _, vehicle_defs = read_defs(files[0])
    groups = top_level_groups(vehicle_defs)
    for gid in PLAN:
        if gid not in groups:
            raise SystemExit(f'#{gid} is gone; has this tool already run?')

    new_parts = {}
    report = []
    for figure, plan in PLAN.items():
        children = split_elements(groups[figure][1])
        used = []
        for name, take in plan['parts'].items():
            elements = pick(children, take)
            used.extend(elements)
            body = f'<g transform="translate(0,-{plan["lift"]})">{"".join(elements)}</g>'
            new_parts[name] = f'<g id="{name}">{body}</g>'
            report.append(f'{name}: {len(elements)} elements, lifted {plan["lift"]}')
        used.extend(pick(children, plan['drop']))
        if len(used) != len(children):
            raise SystemExit(f'{figure}: {len(children) - len(used)} children unaccounted for')
        uses = ''.join(f'<use href="#{p}"></use>' for p in plan['parts'])
        new_parts[plan['wrapper']] = f'<g id="{plan["wrapper"]}">{uses}</g>'

    # The new library: everything that is not one of the two raw figures, then
    # the shared socket and the parts cut from them.
    kept = [raw for gid, (raw, _) in groups.items() if gid not in PLAN]
    merged = kept + [tower_groups['base'][0]] + list(new_parts.values())
    shows = {'sturmbatterie.svg': 't-storm', 'seelenfeuer-obelisk.svg': 't-obelisk'}
    for path in files:
        wrapper = shows.get(path.name)
        write_defs(
            path,
            ''.join(merged),
            f'<use href="#base"/><use href="#{wrapper}"/>' if wrapper else None,
        )

    # The emplacement library loses the placeholders these two replace.
    slimmed = ''.join(raw for gid, (raw, _) in tower_groups.items() if gid not in RETIRED)
    for path in sorted(TOWERS.glob('*.svg')):
        if path.name in RETIRED_SHEETS:
            path.unlink()
            continue
        write_defs(path, slimmed)

    print('\n'.join(report))
    print(f'retired from the emplacements: {", ".join(RETIRED)}')
    print(f'{len(files)} vehicle sheets rewritten, {len(merged)} symbols; {len(RETIRED_SHEETS)} placeholder sheets deleted')


if __name__ == '__main__':
    main()
