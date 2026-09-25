#!/usr/bin/env python3
"""One-off surgery on the last four recipe emplacements of update 6 (M5c).

They arrive as whole figures in reference/konzept/spezialstellungen/, each one
a building of its own — the two-chassis idea of update 4 is off (docs/ART.md,
"Spezialstellungen"). This cuts them into the parts the game draws and gives
them the ids the game already uses, so nothing but the artwork changes:

    t-purge-back / -gun      the altar, and the psi splinter that hovers over it
    t-ember-back             the cauldron with its four electrodes
    t-siege-back / -gun / -front   carriage, the long tube with its scope,
                             and the sandbags and wheels in front of it
    t-thunder-back / -gun    the lattice mast, and the psi core above the coil

Dropped, because they are effects the code draws: every cast shadow, the fire
in the bowl and in the cauldron, the glow around each of them, the rings around
the psi parts, and the lightning around the thunder tower's core.

Like the two figures before them, each is drawn standing on open ground in the
sketch and is therefore lifted by the height of its own cast shadow, so its
foot lands on the shared socket's top face.

With this the six recipe emplacements are complete, so three things retire: the
placeholder figures from M4 in reference/konzept/stellungen/ with their sheets,
and the two bare chassis (`v-tank2`, `v-artillery2`) with theirs.

Usage: python3 tests/tools/split-shrines.py
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
SHRINES = ROOT / 'reference' / 'konzept' / 'spezialstellungen'
TOWERS = ROOT / 'reference' / 'konzept' / 'stellungen'

# The sheet the four raw figures come in on; the rest of the folder still
# carries the library as the last surgery left it.
SOURCE = 'gewitterturm.svg'
LIBRARY = 'sturmbatterie.svg'

# Which children of each figure become which part, in drawing order, and how far
# the figure is lifted so it stands on the socket instead of on open ground.
PLAN = {
    'v-reinigungsschrein': {
        'lift': 16,
        # 22/23 are the mortar tube let into the plinth; it is drawn last in the
        # sketch because it sits in the front face.
        'parts': {'t-purge-back': [(1, 14), 16, 22, 23], 't-purge-gun': [20]},
        'drop': [0, 15, (17, 19), 21],
        'wrapper': 't-purge',
    },
    'v-glutkessel': {
        'lift': 16,
        'parts': {'t-ember-back': [(1, 7), (12, 35)]},
        'drop': [0, (8, 11)],
        'wrapper': 't-ember',
    },
    'v-belagerungsmoerser': {
        'lift': 14,
        # The tube turns, so the sandbags split around it: the back half and the
        # carriage behind, the front half and the wheels in front.
        'parts': {
            't-siege-back': [(1, 9), (17, 19), 28, 29],
            # Every weapon in the library rests pointing left, and the renderer
            # mirrors the sprite when the target is on the right
            # (src/render/towerSprites.js). The sheet draws this tube pointing
            # right, so the part is flipped about the pivot, which is on x = 0.
            't-siege-gun': [(20, 27), 'mirror'],
            't-siege-front': [(10, 16), (30, 33)],
        },
        'drop': [0],
        'wrapper': 't-siege',
    },
    'v-gewitterturm': {
        'lift': 10,
        'parts': {'t-thunder-back': [(1, 12)], 't-thunder-gun': [14]},
        'drop': [0, 13, (15, 22)],
        'wrapper': 't-thunder',
    },
}

# Which sheet shows which figure once the library is shared again.
SHEETS = {
    'reinigungsschrein.svg': 't-purge',
    'sturmbatterie.svg': 't-storm',
    'glutkessel.svg': 't-ember',
    'belagerungsmoerser.svg': 't-siege',
    'gewitterturm.svg': 't-thunder',
    'seelenfeuer-obelisk.svg': 't-obelisk',
}

# The bare chassis of update 4 and the sheets that showed them.
CHASSIS = ['v-tank2', 'v-artillery2']
CHASSIS_SHEETS = ['kampfpanzer.svg', 'artilleriegeschuetz.svg']

# What the M4 placeholders leave behind in the emplacement library.
RETIRED = [
    't-purge', 't-purge-back',
    't-ember', 't-ember-back',
    't-siege', 't-siege-back', 't-siege-gun',
    't-thunder', 't-thunder-back',
]
RETIRED_SHEETS = ['reinigungsschrein.svg', 'glutkessel.svg', 'belagerungsmoerser.svg', 'gewitterturm.svg']


def read_defs(path):
    text = path.read_text()
    m = re.search(r'<defs>(.*?)</defs>', text, re.S)
    if not m:
        raise SystemExit(f'{path.name}: no <defs>')
    return text, m.span(1), m.group(1)


def write_sheet(path, defs, wrapper, lift=0):
    text, (start, end), _ = read_defs(path)
    text = text[:start] + defs + text[end:]
    text = re.sub(
        r'(</defs>).*?(</svg>)',
        rf'\g<1><use href="#base"></use><use href="#{wrapper}"></use>\g<2>',
        text,
        flags=re.S,
    )
    if lift:
        # The figure moved up by its own shadow and now stands on the socket,
        # which reaches further down than open ground did.
        def fit(m):
            x, y, w, h = (float(v) for v in m.group(1).split())
            # Down for the socket the figure now stands on, up because the sheet
            # was cut to the flames, which the code draws from here on.
            return f'viewBox="{x:g} {y - lift - 14:g} {w:g} {h + lift + 36:g}"'

        text = re.sub(r'viewBox="([^"]+)"', fit, text, count=1)
    path.write_text(text)


def main():
    library_text, _, library_defs = read_defs(SHRINES / LIBRARY)
    library = top_level_groups(library_defs)
    for gid in ('base', 't-storm', 't-obelisk'):
        if gid not in library:
            raise SystemExit(f'#{gid} is missing; run split-vehicles.py first')

    _, _, source_defs = read_defs(SHRINES / SOURCE)
    figures = top_level_groups(source_defs)
    for gid in PLAN:
        if gid not in figures:
            raise SystemExit(f'#{gid} is gone; has this tool already run?')

    new_parts = {}
    report = []
    for figure, plan in PLAN.items():
        children = split_elements(figures[figure][1])
        used = []
        for name, take in plan['parts'].items():
            mirror = 'mirror' in take
            elements = pick(children, [t for t in take if t != 'mirror'])
            used.extend(elements)
            body = ''.join(elements)
            if mirror:
                body = f'<g transform="scale(-1,1)">{body}</g>'
            body = f'<g transform="translate(0,-{plan["lift"]})">{body}</g>'
            new_parts[name] = f'<g id="{name}">{body}</g>'
            report.append(f'{name}: {len(elements)} elements, lifted {plan["lift"]}')
        used.extend(pick(children, plan['drop']))
        if len(used) != len(children):
            raise SystemExit(f'{figure}: {len(children) - len(used)} children unaccounted for')
        uses = ''.join(f'<use href="#{p}"></use>' for p in plan['parts'])
        new_parts[plan['wrapper']] = f'<g id="{plan["wrapper"]}">{uses}</g>'

    # The shared library: everything the previous surgery left, minus the two
    # bare chassis, plus the parts cut out of the four new figures.
    kept = [raw for gid, (raw, _) in library.items() if gid not in CHASSIS]
    merged = ''.join(kept + list(new_parts.values()))
    for name, wrapper in SHEETS.items():
        path = SHRINES / name
        if not path.exists():
            raise SystemExit(f'{name} is missing from {SHRINES}')
        lift = next((p['lift'] for p in PLAN.values() if p['wrapper'] == wrapper), 0)
        # Only the four new sheets still stand on open ground.
        write_sheet(path, merged, wrapper, lift if name in RETIRED_SHEETS else 0)
    for name in CHASSIS_SHEETS:
        (SHRINES / name).unlink()

    # The emplacement library loses the four placeholders these replace.
    tower_text, tower_span, tower_defs = read_defs(TOWERS / 'moerser.svg')
    tower_groups = top_level_groups(tower_defs)
    missing = [gid for gid in RETIRED if gid not in tower_groups]
    if missing:
        raise SystemExit(f'the placeholders are already gone ({", ".join(missing)})')
    slimmed = ''.join(raw for gid, (raw, _) in tower_groups.items() if gid not in RETIRED)
    for path in sorted(TOWERS.glob('*.svg')):
        if path.name in RETIRED_SHEETS:
            path.unlink()
            continue
        text, (start, end), _ = read_defs(path)
        path.write_text(text[:start] + slimmed + text[end:])

    print('\n'.join(report))
    print(f'retired from the emplacements: {", ".join(RETIRED)}')
    print(f'retired chassis: {", ".join(CHASSIS)}')
    print(
        f'{len(SHEETS)} recipe sheets rewritten with {len(kept) + len(new_parts)} symbols; '
        f'{len(RETIRED_SHEETS) + len(CHASSIS_SHEETS)} sheets deleted'
    )


if __name__ == '__main__':
    main()
