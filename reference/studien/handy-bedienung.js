// Study "Handy und Bedienung" (task A-23, issue #36).
// Draft of HUD, menus, icons and tutorial for phones. Not game code:
// none of it is in the game; the study only imports today's icons and colours.

import { ICONS as OLD } from '../../src/ui/icons.js';
import { DOCTRINE_COLORS } from '../../src/data/doctrines.js';

// ---------------------------------------------------------------- Palette
// From reference/stiltest.html and src/ui/icons.js.
const INK = '#1a1410';
const GOLD = '#e8c872';
const GOLD_DARK = '#b79243';
const STONE = '#a8a195';
const STONE_DARK = '#6a655e';
const CYAN = '#5fd4ff';
const FIRE = '#ff8a2a';
const BLOOD = '#9e1b1b';
const BONE = '#eadfc4';
const WOOD = '#b0834a';
const RIFT = '#9b6bd6';

/** Stroke with a dark halo, the way the game draws thin lines. */
const line = (d, color, w = 2, halo = 2.2) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + halo}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

// ---------------------------------------------------------------- New icons
// All 24 x 24, ink outline, flat fills. Every icon should read without text:
// a thing one can name, not a sign one has to learn.
export const NEW = {
  wave: `
    <path d="M9.6 5.2 L7.6 2.4 M14.4 5.2 L16.4 2.4" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <path d="M12 4.6 C7 4.6 5.4 8.6 6.4 12.6 C7.4 16.6 10 18.6 12 18.6 C14 18.6 16.6 16.6 17.6 12.6 C18.6 8.6 17 4.6 12 4.6 Z" fill="#7a5a3a" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="9.2" cy="10" r="1.7" fill="${BLOOD}" stroke="${INK}" stroke-width="1.1"/>
    <circle cx="14.8" cy="10" r="1.7" fill="${BLOOD}" stroke="${INK}" stroke-width="1.1"/>
    <path d="M9.6 16.8 C7.2 17.2 5.6 19.6 5 21.4 C8 21.6 10.2 20.2 11.2 18.2 Z M14.4 16.8 C16.8 17.2 18.4 19.6 19 21.4 C16 21.6 13.8 20.2 12.8 18.2 Z" fill="${BONE}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
  `,
  lives: `
    <path d="M12 20.8 C4 14.8 3 10.6 3 8.6 C3 5.8 5 4 7.4 4 C9.4 4 11 5.2 12 6.8 C13 5.2 14.6 4 16.6 4 C19 4 21 5.8 21 8.6 C21 10.6 20 14.8 12 20.8 Z" fill="${BLOOD}" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/>
    <path d="M6.2 8.4 C6.2 7.2 7 6.4 8.2 6.3" stroke="#e07a66" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <path d="M13 8 L11.2 11.4 L13.2 12.6 L11.6 16" stroke="${INK}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  `,
  requisition: `
    <path d="M5 15.4 v2.4 a7 2.8 0 0 0 14 0 v-2.4" fill="${GOLD_DARK}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
    <ellipse cx="12" cy="15.4" rx="7" ry="2.8" fill="${GOLD}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M5 11.2 v2.4 a7 2.8 0 0 0 14 0 v-2.4" fill="${GOLD_DARK}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
    <ellipse cx="12" cy="11.2" rx="7" ry="2.8" fill="${GOLD}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M5 7 v2.4 a7 2.8 0 0 0 14 0 V7" fill="${GOLD_DARK}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
    <ellipse cx="12" cy="7" rx="7" ry="2.8" fill="${GOLD}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M10.2 6.6 h3.6 L12 8.4 Z" fill="${INK}"/>
  `,
  points: `
    <path d="M12 2.6 L20 7.3 V16.7 L12 21.4 L4 16.7 V7.3 Z" fill="#1f3a4a" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M12 2.6 L20 7.3 V16.7 L12 21.4 L4 16.7 V7.3 Z" fill="#1f3a4a" stroke="${CYAN}" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="M13.4 5.8 L8.2 13 H11.6 L10.6 18.2 L15.8 11 H12.4 Z" fill="${CYAN}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
  `,
  route: `
    ${line('M5.4 19 C5.4 11.6 18.6 15.4 18.6 8.6', STONE, 2, 2)}
    <path d="M5.4 19 C5.4 11.6 18.6 15.4 18.6 8.6" fill="none" stroke="${INK}" stroke-width="1.2" stroke-dasharray="1.4 2.4" stroke-linecap="round"/>
    <circle cx="5.4" cy="19" r="2.5" fill="${RIFT}" stroke="${INK}" stroke-width="1.4"/>
    <path d="M18.6 2.8 L22.2 8.8 H15 Z" fill="${BLOOD}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
  `,
  supply: `
    <path d="M3.6 11 h13.2 v9.4 H3.6 Z" fill="${WOOD}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M3.6 14.4 h13.2 M7 11 v9.4 M13.4 11 v9.4" stroke="${INK}" stroke-width="1.2" fill="none"/>
    ${line('M18 11.4 V3.6 M14.6 6.8 L18 3.4 L21.4 6.8', GOLD, 2.3, 2.2)}
  `,
  demolish: `
    ${line('M4.6 20.2 L14.4 10.4', WOOD, 2.6, 2)}
    <g transform="rotate(-45 15.6 9.2)"><rect x="10.2" y="5.6" width="10.8" height="7.2" rx="1" fill="${STONE}" stroke="${INK}" stroke-width="1.8"/><path d="M12 7 v4.4" stroke="${STONE_DARK}" stroke-width="1.4"/></g>
    <path d="M14.4 19.6 h3.2 v2.2 h-3.2 Z M18.6 17 h2.8 v2.2 h-2.8 Z M20 21 h2 v1.6 h-2 Z" fill="${STONE_DARK}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
  `,
  bulwark: `
    <path d="M3.6 20.4 V9 h3.4 V6 h3 v3 h4 V6 h3 v3 h3.4 v11.4 Z" fill="${STONE}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M3.8 14.6 h16.4 M9 9.2 v5.4 M15 9.2 v5.4 M6.4 14.8 v5.4 M12 14.8 v5.4 M17.6 14.8 v5.4" stroke="${INK}" stroke-width="1.1" fill="none"/>
    <path d="M3.6 20.4 h16.8" stroke="${GOLD_DARK}" stroke-width="1.6"/>
  `,
  upgrade: `
    <path d="M4.4 20.4 h15.2 V15.6 H4.4 Z" fill="${STONE_DARK}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M8 15.6 v-2.6 h8 v2.6" fill="${STONE}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
    ${line('M12 11.6 V3.4 M8.2 7.2 L12 3.2 L15.8 7.2', GOLD, 2.4, 2.2)}
  `,
  salvo: `
    ${line('M8.4 8.2 V2.8 M12 8.2 V1.8 M15.6 8.2 V2.8', FIRE, 2, 2)}
    <path d="M6.8 8.6 h10.4 L14.4 19.4 h-4.8 Z" fill="${STONE}" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/>
    <path d="M6.8 8.6 h10.4 l.5 2 H6.3 Z" fill="${INK}"/>
    <rect x="10.4" y="12.2" width="3.2" height="3.2" fill="${BLOOD}" stroke="${INK}" stroke-width="1.2"/>
    <path d="M4.4 21 h15.2" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  `,
  codex: `
    <circle cx="5.4" cy="5.2" r="2.5" fill="${BLOOD}" stroke="${INK}" stroke-width="1.4"/>
    <circle cx="12" cy="4.6" r="2.5" fill="${CYAN}" stroke="${INK}" stroke-width="1.4"/>
    <circle cx="18.6" cy="5.2" r="2.5" fill="${FIRE}" stroke="${INK}" stroke-width="1.4"/>
    ${line('M5.8 8 L11 14.2 M12 7.4 V13.6 M18.2 8 L13 14.2', STONE_DARK, 1.6, 1.8)}
    <path d="M12 12.4 L17 15.2 V20.2 L12 23 L7 20.2 V15.2 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="M12 15.4 L13 17.6 H15.2 L13.4 19 L14.1 21 L12 19.8 L9.9 21 L10.6 19 L8.8 17.6 H11 Z" fill="${INK}"/>
  `,
  menu: `
    ${line('M4.6 7 h14.8 M4.6 12 h14.8 M4.6 17 h14.8', STONE, 2.8, 2.2)}
  `,
  help: `
    <circle cx="12" cy="12" r="9" fill="${GOLD}" stroke="${INK}" stroke-width="1.8"/>
    <path d="M9.2 9.4 a2.9 2.9 0 1 1 4.7 2.3 c-1.1 .8 -1.9 1.3 -1.9 2.7" fill="none" stroke="${INK}" stroke-width="2.3" stroke-linecap="round"/>
    <circle cx="12" cy="17.6" r="1.3" fill="${INK}"/>
  `,
  'tempo-0': `
    <rect x="6" y="5" width="4.2" height="14" rx="1" fill="${BONE}" stroke="${INK}" stroke-width="1.6"/>
    <rect x="13.8" y="5" width="4.2" height="14" rx="1" fill="${BONE}" stroke="${INK}" stroke-width="1.6"/>
  `,
  'tempo-1': `<path d="M8 4.6 L19 12 L8 19.4 Z" fill="${BONE}" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>`,
  'tempo-2': `
    <path d="M4 5.4 L12 12 L4 18.6 Z M12 5.4 L20 12 L12 18.6 Z" fill="${BONE}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
  `,
  'tempo-3': `
    <path d="M2.4 6.6 L8.4 12 L2.4 17.4 Z M9 6.6 L15 12 L9 17.4 Z M15.6 6.6 L21.6 12 L15.6 17.4 Z" fill="${BONE}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
  `,
  close: `${line('M6 6 L18 18 M18 6 L6 18', BONE, 2.6, 2.2)}`,
  fold: `${line('M6 9 L12 15 L18 9', BONE, 2.6, 2.2)}`,
  // Commands: three stay, two become clearer.
  orbitalStrike: OLD.orbitalStrike,
  stasisField: `
    ${line('M12 3 V21 M4.2 7.5 L19.8 16.5 M19.8 7.5 L4.2 16.5', CYAN, 2.2, 2)}
    ${line('M9.4 4.6 L12 7.2 L14.6 4.6 M9.4 19.4 L12 16.8 L14.6 19.4', CYAN, 1.7, 1.8)}
    <circle cx="12" cy="12" r="2.2" fill="#dff6ff" stroke="${INK}" stroke-width="1.3"/>
  `,
  prioritySupply: `
    <path d="M8.6 12.4 h6.8 l2.2 8.4 h-11.2 Z" fill="${STONE}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <rect x="10.6" y="15" width="2.8" height="2.8" fill="${BLOOD}" stroke="${INK}" stroke-width="1.1"/>
    <path d="M12 2.4 L13.5 5.6 L17 6 L14.4 8.3 L15.2 11.7 L12 9.9 L8.8 11.7 L9.6 8.3 L7 6 L10.5 5.6 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
  `,
  holyBanner: OLD.holyBanner,
  airstrike: OLD.airstrike,
  lock: OLD.lock,
};

