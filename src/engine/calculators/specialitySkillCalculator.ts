/**
 * Speciality Skill Calculator
 *
 * Calculates total speciality skill levels including base level, formula bonus, equipment
 * bonuses, and focus stat bonus.
 *
 * **Validates: Requirements 3.6, 6.7, 9.3, 16.6; Concept 00 §7**
 */

import type { Character } from '../../types/character';
import type { Configuration, SkillModifier } from '../../types/config';
import type { FormulaContext, FormulaResult } from '../../types/formula';
import { constantsNamespace } from '../formula/constants';
import { isFormulaError, withSource } from '../formula/errors';
import { evaluateFormulaString } from '../formula/evaluator';

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
 * @returns Record of speciality skill code to total level or error
 */
export function calculateSpecialitySkillLevels(
  character: Character,
  config: Configuration,
  totalMainSkillLevels: Record<string, FormulaResult>,
  equipmentBonuses: SkillModifier[] = []
): Record<string, FormulaResult> {
  const specialitySkillLevels: Record<string, FormulaResult> = {};

  // Main skill levels serve the legacy bare codes; the resolvers serve dotted references
  const context: FormulaContext = {
    variables: totalMainSkillLevels,
    namespaces: { const: constantsNamespace(config.constants) },
  };

  // Calculate each speciality skill
  for (const skill of config.specialitySkills) {
    // Start with base level (default to 0 if not set)
    const baseLevel = character.specialitySkillBaseLevels[skill.code] || 0;

    // Calculate bonus from formula. A broken formula poisons this skill only (Concept 00 §7).
    const bonus = evaluateFormulaString(skill.bonusFormula, context);
    if (isFormulaError(bonus)) {
      specialitySkillLevels[skill.code] = withSource(bonus, {
        kind: 'speciality-skill',
        id: skill.code,
        name: skill.name,
      });
      continue;
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
