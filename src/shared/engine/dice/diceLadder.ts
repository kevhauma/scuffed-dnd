/**
 * Dice Ladder
 *
 * Turns a single number into a dice pool by walking a configured ladder of die sizes greedily,
 * largest first, with whatever will not fill another die left as a flat bonus (Concept 07) — then
 * rolls that pool and prints it the way the sheet prints it (TICKET-ROLL-04).
 *
 * The decomposition is pure and total: every input produces one, including the inputs a ladder
 * cannot really express. Only the roll is non-deterministic, and its randomness is a parameter.
 *
 * ## The flat term is `ROUND`ed, because the sheet rounds it (TICKET-ROLL-08)
 *
 * The v4 workbook spells the ladder out as three `INT`s and one `ROUND`
 * (`Background Charater Sheet Calcu` AB2:AG8): `INT(value/20)` D20s, `INT` D12s, `INT` D6s, and
 * `ROUND(remainder, 0)` into the flat. Excel's `ROUND` breaks a tie **away from zero** — which is
 * `roundHalfAwayFromZero`, the same rule a User formula spelling `round` gets, and *not*
 * `Math.round`, which answers `-2` where Excel answers `-3`. Endurance's 22.4 is what made this
 * reachable: it decomposes to `1D20 + 0D12 + 0D6 + 2`.
 *
 * **Validates: Concept 07**
 */

import type { DiceLadder } from '../../types/config';
import type { DieRollResult } from '../../types/formula';
import { roundHalfAwayFromZero } from '../formula/functions';
import { type RandomSource, rollDie } from './diceSimulator';

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
 * **A fractional value walks like any other and its fraction lands in the flat**, which the module
 * header's `ROUND` then settles: `22.4 → 1D20 + 0D12 + 0D6 + 2` (TICKET-ROLL-08). The rounding is
 * the *last* step and nothing re-walks after it, exactly as the sheet's four independent cells
 * behave — so a `5.6` under a `[20, 12, 6]` ladder is `0D20 + 0D12 + 0D6 + 6`, a flat that has
 * grown to the size of the smallest die rather than becoming a die.
 *
 * **A value the ladder cannot take apart becomes flat-only**: a negative value has no whole dice in
 * it, and neither has a `NaN` or an infinity out of a broken formula, so all three come back as
 * every rung at zero with the rounded value in `flat`. That is the honest reading — the alternative
 * is a pool that drops the value it could not walk.
 *
 * `flat + Σ(size × count)` is therefore the input for every integer value, and the input **rounded
 * to the nearest whole** for a fractional one. A pool cannot express a fraction, and the sheet
 * chooses the rounded pool over an unrollable one.
 *
 * @param value - The number to express as dice
 * @param ladder - The ladder to walk
 * @returns One count per rung, in ladder order, plus the rounded leftover
 */
