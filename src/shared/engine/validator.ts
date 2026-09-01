/**
 * Configuration Validator
 *
 * Validates complete configuration for:
 * - Formula references point to existing skills
 * - Equipment slot types referenced by items exist
 * - Material categories referenced by materials exist
 *   (what an item is *made of* is no longer among these — TICKET-INV-05 moved the material link off
 *   the template and onto a character's composed record, which is player state rather than ruleset)
 * - No circular dependencies in formulas
 * - Currency tier references are valid
 * - Curve tables are readable — unique, sorted keys with a value per column (Concept 06)
 * - Dice ladders can be walked — positive, strictly descending die sizes (Concept 07)
 * - Roll definitions compute and point at a ladder that exists (Concept 08)
 * - A race's creature type and size are words the ruleset's own reference lists offer
 *   (v4 systems/04, systems/14) — a warning, because nothing derives from either
 * - An inlay tier's bonuses name stats that exist and are not derived (v4 systems/10) — the same
 *   two rules a material tier's bonuses answer to
 *
 * Each of those is a `(config) => ValidationIssue[]` helper listed in {@link ISSUE_SOURCES}, and
 * `validateConfiguration` is the concatenation of them (CR-19). A new entity type is a new helper
 * and a new row, never a longer shared body.
 *
 * **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5; Concepts 06, 07, 08**
 */

import type {
  Configuration,
  Curve,
  DiceLadder,
  InlayTier,
  Item,
  MaterialLevel,
  RollDefinition,
  Stat,
} from '../types/config';
import { POINT_BUY_CURVE_NAME } from '../types/config';
import type { ValidationIssue, ValidationReport } from '../types/validation';
import { cellKey, isWithinLayout } from './equipmentLayout';
import { buildReferenceResolver, skillMemberName, statMemberName } from './formula/references';
import type { FormulaScope } from './formula/scoping';
import { FORMULA_OWNER, scopeFor } from './formula/scoping';
import { templateFormulas } from './formula/template';
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
 * The report, re-exported from where it lives a rung lower since TICKET-IO-04
 *
 * This module is where a report is *built* and where its existing consumers import its type from,
 * so changing their import lines to record that a declaration moved house would be churn with no
 * reader. The move happened because `types/api.ts` puts a report on the wire and may not import
 * anything with a runtime — see [`types/validation.ts`](../types/validation.ts).
 *
 * **Only `ValidationReport`**, because only it has a consumer out here. `ValidationIssue` and
 * `ValidationSeverity` are imported from `#shared/types/validation` by whoever needs them; a
 * re-export nobody reads is a claim that something does.
 */
export type { ValidationReport } from '../types/validation';

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
  inlayIssues,
  itemIssues,
  equipmentLayoutIssues,
  raceIssues,
  raceIdentityIssues,
  archetypeIssues,
  pointBuyCurveIssues,
  currencyTierIssues,
  statAbbreviationIssues,
  duplicateNameIssues,
  duplicateIdIssues,
  curveIssues,
  diceLadderIssues,
  rollDefinitionIssues,
  spellEffectIssues,
  passiveEffectIssues,
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
      issues.push(...materialLevelIssues(material.name, level, entity, statsById, currencyTierIds));
    }
  }

  return issues;
}

/**
 * One material tier's modifiers and price
 *
 * Split out of {@link materialIssues} because the two loops nest three deep otherwise, and every
 * message here is about the level rather than about the material.
 *
 * @param materialName - What the material is called, which every message names
 * @param level - The tier to check
 * @param entity - The entity fields shared by every issue about this material
 * @param statsById - The ruleset's stats, for resolving each modifier's target
 * @param currencyTierIds - Every currency tier the ruleset defines
 * @returns One issue per broken reference
 */
