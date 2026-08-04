/**
 * Character Types
 *
 * Type definitions for player characters and their state.
 */

import type { SkillModifier } from './config';
import type { FormulaResult } from './formula';

/**
 * Character - player's in-game persona with stats, skills, and equipment
 */
export interface Character {
  id: string;
  name: string;
  configurationId: string;
  raceIds: string[];
  mainSkillLevels: Record<string, number>; // skillCode -> level
  focusStatCode?: string; // Main or Speciality skill code
  specialitySkillBaseLevels: Record<string, number>; // skillCode -> base level
  currentStatValues: Record<string, number>; // statId -> current value
  inventory: Inventory;
  createdAt: string;
  updatedAt: string;
}

/**
 * Inventory - character's collection of equipment slots and items
 */
export interface Inventory {
  equippedItems: Record<string, string>; // equipmentSlotType -> itemId
  miscItems: string[]; // Array of itemIds
}

/**
 * Calculated character - extends Character with computed values
 * These values are not persisted, computed on demand from base character data
 *
 * The three formula-derived maps hold a `FormulaResult` per entry — a number, or an error value
 * explaining why that one entry could not be calculated (Concept 00 §7). A broken formula never
 * blanks the rest of the sheet. Read them with `numberOr(result, fallback)` where a number is
 * structurally required, or `asNumber(result)` where absence matters (rendering an error chip,
 * skipping a clamp); both live in `engine/formula/errors.ts`.
 *
 * `totalMainSkillLevels` is a plain number map: main skill levels are allocated and modified, not
 * derived from user formulas, so there is nothing there that can fail.
 */
export interface CalculatedCharacter extends Character {
  totalMainSkillLevels: Record<string, number>; // With racial bonuses
  maxStatValues: Record<string, FormulaResult>; // Calculated from formulas
  specialitySkillTotalLevels: Record<string, FormulaResult>; // Base + bonus
  combatSkillBonuses: Record<string, FormulaResult>; // Calculated from formulas
  equipmentBonuses: SkillModifier[]; // From equipped items
}

/**
 * Character creation data - used during character creation wizard
 */
export interface CharacterCreationData {
  name: string;
  raceIds: string[];
  mainSkillLevels: Record<string, number>;
  focusStatCode?: string;
  specialitySkillBaseLevels: Record<string, number>;
}

/**
 * Character summary - lightweight character info for list display
 */
export interface CharacterSummary {
  id: string;
  name: string;
  raceIds: string[];
  level: number; // Derived from total main skill levels
  createdAt: string;
}