/** Rows of the icon table: id, German name, short label under the disc, why it changed. */
export const ICON_ROWS = [
  ['wave', 'Welle', 'Welle', 'Die Fahne sagte "Ziel". Der Insektenkopf sagt, wer kommt.'],
  ['lives', 'Leben der Bastion', 'Leben', 'Das Herz kennt jeder. Die Burg stand schon für die Bastion selbst.'],
  ['requisition', 'Requisition', 'Requisition', 'Ein Münzstapel ist Geld, die Münze mit Dreieck musste man raten.'],
  ['points', 'Kommandopunkte', 'Kommando', 'Blitz im Sechseck: Energie für Kommandos. Der Stern war Bewertung oder Favorit.'],
  ['route', 'Routenlänge', 'Weg', 'Anfang (Riss), Weg und Pfeil zur Bastion. Die Zahl daneben ist die Länge.'],
  ['supply', 'Nachschubstufe', 'Nachschub', 'Eine Kiste mit Pfeil nach oben: mehr Nachschub. Die Antenne hieß Empfang.'],
  ['demolish', 'Abreißen', 'Abriss', 'Der Vorschlaghammer auf Schutt statt einer Tonne, die nach Löschen aussah.'],
  ['bulwark', 'Bollwerk', 'Bollwerk', 'Mauer mit Zinnen und Goldkante, klar eine feste Sperre.'],
  ['upgrade', 'Aufwerten (King of the Hill)', 'Aufwerten', 'Stellung mit Pfeil nach oben statt dreier Winkel.'],
  ['salvo', 'Salve anfordern', 'Salve', 'Die Kapsel fällt mit Feuerschweif: es kommt etwas vom Himmel.'],
  ['codex', 'Rezepte', 'Rezepte', 'Drei Zutaten führen zu einem goldenen Ergebnis. Das Buch sah nach Anleitung aus.'],
  ['menu', 'Menü', 'Menü', 'Bleibt. Die drei Balken kennt jeder.'],
  ['help', 'Symbole erklären', 'Symbole', 'Heute ein Fragezeichen im Text, neu ein Zeichen im Stil der Scheiben.'],
  ['tempo-0', 'Tempo: Pause', 'Pause', 'Heute die Wortknöpfe "Pause 1x 2x 3x". Dreiecke zeigen die Geschwindigkeit.'],
  ['tempo-2', 'Tempo: doppelt', 'Tempo', 'Ein Knopf, der reihum 1x, 2x, 3x schaltet, zeigt die Stufe als Dreiecke.'],
  ['orbitalStrike', 'Orbitalschlag', 'Orbital', 'Bleibt: Fadenkreuz mit Strahl ist eindeutig.'],
  ['stasisField', 'Stasisfeld', 'Stasis', 'Eiskristall mit hellem Kern, auf 24 px klarer als der gedrehte Stern.'],
  ['prioritySupply', 'Priorisierter Nachschub', 'Priorität', 'Kapsel mit goldenem Stern (besserer Rang). Die Winkel verwechselte man mit Aufwerten.'],
  ['holyBanner', 'Heiliges Banner', 'Banner', 'Bleibt: Fahne mit Totenkopf.'],
  ['airstrike', 'Luftschlag', 'Luftschlag', 'Bleibt: das Gunship von oben.'],
  ['lock', 'Gesperrt', 'Gesperrt', 'Bleibt.'],
  ['close', 'Schließen', 'Schließen', 'Neu: Blätter und Karten brauchen ein Kreuz, 44 x 44 px groß.'],
  ['fold', 'Leiste einklappen', 'Einklappen', 'Neu: Pfeil an der Kante der Leiste.'],
];

