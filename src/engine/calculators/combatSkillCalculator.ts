/**
 * Combat Skill Bonus Calculator
 *
 * Calculates combat skill bonuses from their formulas.
 *
 * **No equipment term** since TICKET-MAT-02, for the same reason the speciality calculator lost
 * one: a tier modifier names a stat, and a combat skill feels equipment through the stats and
 * speciality levels its formula reads.
 *
 * **Validates: Concepts 01, 09; Requirements 5.4, 13.3, 16.6; Concept 00 §7**
 */

import type { Configuration } from '../../types/config';
import type { FormulaContext, FormulaResult } from '../../types/formula';
import { isFormulaError, withSource } from '../formula/errors';
import { evaluateFormulaString } from '../formula/evaluator';
import { namespacesFor } from '../formula/namespaces';

/**
 * Calculate combat skill bonuses
 *
 * The bonus is the formula, evaluated over the composed stats and speciality levels — both of
 * which equipment has already moved, so an equipped sword reaches the roll without being added a
 * second time here (Requirement 13.2).
 *
 * @param config - The game configuration containing combat skill definitions
 * @param statVariables - Composed stat values, keyed by abbreviation (TICKET-STAT-01)
 * @param specialitySkillLevels - Calculated speciality skill levels
 * @returns Record of combat skill code to total bonus or error
 */
export function calculateCombatSkillBonuses(
  config: Configuration,
  statVariables: Record<string, FormulaResult>,
  specialitySkillLevels: Record<string, FormulaResult>
): Record<string, FormulaResult> {
  const combatSkillBonuses: Record<string, FormulaResult> = {};

  // Formula context from main and speciality skill levels. A speciality level that is itself an
  // error stays an error here, so a combat skill reading it reports the upstream cause.
  const context: FormulaContext = {
    variables: {
      ...statVariables,
      ...specialitySkillLevels,
    },
    namespaces: namespacesFor(config, 'combat-skill'),
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
