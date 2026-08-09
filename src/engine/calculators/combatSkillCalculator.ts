/**
 * Combat Skill Bonus Calculator
 *
 * Calculates combat skill bonuses from formulas and equipment.
 *
 * **Validates: Requirements 5.4, 13.3, 16.6; Concept 00 §7**
 */

import type { Configuration, SkillModifier } from '../../types/config';
import type { FormulaContext, FormulaResult } from '../../types/formula';
import { isFormulaError, withSource } from '../formula/errors';
import { evaluateFormulaString } from '../formula/evaluator';
import { namespacesFor } from '../formula/namespaces';

/**
 * Calculate combat skill bonuses
 *
 * Calculates the bonus for each combat skill by:
 * 1. Evaluating the bonus formula with main and speciality skill levels
 * 2. Adding equipment bonuses for the specific combat skill
 *
 * @param config - The game configuration containing combat skill definitions
 * @param statVariables - Composed stat values, keyed by abbreviation (TICKET-STAT-01)
 * @param specialitySkillLevels - Calculated speciality skill levels
 * @param equipmentBonuses - Bonuses from equipped items
 * @returns Record of combat skill code to total bonus or error
 */
export function calculateCombatSkillBonuses(
  config: Configuration,
  statVariables: Record<string, FormulaResult>,
  specialitySkillLevels: Record<string, FormulaResult>,
  equipmentBonuses: SkillModifier[]
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

    // Add equipment bonuses for this combat skill
    const equipmentBonus = equipmentBonuses
      .filter((bonus) => bonus.skillCode === skill.code)
      .reduce((sum, bonus) => sum + bonus.modifier, 0);

    // Combine formula bonus with equipment bonus
    combatSkillBonuses[skill.code] = formulaBonus + equipmentBonus;
  }

  return combatSkillBonuses;
}
