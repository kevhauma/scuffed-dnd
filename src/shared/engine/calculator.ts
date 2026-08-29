/**
 * Calculation Engine
 *
 * Main entry point for all calculation functions.
 * Re-exports the specialized calculators for stats, skills, equipment and rolls.
 *
 * **Validates: Requirements 11.5, 13.1, 13.2, 13.3, 3.6, 8.4**
 *
 * (Requirement 6.7 — bonuses and penalties to skills as well as stats — is deliberately no longer
 * validated anywhere: TICKET-MAT-01 removed the shape that could author one and TICKET-MAT-02 the
 * engine term that applied it. Concept 09 puts a tier's modifiers on stats.)
 */

import type { CalculatedCharacter, Character } from '../types/character';
import type { Configuration } from '../types/config';
import type { FormulaError, FormulaResult } from '../types/formula';
import { isFormulaError } from './formula/errors';

// Re-export all calculator functions
export * from './calculators/equipmentBonusCalculator';
export * from './calculators/pointBuy';
export * from './calculators/rollCalculator';
export * from './calculators/skillCalculator';
export * from './calculators/statCalculator';

import {
  calculateEquipmentBonuses,
  calculateEquipmentSkillBonuses,
} from './calculators/equipmentBonusCalculator';
import { archetypeOf, pointBuyCurve } from './calculators/pointBuy';
import { calculateRollInputs } from './calculators/rollCalculator';
// Import for the composed entry point
import { calculateSkills } from './calculators/skillCalculator';
import { calculateStatTotal, calculateStatValues } from './calculators/statCalculator';
import { resolveRaces } from './races';

/**
 * Calculate every derived value for a character
 *
 * The single composed entry point of the calculation engine: it runs the calculators in
 * dependency order and returns the character with all derived values attached. Nothing here is
 * persisted — call it at read time whenever a derived number is needed.
 *
 * The ordering is load-bearing:
 * 1. **equipment** — resolved first, because the composition consumes it;
 * 2. **stats** — the composition: race blend + invested points + equipment for an invested stat,
 *    the formula for a derived one, then clamp and round (TICKET-STAT-01). Everything downstream
 *    reads them, so an equipped `STR +2` moves every stat and skill derived from `STR`
 *    (Requirement 13.3);
 * 3. **skills** — `Σ(weight × stat) + invested`, and the bonus that rounds off it (Concept 02),
 *    plus the equipped templates' own per-skill vector on that bonus (TICKET-ITEM-01);
 * 4. **roll inputs** — each roll definition's expression over stats and skills, both already
 *    computed (TICKET-ROLL-06, which replaced the combat skill that used to sit here).
 *
 * **Equipment supplies two terms, and neither can claim the other's share** (TICKET-MAT-02,
 * TICKET-ITEM-01). A *material tier's* modifier names a **stat** and is applied exactly once, at
 * step 2 — steps 3 and 4 read stats the bonus has already moved rather than adding it again. An
 * *item template's* bonus names a **skill** and is applied exactly once, at step 3, on the skill's
 * bonus. They cannot double-count because a stat is not a skill: no shape lets one modifier be both
 * (Requirement 13.2, v4 systems/11). They are resolved together in step 1 because they read the
 * *same* worn set — one `equippedTemplates` walk over the ruleset's own slots — which is what stops
 * a force-deleted slot leaving one item half-counted, granting its material's stats and none of its
 * skill vector.
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
  // The picks in pick order, duplicates kept and capped at `const.race_count` — a pure-blood is the
  // same race in every slot since TICKET-RACE-04, and a filter over the ruleset's list would
  // collapse it to one. The cap lives in `resolveRaces` so the sheet names exactly what this blends
  const races = resolveRaces(config, character.raceIds);

  // 1. What the equipped items are worth — the material tiers' stat side, and the templates' own
  // per-skill vector (TICKET-ITEM-01). Both read the same equipped slots, so they are resolved
  // together; they land two steps apart because they move two different quantities
  const equipmentBonuses = calculateEquipmentBonuses(character, config);
  const gearSkillBonuses = calculateEquipmentSkillBonuses(character, config);

  // 2. Stat values — the composition (invested or derived), clamped and rounded
  const statValues = calculateStatValues(config.stats, character, {
    races,
    equipmentBonuses,
    source: config,
    // What a spent point buys, by affinity (TICKET-ARC-02). Resolved here rather than inside the
    // composition so the calculator stays the one place that reads the whole `Configuration`.
    archetype: archetypeOf(character, config),
    pointBuy: pointBuyCurve(config),
  });

  // 3. Skill levels and bonuses — weighted stats plus what the Player invested (Concept 02)
  const {
    levels: skillLevels,
    bonuses: skillBonuses,
    contributions: skillContributions,
    focus: skillFocus,
  } = calculateSkills(config, statValues, character, gearSkillBonuses);

  // 4. Roll inputs — each definition's expression over the stats and skills already computed
  // (TICKET-ROLL-06). The number, not a pool: the pool is derived from it at roll time.
  const rollInputs = calculateRollInputs(config, statValues, {
    levels: skillLevels,
    bonuses: skillBonuses,
  });

  return {
    ...character,
    statValues,
    statTotal: calculateStatTotal(config.stats, statValues),
    skillLevels,
    skillBonuses,
    skillContributions,
    skillFocus,
    rollInputs,
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
    ...Object.values(calculated.skillLevels),
    ...Object.values(calculated.rollInputs),
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
