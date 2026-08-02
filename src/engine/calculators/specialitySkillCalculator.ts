/**
 * Speciality Skill Calculator
 *
 * Calculates total speciality skill levels including base level, formula bonus, equipment
 * bonuses, and focus stat bonus.
 *
 * **Validates: Requirements 3.6, 6.7, 9.3, 16.6**
 */

import type { Character } from '../../types/character';
import type { Configuration, SkillModifier } from '../../types/config';
import type { FormulaContext } from '../../types/formula';
import { evaluateFormula } from '../formula/evaluator';
import { parseFormula } from '../formula/parser';

/**
 * Calculate total speciality skill levels
 *
 * Calculates the total level for each speciality skill by:
 * 1. Starting with the base level
 * 2. Adding the bonus calculated from the formula
 * 3. Adding equipment bonuses targeting this speciality skill's code
 * 4. Adding the focus stat bonus if this skill is the character's focus stat
 *
 * @param character - The character whose speciality skills to calculate
 * @param config - The game configuration containing speciality skill definitions
 * @param totalMainSkillLevels - Main skill levels with racial and equipment bonuses applied
 * @param equipmentBonuses - Bonuses from equipped items; only those targeting a speciality skill code are used
 * @returns Record of speciality skill code to total level
 * @throws Error if formula parsing or evaluation fails
 */
export function calculateSpecialitySkillLevels(
  character: Character,
  config: Configuration,
  totalMainSkillLevels: Record<string, number>,
  equipmentBonuses: SkillModifier[] = []
): Record<string, number> {
  const specialitySkillLevels: Record<string, number> = {};

  // Create formula context from main skill levels
  const context: FormulaContext = {
    variables: totalMainSkillLevels,
  };

  // Calculate each speciality skill
  for (const skill of config.specialitySkills) {
    // Start with base level (default to 0 if not set)
    const baseLevel = character.specialitySkillBaseLevels[skill.code] || 0;

    // Calculate bonus from formula
    let bonus = 0;
    try {
      const ast = parseFormula(skill.bonusFormula);
      bonus = evaluateFormula(ast, context);
    } catch (error) {
      throw new Error(
        `Failed to calculate bonus for speciality skill "${skill.name}" (${skill.code}): ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Add equipment bonuses targeting this speciality skill (Requirement 6.7)
    const equipmentBonus = equipmentBonuses
      .filter((modifier) => modifier.skillCode === skill.code)
      .reduce((sum, modifier) => sum + modifier.modifier, 0);

    // Combine base level with formula and equipment bonuses
    let totalLevel = baseLevel + bonus + equipmentBonus;

    // Apply focus stat bonus if this skill is the character's focus stat
    if (character.focusStatCode === skill.code) {
      totalLevel += config.focusStatBonusLevel;
    }

    specialitySkillLevels[skill.code] = totalLevel;
  }

  return specialitySkillLevels;
}
