/**
 * Character Types
 *
 * Type definitions for player characters and their state.
 */

import type { StatModifier } from './config';
import type { FormulaResult } from './formula';

/**
 * One weight row's share of a skill's level (Concept 02, TICKET-SKL-03)
 *
 * The engine's own terms rather than the sheet's: a caller gets the stat id, the weight and the
 * stat's value, and spells them however it renders. The **multiplication is done in the
 * calculator**, because `weight × statValue` is the derivation and a component that recomputed it
 * could disagree with the level it sits beside.
 */
export interface SkillStatContribution {
  statId: string;
  weight: number;
  /** The stat's composed value at the time the level was computed */
  statValue: number;
  /** `weight × statValue` — this row's share of the level */
  contribution: number;
}

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
  /**
   * The stat this character focused on, by **abbreviation** — retired by TICKET-ARC-03.
   *
   * A stat only, since TICKET-SKL-02: a skill has no code to name it by any more, so a focus on a
   * skill has nowhere to point. Archetype replaces the whole mechanism, so this is a shrinking
   * field rather than one to redesign.
   */
  focusStatCode?: string;
  /**
   * Points the Player has put into each skill, keyed by **skill id** (TICKET-SKL-02).
   *
   * Replaces v1's `specialitySkillBaseLevels`, which was keyed by a mutable 3-letter code — so a
   * rename orphaned the Player's investment and needed a store action to chase it. An id cannot.
   * The contribution to `level` is 1:1 for now; Concept 02 leaves the real conversion open
   * (`+1.5` for one starting pick), and TICKET-ARC-02 routes it through the point-buy curve.
   */
  investedSkillPoints: Record<string, number>;
  /**
   * Where each **resource** stat currently stands against its maximum, keyed by stat id.
   *
   * Only `isResource` stats appear: a stat you cannot spend has no "current" distinct from its
   * value, and v1 gave every stat one. This is the one sanctioned piece of derived-looking state
   * that is genuinely stored — it is player state, not a derivation.
   */
  currentResourceValues: Record<string, number>; // statId -> current value
  /**
   * Total experience the character has accumulated (Concept 20, TICKET-RES-01).
   *
   * The **second** sanctioned piece of stored player state, beside `currentResourceValues`. It is
   * stored rather than derived because nothing else in the app knows it: XP is awarded at the
   * table, and `level` is what derives *from* it through the `xp_thresholds` curve.
   *
   * Accumulate-only in spirit — there is no maximum and it never resets — but deductions are
   * allowed (the sheet's `exp.gs` has both), floored at 0 by the store action rather than by this
   * type. A fresh character starts at 0, which the seeded curve reads as level 1.
   *
   * **This inverts v1.0**, where level was the *sum of points spent*. The chain now runs
   * `XP → level → budget → spend` (TICKET-RES-02 closes the budget half).
   */
  experience: number;
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
  /** Each skill's level — `Σ(weight × stat) + invested` — keyed by skill id (Concept 02) */
  skillLevels: Record<string, FormulaResult>;
  /** Each skill's **bonus**, the integer a Player adds to a roll: `round(level / bonus_divider)` */
  skillBonuses: Record<string, FormulaResult>;
  /**
   * The weight rows behind each level, so the sheet can label a breakdown without redoing the
   * multiplication (TICKET-SKL-03). Derived like the rest — never persisted.
   */
  skillContributions: Record<string, SkillStatContribution[]>;
  combatSkillBonuses: Record<string, FormulaResult>; // Calculated from formulas
  equipmentBonuses: StatModifier[]; // From equipped items, keyed by stat id (TICKET-MAT-02)
}

/**
 * Character creation data - used during character creation wizard
 */
export interface CharacterCreationData {
  name: string;
  raceIds: string[];
  investedStatPoints: Record<string, number>;
  focusStatCode?: string;
  investedSkillPoints: Record<string, number>;
}

/**
 * Character summary - lightweight character info for list display
 */
export interface CharacterSummary {
  id: string;
  name: string;
  raceIds: string[];
  /**
   * Derived from accumulated XP through the `xp_thresholds` curve (TICKET-RES-01).
   *
   * A `FormulaResult` rather than a number because that curve is the User's data like any other:
   * they can delete it, or set `outOfRange: 'error'` and leave a character's XP outside the table.
   * A level that cannot be read says so rather than showing a confident 1 (Concept 00 §7).
   */
  level: FormulaResult;
  createdAt: string;
}
