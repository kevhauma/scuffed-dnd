/**
 * Combat Skill Bonus Calculator
 *
 * Calculates combat skill bonuses from their formulas.
 *
 * **No equipment term** since TICKET-MAT-02: a tier modifier names a stat, and a combat skill feels
 * equipment through the stats its formula reads.
 *
 * **A skill is reached as `skills.<name>`** since TICKET-SKL-02. v1 let a combat formula name a
 * speciality skill by its 3-letter code in the flat variable space; a `Skill` has no code any more,
 * so the flat space is stat abbreviations only and a formula still spelling `STL` reports an
 * undefined variable — the clean break this milestone allows, and what the sheet corpus is
 * re-authored for. TICKET-ROLL-05 replaces the entity outright.
 *
 * **Validates: Concepts 01, 02, 09; Requirements 5.4, 13.3, 16.6; Concept 00 §7**
 */

import type { Configuration } from '../../types/config';
import type { FormulaContext, FormulaResult } from '../../types/formula';
import { isFormulaError, withSource } from '../formula/errors';
import { evaluateFormulaString } from '../formula/evaluator';
import { namespacesFor } from '../formula/namespaces';
import type { CalculatedSkills } from './skillCalculator';
import { statVariables } from './statCalculator';

/**
 * Calculate combat skill bonuses
 *
 * The bonus is the formula, evaluated over the composed stats and skills — both of which equipment
 * has already moved, so an equipped sword reaches the roll without being added a second time here
 * (Requirement 13.2).
 *
 * @param config - The game configuration containing combat skill definitions
 * @param statValues - Composed stat values, keyed by stat id
 * @param skills - Computed skill levels and bonuses, keyed by skill id
 * @returns Record of combat skill code to total bonus or error
 */
export function calculateCombatSkillBonuses(
  config: Configuration,
  statValues: Record<string, FormulaResult>,
  skills: CalculatedSkills
): Record<string, FormulaResult> {
  const combatSkillBonuses: Record<string, FormulaResult> = {};

  // A skill level that is itself an error stays an error here, so a combat skill reading it
  // reports the upstream cause rather than a number nobody can account for.
  const context: FormulaContext = {
    variables: statVariables(config.stats, statValues),
    namespaces: namespacesFor(
      {
        ...config,
        statValues,
        skillLevels: skills.levels,
        skillBonuses: skills.bonuses,
      },
      'combat-skill'
    ),
  };

  // Calculate each combat skill bonus
  for (const skill of config.combatSkills) {
    const formulaBonus = evaluateFormulaString(skill.bonusFormula, context);
    if (isFormulaError(formulaBonus)) {
      combatSkillBonuses[skill.code] = withSource(formulaBonus, {
        kind: 'combat-skill',
        id: skill.code,
        name: skill.name,
      });
      continue;
    }

    combatSkillBonuses[skill.code] = formulaBonus;
  }

  return combatSkillBonuses;
}