// ---------------------------------------------------------------- Helpers
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const svg = (inner, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true" focusable="false">${inner}</svg>`;
const NEWSVG = (id, cls = '') => svg(NEW[id], cls);
const OLDSVG = (id, cls = '') => svg(OLD[id] ?? '', cls);

// Today's labels for the controls that have no SVG icon.
const OLD_TEXT = { help: '?', 'tempo-0': 'Pause', 'tempo-1': '1x', 'tempo-2': '2x', 'tempo-3': '3x', close: 'Schließen', fold: '', };

// ---------------------------------------------------------------- Texts
const TXT = {
  wave: 'Welle', lives: 'Leben', req: 'Requisition', route: 'Weg', points: 'Kommando',
  explain: {
    wave: ['Welle', 'Aktuelle Welle und wie viele es insgesamt sind.'],
    lives: ['Leben', 'Jeder Durchbruch kostet Leben. Bei 0 ist die Partie verloren.'],
    req: ['Requisition', 'Deine Währung. Gibt es für Abschüsse und als Bonus nach jeder Welle.'],
    route: ['Weg', 'So viele Felder laufen die Gegner. Ein Strich heisst: Weg blockiert.'],
    points: ['Kommandopunkte', 'Für Spezialkommandos ab Welle 15.'],
  },
};
// ---------------------------------------------------------------- Tutorial flow
// Two rounds, 13 steps. wait: what the player has to do ('next' = the Weiter button).
export const TUTORIAL = [
  { round: 1, target: 'board', wait: 'next', text: 'Willkommen in der Nachschubfront. Aus dem Riss brechen Gegner und laufen zur Bastion. Du hältst sie auf, indem du ihren Weg verlängerst.', input: 'Weiter antippen' },
  { round: 1, target: 'route', wait: 'next', text: 'Die gestrichelte Linie ist ihr Weg, die Zahl oben seine Länge in Feldern. Je länger der Weg, desto mehr Zeit zum Schießen.', input: 'Weiter antippen' },
  { round: 1, target: 'spot', wait: 'spot', text: 'Tippe auf das leuchtende Feld. Dort soll eine Kapsel landen.', input: 'Das leuchtende Feld antippen' },
  { round: 1, target: 'salvo', wait: 'salvo', text: 'Gut. Jetzt die Salve anfordern. Felder, die du nicht markierst, sucht das Spiel selbst aus.', input: 'Salve antippen' },
  { round: 1, target: 'card0', wait: 'card', text: 'Sechs Kapseln sind gelandet. Tippe die erste an: Sie wird deine Stellung.', input: 'Die erste Kapsel antippen' },
  { round: 1, target: 'keep', wait: 'keep', text: 'Mit Behalten baut das Spiel die Stellung. Die übrigen Kapseln werden zu Trümmern. Auch Trümmer versperren den Gegnern den Weg.', input: 'Behalten antippen' },
  { round: 1, target: 'tempo', wait: 'tempo', text: 'Die Welle läuft. Mit dem Tempo-Knopf geht es schneller.', input: 'Tempo antippen' },
  { round: 2, target: 'req', wait: 'next', text: 'Runde zwei. Jeder Abschuss bringt Requisition. Davon zahlst du Nachschub, Abriss und Bollwerk.', input: 'Weiter antippen' },
  { round: 2, target: 'spot2', wait: 'spot', text: 'Markiere wieder ein Feld und achte auf die Zahl beim Weg: Sie soll wachsen.', input: 'Das leuchtende Feld antippen' },
  { round: 2, target: 'salvo', wait: 'salvo', text: 'Noch eine Salve.', input: 'Salve antippen' },
  { round: 2, target: 'cardMerge', wait: 'card', text: 'Zwei gleiche Kapseln lassen sich verschmelzen. Das Zeichen ×2 zeigt es. Tippe die Laser-Kapsel an.', input: 'Die Kapsel mit ×2 antippen' },
  { round: 2, target: 'merge', wait: 'merge', text: 'Verschmelzen macht aus zwei Laser-Rekruten einen Laser-Veteranen mit mehr Reichweite und Schaden.', input: 'Verschmelzen antippen' },
  { round: 2, target: 'menu', wait: 'next', text: 'Das war es. Im Menü findest du die Rezepte und die Erklärung aller Symbole. Viel Glück, Kommandant.', input: 'Los geht\'s antippen', last: true },
];

const SIZES = { '390x844': [390, 844], '360x780': [360, 780], '430x932': [430, 932] };

// Board placeholder: hot spots in percent of the picture (portrait, landscape).
const SPOTS = {
  hoch: { spot: [46, 55], spot2: [32, 62], tower: [52, 40] },
  quer: { spot: [44, 58], spot2: [34, 66], tower: [56, 40] },
};

const CARDS = {
  1: [
    ['psi', 'Psi', 'Rekrut', 0],
    ['laser', 'Laser', 'Rekrut', 2],
    ['mortar', 'Mörser', 'Rekrut', 0],
    ['laser', 'Laser', 'Rekrut', 2],
    ['laser', 'Laser', 'Rekrut', 2],
    ['autocannon', 'Autokanone', 'Rekrut', 0],
  ],
  2: [
    ['flame', 'Flamme', 'Rekrut', 0],
    ['laser', 'Laser', 'Rekrut', 2],
    ['tesla', 'Tesla', 'Rekrut', 0],
    ['laser', 'Laser', 'Rekrut', 2],
    ['psi', 'Psi', 'Rekrut', 0],
    ['mortar', 'Mörser', 'Rekrut', 0],
  ],
};

// ---------------------------------------------------------------- State
const state = {
  size: '390x844',
  orient: 'hoch',
  screen: 'planung', // titel planung kapselwahl welle stellung pause hilfe
  round: 1,
  zones: [], // {x, y} in Prozent des Bildes
  pick: -1,
  speed: 1,
  towers: 0,
  topClosed: false,
  dockClosed: false,
  safe: false,
  heute: true,
  thumb: false,
  tip: null,
  tut: null, // Schrittindex oder null
  waveTimer: null,
  banner: '',
};

const phone = $('#phone');
const heuteImg = $('#heuteImg');
const out = { free: $('#outFree'), hits: $('#outHits'), step: $('#outStep') };

const scaleOf = () => phone.getBoundingClientRect().width / phone.offsetWidth;

// ---------------------------------------------------------------- Building the draft
function chip(key, iconId, value, extra = '') {
  return `<button class="chip ${extra}" data-act="chip" data-key="${key}" data-t="${key}" aria-label="${TXT.explain[key][0]} ${value}">${NEWSVG(iconId)}<b>${value}</b></button>`;
}

function tool(id, iconId, label, price, badge, disabled) {
  return `<button class="tool" data-act="tool" data-id="${id}" data-t="tool-${id}" ${disabled ? 'disabled' : ''} aria-label="${label}">
    <span class="disc">${NEWSVG(iconId)}${badge ? `<i class="badge">${badge}</i>` : ''}${price != null ? `<i class="price">${price}</i>` : ''}</span>
    <span class="lab">${label}</span></button>`;
}

function routeValue() {
  return 41 + state.zones.length * 2 + (state.round - 1) * 3;
}

function topHtml() {
  const wave = `${state.screen === 'titel' ? 0 : state.round}/50`;
  return `<div class="top ${state.topClosed ? 'closed' : ''}">
    ${chip('wave', 'wave', wave)}
    ${chip('lives', 'lives', '20')}
    ${chip('req', 'requisition', state.round === 1 ? '0' : '38', 'opt')}
    ${chip('route', 'route', routeValue(), 'opt')}
    <button class="menu-btn" data-act="sheet" data-id="pause" data-t="menu" aria-label="Menü">${NEWSVG('menu')}</button>
    <button class="fold fold-top" data-act="foldTop" aria-label="${state.topClosed ? 'Statusleiste ausklappen' : 'Statusleiste einklappen'}"><span>${NEWSVG('fold')}</span></button>
  </div>`;
}

function dockHtml() {
  const planning = state.screen === 'planung';
  const wave = state.screen === 'welle';
  const tools = `<div class="tools">
      ${tool('supply', 'supply', 'Nachschub', 20, '1', !planning)}
      ${tool('demolish', 'demolish', 'Abriss', 15, '', !planning)}
      ${tool('bulwark', 'bulwark', 'Bollwerk', 30, '', !planning)}
    </div>`;
  const act = `<div class="act">
      <button class="tempo" data-act="tempo" data-t="tempo" aria-label="Tempo ${state.speed}x">${NEWSVG(`tempo-${state.speed}`)}<span>${state.speed}x</span></button>
      <button class="salvo" data-act="salvo" data-t="salvo" ${planning ? '' : 'disabled'} aria-label="Salve anfordern">${NEWSVG('salvo')}<b>Salve</b>${planning ? `<i class="zn">${state.zones.length}/6</i>` : ''}</button>
    </div>`;
  return `<div class="dock ${state.dockClosed ? 'closed' : ''}">
    ${tools}${act}
    <button class="fold fold-dock" data-act="foldDock" aria-label="${state.dockClosed ? 'Werkzeuge ausklappen' : 'Werkzeuge einklappen'}"><span>${NEWSVG('fold')}</span></button>
  </div>`;
}

function boardHtml() {
  const o = state.orient;
  const img = `../konzept/handy/spielfeld-${o}-${state.screen === 'welle' ? 'welle' : 'planung'}.jpg`;
  const sp = SPOTS[o];
  const hot = state.tut != null ? TUTORIAL[state.tut].target : '';
  const spot = (id) => `<button class="spot ${hot === id ? 'glow' : ''}" data-act="spot" data-t="${id}" style="left:${sp[id][0]}%;top:${sp[id][1]}%" aria-label="Feld markieren"><i></i></button>`;
  const marks = state.zones.map((z, i) => `<span class="mark" style="left:${z.x}%;top:${z.y}%"><em>${i + 1}</em></span>`).join('');
  const tower = state.towers > 0
    ? `<button class="tower" data-act="tower" data-t="tower" style="left:${sp.tower[0]}%;top:${sp.tower[1]}%" aria-label="Stellung antippen für Infos"><i></i></button>` : '';
  const ring = state.screen === 'stellung' ? `<span class="range" style="left:${sp.tower[0]}%;top:${sp.tower[1]}%"></span>` : '';
  const showSpots = state.screen === 'planung' && state.tut != null;
  return `<div class="board" data-act="board" data-t="board"><img src="${img}" alt="Platzhalter-Spielfeld (Standbild des Spiels)">
    ${marks}${ring}${tower}${showSpots ? spot(state.round === 1 ? 'spot' : 'spot2') : ''}</div>`;
}

function cardsHtml() {
  const list = CARDS[state.round];
  return list.map(([doc, name, rank, mult], i) => `
    <button class="card ${state.pick === i ? 'on' : ''}" data-act="card" data-i="${i}" data-t="card${i}${mult && state.round === 2 && i === 1 ? ' cardMerge' : ''}" style="--doc:${DOCTRINE_COLORS[doc] ?? '#ccc'}">
      <span class="cn"><em>${i + 1}</em> ${name}</span><span class="cr">${rank}</span>${mult ? `<i class="x">×${mult}</i>` : ''}</button>`).join('');
}

function sheetHtml() {
  const s = state.screen;
  const o = state.orient;
  const grab = `<button class="grab" data-act="closeSheet" aria-label="Blatt schließen"><span></span></button>`;
  if (s === 'titel') {
    return `<div class="logo"><h1>Nachschubfront</h1><p>Grimdark Tower Defense</p></div>
      <div class="sheet title">
        <button class="btn gold" data-act="new" data-t="new">Neue Partie</button>
        <div class="grid2">
          <button class="btn" disabled>Fortsetzen</button><button class="btn">Seed eingeben</button>
          <button class="btn">Bestenliste</button><button class="btn">Einstellungen</button>
        </div>
      </div>`;
  }
  if (s === 'kapselwahl') {
    const merge = state.pick >= 0 && CARDS[state.round][state.pick][3] > 0;
    return `<div class="sheet pick">
      <div class="shead"><b>Kapsel wählen</b><span>Der Rest wird zu Trümmern.</span><button class="icon-btn" data-act="sheet" data-id="codex" aria-label="Rezepte">${NEWSVG('codex')}</button></div>
      <div class="cards">${cardsHtml()}</div>
      <div class="actions">
        <button class="btn gold" data-act="keep" data-t="keep" ${state.pick < 0 ? 'disabled' : ''}>Behalten</button>
        ${merge ? `<button class="btn gold" data-act="merge" data-t="merge">Verschmelzen ×2 → Veteran</button>` : ''}
      </div>
    </div>`;
  }
  if (s === 'stellung') {
    return `<div class="sheet info">
      <div class="shead"><b class="doc">Psi · Rekrut</b><span>Stellung</span><button class="icon-btn" data-act="closeSheet" aria-label="Schließen">${NEWSVG('close')}</button></div>
      <div class="stats"><div><span>Schaden/s</span><b>4</b></div><div><span>Reichweite</span><b>3 Felder</b></div><div><span>Ziele</span><b>Boden, Luft</b></div></div>
    </div>`;
  }
  if (s === 'pause') {
    return `<button class="scrim" data-act="closeSheet" aria-label="Menü schließen"></button><div class="sheet menu">
      ${grab}
      <h2>Pausiert</h2><p class="status">Welle ${state.round}/50 · Leben 20 · Requisition ${state.round === 1 ? 0 : 38}</p>
      <button class="btn gold" data-act="closeSheet">Fortsetzen</button>
      <div class="grid2">
        <button class="btn" data-act="sheet" data-id="hilfe"><span class="bi">${NEWSVG('help')}</span>Symbole</button>
        <button class="btn" data-act="sheet" data-id="codex"><span class="bi">${NEWSVG('codex')}</span>Rezepte</button>
        <button class="btn">Einstellungen</button><button class="btn">Partie exportieren</button>
      </div>
      <button class="btn quiet" data-act="leave">Partie verlassen</button>
    </div>`;
  }
  if (s === 'hilfe') {
    const rows = [
      ['wave', 'Welle', 'Aktuelle Welle und wie viele es insgesamt sind.'],
      ['lives', 'Leben', 'Jeder Durchbruch kostet Leben. Bei 0 ist die Partie verloren.'],
      ['requisition', 'Requisition', 'Deine Währung, für Abschüsse und als Bonus nach jeder Welle.'],
      ['route', 'Weg', 'So viele Felder laufen die Gegner. Ein Strich heißt: blockiert.'],
      ['supply', 'Nachschub', 'Baut die Nachschubstufe aus: bessere Ränge in neuen Kapseln.'],
      ['demolish', 'Abriss', 'Räumt ein Trümmerfeld und gibt das Feld frei.'],
      ['bulwark', 'Bollwerk', 'Macht aus Trümmern ein Bollwerk, das Rammstößen standhält.'],
      ['salvo', 'Salve', 'Startet die Runde: Kapseln landen, du wählst eine Stellung.'],
      ['tempo-2', 'Tempo', 'Schaltet reihum 1x, 2x, 3x. Pause liegt im Menü.'],
    ];
    return `<button class="scrim" data-act="closeSheet" aria-label="Schließen"></button><div class="sheet help">
      ${grab}<div class="shead"><b>Symbole</b><span>Jedes Zeichen der Leisten</span><button class="icon-btn" data-act="closeSheet" aria-label="Schließen">${NEWSVG('close')}</button></div>
      <ul>${rows.map(([i, n, t]) => `<li>${NEWSVG(i)}<div><b>${n}</b><span>${t}</span></div></li>`).join('')}</ul></div>`;
  }
  if (s === 'codex') {
    return `<button class="scrim" data-act="closeSheet" aria-label="Schließen"></button><div class="sheet help">
      ${grab}<div class="shead"><b>Rezepte</b><span>Drei verschiedene ab dem genannten Rang</span><button class="icon-btn" data-act="closeSheet" aria-label="Schließen">${NEWSVG('close')}</button></div>
      <ul><li>${NEWSVG('codex')}<div><b>Reinigungsschrein</b><span>Flamme + Laser + Psi, ab Rang 2</span></div></li>
      <li>${NEWSVG('codex')}<div><b>Sturmbatterie</b><span>Autokanone + Tesla + Laser, ab Rang 2</span></div></li>
      <li>${NEWSVG('codex')}<div><b>Gewitterturm</b><span>Tesla + Mörser + Psi, ab Rang 3</span></div></li></ul></div>`;
  }
  return '';
}

function bannerHtml() {
  return state.banner ? `<div class="banner">${state.banner}</div>` : '';
}

function tipHtml() {
  if (!state.tip) return '';
  const [n, t] = TXT.explain[state.tip];
  return `<div class="tip"><b>${n}</b><span>${t}</span></div>`;
}

function render() {
  phone.dataset.o = state.orient;
  phone.dataset.screen = state.screen;
  phone.dataset.safe = state.safe ? 'on' : 'off';
  phone.dataset.thumb = state.thumb ? 'on' : 'off';
  const [w, h] = SIZES[state.size];
  const [pw, ph] = state.orient === 'hoch' ? [w, h] : [h, w];
  phone.style.setProperty('--w', `${pw}px`);
  phone.style.setProperty('--h', `${ph}px`);
  const inGame = state.screen !== 'titel';
  const showDock = ['planung', 'welle', 'stellung', 'pause', 'hilfe', 'codex'].includes(state.screen);
  phone.innerHTML = boardHtml()
    + (inGame ? topHtml() : '')
    + (showDock ? dockHtml() : '')
    + tipHtml() + bannerHtml()
    + sheetHtml()
    + `<div class="thumbzone" aria-hidden="true"><i class="easy"></i><i class="hard"></i><i class="easy r"></i></div>`
    + `<div class="safe" aria-hidden="true"></div>`
    + `<div class="tut" hidden></div>`;
  fit();
  renderTut();
  measure();
}

// ---------------------------------------------------------------- Scaling the view
function fit() {
  const [w, h] = SIZES[state.size];
  const [pw, ph] = state.orient === 'hoch' ? [w, h] : [h, w];
  const q = new URLSearchParams(location.search);
  const one = q.get('scale') === '1';
  const room = $('#stage').clientWidth;
  const cols = heuteImg.closest('.col').hidden ? 1 : 2;
  const s = one ? 1 : Math.min(1, (window.innerHeight - 150) / ph, (room - 24 * cols) / (pw * cols));
  document.documentElement.style.setProperty('--s', String(s));
  document.documentElement.style.setProperty('--pw', `${pw}px`);
  document.documentElement.style.setProperty('--ph', `${ph}px`);
}

// ---------------------------------------------------------------- Measuring
function painted() {
  const r0 = phone.getBoundingClientRect();
  const k = scaleOf();
  const sel = '.chip, .menu-btn, .tool, .tempo, .salvo, .sheet, .top:not(.closed), .dock:not(.closed), .tip, .banner, .icon-btn, .logo, .fold span, .card, .btn';
  const rects = [];
  for (const e of $$(sel, phone)) {
    if (e.closest('[hidden]')) continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (e.matches('.top.closed, .dock.closed')) continue;
    // A bar without a band (folded or landscape) counts only with its buttons.
    if (e.matches('.top, .dock') && getComputedStyle(e).backgroundImage === 'none') continue;
    rects.push([(r.left - r0.left) / k, (r.top - r0.top) / k, (r.right - r0.left) / k, (r.bottom - r0.top) / k]);
  }
  return rects;
}

function measure() {
  const W = phone.offsetWidth;
  const H = phone.offsetHeight;
  const step = 2;
  const cols = Math.ceil(W / step);
  const rows = Math.ceil(H / step);
  const grid = new Uint8Array(cols * rows);
  const top = [];
  for (const [x0, y0, x1, y1] of painted()) {
    for (let y = Math.max(0, Math.floor(y0 / step)); y < Math.min(rows, Math.ceil(y1 / step)); y++) {
      for (let x = Math.max(0, Math.floor(x0 / step)); x < Math.min(cols, Math.ceil(x1 / step)); x++) grid[y * cols + x] = 1;
    }
  }
  // Share of the frame that no HUD element covers.
  let cov = 0;
  for (const v of grid) cov += v;
  const free = Math.round(((W * H - cov * step * step) / (W * H)) * 1000) / 10;
  out.free.textContent = `${String(free).replace('.', ',')} %`;
  // Hit areas
  const k = scaleOf();
  const small = [];
  let n = 0;
  for (const b of $$('button, [data-hit]', phone)) {
    if (b.matches('.scrim, .board, .spot, .tower') || b.closest('[hidden]')) continue;
    const r = b.getBoundingClientRect();
    if (r.width === 0) continue;
    n++;
    const w = r.width / k;
    const h = r.height / k;
    if (w < 43.5 || h < 43.5) small.push(`${(b.getAttribute('aria-label') || b.textContent || b.className).trim().slice(0, 24)} ${Math.round(w)} x ${Math.round(h)}`);
  }
  out.hits.textContent = small.length === 0 ? `${n} von ${n} Knöpfen mindestens 44 x 44 px` : `${small.length} unter 44 px: ${small.join(', ')}`;
  out.hits.dataset.ok = small.length === 0 ? '1' : '0';
  phone.dataset.free = String(free);
  phone.dataset.small = String(small.length);
}

// ---------------------------------------------------------------- Tutorial
function step() { return state.tut == null ? null : TUTORIAL[state.tut]; }

function renderTut() {
  const box = $('.tut', phone);
  const st = step();
  if (!st) { box.hidden = true; box.innerHTML = ''; out.step.textContent = 'Tutorial aus'; return; }
  box.hidden = false;
  const W = phone.offsetWidth;
  const H = phone.offsetHeight;
  const k = scaleOf();
  const r0 = phone.getBoundingClientRect();
  const targets = $$(`[data-t~="${st.target}"]`, phone);
  let t = null;
  if (targets[0]) {
    const r = targets[0].getBoundingClientRect();
    t = { x: (r.left - r0.left) / k, y: (r.top - r0.top) / k, w: r.width / k, h: r.height / k };
  }
  const pad = 6;
  const hole = t ? { x: Math.max(0, t.x - pad), y: Math.max(0, t.y - pad), w: Math.min(W, t.w + 2 * pad), h: Math.min(H, t.h + 2 * pad) } : null;
  let html = '';
  if (hole && st.wait !== 'next') {
    // Four blockers around the hole: only the highlighted element takes input.
    html += `<i class="block" style="left:0;top:0;width:${W}px;height:${hole.y}px"></i>`
      + `<i class="block" style="left:0;top:${hole.y + hole.h}px;width:${W}px;height:${H - hole.y - hole.h}px"></i>`
      + `<i class="block" style="left:0;top:${hole.y}px;width:${hole.x}px;height:${hole.h}px"></i>`
      + `<i class="block" style="left:${hole.x + hole.w}px;top:${hole.y}px;width:${W - hole.x - hole.w}px;height:${hole.h}px"></i>`;
  } else {
    html += `<i class="block" style="left:0;top:0;width:${W}px;height:${H}px"></i>`;
  }
  if (hole) html += `<i class="hole" style="left:${hole.x}px;top:${hole.y}px;width:${hole.w}px;height:${hole.h}px"></i>`;
  // Coach card: opposite the target, so the finger does not cover it.
  const cw = Math.min(300, W - 24);
  const quer = state.orient === 'quer';
  let cx;
  let cy;
  const cardH = 150;
  if (!hole) { cx = (W - cw) / 2; cy = H * 0.3; }
  else if (!quer) {
    cx = Math.min(Math.max(12, hole.x + hole.w / 2 - cw / 2), W - cw - 12);
    cy = hole.y + hole.h / 2 > H * 0.5 ? hole.y - cardH - 12 : hole.y + hole.h + 12;
  } else {
    const onRight = hole.x + hole.w / 2 > W / 2;
    cx = onRight ? Math.max(12, hole.x - cw - 12) : Math.min(W - cw - 12, hole.x + hole.w + 12);
    cy = Math.min(Math.max(8, hole.y + hole.h / 2 - cardH / 2), H - cardH - 8);
  }
  cy = Math.max(8, Math.min(cy, H - cardH - 8));
  const i = state.tut;
  html += `<div class="coach" style="left:${cx}px;top:${cy}px;width:${cw}px">
    <div class="cmeta"><b>Schritt ${i + 1} von ${TUTORIAL.length}</b><span>Runde ${st.round}</span></div>
    <p>${st.text}</p>
    <div class="crow">
      <button class="btn quiet" data-act="tutSkip">Überspringen</button>
      ${st.wait === 'next' ? `<button class="btn gold" data-act="tutNext">${st.last ? 'Los geht\'s' : 'Weiter'}</button>` : `<span class="need">${st.input}</span>`}
    </div></div>`;
  box.innerHTML = html;
  out.step.textContent = `Schritt ${i + 1}/${TUTORIAL.length}: ${st.input}`;
}

function tutGoto(i) {
  if (i >= TUTORIAL.length) { state.tut = null; render(); return; }
  state.tut = i;
  const st = TUTORIAL[i];
  // The draft sets up the state that fits the step when one jumps to it.
  state.round = st.round;
  if (['spot', 'spot2', 'route', 'board', 'req'].includes(st.target) || st.target === 'salvo') {
    if (state.screen !== 'planung') state.screen = 'planung';
  }
  if (st.target === 'spot' || st.target === 'spot2') state.zones = [];
  if (st.target === 'salvo' && state.zones.length === 0) state.zones = [{ x: SPOTS[state.orient].spot[0], y: SPOTS[state.orient].spot[1] }];
  if (['card0', 'cardMerge', 'keep', 'merge'].includes(st.target)) {
    state.screen = 'kapselwahl';
    if (st.target === 'keep') state.pick = 0;
    else if (st.target === 'merge') state.pick = 1;
    else state.pick = -1;
  }
  if (st.target === 'tempo') { state.screen = 'welle'; state.towers = Math.max(state.towers, 1); }
  if (st.target === 'menu') { state.screen = 'planung'; state.towers = Math.max(state.towers, 2); }
  render();
}

function emit(name) {
  const st = step();
  if (st && st.wait === name) setTimeout(() => tutGoto(state.tut + 1), 60);
}

// ---------------------------------------------------------------- Flow of the draft
function finishWave() {
  clearTimeout(state.waveTimer);
  state.screen = 'planung';
  state.round = Math.min(2, state.round + 1);
  state.zones = [];
  state.pick = -1;
  state.banner = '';
  state.speed = 1;
  render();
}

function setScreen(name) {
  clearTimeout(state.waveTimer);
  state.screen = name;
  state.banner = '';
  state.tip = null;
  if (name === 'kapselwahl') { state.pick = -1; state.round = state.round || 1; }
  if (name === 'welle') { state.banner = 'Welle 1 läuft'; state.towers = Math.max(1, state.towers); }
  if (name === 'stellung') state.towers = Math.max(1, state.towers);
  if (name === 'planung') state.zones = state.zones.slice(0, 6);
  render();
}

const ACTIONS = {
  chip(el) {
    state.tip = state.tip === el.dataset.key ? null : el.dataset.key;
    render();
    clearTimeout(ACTIONS._tipTimer);
    ACTIONS._tipTimer = setTimeout(() => { state.tip = null; render(); }, 3500);
  },
  tool() { /* The tools do nothing in the draft. */ },
  tempo() {
    state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 3 : 1;
    render();
    emit('tempo');
    if (state.screen === 'welle' && state.speed > 1 && step() === null) { /* free run */ }
  },
  salvo() {
    if (state.zones.length === 0 && state.round === 1 && step() == null) {
      /* The game fills unmarked zones itself. */
    }
    setScreen('kapselwahl');
    emit('salvo');
  },
  spot(el, ev) {
    ev.stopPropagation();
    const sp = SPOTS[state.orient][el.dataset.t];
    state.zones.push({ x: sp[0], y: sp[1] });
    render();
    emit('spot');
  },
  board(el, ev) {
    if (state.screen !== 'planung' || state.tut != null) return;
    const r = el.getBoundingClientRect();
    if (state.zones.length >= 6) return;
    state.zones.push({ x: ((ev.clientX - r.left) / r.width) * 100, y: ((ev.clientY - r.top) / r.height) * 100 });
    render();
  },
  tower() { setScreen('stellung'); },
  card(el) {
    state.pick = Number(el.dataset.i);
    render();
    emit('card');
  },
  keep() {
    state.towers += 1;
    state.screen = 'welle';
    state.banner = 'Welle 1 läuft';
    render();
    emit('keep');
    if (step() == null) state.waveTimer = setTimeout(finishWave, 4000);
  },
  merge() {
    state.towers += 1;
    state.screen = 'welle';
    state.banner = 'Welle 2 läuft';
    render();
    emit('merge');
    if (step() == null) state.waveTimer = setTimeout(finishWave, 4000);
  },
  new() { state.round = 1; state.towers = 0; state.zones = []; setScreen('planung'); },
  sheet(el) { setScreen(el.dataset.id === 'pause' ? 'pause' : el.dataset.id); },
  closeSheet() { setScreen(['pause', 'hilfe', 'codex', 'stellung'].includes(state.screen) ? 'planung' : state.screen); },
  leave() { setScreen('titel'); },
  foldTop() { state.topClosed = !state.topClosed; render(); },
  foldDock() { state.dockClosed = !state.dockClosed; render(); },
  tutNext() { tutGoto(state.tut + 1); },
  tutSkip() { state.tut = null; render(); },
};

phone.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  ACTIONS[el.dataset.act]?.(el, ev);
});

