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
 * Each of those is a `(config) => ValidationIssue[]` helper listed in {@link ISSUE_SOURCES}, and
 * `validateConfiguration` is the concatenation of them (CR-19). A new entity type is a new helper
 * and a new row, never a longer shared body.
 *
 * **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5; Concepts 06, 07, 08**
 */

import type { Configuration, Curve, DiceLadder, RollDefinition } from '../types/config';
import { POINT_BUY_CURVE_NAME } from '../types/config';
import { buildReferenceResolver, skillMemberName, statMemberName } from './formula/references';
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
 * Every rule the report is made of, in the order it is reported (CR-19)
 *
 * One row per entity's rules, each a `(config) => ValidationIssue[]` that owns its own severities.
 * This is what `validateConfiguration` used to be: a single 392-line body carrying every entity
 * inline, which is where CR-01's dead cycle detector sat unnoticed for a milestone. Half the file
 * already had this shape — `curveTableErrors` and friends — so the rest was brought to it rather
 * than a new pattern being invented.
 *
 * Adding an entity type means writing a helper and adding a row here. Reordering rows reorders the
 * report; nothing else depends on the order.
 */
const ISSUE_SOURCES: readonly ((config: Configuration) => ValidationIssue[])[] = [
  statFormulaIssues,
  skillIssues,
  nearDuplicateSkillNameWarnings,
  nearDuplicateStatNameWarnings,
  circularDependencyIssues,
  materialIssues,
  itemIssues,
  raceIssues,
  archetypeIssues,
  pointBuyCurveIssues,
  currencyTierIssues,
  statAbbreviationIssues,
  curveIssues,
  diceLadderIssues,
  rollDefinitionIssues,
];

/**
 * Validate a complete configuration
 *
 * Concatenates {@link ISSUE_SOURCES} and sorts the result into the report's three buckets. Every
 * rule lives in a helper; this function holds none of them.
 *
 * @param config - Configuration to validate
 * @returns Validation report with all detected issues
 */
