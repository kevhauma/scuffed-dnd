/**
 * Main Skill Calculator
 *
 * Calculates total main skill levels including racial, equipment and focus-stat bonuses.
 *
 * **Validates: Requirements 8.4, 6.7, 9.3, 13.3, 13.4**
 */

import type { Character } from '../../types/character';
import type { MainSkill, Race, SkillModifier } from '../../types/config';

/**
 * Optional inputs for main skill totals
 *
 * Omitting all of them reproduces the plain "base + racial" calculation.
 */
export interface MainSkillCalculationOptions {
  /** Main skill definitions — used to decide which codes belong to the main skill namespace */
  mainSkills?: MainSkill[];
  /** Aggregated bonuses from equipped items; only those targeting main skill codes are applied */
  equipmentBonuses?: SkillModifier[];
  /** Focus stat bonus, applied only when the character's focus stat is a main skill */
  focusStatBonusLevel?: number;
}

/**
 * Sum the skill modifiers granted by a set of races
 *
 * Kept separate from the totals so the UI can display the racial contribution on its own
 * (Requirement 8.4, 13.4) without recomputing it from the difference.
 *
 * @param races - Array of Race objects for the character's races
 * @returns Record of skill code to combined racial modifier
 */
export function calculateRacialSkillModifiers(races: Race[]): Record<string, number> {
  const racialModifiers: Record<string, number> = {};

  // Multiple races combine additively
  for (const race of races) {
    for (const modifier of race.skillModifiers) {
      const current = racialModifiers[modifier.skillCode] || 0;
      racialModifiers[modifier.skillCode] = current + modifier.modifier;
    }
  }

  return racialModifiers;
}

/**
 * Calculate total main skill levels
 *
 * Combines, in order:
 * 0. every configured main skill code, seeded to 0 (when `options.mainSkills` is given);
 * 1. the character's allocated levels;
 * 2. racial modifiers from every race the character has;
 * 3. equipment modifiers targeting a main skill code (Requirement 6.7, 13.3);
 * 4. the focus stat bonus, but only when the focus stat is a main skill (Requirement 9.3).
 *
 * **Every configured main skill has a value; absence is not a state.** The returned record is the
 * main skill namespace handed to the formula engine, so a code the ruleset defines but the
 * character never allocated must read as 0 rather than as an undefined variable. `Undefined
 * variable` is reserved for codes the configuration genuinely does not define.
 *
 * @param character - The character whose skills to calculate
 * @param races - Array of Race objects for the character's races
 * @param options - Equipment, focus and main skill definitions; all optional
 * @returns Record of skill code to total level
 */
export function calculateTotalMainSkillLevels(
  character: Character,
  races: Race[],
  options: MainSkillCalculationOptions = {}
): Record<string, number> {
  const { mainSkills, equipmentBonuses = [], focusStatBonusLevel = 0 } = options;

  // Seed the configured namespace first, so an unallocated code is 0 rather than missing.
  // Omitting `mainSkills` leaves the plain allocation shape untouched for callers with no
  // configuration to seed from.
  const seededLevels: Record<string, number> = {};
  for (const skill of mainSkills ?? []) {
    seededLevels[skill.code] = 0;
  }

  const totalLevels: Record<string, number> = { ...seededLevels, ...character.mainSkillLevels };

  // Apply racial bonuses additively
  const racialModifiers = calculateRacialSkillModifiers(races);
  for (const [skillCode, modifier] of Object.entries(racialModifiers)) {
    totalLevels[skillCode] = (totalLevels[skillCode] || 0) + modifier;
  }

  // Skill codes are unique across main, speciality and combat skills, so filtering by the main
  // skill namespace guarantees an equipment bonus is never applied to two kinds of skill.
  const isMainSkillCode = (skillCode: string): boolean =>
    mainSkills
      ? mainSkills.some((skill) => skill.code === skillCode)
      : skillCode in character.mainSkillLevels;

  // Apply equipment bonuses that target a main skill
  for (const bonus of equipmentBonuses) {
    if (!isMainSkillCode(bonus.skillCode)) continue;
    totalLevels[bonus.skillCode] = (totalLevels[bonus.skillCode] || 0) + bonus.modifier;
  }

  // Apply the focus stat bonus only when the focus stat is a main skill — the speciality
  // calculator owns the speciality case, so the bonus lands exactly once.
  if (character.focusStatCode && isMainSkillCode(character.focusStatCode)) {
    totalLevels[character.focusStatCode] =
      (totalLevels[character.focusStatCode] || 0) + focusStatBonusLevel;
  }

  return totalLevels;
}