// ---------------------------------------------------------------- Controls of the study
function syncControls() {
  for (const b of $$('[data-size]')) b.classList.toggle('on', b.dataset.size === state.size);
  for (const b of $$('[data-orient]')) b.classList.toggle('on', b.dataset.orient === state.orient);
  for (const b of $$('[data-screen]')) b.classList.toggle('on', b.dataset.screen === state.screen);
  for (const b of $$('[data-toggle]')) b.classList.toggle('on', Boolean(state[b.dataset.toggle]));
  $('#heuteTitle').textContent = `Heute (${state.size}, ${state.orient === 'hoch' ? 'hoch' : 'quer'})`;
  const key = { titel: 'titel', planung: 'planung', kapselwahl: 'kapselwahl', welle: 'welle', stellung: 'stellung', pause: 'pause', hilfe: 'hilfe', codex: 'hilfe' }[state.screen];
  heuteImg.src = `../konzept/handy/heute-${state.size}-${state.orient}-${key}.jpg`;
  heuteImg.alt = `Das heutige Spiel, Zustand ${key}`;
  document.documentElement.dataset.o = state.orient;
}

for (const b of $$('[data-size]')) b.addEventListener('click', () => { state.size = b.dataset.size; syncControls(); render(); });
for (const b of $$('[data-orient]')) b.addEventListener('click', () => { state.orient = b.dataset.orient; syncControls(); render(); });
for (const b of $$('[data-screen]')) b.addEventListener('click', () => { state.tut = null; setScreen(b.dataset.screen); syncControls(); });
for (const b of $$('[data-toggle]')) b.addEventListener('click', () => {
  state[b.dataset.toggle] = !state[b.dataset.toggle];
  if (b.dataset.toggle === 'heute') $('.col.heute').hidden = !state.heute;
  syncControls();
  render();
});
$('#tutStart').addEventListener('click', () => {
  state.round = 1; state.towers = 0; state.zones = []; state.screen = 'planung'; state.topClosed = false; state.dockClosed = false;
  tutGoto(0);
  syncControls();
});
$('#tutStop').addEventListener('click', () => { state.tut = null; render(); });
window.addEventListener('resize', () => { fit(); renderTut(); });
new MutationObserver(syncControls).observe(phone, { attributes: true, attributeFilter: ['data-screen'] });

