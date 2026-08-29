/**
 * Formula Function Library
 *
 * The closed set of functions callable from formulas. Names are lowercase and reserved;
 * lookup is case-sensitive, so `ROUND` is an unknown function, not this library's `round`.
 * No user-defined functions.
 *
 * Rounding follows the source sheet's Excel semantics:
 * - `round` is half-away-from-zero: `round(1.5) = 2`, `round(-0.5) = -1`
 * - `roundup` rounds away from zero (settling binary noise the way Excel does first — see
 *   {@link roundAwayFromZero}), `rounddown` toward zero
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
 * Significant digits an argument is settled to before it is rounded away from zero
 *
 * **Excel's own number, and it is Excel's for the same reason.** The workbook settles a computed
 * value to 15 significant digits before it rounds, which is why `ROUNDUP(0.2*12 + 0.1*6, 0)` is 3
 * there and not 4. A double carries about 17, so the top two are where binary noise lives.
 */
const SETTLED_DIGITS = 15;

/**
 * Away-from-zero rounding — what `roundup` means here (Excel ROUNDUP)
 *
 * Exported because system arithmetic outside the evaluator has to round the *same* way a User
 * formula spelling `roundup` would: the race blend (TICKET-RACE-02) is written as `roundup` on its
 * concept page, and a bare `Math.ceil` would answer -1 where the formula engine answers -2.
 *
 * ## It settles binary noise first, and that is not an optimisation (TICKET-SKL-04)
 *
 * Rounding **away from zero has no tolerance for floating-point error**, because every integer is a
 * boundary: `0.2 × 12 + 0.1 × 6` is `3.0000000000000004` as a double, and rounding that up buys a
 * whole extra unit the sheet never gives. At the source workbook's own skill weights there are 142
 * such stat pairs in a 0–100 × 0–100 grid, so it is ordinary rather than pathological. The argument
 * is therefore settled to {@link SETTLED_DIGITS} first — Excel's rule, quoted rather than invented,
 * and verified to agree with the exact decimal ceiling on every weight the corpus can express.
 *
 * **The settle lives here rather than in a caller**, which is the whole point: `FORMULA_FUNCTIONS`'
 * `roundup`, the race blend (`statCalculator`) and the skill level and bonus (`skillCalculator`) are
 * all this one function, so a User formula and the engine **cannot** answer differently on the same
 * arithmetic. A settle in `skillCalculator` alone would have made this module's own promise false.
 *
 * **The sibling directions are deliberately untouched, and this is the record of that decision.**
 * `round` cannot be bitten — noise that small never crosses a `.5` boundary — so half-away-from-zero
 * needs nothing and gets nothing. `rounddown`, `floor` and `ceil` have the mirror hazard
 * (`Math.trunc(2.9999999999999996)` is 2 where Excel's `ROUNDDOWN` says 3) and are **left literal
 * here**: no system arithmetic calls them, so the only thing changing them moves is User-authored
 * formula results, which is a decision of its own rather than a consequence of a skills ticket. A
 * ticket that gives one of them a system caller should settle it in the same change.
 */
export function roundAwayFromZero(x: number): number {
  const digits = x.toPrecision(SETTLED_DIGITS);
  const settled = Number(digits);

  return Math.sign(settled) * Math.ceil(Math.abs(settled));
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