export function validateConfiguration(config: Configuration): ValidationReport {
  const issues = ISSUE_SOURCES.flatMap((issuesFrom) => issuesFrom(config));

  return {
    isValid: !issues.some((issue) => issue.severity === 'error'),
    errors: issues.filter((issue) => issue.severity === 'error'),
    warnings: issues.filter((issue) => issue.severity === 'warning'),
    information: issues.filter((issue) => issue.severity === 'information'),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Stat formulas that would not compute (TICKET-STAT-01 — only derived stats have one)
 *
 * Judged against the same scoping table the save-time guard uses, so an imported ruleset is held
 * to exactly the rules a panel would have enforced (Concept 00 §5).
 *
 * @param config - The ruleset to check
 * @returns One issue per error in a stat's formula
 */
function statFormulaIssues(config: Configuration): ValidationIssue[] {
  const scope = scopeFor(config, 'stat');

  return config.stats.flatMap((stat) => {
    if (stat.formula === undefined) return [];

    return validateFormula(stat.formula, scope.codes, scope).errors.map((error) => ({
      severity: 'error' as const,
      category: 'Formula Validation',
      message: `Stat "${stat.name}": ${error}`,
      entityType: 'stat',
      entityId: stat.id,
      entityName: stat.name,
    }));
  });
}

/**
 * Skill weight-row problems (Concept 02)
 *
 * A skill has no formula since TICKET-SKL-02, so what can be wrong is a weight naming a stat the
 * ruleset does not define — plus the concept page's two judgements about the shape of the weights.
 *
 * @param config - The ruleset to check
 * @returns The skills' issues, at all three severities
 */
function skillIssues(config: Configuration): ValidationIssue[] {
  const statIds = new Set(config.stats.map((stat) => stat.id));
  const issues: ValidationIssue[] = [];

  for (const skill of config.skills) {
    const entity = { entityType: 'skill', entityId: skill.id, entityName: skill.name };

    for (const { statId } of skill.statWeights) {
      if (statIds.has(statId)) continue;

      issues.push({
        severity: 'error',
        category: 'Reference Validation',
        message: `Skill "${skill.name}" is weighted on a stat that does not exist: ${statId}`,
        ...entity,
      });
    }

    // Concept 02's own validation rule: not an error, but worth saying out loud.
    //
    // Stated about the *ruleset* rather than about any character, which is all this function can
    // see: the concept page's "and no invested points" half is a property of a Player's
    // allocation, and a config-mode report has no character in hand to check it against.
    if (skill.statWeights.length === 0) {
      issues.push({
        severity: 'warning',
        category: 'Data Consistency',
        message: `Skill "${skill.name}" has no stat weights, so its level is whatever the Player invests and nothing else`,
        ...entity,
      });
    }

    // Concept 02's balance rule. Deliberately *information*: the sheet's own skills sum to 0.2–0.3,
    // so more than 0.5 is a departure from that shape — but a departure the User may well have
    // meant, and calling it a warning would devalue the warnings that are real problems.
    const weightSum = skill.statWeights.reduce((total, row) => total + row.weight, 0);
    if (weightSum > BALANCED_WEIGHT_SUM) {
      issues.push({
        severity: 'information',
        category: 'Balance',
        // "above", not "well above": the check is a strict `>`, so 0.51 lands here too and the
        // message has to be true of it as well as of 0.9
        message: `Skill "${skill.name}" has stat weights totalling ${roundWeightSum(weightSum)}, above the ~${BALANCED_WEIGHT_SUM} the sheet's own skills use — deliberate, or a typo?`,
        ...entity,
      });
    }
  }

  return issues;
}

/**
 * Cycles among the derived stats' formulas
 *
 * `toFormulaDependency` is the one place that decides what an edge is, so bare codes and dotted
 * references land on the same graph nodes — both are resolved to the stat's id, which is what the
 * graph is keyed by (CR-01).
 *
 * **Derived stats are the only nodes** since TICKET-ROLL-06: a combat skill was the other kind and
 * went with the entity, and neither a `Skill` (weight rows) nor a `RollDefinition` (nothing can
 * name one) can be part of a cycle.
 *
 * @param config - The ruleset to check
 * @returns One issue per cycle reported
 */
function circularDependencyIssues(config: Configuration): ValidationIssue[] {
  const resolveReference = buildReferenceResolver(config);
  const formulaDependencies: FormulaDependency[] = config.stats
    .filter((stat) => stat.formula !== undefined)
    .map((stat) =>
      toFormulaDependency(
        { id: stat.id, label: stat.name, formula: stat.formula as string },
        resolveReference
      )
    );

  return validateFormulaCollection(formulaDependencies).errors.map((error) => ({
    severity: 'error' as const,
    category: 'Circular Dependency',
    message: error,
  }));
}

/**
 * Material references that point at nothing, and modifiers that could never apply
 *
 * Levels are keyed by stat **id** since TICKET-MAT-01, so a dangling key is a stat that was
 * deleted rather than one that was renamed.
 *
 * @param config - The ruleset to check
 * @returns One issue per broken reference
 */
function materialIssues(config: Configuration): ValidationIssue[] {
  const materialCategoryIds = new Set(config.materialCategories.map((category) => category.id));
  const currencyTierIds = new Set(config.currencyTiers.map((tier) => tier.id));
  const statsById = new Map(config.stats.map((stat) => [stat.id, stat]));
  const issues: ValidationIssue[] = [];

  for (const material of config.materials) {
    const entity = {
      entityType: 'material',
      entityId: material.id,
      entityName: material.name,
    };

    if (!materialCategoryIds.has(material.categoryId)) {
      issues.push({
        severity: 'error',
        category: 'Reference Validation',
        message: `Material "${material.name}" references non-existent category ID: ${material.categoryId}`,
        ...entity,
      });
    }

    for (const level of material.levels) {
      for (const bonus of level.bonuses) {
        const target = statsById.get(bonus.statId);

        if (!target) {
          issues.push({
            severity: 'error',
            category: 'Reference Validation',
            message: `Material "${material.name}" level ${level.level} references non-existent stat: ${bonus.statId}`,
            ...entity,
          });
          continue;
        }

        // A derived stat's formula *is* its source, so a modifier on one would be a term the
        // composition never applies — silently, which is the worst kind of wrong number
        if (target.formula !== undefined) {
          issues.push({
            severity: 'error',
            category: 'Reference Validation',
            message: `Material "${material.name}" level ${level.level} modifies "${target.name}", which is a derived stat — its formula is its only source`,
            ...entity,
          });
        }
      }

      if (!currencyTierIds.has(level.value.tierId)) {
        issues.push({
          severity: 'error',
          category: 'Reference Validation',
          message: `Material "${material.name}" level ${level.level} references non-existent currency tier: ${level.value.tierId}`,
          ...entity,
        });
      }
    }
  }

  return issues;
}

/**
 * Item references that point at nothing
 *
 * @param config - The ruleset to check
 * @returns One issue per broken slot, material or material-level reference
 */
function itemIssues(config: Configuration): ValidationIssue[] {
  const equipmentSlotTypes = new Set(config.equipmentSlots.map((slot) => slot.type));
  const materialsById = new Map(config.materials.map((material) => [material.id, material]));
  const issues: ValidationIssue[] = [];

  for (const item of config.items) {
    const entity = { entityType: 'item', entityId: item.id, entityName: item.name };

    if (item.equipmentSlotType && !equipmentSlotTypes.has(item.equipmentSlotType)) {
      issues.push({
        severity: 'error',
        category: 'Reference Validation',
        message: `Item "${item.name}" references non-existent equipment slot type: ${item.equipmentSlotType}`,
        ...entity,
      });
    }

    if (item.materialId && !materialsById.has(item.materialId)) {
      issues.push({
        severity: 'error',
        category: 'Reference Validation',
        message: `Item "${item.name}" references non-existent material ID: ${item.materialId}`,
        ...entity,
      });
    }

    // A level on a material that is itself missing is already reported above; naming the level too
    // would be two messages about one broken pointer
    const material = item.materialId ? materialsById.get(item.materialId) : undefined;
    if (material && item.materialLevel !== undefined) {
      const levelExists = material.levels.some((level) => level.level === item.materialLevel);
      if (!levelExists) {
        issues.push({
          severity: 'error',
          category: 'Reference Validation',
          message: `Item "${item.name}" references non-existent material level ${item.materialLevel} for material "${material.name}"`,
          ...entity,
        });
      }
    }
  }

  return issues;
}

/**
 * Race stat blocks naming stats the ruleset does not define
 *
 * Keyed by stat id since TICKET-RACE-01, so a dangling key is a stat that was deleted rather than
 * one that was renamed.
 *
 * @param config - The ruleset to check
 * @returns One issue per dangling stat key
 */
function raceIssues(config: Configuration): ValidationIssue[] {
  const statIds = new Set(config.stats.map((stat) => stat.id));

  return config.races.flatMap((race) =>
    Object.keys(race.statValues)
      .filter((statId) => !statIds.has(statId))
      .map((statId) => ({
        severity: 'error' as const,
        category: 'Reference Validation',
        message: `Race "${race.name}" references non-existent stat: ${statId}`,
        entityType: 'race',
        entityId: race.id,
        entityName: race.name,
      }))
  );
}

/**
 * Archetype affinity problems (Concept 03, TICKET-ARC-01)
 *
 * @param config - The ruleset to check
 * @returns One issue per dangling stat key, plus a warning per archetype that leaves stats untagged
 */
function archetypeIssues(config: Configuration): ValidationIssue[] {
  const statIds = new Set(config.stats.map((stat) => stat.id));
  const issues: ValidationIssue[] = [];

  for (const archetype of config.archetypes ?? []) {
    const entity = {
      entityType: 'archetype',
      entityId: archetype.id,
      entityName: archetype.name,
    };

    // A dangling key is a stat that was deleted, not one that was renamed — affinity is keyed by
    // stat id for exactly that reason
    for (const statId of Object.keys(archetype.statAffinity)) {
      if (statIds.has(statId)) continue;

      issues.push({
        severity: 'error',
        category: 'Reference Validation',
        message: `Archetype "${archetype.name}" references non-existent stat: ${statId}`,
        ...entity,
      });
    }

    // Concept 03's default: a stat the archetype says nothing about is `non`. Reported so the
    // User knows the ruleset made a choice for them, as a **warning** rather than as information
    // — unlike the weight-sum balance rule, this one silently changes what a point buys.
    const untagged = config.stats.filter((stat) => archetype.statAffinity[stat.id] === undefined);
    if (untagged.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'Data Consistency',
        message: `Archetype "${archetype.name}" does not tag ${untagged
          .map((stat) => stat.abbreviation)
          .join(', ')} — ${untagged.length === 1 ? 'it defaults' : 'they default'} to "non"`,
        ...entity,
      });
    }
  }

  return issues;
}

