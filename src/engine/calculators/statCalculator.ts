/**
 * Stat Calculator
 * 
 * Calculates maximum stat values from formulas.
 */

import type { Stat } from '../../types/config';
import type { FormulaContext } from '../../types/formula';
import { parseFormula } from '../formula/parser';
import { evaluateFormula } from '../formula/evaluator';

/**
 * Calculate maximum stat values from formulas
 * 
 * Evaluates stat formulas using the character's total main skill levels (including racial bonuses).
 * 
 * @param stats - Array of Stat definitions from configuration
 * @param totalMainSkillLevels - Main skill levels with racial bonuses applied
 * @returns Record of stat ID to maximum value
 * @throws Error if formula parsing or evaluation fails
 */
export function calculateMaxStatValues(
  stats: Stat[],
  totalMainSkillLevels: Record<string, number>
): Record<string, number> {
  const maxStatValues: Record<string, number> = {};

  // Create formula context from main skill levels
  const context: FormulaContext = {
    variables: totalMainSkillLevels,
  };

  // Calculate each stat
  for (const stat of stats) {
    try {
      const ast = parseFormula(stat.formula);
      const value = evaluateFormula(ast, context);
      maxStatValues[stat.id] = value;
    } catch (error) {
      throw new Error(
        `Failed to calculate stat "${stat.name}" (${stat.id}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return maxStatValues;
}
