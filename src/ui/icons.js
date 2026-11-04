// The HUD symbols (M10 E1), after the icon set of reference/studien/handy-bedienung.js
// (ICON_ROWS, reference/konzept/handy/neu-ikonen.png).
//
// They are inline SVG rather than sprites: they sit in the DOM layer above the
// canvas, never on it, and at 24 units they cost nothing to draw. Each one is a
// thing one can name, not a sign one has to learn (docs/ART.md, "HUD und Ikonen").
//
// House rules from the style test apply: dark ink outline, flat fills, no soft
// gradients. Everything lives in a 24x24 box with its weight in the middle.

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

export const ICONS = {
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
  orbitalStrike: `
    <circle cx="11" cy="13" r="7.4" fill="none" stroke="${GOLD}" stroke-width="1.8"/>
    <circle cx="11" cy="13" r="3.6" fill="none" stroke="${GOLD_DARK}" stroke-width="1.5"/>
    <path d="M11 3.8 v3 M11 19.2 v3 M1.8 13 h3 M17.2 13 h3" stroke="${GOLD}" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <path d="M11 9.4 L12.6 13 L11 16.6 L9.4 13 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M13.6 11 L19.6 4.4" stroke="${FIRE}" stroke-width="3" stroke-linecap="round" fill="none"/>
  `,
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
  holyBanner: `
    <circle cx="7" cy="3.9" r="1.7" fill="${GOLD}" stroke="${INK}" stroke-width="1.3"/>
    <path d="M7 5.4 V21" stroke="${INK}" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M7 5.4 V21" stroke="${STONE}" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <path d="M8.2 6.2 L19 10.8 L8.2 15.4 Z" fill="${BLOOD}" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>
    <circle cx="12" cy="10.8" r="2.1" fill="${STONE}" stroke="${INK}" stroke-width="1.1"/>
    <path d="M11.2 10.5 v.9 M12.8 10.5 v.9" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>
  `,
  airstrike: `
    <path d="M3.7 9.8 h16.6 v3.4 H3.7 Z" fill="${STONE}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M3.7 9.8 h1.9 v3.4 H3.7 Z M18.4 9.8 h1.9 v3.4 h-1.9 Z" fill="#b0643a" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M9.6 3 h4.9 l1 2.9 v10.2 l-1 1.5 H9.6 l-1-1.5 V5.9 Z" fill="${STONE_DARK}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M10.1 4 h3.9 l.5 1.9 H9.6 Z" fill="#3f6a80" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M8.6 7.4 h6.8 v1 H8.6 Z" fill="${BLOOD}" stroke="${INK}" stroke-width="0.9"/>
    <path d="M6.9 13.7 a1.2 1.2 0 0 1 1.2 1.2 v2.5 a1.2 1.2 0 0 1 -2.4 0 v-2.5 a1.2 1.2 0 0 1 1.2 -1.2 Z
             M17.1 13.7 a1.2 1.2 0 0 1 1.2 1.2 v2.5 a1.2 1.2 0 0 1 -2.4 0 v-2.5 a1.2 1.2 0 0 1 1.2 -1.2 Z"
      fill="#6f655b" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M10.1 17.1 h.9 v2.4 h-.9 Z M13 17.1 h.9 v2.4 H13 Z" fill="${STONE}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M6.2 19.1 l.7 1.9 .7-1.9 Z M16.4 19.1 l.7 1.9 .7-1.9 Z" fill="${FIRE}" stroke="${INK}" stroke-width="1"/>
  `,
  lock: `
    <path d="M8.4 11 V8.6 a3.6 3.6 0 0 1 7.2 0 V11" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>
    <path d="M8.4 11 V8.6 a3.6 3.6 0 0 1 7.2 0 V11" fill="none" stroke="#cfc8bc" stroke-width="2.2" stroke-linecap="round"/>
    <rect x="6.6" y="11" width="10.8" height="8.6" rx="1.2" fill="#cfc8bc" stroke="${INK}" stroke-width="1.8"/>
    <circle cx="12" cy="15.3" r="1.5" fill="${INK}"/>
  `,
};

/**
 * Builds one symbol as an inline SVG element.
 *
 * @param {keyof ICONS} name
 * @param {string} [className]
 */
export function icon(name, className) {
  const markup = ICONS[name];
  if (!markup) throw new Error(`Unknown icon: ${name}`);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (className) svg.setAttribute('class', className);
  svg.innerHTML = markup;
  return svg;
}
