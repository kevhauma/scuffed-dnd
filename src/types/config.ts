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
  /**
   * Named lookup tables, called from formulas as `curve.<name>(x)` (Concept 06).
   *
   * Optional for the same reason `constants` is: absent means none and stays absent, so a
   * ruleset written before TICKET-CRV-01 round-trips without growing an empty array. Readers
   * write `config.curves ?? []`.
   */
  curves?: Curve[];
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
 * How a curve reads a key that falls between two rows (Concept 06)
 *
 * `step` holds the last row at or below the input — the threshold reading, which is what makes
 * "you stay level 4 until you cross 3,000 XP" fall out of the table rather than out of a rule.
 * `linear` interpolates between the two rows either side.
 */
export type CurveInterpolation = 'step' | 'linear';

/**
 * What a curve does with an input beyond its first or last row (Concept 06)
 *
 * `error` is the concept page's recommended default: silent clamping is how a level-50 character
 * ends up with a level-15 stat gain and nobody notices.
 */
export type CurveOutOfRange = 'clamp' | 'extrapolate' | 'error';

/**
 * Which axis a curve is read along (Concept 06)
 *
 * `forward` is key → value. `reverse` answers the opposite question — "given this value, which
 * key?" — and exists because some tables are naturally *written* one way and *read* the other:
 * you author "level 5 requires 3,000 XP" and ask "given 3,412 XP, what level am I?".
 */
export type CurveLookupDirection = 'forward' | 'reverse';

/**
 * One output column of a curve
 *
 * `id` is the identity, `name` the identifier a formula spells as `curve.<curve>.<column>(x)`.
 * A single-column curve is called without one.
 */
export interface CurveColumn {
  id: string; // Stable identity
  name: string; // Identifier used in formulas — renamable display data
  /**
   * Formula filling this column, evaluated once per row (Concept 06, TICKET-CRV-02).
   *
   * The row's key is in scope as `key`, alongside `const.*`. Absent means the column is
   * hand-entered — regeneration leaves it alone entirely, which is not the same as a generator
   * that happens to produce the stored numbers.
   */
  generator?: string;
}

/**
 * One row of a curve: an input key and one value per column
 *
 * `values` is positional against `columns`, and so is `overridden` — one addressing rule per row,
 * so adding or removing a column splices both arrays the same way.
 *
 * `overridden[i]` means "this cell was hand-tuned; regeneration must not touch it" (Concept 00
 * §1.1). Absent, or shorter than `values`, reads as `false` — which is what makes the field
 * additive: every curve written before TICKET-CRV-02 loads as fully generated.
 */
export interface CurveRow {
  key: number;
  values: number[];
  overridden?: boolean[];
}

/**
 * Curve - a named lookup table a formula calls as `curve.<name>(x)` (Concept 06)
 *
 * The point is that a progression is *data* — a table you can see and tune — rather than a chain
 * of nested conditionals buried in a formula string. Point-buy, XP thresholds and challenge
 * rating are all the same shape.
 *
 * `id` is the identity and `name` renamable display data, as everywhere else (TICKET-REF-01).
 */
export interface Curve {
  id: string; // Stable identity — what a persisted formula points at
  name: string; // Identifier used in formulas (`xp_thresholds`) — renamable display data
  displayName: string;
  description: string;
  /** What the input axis is called, for the editor's key column header */
  keyName: string;
  columns: CurveColumn[];
  /** Ascending by `key`, with no duplicates — `engine/validator.ts` reports either */
  rows: CurveRow[];
  interpolation: CurveInterpolation;
  outOfRange: CurveOutOfRange;
  lookupDirection: CurveLookupDirection;
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
