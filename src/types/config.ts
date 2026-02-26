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
  focusStatBonusLevel: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Main skill - foundational skill with 3-letter code
 */
export interface MainSkill {
  code: string; // 3-letter unique identifier (e.g., "STR", "WIS", "CON")
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
 */
export interface SpecialitySkill {
  code: string; // 3-letter unique identifier
  name: string;
  description: string;
  maxBaseLevel: number;
  bonusFormula: string; // e.g., "(STR + DEX) / 2"
}

/**
 * Combat skill - skill used in combat with dice rolls and bonuses
 */
export interface CombatSkill {
  code: string; // 3-letter unique identifier
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
 * Currency tier - level in the monetary system with conversion rates
 */
export interface CurrencyTier {
  id: string;
  name: string;
  order: number; // 0 = lowest value
  conversionToNext: number; // How many of this tier = 1 of next tier
}
