/**
 * Dice Simulator
 *
 * A single die roll, and the randomness convention the rest of the app follows.
 *
 * Everything else that lived here went with `DiceConfig` in TICKET-ROLL-06: `rollDice`, `DIE_SIDES`,
 * `DIE_TYPES` and `formatDiceNotation` all keyed off a fixed six-die record, which is the shape the
 * dice ladder replaced. A pool is derived from a character's numbers now — see
 * [`diceLadder.ts`](./diceLadder.ts) — so the only thing a simulator still owes anyone is one die.
 *
 * **Validates: Requirements 5.5**
 */

/**
 * A source of randomness returning a number in `[0, 1)` — the shape of `Math.random`
 */
export type RandomSource = () => number;

/**
 * Roll a single die
 *
 * @param sides - Number of sides
 * @param rng - Source of randomness
 * @returns An integer in `1..sides` inclusive
 */
export function rollDie(sides: number, rng: RandomSource = Math.random): number {
  return Math.floor(rng() * sides) + 1;
}
