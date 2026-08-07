/**
 * Stat Calculator
 *
 * Calculates maximum stat values from formulas.
 *
 * **Validates: Requirements 3.4, 3.6, 8.4, 16.6; Concept 00 §7**
 */

import type { Stat } from '../../types/config';
import type { FormulaContext, FormulaResult } from '../../types/formula';
import { isFormulaError, withSource } from '../formula/errors';
import { evaluateFormulaString } from '../formula/evaluator';
import type { NamespaceSource } from '../formula/namespaces';
import { namespacesFor } from '../formula/namespaces';

/**
 * Calculate maximum stat values from formulas
 *
 * Evaluates stat formulas using the character's total main skill levels (including racial bonuses).
 *
 * A stat whose formula is broken gets an error **value** naming itself; every other stat is still
 * calculated (Concept 00 §7). Nothing here throws for a ruleset problem.
 *
 * @param stats - Array of Stat definitions from configuration
 * @param totalMainSkillLevels - Main skill levels with racial bonuses applied
 * @param source - The ruleset's constants and curves, backing `const.*` and `curve.*(x)`
 * @returns Record of stat ID to maximum value or error
 */
export function calculateMaxStatValues(
  stats: Stat[],
  totalMainSkillLevels: Record<string, FormulaResult>,
  source: NamespaceSource = {}
): Record<string, FormulaResult> {
  const maxStatValues: Record<string, FormulaResult> = {};

  // Main skill levels serve the legacy bare codes; the resolvers serve dotted references
  const context: FormulaContext = {
    variables: totalMainSkillLevels,
    namespaces: namespacesFor(source, 'stat'),
  };

  // Calculate each stat
  for (const stat of stats) {
    const value = evaluateFormulaString(stat.formula, context);

    maxStatValues[stat.id] = isFormulaError(value)
      ? withSource(value, { kind: 'stat', id: stat.id, name: stat.name })
      : value;
  }

  return maxStatValues;
}
