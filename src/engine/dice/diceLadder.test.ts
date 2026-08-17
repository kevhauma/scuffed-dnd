/**
 * Dice Ladder Decomposition Tests
 *
 * The six rows of Concept 07's confirmation table are the contract; the rest are the greedy edge
 * cases the concept page does not show but a ruleset will hit.
 *
 * **Validates: Concept 07**
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { DiceLadder } from '../../types/config';
import { decomposeValue } from './diceLadder';

/** The sheet's ladder, read from the Calculator's literal `20 | 12 | 6` row (Concept 07) */
const sheetLadder: DiceLadder = {
  id: 'ladder-standard',
  name: 'Standard',
  description: 'The sheet ladder',
  dieSizes: [20, 12, 6],
  showZeroTerms: true,
  remainder: 'flat',
};

/** A decomposition as `[counts…, flat]`, which is how the concept page states one */
function asRow(value: number, ladder: DiceLadder = sheetLadder): number[] {
  const { counts, flat } = decomposeValue(value, ladder);
  return [...counts.map((entry) => entry.count), flat];
}

describe('decomposeValue', () => {
  it.each([
    // Every ✅ row of Concept 07's table, in order
    [10, [0, 0, 1, 4]],
    [11, [0, 0, 1, 5]],
    [16, [0, 1, 0, 4]],
    [18, [0, 1, 1, 0]],
    [32, [1, 1, 0, 0]],
    [39, [1, 1, 1, 1]],
  ])('should reproduce the sheet decomposition of %i', (value, expected) => {
    expect(asRow(value)).toEqual(expected);
  });

  it('should keep one entry per rung, in the ladder order, so a zero rung is still shown', () => {
    expect(decomposeValue(10, sheetLadder).counts).toEqual([
      { size: 20, count: 0 },
      { size: 12, count: 0 },
      { size: 6, count: 1 },
    ]);
  });

  it('should leave a value below the smallest die entirely flat', () => {
    expect(asRow(5)).toEqual([0, 0, 0, 5]);
  });

  it('should leave nothing flat for an exact multiple', () => {
    expect(asRow(6)).toEqual([0, 0, 1, 0]);
    expect(asRow(40)).toEqual([2, 0, 0, 0]);
  });

  it('should decompose zero to nothing at all', () => {
    expect(asRow(0)).toEqual([0, 0, 0, 0]);
  });

  it('should walk arbitrary die sizes, a d100 being data like any other', () => {
    const highLevel: DiceLadder = { ...sheetLadder, dieSizes: [100, 20, 12, 6] };

    expect(asRow(139, highLevel)).toEqual([1, 1, 1, 1, 1]);
  });

  it('should push what a maxPerDie cap refuses down the ladder rather than losing it', () => {
    const capped: DiceLadder = { ...sheetLadder, maxPerDie: 1 };

    // 60 would be 3D20 uncapped; the cap leaves 40, which the lower rungs take as far as they can
    expect(asRow(60, capped)).toEqual([1, 1, 1, 22]);
  });

  it('should cap every rung, not only the largest', () => {
    const capped: DiceLadder = { ...sheetLadder, maxPerDie: 2 };

    // 100 would be 5D20; capped it is 2D20 + 2D12 + 2D6, every rung refusing its third die, and
    // the 24 nothing could take falls to flat
    expect(asRow(100, capped)).toEqual([2, 2, 2, 24]);
  });

  it('should decompose a negative or fractional value to flat-only', () => {
    expect(asRow(-7)).toEqual([0, 0, 0, -7]);
    expect(asRow(10.5)).toEqual([0, 0, 0, 10.5]);
  });

  it('should decompose to flat-only when the ladder has no rungs', () => {
    const empty: DiceLadder = { ...sheetLadder, dieSizes: [] };

    expect(decomposeValue(39, empty)).toEqual({ counts: [], flat: 39 });
  });

  it('should never add value back through a cap the validator would reject', () => {
    const broken: DiceLadder = { ...sheetLadder, maxPerDie: -3 };

    expect(asRow(39, broken)).toEqual([0, 0, 0, 39]);
  });

  it('should skip a rung the validator would reject rather than poisoning the whole walk', () => {
    // A hand-edited file can hold anything; one unusable size costs its own rung and nothing else
    const broken: DiceLadder = { ...sheetLadder, dieSizes: [20, Number.NaN, 6] };

    expect(asRow(39, broken)).toEqual([1, 0, 3, 1]);
  });

  it('should conserve the input: flat plus every die face value is the value again', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5000 }), (value) => {
        const { counts, flat } = decomposeValue(value, sheetLadder);
        const fromDice = counts.reduce((sum, entry) => sum + entry.size * entry.count, 0);

        expect(fromDice + flat).toBe(value);
      })
    );
  });

  it('should leave a flat remainder smaller than the smallest die', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5000 }), (value) => {
        expect(decomposeValue(value, sheetLadder).flat).toBeLessThan(6);
      })
    );
  });
});
