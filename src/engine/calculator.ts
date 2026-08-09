/**
 * Calculation Engine
 *
 * Main entry point for all calculation functions.
 * Re-exports specialized calculators for main skills, stats, speciality skills, and combat skills.
 *
 * **Validates: Requirements 11.5, 13.1, 13.2, 13.3, 6.7, 3.6, 8.4, 9.3**
 */

import type { CalculatedCharacter, Character } from '../types/character';
import type { Configuration } from '../types/config';
import type { FormulaError, FormulaResult } from '../types/formula';
import { isFormulaError } from './formula/errors';

// Re-export all calculator functions
export * from './calculators/combatSkillCalculator';
export * from './calculators/equipmentBonusCalculator';
export * from './calculators/specialitySkillCalculator';
export * from './calculators/statCalculator';

import { calculateCombatSkillBonuses } from './calculators/combatSkillCalculator';
import { calculateEquipmentBonuses } from './calculators/equipmentBonusCalculator';
// Import for the composed entry point
import { calculateSpecialitySkillLevels } from './calculators/specialitySkillCalculator';
import {
  calculateStatTotal,
  calculateStatValues,
  statVariables,
} from './calculators/statCalculator';

/**
 * Calculate every derived value for a character
 *
 * The single composed entry point of the calculation engine: it runs the calculators in
 * dependency order and returns the character with all derived values attached. Nothing here is
 * persisted — call it at read time whenever a derived number is needed.
 *
 * The ordering is load-bearing:
 * 1. **equipment** — resolved first, because stats and speciality skills both consume it;
 * 2. **stats** — the composition: invested points + racial modifiers + equipment for an invested
 *    stat, the formula for a derived one, then clamp and round (TICKET-STAT-01). Everything
 *    downstream reads them, so an equipped `STR +2` moves every stat and skill derived from
 *    `STR` (Requirement 13.3);
 * 3. **speciality skills** — base + formula + equipment + focus (if the focus stat is a
 *    speciality skill);
 * 4. **combat skills** — formula over stats and speciality levels + equipment targeting the
 *    combat skill's own code.
 *
 * Because a stat abbreviation is unique against the speciality and combat code spaces, each
 * equipment bonus is claimed by exactly one step and can never be counted twice (Req 13.2).
 *
 * **This function always returns.** A stat or skill whose formula is broken gets an error value
 * in its map entry naming what failed and on which entity; everything else is still calculated
 * (Concept 00 §7). Read the maps with `numberOr` / `asNumber` from `engine/formula/errors.ts`.
 *
 * @param character - The character to calculate
 * @param config - The game configuration the character was built on
 * @returns The character with every derived value populated, errors included as values
 */
export function calculateCharacter(
  character: Character,
  config: Configuration
): CalculatedCharacter {
  // Get races for this character
  const races = config.races.filter((race) => character.raceIds.includes(race.id));

  // 1. Equipment bonuses from equipped items
  const equipmentBonuses = calculateEquipmentBonuses(character, config);

  // 2. Stat values — the composition (invested or derived), clamped and rounded
  const statValues = calculateStatValues(config.stats, character, {
    races,
    equipmentBonuses,
    focusStatBonusLevel: config.focusStatBonusLevel,
    source: config,
  });

  // The flat space downstream formulas are still written in, keyed by abbreviation
  const variables = statVariables(config.stats, statValues);

  // 3. Speciality skill totals — base + formula + equipment + focus
  const specialitySkillTotalLevels = calculateSpecialitySkillLevels(
    character,
    config,
    variables,
    equipmentBonuses
  );

  // 4. Combat skill bonuses — formula + equipment targeting the combat skill itself
  const combatSkillBonuses = calculateCombatSkillBonuses(
    config,
    variables,
    specialitySkillTotalLevels,
    equipmentBonuses
  );

  return {
    ...character,
    statValues,
    statTotal: calculateStatTotal(config.stats, statValues),
    specialitySkillTotalLevels,
    combatSkillBonuses,
    equipmentBonuses,
  };
}

/**
 * The first error value among a calculated character's derived maps, if any
 *
 * `calculateCharacter` no longer throws for a ruleset problem (TICKET-FORM-05), so any surface
 * that used to rely on a `catch` to notice a broken formula must ask this instead — otherwise a
 * broken value renders as a confident `0`, which is worse than the crash it replaced.
 *
 * Interim by design: TICKET-FORM-06 renders a chip per value, at which point callers show the
 * per-entry error rather than one representative.
 *
 * @param calculated - A character from {@link calculateCharacter}
 * @returns The first error found, or `undefined` when every derived value is a number
 */
export function firstCalculationError(calculated: CalculatedCharacter): FormulaError | undefined {
  const entries: FormulaResult[] = [
    ...Object.values(calculated.statValues),
    ...Object.values(calculated.specialitySkillTotalLevels),
    ...Object.values(calculated.combatSkillBonuses),
  ];

  return entries.find(isFormulaError);
}

/**
 * Calculate all maximum stat values for a character
 *
 * Thin wrapper over {@link calculateCharacter} for callers that only need the stat values.
 * It runs the full chain, so the numbers it returns always agree with the rest of the sheet.
 *
 * @param character - The character whose stats to calculate
 * @param config - The game configuration containing stat definitions and races
 * @returns Record of stat ID to maximum value or error
 */
export function calculateCharacterStats(
  character: Character,
  config: Configuration
): Record<string, FormulaResult> {
  return calculateCharacter(character, config).statValues;
}
