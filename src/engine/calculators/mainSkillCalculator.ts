/**
 * Main Skill Calculator
 * 
 * Calculates total main skill levels including racial bonuses.
 */

import type { Character } from '../../types/character';
import type { Race } from '../../types/config';

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
