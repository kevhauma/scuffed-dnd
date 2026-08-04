/**
 * Configuration Validator
 *
 * Validates complete configuration for:
 * - Formula references point to existing skills
 * - Equipment slot types referenced by items exist
 * - Material categories referenced by materials exist
 * - No circular dependencies in formulas
 * - Currency tier references are valid
 *
 * **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5**
 */

import type { Configuration } from '../types/config';
import { scopeFor } from './formula/scoping';
import type { FormulaDependency } from './formula/validator';
import {
  toFormulaDependency,
  validateFormula,
  validateFormulaCollection,
} from './formula/validator';

/**
 * Validation issue severity levels
 */
export type ValidationSeverity = 'error' | 'warning';

/**
 * Validation issue
 */
export interface ValidationIssue {
  severity: ValidationSeverity;
  category: string;
  message: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
}

/**
 * Validation report containing all detected issues
 */
export interface ValidationReport {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  timestamp: string;
}

/**
 * Validate a complete configuration
 *
 * @param config - Configuration to validate
 * @returns Validation report with all detected issues
 */
export function validateConfiguration(config: Configuration): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Build sets of valid identifiers for reference validation
  const mainSkillCodes = new Set(config.mainSkills.map((s) => s.code));
  const specialitySkillCodes = new Set(config.specialitySkills.map((s) => s.code));
  const combatSkillCodes = new Set(config.combatSkills.map((s) => s.code));
  const allSkillCodes = new Set([...mainSkillCodes, ...specialitySkillCodes, ...combatSkillCodes]);
  const materialCategoryIds = new Set(config.materialCategories.map((c) => c.id));
  const equipmentSlotTypes = new Set(config.equipmentSlots.map((s) => s.type));
  const materialIds = new Set(config.materials.map((m) => m.id));
  const currencyTierIds = new Set(config.currencyTiers.map((t) => t.id));

  // Validate formulas against the same scoping table the save-time guard uses, so an imported
  // ruleset is judged by exactly the rules a panel would have enforced (Concept 00 §5).
  const statScope = scopeFor(config, 'stat');
  const specialityScope = scopeFor(config, 'speciality-skill');
  const combatScope = scopeFor(config, 'combat-skill');

  // Validate stat formulas
  for (const stat of config.stats) {
    const result = validateFormula(stat.formula, statScope.codes, statScope);

    if (!result.isValid) {
      for (const error of result.errors) {
        errors.push({
          severity: 'error',
          category: 'Formula Validation',
          message: `Stat "${stat.name}": ${error}`,
          entityType: 'stat',
          entityId: stat.id,
          entityName: stat.name,
        });
      }
    }
  }

  // Validate speciality skill formulas
  for (const skill of config.specialitySkills) {
    const result = validateFormula(skill.bonusFormula, specialityScope.codes, specialityScope);

    if (!result.isValid) {
      for (const error of result.errors) {
        errors.push({
          severity: 'error',
          category: 'Formula Validation',
          message: `Speciality Skill "${skill.name}": ${error}`,
          entityType: 'specialitySkill',
          entityId: skill.code,
          entityName: skill.name,
        });
      }
    }
  }

  // Validate combat skill formulas
  for (const skill of config.combatSkills) {
    const result = validateFormula(skill.bonusFormula, combatScope.codes, combatScope);

    if (!result.isValid) {
      for (const error of result.errors) {
        errors.push({
          severity: 'error',
          category: 'Formula Validation',
          message: `Combat Skill "${skill.name}": ${error}`,
          entityType: 'combatSkill',
          entityId: skill.code,
          entityName: skill.name,
        });
      }
    }
  }

  // Validate circular dependencies in formulas. `toFormulaDependency` is the one place that
  // decides what an edge is, so bare codes and dotted references land on the same graph nodes.
  const formulaDependencies: FormulaDependency[] = [
    ...config.stats.map((stat) => toFormulaDependency(stat.id, stat.formula)),
    ...config.specialitySkills.map((skill) => toFormulaDependency(skill.code, skill.bonusFormula)),
    ...config.combatSkills.map((skill) => toFormulaDependency(skill.code, skill.bonusFormula)),
  ];

  const circularResult = validateFormulaCollection(formulaDependencies);
  if (!circularResult.isValid) {
    for (const error of circularResult.errors) {
      errors.push({
        severity: 'error',
        category: 'Circular Dependency',
        message: error,
      });
    }
  }

  // Validate material category references
  for (const material of config.materials) {
    if (!materialCategoryIds.has(material.categoryId)) {
      errors.push({
        severity: 'error',
        category: 'Reference Validation',
        message: `Material "${material.name}" references non-existent category ID: ${material.categoryId}`,
        entityType: 'material',
        entityId: material.id,
        entityName: material.name,
      });
    }

    // Validate skill modifiers in material levels
    for (const level of material.levels) {
      for (const bonus of level.bonuses) {
        if (!allSkillCodes.has(bonus.skillCode)) {
          errors.push({
            severity: 'error',
            category: 'Reference Validation',
            message: `Material "${material.name}" level ${level.level} references non-existent skill: ${bonus.skillCode}`,
            entityType: 'material',
            entityId: material.id,
            entityName: material.name,
          });
        }
      }

      // Validate currency tier references
      if (!currencyTierIds.has(level.value.tierId)) {
        errors.push({
          severity: 'error',
          category: 'Reference Validation',
          message: `Material "${material.name}" level ${level.level} references non-existent currency tier: ${level.value.tierId}`,
          entityType: 'material',
          entityId: material.id,
          entityName: material.name,
        });
      }
    }
  }

  // Validate item references
  for (const item of config.items) {
    // Validate equipment slot type
    if (item.equipmentSlotType && !equipmentSlotTypes.has(item.equipmentSlotType)) {
      errors.push({
        severity: 'error',
        category: 'Reference Validation',
        message: `Item "${item.name}" references non-existent equipment slot type: ${item.equipmentSlotType}`,
        entityType: 'item',
        entityId: item.id,
        entityName: item.name,
      });
    }

    // Validate material reference
    if (item.materialId && !materialIds.has(item.materialId)) {
      errors.push({
        severity: 'error',
        category: 'Reference Validation',
        message: `Item "${item.name}" references non-existent material ID: ${item.materialId}`,
        entityType: 'item',
        entityId: item.id,
        entityName: item.name,
      });
    }

    // Validate material level if material is specified
    if (item.materialId && item.materialLevel !== undefined) {
      const material = config.materials.find((m) => m.id === item.materialId);
      if (material) {
        const levelExists = material.levels.some((l) => l.level === item.materialLevel);
        if (!levelExists) {
          errors.push({
            severity: 'error',
            category: 'Reference Validation',
            message: `Item "${item.name}" references non-existent material level ${item.materialLevel} for material "${material.name}"`,
            entityType: 'item',
            entityId: item.id,
            entityName: item.name,
          });
        }
      }
    }
  }

  // Validate race skill modifiers
  for (const race of config.races) {
    for (const modifier of race.skillModifiers) {
      if (!mainSkillCodes.has(modifier.skillCode)) {
        errors.push({
          severity: 'error',
          category: 'Reference Validation',
          message: `Race "${race.name}" references non-existent main skill: ${modifier.skillCode}`,
          entityType: 'race',
          entityId: race.id,
          entityName: race.name,
        });
      }
    }
  }

  // Validate currency tier ordering
  const tierOrders = config.currencyTiers.map((t) => t.order);
  const uniqueOrders = new Set(tierOrders);
  if (tierOrders.length !== uniqueOrders.size) {
    warnings.push({
      severity: 'warning',
      category: 'Data Consistency',
      message: 'Currency tiers have duplicate order values',
    });
  }

  // Check for gaps in currency tier ordering
  if (config.currencyTiers.length > 0) {
    const sortedOrders = [...tierOrders].sort((a, b) => a - b);
    for (let i = 0; i < sortedOrders.length - 1; i++) {
      if (sortedOrders[i + 1] - sortedOrders[i] > 1) {
        warnings.push({
          severity: 'warning',
          category: 'Data Consistency',
          message: `Currency tier ordering has gaps between ${sortedOrders[i]} and ${sortedOrders[i + 1]}`,
        });
      }
    }
  }

  // Validate unique skill codes
  const allCodes = [
    ...config.mainSkills.map((s) => ({ code: s.code, type: 'Main Skill', name: s.name })),
    ...config.specialitySkills.map((s) => ({
      code: s.code,
      type: 'Speciality Skill',
      name: s.name,
    })),
    ...config.combatSkills.map((s) => ({ code: s.code, type: 'Combat Skill', name: s.name })),
  ];

  const codeMap = new Map<string, Array<{ type: string; name: string }>>();
  for (const { code, type, name } of allCodes) {
    if (!codeMap.has(code)) {
      codeMap.set(code, []);
    }
    codeMap.get(code)?.push({ type, name });
  }

  for (const [code, skills] of codeMap.entries()) {
    if (skills.length > 1) {
      const skillList = skills.map((s) => `${s.type} "${s.name}"`).join(', ');
      errors.push({
        severity: 'error',
        category: 'Uniqueness Validation',
        message: `Duplicate skill code "${code}" used by: ${skillList}`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    timestamp: new Date().toISOString(),
  };
}
