/**
 * Formula Function Library
 *
 * The closed set of functions callable from formulas. Names are lowercase and reserved;
 * lookup is case-sensitive, so `ROUND` is an unknown function, not this library's `round`.
 * No user-defined functions.
 *
 * Rounding follows the source sheet's Excel semantics:
 * - `round` is half-away-from-zero: `round(1.5) = 2`, `round(-0.5) = -1`
 * - `roundup` rounds away from zero, `rounddown` toward zero
 * - `floor` / `ceil` round toward -∞ / +∞
 *
 * **Validates: Concepts 01 (Stat, APT), 02 (Skill, bonus rounding); spec §5.3**
 */

/**
 * A formula-callable function: arity bounds plus the implementation.
 * `maxArgs: null` means variadic (no upper bound).
 */
export interface FormulaFunction {
  minArgs: number;
  maxArgs: number | null;
  apply: (args: number[]) => number;
}

/**
 * Half-away-from-zero rounding (Excel ROUND)
 *
 * Exported for the same reason `roundAwayFromZero` is: a skill's bonus is `round(level /
 * bonus_divider)` in Concept 02, computed by the calculator rather than by a User formula, and it
 * has to round the way a formula spelling `round` would. `Math.round(-0.5)` is `-0` and this is
 * `-1`; more to the point, Concept 02 verifies level 7.5 → bonus 2, which is the case that tells
 * the two apart at the boundary.
 */
export function roundHalfAwayFromZero(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x));
}

/**
 * Away-from-zero rounding — what `roundup` means here (Excel ROUNDUP)
 *
 * Exported because system arithmetic outside the evaluator has to round the *same* way a User
 * formula spelling `roundup` would: the race blend (TICKET-RACE-02) is written as `roundup` on its
 * concept page, and a bare `Math.ceil` would answer -1 where the formula engine answers -2.
 */
export function roundAwayFromZero(x: number): number {
  return Math.sign(x) * Math.ceil(Math.abs(x));
}

/**
 * The closed function library, keyed by (lowercase, reserved) name
 */
export const FORMULA_FUNCTIONS: Record<string, FormulaFunction> = {
  round: {
    minArgs: 1,
    maxArgs: 1,
    apply: ([x]) => roundHalfAwayFromZero(x),
  },
  roundup: {
    minArgs: 1,
    maxArgs: 1,
    apply: ([x]) => roundAwayFromZero(x),
  },
  rounddown: {
    minArgs: 1,
    maxArgs: 1,
    apply: ([x]) => Math.trunc(x),
  },
  floor: {
    minArgs: 1,
    maxArgs: 1,
    apply: ([x]) => Math.floor(x),
  },
  ceil: {
    minArgs: 1,
    maxArgs: 1,
    apply: ([x]) => Math.ceil(x),
  },
  min: {
    minArgs: 1,
    maxArgs: null,
    apply: (args) => Math.min(...args),
  },
  max: {
    minArgs: 1,
    maxArgs: null,
    apply: (args) => Math.max(...args),
  },
  clamp: {
    minArgs: 3,
    maxArgs: 3,
    apply: ([x, lo, hi]) => Math.min(Math.max(x, lo), hi),
  },
  abs: {
    minArgs: 1,
    maxArgs: 1,
    apply: ([x]) => Math.abs(x),
  },
};

/**
 * Describe a function's expected argument count for validation messages
 */
export function describeArity(fn: FormulaFunction): string {
  if (fn.maxArgs === null) {
    return `at least ${fn.minArgs} argument${fn.minArgs === 1 ? '' : 's'}`;
  }
  if (fn.minArgs === fn.maxArgs) {
    return `exactly ${fn.minArgs} argument${fn.minArgs === 1 ? '' : 's'}`;
  }
  return `between ${fn.minArgs} and ${fn.maxArgs} arguments`;
}
