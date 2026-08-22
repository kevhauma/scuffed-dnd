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
 * - Dice ladders can be walked — positive, strictly descending die sizes (Concept 07)
 * - Roll definitions compute and point at a ladder that exists (Concept 08)
 *
 * **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5; Concepts 06, 07, 08**
 */

import type { Configuration, Curve, DiceLadder, RollDefinition, Skill } from '../types/config';
import { POINT_BUY_CURVE_NAME } from '../types/config';
import { buildReferenceResolver } from './formula/references';
import type { FormulaScope } from './formula/scoping';
import { scopeFor } from './formula/scoping';
import type { FormulaDependency } from './formula/validator';
import {
  toFormulaDependency,
  validateFormula,
  validateFormulaCollection,
} from './formula/validator';

/**
 * The weight sum above which Concept 02 calls a skill a balance smell
 *
 * The sheet's own skills weigh one stat at 0.2 or 0.3, or two at 0.2 and 0.1 — so 0.5 is the top of
 * the observed range rather than a rule, which is why exceeding it is reported as information.
 */
const BALANCED_WEIGHT_SUM = 0.5;

/**
 * A weight sum stated without floating-point noise
 *
 * `0.2 + 0.1` is `0.30000000000000004`, and a message that says so reads as a bug in the app rather
 * than a fact about the ruleset. Two decimals covers every weight the sheet uses.
 */
function roundWeightSum(sum: number): number {
  return Math.round(sum * 100) / 100;
}

/**
 * Validation issue severity levels
 *
 * `information` arrived with TICKET-SKL-03 for Concept 02's balance rule, which is explicitly *not*
 * a mistake: a skill weighted well above ~0.5 is a deliberate choice as often as an accident, and
 * reporting it as a warning would train the User to ignore warnings. It never affects `isValid`.
 */
