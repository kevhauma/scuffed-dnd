/**
 * Dice Simulator
 *
 * Rolls a combat skill's `DiceConfig` and reports every individual die result.
 * Pure: the randomness is a parameter, so callers that need determinism inject their own source.
 *
 * **Validates: Requirements 5.5**
 */

import type { DiceConfig } from '../../types/config';
import type { DiceRollResult } from '../../types/formula';

/**
 * A source of randomness returning a number in `[0, 1)` — the shape of `Math.random`
 */
export type RandomSource = () => number;

/**
 * Die type to its number of sides, in ascending order
 *
 * The order here is the order results come back in, so a breakdown always reads d4 → d20.
 */
export const DIE_SIDES = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
} as const satisfies Record<keyof DiceConfig, number>;

/**
 * Every die type, ascending
 */
export const DIE_TYPES = Object.keys(DIE_SIDES) as DiceRollResult['dieType'][];

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

/**
 * Roll a dice configuration
 *
 * @param dice - Count per die type, e.g. `{ d4: 0, d6: 2, ... }`
 * @param rng - Source of randomness; defaults to `Math.random`
 * @returns One result per die type with a count above zero, ascending by die size
 */
export function rollDice(dice: DiceConfig, rng: RandomSource = Math.random): DiceRollResult[] {
  const results: DiceRollResult[] = [];

  for (const dieType of DIE_TYPES) {
    const count = dice[dieType];

    // Die types the User did not include are absent from the breakdown, not zero entries
    if (!count || count <= 0) continue;

    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(rollDie(DIE_SIDES[dieType], rng));
    }

    results.push({
      dieType,
      rolls,
      total: rolls.reduce((sum, roll) => sum + roll, 0),
    });
  }

  return results;
}

/**
 * Sum every die in a breakdown
 *
 * @param diceResults - Per-die-type results
 * @returns The combined total, `0` for an empty breakdown
 */
export function sumDiceResults(diceResults: DiceRollResult[]): number {
  return diceResults.reduce((sum, result) => sum + result.total, 0);
}
