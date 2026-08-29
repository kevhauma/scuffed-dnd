/**
 * Skill Calculator
 *
 * A skill's two numbers (Concept 02, TICKET-SKL-02; rounding per TICKET-SKL-04, focus per
 * TICKET-SKL-05):
 *
 * ```
 * level = ceil(Σ (weight × stat value) × focus) + invested
 * bonus = ceil(level / const.bonus_divider)
 * ```
 *
 * The **weights are data**, which is the whole point of the entity: the source sheet re-implements
 * this arithmetic in three tabs, so a global rebalance means finding all three. Here it lives once,
 * and "make bonuses grow faster" is one constant rather than 48 formula edits.
 *
 * ## Rounding is `ROUNDUP`, in both places (TICKET-SKL-04)
 *
 * The v4 workbook's `Background Charater Sheet Calcu` rows 3–50 read
 * `ROUNDUP((primary + secondary) × focus, 0) + investedPoints` and `ROUNDUP(level / 5, 0) + gear`,
 * so **both** halves round up. Until this ticket the level was left fractional and the bonus rounded
 * half-away-from-zero; a half-point of stat scaling disappeared off the sheet, and the display edge
 * papered over it with a `Math.ceil` of its own (`SkillsSection`, now deleted).
 *
 * The round-up is `roundAwayFromZero`, the house spelling of Excel's `ROUNDUP` and the one a User
 * formula writing `roundup` gets — `Math.ceil` answers -1 where both answer -2, and a ruleset is
 * free to weight a skill negatively. It **settles binary noise before it rounds**, which rounding up
 * needs and half-away-from-zero never did; the reason, and the 142-pair case that forced it, are in
 * that function's own JSDoc, where every caller of it inherits them.
 *
 * **Invested points land after the ceil**, exactly as the sheet has them: a bought point is a whole
 * point, never a fraction spent rounding the derived part up.
 *
 * ## The focus multiplier is inside the round-up (TICKET-SKL-05)
 *
 * `focus` is the character's three Setup picks summed into one factor per skill — 0.9 unchosen, 2.1
 * chosen once, 3.3 chosen twice at the sheet's dials — and it belongs *inside* the `ROUNDUP` and
 * *before* the invested points, which is the order the cells have and the order that changes the
 * answer: `ceil(5.2 × 2.1) + 3` is 14 where `ceil(5.2) × 2.1 + 3` is 15.6 and
 * `ceil((5.2 + 3) × 2.1)` is 18. The rule itself, the two constants and *absent means neutral* are
 * [`focusSkills.ts`](../focusSkills.ts)'s; this module multiplies by what it is told.
 *
 * The multiplication makes the round-up's float settling load-bearing rather than merely correct:
 * `roundAwayFromZero` settles to 15 significant digits before it rounds, and a fractional multiplier
 * over fractional weights is exactly the arithmetic that lands on `3.0000000000000004`.
 *
 * **The level can still render fractional, and that is deliberate.** `invested` is added *after* the
 * ceil, so 1.5 invested points show as `13.5`. Every path that writes an investment refuses a
 * non-integer (`pointsRefusal`), so the only fractional levels in the app are the golden suite's
 * `+1.5` row — Concept 02's own open question about what a starting pick is worth. Moving the ceil
 * outside the `+ invested` would round a number the workbook does not round, to tidy a case the
 * workbook does not have.
 *
 * **This is an engine rule, not a per-ruleset dial** — the decision TICKET-SKL-04 was asked to make
 * and record. A rounding mode is not a balance knob the way `bonus_divider` is: no ruleset asks for
 * *half* a rounding, an imported ruleset plays whatever the engine does either way (v4
 * [D6](../../../../docs/v4.0_sheet_parity/overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29)
 * is a clean break, so nothing is preserving an old ruleset's old answer), and a constant nobody
 * sets is an abstraction with one caller. The divisor stays data because a User genuinely retunes
 * it; the direction of the rounding is the game's arithmetic.
 *
 * **The invested contribution is 1:1 and still provisional.** Concept 02 leaves the real conversion
 * open — its sample shows `+1.5` for one starting pick, routed through the point-buy curve by the
 * character's archetype affinity. TICKET-ARC-02 did exactly that for **stats** and deliberately did
 * not do it for skills: whether skill investment routes through affinity too is a spec open
 * question, and building it silently alongside the stat change would have answered it by accident.
 * One term changes here when the User decides.
 *
 * **Validates: Concept 02; Concept 05; Concept 00 §7; v4 systems/06 gap 3**
 */