export type ValidationSeverity = 'error' | 'warning' | 'information';

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
  /** Observations that are worth stating and are not defects — see {@link ValidationSeverity} */
  information: ValidationIssue[];
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
  const information: ValidationIssue[] = [];

  // Build sets of valid identifiers for reference validation
  const materialCategoryIds = new Set(config.materialCategories.map((c) => c.id));
  const equipmentSlotTypes = new Set(config.equipmentSlots.map((s) => s.type));
  const materialIds = new Set(config.materials.map((m) => m.id));
  const currencyTierIds = new Set(config.currencyTiers.map((t) => t.id));
  const statsById = new Map(config.stats.map((stat) => [stat.id, stat]));

  // Validate formulas against the same scoping table the save-time guard uses, so an imported
  // ruleset is judged by exactly the rules a panel would have enforced (Concept 00 §5).
  const statScope = scopeFor(config, 'stat');

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

  // Validate skill weight rows — a skill has no formula since TICKET-SKL-02, so what can be
  // wrong is a weight naming a stat the ruleset does not define (Concept 02)
  for (const skill of config.skills) {
    for (const { statId } of skill.statWeights) {
      if (statsById.has(statId)) continue;

      errors.push({
        severity: 'error',
        category: 'Reference Validation',
        message: `Skill "${skill.name}" is weighted on a stat that does not exist: ${statId}`,
        entityType: 'skill',
        entityId: skill.id,
        entityName: skill.name,
      });
    }

    // Concept 02's own validation rule: not an error, but worth saying out loud.
    //
    // Stated about the *ruleset* rather than about any character, which is all this function can
    // see: the concept page's "and no invested points" half is a property of a Player's
    // allocation, and a config-mode report has no character in hand to check it against.
    if (skill.statWeights.length === 0) {
      warnings.push({
        severity: 'warning',
        category: 'Data Consistency',
        message: `Skill "${skill.name}" has no stat weights, so its level is whatever the Player invests and nothing else`,
        entityType: 'skill',
        entityId: skill.id,
        entityName: skill.name,
      });
    }

    // Concept 02's balance rule. Deliberately *information*: the sheet's own skills sum to 0.2–0.3,
    // so more than 0.5 is a departure from that shape — but a departure the User may well have
    // meant, and calling it a warning would devalue the warnings that are real problems.
    const weightSum = skill.statWeights.reduce((total, row) => total + row.weight, 0);
    if (weightSum > BALANCED_WEIGHT_SUM) {
      information.push({
        severity: 'information',
        category: 'Balance',
        // "above", not "well above": the check is a strict `>`, so 0.51 lands here too and the
        // message has to be true of it as well as of 0.9
        message: `Skill "${skill.name}" has stat weights totalling ${roundWeightSum(weightSum)}, above the ~${BALANCED_WEIGHT_SUM} the sheet's own skills use — deliberate, or a typo?`,
        entityType: 'skill',
        entityId: skill.id,
        entityName: skill.name,
      });
    }
  }

  // Concept 02's near-duplicate rule. The sheet genuinely holds both `skinning` and `Skinning` with
  // different levels, so this can never be an error — TICKET-SKL-02 made two skills sharing a
  // spelling legal by taking a skill out of the flat formula space. It is a warning because the
  // usual cause is one skill entered twice, and only the User can tell that from the sheet's case.
  warnings.push(...nearDuplicateSkillNameWarnings(config.skills));

  // Validate circular dependencies in formulas. `toFormulaDependency` is the one place that
  // decides what an edge is, so bare codes and dotted references land on the same graph nodes —
  // both are resolved to the stat's id, which is what the graph is keyed by (CR-01).
  //
  // **Derived stats are the only nodes** since TICKET-ROLL-06: a combat skill was the other kind
  // and went with the entity, and neither a `Skill` (weight rows) nor a `RollDefinition` (nothing
  // can name one) can be part of a cycle.
  const resolveReference = buildReferenceResolver(config);
  const formulaDependencies: FormulaDependency[] = config.stats
    .filter((stat) => stat.formula !== undefined)
    .map((stat) =>
      toFormulaDependency(
        { id: stat.id, label: stat.name, formula: stat.formula as string },
        resolveReference
      )
    );

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

  // Validate archetypes (Concept 03, TICKET-ARC-01)
  for (const archetype of config.archetypes ?? []) {
    // A dangling key is a stat that was deleted, not one that was renamed — affinity is keyed by
    // stat id for exactly that reason
    for (const statId of Object.keys(archetype.statAffinity)) {
      if (!statsById.has(statId)) {
        errors.push({
          severity: 'error',
          category: 'Reference Validation',
          message: `Archetype "${archetype.name}" references non-existent stat: ${statId}`,
          entityType: 'archetype',
          entityId: archetype.id,
          entityName: archetype.name,
        });
      }
    }

    // Concept 03's default: a stat the archetype says nothing about is `non`. Reported so the
    // User knows the ruleset made a choice for them, as a **warning** rather than as information
    // — unlike the weight-sum balance rule, this one silently changes what a point buys.
    const untagged = config.stats.filter((stat) => archetype.statAffinity[stat.id] === undefined);
    if (untagged.length > 0) {
      warnings.push({
        severity: 'warning',
        category: 'Data Consistency',
        message: `Archetype "${archetype.name}" does not tag ${untagged
          .map((stat) => stat.abbreviation)
          .join(', ')} — ${untagged.length === 1 ? 'it defaults' : 'they default'} to "non"`,
        entityType: 'archetype',
        entityId: archetype.id,
        entityName: archetype.name,
      });
    }
  }

  // Every affinity an archetype actually uses needs a `point_buy` column to route through
  // (Concept 03, Concept 06). Without one, TICKET-ARC-02 has nothing to look a spent point up in,
  // so this is an error rather than a warning — named per missing column so the fix is obvious.
  const pointBuy = (config.curves ?? []).find((curve) => curve.name === POINT_BUY_CURVE_NAME);
  const hasArchetypes = (config.archetypes ?? []).length > 0;

  if (hasArchetypes && pointBuy === undefined) {
    // Strictly worse than a missing column, so it cannot be the quiet case: no curve means no
    // affinity routes anywhere at all
    errors.push({
      severity: 'error',
      category: 'Reference Validation',
      message: `This ruleset defines archetypes but has no "${POINT_BUY_CURVE_NAME}" curve, so no affinity has anything to route a spent point through`,
      entityType: 'curve',
    });
  }

  if (pointBuy && hasArchetypes) {
    const columnNames = new Set(pointBuy.columns.map((column) => column.name));
    const usedAffinities = new Set<string>(
      (config.archetypes ?? []).flatMap((archetype) => Object.values(archetype.statAffinity))
    );
    // An untagged stat defaults to `non`, so `non` is used by any ruleset that has archetypes and
    // stats at all — even one whose every tag is `main`
    if (config.stats.length > 0) usedAffinities.add('non');

    for (const affinity of usedAffinities) {
      if (!columnNames.has(affinity)) {
        errors.push({
          severity: 'error',
          category: 'Reference Validation',
          message: `The "${POINT_BUY_CURVE_NAME}" curve has no "${affinity}" column, so an archetype using that affinity has nothing to route a spent point through`,
          entityType: 'curve',
          entityId: pointBuy.id,
          entityName: pointBuy.displayName,
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

  // Validate unique abbreviations. The flat formula space holds **stats and nothing else** since
  // TICKET-ROLL-06, so this is now a check within one list rather than across two — kept because a
  // duplicate abbreviation still splits a formula's identity from the value it reads.
  const abbreviations = config.stats.map((s) => ({
    abbreviation: s.abbreviation,
    type: 'Stat',
    name: s.name,
  }));

  const byAbbreviation = new Map<string, Array<{ type: string; name: string }>>();
  for (const { abbreviation, type, name } of abbreviations) {
    if (!byAbbreviation.has(abbreviation)) {
      byAbbreviation.set(abbreviation, []);
    }
    byAbbreviation.get(abbreviation)?.push({ type, name });
  }

  for (const [abbreviation, owners] of byAbbreviation.entries()) {
    if (owners.length > 1) {
      // "stat abbreviation", not "skill code" (CR-38): skill codes retired in TICKET-SKL-02 and the
      // combat codes with the entity in ROLL-06, so the old message named something that no
      // longer exists — to a User staring at two stats
      const ownerList = owners.map((s) => `${s.type} "${s.name}"`).join(', ');
      errors.push({
        severity: 'error',
        category: 'Uniqueness Validation',
        message: `Duplicate stat abbreviation "${abbreviation}" used by: ${ownerList}`,
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

  // Validate dice ladders (Concept 07). A ladder holds no formula, so what can be wrong is the
  // shape of the walk itself.
  for (const ladder of config.diceLadders ?? []) {
    errors.push(...diceLadderErrors(ladder));
    information.push(...diceLadderObservations(ladder));
  }

  // Validate roll definitions (Concept 08, TICKET-ROLL-05). An input is a formula like any other,
  // judged against its own row of the scoping table; the ladder is a plain id reference.
  const rollScope = scopeFor(config, 'roll-input');
  const ladderIds = new Set((config.diceLadders ?? []).map((ladder) => ladder.id));
  for (const roll of config.rollDefinitions ?? []) {
    errors.push(...rollDefinitionErrors(roll, rollScope, ladderIds));
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    information,
    timestamp: new Date().toISOString(),
  };
}

/**
 * The spelling two skill names are compared on
 *
 * Case and surrounding whitespace only: `skinning` and ` Skinning ` are the pair Concept 02's
 * import note calls out. Nothing more aggressive — stripping punctuation or spaces would collide
 * skills that are genuinely different, and a false warning here is worse than a missed one.
 */
function normalizedSkillName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * One warning per group of skills whose names differ only by case or padding (Concept 02)
 *
 * @param skills - The ruleset's skills
 * @returns One issue per colliding group, naming every member
 */
function nearDuplicateSkillNameWarnings(skills: readonly Skill[]): ValidationIssue[] {
  const byNormalizedName = new Map<string, Skill[]>();

  for (const skill of skills) {
    const key = normalizedSkillName(skill.name);
    if (key === '') continue;

    const group = byNormalizedName.get(key);
    if (group) {
      group.push(skill);
    } else {
      byNormalizedName.set(key, [skill]);
    }
  }

  return [...byNormalizedName.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      severity: 'warning' as const,
      category: 'Data Consistency',
      message: `Skills with near-duplicate names: ${group.map((skill) => `"${skill.name}"`).join(', ')} — keep both deliberately, or merge them`,
      entityType: 'skill',
      entityId: group[0].id,
      entityName: group[0].name,
    }));
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

/**
 * The largest flat remainder a ladder is allowed to leave before it is worth mentioning
 *
 * Concept 07's own rule, phrased as a number: a ladder whose smallest die is large — `[20, 12]`
 * leaves up to 11 — turns most of a roll into a flat bonus. The sheet's `6` leaves at most 5, so
 * anything above that is outside the observed range rather than wrong.
 */
const NOTEWORTHY_FLAT_REMAINDER = 5;

/**
 * Ladder problems that make a decomposition undefined (Concept 07's validation rules)
 *
 * All errors rather than warnings: a rung that is not a positive whole number cannot hold dice,
 * and a ladder that is not strictly descending is not the greedy walk anyone wrote it expecting —
 * `[6, 20]` takes the 6s first and the d20 never fires. `decomposeValue` stays total over both, so
 * these report a ruleset the User must fix rather than protecting the engine from a crash.
 *
 * @param ladder - The ladder to check
 * @returns One issue per problem found
 */
function diceLadderErrors(ladder: DiceLadder): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // camelCase, like `stat` / `skill` / `combatSkill` / `archetype` — `ValidationReport` renders the
  // value verbatim, so the outlier `'Curve'` a few functions up is drift rather than a precedent
  const entity = { entityType: 'diceLadder', entityId: ladder.id, entityName: ladder.name };

  if (ladder.dieSizes.length === 0) {
    issues.push({
      severity: 'error',
      category: 'Dice Ladder Validation',
      message: `Dice ladder "${ladder.name}" has no die sizes, so every value it is given stays a flat bonus`,
      ...entity,
    });
  }

  for (const size of ladder.dieSizes) {
    if (Number.isInteger(size) && size > 0) continue;

    issues.push({
      severity: 'error',
      category: 'Dice Ladder Validation',
      message: `Dice ladder "${ladder.name}" has a die size that is not a positive whole number: ${size}`,
      ...entity,
    });
  }

  for (const [index, size] of ladder.dieSizes.entries()) {
    if (index === 0 || size < ladder.dieSizes[index - 1]) continue;

    issues.push({
      severity: 'error',
      category: 'Dice Ladder Validation',
      message: `Dice ladder "${ladder.name}" is not sorted largest die first: ${size} follows ${ladder.dieSizes[index - 1]}`,
      ...entity,
    });
  }

  if (
    ladder.maxPerDie !== undefined &&
    (!Number.isInteger(ladder.maxPerDie) || ladder.maxPerDie < 1)
  ) {
    issues.push({
      severity: 'error',
      category: 'Dice Ladder Validation',
      message: `Dice ladder "${ladder.name}" caps each die at ${ladder.maxPerDie}, which allows no dice at all — remove the cap instead`,
      ...entity,
    });
  }

  return issues;
}

/**
 * Roll definition problems (Concept 08's validation rules, TICKET-ROLL-05)
 *
 * Two things can be wrong with a roll: its input does not compute, or its ladder is not there. Both
 * are errors — a roll that cannot produce a number has nothing to decompose, and a roll pointing at
 * a deleted ladder has nothing to decompose *with*. The guarded delete in `dependencies.ts` is what
 * normally stops the second; this catches the import that arrives with it already broken.
 *
 * @param roll - The definition to check
 * @param scope - What a roll input on this ruleset may reference
 * @param ladderIds - Every ladder the ruleset defines
 * @returns One issue per problem found
 */
function rollDefinitionErrors(
  roll: RollDefinition,
  scope: FormulaScope,
  ladderIds: ReadonlySet<string>
): ValidationIssue[] {
  const entity = { entityType: 'rollDefinition', entityId: roll.id, entityName: roll.name };

  const formula = validateFormula(roll.input, scope.codes, scope);
  const issues: ValidationIssue[] = formula.isValid
    ? []
    : formula.errors.map((error) => ({
        severity: 'error' as const,
        category: 'Formula Validation',
        message: `Roll "${roll.name}": ${error}`,
        ...entity,
      }));

  if (!ladderIds.has(roll.ladderId)) {
    issues.push({
      severity: 'error',
      category: 'Reference Validation',
      message: `Roll "${roll.name}" uses a dice ladder that does not exist: ${roll.ladderId}`,
      ...entity,
    });
  }

  return issues;
}

/**
 * What a ladder does that is worth stating and is not a defect (Concept 07)
 *
 * The page's own wording — a large smallest die "leaves big flat remainders — surfaced as
 * information, since it may be intended". `information` is TICKET-SKL-03's third severity and this
 * is exactly what it is for: reporting it as a warning would train the User to ignore warnings.
 *
 * @param ladder - The ladder to check
 * @returns The observations, empty for a ladder in the sheet's range
 */
function diceLadderObservations(ladder: DiceLadder): ValidationIssue[] {
  const smallest = ladder.dieSizes[ladder.dieSizes.length - 1];
  if (smallest === undefined || !Number.isInteger(smallest) || smallest <= 0) return [];

  const largestRemainder = smallest - 1;
  if (largestRemainder <= NOTEWORTHY_FLAT_REMAINDER) return [];

  return [
    {
      severity: 'information',
      category: 'Dice Ladder Validation',
      message: `Dice ladder "${ladder.name}" has no die smaller than ${smallest}, so up to ${largestRemainder} of any value stays a flat bonus`,
      entityType: 'diceLadder',
      entityId: ladder.id,
      entityName: ladder.name,
    },
  ];
}
