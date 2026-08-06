/**
 * Configuration Types
 *
 * Type definitions for the user-defined configuration system.
 * All game rules, skills, materials, items, and races are defined here.
 */

/**
 * Main configuration object containing all user-defined game rules
 */
export interface Configuration {
  id: string;
  name: string;
  version: string;
  mainSkills: MainSkill[];
  stats: Stat[];
  specialitySkills: SpecialitySkill[];
  combatSkills: CombatSkill[];
  materials: Material[];
  materialCategories: MaterialCategory[];
  items: Item[];
  equipmentSlots: EquipmentSlot[];
  races: Race[];
  currencyTiers: CurrencyTier[];
  /**
   * Named tunable numbers, referenced from formulas as `const.<name>` (Concept 05).
   *
   * Optional so a configuration written before TICKET-CST-01 still loads. **Absent means none**
   * and stays absent: readers write `config.constants ?? []`, and a file without the key
   * round-trips without growing one — the same treatment `mainSkillPointBudget` gets.
   */
  constants?: Constant[];
  focusStatBonusLevel: number;
  /**
   * Points a Player may spend across all Main_Skills at character creation, one point per level.
   * Absent means unlimited, so rulesets saved before this field existed keep working.
   */
  mainSkillPointBudget?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Main skill - foundational skill with 3-letter code
 *
 * `id` is the identity (TICKET-REF-01): it never changes and is what a persisted formula stores.
 * `code` is display data the User may rename at will — see `engine/formula/references.ts`.
 */
export interface MainSkill {
  id: string; // Stable identity — assigned on creation, never shown, never reused
  code: string; // 3-letter code (e.g., "STR", "WIS", "CON") — renamable display data
  name: string;
  description: string;
  maxLevel: number;
}

/**
 * Stat - derived numeric value calculated from main skills using formulas
 */
export interface Stat {
  id: string;
  name: string;
  description: string;
  formula: string; // e.g., "STR * 10 + CON * 5"
}

/**
 * Speciality skill - skill with base level and bonus from formula
 *
 * `id` is the identity, `code` renamable display data (TICKET-REF-01).
 */
export interface SpecialitySkill {
  id: string; // Stable identity — assigned on creation, never shown, never reused
  code: string; // 3-letter code — renamable display data
  name: string;
  description: string;
  maxBaseLevel: number;
  bonusFormula: string; // e.g., "(STR + DEX) / 2"
}

/**
 * Combat skill - skill used in combat with dice rolls and bonuses
 *
 * `id` is the identity, `code` renamable display data (TICKET-REF-01).
 */
export interface CombatSkill {
  id: string; // Stable identity — assigned on creation, never shown, never reused
  code: string; // 3-letter code — renamable display data
  name: string;
  description: string;
  dice: DiceConfig;
  bonusFormula: string; // e.g., "STR + MEL"
}

/**
 * Dice configuration for combat skills
 */
export interface DiceConfig {
  d4: number;
  d6: number;
  d8: number;
  d10: number;
  d12: number;
  d20: number;
}

/**
 * Material - substance that provides bonuses/penalties and has value
 */
export interface Material {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  levels: MaterialLevel[];
}

/**
 * Material level - tier within a material with scaled bonuses and value
 */
export interface MaterialLevel {
  level: number;
  name: string; // e.g., "Iron", "Steel", "Mithril"
  bonuses: SkillModifier[];
  value: CurrencyValue;
}

/**
 * Skill modifier - bonus or penalty to a skill
 */
export interface SkillModifier {
  skillCode: string; // References Main/Speciality/Combat skill code
  modifier: number; // Positive for bonus, negative for penalty
}

/**
 * Currency value - amount in a specific currency tier
 */
export interface CurrencyValue {
  tierId: string;
  amount: number;
}

/**
 * Material category - user-defined grouping of related materials
 */
export interface MaterialCategory {
  id: string;
  name: string;
  description: string;
}

/**
 * Item - object with optional material and equipment slot
 */
export interface Item {
  id: string;
  name: string;
  description: string;
  categoryId?: string;
  materialId?: string;
  materialLevel?: number;
  equipmentSlotType?: string;
}

/**
 * Equipment slot - designated place where items can be equipped
 */
export interface EquipmentSlot {
  type: string; // e.g., "helmet", "main_hand", "off_hand"
  name: string;
  description: string;
}

/**
 * Race - character lineage providing skill bonuses/penalties
 */
export interface Race {
  id: string;
  name: string;
  description: string;
  skillModifiers: SkillModifier[]; // Only Main_Skills
}

/**
 * Constant - a named tunable number a formula reaches as `const.<name>` (Concept 05)
 *
 * The point is that a balance lever is referenced once and edited once, instead of the same
 * literal being buried in dozens of formula strings. `description` is required by the concept
 * page's own rule: a constant nobody understands is worse than a literal.
 *
 * `value` is a plain number. The spec allows a constant to derive from other constants via a
 * formula; that is deliberately not modelled yet — no seed needs it, and it brings a cycle-
 * detection problem with it. When it arrives, `value` widens to `number | string` and joins the
 * `formulaChange` guard.
 */
export interface Constant {
  id: string; // Stable identity — what a persisted formula points at
  name: string; // Identifier used in formulas (`bonus_divider`) — renamable display data
  displayName: string;
  description: string; // Required (Concept 05)
  value: number;
  unit?: string; // Display suffix, e.g. "points"
}

/**
 * Currency tier - level in the monetary system with conversion rates
 */
export interface CurrencyTier {
  id: string;
  name: string;
  order: number; // 0 = lowest value
  conversionToNext: number; // How many of this tier = 1 of next tier
}
