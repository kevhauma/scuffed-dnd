/**
 * Combat Roll Aggregator
 *
 * Combines a combat skill's dice with the bonus the calculation engine derives for a character,
 * producing the breakdown the roller UI displays and the roll history stores.
 *
 * **Validates: Requirements 5.5, 5.6, 15.1, 15.2**
 */

import type { CalculatedCharacter } from '../../types/character';
import type { CombatSkill, Configuration } from '../../types/config';
import type { CombatRollResult } from '../../types/formula';
import { calculateCombatSkillBonuses } from '../calculators/combatSkillCalculator';
import { rollDice, sumDiceResults, type RandomSource } from './diceSimulator';

/**
 * Roll a combat skill for a character
 *
 * The bonus is read from `calculateCombatSkillBonuses()` — the same calculator the character
 * sheet uses — rather than re-evaluating the formula here, so a roll can never disagree with the
 * displayed bonus.
 *
 * @param skill - The combat skill being rolled
 * @param character - The character rolling it, with derived values already calculated
 * @param config - The configuration the character was built on
 * @param rng - Source of randomness; defaults to `Math.random`
 * @param timestamp - ISO timestamp for the result; defaults to now
 * @returns The full breakdown: per-die-type rolls, dice total, bonus, and combined total
 * @throws Error naming the skill if its bonus formula cannot be evaluated
 */
export function rollCombatSkill(
  skill: CombatSkill,
  character: CalculatedCharacter,
  config: Configuration,
  rng: RandomSource = Math.random,
  timestamp: string = new Date().toISOString()
): CombatRollResult {
  const diceResults = rollDice(skill.dice, rng);
  const diceTotal = sumDiceResults(diceResults);

  const bonuses = calculateCombatSkillBonuses(
    config,
    character.totalMainSkillLevels,
    character.specialitySkillTotalLevels,
    character.equipmentBonuses
  );

  // A skill absent from the configuration contributes no bonus rather than NaN
  const bonus = bonuses[skill.code] ?? 0;

  return {
    skillCode: skill.code,
    skillName: skill.name,
    diceResults,
    diceTotal,
    bonus,
    total: diceTotal + bonus,
    timestamp,
  };
}
