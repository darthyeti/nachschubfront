// The HUD symbols, drawn after reference/konzept/hud/hud-uebersicht.svg.
//
// The sheet is a flat view without ids, so the symbols are rebuilt here instead
// of imported (docs/ART.md, "HUD"). They are inline SVG rather than sprites:
// they sit in the DOM layer above the canvas, never on it, and at 24 units they
// cost nothing to draw.
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

export const ICONS = {
  // ---------- Status bar ----------

  /** Wave: a standard, pole and pennant. */
  wave: `
    <path d="M7 3.5 V20.5" stroke="${INK}" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M7 3.5 V20.5" stroke="${STONE}" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <path d="M8.2 4.6 L18.5 8.4 L8.2 12.2 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
  `,

  /** Bastion lives: the battlement of the bastion itself. */
  lives: `
    <path d="M4 10 h3 v-3 h3 v3 h4 v-3 h3 v3 h3 v10 H4 Z" fill="${STONE}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M10.5 20 v-5 h3 v5" fill="${STONE_DARK}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
  `,

  /** Supply level: the receiving antenna on its foot. */
  supply: `
    <path d="M4.6 10.4 A9.4 9.4 0 0 1 19.4 10.4" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M4.6 10.4 A9.4 9.4 0 0 1 19.4 10.4" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"/>
    <path d="M7.4 12.6 A6 6 0 0 1 16.6 12.6" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M7.4 12.6 A6 6 0 0 1 16.6 12.6" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 6.5 V18" stroke="${INK}" stroke-width="3.8" stroke-linecap="round" fill="none"/>
    <path d="M12 6.5 V18" stroke="${STONE}" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <circle cx="12" cy="6.4" r="1.8" fill="${GOLD}" stroke="${INK}" stroke-width="1.4"/>
    <path d="M8 18 h8 l-1.6 3 h-4.8 Z" fill="${STONE}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
  `,

  /** Requisition: a coin with the war mark stamped into it. */
  requisition: `
    <circle cx="12" cy="12" r="8.4" fill="${GOLD_DARK}" stroke="${INK}" stroke-width="1.8"/>
    <circle cx="12" cy="12" r="6" fill="${GOLD}" stroke="${INK}" stroke-width="1.4"/>
    <path d="M8.6 9.6 h6.8 L12 15.6 Z" fill="${INK}"/>
  `,

  /** Command points: the star the sketch stamps on their plate. */
  points: `
    <path d="M12 3.6 L14.4 9.6 L20.8 10 L15.9 14.1 L17.5 20.3 L12 16.8 L6.5 20.3 L8.1 14.1 L3.2 10 L9.6 9.6 Z"
      fill="${CYAN}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
  `,

  /** Route length: the dotted path from the rift to the bastion. */
  route: `
    <path d="M5 16 C7.5 8.5 16.5 8.5 19 15" stroke="${STONE_DARK}" stroke-width="2.4" stroke-linecap="round"
      stroke-dasharray="1.6 2.6" fill="none"/>
    <circle cx="5" cy="16.4" r="1.9" fill="${GOLD}" stroke="${INK}" stroke-width="1.2"/>
    <circle cx="19" cy="15.4" r="1.9" fill="${BLOOD}" stroke="${INK}" stroke-width="1.2"/>
  `,

  /** Recipes: the codex, a bound book. */
  codex: `
    <path d="M5 4.5 h6.2 a1.6 1.6 0 0 1 1.6 1.6 V20 a1.6 1.6 0 0 0 -1.6 -1.6 H5 Z"
      fill="${STONE_DARK}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M19 4.5 h-6.2 a1.6 1.6 0 0 0 -1.6 1.6 V20 a1.6 1.6 0 0 1 1.6 -1.6 H19 Z"
      fill="${STONE}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M14 9 h3 M14 12 h3" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>
  `,

  /** Menu: three plates on a rack. */
  menu: `
    <path d="M5 7.5 h14 M5 12 h14 M5 16.5 h14" stroke="${STONE}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
  `,

  // ---------- Bottom bar ----------

  /** Demolish: the bin from the sketch, slats and all. */
  demolish: `
    <path d="M4.6 7.2 h14.8" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
    <path d="M10 5 h4 v2.2 h-4 Z" fill="${STONE}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M6.2 8.4 h11.6 l-1.3 11.4 h-9 Z" fill="${STONE}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M9.6 10.6 v7 M12 10.6 v7 M14.4 10.6 v7" stroke="${STONE_DARK}" stroke-width="1.5" stroke-linecap="round" fill="none"/>
  `,

  /** Bulwark: stacked blocks under one straight crown (docs/ART.md, "Bollwerk"). */
  bulwark: `
    <path d="M3.6 8.4 h16.8 v3.2 H3.6 Z" fill="${STONE}" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="M4.6 11.6 h14.8 v8 H4.6 Z" fill="${STONE_DARK}" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="M9.6 11.6 v3.6 M14.4 11.6 v3.6 M7.2 15.2 h9.6 M12 15.2 v4.4" stroke="${INK}" stroke-width="1.2" fill="none"/>
  `,

  /** Supply salvo: the pod itself, light and all. */
  salvo: `
    <path d="M8.8 3.8 h6.4 l3.2 15.4 h-12.8 Z" fill="${STONE}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M8.8 3.8 h6.4 l.6 3 h-7.6 Z" fill="${INK}"/>
    <rect x="10.1" y="10.2" width="3.8" height="3.8" fill="${BLOOD}" stroke="${INK}" stroke-width="1.4"/>
    <path d="M4.6 20.4 h14.8" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  `,

  // ---------- Commands ----------

  /** Orbital strike: the mark, the star at its centre, the streak coming down. */
  orbitalStrike: `
    <circle cx="11" cy="13" r="7.4" fill="none" stroke="${GOLD}" stroke-width="1.8"/>
    <circle cx="11" cy="13" r="3.6" fill="none" stroke="${GOLD_DARK}" stroke-width="1.5"/>
    <path d="M11 3.8 v3 M11 19.2 v3 M1.8 13 h3 M17.2 13 h3" stroke="${GOLD}" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <path d="M11 9.4 L12.6 13 L11 16.6 L9.4 13 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M13.6 11 L19.6 4.4" stroke="${FIRE}" stroke-width="3" stroke-linecap="round" fill="none"/>
  `,

  /** Stasis field: the cold star, frozen mid-turn. */
  stasisField: `
    <path d="M4 12 h16 M12 4 v16" stroke="${CYAN}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    <path d="M6.6 6.6 L17.4 17.4 M17.4 6.6 L6.6 17.4" stroke="#3fa8d8" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M9.4 6.6 L12 9.2 L14.6 6.6 M9.4 17.4 L12 14.8 L14.6 17.4" stroke="${CYAN}" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  `,

  /** Priority supply: a pod with the signal going up ahead of it. */
  prioritySupply: `
    <path d="M9.6 11 h4.8 l2 8.6 h-8.8 Z" fill="${STONE}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M6.4 8.6 L12 3.6 L17.6 8.6" fill="none" stroke="${GOLD}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M7.6 12.6 L12 8.4 L16.4 12.6" fill="none" stroke="${GOLD_DARK}" stroke-width="1.8" stroke-linecap="round"
      stroke-linejoin="round" opacity=".7"/>
  `,

  /** Holy banner: pole, finial and the skull on the cloth. */
  holyBanner: `
    <circle cx="7" cy="3.9" r="1.7" fill="${GOLD}" stroke="${INK}" stroke-width="1.3"/>
    <path d="M7 5.4 V21" stroke="${INK}" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M7 5.4 V21" stroke="${STONE}" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <path d="M8.2 6.2 L19 10.8 L8.2 15.4 Z" fill="${BLOOD}" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>
    <circle cx="12" cy="10.8" r="2.1" fill="${STONE}" stroke="${INK}" stroke-width="1.1"/>
    <path d="M11.2 10.5 v.9 M12.8 10.5 v.9" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>
  `,

  /** Airstrike: the strafing run, two fields wide. */
  airstrike: `
    <path d="M3.4 14.6 L20.6 8.2" stroke="${STONE_DARK}" stroke-width="1.6" stroke-dasharray="2 2.4"
      stroke-linecap="round" fill="none"/>
    <path d="M20.6 11.2 L8.6 5.4 L11 11.2 L8.6 17 Z"
      fill="${STONE}" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round" transform="rotate(-20 12 12)"/>
  `,

  // ---------- States ----------

  /** The padlock on a command that is still to come. */
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