function materialLevelIssues(
  materialName: string,
  level: MaterialLevel,
  entity: Pick<ValidationIssue, 'entityType' | 'entityId' | 'entityName'>,
  statsById: ReadonlyMap<string, Stat>,
  currencyTierIds: ReadonlySet<string>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const bonus of level.bonuses) {
    const target = statsById.get(bonus.statId);

    if (!target) {
      issues.push({
        severity: 'error',
        category: 'Reference Validation',
        message: `Material "${materialName}" level ${level.level} references non-existent stat: ${bonus.statId}`,
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
        message: `Material "${materialName}" level ${level.level} modifies "${target.name}", which is a derived stat — its formula is its only source`,
        ...entity,
      });
    }
  }

  if (!currencyTierIds.has(level.value.tierId)) {
    issues.push({
      severity: 'error',
      category: 'Reference Validation',
      message: `Material "${materialName}" level ${level.level} references non-existent currency tier: ${level.value.tierId}`,
      ...entity,
    });
  }

  return issues;
}

/**
 * Inlay tier bonuses that point at nothing, or at a stat they could never move (TICKET-INL-01)
 *
 * `materialIssues`' sibling, and deliberately the same two rules over the same
 * `{ statId, modifier }` row: a gem grants stats the way a material tier does, so a modifier naming
 * a stat the ruleset has deleted, or naming a **derived** stat whose formula is its only source, is
 * wrong here for exactly the reason it is wrong there.
 *
 * **A gap in the ladder is reported by nothing**, here included. Zircon's missing tenth tier is the
 * sheet's own data (v4 systems/10), so "this family skips a rung" is a fact about the ruleset rather
 * than a defect in it — flagging it would put a permanent warning on a correctly imported corpus.
 *
 * @param config - The ruleset to check
 * @returns One issue per broken bonus
 */
function inlayIssues(config: Configuration): ValidationIssue[] {
  const statsById = new Map(config.stats.map((stat) => [stat.id, stat]));

  return (config.inlays ?? []).flatMap((inlay) => {
    const entity = { entityType: 'inlay', entityId: inlay.id, entityName: inlay.name };

    return inlay.tiers.flatMap((tier) => inlayTierIssues(inlay.name, tier, entity, statsById));
  });
}

/**
 * One inlay tier's modifiers
 *
 * Split out for {@link materialLevelIssues}' reason: every message here is about the tier rather
 * than about the family, and the two loops nest otherwise.
 *
 * @param inlayName - What the family is called, which every message names
 * @param tier - The tier to check
 * @param entity - The entity fields shared by every issue about this family
 * @param statsById - The ruleset's stats, for resolving each modifier's target
 * @returns One issue per broken reference
 */
function inlayTierIssues(
  inlayName: string,
  tier: InlayTier,
  entity: Pick<ValidationIssue, 'entityType' | 'entityId' | 'entityName'>,
  statsById: ReadonlyMap<string, Stat>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const bonus of tier.bonuses) {
    const target = statsById.get(bonus.statId);

    if (!target) {
      issues.push({
        severity: 'error',
        category: 'Reference Validation',
        message: `Inlay "${inlayName}" tier ${tier.tier} references non-existent stat: ${bonus.statId}`,
        ...entity,
      });
      continue;
    }

    if (target.formula !== undefined) {
      issues.push({
        severity: 'error',
        category: 'Reference Validation',
        message: `Inlay "${inlayName}" tier ${tier.tier} modifies "${target.name}", which is a derived stat — its formula is its only source`,
        ...entity,
      });
    }
  }

  return issues;
}

/**
 * How an item names itself in a report
 *
 * @param item - The template being checked
 * @returns The entity fields every one of its issues carries
 */
function itemEntity(item: Item) {
  return { entityType: 'item', entityId: item.id, entityName: item.name };
}

/**
 * Where an item is worn, when the ruleset no longer has that slot
 *
 * @param item - The template being checked
 * @param equipmentSlotTypes - The slot types the ruleset defines
 * @returns One issue when the named slot is gone, none otherwise
 */
