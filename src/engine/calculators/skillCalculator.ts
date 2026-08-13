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
 * **The invested contribution is 1:1 and provisional.** Concept 02 leaves the real conversion
 * open — its sample shows `+1.5` for one starting pick, routed through the point-buy curve by the
 * character's archetype affinity — and TICKET-ARC-02 is what closes it. One term changes here when
 * it does.
 *
 * **Validates: Concept 02; Concept 05; Concept 00 §7**
 */

import type { Character } from '../../types/character';
import type { Configuration, Skill } from '../../types/config';
import type { FormulaResult } from '../../types/formula';
import { asNumber, isFormulaError, withSource } from '../formula/errors';
import { roundHalfAwayFromZero } from '../formula/functions';

/** The constant a level is divided by to reach a bonus, and its Concept 05 seed */
const BONUS_DIVIDER_NAME = 'bonus_divider';
const DEFAULT_BONUS_DIVIDER = 5;

/** Both of a skill's derived numbers, keyed by skill id */
export interface CalculatedSkills {
  levels: Record<string, FormulaResult>;
  bonuses: Record<string, FormulaResult>;
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

  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_BONUS_DIVIDER;
}

/**
 * One skill's level from its weight rows
 *
 * A weight naming a stat the ruleset no longer defines contributes nothing rather than poisoning
 * the level — the same rule the composition applies to a dangling race entry (TICKET-REF-02). A
 * stat whose own formula is broken is different: it has no value at all, so the level that depends
 * on it cannot be computed either, and the error is carried rather than silently read as 0.
 */
function levelOf(
  skill: Skill,
  statValues: Record<string, FormulaResult>,
  invested: number
): FormulaResult {
  let total = invested;

  for (const { statId, weight } of skill.statWeights) {
    const value = statValues[statId];
    if (value === undefined) continue;
    if (isFormulaError(value)) {
      return withSource(value, { kind: 'skill', id: skill.id, name: skill.name });
    }

    total += weight * value;
  }

  return total;
}

/**
 * Compute every skill's level and bonus for a character
 *
 * @param config - The configuration's skills and constants
 * @param statValues - Composed stat values, keyed by stat id
 * @param character - The character whose invested points are applied
 * @returns Both maps, keyed by skill id
 */
export function calculateSkills(
  config: Configuration,
  statValues: Record<string, FormulaResult>,
  character: Character
): CalculatedSkills {
  const divider = bonusDivider(config);

  const levels: Record<string, FormulaResult> = {};
  const bonuses: Record<string, FormulaResult> = {};

  for (const skill of config.skills) {
    const level = levelOf(skill, statValues, character.investedSkillPoints[skill.id] ?? 0);
    levels[skill.id] = level;

    // A level that failed has no bonus either, and the bonus says the same thing rather than a
    // confident 0 (Concept 00 §7)
    const numeric = asNumber(level);
    bonuses[skill.id] = numeric === undefined ? level : roundHalfAwayFromZero(numeric / divider);
  }

  return { levels, bonuses };
}
