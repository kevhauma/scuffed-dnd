/**
 * Skill Calculator
 *
 * A skill's two numbers (Concept 02, TICKET-SKL-02):
 *
 * ```
 * level = Σ (weight × stat value) + invested
 * bonus = round(level / const.bonus_divider)
 * ```
 *
 * The **weights are data**, which is the whole point of the entity: the source sheet re-implements
 * this arithmetic in three tabs, so a global rebalance means finding all three. Here it lives once,
 * and "make bonuses grow faster" is one constant rather than 48 formula edits.
 *
 * Rounding is **half-away-from-zero**, matching the sheet: Concept 02 verifies `perception` at
 * level 7.5 yielding bonus 2 rather than 1, which is the case that tells Excel's ROUND apart from
 * JavaScript's `Math.round`.
 *
 * **The invested contribution is 1:1 and still provisional.** Concept 02 leaves the real conversion
 * open — its sample shows `+1.5` for one starting pick, routed through the point-buy curve by the
 * character's archetype affinity. TICKET-ARC-02 did exactly that for **stats** and deliberately did
 * not do it for skills: whether skill investment routes through affinity too is a spec open
 * question, and building it silently alongside the stat change would have answered it by accident.
 * One term changes here when the User decides.
 *
 * **Validates: Concept 02; Concept 05; Concept 00 §7**
 */

import type { Character, SkillStatContribution } from '../../types/character';
import type { Configuration, Skill } from '../../types/config';
import type { FormulaResult } from '../../types/formula';
import { asNumber, formulaError, isFormulaError, withSource } from '../formula/errors';
import { roundHalfAwayFromZero } from '../formula/functions';

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
   * Empty for a skill whose level failed — there is no honest breakdown of a number that could not
   * be computed, and half a sum is more misleading than none (Concept 00 §7).
   */
  contributions: Record<string, SkillStatContribution[]>;
}

/**
 * The ruleset's bonus divider, or Concept 05's seeded 5
 *
 * Read by name, like the race blend's divisor and with the same consequence: this is system
 * arithmetic rather than a User formula, so there is nothing for `references.ts` to re-spell and
 * renaming the constant falls back rather than following. A zero, negative or non-finite divider
 * would make every bonus `Infinity` or `NaN`, which is a worse answer than the seed.
 */
function bonusDivider(config: Configuration): number {
  const value = (config.constants ?? []).find(
    (constant) => constant.name === BONUS_DIVIDER_NAME
  )?.value;

  return value !== undefined && Number.isFinite(value) && value > 0 ? value : DEFAULT_BONUS_DIVIDER;
}

/**
 * One skill's level from its weight rows
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
  invested: number
): { level: FormulaResult; contributions: SkillStatContribution[] } {
  let total = invested;
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
    total += contribution;
    contributions.push({ statId, weight, statValue: value, contribution });
  }

  return { level: total, contributions };
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
  character: Pick<Character, 'investedSkillPoints'>
): CalculatedSkills {
  const divider = bonusDivider(config);
  const statNames = new Map(config.stats.map((stat) => [stat.id, stat.name]));

  const levels: Record<string, FormulaResult> = {};
  const bonuses: Record<string, FormulaResult> = {};
  const contributions: Record<string, SkillStatContribution[]> = {};

  for (const skill of config.skills) {
    const computed = levelOf(
      skill,
      statValues,
      statNames,
      character.investedSkillPoints[skill.id] ?? 0
    );
    const level = isFormulaError(computed.level)
      ? withSource(computed.level, { kind: 'skill', id: skill.id, name: skill.name })
      : computed.level;
    levels[skill.id] = level;
    contributions[skill.id] = computed.contributions;

    // A level that failed has no bonus either, and the bonus says the same thing rather than a
    // confident 0 (Concept 00 §7)
    const numeric = asNumber(level);
    bonuses[skill.id] = numeric === undefined ? level : roundHalfAwayFromZero(numeric / divider);
  }

  return { levels, bonuses, contributions };
}