function itemSlotIssues(item: Item, equipmentSlotTypes: ReadonlySet<string>): ValidationIssue[] {
  if (!item.equipmentSlotType || equipmentSlotTypes.has(item.equipmentSlotType)) return [];

  return [
    {
      severity: 'error',
      category: 'Reference Validation',
      message: `Item "${item.name}" references non-existent equipment slot type: ${item.equipmentSlotType}`,
      ...itemEntity(item),
    },
  ];
}

/**
 * The template's own skill vector, where it names a skill that is gone
 * (v4 systems/11, TICKET-ITEM-01)
 *
 * A bonus naming a skill the ruleset does not define contributes nothing at all in
 * `calculateEquipmentSkillBonuses`, so without this the User's only clue would be a bonus that
 * quietly never applied. **One issue per dangling row** rather than one per item, because the row is
 * what has to be repointed.
 *
 * @param item - The template being checked
 * @param skillIds - The ids the ruleset's skills carry
 * @returns One issue per row naming a skill that does not exist
 */
function itemSkillBonusIssues(item: Item, skillIds: ReadonlySet<string>): ValidationIssue[] {
  const dangling = (item.skillBonuses ?? []).filter((bonus) => !skillIds.has(bonus.skillId));

  return dangling.map((bonus) => ({
    severity: 'error',
    category: 'Reference Validation',
    message: `Item "${item.name}" grants a bonus to non-existent skill ID: ${bonus.skillId}`,
    ...itemEntity(item),
  }));
}

/**
 * Item references that point at nothing
 *
 * **Two questions since TICKET-INV-05, where there were three.** *What is it made of* left with the
 * fused `materialId` / `materialLevel` pair: a template names no material any more, so there is no
 * material reference on a `Configuration` to dangle. The equivalent question is now asked of a
 * **character's** composed record, and a broken part there is answered by the engine granting
 * nothing (`equipmentBonusCalculator`) and by TICKET-INV-06's picker refusing the rung — neither of
 * which this report can see, because `validateConfiguration` reads a ruleset and a build is player
 * state.
 *
 * @param config - The ruleset to check
 * @returns One issue per broken slot or skill-bonus reference
 */
function itemIssues(config: Configuration): ValidationIssue[] {
  const equipmentSlotTypes = new Set(config.equipmentSlots.map((slot) => slot.type));
  const skillIds = new Set(config.skills.map((skill) => skill.id));

  return config.items.flatMap((item) => {
    const slotIssues = itemSlotIssues(item, equipmentSlotTypes);
    const skillBonusIssues = itemSkillBonusIssues(item, skillIds);

    return [...slotIssues, ...skillBonusIssues];
  });
}

/**
 * Equipment placements the figure cannot draw (TICKET-INV-03)
 *
 * Two ways an arrangement goes wrong, and both leave a ruleset that still renders — which is
 * exactly why they are reported here rather than refused at the import gate. A slot the board has
 * no room for and a slot standing behind another one both simply fall off the figure into the row
 * beneath it, so without a report the User's only clue is a box that quietly stopped appearing.
 *
 * The store cannot produce either state: `setEquipmentLayout` prunes as it shrinks and
 * `placeEquipmentSlot` turns out whoever held the cell. They arrive by import, or by hand-editing
 * an export.
 *
 * @param config - The ruleset to check
 * @returns One issue per placement that cannot be drawn
 */
