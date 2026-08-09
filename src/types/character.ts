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
  /**
   * Points the Player has put into each stat, keyed by **stat id** (TICKET-STAT-01).
   *
   * Keyed by id rather than by a spelling, so renaming a stat cannot orphan an allocation — the
   * same reason a formula stores ids. A derived stat never appears here; an invested stat the
   * Player has not touched reads 0 through the calculator rather than being absent, which is
   * TICKET-CALC-02's invariant carried across.
   */
  investedStatPoints: Record<string, number>; // statId -> points invested
  focusStatCode?: string; // Stat abbreviation or speciality skill code — retired by TICKET-ARC-03
  specialitySkillBaseLevels: Record<string, number>; // skillCode -> base level
  /**
   * Where each **resource** stat currently stands against its maximum, keyed by stat id.
   *
   * Only `isResource` stats appear: a stat you cannot spend has no "current" distinct from its
   * value, and v1 gave every stat one. This is the one sanctioned piece of derived-looking state
   * that is genuinely stored — it is player state, not a derivation.
   */
  currentResourceValues: Record<string, number>; // statId -> current value
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
 * `statValues` replaced v1's `totalMainSkillLevels` + `maxStatValues` when the two entities
 * became one (TICKET-STAT-01). It is one map because there is one concept: the composed value of
 * every configured stat, keyed by stat id. For a **resource** stat that number is the maximum,
 * which `currentResourceValues` is measured against; for every other stat it is just the value.
 * It holds `FormulaResult` rather than `number` because a derived stat's formula can fail.
 */
export interface CalculatedCharacter extends Character {
  statValues: Record<string, FormulaResult>; // statId -> composed value (the max, for resources)
  /** Sum of the `countsTowardTotal` stats — stats that failed to compute contribute nothing */
  statTotal: number;
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
  investedStatPoints: Record<string, number>;
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
  level: number; // Derived from invested stat points — TICKET-RES-01 inverts this to derive from XP
  createdAt: string;
}
