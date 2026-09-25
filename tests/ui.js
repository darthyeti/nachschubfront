// Gallery for the DOM side of the HUD: every rune disc in every state and every
// symbol next to its name. Screenshot target, and the quickest way to see a
// change to ui/icons.js or ui/runeButton.js without starting a match.

import { ICONS, icon } from '../src/ui/icons.js';
import { createRuneButton } from '../src/ui/runeButton.js';
import { STRINGS } from '../src/data/strings.js';
import { COMMANDS } from '../src/data/commands.js';

const root = document.getElementById('gallery');

function section(title) {
  const h = document.createElement('h2');
  h.textContent = title;
  const row = document.createElement('div');
  row.className = 'row';
  root.append(h, row);
  return row;
}

function disc(row, options, face) {
  const made = createRuneButton({ side: 'top', onClick: () => {}, ...options });
  row.append(made.el);
  made.update(face);
  return made;
}

const states = section('Zustände');
disc(states, { iconName: 'orbitalStrike', label: 'Orbitalschlag', hint: STRINGS.commands.orbitalStrike.effect },
  { state: 'ready', note: '4', enabled: true });
disc(states, { iconName: 'orbitalStrike', label: 'Orbitalschlag', hint: STRINGS.commands.orbitalStrike.effect },
  { state: 'ready', note: '4', enabled: false });
disc(states, { iconName: 'stasisField', label: 'Stasisfeld', hint: STRINGS.commands.stasisField.effect },
  { state: 'cooldown', waves: 2, fraction: 1, enabled: false });
disc(states, { iconName: 'stasisField', label: 'Stasisfeld', hint: STRINGS.commands.stasisField.effect },
  { state: 'cooldown', waves: 1, fraction: 0.5, enabled: false });
disc(states, { iconName: 'holyBanner', label: 'Heiliges Banner', hint: STRINGS.commands.holyBanner.effect },
  { state: 'locked', badge: '30', enabled: false });

const bar = section('Untere Leiste');
disc(bar, { iconName: 'supply', label: 'Nachschub', hint: STRINGS.hud.supplyHint },
  { state: 'ready', badge: '6', note: '80', enabled: true });
disc(bar, { iconName: 'demolish', label: 'Abreißen', hint: 'Räumt ein Trümmerfeld.' },
  { state: 'ready', note: '15', enabled: true });
disc(bar, { iconName: 'bulwark', label: 'Bollwerk', hint: STRINGS.hud.bulwarkHint },
  { state: 'ready', note: '30', enabled: true, on: true });

const rail = section('Kommandoleiste');
for (const command of COMMANDS) {
  disc(rail, {
    iconName: command.id,
    label: STRINGS.commands[command.id].name,
    hint: STRINGS.commands[command.id].effect,
    side: 'left',
  }, { state: 'ready', note: String(command.cost), enabled: true });
}

const icons = section('Symbole');
icons.className = 'icons';
for (const name of Object.keys(ICONS)) {
  const fig = document.createElement('figure');
  fig.append(icon(name), Object.assign(document.createElement('figcaption'), { textContent: name }));
  icons.append(fig);
}
