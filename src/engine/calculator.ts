/**
 * Calculation Engine
 * 
 * Calculates derived character values including stats, speciality skills, and combat bonuses.
 * Handles racial bonuses, equipment bonuses, and formula evaluation.
 */

import type { Configuration, Race, Stat, SkillModifier } from '../types/config';
import type { Character } from '../types/character';
import type { FormulaContext } from '../types/formula';
import { parseFormula } from './formula/parser';
import { evaluateFormula } from './formula/evaluator';

/**
 * Calculate total main skill levels including racial bonuses
 * 
 * @param character - The character whose skills to calculate
 * @param races - Array of Race objects for the character's races
 * @returns Record of skill code to total level (base + racial bonuses)
 */
export function calculateTotalMainSkillLevels(
  character: Character,
  races: Race[]
): Record<string, number> {
  const totalLevels: Record<string, number> = { ...character.mainSkillLevels };

  // Apply racial bonuses additively
  for (const race of races) {
    for (const modifier of race.skillModifiers) {
      const currentLevel = totalLevels[modifier.skillCode] || 0;
      totalLevels[modifier.skillCode] = currentLevel + modifier.modifier;
    }
  }

  return totalLevels;
}

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

/**
 * Calculate all stat values for a character
 * 
 * This is the main entry point for stat calculation. It:
 * 1. Applies racial bonuses to main skills
 * 2. Evaluates stat formulas with the total main skill levels
 * 
 * @param character - The character whose stats to calculate
 * @param config - The game configuration containing stat definitions and races
 * @returns Record of stat ID to maximum value
 */
export function calculateCharacterStats(
  character: Character,
  config: Configuration
): Record<string, number> {
  // Get races for this character
  const races = config.races.filter((race) => character.raceIds.includes(race.id));

  // Calculate total main skill levels with racial bonuses
  const totalMainSkillLevels = calculateTotalMainSkillLevels(character, races);

  // Calculate maximum stat values from formulas
  return calculateMaxStatValues(config.stats, totalMainSkillLevels);
}