import type {
  Character,
  SkillFocusContribution,
  SkillStatContribution,
} from '../../types/character';
import type { Configuration, Skill } from '../../types/config';
import type { FormulaResult } from '../../types/formula';
import { type FocusDials, focusDials, focusMultiplier, focusPicksOf } from '../focusSkills';
import { namedConstant } from '../formula/constants';
import { asNumber, formulaError, isFormulaError, withSource } from '../formula/errors';
import { roundAwayFromZero } from '../formula/functions';

/** The constant a level is divided by to reach a bonus, and its Concept 05 seed */
const BONUS_DIVIDER_NAME = 'bonus_divider';
const DEFAULT_BONUS_DIVIDER = 5;

/** Both of a skill's derived numbers plus the terms behind them, keyed by skill id */
export interface CalculatedSkills {
  levels: Record<string, FormulaResult>;
  bonuses: Record<string, FormulaResult>;
  /**
   * The weight rows that produced each level, in the skill's own row order.
   *
   * They sum to the **unrounded** value the level rounds up from, not to the level itself
   * (TICKET-SKL-04) — a term is a weight times a stat, and a fraction is the honest thing for it to
   * be. The rounding belongs to the level, and the sheet shows the level beside the terms rather
   * than as their visible total.
   *
   * Empty for a skill whose level failed — there is no honest breakdown of a number that could not
   * be computed, and half a sum is more misleading than none (Concept 00 §7).
   */
  contributions: Record<string, SkillStatContribution[]>;
  /**
   * Each skill's focus multiplier and what it added, keyed by skill id (TICKET-SKL-05)
   *
   * The term that turns the weight rows above into the number the level rounds up from: with it, the
   * breakdown sums to the pre-rounding total again, which is what {@link contributions} promises and
   * what a multiplier applied silently would have quietly broken.
   *
   * Absent for a skill whose level failed, exactly as its contributions are empty.
   */
  focus: Record<string, SkillFocusContribution>;
}

/**
 * The ruleset's bonus divider, or Concept 05's seeded 5
 *
 * Read by name through `namedConstant`, like the race blend's divisor and with the same
 * consequence: this is system arithmetic rather than a User formula, so there is nothing for
 * `references.ts` to re-spell and renaming the constant falls back rather than following. A zero,
 * negative or non-finite divider would make every bonus `Infinity` or `NaN`, which is a worse
 * answer than the seed.
 */
function bonusDivider(config: Configuration): number {
  return namedConstant(
    config.constants,
    BONUS_DIVIDER_NAME,
    DEFAULT_BONUS_DIVIDER,
    (value) => value > 0
  );
}

/**
 * One skill's level from its weight rows
 *
 * `ceil(Σ (weight × stat) × focus) + invested` (TICKET-SKL-04, TICKET-SKL-05). The **weighted sum
 * times the focus multiplier is what rounds** — the invested points are added to the whole number
 * that comes out, which is why they are summed separately from the rows rather than seeded into the
 * total.
 *
 * A weight naming a stat the ruleset no longer defines contributes nothing rather than poisoning
 * the level — the same rule the composition applies to a dangling race entry (TICKET-REF-02). A
 * stat whose own formula is broken is different: it has no value at all, so the level that depends
 * on it cannot be computed either, and the error is carried rather than silently read as 0.
 *
 * Carried the way the evaluator carries one between formulas: an `upstream` error naming the stat,
 * with the original as its `cause`. Returning the stat's own error instead would leave it claiming
 * to belong to the stat — `withSource` keeps the first source it is given — so the sheet would chip
 * the skill's row with a message attributing it to something else, and the chain would stop at one
 * link (Concept 00 §7).
 */
