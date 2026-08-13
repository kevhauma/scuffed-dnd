/**
 * Configuration Validator
 *
 * Validates complete configuration for:
 * - Formula references point to existing skills
 * - Equipment slot types referenced by items exist
 * - Material categories referenced by materials exist
 * - No circular dependencies in formulas
 * - Currency tier references are valid
 * - Curve tables are readable — unique, sorted keys with a value per column (Concept 06)
 *
 * **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5; Concept 06**
 */

import type { Configuration, Curve } from '../types/config';
import type { FormulaScope } from './formula/scoping';
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
  const materialCategoryIds = new Set(config.materialCategories.map((c) => c.id));
  const equipmentSlotTypes = new Set(config.equipmentSlots.map((s) => s.type));
  const materialIds = new Set(config.materials.map((m) => m.id));
  const currencyTierIds = new Set(config.currencyTiers.map((t) => t.id));
  const statsById = new Map(config.stats.map((stat) => [stat.id, stat]));

  // Validate formulas against the same scoping table the save-time guard uses, so an imported
  // ruleset is judged by exactly the rules a panel would have enforced (Concept 00 §5).
  const statScope = scopeFor(config, 'stat');
  const specialityScope = scopeFor(config, 'speciality-skill');
  const combatScope = scopeFor(config, 'combat-skill');

  // Validate stat formulas — only derived stats have one (TICKET-STAT-01)
  for (const stat of config.stats) {
    if (stat.formula === undefined) continue;
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
    ...config.stats
      .filter((stat) => stat.formula !== undefined)
      .map((stat) => toFormulaDependency(stat.id, stat.formula as string)),
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

    // Validate stat modifiers in material levels. Keyed by stat **id** since TICKET-MAT-01, so a
    // dangling key is a stat that was deleted rather than one that was renamed.
    for (const level of material.levels) {
      for (const bonus of level.bonuses) {
        const target = statsById.get(bonus.statId);

        if (!target) {
          errors.push({
            severity: 'error',
            category: 'Reference Validation',
            message: `Material "${material.name}" level ${level.level} references non-existent stat: ${bonus.statId}`,
            entityType: 'material',
            entityId: material.id,
            entityName: material.name,
          });
          continue;
        }

        // A derived stat's formula *is* its source, so a modifier on one would be a term the
        // composition never applies — silently, which is the worst kind of wrong number
        if (target.formula !== undefined) {
          errors.push({
            severity: 'error',
            category: 'Reference Validation',
            message: `Material "${material.name}" level ${level.level} modifies "${target.name}", which is a derived stat — its formula is its only source`,
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

  // Validate race stat blocks — keyed by stat id since TICKET-RACE-01, so a dangling key is a
  // stat that was deleted rather than one that was renamed
  for (const race of config.races) {
    for (const statId of Object.keys(race.statValues)) {
      if (!statsById.has(statId)) {
        errors.push({
          severity: 'error',
          category: 'Reference Validation',
          message: `Race "${race.name}" references non-existent stat: ${statId}`,
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
    ...config.stats.map((s) => ({ code: s.abbreviation, type: 'Stat', name: s.name })),
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

  // Validate curve tables (Concept 06). Generators are formulas like any other, so they are
  // judged against their own row of the scoping table.
  const generatorScope = scopeFor(config, 'curve-generator');
  for (const curve of config.curves ?? []) {
    errors.push(...curveTableErrors(curve, generatorScope));
    warnings.push(...curveTableWarnings(curve));
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Row problems that make a curve unreadable (Concept 06's validation rules)
 *
 * Duplicate and unsorted keys are errors rather than warnings because a lookup cannot be
 * well-defined over either: two rows claiming the same key disagree about the answer, and an
 * unsorted table is one somebody edited by hand and expected to be read in order.
 *
 * @param curve - The curve to check
 * @param generatorScope - What a generator formula on this ruleset may reference
 * @returns One issue per problem found
 */
function curveTableErrors(curve: Curve, generatorScope: FormulaScope): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entity = { entityType: 'Curve', entityId: curve.id, entityName: curve.displayName };

  if (curve.columns.length === 0) {
    issues.push({
      severity: 'error',
      category: 'Curve Validation',
      message: `Curve "${curve.displayName}" has no value columns`,
      ...entity,
    });
  }

  const seenKeys = new Set<number>();
  for (const [index, row] of curve.rows.entries()) {
    if (seenKeys.has(row.key)) {
      issues.push({
        severity: 'error',
        category: 'Curve Validation',
        message: `Curve "${curve.displayName}" has more than one row for ${curve.keyName} ${row.key}`,
        ...entity,
      });
    }
    seenKeys.add(row.key);

    if (index > 0 && row.key < curve.rows[index - 1].key) {
      issues.push({
        severity: 'error',
        category: 'Curve Validation',
        message: `Curve "${curve.displayName}" rows are not sorted by ${curve.keyName}: ${row.key} follows ${curve.rows[index - 1].key}`,
        ...entity,
      });
    }

    if (row.values.length !== curve.columns.length) {
      issues.push({
        severity: 'error',
        category: 'Curve Validation',
        message: `Curve "${curve.displayName}" row ${row.key} has ${row.values.length} value(s) for ${curve.columns.length} column(s)`,
        ...entity,
      });
    }
  }

  issues.push(...reverseColumnErrors(curve, entity));
  issues.push(...generatorErrors(curve, generatorScope, entity));

  return issues;
}

/**
 * Generator formulas that would not produce a number (TICKET-CRV-02)
 *
 * Checked against the `curve-generator` row of the scoping table, the same way every other
 * formula in the ruleset is checked against its own attachment point — a generator sees the
 * row's `key` and `const.*`, and nothing else.
 *
 * @param curve - The curve whose columns to check
 * @param scope - The `curve-generator` scope for this configuration
 * @param entity - The entity fields shared by every issue about this curve
 * @returns One issue per column whose generator does not validate
 */
function generatorErrors(
  curve: Curve,
  scope: FormulaScope,
  entity: Pick<ValidationIssue, 'entityType' | 'entityId' | 'entityName'>
): ValidationIssue[] {
  return curve.columns.flatMap((column) => {
    if (column.generator === undefined) return [];

    const result = validateFormula(column.generator, scope.codes, scope);
    return result.isValid
      ? []
      : [
          {
            severity: 'error' as const,
            category: 'Curve Validation',
            message: `Curve "${curve.displayName}" column "${column.name}" generator: ${result.errors.join(', ')}`,
            ...entity,
          },
        ];
  });
}

/**
 * Value columns a reverse lookup could not read in order
 *
 * A reverse curve is read along its *value* column — "given 3,412 XP, what level?" — so that
 * column has to ascend for the question to have one answer. A column that doubles back makes two
 * keys equally correct, and the engine has to pick one; naming it here is what stops the User
 * from ever meeting that arbitrary choice.
 *
 * @param curve - The curve to check; only `reverse` ones have this constraint
 * @param entity - The entity fields shared by every issue about this curve
 * @returns One issue per column that decreases
 */
function reverseColumnErrors(
  curve: Curve,
  entity: Pick<ValidationIssue, 'entityType' | 'entityId' | 'entityName'>
): ValidationIssue[] {
  if (curve.lookupDirection !== 'reverse') return [];

  return curve.columns.flatMap((column, columnIndex) => {
    const values = curve.rows.map((row) => row.values[columnIndex]);
    const dropsAt = values.findIndex(
      (value, index) => index > 0 && typeof value === 'number' && value < values[index - 1]
    );

    return dropsAt === -1
      ? []
      : [
          {
            severity: 'error' as const,
            category: 'Curve Validation',
            message: `Curve "${curve.displayName}" is read in reverse, so column "${column.name}" must not decrease — it drops from ${values[dropsAt - 1]} to ${values[dropsAt]}`,
            ...entity,
          },
        ];
  });
}

/**
 * Row problems worth flagging but not refusing
 *
 * Concept 06's gap rule, as written there: with `step` interpolation, a gap wider than the average
 * step means a wide band of inputs silently collapses onto one output. That is sometimes
 * deliberate — the challenge rating table is exactly that shape — so it is a warning the User
 * confirms, not an error.
 *
 * @param curve - The curve to check
 * @returns One issue per unusually wide gap
 */
function curveTableWarnings(curve: Curve): ValidationIssue[] {
  if (curve.interpolation !== 'step' || curve.rows.length < 3) return [];

  const gaps = curve.rows.slice(1).map((row, index) => row.key - curve.rows[index].key);
  const averageGap = gaps.reduce((total, gap) => total + gap, 0) / gaps.length;
  if (averageGap <= 0) return [];

  return gaps.flatMap((gap, index) =>
    gap > averageGap
      ? [
          {
            severity: 'warning' as const,
            category: 'Curve Validation',
            message: `Curve "${curve.displayName}" jumps from ${curve.rows[index].key} to ${curve.rows[index + 1].key}, so every ${curve.keyName} between them reads the same value`,
            entityType: 'Curve',
            entityId: curve.id,
            entityName: curve.displayName,
          },
        ]
      : []
  );
}
