// The "?" in the bottom left corner: opens the symbol sheet, a list of every
// symbol of the bars and the commands with its name and one sentence. It
// replaced the speech bubbles of the first help layer, which covered each other
// on small screens (M10 E1, docs/ART.md "Symbolblatt").
//
// The sheet is only a picture on top of the game: it does not pause the
// simulation, so it can be opened in the middle of a wave to look something up.
// A tap beside it, the close cross and Escape close it; it gives way to every
// other layer (menu, codex, pod selection, end screen).

import { STRINGS } from '../data/strings.js';
import { COMMANDS, commandById } from '../data/commands.js';
import { railOrder } from './commands.js';
import { el } from './controls.js';
import { icon } from './icons.js';
import { sheetHead } from './sheet.js';

const T = STRINGS.help;

/** The line under a command's name: price, unlock wave and pause between uses. */
export function commandMeta(command) {
  return T.commandMeta(command.cost, command.fromWave, command.cooldownWaves);
}

/**
 * What the sheet says, as data, so it can be checked without a browser.
 *
 * @returns {{title: string, rows: {icon: string, name: string, text: string, meta?: string}[]}[]}
 */
export function sheetSections(commands = COMMANDS, { promoting = true } = {}) {
  const row = (iconName, [name, text], meta) => ({ icon: iconName, name, text, ...(meta ? { meta } : {}) });
  const firstCommandWave = railOrder(commands)[0].fromWave;
  return [
    {
      title: T.statusTitle,
      rows: [
        row('wave', T.wave),
        row('lives', T.lives),
        row('supply', T.supply),
        row('requisition', T.requisition),
        row('points', T.points(firstCommandWave)),
        row('route', T.route),
        row('wave', T.riftPlate),
      ],
    },
    {
      title: T.barTitle,
      rows: [
        row('salvo', T.salvo),
        row('supply', T.supplyDisc),
        row('demolish', T.demolishDisc),
        row('bulwark', T.bulwarkDisc),
        row('upgrade', promoting ? T.promoteDisc : T.upgradeDisc),
        row('tempo-0', T.pause),
        row('tempo-2', T.tempo),
      ],
    },
    {
      title: T.commandsTitle,
      rows: railOrder(commands).map((command) => {
        const texts = STRINGS.commands[command.id];
        return row(command.id, [texts.name, texts.effect], commandMeta(commandById(command.id)));
      }),
    },
    {
      title: T.menuTitle,
      rows: [row('menu', T.menu), row('codex', T.codex), row('help', T.symbols)],
    },
  ];
}

/**
 * @param {HTMLElement} root
 */
export function createHelp(root) {
  const layer = el('div', 'help-layer');
  layer.hidden = true;
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-label', T.title);

  const button = el('button', 'help-button interactive');
  button.type = 'button';
  button.append(icon('help', 'help-icon'));
  button.setAttribute('aria-label', T.open);
  button.setAttribute('aria-pressed', 'false');

  function build() {
    const sheet = el('div', 'help-sheet');
    const head = el('div', 'help-head');
    const close = el('button', 'help-close interactive');
    close.type = 'button';
    close.setAttribute('aria-label', T.closeSheet);
    close.append(icon('close', 'help-close-icon'));
    close.addEventListener('click', (ev) => {
      ev.stopPropagation();
      api.close();
    });
    head.append(el('h2', 'help-title', T.title), close);
    const body = el('div', 'help-body');
    for (const section of sheetSections()) {
      const part = el('section', 'help-section');
      part.append(el('h3', 'help-section-title', section.title));
      const list = el('ul', 'help-rows');
      for (const r of section.rows) {
        const item = el('li', 'help-row');
        const disc = el('span', 'help-disc');
        disc.append(icon(r.icon, 'help-disc-icon'));
        const words = el('span', 'help-words');
        words.append(el('b', null, r.name), el('span', 'help-text', r.text));
        if (r.meta) words.append(el('span', 'help-meta', r.meta));
        item.append(disc, words);
        list.append(item);
      }
      part.append(list);
      body.append(part);
    }
    sheet.append(sheetHead(() => api.close(), T.closeSheet), head, body);
    sheet.addEventListener('click', (ev) => ev.stopPropagation());
    return sheet;
  }

  const api = {
    button,
    open() {
      layer.replaceChildren(build());
      layer.hidden = false;
      button.setAttribute('aria-pressed', 'true');
      button.setAttribute('aria-label', T.close);
      layer.querySelector('.help-close').focus({ preventScroll: true });
    },
    close() {
      if (layer.hidden) return;
      layer.hidden = true;
      layer.replaceChildren();
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', T.open);
      button.blur();
    },
    get isOpen() {
      return !layer.hidden;
    },
    /** The "?" has no place while another layer owns the screen. */
    setAvailable(available) {
      button.hidden = !available;
      if (!available && !layer.hidden) api.close();
    },
  };

  button.addEventListener('click', () => (layer.hidden ? api.open() : api.close()));
  layer.addEventListener('click', () => api.close());
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !layer.hidden) {
      ev.stopPropagation();
      api.close();
    }
  }, true);

  root.append(layer);
  return api;
}