/**
 * Affinities with no `point_buy` column to route a spent point through (Concept 03, Concept 06)
 *
 * An error rather than a warning: without the column TICKET-ARC-02 has nothing to look a spent
 * point up in. Named per missing column so the fix is obvious.
 *
 * @param config - The ruleset to check
 * @returns One issue per affinity with nowhere to go, or one for the missing curve
 */
function pointBuyCurveIssues(config: Configuration): ValidationIssue[] {
  const hasArchetypes = (config.archetypes ?? []).length > 0;
  if (!hasArchetypes) return [];

  const pointBuy = (config.curves ?? []).find((curve) => curve.name === POINT_BUY_CURVE_NAME);
  if (pointBuy === undefined) {
    // Strictly worse than a missing column, so it cannot be the quiet case: no curve means no
    // affinity routes anywhere at all
    return [
      {
        severity: 'error',
        category: 'Reference Validation',
        message: `This ruleset defines archetypes but has no "${POINT_BUY_CURVE_NAME}" curve, so no affinity has anything to route a spent point through`,
        entityType: 'curve',
      },
    ];
  }

  const columnNames = new Set(pointBuy.columns.map((column) => column.name));
  const usedAffinities = new Set<string>(
    (config.archetypes ?? []).flatMap((archetype) => Object.values(archetype.statAffinity))
  );
  // An untagged stat defaults to `non`, so `non` is used by any ruleset that has archetypes and
  // stats at all — even one whose every tag is `main`
  if (config.stats.length > 0) usedAffinities.add('non');

  return [...usedAffinities]
    .filter((affinity) => !columnNames.has(affinity))
    .map((affinity) => ({
      severity: 'error' as const,
      category: 'Reference Validation',
      message: `The "${POINT_BUY_CURVE_NAME}" curve has no "${affinity}" column, so an archetype using that affinity has nothing to route a spent point through`,
      entityType: 'curve',
      entityId: pointBuy.id,
      entityName: pointBuy.displayName,
    }));
}

