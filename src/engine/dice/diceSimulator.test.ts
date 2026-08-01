/**
 * Dice Simulator Tests
 *
 * **Validates: Requirements 5.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { DiceConfig } from '../../types/config';
import {
  DIE_SIDES,
  DIE_TYPES,
  formatDiceNotation,
  rollDice,
  rollDie,
  sumDiceResults,
} from './diceSimulator';

const emptyDice: DiceConfig = { d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0 };

/** A deterministic stand-in for Math.random, cycling through the given values */
function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe('rollDie', () => {
  it('should map the low end of the range to 1 and the high end to the die size', () => {
    expect(rollDie(20, () => 0)).toBe(1);
    expect(rollDie(20, () => 0.999999)).toBe(20);
    expect(rollDie(6, () => 0.5)).toBe(4);
  });
});

describe('rollDice', () => {
  it('should return one result per die type with a count above zero', () => {
    const results = rollDice({ ...emptyDice, d6: 2, d20: 1 });

    expect(results.map((result) => result.dieType)).toEqual(['d6', 'd20']);
  });

  it('should return no entry for a die type with a count of zero', () => {
    const results = rollDice({ ...emptyDice, d8: 3 });

    expect(results).toHaveLength(1);
    expect(results[0].dieType).toBe('d8');
  });

  it('should roll exactly as many dice as the count asks for', () => {
    const results = rollDice({ ...emptyDice, d4: 1, d6: 3, d12: 5 });

    expect(results.find((r) => r.dieType === 'd4')?.rolls).toHaveLength(1);
    expect(results.find((r) => r.dieType === 'd6')?.rolls).toHaveLength(3);
    expect(results.find((r) => r.dieType === 'd12')?.rolls).toHaveLength(5);
  });

  it('should list every individual die result, with total equal to their sum', () => {
    // 0.0 → 1, 0.5 → half the die size, 0.999999 → the die size
    const results = rollDice({ ...emptyDice, d6: 3 }, sequenceRng([0, 0.5, 0.999999]));

    expect(results[0].rolls).toEqual([1, 4, 6]);
    expect(results[0].total).toBe(11);
  });

  it('should return an empty breakdown for an all-zero configuration', () => {
    const results = rollDice(emptyDice);

    expect(results).toEqual([]);
    expect(sumDiceResults(results)).toBe(0);
  });

  it('should be deterministic under a seeded source of randomness', () => {
    const dice: DiceConfig = { ...emptyDice, d4: 2, d20: 2 };
    const seed = [0.1, 0.9, 0.35, 0.75];

    expect(rollDice(dice, sequenceRng(seed))).toEqual(rollDice(dice, sequenceRng(seed)));
  });

  it('should order the breakdown ascending by die size', () => {
    const results = rollDice({ d4: 1, d6: 1, d8: 1, d10: 1, d12: 1, d20: 1 });

    expect(results.map((result) => result.dieType)).toEqual([
      'd4',
      'd6',
      'd8',
      'd10',
      'd12',
      'd20',
    ]);
  });

  it('should keep every rolled value within 1..N for each die type', () => {
    fc.assert(
      fc.property(
        fc.record({
          d4: fc.integer({ min: 0, max: 5 }),
          d6: fc.integer({ min: 0, max: 5 }),
          d8: fc.integer({ min: 0, max: 5 }),
          d10: fc.integer({ min: 0, max: 5 }),
          d12: fc.integer({ min: 0, max: 5 }),
          d20: fc.integer({ min: 0, max: 5 }),
        }),
        (dice: DiceConfig) => {
          const results = rollDice(dice);

          for (const result of results) {
            const sides = DIE_SIDES[result.dieType];

            expect(result.rolls).toHaveLength(dice[result.dieType]);
            for (const roll of result.rolls) {
              expect(Number.isInteger(roll)).toBe(true);
              expect(roll).toBeGreaterThanOrEqual(1);
              expect(roll).toBeLessThanOrEqual(sides);
            }
          }
        }
      )
    );
  });

  it('should keep the breakdown total consistent with the individual rolls', () => {
    fc.assert(
      fc.property(
        fc.record({
          d4: fc.integer({ min: 0, max: 4 }),
          d6: fc.integer({ min: 0, max: 4 }),
          d8: fc.integer({ min: 0, max: 4 }),
          d10: fc.integer({ min: 0, max: 4 }),
          d12: fc.integer({ min: 0, max: 4 }),
          d20: fc.integer({ min: 0, max: 4 }),
        }),
        (dice: DiceConfig) => {
          const results = rollDice(dice);

          // Each type's total is the sum of its own rolls...
          for (const result of results) {
            expect(result.total).toBe(result.rolls.reduce((sum, roll) => sum + roll, 0));
          }

          // ...and the overall total is the sum of every roll made
          const everyRoll = results.flatMap((result) => result.rolls);
          expect(sumDiceResults(results)).toBe(
            everyRoll.reduce((sum, roll) => sum + roll, 0)
          );
        }
      )
    );
  });
});

describe('DIE_TYPES', () => {
  it('should cover all six die types in ascending order', () => {
    expect(DIE_TYPES).toEqual(['d4', 'd6', 'd8', 'd10', 'd12', 'd20']);
  });
});

describe('formatDiceNotation', () => {
  it('should list only die types with a count, ascending', () => {
    expect(formatDiceNotation({ ...emptyDice, d20: 1, d6: 2 })).toBe('2d6 + 1d20');
  });

  it('should return an empty string when no die has a count', () => {
    expect(formatDiceNotation(emptyDice)).toBe('');
  });
});
