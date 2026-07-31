/**
 * Calculation Engine
 *
 * Main entry point for all calculation functions.
 * Re-exports specialized calculators for main skills, stats, speciality skills, and combat skills.
 *
 * **Validates: Requirements 11.5, 13.1, 13.2, 13.3, 6.7, 3.6, 8.4, 9.3**
 */

import type { Configuration } from '../types/config';
import type { CalculatedCharacter, Character } from '../types/character';

// Re-export all calculator functions
export * from './calculators/mainSkillCalculator';
export * from './calculators/statCalculator';
export * from './calculators/specialitySkillCalculator';
export * from './calculators/combatSkillCalculator';
export * from './calculators/equipmentBonusCalculator';

// Import for the composed entry point
import { calculateTotalMainSkillLevels } from './calculators/mainSkillCalculator';
import { calculateMaxStatValues } from './calculators/statCalculator';
import { calculateSpecialitySkillLevels } from './calculators/specialitySkillCalculator';
import { calculateCombatSkillBonuses } from './calculators/combatSkillCalculator';
import { calculateEquipmentBonuses } from './calculators/equipmentBonusCalculator';

/**
 * Calculate every derived value for a character
 *
 * The single composed entry point of the calculation engine: it runs the calculators in
 * dependency order and returns the character with all derived values attached. Nothing here is
 * persisted — call it at read time whenever a derived number is needed.
 *
 * The ordering is load-bearing:
 * 1. **equipment** — resolved first, because main and speciality skills both consume it;
 * 2. **main skills** — allocated levels + racial modifiers + equipment + focus (if the focus stat
 *    is a main skill), because stats, speciality skills and combat skills all read them;
 * 3. **stats** — evaluated over the finished main skill levels, so an equipped `STR +2` moves
 *    every stat derived from `STR` (Requirement 13.3);
 * 4. **speciality skills** — base + formula + equipment + focus (if the focus stat is a
 *    speciality skill);
 * 5. **combat skills** — formula over main and speciality levels + equipment targeting the
 *    combat skill's own code.
 *
 * Because skill codes are unique across the three kinds, each equipment bonus is claimed by
 * exactly one step and can never be counted twice (Requirement 13.2).
 *
 * @param character - The character to calculate
 * @param config - The game configuration the character was built on
 * @returns The character with every derived value populated
 * @throws Error naming the stat or skill whose formula failed, and why (Requirement 16.6)
 */
export function calculateCharacter(
  character: Character,
  config: Configuration
): CalculatedCharacter {
  // Get races for this character
  const races = config.races.filter((race) => character.raceIds.includes(race.id));

  // 1. Equipment bonuses from equipped items
  const equipmentBonuses = calculateEquipmentBonuses(character, config);

  // 2. Total main skill levels — base + racial + equipment + focus
  const totalMainSkillLevels = calculateTotalMainSkillLevels(character, races, {
    mainSkills: config.mainSkills,
    equipmentBonuses,
    focusStatBonusLevel: config.focusStatBonusLevel,
  });

  // 3. Maximum stat values from the stat formulas
  const maxStatValues = calculateMaxStatValues(config.stats, totalMainSkillLevels);

  // 4. Speciality skill totals — base + formula + equipment + focus
  const specialitySkillTotalLevels = calculateSpecialitySkillLevels(
    character,
    config,
    totalMainSkillLevels,
    equipmentBonuses
  );

  // 5. Combat skill bonuses — formula + equipment targeting the combat skill itself
  const combatSkillBonuses = calculateCombatSkillBonuses(
    config,
    totalMainSkillLevels,
    specialitySkillTotalLevels,
    equipmentBonuses
  );

  return {
    ...character,
    totalMainSkillLevels,
    maxStatValues,
    specialitySkillTotalLevels,
    combatSkillBonuses,
    equipmentBonuses,
  };
}

/**
 * Calculate all maximum stat values for a character
 *
 * Thin wrapper over {@link calculateCharacter} for callers that only need the stat values.
 * It runs the full chain, so the numbers it returns always agree with the rest of the sheet.
 *
 * @param character - The character whose stats to calculate
 * @param config - The game configuration containing stat definitions and races
 * @returns Record of stat ID to maximum value
 */
export function calculateCharacterStats(
  character: Character,
  config: Configuration
): Record<string, number> {
  return calculateCharacter(character, config).maxStatValues;
}