/**
 * Currency ladders whose ordering does not read as a ladder
 *
 * Both warnings: a duplicate or a gap makes the ladder odd to read rather than impossible to walk,
 * and the User may have meant it.
 *
 * @param config - The ruleset to check
 * @returns One issue for duplicate orders, plus one per gap
 */
function currencyTierIssues(config: Configuration): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tierOrders = config.currencyTiers.map((tier) => tier.order);

  if (tierOrders.length !== new Set(tierOrders).size) {
    issues.push({
      severity: 'warning',
      category: 'Data Consistency',
      message: 'Currency tiers have duplicate order values',
    });
  }

  const sortedOrders = [...tierOrders].sort((a, b) => a - b);
  for (let index = 0; index < sortedOrders.length - 1; index++) {
    if (sortedOrders[index + 1] - sortedOrders[index] > 1) {
      issues.push({
        severity: 'warning',
        category: 'Data Consistency',
        message: `Currency tier ordering has gaps between ${sortedOrders[index]} and ${sortedOrders[index + 1]}`,
      });
    }
  }

  return issues;
}

/**
 * Stat abbreviations claimed by more than one stat
 *
 * The flat formula space holds **stats and nothing else** since TICKET-ROLL-06, so this is a check
 * within one list rather than across two — kept because a duplicate abbreviation still splits a
 * formula's identity from the value it reads.
 *
 * @param config - The ruleset to check
 * @returns One issue per abbreviation with more than one owner
 */
function statAbbreviationIssues(config: Configuration): ValidationIssue[] {
  const byAbbreviation = new Map<string, string[]>();
  for (const stat of config.stats) {
    const owners = byAbbreviation.get(stat.abbreviation);
    if (owners) {
      owners.push(stat.name);
    } else {
      byAbbreviation.set(stat.abbreviation, [stat.name]);
    }
  }

  return [...byAbbreviation.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([abbreviation, owners]) => ({
      severity: 'error' as const,
      category: 'Uniqueness Validation',
      // "stat abbreviation", not "skill code" (CR-38): skill codes retired in TICKET-SKL-02 and the
      // combat codes with the entity in ROLL-06, so the old message named something that no
      // longer exists — to a User staring at two stats
      message: `Duplicate stat abbreviation "${abbreviation}" used by: ${owners
        .map((name) => `Stat "${name}"`)
        .join(', ')}`,
    }));
}

/**
 * Curve table problems (Concept 06)
 *
 * Generators are formulas like any other, so they are judged against their own row of the scoping
 * table.
 *
 * @param config - The ruleset to check
 * @returns Every curve's errors and warnings
 */
function curveIssues(config: Configuration): ValidationIssue[] {
  const generatorScope = scopeFor(config, 'curve-generator');

  return (config.curves ?? []).flatMap((curve) => [
    ...curveTableErrors(curve, generatorScope),
    ...curveTableWarnings(curve),
  ]);
}

