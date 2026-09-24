#!/usr/bin/env python3
"""One-off surgery on the emplacement concept art of update 4 (M4d step 1).

Update 4 brought fresh sheets for the autocannon, the flamethrower and the
laser. They are exports from before the M4 split: they carry the whole symbol
library in one piece again, so they no longer match the other sheets in
reference/konzept/stellungen/ and `npm run sprites` refuses the folder.

This puts the library back together, once:

    t-ac-back     the shared bunker with the machine-gun accent (bunker2-mg)
    t-flame-back  the same bunker with the flame accent  (bunker2-flame)

Neither has a weapon that aims any more (docs/ART.md, "Gemeinsamer Bunker"), so
their -gun and -front parts go, and the muzzle flashes and flame bursts drawn
into the artwork go with them: those are code from now on, like every other
effect (src/render/towerFx.js).

    t-laser-back / t-laser-gun   wrapped in the shrink of t-laser-s

The laser keeps its design and its split; the new sheet only scales it down by
about 30 percent, so the existing parts are wrapped in that same transform
instead of being cut anew.

Usage: python3 tests/tools/split-bunkers.py
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / 'reference' / 'konzept' / 'stellungen'

# The sheet that still carries the split library from M4, and the one that
# carries the new artwork. Every other sheet is written from the merged result.
SPLIT_SOURCE = 'moerser.svg'
UPDATE_SOURCE = 'autokanone.svg'

ELEMENT = re.compile(r'<(?P<tag>[a-zA-Z][\w-]*)\b[^>]*?(?P<selfclose>/?)>')

# Which children of the new bunker symbols are the firing effect. The rest of
# the group is the building: plinth, body, roof, the three embrasures and the
# accent line, with the ink outlines drawn over them last.
BUNKER_EFFECT = range(14, 17)
BUNKER_CHILDREN = 20


def read_defs(path):
    text = path.read_text()
    m = re.search(r'<defs>(.*?)</defs>', text, re.S)
    if not m:
        raise SystemExit(f'{path.name}: no <defs>')
    return text, m.span(1), m.group(1)


def top_level_groups(defs):
    """id -> (raw element, inner text) for every top-level child of <defs>, in order."""
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
        if m.group('selfclose'):
            raw, scan = m.group(0), m.end()
        else:
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
        inner = raw[m.end() - start:-len(f'</{tag}>')] if not m.group('selfclose') else ''
        gid = re.search(r'id="([^"]+)"', m.group(0))
        groups[gid.group(1) if gid else f'#{len(groups)}'] = (raw, inner)
        pos = scan
    return groups


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


def require(groups, name, *ids):
    missing = [i for i in ids if i not in groups]
    if missing:
        raise SystemExit(f'{name} is missing {", ".join(missing)} — has this tool already run?')


def main():
    files = sorted(FOLDER.glob('*.svg'))
    split_text, split_span, split_defs = read_defs(FOLDER / SPLIT_SOURCE)
    _, _, update_defs = read_defs(FOLDER / UPDATE_SOURCE)

    old = top_level_groups(split_defs)
    new = top_level_groups(update_defs)
    require(old, SPLIT_SOURCE, 't-ac-back', 't-ac-gun', 't-flame-back', 't-flame-gun', 't-laser-back', 't-laser-gun')
    require(new, UPDATE_SOURCE, 'bunker2-mg', 'bunker2-flame', 't-laser-s')

    # --- the two bunkers: one piece each, without the firing effect ---
    bunkers = {}
    for part, symbol in (('t-ac-back', 'bunker2-mg'), ('t-flame-back', 'bunker2-flame')):
        children = split_elements(new[symbol][1])
        if len(children) != BUNKER_CHILDREN:
            raise SystemExit(f'{symbol}: expected {BUNKER_CHILDREN} children, found {len(children)}')
        kept = [c for i, c in enumerate(children) if i not in BUNKER_EFFECT]
        bunkers[part] = f'<g id="{part}">{"".join(kept)}</g>'

    # --- the laser: the old parts inside the new sheet's shrink ---
    shrink = re.search(r'<g transform="([^"]+)">', new['t-laser-s'][1])
    if not shrink:
        raise SystemExit('t-laser-s no longer wraps the laser in a transform')
    transform = shrink.group(1)
    lasers = {
        part: f'<g id="{part}"><g transform="{transform}">{old[part][1]}</g></g>'
        for part in ('t-laser-back', 't-laser-gun')
    }

    # --- wrappers, so the concept sheets still render on their own ---
    wrappers = {
        't-ac': '<g id="t-ac"><use href="#t-ac-back"></use></g>',
        't-flame': '<g id="t-flame"><use href="#t-flame-back"></use></g>',
        't-laser': '<g id="t-laser"><use href="#t-laser-back"></use><use href="#t-laser-gun"></use></g>',
    }

    # The bunker has no weapon and no cover, and the autocannon's ammunition
    # crate went with its old form: at veteran it gets the shared sandbag ring
    # like every other doctrine now (docs/ART.md, rank table).
    dropped = {'t-ac-gun', 't-ac-front', 't-flame-gun', 'crate'}
    replacements = {**bunkers, **lasers, **wrappers}

    merged = []
    for gid, (raw, _) in old.items():
        if gid in dropped:
            continue
        merged.append(replacements.pop(gid, raw))
    if replacements:
        raise SystemExit(f'nothing to replace for {", ".join(replacements)}')
    new_defs = ''.join(merged)

    # Every sheet carries the same library; the three new ones also still point
    # at the raw symbols instead of their doctrine's wrapper.
    shown = {'autokanone.svg': 't-ac', 'flamme.svg': 't-flame', 'laser.svg': 't-laser'}
    for path in files:
        text, (start, end), _ = read_defs(path)
        text = text[:start] + new_defs + text[end:]
        wanted = shown.get(path.name)
        if wanted:
            text = re.sub(r'(</defs>.*?<use href=")#[^"]+("/>\s*</svg>)', rf'\g<1>#{wanted}\g<2>', text, flags=re.S)
        path.write_text(text)

    kept_ids = [gid for gid in old if gid not in dropped]
    print(f'dropped: {", ".join(sorted(dropped))}')
    print(f'rebuilt: {", ".join(sorted(bunkers | lasers | wrappers))}')
    print(f'{len(files)} sheets rewritten, {len(kept_ids)} symbols, defs {len(split_defs)} -> {len(new_defs)} characters')


if __name__ == '__main__':
    main()
