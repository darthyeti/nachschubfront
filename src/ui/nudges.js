// Which disc calls for attention (balancing round 5, 09.10.2026).
//
// Three new players, seven matches: not one command used, with up to 34 points
// lying idle, and supply bought late or never while requisition piled up past
// 1500. Both discs were on the screen the whole time; nothing said they were
// the thing to press. A calling disc wears a pulsing ring (ui/style.css), and
// only while the call is true — it is a pointer, not a reminder.
//
// Pure functions of the state, so they can be checked without a browser.

import { canBuySupply } from '../sim/economy.js';

/**
 * How much more than the price has to lie in the purse before the supply disc
 * calls: twice the price is money that is not waiting for anything else.
 */
export const SUPPLY_SURPLUS = 2;

/**
 * A command calls while it can be used and no command has been used in this
 * match yet. Whoever has found the rail once needs no pointer to it.
 * @param {object} state
 * @param {{usable: boolean}} status  From commandStatus (sim/commands.js).
 */
export function commandCalls(state, status) {
  return status.usable && Object.keys(state.commandUses).length === 0;
}

/**
 * The supply disc calls in the planning when the next level is for sale and
 * the purse holds a real surplus over its price.
 */
export function supplyCalls(state) {
  const check = canBuySupply(state);
  return check.ok && state.requisition >= check.cost * SUPPLY_SURPLUS;
}