/**
 * Dice ladder problems and observations (Concept 07)
 *
 * A ladder holds no formula, so what can be wrong is the shape of the walk itself.
 *
 * @param config - The ruleset to check
 * @returns Every ladder's errors and observations
 */
function diceLadderIssues(config: Configuration): ValidationIssue[] {
  return (config.diceLadders ?? []).flatMap((ladder) => [
    ...diceLadderErrors(ladder),
    ...diceLadderObservations(ladder),
  ]);
}

/**
 * Roll definition problems (Concept 08, TICKET-ROLL-05)
 *
 * An input is a formula like any other, judged against its own row of the scoping table; the
 * ladder is a plain id reference.
 *
 * @param config - The ruleset to check
 * @returns Every roll's errors
 */
function rollDefinitionIssues(config: Configuration): ValidationIssue[] {
  const rollScope = scopeFor(config, 'roll-input');
  const ladderIds = new Set((config.diceLadders ?? []).map((ladder) => ladder.id));

  return (config.rollDefinitions ?? []).flatMap((roll) =>
    rollDefinitionErrors(roll, rollScope, ladderIds)
  );
}

/**
 * One warning per group of entities that a formula cannot tell apart (CR-18)
 *
 * **Compared on the member slug, which is the spelling that actually decides.** The check used to
 * compare `trim().toLowerCase()`, which is a different normalization from the one formula
 * resolution uses: `Fire making` and `Fire-making` are different lowercased strings and warned
 * about nothing, while both slug to `fire_making` and only the first answers. Slugging is strictly
 * the broader comparison — anything equal after trim-and-lowercase is equal after slugging too —
 * so the `skinning`/`Skinning` pair Concept 02's import note calls out is still caught.
 *
 * **A warning, never an error, and first-wins stays.** Two skills sharing a spelling is legal since
 * TICKET-SKL-02 took a skill out of the flat formula space, and the real sheet has such a pair. The
 * deliverable is visibility: the message names which entity a formula answers with, because that is
 * the fact the User cannot see anywhere else.
 *
 * @param entities - The colliding space's members, in the order first-wins resolves them
 * @param namespace - How a formula names this space, for the message
 * @param entityType - The `ValidationIssue.entityType` these are reported under
 * @param slugOf - The member spelling, the same derivation `references.ts` resolves on
 * @returns One issue per colliding group, naming every member and the winner
 */
function slugCollisionWarnings<T extends { id: string; name: string }>(
  entities: readonly T[],
  namespace: string,
  entityType: string,
  slugOf: (entity: T) => string
): ValidationIssue[] {
  const bySlug = new Map<string, T[]>();

  for (const entity of entities) {
    const slug = slugOf(entity);
    const group = bySlug.get(slug);
    if (group) {
      group.push(entity);
    } else {
      bySlug.set(slug, [entity]);
    }
  }

  return [...bySlug.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([slug, group]) => ({
      severity: 'warning' as const,
      category: 'Data Consistency',
      message: `${group.map((entity) => `"${entity.name}"`).join(', ')} are all written ${namespace}.${slug} in a formula, so "${group[0].name}" is the one any formula naming it answers with — keep them deliberately, or rename one`,
      entityType,
      entityId: group[0].id,
      entityName: group[0].name,
    }));
}

/**
 * Skills a formula cannot tell apart (Concept 02's near-duplicate rule, widened by CR-18)
 *
 * @param config - The ruleset to check
 * @returns One issue per colliding group
 */
function nearDuplicateSkillNameWarnings(config: Configuration): ValidationIssue[] {
  return slugCollisionWarnings(config.skills, 'skills', 'skill', skillMemberName);
}

/**
 * Stats a formula cannot tell apart (CR-18)
 *
 * Stats had no near-duplicate check at all, while resolving first-wins on the same slug their
 * skills do — so renaming one stat could silently point an unrelated formula at another. This is
 * about `stats.<slug>` only; the abbreviation half of the flat space is `statAbbreviationIssues`,
 * which is an **error** because two stats claiming one abbreviation is never the sheet's intent.
 *
 * @param config - The ruleset to check
 * @returns One issue per colliding group
 */
function nearDuplicateStatNameWarnings(config: Configuration): ValidationIssue[] {
  return slugCollisionWarnings(config.stats, 'stats', 'stat', statMemberName);
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
