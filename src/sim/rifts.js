// Which rift attacks in which wave, on maps with more than one (M7b,
// docs/meilensteine/M7b-king-of-the-hill.md, B2).
//
// The order hangs on the seed and the wave alone. Each block of waves draws from
// its own fork of the seed (`fork('rifts').fork(block)`), never from a stream
// the match also uses, so no other roll can move it and a replay reproduces it
// without knowing anything else about the match.

import { createRng } from '../core/random.js';

/** The order of the rifts within one block of `count` waves: a permutation. */
export function blockOrder(seed, block, count) {
  const ids = Array.from({ length: count }, (_, i) => i);
  const order = createRng(seed).fork('rifts').fork(block).shuffle(ids);
  // A block never opens with the rift the block before closed on. Swapping the
  // first two keeps it a permutation, so nothing repeats inside the block either.
  if (block > 0 && count > 1 && order[0] === blockOrder(seed, block - 1, count)[count - 1]) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

/**
 * What each `riftOrder` of a mode record means (src/data/modes.js).
 *
 * - `cycle`: strictly in the order of the rifts, round and round.
 * - `mixed`: blocks of as many waves as there are rifts, each block every rift
 *   once in a shuffled order, and never the same rift twice in a row.
 */
export const RIFT_ORDERS = {
  cycle: (seed, wave, count) => (wave - 1) % count,
  mixed: (seed, wave, count) => blockOrder(seed, Math.floor((wave - 1) / count), count)[(wave - 1) % count],
};

/**
 * The index of the rift that attacks in `wave` (1-based). Always 0 on a map with
 * a single rift.
 * @param {{seed: string|number, mode: object}} state
 */
export function riftForWave(state, wave) {
  const count = state.mode?.map?.rifts?.length ?? 1;
  if (count <= 1) return 0;
  const order = RIFT_ORDERS[state.mode.riftOrder ?? 'mixed'];
  if (!order) throw new Error(`Unknown rift order: ${state.mode.riftOrder}`);
  return order(state.seed, Math.max(1, wave), count);
}