// ---------------------------------------------------------------- Icon table
function iconTable() {
  const rows = ICON_ROWS.map(([id, name, label, why]) => {
    const old = OLD[id] ? OLDSVG(id) : `<span class="oldtext">${OLD_TEXT[id] ?? '–'}</span>`;
    const same = OLD[id] && NEW[id] === OLD[id];
    return `<tr><td><b>${name}</b></td>
      <td><span class="disc big">${old}</span></td>
      <td><span class="disc big">${NEWSVG(id)}</span>${same ? '<small>unverändert</small>' : ''}</td>
      <td class="sizes"><span class="disc s48">${NEWSVG(id)}</span><span class="disc s32">${NEWSVG(id)}</span><span class="disc s24">${NEWSVG(id)}</span></td>
      <td class="lbl"><span class="tag">${label}</span></td><td class="why">${why}</td></tr>`;
  }).join('');
  $('#iconRows').innerHTML = rows;
}

function tutorialTable() {
  $('#tutRows').innerHTML = TUTORIAL.map((s, i) => {
    const names = { board: 'Spielfeld (Riss, Weg, Bastion)', route: 'Wegzahl in der Statusleiste', spot: 'Leuchtendes Feld auf der Karte', spot2: 'Leuchtendes Feld auf der Karte', salvo: 'Salve-Knopf', card0: 'Erste Kapsel im Blatt', cardMerge: 'Kapsel mit ×2', keep: 'Knopf Behalten', merge: 'Knopf Verschmelzen', tempo: 'Tempo-Knopf', req: 'Requisition in der Statusleiste', menu: 'Menü-Knopf' };
    return `<tr><td>${i + 1}</td><td>${s.round}</td><td>${names[s.target]}</td><td>${s.text}</td><td>${s.input}</td></tr>`;
  }).join('');
}

iconTable();
tutorialTable();
syncControls();
render();

// For the stills and the browser check.
window.__studie = {
  state,
  tutGoto,
  setScreen,
  measure: () => ({ free: Number(phone.dataset.free), small: Number(phone.dataset.small) }),
  setView(size, orient) { state.size = size; state.orient = orient; syncControls(); render(); },
};
