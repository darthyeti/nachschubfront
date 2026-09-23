#!/usr/bin/env python3
"""One-off surgery on the concept art of the emplacements (M4 step 2).

Every file in reference/konzept/stellungen/ carries the same symbol library in
<defs>. This splits each doctrine's single group into the parts the game needs:

    t-<doctrine>-back   housing, mast, tanks: drawn behind the weapon
    t-<doctrine>-gun    the part that turns towards the target
    t-<doctrine>-front  what covers the weapon from the front (sandbags, crates)

and drops the effects that were drawn into the artwork (flame jet, muzzle arcs,
mortar smoke, glows, lightning). Those are animated in code from now on
(docs/ART.md, decision M1b).

The t-<doctrine> wrapper stays, so the concept sheets still render on their own.

Usage: python3 tests/tools/split-towers.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / 'reference' / 'konzept' / 'stellungen'

ELEMENT = re.compile(r'<(?P<tag>[a-zA-Z][\w-]*)\b[^>]*?(?P<selfclose>/?)>')


def split_elements(text):
    """Top-level elements of a group as raw strings (children are leaves here)."""
    out = []
    pos = 0
    while pos < len(text):
        m = ELEMENT.search(text, pos)
        if not m:
            break
        end = m.end()
        if not m.group('selfclose'):
            closing = f'</{m.group("tag")}>'
            if text.startswith(closing, end):
                end += len(closing)
            else:
                raise SystemExit(f'nested element in group: {text[m.start():m.start() + 80]}')
        out.append(text[m.start():end])
        pos = end
    rest = text[pos:].strip()
    if rest:
        raise SystemExit(f'leftover markup: {rest[:80]}')
    return out


def top_level_groups(defs):
    """id -> (raw element, inner text) for every top-level child of <defs>."""
    groups = {}
    pos = 0
    while True:
        start = defs.find('<', pos)
        if start < 0:
            break
        m = ELEMENT.match(defs, start)
        if not m:
            break
        tag = m.group('tag')
        closing = f'</{tag}>'
        depth = 1
        scan = m.end()
        while depth:
            nxt_open = defs.find(f'<{tag}', scan)
            nxt_close = defs.find(closing, scan)
            if nxt_close < 0:
                raise SystemExit(f'unclosed <{tag}>')
            if 0 <= nxt_open < nxt_close:
                depth += 1
                scan = nxt_open + 1
            else:
                depth -= 1
                scan = nxt_close + len(closing)
        raw = defs[start:scan]
        inner = raw[m.end() - start:-len(closing)]
        gid = re.search(r'id="([^"]+)"', m.group(0))
        groups[gid.group(1) if gid else f'#{len(groups)}'] = (raw, inner)
        pos = scan
    return groups


def pick(parts, spec):
    """spec is a list of indices and (from, to) ranges, both inclusive."""
    out = []
    for item in spec:
        if isinstance(item, tuple):
            out.extend(parts[item[0]:item[1] + 1])
        else:
            out.append(parts[item])
    return out


# Which child indices of the original group become which part.
# 'source' is the group the children come from, 'wrapper' the order of <use>.
PLAN = {
    'flame': {
        'source': 't-flame',
        'back': [(0, 10)],                     # bunker, hazard stripe, fuel tanks
        'gun': [(11, 14)],                     # nozzle arm
        'drop': [(15, 17)],                    # flame jet: code (render/weapons.js)
    },
    'ac': {
        'source': 'ac-core',
        'back': [(0, 9)],                      # hexagonal housing, ammo box and belt
        'gun': [(10, 22)],                     # three barrels and breech
        'drop': [(23, 24)],                    # muzzle arcs: code
        'front_source': 't-ac',
        'front': [3, 4],                       # two gold markers on the ring
        'wrapper': ['sb-back', 'back', 'gun', 'sb-front', 'front'],
    },
    'laser': {
        'source': 't-laser',
        'back': [(0, 12), (14, 17)],           # platform, mast, cells, yoke
        'gun': [(18, 34)],                     # beam gun with emitter
        'drop': [13],                          # red glow: code
    },
    'mortar': {
        'source': 't-mortar',
        'back': [(0, 10)],                     # pit, back sandbags, legs
        'gun': [(11, 14)],                     # tube
        'drop': [(15, 17)],                    # smoke puffs: code
        'front': [(18, 32)],                   # front sandbags, crate, shells
    },
    'psi': {
        'source': 't-psi',
        'back': [(0, 11)],                     # shrine
        'gun': [14, 15],                       # floating crystal
        'drop': [12, 13, 16],                  # aura and rings: code
    },
    'tesla': {
        'source': 't-tesla',
        'back': [(0, 16), (18, 19)],           # coil, insulators, sphere
        'drop': [17, (20, 25)],                # glow and lightning: code
    },
}

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
children = {gid: split_elements(inner) for gid, (_, inner) in groups.items()}

# Everything that is not a doctrine group is kept as it is, in the original order.
doctrine_ids = {f't-{name}' for name in PLAN}
doctrine_ids.add('ac-core')
kept = [raw for gid, (raw, _) in groups.items() if gid not in doctrine_ids]

new_groups = []
report = []
for name, plan in PLAN.items():
    src = children[plan['source']]
    used = []
    pieces = []
    for part in ('back', 'gun', 'front'):
        spec = plan.get(part)
        if not spec:
            continue
        source = children[plan.get(f'{part}_source', plan['source'])]
        elements = pick(source, spec)
        new_groups.append(f'<g id="t-{name}-{part}">{"".join(elements)}</g>')
        pieces.append(part)
        if plan.get(f'{part}_source', plan['source']) == plan['source']:
            used.extend(elements)
    used.extend(pick(src, plan.get('drop', [])))
    if plan.get('front_source') is None and len(used) != len(src):
        raise SystemExit(f'{name}: {len(src) - len(used)} children unaccounted for')
    order = plan.get('wrapper') or pieces
    uses = ''.join(f'<use href="#{p if p.startswith("sb-") else f"t-{name}-{p}"}"></use>' for p in order)
    new_groups.append(f'<g id="t-{name}">{uses}</g>')
    report.append(f't-{name}: ' + ', '.join(f'{p} {len(pick(children[plan.get(f"{p}_source", plan["source"])], plan[p]))}' for p in pieces))

new_defs = ''.join(kept + new_groups)
for path, (text, (start, end), _) in sources.items():
    path.write_text(text[:start] + new_defs + text[end:])

print('\n'.join(report))
print(f'{len(files)} files rewritten, defs {len(defs)} -> {len(new_defs)} characters')
