/**
 * Roll Input Calculator
 *
 * Evaluates each roll definition's input expression over a character's composed numbers — the value
 * that gets fed to the dice ladder (Concept 08).
 *
 * Replaces `combatSkillCalculator.ts`, and the swap is the whole point of the entity: that one
 * produced a **bonus** added to a hand-typed pool, this produces the **input** a pool is derived
 * from. A stronger character rolls bigger dice rather than the same dice plus a bigger number.
 *
 * Keyed by roll **id**, not by a code — a roll is not in the flat formula namespace at all.
 *
 * **Validates: Concept 08; Requirements 13.3, 16.6; Concept 00 §7**
 */

import type { Configuration } from '../../types/config';
import type { FormulaContext, FormulaResult } from '../../types/formula';
import { isFormulaError, withSource } from '../formula/errors';
import { evaluateFormulaString } from '../formula/evaluator';
import { namespacesFor } from '../formula/namespaces';
import type { CalculatedSkills } from './skillCalculator';
import { statVariables } from './statCalculator';

/**
 * Calculate every roll's input value
 *
 * Evaluated over the composed stats and skills, which equipment has already moved, so an equipped
 * sword reaches a roll through the stats it changed rather than being added again here
 * (Requirement 13.2).
 *
 * @param config - The configuration holding the roll definitions
 * @param statValues - Composed stat values, keyed by stat id
 * @param skills - Computed skill levels and bonuses, keyed by skill id
 * @returns Record of roll **id** to its input value, or the error explaining why there is none
 */
export function calculateRollInputs(
  config: Configuration,
  statValues: Record<string, FormulaResult>,
  // The two maps a formula can name, narrowed for the reason `calculateCombatSkillBonuses` was:
  // a roll reads `skills.<name>.level` and `.bonus`, so asking for the whole `CalculatedSkills`
  // would make every caller carry a breakdown it has no use for
  skills: Pick<CalculatedSkills, 'levels' | 'bonuses'>
): Record<string, FormulaResult> {
  const inputs: Record<string, FormulaResult> = {};

  // A stat or skill that is itself an error stays one here, so a roll reading it reports the
  // upstream cause rather than a number nobody can account for
  const context: FormulaContext = {
    variables: statVariables(config.stats, statValues),
    namespaces: namespacesFor(
      {
        ...config,
        statValues,
        skillLevels: skills.levels,
        skillBonuses: skills.bonuses,
      },
      'roll-input'
    ),
  };

  for (const roll of config.rollDefinitions ?? []) {
    const value = evaluateFormulaString(roll.input, context);

    inputs[roll.id] = isFormulaError(value)
      ? withSource(value, { kind: 'roll', id: roll.id, name: roll.name })
      : value;
  }

  return inputs;
}
