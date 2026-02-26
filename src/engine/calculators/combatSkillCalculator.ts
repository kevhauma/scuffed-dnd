/**
 * Combat Skill Bonus Calculator
 * 
 * Calculates combat skill bonuses from formulas and equipment.
 */

import type { Configuration } from '../../types/config';
import type { SkillModifier } from '../../types/config';
import type { FormulaContext } from '../../types/formula';
import { parseFormula } from '../formula/parser';
import { evaluateFormula } from '../formula/evaluator';

/**
 * Calculate combat skill bonuses
 * 
 * Calculates the bonus for each combat skill by:
 * 1. Evaluating the bonus formula with main and speciality skill levels
 * 2. Adding equipment bonuses for the specific combat skill
 * 
 * @param config - The game configuration containing combat skill definitions
 * @param totalMainSkillLevels - Main skill levels with racial bonuses applied
 * @param specialitySkillLevels - Calculated speciality skill levels
 * @param equipmentBonuses - Bonuses from equipped items
 * @returns Record of combat skill code to total bonus
 * @throws Error if formula parsing or evaluation fails
 */
export function calculateCombatSkillBonuses(
  config: Configuration,
  totalMainSkillLevels: Record<string, number>,
  specialitySkillLevels: Record<string, number>,
  equipmentBonuses: SkillModifier[]
): Record<string, number> {
  const combatSkillBonuses: Record<string, number> = {};

  // Create formula context from main and speciality skill levels
  const context: FormulaContext = {
    variables: {
      ...totalMainSkillLevels,
      ...specialitySkillLevels,
    },
  };

  // Calculate each combat skill bonus
  for (const skill of config.combatSkills) {
    // Calculate bonus from formula
    let formulaBonus = 0;
    try {
      const ast = parseFormula(skill.bonusFormula);
      formulaBonus = evaluateFormula(ast, context);
    } catch (error) {
      throw new Error(
        `Failed to calculate bonus for combat skill "${skill.name}" (${skill.code}): ${error instanceof Error ? error.message : String(error)}`
      );
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