export function decomposeValue(value: number, ladder: DiceLadder): LadderDecomposition {
  const counts: DieCount[] = ladder.dieSizes.map((size) => ({ size, count: 0 }));

  // A value with no whole dice in it has nothing to walk. `NaN` is here rather than left to the
  // walk because `Math.max(0, NaN)` is `NaN`, which would poison every rung as well as the flat
  if (!Number.isFinite(value) || value < 0) {
    return { counts, flat: roundFlat(value) };
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

  return { counts, flat: roundFlat(remaining) };
}

/**
 * The flat term as the sheet writes it — `ROUND(remainder, 0)` (TICKET-ROLL-08)
 *
 * `roundHalfAwayFromZero` is the shared spelling of Excel's `ROUND`, so the ladder's remainder and
 * a User formula calling `round` break a `.5` the same way. The zero normalisation is not cosmetic:
 * `roundHalfAwayFromZero` multiplies a `-1` sign by a rounded `0`, so a remainder like `-0.4` comes
 * back as `-0`, and a decomposition holding `-0` would
 * compare unequal to one holding `0` for every reader that uses `Object.is`, tests included.
 *
 * `NaN` and the infinities pass straight through, because a flat that is not a number has to stay
 * visibly not a number rather than being rounded into a plausible one (Concept 00 §7).
 */
function roundFlat(remainder: number): number {
  const rounded = roundHalfAwayFromZero(remainder);
  return rounded === 0 ? 0 : rounded;
}

/**
 * A rolled pool: what each rung produced, the flat it carries, and the number that matters
 *
 * `DieRollResult` lives in `types/formula.ts` since TICKET-ROLL-06, because `RollOutcome` carries
 * it and `types/` cannot import from `engine/`. It replaced the old six-name `DiceRollResult`
 * union outright — there is one dice-result shape.
 */
export interface LadderRollResult {
  /** One entry per rung of the decomposition, in ladder order — a rung with no dice included */
  dice: DieRollResult[];
  flat: number;
  /** Σ every die, plus the flat */
  total: number;
}

/**
 * Roll a decomposed pool (Concept 07, TICKET-ROLL-04)
 *
 * Takes a decomposition rather than a value and a ladder, so rolling cannot disagree with what the
 * sheet displayed: the same `LadderDecomposition` is shown and rolled. Randomness is a parameter,
 * per the convention `rollDice`/`rollCombatSkill` set — production callers pass nothing, and a test
 * injects a sequence rather than spying on `Math.random`.
 *
 * A rung with no dice is **still an entry**, with empty `rolls` and a zero total, for the same
 * reason `decomposeValue` keeps it: whether `0D20` is shown is `showZeroTerms`'s decision at
 * display time, and dropping the rung here would take that decision away.
 *
 * @param decomposition - What to roll
 * @param rng - Source of randomness; defaults to `Math.random`
 * @returns Per-rung results, the flat, and their sum
 */
export function rollDecomposition(
  decomposition: LadderDecomposition,
  rng: RandomSource = Math.random
): LadderRollResult {
  const dice: DieRollResult[] = decomposition.counts.map(({ size, count }) => {
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(rollDie(size, rng));
    }

    return { size, rolls, total: rolls.reduce((sum, roll) => sum + roll, 0) };
  });

  return {
    dice,
    flat: decomposition.flat,
    total: dice.reduce((sum, rung) => sum + rung.total, 0) + decomposition.flat,
  };
}

/**
 * Render a decomposed pool the way the sheet renders it (Concept 07, TICKET-ROLL-04)
 *
 * `0D20 + 0D12 + 1D6 + 4` — **descending, uppercase `D`, flat term always present**. Every one of
 * those is the opposite of `formatDiceNotation`'s `2d6 + 1d20`, which is why they are two functions
 * rather than one with a flag: the legacy `DiceConfig` notation ascends, strips zero terms and has
 * no flat to render. Both live until TICKET-ROLL-06 deletes the older one; this is the single
 * definition for ladder pools.
 *
 * Descending order is not sorted here — it is the order the decomposition already has, which is the
 * ladder's own, which `engine/validator.ts` requires to be descending. Sorting would hide a
 * misordered ladder that the report is there to surface.
 *
 * @param decomposition - The pool to render
 * @param ladder - The ladder it came from, for `showZeroTerms`
 * @returns e.g. `"1D20 + 1D12 + 1D6 + 1"`, or just the flat when no rung is rendered
 */
export function formatLadderNotation(
  decomposition: LadderDecomposition,
  ladder: DiceLadder
): string {
  const terms = decomposition.counts
    .filter(({ count }) => ladder.showZeroTerms || count > 0)
    .map(({ size, count }) => `${count}D${size}`);

  // A negative flat only arises from an input the ladder could not take apart, but it has to read
  // as arithmetic rather than as `+ -7`
  const flat =
    decomposition.flat < 0 ? `- ${Math.abs(decomposition.flat)}` : `+ ${decomposition.flat}`;

  // With no dice terms there is nothing for the flat to be added *to*, so it stands alone
  return terms.length === 0 ? `${decomposition.flat}` : `${terms.join(' + ')} ${flat}`;
}