function equipmentLayoutIssues(config: Configuration): ValidationIssue[] {
  const layout = config.equipmentLayout;
  const issues: ValidationIssue[] = [];
  const taken = new Map<string, string>();

  for (const slot of config.equipmentSlots) {
    const { placement } = slot;
    if (!placement) continue;

    const entity = { entityType: 'equipmentSlot', entityId: slot.type, entityName: slot.name };

    if (!layout) {
      issues.push({
        severity: 'error',
        category: 'Equipment Layout',
        message: `Equipment slot "${slot.name}" is placed on a figure this ruleset does not define — open Configuration → Equipment to lay one out`,
        ...entity,
      });
      continue;
    }

    if (!isWithinLayout(placement, layout)) {
      issues.push({
        severity: 'error',
        category: 'Equipment Layout',
        message: `Equipment slot "${slot.name}" sits at column ${placement.column}, row ${placement.row}, outside the ${layout.columns}×${layout.rows} equipment grid`,
        ...entity,
      });
      continue;
    }

    const holder = taken.get(cellKey(placement));
    if (holder) {
      issues.push({
        severity: 'error',
        category: 'Equipment Layout',
        message: `Equipment slots "${holder}" and "${slot.name}" both sit at column ${placement.column}, row ${placement.row} — only the first is drawn`,
        ...entity,
      });
      continue;
    }

    taken.set(cellKey(placement), slot.name);
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
 * A race's creature type and size against the ruleset's own reference lists (TICKET-RACE-03)
 *
 * The lists (`Configuration.creatureTypes` / `creatureSizes`, v4 systems/14) hold the User's own
 * words — the workbook writes `humaniod` and `guargantian` — so a race names one by **spelling**
 * rather than by id, and the check is a comparison of strings rather than a reference lookup.
 *
 * Three rules, and each is a decision:
 *
 * - **A finding, never a refusal.** Nothing derives from a type or a size, so a race naming one the
 *   list does not carry costs the ruleset nothing at play time. `warning` rather than `information`
 *   because it is a mismatch the User would want to fix — a race sized `smal` beside a list saying
 *   `small` is a typo, not a choice.
 * - **A ruleset with no list validates nothing.** Absent means none (not "none allowed"), which is
 *   the state every ruleset written before this ticket is in, and reporting every race against an
 *   empty vocabulary would bury the report in findings nobody asked for.
 * - **An absent field on a race is silent too.** The fields are additive-optional; saying nothing
 *   about a race's kind is a complete answer.
 *
 * @param config - The ruleset to check
 * @returns One warning per race field naming something its list does not hold
 */
function raceIdentityIssues(config: Configuration): ValidationIssue[] {
  const vocabularies = [
    { field: 'type', subject: 'creature type', allowed: config.creatureTypes ?? [] },
    { field: 'size', subject: 'size', allowed: config.creatureSizes ?? [] },
  ] as const;

  const issues: ValidationIssue[] = [];

  for (const { field, subject, allowed } of vocabularies) {
    if (allowed.length === 0) continue;
    const listed = new Set(allowed);

    for (const race of config.races) {
      const named = race[field];
      if (named === undefined || listed.has(named)) continue;

      issues.push({
        severity: 'warning',
        category: 'Reference Validation',
        message: `Race "${race.name}" has ${subject} "${named}", which the ruleset's list does not offer`,
        entityType: 'race',
        entityId: race.id,
        entityName: race.name,
      });
    }
  }

  return issues;
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
  // Compared uppercased, the way `scopeFor` spells an abbreviation into the flat space, so `str`
  // and `STR` are the one slot they actually resolve to — and the same comparison the store's
  // `addStat`/`updateStat` guard now refuses on (CR-17)
  const byAbbreviation = groupBy(config.stats, (stat) => stat.abbreviation.trim().toUpperCase());

  return [...byAbbreviation.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([abbreviation, owners]) => ({
      severity: 'error' as const,
      category: 'Uniqueness Validation',
      // "stat abbreviation", not "skill code" (CR-38): skill codes retired in TICKET-SKL-02 and the
      // combat codes with the entity in ROLL-06, so the old message named something that no
      // longer exists — to a User staring at two stats
      message: `Duplicate stat abbreviation "${abbreviation}" used by: ${owners
        .map((stat) => `Stat "${stat.name}"`)
        .join(', ')}`,
    }));
}

/**
 * Constant and curve names claimed by more than one entity (CR-17)
 *
 * Neither had a check here, while `importExport.ts` has refused both since they were added — so a
 * ruleset the store accepted and the engine validated could be refused by the app's own import. A
 * duplicate also splits identity from value: a stored formula points at one entity's id while the
 * resolver, which is first-wins on the spelling, reads the other's number or table.
 *
 * @param config - The ruleset to check
 * @returns One issue per name with more than one owner
 */
function duplicateNameIssues(config: Configuration): ValidationIssue[] {
  const spaces: {
    entityType: string;
    noun: string;
    /** Both spaces are `{ name, displayName }` — the formula spelling and what a User reads */
    entities: readonly { id: string; name: string; displayName: string }[];
  }[] = [
    { entityType: 'constant', noun: 'constant', entities: config.constants ?? [] },
    { entityType: 'curve', noun: 'curve', entities: config.curves ?? [] },
  ];

  return spaces.flatMap(({ entityType, noun, entities }) =>
    [...groupBy(entities, (entity) => entity.name).entries()]
      .filter(([, owners]) => owners.length > 1)
      .map(([name, owners]) => ({
        severity: 'error' as const,
        category: 'Uniqueness Validation',
        message: `Duplicate ${noun} name "${name}" used by: ${owners
          .map((owner) => `"${owner.displayName}"`)
          .join(', ')}`,
        entityType,
        entityId: owners[0].id,
        entityName: owners[0].displayName,
      }))
  );
}

/**
 * Ids claimed by more than one entity of the same kind (CR-17)
 *
 * Checked by neither validator before, and an id collision is worse than a name collision: the
 * stored form of every formula is ids, so two entities sharing one make a reference genuinely
 * ambiguous rather than merely first-wins on a spelling. Deletes, patches and lookups all address
 * by id, so a duplicate makes every one of them hit whichever came first.
 *
 * @param config - The ruleset to check
 * @returns One issue per id with more than one owner, per collection
 */
function duplicateIdIssues(config: Configuration): ValidationIssue[] {
  const collections: { entityType: string; entities: readonly { id: string; name?: string }[] }[] =
    [
      { entityType: 'stat', entities: config.stats },
      { entityType: 'skill', entities: config.skills },
      { entityType: 'material', entities: config.materials },
      { entityType: 'materialCategory', entities: config.materialCategories },
      { entityType: 'inlay', entities: config.inlays ?? [] },
      // Ids only, deliberately: two spells may share a *name* (v4 systems/13, TICKET-SPL-01). The
      // workbook spells several rows the same way, nothing reaches a spell from a formula, and a
      // `Skill` already lives under that rule (TICKET-SKL-02) — so a name collision is the User's
      // to keep and an id collision makes a delete hit whichever comes first
      { entityType: 'spell', entities: config.spells ?? [] },
      // Ids only for the same reason (v4 systems/14, TICKET-PAS-01), and this catalog genuinely
      // needs it: the workbook's poison-resistance ladder appears **twice**, rows 7–10 and 15–18,
      // with slightly different immunity wording. Those are four legitimate duplicate *names* the
      // data pass records as it found them — and four ids that must still be distinct, or revoking
      // one would revoke whichever came first
      { entityType: 'passive', entities: config.passives ?? [] },
      { entityType: 'item', entities: config.items },
      { entityType: 'race', entities: config.races },
      { entityType: 'currencyTier', entities: config.currencyTiers },
      { entityType: 'archetype', entities: config.archetypes ?? [] },
      { entityType: 'constant', entities: config.constants ?? [] },
      { entityType: 'curve', entities: config.curves ?? [] },
      { entityType: 'diceLadder', entities: config.diceLadders ?? [] },
      { entityType: 'rollDefinition', entities: config.rollDefinitions ?? [] },
    ];

  return collections.flatMap(({ entityType, entities }) =>
    [...groupBy(entities, (entity) => entity.id).entries()]
      .filter(([, owners]) => owners.length > 1)
      .map(([id, owners]) => ({
        severity: 'error' as const,
        category: 'Uniqueness Validation',
        message: `${owners.length} ${entityType}s share the id "${id}", so a formula or a delete naming it reaches whichever comes first`,
        entityType,
        entityId: id,
        entityName: owners[0].name,
      }))
  );
}

/**
 * Group entities by a key, keeping each group in source order
 *
 * Source order is what makes the first member of a group the one first-wins resolution answers
 * with, which several messages here name.
 */
function groupBy<T>(entities: readonly T[], keyOf: (entity: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const entity of entities) {
    const key = keyOf(entity);
    const group = groups.get(key);
    if (group) {
      group.push(entity);
    } else {
      groups.set(key, [entity]);
    }
  }

  return groups;
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
  const generatorScope = scopeFor(config, FORMULA_OWNER.CURVE_GENERATOR);

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
  const rollScope = scopeFor(config, FORMULA_OWNER.ROLL_INPUT);
  const ladderIds = new Set((config.diceLadders ?? []).map((ladder) => ladder.id));

  return (config.rollDefinitions ?? []).flatMap((roll) =>
    rollDefinitionErrors(roll, rollScope, ladderIds)
  );
}

/**
 * Placeholders in a spell effect that would not compute (v4 systems/13 gap 4, TICKET-SPL-03)
 *
 * A spell effect is prose, and the **placeholders inside it** are formulas judged against their own
 * row of the scoping table — `templateFormulas` is what separates the two, so the prose is never
 * handed to a validator that would report every English word as an undefined variable.
 *
 * **Every placeholder is reported, not just the first**, because a sentence reading two cells can be
 * wrong about both and a User fixing one at a time would meet the same dialog twice. The message
 * quotes the placeholder's own source: a spell named once with three of them needs to say *which*.
 *
 * A spell with no placeholders — 92 of the workbook's 418 effects are plain text — produces nothing
 * at all, which is why this cannot make the corpus noisier than it was.
 *
 * @param config - The ruleset to check
 * @returns One issue per error in a placeholder
 */
function spellEffectIssues(config: Configuration): ValidationIssue[] {
  const scope = scopeFor(config, FORMULA_OWNER.SPELL_EFFECT);

  return (config.spells ?? []).flatMap((spell) => {
    const placeholders = templateFormulas(spell.effectTemplate);

    return placeholders.flatMap((source) =>
      validateFormula(source, scope.codes, scope).errors.map((error) => ({
        severity: 'error' as const,
        category: 'Formula Validation',
        message: `Spell "${spell.name}" effect {${source}}: ${error}`,
        entityType: 'spell',
        entityId: spell.id,
        entityName: spell.name,
      }))
    );
  });
}

/**
 * Placeholders in a passive's effect that would not compute (v4 systems/14, TICKET-PAS-01)
 *
 * {@link spellEffectIssues}' rule over the other templating entity, at the same attachment point:
 * two of the workbook's 26 passives read a skill level, so a passive can be as broken as a spell and
 * in exactly the same way.
 *
 * **Deliberately a second function rather than a shared one parameterised over the collection.**
 * This is the *second* instance, and the house rule is to abstract on the third — the two differ
 * only in which array and which field, so a generic version would be an abstraction with one shape
 * to serve and nothing yet to learn from. The day a third templating entity arrives, this pair and
 * `dependencies.ts`'s `formulaSources` rows are the ones to fold together.
 *
 * @param config - The ruleset to check
 * @returns One issue per error in a placeholder
 */
function passiveEffectIssues(config: Configuration): ValidationIssue[] {
  const scope = scopeFor(config, FORMULA_OWNER.SPELL_EFFECT);

  return (config.passives ?? []).flatMap((passive) => {
    const placeholders = templateFormulas(passive.effectText);

    return placeholders.flatMap((source) =>
      validateFormula(source, scope.codes, scope).errors.map((error) => ({
        severity: 'error' as const,
        category: 'Formula Validation',
        message: `Passive "${passive.name}" effect {${source}}: ${error}`,
        entityType: 'passive',
        entityId: passive.id,
        entityName: passive.name,
      }))
    );
  });
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
  return [...groupBy(entities, slugOf).entries()]
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