function levelOf(
  skill: Skill,
  statValues: Record<string, FormulaResult>,
  statNames: ReadonlyMap<string, string>,
  invested: number,
  multiplier: number
): {
  level: FormulaResult;
  contributions: SkillStatContribution[];
  focus?: SkillFocusContribution;
} {
  let weighted = 0;
  const contributions: SkillStatContribution[] = [];

  for (const { statId, weight } of skill.statWeights) {
    const value = statValues[statId];
    if (value === undefined) continue;
    if (isFormulaError(value)) {
      return {
        level: formulaError(
          'upstream',
          `${statNames.get(statId) ?? statId} could not be calculated`,
          { cause: value }
        ),
        contributions: [],
      };
    }

    const contribution = weight * value;
    weighted += contribution;
    contributions.push({ statId, weight, statValue: value, contribution });
  }

  // The sheet's `ROUNDUP((primary + secondary) × focus, 0) + investedPoints`, in that order — the
  // multiplier inside the round-up and the invested points outside it (TICKET-SKL-05)
  const scaled = weighted * multiplier;
  const level = roundAwayFromZero(scaled) + invested;

  return {
    level,
    contributions,
    // Spelled as *what it added* rather than left for a surface to re-derive: `weighted` only exists
    // here, and a breakdown that showed `×2.1` without it would list terms that no longer sum to the
    // number above them
    focus: { multiplier, contribution: scaled - weighted },
  };
}

/**
 * Compute every skill's level and bonus for a character
 *
 * Narrowed to the one field it reads rather than taking a whole `Character`, so a caller with no
 * player in hand — `FormulaPreview` sampling a ruleset — can supply an honest empty allocation
 * without asserting its way past the type. **If the open question above is ever answered yes and a
 * skill's invested term routes through the point-buy curve, this signature widens** to take the
 * archetype, and every such caller becomes a compile error rather than a silent `undefined` at
 * runtime — which is how the stat side of it was caught.
 *
 * @param config - The configuration's skills and constants
 * @param statValues - Composed stat values, keyed by stat id
 * @param character - The character whose invested points are applied
 * @returns Both maps, keyed by skill id
 */
export function calculateSkills(
  config: Configuration,
  statValues: Record<string, FormulaResult>,
  character: Pick<Character, 'investedSkillPoints' | 'focusSkillIds'>
): CalculatedSkills {
  const divider = bonusDivider(config);
  const statNames = new Map(config.stats.map((stat) => [stat.id, stat.name]));

  // Both read once for the whole character rather than per skill: the dials are the ruleset's and
  // the picks are the character's, and neither is a property of any one row (TICKET-SKL-05)
  const dials: FocusDials = focusDials(config.constants);
  const picks = focusPicksOf(character);

  const levels: Record<string, FormulaResult> = {};
  const bonuses: Record<string, FormulaResult> = {};
  const contributions: Record<string, SkillStatContribution[]> = {};
  const focus: Record<string, SkillFocusContribution> = {};

  for (const skill of config.skills) {
    const multiplier = focusMultiplier(skill.id, picks, dials);
    const computed = levelOf(
      skill,
      statValues,
      statNames,
      character.investedSkillPoints[skill.id] ?? 0,
      multiplier
    );
    const level = isFormulaError(computed.level)
      ? withSource(computed.level, { kind: 'skill', id: skill.id, name: skill.name })
      : computed.level;
    levels[skill.id] = level;
    contributions[skill.id] = computed.contributions;
    if (computed.focus) focus[skill.id] = computed.focus;

    // A level that failed has no bonus either, and the bonus says the same thing rather than a
    // confident 0 (Concept 00 §7)
    const numeric = asNumber(level);
    bonuses[skill.id] = numeric === undefined ? level : roundAwayFromZero(numeric / divider);
  }

  return { levels, bonuses, contributions, focus };
}
