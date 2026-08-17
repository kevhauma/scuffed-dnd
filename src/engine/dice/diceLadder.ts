/**
 * Dice Ladder Decomposition
 *
 * Turns a single number into a dice pool by walking a configured ladder of die sizes greedily,
 * largest first, with whatever will not fill another die left as a flat bonus (Concept 07).
 *
 * Pure and total: every input produces a decomposition, including the ones a ladder cannot really
 * express. Rolling the result and rendering it as notation are TICKET-ROLL-04.
 *
 * **Validates: Concept 07**
 */

import type { DiceLadder } from '../../types/config';

/**
 * How many dice of one size a decomposition asks for
 *
 * A rung with `count: 0` is still an entry, because the sheet shows `0D20` and `showZeroTerms`
 * decides that at *display* time — dropping it here would take the choice away from the ladder.
 */
export interface DieCount {
  size: number;
  count: number;
}

/**
 * A value expressed as dice plus a leftover
 *
 * `counts` has one entry per rung of the ladder, in the ladder's own order, so a caller can render
 * `0D20 + 0D12 + 1D6` without knowing anything about the walk. `flat` is what no die could take.
 */
export interface LadderDecomposition {
  counts: DieCount[];
  flat: number;
}

/**
 * Decompose a value into a dice pool (Concept 07)
 *
 * Greedy: each rung takes as many whole dice as the remaining value allows, capped by the ladder's
 * `maxPerDie`, and what a cap refuses falls to the next rung down rather than being lost. The
 * sheet's `[20, 12, 6]` seed gives `10 → 0D20 + 0D12 + 1D6 + 4` and `39 → 1D20 + 1D12 + 1D6 + 1`.
 *
 * **A value the ladder cannot take apart becomes flat-only**: a negative value has no whole dice in
 * it and a fractional one cannot be spelled as a count, so both come back as every rung at zero
 * with the value intact in `flat`. That is the honest reading — the alternative is a pool whose
 * total silently disagrees with the number it came from — and it keeps the invariant every consumer
 * relies on: `flat + Σ(size × count)` is always the input.
 *
 * @param value - The number to express as dice
 * @param ladder - The ladder to walk
 * @returns One count per rung, in ladder order, plus the leftover
 */
export function decomposeValue(value: number, ladder: DiceLadder): LadderDecomposition {
  const counts: DieCount[] = ladder.dieSizes.map((size) => ({ size, count: 0 }));

  // A value with no whole dice in it has nothing to walk
  if (!Number.isInteger(value) || value < 0) {
    return { counts, flat: value };
  }

  let remaining = value;

  for (const rung of counts) {
    // A ladder is validated, not trusted: a rung the validator would reject — zero, negative, a
    // fraction, `NaN` from a hand-edited file — is skipped rather than divided by, so one bad size
    // costs its own rung instead of poisoning every count and the flat with `NaN`
    if (!Number.isInteger(rung.size) || rung.size <= 0) continue;

    const affordable = Math.floor(remaining / rung.size);
    const capped =
      ladder.maxPerDie === undefined ? affordable : Math.min(affordable, ladder.maxPerDie);

    // A cap the validator would reject (0, negative, fractional) must not make the walk *add*
    // value back, so a rung takes a whole non-negative number of dice or none
    rung.count = Math.max(0, Math.floor(capped));
    remaining -= rung.count * rung.size;
  }

  return { counts, flat: remaining };
}
