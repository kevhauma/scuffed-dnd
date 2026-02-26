/**
 * Calculation Engine
 * 
 * Main entry point for all calculation functions.
 * Re-exports specialized calculators for main skills, stats, speciality skills, and combat skills.
 */

import type { Configuration } from '../types/config';
import type { Character } from '../types/character';

// Re-export all calculator functions
export * from './calculators/mainSkillCalculator';
export * from './calculators/statCalculator';
export * from './calculators/specialitySkillCalculator';

// Import for convenience function
import { calculateTotalMainSkillLevels } from './calculators/mainSkillCalculator';
import { calculateMaxStatValues } from './calculators/statCalculator';

/**
 * Calculate all stat values for a character
 * 
 * This is a convenience function that:
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
