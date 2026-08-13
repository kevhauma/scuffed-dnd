/**
 * Speciality Skill Calculator
 *
 * Calculates total speciality skill levels from base level, formula bonus, and focus stat bonus.
 *
 * **No equipment term** since TICKET-MAT-02. A material tier's modifiers name a stat, so there is
 * no shape left that could target a skill code — and a skill still moves with equipment, through
 * the stats its formula reads. That is the sheet's model rather than a regression: a Stealth
 * written as `DEX / 2` follows a cloak that raises DEX.
 *
 * **Validates: Concepts 01, 09; Requirements 3.6, 9.3, 16.6; Concept 00 §7**
 */

import type { Character } from '../../types/character';
import type { Configuration } from '../../types/config';
import type { FormulaContext, FormulaResult } from '../../types/formula';
import { isFormulaError, withSource } from '../formula/errors';
import { evaluateFormulaString } from '../formula/evaluator';
import { namespacesFor } from '../formula/namespaces';

/**
 * Calculate total speciality skill levels
 *
 * Calculates the total level for each speciality skill by:
 * 1. Starting with the base level
 * 2. Adding the bonus calculated from the formula — which is where equipment reaches it, since the
 *    formula reads stats the equipment has already moved
 * 3. Adding the focus stat bonus if this skill is the character's focus stat
 *
 * @param character - The character whose speciality skills to calculate
 * @param config - The game configuration containing speciality skill definitions
 * @param statVariables - Composed stat values, keyed by abbreviation (TICKET-STAT-01)
 * @returns Record of speciality skill code to total level or error
 */
export function calculateSpecialitySkillLevels(
  character: Character,
  config: Configuration,
  statVariables: Record<string, FormulaResult>
): Record<string, FormulaResult> {
  const specialitySkillLevels: Record<string, FormulaResult> = {};

  // Main skill levels serve the legacy bare codes; the resolvers serve dotted references
  const context: FormulaContext = {
    variables: statVariables,
    namespaces: namespacesFor(config, 'speciality-skill'),
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

    let totalLevel = baseLevel + bonus;

    // Apply focus stat bonus if this skill is the character's focus stat
    if (character.focusStatCode === skill.code) {
      totalLevel += config.focusStatBonusLevel;
    }

    specialitySkillLevels[skill.code] = totalLevel;
  }

  return specialitySkillLevels;
}
